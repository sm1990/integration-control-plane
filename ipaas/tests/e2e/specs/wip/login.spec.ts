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

import { expect, test } from '@playwright/test';
import { waitForOTP } from '../../helpers/gmail.js';

// Empty storage state — these tests verify unauthenticated login/signup pages.
test.use({ storageState: { cookies: [], origins: [] } });

// -------------------------------------------------------------------------
// Login page
// -------------------------------------------------------------------------

test.describe('login page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  });

  test('shows Sign In heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });

  test('shows all sign-in options', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Microsoft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Enterprise ID' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Email' })).toBeVisible();
  });

  test('sign-up link navigates to signup page', async ({ page }) => {
    await page.getByRole('link', { name: 'Sign up!' }).click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('shows wso2.com/integration-platform, Privacy Policy, and Terms of Use links', async ({ page }) => {
    const moreDetailsLink = page.getByRole('link', { name: 'wso2.com/integration-platform' });
    const privacyLink = page.getByRole('link', { name: 'Privacy Policy' });
    const termsLink = page.getByRole('link', { name: 'Terms of Use' });

    await expect(moreDetailsLink).toBeVisible();
    await expect(privacyLink).toBeVisible();
    await expect(termsLink).toBeVisible();

    await expect(moreDetailsLink).toHaveAttribute('href', 'https://wso2.com/integration-platform');
    await expect(privacyLink).toHaveAttribute('href', 'https://wso2.com/privacy-policy');
    await expect(termsLink).toHaveAttribute('href', 'https://wso2.com/integration-platform/terms-of-use');
  });
});

// -------------------------------------------------------------------------
// Signup page
// -------------------------------------------------------------------------

test.describe('signup page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  });

  test('shows Sign Up heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();
  });

  test('shows all sign-up options', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Microsoft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign up with Email' })).toBeVisible();
  });

  test('sign-in link navigates back to login page', async ({ page }) => {
    await page.getByRole('link', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows wso2.com/integration-platform, Privacy Policy, and Terms of Use links', async ({ page }) => {
    const moreDetailsLink = page.getByRole('link', { name: 'wso2.com/integration-platform' });
    const privacyLink = page.getByRole('link', { name: 'Privacy Policy' });
    const termsLink = page.getByRole('link', { name: 'Terms of Use' });

    await expect(moreDetailsLink).toBeVisible();
    await expect(privacyLink).toBeVisible();
    await expect(termsLink).toBeVisible();

    await expect(moreDetailsLink).toHaveAttribute('href', 'https://wso2.com/integration-platform');
    await expect(privacyLink).toHaveAttribute('href', 'https://wso2.com/privacy-policy');
    await expect(termsLink).toHaveAttribute('href', 'https://wso2.com/integration-platform/terms-of-use');
  });
});

// -------------------------------------------------------------------------
// Sign-in flows — TODO: all require dedicated test accounts per provider
// -------------------------------------------------------------------------

test.describe('sign-in flows', () => {
  test('Sign in with Email — email + OTP flow completes successfully', async ({ page }) => {
    test.setTimeout(180_000);

    const username = process.env.E2E_USERNAME;
    if (!username) throw new Error('E2E_USERNAME must be set in .env.test');

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Sign in with Email' })).toBeVisible();

    const beforeSignIn = Date.now();

    await Promise.all([
      page.waitForURL((url) => url.hostname.includes('asgardeo.io'), {
        timeout: 30_000,
        waitUntil: 'domcontentloaded',
      }),
      page.getByRole('button', { name: 'Sign in with Email' }).click(),
    ]);

    await page.getByPlaceholder('Enter your email').waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByPlaceholder('Enter your email').fill(username);
    await page.getByRole('button', { name: 'Continue' }).click();

    const wentToOTP = await page
      .waitForURL((url) => url.pathname.includes('email_otp'), {
        timeout: 10_000,
        waitUntil: 'domcontentloaded',
      })
      .then(() => true)
      .catch(() => false);

    if (wentToOTP) {
      const otp = await waitForOTP({
        subjectPattern: /email OTP|one.time passcode|verification|otp/i,
        afterMs: beforeSignIn,
        timeoutMs: 30_000,
      });
      await page.getByRole('textbox').fill(otp);
      await page.getByRole('button', { name: 'Continue' }).click();
    }

    await page.waitForURL(/\/organizations\/[^/]+/, {
      timeout: 90_000,
      waitUntil: 'domcontentloaded',
    });
    await expect(page).toHaveURL(/\/organizations\/[^/]+/);
  });

  test.skip('Continue with Google — redirects to Google OAuth', async () => {
    // TODO: Google blocks automated OAuth ("This browser or app may not be secure").
    // Needs a service account or OAuth workaround before this can be enabled.
  });

  test.skip('Continue with GitHub — redirects to GitHub OAuth', async () => {
    // TODO: Needs a dedicated GitHub test account (wip-e2e-bot).
    //       Set E2E_GITHUB_USERNAME / E2E_GITHUB_PASSWORD secrets before enabling.
  });

  test.skip('Continue with Microsoft — redirects to Microsoft OAuth', async () => {
    // TODO: Needs a dedicated Microsoft test account.
    //       Set E2E_MICROSOFT_USERNAME / E2E_MICROSOFT_PASSWORD secrets before enabling.
  });

  test.skip('Sign in with Enterprise ID — redirects to enterprise IDP', async () => {
    // TODO: Needs an enterprise IDP configured in WSO2 Identity Platform.
    //       Set E2E_ENTERPRISE_USERNAME / E2E_ENTERPRISE_PASSWORD before enabling.
  });
});
