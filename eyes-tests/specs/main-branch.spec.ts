/**
 * Captures the Helloworld baseline on the "main" Applitools branch.
 *
 * Run this first to establish (or update) the main branch baseline.
 * After running feature-branch.spec.ts, use the Jenkins shared library to
 * merge the feature branch baselines into this one.
 *
 * Required env var : APPLITOOLS_API_KEY
 * Optional env vars: APPLITOOLS_ORG  (default: myorg)
 *                    APPLITOOLS_REPO (default: helloworld-demo)
 */

import { test, expect }                  from '@playwright/test';
import { Eyes, Target, Configuration }   from '@applitools/eyes-playwright';

const org  = process.env.APPLITOOLS_ORG  ?? 'myorg';
const repo = process.env.APPLITOOLS_REPO ?? 'helloworld-demo';

// Full branch path expected by the Applitools merge API: company/repo/branch
const BRANCH_NAME = `${org}/${repo}/main`;

test.describe('Helloworld — main branch baseline', () => {
  let eyes: Eyes;

  test.beforeEach(async () => {
    if (!process.env.APPLITOOLS_API_KEY) {
      throw new Error('APPLITOOLS_API_KEY environment variable is not set');
    }

    const config = new Configuration();
    config.setApiKey(process.env.APPLITOOLS_API_KEY);
    config.setBranchName(BRANCH_NAME);

    eyes = new Eyes();
    eyes.setConfiguration(config);
  });

  test.afterEach(async () => {
    await eyes.abortIfNotClosed();
  });

  test('full page — no query params', async ({ page }) => {
    await eyes.open(page, 'Helloworld', 'Main page', { width: 1280, height: 720 });

    await page.goto('https://applitools.com/helloworld/');
    await expect(page.locator('h2')).toBeVisible();

    await eyes.check('Initial load', Target.window().fully());

    const result = await eyes.close(false);
    expect(result.isNew() || result.isPassed(),
      `Eyes result status: ${result.getStatus()}`
    ).toBe(true);
  });

  test('after button click', async ({ page }) => {
    await eyes.open(page, 'Helloworld', 'After click', { width: 1280, height: 720 });

    await page.goto('https://applitools.com/helloworld/');
    await page.locator('button', { hasText: 'Click me!' }).click();
    await expect(page.locator('text=You successfully clicked')).toBeVisible();

    await eyes.check('After click', Target.window().fully());

    const result = await eyes.close(false);
    expect(result.isNew() || result.isPassed(),
      `Eyes result status: ${result.getStatus()}`
    ).toBe(true);
  });
});
