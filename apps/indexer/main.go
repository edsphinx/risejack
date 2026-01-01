package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math/big"
	"os"
	"os/signal"
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

// RiseJack contract events
const riseJackABI = `[
	{"anonymous":false,"inputs":[{"indexed":true,"name":"player","type":"address"},{"indexed":false,"name":"betAmount","type":"uint256"},{"indexed":false,"name":"payout","type":"uint256"},{"indexed":false,"name":"outcome","type":"uint8"}],"name":"GameEnded","type":"event"}
]`

// GameEnded event structure
type GameEndedEvent struct {
	Player    common.Address
	BetAmount *big.Int
	Payout    *big.Int
	Outcome   uint8
}

// Outcome enum
var outcomeNames = map[uint8]string{
	0: "lose",
	1: "win",
	2: "push",
	3: "blackjack",
	4: "surrender",
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

	// Setup context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Start indexing
	go indexEvents(ctx, client, db, common.HexToAddress(contractAddr), parsedABI)

	<-stop
	log.Println("\n🛑 Shutting down indexer...")
	cancel()
	time.Sleep(time.Second) // Allow goroutines to cleanup
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

	outcome := outcomeNames[event.Outcome]
	pnl := new(big.Int).Sub(event.Payout, event.BetAmount)

	fmt.Printf("🎲 GameEnded: player=%s bet=%s payout=%s outcome=%s\n",
		event.Player.Hex()[:10]+"...",
		event.BetAmount.String(),
		event.Payout.String(),
		outcome,
	)

	// Insert into database
	_, err = db.Exec(`
		INSERT INTO games (
			user_id, game_type, tx_hash, block_number,
			bet_amount, currency, payout, pnl, outcome,
			started_at, ended_at
		)
		SELECT 
			u.id, 'blackjack', $1, $2,
			$3, 'ETH', $4, $5, $6,
			NOW(), NOW()
		FROM users u
		WHERE u.wallet_address = $7
		ON CONFLICT (tx_hash) DO NOTHING
	`,
		vLog.TxHash.Hex(),
		vLog.BlockNumber,
		event.BetAmount.String(),
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
	case "surrender":
		bonusXP = 2
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

	// Process referral earnings (10% of house edge to referrer)
	processReferralEarnings(db, event, outcome, vLog.TxHash.Hex())
}

// processReferralEarnings calculates and stores referral earnings
// Referrer earns 10% of house edge from each game their referees play
func processReferralEarnings(db *sql.DB, event GameEndedEvent, outcome string, txHash string) {
	playerAddress := strings.ToLower(event.Player.Hex())

	// Skip if player lost (no house edge to share)
	if outcome == "lose" || outcome == "surrender" {
		return
	}

	// Calculate house edge: betAmount - payout for wins, or betAmount for losses
	// For wins/blackjack/push, house still takes a small edge on average
	// We use a fixed 1% of bet as approximation
	houseEdge := new(big.Int).Div(event.BetAmount, big.NewInt(100)) // 1% of bet

	// Referrer earns 10% of house edge
	referrerEarning := new(big.Int).Div(houseEdge, big.NewInt(10))

	if referrerEarning.Cmp(big.NewInt(0)) <= 0 {
		return // No earnings to distribute
	}

	// Find player's referrer
	var referrerId, referrerWallet string
	err := db.QueryRow(`
		SELECT u2.id, u2.wallet_address
		FROM users u1
		JOIN users u2 ON u1.referrer_id = u2.id
		WHERE u1.wallet_address = $1 AND u1.referrer_id IS NOT NULL
	`, playerAddress).Scan(&referrerId, &referrerWallet)

	if err != nil {
		// No referrer found - this is normal for users without referrals
		return
	}

	// Get player's user ID for the earning record
	var playerId, gameId string
	err = db.QueryRow(`SELECT id FROM users WHERE wallet_address = $1`, playerAddress).Scan(&playerId)
	if err != nil {
		log.Printf("Failed to get player ID: %v", err)
		return
	}

	// Get game ID from the tx just inserted
	err = db.QueryRow(`SELECT id FROM games WHERE tx_hash = $1`, txHash).Scan(&gameId)
	if err != nil {
		log.Printf("Failed to get game ID: %v", err)
		return
	}

	// Insert referral earning (Tier 1)
	_, err = db.Exec(`
		INSERT INTO referral_earnings (
			referrer_id, referee_id, game_id,
			tier, house_edge, earned, currency,
			claimed, created_at
		) VALUES ($1, $2, $3, 1, $4, $5, 'ETH', false, NOW())
		ON CONFLICT DO NOTHING
	`,
		referrerId,
		playerId,
		gameId,
		houseEdge.String(),
		referrerEarning.String(),
	)

	if err != nil {
		log.Printf("Failed to insert referral earning: %v", err)
		return
	}

	fmt.Printf("   💰 Referral earning: %s -> %s (+%s wei)\n",
		playerAddress[:10]+"...",
		referrerWallet[:10]+"...",
		referrerEarning.String(),
	)

	// TODO (Phase 2): Implement Tier 2 earnings (referrer's referrer gets 2%)
}
