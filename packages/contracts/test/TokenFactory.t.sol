// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { TokenFactory, MemeToken } from "../src/tokens/TokenFactory.sol";
import { CHIPToken } from "../src/tokens/defi/CHIPToken.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Mock XP Registry for level verification
contract MockXPRegistry {
    mapping(address => bool) public casinoOwners;
    mapping(address => uint8) public levels;

    function setCasinoOwner(
        address user,
        bool isOwner
    ) external {
        casinoOwners[user] = isOwner;
        if (isOwner) levels[user] = 50;
    }

    function isCasinoOwner(
        address user
    ) external view returns (bool) {
        return casinoOwners[user];
    }

    function getLevel(
        address user
    ) external view returns (uint8) {
        return levels[user];
    }
}

/// @dev Mock Uniswap V2 Factory
contract MockUniswapFactory {
    mapping(address => mapping(address => address)) public pairs;
    uint256 public pairCount;

    function createPair(
        address tokenA,
        address tokenB
    ) external returns (address pair) {
        pair = address(uint160(uint256(keccak256(abi.encodePacked(tokenA, tokenB, pairCount++)))));
        pairs[tokenA][tokenB] = pair;
        pairs[tokenB][tokenA] = pair;
        return pair;
    }

    function getPair(
        address tokenA,
        address tokenB
    ) external view returns (address) {
        return pairs[tokenA][tokenB];
    }
}

/// @dev Mock Uniswap V2 Router
contract MockUniswapRouter {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256,
        uint256,
        address to,
        uint256
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        // Transfer tokens from sender
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountADesired);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountBDesired);

        amountA = amountADesired;
        amountB = amountBDesired;
        liquidity = (amountADesired + amountBDesired) / 2; // Mock LP amount

        // In real scenario, LP tokens would be minted to `to`
        // We just return values
    }
}

/**
 * @title TokenFactory Test Suite
 * @notice Comprehensive tests for meme token creation by Casino Owners
 */
