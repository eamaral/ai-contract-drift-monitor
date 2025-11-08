# AI Contract Drift Monitor

> Professional boilerplate for monitoring external APIs with contract testing, proactive change detection (drift), and intelligent AI-powered alerts.

---

## 🔒 Security

This project implements comprehensive security guardrails including HTTP egress control, rate limiting, secret management, AI safety, and immutable change control.

**📘 For Security Teams:** See [Security Documentation](docs/SECURITY.md) for complete details on all security controls, verification procedures, and compliance checklist.

---

## 🎯 What This Project Does

**Problem:** External APIs change without warning, breaking your production systems. You discover issues only when users complain.

**Solution:** This project provides:

1. **📸 Automatic Snapshots** - Captures API schemas automatically on first run
2. **🔍 Drift Detection** - Monitors APIs continuously for changes
3. **🤖 AI-Powered Analysis** - Explains what changed and the impact
4. **📢 Smart Alerts** - Notifies you via Teams or Console
5. **📊 Visual Monitoring** - Ensures the monitoring system itself is healthy (meta-monitoring)

**Key Differentiator:** Not just testing - it's a complete monitoring system that learns your API structure and alerts you proactively when things change.

---

## 🏗️ Architecture

This project follows **Clean Architecture** principles with clear separation of concerns:

```
src/
├── domain/                 # Business logic & entities
│   ├── entities/          # Core business entities
│   └── repositories/      # Repository interfaces
├── application/           # Use cases & orchestration
│   └── use-cases/        # Business use cases
└── infrastructure/        # External concerns
    ├── api/
    │   ├── config/       # API targets configuration
    │   ├── graphql/      # GraphQL introspection utilities
    │   ├── schemas/      # Zod schema definitions
    │   └── tests/        # Contract tests
    ├── llm/              # AI integration
    ├── monitoring/       # Metrics & monitoring
    └── notifications/    # Alert channels
```

## 🚀 Quick Start

### 1. Start the monitoring stack:
```bash
npm run start
```

### 2. Access Grafana:
- **URL:** http://localhost:3001
- **Login:** admin / admin
- **Dashboard:** Will load automatically!

### 3. Run drift check:
```bash
npm run drift
```

## 📊 What You Get

- ✅ **Contract Testing** - API schema validation with Playwright
- ✅ **Drift Detection** - Proactive change monitoring of external APIs
- ✅ **AI Summaries** - Intelligent impact analysis of changes
- ✅ **Multi-channel Alerts** - Teams, Console
- ✅ **Automatic Dashboard** - Loads on first access
- ✅ **System Health Metrics** - Monitor the monitoring system (CPU, Memory, Disk, Network)
- ✅ **Meta-Monitoring** - Redundancy layer ensuring the monitor itself is healthy

## 🎯 Commands

| Command | Description |
|---------|-------------|
| `npm run start` | Start Docker services (Prometheus, Grafana, Node Exporter) |
| `npm run drift` | Run drift check and detect API changes |
| `npm run metrics` | Start application metrics server (port 9091) |
| `npm run test:contracts` | Run contract tests with Playwright |

## 🔧 Configuration

### Security Environment Variables

Create a `.env` file with **all security settings**:

```bash
# === HTTP Security & Rate Limiting ===
SAFE_HTTP_METHODS=GET,HEAD          # Allowed HTTP methods
MAX_QPS=1                            # Max requests per second
MAX_CONCURRENCY=2                    # Max parallel requests
HTTP_TIMEOUT_MS=8000                 # Request timeout (ms)
HTTP_RETRY_MAX=2                     # Max retry attempts
HTTP_BACKOFF_MS=300:2000             # Backoff range with jitter

# === Scheduling & Kill Switch ===
WINDOW_CRON=*/30 * * * *             # Execution window (cron format)
KILL_SWITCH=false                    # Emergency disable

# === Snapshot Update Policy ===
SNAPSHOT_UPDATE_MODE=PR_ONLY         # NEVER direct commit
DRIFT_SEVERITY_GATE=major            # 'major' blocks CI, 'minor' alerts only
CODEOWNERS_PATH=.github/CODEOWNERS   # Path to CODEOWNERS file

# === AI Configuration ===
AI_ENABLED=false                     # Enable AI summaries (default: off)
AI_GROUNDED_ONLY=true                # Enforce groundedness check
AI_MAX_TOKENS=800                    # Max AI response tokens
AI_GATEWAY_URL=https://api.groq.com/openai/v1/chat/completions
AI_API_KEY=                          # Groq API key (get free: console.groq.com)

# === Logging & Security ===
SCRUB_KEYS=authorization,api-key,set-cookie,x-api-key,cookie,token

# === Notifications ===
TEAMS_WEBHOOK_URL=                   # Teams webhook URL
TEAMS_RATE_LIMIT=1/30m               # Alert rate limit (1 per 30 min)

# === Metrics ===
METRICS_PORT=9091                    # Prometheus metrics port
PROMETHEUS_PORT=9091                 # Same as METRICS_PORT
DD_AGENT_HOST=                       # Optional: Datadog agent host
DD_DOGSTATSD_PORT=8125               # DogStatsD port
```

