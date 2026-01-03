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
  balance: bigint | null;
  formatBalance: () => string;
  onConnect: () => void;
  onDisconnect: () => void;
  onCreateSession: () => Promise<boolean>;
  onRevokeSession: () => void;
}

/**
 * Session expiry modal props
 */
export interface SessionExpiryModalProps {
  onExtend: () => Promise<void>;
  onSkip: () => void;
  isLoading: boolean;
}

/**
 * Fast mode onboarding modal props
 */
export interface FastModeOnboardingProps {
  onEnable: () => Promise<void>;
  onSkip: () => void;
  isLoading: boolean;
}

/**
 * Session expiry warning props
 */
export interface SessionWarningProps {
  minutesLeft: number;
  onExtend: () => void;
}

/**
 * Rise wallet hook return type
 */
export interface UseRiseWalletReturn {
  // Connection
  address: `0x${string}` | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;

  // Balance
  balance: bigint | null;
  formatBalance: () => string;

  // Session Key
  hasSessionKey: boolean;
  sessionExpiry: TimeRemaining | null;
  createSessionKey: () => Promise<boolean>;
  revokeSessionKey: () => Promise<void>;
  isCreatingSession: boolean;

  // Auto Session Flow
  showOnboarding: boolean;
  showExpiryModal: boolean;
  expiryWarningMinutes: number | null;
  dismissOnboarding: (enableFastMode: boolean) => Promise<void>;
  dismissExpiryModal: (extend: boolean) => Promise<void>;

  // Wallet Recovery
  showRecoveryModal: boolean;
  openRecoveryModal: () => void;
  closeRecoveryModal: () => void;
  handleRecoveryComplete: () => void;

  // Internal - for useGameActions
  keyPair: { publicKey: string; privateKey: string } | null;
}
