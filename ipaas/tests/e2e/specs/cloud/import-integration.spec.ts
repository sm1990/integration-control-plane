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
 * Importing an integration from a public repository, through to the build it starts.
 *
 * Serial and stateful: the import in the first test is the fixture for the rest, since it
 * provisions a real integration and a real build. The fixture project and the integration
 * are removed in teardown.
 *
 * The repository is a fixed public one holding a Ballerina integration-as-api package under
 * `greeting-service`, so the form has a real branch and sub-path to resolve.
 */

import { expect, test, type Page } from '@playwright/test';
import { getAuthContext } from '../../helpers/auth-context.js';
import { createFixtureProject, deleteFixtureProjects, reportTeardown, reseedSessionToken, waitForApiConfig } from '../../helpers/cloud-fixtures.js';
import { authStatePath } from '../../helpers/product.js';

const REPO_URL = 'https://github.com/dokimibot/sample-integrations';
const REPO_SUBDIR = 'greeting-service';
const INTEGRATION_TYPE = 'Integration as API';

// BuildCard.tsx:118-140. 'Failed' also reads 'Failed while <phrase>', hence the prefix match.
const TERMINAL_STATUS = /^(Completed|Failed|Cancelled|Timed Out)/;
const BUILD_TIMEOUT_MS = 20 * 60_000;

// Each form step waits on a GitHub round-trip, and an inner 60s wait cannot complete inside
// the 60s default test timeout.
const FORM_TIMEOUT_MS = 3 * 60_000;

// The status has no role or accessible name (BuildCard.tsx:194-198), so it is matched by its text.
function buildStatus(page: Page) {
  return page.getByText(/^(Queued|In Progress|Completed|Failed|Cancelled|Timed Out)/).first();
}

/**
 * Polls in chunks, putting a fresh token in place between them. One 20-minute assertion would
 * outlive the token's hour in token mode, and the session cannot refresh itself there.
 */
