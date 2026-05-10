# Security Policy

## Supported Versions

Only the latest version of Memlink is actively supported with security updates.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not create a public issue** - Security vulnerabilities should be reported privately
2. **Send an email** to the project maintainers with details about the vulnerability
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a timeline for the fix.

## Security Features

### Authentication

- **Bearer Token Authentication**: All MCP requests require a valid bearer token
- **Token Rotation**: Tokens can be rotated without revoking agent access
- **Token Revocation**: Agents and universal memories can be revoked immediately

### Input Validation

- All user inputs are validated using Zod schemas
- Path traversal attacks are prevented
- Command injection protection in file operations

### Data Protection

- Memory files are stored in `~/.memlink/` (user's home directory)
- No sensitive data is logged by default
- Optional request/response logging can be enabled for debugging

### Rate Limiting

- Rate limiting is implemented on the MCP server endpoint
- Prevents abuse and DoS attacks
- Configurable limits per token

### Security Headers

- HTTP security headers are set on all responses
- CORS is configured appropriately
- Content Security Policy headers

## Best Practices for Users

### Token Management

1. **Never commit tokens to version control**
2. **Rotate tokens regularly** - Use `memlink agent rotate <agentId>`
3. **Revoke unused tokens** - Use `memlink agent revoke <agentId>`
4. **Use environment variables** for tokens in production

### Server Configuration

1. **Bind to localhost** by default for local development
2. **Use a reverse proxy** (nginx, Apache) for production deployments
3. **Enable HTTPS** in production environments
4. **Configure firewall rules** to restrict access

### Memory File Security

1. **Memory files are stored locally** - Ensure file system permissions are correct
2. **Backup memory files regularly**
3. **Audit memory content** for sensitive information

## Dependencies

We regularly update dependencies to address security vulnerabilities:

- Run `bun update` regularly
- Monitor security advisories for dependencies
- Use `bun audit` to check for vulnerabilities

## Development Security

### Code Review

- All code changes go through review
- Security-focused review for authentication and data handling
- Automated security scanning in CI/CD

### Secrets Management

- No hardcoded secrets in the codebase
- Use environment variables for configuration
- `.env` files are excluded from version control

## License

This project is licensed under the MIT License - see the LICENSE file for details.
