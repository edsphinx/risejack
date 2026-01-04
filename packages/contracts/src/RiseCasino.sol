// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IRiseGame } from "./interfaces/IRiseGame.sol";

interface IRiseTreasury {
    function payout(
        address to,
        address token,
        uint256 amount
    ) external;
    function balance(
        address token
    ) external view returns (uint256);
}

interface IXPRegistry {
    function addXP(
        address user,
        uint256 amount
    ) external;
    function getLevel(
        address user
    ) external view returns (uint8);
    function getHouseEdgeReduction(
        address user
    ) external view returns (uint256);
}

interface IReferralRegistry {
    function recordEarnings(
        address player,
        address token,
        uint256 houseEdgeAmount,
        uint256 betAmount
    ) external;
    function setReferrer(
        address referrer
    ) external;
}

/**
 * @title RiseCasino
 * @notice Central orchestrator for all casino games
 * @dev Handles house edge, referrals, token whitelist, and game routing
 *
 * FLOW:
 * 1. Player approves CHIP to RiseCasino
 * 2. Player calls play(game, token, amount, params)
 * 3. RiseCasino transfers tokens from player to Treasury
 * 4. RiseCasino calls game.play()
 * 5. Game returns result (won, payout)
 * 6. RiseCasino calculates house edge and referral share
 * 7. RiseCasino requests Treasury to payout net amount
 */
