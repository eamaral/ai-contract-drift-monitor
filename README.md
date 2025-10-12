# AI Contract Drift Monitor

Boilerplate completo para monitoramento de APIs externas com testes de contrato, detecção proativa de mudanças (drift) e alertas inteligentes com IA.

## 🎯 O que faz

- **Testes de Contrato**: Validação automática de schemas de APIs (Playwright + Zod)
- **Drift Detection**: Monitoramento contínuo de mudanças em APIs externas
- **Alertas Inteligentes**: Notificações no Teams com resumo de impacto via IA
- **Métricas**: Exposição de métricas Prometheus para observabilidade
- **CI/CD Ready**: Integração com GitHub Actions e pipelines

## 💡 Valor Real do Projeto

### **❌ Problemas que Resolve:**

**Breaking Changes Silenciosos:**
- APIs externas mudam sem aviso
- Descobrimos que quebrou quando usuário reclama

**Dependências Não Monitoradas:**
- Você não sabe quando APIs que usa mudaram
- GitHub API, APIs de pagamento, terceiros

**Alertas Técnicos vs. Negócio:**
- Diferença entre "campo mudou" vs. "isso vai quebrar nossa integração"

### **🎯 Cenários de Uso Reais:**

**🏢 Empresa usando APIs externas:**
- GitHub API, APIs de pagamento, APIs de terceiros
- Monitoramento proativo vs. reativo (descobrir quebrou quando usuário reclama)

**🔄 CI/CD Pipeline:**
- Testes de contrato como gate de qualidade
- Drift check como early warning system

**📊 Observabilidade:**
- Métricas de saúde do sistema de monitoramento
- Dashboards mostrando estabilidade das dependências

### **🚀 Diferencial Competitivo:**

**O que torna este projeto especial é a combinação:**
- **Testes de contrato** (técnico)
- **Drift detection** (proativo)
- **IA para contextualização** (inteligente)
- **Alertas integrados** (operacional)

**Não é só "testar API" - é um sistema completo de guardrails para dependências externas.**

### **🤔 Ponderações Estratégicas:**

**Pontos Fortes:**
- ✅ Solução end-to-end
- ✅ Integração com ferramentas existentes (Teams, Prometheus)
- ✅ IA adiciona valor real, não é só "buzzword"

**Oportunidades:**
- 🔄 Poderia expandir para APIs internas
- 📧 Integração com mais canais de alerta (Slack, email)
- 📊 Dashboard visual para visualizar drift ao longo do tempo

**O valor está na prevenção proativa de problemas, não na reação a eles.**

## 📋 Requisitos

- Node.js 20+
- Variáveis de ambiente (veja `.env.example`)

## ⚡ Instalação

```bash
npm install
cp .env.example .env
# Opcional: configure TEAMS_WEBHOOK_URL, AI_GATEWAY_URL, AI_API_KEY
```

## 🏃‍♂️ Uso

### Testes de Contrato
```bash
npm run test:contracts
```
Valida schemas de APIs e gera relatórios JUnit.

### Drift Check
```bash
npm run drift
```
- **Primeira execução**: Cria snapshot inicial automaticamente
- **Execuções seguintes**: Compara com snapshot anterior
- **Mudanças detectadas**: Envia alertas (se configurado)

### Métricas Prometheus
```bash
npm run metrics
# Acesse: http://localhost:9090/metrics
```

## ➕ Adicionando Novas APIs

### 1. Adicionar em `targets.json`
```json
{
  "id": "minha_api",
  "method": "GET",
  "url": "https://api.exemplo.com/dados",
  "headers": {
    "Authorization": "Bearer token"
  }
}
```

### 2. Criar teste de contrato
```typescript
// tests/api/minha-api-contract.spec.ts
import { test, expect, request as pwRequest } from '@playwright/test';
import { z } from 'zod';

const MeuSchema = z.object({
  campo1: z.string(),
  campo2: z.number()
});

test('Minha API contract', async () => {
  const req = await pwRequest.newContext();
  const res = await req.get('https://api.exemplo.com/dados');
  
  expect(res.status()).toBe(200);
  const json = await res.json();
  
  const parsed = MeuSchema.safeParse(json);
  expect(parsed.success).toBe(true);
});
```

### 3. Rodar drift check
```bash
npm run drift
# Cria snapshot automaticamente para a nova API
```

## 🤖 Resumo com IA

Configure `AI_GATEWAY_URL` e `AI_API_KEY` no `.env` para ativar resumos inteligentes:

**Sem IA:**
```
Campo 'deprecated' foi adicionado ao schema
```

**Com IA:**
```
⚠️ Campo 'deprecated' adicionado - indica que API pode ser descontinuada em breve, consumidores devem migrar
```

## 📢 Notificações

### **Sempre Notifica (Sucesso ou Mudanças):**

**✅ Sem Mudanças:**
- Título: "API Contracts Status - All Good"
- Conteúdo: Status de todas as APIs monitoradas
- Detalhes: Quantas APIs estão estáveis

**⚠️ Com Mudanças:**
- Título: "API Drift Detected"
- Conteúdo: Resumo inteligente com IA
- Detalhes: APIs afetadas e impacto

### **Canais de Notificação:**

1. **Microsoft Teams** (prioritário)
   - Configure `TEAMS_WEBHOOK_URL`
   - Cards formatados com detalhes

2. **Email** (fallback)
   - Configure `SMTP_*` e `EMAIL_TO`
   - HTML formatado profissionalmente

3. **Console** (sempre)
   - Output colorido no terminal
   - Timestamp e detalhes completos

### **Configuração de Email:**
```bash
# .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
EMAIL_TO=destinatario@exemplo.com
```

## 📊 Exemplos de APIs Monitoradas

- **REST APIs**: GitHub, Frankfurter (câmbio)
- **GraphQL**: Rick and Morty API
- **APIs com autenticação**: Headers customizados
- **APIs internas**: Qualquer endpoint HTTP/HTTPS

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

Pipeline completo configurado em `.github/workflows/contract-monitoring.yml`:

**Triggers:**
- Push para `main` e `develop`
- Pull requests para `main`
- Cron diário às 9h UTC
- Execução manual (`workflow_dispatch`)

**Jobs:**

1. **Contract Tests**
   - Instala dependências
   - Executa testes de contrato
   - Gera relatórios JUnit
   - Upload de artefatos

2. **Drift Detection**
   - Executa drift check
   - Detecta mudanças nos schemas
   - Envia notificações (Teams/Email)
   - Commit automático de snapshots

3. **Prometheus Metrics**
   - Inicia servidor de métricas
   - Health check
   - Relatório de status

**Configuração de Secrets:**
```bash
# No GitHub: Settings > Secrets and variables > Actions
AI_GATEWAY_URL=https://sua-ia-gateway.com
AI_API_KEY=sua-chave-ia
TEAMS_WEBHOOK_URL=https://teams.webhook.url
```

**Artefatos Gerados:**
- `test-results/` - Relatórios JUnit
- `api-snapshots/` - Snapshots das APIs
- Métricas Prometheus

## 📈 Métricas Disponíveis

- CPU e memória do sistema
- Event loop lag
- Métricas de processo Node.js
- Health checks

## 🛠️ Tecnologias

- **Playwright**: Testes de contrato HTTP
- **Zod**: Validação de schemas
- **Prometheus**: Métricas e observabilidade
- **Microsoft Teams**: Alertas e notificações
- **TypeScript**: Tipagem e desenvolvimento
- **Node.js**: Runtime e automação

## 📄 Licença

MIT