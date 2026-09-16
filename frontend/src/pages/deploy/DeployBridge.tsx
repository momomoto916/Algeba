import { useState } from 'react';
import { createPublicClient, createWalletClient, custom, http, pad, isAddress } from 'viem';
import { sepolia, baseSepolia } from 'viem/chains';
import AGBOFTAdapterArtifact from '../../contracts-artifacts/AGBOFTAdapter.json';
import AGBOFTArtifact from '../../contracts-artifacts/AGBOFT.json';
import { CONTRACTS } from '../../config/contracts';
import { LZ_EID, LZ_ENDPOINT_DEFAULTS } from '../../config/bridge';
import { StepShell, CopyButton, AddressCard, TxLine, type StepStatus } from './shared';
import { ensureChain } from '../../utils/chainSwitch';

const sepoliaPublicClient = createPublicClient({ chain: sepolia, transport: http(undefined, { timeout: 10_000, retryCount: 3, retryDelay: 1_000 }) });
const baseSepoliaPublicClient = createPublicClient({ chain: baseSepolia, transport: http(undefined, { timeout: 10_000, retryCount: 3, retryDelay: 1_000 }) });

const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';

export function DeployBridge({ walletAddress }: { walletAddress: string }) {
  const [algebaAddress, setAlgebaAddress] = useState(CONTRACTS.ALGEBA || '');
  const [sepoliaEndpoint, setSepoliaEndpoint] = useState<string>(LZ_ENDPOINT_DEFAULTS.SEPOLIA);
  const [adapterAddress, setAdapterAddress] = useState<string | null>(null);
  const [adapterTx, setAdapterTx] = useState<string | null>(null);
  const [adapterStatus, setAdapterStatus] = useState<StepStatus>('active');
  const [adapterError, setAdapterError] = useState<string | null>(null);

  const [oftName, setOftName] = useState('ALGEBA');
  const [oftSymbol, setOftSymbol] = useState('AGB');
  const [baseSepoliaEndpoint, setBaseSepoliaEndpoint] = useState<string>(LZ_ENDPOINT_DEFAULTS.BASE_SEPOLIA);
  const [oftAddress, setOftAddress] = useState<string | null>(null);
  const [oftTx, setOftTx] = useState<string | null>(null);
  const [oftStatus, setOftStatus] = useState<StepStatus>('locked');
  const [oftError, setOftError] = useState<string | null>(null);

  const [peerSepoliaTx, setPeerSepoliaTx] = useState<string | null>(null);
  const [peerSepoliaStatus, setPeerSepoliaStatus] = useState<StepStatus>('locked');
  const [peerSepoliaError, setPeerSepoliaError] = useState<string | null>(null);

  const [peerBaseSepoliaTx, setPeerBaseSepoliaTx] = useState<string | null>(null);
  const [peerBaseSepoliaStatus, setPeerBaseSepoliaStatus] = useState<StepStatus>('locked');
  const [peerBaseSepoliaError, setPeerBaseSepoliaError] = useState<string | null>(null);

  const deployAdapter = async () => {
    if (!walletAddress || !isAddress(algebaAddress) || !isAddress(sepoliaEndpoint)) return;
    setAdapterStatus('pending');
    setAdapterError(null);
    try {
      await ensureChain(sepolia);
      const walletClient = createWalletClient({ chain: sepolia, transport: custom(window.ethereum) });
      const hash = await walletClient.deployContract({
        account: walletAddress as `0x${string}`,
        abi: AGBOFTAdapterArtifact.abi,
        bytecode: AGBOFTAdapterArtifact.bytecode as `0x${string}`,
        args: [algebaAddress, sepoliaEndpoint, walletAddress],
      });
      setAdapterTx(hash);
      const receipt = await sepoliaPublicClient.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) throw new Error('No contract address in receipt');
      setAdapterAddress(receipt.contractAddress);
      setAdapterStatus('done');
      setOftStatus('active');
    } catch (err) {
      console.error('AGBOFTAdapter deploy failed:', err);
      setAdapterError(err instanceof Error ? err.message : 'Deployment failed');
      setAdapterStatus('error');
    }
  };

  const deployOft = async () => {
    if (!walletAddress || !isAddress(baseSepoliaEndpoint) || !oftName || !oftSymbol) return;
    setOftStatus('pending');
    setOftError(null);
    try {
      await ensureChain(baseSepolia);
      const walletClient = createWalletClient({ chain: baseSepolia, transport: custom(window.ethereum) });
      const hash = await walletClient.deployContract({
        account: walletAddress as `0x${string}`,
        abi: AGBOFTArtifact.abi,
        bytecode: AGBOFTArtifact.bytecode as `0x${string}`,
        args: [oftName, oftSymbol, baseSepoliaEndpoint, walletAddress],
      });
      setOftTx(hash);
      const receipt = await baseSepoliaPublicClient.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) throw new Error('No contract address in receipt');
      setOftAddress(receipt.contractAddress);
      setOftStatus('done');
      setPeerSepoliaStatus('active');
    } catch (err) {
      console.error('AGBOFT deploy failed:', err);
      setOftError(err instanceof Error ? err.message : 'Deployment failed');
      setOftStatus('error');
    }
  };

  const wirePeerOnSepolia = async () => {
    if (!walletAddress || !adapterAddress || !oftAddress) return;
    setPeerSepoliaStatus('pending');
    setPeerSepoliaError(null);
    try {
      await ensureChain(sepolia);
      const walletClient = createWalletClient({ chain: sepolia, transport: custom(window.ethereum) });
      const hash = await walletClient.writeContract({
        account: walletAddress as `0x${string}`,
        address: adapterAddress as `0x${string}`,
        abi: AGBOFTAdapterArtifact.abi,
        functionName: 'setPeer',
        args: [LZ_EID.BASE_SEPOLIA, pad(oftAddress as `0x${string}`, { size: 32 })],
      });
      setPeerSepoliaTx(hash);
      await sepoliaPublicClient.waitForTransactionReceipt({ hash });
      setPeerSepoliaStatus('done');
      setPeerBaseSepoliaStatus('active');
    } catch (err) {
      console.error('Wiring peer on Sepolia failed:', err);
      setPeerSepoliaError(err instanceof Error ? err.message : 'Transaction failed');
      setPeerSepoliaStatus('error');
    }
  };

  const wirePeerOnBaseSepolia = async () => {
    if (!walletAddress || !adapterAddress || !oftAddress) return;
    setPeerBaseSepoliaStatus('pending');
    setPeerBaseSepoliaError(null);
    try {
      await ensureChain(baseSepolia);
      const walletClient = createWalletClient({ chain: baseSepolia, transport: custom(window.ethereum) });
      const hash = await walletClient.writeContract({
        account: walletAddress as `0x${string}`,
        address: oftAddress as `0x${string}`,
        abi: AGBOFTArtifact.abi,
        functionName: 'setPeer',
        args: [LZ_EID.SEPOLIA, pad(adapterAddress as `0x${string}`, { size: 32 })],
      });
      setPeerBaseSepoliaTx(hash);
      await baseSepoliaPublicClient.waitForTransactionReceipt({ hash });
      setPeerBaseSepoliaStatus('done');
    } catch (err) {
      console.error('Wiring peer on Base Sepolia failed:', err);
      setPeerBaseSepoliaError(err instanceof Error ? err.message : 'Transaction failed');
      setPeerBaseSepoliaStatus('error');
    }
  };

  const allDone = peerBaseSepoliaStatus === 'done';

  return (
    <div className="space-y-6">
      <div className="alert alert-primary mb-0">
        Deploying as <strong>{walletAddress}</strong>. This flow deploys contracts on <strong>two networks</strong> —
        your wallet will prompt you to switch between Sepolia and Base Sepolia as needed.
      </div>

      <StepShell number={1} title="Deploy AGBOFTAdapter (Sepolia)" status={adapterStatus}>
        <p className="text-muted">Locks AGB here when bridging out to Base Sepolia, releases it when bridging back in.</p>
        <label className="text-xs text-muted uppercase font-medium tracking-wide block mb-1">ALGEBA Token Address</label>
        <input
          type="text"
          value={algebaAddress}
          onChange={(e) => setAlgebaAddress(e.target.value)}
          disabled={adapterStatus === 'done' || adapterStatus === 'pending'}
          placeholder="0x..."
        />
        <label className="text-xs text-muted uppercase font-medium tracking-wide block mb-1 mt-2">
          Sepolia LayerZero Endpoint — copy the "EndpointV2" address from{' '}
          <a href="https://docs.layerzero.network/v2/deployments/chains/sepolia" target="_blank" rel="noopener noreferrer" className="hover:underline text-navy">
            the official docs
          </a>
          , not a guessed value
        </label>
        <input
          type="text"
          value={sepoliaEndpoint}
          onChange={(e) => setSepoliaEndpoint(e.target.value)}
          disabled={adapterStatus === 'done' || adapterStatus === 'pending'}
          placeholder="Paste verified EndpointV2 address"
        />
        {adapterStatus !== 'done' && (
          <button
            onClick={deployAdapter}
            disabled={adapterStatus === 'pending' || !isAddress(algebaAddress || '') || !isAddress(sepoliaEndpoint || '')}
            className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50 mt-2"
          >
            {adapterStatus === 'pending' ? 'Confirming...' : 'Deploy AGBOFTAdapter'}
          </button>
        )}
        {adapterError && <p className="text-xs text-navy mt-1">{adapterError}</p>}
        {adapterTx && <TxLine hash={adapterTx} />}
        {adapterAddress && <AddressCard address={adapterAddress} />}
      </StepShell>

      <StepShell number={2} title="Deploy AGBOFT (Base Sepolia)" status={oftStatus}>
        <p className="text-muted">Mint/burn representation of bridged AGB. Your wallet will prompt you to switch to Base Sepolia.</p>
        <label className="text-xs text-muted uppercase font-medium tracking-wide block mb-1">Name</label>
        <input
          type="text"
          value={oftName}
          onChange={(e) => setOftName(e.target.value)}
          disabled={oftStatus === 'done' || oftStatus === 'pending'}
        />
        <label className="text-xs text-muted uppercase font-medium tracking-wide block mb-1 mt-2">Symbol</label>
        <input
          type="text"
          value={oftSymbol}
          onChange={(e) => setOftSymbol(e.target.value)}
          disabled={oftStatus === 'done' || oftStatus === 'pending'}
        />
        <label className="text-xs text-muted uppercase font-medium tracking-wide block mb-1 mt-2">
          Base Sepolia LayerZero Endpoint — copy the "EndpointV2" address from{' '}
          <a href="https://docs.layerzero.network/v2/deployments/chains/base-sepolia" target="_blank" rel="noopener noreferrer" className="hover:underline text-navy">
            the official docs
          </a>
          , not a guessed value
        </label>
        <input
          type="text"
          value={baseSepoliaEndpoint}
          onChange={(e) => setBaseSepoliaEndpoint(e.target.value)}
          disabled={oftStatus === 'done' || oftStatus === 'pending'}
          placeholder="Paste verified EndpointV2 address"
        />
        {oftStatus !== 'done' && oftStatus !== 'locked' && (
          <button
            onClick={deployOft}
            disabled={oftStatus === 'pending' || !isAddress(baseSepoliaEndpoint || '')}
            className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50 mt-2"
          >
            {oftStatus === 'pending' ? 'Confirming...' : 'Switch to Base Sepolia & Deploy AGBOFT'}
          </button>
        )}
        {oftError && <p className="text-xs text-navy mt-1">{oftError}</p>}
        {oftTx && <TxLine hash={oftTx} explorerBase={BASE_SEPOLIA_EXPLORER} />}
        {oftAddress && <AddressCard address={oftAddress} explorerBase={BASE_SEPOLIA_EXPLORER} />}
      </StepShell>

      <StepShell number={3} title="Wire Peer: Sepolia → Base Sepolia" status={peerSepoliaStatus}>
        <p className="text-muted">
          Calls <code className="bg-surface px-1 rounded-sm">AGBOFTAdapter.setPeer(baseSepoliaEid, oftAddress)</code> on Sepolia,
          authorizing messages from the Base Sepolia OFT.
        </p>
        {peerSepoliaStatus !== 'done' && peerSepoliaStatus !== 'locked' && (
          <button
            onClick={wirePeerOnSepolia}
            disabled={peerSepoliaStatus === 'pending'}
            className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50 mt-2"
          >
            {peerSepoliaStatus === 'pending' ? 'Confirming...' : 'Switch to Sepolia & Set Peer'}
          </button>
        )}
        {peerSepoliaError && <p className="text-xs text-navy mt-1">{peerSepoliaError}</p>}
        {peerSepoliaTx && <TxLine hash={peerSepoliaTx} />}
      </StepShell>

      <StepShell number={4} title="Wire Peer: Base Sepolia → Sepolia" status={peerBaseSepoliaStatus}>
        <p className="text-muted">
          Calls <code className="bg-surface px-1 rounded-sm">AGBOFT.setPeer(sepoliaEid, adapterAddress)</code> on Base Sepolia,
          authorizing messages from the Sepolia adapter. Both directions must be wired for bridging to work.
        </p>
        {peerBaseSepoliaStatus !== 'done' && peerBaseSepoliaStatus !== 'locked' && (
          <button
            onClick={wirePeerOnBaseSepolia}
            disabled={peerBaseSepoliaStatus === 'pending'}
            className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50 mt-2"
          >
            {peerBaseSepoliaStatus === 'pending' ? 'Confirming...' : 'Switch to Base Sepolia & Set Peer'}
          </button>
        )}
        {peerBaseSepoliaError && <p className="text-xs text-navy mt-1">{peerBaseSepoliaError}</p>}
        {peerBaseSepoliaTx && <TxLine hash={peerBaseSepoliaTx} explorerBase={BASE_SEPOLIA_EXPLORER} />}
      </StepShell>

      {allDone && (
        <div className="card">
          <div className="card-header flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold mb-0">Bridge Deployed &amp; Wired</h2>
            <CopyButton
              text={`VITE_OFT_ADAPTER_ADDRESS=${adapterAddress}\nVITE_OFT_BASE_SEPOLIA_ADDRESS=${oftAddress}`}
            />
          </div>
          <div className="card-body space-y-3">
            <p className="text-sm text-muted">Update your frontend <code className="bg-surface px-1 rounded-sm">.env</code> with these addresses:</p>
            <pre className="bg-surface border border-platinum-dark rounded-md p-4 overflow-x-auto text-xs">
              <code>{`VITE_OFT_ADAPTER_ADDRESS=${adapterAddress}\nVITE_OFT_BASE_SEPOLIA_ADDRESS=${oftAddress}`}</code>
            </pre>
            <p className="text-xs text-muted">Restart the dev server after editing <code className="bg-surface px-1 rounded-sm">.env</code> so the Bridge page picks up the new addresses.</p>
          </div>
        </div>
      )}
    </div>
  );
}
