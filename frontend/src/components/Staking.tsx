import { useEffect, useState } from 'react';
import { getUserData } from '../utils/web3';
import { formatBigInt } from '../utils/formatting';
import { useWallet } from '../context/WalletContext';
import { useNetwork } from '../context/NetworkContext';
import { ensureChain } from '../utils/chainSwitch';
import { createNetworkPublicClient } from '../utils/publicClient';
import { createWalletClient, custom, maxUint256, parseEther, formatEther } from 'viem';
import { STAKING_ABI, ALGEBA_ABI } from '../config/contracts';
import algebaIcon from '../assets/icon-algeba.png';

// Mirrors Staking.MIN_STAKE: a position must be 0 or at least 1 AGB.
const MIN_STAKE = 10n ** 18n;

// Exact decimal-string -> wei. Float math (parseFloat * 1e18) loses precision on
// larger amounts, which could leave a few wei staked on "unstake ALL" — and the
// contract rejects any leftover below MIN_STAKE.
function toWei(value: string): bigint | null {
  if (!value || !value.trim()) return null;
  try {
    const wei = parseEther(value.trim() as `${number}`);
    return wei > 0n ? wei : null;
  } catch {
    return null;
  }
}

interface StakingProps {
  walletAddress?: string | null;
  isWalletConnected?: boolean;
}

