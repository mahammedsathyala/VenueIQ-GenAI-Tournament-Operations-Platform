# VenueIQ — Security Architecture

**Version:** 4.1.0 | **Last Updated:** 2026-07-19 | **Status:** Production-Ready

---

## Overview

VenueIQ is a client-side SPA built with pure HTML/CSS/JavaScript. Since it operates entirely in the browser, all security controls are implemented at the **client layer** using defense-in-depth principles.

---

## 1. Content Security Policy (CSP)

**Location:** index.html

```
default-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com;
script-src 'self';
img-src 'self' data:;
connect-src 'self';
```

Blocks all external script/resource injection and unauthorized API calls.

---

## 2. Clickjacking Protection

**Location:** index.html — X-Frame-Options: DENY

Prevents the page from being embedded in iframes — the primary clickjacking vector.

---

## 3. XSS Protection — sanitizeHTML()

**Location:** app.js

Every user-provided string processed through sanitizeHTML() before DOM insertion:
- Escapes all HTML special characters
- Strips inline event handlers (onclick, onload, etc.)
- Blocks dangerous protocols (javascript:, data:, vbscript:)
- Strips CSS expression() injection

Applied to: chat input, command center, translation input, all dynamic DOM content.

---

## 4. Prompt Injection Filtering — filterPromptInjection()

**Location:** app.js

Applied to ALL user input paths (chat + command center). Detects 30+ patterns:
- Override instructions: ignore previous, disregard instructions
- Jailbreak: jailbreak, dan mode, god mode, no restrictions
- Role confusion: act as, pretend you are, roleplay as
- Code injection: eval(, execute code, import os

Every blocked attempt is logged to AuditLog.

---

## 5. Rate Limiting — RateLimit object

**Location:** app.js

Rolling-window rate limiter on both sendMessage() and sendCommandQuery():
- Max: 10 messages per 60 seconds (RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS)

---

## 6. Input Allowlist Validation

**Location:** app.js — setNavMode(), filterIncidents(), setPersona()

```javascript
const VALID_NAV_MODES  = new Set(['walking','accessible','fastest','scenic']);
const VALID_SEVERITIES = new Set(['all','critical','medium','low']);
```

All enumerated inputs validated against Set allowlists before processing.

---

## 7. Safe JSON Parsing — safeJSON()

Wraps JSON.parse() in try/catch to prevent prototype pollution.

---

## 8. Numeric ID Safety

Incident IDs cast through Number() before interpolation in onclick handlers:
```javascript
onclick="aiAnalyzeIncident(\)"
```

---

## 9. Audit Logging — AuditLog

Tamper-evident in-memory audit trail for all AI decisions and security events.
Every prompt injection attempt logged with confidence: 1.0 and blocked status.
Exportable as CSV for compliance review.

---

## 10. Security Headers

- X-Frame-Options: DENY (clickjacking)
- Referrer-Policy: no-referrer (URL leak prevention)
- Permissions-Policy: camera=(), microphone=(), geolocation=() (hardware protection)
- X-Content-Type-Options: nosniff (MIME sniffing prevention)

---

## Threat Model Summary

| Threat | Mitigation |
|---|---|
| XSS | sanitizeHTML() + CSP |
| Prompt Injection | filterPromptInjection() |
| Clickjacking | X-Frame-Options: DENY |
| Data Exfiltration | CSP connect-src 'self' |
| Input Flooding | RateLimit object |
| Prototype Pollution | safeJSON() wrapper |
| ID Injection | Number() cast |
| Hardware Access | Permissions-Policy |
