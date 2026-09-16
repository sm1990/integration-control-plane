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

import { describe, expect, it } from 'vitest';
import { msUntilNextWindow, totpCode } from './totp';

// RFC 6238 appendix B, SHA-1 rows. The ASCII seed "12345678901234567890" is
// GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ in base32. A wrong implementation here surfaces
// as GitHub rejecting the code, which looks like a bad secret rather than a bug.
const RFC_SEED = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totpCode', () => {
  it.each([
    [59_000, '287082'],
    [1_111_111_109_000, '081804'],
    [1_111_111_111_000, '050471'],
    [1_234_567_890_000, '005924'],
    [2_000_000_000_000, '279037'],
  ])('matches the RFC 6238 vector at %i', (atMs, expected) => {
    expect(totpCode(RFC_SEED, atMs)).toBe(expected);
  });

  it('accepts a secret with the spacing and casing GitHub displays', () => {
    expect(totpCode(' gezdgnbv gy3tqojq gezdgnbv gy3tqojq ', 59_000)).toBe('287082');
  });

  it('holds the code steady inside one 30 second window', () => {
    expect(totpCode(RFC_SEED, 30_000)).toBe(totpCode(RFC_SEED, 59_999));
  });

  it('changes the code across a window boundary', () => {
    expect(totpCode(RFC_SEED, 59_999)).not.toBe(totpCode(RFC_SEED, 60_000));
  });
});

describe('msUntilNextWindow', () => {
  it('never reports more than a full window or less than nothing', () => {
    const remaining = msUntilNextWindow();
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(30_000);
  });
});
