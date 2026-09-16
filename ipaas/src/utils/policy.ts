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

import { DEFAULT_CORS_HEADERS, DEFAULT_CORS_METHODS, TIME_UNITS } from '../constants/policy';
import type { ApimApiInfo, CorsConfiguration } from '../types/apim';
import type { CorsConfig, RateLimitConfig, TimeUnit } from '../types/policy';

// ── Rate limiting ────────────────────────────────────────────────────────────

/**
 * Derive the rate-limit view-model from an APIM API. Mirrors `ManageDrawer`'s
 * mapping (rate limit lives in `apiThrottlingPolicy` as the request count) while
 * also honouring `throttlingLimit` for the time unit when present.
 */
export function rateLimitFromApi(api: ApimApiInfo | null | undefined): RateLimitConfig {
  const count = api?.throttlingLimit?.requestCount != null ? String(api.throttlingLimit.requestCount) : (api?.apiThrottlingPolicy ?? '');
  const hasLimit = !!api?.apiThrottlingPolicy || (api?.throttlingLimit?.requestCount ?? 0) > 0;
  const unit = (api?.throttlingLimit?.unit as TimeUnit) ?? 'MINUTE';
  return {
    level: hasLimit ? 'API_LEVEL' : 'UNLIMITED',
    requestCount: hasLimit && count !== '-1' ? count : '',
    timeUnit: TIME_UNITS.some((u) => u.value === unit) ? unit : 'MINUTE',
  };
}

/** Apply the rate-limit view-model onto an APIM API, returning a new object to PUT. */
export function applyRateLimit(api: ApimApiInfo, value: RateLimitConfig): ApimApiInfo {
  if (value.level !== 'API_LEVEL') {
    return { ...api, apiThrottlingPolicy: null, throttlingLimit: null };
  }
  const count = Number(value.requestCount);
  return {
    ...api,
    apiThrottlingPolicy: value.requestCount || null,
    throttlingLimit: Number.isInteger(count) && count > 0 ? { requestCount: count, unit: value.timeUnit } : null,
  };
}

/** True when a single limit is a positive whole number of requests. */
export function isRuleValid(rule: { requestCount: string }): boolean {
  const count = Number(rule.requestCount);
  return Number.isInteger(count) && count > 0;
}

/** True when the rate limit is internally valid. A blank per-operation row is valid — it means unlimited. */
export function isRateLimitValid(value: RateLimitConfig): boolean {
  if (value.level === 'RESOURCE_LEVEL') {
    return Object.values(value.operations ?? {}).every((rule) => rule.requestCount === '' || isRuleValid(rule));
  }
  if (value.level !== 'API_LEVEL') return true;
  return isRuleValid(value);
}

// ── CORS ──────────────────────────────────────────────────────────────────────

/** True when every origin is allowed — from the checkbox, or from a literal "*" typed as an origin. */
export function allowsAllOrigins(value: Pick<CorsConfig, 'allowAllOrigins' | 'origins'>): boolean {
  return value.allowAllOrigins || value.origins.some((o) => o.trim() === '*');
}

/** Derive the CORS view-model from an APIM API. */
export function corsFromApi(api: ApimApiInfo | null | undefined): CorsConfig {
  const cors = api?.corsConfiguration;
  const origins = cors?.accessControlAllowOrigins ?? [];
  return {
    enabled: cors?.corsConfigurationEnabled ?? false,
    allowAllOrigins: origins.includes('*'),
    origins: origins.filter((o) => o !== '*'),
    headers: cors?.accessControlAllowHeaders ?? DEFAULT_CORS_HEADERS,
    methods: cors?.accessControlAllowMethods ?? DEFAULT_CORS_METHODS,
    allowCredentials: cors?.accessControlAllowCredentials ?? false,
  };
}

/** Apply the CORS view-model onto an APIM API, returning a new object to PUT. */
export function applyCors(api: ApimApiInfo, value: CorsConfig): ApimApiInfo {
  // Credentials against a wildcard origin is rejected by the gateway, so it must never be saved.
  const wildcard = allowsAllOrigins(value);
  const corsConfiguration: CorsConfiguration = {
    corsConfigurationEnabled: value.enabled,
    accessControlAllowOrigins: value.enabled ? (wildcard ? ['*'] : value.origins) : [],
    accessControlAllowCredentials: value.enabled && !wildcard ? value.allowCredentials : false,
    accessControlAllowHeaders: value.enabled ? value.headers : [],
    accessControlAllowMethods: value.enabled ? value.methods : [],
  };
  return { ...api, corsConfiguration };
}
