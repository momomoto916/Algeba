import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Address } from 'viem';
import { requestWalletConnection } from '../utils/wallet';

interface WalletContextType {
  walletAddress: Address | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  setWalletAddress: (address: Address | null) => void;
  setIsConnected: (connected: boolean) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const STORAGE_KEY = 'walletAddress';

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<Address | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const applyAccount = useCallback((account: string | null | undefined) => {
    if (account) {
      setWalletAddress(account as Address);
      setIsConnected(true);
    } else {
      setWalletAddress(null);
      setIsConnected(false);
    }
  }, []);

  // Restore a previous session only if the wallet still authorizes this site.
  // Trusting localStorage alone showed "connected" while every transaction
  // failed because the extension had locked or revoked access.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error loading wallet from storage:', error);
    }
    if (!saved || saved === 'null' || !window.ethereum) return;

    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts: string[]) => {
        const match = accounts.find((a) => a.toLowerCase() === saved!.toLowerCase()) ?? accounts[0];
        applyAccount(match);
      })
      .catch((error: unknown) => console.error('Error restoring wallet:', error));
  }, [applyAccount]);

  // Follow account switches / disconnects made inside the wallet extension.
  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum?.on) return;
    const onAccountsChanged = (accounts: string[]) => applyAccount(accounts[0]);
    ethereum.on('accountsChanged', onAccountsChanged);
    return () => ethereum.removeListener?.('accountsChanged', onAccountsChanged);
  }, [applyAccount]);

  useEffect(() => {
    try {
      if (walletAddress) {
        localStorage.setItem(STORAGE_KEY, walletAddress);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error saving wallet to storage:', error);
    }
  }, [walletAddress]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const wallet = await requestWalletConnection();
      if (wallet.isConnected && wallet.address) applyAccount(wallet.address);
    } finally {
      setIsConnecting(false);
    }
  }, [applyAccount]);

  const disconnect = useCallback(() => applyAccount(null), [applyAccount]);

  return (
    <WalletContext.Provider
      value={{ walletAddress, isConnected, isConnecting, connect, disconnect, setWalletAddress, setIsConnected }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
