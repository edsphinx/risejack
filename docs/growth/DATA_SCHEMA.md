# Rise Casino: Database Schema (Drizzle/SQL)

This document defines the SQL schema for the Rise Casino growth platform. Designed for:

- **Prisma/Drizzle** (TypeScript API)
- **Direct SQL** (Go Indexer)
- **Supabase PostgreSQL**

---

## Core Tables

### `users`

Primary identity table. Links wallet to off-chain profile and marketing channels.

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address  VARCHAR(42) UNIQUE NOT NULL,      -- Ethereum address (lowercase)

    -- Off-chain identity (optional, for marketing)
    email           VARCHAR(255) UNIQUE,
    email_verified  BOOLEAN DEFAULT FALSE,
    telegram_id     VARCHAR(64) UNIQUE,
    discord_id      VARCHAR(64) UNIQUE,
    twitter_handle  VARCHAR(64),

    -- Profile
    display_name    VARCHAR(64),
    avatar_url      TEXT,

    -- Gamification
    xp              INTEGER DEFAULT 0,
    level           INTEGER DEFAULT 1,
    vip_tier        VARCHAR(16) DEFAULT 'bronze',     -- bronze, silver, gold, platinum, diamond

    -- Analytics
    risk_score      REAL,                             -- 0.0 (conservative) to 1.0 (degen)
    ltv_predicted   REAL,                             -- Predicted Lifetime Value (AI)

    -- Referral
    referrer_id     UUID REFERENCES users(id),
    referral_code   VARCHAR(16) UNIQUE NOT NULL,      -- e.g., "EDSP1234"

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_referrer ON users(referrer_id);
CREATE INDEX idx_users_vip ON users(vip_tier);
```

---

### `games`

Record of every game played. Core data for leaderboards, history, and analytics.

```sql
CREATE TABLE games (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    -- Game info
    game_type       VARCHAR(32) NOT NULL,             -- 'blackjack', 'roulette', 'poker'
    tx_hash         VARCHAR(66) UNIQUE NOT NULL,      -- On-chain transaction hash
    block_number    BIGINT NOT NULL,

    -- Bet details
    bet_amount      NUMERIC(78, 0) NOT NULL,          -- Wei or token smallest unit
    currency        VARCHAR(42) NOT NULL,             -- 'ETH' or token address

    -- Outcome
    payout          NUMERIC(78, 0) NOT NULL,          -- 0 if loss
    pnl             NUMERIC(78, 0) NOT NULL,          -- Profit/Loss (payout - bet)
    outcome         VARCHAR(32) NOT NULL,             -- 'win', 'lose', 'push', 'blackjack'

    -- Game-specific data (JSON for flexibility)
    game_data       JSONB,                            -- { playerHand: [2,11], dealerHand: [...] }

    -- Timestamps
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_games_user ON games(user_id);
CREATE INDEX idx_games_type ON games(game_type);
CREATE INDEX idx_games_block ON games(block_number);
CREATE INDEX idx_games_ended ON games(ended_at DESC);
```

---

### `referral_earnings`

Tracks earnings from each referral action.

```sql
CREATE TABLE referral_earnings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id     UUID NOT NULL REFERENCES users(id),
    referee_id      UUID NOT NULL REFERENCES users(id),
    game_id         UUID NOT NULL REFERENCES games(id),

    -- Earnings
    tier            INTEGER DEFAULT 1,                -- 1 = direct, 2 = second-level
    house_edge      NUMERIC(78, 0) NOT NULL,          -- House edge on the game
    earned          NUMERIC(78, 0) NOT NULL,          -- Amount earned (e.g., 10% of edge)
    currency        VARCHAR(42) NOT NULL,

    -- Claim status
    claimed         BOOLEAN DEFAULT FALSE,
    claimed_at      TIMESTAMPTZ,
    claim_tx_hash   VARCHAR(66),

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ref_earnings_referrer ON referral_earnings(referrer_id);
CREATE INDEX idx_ref_earnings_unclaimed ON referral_earnings(referrer_id) WHERE claimed = FALSE;
```

---

### `email_subscriptions`

GDPR-compliant email list management.

```sql
CREATE TABLE email_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),        -- Nullable (can subscribe without account)
    email           VARCHAR(255) NOT NULL UNIQUE,

    -- Status
    status          VARCHAR(16) DEFAULT 'subscribed', -- subscribed, unsubscribed, bounced
    source          VARCHAR(64),                      -- 'landing_page', 'post_game', 'referral'

    -- Compliance
    consent_at      TIMESTAMPTZ DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_subs_status ON email_subscriptions(status);
