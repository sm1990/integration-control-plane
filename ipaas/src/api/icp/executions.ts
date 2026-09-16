/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// TODO: implement using icp APIs
const ni = (name: string): never => {
  throw new Error(`[icp] executions.${name}: not implemented`);
};

export const fetchExecutionConfigs = (..._args: unknown[]): never => ni('fetchExecutionConfigs');
export const fetchTaskExecutions = (..._args: unknown[]): never => ni('fetchTaskExecutions');
export const fetchRuntimeArguments = (..._args: unknown[]): never => ni('fetchRuntimeArguments');
export const fetchExecutionArguments = (..._args: unknown[]): never => ni('fetchExecutionArguments');
export const fetchExecutionLogs = (..._args: unknown[]): never => ni('fetchExecutionLogs');
export const fetchTaskExecutionCount = (..._args: unknown[]): never => ni('fetchTaskExecutionCount');
export const updateJobConfigs = (..._args: unknown[]): never => ni('updateJobConfigs');
export const stopSchedule = (..._args: unknown[]): never => ni('stopSchedule');
export const triggerTask = (..._args: unknown[]): never => ni('triggerTask');
export const triggerComponentRun = (..._args: unknown[]): never => ni('triggerComponentRun');
