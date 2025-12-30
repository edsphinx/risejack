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

        // 1. Deploy WETH (Mock for now, or use existing if configured)
        // For simplicity in this script, we always deploy MockWETH.
        // In production, we would use vm.envAddress("WETH_ADDRESS") or similar.
        MockWETH weth = new MockWETH();
        console.log("WETH deployed at:", address(weth));

        // 2. Deploy CHIP Token
        CHIPToken chip = new CHIPToken(deployer);
        console.log("CHIPToken deployed at:", address(chip));

        // 3. Deploy Factory
        RiseCasinoFactory factory = new RiseCasinoFactory(deployer); // deployer sets fees
        console.log("RiseCasinoFactory deployed at:", address(factory));

        // 4. Deploy Router
        RiseCasinoRouter router = new RiseCasinoRouter(address(factory), address(weth));
        console.log("RiseCasinoRouter deployed at:", address(router));

        // 5. Deploy Staking (Stake CHIP, Earn WETH)
        // Owner = deployer
        // Rewards = WETH
        // Staking = CHIP
        RiseCasinoStaking staking = new RiseCasinoStaking(deployer, address(weth), address(chip));
        console.log("RiseCasinoStaking deployed at:", address(staking));

        // Optional: Create initial Liquidity for CHIP/ETH
        // Requires minting CHIP and depositing ETH.
        // We skip this in the deploy script to keep it clean, but it's the next logical step.

        vm.stopBroadcast();
    }
}
