// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console } from "forge-std/Script.sol";
import { RiseJack } from "../src/RiseJack.sol";
import { MockVRFCoordinator } from "../src/mocks/MockVRFCoordinator.sol";

contract DeployScript is Script {
    function setUp() public { }

    /**
     * @notice Deploy to local Anvil with Mock VRF
     * @dev Run: forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
     */
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        bool isLocal = vm.envOr("LOCAL", false);

        vm.startBroadcast(deployerPrivateKey);

        address vrfCoordinator;

        if (isLocal) {
            // Deploy Mock VRF for local development
            MockVRFCoordinator mockVRF = new MockVRFCoordinator();
            vrfCoordinator = address(mockVRF);
            console.log("Mock VRF Coordinator deployed to:", vrfCoordinator);
        } else {
            // Use address(0) to default to Rise testnet VRF
            vrfCoordinator = address(0);
            console.log("Using Rise Testnet VRF Coordinator");
        }

        RiseJack risejack = new RiseJack(vrfCoordinator);
        console.log("RiseJack deployed to:", address(risejack));

        // Fund contract for payouts (optional, can be done later)
        if (isLocal) {
            (bool success,) = address(risejack).call{ value: 10 ether }("");
            require(success, "Funding failed");
            console.log("Contract funded with 10 ETH");
        }

        vm.stopBroadcast();
    }
}

/**
 * @notice Deploy specifically for local development
 */
contract DeployLocal is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Mock VRF
        MockVRFCoordinator mockVRF = new MockVRFCoordinator();
        console.log("Mock VRF Coordinator:", address(mockVRF));

        // Deploy Blackjack with Mock VRF
        RiseJack risejack = new RiseJack(address(mockVRF));
        console.log("Blackjack:", address(risejack));

        // Fund contract
        (bool success,) = address(risejack).call{ value: 10 ether }("");
        require(success, "Funding failed");
        console.log("Funded with 10 ETH");

        vm.stopBroadcast();
    }
}

/**
 * @notice Deploy to Rise Testnet (uses default VRF)
 * @dev Configures: 0 cooldown, low min bet, initial funding
 */
contract DeployTestnet is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy with default Rise VRF (address(0) triggers default)
        RiseJack risejack = new RiseJack(address(0));
        console.log("RiseJack deployed to:", address(risejack));

        // Configure for testnet: 0 cooldown for fast testing
        risejack.setGameCooldown(0);
        console.log("Game cooldown set to 0");

        // Set low VRF timeout for Rise Chain's fast blocks
        risejack.setVRFTimeout(10 seconds);
        console.log("VRF timeout set to 10 seconds");

        // Set low min bet for testing (0.00001 ETH = 10000000000000 wei)
        risejack.setBetLimits(0.000_01 ether, 0.1 ether);
        console.log("Bet limits: 0.00001 - 0.1 ETH");

        // Disable min reserve for testnet (prevents auto-pause on losses)
        risejack.setMinReserve(0);
        console.log("Min reserve set to 0 (testnet mode)");

        // Initial funding (0.001 ETH = ~10 full bets at max)
        uint256 fundAmount = 0.001 ether;
        (bool success,) = address(risejack).call{ value: fundAmount }("");
        if (success) {
            console.log("Funded with", fundAmount, "wei");
        } else {
            console.log("Funding skipped (add funds manually)");
        }

        vm.stopBroadcast();
    }
}
