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

import { test, expect }        from '@playwright/test';
import { Eyes, Target }        from '@applitools/eyes-playwright';
import { createEyesConfig, org, repo } from '../eyes-config';

const BRANCH_NAME        = `${org}/${repo}/feature-helloworld-diff2`;
const PARENT_BRANCH_NAME = `${org}/${repo}/main`;

test.describe('Helloworld — feature branch baseline (?diff2)', () => {
  let eyes: Eyes;

  test.beforeEach(async () => {
    const config = createEyesConfig();
    config.setBranchName(BRANCH_NAME);
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
    await page.waitForLoadState('networkidle');

    await eyes.check('Initial load', Target.window().fully());
    await eyes.close();
  });

  test('after button click — diff2 variant', async ({ page }) => {
    await eyes.open(page, 'Helloworld', 'After click', { width: 1280, height: 720 });

    await page.goto('https://applitools.com/helloworld?diff2');
    await page.locator('button', { hasText: 'Click me!' }).click();
    await expect(page.locator('text=You successfully clicked')).toBeVisible();

    await eyes.check('After click', Target.window().fully());
    await eyes.close();
  });
});
