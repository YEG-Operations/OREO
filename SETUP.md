# YEG x L'Oréal - Event Manager System

Sistema automatizzato: Brief JotForm → AI genera proposte (con match fornitori YEG) → Event Manager revisiona → Invio a JotForm carrello.

---

## SETUP RAPIDO (fai questi passi in ordine)

### STEP 1 — Apri n8n

Apri il tuo n8n nel browser (il sottodominio dove lo hai hostato).

### STEP 2 — Importa i 4 workflow

Per ognuno: **Menu (☰) → Import from File → seleziona il JSON**

| # | File | Cosa fa |
|---|------|---------|
| 00 | `n8n-workflows/00-carica-suppliers-db.json` | Endpoint per caricare il database fornitori |
| 01 | `n8n-workflows/01-brief-to-proposals.json` | Riceve brief → QWEN genera 10 proposte per categoria |
| 02 | `n8n-workflows/02-api-endpoints.json` | API per l'interfaccia web (lista/dettaglio/aggiorna progetti) |
| 03 | `n8n-workflows/03-invio-jotform-carrello.json` | Invia proposte confermate al JotForm carrello |

**Dopo l'import, ATTIVA tutti e 4 i workflow** (toggle in alto a destra).

### STEP 3 — Inserisci la API Key QWEN

Devi modificare 2 nodi in 2 workflow diversi. Stessa operazione:

1. Apri **Workflow 01** → doppio click sul nodo **"QWEN AI - Genera Proposte"**
2. Vai nella sezione **Headers** → campo `Authorization`
3. Sostituisci `INSERISCI_QUI_LA_TUA_QWEN_API_KEY` con la tua key
   → Il campo deve diventare: `Bearer sk-xxxxxxxxxxxxxxxx`
4. Salva

5. Apri **Workflow 02** → doppio click sul nodo **"QWEN AI - Ricerca Info"**
6. Stessa cosa: Headers → Authorization → stessa API key
7. Salva

### STEP 4 — Inserisci la API Key JotForm

1. Apri **Workflow 03** → doppio click sul nodo **"Invio a JotForm Carrello"**
2. Nella sezione **Headers** → campo `APIKEY`
3. Sostituisci `INSERISCI_QUI_LA_TUA_JOTFORM_API_KEY` con la tua key JotForm
4. Salva

### STEP 5 — Collega il JotForm Brief al webhook

1. Nel **Workflow 01**, clicca sul nodo **"Webhook JotForm Brief"**
2. Copia l'URL di produzione (es: `https://tuo-n8n.com/webhook/jotform-brief-webhook`)
3. Vai su **JotForm** → apri il form brief → **Settings → Integrations → Webhooks**
4. Incolla l'URL del webhook e salva

### STEP 6 — Avvia l'interfaccia web in locale

Apri un terminale ed esegui:

```bash
cd "/Users/emanuele.campanini/Desktop/n8n loreal/web-interface"
python3 -m http.server 8080
```

Poi apri nel browser: **http://localhost:8080**

### STEP 7 — Configura l'interfaccia

Nella **sidebar sinistra**, in basso:

1. **n8n Base URL**: inserisci l'URL base dei webhook del tuo n8n
   - Es: `https://tuo-sottodominio.com/webhook`
   - NON l'URL dell'interfaccia n8n, ma quello dei webhook

2. **Database Fornitori YEG**: clicca "Scegli file" e seleziona `suppliers-db.json`
   (si trova nella cartella del progetto — è già stato generato)

### STEP 8 — Mappa i campi del JotForm Brief

I nomi dei campi nel workflow sono generici (q3, q4, ecc.). Devi adattarli al tuo form reale.

Esegui nel terminale:
```bash
curl "https://api.jotform.com/form/ID_DEL_TUO_FORM_BRIEF/questions?apiKey=LA_TUA_JOTFORM_API_KEY"
```

Questo ti restituisce la struttura dei campi. Poi nel **Workflow 01**, apri il nodo **"Parsing Brief JotForm"** e adatta i nomi `q3_nomeCliente`, `q4_azienda`, ecc. con quelli reali.

### STEP 9 — Mappa i campi del JotForm Carrello

Stessa cosa per il form carrello:
```bash
curl "https://api.jotform.com/form/260832964392061/questions?apiKey=LA_TUA_JOTFORM_API_KEY"
```

Nel **Workflow 03**, apri il nodo **"Mappa Campi JotForm"** e:
- Sostituisci `CART_FIELD_ID = '10'` con l'ID reale del campo carrello/payment del tuo form
- Adatta gli ID dei campi informativi (3, 4, 5, 6) con quelli reali

---

## Come funziona il matching fornitori YEG

Quando arriva un brief, il sistema:

1. **Filtra** dal database solo i fornitori nella stessa **città** dell'evento
2. **Passa** la lista filtrata a QWEN AI insieme al brief completo
3. **QWEN valuta** ogni fornitore YEG rispetto a:
   - Capienza vs numero partecipanti
   - Prezzo vs budget disponibile
   - Tipo di servizio vs tipo richiesto
   - Stile vs stile evento
4. **Include** nelle 10 proposte SOLO i fornitori YEG che effettivamente soddisfano i criteri
5. **Non forza** mai un fornitore inadatto — completa con proposte esterne

Ogni proposta include:
- Foto della struttura/servizio
- Badge dorato "YEG" se è un vostro fornitore
- "Motivo Match": spiegazione di perché risolve l'esigenza specifica del brief

---

## Aggiornare il database fornitori

Quando aggiungi nuovi fornitori nella cartella `SUPPLIERS/`:

```bash
cd "/Users/emanuele.campanini/Desktop/n8n loreal"
python3 build-suppliers-db.py
```

Poi ricarica il nuovo `suppliers-db.json` dall'interfaccia web (sidebar → Database Fornitori YEG).

---

## Struttura File

```
n8n-loreal/
├── SETUP.md                              # Questa guida
├── build-suppliers-db.py                  # Script per generare il DB fornitori
├── suppliers-db.json                      # Database fornitori generato (2345 fornitori)
├── SUPPLIERS/                             # File originali fornitori (Excel, PDF, ecc.)
├── n8n-workflows/
│   ├── 00-carica-suppliers-db.json        # Carica DB fornitori in n8n
│   ├── 01-brief-to-proposals.json         # Brief → AI + Match YEG → Proposte
│   ├── 02-api-endpoints.json              # API per interfaccia web + ricerca AI
│   └── 03-invio-jotform-carrello.json     # Invio a JotForm carrello
└── web-interface/
    ├── index.html                         # Dashboard Event Manager
    ├── style.css                          # Stili (con badge YEG, immagini, match)
    └── app.js                             # Logica applicativa
```

---

## Troubleshooting

**L'interfaccia non carica i progetti:**
→ Verifica che il n8n Base URL sia corretto e che i workflow siano attivi

**CORS error nel browser:**
→ Usa `python3 -m http.server 8080` per servire l'interfaccia, non aprire il file direttamente

**QWEN non risponde:**
→ Verifica la API key. Prova a testare il nodo HTTP Request singolarmente in n8n

**I fornitori YEG non appaiono:**
→ Assicurati di aver caricato `suppliers-db.json` dall'interfaccia web. Il caricamento deve andare a buon fine (messaggio verde)
