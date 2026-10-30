import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { PhotoAttachment, RilevazioneItem, ServiceReportData } from '../types/report';

export interface CloudDraftMetadata {
  report: ServiceReportData;
  updatedAt: number; // Millisecondi Unix epoch per ordinamento temporale certo
  updatedAtIso: string; // Stringa ISO per visualizzazione
  updatedBy: string; // Nome utente o email compilatore
  clientId: string; // Identificativo sessione del dispositivo
  version: number;
}

/**
 * Normalizza e sincronizza in modo rigoroso gli orari di servizio (oraInizio, oraFine, orariServizio)
 * evitando che una mancata corrispondenza tra slot e campi legacy cancelli o nasconda gli orari.
 */
export function normalizeReportOrari(rep: ServiceReportData): ServiceReportData {
  if (!rep) return rep;
  const next: ServiceReportData = JSON.parse(JSON.stringify(rep));
  const rawIni = (next.oraInizio || '').trim();
  const rawFine = (next.oraFine || '').trim();
  const rawDesc = (next.orarioTestoLibero || '').trim();

  if (!Array.isArray(next.orariServizio) || next.orariServizio.length === 0) {
    next.orariServizio = [
      {
        id: 'slot-1',
        oraInizio: rawIni,
        oraFine: rawFine,
        descrizione: rawDesc,
      },
    ];
  } else {
    const slots = next.orariServizio.map((s, idx) => {
      const sCopy = { ...s };
      if (idx === 0) {
        if (!sCopy.oraInizio?.trim() && rawIni) {
          sCopy.oraInizio = rawIni;
        }
        if (!sCopy.oraFine?.trim() && rawFine) {
          sCopy.oraFine = rawFine;
        }
      }
      return sCopy;
    });

    const firstSlot = slots[0];
    const lastSlot = slots[slots.length - 1];

    next.orariServizio = slots;
    if (!next.oraInizio && firstSlot?.oraInizio) {
      next.oraInizio = firstSlot.oraInizio;
    }
    if (!next.oraFine && (lastSlot?.oraFine || firstSlot?.oraFine)) {
      next.oraFine = lastSlot?.oraFine || firstSlot?.oraFine || '';
    }
  }

  return next;
}

/**
 * Seleziona il testo più completo e significativo tra due versioni dello stesso campo:
 * - Se uno è popolato e l'altro è vuoto o solo spazi bianchi, mantiene SEMPRE quello popolato (nessuna cancellazione accidentale).
 * - Se entrambi contengono testo, mantiene la versione con più caratteri/informazioni (chi sta attivamente digitando o integrando).
 */
export function pickBetterText(currentText?: string, incomingText?: string): string {
  const c = (currentText || '').trim();
  const i = (incomingText || '').trim();
  if (c && !i) return currentText || '';
  if (!c && i) return incomingText || '';
  if (!c && !i) return '';
  if (c.length >= i.length) {
    return currentText || '';
  }
  return incomingText || '';
}

/**
 * Verifica se un punto di rilevazione è completamente vuoto (nessun dato utile inserito)
 */
export function isRilevazioneEmpty(r: RilevazioneItem | undefined | null): boolean {
  if (!r) return true;
  const hasLoc = Boolean(r.luogoIndividuazione?.trim() || r.areaTerminal?.trim());
  const hasDesc = Boolean(r.descrizione?.trim());
  const hasUsers = Number(r.numeroUtenti) > 0;
  const hasNames = Array.isArray(r.nominativiAssociati) && r.nominativiAssociati.some((n) => n && n.trim());
  const hasOps = Array.isArray(r.operatoriCoinvolti) && r.operatoriCoinvolti.some((o) => o && o.trim());
  const hasPhotos = Array.isArray(r.foto) && r.foto.length > 0;
  return !hasLoc && !hasDesc && !hasUsers && !hasNames && !hasOps && !hasPhotos;
}

/**
 * Pulisce la lista delle rilevazioni rimuovendo le voci vuote duplicate.
 * Se ci sono voci compilate, restituisce solo quelle compilate.
 * Se tutte le voci sono vuote, restituisce un singolo punto vuoto standard.
 */
