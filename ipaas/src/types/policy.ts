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

export type TimeUnit = 'MINUTE' | 'HOUR' | 'DAY';

/** API_LEVEL is one allowance for the whole API; RESOURCE_LEVEL gives each operation its own. */
export type RateLimitLevel = 'UNLIMITED' | 'API_LEVEL' | 'RESOURCE_LEVEL';

/** One operation's limit, kept as strings so the text inputs stay controlled. */
export interface RateLimitRule {
  requestCount: string;
  timeUnit: TimeUnit;
}

/** An operation a resource-level limit can be attached to. */
export interface RateLimitOperation {
  /** "<METHOD> <path>" — the identity the backend keys per-operation limits by. */
  key: string;
  verb: string;
  target: string;
}

/** View-model for an API's request rate limit. */
export interface RateLimitConfig {
  level: RateLimitLevel;
  /** Max requests per `timeUnit` (kept as a string for the text input). */
  requestCount: string;
  timeUnit: TimeUnit;
  /** Per-operation limits, keyed by RateLimitOperation.key. Only meaningful at RESOURCE_LEVEL. */
  operations?: Record<string, RateLimitRule>;
}

/** View-model for an API's CORS configuration. */
export interface CorsConfig {
  enabled: boolean;
  allowAllOrigins: boolean;
  origins: string[];
  headers: string[];
  methods: string[];
  allowCredentials: boolean;
}
