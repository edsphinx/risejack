# RiseJack Game Flow Analysis

## 1. Contract GameState Enum (from RiseJack.sol)

```solidity
enum GameState {
    Idle,           // 0 - No active game, ready for bet
    WaitingForDeal, // 1 - Bet placed, waiting VRF for initial cards
    PlayerTurn,     // 2 - Player's turn to act
    WaitingForHit,  // 3 - Hit requested, waiting VRF for new card
    DealerTurn,     // 4 - Stand called, dealer plays (auto VRF)
    PlayerWin,      // 5 - TERMINAL: Player wins
    DealerWin,      // 6 - TERMINAL: Dealer wins
    Push,           // 7 - TERMINAL: Tie
    PlayerBlackjack // 8 - TERMINAL: Player got blackjack
}
```

**Terminal States:** 5, 6, 7, 8 (game ended, ready for new bet)

---

## 2. State Sources in Frontend

| Source                | Hook               | What it provides                                      |
| --------------------- | ------------------ | ----------------------------------------------------- |
| **Contract state**    | `useContractState` | `gameData.state`, `playerCards`, `dealerCards`, `bet` |
| **WebSocket events**  | `useGameEvents`    | `GameEnded`, `CardDealt` events in real-time          |
| **Local accumulator** | `useGameState`     | `accumulatedCards`, `lastGameResult`                  |
| **UI snapshot**       | `GameBoard`        | `lastHand` for display persistence                    |

---

## 3. Complete Game Flow

### PHASE 1: IDLE (Ready to Bet)

**Condition:** `gameData.state === Idle` AND `lastGameResult === null`

**UI Shows:**

- Bet amount selector
- "LET'S GO" button

**State Values:**

- `canBet = true`
- `isIdle = true` (canBet && !lastGameResult)
- `canPlay = false`
- `gameResult = null`

---

### PHASE 2: PLACING BET (Transition)

**User Action:** Click "LET'S GO"

**What Happens:**

1. `placeBet(amount)` called
2. Transaction sent to contract
3. `onSuccess` calls `state.refetch()`
4. Contract state changes to `WaitingForDeal`

**⚠️ PROBLEM IDENTIFIED:**
If `lastGameResult` exists from previous game, `isIdle = canBet && !lastGameResult = false`.
But `canBet = true` because `gameData.state === Idle`.

See line 159 in GameBoard.tsx:

```tsx
const isIdle = canBet && !game.lastGameResult;
```

---

### PHASE 3: WAITING FOR VRF (Initial Deal)

**Condition:** `gameData.state === WaitingForDeal`

**UI Shows:**

- VRF waiting overlay
- Should NOT show betting UI

**State Values:**

- `canBet = false`
- `canPlay = false`
- `isWaitingVRF = true`

---

### PHASE 4: PLAYER TURN

**Condition:** `gameData.state === PlayerTurn`

**What Happens:**

- VRF completed, cards dealt
- `CardDealt` events accumulate in `accumulatedCards`
- Contract updated with cards

**UI Shows:**

- Player's cards
- Dealer's cards (one hidden)
- Action buttons: HIT, STAND, DOUBLE, SURRENDER

**State Values:**

- `canBet = false`
- `canPlay = true`
- `isIdle = false`

---

### PHASE 5: HIT (Player requests card)

**User Action:** Click "HIT"

**What Happens:**

1. `snapshotCards()` saves current cards as backup
2. `hit()` sends transaction
3. Contract state changes to `WaitingForHit`
4. VRF provides new card
5. `CardDealt` event fires → `handleCardDealt` adds to accumulator
6. If bust → goes to `DealerWin` (terminal)
7. Else → back to `PlayerTurn`

---

### PHASE 6: STAND (Player ends turn)

**User Action:** Click "STAND"

**What Happens:**

1. `snapshotCards()` saves current cards
2. `stand()` sends transaction
3. Contract state changes to `DealerTurn`
4. Dealer automatically plays (VRF for each card)
5. `CardDealt` events fire for dealer cards
6. Game ends → terminal state (5, 6, 7, or 8)

---

### PHASE 7: GAME ENDED (Terminal State)

**Condition:** `gameData.state` is 5, 6, 7, or 8

**What Happens (via WebSocket):**

1. `GameEnded` event fires
2. `handleGameEnd` in useGameState:
   - Creates `lastGameResult` with cards + outcome
   - Clears `accumulatedCards`
