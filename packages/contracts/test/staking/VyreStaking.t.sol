// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { VyreStaking } from "../../src/tokens/defi/VyreStaking.sol";
import { MockToken } from "../../src/mocks/MockToken.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract VyreStakingTest is Test {
    using SafeERC20 for IERC20;
    VyreStaking staking;
    MockToken stakingToken;
    MockToken rewardsToken;

    address owner = address(this);
    address alice = address(0x1);
    address bob = address(0x2);
    address carol = address(0x3);

    uint256 constant REWARD_AMOUNT = 1_000_000e18;
    uint256 constant INITIAL_STAKE = 100e18;

    function setUp() public {
        stakingToken = new MockToken("LP Token", "LP");
        rewardsToken = new MockToken("Reward Chip", "CHIP");

        staking = new VyreStaking(owner, address(rewardsToken), address(stakingToken));

        // Fund staking contract with rewards
        IERC20(address(rewardsToken)).safeTransfer(address(staking), REWARD_AMOUNT);

        // Fund users with staking tokens
        IERC20(address(stakingToken)).safeTransfer(alice, 1000e18);
        IERC20(address(stakingToken)).safeTransfer(bob, 1000e18);
        IERC20(address(stakingToken)).safeTransfer(carol, 1000e18);

        vm.label(address(staking), "Staking");
        vm.label(address(stakingToken), "StakingToken");
        vm.label(address(rewardsToken), "RewardsToken");
        vm.label(alice, "Alice");
        vm.label(bob, "Bob");
        vm.label(carol, "Carol");
    }

    // ==================== INITIAL STATE ====================

    function test_InitialState() public view {
        assertEq(address(staking.stakingToken()), address(stakingToken));
        assertEq(address(staking.rewardsToken()), address(rewardsToken));
        assertEq(staking.owner(), owner);
        assertEq(staking.rewardsDuration(), 7 days);
    }

    // ==================== STAKE ====================

    function test_Stake() public {
        _notifyReward(REWARD_AMOUNT);

        vm.startPrank(alice);
        stakingToken.approve(address(staking), INITIAL_STAKE);
        staking.stake(INITIAL_STAKE);
        vm.stopPrank();

        assertEq(staking.balanceOf(alice), INITIAL_STAKE);
        assertEq(staking.totalSupply(), INITIAL_STAKE);
    }

    function test_StakeZero() public {
        _notifyReward(REWARD_AMOUNT);

        vm.startPrank(alice);
        stakingToken.approve(address(staking), INITIAL_STAKE);

        vm.expectRevert("Cannot stake 0");
        staking.stake(0);

        vm.stopPrank();
    }

    function test_StakeMultipleTimes() public {
        _notifyReward(REWARD_AMOUNT);

        vm.startPrank(alice);
        stakingToken.approve(address(staking), 300e18);

        staking.stake(100e18);
        staking.stake(100e18);
        staking.stake(100e18);

        vm.stopPrank();

        assertEq(staking.balanceOf(alice), 300e18);
    }

    function testFuzz_Stake(
        uint256 amount
    ) public {
        amount = bound(amount, 1, 1000e18);
        _notifyReward(REWARD_AMOUNT);

        vm.startPrank(alice);
        stakingToken.approve(address(staking), amount);
        staking.stake(amount);
        vm.stopPrank();

        assertEq(staking.balanceOf(alice), amount);
    }

    // ==================== WITHDRAW ====================

    function test_Withdraw() public {
        _stakeFor(alice, INITIAL_STAKE);

        vm.prank(alice);
        staking.withdraw(INITIAL_STAKE);

        assertEq(staking.balanceOf(alice), 0);
        assertEq(stakingToken.balanceOf(alice), 1000e18);
    }

    function test_WithdrawZero() public {
        _stakeFor(alice, INITIAL_STAKE);

        vm.prank(alice);
        vm.expectRevert("Cannot withdraw 0");
        staking.withdraw(0);
    }

    function test_WithdrawMoreThanBalance() public {
        _stakeFor(alice, INITIAL_STAKE);

        vm.prank(alice);
        vm.expectRevert(); // Underflow
        staking.withdraw(INITIAL_STAKE + 1);
    }

    function test_PartialWithdraw() public {
        _stakeFor(alice, INITIAL_STAKE);

        vm.prank(alice);
        staking.withdraw(50e18);

        assertEq(staking.balanceOf(alice), 50e18);
    }

    // ==================== REWARDS ====================

    function test_StakeAndEarn() public {
        _stakeFor(alice, INITIAL_STAKE);

        // Fast forward time (7 days duration default)
        vm.warp(block.timestamp + 3.5 days); // Halfway

        uint256 earned = staking.earned(alice);
        console.log("Earned after 3.5 days:", earned);
        assertGt(earned, 0);
    }

    function test_GetReward() public {
        _stakeFor(alice, INITIAL_STAKE);

        vm.warp(block.timestamp + 7 days);

        uint256 earned = staking.earned(alice);

        vm.prank(alice);
        staking.getReward();

        assertEq(rewardsToken.balanceOf(alice), earned);
        assertEq(staking.earned(alice), 0);
    }

    function test_GetRewardNoStake() public {
        _notifyReward(REWARD_AMOUNT);

        vm.warp(block.timestamp + 7 days);

        vm.prank(alice);
        staking.getReward();

        assertEq(rewardsToken.balanceOf(alice), 0);
    }

    function test_Exit() public {
        _stakeFor(alice, INITIAL_STAKE);

        vm.warp(block.timestamp + 7 days);

        uint256 earnedBefore = staking.earned(alice);

        vm.prank(alice);
        staking.exit();

        assertEq(staking.balanceOf(alice), 0);
        assertEq(stakingToken.balanceOf(alice), 1000e18);
        assertGt(rewardsToken.balanceOf(alice), 0);
        assertApproxEqRel(rewardsToken.balanceOf(alice), earnedBefore, 0.001e18);
    }

    function test_RewardForDuration() public {
        _notifyReward(REWARD_AMOUNT);

        uint256 rewardForDuration = staking.getRewardForDuration();
        assertApproxEqRel(rewardForDuration, REWARD_AMOUNT, 0.01e18);
    }

    // ==================== MULTIPLE STAKERS ====================

    function test_MultipleStakersFairDistribution() public {
        _notifyReward(REWARD_AMOUNT);

        // Alice and Bob stake same amount at same time
        vm.startPrank(alice);
        stakingToken.approve(address(staking), 100e18);
        staking.stake(100e18);
        vm.stopPrank();

        vm.startPrank(bob);
        stakingToken.approve(address(staking), 100e18);
        staking.stake(100e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 7 days);

        uint256 aliceEarned = staking.earned(alice);
        uint256 bobEarned = staking.earned(bob);

        // Should be roughly equal (50% each)
        assertApproxEqRel(aliceEarned, bobEarned, 0.01e18);
        assertApproxEqRel(aliceEarned + bobEarned, REWARD_AMOUNT, 0.01e18);
    }

    function test_ProportionalRewards() public {
        _notifyReward(REWARD_AMOUNT);

        // Alice stakes 75, Bob stakes 25
        vm.startPrank(alice);
        stakingToken.approve(address(staking), 75e18);
        staking.stake(75e18);
        vm.stopPrank();

        vm.startPrank(bob);
        stakingToken.approve(address(staking), 25e18);
        staking.stake(25e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 7 days);

        uint256 aliceEarned = staking.earned(alice);
        uint256 bobEarned = staking.earned(bob);

        // Alice should have ~3x Bob's rewards
        assertApproxEqRel(aliceEarned, bobEarned * 3, 0.01e18);
    }

    function test_LateStakerGetsLessRewards() public {
        _notifyReward(REWARD_AMOUNT);

        // Alice stakes at t=0
        vm.startPrank(alice);
        stakingToken.approve(address(staking), 100e18);
        staking.stake(100e18);
        vm.stopPrank();

        // Bob stakes at t=3.5 days (halfway)
        vm.warp(block.timestamp + 3.5 days);
        vm.startPrank(bob);
        stakingToken.approve(address(staking), 100e18);
        staking.stake(100e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 3.5 days); // t = 7 days

        uint256 aliceEarned = staking.earned(alice);
        uint256 bobEarned = staking.earned(bob);

        // Alice should have more than Bob (staked entire duration)
        assertGt(aliceEarned, bobEarned);
    }

    // ==================== ADMIN FUNCTIONS ====================

    function test_NotifyRewardAmount() public {
        staking.notifyRewardAmount(REWARD_AMOUNT);

        assertGt(staking.rewardRate(), 0);
        assertEq(staking.periodFinish(), block.timestamp + 7 days);
    }

    function test_NotifyRewardAmountOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.notifyRewardAmount(REWARD_AMOUNT);
    }

    function test_NotifyRewardTooHigh() public {
        // Try to notify more than contract has
        vm.expectRevert("Provided reward too high");
        staking.notifyRewardAmount(REWARD_AMOUNT * 2);
    }

    function test_NotifyRewardDuringActivePeriod() public {
        staking.notifyRewardAmount(REWARD_AMOUNT / 2);

        vm.warp(block.timestamp + 3.5 days);

        // Add more rewards mid-period using deal
        deal(address(rewardsToken), address(staking), REWARD_AMOUNT);
        staking.notifyRewardAmount(REWARD_AMOUNT / 2);

        // Should have remaining + new rewards
        assertGt(staking.rewardRate(), 0);
    }

    function test_SetRewardsDuration() public {
        // Can't change during active period
        staking.notifyRewardAmount(REWARD_AMOUNT);

        vm.expectRevert(
            "Previous rewards period must be complete before changing the duration for the new period"
        );
        staking.setRewardsDuration(14 days);

        // After period ends
        vm.warp(block.timestamp + 8 days);
        staking.setRewardsDuration(14 days);

        assertEq(staking.rewardsDuration(), 14 days);
    }

    function test_SetRewardsDurationOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.setRewardsDuration(14 days);
    }

    // ==================== VIEW FUNCTIONS ====================

    function test_LastTimeRewardApplicable() public {
        _notifyReward(REWARD_AMOUNT);

        // During period, should return current time
        vm.warp(block.timestamp + 3 days);
        assertEq(staking.lastTimeRewardApplicable(), block.timestamp);

        // After period, should return periodFinish
        vm.warp(block.timestamp + 10 days);
        assertEq(staking.lastTimeRewardApplicable(), staking.periodFinish());
    }

    function test_RewardPerToken() public {
        _stakeFor(alice, INITIAL_STAKE);

        uint256 rptBefore = staking.rewardPerToken();

        vm.warp(block.timestamp + 1 days);

        uint256 rptAfter = staking.rewardPerToken();

        assertGt(rptAfter, rptBefore);
    }

    function test_RewardPerTokenNoStakers() public {
        _notifyReward(REWARD_AMOUNT);

        vm.warp(block.timestamp + 7 days);

        // Should still return stored value (0 in this case)
        uint256 rpt = staking.rewardPerToken();
        assertEq(rpt, 0);
    }

    // ==================== FUZZ TESTS ====================

    function testFuzz_StakeWithdrawBalance(
        uint256 stakeAmount,
        uint256 withdrawAmount
    ) public {
        stakeAmount = bound(stakeAmount, 1, 1000e18);
        withdrawAmount = bound(withdrawAmount, 1, stakeAmount);

        _notifyReward(REWARD_AMOUNT);

        vm.startPrank(alice);
        stakingToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);

        staking.withdraw(withdrawAmount);
        vm.stopPrank();

        assertEq(staking.balanceOf(alice), stakeAmount - withdrawAmount);
    }

    function testFuzz_RewardAccrual(
        uint256 stakeAmount,
        uint256 timeElapsed
    ) public {
        stakeAmount = bound(stakeAmount, 1e18, 1000e18);
        timeElapsed = bound(timeElapsed, 1 hours, 7 days);

        _notifyReward(REWARD_AMOUNT);

        vm.startPrank(alice);
        stakingToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        vm.stopPrank();

        vm.warp(block.timestamp + timeElapsed);

        uint256 earned = staking.earned(alice);
        assertGt(earned, 0);

        // Earned should be proportional to time passed
        uint256 expectedMaxEarned = (REWARD_AMOUNT * timeElapsed) / 7 days;
        assertLe(earned, expectedMaxEarned + 1e18); // Allow small rounding
    }

    // ==================== HELPERS ====================

    function _notifyReward(
        uint256 amount
    ) internal {
        staking.notifyRewardAmount(amount);
    }

    function _stakeFor(
        address user,
        uint256 amount
    ) internal {
        _notifyReward(REWARD_AMOUNT);

        vm.startPrank(user);
        stakingToken.approve(address(staking), amount);
        staking.stake(amount);
        vm.stopPrank();
    }
}