export function sanitizeRilevazioniList(list: RilevazioneItem[] = []): RilevazioneItem[] {
  if (!Array.isArray(list) || list.length === 0) {
    return [
      {
        id: 'ril-1',
        luogoIndividuazione: '',
        descrizione: '',
        numeroUtenti: 0,
        aggancioEffettuato: false,
        nominativiAssociati: [],
        operatoriCoinvolti: [],
        foto: [],
      },
    ];
  }

  const populated: RilevazioneItem[] = [];
  for (const item of list) {
    if (item && item.id && !isRilevazioneEmpty(item)) {
      populated.push(item);
    }
  }

  if (populated.length > 0) {
    return populated;
  }

  const first = list[0];
  return [
    first && first.id
      ? first
      : {
          id: 'ril-1',
          luogoIndividuazione: '',
          descrizione: '',
          numeroUtenti: 0,
          aggancioEffettuato: false,
          nominativiAssociati: [],
          operatoriCoinvolti: [],
          foto: [],
        },
  ];
}

/**
 * Unisce in modo collaborativo la lista delle rilevazioni:
 * - Abbina gli elementi per ID univoco (es. 'ril-1', 'ril-...').
 * - Preserva le descrizioni e i luoghi usando pickBetterText senza mai cancellare il testo digitato.
 * - Esegue l'unione senza duplicati di nominativi associati, operatori coinvolti e allegati fotografici.
 * - Non accumula MAI slot vuoti o fantasmi.
 */
export function mergeRilevazioni(
  currentList: RilevazioneItem[] = [],
  incomingList: RilevazioneItem[] = []
): RilevazioneItem[] {
  const cleanIncoming = (incomingList || []).filter((item) => item && item.id);
  const cleanCurrent = (currentList || []).filter((item) => item && item.id);

  if (cleanIncoming.length === 0) {
    return sanitizeRilevazioniList(cleanCurrent);
  }
  if (cleanCurrent.length === 0) {
    return sanitizeRilevazioniList(cleanIncoming);
  }

  const incomingMap = new Map<string, RilevazioneItem>();
  cleanIncoming.forEach((item) => {
    incomingMap.set(item.id, item);
  });

  const mergedItems: RilevazioneItem[] = [];
  const processedIncomingIds = new Set<string>();

  // Itera sulle rilevazioni locali correnti
  cleanCurrent.forEach((cItem) => {
    const inItem = incomingMap.get(cItem.id);
    if (!inItem) {
      // Se è presente solo localmente, mantienila SOLO se non è completamente vuota
      if (!isRilevazioneEmpty(cItem)) {
        mergedItems.push(cItem);
      }
    } else {
      processedIncomingIds.add(cItem.id);
      const mergedDesc = pickBetterText(cItem.descrizione, inItem.descrizione);
      const mergedLuogo = pickBetterText(cItem.luogoIndividuazione, inItem.luogoIndividuazione);
      const mergedArea = pickBetterText(cItem.areaTerminal, inItem.areaTerminal);

      const numUsers = Math.max(
        Number(cItem.numeroUtenti) || 0,
        Number(inItem.numeroUtenti) || 0
      );
      const aggancio = Boolean(cItem.aggancioEffettuato || inItem.aggancioEffettuato);

      // Unione univoca nominativi
      const namesSet = new Set<string>();
      (cItem.nominativiAssociati || []).forEach((n) => n && namesSet.add(n.trim()));
      (inItem.nominativiAssociati || []).forEach((n) => n && namesSet.add(n.trim()));

      // Unione univoca operatori coinvolti
      const opsSet = new Set<string>();
      (cItem.operatoriCoinvolti || []).forEach((o) => o && opsSet.add(o.trim()));
      (inItem.operatoriCoinvolti || []).forEach((o) => o && opsSet.add(o.trim()));

      // Unione foto (per ID o dataUrl)
      const photoMap = new Map<string, PhotoAttachment>();
      (inItem.foto || []).forEach((f) => {
        if (f) photoMap.set(f.id || f.dataUrl, f);
      });
      (cItem.foto || []).forEach((f) => {
        if (f) photoMap.set(f.id || f.dataUrl, f);
      });

      const mergedItem: RilevazioneItem = {
        id: cItem.id,
        luogoIndividuazione: mergedLuogo,
        areaTerminal: mergedArea || undefined,
        descrizione: mergedDesc,
        numeroUtenti: numUsers,
        aggancioEffettuato: aggancio,
        nominativiAssociati: Array.from(namesSet),
        operatoriCoinvolti: Array.from(opsSet),
        foto: Array.from(photoMap.values()),
      };

      mergedItems.push(mergedItem);
    }
  });

  // Aggiungi rilevazioni presenti in incoming che non erano presenti in current, MA SOLO SE NON VUOTE!
  cleanIncoming.forEach((inItem) => {
    if (!processedIncomingIds.has(inItem.id)) {
      if (!isRilevazioneEmpty(inItem)) {
        mergedItems.push(inItem);
      }
    }
  });

  return sanitizeRilevazioniList(mergedItems);
}

