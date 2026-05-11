/**
 * Captures the Helloworld baseline on a "feature" Applitools branch using the
 * ?diff2 URL variant, which has a visually different layout from the main page.
 *
 * Run main-branch.spec.ts first, then this file. The two specs together give
 * you divergent baselines on separate branches — the ideal state for validating
 * the applitoolsMergeBranches Jenkins shared library step.
 *
 * To merge after both specs have run, call the shared library with:
 *   sourceBranch: '<org>/<repo>/feature-helloworld-diff2'
 *   targetBranch: '<org>/<repo>/main'
 *
 * Required env var : APPLITOOLS_API_KEY
 * Optional env vars: APPLITOOLS_ORG  (default: myorg)
 *                    APPLITOOLS_REPO (default: helloworld-demo)
 */

import { test, expect }                  from '@playwright/test';
import { Eyes, Target, Configuration }   from '@applitools/eyes-playwright';

const org  = process.env.APPLITOOLS_ORG  ?? 'myorg';
const repo = process.env.APPLITOOLS_REPO ?? 'helloworld-demo';

const BRANCH_NAME        = `${org}/${repo}/feature-helloworld-diff2`;
const PARENT_BRANCH_NAME = `${org}/${repo}/main`;

test.describe('Helloworld — feature branch baseline (?diff2)', () => {
  let eyes: Eyes;

  test.beforeEach(async () => {
    if (!process.env.APPLITOOLS_API_KEY) {
      throw new Error('APPLITOOLS_API_KEY environment variable is not set');
    }

    const config = new Configuration();
    config.setApiKey(process.env.APPLITOOLS_API_KEY);
    config.setBranchName(BRANCH_NAME);
    // Tells Applitools which branch to diff against and merge into
    config.setParentBranchName(PARENT_BRANCH_NAME);

    eyes = new Eyes();
    eyes.setConfiguration(config);
  });

  test.afterEach(async () => {
    await eyes.abortIfNotClosed();
  });

  test('full page — diff2 variant', async ({ page }) => {
    await eyes.open(page, 'Helloworld', 'Main page', { width: 1280, height: 720 });

    await page.goto('https://applitools.com/helloworld?diff2');
    await expect(page.locator('h2')).toBeVisible();

    await eyes.check('Initial load', Target.window().fully());

    const result = await eyes.close(false);
    expect(result.isNew() || result.isPassed(),
      `Eyes result status: ${result.getStatus()}`
    ).toBe(true);
  });

  test('after button click — diff2 variant', async ({ page }) => {
    await eyes.open(page, 'Helloworld', 'After click', { width: 1280, height: 720 });

    await page.goto('https://applitools.com/helloworld?diff2');
    await page.locator('button', { hasText: 'Click me!' }).click();
    await expect(page.locator('text=You successfully clicked')).toBeVisible();

    await eyes.check('After click', Target.window().fully());

    const result = await eyes.close(false);
    expect(result.isNew() || result.isPassed(),
      `Eyes result status: ${result.getStatus()}`
    ).toBe(true);
  });
});
