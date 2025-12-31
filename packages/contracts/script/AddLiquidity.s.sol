// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { CHIPToken } from "../src/defi/CHIPToken.sol";

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
    function getPair(
        address tokenA,
        address tokenB
    ) external view returns (address pair);
}

interface IERC20 {
    function balanceOf(
        address account
    ) external view returns (uint256);
}

contract AddLiquidity is Script {
    address constant ROUTER = 0x67b3925D7b2b2d9BD316DAC8bCF888A60B9F24F0;
    address constant CHIP = 0x2D97Ba366119e55B1a98D9349ce35868920C7Ae8;
    address constant WETH = 0x4200000000000000000000000000000000000006;

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deployer:", deployer);
        console2.log("ETH amount:", uint256(0.0001 ether));
        console2.log("CHIP amount:", uint256(1000 ether));

        vm.startBroadcast(deployerPrivateKey);

        // Approve CHIP for Router
        CHIPToken(CHIP).approve(ROUTER, 1000 ether);
        console2.log("CHIP approved for Router");

        // Add liquidity - use inline values to reduce stack usage
        IUniswapV2Router02(ROUTER).addLiquidityETH{ value: 0.0001 ether }(
            CHIP,
            1000 ether, // amountTokenDesired
            1000 ether, // amountTokenMin (no slippage for initial)
            0.0001 ether, // amountETHMin
            deployer,
            block.timestamp + 600
        );

        console2.log("Liquidity added!");

        // Log results separately to avoid stack issues
        _logResults(deployer);

        vm.stopBroadcast();
    }

    function _logResults(
        address deployer
    ) internal view {
        console2.log("CHIP used:", uint256(1000 ether));
        console2.log("ETH used:", uint256(0.0001 ether));
        console2.log("LP tokens received:", _getLPBalance(deployer));
    }

    function _getLPBalance(
        address account
    ) internal view returns (uint256) {
        IUniswapV2Factory factory = IUniswapV2Factory(IUniswapV2Router02(ROUTER).factory());
        address lpToken = factory.getPair(CHIP, WETH);
        return IERC20(lpToken).balanceOf(account);
    }
}

