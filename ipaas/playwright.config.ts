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

import { defineConfig, devices } from '@playwright/test';

const CLOUD_BASE_URL = process.env.E2E_CLOUD_BASE_URL ?? 'https://ipaas-console-development.gateway.dev.cloud.wso2.com';

// Thunder's Gate SPA intermittently stalls on its spinner; a fresh load clears it.
const CLOUD_RETRIES = process.env.CI ? 2 : 1;

// Selecting the setup by an explicit flag rather than by whether a token source happens
// to be set: a mistyped E2E_TOKEN_URL would otherwise fall back to the browser login and
// report a pass for a mode that never ran.
const CLOUD_SETUP = process.env.E2E_TOKEN_MODE ? 'setup-cloud-token' : 'setup-cloud';

export default defineConfig({
  testDir: './tests/e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Playwright reads the host's core count, not the container's cgroup limit, so a
  // containerised run must state its worker count rather than inherit the default.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://preview-o2-dev.devant.dev',
    trace: 'retain-on-failure',
    // E2E_VIDEO=1 keeps a video per test, including passing ones.
    video: process.env.E2E_VIDEO ? 'on' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
  },
  projects: [
    // WIP — Asgardeo IdP, email + OTP sign-in.
    {
      name: 'setup',
      testDir: './tests/e2e',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'wip',
      testIgnore: /specs[\\/]cloud/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
        launchOptions: {
          args: ['--incognito'],
        },
      },
      dependencies: ['setup'],
    },

    // Cloud — Thunder IdP, GitHub SSO. Own baseURL, so a stray E2E_BASE_URL cannot cross-target.
    {
      name: 'setup-cloud',
      testDir: './tests/e2e',
      testMatch: /cloud\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: CLOUD_BASE_URL,
        // A trace of the login records the OAuth token exchange; E2E_SETUP_ARTIFACTS=1 opts back in.
        trace: process.env.E2E_SETUP_ARTIFACTS ? 'retain-on-failure' : 'off',
        video: process.env.E2E_SETUP_ARTIFACTS ? 'retain-on-failure' : 'off',
        screenshot: process.env.E2E_SETUP_ARTIFACTS ? 'only-on-failure' : 'off',
      },
    },
    {
      // Skips the browser login: takes a token the platform already issued and rebuilds
      // the session the console would have stored.
      name: 'setup-cloud-token',
      testDir: './tests/e2e',
      testMatch: /cloud-token\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: CLOUD_BASE_URL },
    },
    {
      // No storageState and no setup dependency, so this project needs no credentials.
      name: 'cloud-anon',
      testDir: './tests/e2e/specs/cloud-anon',
      retries: CLOUD_RETRIES,
      use: { ...devices['Desktop Chrome'], baseURL: CLOUD_BASE_URL },
    },
    {
      // Manual only: opens a real window for a human to sign in to the test Google account.
      name: 'save-google-session',
      testDir: './tests/e2e',
      testMatch: /save-google-session\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: CLOUD_BASE_URL },
    },
    {
      name: 'cloud',
      testIgnore: /specs[\\/](wip|cloud-anon)[\\/]/,
      retries: CLOUD_RETRIES,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: CLOUD_BASE_URL,
        storageState: '.auth/cloud-user.json',
      },
      dependencies: [CLOUD_SETUP],
    },
  ],
  outputDir: 'test-results/',
});
