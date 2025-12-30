// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import { Script, console } from "forge-std/Script.sol";
import { CHIPToken } from "../src/defi/CHIPToken.sol";
import { RiseCasinoFactory } from "../src/defi/RiseCasinoV2Core.sol";
import { RiseCasinoRouter } from "../src/defi/RiseCasinoRouter.sol";
import { RiseCasinoStaking } from "../src/defi/RiseCasinoStaking.sol";
import { MockWETH } from "../src/mocks/MockWETH.sol";

contract DeployFullEcosystem is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy WETH or use existing
        address wethAddress = 0x4200000000000000000000000000000000000006; // Standard OP Stack WETH (Rise)
        
        // If we are on a local chain (chainId 31337), deploy MockWETH
        if (block.chainid == 31337) {
            MockWETH wethMock = new MockWETH();
            wethAddress = address(wethMock);
            console.log("MockWETH deployed at:", wethAddress);
        } else {
            console.log("Using existing WETH at:", wethAddress);
        }

        // 2. Deploy CHIP Token
        CHIPToken chip = new CHIPToken(deployer);
        console.log("CHIPToken deployed at:", address(chip));

        // 3. Deploy Factory
        RiseCasinoFactory factory = new RiseCasinoFactory(deployer); // deployer sets fees
        console.log("RiseCasinoFactory deployed at:", address(factory));

        // 4. Deploy Router
        RiseCasinoRouter router = new RiseCasinoRouter(address(factory), wethAddress);
        console.log("RiseCasinoRouter deployed at:", address(router));

        // 5. Deploy Staking (Stake CHIP, Earn WETH)
        // Owner = deployer
        // Rewards = WETH
        // Staking = CHIP
        RiseCasinoStaking staking = new RiseCasinoStaking(deployer, wethAddress, address(chip));
        console.log("RiseCasinoStaking deployed at:", address(staking));

        // Optional: Create initial Liquidity for CHIP/ETH
        // Requires minting CHIP and depositing ETH.
        // We skip this in the deploy script to keep it clean, but it's the next logical step.

        vm.stopBroadcast();
    }
}
