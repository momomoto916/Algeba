import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Address } from 'viem';

interface WalletContextType {
  walletAddress: Address | null;
  isConnected: boolean;
  setWalletAddress: (address: Address | null) => void;
  setIsConnected: (connected: boolean) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<Address | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Load wallet from localStorage on mount
  useEffect(() => {
    try {
      const savedAddress = localStorage.getItem('walletAddress');
      if (savedAddress && savedAddress !== 'null') {
        setWalletAddress(savedAddress as Address);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error loading wallet from storage:', error);
    }
  }, []);

  // Save wallet to localStorage when it changes
  useEffect(() => {
    try {
      if (walletAddress) {
        localStorage.setItem('walletAddress', walletAddress);
      } else {
        localStorage.removeItem('walletAddress');
      }
    } catch (error) {
      console.error('Error saving wallet to storage:', error);
    }
  }, [walletAddress]);

  return (
    <WalletContext.Provider value={{ walletAddress, isConnected, setWalletAddress, setIsConnected }}>
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