### Legacy Configuration (for backward compatibility)

```bash
# Minimal setup (legacy)
AI_GATEWAY_URL=https://api.groq.com/openai/v1/chat/completions
AI_API_KEY=your-ai-key
TEAMS_WEBHOOK=https://your-teams-webhook-url
METRICS_PORT=9091
```

## 🆕 Adding New APIs to Monitor

**📖 Complete Guide:** See [`docs/CREATING_CONTRACT_TESTS.md`](docs/CREATING_CONTRACT_TESTS.md) for detailed step-by-step instructions.

### Quick Overview:

#### For REST APIs:

### Step 1: Define the API Target

Add to `src/infrastructure/api/config/targets.json`:

```json
{
  "id": "my_api",
  "method": "GET",
  "url": "https://api.example.com/data",
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN"  // Optional
  }
}
```

### Step 2: Create Schema

Create `src/infrastructure/api/schemas/my-api.schema.ts`:

```typescript
import { z } from 'zod';

export const MyApiSchema = z.object({
  field: z.string()
});

export type MyApiResponse = z.infer<typeof MyApiSchema>;
```

### Step 3: Create Contract Test

Create `src/infrastructure/api/tests/my-api-contract.spec.ts`:

```typescript
import { test, expect, request as pwRequest } from '@playwright/test';
import { MyApiSchema } from '../schemas/my-api.schema.js';

test('My API contract', async () => {
  const req = await pwRequest.newContext();
  const res = await req.get('https://api.example.com/data');
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(MyApiSchema.safeParse(json).success).toBe(true);
});
```

### Step 4: Run Tests & Create Snapshot

```bash
# Run contract tests
npm run test:contracts

# Create snapshot (baseline)
npm run drift
```

**For GraphQL APIs:** See complete guide in [`docs/CREATING_CONTRACT_TESTS.md`](docs/CREATING_CONTRACT_TESTS.md)

```bash
npm run drift
```

**What happens:**

1. **📸 First Run - Snapshot Creation:**
   - Fetches the API response
   - Extracts the schema structure (keys and types)
   - **Automatically creates** `snapshots/latest.json`
   - Saves the baseline for future comparisons

2. **🔍 Subsequent Runs - Drift Detection:**
   - Fetches current API response
   - Compares with saved snapshot
   - Detects any schema changes (new fields, removed fields, type changes)
   - If changes detected:
     - 🤖 AI generates impact summary
     - 📢 Sends alerts (Teams/Email/Console)
     - 💾 Updates snapshot with new structure
     - 🔄 **Auto-commits** updated snapshot to repository (in CI/CD)

**Example Snapshot:**
```json
{
  "my_api": {
    "field": "string",
    "count": "number",
    "active": "boolean"
  }
}
```

**This is the core value:** You don't need to manually define schemas. The system learns your API structure automatically and monitors it forever! 🎯

---

## 🔄 Automatic Pull Requests (CI/CD Only)

**When running in GitHub Actions**, detected changes trigger an automatic workflow:

### What Happens:
1. **Drift detected** → API schema changed
2. **Snapshot updated** → New structure saved to `snapshots/latest.json`
3. **Branch created** → `drift/snapshot-update-{run_id}`
4. **Pull Request opened** → Automatic PR with AI analysis
5. **You review** → Check diff and AI summary
6. **Approve/Reject** → Merge or close the PR

### PR Contains:
- ✅ **Updated snapshots** with new API structure
- ✅ **AI-powered summary** of changes
- ✅ **Link to workflow run** for detailed logs
- ✅ **Labels** for easy filtering (`drift-detection`, `automated-pr`)

### Review Process:
1. **Alert received** → Teams notification with AI summary
2. **PR opened** → GitHub creates automatic Pull Request
3. **Review diff** → See exactly what changed in `snapshots/latest.json`
4. **Check AI analysis** → Understand business impact
5. **Decision:**
   - ✅ **Approve & Merge** → Accept changes
   - ❌ **Close PR** → Reject and investigate with API owner

