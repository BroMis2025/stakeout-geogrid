import {
  proxyPort, proxyCredentials, proxySellerRead,
  proxyPackageSummary, proxyListsSummary,
} from '../packages/core/proxySeller';

async function run() {
  const { login } = proxyCredentials();
  const firstSlotPort = proxyPort(1);
  const listsPath = process.env.PROXY_SELLER_LISTS_PATH ?? 'resident/lists';
  if (listsPath !== 'resident/lists' && listsPath !== 'proxy/lists')
    throw new Error('PROXY_SELLER_LISTS_PATH must be resident/lists or proxy/lists.');
  const key = process.env.PROXY_SELLER_API_KEY ?? '';
  const packageInfo = proxyPackageSummary(await proxySellerRead('resident/package', key));
  const lists = proxyListsSummary(await proxySellerRead(listsPath, key), login);
  console.log(JSON.stringify({
    package: packageInfo,
    lists: { ...lists, endpoint: listsPath },
    connection: {
      protocol: 'socks5',
      firstSlotPort,
      slotPortsEnabled: process.env.PROXY_USE_SLOT_PORT === 'true',
      liveExitVerified: false,
    },
  }, null, 2));
  if (!packageInfo.active || packageInfo.trafficLeftBytes === '0') {
    console.error('Package inactive or traffic exhausted. Check the provider dashboard before scanning.');
    process.exitCode = 2;
  } else if (!lists.configuredLoginFound) {
    console.error('Configured login was not found in this list response. Confirm the API Tools credentials and endpoint.');
    process.exitCode = 2;
  }
}
run().catch((error) => {
  // Helpers emit fixed error messages and discard provider bodies and network causes.
  console.error(error instanceof Error ? error.message : 'PROXY_SELLER_CHECK_FAILED');
  process.exitCode = 1;
});
