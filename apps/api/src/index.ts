import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors())
app.use('*', prettyJSON())

// Health check
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'risejack-api'
    })
})

// API routes
app.get('/', (c) => {
    return c.json({
        name: 'Rise Blackjack API',
        version: '0.1.0',
        endpoints: {
            health: '/health',
            game: '/api/game',
            stats: '/api/stats'
        }
    })
})

// Game routes (placeholder)
const gameRoutes = new Hono()

gameRoutes.get('/state/:address', (c) => {
    const address = c.req.param('address')
    return c.json({
        player: address,
        status: 'idle',
        balance: '0',
        currentGame: null
    })
})

gameRoutes.get('/history/:address', (c) => {
    const address = c.req.param('address')
    return c.json({
        player: address,
        games: [],
        totalWins: 0,
        totalLosses: 0
    })
})

app.route('/api/game', gameRoutes)

// Stats routes (placeholder)
const statsRoutes = new Hono()

statsRoutes.get('/global', (c) => {
    return c.json({
        totalGames: 0,
        totalPlayers: 0,
        totalVolume: '0',
        houseEdge: '1.5%'
    })
})

statsRoutes.get('/leaderboard', (c) => {
    return c.json({
        leaderboard: [],
        updatedAt: new Date().toISOString()
    })
})

app.route('/api/stats', statsRoutes)

// Start server
const port = process.env.PORT || 3000

console.log(`🃏 Rise Blackjack API running on http://localhost:${port}`)

export default {
    port,
    fetch: app.fetch
}
