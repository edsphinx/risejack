// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console } from "forge-std/Script.sol";
import { CHIPToken } from "../src/defi/CHIPToken.sol";

contract DeployCHIP is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        CHIPToken chip = new CHIPToken(deployer);
        console.log("CHIPToken deployed to:", address(chip));
        console.log("Owner:", deployer);
        console.log("Initial supply:", chip.totalSupply());

        vm.stopBroadcast();
    }
}
