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
import { applyCors, applyRateLimit, corsFromApi, isRateLimitValid, rateLimitFromApi } from './policy';
import { DEFAULT_CORS_HEADERS, DEFAULT_CORS_METHODS } from '../constants/policy';
import type { ApimApiInfo } from '../types/apim';
import type { CorsConfig, RateLimitConfig } from '../types/policy';

const baseApi: ApimApiInfo = {
  id: 'api-1',
  name: 'api',
  displayName: 'Api',
  version: '1.0.0',
  lifeCycleStatus: 'PUBLISHED',
};

describe('rateLimitFromApi', () => {
  it('returns UNLIMITED with no request count when api is null', () => {
    expect(rateLimitFromApi(null)).toEqual({ level: 'UNLIMITED', requestCount: '', timeUnit: 'MINUTE' });
  });

  it('returns UNLIMITED with no request count when api is undefined', () => {
    expect(rateLimitFromApi(undefined)).toEqual({ level: 'UNLIMITED', requestCount: '', timeUnit: 'MINUTE' });
  });

  it('derives API_LEVEL from throttlingLimit.requestCount', () => {
    const api: ApimApiInfo = { ...baseApi, throttlingLimit: { requestCount: 50, unit: 'HOUR' } };
    expect(rateLimitFromApi(api)).toEqual({ level: 'API_LEVEL', requestCount: '50', timeUnit: 'HOUR' });
  });

  it('falls back to apiThrottlingPolicy for the request count when throttlingLimit is absent', () => {
    const api: ApimApiInfo = { ...baseApi, apiThrottlingPolicy: '20PerMin' };
    expect(rateLimitFromApi(api)).toEqual({ level: 'API_LEVEL', requestCount: '20PerMin', timeUnit: 'MINUTE' });
  });

  it('treats a count of -1 as unlimited request count text', () => {
    const api: ApimApiInfo = { ...baseApi, apiThrottlingPolicy: '-1', throttlingLimit: { requestCount: -1, unit: 'MINUTE' } };
    expect(rateLimitFromApi(api)).toEqual({ level: 'API_LEVEL', requestCount: '', timeUnit: 'MINUTE' });
  });

  it('falls back to MINUTE when the unit is not a known TimeUnit', () => {
    const api: ApimApiInfo = { ...baseApi, throttlingLimit: { requestCount: 10, unit: 'WEEK' } };
    expect(rateLimitFromApi(api)).toEqual({ level: 'API_LEVEL', requestCount: '10', timeUnit: 'MINUTE' });
  });

  it('is UNLIMITED when neither apiThrottlingPolicy nor a positive requestCount is present', () => {
    const api: ApimApiInfo = { ...baseApi, throttlingLimit: { requestCount: 0, unit: 'DAY' } };
    expect(rateLimitFromApi(api)).toEqual({ level: 'UNLIMITED', requestCount: '', timeUnit: 'DAY' });
  });
});

describe('applyRateLimit', () => {
  it('clears throttling fields when level is UNLIMITED', () => {
    const api: ApimApiInfo = { ...baseApi, apiThrottlingPolicy: '5PerMin', throttlingLimit: { requestCount: 5, unit: 'MINUTE' } };
    const value: RateLimitConfig = { level: 'UNLIMITED', requestCount: '', timeUnit: 'MINUTE' };
    expect(applyRateLimit(api, value)).toEqual({ ...api, apiThrottlingPolicy: null, throttlingLimit: null });
  });

  it('applies a positive integer request count at API_LEVEL', () => {
    const value: RateLimitConfig = { level: 'API_LEVEL', requestCount: '100', timeUnit: 'HOUR' };
    expect(applyRateLimit(baseApi, value)).toEqual({
      ...baseApi,
      apiThrottlingPolicy: '100',
      throttlingLimit: { requestCount: 100, unit: 'HOUR' },
    });
  });

  it('nulls throttlingLimit when the request count is not a positive integer', () => {
    const value: RateLimitConfig = { level: 'API_LEVEL', requestCount: '0', timeUnit: 'MINUTE' };
    expect(applyRateLimit(baseApi, value)).toEqual({
      ...baseApi,
      apiThrottlingPolicy: '0',
      throttlingLimit: null,
    });
  });

  it('nulls apiThrottlingPolicy when the request count string is empty', () => {
    const value: RateLimitConfig = { level: 'API_LEVEL', requestCount: '', timeUnit: 'MINUTE' };
    expect(applyRateLimit(baseApi, value)).toEqual({
      ...baseApi,
      apiThrottlingPolicy: null,
      throttlingLimit: null,
    });
  });
});

