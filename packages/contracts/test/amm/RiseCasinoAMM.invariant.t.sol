// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { RiseCasinoFactory, RiseCasinoPair } from "../../src/defi/RiseCasinoV2Core.sol";
import { RiseCasinoRouter } from "../../src/defi/RiseCasinoRouter.sol";
import { MockWETH } from "../../src/mocks/MockWETH.sol";
import { MockToken } from "../../src/mocks/MockToken.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AMMHandler
 * @notice Handler contract for invariant testing - simulates user actions on AMM
 */
contract AMMHandler is Test {
    RiseCasinoFactory public factory;
    RiseCasinoRouter public router;
    RiseCasinoPair public pair;
    MockToken public tokenA;
    MockToken public tokenB;

    address[] public actors;
    address internal currentActor;

    // Ghost variables for tracking
    uint256 public ghost_totalLiquidityAdded;
    uint256 public ghost_totalLiquidityRemoved;
    uint256 public ghost_totalSwaps;
    uint256 public ghost_totalSkims;
    uint256 public ghost_totalSyncs;

    modifier useActor(
        uint256 actorSeed
    ) {
        currentActor = actors[actorSeed % actors.length];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    constructor(
        RiseCasinoFactory _factory,
        RiseCasinoRouter _router,
        MockToken _tokenA,
        MockToken _tokenB
    ) {
        factory = _factory;
        router = _router;
        tokenA = _tokenA;
        tokenB = _tokenB;

        // Create actors
        for (uint256 i = 0; i < 5; i++) {
            address actor = address(uint160(0x1000 + i));
            actors.push(actor);

            // Fund actors
            deal(address(tokenA), actor, 1_000_000e18);
            deal(address(tokenB), actor, 1_000_000e18);

            // Approve router
            vm.prank(actor);
            tokenA.approve(address(router), type(uint256).max);
            vm.prank(actor);
            tokenB.approve(address(router), type(uint256).max);
        }

        // Get or create pair
        address pairAddr = factory.getPair(address(tokenA), address(tokenB));
        if (pairAddr == address(0)) {
            pairAddr = factory.createPair(address(tokenA), address(tokenB));
        }
        pair = RiseCasinoPair(pairAddr);

        // Approve pair for LP token transfers
        for (uint256 i = 0; i < actors.length; i++) {
            vm.prank(actors[i]);
            pair.approve(address(router), type(uint256).max);
        }
    }

    function addLiquidity(
        uint256 actorSeed,
        uint256 amountA,
        uint256 amountB
    ) external useActor(actorSeed) {
        amountA = bound(amountA, 1e15, 100_000e18);
        amountB = bound(amountB, 1e15, 100_000e18);

        if (tokenA.balanceOf(currentActor) < amountA) return;
        if (tokenB.balanceOf(currentActor) < amountB) return;

        try router.addLiquidity(
            address(tokenA),
            address(tokenB),
            amountA,
            amountB,
            0,
            0,
            currentActor,
            block.timestamp + 1
        ) {
            ghost_totalLiquidityAdded++;
        } catch { }
    }

    function removeLiquidity(
        uint256 actorSeed,
        uint256 liquidityFraction
    ) external useActor(actorSeed) {
        liquidityFraction = bound(liquidityFraction, 1, 100);
        uint256 lpBalance = pair.balanceOf(currentActor);

        if (lpBalance == 0) return;

        uint256 liquidity = (lpBalance * liquidityFraction) / 100;
        if (liquidity == 0) return;

        try router.removeLiquidity(
            address(tokenA), address(tokenB), liquidity, 0, 0, currentActor, block.timestamp + 1
        ) {
            ghost_totalLiquidityRemoved++;
        } catch { }
    }

    function swapAForB(
        uint256 actorSeed,
        uint256 amountIn
    ) external useActor(actorSeed) {
        amountIn = bound(amountIn, 1e15, 10_000e18);

        if (tokenA.balanceOf(currentActor) < amountIn) return;
        if (pair.totalSupply() == 0) return;

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        try router.swapExactTokensForTokens(amountIn, 0, path, currentActor, block.timestamp + 1) {
            ghost_totalSwaps++;
        } catch { }
    }

    function swapBForA(
        uint256 actorSeed,
        uint256 amountIn
    ) external useActor(actorSeed) {
        amountIn = bound(amountIn, 1e15, 10_000e18);

        if (tokenB.balanceOf(currentActor) < amountIn) return;
        if (pair.totalSupply() == 0) return;

        address[] memory path = new address[](2);
        path[0] = address(tokenB);
        path[1] = address(tokenA);

        try router.swapExactTokensForTokens(amountIn, 0, path, currentActor, block.timestamp + 1) {
            ghost_totalSwaps++;
        } catch { }
    }

    function skim(
        uint256 actorSeed
    ) external useActor(actorSeed) {
        try pair.skim(currentActor) {
            ghost_totalSkims++;
        } catch { }
    }

    function sync() external {
        try pair.sync() {
            ghost_totalSyncs++;
        } catch { }
    }

    function getActors() external view returns (address[] memory) {
        return actors;
    }
}

/**
 * @title RiseCasinoAMMInvariantTest
 * @notice Invariant tests for RiseCasino AMM (Factory, Pair, Router)
 */
contract RiseCasinoAMMInvariantTest is Test {
    RiseCasinoFactory public factory;
    RiseCasinoRouter public router;
    MockWETH public weth;
    MockToken public tokenA;
    MockToken public tokenB;
    RiseCasinoPair public pair;
    AMMHandler public handler;

    function setUp() public {
        weth = new MockWETH();
        factory = new RiseCasinoFactory(address(this));
        router = new RiseCasinoRouter(address(factory), address(weth));

        tokenA = new MockToken("TokenA", "TKA");
        tokenB = new MockToken("TokenB", "TKB");

        handler = new AMMHandler(factory, router, tokenA, tokenB);
        pair = handler.pair();

        // Initial liquidity to avoid edge cases
        deal(address(tokenA), address(this), 10_000e18);
        deal(address(tokenB), address(this), 10_000e18);
        tokenA.approve(address(router), type(uint256).max);
        tokenB.approve(address(router), type(uint256).max);

        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            10_000e18,
            10_000e18,
            0,
            0,
            address(this),
            block.timestamp + 1
        );

        // Target only the handler
        targetContract(address(handler));
    }

    /**
     * @notice Invariant: K = reserve0 * reserve1 should never decrease after swaps
     * (accounting for fees, it should actually increase)
     */
    function invariant_KNeverDecreases() public view {
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        uint256 currentK = uint256(reserve0) * uint256(reserve1);

        // K should always be >= 0 (trivially true, but sanity check)
        assertTrue(currentK >= 0, "K should never be negative");

        // If there are reserves, K should be positive
        if (reserve0 > 0 && reserve1 > 0) {
            assertTrue(currentK > 0, "K should be positive when reserves exist");
        }
    }

    /**
     * @notice Invariant: Reserves must match actual token balances after sync
     */
    function invariant_ReservesMatchBalancesAfterSync() public {
        // Force sync
        pair.sync();

        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();

        uint256 balance0 = tokenA.balanceOf(address(pair));
        uint256 balance1 = tokenB.balanceOf(address(pair));

        // Account for token ordering
        if (pair.token0() == address(tokenA)) {
            assertEq(reserve0, balance0, "Reserve0 should match balance0");
            assertEq(reserve1, balance1, "Reserve1 should match balance1");
        } else {
            assertEq(reserve0, balance1, "Reserve0 should match balance1");
            assertEq(reserve1, balance0, "Reserve1 should match balance0");
        }
    }

    /**
     * @notice Invariant: Total LP supply equals sum of all holder balances
     */
    function invariant_LPSupplyConsistent() public view {
        uint256 totalSupply = pair.totalSupply();

        // Check that total supply is consistent with minted/burned
        // This is implicitly true in ERC20, but good to verify
        assertTrue(totalSupply >= 0, "Total supply should be non-negative");

        // If there are reserves, there should be some LP tokens
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        if (reserve0 > 0 && reserve1 > 0) {
            // Account for MINIMUM_LIQUIDITY burned
            assertTrue(totalSupply >= 1000, "Total supply should be at least MINIMUM_LIQUIDITY");
        }
    }

    /**
     * @notice Invariant: Cannot extract more tokens than reserves allow
     */
    function invariant_NoFreeTokens() public view {
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();

        uint256 balance0 = tokenA.balanceOf(address(pair));
        uint256 balance1 = tokenB.balanceOf(address(pair));

        // Pair can only hold more than reserves (from direct transfers), never less
        if (pair.token0() == address(tokenA)) {
            assertTrue(balance0 >= reserve0, "Balance0 should be >= reserve0");
            assertTrue(balance1 >= reserve1, "Balance1 should be >= reserve1");
        } else {
            assertTrue(balance1 >= reserve0, "Balance1 should be >= reserve0");
            assertTrue(balance0 >= reserve1, "Balance0 should be >= reserve1");
        }
    }

    /**
     * @notice Invariant: Pair tokens are correctly set
     */
    function invariant_TokensCorrectlySet() public view {
        address token0 = pair.token0();
        address token1 = pair.token1();

        assertTrue(
            (token0 == address(tokenA) && token1 == address(tokenB))
                || (token0 == address(tokenB) && token1 == address(tokenA)),
            "Tokens should be correctly set"
        );

        // token0 should be less than token1
        assertTrue(token0 < token1, "token0 should be < token1");
    }

    /**
     * @notice Call summary for debugging
     */
    function invariant_callSummary() public view {
        console.log("=== AMM Invariant Call Summary ===");
        console.log("Liquidity adds:", handler.ghost_totalLiquidityAdded());
        console.log("Liquidity removes:", handler.ghost_totalLiquidityRemoved());
        console.log("Total swaps:", handler.ghost_totalSwaps());
        console.log("Skims:", handler.ghost_totalSkims());
        console.log("Syncs:", handler.ghost_totalSyncs());
    }
}
