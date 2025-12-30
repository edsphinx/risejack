// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { RiseCasinoFactory, RiseCasinoPair, RiseCasinoERC20 } from "../../src/defi/RiseCasinoV2Core.sol";
import { RiseCasinoRouter } from "../../src/defi/RiseCasinoRouter.sol";
import { MockWETH } from "../../src/mocks/MockWETH.sol";
import { MockToken } from "../../src/mocks/MockToken.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RiseCasinoAMMTest is Test {
    RiseCasinoFactory factory;
    RiseCasinoRouter router;
    MockWETH weth;
    MockToken tokenA;
    MockToken tokenB;

    address owner = address(this);
    address alice = address(0x1);

    function setUp() public {
        weth = new MockWETH();
        factory = new RiseCasinoFactory(owner);
        router = new RiseCasinoRouter(address(factory), address(weth));

        tokenA = new MockToken("TokenA", "TKA");
        tokenB = new MockToken("TokenB", "TKB");

        vm.label(address(factory), "Factory");
        vm.label(address(router), "Router");
        vm.label(address(tokenA), "TokenA");
        vm.label(address(tokenB), "TokenB");
    }

    function test_PairCreation() public {
        address pairAddress = factory.createPair(address(tokenA), address(tokenB));
        RiseCasinoPair pair = RiseCasinoPair(pairAddress);
        
        assertEq(factory.allPairsLength(), 1);
        assertEq(factory.getPair(address(tokenA), address(tokenB)), pairAddress);
        assertEq(pair.token0(), address(tokenA) < address(tokenB) ? address(tokenA) : address(tokenB));
    }

    function test_AddLiquidityAndSwap() public {
        // Mint tokens to Alice
        tokenA.transfer(alice, 1000e18);
        tokenB.transfer(alice, 1000e18);

        vm.startPrank(alice);
        
        tokenA.approve(address(router), type(uint256).max);
        tokenB.approve(address(router), type(uint256).max);

        // Add Liquidity
        (uint amountA, uint amountB, uint liquidity) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            100e18,
            100e18,
            90e18,
            90e18,
            alice,
            block.timestamp
        );

        // Verify LP tokens
        address pairAddress = factory.getPair(address(tokenA), address(tokenB));
        RiseCasinoPair pair = RiseCasinoPair(pairAddress);
        assertEq(pair.balanceOf(alice), liquidity);

        // Swap A for B
        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        uint amountIn = 10e18;
        uint[] memory amounts = router.getAmountsOut(amountIn, path);
        uint expectedOut = amounts[1];

        router.swapExactTokensForTokens(
            amountIn,
            0, // accept any amount for test
            path,
            alice,
            block.timestamp
        );

        // Verify swap happened
        // Alice should have less A and more B (minus the initial Liquidity add)
        // Initial: 1000. Used LP: 100. Balance: 900.
        // Swap: -10 A. Balance A: 890.
        assertEq(tokenA.balanceOf(alice), 890e18);
        // Balance B: 900 + expectedOut
        assertEq(tokenB.balanceOf(alice), 900e18 + expectedOut);
        
        vm.stopPrank();
    }
}
