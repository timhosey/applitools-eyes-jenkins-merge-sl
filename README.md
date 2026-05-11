# Applitools Eyes Baseline Merge — Jenkins Shared Library

A Jenkins shared library step that merges Applitools Eyes baselines between branches using the [Applitools Server API](https://applitools.com/docs/eyes/reference/server-api/scm-integrations/merge-branches).

## Setup

### 1. Add to Jenkins

In **Manage Jenkins → System → Global Pipeline Libraries**, add:

| Field | Value |
|-------|-------|
| Name | `applitools-shared-library` (or any name you prefer) |
| Default version | `main` |
| Source | This repository's SCM URL |

### 2. Store the API key

In **Manage Jenkins → Credentials**, create a **Secret text** credential with:
- ID: `applitools-api-key`
- Value: your Applitools merge API key (found in the Eyes dashboard under Team → API Key)

---

## Usage

```groovy
@Library('applitools-shared-library') _

stage('Merge Applitools Baselines') {
    steps {
        script {
            def result = applitoolsMergeBranches(
                apiKey:           env.APPLITOOLS_API_KEY,  // from credentials binding
                sourceBranch:     'myorg/my-repo/feature-branch',
                targetBranch:     'myorg/my-repo/main',
                onlyCheck:        false,          // set true to check for conflicts without merging
                timeoutSecs:      300,            // how long to wait for the job (default: 300)
                pollIntervalSecs: 10,             // how often to poll for status (default: 10)
                eyesServerUrl:    'https://eyes.applitools.com'  // only needed for self-hosted
            )

            echo "merged=${result.merged}, conflicts=${result.conflicts}"
        }
    }
}
```

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `apiKey` | Yes | — | Applitools API key. Use `credentials()` binding — never hardcode. |
| `sourceBranch` | Yes | — | Branch to merge **from**. Format: `company/repo/branch`. |
| `targetBranch` | Yes | — | Branch to merge **into**. Format: `company/repo/branch`. |
| `onlyCheck` | No | `false` | If `true`, validates for conflicts without performing the merge. |
| `timeoutSecs` | No | `300` | Maximum seconds to wait for the async merge job to complete. |
| `pollIntervalSecs` | No | `10` | Seconds between status poll requests. |
| `eyesServerUrl` | No | `https://eyes.applitools.com` | Override for self-hosted Applitools installations. |

### Return value

The step returns a `Map` with:

| Key | Type | Description |
|-----|------|-------------|
| `merged` | Boolean | Whether the merge was performed successfully. |
| `conflicts` | Integer | Number of conflicting baselines detected. |
| `changes` | List | Array of changed baseline entries from the API response. |
| `jobId` | String | The async job ID, useful for debugging. |

### Error handling

The step throws a `RuntimeException` (failing the build) if:
- Required parameters are missing
- The API returns a non-202 status on the initial merge request
- The branch is not found (HTTP 404)
- The job does not complete within `timeoutSecs`

Use `catchError` or `try/catch` in your pipeline if you want non-fatal behavior.

---

## Branch name format

The Applitools API expects branch names in the format `company_name/repository/branch`, for example:

```
acme-corp/my-app/feature-login
acme-corp/my-app/main
```

You can construct these dynamically in a pipeline:

```groovy
def repo   = scm.getUserRemoteConfigs()[0].getUrl().tokenize('/').last().replace('.git', '')
def org    = 'acme-corp'
def source = "${org}/${repo}/${env.BRANCH_NAME}"
def target = "${org}/${repo}/main"
```

---

## Requirements

- Jenkins 2.x with Pipeline support
- No additional plugins required (uses Groovy's built-in `HttpURLConnection`)
- Script security: `groovy.json.JsonSlurperClassic` must be whitelisted if running in a sandboxed environment. Add it via **Manage Jenkins → In-process Script Approval** if needed.
# applitools-eyes-jenkins-merge-sl
