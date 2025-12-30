// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import {
    RiseCasinoFactory,
    RiseCasinoPair,
    RiseCasinoERC20
} from "../../src/defi/RiseCasinoV2Core.sol";
import { RiseCasinoRouter, RiseCasinoLibrary } from "../../src/defi/RiseCasinoRouter.sol";
import { MockWETH } from "../../src/mocks/MockWETH.sol";
import { MockToken } from "../../src/mocks/MockToken.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RiseCasinoAMMTest is Test {
    RiseCasinoFactory factory;
    RiseCasinoRouter router;
    MockWETH weth;
    MockToken tokenA;
    MockToken tokenB;
    MockToken tokenC;

    address owner = address(this);
    address alice = address(0x1);
    address bob = address(0x2);
    address feeCollector = address(0x3);

    uint256 constant INITIAL_LIQUIDITY = 100e18;

    function setUp() public {
        weth = new MockWETH();
        factory = new RiseCasinoFactory(owner);
        router = new RiseCasinoRouter(address(factory), address(weth));

        tokenA = new MockToken("TokenA", "TKA");
        tokenB = new MockToken("TokenB", "TKB");
        tokenC = new MockToken("TokenC", "TKC");

        // Fund accounts
        tokenA.transfer(alice, 10_000e18);
        tokenB.transfer(alice, 10_000e18);
        tokenC.transfer(alice, 10_000e18);
        tokenA.transfer(bob, 10_000e18);
        tokenB.transfer(bob, 10_000e18);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        vm.label(address(factory), "Factory");
        vm.label(address(router), "Router");
        vm.label(address(weth), "WETH");
        vm.label(address(tokenA), "TokenA");
        vm.label(address(tokenB), "TokenB");
        vm.label(address(tokenC), "TokenC");
    }

    // ==================== FACTORY TESTS ====================

    function test_PairCreation() public {
        address pairAddress = factory.createPair(address(tokenA), address(tokenB));
        RiseCasinoPair pair = RiseCasinoPair(pairAddress);

        assertEq(factory.allPairsLength(), 1);
        assertEq(factory.getPair(address(tokenA), address(tokenB)), pairAddress);
        assertEq(factory.getPair(address(tokenB), address(tokenA)), pairAddress);
        assertEq(
            pair.token0(), address(tokenA) < address(tokenB) ? address(tokenA) : address(tokenB)
        );
    }

    function test_CreatePairIdenticalTokens() public {
        vm.expectRevert("RiseCasino: IDENTICAL_ADDRESSES");
        factory.createPair(address(tokenA), address(tokenA));
    }

    function test_CreatePairZeroAddress() public {
        vm.expectRevert("RiseCasino: ZERO_ADDRESS");
        factory.createPair(address(tokenA), address(0));
    }

    function test_CreatePairAlreadyExists() public {
        factory.createPair(address(tokenA), address(tokenB));
        vm.expectRevert("RiseCasino: PAIR_EXISTS");
        factory.createPair(address(tokenA), address(tokenB));
    }

    function test_SetFeeTo() public {
        factory.setFeeTo(feeCollector);
        assertEq(factory.feeTo(), feeCollector);
    }

    function test_SetFeeToByNonOwner() public {
        vm.prank(alice);
        vm.expectRevert("RiseCasino: FORBIDDEN");
        factory.setFeeTo(feeCollector);
    }

    function test_SetFeeToSetter() public {
        factory.setFeeToSetter(alice);
        assertEq(factory.feeToSetter(), alice);
    }

    // ==================== PAIR LP TOKEN TESTS ====================

    function test_PairLPTokenName() public {
        factory.createPair(address(tokenA), address(tokenB));
        address pairAddress = factory.getPair(address(tokenA), address(tokenB));
        RiseCasinoPair pair = RiseCasinoPair(pairAddress);

        assertEq(pair.name(), "RiseCasino LP");
        assertEq(pair.symbol(), "RSC-LP");
        assertEq(pair.decimals(), 18);
    }

    // ==================== ROUTER ADD LIQUIDITY ====================

    function test_AddLiquidity() public {
        vm.startPrank(alice);

        tokenA.approve(address(router), type(uint256).max);
        tokenB.approve(address(router), type(uint256).max);

        (uint256 amountA, uint256 amountB, uint256 liquidity) = router.addLiquidity(
            address(tokenA), address(tokenB), 100e18, 100e18, 90e18, 90e18, alice, block.timestamp
        );

        address pairAddress = factory.getPair(address(tokenA), address(tokenB));
        RiseCasinoPair pair = RiseCasinoPair(pairAddress);

        assertEq(amountA, 100e18);
        assertEq(amountB, 100e18);
        assertGt(liquidity, 0);
        assertEq(pair.balanceOf(alice), liquidity);

        vm.stopPrank();
    }

    function test_AddLiquidityETH() public {
        vm.startPrank(alice);

        tokenA.approve(address(router), type(uint256).max);

        (uint256 amountToken, uint256 amountETH, uint256 liquidity) = router.addLiquidityETH{
            value: 10 ether
        }(
            address(tokenA), 100e18, 90e18, 9 ether, alice, block.timestamp
        );

        address pairAddress = factory.getPair(address(tokenA), address(weth));
        RiseCasinoPair pair = RiseCasinoPair(pairAddress);

        assertEq(amountToken, 100e18);
        assertEq(amountETH, 10 ether);
        assertGt(liquidity, 0);
        assertEq(pair.balanceOf(alice), liquidity);

        vm.stopPrank();
    }

    function test_AddLiquidityExpired() public {
        vm.startPrank(alice);
        tokenA.approve(address(router), type(uint256).max);
        tokenB.approve(address(router), type(uint256).max);

        vm.expectRevert("RiseCasinoRouter: EXPIRED");
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            100e18,
            100e18,
            90e18,
            90e18,
            alice,
            block.timestamp - 1
        );

        vm.stopPrank();
    }

    // ==================== ROUTER REMOVE LIQUIDITY ====================

    function test_RemoveLiquidity() public {
        // First add liquidity
        vm.startPrank(alice);
        tokenA.approve(address(router), type(uint256).max);
        tokenB.approve(address(router), type(uint256).max);

        (,, uint256 liquidity) = router.addLiquidity(
            address(tokenA), address(tokenB), 100e18, 100e18, 90e18, 90e18, alice, block.timestamp
        );

        address pairAddress = factory.getPair(address(tokenA), address(tokenB));
        RiseCasinoPair pair = RiseCasinoPair(pairAddress);

        uint256 balanceABefore = tokenA.balanceOf(alice);
        uint256 balanceBBefore = tokenB.balanceOf(alice);

        // Remove liquidity
        pair.approve(address(router), liquidity);
        (uint256 amountA, uint256 amountB) = router.removeLiquidity(
            address(tokenA), address(tokenB), liquidity, 0, 0, alice, block.timestamp
        );

        assertGt(amountA, 0);
        assertGt(amountB, 0);
        assertEq(tokenA.balanceOf(alice), balanceABefore + amountA);
        assertEq(tokenB.balanceOf(alice), balanceBBefore + amountB);
        assertEq(pair.balanceOf(alice), 0);

        vm.stopPrank();
    }

    function test_RemoveLiquidityETH() public {
        vm.startPrank(alice);
        tokenA.approve(address(router), type(uint256).max);

        (,, uint256 liquidity) = router.addLiquidityETH{ value: 10 ether }(
            address(tokenA), 100e18, 90e18, 9 ether, alice, block.timestamp
        );

        address pairAddress = factory.getPair(address(tokenA), address(weth));
        RiseCasinoPair pair = RiseCasinoPair(pairAddress);

        uint256 ethBefore = alice.balance;
        uint256 tokenBefore = tokenA.balanceOf(alice);

        pair.approve(address(router), liquidity);
        (uint256 amountToken, uint256 amountETH) =
            router.removeLiquidityETH(address(tokenA), liquidity, 0, 0, alice, block.timestamp);

        assertGt(amountToken, 0);
        assertGt(amountETH, 0);
        assertEq(tokenA.balanceOf(alice), tokenBefore + amountToken);
        assertEq(alice.balance, ethBefore + amountETH);

        vm.stopPrank();
    }

    // ==================== ROUTER SWAP ====================

    function test_SwapExactTokensForTokens() public {
        // Setup liquidity first
        _setupLiquidity();

        vm.startPrank(alice);

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        uint256 amountIn = 10e18;
        uint256[] memory amounts = router.getAmountsOut(amountIn, path);
        uint256 expectedOut = amounts[1];

        uint256 balanceBBefore = tokenB.balanceOf(alice);

        router.swapExactTokensForTokens(amountIn, 0, path, alice, block.timestamp);

        assertEq(tokenB.balanceOf(alice), balanceBBefore + expectedOut);

        vm.stopPrank();
    }

    function test_SwapTokensForExactTokens() public {
        _setupLiquidity();

        vm.startPrank(alice);

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        uint256 amountOut = 5e18;
        uint256[] memory amounts = router.getAmountsIn(amountOut, path);
        uint256 expectedIn = amounts[0];

        uint256 balanceABefore = tokenA.balanceOf(alice);
        uint256 balanceBBefore = tokenB.balanceOf(alice);

        router.swapTokensForExactTokens(amountOut, type(uint256).max, path, alice, block.timestamp);

        assertEq(tokenB.balanceOf(alice), balanceBBefore + amountOut);
        assertEq(tokenA.balanceOf(alice), balanceABefore - expectedIn);

        vm.stopPrank();
    }

    function test_SwapExactETHForTokens() public {
        // Setup ETH/TokenA liquidity
        vm.startPrank(alice);
        tokenA.approve(address(router), type(uint256).max);
        router.addLiquidityETH{ value: 50 ether }(
            address(tokenA), 500e18, 0, 0, alice, block.timestamp
        );

        address[] memory path = new address[](2);
        path[0] = address(weth);
        path[1] = address(tokenA);

        uint256 tokenBefore = tokenA.balanceOf(alice);

        router.swapExactETHForTokens{ value: 1 ether }(0, path, alice, block.timestamp);

        assertGt(tokenA.balanceOf(alice), tokenBefore);

        vm.stopPrank();
    }

    function test_SwapExactTokensForETH() public {
        // Setup ETH/TokenA liquidity
        vm.startPrank(alice);
        tokenA.approve(address(router), type(uint256).max);
        router.addLiquidityETH{ value: 50 ether }(
            address(tokenA), 500e18, 0, 0, alice, block.timestamp
        );

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(weth);

        uint256 ethBefore = alice.balance;

        router.swapExactTokensForETH(10e18, 0, path, alice, block.timestamp);

        assertGt(alice.balance, ethBefore);

        vm.stopPrank();
    }

    function test_MultiHopSwap() public {
        // Setup A-B and B-C pairs
        vm.startPrank(alice);
        tokenA.approve(address(router), type(uint256).max);
        tokenB.approve(address(router), type(uint256).max);
        tokenC.approve(address(router), type(uint256).max);

        router.addLiquidity(
            address(tokenA), address(tokenB), 1000e18, 1000e18, 0, 0, alice, block.timestamp
        );
        router.addLiquidity(
            address(tokenB), address(tokenC), 1000e18, 1000e18, 0, 0, alice, block.timestamp
        );

        // Swap A -> B -> C
        address[] memory path = new address[](3);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);

        uint256 balanceCBefore = tokenC.balanceOf(alice);

        router.swapExactTokensForTokens(10e18, 0, path, alice, block.timestamp);

        assertGt(tokenC.balanceOf(alice), balanceCBefore);

        vm.stopPrank();
    }

    // ==================== PAIR DIRECT FUNCTIONS ====================

    function test_PairMintDirect() public {
        factory.createPair(address(tokenA), address(tokenB));
        address pairAddress = factory.getPair(address(tokenA), address(tokenB));
        RiseCasinoPair pair = RiseCasinoPair(pairAddress);

        // Transfer tokens directly to pair
        tokenA.transfer(pairAddress, 100e18);
        tokenB.transfer(pairAddress, 100e18);

        // Mint LP tokens
        uint256 liquidity = pair.mint(alice);

        assertGt(liquidity, 0);
        assertEq(pair.balanceOf(alice), liquidity);
    }

    function test_PairBurnDirect() public {
        _setupLiquidity();

        address pairAddress = factory.getPair(address(tokenA), address(tokenB));
        RiseCasinoPair pair = RiseCasinoPair(pairAddress);

        // Get alice's LP balance and transfer to pair
        vm.startPrank(alice);
        uint256 lpBalance = pair.balanceOf(alice);
        pair.transfer(pairAddress, lpBalance);
        vm.stopPrank();

        // Burn from pair
        (uint256 amount0, uint256 amount1) = pair.burn(bob);

        assertGt(amount0, 0);
        assertGt(amount1, 0);
    }

    function test_PairSync() public {
        _setupLiquidity();

        address pairAddress = factory.getPair(address(tokenA), address(tokenB));
        RiseCasinoPair pair = RiseCasinoPair(pairAddress);

        // Transfer extra tokens
        tokenA.transfer(pairAddress, 10e18);

        (uint112 reserve0Before, uint112 reserve1Before,) = pair.getReserves();

        pair.sync();

        (uint112 reserve0After, uint112 reserve1After,) = pair.getReserves();

        // Reserve should increase by 10e18 for token that was transferred
        assertGt(reserve0After + reserve1After, reserve0Before + reserve1Before);
    }

    function test_PairSkim() public {
        _setupLiquidity();

        address pairAddress = factory.getPair(address(tokenA), address(tokenB));
        RiseCasinoPair pair = RiseCasinoPair(pairAddress);

        // Transfer extra tokens
        tokenA.transfer(pairAddress, 10e18);

        uint256 bobBalanceBefore = tokenA.balanceOf(bob);

        pair.skim(bob);

        assertEq(tokenA.balanceOf(bob), bobBalanceBefore + 10e18);
    }

    // ==================== LIBRARY TESTS ====================

    function testFuzz_GetAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure {
        amountIn = bound(amountIn, 1, 1e30);
        reserveIn = bound(reserveIn, 1000, 1e35);
        reserveOut = bound(reserveOut, 1000, 1e35);

        uint256 amountOut = RiseCasinoLibrary.getAmountOut(amountIn, reserveIn, reserveOut);

        // Output should never exceed reserve
        assertLt(amountOut, reserveOut);
    }

    function testFuzz_GetAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure {
        reserveOut = bound(reserveOut, 1000, 1e35);
        amountOut = bound(amountOut, 1, reserveOut - 1);
        reserveIn = bound(reserveIn, 1000, 1e35);

        uint256 amountIn = RiseCasinoLibrary.getAmountIn(amountOut, reserveIn, reserveOut);

        assertGt(amountIn, 0);
    }

    function test_Quote() public pure {
        uint256 amountA = 100e18;
        uint256 reserveA = 1000e18;
        uint256 reserveB = 2000e18;

        uint256 amountB = RiseCasinoLibrary.quote(amountA, reserveA, reserveB);

        assertEq(amountB, 200e18);
    }

    // ==================== EDGE CASES ====================

    function test_SwapInsufficientOutput() public {
        _setupLiquidity();

        vm.startPrank(alice);

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        // Expect minimum output that's way too high
        vm.expectRevert("RiseCasinoRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        router.swapExactTokensForTokens(10e18, 100e18, path, alice, block.timestamp);

        vm.stopPrank();
    }

    function test_InsufficientLiquidityMint() public {
        factory.createPair(address(tokenA), address(tokenB));
        address pairAddress = factory.getPair(address(tokenA), address(tokenB));
        RiseCasinoPair pair = RiseCasinoPair(pairAddress);

        // Transfer tiny amounts
        tokenA.transfer(pairAddress, 1);
        tokenB.transfer(pairAddress, 1);

        // Expect arithmetic underflow (sqrt(1*1) - 1000 = underflow)
        vm.expectRevert();
        pair.mint(alice);
    }

    // ==================== HELPERS ====================

    function _setupLiquidity() internal {
        vm.startPrank(alice);
        tokenA.approve(address(router), type(uint256).max);
        tokenB.approve(address(router), type(uint256).max);

        router.addLiquidity(
            address(tokenA), address(tokenB), 1000e18, 1000e18, 0, 0, alice, block.timestamp
        );
        vm.stopPrank();
    }
}
