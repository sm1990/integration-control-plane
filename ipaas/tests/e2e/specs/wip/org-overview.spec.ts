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
import { TopNav } from '../../pages/TopNav';

// WIP only: on cloud, OrgHome redirects /organizations/:org/home to the last project.
test.describe('org overview @smoke', () => {
  let orgHandler: string;
  let projectHandler: string;

  test.beforeEach(() => {
    const ctx = getAuthContext();
    orgHandler = ctx.orgHandler;
    if (!ctx.projectHandler) throw new Error('No projectHandler in auth context — re-run setup');
    projectHandler = ctx.projectHandler;
  });

  // -------------------------------------------------------------------------
  // Navigate to org overview from project home
  // -------------------------------------------------------------------------

  test('clicking X on project chip navigates to org overview', async ({ page }) => {
    await page.goto(`/organizations/${orgHandler}/projects/${projectHandler}/home`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/projects\/[^/]+\/home/, { timeout: 30_000 });

    await new TopNav(page).closeProjectChip();

    await expect(page).toHaveURL(/\/organizations\/[^/]+\/home/);
    await expect(page.getByRole('heading', { name: 'All Projects' })).toBeVisible();
  });

  test('clicking org card navigates to org overview', async ({ page }) => {
    await page.goto(`/organizations/${orgHandler}/projects/${projectHandler}/home`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/projects\/[^/]+\/home/, { timeout: 30_000 });

    await new TopNav(page).clickOrg();

    await expect(page).toHaveURL(/\/organizations\/[^/]+\/home/);
    await expect(page.getByRole('heading', { name: 'All Projects' })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Org overview page content
  // -------------------------------------------------------------------------

  test('org overview page loads with All Projects heading', async ({ page }) => {
    await page.goto(`/organizations/${orgHandler}/home`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/organizations\/[^/]+\/home/);
    await expect(page.getByRole('heading', { name: 'All Projects' })).toBeVisible();
  });

  test('shows search input, Create and Import buttons', async ({ page }) => {
    await page.goto(`/organizations/${orgHandler}/home`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByPlaceholder('Search projects')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeVisible();
  });

  test('at least one project card is visible', async ({ page }) => {
    await page.goto(`/organizations/${orgHandler}/home`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Default')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Navigate from org overview back to project home
  // -------------------------------------------------------------------------

  test('clicking a project card navigates to project home', async ({ page }) => {
    await page.goto(`/organizations/${orgHandler}/home`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'All Projects' })).toBeVisible();

    // Derive display name from the gear button's aria-label to avoid clicking the gear itself.
    const gearButton = page.getByRole('button', { name: /^Settings for /i }).first();
    await gearButton.waitFor({ state: 'visible' });
    const ariaLabel = (await gearButton.getAttribute('aria-label')) ?? '';
    const displayName = ariaLabel.replace(/^Settings for /i, '');

    await page.getByText(displayName, { exact: true }).first().click();

    await expect(page).toHaveURL(/\/projects\/[^/]+\/home/);
  });

  // -------------------------------------------------------------------------
  // Org overview interactions — TODO
  // -------------------------------------------------------------------------

  test.skip('Create button opens create project flow', async () => {
    // TODO: create project flow not yet finalized.
  });

  test.skip('Import button opens import project flow', async () => {
    // TODO: import project flow not yet finalized.
  });

  test.skip('search filters the project list', async () => {
    // TODO: search functionality not yet tested.
  });

  test.skip('grid/list view toggle changes the project layout', async () => {
    // TODO: grid/list view toggle not yet tested.
  });

  test.skip('project settings gear opens project settings', async () => {
    // TODO: project settings page not yet implemented.
  });

  // -------------------------------------------------------------------------
  // Onboarding flows — TODO
  // -------------------------------------------------------------------------

  test.skip('Platform Engineer/SRE persona shows relevant org overview', async () => {
    // TODO: persona selection is currently commented out in OrgHome.tsx (not persisted
    // anywhere) — revisit this test once/if that step comes back.
  });

  test.skip('EU region selection during onboarding', async () => {
    // TODO: test EU data-residency region selection during onboarding.
  });
});
