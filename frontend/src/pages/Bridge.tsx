import { useEffect, useState } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  pad,
  parseEther,
  formatEther,
  concatHex,
  numberToHex,
} from 'viem';
import { sepolia, baseSepolia } from 'viem/chains';
import { useWallet } from '../context/WalletContext';
import { CONTRACTS, ALGEBA_ABI } from '../config/contracts';
import { LZ_EID, OFT_CONTRACTS, OFT_ABI, layerZeroScanUrl } from '../config/bridge';
import { ensureChain } from '../utils/chainSwitch';

type Direction = 'toBaseSepolia' | 'toSepolia';
type TxStatus = 'idle' | 'approving' | 'quoting' | 'sending' | 'done' | 'error';

const sepoliaPublicClient = createPublicClient({ chain: sepolia, transport: http(undefined, { timeout: 10_000, retryCount: 3, retryDelay: 1_000 }) });
const baseSepoliaPublicClient = createPublicClient({ chain: baseSepolia, transport: http(undefined, { timeout: 10_000, retryCount: 3, retryDelay: 1_000 }) });

// LayerZero V2 "Type 3" options: a single executor lzReceive gas option.
// Format: 0x0003 (options type) + workerId(1B=executor) + size(2B) + optionType(1B=lzReceive) + gas(16B)
function buildLzReceiveOption(gasLimit: bigint): `0x${string}` {
  const gasHex = numberToHex(gasLimit, { size: 16 });
  return concatHex(['0x0003', '0x01', '0x0011', '0x01', gasHex]);
}

const DEFAULT_GAS_LIMIT = 200_000n;

