# n8n Workflows per OREO

## Workflow 1: Invio Email Fornitori (`send-email-fornitori.json`)

Triggerato dalla web app via webhook. Invia email ai fornitori usando il tuo SMTP.

**Setup:**
1. Importa `send-email-fornitori.json` in n8n
2. Configura il nodo SMTP con le tue credenziali
3. Copia il webhook URL e inseriscilo in `N8N_WEBHOOK_SEND_EMAIL` su Vercel

## Workflow 2: Cattura Risposte Fornitori (`capture-reply-fornitori.json`)

Triggerato quando l'email dell'operatore riceve una risposta da un fornitore.

**Setup:**
1. Configura un forwarder email (es. Gmail → n8n webhook, o IMAP polling)
2. Importa `capture-reply-fornitori.json` in n8n  
3. Il webhook chiama `POST /api/email-reply` sulla web app

## Variabili d'ambiente necessarie

```
N8N_WEBHOOK_SEND_EMAIL=https://tuon8n.com/webhook/send-email
N8N_WEBHOOK_REPLY_URL=https://tuon8n.com/webhook/reply-handler
NEXT_PUBLIC_APP_URL=https://oreo.vercel.app