// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ALGEBA} from "../ALGEBA.sol";
import {Genesis} from "../Genesis.sol";
import {Staking} from "../Staking.sol";
import {FfiMerkleTree} from "./helpers/FfiMerkleTree.sol";

contract StakingTest is Test {
    ALGEBA algeba;
    Genesis genesis;
    Staking staking;

    uint256 constant DURATION = 7 days;
    uint256 constant HALVING_PERIOD = 1000;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        algeba = new ALGEBA(address(this));

        address[] memory whitelist = new address[](2);
        whitelist[0] = alice;
        whitelist[1] = bob;
        (bytes32 root, bytes32[][] memory proofs) = FfiMerkleTree.build(whitelist);

        genesis = new Genesis(address(algeba), DURATION, root);
        algeba.transfer(address(genesis), algeba.GENESIS_ALLOCATION());

        vm.prank(alice);
        genesis.participate(proofs[0]);
        vm.prank(bob);
        genesis.participate(proofs[1]);

        vm.warp(block.timestamp + DURATION + 1);
        genesis.finalize();

        vm.prank(alice);
        genesis.claim();
        vm.prank(bob);
        genesis.claim();
        // alice and bob now each hold GENESIS_ALLOCATION / 2 AGB (25 ether) to stake.

        staking = new Staking(address(algeba), address(genesis), HALVING_PERIOD);
        algeba.setStaking(address(staking));
    }

    function _stake(address who, uint256 amount) internal {
        vm.startPrank(who);
        algeba.approve(address(staking), amount);
        staking.stake(amount);
        vm.stopPrank();
    }

    function test_constructor_revertsOnZeroAddresses() public {
        vm.expectRevert(bytes("zero address"));
        new Staking(address(0), address(genesis), HALVING_PERIOD);
        vm.expectRevert(bytes("zero address"));
        new Staking(address(algeba), address(0), HALVING_PERIOD);
    }

    function test_constructor_revertsOnZeroHalvingPeriod() public {
        vm.expectRevert(Staking.InvalidHalvingPeriod.selector);
        new Staking(address(algeba), address(genesis), 0);
    }

    function test_stake_revertsBeforeGenesisFinalized() public {
        Genesis freshGenesis = new Genesis(address(algeba), DURATION, bytes32(uint256(1)));
        Staking freshStaking = new Staking(address(algeba), address(freshGenesis), HALVING_PERIOD);

        vm.startPrank(alice);
        algeba.approve(address(freshStaking), 1 ether);
        vm.expectRevert(Staking.GenesisNotFinalized.selector);
        freshStaking.stake(1 ether);
        vm.stopPrank();
    }

    function test_stake_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(Staking.ZeroAmount.selector);
        staking.stake(0);
    }

    function test_stake_startsEmissionOnFirstStake() public {
        assertEq(staking.startTime(), 0);
        _stake(alice, 10 ether);
        assertEq(staking.startTime(), block.timestamp);
        assertEq(staking.totalStaked(), 10 ether);
    }

    function test_stake_soleStakerAccruesFullEmission() public {
        _stake(alice, 10 ether);
        uint256 secondsElapsed = 100;
        vm.warp(block.timestamp + secondsElapsed);

        uint256 expected = staking.currentEmissionPerSecond() * secondsElapsed;
        assertApproxEqAbs(staking.pendingReward(alice), expected, 1e6);
    }

    function test_claim_mintsExactPendingReward() public {
        _stake(alice, 10 ether);
        vm.warp(block.timestamp + 100);

        uint256 pending = staking.pendingReward(alice);
        assertGt(pending, 0);

        vm.prank(alice);
        uint256 reward = staking.claim();
        assertEq(reward, pending);
        assertEq(algeba.balanceOf(alice), 25 ether - 10 ether + pending);
    }

    function test_claim_revertsIfNoReward() public {
        _stake(alice, 10 ether);
        vm.prank(alice);
        vm.expectRevert(Staking.NoReward.selector);
        staking.claim();
    }

    function test_compound_increasesStakeByReward() public {
        _stake(alice, 10 ether);
        vm.warp(block.timestamp + 100);

        uint256 pending = staking.pendingReward(alice);
        vm.prank(alice);
        uint256 reward = staking.compound();

        assertEq(reward, pending);
        (uint256 amount,,) = staking.users(alice);
        assertEq(amount, 10 ether + pending);
        assertEq(staking.totalStaked(), 10 ether + pending);
    }

    function test_unstake_returnsPrincipalAndProportionalReward() public {
        _stake(alice, 10 ether);
        vm.warp(block.timestamp + 100);

        uint256 pending = staking.pendingReward(alice);
        uint256 balBefore = algeba.balanceOf(alice);

        vm.prank(alice);
        uint256 reward = staking.unstake(10 ether);

        assertEq(reward, pending);
        assertEq(algeba.balanceOf(alice), balBefore + 10 ether + reward);
        (uint256 amount,,) = staking.users(alice);
        assertEq(amount, 0);
        assertEq(staking.totalStaked(), 0);
    }

    function test_unstake_revertsOnZeroAmount() public {
        _stake(alice, 10 ether);
        vm.prank(alice);
        vm.expectRevert(Staking.ZeroAmount.selector);
        staking.unstake(0);
    }

    function test_unstake_revertsIfExceedsStake() public {
        _stake(alice, 10 ether);
        vm.prank(alice);
        vm.expectRevert(Staking.InsufficientStake.selector);
        staking.unstake(11 ether);
    }

    function test_unstake_partial_keepsRemainderAndPendingRewards() public {
        _stake(alice, 10 ether);
        vm.warp(block.timestamp + 100);

        vm.prank(alice);
        staking.unstake(4 ether);

        (uint256 amount,,) = staking.users(alice);
        assertEq(amount, 6 ether);
        assertEq(staking.totalStaked(), 6 ether);
    }

    function test_twoStakers_splitEmissionProportionally() public {
        _stake(alice, 10 ether);
        _stake(bob, 10 ether);
        vm.warp(block.timestamp + 100);

        uint256 alicePending = staking.pendingReward(alice);
        uint256 bobPending = staking.pendingReward(bob);
        assertApproxEqAbs(alicePending, bobPending, 1e6);
    }

    function test_currentEpoch_andHalving_matchesTimeSchedule() public {
        _stake(alice, 10 ether);
        assertEq(staking.currentEpoch(), 0);

        vm.warp(block.timestamp + HALVING_PERIOD);
        assertEq(staking.currentEpoch(), 1);
        assertEq(staking.currentEmissionPerSecond(), (staking.FIRST_EPOCH_EMISSION() >> 1) / HALVING_PERIOD);
    }

    function test_emissionBetween_neverExceedsTotalEmissionCap() public {
        _stake(alice, 10 ether);
        // Warp far enough to span many halving epochs in one jump.
        vm.warp(block.timestamp + HALVING_PERIOD * 300);
        vm.prank(alice);
        staking.claim();
        assertLe(staking.totalEmitted(), staking.TOTAL_EMISSION());
    }

    function test_idlePeriodsAreNotRetroactivelyCredited() public {
        _stake(alice, 10 ether);
        vm.prank(alice);
        staking.unstake(10 ether);

        vm.warp(block.timestamp + 1000);
        // Nobody staked during this gap: emission should not have accrued for it.
        _stake(bob, 10 ether);
        assertEq(staking.pendingReward(bob), 0);
    }

    function test_viewFunctions_directlyCallable() public {
        _stake(alice, 10 ether);
        vm.warp(block.timestamp + 10);

        assertGt(staking.previewIndex(), 0);
        assertGt(staking.emittedSupply(), 0);
        assertEq(staking.nextHalvingTime(), staking.startTime() + HALVING_PERIOD);
        assertGt(staking.emissionBetween(staking.startTime(), block.timestamp), 0);
        assertEq(staking.emissionBetween(block.timestamp, block.timestamp), 0);
        assertEq(staking.emissionBetween(10, 5), 0);
    }

    function test_viewFunctions_beforeAnyStake_returnZero() public view {
        assertEq(staking.currentEpoch(), 0);
        assertEq(staking.currentEmissionPerSecond(), 0);
        assertEq(staking.nextHalvingTime(), 0);
        assertEq(staking.previewIndex(), 0);
    }

    /// @dev emissionBetween clamps fromTime up to startTime when a caller passes
    /// something earlier — no emission is retroactively counted before staking began.
    function test_emissionBetween_clampsFromTimeBeforeStart() public {
        _stake(alice, 10 ether);
        vm.warp(block.timestamp + 100);
        assertEq(
            staking.emissionBetween(0, block.timestamp),
            staking.emissionBetween(staking.startTime(), block.timestamp)
        );
    }

    /// @dev A single emissionBetween() call spanning many halving epochs in one
    /// jump must still cap at TOTAL_EMISSION. In practice this exits via the
    /// `total >= remaining` early return (the halving series converges on
    /// TOTAL_EMISSION well before epoch ~87, where epochEmission would first hit
    /// zero from bit-shifting) — that convergence-based exit, not the epoch-count
    /// or zero-emission break conditions, is what's actually reachable here given
    /// current constants.
    function test_emissionBetween_stopsOnceEpochEmissionDecaysToZero() public {
        _stake(alice, 10 ether);
        uint256 farFuture = staking.startTime() + 90 * HALVING_PERIOD;
        uint256 total = staking.emissionBetween(staking.startTime(), farFuture);
        assertLe(total, staking.TOTAL_EMISSION());
    }

    function test_currentEmissionPerSecond_zeroPastMaxEpochs() public {
        _stake(alice, 10 ether);
        vm.warp(block.timestamp + (staking.MAX_EPOCHS()) * HALVING_PERIOD);
        assertEq(staking.currentEmissionPerSecond(), 0);
    }

    /// @dev Once totalEmitted has fully converged on TOTAL_EMISSION, previewIndex
    /// must stop advancing the index even though time keeps passing.
    function test_previewIndex_flatAfterEmissionFullyExhausted() public {
        _stake(alice, 10 ether);
        vm.warp(block.timestamp + 90 * HALVING_PERIOD);
        vm.prank(alice);
        staking.claim(); // forces _update(), converging totalEmitted to the cap

        assertEq(staking.totalEmitted(), staking.TOTAL_EMISSION());
        uint256 indexBefore = staking.previewIndex();
        vm.warp(block.timestamp + 1000);
        assertEq(staking.previewIndex(), indexBefore);
    }

    function testFuzz_stakeAndUnstake_conservesPrincipal(uint256 amount) public {
        uint256 bal = algeba.balanceOf(alice);
        amount = bound(amount, staking.MIN_STAKE(), bal);

        _stake(alice, amount);
        vm.warp(block.timestamp + 50);

        vm.prank(alice);
        staking.unstake(amount);

        (uint256 remaining,,) = staking.users(alice);
        assertEq(remaining, 0);
        assertGe(algeba.balanceOf(alice), bal - amount);
    }

    /// @dev Regression test for a claimed bug: that partial unstake() leaves a
    /// stale rewardDebt (computed from the pre-decrement principal), causing
    /// underflow or reward loss on the next _settle(). It does not —
    /// u.rewardDebt is recomputed using u.amount AFTER it's decremented
    /// (Staking.sol's unstake(), rewardDebt line runs after the amount
    /// decrement). Proven here with concrete numbers across two settle rounds.
    function test_partialUnstake_thenMoreRewardAccrues_noUnderflowNoLoss() public {
        _stake(alice, 15 ether);
        vm.warp(block.timestamp + 100);

        uint256 pendingBeforePartial = staking.pendingReward(alice);
        assertGt(pendingBeforePartial, 0);

        vm.prank(alice);
        uint256 rewardFromUnstake = staking.unstake(6 ether); // 15 -> 9, sole staker throughout
        assertEq(rewardFromUnstake, pendingBeforePartial * 6 / 15);

        (uint256 amountAfter,, uint256 leftoverRewards) = staking.users(alice);
        assertEq(amountAfter, 9 ether);
        assertEq(leftoverRewards, pendingBeforePartial - rewardFromUnstake);

        vm.warp(block.timestamp + 100);
        uint256 pendingAfter = staking.pendingReward(alice); // must not revert/underflow
        assertGt(pendingAfter, 0);

        vm.prank(alice);
        uint256 claimed = staking.claim(); // must not revert either
        assertEq(claimed, pendingAfter);
        // Sole staker throughout: leftover from before + a full second window's
        // emission (her absolute stake size doesn't matter when she's the only
        // one), within a wei or two of integer-division dust.
        assertApproxEqAbs(claimed, leftoverRewards + staking.currentEmissionPerSecond() * 100, 2);
    }

    /// @dev Same claim, with a second staker present, so accounting must stay
    /// correct under a shared, changing totalStaked — not just the sole-staker
    /// case above.
    function test_partialUnstake_withOtherStakerPresent_noDriftInTotals() public {
        _stake(alice, 15 ether);
        _stake(bob, 10 ether);
        vm.warp(block.timestamp + 100);

        vm.prank(alice);
        staking.unstake(6 ether); // alice: 15 -> 9

        vm.warp(block.timestamp + 100);

        vm.prank(alice);
        staking.claim();
        vm.prank(bob);
        staking.claim();

        // Global invariant, independent of any per-user math: total minted as
        // staking rewards must equal total emitted by the schedule so far,
        // within a few wei of integer-division dust (expected, not a bug —
        // same benign category as Genesis's documented rounding dust).
        assertApproxEqAbs(algeba.stakingMinted(), staking.totalEmitted(), 10);

        (uint256 aliceAmount,,) = staking.users(alice);
        (uint256 bobAmount,,) = staking.users(bob);
        assertEq(aliceAmount + bobAmount, staking.totalStaked());
        assertEq(aliceAmount, 9 ether);
        assertEq(bobAmount, 10 ether);
    }

    // ---------------------------------------------------------------------
    // AGB-05: minimum position size (dust-stake index inflation)
    // ---------------------------------------------------------------------

    function test_stake_revertsBelowMinimum() public {
        uint256 justUnder = staking.MIN_STAKE() - 1;
        vm.startPrank(alice);
        algeba.approve(address(staking), type(uint256).max);
        vm.expectRevert(Staking.BelowMinimumStake.selector);
        staking.stake(1);
        vm.expectRevert(Staking.BelowMinimumStake.selector);
        staking.stake(justUnder);
        vm.stopPrank();
    }

    function test_stake_smallTopUpAllowedOnceAboveMinimum() public {
        _stake(alice, 1 ether);
        _stake(alice, 1); // position stays >= MIN_STAKE, so any top-up is fine
        (uint256 amount,,) = staking.users(alice);
        assertEq(amount, 1 ether + 1);
    }

    function test_unstake_revertsIfItWouldLeaveDust() public {
        _stake(alice, 2 ether);
        vm.prank(alice);
        vm.expectRevert(Staking.BelowMinimumStake.selector);
        staking.unstake(1.5 ether); // would leave 0.5 AGB

        vm.prank(alice);
        staking.unstake(1 ether); // leaves exactly MIN_STAKE: allowed
        vm.prank(alice);
        staking.unstake(1 ether); // full exit to zero: allowed
        (uint256 amount,,) = staking.users(alice);
        assertEq(amount, 0);
    }

    /// @dev Regression for the dust-stake attack. The worst case the fix allows
    /// is a sole staker sitting at exactly MIN_STAKE for the entire emission
    /// schedule, which maximizes accRewardPerShare. Even then, the largest
    /// position that can realistically exist (everything ever minted) must still
    /// be stakeable, readable, and withdrawable without overflow.
    function test_dustAttack_worstCaseIndexCannotBrickLargePositions() public {
        _stake(alice, staking.MIN_STAKE());
        vm.warp(block.timestamp + HALVING_PERIOD * 300); // far past schedule end
        vm.prank(alice);
        staking.claim();

        assertEq(staking.totalEmitted(), staking.TOTAL_EMISSION());
        assertLe(
            staking.accRewardPerShare(),
            staking.TOTAL_EMISSION() * staking.PRECISION() / staking.MIN_STAKE()
        );

        uint256 everything = algeba.balanceOf(alice); // ~all of TOTAL_EMISSION
        assertGt(everything, 200_000_000 ether);
        _stake(alice, everything);
        _stake(bob, 10 ether);

        staking.pendingReward(alice); // views must not overflow either
        (uint256 aliceAmount,,) = staking.users(alice);
        vm.prank(alice);
        staking.unstake(aliceAmount);
        (aliceAmount,,) = staking.users(alice);
        assertEq(aliceAmount, 0);
    }

    // ---------------------------------------------------------------------
    // AGB-06: principal-only emergency exit
    // ---------------------------------------------------------------------

    function test_emergencyWithdraw_returnsPrincipalAndForfeitsRewards() public {
        _stake(alice, 10 ether);
        vm.warp(block.timestamp + 100);
        assertGt(staking.pendingReward(alice), 0);

        uint256 balBefore = algeba.balanceOf(alice);
        uint256 mintedBefore = algeba.stakingMinted();

        vm.prank(alice);
        staking.emergencyWithdraw();

        assertEq(algeba.balanceOf(alice), balBefore + 10 ether);
        assertEq(algeba.stakingMinted(), mintedBefore); // never touches minting
        (uint256 amount, uint256 debt, uint256 rewards) = staking.users(alice);
        assertEq(amount, 0);
        assertEq(debt, 0);
        assertEq(rewards, 0);
        assertEq(staking.totalStaked(), 0);
    }

    function test_emergencyWithdraw_revertsWithoutPosition() public {
        vm.prank(alice);
        vm.expectRevert(Staking.InsufficientStake.selector);
        staking.emergencyWithdraw();
    }

    function test_emergencyWithdraw_remainingStakersKeepConsistentAccounting() public {
        _stake(alice, 10 ether);
        _stake(bob, 10 ether);
        vm.warp(block.timestamp + 100);

        vm.prank(alice);
        staking.emergencyWithdraw();
        vm.warp(block.timestamp + 100);

        vm.prank(bob);
        staking.claim();
        assertLe(algeba.stakingMinted(), staking.totalEmitted()); // forfeits only under-mint
        (uint256 bobAmount,,) = staking.users(bob);
        assertEq(bobAmount, staking.totalStaked());
        assertEq(algeba.balanceOf(address(staking)), staking.totalStaked());
    }

    // ---------------------------------------------------------------------
    // Timestamp-based schedule: halvings follow elapsed time, not block count
    // ---------------------------------------------------------------------

    /// @dev Simulates Ethereum changing its block time: a huge number of blocks
    /// with no time passing must accrue nothing and must not advance the epoch.
    function test_schedule_ignoresBlockCount() public {
        _stake(alice, 10 ether);
        uint256 epochBefore = staking.currentEpoch();

        vm.roll(block.number + HALVING_PERIOD * 50); // many blocks, zero seconds
        assertEq(staking.pendingReward(alice), 0);
        assertEq(staking.currentEpoch(), epochBefore);
        assertEq(staking.nextHalvingTime(), staking.startTime() + HALVING_PERIOD);
    }

    /// @dev The inverse: time passing with no new blocks produced (e.g. missed
    /// slots) still accrues exactly the scheduled emission for that time.
    function test_schedule_followsElapsedTimeOnly() public {
        _stake(alice, 10 ether);
        vm.warp(block.timestamp + 250); // time passes, block number unchanged
        uint256 expected = staking.FIRST_EPOCH_EMISSION() * 250 / HALVING_PERIOD;
        assertApproxEqAbs(staking.pendingReward(alice), expected, 1e6);
    }

    /// @dev Each halving lands exactly HALVING_PERIOD seconds after the previous
    /// one, measured from the first stake, for many consecutive epochs.
    function test_schedule_halvingsLandExactlyOnPeriodBoundaries() public {
        _stake(alice, 10 ether);
        uint256 start = staking.startTime();
        for (uint256 epoch = 0; epoch < 10; epoch++) {
            vm.warp(start + epoch * HALVING_PERIOD + HALVING_PERIOD - 1);
            assertEq(staking.currentEpoch(), epoch);
            assertEq(staking.currentEmissionPerSecond(), (staking.FIRST_EPOCH_EMISSION() >> epoch) / HALVING_PERIOD);
            vm.warp(start + (epoch + 1) * HALVING_PERIOD);
            assertEq(staking.currentEpoch(), epoch + 1);
            assertEq(staking.nextHalvingTime(), start + (epoch + 2) * HALVING_PERIOD);
        }
    }

    /// @dev Real deployment value: 4 years in seconds. A full uninterrupted first
    /// epoch emits exactly FIRST_EPOCH_EMISSION (to within integer rounding).
    function test_schedule_realFourYearPeriod_firstEpochEmitsExpectedTotal() public {
        uint256 fourYears = 126_230_400; // 4 * 365.25 days
        Staking realStaking = new Staking(address(algeba), address(genesis), fourYears);
        vm.startPrank(alice);
        algeba.approve(address(realStaking), 10 ether);
        realStaking.stake(10 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + fourYears);
        assertEq(realStaking.currentEpoch(), 1);
        assertApproxEqAbs(
            realStaking.emissionBetween(realStaking.startTime(), block.timestamp),
            realStaking.FIRST_EPOCH_EMISSION(),
            1
        );
    }
}