export function Bridge() {
  const { walletAddress, isConnected } = useWallet();
  const [direction, setDirection] = useState<Direction>('toBaseSepolia');
  const [amount, setAmount] = useState('1');
  const [sepoliaBalance, setSepoliaBalance] = useState(0n);
  const [baseSepoliaBalance, setBaseSepoliaBalance] = useState(0n);
  const [status, setStatus] = useState<TxStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const bridgeConfigured = Boolean(OFT_CONTRACTS.ADAPTER_SEPOLIA && OFT_CONTRACTS.OFT_BASE_SEPOLIA);

  useEffect(() => {
    if (!isConnected || !walletAddress || !bridgeConfigured) return;
    const fetchBalances = async () => {
      try {
        const [sBal, mBal] = await Promise.all([
          sepoliaPublicClient.readContract({
            address: CONTRACTS.ALGEBA as `0x${string}`,
            abi: ALGEBA_ABI,
            functionName: 'balanceOf',
            args: [walletAddress as `0x${string}`],
          }) as Promise<bigint>,
          baseSepoliaPublicClient.readContract({
            address: OFT_CONTRACTS.OFT_BASE_SEPOLIA as `0x${string}`,
            abi: OFT_ABI,
            functionName: 'balanceOf',
            args: [walletAddress as `0x${string}`],
          }) as Promise<bigint>,
        ]);
        setSepoliaBalance(sBal);
        setBaseSepoliaBalance(mBal);
      } catch (err) {
        console.error('Error fetching bridge balances:', err);
      }
    };
    fetchBalances();
    const interval = setInterval(fetchBalances, 20000);
    return () => clearInterval(interval);
  }, [isConnected, walletAddress, bridgeConfigured]);

  const handleBridge = async () => {
    if (!walletAddress || !amount) return;
    setStatus('approving');
    setError(null);
    setTxHash(null);
    try {
      if (!window.ethereum) throw new Error('MetaMask not installed');

      const amountLD = parseEther(amount);
      const srcChain = direction === 'toBaseSepolia' ? sepolia : baseSepolia;
      const srcPublicClient = direction === 'toBaseSepolia' ? sepoliaPublicClient : baseSepoliaPublicClient;
      const srcOftAddress = direction === 'toBaseSepolia' ? OFT_CONTRACTS.ADAPTER_SEPOLIA : OFT_CONTRACTS.OFT_BASE_SEPOLIA;
      const dstEid = direction === 'toBaseSepolia' ? LZ_EID.BASE_SEPOLIA : LZ_EID.SEPOLIA;

      await ensureChain(srcChain);
      const walletClient = createWalletClient({ chain: srcChain, transport: custom(window.ethereum) });

      // Only the Sepolia adapter requires approval (it locks the real ERC-20 via
      // transferFrom); the Base Sepolia OFT mints/burns directly and needs none.
      if (direction === 'toBaseSepolia') {
        const currentAllowance = await srcPublicClient.readContract({
          address: CONTRACTS.ALGEBA as `0x${string}`,
          abi: ALGEBA_ABI,
          functionName: 'allowance',
          args: [walletAddress as `0x${string}`, srcOftAddress as `0x${string}`],
        }) as bigint;

        if (currentAllowance < amountLD) {
          const approveHash = await walletClient.writeContract({
            account: walletAddress as `0x${string}`,
            address: CONTRACTS.ALGEBA as `0x${string}`,
            abi: ALGEBA_ABI,
            functionName: 'approve',
            args: [srcOftAddress as `0x${string}`, amountLD],
          });
          await srcPublicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      setStatus('quoting');

      const sendParam = {
        dstEid,
        to: pad(walletAddress as `0x${string}`, { size: 32 }),
        amountLD,
        minAmountLD: amountLD,
        extraOptions: buildLzReceiveOption(DEFAULT_GAS_LIMIT),
        composeMsg: '0x' as `0x${string}`,
        oftCmd: '0x' as `0x${string}`,
      };

      const fee = await srcPublicClient.readContract({
        address: srcOftAddress as `0x${string}`,
        abi: OFT_ABI,
        functionName: 'quoteSend',
        args: [sendParam, false],
      }) as { nativeFee: bigint; lzTokenFee: bigint };

      setStatus('sending');

      const hash = await walletClient.writeContract({
        account: walletAddress as `0x${string}`,
        address: srcOftAddress as `0x${string}`,
        abi: OFT_ABI,
        functionName: 'send',
        args: [sendParam, fee, walletAddress as `0x${string}`],
        value: fee.nativeFee,
      });
      setTxHash(hash);
      await srcPublicClient.waitForTransactionReceipt({ hash });
      setStatus('done');
    } catch (err) {
      console.error('Bridge failed:', err);
      setError(err instanceof Error ? err.message : 'Bridge transaction failed');
      setStatus('error');
    }
  };

  if (!bridgeConfigured) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Bridge</h1>
          <p className="page-subtitle">Bridge AGB between Sepolia and Base Sepolia via LayerZero</p>
        </div>
        <div className="alert alert-primary">
          The bridge contracts haven't been deployed yet. An admin needs to deploy them from the Deploy page's
          Bridge tab and set <code className="bg-surface px-1 rounded-sm">VITE_OFT_ADAPTER_ADDRESS</code> and{' '}
          <code className="bg-surface px-1 rounded-sm">VITE_OFT_BASE_SEPOLIA_ADDRESS</code> in <code className="bg-surface px-1 rounded-sm">.env</code>.
        </div>
      </>
    );
  }

  const statusLabel = {
    idle: 'Bridge',
    approving: 'Approving AGB...',
    quoting: 'Getting quote...',
    sending: 'Bridging...',
    done: 'Bridge',
    error: 'Bridge',
  }[status];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Bridge</h1>
        <p className="page-subtitle">Bridge AGB between Sepolia and Base Sepolia via LayerZero</p>
      </div>

      <div className="py-2.5 px-2">
        <div className="card max-w-lg">
          <div className="card-header">
            <h2 className="text-lg font-bold mb-0">Bridge AGB</h2>
          </div>
          <div className="card-body space-y-4 text-sm">
            {!isConnected && (
              <div className="alert alert-primary mb-0">Connect your wallet to bridge AGB.</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md border border-platinum-dark bg-platinum">
                <p className="text-xs text-muted uppercase font-medium tracking-wide">Sepolia</p>
                <p className="text-sm font-bold mt-1">{formatEther(sepoliaBalance)} AGB</p>
              </div>
              <div className="p-3 rounded-md border border-platinum-dark bg-platinum">
                <p className="text-xs text-muted uppercase font-medium tracking-wide">Base Sepolia</p>
                <p className="text-sm font-bold mt-1">{formatEther(baseSepoliaBalance)} AGB</p>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted uppercase font-medium tracking-wide block mb-1">Direction</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('toBaseSepolia')}
                  className={`btn ${direction === 'toBaseSepolia' ? 'btn-primary' : 'btn-secondary'} text-sm py-2`}
                >
                  Sepolia → Base Sepolia
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('toSepolia')}
                  className={`btn ${direction === 'toSepolia' ? 'btn-primary' : 'btn-secondary'} text-sm py-2`}
                >
                  Base Sepolia → Sepolia
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted uppercase font-medium tracking-wide block mb-1">Amount (AGB)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={status === 'approving' || status === 'quoting' || status === 'sending'}
                placeholder="Enter amount"
              />
            </div>

            <button
              onClick={handleBridge}
              disabled={!isConnected || !amount || status === 'approving' || status === 'quoting' || status === 'sending'}
              className="w-full btn btn-primary py-3 font-semibold disabled:opacity-50"
            >
              {statusLabel}
            </button>

            {error && <p className="text-xs text-navy">{error}</p>}

            {txHash && (
              <div className="rounded-md bg-platinum p-2.5 text-xs">
                <p className="text-muted uppercase font-medium tracking-wide mb-1">
                  {status === 'done' ? 'Bridge Sent' : 'Transaction'}
                </p>
                <a href={layerZeroScanUrl(txHash)} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy hover:underline break-all">
                  Track on LayerZero Scan
                </a>
                {status === 'done' && (
                  <p className="text-muted mt-1">Delivery to the destination chain typically takes 1-3 minutes.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
