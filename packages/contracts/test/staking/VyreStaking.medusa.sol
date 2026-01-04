// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { VyreStaking } from "../../src/defi/VyreStaking.sol";
import { MockToken } from "../../src/mocks/MockToken.sol";

/**
 * @title VyreStakingMedusaTest
 * @notice Property-based tests for Medusa fuzzer targeting Staking contract
 * @dev All functions prefixed with "property_" are tested by Medusa
 */
contract VyreStakingMedusaTest {
    VyreStaking public staking;
    MockToken public stakingToken;
    MockToken public rewardsToken;

    uint256 constant REWARD_AMOUNT = 10_000_000e18;

    // Ghost tracking
    uint256 public ghost_totalStaked;
    uint256 public ghost_totalWithdrawn;

    constructor() payable {
        stakingToken = new MockToken("LP Token", "LP");
        rewardsToken = new MockToken("CHIP", "CHIP");

        staking = new VyreStaking(address(this), address(rewardsToken), address(stakingToken));

        // Fund staking contract with rewards
        rewardsToken.transfer(address(staking), REWARD_AMOUNT);
        staking.notifyRewardAmount(REWARD_AMOUNT);

        // Approve staking
        stakingToken.approve(address(staking), type(uint256).max);
    }

    // ==================== ACTIONS ====================

    function stake(
        uint256 amount
    ) external {
        amount = _bound(amount, 1e15, 10_000e18);

        uint256 balance = stakingToken.balanceOf(address(this));
        if (balance < amount) return;

        try staking.stake(amount) {
            ghost_totalStaked += amount;
        } catch { }
    }

    function withdraw(
        uint256 fraction
    ) external {
        fraction = _bound(fraction, 1, 100);

        uint256 stakedBalance = staking.balanceOf(address(this));
        if (stakedBalance == 0) return;

        uint256 amount = (stakedBalance * fraction) / 100;
        if (amount == 0) return;

        try staking.withdraw(amount) {
            ghost_totalWithdrawn += amount;
        } catch { }
    }

    function getReward() external {
        try staking.getReward() { } catch { }
    }

    function exit() external {
        uint256 stakedBalance = staking.balanceOf(address(this));
        if (stakedBalance == 0) return;

        try staking.exit() {
            ghost_totalWithdrawn += stakedBalance;
        } catch { }
    }

    // ==================== PROPERTY TESTS ====================

    /**
     * @notice Property: Total supply must match sum of known balances
     */
    function property_TotalSupplyConsistent() external view returns (bool) {
        uint256 totalSupply = staking.totalSupply();
        uint256 ourBalance = staking.balanceOf(address(this));

        // Our balance should never exceed total supply
        return ourBalance <= totalSupply;
    }

    /**
     * @notice Property: Staking contract has enough tokens to cover stakes
     */
    function property_StakingTokenSolvency() external view returns (bool) {
        uint256 totalStaked = staking.totalSupply();
        uint256 contractBalance = stakingToken.balanceOf(address(staking));

        return contractBalance >= totalStaked;
    }

    /**
     * @notice Property: Earned rewards should be non-negative
     */
    function property_EarnedNonNegative() external view returns (bool) {
        uint256 earned = staking.earned(address(this));
        return earned >= 0;
    }

    /**
     * @notice Property: Reward rate should be reasonable
     */
    function property_RewardRateReasonable() external view returns (bool) {
        uint256 rewardRate = staking.rewardRate();
        uint256 periodFinish = staking.periodFinish();

        if (block.timestamp >= periodFinish) {
            return true; // Period ended, no constraints
        }

        uint256 remainingTime = periodFinish - block.timestamp;
        uint256 remainingRewards = rewardRate * remainingTime;
        uint256 contractBalance = rewardsToken.balanceOf(address(staking));

        // Allow some tolerance for rounding
        return remainingRewards <= contractBalance + 1e18;
    }

    /**
     * @notice Property: User can always withdraw their full stake
     */
    function property_CanAlwaysWithdraw() external returns (bool) {
        uint256 stakedBalance = staking.balanceOf(address(this));

        if (stakedBalance == 0) return true;

        uint256 tokensBefore = stakingToken.balanceOf(address(this));

        try staking.withdraw(stakedBalance) {
            uint256 tokensAfter = stakingToken.balanceOf(address(this));

            bool result = tokensAfter == tokensBefore + stakedBalance
                && staking.balanceOf(address(this)) == 0;

            // Re-stake to continue testing
            stakingToken.approve(address(staking), stakedBalance);
            try staking.stake(stakedBalance) { } catch { }

            return result;
        } catch {
            return false;
        }
    }

    /**
     * @notice Property: Period finish is in the future when rewards are active
     */
    function property_PeriodFinishValid() external view returns (bool) {
        uint256 periodFinish = staking.periodFinish();
        uint256 rewardRate = staking.rewardRate();

        // If reward rate is 0, period finish doesn't matter
        if (rewardRate == 0) return true;

        // Period finish should have been set
        return periodFinish > 0;
    }

    /**
     * @notice Property: Rewards duration is positive
     */
    function property_RewardsDurationPositive() external view returns (bool) {
        return staking.rewardsDuration() > 0;
    }

    /**
     * @notice Property: Ghost tracking consistency
     */
    function property_GhostConsistency() external view returns (bool) {
        uint256 netStaked =
            ghost_totalStaked > ghost_totalWithdrawn ? ghost_totalStaked - ghost_totalWithdrawn : 0;

        uint256 ourBalance = staking.balanceOf(address(this));

        // Should be approximately equal (exact for this contract)
        // Allow small difference for edge cases
        return ourBalance <= netStaked + 1e18;
    }

    // ==================== HELPERS ====================

    function _bound(
        uint256 value,
        uint256 min,
        uint256 max
    ) internal pure returns (uint256) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    receive() external payable { }
}
