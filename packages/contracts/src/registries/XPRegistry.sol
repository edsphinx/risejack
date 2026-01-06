// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.28;

/* --------------------------------------------------------------------------
 * XPREGISTRY — PLAYER EXPERIENCE AND LEVEL TRACKING
 * -------------------------------------------------------------------------
 * Tracks player XP and levels with perks for the casino ecosystem.
 *
 * - XP Awards: Games call addXP() after each play based on bet amount
 * - Level Perks: House edge reduction, max bet multiplier, VIP access
 * - Casino Owner: Level 50+ can create MEME tokens via TokenFactory
 * - Vault Creator: Level 40+ can create social trading vaults
 * ------------------------------------------------------------------------*/

/**
 * @title  XPRegistry
 * @author edsphinx
 * @custom:company Blocketh
 * @notice Tracks player XP and levels for casino ecosystem perks.
 * @dev    Level thresholds:
 *         - Level 10: 1,000 XP
 *         - Level 20: 5,000 XP
 *         - Level 30: 15,000 XP (VIP Access)
 *         - Level 40: 40,000 XP (Can create vaults)
 *         - Level 50: 100,000 XP (Casino Owner!)
 */
contract XPRegistry {
    // ----------------------------------------------------------------------
    //  STORAGE
    // ----------------------------------------------------------------------
    // ==================== STATE ====================

    /// @notice Owner (can add authorized games)
    address public owner;

    /// @notice XP per player
    mapping(address => uint256) public xp;

    /// @notice Authorized contracts that can add XP
    mapping(address => bool) public authorizedCallers;

    /// @notice XP required for each level milestone
    uint256[11] public LEVEL_THRESHOLDS = [
        0, // Level 0-9
        1000, // Level 10
        2000, // Level 15
        5000, // Level 20
        10_000, // Level 25
        15_000, // Level 30
        25_000, // Level 35
        40_000, // Level 40
        60_000, // Level 45
        100_000, // Level 50 (Casino Owner!)
        200_000 // Level 60+
    ];

    /// @notice Casino Owner level threshold
    uint256 public constant CASINO_OWNER_XP = 100_000;

    // ==================== EVENTS ====================

    event XPAdded(address indexed player, uint256 amount, uint256 newTotal);
    event LevelUp(address indexed player, uint8 newLevel);
    event CallerAuthorized(address indexed caller);
    event CallerRevoked(address indexed caller);

    // ==================== MODIFIERS ====================

    modifier onlyOwner() {
        require(msg.sender == owner, "XPRegistry: only owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender], "XPRegistry: not authorized");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _owner
    ) {
        require(_owner != address(0), "XPRegistry: zero owner");
        owner = _owner;
    }

    // ==================== PUBLIC FUNCTIONS ====================

    /**
     * @notice Add XP to a player (called by games/casino)
     * @param player Player address
     * @param amount XP to add
     */
    function addXP(
        address player,
        uint256 amount
    ) external onlyAuthorized {
        require(player != address(0), "XPRegistry: zero player");

        uint8 oldLevel = getLevel(player);
        xp[player] += amount;
        uint8 newLevel = getLevel(player);

        emit XPAdded(player, amount, xp[player]);

        if (newLevel > oldLevel) {
            emit LevelUp(player, newLevel);
        }
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get player XP
     */
    function getXP(
        address player
    ) external view returns (uint256) {
        return xp[player];
    }

    /**
     * @notice Get player level (1-100+)
     */
    function getLevel(
        address player
    ) public view returns (uint8) {
        uint256 playerXP = xp[player];

        // Levels 60+: 200,000 + (level-60) * 100,000
        if (playerXP >= 200_000) {
            return uint8(60 + (playerXP - 200_000) / 100_000);
        }

        // Levels 50-59
        if (playerXP >= 100_000) {
            return uint8(50 + (playerXP - 100_000) / 10_000);
        }

        // Levels 40-49
        if (playerXP >= 40_000) {
            return uint8(40 + (playerXP - 40_000) / 6000);
        }

        // Levels 30-39
        if (playerXP >= 15_000) {
            return uint8(30 + (playerXP - 15_000) / 2500);
        }

        // Levels 20-29
        if (playerXP >= 5000) {
            return uint8(20 + (playerXP - 5000) / 1000);
        }

        // Levels 10-19
        if (playerXP >= 1000) {
            return uint8(10 + (playerXP - 1000) / 400);
        }

        // Levels 1-9
        return uint8(1 + playerXP / 125);
    }

    /**
     * @notice Check if player is Casino Owner (Level 50+)
     */
    function isCasinoOwner(
        address player
    ) external view returns (bool) {
        return xp[player] >= CASINO_OWNER_XP;
    }

    /**
     * @notice Get XP needed for next level
     */
    function xpToNextLevel(
        address player
    ) external view returns (uint256) {
        uint8 currentLevel = getLevel(player);
        uint256 playerXP = xp[player];
        uint256 nextLevelXP;

        if (currentLevel >= 60) {
            nextLevelXP = 200_000 + ((currentLevel - 59) * 100_000);
        } else if (currentLevel >= 50) {
            nextLevelXP = 100_000 + ((currentLevel - 49) * 10_000);
        } else if (currentLevel >= 40) {
            nextLevelXP = 40_000 + ((currentLevel - 39) * 6000);
        } else if (currentLevel >= 30) {
            nextLevelXP = 15_000 + ((currentLevel - 29) * 2500);
        } else if (currentLevel >= 20) {
            nextLevelXP = 5000 + ((currentLevel - 19) * 1000);
        } else if (currentLevel >= 10) {
            nextLevelXP = 1000 + ((currentLevel - 9) * 400);
        } else {
            nextLevelXP = currentLevel * 125;
        }

        return nextLevelXP > playerXP ? nextLevelXP - playerXP : 0;
    }

    // ==================== ADMIN FUNCTIONS ====================

    function authorizeCaller(
        address caller
    ) external onlyOwner {
        require(caller != address(0), "XPRegistry: zero caller");
        authorizedCallers[caller] = true;
        emit CallerAuthorized(caller);
    }

    function revokeCaller(
        address caller
    ) external onlyOwner {
        authorizedCallers[caller] = false;
        emit CallerRevoked(caller);
    }

    function transferOwnership(
        address newOwner
    ) external onlyOwner {
        require(newOwner != address(0), "XPRegistry: zero owner");
        owner = newOwner;
    }

    // ==================== LEVEL PERKS ====================

    /**
     * @notice Perks available based on level
     * @dev Used by games to apply bonuses
     */
    struct LevelPerks {
        uint8 level;
        uint256 houseEdgeReductionBps; // Reduce house edge (e.g., 50 = 0.5% reduction)
        uint256 maxBetMultiplier; // Multiply max bet (100 = 1x, 200 = 2x, etc.)
        bool vipTableAccess; // Access to VIP tables
        bool casinoOwner; // Can create tokens
        bool canCreateVault; // Can create social trading vaults
        string title; // Display title
    }

    /**
     * @notice Get perks for a player based on their level
     * @param player Player address
     * @return perks Player's current perks
     */
    function getPlayerPerks(
        address player
    ) external view returns (LevelPerks memory perks) {
        uint8 level = getLevel(player);
        perks.level = level;

        // House edge reduction: 0.1% per 10 levels (max 0.5% at level 50+)
        if (level >= 50) {
            perks.houseEdgeReductionBps = 50; // 0.5%
        } else if (level >= 40) {
            perks.houseEdgeReductionBps = 40; // 0.4%
        } else if (level >= 30) {
            perks.houseEdgeReductionBps = 30; // 0.3%
        } else if (level >= 20) {
            perks.houseEdgeReductionBps = 20; // 0.2%
        } else if (level >= 10) {
            perks.houseEdgeReductionBps = 10; // 0.1%
        } else {
            perks.houseEdgeReductionBps = 0;
        }

        // Max bet multiplier: increases with level
        if (level >= 50) {
            perks.maxBetMultiplier = 500; // 5x max bet
        } else if (level >= 40) {
            perks.maxBetMultiplier = 300; // 3x
        } else if (level >= 30) {
            perks.maxBetMultiplier = 200; // 2x
        } else if (level >= 20) {
            perks.maxBetMultiplier = 150; // 1.5x
        } else {
            perks.maxBetMultiplier = 100; // 1x (base)
        }

        // VIP table access at level 30+
        perks.vipTableAccess = level >= 30;

        // Casino Owner at level 50+
        perks.casinoOwner = level >= 50;

        // Can create vault at level 40+
        perks.canCreateVault = level >= 40;

        // Titles
        if (level >= 50) {
            perks.title = "Casino Owner";
        } else if (level >= 40) {
            perks.title = "High Roller";
        } else if (level >= 30) {
            perks.title = "VIP";
        } else if (level >= 20) {
            perks.title = "Regular";
        } else if (level >= 10) {
            perks.title = "Rookie";
        } else {
            perks.title = "Newcomer";
        }
    }

    /**
     * @notice Get house edge reduction for player (in bps)
     */
    function getHouseEdgeReduction(
        address player
    ) external view returns (uint256) {
        uint8 level = getLevel(player);
        if (level >= 50) return 50;
        if (level >= 40) return 40;
        if (level >= 30) return 30;
        if (level >= 20) return 20;
        if (level >= 10) return 10;
        return 0;
    }

    /**
     * @notice Check if player has VIP access
     */
    function hasVIPAccess(
        address player
    ) external view returns (bool) {
        return getLevel(player) >= 30;
    }

    /**
     * @notice Check if player can create social trading vault
     */
    function canCreateVault(
        address player
    ) external view returns (bool) {
        return getLevel(player) >= 40;
    }
}

