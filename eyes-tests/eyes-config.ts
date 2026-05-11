import { BatchInfo, Configuration } from '@applitools/eyes-playwright';

export const org  = process.env.APPLITOOLS_ORG  ?? 'myorg';
export const repo = process.env.APPLITOOLS_REPO ?? 'helloworld-demo';

// Pin a batch ID for this process before any BatchInfo is constructed.
// The SDK reads APPLITOOLS_BATCH_ID automatically, so this is more reliable
// than passing a BatchInfo object reference (which gets cloned inside Configuration).
// In CI, set APPLITOOLS_BATCH_ID externally (e.g. to the build number) to group
// runs across separate invocations.
if (!process.env.APPLITOOLS_BATCH_ID) {
  process.env.APPLITOOLS_BATCH_ID = Date.now().toString();
}

export function createEyesConfig(): Configuration {
  if (!process.env.APPLITOOLS_API_KEY) {
    throw new Error('APPLITOOLS_API_KEY environment variable is not set');
  }
  const config = new Configuration();
  config.setApiKey(process.env.APPLITOOLS_API_KEY);
  config.setBatch(new BatchInfo(
    process.env.APPLITOOLS_BATCH_NAME ?? 'Helloworld Baseline Merge Demo'
  ));
  return config;
}