3. `GameBoard` useEffect reacts to `lastGameResult`:
   - Sets `lastHand` for display persistence
   - Saves to history
   - Shows XP popup

**UI Shows:**

- Result banner (WIN/LOSE/PUSH/BLACKJACK)
- Final cards (from `lastHand`)
- Payout amount
- "PLAY AGAIN" button

**State Values:**

- `gameResult = 'win'/'lose'/'push'/'blackjack'`
- `canBet = true` (contract state is terminal)
- `isIdle = canBet && !lastGameResult = FALSE` ← This is key!
- `canPlay = false`

---

### PHASE 8: READY FOR NEW GAME

**Condition:**

- Contract `gameData.state` is terminal OR Idle
- User wants to play again

**⚠️ THE BUG:**
When user clicks "PLAY AGAIN":

- `lastGameResult` is NOT cleared
- So `isIdle` remains FALSE
- But `canBet` is TRUE
- UI should show betting interface but logic is confused

**What SHOULD happen:**
When placing a new bet, we need to:

1. Clear `lastGameResult` → so `isIdle` becomes true
2. Clear `lastHand` → so old cards don't display
3. Clear `accumulatedCards` → ready for new cards

---

## 4. Key State Variables Summary

| Variable           | Where            | Purpose                         | When to Clear           |
| ------------------ | ---------------- | ------------------------------- | ----------------------- |
| `gameData`         | useContractState | Contract state                  | Never (refetched)       |
| `accumulatedCards` | useGameState     | Real-time cards from WebSocket  | On game end, on new bet |
| `lastGameResult`   | useGameState     | Persists result after game ends | On new bet              |
| `lastHand`         | GameBoard        | UI display of final cards       | On new bet              |
| `cardSnapshotRef`  | useGameState     | Backup before actions           | On game end, on new bet |

---

## 5. Identified Issues

### Issue 1: `isIdle` Logic

**Line 159 GameBoard.tsx:**

```tsx
const isIdle = canBet && !game.lastGameResult;
```

When game ends, `lastGameResult` is set, so `isIdle = false`.
But `canBet = true` because contract is in terminal state.

This means the UI may not show the correct interface after game ends.

### Issue 2: State Not Cleared on New Bet

When user clicks "PLAY AGAIN", `placeBet` is called but:

- `lastGameResult` is NOT cleared
- `lastHand` is NOT cleared in GameBoard
- Old UI state persists

### Issue 3: `clearLastResult` Exists But Not Used

There's a `clearLastResult` function in useGameState but it's not called when placing a new bet.

---

## 6. Recommended Fix

The `wrappedPlaceBet` approach was correct in concept but needs to also signal GameBoard to clear `lastHand`:

```tsx
// In useGameState
const wrappedPlaceBet = async (betAmount: string): Promise<boolean> => {
  // Clear previous game state
  setLastGameResult(null);
  setAccumulatedCards({ playerCards: [], dealerCards: [], dealerHiddenCard: null });
  cardSnapshotRef.current = null;
  return actions.placeBet(betAmount);
};
```

**But also in GameBoard:**

```tsx
// GameBoard should clear lastHand when lastGameResult becomes null
useEffect(() => {
  if (!game.lastGameResult) {
    setLastHand(null);
  }
}, [game.lastGameResult]);
```

---

## 8. ALL Possible Gameplay Scenarios

### A. Fresh Start (First Game Ever)

```
State: Idle, lastGameResult: null, lastHand: null
UI: Bet selector + "LET'S GO" button
User Action: Place bet
→ State: WaitingForDeal
```

### B. Normal Win Flow

```
1. Idle → PlaceBet → WaitingForDeal
2. VRF completes → PlayerTurn (2 cards each)
3. User: HIT → WaitingForHit → back to PlayerTurn (or bust)
4. User: STAND → DealerTurn
5. Dealer plays → PlayerWin
6. UI shows "YOU WIN" + final cards + payout
```

### C. Player Busts (Loses by going over 21)

```
1. PlayerTurn with 2 cards
2. User: HIT → WaitingForHit
3. New card makes total > 21
4. Immediately → DealerWin (no dealer play)
5. UI shows "BUST" + cards
```

### D. Blackjack on Initial Deal

