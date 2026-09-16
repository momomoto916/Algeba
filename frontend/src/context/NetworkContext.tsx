import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { NETWORKS, DEFAULT_NETWORK, type NetworkKey, type NetworkConfig } from '../config/networks';

interface NetworkContextType {
  networkKey: NetworkKey;
  network: NetworkConfig;
  setNetworkKey: (key: NetworkKey) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [networkKey, setNetworkKey] = useState<NetworkKey>(DEFAULT_NETWORK);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('algeba_network');
      if (saved === 'mainnet' || saved === 'sepolia') {
        setNetworkKey(saved);
      }
    } catch (error) {
      console.error('Error loading network from storage:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('algeba_network', networkKey);
    } catch (error) {
      console.error('Error saving network to storage:', error);
    }
  }, [networkKey]);

  return (
    <NetworkContext.Provider value={{ networkKey, network: NETWORKS[networkKey], setNetworkKey }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
}
