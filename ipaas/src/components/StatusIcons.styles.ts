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

/** Filled circle behind a glyph — the shared shape of the success/queued/skipped/failed icons. */
export const statusCircleSx = (size: number, bgcolor: string, color: string) =>
  ({
    width: size,
    height: size,
    borderRadius: '50%',
    bgcolor,
    color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }) as const;

export const spinnerSx = {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  color: 'primary.main',
  animation: 'spin 3s linear infinite',
  '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
} as const;

export const warningSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: 'warning.main',
} as const;
