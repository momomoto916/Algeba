import { useState, useEffect } from 'react';
import { createWalletClient, custom, parseEther, isAddress, isHex } from 'viem';
import ALGEBAArtifact from '../../contracts-artifacts/ALGEBA.json';
import GenesisArtifact from '../../contracts-artifacts/Genesis.json';
import StakingArtifact from '../../contracts-artifacts/Staking.json';
import { StepShell, CopyButton, AddressCard, TxLine, type StepStatus } from './shared';
import { WhitelistBuilder } from './WhitelistBuilder';
import { useNetwork } from '../../context/NetworkContext';
import { ensureChain } from '../../utils/chainSwitch';
import { createNetworkPublicClient } from '../../utils/publicClient';

// Must match GENESIS_ALLOCATION in ALGEBA.sol / Genesis.sol (currently 50 ether, testnet value)
const GENESIS_ALLOCATION_AGB = '50';

// Staking's halving period is in seconds (block.timestamp based). A year here is
// 365.25 days, so 4 years = 126,230,400 seconds exactly.
const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;

function yearsToSeconds(years: string): number {
  return Math.round(parseFloat(years) * SECONDS_PER_YEAR);
}

function formatHalvingPreview(years: string): string | null {
  const seconds = yearsToSeconds(years);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const days = seconds / 86400;
  const human = days < 1
    ? `${(seconds / 3600).toFixed(2)} hours`
    : days < 365.25
      ? `${days.toFixed(1)} days`
      : `${(days / 365.25).toFixed(2)} years`;
  return `${seconds.toLocaleString()} seconds (≈ ${human}) per halving epoch`;
}

// Genesis.sol takes its duration in seconds (block.timestamp based). The input
// is in minutes: 1440 = 24 hours; decimals allowed for short test windows.
function minutesToSeconds(minutes: string): number {
  return Math.round(parseFloat(minutes) * 60);
}

function formatDurationPreview(minutes: string): string | null {
  const seconds = minutesToSeconds(minutes);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `≈ ${seconds} seconds`;
  if (seconds < 3600) return `≈ ${(seconds / 60).toFixed(1)} minutes`;
  const totalHours = seconds / 3600;
  if (totalHours < 48) return `≈ ${totalHours.toFixed(2)} hours`;
  const days = totalHours / 24;
  if (days < 90) return `≈ ${days.toFixed(1)} days`;
  const years = days / 365.25;
  if (years < 1) return `≈ ${days.toFixed(0)} days (~${(days / 30.44).toFixed(1)} months)`;
  return `≈ ${years.toFixed(2)} years`;
}

