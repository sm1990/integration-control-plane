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

import * as OTPAuth from 'otpauth';

// SHA-1 / 6 digits / 30s — the parameters GitHub issues.
export function totpCode(secret: string, atMs?: number): string {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret.replace(/\s+/g, '').toUpperCase()),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
  return atMs === undefined ? totp.generate() : totp.generate({ timestamp: atMs });
}

/** Milliseconds until the current TOTP window rolls over. */
export function msUntilNextWindow(period = 30): number {
  const elapsed = (Date.now() / 1000) % period;
  return Math.ceil((period - elapsed) * 1000);
}
