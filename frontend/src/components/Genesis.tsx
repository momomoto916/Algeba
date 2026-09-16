import { useEffect, useState } from 'react';
import type { GenesisStatus, UserData } from '../types/index';
import { getGenesisStatus, getUserData } from '../utils/web3';
import { formatBigInt, formatTime } from '../utils/formatting';
import { useWallet } from '../context/WalletContext';
import { useNetwork } from '../context/NetworkContext';
import { ensureChain } from '../utils/chainSwitch';
import { createNetworkPublicClient } from '../utils/publicClient';
import { createWalletClient, custom } from 'viem';
import { GENESIS_ABI } from '../config/contracts';

interface GenesisProps {
  walletAddress?: string | null;
  isWalletConnected?: boolean;
}

export function Genesis(_props?: GenesisProps) {
  const { walletAddress: address, isConnected } = useWallet();
  const { network } = useNetwork();

  const [status, setStatus] = useState<GenesisStatus | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [finalizingLoading, setFinalizingLoading] = useState(false);
  const [whitelistProofs, setWhitelistProofs] = useState<Record<string, `0x${string}`[]> | null>(null);

  const publicClient = createNetworkPublicClient(network);

  useEffect(() => {
    let isMounted = true;
    fetch('/genesis-whitelist.json')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) setWhitelistProofs(data.proofs ?? {});
      })
      .catch((error) => {
        console.error('Error loading Genesis whitelist:', error);
        if (isMounted) setWhitelistProofs({});
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Merkle proofs are keyed by checksummed address in whitelist-tree.json;
  // normalize the lookup so casing never causes a false "not whitelisted".
  const myProof = address && whitelistProofs
    ? Object.entries(whitelistProofs).find(([addr]) => addr.toLowerCase() === address.toLowerCase())?.[1] ?? null
    : null;
  const isWhitelisted = myProof !== null;

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [statusData, userDataResult] = await Promise.all([
          getGenesisStatus(publicClient, network.contracts),
          isConnected && address ? getUserData(publicClient, address as any, network.contracts) : Promise.resolve(null),
        ]);

        if (isMounted) {
          setStatus((prev) => {
            // Only update if values actually changed to avoid re-renders
            if (prev && statusData &&
                prev.open === statusData.open &&
                prev.done === statusData.done &&
                prev.remaining === statusData.remaining &&
                prev.participants === statusData.participants) {
              return prev;
            }
            return statusData;
          });

          setUserData((prev) => {
            // Only update if values actually changed
            if (prev && userDataResult &&
                prev.genesisAllocation === userDataResult.genesisAllocation &&
                prev.genesisClaimed === userDataResult.genesisClaimed &&
                prev.genesisClaimable === userDataResult.genesisClaimable) {
              return prev;
            }
            return userDataResult;
          });

          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching Genesis data:', error);
      }
    };

    // Initial load
    setLoading(true);
    fetchData();

    // Polling without setLoading to prevent flickering
    const interval = setInterval(fetchData, 30000); // Increased to 30s to reduce updates
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isConnected, address, network]);

  const getWalletClient = async () => {
    if (!window.ethereum) throw new Error('MetaMask not installed');
    await ensureChain(network.chain);
    return createWalletClient({ chain: network.chain, transport: custom(window.ethereum) });
  };

  const handleParticipate = async () => {
    if (!isConnected || !address || !myProof) return;
    setActionLoading(true);
    try {
      const walletClient = await getWalletClient();
      const hash = await walletClient.writeContract({
        account: address as any,
        address: network.contracts.GENESIS as any,
        abi: GENESIS_ABI,
        functionName: 'participate',
        args: [myProof],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const updatedStatus = await getGenesisStatus(publicClient, network.contracts);
      const updatedUserData = await getUserData(publicClient, address as any, network.contracts);
      setStatus(updatedStatus);
      setUserData(updatedUserData);
    } catch (error) {
      console.error('Error participating:', error);
      if (error instanceof Error) {
        alert(`Participate failed: ${error.message}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!isConnected || !address) return;
    setActionLoading(true);
    try {
      const walletClient = await getWalletClient();
      const hash = await walletClient.writeContract({
        account: address as any,
        address: network.contracts.GENESIS as any,
        abi: GENESIS_ABI,
        functionName: 'claim',
        args: [],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const updatedUserData = await getUserData(publicClient, address as any, network.contracts);
      setUserData(updatedUserData);
    } catch (error) {
      console.error('Error claiming:', error);
      if (error instanceof Error) {
        alert(`Claim failed: ${error.message}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!isConnected || !address) return;
    setFinalizingLoading(true);
    try {
      const walletClient = await getWalletClient();
      const hash = await walletClient.writeContract({
        account: address as any,
        address: network.contracts.GENESIS as any,
        abi: GENESIS_ABI,
        functionName: 'finalize',
        args: [],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const updatedStatus = await getGenesisStatus(publicClient, network.contracts);
      setStatus(updatedStatus);
    } catch (error) {
      console.error('Error finalizing:', error);
      if (error instanceof Error) {
        alert(`Finalize failed: ${error.message}`);
      }
    } finally {
      setFinalizingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-24 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="text-navy">
            {network.contracts.GENESIS
              ? 'Failed to load Genesis data'
              : `No Genesis contract configured for ${network.label}. Switch networks above or deploy from the Deploy page.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-xl font-bold mb-0">Genesis Event</h2>
      </div>
      <div className="card-body space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="p-4 rounded-md border border-platinum bg-platinum">
            <p className="text-xs text-muted font-medium uppercase">Status</p>
            <p className="text-lg font-bold mt-3">
              {status.done ? 'Finalized' : status.open ? 'Open' : 'Closed'}
            </p>
          </div>
          <div className="p-4 rounded-md border border-platinum bg-platinum">
            <p className="text-xs text-muted font-medium uppercase">Time Remaining</p>
            <p className="text-lg font-bold mt-3">
              {status.open ? formatTime(status.remaining) : 'N/A'}
            </p>
          </div>
          <div className="p-4 rounded-md border border-platinum bg-platinum">
            <p className="text-xs text-muted font-medium uppercase">Participants</p>
            <p className="text-lg font-bold mt-3">{status.participants.toString()}</p>
          </div>
          <div className="p-4 rounded-md border border-platinum bg-platinum">
            <p className="text-xs text-muted font-medium uppercase">Your Allocation</p>
            <p className="text-lg font-bold mt-3">
              {userData && userData.genesisAllocation !== 0n
                ? `${formatBigInt(userData.genesisAllocation)} AGB`
                : 'N/A'}
            </p>
          </div>
        </div>

        {/* Open Mode */}
        {status.open && (
          <div className="space-y-4">
            <div className="p-4 rounded-md border border-platinum bg-platinum">
              <p className="text-sm font-semibold text-navy">Open — Participate in Genesis</p>
              <p className="text-xs text-muted mt-1">Connect your wallet to participate and earn genesis allocation</p>
            </div>

            {!isConnected && (
              <div className="p-4 rounded-md border border-platinum-dark bg-white">
                <p className="text-sm text-muted">Connect your wallet to participate in Genesis</p>
              </div>
            )}

            {isConnected && userData && whitelistProofs && (
              <div className="space-y-3">
                {!userData.genesisEligible && isWhitelisted && (
                  <button
                    onClick={handleParticipate}
                    disabled={actionLoading}
                    className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50"
                  >
                    {actionLoading ? 'Participating...' : 'Participate'}
                  </button>
                )}

                {!userData.genesisEligible && !isWhitelisted && (
                  <div className="p-4 rounded-md border border-platinum-dark bg-white">
                    <p className="text-sm font-semibold text-navy">This wallet is not on the Genesis whitelist</p>
                    <p className="text-xs text-muted mt-1">The whitelist is fixed and cannot be changed after deployment.</p>
                  </div>
                )}

                {userData.genesisEligible && (
                  <div className="p-4 rounded-md border border-platinum bg-platinum">
                    <p className="text-sm font-semibold text-navy">You are registered for Genesis</p>
                    <p className="text-xs text-muted mt-1">Wait for the event to close and then finalize</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Closed Mode */}
        {!status.open && !status.done && (
          <div className="space-y-4">
            <div className="p-4 rounded-md bg-navy">
              <p className="text-sm font-semibold text-white">Closed — Waiting to Finalize</p>
              <p className="text-xs mt-1 text-white/75">The Genesis event has closed. An admin will finalize it soon.</p>
            </div>

            {isConnected && (
              <button
                onClick={handleFinalize}
                disabled={finalizingLoading}
                className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50"
              >
                {finalizingLoading ? 'Finalizing...' : 'Finalize Genesis'}
              </button>
            )}
          </div>
        )}

        {/* Finalized Mode */}
        {status.done && (
          <div className="space-y-4">
            <div className="p-4 rounded-md border border-platinum bg-platinum">
              <p className="text-sm font-semibold text-navy">Finalized — Claim Your Allocation</p>
              <p className="text-xs text-muted mt-1">The Genesis event is complete. You can now claim your allocation.</p>
            </div>

            {!isConnected && (
              <div className="p-4 rounded-md border border-platinum-dark bg-white">
                <p className="text-sm text-muted">Connect your wallet to claim your allocation</p>
              </div>
            )}

            {isConnected && userData && (
              <div className="space-y-3">
                {userData.genesisClaimed ? (
                  <div className="p-4 rounded-md border border-platinum bg-platinum">
                    <p className="text-sm font-semibold text-navy">Claimed — You have claimed your Genesis allocation</p>
                    <p className="text-xs text-muted mt-1">Amount: {formatBigInt(userData.genesisAllocation)} AGB</p>
                  </div>
                ) : userData.genesisClaimable !== 0n ? (
                  <button
                    onClick={handleClaim}
                    disabled={actionLoading}
                    className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50"
                  >
                    {actionLoading ? 'Claiming...' : `Claim ${formatBigInt(userData.genesisClaimable)} AGB`}
                  </button>
                ) : (
                  <div className="p-4 rounded-md border border-platinum-dark bg-white">
                    <p className="text-sm text-muted">No claimable amount available</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
