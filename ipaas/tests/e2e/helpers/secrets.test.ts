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

import { afterEach, describe, expect, it } from 'vitest';
import { readSecret } from './secrets';

const NAME = 'E2E_SECRETS_SPEC_FIXTURE';

afterEach(() => {
  delete process.env[NAME];
});

describe('readSecret', () => {
  it('returns undefined for a variable that was never set', () => {
    expect(readSecret(NAME)).toBeUndefined();
  });

  // docker run --env-file assigns values verbatim, quotes included, while dotenv-cli
  // strips them — so the same .env.test has to work through both paths.
  it.each([
    ['"quoted"', 'quoted'],
    ["'quoted'", 'quoted'],
    ['bare', 'bare'],
    ['  padded  ', 'padded'],
    ['"  padded inside quotes  "', '  padded inside quotes  '],
  ])('reads %j as %j', (raw, expected) => {
    process.env[NAME] = raw;
    expect(readSecret(NAME)).toBe(expected);
  });

  it.each([['"mismatched'], ["mismatched'"], ['"'], ["'"], ['']])('leaves %j alone', (raw) => {
    process.env[NAME] = raw;
    expect(readSecret(NAME)).toBe(raw.trim());
  });

  it('keeps quotes that are part of the value itself', () => {
    process.env[NAME] = 'pa"ss"word';
    expect(readSecret(NAME)).toBe('pa"ss"word');
  });
});
