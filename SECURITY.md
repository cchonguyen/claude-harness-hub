# Security Policy

## Supported versions

Only the latest commit on `main` is supported.

## How the dashboard is built to be safe

- It binds to `127.0.0.1` (your own machine) unless you set the `HOST` environment variable. It has no login, so it should never be exposed to a network.
- It only writes to a fixed list of registered planning and contract files. Other paths are refused.
- It runs commands through `execFile` without a shell, and only from a fixed allow-list (unit tests, typecheck, lint, and the handoff modes).
- Claude Code's `.claude/settings.json` denies reads and edits of `.env` files.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting instead: open the repository's **Security** tab and choose **Report a vulnerability**.

## Secrets

This repository should contain no secrets, tokens, or private keys. If you find one, report it through the same private channel so it can be removed and rotated.
