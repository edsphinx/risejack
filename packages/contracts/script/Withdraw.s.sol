// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Script, console } from "forge-std/Script.sol";

interface IRiseJack {
    function owner() external view returns (address);
    function minReserve() external view returns (uint256);
    function withdrawHouseFunds(
        uint256 amount
    ) external;
    function getHouseStats()
        external
        view
        returns (
            uint256 balance,
            uint256 exposure,
            uint256 reserve,
            uint256 recentLosses,
            bool isPaused
        );
}

/**
 * @title Withdraw Script
 * @notice Withdraws all available funds from the deployed RiseJack contract
 * @dev Run with: forge script script/Withdraw.s.sol --rpc-url https://testnet.riselabs.xyz --broadcast --private-key $PRIVATE_KEY
 */
contract WithdrawScript is Script {
    // Current deployed contract address
    address constant RISEJACK_ADDRESS = 0xe17C645aE8dC321B41BA00bbc8B9E392342A0cA2;

    function run() external {
        IRiseJack riseJack = IRiseJack(RISEJACK_ADDRESS);

        // Get contract state
        (uint256 balance, uint256 exposure, uint256 reserve,,) = riseJack.getHouseStats();
        address owner = riseJack.owner();

        console.log("=== RiseJack Withdraw ===");
        console.log("Contract:", RISEJACK_ADDRESS);
        console.log("Owner:", owner);
        console.log("Balance:", balance, "wei");
        console.log("Exposure:", exposure);
        console.log("Min Reserve:", reserve);

        // Calculate withdrawable amount
        uint256 withdrawable = balance > reserve ? balance - reserve : 0;
        console.log("Withdrawable:", withdrawable, "wei");

        if (withdrawable == 0) {
            console.log("Nothing to withdraw!");
            return;
        }

        console.log("");
        console.log("Withdrawing", withdrawable, "wei...");

        // Start broadcast - uses the private key from CLI flag
        vm.startBroadcast();
        riseJack.withdrawHouseFunds(withdrawable);
        vm.stopBroadcast();

        console.log("=== Withdraw Complete! ===");
    }
}
