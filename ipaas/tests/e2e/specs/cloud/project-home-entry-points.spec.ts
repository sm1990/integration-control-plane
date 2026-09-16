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

/**
 * The ways an empty project offers to get started: importing, the cloud editor, and the
 * prebuilt catalogue. All of these belong to the isEmpty branch — a populated project home
 * replaces them with the integrations table.
 *
 * The suite creates its own project rather than using `default`: onboarding provisions that
 * one empty, but anything deployed into it later flips the branch and every assertion here
 * starts failing for a reason that has nothing to do with the code.
 *
 * Cloud-only rather than shared: the provider set and the editor's availability differ
 * between products, so asserting them against WIP would be a guess.
 */

import { expect, test } from '@playwright/test';
import { getAuthContext } from '../../helpers/auth-context.js';
import { createFixtureProject, deleteFixtureProjects, reportTeardown, waitForApiConfig } from '../../helpers/cloud-fixtures.js';
import { authStatePath } from '../../helpers/product.js';

const IMPORT_PROVIDERS = ['Import from a Public Repository', 'Import from GitHub', 'Import from GitLab', 'Import from Bitbucket', 'Import from Azure'];

test.describe('project home entry points @smoke', () => {
  // beforeAll runs once per worker; parallel workers would each create a project and exhaust quota.
  test.describe.configure({ mode: 'serial' });

  let orgHandler: string;
  let projectHandler: string;
  // Every handle, not just the last: beforeAll re-runs on retry and one variable leaks a project.
  const created: string[] = [];

  test.beforeAll(async ({ browser }, testInfo) => {
    orgHandler = getAuthContext(testInfo.project.name).orgHandler;

    const ctx = await browser.newContext({ storageState: authStatePath(testInfo.project.name) });
    const page = await ctx.newPage();
    await page.goto(`/organizations/${orgHandler}/projects/default/home`, { waitUntil: 'domcontentloaded' });
    await waitForApiConfig(page);

    const handle = `e2e-empty-${Date.now()}`;
    const result = await createFixtureProject(page, handle, 'Empty-state assertions; deleted in teardown');

    // Recorded before the check so a project behind a failed response is still torn down.
    created.push(handle);
    if (result.status < 200 || result.status >= 300) throw new Error(`Could not create the fixture project (${result.status}): ${result.body}`);

    projectHandler = handle;
    await ctx.close();
  });

  test.afterAll(async ({ browser }, testInfo) => {
    if (created.length === 0) return;

    const ctx = await browser.newContext({ storageState: authStatePath(testInfo.project.name) });
    const page = await ctx.newPage();
    await page.goto(`/organizations/${orgHandler}/projects/default/home`, { waitUntil: 'domcontentloaded' });
    await waitForApiConfig(page);

    reportTeardown(await deleteFixtureProjects(page, created));
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/organizations/${orgHandler}/projects/${projectHandler}/home`, { waitUntil: 'domcontentloaded' });

    // Raced against the login heading so a dead session fails in seconds, not after 30s of nothing.
    await Promise.race([
      page
        .getByRole('heading', { name: 'Import an Integration' })
        .waitFor({ state: 'visible', timeout: 30_000 })
        .catch(() => {}),
      page
        .getByRole('heading', { name: 'Sign In' })
        .waitFor({ state: 'visible', timeout: 30_000 })
        .catch(() => {}),
    ]);
    await expect(page, 'Session expired or was never authenticated').toHaveURL(/\/projects\/[^/]+\/home/, { timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // Import
  // -------------------------------------------------------------------------

  for (const provider of IMPORT_PROVIDERS) {
    test(`offers "${provider}"`, async ({ page }) => {
      await expect(page.getByRole('button', { name: provider, exact: true })).toBeVisible();
    });
  }

  test('offers no import provider beyond the five supported ones', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Import from/ })).toHaveCount(IMPORT_PROVIDERS.length);
  });

  // -------------------------------------------------------------------------
  // Cloud editor
  // -------------------------------------------------------------------------

  test('offers the cloud editor, marked Beta', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Create an Integration' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Cloud Editor', exact: true })).toBeVisible();
    await expect(page.getByText('Beta', { exact: true })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Prebuilt catalogue
  // -------------------------------------------------------------------------

  test('Prebuilt Integrations tab is selected by default and lists cards', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Prebuilt Integrations' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Explore more prebuilt integrations' })).toBeVisible();
  });

  test('prebuilt cards name the integrations they connect', async ({ page }) => {
    // One card, not the catalogue: the backend owns its contents and can reorder them.
    await expect(page.getByText('Export Salesforce Opportunities to a Google Sheet')).toBeVisible();
    await expect(page.getByText('Salesforce • Google Sheets')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Help links
  // -------------------------------------------------------------------------

  test('links to tutorials and Discord support', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Tutorials' })).toHaveAttribute('href', 'https://wso2.com/devant/docs');
    await expect(page.getByRole('link', { name: 'Get Support on Discord' })).toHaveAttribute('href', 'https://discord.gg/wso2');
  });
});