/**
 * Unisce in modo sicuro due versioni del report bozza:
 * - Se i due report hanno numeri diversi (es. passaggio dal report 37 al nuovo report 38):
 *   i dati del vecchio report NON vengono mai riversati nel nuovo! Prevale il nuovo report pulito.
 * - Se i due report hanno lo stesso numero (es. entrambi su Report 38):
 *   impedisce rigorosamente che una scheda con campi vuoti o parziali cancelli descrizioni,
 *   note, luoghi, orari o rilevazioni già scritte.
 */
export function safeMergeReport(
  current: ServiceReportData,
  incoming: ServiceReportData
): ServiceReportData {
  if (!incoming) return current;
  if (!current) return normalizeReportOrari(incoming);

  const currentNum = Number(current.numeroReport) || 0;
  const incomingNum = Number(incoming.numeroReport) || 0;

  // CASO 1: Numero di report differente (creazione nuovo turno/report successivo)
  if (incomingNum !== currentNum) {
    if (incomingNum > currentNum) {
      return normalizeReportOrari(incoming);
    } else {
      return normalizeReportOrari(current);
    }
  }

  // CASO 2: Stesso numero di report (modifica collaborativa in tempo reale)
  const merged: ServiceReportData = JSON.parse(JSON.stringify(incoming));

  // Protezione orari di servizio
  const currentHasOrari = Boolean(
    current.oraInizio?.trim() ||
    current.oraFine?.trim() ||
    current.orariServizio?.some((s) => s.oraInizio?.trim() || s.oraFine?.trim())
  );
  const incomingHasOrari = Boolean(
    incoming.oraInizio?.trim() ||
    incoming.oraFine?.trim() ||
    incoming.orariServizio?.some((s) => s.oraInizio?.trim() || s.oraFine?.trim())
  );

  if (currentHasOrari && !incomingHasOrari) {
    merged.oraInizio = current.oraInizio;
    merged.oraFine = current.oraFine;
    merged.orarioTestoLibero = current.orarioTestoLibero;
    merged.orariServizio = current.orariServizio;
  } else if (currentHasOrari && incomingHasOrari) {
    if (Array.isArray(current.orariServizio) && Array.isArray(incoming.orariServizio)) {
      merged.orariServizio = incoming.orariServizio.map((inSlot, idx) => {
        const curSlot = current.orariServizio?.[idx];
        if (!curSlot) return inSlot;
        return {
          id: inSlot.id || curSlot.id || `slot-${idx + 1}`,
          oraInizio: pickBetterText(curSlot.oraInizio, inSlot.oraInizio),
          oraFine: pickBetterText(curSlot.oraFine, inSlot.oraFine),
          descrizione: pickBetterText(curSlot.descrizione, inSlot.descrizione),
        };
      });
    }
    merged.oraInizio = pickBetterText(current.oraInizio, incoming.oraInizio);
    merged.oraFine = pickBetterText(current.oraFine, incoming.oraFine);
    merged.orarioTestoLibero = pickBetterText(current.orarioTestoLibero, incoming.orarioTestoLibero);
  }

  // Protezione data del servizio: la modifica attiva del compilatore locale ha priorità
  merged.data = current.data?.trim() || incoming.data?.trim() || '';

  // Protezione caposervizio e compilatore
  // CRITICO: Non usare MAI pickBetterText su nomi/compilatore, altrimenti
  // 'Chiara Menegotto' (16 car.) vince sempre su 'Andrea Menegotto' (15 car.) per lunghezza caratteri!
  if (current.compilatore && current.compilatore.trim() && current.compilatore.trim().toLowerCase() !== 'compilatore') {
    merged.compilatore = current.compilatore.trim();
  } else if (incoming.compilatore && incoming.compilatore.trim() && incoming.compilatore.trim().toLowerCase() !== 'compilatore') {
    merged.compilatore = incoming.compilatore.trim();
  } else {
    merged.compilatore = '';
  }

  if (current.caposervizio && current.caposervizio.trim() && current.caposervizio.trim().toLowerCase() !== 'caposervizio') {
    merged.caposervizio = current.caposervizio.trim();
  } else if (incoming.caposervizio && incoming.caposervizio.trim() && incoming.caposervizio.trim().toLowerCase() !== 'caposervizio') {
    merged.caposervizio = incoming.caposervizio.trim();
  } else {
    merged.caposervizio = '';
  }

  merged.firmaImmagineUrl = current.firmaImmagineUrl || incoming.firmaImmagineUrl || '';

  // Protezione aperture sbarra inizio
  if (Array.isArray(current.apertureSbarraInizio) && Array.isArray(incoming.apertureSbarraInizio)) {
    merged.apertureSbarraInizio = [
      {
        ora: pickBetterText(current.apertureSbarraInizio[0]?.ora, incoming.apertureSbarraInizio[0]?.ora),
        targa: pickBetterText(current.apertureSbarraInizio[0]?.targa, incoming.apertureSbarraInizio[0]?.targa),
      },
      {
        ora: pickBetterText(current.apertureSbarraInizio[1]?.ora, incoming.apertureSbarraInizio[1]?.ora),
        targa: pickBetterText(current.apertureSbarraInizio[1]?.targa, incoming.apertureSbarraInizio[1]?.targa),
      },
    ];
  } else if (Array.isArray(current.apertureSbarraInizio)) {
    merged.apertureSbarraInizio = current.apertureSbarraInizio;
  }

  // Protezione comunicazioni e testo termine
  merged.comunicazioneInizioCO = pickBetterText(current.comunicazioneInizioCO, incoming.comunicazioneInizioCO);
  merged.comunicazioneFineCO = pickBetterText(current.comunicazioneFineCO, incoming.comunicazioneFineCO);
  merged.luogoTermineFisso = pickBetterText(current.luogoTermineFisso, incoming.luogoTermineFisso);

  // Protezione personale esterno / affiancamento
  merged.personaleEsternoAffiancamento = pickBetterText(
    current.personaleEsternoAffiancamento,
    incoming.personaleEsternoAffiancamento
  );

  // Protezione e unione delle Rilevazioni (descrizioni, luoghi, conteggi, foto)
  merged.rilevazioni = mergeRilevazioni(current.rilevazioni, incoming.rilevazioni);

  // Protezione richieste emergenza, richieste non urgenti, note e osservazioni
  merged.richiesteEmergenzaCOPS = pickBetterText(current.richiesteEmergenzaCOPS, incoming.richiesteEmergenzaCOPS);
  merged.richiesteEmergenzaCOSEA = pickBetterText(current.richiesteEmergenzaCOSEA, incoming.richiesteEmergenzaCOSEA);
  merged.richiesteEmergenzaProntoSoccorsoMXP = pickBetterText(
    current.richiesteEmergenzaProntoSoccorsoMXP,
    incoming.richiesteEmergenzaProntoSoccorsoMXP
  );
  merged.richiesteEmergenza = pickBetterText(current.richiesteEmergenza, incoming.richiesteEmergenza);
  merged.richiesteNonUrgenti = pickBetterText(current.richiesteNonUrgenti, incoming.richiesteNonUrgenti);
  merged.note = pickBetterText(current.note, incoming.note);
  merged.osservazioni = pickBetterText(current.osservazioni, incoming.osservazioni);

  // Protezione squadra: unisci i membri garantendo che la designazione del compilatore sia univoca ed esatta
  if (Array.isArray(incoming.squadra) && incoming.squadra.length > 0) {
    const currentSquadraMap = new Map<string, any>();
    (current.squadra || []).forEach((m) => {
      if (m?.nomeCognome) currentSquadraMap.set(m.nomeCognome.trim().toLowerCase(), m);
    });

    const activeCompName = (merged.compilatore || '').trim().toLowerCase();
    const activeCapoName = (merged.caposervizio || '').trim().toLowerCase();

    const mergedSquadra: any[] = incoming.squadra.map((inM) => {
      const curM = currentSquadraMap.get(inM.nomeCognome.trim().toLowerCase());
      const mName = (inM.nomeCognome || '').trim().toLowerCase();

      // Risolvi stato compilatore in modo univoco
      let isComp = false;
      if (activeCompName) {
        isComp = mName === activeCompName;
      } else {
        isComp = curM ? Boolean(curM.isCompilatore) : Boolean(inM.isCompilatore);
      }

      // Risolvi stato caposervizio
      let isCapo = false;
      if (activeCapoName) {
        isCapo = mName === activeCapoName;
      } else {
        isCapo = curM ? Boolean(curM.isCaposervizio) : Boolean(inM.isCaposervizio);
      }

      const isPres = Boolean((curM?.isPresente ?? inM.isPresente) || isComp || isCapo);

      if (!curM) {
        return {
          ...inM,
          isCompilatore: isComp,
          isCaposervizio: isCapo,
          isPresente: isPres,
        };
      }

      return {
        ...inM,
        orarioServizio: pickBetterText(curM.orarioServizio, inM.orarioServizio),
        note: pickBetterText(curM.note, inM.note),
        qualifica: inM.qualifica || curM.qualifica,
        isCaposervizio: isCapo,
        isCompilatore: isComp,
        isPresente: isPres,
      };
    });

    // Mantieni eventuali membri presenti in current non presenti in incoming
    (current.squadra || []).forEach((curM) => {
      if (
        curM?.nomeCognome &&
        !incoming.squadra.some(
          (m) => m?.nomeCognome?.trim().toLowerCase() === curM.nomeCognome.trim().toLowerCase()
        )
      ) {
        mergedSquadra.push(curM);
      }
    });

    merged.squadra = mergedSquadra;
  } else if (Array.isArray(current.squadra)) {
    merged.squadra = current.squadra;
  }

  return normalizeReportOrari(merged);
}

