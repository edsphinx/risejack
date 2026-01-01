/**
 * Hooks Index - Export all hooks
 */

// Specialized hooks
export { useWalletConnection, type UseWalletConnectionReturn } from './useWalletConnection';
export { useSessionKey, type UseSessionKeyReturn } from './useSessionKey';
export { useContractState, type UseContractStateReturn } from './useContractState';
export { useGameActions, type UseGameActionsReturn } from './useGameActions';

// Compositor hooks (recommended for components)
export { useRiseWallet } from './useRiseWallet';
export { useGameState, type UseGameStateReturn } from './useGameState';
