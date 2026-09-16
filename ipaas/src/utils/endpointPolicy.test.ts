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
import { configToPolicy, corsFromPolicy, corsToPolicy, policyToConfig, rateLimitFromPolicy, rateLimitToPolicy, toRateLimitOperations } from './endpointPolicy';
import { DEFAULT_CORS_HEADERS, DEFAULT_CORS_METHODS } from '../constants/policy';
import type { CorsConfig, RateLimitConfig } from '../types/policy';

describe('corsFromPolicy', () => {
  it('seeds headers and methods when CORS has never been configured, so a first enable allows something', () => {
    const value = corsFromPolicy(undefined);
    expect(value.enabled).toBe(false);
    expect(value.headers).toEqual(DEFAULT_CORS_HEADERS);
    expect(value.methods).toEqual(DEFAULT_CORS_METHODS);
  });

  it('reads the wildcard origin back as the allow-all checkbox rather than a literal tag', () => {
    const value = corsFromPolicy({ enabled: true, allowOrigins: ['*'], allowCredentials: true });
    expect(value.allowAllOrigins).toBe(true);
    expect(value.origins).toEqual([]);
    expect(value.allowCredentials).toBe(true);
  });

  it('keeps explicit origins as tags', () => {
    const value = corsFromPolicy({ enabled: true, allowOrigins: ['https://a.example', 'https://b.example'], allowCredentials: false });
    expect(value.allowAllOrigins).toBe(false);
    expect(value.origins).toEqual(['https://a.example', 'https://b.example']);
  });
});

describe('corsToPolicy', () => {
  const enabled: CorsConfig = { enabled: true, allowAllOrigins: false, origins: ['https://a.example'], headers: ['authorization'], methods: ['GET'], allowCredentials: true };

  it('sends allow-all as the wildcard origin', () => {
    expect(corsToPolicy({ ...enabled, allowAllOrigins: true }).allowOrigins).toEqual(['*']);
  });

  it('sends nothing but the off switch when disabled, so the policy is removed rather than narrowed', () => {
    expect(corsToPolicy({ ...enabled, enabled: false })).toEqual({ enabled: false, allowCredentials: false });
  });

  it('drops credentials when all origins are allowed', () => {
    const out = corsToPolicy({ ...enabled, allowAllOrigins: true, allowCredentials: true });
    expect(out.allowOrigins).toEqual(['*']);
    expect(out.allowCredentials).toBe(false);
  });

  it('drops credentials when a literal * is typed as an origin', () => {
    const out = corsToPolicy({ ...enabled, allowAllOrigins: false, origins: ['*'], allowCredentials: true });
    expect(out.allowOrigins).toEqual(['*']);
    expect(out.allowCredentials).toBe(false);
  });

  it('round-trips an enabled config', () => {
    expect(corsFromPolicy(corsToPolicy(enabled))).toEqual(enabled);
  });
});

describe('rateLimitFromPolicy', () => {
  it('defaults to unlimited when the API carries no limit', () => {
    expect(rateLimitFromPolicy(undefined).level).toBe('UNLIMITED');
  });

  it('maps an API-wide limit', () => {
    const value = rateLimitFromPolicy({ level: 'api', requestCount: 5, timeUnit: 'HOUR' });
    expect(value).toMatchObject({ level: 'API_LEVEL', requestCount: '5', timeUnit: 'HOUR' });
  });

  it('maps per-operation limits, keyed as the backend keys them', () => {
    const value = rateLimitFromPolicy({ level: 'resource', operations: { 'GET /pets': { requestCount: 2, timeUnit: 'MINUTE' } } });
    expect(value.level).toBe('RESOURCE_LEVEL');
    expect(value.operations).toEqual({ 'GET /pets': { requestCount: '2', timeUnit: 'MINUTE' } });
  });

  it('falls back to MINUTE for a unit the selector cannot show', () => {
    expect(rateLimitFromPolicy({ level: 'api', requestCount: 1, timeUnit: 'FORTNIGHT' as never }).timeUnit).toBe('MINUTE');
  });
});

describe('rateLimitToPolicy', () => {
  it('drops operations left blank so they stay unlimited instead of being rejected as zero', () => {
    const value: RateLimitConfig = {
      level: 'RESOURCE_LEVEL',
      requestCount: '',
      timeUnit: 'MINUTE',
      operations: { 'GET /pets': { requestCount: '2', timeUnit: 'MINUTE' }, 'POST /pets': { requestCount: '', timeUnit: 'MINUTE' } },
    };
    expect(rateLimitToPolicy(value).operations).toEqual({ 'GET /pets': { requestCount: 2, timeUnit: 'MINUTE' } });
  });

  it('saves as unlimited when every operation row was left blank', () => {
    const value: RateLimitConfig = { level: 'RESOURCE_LEVEL', requestCount: '', timeUnit: 'MINUTE', operations: { 'GET /pets': { requestCount: '', timeUnit: 'MINUTE' } } };
    expect(rateLimitToPolicy(value)).toEqual({ level: 'unlimited' });
  });

  it('sends only the level when unlimited', () => {
    expect(rateLimitToPolicy({ level: 'UNLIMITED', requestCount: '9', timeUnit: 'DAY' })).toEqual({ level: 'unlimited' });
  });

  it('round-trips an API-wide limit', () => {
    const value: RateLimitConfig = { level: 'API_LEVEL', requestCount: '7', timeUnit: 'DAY', operations: {} };
    expect(rateLimitFromPolicy(rateLimitToPolicy(value))).toMatchObject({ level: 'API_LEVEL', requestCount: '7', timeUnit: 'DAY' });
  });
});

describe('toRateLimitOperations', () => {
  it('maps the API routes onto the rows the rate-limit section renders', () => {
    expect(toRateLimitOperations([{ key: 'GET /pets', method: 'GET', path: '/pets' }])).toEqual([{ key: 'GET /pets', verb: 'GET', target: '/pets' }]);
  });

  it('is empty when the API reports no routes, which hides the per-operation choice', () => {
    expect(toRateLimitOperations(undefined)).toEqual([]);
  });
});

describe('policyToConfig / configToPolicy', () => {
  it('round-trips a full configuration', () => {
    const wire = {
      cors: { enabled: true, allowOrigins: ['*'], allowMethods: ['GET'], allowHeaders: ['authorization'], allowCredentials: false },
      rateLimit: { level: 'api' as const, requestCount: 3, timeUnit: 'MINUTE' as const },
    };
    const { cors, rateLimit } = policyToConfig(wire);
    expect(configToPolicy(cors, rateLimit)).toEqual(wire);
  });
});
