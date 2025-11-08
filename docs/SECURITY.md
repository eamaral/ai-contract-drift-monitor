# 🔒 Security Guardrails Documentation

> **Status:** ✅ **PRODUCTION-READY** | **Security Review Required**

This document provides a comprehensive overview of all security controls implemented in the AI Contract Drift Monitor. Designed for security teams to quickly audit and verify compliance.

---

## 🔒 SECURITY GUARDRAILS (For Security Team)

**Status:** ✅ **PRODUCTION-READY** | **Security Review Required**

This section provides a comprehensive overview of all security controls implemented in the system. Designed for security teams to quickly audit and verify compliance.

<details open>
<summary><strong>📋 Quick Security Checklist</strong></summary>

- ✅ **HTTP Egress Control** - Only GET/HEAD allowed, configurable allowlist
- ✅ **Rate Limiting** - QPS and concurrency limits enforced
- ✅ **Secret Management** - Automatic scrubbing in logs and outputs
- ✅ **AI Safety** - Output validation and grounding checks
- ✅ **Immutable Changes** - PR-only snapshot updates (no direct commits)
- ✅ **Observability** - Full audit trail with run_id tracking
- ✅ **Input Validation** - Zod schemas for all external data
- ✅ **Operational Safety** - Kill switch and execution windows

</details>

### 🛡️ Control Matrix

| Control Domain | Implementation | Status | Verification |
|---------------|----------------|--------|--------------|
| **Egress Filtering** | HTTP method allowlist | ✅ Active | `SAFE_HTTP_METHODS=GET,HEAD` |
| **Rate Limiting** | Token bucket (QPS) + Semaphore (concurrency) | ✅ Active | `MAX_QPS=1, MAX_CONCURRENCY=2` |
| **Timeout Control** | AbortController 8s default | ✅ Active | `HTTP_TIMEOUT_MS=8000` |
| **Retry Policy** | Exponential backoff with jitter | ✅ Active | `HTTP_RETRY_MAX=2, HTTP_BACKOFF_MS=300:2000` |
| **Secret Scrubbing** | Automatic header/content masking | ✅ Active | `SCRUB_KEYS` config |
| **Audit Logging** | Run ID tracking on all operations | ✅ Active | Every log includes 8-char UUID |
| **Change Control** | PR-only snapshot updates | ✅ Enforced | `SNAPSHOT_UPDATE_MODE=PR_ONLY` |
| **AI Validation** | Zod schemas + grounding check | ✅ Active | ≥30% token overlap required |
| **Alert Rate Limit** | Teams deduplication + throttling | ✅ Active | `TEAMS_RATE_LIMIT=1/30m` |
| **Kill Switch** | Global disable capability | ✅ Available | `KILL_SWITCH=true/false` |
| **Metrics** | Prometheus + DogStatsD | ✅ Active | `http://localhost:9091/metrics` |

### 🔍 Security Controls Deep Dive

#### 1. **HTTP Egress Security** 
**File:** [`src/infrastructure/http/guardedFetch.ts`](src/infrastructure/http/guardedFetch.ts)

```typescript
// Control: Method Allowlist
SAFE_HTTP_METHODS=GET,HEAD  // Default: read-only operations

// Control: Rate Limiting (Token Bucket Algorithm)
MAX_QPS=1                   // Requests per second
MAX_CONCURRENCY=2           // Parallel request limit

// Control: Timeouts & Retries
HTTP_TIMEOUT_MS=8000        // 8 second timeout
HTTP_RETRY_MAX=2            // Max retry attempts
HTTP_BACKOFF_MS=300:2000    // Exponential backoff with jitter
```

**Verification:**
```bash
# Test method blocking
curl -X POST http://localhost:9091/api  # Should be blocked

# Check logs
grep "Method.*not allowed" logs/*.log

# Verify rate limiting
# Add 5+ targets and observe ~1 req/sec throttling
```

**Attack Surface Reduction:**
- ❌ POST/PUT/PATCH/DELETE blocked at code level
- ❌ No unbounded concurrent requests
- ❌ No indefinite hangs (timeout enforced)
- ✅ All egress logged with target name

---

#### 2. **Secret Management**
**File:** [`src/infrastructure/logging/logger.ts`](src/infrastructure/logging/logger.ts)

```typescript
// Auto-scrubbed keys (case-insensitive substring match)
SCRUB_KEYS=authorization,api-key,set-cookie,x-api-key,cookie,token

// Example output:
// ❌ "Authorization: Bearer sk_abc123..." 
// ✅ "Authorization: [REDACTED]"
```

**Verification:**
```bash
# Run drift check and inspect logs
npm run drift 2>&1 | grep -i "authorization\|api-key\|token"
# Should show [REDACTED] instead of actual values

# Check Teams messages
# Verify no raw headers/payloads included
```