contract TokenFactoryTest is Test {
    TokenFactory factory;
    CHIPToken chip;
    MockXPRegistry xpRegistry;
    MockUniswapFactory uniFactory;
    MockUniswapRouter uniRouter;

    address owner = address(this);
    address casinoOwner = address(0x5050);
    address regularUser = address(0x1);

    uint256 constant CREATION_FEE = 1000e18;
    uint256 constant MIN_LIQUIDITY = 10_000e18;

    function setUp() public {
        // Deploy mocks
        xpRegistry = new MockXPRegistry();
        uniFactory = new MockUniswapFactory();
        uniRouter = new MockUniswapRouter();

        // Deploy CHIP
        chip = new CHIPToken(owner);

        // Deploy factory
        factory = new TokenFactory(
            address(xpRegistry), address(uniFactory), address(uniRouter), address(chip), owner
        );

        // Setup casino owner
        xpRegistry.setCasinoOwner(casinoOwner, true);

        // Give CHIP to casino owner for creation (enough for multiple token creates)
        chip.transfer(casinoOwner, 1_000_000e18);

        // Labels
        vm.label(address(factory), "TokenFactory");
        vm.label(address(chip), "CHIP");
        vm.label(casinoOwner, "CasinoOwner");
        vm.label(regularUser, "RegularUser");
    }

    // ==================== DEPLOYMENT ====================

    function test_Deployment() public view {
        assertEq(address(factory.xpRegistry()), address(xpRegistry));
        assertEq(address(factory.uniswapFactory()), address(uniFactory));
        assertEq(address(factory.uniswapRouter()), address(uniRouter));
        assertEq(factory.chipToken(), address(chip));
        assertEq(factory.owner(), owner);
        assertEq(factory.creationFee(), CREATION_FEE);
        assertEq(factory.minChipLiquidity(), MIN_LIQUIDITY);
        assertEq(factory.creatorShareBps(), 2000); // 20%
    }

    // ==================== TOKEN CREATION ====================

    function test_CreateToken() public {
        vm.startPrank(casinoOwner);

        // Approve CHIP for fee + liquidity
        uint256 totalChip = CREATION_FEE + MIN_LIQUIDITY;
        chip.approve(address(factory), totalChip);

        (address token, address lpPair) =
            factory.createToken(
                "Test Meme",
                "MEME",
                1_000_000e18, // 1M supply
                MIN_LIQUIDITY
            );

        // Verify token created
        assertTrue(token != address(0));
        assertTrue(lpPair != address(0));

        // Verify token info
        (
            address recordedToken,
            address creator,
            address recordedPair,
            uint256 lpAmount,,
            uint256 createdAt
        ) = factory.tokenInfo(token);

        assertEq(recordedToken, token);
        assertEq(creator, casinoOwner);
        assertEq(recordedPair, lpPair);
        assertGt(lpAmount, 0);
        assertEq(createdAt, block.timestamp);

        // Verify creator received 20% of supply
        uint256 creatorBalance = IERC20(token).balanceOf(casinoOwner);
        assertEq(creatorBalance, 200_000e18); // 20% of 1M

        vm.stopPrank();
    }

    function test_CreateTokenNotCasinoOwner() public {
        vm.startPrank(regularUser);

        chip.approve(address(factory), CREATION_FEE + MIN_LIQUIDITY);

        vm.expectRevert("TokenFactory: must be Level 50+");
        factory.createToken("Test", "TST", 1_000_000e18, MIN_LIQUIDITY);

        vm.stopPrank();
    }

    function test_CreateTokenEmptyName() public {
        vm.startPrank(casinoOwner);
        chip.approve(address(factory), CREATION_FEE + MIN_LIQUIDITY);

        vm.expectRevert("TokenFactory: empty name");
        factory.createToken("", "TST", 1_000_000e18, MIN_LIQUIDITY);

        vm.stopPrank();
    }

    function test_CreateTokenEmptySymbol() public {
        vm.startPrank(casinoOwner);
        chip.approve(address(factory), CREATION_FEE + MIN_LIQUIDITY);

        vm.expectRevert("TokenFactory: empty symbol");
        factory.createToken("Test", "", 1_000_000e18, MIN_LIQUIDITY);

        vm.stopPrank();
    }

    function test_CreateTokenZeroSupply() public {
        vm.startPrank(casinoOwner);
        chip.approve(address(factory), CREATION_FEE + MIN_LIQUIDITY);

        vm.expectRevert("TokenFactory: zero supply");
        factory.createToken("Test", "TST", 0, MIN_LIQUIDITY);

        vm.stopPrank();
    }

    function test_CreateTokenInsufficientLiquidity() public {
        vm.startPrank(casinoOwner);
        chip.approve(address(factory), CREATION_FEE + 5000e18);

        vm.expectRevert("TokenFactory: insufficient CHIP");
        factory.createToken("Test", "TST", 1_000_000e18, 5000e18); // Less than min

        vm.stopPrank();
    }

    // ==================== VIEW FUNCTIONS ====================

    function test_GetAllTokens() public {
        vm.startPrank(casinoOwner);
        chip.approve(address(factory), (CREATION_FEE + MIN_LIQUIDITY) * 2);

        factory.createToken("Token1", "TK1", 1_000_000e18, MIN_LIQUIDITY);
        factory.createToken("Token2", "TK2", 1_000_000e18, MIN_LIQUIDITY);

        address[] memory tokens = factory.getAllTokens();
        assertEq(tokens.length, 2);

        vm.stopPrank();
    }

    function test_GetTokensByCreator() public {
        vm.startPrank(casinoOwner);
        chip.approve(address(factory), (CREATION_FEE + MIN_LIQUIDITY) * 2);

        factory.createToken("Token1", "TK1", 1_000_000e18, MIN_LIQUIDITY);
        factory.createToken("Token2", "TK2", 1_000_000e18, MIN_LIQUIDITY);

        address[] memory tokens = factory.getTokensByCreator(casinoOwner);
        assertEq(tokens.length, 2);

        vm.stopPrank();
    }

    function test_GetTokenCount() public {
        vm.startPrank(casinoOwner);
        chip.approve(address(factory), CREATION_FEE + MIN_LIQUIDITY);

        assertEq(factory.getTokenCount(), 0);

        factory.createToken("Token1", "TK1", 1_000_000e18, MIN_LIQUIDITY);

        assertEq(factory.getTokenCount(), 1);

        vm.stopPrank();
    }

    function test_IsLPLocked() public {
        vm.startPrank(casinoOwner);
        chip.approve(address(factory), CREATION_FEE + MIN_LIQUIDITY);

        (, address lpPair) = factory.createToken("Token1", "TK1", 1_000_000e18, MIN_LIQUIDITY);

        assertTrue(factory.isLPLocked(lpPair));
        assertFalse(factory.isLPLocked(address(0x1234)));

        vm.stopPrank();
    }

    // ==================== ADMIN ====================

    function test_SetCreationFee() public {
        factory.setCreationFee(500e18);
        assertEq(factory.creationFee(), 500e18);
    }

    function test_SetCreationFeeOnlyOwner() public {
        vm.prank(regularUser);
        vm.expectRevert("TokenFactory: only owner");
        factory.setCreationFee(500e18);
    }

    function test_SetMinLiquidity() public {
        factory.setMinLiquidity(5000e18);
        assertEq(factory.minChipLiquidity(), 5000e18);
    }

    function test_SetMinLiquidityOnlyOwner() public {
        vm.prank(regularUser);
        vm.expectRevert("TokenFactory: only owner");
        factory.setMinLiquidity(5000e18);
    }

    function test_SetCreatorShare() public {
        factory.setCreatorShare(3000); // 30%
        assertEq(factory.creatorShareBps(), 3000);
    }

    function test_SetCreatorShareMaxLimit() public {
        vm.expectRevert("TokenFactory: max 50%");
        factory.setCreatorShare(5001);
    }

    function test_SetCreatorShareOnlyOwner() public {
        vm.prank(regularUser);
        vm.expectRevert("TokenFactory: only owner");
        factory.setCreatorShare(3000);
    }

    // ==================== TWO-STEP OWNERSHIP ====================

    function test_TransferOwnership() public {
        factory.transferOwnership(casinoOwner);
        assertEq(factory.pendingOwner(), casinoOwner);
        assertEq(factory.owner(), owner); // Still owner
    }

    function test_AcceptOwnership() public {
        factory.transferOwnership(casinoOwner);

        vm.prank(casinoOwner);
        factory.acceptOwnership();

        assertEq(factory.owner(), casinoOwner);
        assertEq(factory.pendingOwner(), address(0));
    }

    function test_AcceptOwnershipNotPending() public {
        factory.transferOwnership(casinoOwner);

        vm.prank(regularUser);
        vm.expectRevert("TokenFactory: not pending owner");
        factory.acceptOwnership();
    }

    function test_TransferOwnershipOnlyOwner() public {
        vm.prank(regularUser);
        vm.expectRevert("TokenFactory: only owner");
        factory.transferOwnership(casinoOwner);
    }

    function test_TransferOwnershipZeroAddress() public {
        vm.expectRevert("TokenFactory: zero owner");
        factory.transferOwnership(address(0));
    }

    // ==================== MEME TOKEN ====================

    function test_MemeTokenMetadata() public {
        vm.startPrank(casinoOwner);
        chip.approve(address(factory), CREATION_FEE + MIN_LIQUIDITY);

        (address token,) = factory.createToken("Cool Meme", "COOL", 1_000_000e18, MIN_LIQUIDITY);

        MemeToken meme = MemeToken(token);
        assertEq(meme.name(), "Cool Meme");
        assertEq(meme.symbol(), "COOL");
        // MemeToken records the address that received the initial mint (factory)
        // The actual creator is tracked in TokenFactory.tokenInfo
        assertEq(meme.creator(), address(factory));
        assertEq(meme.createdAt(), block.timestamp);

        // Verify TokenFactory tracks the actual creator
        (, address creator,,,,) = factory.tokenInfo(token);
        assertEq(creator, casinoOwner);

        vm.stopPrank();
    }

    // ==================== ZERO FEE CREATION ====================

    function test_CreateTokenWithZeroFee() public {
        // Set zero creation fee
        factory.setCreationFee(0);

        vm.startPrank(casinoOwner);
        chip.approve(address(factory), MIN_LIQUIDITY);

        uint256 chipBefore = chip.balanceOf(casinoOwner);

        factory.createToken("NoFee", "NFT", 1_000_000e18, MIN_LIQUIDITY);

        // Only liquidity was taken, no fee
        assertEq(chip.balanceOf(casinoOwner), chipBefore - MIN_LIQUIDITY);

        vm.stopPrank();
    }
}
