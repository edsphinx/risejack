// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.28;

import { IVRFConsumer } from "../../interfaces/IVRFConsumer.sol";
import { IVRFCoordinator } from "../../interfaces/IVRFCoordinator.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title VyreJackERC20
 * @author edsphinx
 * @custom:company blocketh
 * @notice On-chain Blackjack with ERC20 token betting (USDC, CHIP, etc.)
 * @dev Identical game logic to VyreJack but uses ERC20 instead of ETH
 *
 * SECURITY MODEL:
 * - Infinite Deck: Each card is dealt from a fresh virtual deck (random % 52).
 * - House Edge: Standard blackjack rules give the house ~0.5% edge.
 * - ERC20: Uses SafeERC20 for all transfers
 */
contract VyreJackERC20 is IVRFConsumer {
    using SafeERC20 for IERC20;

    // ==================== CONSTANTS ====================

    address public constant DEFAULT_VRF_COORDINATOR = 0x9d57aB4517ba97349551C876a01a7580B1338909;

    uint8 public constant CARDS_PER_DECK = 52;
    uint256 public constant BLACKJACK_PAYOUT = 150;
    uint256 public constant STANDARD_PAYOUT = 200;
    uint256 public constant DEFAULT_DAILY_PROFIT_LIMIT = 10_000e18; // 10k tokens
    uint256 public constant DEFAULT_MIN_RESERVE = 50_000e18; // 50k tokens
    uint256 public constant CIRCUIT_BREAKER_THRESHOLD = 20_000e18;
    uint256 public constant CIRCUIT_BREAKER_WINDOW = 1 hours;
    uint256 public constant GAME_TIMEOUT = 1 hours;
    uint256 public constant HOUSE_FEE_BPS = 200; // 2% house fee per game

    uint8 public constant BLACKJACK_VALUE = 21;
    uint8 public constant DEALER_STAND_VALUE = 17;
    uint8 public constant ACE_HIGH_VALUE = 11;
    uint8 public constant ACE_LOW_VALUE = 1;
    uint8 public constant FACE_CARD_VALUE = 10;
    uint8 public constant RANKS_PER_SUIT = 13;
    uint8 public constant NUM_SUITS = 4;
    uint8 public constant MAX_DEALER_CARDS = 10;

    uint256 public vrfTimeout = 30 seconds;
    uint256 public gameCooldown = 5 seconds;

    // ==================== STRUCTS ====================

    struct Game {
        address player;
        uint256 bet;
        uint8[] playerCards;
        uint8[] dealerCards;
        GameState state;
        uint256 timestamp;
        bool isDoubled;
    }

    struct VRFRequest {
        address player;
        RequestType requestType;
        bool fulfilled;
        uint256 timestamp;
    }

    // ==================== ENUMS ====================

    enum GameState {
        Idle,
        WaitingForDeal,
        PlayerTurn,
        WaitingForHit,
        DealerTurn,
        PlayerWin,
        DealerWin,
        Push,
        PlayerBlackjack
    }

    enum RequestType {
        InitialDeal,
        PlayerHit,
        DealerDraw
    }

    // ==================== EVENTS ====================

    event GameStarted(address indexed player, uint256 bet);
    event CardsRequested(address indexed player, uint256 requestId, RequestType requestType);
    event CardDealt(address indexed player, uint8 card, bool isDealer, bool faceUp);
    event PlayerAction(address indexed player, string action);
    event GameEnded(
        address indexed player,
        GameState result,
        uint256 payout,
        uint8 playerFinalValue,
        uint8 dealerFinalValue,
        uint8 playerCardCount,
        uint8 dealerCardCount
    );
    event HandValue(address indexed player, uint8 value, bool isSoft, bool isDealer);
    event ContractPaused(string reason);
    event ContractUnpaused();
    event DailyLimitReached(address indexed player, uint256 profit);
    event CircuitBreakerTriggered(uint256 lossAmount, uint256 timeWindow);
    event ReserveLow(uint256 currentBalance, uint256 minRequired);
    event GameTimedOut(address indexed player, uint256 refund);
    event BetLimitsChanged(uint256 newMinBet, uint256 newMaxBet);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event VRFRequestRetried(address indexed player, uint256 oldRequestId, uint256 newRequestId);
    event GameForceResolved(address indexed player, uint256 refund);

    // ==================== STATE ====================

    IVRFCoordinator public immutable coordinator;
    IERC20 public immutable betToken;

    /// @notice Treasury address for house fees
    address public treasury;

    mapping(address => Game) public games;
    mapping(uint256 => VRFRequest) public vrfRequests;

    uint256 public minBet;
    uint256 public maxBet;
    address public owner;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(address => uint256) public playerNonces;
    mapping(address => uint256) public lastGameTimestamp;

    bool public paused;
    mapping(address => uint256) public dailyProfit;
    mapping(address => uint256) public lastProfitReset;
    uint256 public dailyProfitLimit;
    uint256 public minReserve;
    uint256 public windowStartTime;
    uint256 public windowLosses;
    uint256 public totalExposure;

    // ==================== MODIFIERS ====================

    modifier onlyVRFCoordinator() {
        require(msg.sender == address(coordinator), "Only VRF coordinator");
        _;
    }

    modifier gameInState(
        address player,
        GameState state
    ) {
        require(games[player].state == state, "Invalid game state");
        _;
    }

    modifier validBet(
        uint256 amount
    ) {
        require(amount >= minBet && amount <= maxBet, "Invalid bet amount");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier checkReserve() {
        _;
        if (_getBalance() < minReserve) {
            paused = true;
            emit ContractPaused("Reserve below minimum");
            emit ReserveLow(_getBalance(), minReserve);
        }
    }

    modifier checkDailyLimit(
        address player
    ) {
        if (block.timestamp - lastProfitReset[player] >= 1 days) {
            dailyProfit[player] = 0;
            lastProfitReset[player] = block.timestamp;
        }
        require(dailyProfit[player] < dailyProfitLimit, "Daily profit limit reached");
        _;
    }

    modifier checkCooldown(
        address player
    ) {
        require(block.timestamp >= lastGameTimestamp[player] + gameCooldown, "Cooldown active");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    /**
     * @notice Deploy ERC20 Blackjack contract
     * @param _vrfCoordinator Address of VRF Coordinator (address(0) for default)
     * @param _betToken Address of the ERC20 token for betting (USDC, CHIP, etc.)
     * @param _minBet Minimum bet amount (in token decimals)
     * @param _maxBet Maximum bet amount (in token decimals)
     * @param _treasury Address to receive house fees
     */
    constructor(
        address _vrfCoordinator,
        address _betToken,
        uint256 _minBet,
        uint256 _maxBet,
        address _treasury
    ) {
        require(_betToken != address(0), "Invalid bet token");
        require(_minBet > 0 && _maxBet > _minBet, "Invalid bet limits");
        require(_treasury != address(0), "Invalid treasury");

        if (_vrfCoordinator == address(0)) {
            coordinator = IVRFCoordinator(DEFAULT_VRF_COORDINATOR);
        } else {
            require(_vrfCoordinator.code.length > 0, "VRF must be contract");
            coordinator = IVRFCoordinator(_vrfCoordinator);
        }

        betToken = IERC20(_betToken);
        minBet = _minBet;
        maxBet = _maxBet;
        treasury = _treasury;
        owner = msg.sender;
        dailyProfitLimit = DEFAULT_DAILY_PROFIT_LIMIT;
        minReserve = DEFAULT_MIN_RESERVE;
    }

    // ==================== CORE FUNCTIONS ====================

    /**
     * @notice Place a bet and start a new game
     * @param amount Token amount to bet (must be approved first)
     */
    function placeBet(
        uint256 amount
    )
        external
        whenNotPaused
        validBet(amount)
        gameInState(msg.sender, GameState.Idle)
        checkDailyLimit(msg.sender)
        checkCooldown(msg.sender)
    {
        lastGameTimestamp[msg.sender] = block.timestamp;

        // Calculate and collect house fee (2%)
        uint256 houseFee = (amount * HOUSE_FEE_BPS) / 10_000;
        uint256 netBet = amount - houseFee;

        totalExposure += (netBet * BLACKJACK_PAYOUT) / 100 + netBet;

        // Transfer tokens from player
        betToken.safeTransferFrom(msg.sender, address(this), amount);

        // Send house fee to treasury
        if (houseFee > 0) {
            betToken.safeTransfer(treasury, houseFee);
        }

        games[msg.sender] = Game({
            player: msg.sender,
            bet: netBet, // Net bet after fee
            playerCards: new uint8[](0),
            dealerCards: new uint8[](0),
            state: GameState.WaitingForDeal,
            timestamp: block.timestamp,
            isDoubled: false
        });

        uint256 nonce = playerNonces[msg.sender]++;
        uint256 seed =
            uint256(keccak256(abi.encode(msg.sender, block.timestamp, block.prevrandao, nonce)));
        uint256 requestId = coordinator.requestRandomNumbers(4, seed);

        vrfRequests[requestId] = VRFRequest({
            player: msg.sender,
            requestType: RequestType.InitialDeal,
            fulfilled: false,
            timestamp: block.timestamp
        });

        emit GameStarted(msg.sender, amount);
        emit CardsRequested(msg.sender, requestId, RequestType.InitialDeal);
    }

    /**
     * @notice Request another card (hit)
     */
    function hit() external gameInState(msg.sender, GameState.PlayerTurn) {
        games[msg.sender].state = GameState.WaitingForHit;

        uint256 nonce = playerNonces[msg.sender]++;
        uint256 seed = uint256(
            keccak256(
                abi.encode(msg.sender, block.timestamp, games[msg.sender].playerCards.length, nonce)
            )
        );
        uint256 requestId = coordinator.requestRandomNumbers(1, seed);

        vrfRequests[requestId] = VRFRequest({
            player: msg.sender,
            requestType: RequestType.PlayerHit,
            fulfilled: false,
            timestamp: block.timestamp
        });

        emit PlayerAction(msg.sender, "hit");
        emit CardsRequested(msg.sender, requestId, RequestType.PlayerHit);
    }

    /**
     * @notice End player turn and let dealer play
     */
    function stand() external gameInState(msg.sender, GameState.PlayerTurn) {
        emit PlayerAction(msg.sender, "stand");
        _playDealer(msg.sender);
    }

    /**
     * @notice Double down - double bet, take one card, then stand
     * @dev Requires additional approval for the original bet amount
     */
    function double() external gameInState(msg.sender, GameState.PlayerTurn) {
        Game storage game = games[msg.sender];
        require(game.playerCards.length == 2, "Can only double on initial hand");

        uint256 additionalBet = game.bet;

        // Transfer additional tokens
        betToken.safeTransferFrom(msg.sender, address(this), additionalBet);

        game.bet += additionalBet;
        game.isDoubled = true;
        game.state = GameState.WaitingForHit;

        totalExposure += (additionalBet * 3) / 2;

        uint256 nonce = playerNonces[msg.sender]++;
        uint256 seed = uint256(keccak256(abi.encode(msg.sender, block.timestamp, "double", nonce)));
        uint256 requestId = coordinator.requestRandomNumbers(1, seed);

        vrfRequests[requestId] = VRFRequest({
            player: msg.sender,
            requestType: RequestType.PlayerHit,
            fulfilled: false,
            timestamp: block.timestamp
        });

        emit PlayerAction(msg.sender, "double");
        emit CardsRequested(msg.sender, requestId, RequestType.PlayerHit);
    }

    /**
     * @notice Surrender - forfeit half the bet
     */
    function surrender() external gameInState(msg.sender, GameState.PlayerTurn) {
        require(games[msg.sender].playerCards.length == 2, "Can only surrender on initial hand");

        uint256 refund = games[msg.sender].bet / 2;
        games[msg.sender].state = GameState.DealerWin;

        emit PlayerAction(msg.sender, "surrender");
        _emitGameEnded(msg.sender, GameState.DealerWin, refund);
        _resetGame(msg.sender);
        _safePayout(msg.sender, refund);
    }

    // ==================== VRF CALLBACK ====================

    function rawFulfillRandomNumbers(
        uint256 requestId,
        uint256[] memory randomNumbers
    ) external override onlyVRFCoordinator {
        VRFRequest storage request = vrfRequests[requestId];
        require(request.player != address(0), "Unknown request");
        require(!request.fulfilled, "Already fulfilled");

        request.fulfilled = true;
        address player = request.player;
        Game storage game = games[player];

        require(
            game.state == GameState.WaitingForDeal || game.state == GameState.WaitingForHit
                || game.state == GameState.DealerTurn,
            "Invalid game state for VRF callback"
        );

        if (request.requestType == RequestType.InitialDeal) {
            _handleInitialDeal(player, randomNumbers);
        } else if (request.requestType == RequestType.PlayerHit) {
            _handlePlayerHit(player, randomNumbers);
        } else if (request.requestType == RequestType.DealerDraw) {
            _handleDealerDraw(player, randomNumbers);
        }
    }

    // ==================== INTERNAL - DEAL HANDLING ====================

    function _handleInitialDeal(
        address player,
        uint256[] memory randomNumbers
    ) internal {
        require(randomNumbers.length >= 4, "Need 4 random numbers");

        Game storage game = games[player];

        uint8 playerCard1 = _randomToCard(randomNumbers[0]);
        uint8 dealerCard1 = _randomToCard(randomNumbers[1]);
        uint8 playerCard2 = _randomToCard(randomNumbers[2]);
        uint8 dealerCard2 = _randomToCard(randomNumbers[3]);

        game.playerCards.push(playerCard1);
        game.dealerCards.push(dealerCard1);
        game.playerCards.push(playerCard2);
        game.dealerCards.push(dealerCard2);

        emit CardDealt(player, playerCard1, false, true);
        emit CardDealt(player, dealerCard1, true, true);
        emit CardDealt(player, playerCard2, false, true);
        emit CardDealt(player, dealerCard2, true, false);

        (uint8 playerValue,) = calculateHandValue(game.playerCards);
        (uint8 dealerValue,) = calculateHandValue(game.dealerCards);

        emit HandValue(player, playerValue, false, false);

        if (playerValue == 21 && dealerValue == 21) {
            game.state = GameState.Push;
            uint256 payout = game.bet;
            _emitGameEnded(player, GameState.Push, payout);
            _resetGame(player);
            _safePayout(player, payout);
        } else if (playerValue == 21) {
            game.state = GameState.PlayerBlackjack;
            uint256 payout = (game.bet * BLACKJACK_PAYOUT) / 100 + game.bet;
            _emitGameEnded(player, GameState.PlayerBlackjack, payout);
            _resetGame(player);
            _safePayout(player, payout);
        } else if (dealerValue == 21) {
            game.state = GameState.DealerWin;
            emit CardDealt(player, dealerCard2, true, true);
            emit HandValue(player, dealerValue, false, true);
            _emitGameEnded(player, GameState.DealerWin, 0);
            _resetGame(player);
        } else {
            game.state = GameState.PlayerTurn;
        }
    }

    function _handlePlayerHit(
        address player,
        uint256[] memory randomNumbers
    ) internal {
        require(randomNumbers.length >= 1, "Need 1 random number");

        Game storage game = games[player];
        uint8 newCard = _randomToCard(randomNumbers[0]);
        game.playerCards.push(newCard);

        emit CardDealt(player, newCard, false, true);

        (uint8 playerValue,) = calculateHandValue(game.playerCards);
        emit HandValue(player, playerValue, false, false);

        if (playerValue > 21) {
            game.state = GameState.DealerWin;
            _emitGameEnded(player, GameState.DealerWin, 0);
            _resetGame(player);
        } else if (playerValue == 21) {
            _playDealer(player);
        } else {
            if (game.isDoubled) {
                _playDealer(player);
            } else {
                game.state = GameState.PlayerTurn;
            }
        }
    }

    function _handleDealerDraw(
        address player,
        uint256[] memory randomNumbers
    ) internal {
        Game storage game = games[player];

        for (uint256 i = 0; i < randomNumbers.length; i++) {
            uint8 newCard = _randomToCard(randomNumbers[i]);
            game.dealerCards.push(newCard);
            emit CardDealt(player, newCard, true, true);
        }

        _resolveDealerHand(player);
    }

    // ==================== INTERNAL - DEALER LOGIC ====================

    function _playDealer(
        address player
    ) internal {
        Game storage game = games[player];
        game.state = GameState.DealerTurn;

        if (game.dealerCards.length >= 2) {
            emit CardDealt(player, game.dealerCards[1], true, true);
        }

        (uint8 dealerValue, bool isSoft) = calculateHandValue(game.dealerCards);
        emit HandValue(player, dealerValue, isSoft, true);

        uint8 cardsNeeded = 0;
        uint8 tempValue = dealerValue;
        bool tempSoft = isSoft;

        while (_shouldDealerHit(tempValue, tempSoft) && cardsNeeded < 5) {
            cardsNeeded++;
            tempValue += 7;
            if (tempValue > 21 && tempSoft) {
                tempValue -= 10;
                tempSoft = false;
            }
        }

        if (cardsNeeded > 0) {
            uint256 nonce = playerNonces[player]++;
            uint256 seed = uint256(keccak256(abi.encode(player, block.timestamp, "dealer", nonce)));
            uint256 requestId = coordinator.requestRandomNumbers(cardsNeeded, seed);

            vrfRequests[requestId] = VRFRequest({
                player: player,
                requestType: RequestType.DealerDraw,
                fulfilled: false,
                timestamp: block.timestamp
            });

            emit CardsRequested(player, requestId, RequestType.DealerDraw);
        } else {
            _resolveGame(player);
        }
    }

    function _resolveDealerHand(
        address player
    ) internal {
        Game storage game = games[player];

        (uint8 dealerValue, bool isSoft) = calculateHandValue(game.dealerCards);
        emit HandValue(player, dealerValue, isSoft, true);

        if (_shouldDealerHit(dealerValue, isSoft) && game.dealerCards.length < 10) {
            uint256 nonce = playerNonces[player]++;
            uint256 seed = uint256(
                keccak256(abi.encode(player, block.timestamp, game.dealerCards.length, nonce))
            );
            uint256 requestId = coordinator.requestRandomNumbers(1, seed);

            vrfRequests[requestId] = VRFRequest({
                player: player,
                requestType: RequestType.DealerDraw,
                fulfilled: false,
                timestamp: block.timestamp
            });

            emit CardsRequested(player, requestId, RequestType.DealerDraw);
        } else {
            _resolveGame(player);
        }
    }

    function _shouldDealerHit(
        uint8 value,
        bool isSoft
    ) internal pure returns (bool) {
        if (value < 17) return true;
        if (value == 17 && isSoft) return true;
        return false;
    }

    function _resolveGame(
        address player
    ) internal checkReserve {
        Game storage game = games[player];

        (uint8 playerValue,) = calculateHandValue(game.playerCards);
        (uint8 dealerValue,) = calculateHandValue(game.dealerCards);

        uint256 payout = 0;
        uint256 bet = game.bet;

        if (dealerValue > 21) {
            game.state = GameState.PlayerWin;
            payout = bet * 2;
        } else if (playerValue > dealerValue) {
            game.state = GameState.PlayerWin;
            payout = bet * 2;
        } else if (dealerValue > playerValue) {
            game.state = GameState.DealerWin;
            payout = 0;
        } else {
            game.state = GameState.Push;
            payout = bet;
        }

        uint256 maxPayout = (bet * BLACKJACK_PAYOUT) / 100 + bet;
        if (totalExposure >= maxPayout) {
            totalExposure -= maxPayout;
        } else {
            totalExposure = 0;
        }

        if (payout > bet) {
            uint256 profit = payout - bet;
            dailyProfit[player] += profit;

            if (dailyProfit[player] >= dailyProfitLimit) {
                emit DailyLimitReached(player, dailyProfit[player]);
            }

            _trackHouseLoss(profit);
        }

        _emitGameEnded(player, game.state, payout);
        _resetGame(player);

        if (payout > 0) {
            _safePayout(player, payout);
        }
    }

    function _resetGame(
        address player
    ) internal {
        delete games[player];
    }

    function _emitGameEnded(
        address player,
        GameState result,
        uint256 payout
    ) internal {
        Game storage game = games[player];
        (uint8 playerValue,) = calculateHandValue(game.playerCards);
        (uint8 dealerValue,) = calculateHandValue(game.dealerCards);

        emit GameEnded(
            player,
            result,
            payout,
            playerValue,
            dealerValue,
            uint8(game.playerCards.length),
            uint8(game.dealerCards.length)
        );
    }

    /**
     * @notice Safe payout using ERC20 transfer
     */
    function _safePayout(
        address to,
        uint256 amount
    ) internal {
        if (amount > 0) {
            betToken.safeTransfer(to, amount);
        }
    }

    function _trackHouseLoss(
        uint256 lossAmount
    ) internal {
        if (block.timestamp - windowStartTime >= CIRCUIT_BREAKER_WINDOW) {
            windowStartTime = block.timestamp;
            windowLosses = 0;
        }

        windowLosses += lossAmount;

        if (windowLosses >= CIRCUIT_BREAKER_THRESHOLD) {
            paused = true;
            emit CircuitBreakerTriggered(windowLosses, CIRCUIT_BREAKER_WINDOW);
            emit ContractPaused("Circuit breaker triggered");
        }
    }

    function _getBalance() internal view returns (uint256) {
        return betToken.balanceOf(address(this));
    }

    // ==================== UTILITY FUNCTIONS ====================

    function _randomToCard(
        uint256 random
    ) internal pure returns (uint8) {
        return uint8(random % CARDS_PER_DECK);
    }

    function calculateHandValue(
        uint8[] memory cards
    ) public pure returns (uint8 value, bool isSoft) {
        uint8 total = 0;
        uint8 aces = 0;
        uint256 len = cards.length;

        for (uint256 i = 0; i < len;) {
            uint8 cardRank = cards[i] % RANKS_PER_SUIT;

            if (cardRank == 0) {
                unchecked {
                    aces++;
                }
                total += ACE_HIGH_VALUE;
            } else if (cardRank >= 10) {
                total += FACE_CARD_VALUE;
            } else {
                unchecked {
                    total += cardRank + 1;
                }
            }
            unchecked {
                i++;
            }
        }

        while (total > BLACKJACK_VALUE && aces > 0) {
            unchecked {
                total -= 10;
                aces--;
            }
        }

        return (total, aces > 0 && total <= BLACKJACK_VALUE);
    }

    function getCardInfo(
        uint8 card
    ) external pure returns (uint8 rank, uint8 suit) {
        return (card % RANKS_PER_SUIT, card / RANKS_PER_SUIT);
    }

    // ==================== VIEW FUNCTIONS ====================

    function getGameState(
        address player
    ) external view returns (Game memory) {
        return games[player];
    }

    function getPlayerHandValue(
        address player
    ) external view returns (uint8 value, bool isSoft) {
        return calculateHandValue(games[player].playerCards);
    }

    function getDealerVisibleValue(
        address player
    ) external view returns (uint8 value) {
        Game storage game = games[player];
        if (game.dealerCards.length == 0) return 0;

        if (game.state == GameState.PlayerTurn || game.state == GameState.WaitingForHit) {
            uint8[] memory visibleCards = new uint8[](1);
            visibleCards[0] = game.dealerCards[0];
            (value,) = calculateHandValue(visibleCards);
        } else {
            (value,) = calculateHandValue(game.dealerCards);
        }
    }

    // ==================== PLAYER FUNCTIONS ====================

    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending withdrawal");

        pendingWithdrawals[msg.sender] = 0;
        betToken.safeTransfer(msg.sender, amount);
    }

    function cancelTimedOutGame(
        address player
    ) external {
        Game storage game = games[player];
        require(game.state != GameState.Idle, "No active game");
        require(block.timestamp >= game.timestamp + GAME_TIMEOUT, "Game not timed out");

        uint256 refund = game.bet;

        uint256 maxPayout = (refund * BLACKJACK_PAYOUT) / 100 + refund;
        if (totalExposure >= maxPayout) {
            totalExposure -= maxPayout;
        } else {
            totalExposure = 0;
        }

        emit GameTimedOut(player, refund);
        _resetGame(player);

        if (refund > 0) {
            _safePayout(player, refund);
        }
    }

    // ==================== VRF TIMEOUT FUNCTIONS ====================

    function retryVRFRequest(
        uint256 requestId
    ) external {
        VRFRequest storage request = vrfRequests[requestId];
        require(request.player != address(0), "Unknown request");
        require(!request.fulfilled, "Already fulfilled");
        require(block.timestamp >= request.timestamp + vrfTimeout, "Request not timed out");

        address player = request.player;
        RequestType requestType = request.requestType;

        request.fulfilled = true;

        uint256 nonce = playerNonces[player]++;
        uint256 seed = uint256(keccak256(abi.encode(player, block.timestamp, "retry", nonce)));
        uint256 numNumbers = requestType == RequestType.InitialDeal ? 4 : 1;

        uint256 newRequestId = coordinator.requestRandomNumbers(uint32(numNumbers), seed);

        vrfRequests[newRequestId] = VRFRequest({
            player: player, requestType: requestType, fulfilled: false, timestamp: block.timestamp
        });

        emit VRFRequestRetried(player, requestId, newRequestId);
        emit CardsRequested(player, newRequestId, requestType);
    }

    function forceResolveGame(
        address player
    ) external onlyOwner {
        Game storage game = games[player];
        require(game.state != GameState.Idle, "No active game");

        uint256 refund = game.bet;
        uint256 exposureToRemove = (refund * BLACKJACK_PAYOUT) / 100 + refund;

        if (exposureToRemove > totalExposure) {
            totalExposure = 0;
        } else {
            totalExposure -= exposureToRemove;
        }

        emit GameForceResolved(player, refund);
        _resetGame(player);

        if (refund > 0) {
            _safePayout(player, refund);
        }
    }

    // ==================== ADMIN FUNCTIONS ====================

    function setBetLimits(
        uint256 _minBet,
        uint256 _maxBet
    ) external onlyOwner {
        require(_minBet > 0, "Min bet must be positive");
        require(_maxBet > _minBet, "Max must exceed min");
        minBet = _minBet;
        maxBet = _maxBet;
        emit BetLimitsChanged(_minBet, _maxBet);
    }

    function withdrawHouseFunds(
        uint256 amount
    ) external onlyOwner {
        require(amount <= _getBalance(), "Insufficient balance");
        require(_getBalance() - amount >= minReserve, "Would breach min reserve");
        betToken.safeTransfer(owner, amount);
    }

    function transferOwnership(
        address newOwner
    ) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function pause() external onlyOwner {
        paused = true;
        emit ContractPaused("Manual pause by owner");
    }

    function unpause() external onlyOwner {
        require(_getBalance() >= minReserve, "Reserve too low to unpause");
        paused = false;
        windowLosses = 0;
        windowStartTime = block.timestamp;
        emit ContractUnpaused();
    }

    function setDailyProfitLimit(
        uint256 _limit
    ) external onlyOwner {
        require(_limit > 0, "Limit must be positive");
        dailyProfitLimit = _limit;
    }

    function setMinReserve(
        uint256 _reserve
    ) external onlyOwner {
        minReserve = _reserve;
    }

    function setVRFTimeout(
        uint256 _timeout
    ) external onlyOwner {
        require(_timeout >= 10 seconds && _timeout <= 10 minutes, "Invalid timeout");
        vrfTimeout = _timeout;
    }

    function setGameCooldown(
        uint256 _cooldown
    ) external onlyOwner {
        require(_cooldown <= 60 seconds, "Cooldown too long");
        gameCooldown = _cooldown;
    }

    function getHouseStats()
        external
        view
        returns (
            uint256 balance,
            uint256 exposure,
            uint256 reserve,
            uint256 recentLosses,
            bool isPaused
        )
    {
        return (_getBalance(), totalExposure, minReserve, windowLosses, paused);
    }

    // No receive() needed - this is ERC20 only
}