let inMemoryClientId = '';

// Genera un ID univoco e stabile per la specifica sessione / finestra aperta
export function getOrCreateClientId(): string {
  if (inMemoryClientId) return inMemoryClientId;
  try {
    let id = sessionStorage.getItem('ca_session_client_id');
    if (!id) {
      id = 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      try {
        sessionStorage.setItem('ca_session_client_id', id);
      } catch {
        // ignore
      }
    }
    inMemoryClientId = id;
    return id;
  } catch {
    inMemoryClientId = 'tab_mem_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    return inMemoryClientId;
  }
}

const DRAFT_COLLECTION = 'active_draft_reports';
const DRAFT_DOC_ID = 'current';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingResolvers: Array<() => void> = [];
let latestPendingReport: ServiceReportData | null = null;
let latestPendingUserLabel = '';

/**
 * Salva la bozza in corso su Cloud Firestore con debounce (per non sovraccaricare la rete mentre si digita).
 * I dati vengono sincronizzati istantaneamente con tutti gli altri PC e smartphone Android collegati.
 */
export function pushDraftToCloudDebounced(
  report: ServiceReportData,
  userLabel: string,
  delayMs = 600
): Promise<void> {
  latestPendingReport = report;
  latestPendingUserLabel = userLabel;

  return new Promise((resolve) => {
    pendingResolvers.push(resolve);

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      try {
        if (latestPendingReport) {
          await pushDraftToCloudImmediate(latestPendingReport, latestPendingUserLabel);
        }
      } catch (err) {
        console.warn('Errore sincronizzazione bozza su Cloud Firestore:', err);
      } finally {
        const resolvers = [...pendingResolvers];
        pendingResolvers = [];
        debounceTimer = null;
        resolvers.forEach((r) => r());
      }
    }, delayMs);
  });
}