```
1. Idle → PlaceBet → WaitingForDeal
2. VRF completes → PlayerBlackjack (player has 21)
3. No user actions available
4. UI shows "BLACKJACK!" + 2.5x payout
```

### E. DOUBLE Action

```
Condition: PlayerTurn, exactly 2 cards, not yet doubled
1. User: DOUBLE (bet doubles)
2. → WaitingForHit
3. Exactly 1 card dealt
4. → Auto-STAND (DealerTurn)
5. → Terminal state
```

### F. SURRENDER Action

```
Condition: PlayerTurn, exactly 2 cards
1. User: SURRENDER
2. → Immediately DealerWin
3. 50% of bet returned
4. UI shows "SURRENDER"
```

### G. Push (Tie)

```
1. Player and Dealer have equal value ≤21
2. → Push state
3. Full bet returned
4. UI shows "PUSH - BET RETURNED"
```

### H. VRF Timeout (Deal)

```
1. PlaceBet → WaitingForDeal
2. VRF doesn't respond within 30 seconds
3. UI shows "CANCEL" button
4. User: Cancel → Idle
5. Full bet returned
```

### I. VRF Timeout (Hit)

```
1. PlayerTurn → HIT → WaitingForHit
2. VRF doesn't respond within 30 seconds
3. UI shows "CANCEL" button
4. User: Cancel → Idle
5. Full bet returned
```

### J. Page Refresh Scenarios

| Refresh During               | Contract State     | What Happens                |
| ---------------------------- | ------------------ | --------------------------- |
| Bet selection                | Idle               | Show bet UI                 |
| VRF wait                     | WaitingForDeal/Hit | Show VRF overlay            |
| Player turn                  | PlayerTurn         | Show cards + action buttons |
| Dealer turn                  | DealerTurn         | Watch dealer play out       |
| Result display               | Terminal           | Show result again           |
| After result, before new bet | Terminal           | Show result + "Play Again"  |

### K. Second Game (After Completing One)

```
PROBLEM SCENARIO:
1. First game ends → lastGameResult = {result, cards}
2. User clicks "PLAY AGAIN"
3. placeBet() called
4. BUT: lastGameResult still exists
5. UI may show old cards or wrong buttons
```

### L. Wallet Disconnects Mid-Game

```
1. User in PlayerTurn
2. Wallet disconnects
3. UI should show reconnect prompt
4. Contract state unchanged (game waiting)
5. On reconnect: resume from PlayerTurn
```

---

## 9. Button Visibility Rules

| Button                   | Visible When                                  |
| ------------------------ | --------------------------------------------- | --- | ------------ |
| **LET'S GO** (Place Bet) | `canBet && (isIdle                            |     | gameResult)` |
| **HIT**                  | `canPlay`                                     |
| **STAND**                | `canPlay`                                     |
| **DOUBLE**               | `canPlay && cards.length === 2 && !isDoubled` |
| **SURRENDER**            | `canPlay && cards.length === 2`               |
| **CANCEL**               | `isWaitingVRF && vrfTimeout > 30s`            |
| **PLAY AGAIN**           | `gameResult !== null && canBet`               |

---

## 10. State Variable Truth Table

| Scenario      | gameData.state | lastGameResult | canBet | canPlay | isIdle | gameResult | Show                |
| ------------- | -------------- | -------------- | ------ | ------- | ------ | ---------- | ------------------- |
| Fresh start   | Idle           | null           | ✅     | ❌      | ✅     | null       | Bet UI              |
| Waiting VRF   | WaitingForDeal | null           | ❌     | ❌      | ❌     | null       | VRF overlay         |
| Player turn   | PlayerTurn     | null           | ❌     | ✅      | ❌     | null       | Action buttons      |
| Just won      | PlayerWin      | {win,...}      | ✅     | ❌      | ❌     | 'win'      | Result + Play Again |
| Just lost     | DealerWin      | {lose,...}     | ✅     | ❌      | ❌     | 'lose'     | Result + Play Again |
| After refetch | Idle           | {result,...}   | ✅     | ❌      | ❌     | result     | **BUG: Wrong UI**   |

---

## 11. The Core Bug Explained

**After game ends and contract resets to Idle:**

```tsx
// GameBoard.tsx line 159
const isIdle = canBet && !game.lastGameResult;

// With:
// - gameData.state = Idle (refetched)
// - lastGameResult = {result: 'win', ...} (not cleared)

// Result:
// canBet = true (state is Idle)
// isIdle = true && !{...} = true && false = FALSE

// But we want isIdle = FALSE while showing result,
// and isIdle = TRUE after user starts new bet
```

