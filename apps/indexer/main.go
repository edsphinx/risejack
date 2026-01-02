package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math/big"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// RiseJack contract events - must match RiseJack.sol exactly
const riseJackABI = `[
	{"anonymous":false,"inputs":[{"indexed":true,"name":"player","type":"address"},{"indexed":false,"name":"result","type":"uint8"},{"indexed":false,"name":"payout","type":"uint256"},{"indexed":false,"name":"playerFinalValue","type":"uint8"},{"indexed":false,"name":"dealerFinalValue","type":"uint8"},{"indexed":false,"name":"playerCardCount","type":"uint8"},{"indexed":false,"name":"dealerCardCount","type":"uint8"}],"name":"GameEnded","type":"event"}
]`

// GameEnded event structure - matches contract emission
type GameEndedEvent struct {
	Player           common.Address
	Result           uint8 // GameState enum
	Payout           *big.Int
	PlayerFinalValue uint8
	DealerFinalValue uint8
	PlayerCardCount  uint8
	DealerCardCount  uint8
}

// GameState enum from contract (matches Result field)
var outcomeNames = map[uint8]string{
	0: "idle",
	1: "waiting_deal",
	2: "player_turn",
	3: "waiting_hit",
	4: "dealer_turn",
	5: "win",  // PlayerWin
	6: "lose", // DealerWin
	7: "push",
	8: "blackjack", // PlayerBlackjack
}

func main() {
	fmt.Println("🎰 RiseJack Indexer v1.0.0")
	fmt.Println("⚡ Target Chain: Rise Testnet (10ms blocks)")

	// Load environment
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Get configuration
	rpcURL := os.Getenv("RISE_WSS_URL")
	if rpcURL == "" {
		rpcURL = os.Getenv("RISE_RPC_URL")
	}
	if rpcURL == "" {
		log.Fatal("RISE_WSS_URL or RISE_RPC_URL environment variable required")
	}

	contractAddr := os.Getenv("RISEJACK_CONTRACT_ADDRESS")
	if contractAddr == "" {
		log.Fatal("RISEJACK_CONTRACT_ADDRESS environment variable required")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable required")
	}

	// Connect to database
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	fmt.Println("✅ Connected to PostgreSQL")

	// Connect to Rise Chain
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		log.Fatalf("Failed to connect to Rise Chain: %v", err)
	}
	defer client.Close()
	fmt.Printf("✅ Connected to Rise Chain at %s\n", rpcURL)

	// Parse contract ABI
	parsedABI, err := abi.JSON(strings.NewReader(riseJackABI))
	if err != nil {
		log.Fatalf("Failed to parse ABI: %v", err)
	}

	// Get contract deployment block from env or use default
	deployBlock := uint64(0)
	if deployBlockStr := os.Getenv("CONTRACT_DEPLOY_BLOCK"); deployBlockStr != "" {
		if parsed, err := strconv.ParseUint(deployBlockStr, 10, 64); err == nil {
			deployBlock = parsed
		}
	}

	// Setup context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Run backfill first to catch up on missed events
	backfillEvents(ctx, client, db, common.HexToAddress(contractAddr), parsedABI, deployBlock)

	// Start real-time indexing
	go indexEvents(ctx, client, db, common.HexToAddress(contractAddr), parsedABI)

	<-stop
	log.Println("\n🛑 Shutting down indexer...")
	cancel()
	time.Sleep(time.Second) // Allow goroutines to cleanup
}

