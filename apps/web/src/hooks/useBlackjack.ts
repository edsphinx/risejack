import { createPublicClient, createWalletClient, http, custom, parseEther, formatEther } from 'viem';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { RISEJACK_ABI, RISEJACK_ADDRESS, riseTestnet } from '../lib/contract';
import type { GameData, GameState, HandValue, BetLimits } from '@risejack/shared';

export function useBlackjack() {
    const [account, setAccount] = useState<`0x${string}` | null>(null);
    const [gameData, setGameData] = useState<GameData | null>(null);
    const [playerValue, setPlayerValue] = useState<HandValue | null>(null);
    const [dealerValue, setDealerValue] = useState<number | null>(null);
    const [betLimits, setBetLimits] = useState<BetLimits>({ min: 0n, max: 0n });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const publicClient = createPublicClient({
        chain: riseTestnet,
        transport: http(),
    });

    const connect = useCallback(async () => {
        if (typeof window.ethereum === 'undefined') {
            setError('Please install MetaMask');
            return;
        }

        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
            setAccount(accounts[0] as `0x${string}`);

            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${riseTestnet.id.toString(16)}` }],
                });
            } catch (switchError: unknown) {
                if ((switchError as { code: number }).code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: `0x${riseTestnet.id.toString(16)}`,
                            chainName: riseTestnet.name,
                            nativeCurrency: riseTestnet.nativeCurrency,
                            rpcUrls: [riseTestnet.rpcUrls.default.http[0]],
                            blockExplorerUrls: [riseTestnet.blockExplorers.default.url],
                        }],
                    });
                }
            }
        } catch (err: unknown) {
            setError((err as Error).message);
        }
    }, []);

    const fetchBetLimits = useCallback(async () => {
        const [min, max] = await Promise.all([
            publicClient.readContract({ address: RISEJACK_ADDRESS, abi: RISEJACK_ABI, functionName: 'minBet' }),
            publicClient.readContract({ address: RISEJACK_ADDRESS, abi: RISEJACK_ABI, functionName: 'maxBet' }),
        ]);
        setBetLimits({ min, max });
    }, [publicClient]);

    const fetchGameState = useCallback(async () => {
        if (!account) return;

        const [game, handValue, dealerVal] = await Promise.all([
            publicClient.readContract({ address: RISEJACK_ADDRESS, abi: RISEJACK_ABI, functionName: 'getGameState', args: [account] }),
            publicClient.readContract({ address: RISEJACK_ADDRESS, abi: RISEJACK_ABI, functionName: 'getPlayerHandValue', args: [account] }),
            publicClient.readContract({ address: RISEJACK_ADDRESS, abi: RISEJACK_ABI, functionName: 'getDealerVisibleValue', args: [account] }),
        ]);

        setGameData({
            player: game.player,
            bet: game.bet,
            playerCards: game.playerCards,
            dealerCards: game.dealerCards,
            state: game.state as GameState,
            timestamp: game.timestamp,
            isDoubled: game.isDoubled,
        });
        setPlayerValue({ value: handValue[0], isSoft: handValue[1] });
        setDealerValue(dealerVal);
    }, [account, publicClient]);

    const executeAction = useCallback(async (
        functionName: 'placeBet' | 'hit' | 'stand' | 'double' | 'surrender',
        value?: bigint
    ) => {
        if (!account) return;
        setIsLoading(true);
        setError(null);

        try {
            const walletClient = createWalletClient({
                chain: riseTestnet,
                transport: custom(window.ethereum!),
            });

            let hash: `0x${string}`;

            if (value) {
                hash = await walletClient.writeContract({
                    address: RISEJACK_ADDRESS,
                    abi: RISEJACK_ABI,
                    functionName: functionName as 'placeBet' | 'double',
                    account,
                    value,
                });
            } else {
                hash = await walletClient.writeContract({
                    address: RISEJACK_ADDRESS,
                    abi: RISEJACK_ABI,
                    functionName: functionName as 'hit' | 'stand' | 'surrender',
                    account,
                });
            }

            await publicClient.waitForTransactionReceipt({ hash });
            await fetchGameState();
        } catch (err: unknown) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [account, publicClient, fetchGameState]);

    const placeBet = useCallback((betAmount: string) =>
        executeAction('placeBet', parseEther(betAmount)), [executeAction]);

    const hit = useCallback(() => executeAction('hit'), [executeAction]);
    const stand = useCallback(() => executeAction('stand'), [executeAction]);
    const double = useCallback(() =>
        gameData ? executeAction('double', gameData.bet) : undefined, [executeAction, gameData]);
    const surrender = useCallback(() => executeAction('surrender'), [executeAction]);

    useEffect(() => {
        fetchBetLimits();
    }, [fetchBetLimits]);

    useEffect(() => {
        if (!account) return;

        fetchGameState();
        const interval = setInterval(fetchGameState, 2000);
        return () => clearInterval(interval);
    }, [account, fetchGameState]);

    return {
        account,
        gameData,
        playerValue,
        dealerValue,
        betLimits,
        isLoading,
        error,
        connect,
        placeBet,
        hit,
        stand,
        double,
        surrender,
        fetchGameState,
        formatEther,
    };
}

declare global {
    interface Window {
        ethereum?: {
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        };
    }
}