/**
 * Forza il salvataggio immediato di eventuali modifiche ancora in coda (es. cambio tab o chiusura su smartphone).
 */
export async function flushPendingDraftToCloud(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (latestPendingReport) {
    const rep = latestPendingReport;
    const label = latestPendingUserLabel;
    latestPendingReport = null;
    try {
      await pushDraftToCloudImmediate(rep, label);
    } catch {
      // ignore
    } finally {
      const resolvers = [...pendingResolvers];
      pendingResolvers = [];
      resolvers.forEach((r) => r());
    }
  }
}

/**
 * Salvataggio immediato forzato della bozza su Cloud Firestore.
 * Pulisce i dati da valori undefined per non incorrere in rifiuti di Firestore.
 */
export async function pushDraftToCloudImmediate(
  report: ServiceReportData,
  userLabel: string
): Promise<CloudDraftMetadata> {
  const clientId = getOrCreateClientId();
  const now = Date.now();

  // Normalizza gli orari e pulizia profonda per garantire che nessun campo undefined blocchi Firestore
  const normalized = normalizeReportOrari(report);
  const cleanReport: ServiceReportData = JSON.parse(JSON.stringify(normalized));
  cleanReport.rilevazioni = sanitizeRilevazioniList(cleanReport.rilevazioni);

  const docRef = doc(db, DRAFT_COLLECTION, DRAFT_DOC_ID);
  const payload: CloudDraftMetadata = {
    report: cleanReport,
    updatedAt: now,
    updatedAtIso: new Date(now).toISOString(),
    updatedBy: userLabel || 'Collaboratore',
    clientId,
    version: now,
  };

  await setDoc(docRef, payload);
  return payload;
}

