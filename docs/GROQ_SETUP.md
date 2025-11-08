# 🤖 Groq AI Setup (FREE!)

## 🎯 Why Groq?

- ✅ **100% FREE** (no credit card needed!)
- ✅ **14,400 requests/day** (more than enough)
- ✅ **Super fast** (fastest inference)
- ✅ **OpenAI compatible** (easy to switch later)

## 🚀 Setup (2 minutes)

### Step 1: Get Free API Key

1. Go to: **https://console.groq.com**
2. Sign up with GitHub/Google (free)
3. Go to: **https://console.groq.com/keys**
4. Click **"Create API Key"**
5. Copy the key (starts with `gsk_...`)

### Step 2: Configure Your Project

Add to your `.env` file:

```bash
# AI Configuration - Groq (FREE!)
AI_GATEWAY_URL=https://api.groq.com/openai/v1/chat/completions
AI_API_KEY=gsk_your_actual_key_here
```

### Step 3: Add to GitHub Secrets

For CI/CD to work:

1. Go to: **GitHub Repository > Settings > Secrets and variables > Actions**
2. Click **"New repository secret"**
3. Add:
   - Name: `AI_GATEWAY_URL`
   - Value: `https://api.groq.com/openai/v1/chat/completions`
4. Click **"New repository secret"** again
5. Add:
   - Name: `AI_API_KEY`
   - Value: `gsk_your_actual_key_here`

### Step 4: Test It!

```bash
npm run drift
```

If you see a change, the AI will generate a summary like:

```
🤖 AI Summary:
⚠️ Field 'deprecated' added to GitHub API response. This indicates 
the endpoint may be phased out soon. Consumers should check for 
migration alternatives and plan updates.
```

## 📊 What You Get

**Without AI:**
```
Diff: {"github_typescript":{"added":["deprecated"],"removed":[]}}
```

**With AI (Groq):**
```
⚠️ The 'deprecated' field signals potential API retirement. 
Consumers should monitor for deprecation notices and prepare 
migration paths to avoid service disruption.
```

## 🎯 Models Available (All Free!)

| Model | Speed | Quality | Best For |
|-------|-------|---------|----------|
| `llama-3.3-70b-versatile` | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | **Analysis (recommended)** |
| `llama-3.1-8b-instant` | ⚡⚡⚡⚡⚡ | ⭐⭐⭐ | Quick responses |
| `mixtral-8x7b-32768` | ⚡⚡ | ⭐⭐⭐⭐ | Long context |

## 🔧 Troubleshooting

### "AI summary disabled"
- ✅ Check if `AI_GATEWAY_URL` is set in `.env`
- ✅ Check if `AI_API_KEY` is set in `.env`
- ✅ Restart your terminal/server

### "401 Unauthorized"
- ✅ Check if API key is correct (starts with `gsk_`)
- ✅ Check if key is active in https://console.groq.com/keys

### "429 Rate Limit"
- ✅ You hit the free tier limit (14,400 requests/day)
- ✅ Wait 24h or upgrade to paid tier
- ✅ Unlikely with daily drift checks!

## 💡 Cost Comparison

| Provider | Free Tier | Cost After |
|----------|-----------|------------|
| **Groq** | ✅ 14,400/day | Still free! |
| OpenAI | ❌ No free tier | ~$0.002/request |
| Anthropic | ❌ No free tier | ~$0.003/request |

## 🎉 You're Done!

Your drift detection now has:
- ✅ Real AI analysis (not fake!)
- ✅ Business impact summaries
- ✅ 100% free
- ✅ Super fast responses

**Test it:** Change an API target and run `npm run drift`!
