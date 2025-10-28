// Copyright (c) 2025, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
//
// WSO2 Inc. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
//  http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import icp_server.storage;

import ballerina/log;
import ballerina/task;

// Start the offline runtime scheduler
function init() returns error? {

    // Start a worker to periodically mark runtimes as OFFLINE if they haven't sent a heartbeat within the timeout
    worker offlineRuntimeSchedulerWorker {
        task:JobId|error id = task:scheduleJobRecurByFrequency(new Job(), <decimal>schedulerIntervalSeconds);
        if (id is error) {
            log:printError("Failed to schedule offline runtime job", id);
        }
    }

    // Start a worker to periodically clean up expired and revoked refresh tokens
    worker refreshTokenCleanupWorker {
        task:JobId|error id = task:scheduleJobRecurByFrequency(new RefreshTokenCleanupJob(), <decimal>refreshTokenCleanupIntervalSeconds);
        if (id is error) {
            log:printError("Failed to schedule refresh token cleanup job", id);
        } else {
            log:printInfo("Refresh token cleanup job scheduled successfully", 
                intervalSeconds = refreshTokenCleanupIntervalSeconds);
        }
    }
}

// Creates a job to be executed by the scheduler.
class Job {

    *task:Job;

    // Executes this function when the scheduled trigger fires.
    public function execute() {
        do {
            check storage:markOfflineRuntimes();
            log:printDebug("Updated offline runtimes successfully");
        } on fail error e {
            log:printError("Failed to update offline runtimes", e);
        }

    }

}
