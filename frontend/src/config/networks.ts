import { mainnet, sepolia } from 'viem/chains';
import type { Chain } from 'viem';

export type NetworkKey = 'mainnet' | 'sepolia';

export interface ContractAddresses {
  ALGEBA: string;
  GENESIS: string;
  STAKING: string;
}

export interface NetworkConfig {
  key: NetworkKey;
  label: string;
  chain: Chain;
  explorerUrl: string;
  contracts: ContractAddresses;
  // Optional override for the chain's bundled default RPC — viem's built-in
  // sepolia/mainnet definitions each point at a single shared free public
  // endpoint (e.g. thirdweb's), which has no redundancy and can fail under
  // load ("Failed to fetch"). Set these to a dedicated RPC (Alchemy/Infura/etc)
  // for more reliable confirmations.
  rpcUrl?: string;
}

export const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  mainnet: {
    key: 'mainnet',
    label: 'Ethereum',
    chain: mainnet,
    explorerUrl: 'https://etherscan.io',
    rpcUrl: import.meta.env.VITE_RPC_URL_MAINNET || undefined,
    contracts: {
      ALGEBA: import.meta.env.VITE_ALGEBA_ADDRESS_MAINNET || '',
      GENESIS: import.meta.env.VITE_GENESIS_ADDRESS_MAINNET || '',
      STAKING: import.meta.env.VITE_STAKING_ADDRESS_MAINNET || '',
    },
  },
  sepolia: {
    key: 'sepolia',
    label: 'Sepolia',
    chain: sepolia,
    explorerUrl: 'https://sepolia.etherscan.io',
    rpcUrl: import.meta.env.VITE_RPC_URL_SEPOLIA || undefined,
    contracts: {
      ALGEBA: import.meta.env.VITE_ALGEBA_ADDRESS_SEPOLIA || '',
      GENESIS: import.meta.env.VITE_GENESIS_ADDRESS_SEPOLIA || '',
      STAKING: import.meta.env.VITE_STAKING_ADDRESS_SEPOLIA || '',
    },
  },
};

export const DEFAULT_NETWORK: NetworkKey = 'mainnet';

export function explorerAddressUrl(network: NetworkConfig, address: string) {
  return `${network.explorerUrl}/address/${address}`;
}

export function explorerTxUrl(network: NetworkConfig, hash: string) {
  return `${network.explorerUrl}/tx/${hash}`;
}
