import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractTextFromPdfBuffer(buf: Buffer): string {
  let fullText = '';
  const str = buf.toString('latin1');

  // Decompress streams (supporting /Filter /FlateDecode)
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(str)) !== null) {
    const streamData = Buffer.from(match[1], 'latin1');
    let decompressed = '';
    try {
      decompressed = zlib.inflateSync(streamData).toString('utf-8');
    } catch {
      try {
        decompressed = zlib.inflateRawSync(streamData).toString('utf-8');
      } catch {
        decompressed = streamData.toString('utf-8');
      }
    }

    if (!decompressed) continue;

    // Extract text from literal string Tj commands: (Hello World) Tj
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = tjRegex.exec(decompressed)) !== null) {
      fullText += m[1] + ' ';
    }

    // Extract text from kerning arrays: [ (Hello) 10 (World) ] TJ
    const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
    while ((m = tjArrayRegex.exec(decompressed)) !== null) {
      const inner = m[1].replace(/(-?\d+)/g, ' ').match(/\(([^)]+)\)/g);
      if (inner) {
        fullText += inner.map((s) => s.slice(1, -1)).join('') + ' ';
      }
    }

    // Extract text from hex string commands: <00410042> Tj
    const tjHexRegex = /<([0-9a-fA-F]+)>\s*Tj/g;
    while ((m = tjHexRegex.exec(decompressed)) !== null) {
      const hex = m[1];
      let decodedStr = '';
      if (hex.length % 4 === 0) {
        for (let i = 0; i < hex.length; i += 4) {
          const code = parseInt(hex.substring(i, i + 4), 16);
          if (code >= 32 && code < 65535) decodedStr += String.fromCharCode(code);
        }
      } else {
        for (let i = 0; i < hex.length; i += 2) {
          const code = parseInt(hex.substring(i, i + 2), 16);
          if (code >= 32) decodedStr += String.fromCharCode(code);
        }
      }
      if (decodedStr) fullText += decodedStr + ' ';
    }
  }

  // Clean text and unescape common PDF escape sequences
  const cleaned = fullText
    .replace(/\\([()\\])/g, '$1')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length > 30) return cleaned;

  // Fallback to printable text fragments from the raw buffer
  const rawCleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ').replace(/\s+/g, ' ');
  const words = rawCleaned.match(/[A-Za-z0-9À-ÿ]{3,}/g) || [];
  return words.slice(0, 3000).join(' ');
}

