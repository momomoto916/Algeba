import { useState } from 'react';

export type StepStatus = 'locked' | 'active' | 'pending' | 'done' | 'error';

export function explorerUrl(hashOrAddress: string, type: 'tx' | 'address', base = 'https://sepolia.etherscan.io') {
  return `${base}/${type}/${hashOrAddress}`;
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="btn btn-secondary text-xs py-1 px-2 flex-shrink-0"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function StatusBadge({ status }: { status: StepStatus }) {
  const label = {
    locked: 'Locked',
    active: 'Ready',
    pending: 'Confirming...',
    done: 'Done',
    error: 'Failed',
  }[status];
  const className = {
    locked: 'bg-platinum text-muted',
    active: 'bg-platinum text-navy',
    pending: 'bg-navy text-white',
    done: 'bg-navy text-white',
    error: 'bg-navy text-white',
  }[status];
  return <span className={`badge ${className}`}>{label}</span>;
}

interface StepShellProps {
  number: number;
  title: string;
  status: StepStatus;
  children: React.ReactNode;
}

export function StepShell({ number, title, status, children }: StepShellProps) {
  return (
    <div className="card" style={{ opacity: status === 'locked' ? 0.55 : 1 }}>
      <div className="card-header flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-navy text-white text-xs font-bold flex-shrink-0">
            {number}
          </span>
          <h2 className="text-lg font-bold mb-0">{title}</h2>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="card-body space-y-3 text-sm">{children}</div>
    </div>
  );
}

export function AddressCard({ address, explorerBase }: { address: string; explorerBase?: string }) {
  return (
    <div className="rounded-md bg-platinum p-2.5 text-xs flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-muted uppercase font-medium tracking-wide mb-1">Deployed Address</p>
        <a
          href={explorerUrl(address, 'address', explorerBase)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-navy hover:underline break-all"
        >
          {address}
        </a>
      </div>
      <CopyButton text={address} />
    </div>
  );
}

export function TxLine({ hash, explorerBase }: { hash: string; explorerBase?: string }) {
  return (
    <p className="text-xs text-muted">
      Tx: <a href={explorerUrl(hash, 'tx', explorerBase)} target="_blank" rel="noopener noreferrer" className="hover:underline text-navy">{hash}</a>
    </p>
  );
}