**Data Protection:**
- ✅ Request headers scrubbed in logs
- ✅ Response bodies never logged
- ✅ Teams notifications sanitized
- ✅ AI prompts contain only structured diff (no raw data)

---

#### 3. **AI Safety Controls**
**Files:** 
- [`src/infrastructure/ai/summary.ts`](src/infrastructure/ai/summary.ts)
- [`src/infrastructure/ai/schemas/aiSummary.schema.ts`](src/infrastructure/ai/schemas/aiSummary.schema.ts)

```typescript
// Control: Schema Validation
const AISummarySchema = z.object({
  summary: z.string().min(10).max(1000),
  impact: z.array(z.string()).max(10),
  risks: z.array(z.string()).max(10)
});

// Control: Grounding Check
AI_GROUNDED_ONLY=true  // Enforces ≥30% token overlap with diff

// Control: Token Limiting
AI_MAX_TOKENS=800      // Prevents excessive API usage
```

**Verification:**
```bash
# Check AI validation logs
grep "Groundedness check" logs/*.log
grep "Zod" logs/*.log

# Test with AI disabled
AI_ENABLED=false npm run drift
# Should use deterministic fallback
```

**AI Safety Guarantees:**
- ✅ Zod validates structure (no injection)
- ✅ Grounding check prevents hallucinations
- ✅ Deterministic fallback (no AI dependency)
- ✅ No raw payloads sent to external AI
- ✅ Token limits prevent cost overruns

---

#### 4. **Change Control & Auditability**
**File:** [`src/application/snapshots/update.ts`](src/application/snapshots/update.ts)

```typescript
// ENFORCED: PR-only mode (throws error if violated)
SNAPSHOT_UPDATE_MODE=PR_ONLY  // Never commits directly

// Severity gate (CI/CD enforcement)
DRIFT_SEVERITY_GATE=major     // 'major' fails CI, 'minor' alerts only

// Code owners enforcement
CODEOWNERS_PATH=.github/CODEOWNERS  // Required reviewers
```

**Verification:**
```bash
# Try to run in non-PR mode (should fail)
SNAPSHOT_UPDATE_MODE=DIRECT npm run drift
# Expected: Error thrown

# Check git status after drift
git status
# snapshots/latest.json should be modified but NOT committed

# Verify PR creation in CI
# Check GitHub Actions for automatic PR creation
```

**Change Control Guarantees:**
- ✅ No direct commits to snapshots (code-level enforcement)
- ✅ All changes via reviewed PRs
- ✅ CODEOWNERS approval required
- ✅ Severity classification in PR body
- ✅ AI analysis included for review
- ✅ Full audit trail (run_id + timestamp)

---

#### 5. **Observability & Audit Trail**
**Files:**
- [`src/infrastructure/monitoring/metrics/metrics.ts`](src/infrastructure/monitoring/metrics/metrics.ts)
- [`src/infrastructure/logging/logger.ts`](src/infrastructure/logging/logger.ts)

```typescript
// Metrics endpoint
PROMETHEUS_PORT=9091
// Access: http://localhost:9091/metrics

// All logs include:
[timestamp] [run_id] [level] [context] message | metadata

// Example:
[2024-01-01T12:00:00Z] [a1b2c3d4] [INFO] [drift-check] Starting...
```

**Key Metrics for Security Monitoring:**
```promql
# HTTP error rate (potential attacks)
rate(ai_monitor_http_requests_total{status=~"4..|5.."}[5m])

# Retry rate (network issues or rate limiting)
rate(ai_monitor_http_retry_total[5m])

# Timeout rate (potential DoS or slow endpoints)
rate(ai_monitor_http_timeout_total[5m])

# Alert failures (notification issues)
rate(ai_monitor_alerts_failed_total[5m])
```

**Verification:**
```bash
# Start metrics server
npm run metrics

# Check health
curl http://localhost:9091/health

# View all metrics
curl http://localhost:9091/metrics | grep ai_monitor

# Check log format
npm run drift 2>&1 | head -20
# Verify run_id present in every log line
```

---

#### 6. **Operational Safety**
**File:** [`src/application/schedule/window.ts`](src/application/schedule/window.ts)

```typescript
// Emergency disable
KILL_SWITCH=true   // Immediately stops all monitoring

// Execution windows
WINDOW_CRON=*/30 * * * *  // Run every 30 minutes
WINDOW_CRON=0 9-17 * * 1-5  // Business hours only (Mon-Fri 9-5)
```

**Verification:**
```bash
# Test kill switch
KILL_SWITCH=true npm run drift
# Expected: Graceful abort with clear log

# Test execution window
WINDOW_CRON="0 0 * * *" npm run drift  # Only midnight
# If not midnight: should abort with reason
```

