import { createPublicClient, http } from 'viem';
import type { NetworkConfig } from '../config/networks';

/**
 * Creates a viem public client with retry/timeout config, since a bare
 * `http()` transport has none — a single dropped request (viem's bundled
 * chain definitions each point at one shared free public RPC with no
 * redundancy) surfaces as a raw "Failed to fetch" straight to the user
 * instead of being retried.
 */
export function createNetworkPublicClient(network: NetworkConfig) {
  return createPublicClient({
    chain: network.chain,
    // Readings fired in the same tick (e.g. the 9 stats reads) are folded into
    // one Multicall3 eth_call. Fewer requests means the free public RPC stops
    // rate-limiting us, which is what made sections vanish and reappear.
    batch: { multicall: true },
    transport: http(network.rpcUrl, {
      timeout: 10_000,
      retryCount: 3,
      retryDelay: 1_000,
    }),
  });
}