// backfillEvents processes all historical events from contract deployment
func backfillEvents(ctx context.Context, client *ethclient.Client, db *sql.DB, contractAddr common.Address, contractABI abi.ABI, deployBlock uint64) {
	fmt.Println("🔄 Starting backfill of historical events...")

	// Get last processed block from DB
	var lastProcessedBlock uint64 = 0
	err := db.QueryRow("SELECT COALESCE(MAX(block_number), 0) FROM games").Scan(&lastProcessedBlock)
	if err != nil {
		log.Printf("Failed to get last processed block: %v", err)
	}

	// Use the higher of deploy block or last processed block
	startBlock := deployBlock
	if lastProcessedBlock > startBlock {
		startBlock = lastProcessedBlock + 1
	}

	// Get current block
	currentBlock, err := client.BlockNumber(ctx)
	if err != nil {
		log.Printf("Failed to get current block: %v", err)
		return
	}

	if startBlock >= currentBlock {
		fmt.Println("✅ Backfill complete - already caught up")
		return
	}

	fmt.Printf("📦 Backfilling blocks %d to %d (%d blocks)\n", startBlock, currentBlock, currentBlock-startBlock)

	// Process in batches of 10000 blocks to avoid RPC limits
	batchSize := uint64(10000)
	totalEvents := 0

	for fromBlock := startBlock; fromBlock < currentBlock; fromBlock += batchSize {
		toBlock := fromBlock + batchSize - 1
		if toBlock > currentBlock {
			toBlock = currentBlock
		}

		query := ethereum.FilterQuery{
			FromBlock: big.NewInt(int64(fromBlock)),
			ToBlock:   big.NewInt(int64(toBlock)),
			Addresses: []common.Address{contractAddr},
		}

		logs, err := client.FilterLogs(ctx, query)
		if err != nil {
			log.Printf("Failed to filter logs for blocks %d-%d: %v", fromBlock, toBlock, err)
			continue
		}

		for _, vLog := range logs {
			processLog(db, contractABI, vLog)
			totalEvents++
		}

		if len(logs) > 0 {
			fmt.Printf("   📊 Processed %d events from blocks %d-%d\n", len(logs), fromBlock, toBlock)
		}
	}

	fmt.Printf("✅ Backfill complete - processed %d total events\n", totalEvents)
}

func indexEvents(ctx context.Context, client *ethclient.Client, db *sql.DB, contractAddr common.Address, contractABI abi.ABI) {
	fmt.Printf("📡 Listening for events on contract: %s\n", contractAddr.Hex())

	// Create filter query
	query := ethereum.FilterQuery{
		Addresses: []common.Address{contractAddr},
	}

	// Subscribe to new logs
	logs := make(chan types.Log)
	sub, err := client.SubscribeFilterLogs(ctx, query, logs)
	if err != nil {
		// Fallback to polling if WebSocket not available
		log.Printf("WebSocket subscription failed, falling back to polling: %v", err)
		pollEvents(ctx, client, db, contractAddr, contractABI)
		return
	}
	defer sub.Unsubscribe()

	fmt.Println("📡 WebSocket subscription active")

	for {
		select {
		case <-ctx.Done():
			return
		case err := <-sub.Err():
			log.Printf("Subscription error: %v", err)
			// Attempt to reconnect
			time.Sleep(5 * time.Second)
			return
		case vLog := <-logs:
			processLog(db, contractABI, vLog)
		}
	}
}

func pollEvents(ctx context.Context, client *ethclient.Client, db *sql.DB, contractAddr common.Address, contractABI abi.ABI) {
	fmt.Println("📡 Polling mode active (every 5 seconds)")

	// Get last processed block from DB
	var lastBlock uint64 = 0
	err := db.QueryRow("SELECT COALESCE(MAX(block_number), 0) FROM games").Scan(&lastBlock)
	if err != nil {
		log.Printf("Failed to get last block: %v", err)
	}

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			currentBlock, err := client.BlockNumber(ctx)
			if err != nil {
				log.Printf("Failed to get block number: %v", err)
				continue
			}

			if currentBlock <= lastBlock {
				continue
			}

			query := ethereum.FilterQuery{
				FromBlock: big.NewInt(int64(lastBlock + 1)),
				ToBlock:   big.NewInt(int64(currentBlock)),
				Addresses: []common.Address{contractAddr},
			}

			logs, err := client.FilterLogs(ctx, query)
			if err != nil {
				log.Printf("Failed to filter logs: %v", err)
				continue
			}

			for _, vLog := range logs {
				processLog(db, contractABI, vLog)
			}

			if len(logs) > 0 {
				fmt.Printf("Processed %d events from blocks %d-%d\n", len(logs), lastBlock+1, currentBlock)
			}
			lastBlock = currentBlock
		}
	}
}

