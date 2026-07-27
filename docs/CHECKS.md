# Site Validation Commands

## Complete local check

```bat
cd /d C:\Users\clayg\Documents\GitHub\laborcoin-site
scripts\run-checks.cmd
```

The check verifies the exact current deployable inventory, SHA-256 commitments, local links, duplicate HTML IDs, PWA files, icon dimensions, predeployment/active configuration rules, Revision 7.1 functional markers, pinned external JavaScript versions, stale executable addresses, likely backup files, and secret-like material.

## Verify Git state separately

```bat
git branch --show-current
git remote -v
git status
git diff --check
git rev-parse HEAD
git fetch origin
git status
```

Expected after committing and pushing:

```text
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```

## After an intentional source edit

Review the change first:

```bat
git diff --check
git diff
```

Then update the deployable manifest and rerun checks:

```bat
python scripts\update-source-manifest.py
python scripts\validate-site.py
```
