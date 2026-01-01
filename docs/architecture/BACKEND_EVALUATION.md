# Backend & Growth Architecture

## Architecture Decision: "Speed Demon Stack"

To match Rise Chain 10ms block times, we prioritize low latency and high throughput.

### Technology Stack

```text
┌─────────────────────────────────────────────────────────────────┐
│                        RISECASINO                                │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Frontend      │   Data API      │   Indexer                   │
│   (Preact)      │   (Hono Edge)   │   (Go)                      │
└────────┬────────┴────────┬────────┴────────┬────────────────────┘
         │                 │                 │
         └─────────────────┴─────────────────┘
                           │
                    ┌──────┴──────┐
                    │  Supabase   │
                    │ (PostgreSQL)│
                    └─────────────┘
```

| Component | Technology         | Purpose                                      |
| --------- | ------------------ | -------------------------------------------- |
| Frontend  | Preact + Vite      | Sub-millisecond render updates, <50KB bundle |
| Data API  | Hono (Vercel Edge) | Instant cold starts (<50ms), cached JSON     |
| Indexer   | Go (VPS)           | WebSocket connections, event processing      |
| Database  | Supabase           | Shared source of truth                       |

### Data Flow

1. **Indexer** listens to Rise Chain events via WebSocket
2. **Indexer** processes events and writes to Supabase
3. **API** reads from Supabase with aggressive caching
4. **Frontend** fetches cached data from API

### Related Documents

- [FRONTEND.md](./FRONTEND.md) - Frontend architecture details
- [SMART_CONTRACTS.md](./SMART_CONTRACTS.md) - Contract architecture
