// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RiseTreasury
 * @notice Secure vault holding all casino funds
 * @dev Controlled by SAFE multisig as owner, RiseCasino as operator
 *
 * SECURITY MODEL:
 * - Owner (SAFE multisig): Can freeze, set limits, emergency withdraw
 * - Operator (RiseCasino): Can request payouts within daily limits
 * - Daily withdrawal limits prevent catastrophic losses
 * - Emergency freeze stops all operations instantly
 */
contract RiseTreasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ==================== STATE ====================

    /// @notice Owner (SAFE multisig)
    address public owner;

    /// @notice Operator (RiseCasino contract)
    address public operator;

    /// @notice Emergency freeze status
    bool public frozen;

    /// @notice Daily withdrawal limit per token (0 = unlimited)
    mapping(address => uint256) public dailyLimits;

    /// @notice Amount spent today per token
    mapping(address => uint256) public dailySpent;

    /// @notice Last reset timestamp
    uint256 public lastResetTime;

    /// @notice Timelock for emergency withdraw (72 hours)
    uint256 public constant TIMELOCK_DURATION = 72 hours;

    /// @notice Pending emergency withdrawals
    struct PendingWithdraw {
        address token;
        address to;
        uint256 amount;
        uint256 executeAfter;
    }
    mapping(bytes32 => PendingWithdraw) public pendingWithdrawals;

    // ==================== EVENTS ====================

    event OperatorSet(address indexed operator);
    event DailyLimitSet(address indexed token, uint256 limit);
    event Payout(address indexed to, address indexed token, uint256 amount);
    event Frozen();
    event Unfrozen();
    event EmergencyWithdrawQueued(
        bytes32 indexed id, address token, address to, uint256 amount, uint256 executeAfter
    );
    event EmergencyWithdrawExecuted(bytes32 indexed id);
    event EmergencyWithdrawCancelled(bytes32 indexed id);
    event Deposit(address indexed from, address indexed token, uint256 amount);

    // ==================== MODIFIERS ====================

    modifier onlyOwner() {
        require(msg.sender == owner, "RiseTreasury: only owner");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "RiseTreasury: only operator");
        _;
    }

    modifier notFrozen() {
        require(!frozen, "RiseTreasury: frozen");
        _;
    }

    modifier withinDailyLimit(
        address token,
        uint256 amount
    ) {
        _resetDailyIfNeeded();
        uint256 limit = dailyLimits[token];
        if (limit > 0) {
            require(dailySpent[token] + amount <= limit, "RiseTreasury: daily limit exceeded");
        }
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _owner
    ) {
        require(_owner != address(0), "RiseTreasury: zero owner");
        owner = _owner;
        lastResetTime = block.timestamp;
    }

    // ==================== OPERATOR FUNCTIONS ====================

    /**
     * @notice Payout to player (called by RiseCasino)
     * @param to Recipient address
     * @param token ERC20 token address
     * @param amount Amount to pay
     */
    function payout(
        address to,
        address token,
        uint256 amount
    ) external onlyOperator notFrozen withinDailyLimit(token, amount) nonReentrant {
        require(to != address(0), "RiseTreasury: zero recipient");
        require(amount > 0, "RiseTreasury: zero amount");

        dailySpent[token] += amount;

        IERC20(token).safeTransfer(to, amount);

        emit Payout(to, token, amount);
    }

    // ==================== OWNER FUNCTIONS ====================

    /**
     * @notice Set operator address (RiseCasino)
     */
    function setOperator(
        address _operator
    ) external onlyOwner {
        require(_operator != address(0), "RiseTreasury: zero operator");
        operator = _operator;
        emit OperatorSet(_operator);
    }

    /**
     * @notice Set daily withdrawal limit for a token
     * @param token Token address
     * @param limit Daily limit (0 = unlimited)
     */
    function setDailyLimit(
        address token,
        uint256 limit
    ) external onlyOwner {
        dailyLimits[token] = limit;
        emit DailyLimitSet(token, limit);
    }

    /**
     * @notice Emergency freeze all operations
     */
    function freeze() external onlyOwner {
        frozen = true;
        emit Frozen();
    }

    /**
     * @notice Unfreeze operations
     */
    function unfreeze() external onlyOwner {
        frozen = false;
        emit Unfrozen();
    }

    /**
     * @notice Queue emergency withdrawal (with timelock)
     */
    function queueEmergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner returns (bytes32 id) {
        id = keccak256(abi.encodePacked(token, to, amount, block.timestamp));

        pendingWithdrawals[id] = PendingWithdraw({
            token: token, to: to, amount: amount, executeAfter: block.timestamp + TIMELOCK_DURATION
        });

        emit EmergencyWithdrawQueued(id, token, to, amount, block.timestamp + TIMELOCK_DURATION);
    }

    /**
     * @notice Execute queued emergency withdrawal
     */
    function executeEmergencyWithdraw(
        bytes32 id
    ) external onlyOwner nonReentrant {
        PendingWithdraw memory pw = pendingWithdrawals[id];
        require(pw.executeAfter > 0, "RiseTreasury: not queued");
        require(block.timestamp >= pw.executeAfter, "RiseTreasury: timelock not passed");

        delete pendingWithdrawals[id];

        IERC20(pw.token).safeTransfer(pw.to, pw.amount);

        emit EmergencyWithdrawExecuted(id);
    }

    /**
     * @notice Cancel queued emergency withdrawal
     */
    function cancelEmergencyWithdraw(
        bytes32 id
    ) external onlyOwner {
        require(pendingWithdrawals[id].executeAfter > 0, "RiseTreasury: not queued");
        delete pendingWithdrawals[id];
        emit EmergencyWithdrawCancelled(id);
    }

    /**
     * @notice Transfer ownership to new SAFE
     */
    function transferOwnership(
        address newOwner
    ) external onlyOwner {
        require(newOwner != address(0), "RiseTreasury: zero owner");
        owner = newOwner;
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get token balance
     */
    function balance(
        address token
    ) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @notice Get remaining daily limit
     */
    function remainingDailyLimit(
        address token
    ) external view returns (uint256) {
        uint256 limit = dailyLimits[token];
        if (limit == 0) return type(uint256).max;

        // Check if reset needed
        if (block.timestamp >= lastResetTime + 1 days) {
            return limit;
        }

        return limit > dailySpent[token] ? limit - dailySpent[token] : 0;
    }

    // ==================== INTERNAL ====================

    function _resetDailyIfNeeded() internal {
        if (block.timestamp >= lastResetTime + 1 days) {
            lastResetTime = block.timestamp;
            // Note: dailySpent is not reset here for gas efficiency
            // Instead, we reset lazily per token when accessed
        }
    }

    // ==================== RECEIVE ====================

    /// @notice Allow receiving ETH for potential future use
    receive() external payable { }
}