export function DeployContracts({ walletAddress }: { walletAddress: string }) {
  const { network } = useNetwork();
  const publicClient = createNetworkPublicClient(network);

  const [initialHolder, setInitialHolder] = useState(walletAddress || '');
  const [genesisDurationMinutes, setGenesisDurationMinutes] = useState('1440');
  const [halvingYears, setHalvingYears] = useState('4');
  const [merkleRoot, setMerkleRoot] = useState('');

  const isValidMerkleRoot = (root: string) => isHex(root) && root.length === 66;

  const [algebaAddress, setAlgebaAddress] = useState<string | null>(null);
  const [algebaTx, setAlgebaTx] = useState<string | null>(null);
  const [algebaStatus, setAlgebaStatus] = useState<StepStatus>('active');
  const [algebaError, setAlgebaError] = useState<string | null>(null);

  const [genesisAddress, setGenesisAddress] = useState<string | null>(null);
  const [genesisTx, setGenesisTx] = useState<string | null>(null);
  const [genesisStatus, setGenesisStatus] = useState<StepStatus>('locked');
  const [genesisError, setGenesisError] = useState<string | null>(null);

  const [fundTx, setFundTx] = useState<string | null>(null);
  const [fundStatus, setFundStatus] = useState<StepStatus>('locked');
  const [fundError, setFundError] = useState<string | null>(null);

  const [stakingAddress, setStakingAddress] = useState<string | null>(null);
  const [stakingTx, setStakingTx] = useState<string | null>(null);
  const [stakingStatus, setStakingStatus] = useState<StepStatus>('locked');
  const [stakingError, setStakingError] = useState<string | null>(null);

  const [authTx, setAuthTx] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<StepStatus>('locked');
  const [authError, setAuthError] = useState<string | null>(null);

  const [renounceTx, setRenounceTx] = useState<string | null>(null);
  const [renounceStatus, setRenounceStatus] = useState<StepStatus>('active');
  const [renounceError, setRenounceError] = useState<string | null>(null);
  const [renounceConfirmed, setRenounceConfirmed] = useState(false);
  const [renounceAddressInput, setRenounceAddressInput] = useState('');
  const [renounceOwner, setRenounceOwner] = useState<string | null>(null);
  const [renounceOwnerError, setRenounceOwnerError] = useState<string | null>(null);
  const [checkingOwner, setCheckingOwner] = useState(false);

  // Defaults to whatever Step 1 deployed this session; falls back to manual
  // entry so this step works standalone for a contract deployed earlier.
  const renounceTargetAddress = renounceAddressInput || algebaAddress || '';

  useEffect(() => {
    if (!isAddress(renounceTargetAddress)) {
      setRenounceOwner(null);
      setRenounceOwnerError(null);
      return;
    }
    let cancelled = false;
    setCheckingOwner(true);
    setRenounceOwnerError(null);
    publicClient
      .readContract({
        address: renounceTargetAddress as `0x${string}`,
        abi: ALGEBAArtifact.abi,
        functionName: 'owner',
      })
      .then((result) => {
        if (!cancelled) setRenounceOwner(result as string);
      })
      .catch(() => {
        if (!cancelled) {
          setRenounceOwner(null);
          setRenounceOwnerError('Could not read owner() — is this an ALGEBA contract on the selected network?');
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingOwner(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renounceTargetAddress, network.key]);

  const getWalletClient = async () => {
    if (!window.ethereum) throw new Error('MetaMask not installed');
    await ensureChain(network.chain);
    return createWalletClient({ chain: network.chain, transport: custom(window.ethereum) });
  };

  const deployAlgeba = async () => {
    if (!walletAddress || !isAddress(initialHolder)) return;
    setAlgebaStatus('pending');
    setAlgebaError(null);
    try {
      const walletClient = await getWalletClient();
      const hash = await walletClient.deployContract({
        account: walletAddress as `0x${string}`,
        abi: ALGEBAArtifact.abi,
        bytecode: ALGEBAArtifact.bytecode as `0x${string}`,
        args: [initialHolder],
      });
      setAlgebaTx(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) throw new Error('No contract address in receipt');
      setAlgebaAddress(receipt.contractAddress);
      setAlgebaStatus('done');
      setGenesisStatus('active');
    } catch (err) {
      console.error('ALGEBA deploy failed:', err);
      setAlgebaError(err instanceof Error ? err.message : 'Deployment failed');
      setAlgebaStatus('error');
    }
  };

  const deployGenesis = async () => {
    if (!walletAddress || !algebaAddress || !isValidMerkleRoot(merkleRoot)) return;
    const durationSeconds = minutesToSeconds(genesisDurationMinutes);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
    setGenesisStatus('pending');
    setGenesisError(null);
    try {
      const walletClient = await getWalletClient();
      const hash = await walletClient.deployContract({
        account: walletAddress as `0x${string}`,
        abi: GenesisArtifact.abi,
        bytecode: GenesisArtifact.bytecode as `0x${string}`,
        args: [algebaAddress, BigInt(durationSeconds), merkleRoot as `0x${string}`],
      });
      setGenesisTx(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) throw new Error('No contract address in receipt');
      setGenesisAddress(receipt.contractAddress);
      setGenesisStatus('done');
      setFundStatus('active');
    } catch (err) {
      console.error('Genesis deploy failed:', err);
      setGenesisError(err instanceof Error ? err.message : 'Deployment failed');
      setGenesisStatus('error');
    }
  };

  const fundGenesis = async () => {
    if (!walletAddress || !algebaAddress || !genesisAddress) return;
    setFundStatus('pending');
    setFundError(null);
    try {
      const walletClient = await getWalletClient();
      const hash = await walletClient.writeContract({
        account: walletAddress as `0x${string}`,
        address: algebaAddress as `0x${string}`,
        abi: ALGEBAArtifact.abi,
        functionName: 'transfer',
        args: [genesisAddress, parseEther(GENESIS_ALLOCATION_AGB)],
      });
      setFundTx(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setFundStatus('done');
      setStakingStatus('active');
    } catch (err) {
      console.error('Funding Genesis failed:', err);
      setFundError(err instanceof Error ? err.message : 'Transfer failed');
      setFundStatus('error');
    }
  };

  const deployStaking = async () => {
    const halvingSeconds = yearsToSeconds(halvingYears);
    if (!walletAddress || !algebaAddress || !genesisAddress || !Number.isFinite(halvingSeconds) || halvingSeconds <= 0) return;
    setStakingStatus('pending');
    setStakingError(null);
    try {
      const walletClient = await getWalletClient();
      const hash = await walletClient.deployContract({
        account: walletAddress as `0x${string}`,
        abi: StakingArtifact.abi,
        bytecode: StakingArtifact.bytecode as `0x${string}`,
        args: [algebaAddress, genesisAddress, BigInt(halvingSeconds)],
      });
      setStakingTx(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) throw new Error('No contract address in receipt');
      setStakingAddress(receipt.contractAddress);
      setStakingStatus('done');
      setAuthStatus('active');
    } catch (err) {
      console.error('Staking deploy failed:', err);
      setStakingError(err instanceof Error ? err.message : 'Deployment failed');
      setStakingStatus('error');
    }
  };

  const authorizeStaking = async () => {
    if (!walletAddress || !algebaAddress || !stakingAddress) return;
    setAuthStatus('pending');
    setAuthError(null);
    try {
      const walletClient = await getWalletClient();
      const hash = await walletClient.writeContract({
        account: walletAddress as `0x${string}`,
        address: algebaAddress as `0x${string}`,
        abi: ALGEBAArtifact.abi,
        functionName: 'setStaking',
        args: [stakingAddress],
      });
      setAuthTx(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setAuthStatus('done');
      setRenounceStatus('active');
    } catch (err) {
      console.error('Authorizing staking failed:', err);
      setAuthError(err instanceof Error ? err.message : 'Transaction failed');
      setAuthStatus('error');
    }
  };

  // setStaking() is a one-time setter (reverts once staking != address(0)), so
  // once Step 5 has run, owner has no remaining capability on ALGEBA at all —
  // renouncing here gives up nothing functional, only proves it publicly.
  const renounceAlgeba = async () => {
    if (!walletAddress || !isAddress(renounceTargetAddress) || !renounceConfirmed) return;
    setRenounceStatus('pending');
    setRenounceError(null);
    try {
      const walletClient = await getWalletClient();
      const hash = await walletClient.writeContract({
        account: walletAddress as `0x${string}`,
        address: renounceTargetAddress as `0x${string}`,
        abi: ALGEBAArtifact.abi,
        functionName: 'renounceOwnership',
        args: [],
      });
      setRenounceTx(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setRenounceStatus('done');
    } catch (err) {
      console.error('Renouncing ALGEBA ownership failed:', err);
      setRenounceError(err instanceof Error ? err.message : 'Transaction failed');
      setRenounceStatus('error');
    }
  };

  const allDone = authStatus === 'done';

  return (
    <div className="space-y-6">
      <div className="alert alert-primary mb-0">
        Deploying as <strong>{walletAddress}</strong> on <strong>{network.label}</strong>. Each step sends a real transaction and unlocks the next once confirmed.
        {network.key === 'mainnet' && ' This is Ethereum Mainnet — transactions cost real ETH and are irreversible.'}
      </div>

      <StepShell number={1} title="Deploy ALGEBA.sol" status={algebaStatus}>
        <label className="text-xs text-muted uppercase font-medium tracking-wide block mb-1">
          Initial Holder (receives {GENESIS_ALLOCATION_AGB} AGB Genesis allocation)
        </label>
        <input
          type="text"
          value={initialHolder}
          onChange={(e) => setInitialHolder(e.target.value)}
          disabled={algebaStatus === 'done' || algebaStatus === 'pending'}
          placeholder="0x..."
        />
        {algebaStatus !== 'done' && (
          <button
            onClick={deployAlgeba}
            disabled={algebaStatus === 'pending' || !isAddress(initialHolder || '')}
            className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50 mt-2"
          >
            {algebaStatus === 'pending' ? 'Confirming...' : 'Deploy ALGEBA'}
          </button>
        )}
        {algebaError && <p className="text-xs text-navy mt-1">{algebaError}</p>}
        {algebaTx && <TxLine hash={algebaTx} explorerBase={network.explorerUrl} />}
        {algebaAddress && <AddressCard address={algebaAddress} explorerBase={network.explorerUrl} />}
      </StepShell>

      <StepShell number={2} title="Deploy Genesis.sol" status={genesisStatus}>
        <p className="text-muted">Constructor arguments: the ALGEBA token address from Step 1, how long Genesis stays open, and the whitelist Merkle root.</p>
        {algebaAddress && (
          <p className="text-xs text-muted">Token: <span className="text-navy font-semibold">{algebaAddress}</span></p>
        )}
        <label className="text-xs text-muted uppercase font-medium tracking-wide block mb-1">
          Genesis Duration (minutes) — 1440 = 24 hours
        </label>
        <input
          type="number"
          step="any"
          min="0"
          value={genesisDurationMinutes}
          onChange={(e) => setGenesisDurationMinutes(e.target.value)}
          disabled={genesisStatus === 'done' || genesisStatus === 'pending'}
          placeholder="e.g. 1440"
        />
        {formatDurationPreview(genesisDurationMinutes) && (
          <p className="text-xs text-muted">{formatDurationPreview(genesisDurationMinutes)}</p>
        )}

        <label className="text-xs text-muted uppercase font-medium tracking-wide block mb-1 mt-2">
          Whitelist Merkle Root
        </label>
        <p className="text-xs text-muted mb-2">Immutable once deployed — the full whitelist must be finalized first.</p>

        {genesisStatus !== 'done' && genesisStatus !== 'pending' && (
          <div className="mb-3">
            <WhitelistBuilder onRootGenerated={setMerkleRoot} />
          </div>
        )}

        <label className="text-xs text-muted uppercase font-medium tracking-wide block mb-1">
          Root (auto-filled by the builder above, or paste one you already generated)
        </label>
        <input
          type="text"
          value={merkleRoot}
          onChange={(e) => setMerkleRoot(e.target.value)}
          disabled={genesisStatus === 'done' || genesisStatus === 'pending'}
          placeholder="0x..."
        />
        {merkleRoot && !isValidMerkleRoot(merkleRoot) && (
          <p className="text-xs text-navy mt-1">Must be a 32-byte hex value (0x + 64 hex characters).</p>
        )}

        {genesisStatus !== 'done' && genesisStatus !== 'locked' && (
          <button
            onClick={deployGenesis}
            disabled={genesisStatus === 'pending' || minutesToSeconds(genesisDurationMinutes) <= 0 || !isValidMerkleRoot(merkleRoot)}
            className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50 mt-2"
          >
            {genesisStatus === 'pending' ? 'Confirming...' : 'Deploy Genesis'}
          </button>
        )}
        {genesisError && <p className="text-xs text-navy mt-1">{genesisError}</p>}
        {genesisTx && <TxLine hash={genesisTx} explorerBase={network.explorerUrl} />}
        {genesisAddress && <AddressCard address={genesisAddress} explorerBase={network.explorerUrl} />}
      </StepShell>

      <StepShell number={3} title={`Fund Genesis (${GENESIS_ALLOCATION_AGB} AGB)`} status={fundStatus}>
        <p className="text-muted">
          Genesis does not mint tokens itself — it pays out from its own balance. Transfer the {GENESIS_ALLOCATION_AGB} AGB
          minted to the initial holder in Step 1 into the Genesis contract.
        </p>
        {fundStatus !== 'done' && fundStatus !== 'locked' && (
          <button
            onClick={fundGenesis}
            disabled={fundStatus === 'pending'}
            className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50 mt-2"
          >
            {fundStatus === 'pending' ? 'Confirming...' : `Transfer ${GENESIS_ALLOCATION_AGB} AGB to Genesis`}
          </button>
        )}
        {fundError && <p className="text-xs text-navy mt-1">{fundError}</p>}
        {fundTx && <TxLine hash={fundTx} explorerBase={network.explorerUrl} />}
      </StepShell>

      <StepShell number={4} title="Deploy Staking.sol" status={stakingStatus}>
        <p className="text-muted">Constructor arguments: ALGEBA address, Genesis address, and the halving period.</p>
        <label className="text-xs text-muted uppercase font-medium tracking-wide block mb-1">
          Halving Period (years)
        </label>
        <input
          type="number"
          step="any"
          min="0"
          value={halvingYears}
          onChange={(e) => setHalvingYears(e.target.value)}
          disabled={stakingStatus === 'done' || stakingStatus === 'pending'}
          placeholder="e.g. 4"
        />
        {formatHalvingPreview(halvingYears) ? (
          <p className="text-xs text-muted">
            {formatHalvingPreview(halvingYears)}. Timestamp-based: each halving lands exactly this long after the
            first stake, regardless of Ethereum block time. Immutable after deployment.
          </p>
        ) : (
          halvingYears && <p className="text-xs text-navy mt-1">Enter a period greater than 0.</p>
        )}
        {stakingStatus !== 'done' && stakingStatus !== 'locked' && (
          <button
            onClick={deployStaking}
            disabled={stakingStatus === 'pending' || !(yearsToSeconds(halvingYears) > 0)}
            className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50 mt-2"
          >
            {stakingStatus === 'pending' ? 'Confirming...' : 'Deploy Staking'}
          </button>
        )}
        {stakingError && <p className="text-xs text-navy mt-1">{stakingError}</p>}
        {stakingTx && <TxLine hash={stakingTx} explorerBase={network.explorerUrl} />}
        {stakingAddress && <AddressCard address={stakingAddress} explorerBase={network.explorerUrl} />}
      </StepShell>

      <StepShell number={5} title="Authorize Staking as Minter" status={authStatus}>
        <p className="text-muted">Calls <code className="bg-surface px-1 rounded-sm">ALGEBA.setStaking(stakingAddress)</code> so Staking can mint reward emissions.</p>
        {authStatus !== 'done' && authStatus !== 'locked' && (
          <button
            onClick={authorizeStaking}
            disabled={authStatus === 'pending'}
            className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50 mt-2"
          >
            {authStatus === 'pending' ? 'Confirming...' : 'Set Staking on ALGEBA'}
          </button>
        )}
        {authError && <p className="text-xs text-navy mt-1">{authError}</p>}
        {authTx && <TxLine hash={authTx} explorerBase={network.explorerUrl} />}
      </StepShell>

      <StepShell number={6} title="Renounce ALGEBA Ownership (Optional)" status={renounceStatus}>
        <p className="text-muted">
          <code className="bg-surface px-1 rounded-sm">setStaking()</code> can only ever be called once, so after it has
          run the owner key has no remaining capability on ALGEBA — no mint switch, no pause, nothing. Renouncing here
          gives up no real power; it just proves that publicly on-chain. Works standalone: defaults to the address from
          Step 1 above if you deployed it this session, or enter any ALGEBA address you own below.
        </p>
        {renounceStatus !== 'done' && (
          <>
            <label className="text-xs text-muted uppercase font-medium tracking-wide block mb-1 mt-2">
              ALGEBA Address
            </label>
            <input
              type="text"
              value={renounceAddressInput}
              onChange={(e) => setRenounceAddressInput(e.target.value)}
              disabled={renounceStatus === 'pending'}
              placeholder={algebaAddress || '0x...'}
            />

            {renounceTargetAddress && !isAddress(renounceTargetAddress) && (
              <p className="text-xs text-navy mt-1">Not a valid address.</p>
            )}
            {isAddress(renounceTargetAddress) && checkingOwner && (
              <p className="text-xs text-muted mt-1">Checking current owner…</p>
            )}
            {isAddress(renounceTargetAddress) && renounceOwnerError && (
              <p className="text-xs text-navy mt-1">{renounceOwnerError}</p>
            )}
            {isAddress(renounceTargetAddress) && renounceOwner && (
              renounceOwner === '0x0000000000000000000000000000000000000000' ? (
                <p className="text-xs text-muted mt-1">Already renounced — owner is the zero address.</p>
              ) : (
                <>
                  <p className="text-xs text-muted mt-1">
                    Current owner: <span className="text-navy font-semibold">{renounceOwner}</span>
                  </p>
                  {walletAddress && renounceOwner.toLowerCase() !== walletAddress.toLowerCase() && (
                    <p className="text-xs text-navy mt-1">
                      Your connected wallet ({walletAddress}) does not match this owner — the transaction will revert.
                    </p>
                  )}
                </>
              )
            )}

            {renounceOwner && renounceOwner !== '0x0000000000000000000000000000000000000000' && (
              <>
                <div className="alert alert-primary mt-2">
                  This is permanent and cannot be undone. Only do this once you're certain ALGEBA is configured correctly.
                </div>
                <label className="flex items-center gap-2 text-xs text-muted mt-2">
                  <input
                    type="checkbox"
                    checked={renounceConfirmed}
                    onChange={(e) => setRenounceConfirmed(e.target.checked)}
                    disabled={renounceStatus === 'pending'}
                  />
                  I understand this is irreversible and want to renounce ownership of ALGEBA.
                </label>
                <button
                  onClick={renounceAlgeba}
                  disabled={renounceStatus === 'pending' || !renounceConfirmed}
                  className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50 mt-2"
                >
                  {renounceStatus === 'pending' ? 'Confirming...' : 'Renounce ALGEBA Ownership'}
                </button>
              </>
            )}
          </>
        )}
        {renounceError && <p className="text-xs text-navy mt-1">{renounceError}</p>}
        {renounceTx && <TxLine hash={renounceTx} explorerBase={network.explorerUrl} />}
        {renounceStatus === 'done' && (
          <p className="text-xs text-muted mt-1">Ownership renounced — ALGEBA now has no owner.</p>
        )}
      </StepShell>

      {allDone && (() => {
        const suffix = network.key === 'mainnet' ? 'MAINNET' : 'SEPOLIA';
        const envSnippet = `VITE_ALGEBA_ADDRESS_${suffix}=${algebaAddress}\nVITE_GENESIS_ADDRESS_${suffix}=${genesisAddress}\nVITE_STAKING_ADDRESS_${suffix}=${stakingAddress}`;
        return (
          <div className="card">
            <div className="card-header flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold mb-0">Deployment Complete</h2>
              <CopyButton text={envSnippet} />
            </div>
            <div className="card-body space-y-3">
              <p className="text-sm text-muted">Update your frontend <code className="bg-surface px-1 rounded-sm">.env</code> with these addresses:</p>
              <pre className="bg-surface border border-platinum-dark rounded-md p-4 overflow-x-auto text-xs">
                <code>{envSnippet}</code>
              </pre>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
