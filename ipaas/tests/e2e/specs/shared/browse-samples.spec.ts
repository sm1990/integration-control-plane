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

/**
 * Covers the Browse Samples page at
 * /organizations/:org/projects/:project/components/new/samples.
 *
 * Every locator below is taken verbatim from src/pages/BrowseSamples.tsx and
 * src/components/FilterSection.tsx — including the ellipsis character in the
 * search placeholder, which is "…" and not three dots.
 */
test.describe('browse samples @smoke', () => {
  let orgHandler: string;
  let projectHandler: string;

  test.beforeEach(async ({ page }) => {
    const ctx = getAuthContext();
    orgHandler = ctx.orgHandler;
    if (!ctx.projectHandler) throw new Error('No projectHandler in auth context — re-run setup');
    projectHandler = ctx.projectHandler;

    await page.goto(`/organizations/${orgHandler}/projects/${projectHandler}/components/new/samples`, {
      waitUntil: 'domcontentloaded',
    });

    // The page has three terminal states: the samples grid, the samples-fetch error,
    // and a login redirect if the saved session died. Race all three so each fails with
    // its own message instead of timing out on a grid that is never going to render.
    await Promise.race([
      page
        .getByRole('heading', { name: 'Browse Samples' })
        .waitFor({ state: 'visible', timeout: 30_000 })
        .catch(() => {}),
      page
        .getByText('Failed to load samples. Please try again later.')
        .waitFor({ state: 'visible', timeout: 30_000 })
        .catch(() => {}),
      page
        .getByRole('heading', { name: 'Sign In' })
        .waitFor({ state: 'visible', timeout: 30_000 })
        .catch(() => {}),
    ]);

    await expect(page, 'Session expired or was never authenticated — redirected to the login page').toHaveURL(new RegExp(`/organizations/${orgHandler}/projects/${projectHandler}/components/new/samples$`), { timeout: 5_000 });
    await expect(page.getByText('Failed to load samples. Please try again later.'), 'The samples service is down — this is a backend failure, not a UI regression').not.toBeVisible();
  });

  test('shows the Browse Samples heading and subtitle', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Browse Samples' })).toBeVisible();
    await expect(page.getByText('Deploy a sample to get started quickly.')).toBeVisible();
  });

  test('shows a Back button to the integration creation options', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
  });

  test('shows the sample search input', async ({ page }) => {
    await expect(page.getByPlaceholder('Search samples…')).toBeVisible();
  });

  test('shows the Type, Technology and Tags filter sections', async ({ page }) => {
    // FilterSection renders its title inside a `Box component="button"`, so each
    // section header is a button whose accessible name is the title.
    await expect(page.getByRole('button', { name: 'Type', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Technology', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tags', exact: true })).toBeVisible();
  });

  test('a search with no matches shows the empty-result message', async ({ page }) => {
    // Every SampleGridCard renders a "Quick Deploy" button regardless of which sample it is —
    // asserting on it first confirms real results are showing before we search them away.
    await expect(page.getByRole('button', { name: 'Quick Deploy' }).first()).toBeVisible();

    await page.getByPlaceholder('Search samples…').fill(`no-such-sample-${Date.now()}`);
    await expect(page.getByText('No samples match your search.')).toBeVisible();
  });

  test('clearing the search brings the results back', async ({ page }) => {
    const search = page.getByPlaceholder('Search samples…');
    await expect(page.getByRole('button', { name: 'Quick Deploy' }).first()).toBeVisible();

    await search.fill(`no-such-sample-${Date.now()}`);
    await expect(page.getByText('No samples match your search.')).toBeVisible();

    await search.clear();
    await expect(page.getByText('No samples match your search.')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Quick Deploy' }).first()).toBeVisible();
  });

  test.skip('deploying a sample creates an integration', async () => {
    // TODO: deploy calls useCreateComponent, which provisions a real integration against
    // the backend and navigates to its overview page. Needs a cleanup story (delete the
    // created component afterwards) before it can run nightly without accumulating junk.
  });
});
