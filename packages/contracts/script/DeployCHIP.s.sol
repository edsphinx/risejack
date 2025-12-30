// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CHIPToken} from "../src/defi/CHIPToken.sol";

contract DeployCHIP is Script {
    function run() public {
        // Validate environment variable exists
        // Note: vm.envUint will revert if not set, but we add explicit check for clarity
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set or invalid");

        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== DeployCHIP Script ===");
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        CHIPToken chip = new CHIPToken(deployer);

        console.log("=== Deployment Complete ===");
        console.log("CHIPToken deployed to:", address(chip));
        console.log("Owner:", deployer);
        console.log("Initial supply:", chip.totalSupply());

        vm.stopBroadcast();
    }
}
