# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.3.x   | ✅ Yes    |
| < 1.3   | ❌ No     |

## Security Model

### Authentication & Access Control

Memlink uses token-based routing for named memories and open access for the default memory:

```
http://localhost:4444/mcp                  # default memory (no token required)
http://localhost:4444/mcp?t=<TOKEN>        # named memory (token required)
```

Tokens are 32-character nanoids (~192 bits of entropy). An invalid or missing token returns `401 Unauthorized`. The admin API (`/admin/*`) is protected by a separate local token stored in `~/.memlink/settings.json`.

### Threat Model

| Surface | Mitigation |
|---------|------------|
| Network exposure | Binds to `localhost` by default. Remote access requires explicit `--host 0.0.0.0` or `MEMLINK_HOST`. |
| Unauthorized memory access | Per-memory tokens with ~192-bit entropy. Never logged or returned after creation. |
| Data corruption | All writes use `.tmp` + atomic `renameSync()`. No partial writes reach disk. |
| Concurrent writes | File-level lock (`.lock` with TTL + retry) serializes all mutations. |
| Accidental data loss | Every mutation creates a timestamped backup in `.backups/`. |
| Abuse / DoS | Built-in rate limiter: 1000 requests/min per IP. |
| Log leakage | TTY detection disables banners, clipboard ops, and ASCII art in CI/Docker/pipe environments. |

### Security Headers

All HTTP responses include:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### File Permissions

Memory data is stored in `~/.memlink/` (or `$MEMLINK_DIR`) under standard user-level permissions. For sensitive workloads, point `MEMLINK_DIR` to an encrypted volume.

## Best Practices

1. **Never expose the server publicly** without a reverse proxy (nginx, Caddy) with TLS and additional auth.
2. **Keep tokens private** — treat them like API keys. Revoke and regenerate if compromised: `memlink token revoke <label>`.
3. **Restrict port access** — use firewall rules to limit port 4444 to localhost or trusted networks.
4. **Encrypt at rest** — set `MEMLINK_DIR` to an encrypted volume for sensitive agent memories.
5. **Update regularly** — `npm update -g @memlink/cli`.

## Reporting a Vulnerability

Report security vulnerabilities via **GitHub Security Advisories** (preferred — keeps the report private until patched):

👉 https://github.com/rblez/memlink/security/advisories/new

Or open a GitHub Issue for non-sensitive findings:

👉 https://github.com/rblez/memlink/issues

Please include: description, steps to reproduce, potential impact, and a suggested fix if possible.

Response target: within 72 hours for critical issues.
