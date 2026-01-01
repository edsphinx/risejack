---
description: Save session summary to chat history after completing work
---

# Save Session Workflow

After completing a work session, create a chat log entry:

## 1. Create Chat Log

Create a new file in:

```
/home/edsphinx/Blockchain/RiseJack (Mobile)/ai-context-hub/projects/risecasino/chats/[YYYY-MM-DD]_[topic].md
```

## 2. Include These Sections

```markdown
# Session: [Brief Topic]

**Date**: [YYYY-MM-DD]
**AI**: [Model name]
**Device**: [Desktop/Mobile]

---

## Summary

[What was accomplished]

## Key Decisions

[Important decisions made]

## Work Completed

[Files changed, features added]

## Decisions Pending

[Open questions]

## Next Session Topics

[What to work on next]

## Files Modified/Created

[List of paths]
```

## 3. Update Project Context

Update the project context file if needed:

```
/home/edsphinx/Blockchain/RiseJack (Mobile)/ai-context-hub/projects/risecasino/context.md
```

## 4. Commit to ai-context-hub

```bash
cd /home/edsphinx/Blockchain/RiseJack\ \(Mobile\)/ai-context-hub
git add -A
git commit -m "session: [topic] - [date]"
git push
```
