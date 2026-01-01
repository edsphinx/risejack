---
description: Save session summary to chat history
---

# /edsx save

Save the current session to chat history.

## Steps

### 1. Create Chat Log

Create file:

```text
/home/edsphinx/Blockchain/RiseJack (Mobile)/ai-context-hub/projects/risecasino/chats/[YYYY-MM-DD]_[topic].md
```

### 2. Use This Template

```markdown
# Session: [Brief Topic]

**Date**: [YYYY-MM-DD]
**AI**: [Model]

## Summary

[What was accomplished]

## Key Decisions

[Important decisions made]

## Files Modified

[List of paths]

## Next Steps

[What to work on next]
```

### 3. Update Project Context

If needed, update:

```text
/home/edsphinx/Blockchain/RiseJack (Mobile)/ai-context-hub/projects/risecasino/context.md
```

### 4. Commit and Push

```bash
cd "/home/edsphinx/Blockchain/RiseJack (Mobile)/ai-context-hub"
git add -A && git commit -m "session: [topic]" && git push
```

Confirm: "Session saved to [filename]."