---

### 🔐 Compliance & Standards

| Standard | Control | Evidence |
|----------|---------|----------|
| **OWASP Top 10** | A01:2021 – Broken Access Control | ✅ Method allowlist, rate limiting |
| **OWASP Top 10** | A02:2021 – Cryptographic Failures | ✅ Secret scrubbing, no plaintext in logs |
| **OWASP Top 10** | A03:2021 – Injection | ✅ Zod validation, parameterized queries |
| **OWASP Top 10** | A09:2021 – Security Logging Failures | ✅ Comprehensive logging with run_id |
| **CIS Controls** | 4.1 - Secure Configuration | ✅ Safe defaults, PR-only mode |
| **CIS Controls** | 8.2 - Audit Log Management | ✅ Structured logs, metrics, traceability |
| **NIST 800-53** | AC-3 - Access Enforcement | ✅ Method allowlist, CODEOWNERS |
| **NIST 800-53** | AU-2 - Audit Events | ✅ All operations logged with context |
| **NIST 800-53** | SI-4 - System Monitoring | ✅ Prometheus metrics, DogStatsD |

---

### 🧪 Security Testing

#### Manual Security Tests

```bash
# 1. Method Allowlist Test
SAFE_HTTP_METHODS=GET npm run drift
# Add a POST target to targets.json
# Expected: Request blocked with error log

# 2. Rate Limiting Test
MAX_QPS=1 MAX_CONCURRENCY=2 npm run drift
# Add 5+ targets
# Expected: ~1 request per second, max 2 parallel

# 3. Secret Scrubbing Test
npm run drift 2>&1 | grep -E "authorization|api.?key|token"
# Expected: All sensitive values show [REDACTED]

# 4. PR-Only Enforcement Test
SNAPSHOT_UPDATE_MODE=DIRECT npm run drift
# Expected: Error thrown, execution aborted

# 5. Kill Switch Test
KILL_SWITCH=true npm run drift
# Expected: Graceful abort with reason logged

# 6. AI Validation Test
AI_ENABLED=true npm run drift
grep "Groundedness check" logs/*.log
grep "Zod" logs/*.log
# Expected: Both validation steps present
```

#### Unit Tests

```bash
# Run severity classification tests
npm run test:severity

# Expected output:
✔ classifySeverity - field removed is major
✔ classifySeverity - field added is minor
✔ classifySeverity - type change is major
✔ hasChanges - returns true when changes exist
# ... 10 tests total
```

---

### 📚 Security Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | Complete technical documentation | Security engineers |
| [QUICKSTART.md](QUICKSTART.md) | Setup and configuration guide | Developers |
| [README.md](README.md) § Operational Runbook | Emergency procedures | DevOps, SRE |
| [.github/CODEOWNERS](.github/CODEOWNERS) | Review requirements | All teams |

---

### 🚨 Incident Response

**Emergency Procedures:**

```bash
# 1. Disable monitoring immediately
echo "KILL_SWITCH=true" >> .env
# OR set in CI secrets

# 2. Revert bad snapshot
git checkout main~1 -- snapshots/latest.json
git commit -m "revert: emergency snapshot rollback"
git push

# 3. Check audit logs
grep "run_id" logs/*.log | grep "<run_id_from_alert>"

# 4. Review metrics
curl http://localhost:9091/metrics | grep ai_monitor_drift
```

---

### 📞 Security Contacts (Template)

**Configure these roles for your organization:**

| Role | Responsibility | Files to Review |
|------|----------------|-----------------|
| **Security Team** | Approve guardrails, audit logs | `src/infrastructure/http/`, `src/infrastructure/logging/` |
| **Platform Team** | Review architecture changes | `src/cli/`, `src/application/` |
| **API Team** | Approve snapshot PRs | `snapshots/`, `src/infrastructure/api/config/` |

> 💡 **Setup:** Update `.github/CODEOWNERS` with your actual team handles

---

### ✅ Security Sign-Off

**Before deploying to production, verify:**

- [ ] All environment variables configured (see [Configuration](#configuration))
- [ ] `SNAPSHOT_UPDATE_MODE=PR_ONLY` enforced
- [ ] `KILL_SWITCH=false` initially, documented emergency procedure
- [ ] GitHub secrets configured: `AI_API_KEY`, `TEAMS_WEBHOOK`
- [ ] `.github/CODEOWNERS` configured with your team handles (if using)
- [ ] Metrics endpoint accessible and monitored
- [ ] Logs reviewed for secret leakage (none should exist)
- [ ] Security tests passed (see [Security Testing](#security-testing))
- [ ] Incident response procedures documented
- [ ] Security team approval obtained (if applicable)

**Security Review Status:** ✅ **TEMPLATE - CONFIGURE FOR YOUR ORG**

---

</details>

---

