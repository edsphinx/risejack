// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.28;

/* --------------------------------------------------------------------------
 * CHIPWRAPPER — MULTI-ASSET TO CHIP EXCHANGE
 * -------------------------------------------------------------------------
 * Deposit & Mint model with oracle-based pricing.
 * Users can buy CHIP with ETH, USDC, USDT, or WBTC at current USD prices.
 *
 * - 1 CHIP = 1 USD (backed by deposited assets)
 * - Deposit: Asset → CHIP (0% fee, oracle pricing)
 * - Withdraw: CHIP → USDC (0.5% fee, 1:1)
 * ------------------------------------------------------------------------*/

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";
import { IPermit2 } from "../interfaces/IPermit2.sol";

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
 * @notice Multi-asset CHIP minting with Rise Chain oracle pricing
 * @dev Every CHIP is worth 1 USD, backed by deposited assets
 *
 * SUPPORTED ASSETS:
 * - ETH  (native, via depositETH)
 * - USDC (ERC20, via deposit or depositToken)
 * - USDT (ERC20, via depositToken)
 * - WBTC (ERC20, via depositToken)
 */
contract CHIPWrapper is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ==================== CONSTANTS ====================

    /// @notice Oracle price decimals (Rise oracles use 8)
    uint256 public constant ORACLE_DECIMALS = 8;

    /// @notice CHIP token decimals
    uint256 public constant CHIP_DECIMALS = 18;

    /// @notice Permit2 contract address (pre-deployed on Rise Testnet)
    IPermit2 public constant PERMIT2 = IPermit2(0x000000000022D473030F116dDEE9F6B43aC78BA3);

    // ==================== STATE ====================

    /// @notice USDC token (primary backing asset for withdrawals)
    IERC20 public immutable usdc;

    /// @notice CHIP token (casino chips)
    IMintableBurnable public immutable chip;

    /// @notice Treasury for collected fees
    address public treasury;

    /// @notice Owner
    address public owner;

    /// @notice Pending owner for two-step transfer
    address public pendingOwner;

    /// @notice Withdrawal fee in bps (50 = 0.5%)
    uint256 public withdrawFeeBps = 50;

    /// @notice Deposit fee in bps (0 = free)
    uint256 public depositFeeBps = 0;

    /// @notice Paused state
    bool public paused;

    // ==================== MULTI-ASSET SUPPORT ====================

    /// @notice Asset configuration for oracle-based deposits
    struct AssetConfig {
        address token; // Token address (address(0) for ETH)
        address oracle; // Price oracle address
        uint8 decimals; // Token decimals (18 for ETH, 6 for USDC/USDT, 8 for WBTC)
        bool enabled; // Is asset enabled for deposit
    }

    /// @notice Supported assets by key (e.g., "ETH", "USDC", "USDT", "WBTC")
    mapping(bytes32 => AssetConfig) public supportedAssets;

    /// @notice List of asset keys for iteration
    bytes32[] public assetKeys;

    // ==================== STATS ====================

    /// @notice Total deposits ever (in USD value, 18 decimals)
    uint256 public totalDeposited;

    /// @notice Total withdrawals ever (in USDC, 6 decimals)
    uint256 public totalWithdrawn;

    /// @notice Total fees collected ever (in USDC, 6 decimals)
    uint256 public totalFeesCollected;

    // ==================== EVENTS ====================

    event Deposited(address indexed user, uint256 usdcAmount, uint256 chipMinted);
    event DepositedAsset(
        address indexed user,
        bytes32 indexed assetKey,
        uint256 assetAmount,
        uint256 chipMinted,
        uint256 usdValue
    );
    event Withdrawn(address indexed user, uint256 chipBurned, uint256 usdcReturned, uint256 fee);
    event FeesCollected(address indexed treasury, uint256 amount);
    event FeeUpdated(string feeType, uint256 newBps);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event OwnershipTransferStarted(address indexed currentOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(bool isPaused);
    event AssetAdded(bytes32 indexed key, address token, address oracle, uint8 decimals);
    event AssetUpdated(bytes32 indexed key, bool enabled);

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

    // ==================== DEPOSIT ETH ====================

    /**
     * @notice Deposit ETH and receive CHIP at current USD price
     * @return chipAmount CHIP minted (18 decimals)
     */
    function depositETH() external payable nonReentrant whenNotPaused returns (uint256 chipAmount) {
        require(msg.value > 0, "CHIPWrapper: zero amount");

        bytes32 key = keccak256("ETH");
        AssetConfig memory config = supportedAssets[key];
        require(config.enabled, "CHIPWrapper: ETH not supported");
        require(config.oracle != address(0), "CHIPWrapper: ETH oracle not set");

        // Get ETH price in USD (8 decimals from oracle)
        int256 ethPrice = IPriceOracle(config.oracle).latest_answer();
        require(ethPrice > 0, "CHIPWrapper: invalid ETH price");

        // Calculate USD value in 18 decimals
        // ETH is 18 decimals, oracle is 8 decimals
        // usdValue = (ethAmount * price) / 10^8
        uint256 usdValue = (msg.value * uint256(ethPrice)) / (10 ** ORACLE_DECIMALS);

        // Apply deposit fee
        uint256 fee = (usdValue * depositFeeBps) / 10_000;
        chipAmount = usdValue - fee;

        // Mint CHIP to user
        chip.mint(msg.sender, chipAmount);

        totalDeposited += usdValue;

        emit DepositedAsset(msg.sender, key, msg.value, chipAmount, usdValue);
    }

    // ==================== DEPOSIT TOKEN (ORACLE-BASED) ====================

    /**
     * @notice Deposit any supported token and receive CHIP at current USD price
     * @param assetKey The asset key (e.g., keccak256("USDC"), keccak256("USDT"), keccak256("WBTC"))
     * @param amount Token amount in token's native decimals
     * @return chipAmount CHIP minted (18 decimals)
     */
    function depositToken(
        bytes32 assetKey,
        uint256 amount
    ) external nonReentrant whenNotPaused returns (uint256 chipAmount) {
        require(amount > 0, "CHIPWrapper: zero amount");

        AssetConfig memory config = supportedAssets[assetKey];
        require(config.enabled, "CHIPWrapper: asset not supported");
        require(config.token != address(0), "CHIPWrapper: use depositETH for ETH");
        require(config.oracle != address(0), "CHIPWrapper: oracle not set");

        // Transfer token to contract
        IERC20(config.token).safeTransferFrom(msg.sender, address(this), amount);

        // Get price from oracle (8 decimals)
        int256 price = IPriceOracle(config.oracle).latest_answer();
        require(price > 0, "CHIPWrapper: invalid price");

        // Normalize amount to 18 decimals
        uint256 normalizedAmount;
        if (config.decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - config.decimals));
        } else if (config.decimals > 18) {
            normalizedAmount = amount / (10 ** (config.decimals - 18));
        } else {
            normalizedAmount = amount;
        }

        // Calculate USD value: normalizedAmount * price / 10^8
        uint256 usdValue = (normalizedAmount * uint256(price)) / (10 ** ORACLE_DECIMALS);

        // Apply deposit fee
        uint256 fee = (usdValue * depositFeeBps) / 10_000;
        chipAmount = usdValue - fee;

        // Mint CHIP to user
        chip.mint(msg.sender, chipAmount);

        totalDeposited += usdValue;

        emit DepositedAsset(msg.sender, assetKey, amount, chipAmount, usdValue);
    }

    // ==================== LEGACY DEPOSIT (USDC 1:1) ====================

    /**
     * @notice Deposit USDC and receive CHIP 1:1 (legacy, no oracle)
     * @dev Kept for backward compatibility
     * @param amount USDC amount (6 decimals)
     * @return chipAmount CHIP minted (18 decimals)
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

        totalDeposited += netAmount * 1e12;

        emit Deposited(msg.sender, amount, chipAmount);
    }

    /**
     * @notice Deposit USDC using Permit2 (gasless approval)
     * @dev User signs a permit off-chain, no separate approve tx needed
     * @param amount USDC amount (6 decimals)
     * @param permit The permit data signed by the user
     * @param signature The user's signature over the permit
     * @return chipAmount CHIP minted (18 decimals)
     */
    function depositWithPermit(
        uint256 amount,
        IPermit2.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external nonReentrant whenNotPaused returns (uint256 chipAmount) {
        require(amount > 0, "CHIPWrapper: zero amount");
        require(permit.permitted.token == address(usdc), "CHIPWrapper: wrong token");
        require(permit.permitted.amount >= amount, "CHIPWrapper: insufficient permit");

        // Use Permit2 to transfer USDC from user
        PERMIT2.permitTransferFrom(
            permit,
            IPermit2.SignatureTransferDetails({ to: address(this), requestedAmount: amount }),
            msg.sender,
            signature
        );

        // Calculate fee
        uint256 fee = (amount * depositFeeBps) / 10_000;
        uint256 netAmount = amount - fee;

        // If fee, send to treasury
        if (fee > 0) {
            usdc.safeTransfer(treasury, fee);
            totalFeesCollected += fee;
        }

        // Convert 6 decimals (USDC) to 18 decimals (CHIP)
        chipAmount = netAmount * 1e12;

        // Mint CHIP to user
        chip.mint(msg.sender, chipAmount);

        totalDeposited += netAmount * 1e12;

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
     * @notice Get total USDC reserves
     */
    function getReserves() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Get quote for ETH deposit
     * @param ethAmount ETH amount in wei
     * @return chipOut Expected CHIP output
     * @return usdValue USD value (18 decimals)
     */
    function quoteDepositETH(
        uint256 ethAmount
    ) external view returns (uint256 chipOut, uint256 usdValue) {
        bytes32 key = keccak256("ETH");
        AssetConfig memory config = supportedAssets[key];
        if (!config.enabled || config.oracle == address(0)) {
            return (0, 0);
        }

        int256 ethPrice = IPriceOracle(config.oracle).latest_answer();
        if (ethPrice <= 0) {
            return (0, 0);
        }

        usdValue = (ethAmount * uint256(ethPrice)) / (10 ** ORACLE_DECIMALS);
        uint256 fee = (usdValue * depositFeeBps) / 10_000;
        chipOut = usdValue - fee;
    }

    /**
     * @notice Get quote for token deposit
     * @param assetKey The asset key
     * @param amount Token amount in native decimals
     * @return chipOut Expected CHIP output
     * @return usdValue USD value (18 decimals)
     */
    function quoteDepositToken(
        bytes32 assetKey,
        uint256 amount
    ) external view returns (uint256 chipOut, uint256 usdValue) {
        AssetConfig memory config = supportedAssets[assetKey];
        if (!config.enabled || config.oracle == address(0)) {
            return (0, 0);
        }

        int256 price = IPriceOracle(config.oracle).latest_answer();
        if (price <= 0) {
            return (0, 0);
        }

        // Normalize to 18 decimals
        uint256 normalizedAmount;
        if (config.decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - config.decimals));
        } else if (config.decimals > 18) {
            normalizedAmount = amount / (10 ** (config.decimals - 18));
        } else {
            normalizedAmount = amount;
        }

        usdValue = (normalizedAmount * uint256(price)) / (10 ** ORACLE_DECIMALS);
        uint256 fee = (usdValue * depositFeeBps) / 10_000;
        chipOut = usdValue - fee;
    }

    /**
     * @notice Get all supported asset keys
     */
    function getSupportedAssetKeys() external view returns (bytes32[] memory) {
        return assetKeys;
    }

    /**
     * @notice Get current price from oracle
     * @param assetKey The asset key
     * @return price Price in 8 decimals
     */
    function getAssetPrice(
        bytes32 assetKey
    ) external view returns (int256 price) {
        AssetConfig memory config = supportedAssets[assetKey];
        if (config.oracle == address(0)) {
            return 0;
        }
        return IPriceOracle(config.oracle).latest_answer();
    }

    /**
     * @notice Get quote for legacy USDC deposit
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

    // ==================== ADMIN: ASSET MANAGEMENT ====================

    /**
     * @notice Add a new supported asset
     * @param key Unique key (use keccak256 of ticker, e.g., keccak256("ETH"))
     * @param token Token address (address(0) for ETH)
     * @param oracle Oracle address
     * @param decimals Token decimals
     */
    function addSupportedAsset(
        bytes32 key,
        address token,
        address oracle,
        uint8 decimals
    ) external onlyOwner {
        require(oracle != address(0), "CHIPWrapper: zero oracle");
        require(supportedAssets[key].oracle == address(0), "CHIPWrapper: asset exists");

        supportedAssets[key] =
            AssetConfig({ token: token, oracle: oracle, decimals: decimals, enabled: true });

        assetKeys.push(key);

        emit AssetAdded(key, token, oracle, decimals);
    }

    /**
     * @notice Enable or disable an asset
     */
    function setSupportedAssetEnabled(
        bytes32 key,
        bool enabled
    ) external onlyOwner {
        require(supportedAssets[key].oracle != address(0), "CHIPWrapper: asset not found");
        supportedAssets[key].enabled = enabled;
        emit AssetUpdated(key, enabled);
    }

    /**
     * @notice Update oracle for an asset
     */
    function updateAssetOracle(
        bytes32 key,
        address oracle
    ) external onlyOwner {
        require(oracle != address(0), "CHIPWrapper: zero oracle");
        require(supportedAssets[key].oracle != address(0), "CHIPWrapper: asset not found");
        supportedAssets[key].oracle = oracle;
    }

    // ==================== ADMIN: FEES & OWNERSHIP ====================

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
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
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
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "CHIPWrapper: not pending owner");
        address oldOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, msg.sender);
    }

    // ==================== ADMIN: EMERGENCY ====================

    /**
     * @notice Recover stuck tokens (not primary reserves)
     * @dev Allows recovering non-USDC tokens or excess ETH
     */
    function emergencyRecover(
        address token,
        uint256 amount
    ) external onlyOwner {
        if (token == address(0)) {
            // Recover ETH
            payable(owner).transfer(amount);
        } else {
            IERC20(token).safeTransfer(owner, amount);
        }
    }

    /**
     * @notice Receive ETH (for depositETH)
     */
    receive() external payable { }
}
