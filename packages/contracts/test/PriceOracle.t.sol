// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { PriceOracle } from "../src/oracles/PriceOracle.sol";

/// @dev Mock Uniswap V2 Pair for testing
contract MockUniswapPair {
    address public token0;
    address public token1;
    uint112 public reserve0;
    uint112 public reserve1;
    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;

    constructor(
        address _token0,
        address _token1
    ) {
        token0 = _token0;
        token1 = _token1;
        reserve0 = 1000e18;
        reserve1 = 1000e18;
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, uint32(block.timestamp));
    }

    function setReserves(
        uint112 _reserve0,
        uint112 _reserve1
    ) external {
        reserve0 = _reserve0;
        reserve1 = _reserve1;
    }

    function setPriceCumulative(
        uint256 _price0,
        uint256 _price1
    ) external {
        price0CumulativeLast = _price0;
        price1CumulativeLast = _price1;
    }
}

/**
 * @title PriceOracle Test Suite
 * @notice Tests for TWAP oracle with circuit breaker
 */
contract PriceOracleTest is Test {
    PriceOracle oracle;
    MockUniswapPair pair;

    address chip = address(0x1111);
    address meme = address(0x2222);
    address owner = address(this);

    function setUp() public {
        // Fix hex addresses
        chip = address(0x1111);
        meme = address(0x2222);

        oracle = new PriceOracle(chip, owner);

        // Create mock pair: meme is token0, chip is token1
        pair = new MockUniswapPair(meme, chip);

        vm.label(address(oracle), "PriceOracle");
        vm.label(address(pair), "MockPair");
        vm.label(meme, "MEME");
        vm.label(chip, "CHIP");
    }

    // ==================== DEPLOYMENT ====================

    function test_Deployment() public view {
        assertEq(oracle.chip(), chip);
        assertEq(oracle.owner(), owner);
        assertEq(oracle.TWAP_WINDOW(), 5 minutes);
        assertEq(oracle.circuitBreakerBps(), 2000);
        assertEq(oracle.minLiquidity(), 1000e18);
    }

    function test_ConstructorZeroChip() public {
        vm.expectRevert("PriceOracle: zero chip");
        new PriceOracle(address(0), owner);
    }

    function test_ConstructorZeroOwner() public {
        vm.expectRevert("PriceOracle: zero owner");
        new PriceOracle(chip, address(0));
    }

    // ==================== REGISTRATION ====================

    function test_RegisterToken() public {
        oracle.registerToken(meme, address(pair));

        // priceData returns: pair, isToken0, lastTWAP, isPaused, pausedAt (observations is array)
        (address registeredPair, bool isToken0,, bool isPaused,) = oracle.priceData(meme);
        assertEq(registeredPair, address(pair));
        assertTrue(isToken0); // meme is token0
        assertFalse(isPaused);
    }

    function test_RegisterTokenZeroToken() public {
        vm.expectRevert("PriceOracle: zero token");
        oracle.registerToken(address(0), address(pair));
    }

    function test_RegisterTokenZeroPair() public {
        vm.expectRevert("PriceOracle: zero pair");
        oracle.registerToken(meme, address(0));
    }

    function test_RegisterTokenAlreadyRegistered() public {
        oracle.registerToken(meme, address(pair));

        vm.expectRevert("PriceOracle: already registered");
        oracle.registerToken(meme, address(pair));
    }

    function test_RegisterTokenOnlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("PriceOracle: only owner");
        oracle.registerToken(meme, address(pair));
    }

    // ==================== PRICE UPDATES ====================

    function test_UpdatePrice() public {
        oracle.registerToken(meme, address(pair));

        // Advance time
        vm.warp(block.timestamp + 3 minutes);

        // Update price
        oracle.updatePrice(meme);

        // TWAP should be updated (or spot used)
        uint256 twap = oracle.getTWAP(meme);
        // With equal reserves (1000:1000), price = 1e18
        assertGt(twap, 0);
    }

    function test_UpdatePriceNotRegistered() public {
        vm.expectRevert("PriceOracle: not registered");
        oracle.updatePrice(meme);
    }

    // ==================== PRICE QUERIES ====================

    function test_GetPrice() public {
        oracle.registerToken(meme, address(pair));

        // Set high reserves for liquidity check
        pair.setReserves(10_000e18, 10_000e18);

        vm.warp(block.timestamp + 3 minutes);
        oracle.updatePrice(meme);

        (uint256 chipValue, bool isValid) = oracle.getPrice(meme, 100e18);
        assertTrue(isValid);
        assertGt(chipValue, 0);
    }

    function test_GetPriceNotRegistered() public {
        (uint256 chipValue, bool isValid) = oracle.getPrice(meme, 100e18);
        assertEq(chipValue, 0);
        assertFalse(isValid);
    }

    function test_GetPriceInsufficientLiquidity() public {
        oracle.registerToken(meme, address(pair));

        // Low reserves
        pair.setReserves(100e18, 100e18);

        (uint256 chipValue, bool isValid) = oracle.getPrice(meme, 100e18);
        assertEq(chipValue, 0);
        assertFalse(isValid);
    }

    function test_GetSpotPrice() public {
        oracle.registerToken(meme, address(pair));

        // Set 2:1 ratio (2000 CHIP : 1000 MEME)
        pair.setReserves(1000e18, 2000e18);

        uint256 spot = oracle.getSpotPrice(meme);
        // price = chip per meme = reserve1/reserve0 = 2000/1000 = 2e18
        assertEq(spot, 2e18);
    }

    function test_GetTWAP() public {
        oracle.registerToken(meme, address(pair));

        // Initial TWAP is 0 or spot
        uint256 twap = oracle.getTWAP(meme);
        assertEq(twap, 0); // No updates yet
    }

    function test_IsPaused() public {
        oracle.registerToken(meme, address(pair));
        assertFalse(oracle.isPaused(meme));
    }

    // ==================== CIRCUIT BREAKER ====================

    function test_CircuitBreakerInitialState() public {
        oracle.registerToken(meme, address(pair));
        pair.setReserves(10_000e18, 10_000e18);

        // Circuit breaker should not be triggered initially
        assertFalse(oracle.isPaused(meme));

        // Update price
        vm.warp(block.timestamp + 3 minutes);
        oracle.updatePrice(meme);

        // Still not paused after single update
        assertFalse(oracle.isPaused(meme));
    }

    function test_ResetCircuitBreaker() public {
        oracle.registerToken(meme, address(pair));
        pair.setReserves(10_000e18, 10_000e18);

        // Manually pause for testing
        // We need to trigger circuit breaker first
        // This requires significant price change

        // For now, test the admin function directly fails if not paused
        vm.expectRevert("PriceOracle: not paused");
        oracle.resetCircuitBreaker(meme);
    }

    function test_ResetCircuitBreakerOnlyOwner() public {
        oracle.registerToken(meme, address(pair));

        vm.prank(address(0x999));
        vm.expectRevert("PriceOracle: only owner");
        oracle.resetCircuitBreaker(meme);
    }

    // ==================== ADMIN ====================

    function test_SetCircuitBreakerThreshold() public {
        oracle.setCircuitBreakerThreshold(1000); // 10%
        assertEq(oracle.circuitBreakerBps(), 1000);
    }

    function test_SetCircuitBreakerThresholdBounds() public {
        // Too low
        vm.expectRevert("PriceOracle: 5-50%");
        oracle.setCircuitBreakerThreshold(400);

        // Too high
        vm.expectRevert("PriceOracle: 5-50%");
        oracle.setCircuitBreakerThreshold(6000);
    }

    function test_SetCircuitBreakerThresholdOnlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("PriceOracle: only owner");
        oracle.setCircuitBreakerThreshold(1000);
    }

    function test_SetMinLiquidity() public {
        oracle.setMinLiquidity(5000e18);
        assertEq(oracle.minLiquidity(), 5000e18);
    }

    function test_SetMinLiquidityOnlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("PriceOracle: only owner");
        oracle.setMinLiquidity(5000e18);
    }

    function test_TransferOwnership() public {
        address newOwner = address(0x8888);
        oracle.transferOwnership(newOwner);
        assertEq(oracle.owner(), newOwner);
    }

    function test_TransferOwnershipZeroAddress() public {
        vm.expectRevert("PriceOracle: zero owner");
        oracle.transferOwnership(address(0));
    }

    function test_TransferOwnershipOnlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("PriceOracle: only owner");
        oracle.transferOwnership(address(0x8888));
    }
}
