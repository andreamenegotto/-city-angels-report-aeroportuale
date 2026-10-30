# City Angels - Report di Servizio Aeroportuale (Malpensa T1 / T2)

Applicativo web gestionale completo, moderno e responsive sviluppato per l'Associazione e Cooperativa **City Angels**, dedicato alla compilazione, calcolo automatico dei totali, firma digitale scansionata e generazione del **Report di Servizio Ufficiale in formato PDF (A4 multipagina)**.

---

## 🌟 Caratteristiche Principali

### 1. Dati Generali del Servizio
- **Numerazione sequenziale e archivio storico**: caricamento automatico e navigazione immediata tra tutti i report registrati (stagioni 2025 e 2026).
- **Gestione orari di più servizi**: possibilità di inserire date e fasce orarie multiple (es. turno mattutino, presidio pomeridiano, servizio serale/notturno o interventi spezzati) con descrizione dedicata per ciascun servizio.
- **Dati Enti personalizzabili**: intestazioni ufficiali per *City Angels ODV* e *Cooperativa Sociale City Angels*, con caricamento del logo ad alta definizione.

### 2. Luoghi e Comunicazioni CO PS
- Gestione varchi e sbarre di inizio e termine servizio (Terminal 1 e Terminal 2).
- Tracciamento targhe dei veicoli di servizio autorizzati con autocompletamento e archivio targhe.
- Comunicazioni con la Centrale Operativa Polizia di Stato (CO PS) sia in avvio che in conclusione turno.

### 3. Squadra Operativa e Firme Digitali
- Registro anagrafico dei volontari e coordinatori operativi.
- Selezione immediata dei presenti con calcolo orario e conteggio presenze totali per la statistica di servizio.
- **Associazione del compilatore**: spunta diretta per indicare chi compila la scheda.
- **Firme scansionate ufficiali**: associazione automatica delle firme con trasparenza per i coordinatori (Andrea Menegotto, Chiara Menegotto, Chiara Pozzi), con possibilità di caricare nuove firme o lasciare il riquadro bianco per la firma manuale a penna.

### 4. Rilievi Operativi e Statistiche
- Griglia per monitoraggio e censimento:
  - Senzatetto / persone senza fissa dimora
  - Passeggeri e utenti assistiti
  - Bagagli incustoditi e verifiche di sicurezza
  - Taxi abusivi e monitoraggio viabilità
  - Interventi di primo soccorso / ambulanze
  - Interventi congiunti con Forze dell'Ordine / Polaria
- Caricamento e allegato fotografico dei rilievi con ottimizzazione automatica della risoluzione.

### 5. Generazione PDF A4 Ufficiale
- Rendering conforme al modello cartaceo originale a due o più pagine A4.
- Layout pixel-perfect con bordi neri definiti, loghi nitidi e distribuzione bilanciata dei contenuti.
- Pulsanti di esportazione immediata in **PDF vettoriale**, visualizzazione anteprima A4 a schermo e stampa diretta con finestra di sistema.

### 6. Archiviazione Cloud, Google Drive & Storico Intelligente
- Persistenza su **Google Cloud Firebase Firestore** per sincronizzazione in tempo reale multi-dispositivo (utenti, luoghi, firme, configurazioni).
- **Integrazione bidirezionale con Google Drive**: scansione gerarchica e archiviazione automatica nelle sottocartelle 2025/2026 con eliminazione sincronizzata (PDF e JSON).
- **Deduplicazione automatica e normalizzazione assoluta**: garanzia di conteggi storici sempre esatti e univoci (62 report storici consolidati, nessun conteggio duplicato).
- Cache di riserva locale in `localStorage` per garantire continuità operativa anche in caso di disconnessione o scarsa copertura di rete in aeroporto.

### 7. Interrogazione Intelligente con Gemini AI
- Modulo di ricerca semantica e query vocale tramite microfono con modello multimodale **Google Gemini**.
- Analisi incrociata istantanea su tutti i report storici, verbali archiviati, presenze e rilevazioni varchi.

### 8. Affidabilità e Compatibilità Multipiattaforma
- **Pieno supporto Desktop (PC / Mac) e Mobile (Android / iOS)**.
- **ErrorBoundary globale**: protezione completa da errori imprevisti con pannello di ripristino e ricarica.
- Link pubblico di produzione diretto per i collaboratori.

---

## 🛠️ Stack Tecnologico

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite 8](https://vitejs.dev/)
- **Stile**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icone**: [Lucide React](https://lucide.dev/)
- **Generazione Documenti**: [jsPDF](https://github.com/parallax/jsPDF)
- **Intelligenza Artificiale**: Google Gen AI SDK (`@google/genai`)
- **Database Cloud**: [Firebase Firestore](https://firebase.google.com/)
- **Archiviazione Cloud**: Google Drive API v3 (OAuth2)
- **Backend**: Express su Node.js (`server.ts`)

---

## 🚀 Installazione ed Esecuzione Locale

### Prerequisiti
- [Node.js](https://nodejs.org/) (versione 18 o superiore consigliata)
- `npm` o `bun`

### Passaggi

1. **Clona il repository**:
   ```bash
   git clone https://github.com/<tuo-utente>/city-angels-report-aeroportuale.git
   cd city-angels-report-aeroportuale
   ```

2. **Installa le dipendenze**:
   ```bash
   npm install
   ```

3. **Configura le variabili d'ambiente** (opzionale):
   Copia il file di esempio se necessario:
   ```bash
   cp .env.example .env
   ```

4. **Avvia il server di sviluppo**:
   ```bash
   npm run dev
   ```
   L'applicazione sarà accessibile all'indirizzo `http://localhost:3000`.

5. **Compilazione per la produzione**:
   ```bash
   npm run build
   ```

---

## 📂 Struttura del Progetto

```
.
├── index.html                     # Entry point HTML con metadati
├── package.json                   # Dipendenze e script npm
├── server.ts                      # Server Express con proxy e supporto SSR/SPA
├── vite.config.ts                 # Configurazione Vite e Tailwind CSS
├── tsconfig.json                  # Configurazione TypeScript
├── firebase-applet-config.json    # Configurazione Firebase
├── firestore.rules                # Regole di sicurezza Firestore
├── src/
│   ├── main.tsx                   # Bootstrap React
│   ├── App.tsx                    # Componente principale dell'applicazione
│   ├── types/
│   │   └── report.ts              # Definizioni TypeScript per report, squadra, statistiche
│   ├── components/
│   │   └── A4PaginatedDocument.tsx # Impaginazione e rendering del documento A4 ufficiale
│   ├── utils/
│   │   ├── pdfGenerator.ts        # Motore di rendering e generazione PDF jsPDF
│   │   ├── reportHistoryMemory.ts # Database storico dei 62 report (2025/2026)
│   │   └── standaloneHtmlBuilder.ts # Generatore HTML standalone per archivio
│   └── firebase.ts                # Connessione al database Firestore
└── README.md
```

---

## 📄 Licenza

Riservato ad uso operativo per l'Associazione e Cooperativa **City Angels**.
