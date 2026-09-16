// Builds the Merkle tree for Genesis's immutable whitelist.
//
// Usage:
//   node scripts/build-genesis-whitelist.mjs addresses.txt
//
// addresses.txt: one 0x address per line (blank lines / lines starting with
// # are ignored). Output: whitelist-tree.json, containing the root (pass this
// as merkleRoot_ to Genesis's constructor on the Deploy page) and, for every
// address, its proof (needed client-side when that wallet calls participate()).
//
// This MUST use @openzeppelin/merkle-tree (not a hand-rolled hash) because
// Genesis.sol's leaf hash — keccak256(bytes.concat(keccak256(abi.encode(address))))
// — is exactly what StandardMerkleTree produces for a single `address` value.
// Any other tree-building method will not produce valid proofs on-chain.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { isAddress, getAddress } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/build-genesis-whitelist.mjs <addresses.txt>');
  process.exit(1);
}

const raw = fs.readFileSync(path.resolve(inputPath), 'utf8');
const lines = raw
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith('#'));

if (lines.length === 0) {
  console.error('No addresses found in input file.');
  process.exit(1);
}

const seen = new Set();
const addresses = [];
for (const line of lines) {
  if (!isAddress(line)) {
    console.error(`Not a valid address: "${line}"`);
    process.exit(1);
  }
  const checksummed = getAddress(line);
  if (seen.has(checksummed.toLowerCase())) {
    console.error(`Duplicate address: ${checksummed}`);
    process.exit(1);
  }
  seen.add(checksummed.toLowerCase());
  addresses.push(checksummed);
}

// StandardMerkleTree.of expects an array of "values" (each itself an array of
// leaf-encoded fields) plus the Solidity types of those fields — here, one
// address per leaf, matching Genesis.sol's keccak256(abi.encode(address)) leaf.
const tree = StandardMerkleTree.of(
  addresses.map((a) => [a]),
  ['address']
);

const proofs = {};
for (const [i, [address]] of tree.entries()) {
  proofs[address] = tree.getProof(i);
}

const output = {
  root: tree.root,
  count: addresses.length,
  addresses,
  proofs,
};

const outPath = path.resolve(__dirname, '..', 'whitelist-tree.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`Whitelisted ${addresses.length} address(es).`);
console.log(`Merkle root: ${tree.root}`);
console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
console.log('\nPass the root above as merkleRoot_ when deploying Genesis.');
