import { PublicAddressGuard } from '../../src/images/PublicAddressGuard.js';

/** The real guard over a fake resolver: hosts ending in `.internal` resolve to the home network, the rest to a public address. */
export const testUrlGuard = new PublicAddressGuard(async (host) =>
  host.endsWith('.internal') ? ['192.168.1.15'] : ['93.184.215.14'],
);
