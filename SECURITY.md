# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.5.x   | Yes       |
| < 0.5   | No        |

## Security Model

### Authentication

Memlink uses a simple URL-based connection model:

```
http://localhost:4444/mcp?id=MEMORY_ID
```

The memory ID (12-character nanoid) acts as the only access key. No tokens, bearer auth, or OAuth.

### Threat Model

- **Localhost only**: By default, the server binds to `localhost`. Remote access requires changing the host via `-H` flag or `HOST`/`MEMLINK_HOST` env var.
- **Memory ID secrecy**: The 12-character ID provides ~72 bits of entropy. Keep it private.
- **File-based storage**: Memory files are stored in `~/.memlink/` (or `$MEMLINK_DIR`) with standard user permissions.
- **Atomic writes**: All file writes go through a `.tmp` + `renameSync()` cycle, eliminating data corruption on crash.
- **Auto-backups**: Every mutation creates a timestamped backup in `backups/` (last 3 kept). Enables recovery from accidental agent edits.
- **Rate limiting**: Built-in rate limiter (1000 req/min) prevents abuse.
- **TTY detection**: In non-interactive environments (CI, Docker, pipes), ASCII banners and clipboard operations are automatically disabled, preventing information leaks in logs.

### Security Headers

All responses include:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`
- `Content-Security-Policy: default-src 'self'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

## Reporting a Vulnerability

Report security issues via GitHub Issues:

https://github.com/aiustantt/memlink/issues

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Best Practices

1. **Never expose the server to the public internet** without a reverse proxy and additional auth
2. **Keep memory IDs private** — they are the only access key
3. **Use firewall rules** to restrict access to localhost or trusted networks
4. **Set `MEMLINK_DIR`** to an encrypted volume for sensitive data
5. **Regularly backup** your memory files from `~/.memlink/`
6. **Update regularly** — `npm update -g memlink`
