// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ALGEBA} from "../ALGEBA.sol";
import {Genesis} from "../Genesis.sol";
import {Staking} from "../Staking.sol";
import {FfiMerkleTree} from "./helpers/FfiMerkleTree.sol";

/// @dev AGB-06 regression. Runs 40 full-lifetime scenarios (5 stakers mixing
/// stake / compound / partial unstake / claim with odd amounts) all the way past
/// emission exhaustion, then has every staker fully exit. Before the fix, about
/// half of these scenarios ended with owed rewards a few wei above the mint cap
/// and one staker's principal permanently stuck.
contract StakingEndOfLifeTest is Test {
    address[] users;
    bytes32 root;
    bytes32[][] proofs;

    function setUp() public {
        users = new address[](5);
        for (uint256 i = 0; i < 5; i++) users[i] = address(uint160(0xA000 + i));
        (root, proofs) = FfiMerkleTree.build(users);
    }

    function _deploy() internal returns (ALGEBA algeba, Staking staking) {
        algeba = new ALGEBA(address(this));
        Genesis genesis = new Genesis(address(algeba), 1, root);
        algeba.transfer(address(genesis), algeba.GENESIS_ALLOCATION());
        for (uint256 i = 0; i < users.length; i++) {
            vm.prank(users[i]);
            genesis.participate(proofs[i]);
        }
        vm.warp(block.timestamp + 2);
        genesis.finalize();
        for (uint256 i = 0; i < users.length; i++) {
            vm.prank(users[i]);
            genesis.claim();
        }
        staking = new Staking(address(algeba), address(genesis), 37);
        algeba.setStaking(address(staking));
        for (uint256 i = 0; i < users.length; i++) {
            vm.prank(users[i]);
            algeba.approve(address(staking), type(uint256).max);
        }
    }

    function test_endOfEmission_everyStakerCanAlwaysExit() public {
        uint256 scenariosWhereOwedExceededMintable;

        for (uint256 s = 0; s < 40; s++) {
            (ALGEBA algeba, Staking staking) = _deploy();

            for (uint256 r = 0; r < 40; r++) {
                for (uint256 i = 0; i < users.length; i++) {
                    address u = users[i];
                    uint256 action = (r * 7 + i * 13 + s * 3) % 4;
                    vm.startPrank(u);
                    if (action == 0) {
                        uint256 amt = 1 ether + ((s + 1) * (r + 3) * (i + 5) * 1_000_003_331) % 1 ether;
                        if (algeba.balanceOf(u) >= amt) try staking.stake(amt) {} catch {}
                    } else if (action == 1) {
                        try staking.compound() {} catch {}
                    } else if (action == 2) {
                        (uint256 a,,) = staking.users(u);
                        if (a > 2 ether) try staking.unstake(a / 3 + s + r) {} catch {}
                    } else {
                        try staking.claim() {} catch {}
                    }
                    vm.stopPrank();
                }
                vm.warp(block.timestamp + 3 + ((r + s) % 5));
            }

            vm.warp(block.timestamp + 100_000); // far past the end of the schedule
            vm.prank(users[0]);
            try staking.claim() {} catch {}

            uint256 owed;
            for (uint256 i = 0; i < users.length; i++) owed += staking.pendingReward(users[i]);
            if (owed > algeba.remainingStakingEmission()) scenariosWhereOwedExceededMintable++;

            for (uint256 i = 0; i < users.length; i++) {
                (uint256 a,,) = staking.users(users[i]);
                if (a == 0) continue;
                vm.prank(users[i]);
                staking.unstake(a); // must never revert
            }

            assertEq(staking.totalStaked(), 0);
            assertLe(algeba.stakingMinted(), algeba.STAKING_ALLOCATION());
            assertLe(algeba.totalSupply(), algeba.MAX_SUPPLY());
        }

        // Proves the scenarios actually hit the pre-fix failure condition, so a
        // pass here means the cap-to-mintable fix handled it, not that the
        // condition simply never occurred.
        assertGt(scenariosWhereOwedExceededMintable, 0);
    }
}
