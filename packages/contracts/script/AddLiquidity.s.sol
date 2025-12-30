// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CHIPToken} from "../src/defi/CHIPToken.sol";

interface IUniswapV2Router02 {
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);

    function factory() external view returns (address);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

contract AddLiquidity is Script {
    address constant ROUTER = 0x67b3925D7b2b2d9BD316DAC8bCF888A60B9F24F0;
    address constant CHIP = 0x2D97Ba366119e55B1a98D9349ce35868920C7Ae8;
    address constant WETH = 0x4200000000000000000000000000000000000006;

    // Short deadline to minimize MEV exposure (60 seconds)
    uint256 constant DEADLINE_SECONDS = 60;

    function run() public {
        // Validate environment variable exists
        // Note: vm.envUint will revert if not set, but we add explicit check for clarity
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set or invalid");

        address deployer = vm.addr(deployerPrivateKey);

        // Minimal liquidity amounts
        uint256 ethAmount = 0.0001 ether;
        uint256 chipAmount = 1000 * 1e18;

        console.log("=== AddLiquidity Script ===");
        console.log("Deployer:", deployer);
        console.log("ETH amount:", ethAmount);
        console.log("CHIP amount:", chipAmount);

        // Validate balances before starting
        require(deployer.balance >= ethAmount, "Insufficient ETH balance");

        CHIPToken chip = CHIPToken(CHIP);
        require(chip.balanceOf(deployer) >= chipAmount, "Insufficient CHIP balance");

        console.log("Balance checks passed");

        vm.startBroadcast(deployerPrivateKey);

        // Approve CHIP for Router
        chip.approve(ROUTER, chipAmount);
        console.log("CHIP approved for Router");

        // Add liquidity with short deadline to minimize MEV
        IUniswapV2Router02 router = IUniswapV2Router02(ROUTER);
        (uint256 amountToken, uint256 amountETH, uint256 liquidity) = router.addLiquidityETH{value: ethAmount}(
            CHIP,
            chipAmount,
            chipAmount, // min token amount (exact for first liquidity add)
            ethAmount, // min ETH amount
            deployer, // LP tokens go to deployer
            block.timestamp + DEADLINE_SECONDS
        );

        console.log("=== Liquidity Added ===");
        console.log("CHIP used:", amountToken);
        console.log("ETH used:", amountETH);
        console.log("LP tokens received:", liquidity);

        // Get pair address
        IUniswapV2Factory factory = IUniswapV2Factory(router.factory());
        address pair = factory.getPair(CHIP, WETH);
        console.log("LP Token (Pair) address:", pair);

        vm.stopBroadcast();
    }
}
