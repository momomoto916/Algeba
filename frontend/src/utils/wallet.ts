import type { Address } from 'viem';
import { DEPLOYER_WALLET } from '../config/constants';

// Placeholder for wallet connection state
// In production, this would use MetaMask or WalletConnect
export interface WalletState {
  isConnected: boolean;
  address: Address | null;
  chainId: number | null;
}

export const defaultWalletState: WalletState = {
  isConnected: false,
  address: null,
  chainId: null,
};

// Check if window.ethereum exists (MetaMask, etc.)
export const hasEthereumProvider = () => {
  if (typeof window === 'undefined') return false;
  return 'ethereum' in window;
};

// Request wallet connection (MetaMask)
export const requestWalletConnection = async (): Promise<WalletState> => {
  try {
    if (!hasEthereumProvider()) {
      alert('Please install a Web3 wallet (MetaMask, etc.)');
      return defaultWalletState;
    }

    const ethereum = (window as any).ethereum;
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    const chainId = await ethereum.request({ method: 'eth_chainId' });
    
    if (accounts.length === 0) {
      return defaultWalletState;
    }

    return {
      isConnected: true,
      address: accounts[0],
      chainId: parseInt(chainId, 16),
    };
  } catch (error) {
    console.error('Error connecting wallet:', error);
    return defaultWalletState;
  }
};

// Disconnect wallet
export const disconnectWallet = (): WalletState => {
  return defaultWalletState;
};

// Check whether the given address is the authorized deployer wallet
export const isDeployerWallet = (address?: string | null): boolean => {
  if (!address || !DEPLOYER_WALLET) return false;
  return address.toLowerCase() === DEPLOYER_WALLET.toLowerCase();
};