### Why Pull Request (Not Direct Commit)?
- ✅ **Explicit approval** required for snapshot changes
- ✅ **Code review** process enforced
- ✅ **Discussion** possible in PR comments
- ✅ **Revert easily** if needed (just close PR)
- ✅ **Audit trail** of when and why snapshots changed

---

## 📈 Monitoring Stack (Meta-Monitoring)

**Purpose:** Monitor the monitoring system itself - ensure your drift detection is always running.

### Local Monitoring (Visual Dashboard)

- **Prometheus** (http://localhost:9090) - Collects metrics from the monitoring infrastructure
- **Grafana** (http://localhost:3001) - Visual dashboard showing system health
- **Node Exporter** (http://localhost:9100) - System metrics (CPU, Memory, Disk, Network)

**What it monitors:**
- ✅ Is the drift check service running?
- ✅ Is the system healthy? (CPU, RAM, Disk)
- ✅ Are there any performance issues?

**To use:** Run `npm run start` locally and access http://localhost:3001

### CI/CD Monitoring (Metrics Snapshots)

**In GitHub Actions**, metrics are saved as downloadable artifacts:

- **metrics_TIMESTAMP.txt** - Complete Prometheus metrics
- **health_TIMESTAMP.json** - Health check status
- **metrics_summary.md** - Summary report

**To access:**
1. Go to Actions tab
2. Select a workflow run
3. Download **metrics-snapshot-{run_id}** artifact

**Retention:** 30 days

**Think of it as:** A redundancy layer - if your monitoring system goes down, you'll know immediately from the dashboard. It's "monitoring the monitor" to ensure reliability.

## 💡 AI-Powered Summaries

Enable intelligent impact analysis with **Groq (100% FREE!)**:

### Quick Setup (2 minutes)

1. Get free API key: **https://console.groq.com/keys**
2. Add to `.env`:
   ```bash
   AI_GATEWAY_URL=https://api.groq.com/openai/v1/chat/completions
   AI_API_KEY=gsk_your_key_here
   ```
3. Done! AI is now active.

**See:** `docs/GROQ_SETUP.md` for detailed instructions.

### Example Output

**Without AI:**
```
Field 'deprecated' was added to schema
```

**With AI (Groq):**
```
⚠️ The 'deprecated' field signals potential API retirement. 
Consumers should monitor for deprecation notices and prepare 
migration paths to avoid service disruption.
```

The AI analyzes schema changes and explains **business impact**, not just technical diff.

## 🛠️ Technologies

- **TypeScript** - Type-safe development
- **Playwright** - HTTP contract testing
- **Zod** - Schema validation
- **Prometheus** - Metrics & observability
- **Grafana** - Dashboards & visualization
- **Docker** - Containerized infrastructure

---

## 📘 Operational Runbook

### Emergency: Disable Monitoring

```bash
# Set kill switch in CI secrets or .env
KILL_SWITCH=true
```

All drift checks will abort immediately with clear logging.

### Revert Snapshot Changes

If a bad snapshot was merged:

```bash
# 1. Close the automated PR (don't merge)
# 2. Revert the snapshot file
git checkout main~1 -- snapshots/latest.json
git commit -m "revert: bad snapshot"
git push

# 3. Contact API team to understand the change
```

### Adjust Execution Window

```bash
# Run only during business hours (9 AM - 5 PM UTC, Mon-Fri)
WINDOW_CRON="0 9-17 * * 1-5"

# Run every 2 hours
WINDOW_CRON="0 */2 * * *"
```

### Debug Drift False Positives

1. Check logs for run_id
2. Review snapshot diff: `git diff snapshots/latest.json`
3. Verify severity classification in PR body
4. Check AI grounding: look for `[AI] Groundedness check` in logs

### Increase Rate Limits (if needed)

```bash
# Production-grade settings
MAX_QPS=5
MAX_CONCURRENCY=10
HTTP_TIMEOUT_MS=15000
```

⚠️ **Warning**: Only increase if you've confirmed with API owners.

### Metrics Endpoint

- Local: `http://localhost:9091/metrics`
- Health: `http://localhost:9091/health`

Query Prometheus:
```promql
# Total drift events by severity
sum by (severity) (ai_monitor_drift_detected_total)

# HTTP error rate
rate(ai_monitor_http_requests_total{status=~"5.."}[5m])
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Main documentation & quick start |
| [docs/CREATING_CONTRACT_TESTS.md](docs/CREATING_CONTRACT_TESTS.md) | **Complete guide to create new tests** |
| [docs/GROQ_SETUP.md](docs/GROQ_SETUP.md) | AI setup with Groq (free) |
| [.github/CODEOWNERS](.github/CODEOWNERS) | PR review requirements |

---

## 📄 License

MIT