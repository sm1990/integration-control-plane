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
import { httpStatusOf, isNotFoundError, isUnsupportedError } from './apiErrors';

describe('httpStatusOf', () => {
  it('prefers a structured status field over the message', () => {
    // BffError carries `status`; trust it rather than parsing the text.
    expect(httpStatusOf(Object.assign(new Error('HTTP 500: masked'), { status: 404 }))).toBe(404);
  });

  it('falls back to the message for wip GraphQL errors', () => {
    expect(httpStatusOf(new Error('GraphQL request failed (HTTP 404): nope'))).toBe(404);
    expect(httpStatusOf(new Error('HTTP 503: unavailable'))).toBe(503);
  });

  it('returns NaN when no status is present', () => {
    expect(httpStatusOf(new Error('Network request failed'))).toBeNaN();
    expect(httpStatusOf(null)).toBeNaN();
  });

  it('ignores a non-numeric status field', () => {
    expect(httpStatusOf(Object.assign(new Error('HTTP 404: x'), { status: 'nope' }))).toBe(404);
  });
});

describe('isNotFoundError', () => {
  it('matches an HTTP 404', () => {
    expect(isNotFoundError(new Error('HTTP 404 Not Found'))).toBe(true);
  });

  it('matches a BffError carrying status 404', () => {
    expect(isNotFoundError(Object.assign(new Error('HTTP 404: not found'), { status: 404 }))).toBe(true);
  });

  it('does not match other status codes', () => {
    expect(isNotFoundError(new Error('HTTP 500 Internal Server Error'))).toBe(false);
    expect(isNotFoundError(new Error('HTTP 4040 weird'))).toBe(false);
  });

  it('reads a bare message string as well as an Error', () => {
    expect(isNotFoundError('HTTP 404: not found')).toBe(true);
  });

  it('tolerates values carrying no status', () => {
    expect(isNotFoundError('nope')).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError(undefined)).toBe(false);
  });
});

describe('isUnsupportedError', () => {
  it('matches the not-implemented stubs thrown by the cloud and icp API layers', () => {
    expect(isUnsupportedError(new Error('[cloud] executions.fetchRuntimeArguments: not implemented'))).toBe(true);
    expect(isUnsupportedError(new Error('[icp] governance.fetchPolicies: not implemented'))).toBe(true);
  });

  it('does not match a genuine server failure', () => {
    expect(isUnsupportedError(new Error('HTTP 500 failed to list execution history'))).toBe(false);
    expect(isUnsupportedError(new Error('Network request failed'))).toBe(false);
  });

  it('tolerates non-Error values', () => {
    expect(isUnsupportedError('not implemented')).toBe(false);
    expect(isUnsupportedError(null)).toBe(false);
  });
});