const isProduction = process.env.NODE_ENV === 'production';
const port = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Initialize Gemini client strictly using @google/genai and User-Agent
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API endpoint to query historical reports and Drive files with Gemini
  app.post('/api/gemini/query-reports', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: "Integrazione non attiva: la chiave GEMINI_API_KEY non è configurata o presente nel file .env del server."
        });
        return;
      }

      const {
        query = '',
        audioData,
        audioMimeType = 'audio/webm',
        reportsData = [],
        driveFiles = [],
        uploadedFiles = [],
        userRegistry = [],
      } = req.body;

      if ((!query || typeof query !== 'string' || !query.trim()) && !audioData) {
        res.status(400).json({ error: 'La query di ricerca o la registrazione vocale è obbligatoria.' });
        return;
      }

      // Build structured context parts for Gemini
      const parts: any[] = [];

      // If direct audio query is provided, attach as multimodal inline data
      if (audioData) {
        parts.push({
          inlineData: {
            mimeType: audioMimeType || 'audio/webm',
            data: audioData,
          },
        });
        parts.push({
          text: "NOTA VOCALE: L'operatore City Angels ha formulato la richiesta a voce tramite la registrazione audio allegata. Ascolta l'audio con attenzione in lingua italiana ed esegui la richiesta o rispondi alla domanda posta.",
        });
      }

      // 1. Text Summary of Structured Reports
      let reportsSummaryText = '=== ARCHIVIO DEI REPORT DI SERVIZIO CITY ANGELS (DATI STRUTTURATI) ===\n\n';

      if (Array.isArray(reportsData) && reportsData.length > 0) {
        reportsData.forEach((rep: any, idx: number) => {
          const r = rep.report || rep;
          const reportNum = r.numeroReport ?? (idx + 1);
          const dateStr = r.data || 'Data non specificata';
          reportsSummaryText += `--- REPORT N. ${reportNum} (Data: ${dateStr}) ---\n`;
          reportsSummaryText += `Luogo: ${r.luogo || 'Aeroporto MXP'}\n`;
          reportsSummaryText += `Orario: dalle ${r.oraInizio || '—'} alle ${r.oraFine || '—'} ${r.orarioTestoLibero || ''}\n`;
          reportsSummaryText += `Caposervizio: ${r.caposervizio || '—'} | Compilatore: ${r.compilatore || '—'}\n`;

          const squad = (r.squadra || [])
            .map((m: any) => `${m.nomeCognome || ''}${m.nickname ? ` ("${m.nickname}")` : ''} [${m.qualifica || ''}]`)
            .filter(Boolean)
            .join(', ');
          reportsSummaryText += `Squadra Operatori: ${squad || 'Non specificata'}\n`;

          if (r.apertureSbarraInizio && Array.isArray(r.apertureSbarraInizio)) {
            const sbarre = r.apertureSbarraInizio
              .filter((b: any) => b && (b.ora || b.targa))
              .map((b: any, sIdx: number) => `Sbarra ${sIdx + 1}: ore ${b.ora || '—'}, targa mezzo: ${b.targa || '—'}`)
              .join('; ');
            if (sbarre) {
              reportsSummaryText += `Accessi mezzi Parcheggio P1: ${sbarre}\n`;
            }
          }

          if (r.personaleEsternoAffiancamento) {
            reportsSummaryText += `Personale Esterno: ${r.personaleEsternoAffiancamento}\n`;
          }

          reportsSummaryText += `Rilevazioni e Interventi effettuati:\n`;
          (r.rilevazioni || []).forEach((ril: any, rIdx: number) => {
            const letter = String.fromCharCode(97 + (rIdx % 26));
            reportsSummaryText += `  • Punto ${letter}: Luogo: "${ril.luogoIndividuazione || ril.areaTerminal || 'Non indicato'}", Utenti: ${ril.numeroUtenti ?? 0}, Aggancio/Colloquio: ${ril.aggancioEffettuato ? 'SÌ' : 'NO'}\n`;
            if (ril.nominativiAssociati && ril.nominativiAssociati.length > 0) {
              reportsSummaryText += `    Nominativi/Soggetti associati: ${ril.nominativiAssociati.join(', ')}\n`;
            }
            if (ril.descrizione) {
              reportsSummaryText += `    Descrizione: ${ril.descrizione}\n`;
            }
          });

          if (r.richiesteEmergenzaCOPS || r.richiesteEmergenzaCOSEA || r.richiesteEmergenza) {
            reportsSummaryText += `Emergenze CO PS: ${r.richiesteEmergenzaCOPS || r.richiesteEmergenza || 'Nessuna'} | CO SEA: ${r.richiesteEmergenzaCOSEA || 'Nessuna'}\n`;
          }
          if (r.richiesteNonUrgenti) {
            reportsSummaryText += `Richieste non urgenti: ${r.richiesteNonUrgenti}\n`;
          }
          if (r.note) reportsSummaryText += `Note: ${r.note}\n`;
          if (r.osservazioni) reportsSummaryText += `Osservazioni: ${r.osservazioni}\n`;
          reportsSummaryText += '\n';
        });
      } else {
        reportsSummaryText += 'Nessun report strutturato presente al momento nello storico locale.\n\n';
      }

      parts.push({ text: reportsSummaryText });

      // 2. Google Drive Files and Uploaded Documents Context (Esclusione rigorosa file DOC/DOCX: solo PDF definitivi)
      const allFiles = [...(driveFiles || []), ...(uploadedFiles || [])].filter((file) => {
        const nameLower = (file.name || '').toLowerCase();
        const isWord =
          nameLower.endsWith('.doc') ||
          nameLower.endsWith('.docx') ||
          file.mimeType === 'application/msword' ||
          file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        return !isWord;
      });

      if (allFiles.length > 0) {
        let filesSummaryText = '=== DOCUMENTI E FILE PRECEDENTI DA GOOGLE DRIVE / ARCHIVIO STORICO (2025, 2026 E SOTTOCARTELLE) ===\n\n';
        let inlineDataBytesCount = 0;
        const maxInlineDataBytes = 12 * 1024 * 1024; // 12 MB safe limit for inline multimodal attachments

        for (const file of allFiles) {
          const folderPrefix = file.folderPath ? `[Sottocartella: ${file.folderPath}] ` : '';
          filesSummaryText += `--- FILE: "${folderPrefix}${file.name}" (Tipo: ${file.mimeType || 'sconosciuto'}) ---\n`;

          let textExtracted = file.textContent || '';

          // If base64Data is present for PDF, decompress and extract full text streams AND attach natively as application/pdf
          if (file.base64Data && (file.mimeType === 'application/pdf' || file.name.endsWith('.pdf'))) {
            const sizeInBytes = file.base64Data.length * 0.75;
            if (inlineDataBytesCount + sizeInBytes < maxInlineDataBytes) {
              parts.push({
                inlineData: {
                  mimeType: 'application/pdf',
                  data: file.base64Data,
                },
              });
              inlineDataBytesCount += sizeInBytes;
              console.log(`Allegato file PDF nativo a Gemini: ${file.name} (${Math.round(sizeInBytes / 1024)} KB)`);
            }

            try {
              const pdfBuf = Buffer.from(file.base64Data, 'base64');
              const decompressed = extractTextFromPdfBuffer(pdfBuf);
              if (decompressed && decompressed.length > textExtracted.length) {
                textExtracted = decompressed;
              }
            } catch (decompErr) {
              console.warn(`Errore decompressione PDF "${file.name}":`, decompErr);
            }
          }

          // If file is JSON structured report, parse it to extract rich report details
          if (
            file.name.endsWith('.json') ||
            file.mimeType === 'application/json' ||
            (textExtracted && textExtracted.trim().startsWith('{'))
          ) {
            try {
              const parsed = JSON.parse(textExtracted);
              const r = parsed.report || parsed;
              if (r && (r.numeroReport !== undefined || r.data || r.rilevazioni)) {
                let jsonReportDesc = `SCHEDA REPORT STRUTTURATO N. ${r.numeroReport ?? '—'} (Data: ${r.data || '—'})\n`;
                jsonReportDesc += `Luogo: ${r.luogo || 'Aeroporto MXP'}\n`;
                jsonReportDesc += `Orario: dalle ${r.oraInizio || '—'} alle ${r.oraFine || '—'} ${r.orarioTestoLibero || ''}\n`;
                jsonReportDesc += `Compilatore: ${r.compilatore || '—'} | Caposervizio: ${r.caposervizio || '—'}\n`;
                if (r.squadra && Array.isArray(r.squadra)) {
                  const sq = r.squadra.map((m: any) => `${m.nomeCognome || ''}${m.nickname ? ` ("${m.nickname}")` : ''}`).filter(Boolean).join(', ');
                  jsonReportDesc += `Squadra Operatori: ${sq || '—'}\n`;
                }
                if (r.apertureSbarraInizio && Array.isArray(r.apertureSbarraInizio)) {
                  const sbarre = r.apertureSbarraInizio.filter((b: any) => b && (b.ora || b.targa)).map((b: any, sIdx: number) => `Sbarra ${sIdx + 1}: ore ${b.ora || '—'}, targa ${b.targa || '—'}`).join('; ');
                  if (sbarre) jsonReportDesc += `Accessi mezzi P1: ${sbarre}\n`;
                }
                if (r.rilevazioni && Array.isArray(r.rilevazioni)) {
                  jsonReportDesc += `Rilevazioni e Interventi:\n`;
                  r.rilevazioni.forEach((ril: any, rIdx: number) => {
                     const l = String.fromCharCode(97 + (rIdx % 26));
                     jsonReportDesc += `  • Punto ${l}: Area: "${ril.luogoIndividuazione || ril.areaTerminal || '—'}", Utenti: ${ril.numeroUtenti ?? 0}, Colloquio: ${ril.aggancioEffettuato ? 'Sì' : 'No'}\n`;
                     if (ril.nominativiAssociati?.length) jsonReportDesc += `    Soggetti/Alias censiti: ${ril.nominativiAssociati.join(', ')}\n`;
                     if (ril.descrizione) jsonReportDesc += `    Descrizione: ${ril.descrizione}\n`;
                  });
                }
                if (r.richiesteEmergenzaCOPS || r.richiesteEmergenzaCOSEA || r.richiesteEmergenza) {
                  jsonReportDesc += `Emergenze CO PS: ${r.richiesteEmergenzaCOPS || r.richiesteEmergenza || 'Nessuna'} | CO SEA: ${r.richiesteEmergenzaCOSEA || 'Nessuna'}\n`;
                }
                if (r.richiesteNonUrgenti) jsonReportDesc += `Richieste non urgenti: ${r.richiesteNonUrgenti}\n`;
                if (r.note) jsonReportDesc += `Note: ${r.note}\n`;
                if (r.osservazioni) jsonReportDesc += `Osservazioni: ${r.osservazioni}\n`;
                textExtracted = jsonReportDesc;
              }
            } catch {
              // keep existing textExtracted
            }
          }

          if (textExtracted) {
            filesSummaryText += `Testo e dati del documento:\n${textExtracted}\n\n`;
          } else if (file.description) {
            filesSummaryText += `Note descrittive: ${file.description}\n\n`;
          }
        }

        parts.push({ text: filesSummaryText });
      }

      // 2.5 User Registry Context
      if (Array.isArray(userRegistry) && userRegistry.length > 0) {
        let registrySummaryText = '=== REGISTRO UFFICIALE DEGLI UTENTI E SOGGETTI MONITORATI (54 NOMINATIVI) ===\n\n';
        userRegistry.forEach((u: any) => {
          registrySummaryText += `- ID: ${u.id} | ${u.nomeCognome}${u.alias ? ` (Alias/Soprannome: "${u.alias}")` : ''} | Sesso: ${u.sesso} | Nazionalità: ${u.nazionalita}\n`;
          registrySummaryText += `  Area Stazionamento Tipica: ${u.areaStazionamento}\n`;
          registrySummaryText += `  Descrizione/Profilo/Note: ${u.descrizione}\n\n`;
        });
        parts.push({ text: registrySummaryText });
      }

      // 3. User Query Prompt
      parts.push({
        text: `DOMANDA DELL'UTENTE / OPERATORE CITY ANGELS:
"${query}"

ISTRUZIONI DI RISPOSTA:
1. Rispondi in lingua italiana in modo chiaro, professionale, ordinato e operativo.
2. Considera come storico TUTTO l'archivio disponibile: i dati correnti, i report strutturati, i documenti storici del 2025, del 2026 e di tutte le sottocartelle di Google Drive esaminate.
3. Se l'utente cerca nominativi, persone vulnerabili o alias: elenca chiaramente chi è stato individuato, quante volte, in quali date/anni (2025 o 2026), presso quali porte o varchi (es. Porta 1, Porta 2, vano CISL, food court) e quali interventi o contatti sono avvenuti.
4. Se l'utente richiede un modello statistico o analisi delle presenze: genera una relazione strutturata con tabelle Markdown contenente:
   - Totale persone censite complessive e media presenze per servizio/turno.
   - Confronto temporale (es. 2025 vs 2026) e trend mensile/stagionale.
   - Mappatura presenze per zona e varco (Porta 1, Porta 2, vano CISL, Food Court, Caroselli, Parcheggi P1).
   - Tasso di aggancio/colloquio su presenze totali e numero di interventi REALI d'emergenza CO PS / CO SEA (escludendo categoricamente le chiamate normali od ordinarie di inizio e termine del servizio).
   - Sintesi delle raccomandazioni operative per l'ottimizzazione del pattugliamento.
5. Se l'utente cerca interventi d'urgenza o chiamate: specifica date, orari, mezzo/targhe, e le richieste REALI a CO PS, CO SEA, 118 o altri enti (escludendo categoricamente le comunicazioni/chiamate ordinarie o normali per l'inizio e il termine del servizio).
6. Cita sempre con precisione i report di riferimento (es. "Report n. 35 del 01/10/2026", "Cartella 2025 - Report 12", ecc.).
7. Se un'informazione specifica non compare nei documenti storici o attuali forniti, segnalalo con chiarezza.`,
      });

      // Combine prompt text parts cleanly
      const textPartsList = parts.filter((p) => p.text).map((p) => p.text);
      const combinedTextPrompt = textPartsList.join('\n\n');
      const hasInlineMedia = parts.some((p) => p.inlineData);

      // Unified content generator helper
      const getGeminiContents = () => {
        return hasInlineMedia ? [{ role: 'user', parts }] : combinedTextPrompt;
      };

      // Call Gemini model with automatic multi-tier fallback (3.8-flash -> flash-latest -> 3.1-flash-lite)
      let response: any;
      const modelConfig = {
        systemInstruction:
          "Sei l'analista operativo e intelligence dei City Angels Coordinamento Provincia di Varese per i presidi aeroportuali a Milano Malpensa (MXP). Il tuo scopo è analizzare l'intero archivio documentale (report attuali, storico 2025, storico 2026, cartelle e sottocartelle di Google Drive, PDF precedenti anche non generati da questa app) per estrarre informazioni chiave: soggetti censiti, situazioni di degrado, emergenze, presenze e continuità operativa.",
      };

      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      // Attempt 1: gemini-3.8-flash
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: getGeminiContents(),
          config: modelConfig,
        });
      } catch (err1: any) {
        console.warn('Errore primario chiamata Gemini (3.8-flash):', err1?.message || err1);
        await delay(500);

        // Attempt 2: gemini-flash-latest with rich multimodal support
        try {
          response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: getGeminiContents(),
            config: modelConfig,
          });
        } catch (err2: any) {
          console.warn('Errore secondario chiamata Gemini (flash-latest):', err2?.message || err2);
          await delay(500);

          // Attempt 3: gemini-3.1-flash-lite
          try {
            response = await ai.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents: getGeminiContents(),
              config: modelConfig,
            });
          } catch (err3: any) {
            console.error('Tutti i tentativi Gemini sono falliti:', err3?.message || err3);
            throw new Error(
              `Il servizio Gemini sta affrontando un picco temporaneo di carico (${err3?.message || 'Server occupato'}). Riprova tra pochi istanti.`
            );
          }
        }
      }

      const replyText = response.text || 'Nessuna risposta generata dal modello.';

      res.json({
        answer: replyText,
        analyzedReportsCount: reportsData.length,
        analyzedFilesCount: allFiles.length,
      });
    } catch (error: any) {
      console.error('Errore API Gemini query-reports:', error);
      res.status(500).json({
        error: error.message || 'Si è verificato un errore durante l’interrogazione con Gemini.',
      });
    }
  });

  // Setup Vite middlewares in development or static serving in production
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`City Angels server attivo sulla porta ${port}`);
  });
}

startServer();
