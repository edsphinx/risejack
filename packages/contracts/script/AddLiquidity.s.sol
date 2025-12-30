// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console } from "forge-std/Script.sol";
import { CHIPToken } from "../src/defi/CHIPToken.sol";

interface IUniswapV2Router02 {
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
    
    function factory() external view returns (address);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

contract AddLiquidity is Script {
    address constant ROUTER = 0x67b3925D7b2b2d9BD316DAC8bCF888A60B9F24F0;
    address constant CHIP = 0x2D97Ba366119e55B1a98D9349ce35868920C7Ae8;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Minimal liquidity: 0.0001 ETH + 1000 CHIP
        uint256 ethAmount = 0.0001 ether;
        uint256 chipAmount = 1000 * 1e18;
        
        console.log("Deployer:", deployer);
        console.log("ETH amount:", ethAmount);
        console.log("CHIP amount:", chipAmount);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Approve CHIP for Router
        CHIPToken chip = CHIPToken(CHIP);
        chip.approve(ROUTER, chipAmount);
        console.log("CHIP approved for Router");
        
        // Add liquidity
        IUniswapV2Router02 router = IUniswapV2Router02(ROUTER);
        (uint amountToken, uint amountETH, uint liquidity) = router.addLiquidityETH{value: ethAmount}(
            CHIP,
            chipAmount,
            chipAmount, // min token amount (exact for first liquidity add)
            ethAmount,  // min ETH amount
            deployer,   // LP tokens go to deployer
            block.timestamp + 600 // 10 min deadline
        );
        
        console.log("Liquidity added!");
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
