# RiseJack Game State Fixes - Implementation Plan

## Overview

Based on the [Game Flow Analysis](file:///home/edsphinx/Blockchain/RiseJack/risejack/docs/GAME_FLOW_ANALYSIS.md), this plan addresses all identified bugs.

---

## Problem 1: Previous Game State Persists into New Game

### Symptom

- After game ends, old cards visible when starting new game
- Result banner stays visible during new game

### Root Cause

`wrappedPlaceBet` clears `lastGameResult` in useGameState, but GameBoard's `lastHand` is not linked to it.

### Current Code (GameBoard.tsx)

```tsx
// Line 30
const [lastHand, setLastHand] = useState<HandSnapshot | null>(null);

// Lines 65-122: useEffect that SETS lastHand when game ends
useEffect(() => {
  if (game.lastGameResult) {
    // ... sets lastHand
  }
}, [game.lastGameResult, ...]);
```

There's NO useEffect that CLEARS `lastHand` when `lastGameResult` becomes null.

### Fix Required

Add useEffect in GameBoard.tsx to clear `lastHand` when `lastGameResult` becomes null:

```tsx
// ADD after line 122 in GameBoard.tsx
useEffect(() => {
  if (!game.lastGameResult) {
    setLastHand(null);
    lastSavedResultRef.current = null; // Also reset duplicate check
  }
}, [game.lastGameResult]);
```

### Files to Modify

- [GameBoard.tsx](file:///home/edsphinx/Blockchain/RiseJack/risejack/apps/web/src/components/game/GameBoard.tsx)

---

## Problem 2: Button Visibility After Game Ends

### Symptom

- After game ends, "LET'S GO" button not visible
- Or action buttons stuck visible

### Current Code (GameBoard.tsx line 159)

```tsx
const isIdle = canBet && !game.lastGameResult;
```

This means when result is showing, `isIdle = false`.
But `canBet = true` (contract in terminal state).

### Analysis

The current logic is actually CORRECT for these states:

- Game just ended → `isIdle = false`, show result
- Result cleared (new bet placed) → `isIdle = true`, show bet UI

The problem is that the conditional rendering in GameBoard might not handle all cases.

### Verify Rendering Logic

Need to examine how GameBoard renders buttons based on:

- `isIdle` (show bet UI)
- `canPlay` (show action buttons)
- `gameResult` (show result + play again)

### Files to Examine

- GameBoard.tsx lines 200-400 (rendering logic)

---

## Problem 3: Session Key Stops Working

### Symptom

- Session key fails with UserRejectedRequestError
- Cannot re-enable after revoking

### Root Causes

1. MetaMask fights with Rise Wallet for `window.ethereum`
2. Rise Wallet IndexedDB corrupted
3. localStorage has stale session key data

### Current Mitigations (Already Implemented)

1. `clearAllSessionKeys()` when transaction fails (useGameActions.ts)
2. Recovery modal with IndexedDB cleanup (walletRecovery.ts)
3. `checkPendingDbDelete()` on startup (main.tsx)
4. Removed auto-create session key on load (useRiseWallet.ts)

### Additional Fixes Needed

**A. Add MetaMask conflict detection:**

In `riseWallet.ts` or app startup, detect if MetaMask is present:

```tsx
// Check for MetaMask conflict
if (window.ethereum && window.ethereum.isMetaMask) {
  console.warn('⚠️ MetaMask detected - may conflict with Rise Wallet');
  // Optionally show user warning
}
```

**B. Fallback to passkey-only mode:**

If session key repeatedly fails, offer to disable Fast Mode:

```tsx
// In useGameActions.ts, track consecutive failures
const [sessionKeyFailures, setSessionKeyFailures] = useState(0);

// If > 3 failures, suggest disabling Fast Mode
if (sessionKeyFailures > 3) {
  // Show UI to disable Fast Mode and use passkey only
}
```

### Files to Modify

- [riseWallet.ts](file:///home/edsphinx/Blockchain/RiseJack/risejack/apps/web/src/lib/riseWallet.ts)
- [useGameActions.ts](file:///home/edsphinx/Blockchain/RiseJack/risejack/apps/web/src/hooks/useGameActions.ts)

---

## Problem 4: lastHand Persists Old Cards

### Symptom

- Old cards show in result area when should be cleared

### Current Flow

1. Game ends → `handleGameEnd` sets `lastGameResult`
2. GameBoard useEffect sets `lastHand` from `lastGameResult`
3. New bet placed → `wrappedPlaceBet` clears `lastGameResult`
4. **Missing:** Nothing clears `lastHand`

### Fix (Same as Problem 1)

The useEffect to clear `lastHand` solves this.

---

## Implementation Order

### Phase 1: Core Game State Fix (Minimal Risk)

1. Add useEffect to clear `lastHand` in GameBoard.tsx
2. Test: Complete game → Place new bet → Verify old cards cleared

### Phase 2: Verify Button Rendering (Analysis Only)

1. Review GameBoard rendering logic
2. Confirm buttons appear correctly in all states
3. Only modify if needed

### Phase 3: Session Key Robustness (Low Priority)

1. Add MetaMask conflict warning
2. Add session key failure counter
3. Add fallback to passkey-only mode

---

## Changes Summary

| File              | Change                          | Risk |
| ----------------- | ------------------------------- | ---- |
| GameBoard.tsx     | Add useEffect to clear lastHand | LOW  |
| riseWallet.ts     | Add MetaMask detection warning  | LOW  |
| useGameActions.ts | Add failure counter (optional)  | LOW  |

---

## Testing Strategy

### Setup Requirements

**Unit Tests (Vitest):**

```bash
bun add -D vitest @testing-library/preact @testing-library/user-event jsdom
```

**E2E Tests (Playwright):**

```bash
bunx playwright install
bun add -D @playwright/test
```

---

### Unit Tests

#### Test 1: wrappedPlaceBet clears state

```typescript
// apps/web/src/hooks/__tests__/useGameState.test.ts
it('clears lastGameResult when placeBet is called', async () => {
  // Simulate game end, verify lastGameResult populated
  // Call placeBet, verify lastGameResult = null
});
```

#### Test 2: GameBoard clears lastHand

```typescript
// apps/web/src/components/game/__tests__/GameBoard.test.tsx
it('clears lastHand when lastGameResult becomes null', () => {
  // Render with result, verify visible
  // Clear lastGameResult, verify not visible
});
```

---

### E2E Tests (Playwright)

#### Test 1: Complete Game Cycle

```typescript
// e2e/game-flow.spec.ts
test('completes game and starts new with cleared state', async ({ page }) => {
  // Connect → Bet → Play → Result → New bet → Verify cleared
});
```

#### Test 2: Multiple Games

```typescript
test('3 consecutive games maintain correct state', async ({ page }) => {
  // Loop 3 games, verify no state leakage
});
```

---

### Data-Testid Attributes Needed

| Component      | ID                 |
| -------------- | ------------------ |
| Connect Button | `connect-wallet`   |
| Bet Input      | `bet-input`        |
| Place Bet      | `place-bet-button` |
| Stand Button   | `stand-button`     |
| Game Result    | `game-result`      |

---

## Updated Implementation Order

1. **Phase 1: Setup Tests** - Install Vitest + Playwright, add data-testids
2. **Phase 2: Core Fix** - Add useEffect to clear lastHand
3. **Phase 3: Unit Tests** - Write and verify unit tests pass
4. **Phase 4: E2E Tests** - Write game flow tests
5. **Phase 5: Session Key** - Add MetaMask detection, failure counter

---

## Conflict Analysis Matrix

### All Fixes Under Consideration

| ID  | Fix                                           | Affects                           |
| --- | --------------------------------------------- | --------------------------------- |
| F1  | Clear `lastHand` when `lastGameResult` → null | GameBoard.tsx state               |
| F2  | Clear `lastGameResult` in `wrappedPlaceBet`   | useGameState.ts (ALREADY DONE)    |
| F3  | Reset Wallet button                           | WalletDropdown.tsx (ALREADY DONE) |
| F4  | MetaMask detection warning                    | riseWallet.ts                     |
| F5  | Session key failure counter                   | useGameActions.ts                 |
| F6  | Don't clear state immediately (wait for VRF)  | useGameState.ts                   |

---

### Conflict Matrix

| Fix    | F1  | F2  | F3  | F4  | F5  | F6  |
| ------ | --- | --- | --- | --- | --- | --- |
| **F1** | -   | ✅  | ✅  | ✅  | ✅  | ⚠️  |
| **F2** | ✅  | -   | ✅  | ✅  | ✅  | ⚠️  |
| **F3** | ✅  | ✅  | -   | ✅  | ✅  | ✅  |
| **F4** | ✅  | ✅  | ✅  | -   | ✅  | ✅  |
| **F5** | ✅  | ✅  | ✅  | ✅  | -   | ✅  |
| **F6** | ⚠️  | ⚠️  | ✅  | ✅  | ✅  | -   |

✅ = Compatible
⚠️ = Potential conflict

---

### Identified Conflicts

#### CONFLICT 1: F1/F2 vs F6 (State Clearing vs VRF Wait)

**Problem:**

- F1/F2: Clear state immediately when new bet placed
- F6: Don't clear state until VRF responds (needed for HIT display)

**Scenario:**

1. User in PlayerTurn, clicks HIT
2. TX succeeds, state = WaitingForHit
3. VRF takes 5 seconds
4. `onSuccess` refetches, but VRF not done yet
5. User clicks "Play Again" before game finishes → F2 clears state
6. VRF responds → CardDealt event arrives → nowhere to display

**Resolution:**

- F2 should ONLY clear for `placeBet`, not for actions mid-game
- Check: Is game truly Idle before clearing?
- Add condition: `if (gameData.state === GameState.Idle) { clear }`

---

#### CONFLICT 2: Multiple State Sources

**Problem:**

- `lastGameResult` (useGameState) - set by WebSocket
- `lastHand` (GameBoard) - set by useEffect watching lastGameResult
- `gameData` (useContractState) - set by contract refetch
- These can get out of sync

**Scenario:**

1. Game ends via WebSocket → lastGameResult set
2. Refetch shows Idle (contract reset fast)
3. User sees result, clicks Play Again
4. lastGameResult cleared BUT lastHand wasn't
5. Old cards still visible

**Resolution:**

- F1 fixes this: useEffect watching lastGameResult → clears lastHand ✅

---

### Safe Implementation Order (Dependency-Based)

1. **F1 first** - adds missing link between lastGameResult and lastHand
2. **Keep F2 as-is** - already implemented, works with F1
3. **F3 done** - Reset Wallet button independent
4. **F4 optional** - just a warning, no state changes
5. **F5 optional** - only affects session key flow
6. **F6 NOT NEEDED** - VRF timing handled by CardDealt WebSocket

---

### Verification After Each Fix

| After Fix | Test Case                          | Expected                                   |
| --------- | ---------------------------------- | ------------------------------------------ |
| F1        | Play game → Win → Click new bet    | Old cards disappear                        |
| F1        | HIT during game                    | Cards still visible (no clearing mid-game) |
| F2        | placeBet clears result             | New game starts fresh                      |
| F3        | Reset Wallet → Re-enable Fast Mode | Should work                                |

---

## Current Status

- [x] F1 - Clear lastHand useEffect (DONE)
- [x] F2 - wrappedPlaceBet (ALREADY EXISTS)
- [x] F3 - Reset Wallet button (DONE)
- [ ] F4 - MetaMask warning (LOW PRIORITY)
- [ ] F5 - Session key failure counter (LOW PRIORITY)

---

## Approval Required

1. Is this conflict analysis complete?
2. Any other scenarios that could cause conflicts?
3. Ready to continue testing F1 (already implemented)?
