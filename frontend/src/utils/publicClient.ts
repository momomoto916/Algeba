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
    transport: http(network.rpcUrl, {
      timeout: 10_000,
      retryCount: 3,
      retryDelay: 1_000,
    }),
  });
}