```

---

### `notifications_log`

Track all outbound communications for analytics and debugging.

```sql
CREATE TABLE notifications_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),

    channel         VARCHAR(16) NOT NULL,             -- 'email', 'push', 'telegram', 'in_app'
    template_id     VARCHAR(64) NOT NULL,             -- Reference to template
    subject         TEXT,

    -- Delivery status
    status          VARCHAR(16) DEFAULT 'pending',    -- pending, sent, failed, opened, clicked
    sent_at         TIMESTAMPTZ,
    opened_at       TIMESTAMPTZ,
    clicked_at      TIMESTAMPTZ,

    -- Error tracking
    error_message   TEXT,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_user ON notifications_log(user_id);
CREATE INDEX idx_notif_status ON notifications_log(status);
```

---

### `sessions`

Track user sessions for behavioral analytics.

```sql
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    -- Session data
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    duration_secs   INTEGER,

    -- Attribution
    referrer_url    TEXT,
    utm_source      VARCHAR(64),
    utm_medium      VARCHAR(64),
    utm_campaign    VARCHAR(64),

    -- Device info
    user_agent      TEXT,
    ip_geo_country  VARCHAR(2),
    ip_geo_city     VARCHAR(64),
    device_type     VARCHAR(16)                       -- 'mobile', 'desktop', 'tablet'
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_started ON sessions(started_at DESC);
```

---

### `leaderboards` (Materialized View / Cron-Calculated)

Pre-calculated leaderboard data for fast reads.

```sql
CREATE TABLE leaderboard_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period          VARCHAR(16) NOT NULL,             -- 'daily', 'weekly', 'monthly', 'all_time'
    period_start    DATE NOT NULL,

    -- Entries (JSON array for flexibility)
    entries         JSONB NOT NULL,                   -- [{ rank, userId, displayName, value, ... }]

    -- Metadata
    metric          VARCHAR(32) NOT NULL,             -- 'volume', 'wins', 'pnl', 'xp'
    generated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leaderboard_period ON leaderboard_snapshots(period, period_start DESC);
```

---

## Aggregated Views (For Analytics)

```sql
-- User stats summary (for profile page and API)
CREATE VIEW user_stats AS
SELECT
    u.id,
    u.wallet_address,
    u.display_name,
    u.xp,
    u.level,
    u.vip_tier,
    COUNT(g.id) AS total_games,
    COALESCE(SUM(g.bet_amount), 0) AS total_wagered,
    COALESCE(SUM(g.pnl), 0) AS total_pnl,
    COUNT(CASE WHEN g.outcome = 'win' OR g.outcome = 'blackjack' THEN 1 END) AS wins,
    COUNT(CASE WHEN g.outcome = 'lose' THEN 1 END) AS losses,
    MAX(g.ended_at) AS last_played_at
FROM users u
LEFT JOIN games g ON g.user_id = u.id
GROUP BY u.id;

-- Referral stats summary
CREATE VIEW referral_stats AS
SELECT
    u.id AS user_id,
    u.referral_code,
    COUNT(DISTINCT r.referee_id) AS direct_referrals,
    COALESCE(SUM(re.earned), 0) AS total_earned,
    COALESCE(SUM(CASE WHEN re.claimed = FALSE THEN re.earned ELSE 0 END), 0) AS unclaimed_earnings
FROM users u
LEFT JOIN users r ON r.referrer_id = u.id
LEFT JOIN referral_earnings re ON re.referrer_id = u.id
GROUP BY u.id;
```

---

## Notes

1. **Currency Handling**: Store all amounts as `NUMERIC(78,0)` (BigInt compatible for 256-bit values). Convert to human-readable format in application layer.
2. **JSONB Fields**: Use for game-specific data that varies by game type (e.g., cards for Blackjack, numbers for Roulette).
3. **Indexes**: Designed for common read patterns (leaderboards, user lookups, referral queries).
4. **Privacy**: `ip_geo_*` fields store only country/city, never full IP. Compliant with GDPR.
