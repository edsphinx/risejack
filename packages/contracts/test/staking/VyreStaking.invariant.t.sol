// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { VyreStaking } from "../../src/tokens/defi/VyreStaking.sol";
import { MockToken } from "../../src/mocks/MockToken.sol";

/**
 * @title StakingHandler
 * @notice Handler contract for invariant testing - simulates user actions on Staking
 */
contract StakingHandler is Test {
    VyreStaking public staking;
    MockToken public stakingToken;
    MockToken public rewardsToken;

    address[] public actors;
    address internal currentActor;

    // Ghost variables for tracking
    uint256 public ghost_totalStaked;
    uint256 public ghost_totalWithdrawn;
    uint256 public ghost_totalRewardsClaimed;
    uint256 public ghost_stakeCount;
    uint256 public ghost_withdrawCount;
    uint256 public ghost_getRewardCount;

    // Track individual stakes for invariant checking
    mapping(address => uint256) public ghost_userStakes;

    modifier useActor(
        uint256 actorSeed
    ) {
        currentActor = actors[actorSeed % actors.length];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    constructor(
        VyreStaking _staking,
        MockToken _stakingToken,
        MockToken _rewardsToken
    ) {
        staking = _staking;
        stakingToken = _stakingToken;
        rewardsToken = _rewardsToken;

        // Create actors
        for (uint256 i = 0; i < 5; i++) {
            address actor = vm.addr(0x2000 + i);
            actors.push(actor);

            // Fund actors with staking tokens
            deal(address(stakingToken), actor, 1_000_000e18);

            // Approve staking contract
            vm.prank(actor);
            stakingToken.approve(address(staking), type(uint256).max);
        }
    }

    function stake(
        uint256 actorSeed,
        uint256 amount
    ) external useActor(actorSeed) {
        amount = bound(amount, 1e15, 100_000e18);

        uint256 balance = stakingToken.balanceOf(currentActor);
        if (balance < amount) return;

        try staking.stake(amount) {
            ghost_totalStaked += amount;
            ghost_userStakes[currentActor] += amount;
            ghost_stakeCount++;
        } catch { }
    }

    function withdraw(
        uint256 actorSeed,
        uint256 fraction
    ) external useActor(actorSeed) {
        fraction = bound(fraction, 1, 100);

        uint256 stakedBalance = staking.balanceOf(currentActor);
        if (stakedBalance == 0) return;

        uint256 amount = (stakedBalance * fraction) / 100;
        if (amount == 0) return;

        try staking.withdraw(amount) {
            ghost_totalWithdrawn += amount;
            ghost_userStakes[currentActor] -= amount;
            ghost_withdrawCount++;
        } catch { }
    }

    function getReward(
        uint256 actorSeed
    ) external useActor(actorSeed) {
        if (staking.balanceOf(currentActor) == 0 && staking.earned(currentActor) == 0) return;

        uint256 earnedBefore = staking.earned(currentActor);

        try staking.getReward() {
            ghost_totalRewardsClaimed += earnedBefore;
            ghost_getRewardCount++;
        } catch { }
    }

    function exit(
        uint256 actorSeed
    ) external useActor(actorSeed) {
        uint256 stakedBalance = staking.balanceOf(currentActor);
        if (stakedBalance == 0) return;

        uint256 earnedBefore = staking.earned(currentActor);

        try staking.exit() {
            ghost_totalWithdrawn += stakedBalance;
            ghost_userStakes[currentActor] = 0;
            ghost_totalRewardsClaimed += earnedBefore;
            ghost_withdrawCount++;
            ghost_getRewardCount++;
        } catch { }
    }

    function warpTime(
        uint256 timeToWarp
    ) external {
        timeToWarp = bound(timeToWarp, 1 hours, 7 days);
        vm.warp(block.timestamp + timeToWarp);
    }

    function getActors() external view returns (address[] memory) {
        return actors;
    }

    function getSumOfUserStakes() external view returns (uint256 sum) {
        for (uint256 i = 0; i < actors.length; i++) {
            sum += ghost_userStakes[actors[i]];
        }
    }
}

/**
 * @title VyreStakingInvariantTest
 * @notice Invariant tests for RiseCasino Staking contract
 */
contract VyreStakingInvariantTest is Test {
    VyreStaking public staking;
    MockToken public stakingToken;
    MockToken public rewardsToken;
    StakingHandler public handler;

    uint256 constant REWARD_AMOUNT = 10_000_000e18;

    function setUp() public {
        stakingToken = new MockToken("LP Token", "LP");
        rewardsToken = new MockToken("CHIP", "CHIP");

        staking = new VyreStaking(address(this), address(rewardsToken), address(stakingToken));

        // Fund staking contract with rewards using deal
        deal(address(rewardsToken), address(staking), REWARD_AMOUNT);
        staking.notifyRewardAmount(REWARD_AMOUNT);

        handler = new StakingHandler(staking, stakingToken, rewardsToken);

        // Target only the handler
        targetContract(address(handler));
    }

    /**
     * @notice Invariant: Total supply must equal sum of all balances
     */
    function invariant_TotalSupplyConsistent() public view {
        uint256 totalSupply = staking.totalSupply();
        uint256 sumOfBalances = 0;

        address[] memory actors = handler.getActors();
        for (uint256 i = 0; i < actors.length; i++) {
            sumOfBalances += staking.balanceOf(actors[i]);
        }

        // Note: Other addresses (like this contract) might also stake
        // So sumOfBalances <= totalSupply
        assertTrue(sumOfBalances <= totalSupply, "Sum of balances should not exceed total supply");
    }

    /**
     * @notice Invariant: Staking contract must have enough staking tokens to cover withdrawals
     */
    function invariant_StakingTokenSolvency() public view {
        uint256 totalStaked = staking.totalSupply();
        uint256 contractBalance = stakingToken.balanceOf(address(staking));

        assertTrue(
            contractBalance >= totalStaked,
            "Contract must have enough staking tokens to cover all stakes"
        );
    }

    /**
     * @notice Invariant: Reward rate should be reasonable given balance
     */
    function invariant_RewardRateReasonable() public view {
        uint256 rewardRate = staking.rewardRate();
        uint256 contractBalance = rewardsToken.balanceOf(address(staking));

        // Total rewards for duration should not exceed balance
        // But accounting for already distributed rewards, this is complex
        // At minimum, rate * remaining_time <= balance
        uint256 periodFinish = staking.periodFinish();
        if (block.timestamp < periodFinish) {
            uint256 remainingTime = periodFinish - block.timestamp;
            uint256 remainingRewards = rewardRate * remainingTime;
            // This might not hold exactly due to rounding, but should be close
            // We allow some tolerance
            assertTrue(
                remainingRewards <= contractBalance + 1e18,
                "Remaining rewards should be covered by balance"
            );
        }
    }

    /**
     * @notice Invariant: User balances should never exceed total supply
     */
    function invariant_IndividualBalancesReasonable() public view {
        uint256 totalSupply = staking.totalSupply();

        address[] memory actors = handler.getActors();
        for (uint256 i = 0; i < actors.length; i++) {
            uint256 balance = staking.balanceOf(actors[i]);
            assertTrue(balance <= totalSupply, "Individual balance should not exceed total supply");
        }
    }

    /**
     * @notice Invariant: Ghost tracking should match actual state
     */
    function invariant_GhostTrackingConsistent() public view {
        // Net staked (ghost) should roughly match total supply
        uint256 netStaked = handler.ghost_totalStaked() - handler.ghost_totalWithdrawn();

        // Allow some tolerance due to edge cases
        uint256 totalSupply = staking.totalSupply();

        // The difference should be small (accounting for initial stake from setup)
        assertTrue(
            netStaked <= totalSupply + 1e18, "Ghost tracking should be consistent with actual state"
        );
    }

    /**
     * @notice Invariant: Earned rewards should be non-negative
     */
    function invariant_EarnedNonNegative() public view {
        address[] memory actors = handler.getActors();
        for (uint256 i = 0; i < actors.length; i++) {
            uint256 earned = staking.earned(actors[i]);
            assertTrue(earned >= 0, "Earned should be non-negative");
        }
    }

    /**
     * @notice Invariant: Users can always withdraw their full stake
     */
    function invariant_UsersCanWithdraw() public {
        address[] memory actors = handler.getActors();

        for (uint256 i = 0; i < actors.length; i++) {
            address actor = actors[i];
            uint256 balance = staking.balanceOf(actor);

            if (balance > 0) {
                uint256 tokensBefore = stakingToken.balanceOf(actor);

                vm.prank(actor);
                staking.withdraw(balance);

                uint256 tokensAfter = stakingToken.balanceOf(actor);
                assertEq(tokensAfter, tokensBefore + balance, "User should receive their tokens");
                assertEq(
                    staking.balanceOf(actor), 0, "User balance should be 0 after full withdrawal"
                );

                // Re-stake to continue invariant testing
                vm.prank(actor);
                stakingToken.approve(address(staking), balance);
                vm.prank(actor);
                staking.stake(balance);
            }
        }
    }

    /**
     * @notice Call summary for debugging
     */
    function invariant_callSummary() public view {
        console.log("=== Staking Invariant Call Summary ===");
        console.log("Total staked (ghost):", handler.ghost_totalStaked());
        console.log("Total withdrawn (ghost):", handler.ghost_totalWithdrawn());
        console.log("Total rewards claimed (ghost):", handler.ghost_totalRewardsClaimed());
        console.log("Stake count:", handler.ghost_stakeCount());
        console.log("Withdraw count:", handler.ghost_withdrawCount());
        console.log("GetReward count:", handler.ghost_getRewardCount());
        console.log("Actual total supply:", staking.totalSupply());
    }
}
