# 📱 WhatsApp Integration - Setup Guide

## ✅ Implementação Completa!

A integração WhatsApp está 100% implementada e pronta para uso. Siga os passos abaixo para ativar.

---

## 🚀 Passo 1: Criar Conta Twilio

### 1.1 - Cadastro
1. Acesse: https://www.twilio.com/try-twilio
2. Preencha seus dados e crie a conta (gratuita)
3. Verifique seu email e número de telefone

### 1.2 - Ativar WhatsApp Sandbox
1. No Twilio Console, vá em: **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Você verá algo assim:
   ```
   To connect your WhatsApp account to this Sandbox, send a message 
   with the code join <código> to the number +1 415 523 8886
   ```
3. **Guarde esse código!** (ex: `join money-goal`)

### 1.3 - Pegar Credenciais
1. No Twilio Console, vá em **Account Info**
2. Copie:
   - **Account SID** (ex: `ACxxxxxxxxxxxxxxxxx`)
   - **Auth Token** (clique em "show" e copie)
   - **WhatsApp Number**: `+14155238886` (sandbox)

---

## 🔐 Passo 2: Configurar Variáveis de Ambiente

### 2.1 - Adicionar no Render

No Render Dashboard → seu service → **Environment**:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+14155238886
VITE_APP_URL=https://seu-app.onrender.com
```

### 2.2 - Adicionar localmente (`.env`)

Para testes locais:

```bash
# WhatsApp / Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+14155238886
VITE_APP_URL=http://localhost:5173
```

---

## ⚙️ Passo 3: Configurar Webhook no Twilio

### 3.1 - URL do Webhook

Sua URL será:
```
https://seu-app.onrender.com/trpc/whatsapp.webhook
```

### 3.2 - Configurar no Twilio

1. Twilio Console → **Messaging** → **Settings** → **WhatsApp Sandbox Settings**
2. Em **"WHEN A MESSAGE COMES IN"**:
   - URL: `https://seu-app.onrender.com/trpc/whatsapp.webhook`
   - Method: **POST**
3. Clique em **Save**

---

## 🗄️ Passo 4: Rodar Migration no Banco

### Opção A: Automático (próximo deploy)

Se você já configurou `MIGRATE=1` no Render, a migration roda automaticamente.

### Opção B: Manual (SQL direto)

Se quiser rodar agora no banco:

```sql
-- Adicionar colunas de WhatsApp
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number" varchar(20);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_verified" boolean DEFAULT false;
```

**Como rodar:**
1. Acesse seu banco PostgreSQL (Render Dashboard → Database → Connect)
2. Cole e execute o SQL acima

---

## 🧪 Passo 5: Testar

### 5.1 - Vincular no App

1. Acesse o app → **Settings**
2. Na seção **WhatsApp Integration**:
   - Digite seu número: `+55 11 99999-9999`
   - Clique em **"🚀 Conectar via WhatsApp"**
3. O WhatsApp abrirá automaticamente
4. Aperte **ENVIAR** na mensagem `join money-goal`

### 5.2 - Testar Mensagens

Agora envie para o mesmo número (`+1 415 523 8886`):

```
Mercado 350 reais
```

Você deve receber:
```
✅ Gasto registrado!

📝 Mercado
💰 R$ 350,00
🏷️ Alimentação

💎 Economias totais: R$ X,XX
```

### 5.3 - Outros Testes

```
Uber 25
→ Registra R$ 25 em Transporte

hoje
→ Mostra gastos de hoje

ajuda
→ Lista todos os comandos
```

---

## 🎯 Como Funciona (Fluxo Técnico)

```
1. User envia msg no WhatsApp
   ↓
2. Twilio recebe e chama webhook
   POST /trpc/whatsapp.webhook
   ↓
3. Server identifica user por telefone
   ↓
4. OpenAI/Gemini extrai dados da msg
   "Mercado 350" → {description: "Mercado", amount: 35000}
   ↓
5. Cria transaction no PostgreSQL
   ↓
6. Envia confirmação via Twilio
   ↓
7. User recebe "✅ Gasto registrado!"
```

