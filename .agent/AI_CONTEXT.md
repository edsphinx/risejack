# AI Development Context

This project uses an MCP (Model Context Protocol) server to provide AI assistants with project context.

## Quick Start

### For AI Assistants

When starting a session, load context with:

```
/load-context
```

When ending a session, save the summary:

```
/save-session
```

### For Developers

The MCP server runs automatically via systemd:

```bash
# Check status
systemctl --user status mcp-risecasino

# View available resources
curl http://localhost:3100/resources

# Get specific resource
curl "http://localhost:3100/resource?uri=risecasino://context"
```

## Available Resources

| URI                                   | Description                         |
| ------------------------------------- | ----------------------------------- |
| `risecasino://context`                | Current project state               |
| `risecasino://preferences/tech-stack` | Preferred technologies              |
| `risecasino://preferences/code-style` | Code conventions                    |
| `risecasino://chats/recent`           | Last 5 session logs                 |
| `risecasino://roadmap`                | Project roadmap (from private repo) |
| `risecasino://contracts`              | Smart contract info                 |

## Related Repos

- **ai-context-hub**: Context storage and MCP server docs
- **risecasinorpg-private**: Strategy and roadmap docs

## Server Location

```
~/.mcp/servers/risecasino/
```

See `ai-context-hub/mcp-server/SETUP.md` for full setup instructions.
