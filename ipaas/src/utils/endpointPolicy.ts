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

/** Translation between the BFF's endpoint-policy wire shape and the CORS / rate-limit view-models. */

import { DEFAULT_CORS_HEADERS, DEFAULT_CORS_METHODS, TIME_UNITS } from '../constants/policy';
import type { EndpointCorsPolicy, EndpointPolicyConfig, EndpointPolicyOperation, EndpointRateLimitLevel, EndpointRateLimitPolicy } from '../types/consumers';
import type { CorsConfig, RateLimitConfig, RateLimitLevel, RateLimitOperation, TimeUnit } from '../types/policy';
import { allowsAllOrigins } from './policy';

const ALLOW_ALL = '*';

const asTimeUnit = (unit: string | undefined): TimeUnit => (TIME_UNITS.some((u) => u.value === unit) ? (unit as TimeUnit) : 'MINUTE');

// ── CORS ─────────────────────────────────────────────────────────────────────

/** Seeds the header and method defaults, so a first enable allows something. */
export function corsFromPolicy(cors: EndpointCorsPolicy | undefined): CorsConfig {
  const origins = cors?.allowOrigins ?? [];
  return {
    enabled: cors?.enabled ?? false,
    allowAllOrigins: origins.includes(ALLOW_ALL),
    origins: origins.filter((o) => o !== ALLOW_ALL),
    headers: cors?.allowHeaders?.length ? cors.allowHeaders : DEFAULT_CORS_HEADERS,
    methods: cors?.allowMethods?.length ? cors.allowMethods : DEFAULT_CORS_METHODS,
    allowCredentials: cors?.allowCredentials ?? false,
  };
}

/** Credentials are dropped against a wildcard origin: the gateway 500s the whole API on that pair. */
export function corsToPolicy(value: CorsConfig): EndpointCorsPolicy {
  if (!value.enabled) return { enabled: false, allowCredentials: false };
  const wildcard = allowsAllOrigins(value);
  return {
    enabled: true,
    allowOrigins: wildcard ? [ALLOW_ALL] : value.origins,
    allowMethods: value.methods,
    allowHeaders: value.headers,
    allowCredentials: wildcard ? false : value.allowCredentials,
  };
}

// ── Rate limiting ────────────────────────────────────────────────────────────

const LEVEL_FROM_WIRE: Record<EndpointRateLimitLevel, RateLimitLevel> = {
  unlimited: 'UNLIMITED',
  api: 'API_LEVEL',
  resource: 'RESOURCE_LEVEL',
};

const LEVEL_TO_WIRE: Record<RateLimitLevel, EndpointRateLimitLevel> = {
  UNLIMITED: 'unlimited',
  API_LEVEL: 'api',
  RESOURCE_LEVEL: 'resource',
};

export function rateLimitFromPolicy(rateLimit: EndpointRateLimitPolicy | undefined): RateLimitConfig {
  const level = LEVEL_FROM_WIRE[rateLimit?.level ?? 'unlimited'] ?? 'UNLIMITED';
  const operations: RateLimitConfig['operations'] = {};
  for (const [key, rule] of Object.entries(rateLimit?.operations ?? {})) {
    operations[key] = { requestCount: String(rule.requestCount), timeUnit: asTimeUnit(rule.timeUnit) };
  }
  return {
    level,
    requestCount: rateLimit?.requestCount ? String(rateLimit.requestCount) : '',
    timeUnit: asTimeUnit(rateLimit?.timeUnit),
    operations,
  };
}

/** Blank operations are dropped — they mean "leave this one unlimited", not "zero requests". */
export function rateLimitToPolicy(value: RateLimitConfig): EndpointRateLimitPolicy {
  const level = LEVEL_TO_WIRE[value.level];
  if (level === 'api') {
    return { level, requestCount: Number(value.requestCount), timeUnit: value.timeUnit };
  }
  if (level === 'resource') {
    const operations: NonNullable<EndpointRateLimitPolicy['operations']> = {};
    for (const [key, rule] of Object.entries(value.operations ?? {})) {
      const count = Number(rule.requestCount);
      if (!Number.isInteger(count) || count <= 0) continue;
      operations[key] = { requestCount: count, timeUnit: rule.timeUnit };
    }
    // Clearing every row means the limit is gone, not that an empty limit is configured.
    return Object.keys(operations).length ? { level, operations } : { level: 'unlimited' };
  }
  return { level: 'unlimited' };
}

/** The operations the rate-limiting section renders a row for. */
export const toRateLimitOperations = (operations: EndpointPolicyOperation[] | undefined): RateLimitOperation[] => (operations ?? []).map((op) => ({ key: op.key, verb: op.method, target: op.path }));

export const policyToConfig = (cfg: EndpointPolicyConfig | undefined): { cors: CorsConfig; rateLimit: RateLimitConfig } => ({
  cors: corsFromPolicy(cfg?.cors),
  rateLimit: rateLimitFromPolicy(cfg?.rateLimit),
});

export const configToPolicy = (cors: CorsConfig, rateLimit: RateLimitConfig): EndpointPolicyConfig => ({
  cors: corsToPolicy(cors),
  rateLimit: rateLimitToPolicy(rateLimit),
});
