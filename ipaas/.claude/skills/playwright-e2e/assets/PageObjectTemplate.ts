/**
 * Starting point for a page object. Copy to tests/e2e/pages/<Name>Page.ts and
 * rename the class to match the file.
 *
 * Locators and actions live here; assertions live in the spec. The exception is a
 * readiness helper (goto / waitForLoad / expectPageLoaded) — "this page finished
 * loading" is the page's own business and every spec needs it identically.
 */
import { type Page, expect } from '@playwright/test';

export class TemplatePage {
  constructor(private readonly page: Page) {}

  async goto(orgHandler: string) {
    await this.page.goto(`/organizations/${orgHandler}/<path>`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Return locators from methods rather than fields so they stay lazy. */
  primaryActionButton() {
    return this.page.getByRole('button', { name: '<Exact Label>', exact: true });
  }

  nameInput() {
    return this.page.getByLabel('<Field Label>');
  }

  async expectPageLoaded() {
    await expect(this.page.getByRole('heading', { name: '<Heading>' })).toBeVisible();
  }
}
