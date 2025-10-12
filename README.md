# AI Contract Drift Monitor

> Professional boilerplate for monitoring external APIs with contract testing, proactive change detection (drift), and intelligent AI-powered alerts.

---

## 🎯 What This Project Does

**Problem:** External APIs change without warning, breaking your production systems. You discover issues only when users complain.

**Solution:** This project provides:

1. **📸 Automatic Snapshots** - Captures API schemas automatically on first run
2. **🔍 Drift Detection** - Monitors APIs continuously for changes
3. **🤖 AI-Powered Analysis** - Explains what changed and the impact
4. **📢 Smart Alerts** - Notifies you via Teams, Email, or Console
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
- ✅ **Multi-channel Alerts** - Teams, Email, Console
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

### Environment Variables

Create a `.env` file:

```bash
# AI Configuration (optional)
AI_GATEWAY_URL=https://your-ai-gateway.com
AI_API_KEY=your-ai-key

# Teams Notifications (optional)
TEAMS_WEBHOOK_URL=https://teams.webhook.url

# Email Notifications (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
EMAIL_TO=recipient@example.com
```

## 🆕 Adding New APIs to Monitor

### Step 1: Define the API Target

Add to `src/infrastructure/api/tests/targets.json`:

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

### Step 2: Create Contract Test

Create `src/infrastructure/api/tests/my-api-contract.spec.ts`:

```typescript
import { test, expect, request as pwRequest } from '@playwright/test';
import { z } from 'zod';

const MySchema = z.object({
  field: z.string()
});

test('My API contract', async () => {
  const req = await pwRequest.newContext();
  const res = await req.get('https://api.example.com/data');
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(MySchema.safeParse(json).success).toBe(true);
});
```

### Step 3: Run Drift Check (The Magic! ✨)

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

## 🔄 Automatic Snapshot Commits (CI/CD Only)

**When running in GitHub Actions**, detected changes trigger an automatic workflow:

### What Happens:
1. **Drift detected** → API schema changed
2. **Snapshot updated** → New structure saved to `snapshots/latest.json`
3. **Auto-commit** → GitHub Actions commits the change:
   ```
   chore: update API snapshots [skip ci]
   ```
4. **Push to main** → Changes pushed automatically
5. **No PR needed** → Direct commit to main branch

### Why Direct Commit?
- ✅ Snapshots are **non-breaking changes** (just documentation)
- ✅ You already received **alerts** (Teams/Email) about the change
- ✅ You can **review the commit** in GitHub history
- ✅ If needed, you can **revert** the commit

### Review Process:
1. **Alert received** → Check Teams/Email notification
2. **AI Summary** → Understand the impact
3. **GitHub commit** → Review snapshot diff in repository
4. **Action** → If problematic, revert or contact API owner

**Note:** The `[skip ci]` flag prevents infinite loops by not triggering another pipeline run.

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

Configure `AI_GATEWAY_URL` and `AI_API_KEY` in `.env` to enable intelligent impact analysis:

**Without AI:**
```
Field 'deprecated' was added to schema
```

**With AI:**
```
⚠️ Field 'deprecated' added - indicates API may be discontinued soon, consumers should migrate
```

The AI analyzes schema changes and explains business impact, not just technical diff.

## 🛠️ Technologies

- **TypeScript** - Type-safe development
- **Playwright** - HTTP contract testing
- **Zod** - Schema validation
- **Prometheus** - Metrics & observability
- **Grafana** - Dashboards & visualization
- **Docker** - Containerized infrastructure

## 📄 License

MIT