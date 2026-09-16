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
import { authStatePath } from '../../helpers/product.js';
import { CreateProjectPage } from '../../pages/CreateProjectPage';
import { IntegrationOptionsPage } from '../../pages/IntegrationOptionsPage';

// Skipped: create project flow not yet finalized — re-enable once the flow is stable.
test.describe.skip('integrations @smoke', () => {
  let orgHandler: string;
  let projectHandler: string;

  // Create a dedicated project once for all tests in this suite.
  test.beforeAll(async ({ browser }, testInfo) => {
    orgHandler = getAuthContext(testInfo.project.name).orgHandler;

    const ctx = await browser.newContext({ storageState: authStatePath(testInfo.project.name) });
    const page = await ctx.newPage();

    const suffix = `${Date.now()}`;
    const createPage = new CreateProjectPage(page);
    await createPage.goto(orgHandler);
    await createPage.fillAndSubmit(`e2e-int-${suffix}`, 'Integrations smoke suite project');
    await createPage.waitForProjectCreated();

    const match = page.url().match(/\/projects\/([^/]+)/);
    if (!match) throw new Error(`Project creation did not navigate to project home. URL: ${page.url()}`);
    projectHandler = match[1];

    await ctx.close();
  });

  test('integration creation options page loads', async ({ page }) => {
    const optionsPage = new IntegrationOptionsPage(page);
    await optionsPage.goto(orgHandler, projectHandler);
    await optionsPage.expectOptionsVisible();
  });

  test('browse samples page loads', async ({ page }) => {
    await page.goto(`/organizations/${orgHandler}/projects/${projectHandler}/components/new/samples`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/components\/new\/samples/);
  });

  test('prebuilt integrations page loads (WIP only)', async ({ page }) => {
    await page.goto(`/organizations/${orgHandler}/projects/${projectHandler}/prebuilt-integrations`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/prebuilt-integrations/);
  });
});
