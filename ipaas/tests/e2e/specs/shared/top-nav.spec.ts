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
import { isCloud } from '../../helpers/product.js';
import { TopNav } from '../../pages/TopNav';

test.describe('top nav @smoke', () => {
  let orgHandler: string;
  let projectHandler: string;

  test.beforeEach(() => {
    const ctx = getAuthContext();
    orgHandler = ctx.orgHandler;
    if (!ctx.projectHandler) throw new Error('No projectHandler in auth context — re-run setup');
    projectHandler = ctx.projectHandler;
  });

  // -------------------------------------------------------------------------
  // Project picker — navigate to project home from org overview
  // -------------------------------------------------------------------------

  test('project picker caret opens project home', async ({ page }) => {
    // Cloud redirects away from the org overview page this flow starts from.
    test.skip(isCloud(), 'Org overview page does not render on cloud');

    await page.goto(`/organizations/${orgHandler}/home`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'All Projects' })).toBeVisible();

    const nav = new TopNav(page);
    await nav.openProjectPicker();
    await nav.selectProject(projectHandler);

    await expect(page).toHaveURL(/\/projects\/[^/]+\/home/);
  });

  // -------------------------------------------------------------------------
  // Sign out
  // -------------------------------------------------------------------------

  test('sign out redirects to login page', async ({ page }) => {
    await page.goto(`/organizations/${orgHandler}/projects/${projectHandler}/home`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/projects\/[^/]+\/home/, { timeout: 30_000 });

    const nav = new TopNav(page);
    await nav.openUserMenu();
    await nav.clickSignOut();

    await expect(page.getByRole('dialog')).toBeVisible();
    await nav.confirmSignOut();

    // Cloud has no in-app login page — /login redirects on to Thunder's hosted Gate.
    if (isCloud()) {
      await expect(page).toHaveURL(/\/gate\/signin/);
      await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
    } else {
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('button', { name: 'Sign in with Email' })).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // Org card dropdown — TODO
  // -------------------------------------------------------------------------

  test.skip('org card dropdown opens organization switcher', async () => {
    // TODO: the ▼ caret on the org card opens an org switcher — not yet tested.
  });
});
