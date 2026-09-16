import { useEffect, useState } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { getContractStats } from '../utils/web3';
import { createNetworkPublicClient } from '../utils/publicClient';
import { useNetwork } from '../context/NetworkContext';

interface EmissionData {
  epoch: number;
  epochEmission: number;
  genesisSupply: number; // testnet: 50 AGB (see GENESIS_ALLOCATION)
  cumulativeSupply: number; // Genesis + accumulated emissions
  emittedSupply: number; // Live data
  totalSupply: number; // Live data
}

const GENESIS_ALLOCATION = 50; // testnet value, matches ALGEBA.sol / Genesis.sol
const FIRST_EPOCH_EMISSION = 105_000_000; // MAX_SUPPLY / 2 — see Staking.sol for the TOTAL_EMISSION clamp
const TOTAL_STAKING_EMISSION = 209_999_950; // matches Staking.sol TOTAL_EMISSION / ALGEBA.sol STAKING_ALLOCATION
const MAX_SUPPLY_TOTAL = GENESIS_ALLOCATION + TOTAL_STAKING_EMISSION; // 210,000,000 — the true hard cap

export function EmissionChart() {
  const { network } = useNetwork();
  const [data, setData] = useState<EmissionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const generateEmissionSchedule = async () => {
      try {
        // Fetch live contract data
        const publicClient = createNetworkPublicClient(network);

        let liveEmitted = 0;
        let liveTotalSupply = 0;

        if (network.contracts.STAKING && network.contracts.ALGEBA) {
          try {
            const stats = await getContractStats(publicClient, network.contracts);
            if (stats) {
              liveEmitted = Number(stats.emittedSupply) / 1e18;
              liveTotalSupply = Number(stats.totalSupply) / 1e18;
            }
          } catch (error) {
            console.error('Error fetching contract stats:', error);
          }
        }

        const chartData: EmissionData[] = [];

        // Chart starts at epoch 0 (Genesis allocation)
        chartData.push({
          epoch: 0,
          epochEmission: 0,
          genesisSupply: GENESIS_ALLOCATION,
          cumulativeSupply: GENESIS_ALLOCATION,
          emittedSupply: liveEmitted,
          totalSupply: liveTotalSupply,
        });

        // Then emissions for epochs 0-11
        for (let epoch = 0; epoch < 12; epoch++) {
          const epochEmission = FIRST_EPOCH_EMISSION / Math.pow(2, epoch);
          // Cumulative = Genesis allocation + sum of all emissions up to this epoch
          const cumulativeEmission = GENESIS_ALLOCATION +
            (FIRST_EPOCH_EMISSION * (1 - Math.pow(0.5, epoch + 1)) / (1 - 0.5));

          // Calculate emission and total supply following the same curve pattern
          // but representing actual/live data points
          const emissionCurveValue = Math.min(liveEmitted, cumulativeEmission);
          const totalCurveValue = Math.min(liveTotalSupply, cumulativeEmission);

          chartData.push({
            epoch: epoch + 1,
            epochEmission: Math.round(epochEmission),
            genesisSupply: GENESIS_ALLOCATION,
            cumulativeSupply: Math.round(cumulativeEmission),
            emittedSupply: Math.round(emissionCurveValue),
            totalSupply: Math.round(totalCurveValue),
          });
        }

        if (isMounted) {
          setData(chartData);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error generating emission schedule:', error);
      }
    };

    generateEmissionSchedule();

    // Refresh every 30 seconds
    const interval = setInterval(generateEmissionSchedule, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [network]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="h-96 bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-xl font-bold mb-0">Token Supply & Emission Schedule</h2>
        <p className="page-subtitle mt-1">Complete emission plan from genesis allocation to final supply</p>
      </div>

      <div className="card-body space-y-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-2 gap-6 p-4 rounded-md border border-platinum bg-platinum">
          <div className="text-center">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Genesis Allocation</p>
            <p className="text-2xl font-bold mt-2 text-navy">{GENESIS_ALLOCATION.toLocaleString()} AGB</p>
            <p className="text-xs text-muted mt-1">Initial Supply</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Max Supply</p>
            <p className="text-2xl font-bold mt-2 text-navy">{(MAX_SUPPLY_TOTAL / 1_000_000).toFixed(1)}M</p>
            <p className="text-xs text-muted mt-1">Genesis + Emission</p>
          </div>
        </div>

        {/* Main Chart */}
        <div>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={true} />
            <XAxis
              dataKey="epoch"
              label={{ value: 'Epoch', position: 'insideBottomRight', offset: -10 }}
              stroke="#6b7280"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              label={{ value: 'Supply (AGB Millions)', angle: -90, position: 'insideLeft', offset: 10 }}
              stroke="#6b7280"
              tickFormatter={(value) => `${(value / 1_000_000).toFixed(0)}M`}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: any) => {
                const numValue = typeof value === 'number' ? value : 0;
                return `${(numValue / 1_000_000).toFixed(2)}M AGB`;
              }}
              labelFormatter={(epoch) => {
                if (epoch === 0) return 'Genesis Allocation';
                return `Epoch ${epoch}`;
              }}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #cfcdc9',
                borderRadius: '8px',
                padding: '10px',
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />

            {/* Full Emission Plan - Green Shaded Area */}
            <Area
              type="monotone"
              dataKey="cumulativeSupply"
              stroke="#22C55E"
              strokeWidth={3}
              fill="url(#colorPlan)"
              isAnimationActive={false}
              name="Full Emission Plan (Genesis + Emissions)"
              dot={{ fill: '#22C55E', r: 2.5 }}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        </div>

        {/* Detailed Epoch Data Table */}
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
              {data.filter((row) => row.epoch >= 0).map((row, idx) => {
                const isGenesisRow = row.epoch === 0;
                const halvingRate = isGenesisRow ? '—' : `1/${Math.pow(2, row.epoch - 1)}x`;
                return (
                  <tr key={idx}>
                    <td className="px-4 py-3 font-bold">{isGenesisRow ? 'Genesis' : row.epoch}</td>
                    <td className="px-4 py-3 text-right">{(row.epochEmission / 1_000_000).toFixed(1)}M</td>
                    <td className="px-4 py-3 text-right text-muted">{halvingRate}</td>
                    <td className="px-4 py-3 text-right font-bold text-navy">
                      {row.cumulativeSupply >= 1_000_000
                        ? `${(row.cumulativeSupply / 1_000_000).toFixed(2)}M`
                        : row.cumulativeSupply.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend & Explanation */}
        <div className="pt-6 border-t border-platinum space-y-3">
          <h3 className="font-bold text-sm">Chart Guide</h3>

        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-0.5 mt-2 flex-shrink-0 bg-[#22C55E]"></div>
            <div>
              <p className="font-semibold text-sm text-navy">Full Emission Plan (Green)</p>
              <p className="text-xs text-muted">Genesis ({GENESIS_ALLOCATION} AGB) + theoretical emissions schedule. Starting at {GENESIS_ALLOCATION} AGB, then emitting 105M in the first epoch, halving each epoch after.</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg p-4 mt-4 border border-platinum-dark bg-platinum">
          <p className="text-xs text-navy">
            <strong>How it works:</strong> Genesis starts with {GENESIS_ALLOCATION} AGB tokens distributed to early participants.
            Staking emissions begin at 105M in epoch 0 and halve every epoch, asymptotically reaching the ~210M max supply.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
