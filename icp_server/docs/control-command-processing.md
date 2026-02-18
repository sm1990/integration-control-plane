# Control Command Processing

This document describes how control commands are created, stored, delivered, and executed for both BI (Ballerina Integrator) and MI (Micro Integrator) runtimes.

---

## Overview

Control commands change the state of artifacts running on runtimes. There are two triggers:

1. **User-initiated (GraphQL mutations)** -- a user explicitly changes an artifact's status or tracing.
2. **Heartbeat-initiated (intended state sync)** -- a runtime registers or heartbeats, and the system detects its current state differs from the intended state.

Both paths write a record to the control commands table. The key difference is how the command reaches the runtime:

| | BI | MI |
|---|---|---|
| **Delivery** | Returned in the heartbeat response | Sent via async HTTP POST to the runtime's management API |
| **Actions** | `START`, `STOP` | `ARTIFACT_ENABLE`, `ARTIFACT_DISABLE`, `ARTIFACT_ENABLE_TRACING`, `ARTIFACT_DISABLE_TRACING` |
| **Artifact scope** | Services, Listeners | 12+ types (APIs, Proxy Services, Endpoints, Sequences, Tasks, etc.) |
| **Intended state tables** | 1 (`bi_artifact_intended_state`) | 2 (`mi_artifact_intended_status`, `mi_artifact_intended_tracing`) |

---

## BI Control Commands

### Tables

- `bi_runtime_control_commands` -- one row per command, keyed by `command_id` (UUID).
- `bi_artifact_intended_state` -- one row per `(component_id, target_artifact)`, stores the desired action.

### Flow 1: User changes a listener state (mutation)

Trigger: `updateListenerState` GraphQL mutation (`graphql_api.bal`).

```
1. Validate input and check PERMISSION_INTEGRATION_MANAGE.
2. For each target runtime:
   a. insertControlCommand(runtimeId, listenerName, action, userId)
      -> INSERT into bi_runtime_control_commands with status='pending'.
      -> Returns the generated command_id.
3. Record intended state:
   upsertBIArtifactIntendedState(componentId, listenerName, action, userId)
4. Return the list of command IDs to the caller.
```

The command sits in `pending` status until the next heartbeat from that runtime picks it up.

### Flow 2: Heartbeat retrieves and delivers pending commands

Trigger: `processHeartbeat` or `processDeltaHeartbeat` (`heartbeat_repository.bal`).

```
1. Inside a DB transaction:
   a. Upsert the runtime and its artifacts.
   b. processIntendedStates() -> checkBIIntendedStatesAndInsertCommands():
      - Fetch intended states for the component.
      - Compare each artifact's current state (from heartbeat payload)
        against its intended state.
      - If they differ, insertControlCommand() to create a new pending command.
   c. sendPendingBIControlCommands(runtimeId):
      - SELECT ... WHERE status='pending' FOR UPDATE
        (locks rows to prevent duplicate delivery by concurrent heartbeats).
      - For each command: UPDATE status='sent'.
      - Return the ControlCommand[] array.
2. Include the commands in the HeartbeatResponse.
```

The BI runtime receives the commands as part of the heartbeat response and executes them.

### Flow 3: Intended state sync on runtime registration

When a BI runtime sends its first heartbeat, `processIntendedStates` runs and compares the runtime's reported artifact states against intended states. If a mismatch is found (e.g., a listener is disabled but the intended state is START), a pending command is inserted. It is then picked up by `sendPendingBIControlCommands` in the same transaction.

---

## MI Control Commands

### Tables

- `mi_runtime_control_commands` -- one row per `(runtime_id, component_id, artifact_name, artifact_type)`. Uses UPSERT semantics (a new command for the same artifact overwrites the previous one).
- `mi_artifact_intended_status` -- intended enable/disable state per `(component_id, artifact_name, artifact_type)`.
- `mi_artifact_intended_tracing` -- intended tracing state per `(component_id, artifact_name, artifact_type)`.

### Status lifecycle

```
Heartbeat path:            pending  -->  sent  (HTTP fired during heartbeat processing)
Mutation (RUNNING):        sent                (inserted directly as 'sent', HTTP fired immediately)
Mutation (OFFLINE):        pending  -->  sent  (queued; delivered on next heartbeat)
```

### Flow 1: User changes artifact status (mutation)

Trigger: `updateArtifactStatus` GraphQL mutation (`graphql_api.bal`).

```
1. Validate input and check PERMISSION_INTEGRATION_EDIT or PERMISSION_INTEGRATION_MANAGE.
2. Determine action: ARTIFACT_ENABLE (if status=="active") or ARTIFACT_DISABLE.
3. Record intended state:
   upsertMIArtifactIntendedStatus(componentId, artifactName, artifactType, action, userId)
4. For each MI runtime in the component:
   IF runtime.status == RUNNING:
     a. insertMIControlCommand(..., status="sent", issuedBy=userId)
        -> UPSERT with status='sent' and sent_at=CURRENT_TIMESTAMP.
     b. sendMIControlCommandAsync(runtimeId, artifactType, artifactName, actionStr)
        -> POST /icp/artifacts/status (fire-and-forget).
   IF runtime.status == OFFLINE:
     a. insertMIControlCommand(..., status="pending", issuedBy=userId)
        -> UPSERT with status='pending' and sent_at=NULL.
        -> Command will be picked up by sendPendingMIControlCommands()
           when the runtime comes back online and sends a heartbeat.
5. Return success/failure counts.
```

