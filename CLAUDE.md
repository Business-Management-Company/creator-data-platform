# Claude Code Instructions

## Auto-commit rule

After EVERY task or prompt execution, without exception and without being asked, always run:

```
git add -u
git commit -m "auto: [brief description of what was just changed]"
```

- `git add -u` stages only tracked files — never untracked files, secrets, or artifacts
- The commit message should be a short description of what was actually changed
- After committing, print the commit summary (hash + changed files)
- Then remind the user: **When you're ready to deploy, run: `git push origin main`**
- Do NOT auto-push. Never run `git push` unless the user explicitly asks

This applies to every single response that modifies files. No exceptions.
