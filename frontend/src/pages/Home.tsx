import { Suspense, useState } from 'react';
import { Stats } from '../components/Stats';
import { Staking } from '../components/Staking';
import { EmissionChart } from '../components/EmissionChart';
import { useNetwork } from '../context/NetworkContext';
import { explorerAddressUrl } from '../config/networks';
import { formatAddress } from '../utils/formatting';

function TokenAddressBadge() {
  const { network } = useNetwork();
  const [copied, setCopied] = useState(false);
  const address = network.contracts.ALGEBA;

  if (!address) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-platinum-dark bg-platinum px-3 py-1.5">
      <span className="text-xs font-bold text-navy">AGB</span>
      <a
        href={explorerAddressUrl(network, address)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-navy hover:underline"
        title={address}
      >
        {formatAddress(address)}
      </a>
      <button
        onClick={handleCopy}
        type="button"
        aria-label="Copy token address"
        title={copied ? 'Copied' : 'Copy address'}
        className="flex items-center justify-center text-navy hover:opacity-70 transition-opacity"
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function Home() {
  return (
    <>
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <h1 className="page-title">Explorer</h1>
        <TokenAddressBadge />
      </div>

      <div>
        <section className="py-2.5 px-2">
          <Suspense fallback={<div className="animate-pulse bg-gray-200 h-40 rounded-lg"></div>}>
            <Stats />
          </Suspense>
        </section>

        <section className="py-2.5 px-2">
          <Suspense fallback={<div className="animate-pulse bg-gray-200 h-96 rounded-lg"></div>}>
            <Staking />
          </Suspense>
        </section>

        <section className="py-2.5 px-2">
          <Suspense fallback={<div className="animate-pulse bg-gray-200 h-80 rounded-lg"></div>}>
            <EmissionChart />
          </Suspense>
        </section>
      </div>
    </>
  );
}
