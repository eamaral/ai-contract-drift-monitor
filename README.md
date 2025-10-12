# AI Contract Drift Monitor

Complete boilerplate for monitoring external APIs with contract testing, proactive change detection (drift), and intelligent AI-powered alerts.

## 🎯 What it does

- **Contract Testing**: Automatic validation of API schemas (Playwright + Zod)
- **Drift Detection**: Continuous monitoring of changes in external APIs
- **Intelligent Alerts**: Teams notifications with AI-powered impact summaries
- **Metrics**: Prometheus metrics exposure for observability
- **CI/CD Ready**: GitHub Actions and pipeline integration

## 💡 Real Project Value

### **❌ Problems it Solves:**

**Silent Breaking Changes:**
- External APIs change without notice
- We only discover it broke when users complain

**Unmonitored Dependencies:**
- You don't know when APIs you use have changed
- GitHub API, payment APIs, third-party services

**Technical vs. Business Alerts:**
- Difference between "field changed" vs. "this will break our integration"

### **🎯 Real Use Cases:**

**🏢 Companies using external APIs:**
- GitHub API, payment APIs, third-party services
- Proactive vs. reactive monitoring (discover it broke when user complains)

**🔄 CI/CD Pipeline:**
- Contract tests as quality gate
- Drift check as early warning system

**📊 Observability:**
- Health metrics of the monitoring system
- Dashboards showing dependency stability

### **🚀 Competitive Advantage:**

**What makes this project special is the combination:**
- **Contract testing** (technical)
- **Drift detection** (proactive)
- **AI for contextualization** (intelligent)
- **Integrated alerts** (operational)

**It's not just "testing APIs" - it's a complete guardrails system for external dependencies.**

### **🤔 Strategic Considerations:**

**Strengths:**
- ✅ End-to-end solution
- ✅ Integration with existing tools (Teams, Prometheus)
- ✅ AI adds real value, not just "buzzword"

**Opportunities:**
- 🔄 Could expand to internal APIs
- 📧 Integration with more alert channels (Slack, email)
- 📊 Visual dashboard to view drift over time

**The value is in proactive problem prevention, not reaction to them.**

## 📋 Requirements

- Node.js 20+
- Environment variables (see `.env.example`)

## ⚡ Installation

```bash
npm install
cp .env.example .env
# Optional: configure TEAMS_WEBHOOK_URL, AI_GATEWAY_URL, AI_API_KEY
```

## 🏃‍♂️ Usage

### Contract Tests
```bash
npm run test:contracts
```
Validates API schemas and generates JUnit reports.

### Drift Check
```bash
npm run drift
```
- **First run**: Creates initial snapshot automatically
- **Subsequent runs**: Compares with previous snapshot
- **Changes detected**: Sends alerts (if configured)

### Prometheus Metrics
```bash
npm run metrics
# Access: http://localhost:9090/metrics
```

## ➕ Adding New APIs

### 1. Add to `targets.json`
```json
{
  "id": "my_api",
  "method": "GET",
  "url": "https://api.example.com/data",
  "headers": {
    "Authorization": "Bearer token"
  }
}
```

### 2. Create contract test
```typescript
// tests/api/my-api-contract.spec.ts
import { test, expect, request as pwRequest } from '@playwright/test';
import { z } from 'zod';

const MySchema = z.object({
  field1: z.string(),
  field2: z.number()
});

test('My API contract', async () => {
  const req = await pwRequest.newContext();
  const res = await req.get('https://api.example.com/data');
  
  expect(res.status()).toBe(200);
  const json = await res.json();
  
  const parsed = MySchema.safeParse(json);
  expect(parsed.success).toBe(true);
});
```

### 3. Run drift check
```bash
npm run drift
# Creates snapshot automatically for the new API
```

## 🤖 AI-Powered Summaries

Configure `AI_GATEWAY_URL` and `AI_API_KEY` in `.env` to enable intelligent summaries:

**Without AI:**
```
Field 'deprecated' was added to schema
```

**With AI:**
```
⚠️ Field 'deprecated' added - indicates API may be discontinued soon, consumers should migrate
```

## 📢 Notifications

### **Always Notifies (Success or Changes):**

**✅ No Changes:**
- Title: "API Contracts Status - All Good"
- Content: Status of all monitored APIs
- Details: How many APIs are stable

**⚠️ With Changes:**
- Title: "API Drift Detected"
- Content: Intelligent AI summary
- Details: Affected APIs and impact

### **Notification Channels:**

1. **Microsoft Teams** (priority)
   - Configure `TEAMS_WEBHOOK_URL`
   - Formatted cards with details

2. **Email** (fallback)
   - Configure `SMTP_*` and `EMAIL_TO`
   - Professional HTML formatting

3. **Console** (always)
   - Colored terminal output
   - Timestamp and complete details

### **Email Configuration:**
```bash
# .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_TO=recipient@example.com
```

## 📊 Monitored API Examples

- **REST APIs**: GitHub, Frankfurter (currency)
- **GraphQL**: Rick and Morty API
- **APIs with authentication**: Custom headers
- **Internal APIs**: Any HTTP/HTTPS endpoint

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

Complete pipeline configured in `.github/workflows/contract-monitoring.yml`:

**Triggers:**
- Push to `main` and `develop`
- Pull requests to `main`
- Daily cron at 9 AM UTC
- Manual execution (`workflow_dispatch`)

**Jobs:**

1. **Contract Tests**
   - Install dependencies
   - Run contract tests
   - Generate JUnit reports
   - Upload artifacts

2. **Drift Detection**
   - Run drift check
   - Detect schema changes
   - Send notifications (Teams/Email)
   - Automatic snapshot commits

3. **Prometheus Metrics**
   - Start metrics server
   - Health check
   - Status report

**Secrets Configuration:**
```bash
# In GitHub: Settings > Secrets and variables > Actions

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

**Generated Artifacts:**
- `test-results/` - JUnit reports
- `api-snapshots/` - API snapshots
- Prometheus metrics

## 📈 Available Metrics

- CPU and system memory
- Event loop lag
- Node.js process metrics
- Health checks

## 🛠️ Technologies

- **Playwright**: HTTP contract testing
- **Zod**: Schema validation
- **Prometheus**: Metrics and observability
- **Microsoft Teams**: Alerts and notifications
- **TypeScript**: Typing and development
- **Node.js**: Runtime and automation

## 📄 License

MIT