/**
 * Scarica la bozza corrente direttamente da Cloud Firestore (se presente).
 */
export async function fetchDraftFromCloud(): Promise<CloudDraftMetadata | null> {
  try {
    const docRef = doc(db, DRAFT_COLLECTION, DRAFT_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as any;
      if (data && data.report && typeof data.report.numeroReport !== 'undefined') {
        const updatedAtNum =
          typeof data.updatedAt === 'number'
            ? data.updatedAt
            : data.updatedAt
            ? new Date(data.updatedAt).getTime()
            : 0;
        const rep = normalizeReportOrari(data.report);
        rep.rilevazioni = sanitizeRilevazioniList(rep.rilevazioni);
        return {
          report: rep,
          updatedAt: updatedAtNum,
          updatedAtIso:
            data.updatedAtIso ||
            (typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString()),
          updatedBy: data.updatedBy || 'Collaboratore',
          clientId: data.clientId || '',
          version: typeof data.version === 'number' ? data.version : updatedAtNum,
        };
      }
    }
  } catch (err) {
    console.warn('Impossibile scaricare la bozza da Cloud Firestore:', err);
  }
  return null;
}

/**
 * Ascolta in tempo reale le modifiche alla bozza condivisa su Firestore.
 * Quando qualsiasi utente (es. Chiara da smartphone Android o Andrea da PC) modifica il report,
 * tutti gli altri dispositivi ricevono l'aggiornamento in diretta.
 */
export function subscribeToActiveDraft(
  onRemoteUpdate: (metadata: CloudDraftMetadata) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const docRef = doc(db, DRAFT_COLLECTION, DRAFT_DOC_ID);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data() as any;
        if (!data || !data.report) return;

        const updatedAtNum =
          typeof data.updatedAt === 'number'
            ? data.updatedAt
            : data.updatedAt
            ? new Date(data.updatedAt).getTime()
            : 0;

        const rep = normalizeReportOrari(data.report);
        rep.rilevazioni = sanitizeRilevazioniList(rep.rilevazioni);

        const metadata: CloudDraftMetadata = {
          report: rep,
          updatedAt: updatedAtNum,
          updatedAtIso:
            data.updatedAtIso ||
            (typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString()),
          updatedBy: data.updatedBy || 'Collaboratore',
          clientId: data.clientId || '',
          version: typeof data.version === 'number' ? data.version : updatedAtNum,
        };

        onRemoteUpdate(metadata);
      },
      (err) => {
        console.warn('Errore listener live su active_draft_reports:', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Impossibile agganciare listener Cloud Firestore:', err);
    return () => {};
  }
}
