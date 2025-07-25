import ballerina/time;

// Runtime and system enums
public enum RuntimeType {
    MI,
    BI
}

public enum RuntimeStatus {
    RUNNING,
    FAILED,
    DISABLED,
    OFFLINE
}

public enum ArtifactState {
    ENABLED,
    DISABLED,
    STARTING,
    STOPPING,
    FAILED
}

// Core domain types
public type Node record {
    string platformName = "ballerina";
    string platformVersion?;
    string platformHome?;
    string osName?;
    string osVersion?;
};

public type Runtime record {
    string runtimeId;
    RuntimeType runtimeType;
    RuntimeStatus status;
    string environment?;
    string deploymentType?;
    string version?;
    Node nodeInfo;
    Artifacts artifacts;
    time:Utc registrationTime?;
    time:Utc lastHeartbeat?;
};

public type Heartbeat record {
    string runtimeId;
    RuntimeStatus status;
    Artifacts artifacts;
    time:Utc timestamp;
};


public type Artifacts record {
    ListenerDetail[] listeners;
    ServiceDetail[] services;
};

public type Artifact record {
    string name;
};

public type ServiceDetail record {
    *Artifact;
    ArtifactState state?;
    string? basePath;
    string package;
    Artifact[] listeners;
    Resource[] resources;
};

public type Resource record {
    string[] methods;
    string url;
};

public type ListenerDetail record {
    *Artifact;
    string protocol?;
    string package;
    ArtifactState state?;
};

// API Response types
public type RuntimeRegistrationResponse record {
    boolean success;
    string message?;
    string[] errors?;
};

public type HeartbeatResponse record {
    boolean acknowledged;
    ControlCommand[] commands?;
};

public type ControlCommand record {
    string commandId;
    string runtimeId;
    string targetArtifact;
    string action;
    time:Utc issuedAt;
    string status; // pending, sent, acknowledged, failed
};

// Summary and view types
public type RuntimeSummary record {
    string runtimeId;
    RuntimeType runtimeType;
    RuntimeStatus status;
    string environment?;
    int totalServices;
    int totalListeners;
    time:Utc lastHeartbeat?;
    boolean isOnline;
};

public type IntegrationSummary record {
    string runtimeId;
    string artifactName;
    string artifactType; // service or listener
    ArtifactState state;
    string package;
};

// Authentication types
public type UserClaims record {
    string sub;
    string[] roles;
    int exp;
};

// API response wrapper
public type ApiResponse record {
    boolean success;
    string message?;
    json data?;
    string[] errors?;
};