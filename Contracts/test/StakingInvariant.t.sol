// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ALGEBA} from "../ALGEBA.sol";
import {Genesis} from "../Genesis.sol";
import {Staking} from "../Staking.sol";
import {FfiMerkleTree} from "./helpers/FfiMerkleTree.sol";

/// @dev Stateful-fuzzing handler: the invariant runner calls these functions in
/// random sequences with random arguments, then checks the invariants below still
/// hold after every call. Reverts from the contract under test are expected and
/// swallowed here (e.g. staking 0, unstaking more than you have) — the point is
/// to keep the sequence going, not to avoid every revert.
contract StakingInvariantHandler is Test {
    ALGEBA public algeba;
    Genesis public genesis;
    Staking public staking;
    address[] public actors;

    constructor(ALGEBA _algeba, Genesis _genesis, Staking _staking, address[] memory _actors) {
        algeba = _algeba;
        genesis = _genesis;
        staking = _staking;
        actors = _actors;
    }

    // Exits are never allowed to fail silently: a full unstake or emergency
    // withdraw of an existing position has no legitimate reason to revert, so
    // any revert is recorded and fails invariant_exitsNeverRevert.
    uint256 public exitFailures;

    function stake(uint256 actorSeed, uint256 amount) public {
        address who = actors[actorSeed % actors.length];
        uint256 bal = algeba.balanceOf(who);
        (uint256 staked,,) = staking.users(who);
        uint256 minAmount = staked == 0 ? staking.MIN_STAKE() : 1;
        if (bal < minAmount) return;
        amount = bound(amount, minAmount, bal);
        vm.startPrank(who);
        algeba.approve(address(staking), amount);
        try staking.stake(amount) {} catch {}
        vm.stopPrank();
    }

    function unstake(uint256 actorSeed, uint256 amount) public {
        address who = actors[actorSeed % actors.length];
        (uint256 staked,,) = staking.users(who);
        if (staked == 0) return;
        amount = bound(amount, 1, staked);
        uint256 remaining = staked - amount;
        if (remaining != 0 && remaining < staking.MIN_STAKE()) amount = staked;
        vm.startPrank(who);
        try staking.unstake(amount) {} catch {
            if (amount == staked) exitFailures++;
        }
        vm.stopPrank();
    }

    function emergencyWithdraw(uint256 actorSeed) public {
        address who = actors[actorSeed % actors.length];
        (uint256 staked,,) = staking.users(who);
        if (staked == 0) return;
        vm.startPrank(who);
        try staking.emergencyWithdraw() {} catch {
            exitFailures++;
        }
        vm.stopPrank();
    }

    function claim(uint256 actorSeed) public {
        address who = actors[actorSeed % actors.length];
        vm.startPrank(who);
        try staking.claim() {} catch {}
        vm.stopPrank();
    }

    function compound(uint256 actorSeed) public {
        address who = actors[actorSeed % actors.length];
        vm.startPrank(who);
        try staking.compound() {} catch {}
        vm.stopPrank();
    }

    function warpTime(uint256 seconds_) public {
        seconds_ = bound(seconds_, 1, 5000);
        vm.warp(block.timestamp + seconds_);
    }

    function actorCount() public view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) public view returns (address) {
        return actors[i];
    }
}

contract StakingInvariantTest is Test {
    ALGEBA algeba;
    Genesis genesis;
    Staking staking;
    StakingInvariantHandler handler;
    address[] actors;

    function setUp() public {
        algeba = new ALGEBA(address(this));

        address[] memory whitelist = new address[](5);
        for (uint256 i = 0; i < 5; i++) {
            whitelist[i] = address(uint160(0x9000 + i));
        }
        (bytes32 root, bytes32[][] memory proofs) = FfiMerkleTree.build(whitelist);

        genesis = new Genesis(address(algeba), 1, root);
        algeba.transfer(address(genesis), algeba.GENESIS_ALLOCATION());

        for (uint256 i = 0; i < 5; i++) {
            actors.push(whitelist[i]);
            vm.prank(whitelist[i]);
            genesis.participate(proofs[i]);
        }

        vm.warp(block.timestamp + 2);
        genesis.finalize();
        for (uint256 i = 0; i < actors.length; i++) {
            vm.prank(actors[i]);
            genesis.claim();
        }

        staking = new Staking(address(algeba), address(genesis), 500);
        algeba.setStaking(address(staking));

        handler = new StakingInvariantHandler(algeba, genesis, staking, actors);
        targetContract(address(handler));
    }

    /// @dev Sum of every user's recorded stake must always equal totalStaked —
    /// no accounting drift across any sequence of stake/unstake/compound calls.
    function invariant_totalStakedMatchesSumOfUsers() public view {
        uint256 sum;
        for (uint256 i = 0; i < handler.actorCount(); i++) {
            (uint256 amount,,) = staking.users(handler.actorAt(i));
            sum += amount;
        }
        assertEq(sum, staking.totalStaked());
    }

    /// @dev The contract must always hold enough AGB to cover every staker's
    /// principal — it can never become insolvent for what users are owed back.
    function invariant_contractSolventForPrincipal() public view {
        assertGe(algeba.balanceOf(address(staking)), staking.totalStaked());
    }

    /// @dev The halving schedule's cumulative emission can never exceed the
    /// contract's own hard cap, regardless of how staking/unstaking is timed.
    function invariant_totalEmittedNeverExceedsCap() public view {
        assertLe(staking.totalEmitted(), staking.TOTAL_EMISSION());
    }

    /// @dev ALGEBA's own hard cap must hold regardless of what Staking does.
    function invariant_algebaSupplyNeverExceedsMaxSupply() public view {
        assertLe(algeba.totalSupply(), algeba.MAX_SUPPLY());
    }

    /// @dev AGB-05: no position can ever sit between 0 and MIN_STAKE, which is
    /// what keeps accRewardPerShare bounded for the contract's whole life.
    function invariant_positionsAreZeroOrAboveMinimum() public view {
        for (uint256 i = 0; i < handler.actorCount(); i++) {
            (uint256 amount,,) = staking.users(handler.actorAt(i));
            assertTrue(amount == 0 || amount >= staking.MIN_STAKE());
        }
    }

    /// @dev AGB-06: a staker can always get their principal back, via a full
    /// unstake or the emergency exit, at any point in any random sequence.
    function invariant_exitsNeverRevert() public view {
        assertEq(handler.exitFailures(), 0);
    }
}