### Flow 2: User changes artifact tracing (mutation)

Trigger: `updateArtifactTracingStatus` GraphQL mutation (`graphql_api.bal`).

Identical to Flow 1 except:
- Action: `ARTIFACT_ENABLE_TRACING` or `ARTIFACT_DISABLE_TRACING`.
- Intended state table: `mi_artifact_intended_tracing`.
- HTTP endpoint: `POST /icp/artifacts/tracing` with payload `{type, name, trace: "enable"/"disable"}`.

### Flow 3: Heartbeat sends pending commands

Trigger: `processHeartbeat` or `processDeltaHeartbeat` (`heartbeat_repository.bal`).

```
1. Inside a DB transaction:
   a. Upsert the runtime and its artifacts.
   b. processIntendedStates() -> checkMIIntendedStatesAndInsertCommands():
      - Fetch intended states (both status and tracing) for the component.
      - For each intended state, query the runtime's artifact table to get
        the current state/tracing value.
      - processMIControlCommand():
        - Compare intended action vs current state.
        - If mismatch: insertMIControlCommand() with status='pending'.
   c. sendPendingMIControlCommands(runtimeId):
      - SELECT ... WHERE status='pending' FOR UPDATE.
      - For each command:
        - sendMIControlCommandAsync() (fire HTTP POST).
        - UPDATE status='sent', sent_at=CURRENT_TIMESTAMP.
2. Return HeartbeatResponse (MI commands are NOT included in the response).
```

### Flow 4: Intended state sync on runtime registration

Same as heartbeat Flow 3. When an MI runtime first registers, `checkMIIntendedStatesAndInsertCommands` compares the reported artifact states against intended states and inserts `pending` commands for any mismatches. These are then sent in `sendPendingMIControlCommands`.

### MI async HTTP delivery details

`sendMIControlCommandAsync` (`repository_common.bal`):

1. Look up runtime to get `managementHostname` and `managementPort`.
2. Create an HTTPS client to `https://{host}:{port}`.
3. Generate an HMAC JWT bearer token.
4. Determine the endpoint and payload:
   - Enable/Disable: `POST /icp/artifacts/status` with `{type, name, status: "active"|"inactive"}`.
   - Enable/Disable tracing: `POST /icp/artifacts/tracing` with `{type, name, trace: "enable"|"disable"}`.
5. Fire the request. Log the outcome but do not propagate errors.

---

## Intended State Mechanism

Intended states ensure that newly registered or reconnecting runtimes converge to the desired artifact state without requiring the user to re-issue commands.

**When an intended state is recorded:**
- `updateListenerState` mutation (BI) -- calls `upsertBIArtifactIntendedState`.
- `updateArtifactStatus` mutation (MI) -- calls `upsertMIArtifactIntendedStatus`.
- `updateArtifactTracingStatus` mutation (MI) -- calls `upsertMIArtifactIntendedTracing`.

**When an intended state is checked:**
- Every heartbeat (full or delta) triggers `processIntendedStates`, which calls the appropriate BI/MI function to compare current vs intended and insert commands for mismatches.

**When an intended state is deleted:**
- `deleteBIArtifactIntendedState`, `deleteMIArtifactIntendedStatus`, `deleteMIArtifactIntendedTracing` -- called when the intended state is no longer relevant (e.g., artifact removed).

---

## Key Files

| File | Responsibility |
|---|---|
| `graphql_api.bal` | Mutation entry points: `updateListenerState`, `updateArtifactStatus`, `updateArtifactTracingStatus` |
| `modules/storage/heartbeat_repository.bal` | Heartbeat processing, intended state comparison, command insertion during sync |
| `modules/storage/repository_common.bal` | CRUD operations: insert/send/mark commands, UPSERT intended states, async HTTP delivery |
| `modules/types/types.bal` | Type definitions: `ControlCommand`, `MIRuntimeControlCommand`, enums, DB record types |
| `resources/db/init-scripts/` | Table schemas for all supported databases (H2, PostgreSQL, MySQL, MSSQL) |

---

## Test Scenarios

### BI Control Commands

1. **Listener state change via mutation**
   - Call `updateListenerState` with action=START for a registered BI runtime.
   - Verify a `pending` command is inserted into `bi_runtime_control_commands`.
   - Verify the intended state is recorded in `bi_artifact_intended_state`.

2. **Pending commands delivered on heartbeat**
   - Insert a pending BI command for a runtime.
   - Send a heartbeat for that runtime.
   - Verify the heartbeat response includes the command.
   - Verify the command status changes from `pending` to `sent`.

3. **Concurrent heartbeats do not duplicate delivery**
   - Insert a pending BI command.
   - Simulate two concurrent heartbeats for the same runtime.
   - Verify the command is delivered in exactly one response (FOR UPDATE lock).

