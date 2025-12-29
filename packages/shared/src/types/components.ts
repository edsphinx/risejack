import type { GameResult } from './game';
import type { TimeRemaining } from './wallet';

/**
 * Playing card component props
 */
export interface PlayingCardProps {
  cardIndex: number;
  faceUp?: boolean;
  delay?: number;
  isNew?: boolean;
}

/**
 * Hand component props
 */
export interface HandProps {
  cards: readonly number[];
  value?: number;
  isSoft?: boolean;
  isDealer?: boolean;
  hideSecond?: boolean;
  result?: GameResult;
}

/**
 * Action buttons props
 */
export interface ActionButtonsProps {
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSurrender: () => void;
  canDouble: boolean;
  canSurrender: boolean;
  isLoading: boolean;
}

/**
 * Bet input props
 */
export interface BetInputProps {
  minBet: bigint;
  maxBet: bigint;
  onPlaceBet: (amount: string) => void;
  isLoading: boolean;
}

/**
 * Wallet connect component props
 */
export interface WalletConnectProps {
  account: `0x${string}` | null;
  isConnected: boolean;
  isConnecting: boolean;
  hasSessionKey: boolean;
  sessionExpiry: TimeRemaining | null;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onCreateSession: () => Promise<boolean>;
}
