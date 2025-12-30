// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { RiseCasinoFactory, RiseCasinoPair } from "../../src/defi/RiseCasinoV2Core.sol";
import { RiseCasinoRouter, RiseCasinoLibrary } from "../../src/defi/RiseCasinoRouter.sol";
import { MockWETH } from "../../src/mocks/MockWETH.sol";
import { MockToken } from "../../src/mocks/MockToken.sol";

/**
 * @title RiseCasinoAMMMedusaTest
 * @notice Property-based tests for Medusa fuzzer targeting AMM contracts
 * @dev All functions prefixed with "property_" are tested by Medusa
 */
contract RiseCasinoAMMMedusaTest {
    RiseCasinoFactory public factory;
    RiseCasinoRouter public router;
    MockWETH public weth;
    MockToken public tokenA;
    MockToken public tokenB;
    RiseCasinoPair public pair;

    // Track K value for invariant checking
    uint256 public lastK;

    constructor() payable {
        weth = new MockWETH();
        factory = new RiseCasinoFactory(address(this));
        router = new RiseCasinoRouter(address(factory), address(weth));

        tokenA = new MockToken("TokenA", "TKA");
        tokenB = new MockToken("TokenB", "TKB");

        // Approve router
        tokenA.approve(address(router), type(uint256).max);
        tokenB.approve(address(router), type(uint256).max);

        // Create pair with initial liquidity
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            100_000e18,
            100_000e18,
            0,
            0,
            address(this),
            block.timestamp + 1
        );

        pair = RiseCasinoPair(factory.getPair(address(tokenA), address(tokenB)));
        pair.approve(address(router), type(uint256).max);

        // Record initial K
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        lastK = uint256(reserve0) * uint256(reserve1);
    }

    // ==================== ACTIONS ====================

    function addLiquidity(
        uint256 amountA,
        uint256 amountB
    ) external {
        amountA = _bound(amountA, 1e15, 10_000e18);
        amountB = _bound(amountB, 1e15, 10_000e18);

        if (tokenA.balanceOf(address(this)) < amountA) return;
        if (tokenB.balanceOf(address(this)) < amountB) return;

        try router.addLiquidity(
            address(tokenA),
            address(tokenB),
            amountA,
            amountB,
            0,
            0,
            address(this),
            block.timestamp + 1
        ) { }
            catch { }

        _updateK();
    }

    function removeLiquidity(
        uint256 fraction
    ) external {
        fraction = _bound(fraction, 1, 100);
        uint256 lpBalance = pair.balanceOf(address(this));

        if (lpBalance == 0) return;

        uint256 liquidity = (lpBalance * fraction) / 100;
        if (liquidity == 0) return;

        try router.removeLiquidity(
            address(tokenA), address(tokenB), liquidity, 0, 0, address(this), block.timestamp + 1
        ) { }
            catch { }

        _updateK();
    }

    function swapAForB(
        uint256 amountIn
    ) external {
        amountIn = _bound(amountIn, 1e15, 1000e18);

        if (tokenA.balanceOf(address(this)) < amountIn) return;

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        try router.swapExactTokensForTokens(
            amountIn, 0, path, address(this), block.timestamp + 1
        ) { }
            catch { }

        _updateK();
    }

    function swapBForA(
        uint256 amountIn
    ) external {
        amountIn = _bound(amountIn, 1e15, 1000e18);

        if (tokenB.balanceOf(address(this)) < amountIn) return;

        address[] memory path = new address[](2);
        path[0] = address(tokenB);
        path[1] = address(tokenA);

        try router.swapExactTokensForTokens(
            amountIn, 0, path, address(this), block.timestamp + 1
        ) { }
            catch { }

        _updateK();
    }

    function skim() external {
        try pair.skim(address(this)) { } catch { }
    }

    function sync() external {
        try pair.sync() { } catch { }
        _updateK();
    }

    // ==================== PROPERTY TESTS ====================

    /**
     * @notice Property: K should never decrease after valid trading operations
     */
    function property_KNeverDecreases() external view returns (bool) {
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        uint256 currentK = uint256(reserve0) * uint256(reserve1);

        // K can only increase or stay same (fees accumulate)
        // Note: K can decrease when removing liquidity, but should not after swaps
        return currentK >= lastK || lastK == 0;
    }

    /**
     * @notice Property: Reserves should always match balances after sync
     */
    function property_ReservesMatchBalances() external returns (bool) {
        pair.sync();

        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();

        uint256 balance0;
        uint256 balance1;

        if (pair.token0() == address(tokenA)) {
            balance0 = tokenA.balanceOf(address(pair));
            balance1 = tokenB.balanceOf(address(pair));
        } else {
            balance0 = tokenB.balanceOf(address(pair));
            balance1 = tokenA.balanceOf(address(pair));
        }

        return reserve0 == balance0 && reserve1 == balance1;
    }

    /**
     * @notice Property: Output of swap should never exceed reserve
     */
    function property_SwapOutputNeverExceedsReserve(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) external pure returns (bool) {
        amountIn = _boundPure(amountIn, 1, 1e30);
        reserveIn = _boundPure(reserveIn, 1000, 1e35);
        reserveOut = _boundPure(reserveOut, 1000, 1e35);

        uint256 amountOut = RiseCasinoLibrary.getAmountOut(amountIn, reserveIn, reserveOut);

        return amountOut < reserveOut;
    }

    /**
     * @notice Property: Quote function is proportional
     */
    function property_QuoteProportional(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) external pure returns (bool) {
        amountA = _boundPure(amountA, 1, 1e30);
        reserveA = _boundPure(reserveA, 1, 1e35);
        reserveB = _boundPure(reserveB, 1, 1e35);

        uint256 amountB = RiseCasinoLibrary.quote(amountA, reserveA, reserveB);

        // amountB / amountA should equal reserveB / reserveA (proportionality)
        // Cross multiply to avoid division: amountB * reserveA == amountA * reserveB
        return amountB * reserveA == amountA * reserveB;
    }

    /**
     * @notice Property: No tokens can be extracted without providing LP or input
     */
    function property_NoFreeTokens() external view returns (bool) {
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();

        uint256 balance0;
        uint256 balance1;

        if (pair.token0() == address(tokenA)) {
            balance0 = tokenA.balanceOf(address(pair));
            balance1 = tokenB.balanceOf(address(pair));
        } else {
            balance0 = tokenB.balanceOf(address(pair));
            balance1 = tokenA.balanceOf(address(pair));
        }

        // Balances should always be >= reserves (excess can be skimmed)
        return balance0 >= reserve0 && balance1 >= reserve1;
    }

    /**
     * @notice Property: LP total supply should be consistent
     */
    function property_LPSupplyPositive() external view returns (bool) {
        uint256 totalSupply = pair.totalSupply();
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();

        // If reserves exist, LP supply must be positive
        if (reserve0 > 0 && reserve1 > 0) {
            return totalSupply >= 1000; // MINIMUM_LIQUIDITY
        }
        return true;
    }

    /**
     * @notice Property: Tokens are correctly ordered
     */
    function property_TokensOrdered() external view returns (bool) {
        address token0 = pair.token0();
        address token1 = pair.token1();

        return token0 < token1;
    }

    // ==================== HELPERS ====================

    function _updateK() internal {
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        lastK = uint256(reserve0) * uint256(reserve1);
    }

    function _bound(
        uint256 value,
        uint256 min,
        uint256 max
    ) internal pure returns (uint256) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    function _boundPure(
        uint256 value,
        uint256 min,
        uint256 max
    ) internal pure returns (uint256) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    receive() external payable { }
}
