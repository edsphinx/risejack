// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Blackjack} from "../src/Blackjack.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        Blackjack blackjack = new Blackjack();
        
        console.log("Blackjack deployed to:", address(blackjack));
        
        vm.stopBroadcast();
    }
}
