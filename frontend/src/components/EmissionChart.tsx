import { useEffect, useMemo, useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ReferenceLine,
} from 'recharts';
import { getContractStats } from '../utils/web3';
import { createNetworkPublicClient } from '../utils/publicClient';
import { useNetwork } from '../context/NetworkContext';
import { formatBigInt } from '../utils/formatting';

// Mirrors Staking.sol / ALGEBA.sol constants.
const GENESIS_ALLOCATION = 50;
const FIRST_EPOCH_EMISSION = 105_000_000;
const TOTAL_STAKING_EMISSION = 209_999_950;
const MAX_SUPPLY_TOTAL = GENESIS_ALLOCATION + TOTAL_STAKING_EMISSION;
const FULL_VIEW_EPOCHS = 12;

type View = 'full' | 'toDate';

interface ChartPoint {
  x: number; // position on the schedule, in epochs (1.5 = halfway through epoch 2)
  plan: number;
  emitted: number | null;
  totalSupply: number | null;
}

interface LiveData {
  emitted: number;
  totalSupply: number;
  // Current position in epochs; null until the first stake starts emission.
  now: number | null;
  halvingDays: number;
}

/** Scheduled supply after `x` epochs: genesis + halving emission, capped at the staking allocation. */
function plannedSupply(x: number): number {
  const epoch = Math.floor(x);
  const completed = FIRST_EPOCH_EMISSION * 2 * (1 - Math.pow(0.5, epoch));
  const partial = (FIRST_EPOCH_EMISSION / Math.pow(2, epoch)) * (x - epoch);
  return GENESIS_ALLOCATION + Math.min(completed + partial, TOTAL_STAKING_EMISSION);
}

function formatAgb(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return Math.floor(value).toLocaleString();
}

function buildPoints(view: View, live: LiveData | null): ChartPoint[] {
  const now = live?.now ?? null;
  const from = 0;
  let to = FULL_VIEW_EPOCHS;
  let steps = FULL_VIEW_EPOCHS * 4;
  if (view === 'toDate' && now !== null && now > 0) {
    // Zoom from launch to a little past today so the live lines are readable.
    to = now * 1.25;
    steps = 60;
  }

  const xs = Array.from({ length: steps + 1 }, (_, i) => from + ((to - from) * i) / steps);
  if (now !== null && now > from && now < to) xs.push(now);
  xs.sort((a, b) => a - b);

  // Only today's values are on-chain, so the live lines run straight from
  // genesis to "now". Emission is linear inside an epoch, so for the current
  // epoch this is also the true shape of the emitted line.
  const liveAt = (x: number, current: number) => {
    if (live === null || now === null || x > now) return null;
    if (now === 0) return current;
    return GENESIS_ALLOCATION + ((current - GENESIS_ALLOCATION) * x) / now;
  };

  return xs.map((x) => ({
    x,
    plan: plannedSupply(x),
    emitted: liveAt(x, live?.emitted ?? 0),
    totalSupply: liveAt(x, live?.totalSupply ?? 0),
  }));
}

