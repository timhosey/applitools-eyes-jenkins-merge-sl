# Eyes Tests

Playwright + Applitools Eyes tests used to validate the `applitoolsMergeBranches` Jenkins shared library. The two specs capture baselines on separate Applitools branches so that a merge can be triggered and verified.

## Setup

```bash
cd eyes-tests
npm install
npx playwright install chromium
```

Set your API key:

```bash
export APPLITOOLS_API_KEY=<your-api-key>
```

Optionally override the org and repo name used to build Applitools branch paths (defaults shown):

```bash
export APPLITOOLS_ORG=myorg
export APPLITOOLS_REPO=helloworld-demo
```

## Running the tests

Run them in order. The main branch spec must go first so the feature spec has a parent baseline to branch from.

```bash
# 1. Establish the main branch baseline (https://applitools.com/helloworld/)
npm run test:main

# 2. Capture the feature branch baseline (https://applitools.com/helloworld?diff2)
npm run test:feature
```

## Resulting Applitools branches

| Spec | URL | Applitools branch |
|------|-----|-------------------|
| `main-branch.spec.ts` | `helloworld/` | `<org>/<repo>/main` |
| `feature-branch.spec.ts` | `helloworld?diff2` | `<org>/<repo>/feature-helloworld-diff2` |

The `?diff2` variant renders with a different layout, so the two branches will have visually distinct baselines — exactly what you need to exercise the merge.

## Validating the shared library

After both specs have passed, trigger the Jenkins pipeline (or call the step directly) with:

```groovy
applitoolsMergeBranches(
    apiKey:       env.APPLITOOLS_API_KEY,
    sourceBranch: 'myorg/helloworld-demo/feature-helloworld-diff2',
    targetBranch: 'myorg/helloworld-demo/main'
)
```

A successful merge with `merged=true` confirms the shared library is working end-to-end.
