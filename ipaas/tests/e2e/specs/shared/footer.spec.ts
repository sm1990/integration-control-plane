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
import { getAuthContext } from '../../helpers/auth-context.js';

test.describe('footer @smoke', () => {
  test.beforeEach(async ({ page }) => {
    const { orgHandler } = getAuthContext();
    await page.goto(`/organizations/${orgHandler}/home`, { waitUntil: 'domcontentloaded' });
    // Guard against a stale/expired session silently redirecting to /login — the footer
    // there has no Support link, which would otherwise fail confusingly further down.
    await expect(page).toHaveURL(/\/organizations\/[^/]+\/home/);
  });

  test('shows Terms of Use, Privacy Policy, and Support links in correct order', async ({ page }) => {
    const termsLink = page.getByRole('link', { name: 'Terms of Use' });
    const privacyLink = page.getByRole('link', { name: 'Privacy Policy' });
    const supportLink = page.getByRole('link', { name: 'Support' });

    await expect(termsLink).toBeVisible();
    await expect(privacyLink).toBeVisible();
    await expect(supportLink).toBeVisible();

    await expect(termsLink).toHaveAttribute('href', 'https://wso2.com/integration-platform/terms-of-use');
    await expect(privacyLink).toHaveAttribute('href', 'https://wso2.com/privacy-policy');
    await expect(supportLink).toHaveAttribute('href', 'https://discord.com/invite/wso2');

    const links = page.getByRole('link', { name: /^(Terms of Use|Privacy Policy|Support)$/ });
    await expect(links.nth(0)).toHaveText('Terms of Use');
    await expect(links.nth(1)).toHaveText('Privacy Policy');
    await expect(links.nth(2)).toHaveText('Support');
  });

  test('all footer links open in a new tab', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('target', '_blank');
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('target', '_blank');
    await expect(page.getByRole('link', { name: 'Support' })).toHaveAttribute('target', '_blank');
  });

  test('footer shows WSO2 copyright notice', async ({ page }) => {
    await expect(page.getByText(`© ${new Date().getFullYear()}, WSO2 LLC.`)).toBeVisible();
  });
});
