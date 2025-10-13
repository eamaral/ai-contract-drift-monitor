# 🎬 Guia de Demonstração - AI Drift Detection

## 🎯 Objetivo
Demonstrar como o sistema detecta mudanças em APIs e como a IA analisa o impacto.

---

## 📋 Pré-Requisitos

1. ✅ Groq AI configurado no `.env` (veja `GROQ_SETUP.md`)
2. ✅ Docker rodando (para Grafana opcional)
3. ✅ Snapshot baseline criado

---

## 🎬 Roteiro de Demonstração (5 minutos)

### **Passo 1: Mostrar Estado Atual (30s)**

```bash
npm run drift
```

**Resultado esperado:**
```
✅ API Contracts Status - All Good
📝 All 3 endpoints are stable
   • APIs Monitored: 3
   • APIs with Changes: 0
```

**Fale:** "Veja, temos 3 APIs sendo monitoradas: GitHub, Frankfurter (moedas) e Rick & Morty (GraphQL). Tudo estável, sem mudanças detectadas."

---

### **Passo 2: Explicar as APIs (30s)**

Mostrar o arquivo `src/infrastructure/api/tests/targets.json`:

**Fale:** "Aqui definimos as APIs que queremos monitorar:
- GitHub API (REST)
- Frankfurter (REST - taxas de câmbio)  
- Rick & Morty (GraphQL - usa introspection para detectar mudanças no schema)"

---

### **Passo 3: Simular Mudança na API (1min)**

**Opção A: REST API (Mais Simples)**

Editar `targets.json`, mudar:
```json
"url": "https://api.frankfurter.app/latest?from=USD&to=EUR"
```

Para:
```json
"url": "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY"
```

**Fale:** "Vamos simular que a API Frankfurter agora retorna múltiplas moedas em vez de apenas EUR."

---

**Opção B: GraphQL (Para demonstrar introspection)**

Não precisa mudar nada no targets! Em vez disso:

Editar `snapshots/latest.json`, remover o campo `"gender:String"` do Character:

**Fale:** "Vamos simular que a API Rick & Morty REMOVEU o campo 'gender' do schema Character."

---

### **Passo 4: Detectar Drift + IA Analisa (1min)**

```bash
npm run drift
```

**Resultado esperado:**
```
🚨 🚨 API Drift Detected

📝 [IA GROQ ANALISA AQUI]
The addition of GBP and JPY to the currency conversion response 
is an additive change that won't break existing consumers. However, 
integrations expecting only EUR may need to update their validation 
logic to handle multiple currencies...

📊 Details:
   • APIs with Changes: 1
   • Affected APIs: fx_usd_eur
```

**Fale:** "Olha! O sistema detectou a mudança E a IA Groq analisou automaticamente:
- Identificou que é mudança aditiva
- Explicou que não quebra integrações existentes
- Alertou que pode precisar ajustar validações
- Isso é análise de NEGÓCIO, não só diff técnico!"

---

### **Passo 5: Mostrar Notificações (30s)**

**Fale:** "Além do console, o sistema enviou:
- 📧 Email com o resumo (se configurado)
- 💬 Teams message (se configurado)
- 💾 Snapshot atualizado automaticamente"

Mostrar:
- Email recebido (se tiver)
- Snapshot file: `snapshots/latest.json`

---

### **Passo 6: Mostrar GraphQL Introspection (Bônus - 1min)**

```bash
cat snapshots/latest.json | jq '.rick_morty_graphql.Character'
```

**Resultado:**
```json
[
  "created:String",
  "episode:NON_NULL",
  "gender:String",
  "id:ID",
  "image:String",
  "location:Location",
  "name:String",
  "origin:Location",
  "species:String",
  "status:String",
  "type:String"
]
```

**Fale:** "Para GraphQL, o sistema usa **introspection** para pegar o schema completo da API, não apenas os campos que você pediu na query. Isso detecta QUALQUER mudança no schema, mesmo que você não use todos os campos."

---

### **Passo 7: Limpar Demonstração (10s)**

```bash
git checkout src/infrastructure/api/tests/targets.json snapshots/latest.json
```

**Fale:** "Pronto! Voltamos ao estado original. Sem commits, demonstração limpa e repetível!"

---

## 🎯 Mensagens-Chave para Passar

1. **📸 Automatic Learning:** Sistema aprende o schema automaticamente (não precisa definir manualmente)
2. **🔍 Proactive Detection:** Detecta mudanças ANTES de quebrar produção
3. **🤖 AI Analysis:** IA explica impacto de negócio, não só diff técnico
4. **📢 Smart Alerts:** Notificações inteligentes quando algo muda
5. **🎛️ GraphQL Support:** Introspection detecta mudanças no schema completo

---

## 💡 Perguntas Comuns

**P: O snapshot precisa ser criado manualmente?**
R: Não! O primeiro `npm run drift` cria automaticamente.

**P: Como sabe quando algo mudou?**
R: Compara snapshot atual com a resposta da API. Qualquer diferença é detectada.

**P: GraphQL funciona diferente?**
R: Sim! Usa introspection para pegar o schema completo, não depende da sua query.

**P: A IA sempre analisa?**
R: Só quando há mudanças detectadas. Se tudo estável, não gasta requests.

**P: Precisa commitar snapshots?**
R: Localmente não. Na pipeline CI/CD, sim (auto-commit).

---

## 🚀 Demonstração Relâmpago (2 min)

```bash
# 1. Estado atual
npm run drift  # ✅ All Good

# 2. Simular mudança
# Editar targets.json (mudar EUR para EUR,GBP,JPY)

# 3. Detectar + IA
npm run drift  # 🚨 Drift + AI Analysis

# 4. Limpar
git checkout src/infrastructure/api/tests/targets.json snapshots/latest.json
```

**Pronto para apresentar!** 🎯
