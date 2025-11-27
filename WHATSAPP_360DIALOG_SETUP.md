# 📱 WhatsApp Integration - 360Dialog Setup Guide

A integração WhatsApp via 360Dialog está 100% implementada. Siga os passos abaixo para ativar.

## 🚀 Passo 1: Criar Conta 360Dialog

### 1.1 - Registro
1. Acesse: https://hub.360dialog.com/
2. Clique em "Get Started" ou "Sign Up"
3. Complete o cadastro com seus dados

### 1.2 - Conectar Número WhatsApp
1. No dashboard, clique em "Connect a number"
2. Escolha uma das opções:
   - **Opção A**: Número novo (360Dialog fornece)
   - **Opção B**: Migrar número existente
   - **Opção C**: Usar número de teste (sandbox)

3. Siga o fluxo de verificação do Meta/Facebook
4. Aguarde aprovação (geralmente instantâneo para teste)

## 📋 Passo 2: Obter Credenciais

### 2.1 - API Key (Access Token)
1. No 360Dialog Hub, vá em **Settings** → **API Keys**
2. Clique em "Create API Key"
3. Copie o token gerado (começa com `EAAA...`)
4. **Importante**: Guarde em local seguro, só aparece uma vez!

### 2.2 - Phone Number ID
1. Vá em **Phone Numbers**
2. Clique no número que você conectou
3. Copie o **Phone Number ID** (número longo, tipo `106540352242922`)

### 2.3 - Webhook Token
1. Crie um token secreto aleatório (você mesmo define)
2. Exemplo: `minhaChaveSecreta12345` ou gere aleatoriamente
3. Este token será usado para verificar webhooks

## 🔧 Passo 3: Configurar Variáveis de Ambiente

### 3.1 - Backend (Render)
Adicione as seguintes variáveis no Render:

```env
WHATSAPP_PHONE_NUMBER_ID=106540352242922
WHATSAPP_ACCESS_TOKEN=EAAAxxxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_WEBHOOK_TOKEN=minhaChaveSecreta12345
```

### 3.2 - Remover Variáveis do Twilio (Opcional)
Você pode remover estas variáveis antigas:
```env
# Não são mais necessárias
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN  
TWILIO_WHATSAPP_NUMBER
```

## 🔗 Passo 4: Configurar Webhook

### 4.1 - URL do Webhook
No 360Dialog Hub, configure o webhook:

**URL**: `https://money-goal-backend.onrender.com/api/webhooks/whatsapp`

### 4.2 - Verificação
1. Cole a URL acima
2. No campo "Verify Token", cole o mesmo token que você definiu em `WHATSAPP_WEBHOOK_TOKEN`
3. Clique em "Verify and Save"

### 4.3 - Eventos para Inscrever
Marque as seguintes opções:
- ✅ **messages** - Para receber mensagens dos usuários

## ✅ Passo 5: Testar

### 5.1 - Vincular Número no App
1. Acesse o aplicativo: https://money-goal-app.vercel.app
2. Vá em **Configurações** → **WhatsApp**
3. Digite seu número (com DDD): `+5521999999999`
4. Clique em "Vincular WhatsApp"
5. Você receberá uma mensagem de boas-vindas!

### 5.2 - Enviar Primeiro Gasto
Envie uma mensagem WhatsApp para o número conectado:

```
Mercado 350 reais
```

Você deve receber:
```
✅ Gasto registrado!

📝 Mercado
💸 R$ 350,00
🏷️ Alimentação

💎 Economias totais: R$ 0,00
```

## 🎯 Comandos Disponíveis

Envie pelo WhatsApp:

- `Mercado 350 reais` - Registra gasto
- `Recebi 1000 dólares` - Registra receita em USD
- `hoje` - Ver gastos do dia
- `ajuda` - Lista de comandos

## 💰 Preços

### Plano Gratuito
- **250 conversas/mês grátis**
- Conversa = janela de 24h (não por mensagem)
- Perfeito para uso pessoal com 3-4 usuários

### Cálculo de Uso
Para 4 pessoas usando diariamente:
- 4 pessoas × 30 dias = **120 conversas/mês**
- Bem abaixo do limite de 250 ✅

## 🔍 Troubleshooting

### Webhook não está sendo chamado
1. Verifique se o WHATSAPP_WEBHOOK_TOKEN está correto no Render
2. Teste a URL manualmente: `GET https://money-goal-backend.onrender.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=test`
3. Deve retornar `test` se configurado corretamente

### Mensagens não são enviadas
1. Verifique o WHATSAPP_ACCESS_TOKEN no Render
2. Verifique o WHATSAPP_PHONE_NUMBER_ID
3. Check logs no Render para erros de API

### Número não vinculado
1. Certifique-se que o formato está correto: `+55` + DDD + número
2. Exemplo: `+5521999999999` (sem espaços ou traços)

## 🌟 Vantagens vs Twilio

✅ **Sem restrições geográficas**  
✅ **Mais barato** (conversas grátis nas primeiras 24h)  
✅ **Plano gratuito generoso** (250 conversas/mês)  
✅ **API oficial do WhatsApp**  
✅ **Melhor para Brasil**  

## 📚 Documentação

- [360Dialog Hub](https://hub.360dialog.com/)
- [360Dialog Docs](https://docs.360dialog.com/)
- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
