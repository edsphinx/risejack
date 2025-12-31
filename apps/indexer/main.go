package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	fmt.Println("🚀 RiseJack Indexer v0.1.0 Starting...")
	fmt.Println("⚡ Target Chain: Rise Testnet (10ms blocks)")

	// Channel to handle graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Placeholder for Indexer Loop
	go func() {
		fmt.Println("Waiting for WebSocket events...")
		// TODO: Implement ethclient connection
	}()

	<-stop
	log.Println("\n🛑 Shutting down indexer...")
}