describe('isRateLimitValid', () => {
  it('is always valid when UNLIMITED', () => {
    expect(isRateLimitValid({ level: 'UNLIMITED', requestCount: '', timeUnit: 'MINUTE' })).toBe(true);
  });

  it('is valid at API_LEVEL with a positive integer count', () => {
    expect(isRateLimitValid({ level: 'API_LEVEL', requestCount: '10', timeUnit: 'MINUTE' })).toBe(true);
  });

  it('is invalid at API_LEVEL with a zero count', () => {
    expect(isRateLimitValid({ level: 'API_LEVEL', requestCount: '0', timeUnit: 'MINUTE' })).toBe(false);
  });

  it('is invalid at API_LEVEL with an empty count', () => {
    expect(isRateLimitValid({ level: 'API_LEVEL', requestCount: '', timeUnit: 'MINUTE' })).toBe(false);
  });

  it('is invalid at API_LEVEL with a non-numeric count', () => {
    expect(isRateLimitValid({ level: 'API_LEVEL', requestCount: 'abc', timeUnit: 'MINUTE' })).toBe(false);
  });

  it('is invalid at API_LEVEL with a negative count', () => {
    expect(isRateLimitValid({ level: 'API_LEVEL', requestCount: '-5', timeUnit: 'MINUTE' })).toBe(false);
  });
});

describe('corsFromApi', () => {
  it('returns defaults when api is null', () => {
    expect(corsFromApi(null)).toEqual({
      enabled: false,
      allowAllOrigins: false,
      origins: [],
      headers: DEFAULT_CORS_HEADERS,
      methods: DEFAULT_CORS_METHODS,
      allowCredentials: false,
    });
  });

  it('returns defaults when api is undefined', () => {
    expect(corsFromApi(undefined)).toEqual({
      enabled: false,
      allowAllOrigins: false,
      origins: [],
      headers: DEFAULT_CORS_HEADERS,
      methods: DEFAULT_CORS_METHODS,
      allowCredentials: false,
    });
  });

  it('maps an enabled configuration with wildcard origins', () => {
    const api: ApimApiInfo = {
      ...baseApi,
      corsConfiguration: {
        corsConfigurationEnabled: true,
        accessControlAllowOrigins: ['*'],
        accessControlAllowCredentials: true,
        accessControlAllowHeaders: ['X-Custom'],
        accessControlAllowMethods: ['GET'],
      },
    };
    expect(corsFromApi(api)).toEqual({
      enabled: true,
      allowAllOrigins: true,
      origins: [],
      headers: ['X-Custom'],
      methods: ['GET'],
      allowCredentials: true,
    });
  });

  it('filters out the wildcard from explicit origins when other origins are present', () => {
    const api: ApimApiInfo = {
      ...baseApi,
      corsConfiguration: {
        corsConfigurationEnabled: true,
        accessControlAllowOrigins: ['*', 'https://example.com'],
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: [],
        accessControlAllowMethods: [],
      },
    };
    const result = corsFromApi(api);
    expect(result.allowAllOrigins).toBe(true);
    expect(result.origins).toEqual(['https://example.com']);
  });

  it('handles specific, non-wildcard origins', () => {
    const api: ApimApiInfo = {
      ...baseApi,
      corsConfiguration: {
        corsConfigurationEnabled: false,
        accessControlAllowOrigins: ['https://a.com', 'https://b.com'],
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: [],
        accessControlAllowMethods: [],
      },
    };
    const result = corsFromApi(api);
    expect(result.enabled).toBe(false);
    expect(result.allowAllOrigins).toBe(false);
    expect(result.origins).toEqual(['https://a.com', 'https://b.com']);
  });
});

