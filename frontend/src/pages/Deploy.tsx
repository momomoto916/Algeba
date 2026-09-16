import { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { isDeployerWallet } from '../utils/wallet';
import { DeployContracts } from './deploy/DeployContracts';
import { DeployBridge } from './deploy/DeployBridge';

type Tab = 'contracts' | 'bridge';

export function Deploy() {
  const { walletAddress, isConnected } = useWallet();
  const authorized = isConnected && isDeployerWallet(walletAddress);
  const [tab, setTab] = useState<Tab>('contracts');

  if (!authorized) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Deploy</h1>
        </div>
        <div className="alert alert-danger">
          <strong>Access Restricted.</strong> This page is only available to the authorized deployer wallet.
          {!isConnected && ' Connect your wallet to continue.'}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Deploy</h1>
        <p className="page-subtitle">Deploy contracts directly from your connected wallet</p>
      </div>

      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setTab('contracts')}
          className={`nav-link${tab === 'contracts' ? ' active' : ''}`}
        >
          Main Contracts
        </button>
        <button
          onClick={() => setTab('bridge')}
          className={`nav-link${tab === 'bridge' ? ' active' : ''}`}
        >
          Bridge (LayerZero)
        </button>
      </div>

      <div className="py-2.5 px-2">
        {tab === 'contracts' && <DeployContracts walletAddress={walletAddress || ''} />}
        {tab === 'bridge' && <DeployBridge walletAddress={walletAddress || ''} />}
      </div>
    </>
  );
}