**Problem:** The code conflates "showing result" with "ready to bet".

### M. Multiple Tabs Open

```
TAB 1: User starts game, in PlayerTurn
TAB 2: User opens same page

Behavior (current):
- TAB 2 connects, reads contract state (PlayerTurn)
- TAB 2 shows cards + action buttons
- Both tabs subscribe to WebSocket (same player address)

Potential Issues:
1. User clicks HIT in TAB 1
2. TAB 2 also receives CardDealt event
3. Both tabs update their accumulatedCards
4. User confused which tab to use

5. User clicks STAND in TAB 1
6. Game ends → GameEnded event fires
7. BOTH tabs receive GameEnded
8. BOTH tabs set lastGameResult
9. One tab shows "YOU WIN", other may show stale state
```

**Risk Level:** MEDIUM - Contract is single-source-of-truth so no data corruption, but UX is confusing.

**Current Mitigation:** None. WebSocket broadcasts to all tabs.

**Possible Solutions:**

1. Detect focus/visibility and only allow actions from active tab
2. Use BroadcastChannel to sync tabs
3. Lock to single tab (show warning in second tab)

### N. Same Account on Desktop + Mobile Simultaneously

```text
DEVICE 1 (Desktop): User in PlayerTurn
DEVICE 2 (Mobile): User opens app, same wallet

Differences from Multi-Tab:
- Different physical devices
- Different WebSocket connections
- Different local state (accumulatedCards, etc.)
- Cannot use BroadcastChannel (different devices)

Behavior:
- Both devices read same contract state (PlayerTurn)
- Both show action buttons
- User clicks HIT on Desktop
- Mobile doesn't see immediate update (no shared state)
- Mobile only sees CardDealt via WebSocket
- If Mobile user clicks STAND before CardDealt arrives:
  → Contract rejects (wrong game state or nonce)
  → UI shows error
```

**Risk Level:** LOW-MEDIUM - Contract protects integrity, but UX confusing.

**Possible Solutions:**

1. Show "Game active on another device" warning
2. Accept as edge case (contract protects data)

---

## 12. Correct State Clearing Points

| Event                    | Clear lastGameResult | Clear lastHand    | Clear accumulatedCards |
| ------------------------ | -------------------- | ----------------- | ---------------------- |
| Game ends                | ❌ (need to show)    | ❌ (need to show) | ✅                     |
| User clicks "Play Again" | ✅                   | ✅                | ✅                     |
| placeBet() called        | ✅                   | ✅                | ✅                     |
| New cards arrive         | ❌                   | ❌                | ❌ (accumulating)      |

---

## 13. Session Key / Fast Mode Issues

### O. Session Key Stops Working Mid-Game

```text
OBSERVED BEHAVIOR:
1. User has Fast Mode enabled (session key active)
2. After some time/actions, transactions start requiring confirmation
3. Session key appears valid but wallet_sendPreparedCalls fails with UserRejectedRequestError
4. User revokes session key
5. User tries to enable Fast Mode again
6. wallet_grantPermissions ALSO fails with UserRejectedRequestError
7. User stuck - cannot use Fast Mode anymore
```

**Error Log Pattern:**

```
🔑 Failed to create session key: Provider.UserRejectedRequestError: The user rejected the request.
    at async createSessionKey (sessionKeyManager.ts:137:3)
```

**Root Causes:**

1. Rise Wallet (Porto) internal state corrupted
2. MetaMask extension conflicting with ethereum provider
3. Session expired but localStorage still has stale data
4. IndexedDB data corrupted after browser crash/update

**MetaMask Conflict Error:**

```
MetaMask encountered an error setting the global Ethereum provider -
TypeError: Cannot set property ethereum of #<Window> which has only a getter
```

This indicates MetaMask is fighting with Rise Wallet for `window.ethereum`.

**Current Mitigations:**

- Auto-clear session key when transaction fails with UserRejected (implemented)
- Recovery modal to clear IndexedDB/localStorage (implemented)
- checkPendingDbDelete on page load (implemented)

**Still Needed:**

- Retry IndexedDB deletion after complete browser close
- Optionally: Disable Fast Mode completely and use passkey-only mode
- Detection of MetaMask conflict and show user warning
