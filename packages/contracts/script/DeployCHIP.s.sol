// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console } from "forge-std/Script.sol";
import { CHIPToken } from "../src/tokens/defi/CHIPToken.sol";

/**
 * @title DeployCHIP
 * @notice Deploy CHIPToken with SAFE multisig as owner
 *
 * Required env vars:
 * - DEPLOYER_PRIVATE_KEY: Private key for deployment
 * - RISE_SAFE_ADDRESS: SAFE multisig address (owner of token)
 *
 * Run: forge script script/DeployCHIP.s.sol:DeployCHIP --rpc-url https://testnet.riselabs.xyz --broadcast
 */
contract DeployCHIP is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Load SAFE address from env - NEVER hardcode
        address safeOwner = vm.envAddress("RISE_SAFE_ADDRESS");

        console.log("=== DeployCHIP Script ===");
        console.log("Deployer:", deployer);
        console.log("Token Owner (SAFE):", safeOwner);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy with SAFE as owner
        CHIPToken chip = new CHIPToken(safeOwner);

        console.log("=== Deployment Complete ===");
        console.log("CHIPToken deployed to:", address(chip));
        console.log("Owner:", chip.owner());
        console.log("Initial supply:", chip.totalSupply());

        vm.stopBroadcast();
    }
}
