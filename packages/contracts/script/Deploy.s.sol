// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Blackjack} from "../src/Blackjack.sol";
import {MockVRFCoordinator} from "../src/mocks/MockVRFCoordinator.sol";

contract DeployScript is Script {
    function setUp() public {}

    /**
     * @notice Deploy to local Anvil with Mock VRF
     * @dev Run: forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
     */
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
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
        
        Blackjack blackjack = new Blackjack(vrfCoordinator);
        console.log("Blackjack deployed to:", address(blackjack));
        
        // Fund contract for payouts (optional, can be done later)
        if (isLocal) {
            (bool success,) = address(blackjack).call{value: 10 ether}("");
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
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy Mock VRF
        MockVRFCoordinator mockVRF = new MockVRFCoordinator();
        console.log("Mock VRF Coordinator:", address(mockVRF));
        
        // Deploy Blackjack with Mock VRF
        Blackjack blackjack = new Blackjack(address(mockVRF));
        console.log("Blackjack:", address(blackjack));
        
        // Fund contract
        (bool success,) = address(blackjack).call{value: 10 ether}("");
        require(success, "Funding failed");
        console.log("Funded with 10 ETH");
        
        vm.stopBroadcast();
    }
}

/**
 * @notice Deploy to Rise Testnet (uses default VRF)
 */
contract DeployTestnet is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy with default Rise VRF (address(0) triggers default)
        Blackjack blackjack = new Blackjack(address(0));
        console.log("Blackjack deployed to:", address(blackjack));
        
        vm.stopBroadcast();
    }
}
