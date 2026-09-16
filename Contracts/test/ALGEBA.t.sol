// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ALGEBA} from "../ALGEBA.sol";

contract ALGEBATest is Test {
    ALGEBA algeba;
    address holder = address(0xA11CE);
    address staking = address(0x57A11);
    address user = address(0xBEEF);

    function setUp() public {
        algeba = new ALGEBA(holder);
    }

    function test_constructor_mintsGenesisAllocationToHolder() public view {
        assertEq(algeba.balanceOf(holder), algeba.GENESIS_ALLOCATION());
        assertEq(algeba.totalSupply(), algeba.GENESIS_ALLOCATION());
    }

    function test_constructor_revertsOnZeroHolder() public {
        vm.expectRevert(ALGEBA.InvalidAddress.selector);
        new ALGEBA(address(0));
    }

    function test_setStaking_setsOnce() public {
        algeba.setStaking(staking);
        assertEq(algeba.staking(), staking);
    }

    function test_setStaking_revertsIfAlreadySet() public {
        algeba.setStaking(staking);
        vm.expectRevert(ALGEBA.StakingAlreadySet.selector);
        algeba.setStaking(address(0xDEAD));
    }

    function test_setStaking_revertsOnZeroAddress() public {
        vm.expectRevert(ALGEBA.InvalidAddress.selector);
        algeba.setStaking(address(0));
    }

    function test_setStaking_revertsIfNotOwner() public {
        vm.prank(user);
        vm.expectRevert();
        algeba.setStaking(staking);
    }

    function test_mintStakingReward_onlyStaking() public {
        algeba.setStaking(staking);
        vm.prank(user);
        vm.expectRevert(ALGEBA.OnlyStaking.selector);
        algeba.mintStakingReward(user, 1 ether);
    }

    function test_mintStakingReward_mintsAndTracks() public {
        algeba.setStaking(staking);
        vm.prank(staking);
        algeba.mintStakingReward(user, 100 ether);
        assertEq(algeba.balanceOf(user), 100 ether);
        assertEq(algeba.stakingMinted(), 100 ether);
        assertEq(algeba.remainingStakingEmission(), algeba.STAKING_ALLOCATION() - 100 ether);
    }

    function test_mintStakingReward_revertsPastStakingAllocation() public {
        algeba.setStaking(staking);
        uint256 overCap = algeba.STAKING_ALLOCATION() + 1;
        vm.prank(staking);
        vm.expectRevert(ALGEBA.CapExceeded.selector);
        algeba.mintStakingReward(user, overCap);
    }

    function test_mintStakingReward_neverExceedsMaxSupply() public {
        algeba.setStaking(staking);
        uint256 fullAllocation = algeba.STAKING_ALLOCATION();
        vm.prank(staking);
        algeba.mintStakingReward(user, fullAllocation);
        assertEq(algeba.totalSupply(), algeba.MAX_SUPPLY());

        vm.prank(staking);
        vm.expectRevert(ALGEBA.CapExceeded.selector);
        algeba.mintStakingReward(user, 1);
    }

    function test_emittedSupply_beforeStakingSet_returnsGenesisAllocation() public view {
        assertEq(algeba.emittedSupply(), algeba.GENESIS_ALLOCATION());
    }

    function testFuzz_mintStakingReward_neverExceedsEitherCap(uint256 amount) public {
        algeba.setStaking(staking);
        amount = bound(amount, 0, algeba.MAX_SUPPLY());
        uint256 stakingAllocation = algeba.STAKING_ALLOCATION();

        if (amount > stakingAllocation) {
            vm.prank(staking);
            vm.expectRevert(ALGEBA.CapExceeded.selector);
            algeba.mintStakingReward(user, amount);
        } else {
            vm.prank(staking);
            algeba.mintStakingReward(user, amount);
            assertLe(algeba.totalSupply(), algeba.MAX_SUPPLY());
            assertLe(algeba.stakingMinted(), stakingAllocation);
        }
    }
}