describe('applyCors', () => {
  it('drops credentials when all origins are allowed', () => {
    const value: CorsConfig = {
      enabled: true,
      allowAllOrigins: true,
      origins: [],
      headers: ['authorization'],
      methods: ['GET'],
      allowCredentials: true,
    };
    const cors = applyCors(baseApi, value).corsConfiguration!;
    expect(cors.accessControlAllowOrigins).toEqual(['*']);
    expect(cors.accessControlAllowCredentials).toBe(false);
  });

  it('drops credentials when a literal * is typed as an origin', () => {
    const value: CorsConfig = {
      enabled: true,
      allowAllOrigins: false,
      origins: ['*'],
      headers: ['authorization'],
      methods: ['GET'],
      allowCredentials: true,
    };
    const cors = applyCors(baseApi, value).corsConfiguration!;
    expect(cors.accessControlAllowOrigins).toEqual(['*']);
    expect(cors.accessControlAllowCredentials).toBe(false);
  });

  it('collapses a typed wildcard alongside other origins', () => {
    const value: CorsConfig = {
      enabled: true,
      allowAllOrigins: false,
      origins: ['https://app.example', ' * '],
      headers: [],
      methods: [],
      allowCredentials: true,
    };
    const cors = applyCors(baseApi, value).corsConfiguration!;
    expect(cors.accessControlAllowOrigins).toEqual(['*']);
    expect(cors.accessControlAllowCredentials).toBe(false);
  });

  it('keeps credentials when the origins are explicit', () => {
    const value: CorsConfig = {
      enabled: true,
      allowAllOrigins: false,
      origins: ['https://app.example'],
      headers: ['authorization'],
      methods: ['GET'],
      allowCredentials: true,
    };
    const cors = applyCors(baseApi, value).corsConfiguration!;
    expect(cors.accessControlAllowOrigins).toEqual(['https://app.example']);
    expect(cors.accessControlAllowCredentials).toBe(true);
  });

  it('produces an empty, disabled CORS configuration when disabled', () => {
    const value: CorsConfig = {
      enabled: false,
      allowAllOrigins: true,
      origins: ['https://a.com'],
      headers: ['X-Test'],
      methods: ['GET'],
      allowCredentials: true,
    };
    expect(applyCors(baseApi, value).corsConfiguration).toEqual({
      corsConfigurationEnabled: false,
      accessControlAllowOrigins: [],
      accessControlAllowCredentials: false,
      accessControlAllowHeaders: [],
      accessControlAllowMethods: [],
    });
  });

  it('uses a wildcard origin when enabled and allowAllOrigins is true', () => {
    const value: CorsConfig = {
      enabled: true,
      allowAllOrigins: true,
      origins: ['https://a.com'],
      headers: ['X-Test'],
      methods: ['GET'],
      allowCredentials: true,
    };
    expect(applyCors(baseApi, value).corsConfiguration).toEqual({
      corsConfigurationEnabled: true,
      accessControlAllowOrigins: ['*'],
      accessControlAllowCredentials: false, // the wildcard wins over the requested credentials
      accessControlAllowHeaders: ['X-Test'],
      accessControlAllowMethods: ['GET'],
    });
  });

  it('uses explicit origins when enabled and allowAllOrigins is false', () => {
    const value: CorsConfig = {
      enabled: true,
      allowAllOrigins: false,
      origins: ['https://a.com', 'https://b.com'],
      headers: [],
      methods: [],
      allowCredentials: false,
    };
    expect(applyCors(baseApi, value).corsConfiguration).toEqual({
      corsConfigurationEnabled: true,
      accessControlAllowOrigins: ['https://a.com', 'https://b.com'],
      accessControlAllowCredentials: false,
      accessControlAllowHeaders: [],
      accessControlAllowMethods: [],
    });
  });

  it('preserves the rest of the api object', () => {
    const value: CorsConfig = { enabled: false, allowAllOrigins: false, origins: [], headers: [], methods: [], allowCredentials: false };
    const result = applyCors(baseApi, value);
    expect(result.id).toBe(baseApi.id);
    expect(result.name).toBe(baseApi.name);
  });
});
