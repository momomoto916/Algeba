import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GenesisStatus, UserData } from '../types/index';
import { getGenesisStatus, getUserData } from '../utils/web3';
import { formatBigInt } from '../utils/formatting';
import { useWallet } from '../context/WalletContext';
import { useNetwork } from '../context/NetworkContext';
import { ensureChain } from '../utils/chainSwitch';
import { createNetworkPublicClient } from '../utils/publicClient';
import { createWalletClient, custom, type Address } from 'viem';
import { GENESIS_ABI } from '../config/contracts';

type Action = 'participate' | 'finalize' | 'claim';

const GENESIS_ALLOCATION_WEI = 50n * 10n ** 18n;

function errorMessage(error: unknown): string {
  const e = error as { shortMessage?: string; message?: string };
  return e?.shortMessage || e?.message || 'Transaction failed';
}

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(sec)}s` : `${pad(h)}h ${pad(m)}m ${pad(sec)}s`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-md border border-platinum bg-platinum">
      <p className="text-xs text-muted font-medium uppercase">{label}</p>
      <p className="text-lg font-bold mt-3 tabular-nums">{value}</p>
    </div>
  );
}

function Panel({ title, children, dark = false }: { title: string; children?: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`p-4 rounded-md ${dark ? 'bg-navy' : 'border border-platinum bg-platinum'}`}>
      <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-navy'}`}>{title}</p>
      {children && <p className={`text-xs mt-1 ${dark ? 'text-white/75' : 'text-muted'}`}>{children}</p>}
    </div>
  );
}

