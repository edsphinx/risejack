// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { RiseCasinoStaking } from "../../src/defi/RiseCasinoStaking.sol";
import { MockToken } from "../../src/mocks/MockToken.sol";

contract RiseCasinoStakingTest is Test {
    RiseCasinoStaking staking;
    MockToken stakingToken;
    MockToken rewardsToken;

    address owner = address(this);
    address alice = address(0x1);

    function setUp() public {
        stakingToken = new MockToken("LP Token", "LP");
        rewardsToken = new MockToken("Reward Chip", "CHIP");

        staking = new RiseCasinoStaking(owner, address(rewardsToken), address(stakingToken));

        // Fund staking contract with rewards
        rewardsToken.transfer(address(staking), 1_000_000e18);
        staking.notifyRewardAmount(1_000_000e18);
    }

    function test_StakeAndEarn() public {
        stakingToken.transfer(alice, 100e18);

        vm.startPrank(alice);
        stakingToken.approve(address(staking), 100e18);
        staking.stake(100e18);
        vm.stopPrank();

        // Check balance
        assertEq(staking.balanceOf(alice), 100e18);

        // Fast forward time (7 days duration default)
        vm.warp(block.timestamp + 3.5 days); // Halfway

        uint earned = staking.earned(alice);
        console.log("Earned after 3.5 days:", earned);
        assertGt(earned, 0);

        // Exit
        vm.startPrank(alice);
        staking.exit();
        vm.stopPrank();

        assertEq(staking.balanceOf(alice), 0);
        assertGt(rewardsToken.balanceOf(alice), 0);
    }
}