export function Staking(_props?: StakingProps) {
  const { walletAddress: address, isConnected } = useWallet();
  const { network } = useNetwork();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingReward, setPendingReward] = useState(0n);
  const [stakedAmount, setStakedAmount] = useState(0n);
  const [agbBalance, setAgbBalance] = useState(0n);
  const [stakeAmount, setStakeAmount] = useState('1');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [stakeStep, setStakeStep] = useState<'approve' | 'stake' | null>(null);
  const [emergencyConfirmed, setEmergencyConfirmed] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  const publicClient = createNetworkPublicClient(network);

  const getWalletClient = async () => {
    if (!window.ethereum) throw new Error('MetaMask not installed');
    await ensureChain(network.chain);
    return createWalletClient({ chain: network.chain, transport: custom(window.ethereum) });
  };

  useEffect(() => {
    const contractsConfigured = Boolean(network.contracts.ALGEBA && network.contracts.STAKING);

    const fetchData = async () => {
      if (isConnected && address && contractsConfigured) {
        try {
          const userDataResult = await getUserData(publicClient, address as any, network.contracts);
          if (userDataResult) {
            setPendingReward(userDataResult.pendingReward || 0n);
            setStakedAmount(userDataResult.stakingInfo?.amount || 0n);
          }

          // Fetch AGB token balance
          const balance = await publicClient.readContract({
            address: network.contracts.ALGEBA as any,
            abi: ALGEBA_ABI,
            functionName: 'balanceOf',
            args: [address as any],
          }) as unknown as bigint;
          setAgbBalance(balance || 0n);
        } catch (error) {
          console.error('Error fetching staking data:', error);
        }
      }
      setLoading(false);
    };

    // Initial fetch
    setLoading(true);
    fetchData();

    // Poll for updates
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [isConnected, address, network]);

  const setStakePercentage = (percentage: number) => {
    const amount = (agbBalance * BigInt(percentage)) / 100n;
    setStakeAmount(formatEther(amount));
  };

  const setUnstakePercentage = (percentage: number) => {
    const amount = (stakedAmount * BigInt(percentage)) / 100n;
    setUnstakeAmount(formatEther(amount));
  };

  const stakeWei = toWei(stakeAmount);
  const stakeError = !stakeAmount
    ? null
    : stakeWei === null
      ? 'Enter a valid amount.'
      : stakeWei > agbBalance
        ? 'Amount exceeds your AGB balance.'
        : stakedAmount + stakeWei < MIN_STAKE
          ? 'Minimum stake is 1 AGB.'
          : null;

  const unstakeWei = toWei(unstakeAmount);
  const unstakeRemaining = unstakeWei !== null && unstakeWei <= stakedAmount ? stakedAmount - unstakeWei : null;
  const unstakeError = !unstakeAmount
    ? null
    : unstakeWei === null
      ? 'Enter a valid amount.'
      : unstakeWei > stakedAmount
        ? 'Amount exceeds your staked position.'
        : unstakeRemaining !== null && unstakeRemaining > 0n && unstakeRemaining < MIN_STAKE
          ? `This would leave ${formatEther(unstakeRemaining)} AGB staked, below the 1 AGB minimum. Unstake everything, or leave at least 1 AGB.`
          : null;

  const handleAddToWallet = async () => {
    if (!window.ethereum) {
      alert('No wallet extension detected');
      return;
    }
    try {
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: network.contracts.ALGEBA,
            symbol: 'AGB',
            decimals: 18,
            image: new URL(algebaIcon, window.location.origin).toString(),
          },
        },
      });
    } catch (error) {
      console.error('Error adding token to wallet:', error);
    }
  };

  const handleStake = async () => {
    if (!isConnected || !address || stakeWei === null || stakeError) return;
    setActionLoading(true);
    try {
      // Check if MetaMask or wallet is available
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      const stakeBigInt = stakeWei;

      // Create wallet client for transaction signing
      const walletClient = await getWalletClient();

      // The Staking contract pulls AGB via transferFrom, which needs prior
      // approval. Without this check, stake() reverts during gas estimation
      // and wallets/RPCs surface a confusing "gas limit too high" error
      // instead of the real "insufficient allowance" cause.
      const currentAllowance = await publicClient.readContract({
        address: network.contracts.ALGEBA as any,
        abi: ALGEBA_ABI,
        functionName: 'allowance',
        args: [address, network.contracts.STAKING as any],
      }) as unknown as bigint;

      if (currentAllowance < stakeBigInt) {
        setStakeStep('approve');
        const approveHash = await walletClient.writeContract({
          account: address,
          address: network.contracts.ALGEBA as any,
          abi: ALGEBA_ABI,
          functionName: 'approve',
          args: [network.contracts.STAKING as any, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStakeStep('stake');

      // Request stake transaction
      const hash = await walletClient.writeContract({
        account: address,
        address: network.contracts.STAKING as any,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [stakeBigInt],
      });

      await publicClient.waitForTransactionReceipt({ hash });

      setStakeAmount('');

      // Refresh data
      const updatedUserData = await getUserData(publicClient, address as any, network.contracts);
      if (updatedUserData) {
        setStakedAmount(updatedUserData.stakingInfo?.amount || 0n);
      }
    } catch (error) {
      console.error('Error staking:', error);
      if (error instanceof Error) {
        alert(`Stake failed: ${error.message}`);
      }
    } finally {
      setActionLoading(false);
      setStakeStep(null);
    }
  };

  const handleClaim = async () => {
    if (!isConnected || !address || pendingReward === 0n) return;
    setActionLoading(true);
    try {
      console.log('Claiming rewards:', formatBigInt(pendingReward), 'AGB');

      // Check if MetaMask or wallet is available
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      // Create wallet client for transaction signing
      const walletClient = await getWalletClient();

      // Request claim transaction
      const hash = await walletClient.writeContract({
        account: address,
        address: network.contracts.STAKING as any,
        abi: STAKING_ABI,
        functionName: 'claim',
        args: [],
      });

      console.log('Claim transaction submitted:', hash);

      await publicClient.waitForTransactionReceipt({ hash });

      // Refresh data
      const updatedUserData = await getUserData(publicClient, address as any, network.contracts);
      if (updatedUserData) {
        setPendingReward(updatedUserData.pendingReward || 0n);
      }
    } catch (error) {
      console.error('Error claiming:', error);
      if (error instanceof Error) {
        alert(`Claim failed: ${error.message}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompound = async () => {
    if (!isConnected || !address || pendingReward === 0n) return;
    setActionLoading(true);
    try {
      console.log('Compounding rewards:', formatBigInt(pendingReward), 'AGB');

      // Check if MetaMask or wallet is available
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      // Create wallet client for transaction signing
      const walletClient = await getWalletClient();

      // Request compound transaction
      const hash = await walletClient.writeContract({
        account: address,
        address: network.contracts.STAKING as any,
        abi: STAKING_ABI,
        functionName: 'compound',
        args: [],
      });

      console.log('Compound transaction submitted:', hash);

      await publicClient.waitForTransactionReceipt({ hash });

      // Refresh data
      const updatedUserData = await getUserData(publicClient, address as any, network.contracts);
      if (updatedUserData) {
        setPendingReward(updatedUserData.pendingReward || 0n);
        setStakedAmount(updatedUserData.stakingInfo?.amount || 0n);
      }
    } catch (error) {
      console.error('Error compounding:', error);
      if (error instanceof Error) {
        alert(`Compound failed: ${error.message}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnstake = async () => {
    if (!isConnected || !address || unstakeWei === null || unstakeError) return;
    setActionLoading(true);
    try {
      // Check if MetaMask or wallet is available
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      const unstakeBigInt = unstakeWei;

      // Create wallet client for transaction signing
      const walletClient = await getWalletClient();

      // Request unstake transaction
      const hash = await walletClient.writeContract({
        account: address,
        address: network.contracts.STAKING as any,
        abi: STAKING_ABI,
        functionName: 'unstake',
        args: [unstakeBigInt],
      });

      console.log('Unstake transaction submitted:', hash);

      setUnstakeAmount('');

      await publicClient.waitForTransactionReceipt({ hash });

      // Refresh data
      const updatedUserData = await getUserData(publicClient, address as any, network.contracts);
      if (updatedUserData) {
        setStakedAmount(updatedUserData.stakingInfo?.amount || 0n);
      }
    } catch (error) {
      console.error('Error unstaking:', error);
      if (error instanceof Error) {
        alert(`Unstake failed: ${error.message}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmergencyWithdraw = async () => {
    if (!isConnected || !address || stakedAmount === 0n || !emergencyConfirmed) return;
    setEmergencyLoading(true);
    try {
      const walletClient = await getWalletClient();
      const hash = await walletClient.writeContract({
        account: address,
        address: network.contracts.STAKING as any,
        abi: STAKING_ABI,
        functionName: 'emergencyWithdraw',
        args: [],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      setEmergencyConfirmed(false);
      const updatedUserData = await getUserData(publicClient, address as any, network.contracts);
      if (updatedUserData) {
        setStakedAmount(updatedUserData.stakingInfo?.amount || 0n);
        setPendingReward(updatedUserData.pendingReward || 0n);
      }
      const balance = await publicClient.readContract({
        address: network.contracts.ALGEBA as any,
        abi: ALGEBA_ABI,
        functionName: 'balanceOf',
        args: [address as any],
      }) as unknown as bigint;
      setAgbBalance(balance || 0n);
    } catch (error) {
      console.error('Error during emergency withdraw:', error);
      if (error instanceof Error) {
        alert(`Emergency withdraw failed: ${error.message}`);
      }
    } finally {
      setEmergencyLoading(false);
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

  if (!isConnected) {
    return (
      <div className="card min-h-96">
        <p className="text-muted text-center py-12">Connect your wallet to stake</p>
      </div>
    );
  }

  if (!network.contracts.ALGEBA || !network.contracts.STAKING) {
    return (
      <div className="card min-h-96">
        <p className="text-muted text-center py-12">
          No Staking contract configured for {network.label}. Switch networks above or deploy from the Deploy page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Split Layout - Stake & Manage with Headers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Stake */}
        <div className="card flex flex-col h-full">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold mb-0">Stake</h3>
              <div className="text-right">
                <p className="text-xs text-muted uppercase font-medium tracking-wide">Your Stake</p>
                <p className="text-xl font-bold text-navy">{formatBigInt(stakedAmount)}</p>
              </div>
            </div>
          </div>
          <div className="card-body flex flex-col flex-1">
            {/* Input with Quick-Fill Buttons */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-xs text-muted uppercase font-medium tracking-wide">Amount to Stake</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => setStakePercentage(25)}
                    className="btn btn-secondary text-xs py-1 px-2"
                  >
                    25%
                  </button>
                  <button
                    onClick={() => setStakePercentage(50)}
                    className="btn btn-secondary text-xs py-1 px-2"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => setStakePercentage(75)}
                    className="btn btn-secondary text-xs py-1 px-2"
                  >
                    75%
                  </button>
                  <button
                    onClick={() => setStakePercentage(100)}
                    className="btn btn-primary text-xs py-1 px-2"
                  >
                    ALL
                  </button>
                </div>
              </div>
              <input
                type="number"
                placeholder="Enter amount (AGB)"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full px-4 py-3 border border-platinum rounded-md text-navy focus:outline-none transition-all"
              />
              <p className="text-xs text-muted mt-2">
                Balance: {formatBigInt(agbBalance)} AGB · Minimum position: 1 AGB
              </p>
              {stakeError && <p className="text-xs text-navy font-semibold mt-1">{stakeError}</p>}
            </div>

            <button
              onClick={handleAddToWallet}
              type="button"
              className="w-full btn btn-secondary py-2 text-sm font-medium mt-auto mb-3 flex items-center justify-center gap-2"
            >
              <img src={algebaIcon} alt="" className="w-4 h-4 rounded-full flex-shrink-0" />
              Add AGB to Wallet
            </button>

            <button
              onClick={handleStake}
              disabled={actionLoading || stakeWei === null || stakeError !== null}
              className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50"
            >
              {stakeStep === 'approve' ? 'Approving AGB...' : stakeStep === 'stake' ? 'Staking...' : 'Stake'}
            </button>
        </div>
        </div>

        {/* Right: Manage */}
        <div className="card flex flex-col h-full">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold mb-0">Manage</h3>
              <div className="text-right">
                <p className="text-xs text-muted uppercase font-medium tracking-wide">Pending Rewards</p>
                <p className="text-xl font-bold text-navy">{formatBigInt(pendingReward)}</p>
              </div>
            </div>
          </div>
          <div className="card-body flex flex-col flex-1 space-y-6">
            {/* Unstake Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold mb-0">Unstake</h4>

              <div className="w-full rounded-md bg-platinum text-navy p-2.5 text-xs font-semibold">
                Your Position: {formatBigInt(stakedAmount)} AGB
              </div>

              {/* Input with Quick-Fill Buttons */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs text-muted uppercase font-medium tracking-wide">Amount to Unstake</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setUnstakePercentage(25)}
                      className="btn btn-secondary text-xs py-1 px-2"
                    >
                      25%
                    </button>
                    <button
                      onClick={() => setUnstakePercentage(50)}
                      className="btn btn-secondary text-xs py-1 px-2"
                    >
                      50%
                    </button>
                    <button
                      onClick={() => setUnstakePercentage(75)}
                      className="btn btn-secondary text-xs py-1 px-2"
                    >
                      75%
                    </button>
                    <button
                      onClick={() => setUnstakePercentage(100)}
                      className="btn btn-primary text-xs py-1 px-2"
                    >
                      ALL
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  placeholder="Enter amount (AGB)"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-platinum rounded-md text-navy focus:outline-none transition-all"
                />
                {unstakeError && <p className="text-xs text-navy font-semibold mt-1">{unstakeError}</p>}
              </div>

              <button
                onClick={handleUnstake}
                disabled={actionLoading || unstakeWei === null || unstakeError !== null}
                className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50 mt-2"
              >
                {actionLoading ? 'Unstaking...' : 'Unstake'}
              </button>
            </div>

            {/* Divider */}
            <div className="divider"></div>

            {/* Claim & Compound Section */}
            {pendingReward > 0n && (
              <div className="space-y-4">
                <h4 className="text-sm font-bold">Claim Rewards</h4>
                <div className="p-4 rounded-md border border-navy bg-navy/5 space-y-2">
                  <p className="text-xs text-muted uppercase font-medium tracking-wide">Pending Rewards</p>
                  <p className="text-lg font-bold">{formatBigInt(pendingReward)} AGB</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleClaim}
                    disabled={actionLoading}
                    className="btn btn-primary py-3 font-semibold disabled:opacity-50 text-sm"
                  >
                    {actionLoading ? 'Claiming...' : 'Claim'}
                  </button>
                  <button
                    onClick={handleCompound}
                    disabled={actionLoading}
                    className="btn text-white py-3 font-semibold disabled:opacity-50 text-sm bg-navy"
                  >
                    {actionLoading ? 'Compounding...' : 'Compound'}
                  </button>
                </div>
              </div>
            )}

            {/* Emergency Withdraw */}
            {stakedAmount > 0n && (
              <details className="rounded-md border border-platinum-dark p-3">
                <summary className="text-sm font-bold cursor-pointer">Emergency withdraw</summary>
                <div className="space-y-3 mt-3">
                  <p className="text-xs text-muted">
                    Returns your full staked principal ({formatBigInt(stakedAmount)} AGB) without touching rewards.
                    Use it only if a normal Unstake fails. This always works because it doesn&rsquo;t depend on reward
                    calculations, but any pending rewards are forfeited permanently.
                  </p>
                  <div className="alert alert-primary mb-0 text-xs">
                    You will forfeit <strong>{formatBigInt(pendingReward)} AGB</strong> in pending rewards. This
                    cannot be undone.
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={emergencyConfirmed}
                      onChange={(e) => setEmergencyConfirmed(e.target.checked)}
                      disabled={emergencyLoading}
                      style={{ width: 'auto' }}
                    />
                    I understand I will lose all pending rewards.
                  </label>
                  <button
                    onClick={handleEmergencyWithdraw}
                    disabled={emergencyLoading || !emergencyConfirmed}
                    className="w-full btn btn-secondary py-3 font-semibold disabled:opacity-50"
                  >
                    {emergencyLoading ? 'Withdrawing...' : 'Emergency Withdraw Principal'}
                  </button>
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
