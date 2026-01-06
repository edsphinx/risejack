// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.28;

/* --------------------------------------------------------------------------
 * CHIPWRAPPER — USDC TO CHIP 1:1 EXCHANGE
 * -------------------------------------------------------------------------
 * Deposit & Mint model ensuring 100% USDC backing for all CHIP tokens.
 *
 * - Deposit: USDC → CHIP (0% fee)
 * - Withdraw: CHIP → USDC (0.5% fee)
 * - Solvency: CHIP supply always ≤ USDC reserves
 * - Decimal Handling: USDC (6 dec) ↔ CHIP (18 dec)
 * ------------------------------------------------------------------------*/

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMintableBurnable {
    function mint(
        address to,
        uint256 amount
    ) external;
    function burn(
        address from,
        uint256 amount
    ) external;
}

/**
 * @title  CHIPWrapper
 * @author edsphinx
 * @custom:company Blocketh
 * @notice 1:1 USDC ⟷ CHIP exchange (Deposit & Mint model)
 * @dev Every CHIP in circulation is backed by 1 USDC in this vault
 *
 * FLOW:
 * - Deposit: User sends USDC → Contract mints CHIP (0% fee)
 * - Withdraw: User sends CHIP → Contract burns CHIP, returns USDC (0.5% fee)
 *
 * GUARANTEE: Total CHIP supply ≤ USDC balance (100% solvency)
 */