export function Genesis() {
  const { walletAddress: address, isConnected, isConnecting, connect } = useWallet();
  const { network } = useNetwork();

  const [status, setStatus] = useState<GenesisStatus | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<Action | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [whitelistProofs, setWhitelistProofs] = useState<Record<string, `0x${string}`[]> | null>(null);
  // Local end time derived from the contract's `remaining`, so the countdown
  // ticks every second without hitting the RPC.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [nowSec, setNowSec] = useState(() => Date.now() / 1000);

  const publicClient = useMemo(() => createNetworkPublicClient(network), [network]);

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

  // Proofs are keyed by checksummed address; compare case-insensitively.
  const myProof = address && whitelistProofs
    ? Object.entries(whitelistProofs).find(([addr]) => addr.toLowerCase() === address.toLowerCase())?.[1] ?? null
    : null;
  const isWhitelisted = myProof !== null;

  const refresh = useCallback(async () => {
    const [statusData, user] = await Promise.all([
      getGenesisStatus(publicClient, network.contracts),
      isConnected && address ? getUserData(publicClient, address, network.contracts) : Promise.resolve(null),
    ]);
    // A failed read returns null; keep what is on screen instead of blanking it.
    if (statusData) {
      setStatus(statusData);
      setEndsAt(statusData.open ? Date.now() / 1000 + Number(statusData.remaining) : null);
    }
    if (user) setUserData(user);
    if (!isConnected) setUserData(null);
    setLoading(false);
  }, [publicClient, network.contracts, isConnected, address]);

  // Only a network switch clears the screen. Connecting a wallet just adds
  // user data on top, so the card never disappears and reappears.
  useEffect(() => {
    setLoading(true);
    setStatus(null);
    setUserData(null);
  }, [network]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const secondsLeft = endsAt === null ? 0 : endsAt - nowSec;

  useEffect(() => {
    if (endsAt === null) return;
    const tick = setInterval(() => setNowSec(Date.now() / 1000), 1000);
    return () => clearInterval(tick);
  }, [endsAt]);

  // When the local countdown runs out, re-read so the Finalize button appears.
  const countdownDone = endsAt !== null && secondsLeft <= 0;
  useEffect(() => {
    if (countdownDone) refresh();
  }, [countdownDone, refresh]);

  const send = async (kind: Action, label: string, functionName: 'participate' | 'finalize' | 'claim', args: readonly unknown[]) => {
    if (!address) return;
    setAction(kind);
    setNotice(null);
    try {
      if (!window.ethereum) throw new Error('No wallet extension detected');
      await ensureChain(network.chain);
      const wallet = createWalletClient({ chain: network.chain, transport: custom(window.ethereum) });
      const hash = await wallet.writeContract({
        account: address as Address,
        chain: network.chain,
        address: network.contracts.GENESIS as Address,
        abi: GENESIS_ABI,
        functionName,
        args,
      } as Parameters<typeof wallet.writeContract>[0]);
      await publicClient.waitForTransactionReceipt({ hash });
      setNotice({ kind: 'ok', text: `${label} confirmed.` });
    } catch (error) {
      console.error(`${label} failed:`, error);
      setNotice({ kind: 'error', text: `${label} failed: ${errorMessage(error)}` });
    } finally {
      setAction(null);
      await refresh();
    }
  };

  if (!network.contracts.GENESIS) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="text-navy">No Genesis contract configured for {network.label}. Switch networks above or deploy from the Deploy page.</p>
        </div>
      </div>
    );
  }

  if (loading && !status) {
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
        <div className="card-body space-y-3">
          <p className="text-navy">Failed to load Genesis data.</p>
          <button onClick={() => refresh()} className="btn btn-secondary text-sm">Retry</button>
        </div>
      </div>
    );
  }

  const isClosed = status.done;
  const timeEnded = !status.done && !status.open;
  const participants = status.participants;
  const estimatedShare = participants > 0n ? GENESIS_ALLOCATION_WEI / participants : GENESIS_ALLOCATION_WEI;

  const connectButton = (text: string) => (
    <button
      onClick={() => connect().catch((e) => console.error(e))}
      disabled={isConnecting}
      className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50"
    >
      {isConnecting ? 'Connecting...' : text}
    </button>
  );

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold mb-0">Genesis Event</h2>
          <span className={`text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-sm ${isClosed ? 'bg-platinum text-navy' : 'bg-navy text-white'}`}>
            {isClosed ? 'Closed' : 'Open'}
          </span>
        </div>
      </div>

      <div className="card-body space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Tile label="Status" value={isClosed ? 'Closed' : timeEnded ? 'Ended' : 'Open'} />
          <Tile label="Time Remaining" value={status.open ? formatCountdown(secondsLeft) : timeEnded ? 'Awaiting finalize' : '—'} />
          <Tile label="Participants" value={participants.toString()} />
          <Tile
            label={isClosed ? 'Your Allocation' : 'Share per Wallet'}
            value={
              isClosed
                ? userData && userData.genesisAllocation !== 0n ? `${formatBigInt(userData.genesisAllocation)} AGB` : '—'
                : `≈ ${formatBigInt(estimatedShare)} AGB`
            }
          />
        </div>

        {notice && (
          <div className={`alert mb-0 ${notice.kind === 'error' ? 'alert-danger' : 'alert-primary'}`} role="status">
            {notice.text}
          </div>
        )}

        {/* OPEN MODE: participate while the window runs, finalize once time is up */}
        {!isClosed && (
          <div className="space-y-4">
            {status.open ? (
              <>
                <Panel title="Open — Participate in Genesis">
                  Whitelisted wallets register once for free (gas only). The 50 AGB Genesis allocation is split equally between all participants.
                </Panel>

                {!isConnected ? (
                  connectButton('Connect Wallet to Participate')
                ) : !whitelistProofs || !userData ? (
                  <p className="text-sm text-muted">Checking your wallet…</p>
                ) : userData.genesisEligible ? (
                  <Panel title="You are registered for Genesis">
                    Come back when the timer ends to finalize, then claim your allocation.
                  </Panel>
                ) : isWhitelisted ? (
                  <button
                    onClick={() => send('participate', 'Participate', 'participate', [myProof])}
                    disabled={action !== null}
                    className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50"
                  >
                    {action === 'participate' ? 'Participating...' : 'Participate'}
                  </button>
                ) : (
                  <Panel title="This wallet is not on the Genesis whitelist">
                    The whitelist is fixed and cannot be changed after deployment.
                  </Panel>
                )}
              </>
            ) : (
              <>
                <Panel title="Time is up — Finalize Genesis" dark>
                  The participation window has ended. Anyone can finalize; once finalized, participants can claim.
                </Panel>
                {!isConnected ? (
                  connectButton('Connect Wallet to Finalize')
                ) : (
                  <button
                    onClick={() => send('finalize', 'Finalize', 'finalize', [])}
                    disabled={action !== null}
                    className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50"
                  >
                    {action === 'finalize' ? 'Finalizing...' : 'Finalize Genesis'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* CLOSED MODE: claim */}
        {isClosed && (
          <div className="space-y-4">
            <Panel title="Closed — Claim Your Allocation">
              Genesis is finalized with {participants.toString()} participant{participants === 1n ? '' : 's'}. Each one can claim an equal share.
            </Panel>

            {!isConnected ? (
              connectButton('Connect Wallet to Claim')
            ) : !userData ? (
              <p className="text-sm text-muted">Checking your wallet…</p>
            ) : userData.genesisClaimed ? (
              <Panel title="Claimed">
                You have claimed {formatBigInt(userData.genesisAllocation)} AGB.
              </Panel>
            ) : userData.genesisClaimable !== 0n ? (
              <button
                onClick={() => send('claim', 'Claim', 'claim', [])}
                disabled={action !== null}
                className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50"
              >
                {action === 'claim' ? 'Claiming...' : `Claim ${formatBigInt(userData.genesisClaimable)} AGB`}
              </button>
            ) : (
              <Panel title="Nothing to claim">
                This wallet did not participate in Genesis.
              </Panel>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