export function EmissionChart() {
  const { network } = useNetwork();
  const [live, setLive] = useState<LiveData | null>(null);
  const [raw, setRaw] = useState<{ emitted: bigint; totalSupply: bigint } | null>(null);
  const [view, setView] = useState<View>('full');

  useEffect(() => {
    let isMounted = true;
    setLive(null);
    setRaw(null);

    const fetchLive = async () => {
      if (!network.contracts.STAKING || !network.contracts.ALGEBA) return;
      try {
        const publicClient = createNetworkPublicClient(network);
        const [stats, block] = await Promise.all([
          getContractStats(publicClient, network.contracts),
          publicClient.getBlock(),
        ]);
        // Keep the previous values on a failed poll so the lines don't drop to zero.
        if (!isMounted || !stats) return;

        const now = stats.startTime === 0n || stats.halvingPeriod === 0n
          ? null
          : Math.max(0, Number(block.timestamp - stats.startTime) / Number(stats.halvingPeriod));

        setRaw({ emitted: stats.emittedSupply, totalSupply: stats.totalSupply });
        setLive({
          emitted: Number(stats.emittedSupply) / 1e18,
          totalSupply: Number(stats.totalSupply) / 1e18,
          now,
          halvingDays: Number(stats.halvingPeriod) / 86400,
        });
      } catch (error) {
        console.error('Error fetching emission data:', error);
      }
    };

    fetchLive();
    const interval = setInterval(fetchLive, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [network]);

  const points = useMemo(() => buildPoints(view, live), [view, live]);

  const tableRows = useMemo(() => {
    const rows = [{ epoch: 0, emission: 0, cumulative: GENESIS_ALLOCATION }];
    for (let epoch = 1; epoch <= FULL_VIEW_EPOCHS; epoch++) {
      rows.push({
        epoch,
        emission: FIRST_EPOCH_EMISSION / Math.pow(2, epoch - 1),
        cumulative: plannedSupply(epoch),
      });
    }
    return rows;
  }, []);

  const now = live?.now ?? null;
  const toDate = view === 'toDate' && now !== null && now > 0;
  const days = (x: number) => x * (live?.halvingDays ?? 0);
  const currentEpoch = now === null ? null : Math.floor(now) + 1;

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold mb-0">Token Supply &amp; Emission Schedule</h2>
            <p className="page-subtitle mt-1">Planned emission vs. what has emitted and been minted so far</p>
          </div>
          <div className="tabs" role="tablist" aria-label="Chart range">
            <button role="tab" aria-selected={view === 'full'} className={`tab${view === 'full' ? ' active' : ''}`} onClick={() => setView('full')}>
              All epochs
            </button>
            <button role="tab" aria-selected={view === 'toDate'} className={`tab${view === 'toDate' ? ' active' : ''}`} onClick={() => setView('toDate')}>
              To date
            </button>
          </div>
        </div>
      </div>

      <div className="card-body space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-md border border-platinum bg-platinum">
          <div className="text-center">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Genesis</p>
            <p className="text-xl font-bold mt-2 text-navy">{GENESIS_ALLOCATION.toLocaleString()} AGB</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Emitted</p>
            <p className="text-xl font-bold mt-2 text-[#16A34A] tabular-nums">{raw ? formatBigInt(raw.emitted) : '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Total Supply</p>
            <p className="text-xl font-bold mt-2 text-[#2563EB] tabular-nums">{raw ? formatBigInt(raw.totalSupply) : '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Max Supply</p>
            <p className="text-xl font-bold mt-2 text-navy">{(MAX_SUPPLY_TOTAL / 1_000_000).toFixed(0)}M</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={points} margin={{ top: 10, right: 24, left: 8, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="x"
              type="number"
              domain={['dataMin', 'dataMax']}
              allowDecimals={toDate}
              tickCount={toDate ? 6 : FULL_VIEW_EPOCHS + 1}
              tickFormatter={(x: number) => (toDate ? `${days(x).toFixed(days(x) < 10 ? 1 : 0)}d` : `${x}`)}
              label={{ value: toDate ? 'Days since emission start' : 'Epoch', position: 'insideBottomRight', offset: -10 }}
              stroke="#6b7280"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              width={64}
              stroke="#6b7280"
              tickFormatter={formatAgb}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => `${formatAgb(typeof value === 'number' ? value : 0)} AGB`}
              labelFormatter={(x) => {
                const n = Number(x);
                if (n === 0) return 'Genesis';
                return toDate
                  ? `Day ${days(n).toFixed(1)} · Epoch ${Math.floor(n) + 1}`
                  : `Epoch ${Math.floor(n) + 1} · ${(((n - Math.floor(n)) * 100)).toFixed(1)}%`;
              }}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #cfcdc9', borderRadius: '8px', padding: '10px' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />

            {now !== null && (
              <ReferenceLine x={now} stroke="#1A1F3D" strokeDasharray="4 4" label={{ value: 'Now', position: 'top', fontSize: 12, fill: '#1A1F3D' }} />
            )}

            <Line type="linear" dataKey="plan" name="Full emission plan" stroke="#9CA3AF" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="emitted" name="Emitted supply (to date)" stroke="#16A34A" strokeWidth={3} dot={false} connectNulls={false} isAnimationActive={false} />
            <Line type="linear" dataKey="totalSupply" name="Total supply (minted)" stroke="#2563EB" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>

        <div className="pt-6 border-t border-platinum space-y-3">
          <h3 className="font-bold text-sm">Chart Guide</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 mt-2 flex-shrink-0 border-t-2 border-dashed border-[#9CA3AF]"></div>
              <div>
                <p className="font-semibold text-sm text-navy">Full emission plan</p>
                <p className="text-xs text-muted">Starts at the {GENESIS_ALLOCATION} AGB Genesis, reaches {formatAgb(plannedSupply(1))} after epoch 1, then halves every epoch toward {(MAX_SUPPLY_TOTAL / 1_000_000).toFixed(0)}M.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-0.5 mt-2 flex-shrink-0 bg-[#16A34A]"></div>
              <div>
                <p className="font-semibold text-sm text-navy">Emitted supply (green)</p>
                <p className="text-xs text-muted">emittedSupply(): Genesis plus everything the schedule has released up to now, claimed or not.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-0.5 mt-2 flex-shrink-0 bg-[#2563EB]"></div>
              <div>
                <p className="font-semibold text-sm text-navy">Total supply (blue)</p>
                <p className="text-xs text-muted">totalSupply(): tokens actually minted so far through claim, compound and unstake.</p>
              </div>
            </div>
          </div>
          {currentEpoch !== null && view === 'full' && now !== null && now < 0.05 && (
            <p className="text-xs text-muted">
              Early in epoch {currentEpoch} the live lines are tiny next to the 210M scale. Switch to <strong>To date</strong> for a closer look.
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <h3 className="text-lg font-bold mb-4">Emission Schedule by Epoch</h3>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left font-bold">Epoch</th>
                <th className="px-4 py-3 text-right font-bold">Emission / Epoch</th>
                <th className="px-4 py-3 text-right font-bold">Halving Rate</th>
                <th className="px-4 py-3 text-right font-bold">Cumulative Supply</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.epoch} className={row.epoch === currentEpoch ? 'bg-platinum' : undefined}>
                  <td className="px-4 py-3 font-bold">
                    {row.epoch === 0 ? 'Genesis' : row.epoch}
                    {row.epoch === currentEpoch && <span className="ml-2 text-xs font-semibold text-[#16A34A]">current</span>}
                  </td>
                  <td className="px-4 py-3 text-right">{row.epoch === 0 ? '—' : formatAgb(row.emission)}</td>
                  <td className="px-4 py-3 text-right text-muted">{row.epoch === 0 ? '—' : `1/${Math.pow(2, row.epoch - 1)}x`}</td>
                  <td className="px-4 py-3 text-right font-bold text-navy">{formatAgb(row.cumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
