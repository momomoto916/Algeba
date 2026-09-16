import { useState } from 'react';
import { isAddress, getAddress } from 'viem';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { CopyButton } from './shared';

interface WhitelistBuilderProps {
  onRootGenerated: (root: string) => void;
}

/// Builds the Genesis Merkle whitelist entirely in the browser, using the same
/// OpenZeppelin library as scripts/build-genesis-whitelist.mjs — no manual
/// text file or terminal command needed. Generates the root (auto-fills the
/// field below) and a downloadable proofs file for public/genesis-whitelist.json.
export function WhitelistBuilder({ onRootGenerated }: WhitelistBuilderProps) {
  const [addresses, setAddresses] = useState<string[]>(['']);
  const [result, setResult] = useState<{ root: string; proofsJson: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateAddress = (i: number, value: string) => {
    setAddresses((prev) => prev.map((a, idx) => (idx === i ? value : a)));
    setResult(null);
  };

  const addRow = () => setAddresses((prev) => [...prev, '']);
  const removeRow = (i: number) =>
    setAddresses((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const trimmed = addresses.map((a) => a.trim()).filter((a) => a.length > 0);
  const invalidEntries = trimmed.filter((a) => !isAddress(a));
  const checksummed = trimmed.filter((a) => isAddress(a)).map((a) => getAddress(a));
  const duplicates = [...new Set(checksummed.filter((a, i) => checksummed.indexOf(a) !== i))];

  const canGenerate = checksummed.length > 0 && invalidEntries.length === 0 && duplicates.length === 0;

  const generate = () => {
    setError(null);
    try {
      const tree = StandardMerkleTree.of(
        checksummed.map((a) => [a]),
        ['address']
      );
      const proofs: Record<string, string[]> = {};
      for (const [i, [address]] of tree.entries()) {
        proofs[address as string] = tree.getProof(i);
      }
      const output = { root: tree.root, count: checksummed.length, addresses: checksummed, proofs };
      setResult({ root: tree.root, proofsJson: JSON.stringify(output, null, 2) });
      onRootGenerated(tree.root);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build the whitelist tree.');
    }
  };

  const downloadJson = () => {
    if (!result) return;
    const blob = new Blob([result.proofsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'genesis-whitelist.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 p-3 rounded-md border border-platinum-dark bg-surface">
      <p className="text-xs text-muted uppercase font-medium tracking-wide">Build whitelist</p>

      <div className="space-y-2">
        {addresses.map((addr, i) => {
          const t = addr.trim();
          const isBad = t.length > 0 && !isAddress(t);
          return (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={addr}
                onChange={(e) => updateAddress(i, e.target.value)}
                placeholder="0x..."
                style={isBad ? { borderColor: '#d03b3b' } : undefined}
              />
              {addresses.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="btn btn-secondary text-xs py-1 px-2 flex-shrink-0"
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" onClick={addRow} className="btn btn-secondary text-sm">
        + Address
      </button>

      {invalidEntries.length > 0 && (
        <p className="text-xs text-navy">
          {invalidEntries.length} invalid address{invalidEntries.length === 1 ? '' : 'es'} — fix before generating.
        </p>
      )}
      {duplicates.length > 0 && (
        <p className="text-xs text-navy">Duplicate address(es): {duplicates.join(', ')}</p>
      )}

      <button
        type="button"
        onClick={generate}
        disabled={!canGenerate}
        className="w-full btn btn-primary py-2 font-semibold disabled:opacity-50"
      >
        Generate Whitelist ({checksummed.length} address{checksummed.length === 1 ? '' : 'es'})
      </button>
      {error && <p className="text-xs text-navy">{error}</p>}

      {result && (
        <div className="space-y-2 pt-2 border-t border-platinum-dark">
          <p className="text-xs text-muted">Merkle root (auto-filled below):</p>
          <div className="flex items-center gap-2">
            <code className="text-xs break-all flex-1">{result.root}</code>
            <CopyButton text={result.root} />
          </div>
          <button type="button" onClick={downloadJson} className="w-full btn btn-secondary text-sm">
            Download genesis-whitelist.json
          </button>
          <p className="text-xs text-muted">
            Put the downloaded file at{' '}
            <code className="bg-platinum px-1 rounded-sm">public/genesis-whitelist.json</code> (replacing the
            placeholder) before redeploying the frontend — it holds the proofs each wallet needs to call
            participate().
          </p>
        </div>
      )}
    </div>
  );
}
