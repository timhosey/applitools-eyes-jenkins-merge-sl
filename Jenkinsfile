@Library('applitools-shared-library') _

pipeline {
    agent any

    parameters {
        string(
            name:         'APPLITOOLS_ORG',
            defaultValue: 'myorg',
            description:  'Applitools org/company name — the first segment of the branch path (e.g. "myorg" in "myorg/repo/branch")'
        )
        string(
            name:         'SOURCE_BRANCH',
            defaultValue: '',
            description:  'Source branch to merge baselines FROM. Leave blank to use the current Git branch.'
        )
        string(
            name:         'TARGET_BRANCH',
            defaultValue: 'main',
            description:  'Target branch to merge baselines INTO.'
        )
        booleanParam(
            name:         'ONLY_CHECK',
            defaultValue: false,
            description:  'When true, checks for conflicts without performing the merge.'
        )
    }

    environment {
        // Secret text credential — set up in Manage Jenkins > Credentials
        APPLITOOLS_API_KEY = credentials('applitools-api-key')
    }

    stages {

        stage('Resolve Branch Names') {
            steps {
                script {
                    // Derive the repository name from the remote URL.
                    // Handles both HTTPS and SSH remote formats.
                    env.REPO_NAME = sh(
                        returnStdout: true,
                        script: "git remote get-url origin | sed 's|.*/||;s|\\.git\$||'"
                    ).trim()

                    // Use the explicitly supplied source branch, or fall back to the
                    // branch Jenkins checked out (BRANCH_NAME for multibranch pipelines,
                    // GIT_BRANCH for freestyle-triggered pipelines).
                    String rawSource = params.SOURCE_BRANCH?.trim()
                        ?: env.BRANCH_NAME
                        ?: env.GIT_BRANCH?.replaceFirst(/^origin\//, '')

                    if (!rawSource) {
                        error 'Could not determine source branch. Set the SOURCE_BRANCH parameter explicitly.'
                    }

                    // Build fully-qualified Applitools branch paths: org/repo/branch
                    env.APPLITOOLS_SOURCE = "${params.APPLITOOLS_ORG}/${env.REPO_NAME}/${rawSource}"
                    env.APPLITOOLS_TARGET = "${params.APPLITOOLS_ORG}/${env.REPO_NAME}/${params.TARGET_BRANCH}"

                    echo "Source : ${env.APPLITOOLS_SOURCE}"
                    echo "Target : ${env.APPLITOOLS_TARGET}"
                }
            }
        }

        stage('Check for Conflicts') {
            steps {
                script {
                    def checkResult = applitoolsMergeBranches(
                        apiKey:           env.APPLITOOLS_API_KEY,
                        sourceBranch:     env.APPLITOOLS_SOURCE,
                        targetBranch:     env.APPLITOOLS_TARGET,
                        onlyCheck:        true,
                        timeoutSecs:      120,
                        pollIntervalSecs: 10
                    )

                    env.CONFLICT_COUNT = "${checkResult.conflicts}"

                    if (checkResult.conflicts > 0) {
                        unstable("Applitools: ${checkResult.conflicts} baseline conflict(s) detected between '${env.APPLITOOLS_SOURCE}' and '${env.APPLITOOLS_TARGET}'. Review in the Eyes dashboard before merging.")
                    } else {
                        echo 'Applitools: no conflicts detected — safe to merge.'
                    }
                }
            }
        }

        stage('Merge Baselines') {
            // Skip the actual merge when:
            //   - the caller only wanted a conflict check, OR
            //   - conflicts were found (build marked unstable above)
            when {
                allOf {
                    not { expression { params.ONLY_CHECK } }
                    expression { currentBuild.result == null || currentBuild.result == 'SUCCESS' }
                }
            }
            steps {
                script {
                    def mergeResult = applitoolsMergeBranches(
                        apiKey:           env.APPLITOOLS_API_KEY,
                        sourceBranch:     env.APPLITOOLS_SOURCE,
                        targetBranch:     env.APPLITOOLS_TARGET,
                        onlyCheck:        false,
                        timeoutSecs:      300,
                        pollIntervalSecs: 10
                    )

                    echo "Applitools merge complete:"
                    echo "  merged       : ${mergeResult.merged}"
                    echo "  conflicts    : ${mergeResult.conflicts}"
                    echo "  changes      : ${mergeResult.changesCount}"
                    echo "  jobId        : ${mergeResult.jobId}"

                    if (!mergeResult.merged) {
                        unstable('Applitools: merge completed but merged=false. Check the Eyes dashboard for details.')
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Applitools baseline merge pipeline completed successfully.'
        }
        unstable {
            echo "Applitools baseline merge completed with warnings (conflicts: ${env.CONFLICT_COUNT ?: 'unknown'}). Review the Eyes dashboard."
        }
        failure {
            echo 'Applitools baseline merge pipeline failed. Check the logs above for details.'
        }
    }
}