contract CHIPWrapper is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ==================== STATE ====================

    /// @notice USDC token (backing asset)
    IERC20 public immutable usdc;

    /// @notice CHIP token (casino chips)
    IMintableBurnable public immutable chip;

    /// @notice Treasury for collected fees
    address public treasury;

    /// @notice Owner
    address public owner;

    /// @notice Withdrawal fee in bps (50 = 0.5%)
    uint256 public withdrawFeeBps = 50;

    /// @notice Deposit fee in bps (0 = free)
    uint256 public depositFeeBps = 0;

    /// @notice Paused state
    bool public paused;

    /// @notice Total deposits ever (for stats)
    uint256 public totalDeposited;

    /// @notice Total withdrawals ever (for stats)
    uint256 public totalWithdrawn;

    /// @notice Total fees collected ever
    uint256 public totalFeesCollected;

    // ==================== EVENTS ====================

    event Deposited(address indexed user, uint256 usdcAmount, uint256 chipMinted);
    event Withdrawn(address indexed user, uint256 chipBurned, uint256 usdcReturned, uint256 fee);
    event FeesCollected(address indexed treasury, uint256 amount);
    event FeeUpdated(string feeType, uint256 newBps);
    event Paused(bool isPaused);

    // ==================== MODIFIERS ====================

    modifier onlyOwner() {
        require(msg.sender == owner, "CHIPWrapper: only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "CHIPWrapper: paused");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _usdc,
        address _chip,
        address _treasury,
        address _owner
    ) {
        require(_usdc != address(0), "CHIPWrapper: zero usdc");
        require(_chip != address(0), "CHIPWrapper: zero chip");
        require(_treasury != address(0), "CHIPWrapper: zero treasury");
        require(_owner != address(0), "CHIPWrapper: zero owner");

        usdc = IERC20(_usdc);
        chip = IMintableBurnable(_chip);
        treasury = _treasury;
        owner = _owner;
    }

    // ==================== DEPOSIT (USDC → CHIP) ====================

    /**
     * @notice Deposit USDC and receive CHIP 1:1
     * @param amount USDC amount (6 decimals)
     * @return chipAmount CHIP minted (18 decimals, adjusted)
     */
    function deposit(
        uint256 amount
    ) external nonReentrant whenNotPaused returns (uint256 chipAmount) {
        require(amount > 0, "CHIPWrapper: zero amount");

        // Calculate fee
        uint256 fee = (amount * depositFeeBps) / 10_000;
        uint256 netAmount = amount - fee;

        // Transfer USDC from user
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // If fee, send to treasury
        if (fee > 0) {
            usdc.safeTransfer(treasury, fee);
            totalFeesCollected += fee;
        }

        // Convert 6 decimals (USDC) to 18 decimals (CHIP)
        chipAmount = netAmount * 1e12;

        // Mint CHIP to user
        chip.mint(msg.sender, chipAmount);

        totalDeposited += amount;

        emit Deposited(msg.sender, amount, chipAmount);
    }

    // ==================== WITHDRAW (CHIP → USDC) ====================

    /**
     * @notice Withdraw CHIP and receive USDC 1:1 (minus fee)
     * @param chipAmount CHIP amount (18 decimals)
     * @return usdcAmount USDC returned (6 decimals, minus fee)
     */
    function withdraw(
        uint256 chipAmount
    ) external nonReentrant whenNotPaused returns (uint256 usdcAmount) {
        require(chipAmount > 0, "CHIPWrapper: zero amount");

        // Convert 18 decimals (CHIP) to 6 decimals (USDC)
        uint256 grossUsdc = chipAmount / 1e12;
        require(grossUsdc > 0, "CHIPWrapper: amount too small");

        // Calculate fee
        uint256 fee = (grossUsdc * withdrawFeeBps) / 10_000;
        usdcAmount = grossUsdc - fee;

        // Check vault has enough USDC
        require(usdc.balanceOf(address(this)) >= grossUsdc, "CHIPWrapper: insufficient reserves");

        // Burn CHIP from user
        chip.burn(msg.sender, chipAmount);

        // Transfer USDC to user
        usdc.safeTransfer(msg.sender, usdcAmount);

        // If fee, send to treasury
        if (fee > 0) {
            usdc.safeTransfer(treasury, fee);
            totalFeesCollected += fee;
        }

        totalWithdrawn += grossUsdc;

        emit Withdrawn(msg.sender, chipAmount, usdcAmount, fee);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get total USDC reserves (backing all CHIP)
     */
    function getReserves() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Check if 100% solvent (reserves >= CHIP supply)
     */
    function isSolvent() external view returns (bool) {
        uint256 reserves = usdc.balanceOf(address(this));
        uint256 chipSupply = IERC20(address(chip)).totalSupply();
        // CHIP is 18 decimals, USDC is 6, adjust
        uint256 chipInUsdc = chipSupply / 1e12;
        return reserves >= chipInUsdc;
    }

    /**
     * @notice Get quote for deposit
     */
    function quoteDeposit(
        uint256 usdcAmount
    ) external view returns (uint256 chipOut, uint256 fee) {
        fee = (usdcAmount * depositFeeBps) / 10_000;
        chipOut = (usdcAmount - fee) * 1e12;
    }

    /**
     * @notice Get quote for withdrawal
     */
    function quoteWithdraw(
        uint256 chipAmount
    ) external view returns (uint256 usdcOut, uint256 fee) {
        uint256 grossUsdc = chipAmount / 1e12;
        fee = (grossUsdc * withdrawFeeBps) / 10_000;
        usdcOut = grossUsdc - fee;
    }

    // ==================== ADMIN ====================

    function setDepositFee(
        uint256 bps
    ) external onlyOwner {
        require(bps <= 100, "CHIPWrapper: max 1%");
        depositFeeBps = bps;
        emit FeeUpdated("deposit", bps);
    }

    function setWithdrawFee(
        uint256 bps
    ) external onlyOwner {
        require(bps <= 200, "CHIPWrapper: max 2%");
        withdrawFeeBps = bps;
        emit FeeUpdated("withdraw", bps);
    }

    function setTreasury(
        address _treasury
    ) external onlyOwner {
        require(_treasury != address(0), "CHIPWrapper: zero treasury");
        treasury = _treasury;
    }

    function setPaused(
        bool _paused
    ) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function transferOwnership(
        address newOwner
    ) external onlyOwner {
        require(newOwner != address(0), "CHIPWrapper: zero owner");
        owner = newOwner;
    }

    // Emergency: recover stuck tokens (not USDC)
    function emergencyRecover(
        address token,
        uint256 amount
    ) external onlyOwner {
        require(token != address(usdc), "CHIPWrapper: cannot recover reserves");
        IERC20(token).safeTransfer(owner, amount);
    }
}
