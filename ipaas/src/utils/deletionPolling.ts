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

/** Anything a list can report as mid-deletion. */
interface Deletable {
  deleting?: boolean;
}

/** Cadence for re-checking a list that still holds a finalizing resource. */
export const DELETING_POLL_INTERVAL_MS = 3000;

/**
 * `refetchInterval` for a list whose entries vanish only once their finalizers clear.
 * Reads the unselected cache, so a caller filtering deleting entries out still polls them away.
 */
export function pollWhileDeleting<T extends Deletable>(query: { state: { data?: T[] } }): number | false {
  return query.state.data?.some((item) => item.deleting) ? DELETING_POLL_INTERVAL_MS : false;
}
