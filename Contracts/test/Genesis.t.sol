// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ALGEBA} from "../ALGEBA.sol";
import {Genesis} from "../Genesis.sol";
import {FfiMerkleTree} from "./helpers/FfiMerkleTree.sol";

contract GenesisTest is Test {
    ALGEBA algeba;
    Genesis genesis;
    uint256 constant DURATION = 7 days;

    address alice = address(0xA1);
    address bob = address(0xB0B);
    address carol = address(0xCA401);
    address outsider = address(0xBAD); // never whitelisted

    address[] whitelist;
    bytes32 merkleRoot;
    bytes32[][] proofs; // proofs[i] corresponds to whitelist[i]

    function setUp() public {
        whitelist = new address[](3);
        whitelist[0] = alice;
        whitelist[1] = bob;
        whitelist[2] = carol;
        (merkleRoot, proofs) = FfiMerkleTree.build(whitelist);

        algeba = new ALGEBA(address(this));
        genesis = new Genesis(address(algeba), DURATION, merkleRoot);
        algeba.transfer(address(genesis), algeba.GENESIS_ALLOCATION());
    }

    function _proofFor(address account) internal view returns (bytes32[] memory) {
        for (uint256 i = 0; i < whitelist.length; i++) {
            if (whitelist[i] == account) return proofs[i];
        }
        revert("not in test whitelist");
    }

    function _participate(address account) internal {
        vm.prank(account);
        genesis.participate(_proofFor(account));
    }

    function test_constructor_revertsOnZeroToken() public {
        vm.expectRevert(bytes("zero token"));
        new Genesis(address(0), DURATION, merkleRoot);
    }

    function test_constructor_revertsOnZeroDuration() public {
        vm.expectRevert(Genesis.ZeroDuration.selector);
        new Genesis(address(algeba), 0, merkleRoot);
    }

    function test_constructor_revertsOnZeroMerkleRoot() public {
        vm.expectRevert(Genesis.ZeroMerkleRoot.selector);
        new Genesis(address(algeba), DURATION, bytes32(0));
    }

    function test_participate_registersOnce() public {
        _participate(alice);
        assertTrue(genesis.eligible(alice));
        assertEq(genesis.participantCount(), 1);
    }

    function test_participate_revertsOnDoubleRegister() public {
        _participate(alice);
        vm.prank(alice);
        vm.expectRevert(Genesis.AlreadyParticipated.selector);
        genesis.participate(_proofFor(alice));
    }

    function test_participate_revertsAfterWindowCloses() public {
        vm.warp(block.timestamp + DURATION + 1);
        vm.prank(alice);
        vm.expectRevert(Genesis.NotOpen.selector);
        genesis.participate(_proofFor(alice));
    }

    function test_participate_revertsAfterFinalized() public {
        vm.warp(block.timestamp + DURATION + 1);
        genesis.finalize();
        vm.prank(alice);
        vm.expectRevert(Genesis.NotOpen.selector);
        genesis.participate(_proofFor(alice));
    }

    /// @dev AGB-01 (now fixed): a non-whitelisted address cannot register, even
    /// with a well-formed but invalid proof — this is the Sybil-resistance fix.
    function test_participate_revertsIfNotWhitelisted() public {
        vm.prank(outsider);
        vm.expectRevert(Genesis.NotWhitelisted.selector);
        genesis.participate(_proofFor(alice)); // someone else's valid proof, wrong claimant
    }

    function test_participate_revertsWithEmptyProofForNonWhitelisted() public {
        vm.prank(outsider);
        vm.expectRevert(Genesis.NotWhitelisted.selector);
        genesis.participate(new bytes32[](0));
    }

    /// @dev AGB-01 (now fixed): simulates the exact attack the finding described
    /// — one actor spinning up many wallets to capture a disproportionate share.
    /// Every non-whitelisted wallet is rejected; only the 3 pre-approved addresses
    /// can ever register, regardless of how many others the attacker generates.
    function test_sybilAttack_isBlockedByWhitelist() public {
        for (uint256 i = 0; i < 500; i++) {
            address attackerWallet = address(uint160(0x10000 + i));
            vm.prank(attackerWallet);
            vm.expectRevert(Genesis.NotWhitelisted.selector);
            genesis.participate(new bytes32[](0));
        }
        assertEq(genesis.participantCount(), 0);

        _participate(alice);
        _participate(bob);
        _participate(carol);
        assertEq(genesis.participantCount(), 3);
    }

    function test_finalize_revertsBeforeWindowCloses() public {
        vm.expectRevert(Genesis.FinalizationNotReady.selector);
        genesis.finalize();
    }

    function test_finalize_revertsIfAlreadyFinalized() public {
        vm.warp(block.timestamp + DURATION + 1);
        genesis.finalize();
        vm.expectRevert(Genesis.AlreadyFinalized.selector);
        genesis.finalize();
    }

    function test_finalize_isPermissionless() public {
        vm.warp(block.timestamp + DURATION + 1);
        vm.prank(address(0xDEAD));
        genesis.finalize();
        assertTrue(genesis.finalized());
    }

    function test_claim_transfersEqualShare() public {
        _participate(alice);
        _participate(bob);

        vm.warp(block.timestamp + DURATION + 1);
        genesis.finalize();

        uint256 expected = algeba.GENESIS_ALLOCATION() / 2;
        vm.prank(alice);
        genesis.claim();
        assertEq(algeba.balanceOf(alice), expected);

        vm.prank(bob);
        genesis.claim();
        assertEq(algeba.balanceOf(bob), expected);
    }

    function test_claim_revertsIfNotEligible() public {
        vm.warp(block.timestamp + DURATION + 1);
        genesis.finalize();
        vm.prank(outsider);
        vm.expectRevert(Genesis.NotEligible.selector);
        genesis.claim();
    }

    function test_claim_revertsOnDoubleClaim() public {
        _participate(alice);
        vm.warp(block.timestamp + DURATION + 1);
        genesis.finalize();
        vm.prank(alice);
        genesis.claim();
        vm.prank(alice);
        vm.expectRevert(Genesis.AlreadyClaimed.selector);
        genesis.claim();
    }

    function test_claim_revertsBeforeFinalized() public {
        _participate(alice);
        vm.prank(alice);
        vm.expectRevert(Genesis.FinalizationNotReady.selector);
        genesis.claim();
    }

    /// @dev AGB-04: proves the documented rounding-dust behavior in
    /// allocationPerWallet() — the remainder is real and stays unswept.
    function test_dustRemainsPermanentlyUnclaimed() public {
        _participate(alice);
        _participate(bob);
        _participate(carol);
        vm.warp(block.timestamp + DURATION + 1);
        genesis.finalize();

        uint256 per = genesis.allocationPerWallet();
        vm.prank(alice); genesis.claim();
        vm.prank(bob); genesis.claim();
        vm.prank(carol); genesis.claim();

        uint256 dust = algeba.GENESIS_ALLOCATION() - per * 3;
        assertEq(algeba.balanceOf(address(genesis)), dust);
        assertGt(dust, 0);
    }

    function test_allocationOf_and_claimable() public {
        _participate(alice);

        assertEq(genesis.allocationOf(alice), 0);
        assertEq(genesis.claimable(alice), 0);
        assertEq(genesis.allocationOf(bob), 0);

        vm.warp(block.timestamp + DURATION + 1);
        genesis.finalize();

        uint256 expected = algeba.GENESIS_ALLOCATION(); // sole participant gets it all
        assertEq(genesis.allocationOf(alice), expected);
        assertEq(genesis.claimable(alice), expected);
        assertEq(genesis.allocationOf(bob), 0); // bob never registered

        vm.prank(alice);
        genesis.claim();
        assertEq(genesis.claimable(alice), 0);
        assertEq(genesis.allocationOf(alice), expected);
    }

    function test_status_reflectsPhase() public {
        (bool openBefore, bool doneBefore,, uint256 participantsBefore) = genesis.status();
        assertTrue(openBefore);
        assertFalse(doneBefore);
        assertEq(participantsBefore, 0);

        vm.warp(block.timestamp + DURATION + 1);
        (bool openAfter,,,) = genesis.status();
        assertFalse(openAfter);
    }

    function testFuzz_allocationPerWallet_neverExceedsGenesisAllocation(uint8 n) public {
        n = uint8(bound(n, 1, 21));

        address[] memory list = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            list[i] = address(uint160(0x3000 + i));
        }
        (bytes32 root, bytes32[][] memory listProofs) = FfiMerkleTree.build(list);

        ALGEBA freshAlgeba = new ALGEBA(address(this));
        Genesis g = new Genesis(address(freshAlgeba), DURATION, root);
        freshAlgeba.transfer(address(g), freshAlgeba.GENESIS_ALLOCATION());

        for (uint256 i = 0; i < n; i++) {
            vm.prank(list[i]);
            g.participate(listProofs[i]);
        }
        vm.warp(block.timestamp + DURATION + 1);
        g.finalize();

        uint256 per = g.allocationPerWallet();
        assertLe(per * n, algeba.GENESIS_ALLOCATION());
    }
}