func processLog(db *sql.DB, contractABI abi.ABI, vLog types.Log) {
	// Check if this is a GameEnded event
	gameEndedEvent := contractABI.Events["GameEnded"]
	if len(vLog.Topics) == 0 || vLog.Topics[0] != gameEndedEvent.ID {
		return
	}

	// Decode event
	var event GameEndedEvent
	event.Player = common.HexToAddress(vLog.Topics[1].Hex())

	err := contractABI.UnpackIntoInterface(&event, "GameEnded", vLog.Data)
	if err != nil {
		log.Printf("Failed to unpack event: %v", err)
		return
	}

	outcome := outcomeNames[event.Result]

	// Skip non-terminal states (only process actual game outcomes)
	if event.Result < 5 { // States 0-4 are not final outcomes
		return
	}

	fmt.Printf("🎲 GameEnded: player=%s payout=%s outcome=%s playerValue=%d dealerValue=%d\n",
		event.Player.Hex()[:10]+"...",
		event.Payout.String(),
		outcome,
		event.PlayerFinalValue,
		event.DealerFinalValue,
	)

	// Calculate PNL: if payout > 0, player won, else lost
	// Note: We don't have bet amount in event, so we estimate from payout
	// For wins: payout = 2*bet, so bet = payout/2, pnl = payout - bet = payout/2
	// For blackjack: payout = 2.5*bet, so bet = payout/2.5, pnl = payout - bet
	// For push: payout = bet, pnl = 0
	// For lose: payout = 0, pnl unknown (but we can set to 0 or query later)
	var pnl *big.Int
	var betAmount *big.Int

	switch outcome {
	case "win":
		betAmount = new(big.Int).Div(event.Payout, big.NewInt(2))
		pnl = betAmount // Won 1x bet
	case "blackjack":
		// Payout = bet * 2.5 = bet + bet*1.5, so bet = payout / 2.5 = payout * 2 / 5
		betAmount = new(big.Int).Mul(event.Payout, big.NewInt(2))
		betAmount = new(big.Int).Div(betAmount, big.NewInt(5))
		pnl = new(big.Int).Sub(event.Payout, betAmount) // Won 1.5x bet
	case "push":
		betAmount = event.Payout // Got bet back
		pnl = big.NewInt(0)
	default: // lose
		betAmount = big.NewInt(0) // We don't know the bet from payout=0
		pnl = big.NewInt(0)       // Unknown, set to 0
	}

	// Insert into database
	// Note: Prisma uses client-side UUID generation, so we use gen_random_uuid() in PostgreSQL
	_, err = db.Exec(`
		INSERT INTO games (
			id, user_id, chain_id, game_type, tx_hash, block_number,
			bet_amount, currency, payout, pnl, outcome,
			started_at, ended_at
		)
		SELECT 
			gen_random_uuid(), u.id, 713715, 'blackjack', $1, $2,
			$3, 'ETH', $4, $5, $6,
			NOW(), NOW()
		FROM users u
		WHERE u.wallet_address = $7
		ON CONFLICT (tx_hash) DO NOTHING
	`,
		vLog.TxHash.Hex(),
		vLog.BlockNumber,
		betAmount.String(),
		event.Payout.String(),
		pnl.String(),
		outcome,
		strings.ToLower(event.Player.Hex()),
	)

	if err != nil {
		log.Printf("Failed to insert game: %v", err)
		return
	}

	// Calculate XP based on outcome
	baseXP := 10
	bonusXP := 0
	switch outcome {
	case "win":
		bonusXP = 25
	case "blackjack":
		bonusXP = 50
	case "push":
		bonusXP = 5
	}
	totalXP := baseXP + bonusXP

	// Update user XP and level
	_, err = db.Exec(`
		UPDATE users SET 
			xp = xp + $1,
			level = FLOOR((xp + $1) / 100) + 1,
			updated_at = NOW(),
			last_seen_at = NOW()
		WHERE wallet_address = $2
	`, totalXP, strings.ToLower(event.Player.Hex()))

	if err != nil {
		log.Printf("Failed to update user XP: %v", err)
	} else {
		fmt.Printf("   ⭐ XP awarded: +%d (base: %d, bonus: %d)\n", totalXP, baseXP, bonusXP)
	}

	// Process referral earnings (skip for now since we don't have bet amount)
	// processReferralEarnings(db, event, outcome, vLog.TxHash.Hex())
}

// processReferralEarnings is disabled - requires BetAmount which is no longer in event
// TODO: Re-enable when we add bet amount tracking or query from GameStarted event
/*
func processReferralEarnings(db *sql.DB, event GameEndedEvent, outcome string, txHash string) {
	// ... original implementation commented out ...
}
*/
