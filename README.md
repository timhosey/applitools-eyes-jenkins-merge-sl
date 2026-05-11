# Applitools Eyes Baseline Merge: Jenkins Shared Library

A Jenkins shared library step that merges Applitools Eyes baselines between branches using the [Applitools Server API](https://applitools.com/docs/eyes/reference/server-api/scm-integrations/merge-branches).

## Requirements

- Jenkins 2.x with Pipeline support
- `curl` and `jq` available on the agent's `PATH`
- No additional Jenkins plugins required

---

## Setup

### 1. Add to Jenkins

In **Manage Jenkins -> System -> Global Pipeline Libraries**, add:

| Field | Value |
|-------|-------|
| Name | `applitools-shared-library` (or any name you prefer) |
| Default version | `main` |
| Source | This repository's SCM URL |

### 2. Store the API key

In **Manage Jenkins -> Credentials**, create a **Secret text** credential with:
- ID: `applitools-api-key`
- Value: your Applitools merge API key (found or generated in the Eyes admin view under API Keys)

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
                eyesServerUrl:    'https://eyes.applitools.com'  // only needed for private cloud
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
| `changesCount` | Integer | Number of baselines changed by the merge. |
| `jobId` | String | The async job ID, useful for debugging. |

### Error handling

The step fails the build (via `error`) if:
- Required parameters are missing
- The API returns a non-202 status on the initial merge request
- The branch is not found (HTTP 404)
- The job does not complete within `timeoutSecs`

Use `catchError` or `try/catch` in your pipeline if you want non-fatal behavior.

---

## Branch name format

The Applitools API expects branch names in the format `company/repository/branch`, for example:

```
acme-corp/my-app/feature-login
acme-corp/my-app/main
```

You can construct these dynamically in a pipeline:

```groovy
def repo   = sh(returnStdout: true, script: "git remote get-url origin | sed 's|.*/||;s|\\.git\$||'").trim()
def org    = 'acme-corp'
def source = "${org}/${repo}/${env.BRANCH_NAME}"
def target = "${org}/${repo}/main"
```

---

## Implementation notes

All HTTP calls are made with `curl` and JSON responses are parsed with `jq` inside `sh` steps, so there is no Groovy JSON parsing as JsonSlurper is a performance risk per the Jenkins docs. The API key and branch names are passed to shell via `withEnv` rather than Groovy string interpolation, which prevents shell injection from branch names containing special characters and keeps the API key out of shell process listings.

The merge is asynchronous: the step POSTs the request, extracts the job ID from the `Location` response header, polls the status endpoint until the job completes (HTTP 201), then retrieves the result.