async function expectBuildToFinish(page: Page): Promise<void> {
  const CHUNK_MS = 4 * 60_000;

  for (let elapsed = 0; elapsed < BUILD_TIMEOUT_MS; elapsed += CHUNK_MS) {
    const finished = await expect(buildStatus(page))
      .toHaveText(TERMINAL_STATUS, { timeout: CHUNK_MS })
      .then(() => true)
      .catch(() => false);
    if (finished) return;

    await reseedSessionToken(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Latest Build' })).toBeVisible({ timeout: 60_000 });
  }

  throw new Error(`Build did not reach a terminal state within ${BUILD_TIMEOUT_MS / 60_000} minutes; last status: ${await buildStatus(page).textContent()}`);
}

test.describe('import an integration @smoke', () => {
  // The first test's import is the fixture for the rest, and beforeAll runs once per worker.
  test.describe.configure({ mode: 'serial' });

  let orgHandler: string;
  let projectHandler: string;
  let componentHandle: string | null = null;
  const displayName = `e2e-import-${Date.now()}`;
  const createdProjects: string[] = [];

  test.beforeAll(async ({ browser }, testInfo) => {
    orgHandler = getAuthContext(testInfo.project.name).orgHandler;

    const ctx = await browser.newContext({ storageState: authStatePath(testInfo.project.name) });
    const page = await ctx.newPage();
    await page.goto(`/organizations/${orgHandler}/projects/default/home`, { waitUntil: 'domcontentloaded' });
    await waitForApiConfig(page);

    const handle = `e2e-import-fx-${Date.now()}`;
    const result = await createFixtureProject(page, handle, 'Import flow spec; deleted in teardown');

    // Recorded before the check so a project behind a failed response is still torn down.
    createdProjects.push(handle);
    if (result.status < 200 || result.status >= 300) throw new Error(`Could not create the fixture project (${result.status}): ${result.body}`);

    projectHandler = handle;
    await ctx.close();
  });

  test.afterAll(async ({ browser }, testInfo) => {
    if (createdProjects.length === 0) return;

    const ctx = await browser.newContext({ storageState: authStatePath(testInfo.project.name) });
    const page = await ctx.newPage();
    await page.goto(`/organizations/${orgHandler}/projects/default/home`, { waitUntil: 'domcontentloaded' });
    await waitForApiConfig(page);

    reportTeardown(await deleteFixtureProjects(page, createdProjects));
    await ctx.close();
  });

  // -------------------------------------------------------------------------
  // The form, and the import it submits
  // -------------------------------------------------------------------------

  test('importing a public repository provisions an integration', async ({ page }) => {
    test.setTimeout(FORM_TIMEOUT_MS);
    await page.goto(`/organizations/${orgHandler}/projects/${projectHandler}/home`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Import from a Public Repository' }).click();
    await expect(page.getByRole('heading', { name: 'Import an Integration' })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('textbox', { name: 'Repository URL' }).fill(REPO_URL);

    // Branch, sub-path and the names appear only once the repository resolves, which is a
    // round-trip to GitHub — hence the wait on the branch rather than on the URL field.
    await expect(page.getByRole('combobox', { name: /^Branch/ }), 'the repository did not resolve into a branch').toContainText('main', { timeout: 60_000 });
    await expect(page.getByRole('textbox', { name: 'Repository Sub Path' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Display Name' }), 'the display name was not derived from the repository').not.toHaveValue('');
    // exact: true — 'Display Name' also matches a loose 'Name'. Disabled because the
    // identifier is derived from the display name rather than typed.
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeDisabled();

    await page.getByRole('button', { name: 'Edit path' }).click();
    const dialog = page.getByRole('dialog', { name: 'Repository Sub Path' });
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByRole('tree'), 'the picker did not list the repository tree').toBeVisible();
    await dialog.getByRole('treeitem', { name: REPO_SUBDIR }).click();
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(dialog).not.toBeVisible();

    // Overwrites the name the form derived from the repository, so two runs cannot collide
    // and the integration is identifiable if teardown ever fails.
    await page.getByRole('textbox', { name: 'Display Name' }).fill(displayName);
    await page.getByRole('button', { name: new RegExp(`^${INTEGRATION_TYPE}`) }).click();

    const submit = page.getByRole('button', { name: 'Import Integration' });
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await submit.click();

    // Waits for a handle that is not 'new': the creation form itself lives at
    // /components/new/import, and the landing URL carries no trailing segment.
    await page.waitForURL((url) => (url.pathname.match(/\/components\/([^/]+)/)?.[1] ?? 'new') !== 'new', { timeout: 120_000 });
    componentHandle = page.url().match(/\/components\/([^/]+)/)?.[1] ?? null;
    expect(componentHandle, 'Import did not navigate to an integration').toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // The build it starts
  // -------------------------------------------------------------------------

  test('the imported integration reports its source and a build', async ({ page }) => {
    test.skip(!componentHandle, 'No integration was imported');
    await page.goto(`/organizations/${orgHandler}/projects/${projectHandler}/components/${componentHandle}/overview`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: displayName })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(INTEGRATION_TYPE, { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(REPO_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Latest Build' })).toBeVisible({ timeout: 60_000 });
  });

  test('View Logs opens the build logs and Hide Logs closes them', async ({ page }) => {
    test.skip(!componentHandle, 'No integration was imported');
    await page.goto(`/organizations/${orgHandler}/projects/${projectHandler}/components/${componentHandle}/overview`, { waitUntil: 'domcontentloaded' });

    const viewLogs = page.getByRole('button', { name: 'View Logs' }).first();
    await expect(viewLogs).toBeVisible({ timeout: 5 * 60_000 });
    await viewLogs.click();

    // One button carries both labels (BuildCard.tsx:208), so the flip is the evidence.
    const hideLogs = page.getByRole('button', { name: 'Hide Logs' }).first();
    await expect(hideLogs).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Copy logs' })).toBeVisible();

    await hideLogs.click();
    await expect(page.getByRole('button', { name: 'View Logs' }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('the build section collapses and expands', async ({ page }) => {
    test.skip(!componentHandle, 'No integration was imported');
    await page.goto(`/organizations/${orgHandler}/projects/${projectHandler}/components/${componentHandle}/overview`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Latest Build' })).toBeVisible({ timeout: 60_000 });

    // Collapse and Expand are the same control under two tooltips, so each label appearing
    // is what proves the section moved.
    await page.getByRole('button', { name: 'Collapse' }).first().click();
    await expect(page.getByRole('main').getByRole('button', { name: 'Expand' }).first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole('main').getByRole('button', { name: 'Expand' }).first().click();
    await expect(page.getByRole('button', { name: 'Collapse' }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('the build completes', async ({ page }) => {
    test.skip(!componentHandle, 'No integration was imported');
    // Far beyond the 60s default: this waits out a real build.
    test.setTimeout(BUILD_TIMEOUT_MS + 2 * 60_000);

    await page.goto(`/organizations/${orgHandler}/projects/${projectHandler}/components/${componentHandle}/overview`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Latest Build' })).toBeVisible({ timeout: 60_000 });

    await expectBuildToFinish(page);

    await expect(buildStatus(page), 'the build reached a terminal state other than Completed').toHaveText(/^Completed/);
  });
});
