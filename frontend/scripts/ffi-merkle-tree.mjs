// Test-only helper invoked via Foundry's vm.ffi from Contracts/test/helpers/FfiMerkleTree.sol.
// Builds a tree with the exact same @openzeppelin/merkle-tree call used by
// scripts/build-genesis-whitelist.mjs (the real deploy-time tool), so Foundry
// tests validate Genesis.sol's Merkle logic against the actual production
// tree-building code path rather than a hand-rolled reimplementation.
//
// Usage: node scripts/ffi-merkle-tree.mjs <addr1> <addr2> ... <addrN>
// Output: a single ABI-encoded hex string (bytes32 root, bytes32[][] proofs),
// one proof array per input address in the same order, for Solidity to decode
// via abi.decode(result, (bytes32, bytes32[][])).

import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { AbiCoder } from 'ethers';

const addresses = process.argv.slice(2);
if (addresses.length === 0) {
  console.error('Usage: node scripts/ffi-merkle-tree.mjs <addr1> <addr2> ...');
  process.exit(1);
}

const tree = StandardMerkleTree.of(
  addresses.map((a) => [a]),
  ['address']
);

const proofsByAddress = new Map();
for (const [i, [address]] of tree.entries()) {
  proofsByAddress.set(address.toLowerCase(), tree.getProof(i));
}

// Preserve input order/duplication exactly as given, since callers index
// proofs[i] by their own account array's position, not the tree's internal order.
const orderedProofs = addresses.map((a) => {
  const proof = proofsByAddress.get(a.toLowerCase());
  if (!proof) throw new Error(`No proof found for ${a} — not a valid address?`);
  return proof;
});

const encoded = AbiCoder.defaultAbiCoder().encode(['bytes32', 'bytes32[][]'], [tree.root, orderedProofs]);
process.stdout.write(encoded);
