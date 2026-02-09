/**
 * Copyright (c) 2025, WSO2 LLC. (https://www.wso2.com).
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

import type { McpServer } from './types'

export const mockMcpServers: McpServer[] = [
  { id: '1', action: 'Customer Support MCP', user: 'System', timestamp: '2 months ago' },
  { id: '2', action: 'Order Processing MCP', user: 'System', timestamp: '3 months ago' },
  { id: '3', action: 'Fraud Detection MCP', user: 'System', timestamp: '5 months ago' },
  { id: '4', action: 'Notification Dispatcher MCP', user: 'System', timestamp: '7 months ago' },
]