contract RiseCasino is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ==================== STATE ====================

    /// @notice Treasury contract
    IRiseTreasury public immutable treasury;

    /// @notice XP Registry for level tracking
    IXPRegistry public xpRegistry;

    /// @notice Referral Registry for multi-tier referrals
    IReferralRegistry public referralRegistry;

    /// @notice Owner (SAFE multisig)
    address public owner;

    /// @notice Paused state
    bool public paused;

    /// @notice Registered games
    mapping(address => bool) public registeredGames;

    /// @notice Whitelisted tokens
    mapping(address => bool) public whitelistedTokens;

    /// @notice CHIP token (always whitelisted)
    address public immutable chipToken;

    /// @notice Referrer relationships (legacy - use referralRegistry)
    mapping(address => address) public referrers;

    /// @notice Referral earnings per token (legacy - use referralRegistry)
    mapping(address => mapping(address => uint256)) public referralEarnings;

    // ==================== CONFIG ====================

    /// @notice House edge in basis points (200 = 2%)
    uint256 public houseEdgeBps = 200;

    /// @notice Referral share of house edge in bps (5000 = 50%)
    uint256 public referralShareBps = 5000;

    /// @notice Treasury share of house edge in bps (3000 = 30%)
    uint256 public treasuryShareBps = 3000;

    /// @notice Buyback share of house edge in bps (2000 = 20%)
    uint256 public buybackShareBps = 2000;

    /// @notice Buyback wallet
    address public buybackWallet;

    /// @notice XP per bet unit (e.g., 1 XP per CHIP bet)
    uint256 public xpPerBet = 1;

    // ==================== CHIP TIERS ====================

    /// @notice Visual chip tiers for frontend
    uint256[12] public CHIP_TIERS = [
        1e18, // 0: 1 CHIP (white)
        5e18, // 1: 5 CHIP (red)
        10e18, // 2: 10 CHIP (blue)
        50e18, // 3: 50 CHIP (green)
        100e18, // 4: 100 CHIP (black)
        1000e18, // 5: 1K CHIP (purple)
        5000e18, // 6: 5K CHIP (orange)
        10_000e18, // 7: 10K CHIP (yellow)
        50_000e18, // 8: 50K CHIP (pink)
        100_000e18, // 9: 100K CHIP (cyan)
        500_000e18, // 10: 500K CHIP (gold)
        1_000_000e18 // 11: 1M CHIP (diamond)
    ];

    // ==================== EVENTS ====================

    event GameRegistered(address indexed game);
    event GameUnregistered(address indexed game);
    event TokenWhitelisted(address indexed token);
    event TokenRemoved(address indexed token);
    event ReferrerSet(address indexed player, address indexed referrer);
    event ReferralEarningsClaimed(address indexed referrer, address indexed token, uint256 amount);
    event GamePlayed(
        address indexed player,
        address indexed game,
        address indexed token,
        uint256 bet,
        bool won,
        uint256 netPayout,
        uint256 houseEdge
    );
    event XPAwarded(address indexed player, uint256 amount);

    // ==================== MODIFIERS ====================

    modifier onlyOwner() {
        require(msg.sender == owner, "RiseCasino: only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "RiseCasino: paused");
        _;
    }

    modifier onlyRegisteredGame() {
        require(registeredGames[msg.sender], "RiseCasino: not registered game");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _treasury,
        address _chipToken,
        address _owner,
        address _buybackWallet
    ) {
        require(_treasury != address(0), "RiseCasino: zero treasury");
        require(_chipToken != address(0), "RiseCasino: zero chip");
        require(_owner != address(0), "RiseCasino: zero owner");

        treasury = IRiseTreasury(_treasury);
        chipToken = _chipToken;
        owner = _owner;
        buybackWallet = _buybackWallet;

        // CHIP is always whitelisted
        whitelistedTokens[_chipToken] = true;
    }

    // ==================== PLAYER FUNCTIONS ====================

    /**
     * @notice Play a game
     * @param game Game contract address
     * @param token Token to bet (must be whitelisted)
     * @param amount Bet amount
     * @param gameData Game-specific parameters
     */
    function play(
        address game,
        address token,
        uint256 amount,
        bytes calldata gameData
    ) external whenNotPaused nonReentrant returns (IRiseGame.GameResult memory result) {
        // Validations
        require(registeredGames[game], "RiseCasino: game not registered");
        require(whitelistedTokens[token], "RiseCasino: token not whitelisted");
        require(amount > 0, "RiseCasino: zero bet");
        require(
            amount >= IRiseGame(game).minBet(token) && amount <= IRiseGame(game).maxBet(token),
            "RiseCasino: bet out of range"
        );

        // Transfer bet from player to treasury
        IERC20(token).safeTransferFrom(msg.sender, address(treasury), amount);

        // Determine chip tier for display
        uint8 chipTier = _getChipTier(amount);

        // Call game
        IRiseGame.BetInfo memory betInfo =
            IRiseGame.BetInfo({ token: token, amount: amount, chipTier: chipTier });

        result = IRiseGame(game).play(msg.sender, betInfo, gameData);

        // Process result
        if (result.won && result.payout > 0) {
            _processWin(msg.sender, token, result.payout);
        }

        // Award XP (based on bet amount)
        _awardXP(msg.sender, amount);

        emit GamePlayed(
            msg.sender,
            game,
            token,
            amount,
            result.won,
            result.won ? _calculateNetPayout(result.payout) : 0,
            result.won ? _calculateHouseEdge(result.payout) : 0
        );
    }

    /**
     * @notice Set referrer for caller
     * @param referrer Referrer address
     */
    function setReferrer(
        address referrer
    ) external {
        require(referrers[msg.sender] == address(0), "RiseCasino: referrer already set");
        require(referrer != address(0), "RiseCasino: zero referrer");
        require(referrer != msg.sender, "RiseCasino: self referral");

        referrers[msg.sender] = referrer;
        emit ReferrerSet(msg.sender, referrer);
    }

    /**
     * @notice Claim accumulated referral earnings
     * @param token Token to claim
     */
    function claimReferralEarnings(
        address token
    ) external nonReentrant {
        uint256 earnings = referralEarnings[msg.sender][token];
        require(earnings > 0, "RiseCasino: no earnings");

        referralEarnings[msg.sender][token] = 0;
        treasury.payout(msg.sender, token, earnings);

        emit ReferralEarningsClaimed(msg.sender, token, earnings);
    }

    // ==================== ADMIN FUNCTIONS ====================

    function registerGame(
        address game
    ) external onlyOwner {
        require(game != address(0), "RiseCasino: zero game");
        registeredGames[game] = true;
        emit GameRegistered(game);
    }

    function unregisterGame(
        address game
    ) external onlyOwner {
        registeredGames[game] = false;
        emit GameUnregistered(game);
    }

    function whitelistToken(
        address token
    ) external onlyOwner {
        require(token != address(0), "RiseCasino: zero token");
        whitelistedTokens[token] = true;
        emit TokenWhitelisted(token);
    }

    function removeToken(
        address token
    ) external onlyOwner {
        require(token != chipToken, "RiseCasino: cannot remove CHIP");
        whitelistedTokens[token] = false;
        emit TokenRemoved(token);
    }

    function setHouseEdge(
        uint256 bps
    ) external onlyOwner {
        require(bps <= 1000, "RiseCasino: max 10%");
        houseEdgeBps = bps;
    }

    function setReferralShare(
        uint256 bps
    ) external onlyOwner {
        require(bps <= 10_000, "RiseCasino: max 100%");
        referralShareBps = bps;
    }

    function setXPRegistry(
        address _xpRegistry
    ) external onlyOwner {
        xpRegistry = IXPRegistry(_xpRegistry);
    }

    function setBuybackWallet(
        address _wallet
    ) external onlyOwner {
        buybackWallet = _wallet;
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    function transferOwnership(
        address newOwner
    ) external onlyOwner {
        require(newOwner != address(0), "RiseCasino: zero owner");
        owner = newOwner;
    }

    // ==================== VIEW FUNCTIONS ====================

    function getChipTier(
        uint256 amount
    ) external view returns (uint8) {
        return _getChipTier(amount);
    }

    function getAvailableChipTiers(
        address player,
        address token
    ) external view returns (bool[12] memory available) {
        uint256 balance = IERC20(token).balanceOf(player);
        for (uint8 i = 0; i < 12; i++) {
            available[i] = balance >= CHIP_TIERS[i];
        }
    }

    // ==================== INTERNAL ====================

    function _processWin(
        address player,
        address token,
        uint256 grossPayout
    ) internal {
        uint256 houseEdge = _calculateHouseEdge(grossPayout);
        uint256 netPayout = grossPayout - houseEdge;

        // Distribute house edge
        if (houseEdge > 0) {
            address referrer = referrers[player];

            if (referrer != address(0)) {
                // Referrer gets their share
                uint256 referralAmount = (houseEdge * referralShareBps) / 10_000;
                referralEarnings[referrer][token] += referralAmount;
            }

            // Buyback wallet gets their share (sent directly)
            if (buybackWallet != address(0)) {
                uint256 buybackAmount = (houseEdge * buybackShareBps) / 10_000;
                if (buybackAmount > 0) {
                    treasury.payout(buybackWallet, token, buybackAmount);
                }
            }
            // Treasury keeps remaining (already in treasury)
        }

        // Pay player
        if (netPayout > 0) {
            treasury.payout(player, token, netPayout);
        }
    }

    function _calculateHouseEdge(
        uint256 payout
    ) internal view returns (uint256) {
        return (payout * houseEdgeBps) / 10_000;
    }

    function _calculateNetPayout(
        uint256 grossPayout
    ) internal view returns (uint256) {
        return grossPayout - _calculateHouseEdge(grossPayout);
    }

    function _getChipTier(
        uint256 amount
    ) internal view returns (uint8) {
        for (uint8 i = 11; i > 0; i--) {
            if (amount >= CHIP_TIERS[i]) return i;
        }
        return 0;
    }

    function _awardXP(
        address player,
        uint256 betAmount
    ) internal {
        if (address(xpRegistry) != address(0)) {
            uint256 xp = (betAmount / 1e18) * xpPerBet;
            if (xp > 0) {
                xpRegistry.addXP(player, xp);
                emit XPAwarded(player, xp);
            }
        }
    }
}
