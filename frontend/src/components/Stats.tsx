import { useEffect, useState } from 'react';
import type { ContractStats } from '../types/index';
import { getContractStats } from '../utils/web3';
import { formatCompact, formatBigInt, formatWithDecimals, formatBigIntNoFloat } from '../utils/formatting';
import { createNetworkPublicClient } from '../utils/publicClient';
import { useNetwork } from '../context/NetworkContext';

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
}

// APR = current emission rate / TVL. With little staked relative to the fixed
// emission pool, this is genuinely a huge number early on — that's expected
// DeFi-farm behavior, not a bug. Format compactly rather than hiding it.
function formatAPY(apy: number): string {
  if (apy >= 1_000_000) return `${(apy / 1_000_000).toFixed(2)}M%`;
  if (apy >= 1_000) return `${(apy / 1_000).toFixed(2)}K%`;
  return `${apy.toFixed(2)}%`;
}

// Days when under a year; "Xy Yd" once it crosses a year, so multi-year
// halving countdowns don't render as an unreadable wall of days.
function formatHalvingCountdown(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  if (days < 365) return `${days}d`;
  const years = Math.floor(days / 365.25);
  const remainderDays = Math.floor(days - years * 365.25);
  return `${years}y ${remainderDays}d`;
}

const StatCard = ({ label, value, subtext }: StatCardProps) => (
  <div className="card">
    <div style={{ padding: '3px' }}>
      <p className="text-xs uppercase tracking-wide font-medium text-muted">
        {label}
      </p>
      <p className="text-lg font-bold mt-1.5 tabular-nums">
        {value}
      </p>
      {subtext && (
        <p className="text-xs mt-1 text-muted">
          {subtext}
        </p>
      )}
    </div>
  </div>
);

const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;

export function Stats() {
  const { network } = useNetwork();
  const [stats, setStats] = useState<ContractStats | null>(null);
  const [chainTime, setChainTime] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [apy, setApy] = useState(0);

  useEffect(() => {
    let isMounted = true;

    // Only the first fetch (or a network switch, since this effect re-runs
    // on [network] change) shows the skeleton. Background polls update the
    // numbers in place so the cards don't blink every 60s.
    const fetchStats = async (isInitial: boolean) => {
      if (isInitial) setLoading(true);
      const publicClient = createNetworkPublicClient(network);

      try {
        const [data, latestBlock] = await Promise.all([
          getContractStats(publicClient, network.contracts),
          publicClient.getBlock(),
        ]);
        if (!isMounted) return;
        // A failed poll returns null. Keep the last good numbers instead of
        // dropping back to the skeleton, which made the cards blink out.
        if (!data) {
          setLoading(false);
          return;
        }
        setStats(data);
        // The halving schedule runs on block.timestamp, so count down against
        // the chain's clock rather than the viewer's local clock.
        setChainTime(latestBlock.timestamp);

        {
          const totalStaked = Number(data.totalStaked) / 1e18;
          const emissionPerSecond = Number(data.emissionPerSecond) / 1e18;
          const annualEmission = emissionPerSecond * SECONDS_PER_YEAR;
          const calculatedAPY = totalStaked > 0 ? (annualEmission / totalStaked) * 100 : 0;

          setApy(Math.max(calculatedAPY, 0));
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching stats:', error);
        if (isMounted) setLoading(false);
      }
    };

    fetchStats(true);

    // Poll less frequently to avoid rate limiting
    const interval = setInterval(() => fetchStats(false), 60000); // 60 seconds instead of 15
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [network]);

  if (!network.contracts.ALGEBA || !network.contracts.GENESIS || !network.contracts.STAKING) {
    return (
      <div className="alert alert-primary mb-0">
        No contracts configured for {network.label}. Deploy them from the Deploy page, or switch networks above.
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-lg p-6 min-h-32 animate-pulse">
            <div className="h-3 bg-gray-300 rounded w-24 mb-4"></div>
            <div className="h-8 bg-gray-300 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Stats Grid - 5 cards with Tabler spacing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          label="Circulating Supply"
          value={formatCompact(stats.totalSupply)}
          subtext={`${formatBigInt(stats.totalSupply)} AGB`}
        />
        <StatCard
          label="Total Staked"
          value={formatCompact(stats.totalStaked)}
          subtext={`${formatBigInt(stats.totalStaked)} AGB`}
        />
        <StatCard
          label="Emitted"
          value={formatCompact(stats.emittedSupply)}
          subtext={`${formatBigInt(stats.emittedSupply)} AGB`}
        />
        <StatCard
          label="Remaining"
          value={formatCompact(stats.remainingEmission)}
          subtext={`${formatBigInt(stats.remainingEmission)} AGB`}
        />
        <StatCard
          label="Current APY"
          value={stats.totalStaked === 0n ? 'New Pool' : formatAPY(apy)}
          subtext={stats.totalStaked === 0n ? 'Not enough staked yet' : 'Yield'}
        />
      </div>

      {/* Secondary Stats - 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Genesis Participants"
          value={stats.genesisParticipants.toString()}
          subtext="Total participants"
        />
        <StatCard
          label="Current Epoch"
          value={`Epoch ${(stats.currentEpoch + 1n).toString()}`}
          subtext={
            stats.emissionPerSecond === 0n
              ? 'Emission not started'
              : `${formatBigIntNoFloat(stats.emissionPerSecond * 86400n)} AGB/day · ${formatWithDecimals(stats.emissionPerSecond)} AGB/sec`
          }
        />
        {(() => {
          if (stats.nextHalvingTime === 0n) {
            return (
              <StatCard
                label="Next Halving"
                value="Not Started"
                subtext="Staking hasn't begun yet"
              />
            );
          }
          const now = chainTime ?? BigInt(Math.floor(Date.now() / 1000));
          const secondsLeft = stats.nextHalvingTime > now ? Number(stats.nextHalvingTime - now) : 0;
          const halvingDate = new Date(Number(stats.nextHalvingTime) * 1000).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          return (
            <StatCard
              label="Next Halving"
              value={halvingDate}
              subtext={`${formatHalvingCountdown(secondsLeft)} left`}
            />
          );
        })()}
      </div>

    </div>
  );
}