---

## 💰 Custos e Limites

### Sandbox (Desenvolvimento/Uso Pessoal)

| Recurso | Limite | Custo |
|---------|--------|-------|
| Números conectados | 5 simultâneos | **GRÁTIS** |
| Mensagens/mês | 1000 | **GRÁTIS** |
| Validade | Sem limite | **GRÁTIS** |

**Para 2-5 usuários:** 100% gratuito!

### Produção (Número Próprio)

Só precisa se quiser:
- Número brasileiro dedicado
- Mais de 5 usuários
- Remover marca "via Twilio"

**Custos:**
- Setup: ~$0 (só burocracia)
- Número: ~$15/mês
- Mensagens: $0.005 cada (após 1000 grátis)

---

## 🛠️ Troubleshooting

### ❌ "Número não vinculado"
**Problema:** User não fez o link no app
**Solução:** Ir em Settings → WhatsApp e vincular

### ❌ Webhook não funciona
**Problema:** URL errada ou não configurada
**Solução:** 
1. Verificar URL: `https://seu-app.onrender.com/trpc/whatsapp.webhook`
2. Method deve ser **POST**
3. Testar manualmente:
```bash
curl -X POST https://seu-app.onrender.com/trpc/whatsapp.webhook \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+5511999999999","Body":"teste"}'
```

### ❌ "Failed to send WhatsApp message"
**Problema:** Credenciais Twilio erradas
**Solução:**
1. Verificar `TWILIO_ACCOUNT_SID` e `TWILIO_AUTH_TOKEN`
2. Verificar se começam com `AC` e têm 32+ caracteres
3. Regenerar no Twilio se necessário

### ❌ LLM não entende mensagens
**Problema:** OpenAI/Gemini não configurado
**Solução:** Verificar `GOOGLE_API_KEY` nas env vars

---

## 📊 Monitoramento

### Ver Logs no Render
```
Render Dashboard → seu service → Logs
Filtrar por: "WhatsApp"
```

### Ver Mensagens no Twilio
```
Twilio Console → Monitor → Logs → Messaging
```

---

## 🎨 Customizações Futuras

Fácil de adicionar:

### 1. Mais Comandos
```typescript
// Em server/whatsappRouter.ts
if (lowerMessage === "saldo") {
  const goals = await db.getActiveGoals(user.openId);
  // Enviar saldo atual
}
```

### 2. Envio de Notas Fiscais (OCR)
```typescript
if (input.MediaUrl) {
  // Usar Google Vision API para extrair texto
  // Parsear valores da nota
}
```

### 3. Notificações Proativas
```typescript
// Cron job diário
await sendWhatsApp(phoneNumber, 
  "📊 Resumo de ontem: R$ 150,00 em 5 gastos"
);
```

### 4. Gráficos por WhatsApp
Usar bibliotecas como `quickchart.io` para gerar gráficos e enviar como imagem.

---

## ✅ Checklist Final

- [ ] Conta Twilio criada
- [ ] Sandbox ativado
- [ ] Env vars configuradas no Render
- [ ] Webhook configurado
- [ ] Migration rodada
- [ ] App deployed
- [ ] Teste de vinculação OK
- [ ] Teste de mensagem OK
- [ ] Teste de comando "hoje" OK

---

## 📞 Suporte

**Documentação Twilio:**
- Sandbox: https://www.twilio.com/docs/whatsapp/sandbox
- API: https://www.twilio.com/docs/whatsapp/api

**Limites e Pricing:**
- https://www.twilio.com/whatsapp/pricing

---

## 🎉 Pronto!

Sua integração WhatsApp está funcionando! 

Agora seus usuários podem registrar gastos com mensagens simples como:
- "Mercado 350"
- "Uber 25"
- "Academia 120"

E receber confirmações instantâneas! 💰✨
