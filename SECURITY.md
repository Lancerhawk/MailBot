# Security Policy

## Supported Versions

Currently, only the `main` branch (and the latest stable release) is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.7.x   | :white_check_mark: |
| < 0.7   | :x:                |

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues. 

Instead, please report them directly to the maintainers by emailing `security@mailbot.local` (or the maintainer's primary contact email). 

You should receive a response within 48 hours. If the issue is confirmed as a vulnerability, we will open a private Security Advisory on GitHub and work on a patch immediately.

## Scope
Please report vulnerabilities related to:
- Authentication bypass (Google OAuth)
- Unauthorized access to other users' emails or S3 documents
- Prompt injection vulnerabilities that could leak backend secrets
- Webhook manipulation or spoofing

Thank you for helping keep MailBot safe!
