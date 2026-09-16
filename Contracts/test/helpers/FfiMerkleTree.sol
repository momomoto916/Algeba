// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

/// @dev Test-only Merkle tree builder that shells out (via FFI) to the real
/// OpenZeppelin JS merkle-tree library through scripts/ffi-merkle-tree.mjs —
/// the exact same tool used at deploy time (scripts/build-genesis-whitelist.mjs)
/// — so tests validate Genesis.sol's on-chain verification against the real
/// production tree, not a hand-rolled Solidity reimplementation. Requires
/// `ffi = true` in foundry.toml and Node.js with the frontend's node_modules
/// installed.
library FfiMerkleTree {
    address constant VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));
    Vm constant vm = Vm(VM_ADDRESS);

    /// @dev Returns the root and, for each input address (same order,
    /// duplicates preserved), its Merkle proof.
    function build(address[] memory accounts) internal returns (bytes32 root, bytes32[][] memory proofs) {
        string[] memory cmd = new string[](2 + accounts.length);
        cmd[0] = "node";
        cmd[1] = "../frontend/scripts/ffi-merkle-tree.mjs";
        for (uint256 i = 0; i < accounts.length; i++) {
            cmd[2 + i] = vm.toString(accounts[i]);
        }

        bytes memory result = vm.ffi(cmd);
        (root, proofs) = abi.decode(result, (bytes32, bytes32[][]));
    }
}