4. **Intended state sync on registration**
   - Set an intended state (e.g., STOP) for a BI artifact.
   - Register a new runtime whose heartbeat reports that artifact as ENABLED.
   - Verify a STOP command is automatically created and delivered.

5. **No command when state matches**
   - Set intended state START for a BI artifact.
   - Send a heartbeat where the artifact is already ENABLED.
   - Verify no new command is created.

6. **Intended state removed**
   - Delete a BI intended state.
   - Register a new runtime with a mismatched artifact state.
   - Verify no command is created (no intended state to compare against).

### MI Control Commands

7. **Artifact status change via mutation (RUNNING runtime)**
   - Call `updateArtifactStatus` with status="active" for a component with a RUNNING MI runtime.
   - Verify a command is inserted with status=`sent` and `sent_at` is set.
   - Verify the intended state is recorded in `mi_artifact_intended_status`.
   - Verify an HTTP POST is fired to `/icp/artifacts/status`.

8. **Artifact status change via mutation (OFFLINE runtime)**
   - Call `updateArtifactStatus` with status="active" for a component with an OFFLINE MI runtime.
   - Verify a command is inserted with status=`pending` and `sent_at` is NULL.
   - Verify no HTTP POST is fired.
   - Verify the intended state is still recorded in `mi_artifact_intended_status`.
   - Send a heartbeat for that runtime (simulating it coming back online).
   - Verify `sendPendingMIControlCommands` picks up the command and fires the HTTP POST.
   - Verify the command status changes from `pending` to `sent`.

9. **Artifact tracing change via mutation (RUNNING runtime)**
   - Call `updateArtifactTracingStatus` with trace="enable" for a RUNNING MI runtime.
   - Verify a command is inserted with status=`sent` and `sent_at` is set.
   - Verify the intended state is recorded in `mi_artifact_intended_tracing`.
   - Verify an HTTP POST is fired to `/icp/artifacts/tracing`.

10. **Artifact tracing change via mutation (OFFLINE runtime)**
    - Call `updateArtifactTracingStatus` with trace="enable" for an OFFLINE MI runtime.
    - Verify a command is inserted with status=`pending` and `sent_at` is NULL.
    - Verify no HTTP POST is fired.
    - Verify the command is delivered on the next heartbeat.

11. **Heartbeat-triggered pending command delivery**
    - Insert a `pending` MI command for a runtime (simulating intended state sync).
    - Send a heartbeat for that runtime.
    - Verify `sendMIControlCommandAsync` is called for the command.
    - Verify the command status changes from `pending` to `sent` with `sent_at` populated.

12. **UPSERT overwrites existing command**
    - Insert an MI command (ARTIFACT_ENABLE, status=pending) for a runtime+artifact.
    - Insert another command (ARTIFACT_DISABLE) for the same runtime+artifact.
    - Verify only one row exists and the action is ARTIFACT_DISABLE with reset timestamps.

13. **Intended state sync on MI runtime registration**
    - Set an intended status (ARTIFACT_DISABLE) and intended tracing (ARTIFACT_ENABLE_TRACING) for an MI artifact.
    - Register a new MI runtime whose heartbeat reports that artifact as enabled with tracing off.
    - Verify two pending commands are created (one for disable, one for enable tracing).
    - Verify both are sent during the same heartbeat processing.

14. **No command when MI state matches**
    - Set intended status ARTIFACT_ENABLE for an MI artifact.
    - Send a heartbeat where the artifact is already active.
    - Verify no new command is created.

15. **Mixed RUNNING and OFFLINE runtimes in a component**
    - Register two MI runtimes under the same component: one RUNNING, one OFFLINE.
    - Call `updateArtifactStatus`.
    - Verify the RUNNING runtime gets a command with status=`sent` and HTTP is fired.
    - Verify the OFFLINE runtime gets a command with status=`pending` and no HTTP is fired.
    - Verify success counts include both runtimes.
    - Bring the OFFLINE runtime online (send heartbeat).
    - Verify the pending command is delivered during heartbeat processing.

16. **MI command HTTP failure does not block the flow**
    - Simulate an unreachable RUNNING MI runtime (management API down).
    - Call `updateArtifactStatus`.
    - Verify the command is still inserted with status=`sent`.
    - Verify the mutation returns success (fire-and-forget semantics).

### Cross-cutting

17. **Multi-database dialect support**
    - Run the UPSERT operations (`insertMIControlCommand`, `upsertBIArtifactIntendedState`, etc.) against each supported database (H2, PostgreSQL, MySQL, MSSQL).
    - Verify correct INSERT and UPDATE behavior, including conditional `sent_at` handling.

18. **Authorization**
    - Verify `updateListenerState` requires `PERMISSION_INTEGRATION_MANAGE`.
    - Verify `updateArtifactStatus` and `updateArtifactTracingStatus` require `PERMISSION_INTEGRATION_EDIT` or `PERMISSION_INTEGRATION_MANAGE`.
    - Verify unauthorized requests are rejected.
