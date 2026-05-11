/**
 * Merges Applitools Eyes baselines from a source branch into a target branch
 * using the Applitools Server API.
 *
 * Usage:
 *   def result = applitoolsMergeBranches(
 *       apiKey:           'your-api-key',               // required; use credentials binding
 *       sourceBranch:     'org/repo/feature-branch',    // required; format: company/repo/branch
 *       targetBranch:     'org/repo/main',              // required; format: company/repo/branch
 *       onlyCheck:        false,                        // optional; validate without merging (default: false)
 *       timeoutSecs:      300,                          // optional; total wait time in seconds (default: 300)
 *       pollIntervalSecs: 10,                           // optional; polling interval in seconds (default: 10)
 *       eyesServerUrl:    'https://eyes.applitools.com' // optional; override for self-hosted installations
 *   )
 *
 * Returns a Map:
 *   [merged: true/false, conflicts: <int>, changesCount: <int>, jobId: '...']
 *
 * Requires: curl, jq on the agent PATH.
 * Throws an exception (failing the build) on HTTP errors, missing branches, or timeout.
 */
def call(Map config) {
    validateConfig(config)

    String baseUrl      = (config.eyesServerUrl ?: 'https://eyes.applitools.com').replaceAll('/+$', '')
    String sourceBranch = config.sourceBranch
    String targetBranch = config.targetBranch
    boolean onlyCheck   = config.containsKey('onlyCheck') ? config.onlyCheck as boolean : false
    int timeoutSecs     = (config.timeoutSecs     ?: 300) as int
    int pollInterval    = (config.pollIntervalSecs ?: 10)  as int

    echo "Applitools: merging baselines from '${sourceBranch}' into '${targetBranch}' (onlyCheck=${onlyCheck})"

    String jobId
    Map mergeResult

    // User-supplied strings are passed as env vars so they never get interpolated
    // directly into shell scripts, avoiding injection from branch names with special chars.
    withEnv([
        "APPLITOOLS_API_KEY=${config.apiKey}",
        "APPLITOOLS_SOURCE_BRANCH=${sourceBranch}",
        "APPLITOOLS_TARGET_BRANCH=${targetBranch}",
    ]) {
        jobId = submitMergeRequest(baseUrl, onlyCheck)
        echo "Applitools: merge job submitted — jobId=${jobId}"

        pollUntilComplete(baseUrl, jobId, timeoutSecs, pollInterval)

        mergeResult = fetchResult(baseUrl, jobId)
    }

    mergeResult.jobId = jobId

    if (onlyCheck) {
        echo "Applitools: conflict check complete — conflicts=${mergeResult.conflicts}"
    } else {
        echo "Applitools: merge complete — merged=${mergeResult.merged}, conflicts=${mergeResult.conflicts}"
    }

    return mergeResult
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

private void validateConfig(Map config) {
    ['apiKey', 'sourceBranch', 'targetBranch'].each { key ->
        if (!config[key]) {
            error "applitoolsMergeBranches: required parameter '${key}' is missing or empty"
        }
    }
}

/**
 * POSTs the merge request and returns the jobId extracted from the Location header.
 * APPLITOOLS_SOURCE_BRANCH, APPLITOOLS_TARGET_BRANCH, and APPLITOOLS_API_KEY must be
 * set in the environment before calling (handled by the withEnv block in call()).
 */
private String submitMergeRequest(String baseUrl, boolean onlyCheck) {
    return sh(returnStdout: true, script: """#!/bin/bash
set -eo pipefail

SOURCE=\$(printf '%s' "\${APPLITOOLS_SOURCE_BRANCH}" | jq -Rr @uri)
TARGET=\$(printf '%s' "\${APPLITOOLS_TARGET_BRANCH}" | jq -Rr @uri)
HEADER_FILE=\$(mktemp)

STATUS=\$(curl -s -X POST \\
    -H "X-Eyes-Api-Key: \${APPLITOOLS_API_KEY}" \\
    -D "\${HEADER_FILE}" \\
    -o /dev/null \\
    -w '%{http_code}' \\
    "${baseUrl}/api/baselines/branches/merge?SourceBranch=\${SOURCE}&TargetBranch=\${TARGET}&OnlyCheck=${onlyCheck}")

if [ "\${STATUS}" != "202" ]; then
    rm -f "\${HEADER_FILE}"
    echo "ERROR: Merge request failed with HTTP \${STATUS}" >&2
    exit 1
fi

LOCATION=\$(grep -i '^location:' "\${HEADER_FILE}" | tr -d '\\r' | awk '{print \$2}' | tr -d '[:space:]')
rm -f "\${HEADER_FILE}"

if [ -z "\${LOCATION}" ]; then
    echo "ERROR: No Location header found in 202 response" >&2
    exit 1
fi

JOB_ID=\$(echo "\${LOCATION}" | sed 's|.*/tasks/||;s|/.*||')

if [ -z "\${JOB_ID}" ]; then
    echo "ERROR: Could not extract jobId from Location: \${LOCATION}" >&2
    exit 1
fi

printf '%s' "\${JOB_ID}"
""").trim()
}

/**
 * Polls GET /api/tasks/{jobId}/status until 201 (complete) or timeout.
 */
private void pollUntilComplete(String baseUrl, String jobId, int timeoutSecs, int pollIntervalSecs) {
    long deadline = System.currentTimeMillis() + (timeoutSecs * 1000L)

    while (System.currentTimeMillis() < deadline) {
        String statusCode = sh(returnStdout: true, script: """
curl -s -o /dev/null -w '%{http_code}' \\
    -H "X-Eyes-Api-Key: \${APPLITOOLS_API_KEY}" \\
    "${baseUrl}/api/tasks/${jobId}/status"
""").trim()

        if (statusCode == '201') {
            return
        } else if (statusCode == '200') {
            echo "Applitools: merge in progress — waiting ${pollIntervalSecs}s..."
            sleep(pollIntervalSecs)
        } else {
            error "Applitools status poll returned unexpected HTTP ${statusCode} for jobId=${jobId}"
        }
    }

    error "Applitools merge timed out after ${timeoutSecs}s for jobId=${jobId}"
}

/**
 * GETs /api/tasks/{jobId}/result, extracts fields with jq, and returns a Map.
 * Returns: [merged: bool, conflicts: int, changesCount: int]
 */
private Map fetchResult(String baseUrl, String jobId) {
    String output = sh(returnStdout: true, script: """#!/bin/bash
set -eo pipefail

BODY_FILE=\$(mktemp)

STATUS=\$(curl -s \\
    -H "X-Eyes-Api-Key: \${APPLITOOLS_API_KEY}" \\
    -o "\${BODY_FILE}" \\
    -w '%{http_code}' \\
    "${baseUrl}/api/tasks/${jobId}/result")

case "\${STATUS}" in
    200) ;;
    204) rm -f "\${BODY_FILE}"; echo "ERROR: Result not ready — job may not have started (HTTP 204)" >&2; exit 1 ;;
    404) rm -f "\${BODY_FILE}"; echo "ERROR: Branch not found (HTTP 404)" >&2; exit 1 ;;
    *)   rm -f "\${BODY_FILE}"; echo "ERROR: Result fetch failed with HTTP \${STATUS}" >&2; exit 1 ;;
esac

jq -r '[(.merged // false), (.conflicts // 0), ((.changes // []) | length)] | @tsv' "\${BODY_FILE}"
rm -f "\${BODY_FILE}"
""").trim()

    def parts = output.split('\t')
    return [
        merged:       parts[0] == 'true',
        conflicts:    parts[1] as int,
        changesCount: parts[2] as int,
    ]
}
