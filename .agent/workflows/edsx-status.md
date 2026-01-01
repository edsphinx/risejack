---
description: Check MCP server and context status
---

# /edsx status

Check the status of the MCP server and loaded context.

## Steps

### 1. Check MCP Server

```bash
systemctl --user status mcp-risecasino --no-pager
```

### 2. Check Available Resources

```bash
curl -s http://localhost:3100/resources
```

### 3. Report Status

Report:

- Server: Running/Stopped
- Resources: Count
- Last session: Date from chats folder
