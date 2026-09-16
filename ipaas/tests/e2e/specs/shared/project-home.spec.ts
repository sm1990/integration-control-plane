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

test.describe('project home @smoke', () => {
  let orgHandler: string;
  let projectHandler: string;

  test.beforeEach(async ({ page }) => {
    const ctx = getAuthContext();
    orgHandler = ctx.orgHandler;
    if (!ctx.projectHandler) throw new Error('No projectHandler in auth context — re-run setup');
    projectHandler = ctx.projectHandler;

    await page.goto(`/organizations/${orgHandler}/projects/${projectHandler}/home`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/projects\/[^/]+\/home/, { timeout: 30_000 });
  });

  // -------------------------------------------------------------------------
  // Page loads
  // -------------------------------------------------------------------------

  test('project home page loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/organizations\/[^/]+\/projects\/[^/]+\/home/);
  });

  // -------------------------------------------------------------------------
  // Top nav breadcrumb
  // -------------------------------------------------------------------------

  test('top nav shows organization and project breadcrumbs', async ({ page }) => {
    await expect(page.getByRole('combobox', { name: 'Select organization' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Select project' })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Page content
  //
  // Only what holds whichever branch the project renders. The empty state's cards
  // live in project-home-empty.spec.ts and the table in specs/cloud's populated
  // spec, because a project has one of those two shapes and never both.
  // -------------------------------------------------------------------------

  test('shows the project name as the page heading', async ({ page }) => {
    // The display name is the backend's, not the handle in the auth context, so the
    // assertion is that the heading carries one rather than what it says.
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 30_000 });
    await expect(heading).not.toHaveText('');
  });

  test('offers to link a repository', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Link a Repository' })).toBeVisible({ timeout: 30_000 });
  });

  // -------------------------------------------------------------------------
  // Create integration flow — TODO
  // -------------------------------------------------------------------------

  test.skip('clicking Create an Integration opens the editor', async () => {
    // TODO: "Create an Integration" now opens the Cloud Editor instead of navigating
    // to /components/new — re-enable once the navigation flow is finalized.
  });
});
