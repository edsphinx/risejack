# 🏗️ VyreJack Architecture Principles

> **⚠️ MUST READ** - These principles apply to ALL code changes

**Created:** 2026-01-06
**Status:** Active - Enforce Always

---

## ⚡ PERFORMANCE FIRST

> Every millisecond counts. Users must feel instant feedback.

### Polling Optimization

```typescript
// ✅ CORRECT: Adaptive polling
const interval = hasActiveGame ? 2000 : 10000;

// ❌ WRONG: Fixed fast polling always
setInterval(refresh, 1000);
```

### Tab Visibility

```typescript
// ✅ CORRECT: Stop polling when tab hidden
if (!isActiveTab) return;

// ❌ WRONG: Poll even when hidden (wastes resources)
```

### Memoization

```typescript
// ✅ CORRECT: Memoize derived values
const formattedBalance = useMemo(() => parseFloat(balance.formatted).toFixed(2), [balance]);

// ❌ WRONG: Recompute on every render
const formattedBalance = parseFloat(balance.formatted).toFixed(2);
```

---

## 🧱 CLEAN ARCHITECTURE LAYERS

```
Pages      → Only composition, no logic
Components → Pure UI, receive props only
Hooks      → State + orchestration
Services   → Contract calls, pure functions
Types      → Centralized in packages/shared
ABIs       → Centralized in packages/shared
```

### Layer Rules

| Layer      | Can Import        | Cannot Import     |
| ---------- | ----------------- | ----------------- |
| Pages      | Components, Hooks | Services, ABIs    |
| Components | Nothing           | Hooks, Services   |
| Hooks      | Services, Types   | Components        |
| Services   | Types, ABIs       | Hooks, Components |

---

## 📦 CENTRALIZED TYPES

> ALL types live in `packages/shared`

```typescript
// ✅ CORRECT: Import from shared
import type { VyreJackGame, TokenBalance } from '@vyrejack/shared';

// ❌ WRONG: Define local types
interface VyreJackGame { ... } // NEVER DO THIS
```

---

## 🔁 DRY - Don't Repeat Yourself

### Services Pattern

```typescript
// ✅ CORRECT: Single service handles all token reads
const balance = await TokenService.getBalance(token, account);
const allowance = await TokenService.getAllowance(token, account);

// ❌ WRONG: Duplicate logic in multiple hooks
const client = createPublicClient(...); // Repeated everywhere
await client.readContract(...);
```

---

## 📊 BUNDLE SIZE

> Target: < 100KB gzipped for initial load

- Lazy load routes
- Tree-shake imports
- No moment.js (use date-fns)
- No lodash (use native)
- Preact over React

---

## 🔍 CODE REVIEW CHECKLIST

Before merging ANY PR:

- [ ] Uses centralized types from `@vyrejack/shared`
- [ ] Uses services for contract reads (not direct viem)
- [ ] Has performance documentation in comments
- [ ] Tab-aware polling (no background waste)
- [ ] Memoized derived values
- [ ] No duplicate logic (DRY)

---

## 📝 DOCUMENTATION REQUIREMENTS

Every hook/service MUST have:

```typescript
/**
 * ⚡ PERFORMANCE OPTIMIZATIONS:
 * 1. ...
 * 2. ...
 *
 * 🔧 MAINTAINABILITY:
 * - ...
 */
```
