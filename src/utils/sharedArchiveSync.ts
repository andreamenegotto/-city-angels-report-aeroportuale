import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  HistoricalReportEntry,
  INITIAL_HISTORICAL_REPORTS,
  getReportNormalizedKey,
  mergeReportEntries,
} from './reportHistoryMemory';

const ARCHIVE_COLLECTION = 'app_shared_archive';
const DOC_2025 = 'reports_2025';
const DOC_2026 = 'reports_2026';

export interface SharedArchiveDoc {
  reports: HistoricalReportEntry[];
  updatedAt: number;
  updatedAtIso: string;
  updatedBy: string;
}

/**
 * Pulisce i dati rimuovendo eventuali campi undefined prima della scrittura su Firestore.
 */
function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Salva l'intero archivio storico su Cloud Firestore suddiviso per anno (2025 e 2026),
 * garantendo sincronizzazione istantanea e persistente su tutti i PC e smartphone Android.
 */
export async function pushSharedArchiveToCloud(
  allReports: HistoricalReportEntry[],
  userLabel: string
): Promise<void> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const reports2025 = allReports.filter((e) =>
    getReportNormalizedKey(e).startsWith('2025')
  );

  const reports2026 = allReports.filter(
    (e) => !getReportNormalizedKey(e).startsWith('2025')
  );

  const docRef2025 = doc(db, ARCHIVE_COLLECTION, DOC_2025);
  const docRef2026 = doc(db, ARCHIVE_COLLECTION, DOC_2026);

  const payload2025: SharedArchiveDoc = sanitizeForFirestore({
    reports: reports2025,
    updatedAt: now,
    updatedAtIso: nowIso,
    updatedBy: userLabel || 'Collaboratore',
  });

  const payload2026: SharedArchiveDoc = sanitizeForFirestore({
    reports: reports2026,
    updatedAt: now,
    updatedAtIso: nowIso,
    updatedBy: userLabel || 'Collaboratore',
  });

  await Promise.all([
    setDoc(docRef2025, payload2025),
    setDoc(docRef2026, payload2026),
  ]);
}

/**
 * Scarica l'archivio completo da Cloud Firestore.
 * Se non ancora presente nel cloud, inizializza automaticamente Firestore con i report storici di base (incluso il Report 36 corretto).
 */
export async function fetchSharedArchiveFromCloud(
  userLabel = 'Sistema'
): Promise<HistoricalReportEntry[]> {
  try {
    const docRef2025 = doc(db, ARCHIVE_COLLECTION, DOC_2025);
    const docRef2026 = doc(db, ARCHIVE_COLLECTION, DOC_2026);

    const [snap2025, snap2026] = await Promise.all([
      getDoc(docRef2025),
      getDoc(docRef2026),
    ]);

    const has2025 = snap2025.exists();
    const has2026 = snap2026.exists();

    if (!has2025 && !has2026) {
      // Inizializzazione automatica del cloud con i dati storici certificati
      await pushSharedArchiveToCloud(INITIAL_HISTORICAL_REPORTS, userLabel);
      return INITIAL_HISTORICAL_REPORTS;
    }

    const data2025 = has2025 ? ((snap2025.data() as SharedArchiveDoc)?.reports || []) : [];
    const data2026 = has2026 ? ((snap2026.data() as SharedArchiveDoc)?.reports || []) : [];

    const combined = mergeReportEntries([], [...data2025, ...data2026]);
    return combined.length > 0 ? combined : INITIAL_HISTORICAL_REPORTS;
  } catch (err) {
    console.warn('Errore recupero archivio da Cloud Firestore:', err);
    return INITIAL_HISTORICAL_REPORTS;
  }
}

/**
 * Ascolta in tempo reale le modifiche all'archivio storico su Cloud Firestore.
 * Quando un utente su PC sincronizza Google Drive o archivia un nuovo report,
 * tutti gli smartphone Android e altri dispositivi ricevono l'archivio completo in tempo reale.
 */
export function subscribeToSharedArchive(
  onUpdate: (reports: HistoricalReportEntry[], updatedBy: string, updatedAtIso: string) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const docRef2025 = doc(db, ARCHIVE_COLLECTION, DOC_2025);
    const docRef2026 = doc(db, ARCHIVE_COLLECTION, DOC_2026);

    let cached2025: HistoricalReportEntry[] = INITIAL_HISTORICAL_REPORTS.filter((e) =>
      getReportNormalizedKey(e).startsWith('2025')
    );
    let cached2026: HistoricalReportEntry[] = INITIAL_HISTORICAL_REPORTS.filter(
      (e) => !getReportNormalizedKey(e).startsWith('2025')
    );
    let isInitialized = false;

    const notify = (updatedBy: string, updatedAtIso: string) => {
      const combined = mergeReportEntries([], [...cached2025, ...cached2026]);
      if (combined.length > 0) {
        onUpdate(combined, updatedBy, updatedAtIso);
      }
    };

    const unsub2025 = onSnapshot(
      docRef2025,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SharedArchiveDoc;
          cached2025 = data.reports || [];
          isInitialized = true;
          notify(data.updatedBy, data.updatedAtIso);
        }
      },
      (err) => {
        console.warn('Errore listener archivio 2025 Firestore:', err);
        if (onError) onError(err);
      }
    );

    const unsub2026 = onSnapshot(
      docRef2026,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SharedArchiveDoc;
          cached2026 = data.reports || [];
          isInitialized = true;
          notify(data.updatedBy, data.updatedAtIso);
        }
      },
      (err) => {
        console.warn('Errore listener archivio 2026 Firestore:', err);
        if (onError) onError(err);
      }
    );

    return () => {
      unsub2025();
      unsub2026();
    };
  } catch (err) {
    console.warn('Impossibile agganciare listener archivio Firestore:', err);
    return () => {};
  }
}
