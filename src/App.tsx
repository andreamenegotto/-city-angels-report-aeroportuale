import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, addDoc, deleteDoc, doc, getDocs, query, where, setDoc } from 'firebase/firestore';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Camera,
  Car,
  Check,
  Clock,
  CloudUpload,
  Copy,
  AlertCircle,
  CheckCircle2,
  CloudDownload,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FilePlus2,
  FolderOpen,
  FolderSync,
  History,
  Laptop,
  MapPin,
  Minus,
  PenTool,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  Share2,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  CorporateHeaderConfig,
  DEFAULT_ASSOCIAZIONE_CONFIG,
  DEFAULT_COOPERATIVA_CONFIG,
  DEFAULT_CORPORATE_CONFIG,
  DEFAULT_ROSTER,
  DEFAULT_SAVED_PLATES,
  DEFAULT_SAVED_SIGNATURES,
  EMPTY_REPORT_DATA,
  LUOGHI_INDIVIDUAZIONE_PREDEFINITI,
  OPZIONI_DETTAGLIO_ORARIO,
  PhotoAttachment,
  QUALIFICHE_PREDEFINITE,
  RilevazioneItem,
  RosterMember,
  SAMPLE_REPORT_DATA,
  SavedLicensePlate,
  SavedSignature,
  ServiceReportData,
  ServiceTimeSlot,
  TESTO_FISSO_LUOGO,
  TESTO_FISSO_LUOGO_INIZIO_BASE,
  TESTO_FISSO_LUOGO_TERMINE,
  TESTO_FISSO_RIFERIMENTI_EMERGENZE,
  TeamMember,
  alignSquadraToRosterOrder,
  formatDateIT,
  indexToAlpha,
} from './types/report';
import { CityAngelsLogo } from './components/CityAngelsLogo';
import { A4PaginatedDocument } from './components/A4PaginatedDocument';
import { ComboInputWithArrow } from './components/ComboInputWithArrow';
import { SearchableLocationInput } from './components/SearchableLocationInput';
import { SearchableUserPicker } from './components/SearchableUserPicker';
import { CompilationQuickSearchToolbar } from './components/CompilationQuickSearchToolbar';
import { GoogleDriveArchivePanel } from './components/GoogleDriveArchivePanel';
import { GeminiReportsQueryPanel } from './components/GeminiReportsQueryPanel';
import { StatisticsPanel } from './components/StatisticsPanel';
import {
  DriveFileMetadata,
  archiveReportToSharedDriveFolder,
  deleteDriveFile,
  deleteReportFilesFromDrive,
  DEFAULT_SHARED_DRIVE_FOLDER_ID,
  DEFAULT_SHARED_DRIVE_FOLDER_URL,
  ensureDriveConnection,
  extractDriveFolderId,
  getAccessToken,
  getDirectDriveFileUrl,
  getDirectDriveDownloadUrl,
  getStoredDriveFolderUrl,
  googleSignIn,
  initAuth,
  logoutGoogle,
  loadHistoricalReportsFromDriveFolder,
  subscribeToDriveFolderUrl,
} from './utils/googleDriveService';
import {
  parseUploadedReportFile,
} from './utils/pdfArchiveParser';
import {
  HistoricalReportEntry,
  INITIAL_HISTORICAL_REPORTS,
  buildMemoryIndex,
  deduplicateHistoricalReports,
  extractTaggedSubjectsFromText,
  getCanonicalReport36,
  getReportNormalizedKey,
  getSaracinoAffiancamentoForReport,
  mergeReportEntries,
  parseReportFile,
  sanitizeReportCompilatore,
} from './utils/reportHistoryMemory';
import {
  generateAndDownloadReportPdf,
  generateReportPdfBlob,
  generateStatisticsPdf,
} from './utils/pdfGenerator';
import {
  subscribeToActiveDraft,
  pushDraftToCloudDebounced,
  pushDraftToCloudImmediate,
  flushPendingDraftToCloud,
  fetchDraftFromCloud,
  CloudDraftMetadata,
  normalizeReportOrari,
  safeMergeReport,
  sanitizeRilevazioniList,
  getOrCreateClientId,
} from './utils/realtimeReportSync';
import {
  fetchSharedArchiveFromCloud,
  pushSharedArchiveToCloud,
  subscribeToSharedArchive,
} from './utils/sharedArchiveSync';
import { USER_REGISTRY, KNOWN_LOCATIONS, formatUserRegistryName } from './utils/userRegistryData';
import { UserRegistryPanel } from './components/UserRegistryPanel';

type ActiveTab = 'form' | 'preview' | 'gemini' | 'registry' | 'drive' | 'stats' | 'corporate' | 'history';

const STORAGE_KEY_REPORT = 'city_angels_airport_report_v6';
const STORAGE_KEY_CORP = 'city_angels_corporate_config_v3';
const STORAGE_KEY_ROSTER = 'city_angels_roster_v4';
const STORAGE_KEY_HISTORY = 'city_angels_history_reports_v4';
const STORAGE_KEY_CUSTOM_SUBJECTS = 'city_angels_custom_subjects_v2';
const STORAGE_KEY_SAVED_PLATES = 'city_angels_saved_license_plates_v2';
const STORAGE_KEY_SAVED_SIGNATURES = 'city_angels_saved_signatures_v2';
const STORAGE_KEY_AUTO_MATCH_SIG = 'city_angels_auto_match_signatures_v1';

/**
 * Optimizes an uploaded signature file with crisp dimensions and transparency
 */
function processSignatureImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 700;
        const maxH = 240;
        let w = img.width;
        let h = img.height;
        const scale = Math.min(maxW / w, maxH / h, 1);
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png', 0.95));
        } else {
          resolve(result);
        }
      };
      img.onerror = () => resolve(result);
      img.src = result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Optimizes an uploaded logo file preserving pristine high resolution for A4 print and PDF
 */
function processLogoImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // If file is already reasonably sized, preserve original byte-for-byte data URL for maximum sharpness
        if (file.size <= 3 * 1024 * 1024 && img.width <= 2400 && img.height <= 2400) {
          resolve(result);
          return;
        }
        const canvas = document.createElement('canvas');
        const maxDim = 1800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.98));
        } else {
          resolve(result);
        }
      };
      img.onerror = () => resolve(result);
      img.src = result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Formatta in italiano naturale giorno e orario per la sincronizzazione cloud (es. "oggi alle 01:35:45" o "il 30 ott 2026 alle 01:35:45")
 */
function formatSyncTimestamp(at: string | number | undefined): string {
  if (!at) return '';
  const dateObj = typeof at === 'number' ? new Date(at) : new Date(at);
  if (isNaN(dateObj.getTime())) return '';

  const now = new Date();
  const isToday =
    dateObj.getDate() === now.getDate() &&
    dateObj.getMonth() === now.getMonth() &&
    dateObj.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    dateObj.getDate() === yesterday.getDate() &&
    dateObj.getMonth() === yesterday.getMonth() &&
    dateObj.getFullYear() === yesterday.getFullYear();

  const timeStr = dateObj.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  if (isToday) {
    return `oggi alle ${timeStr}`;
  }
  if (isYesterday) {
    return `ieri alle ${timeStr}`;
  }

  const dateStr = dateObj.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `il ${dateStr} alle ${timeStr}`;
}

export const OFFICIAL_COMPILERS = [
  { name: 'Andrea Menegotto', nickname: 'Tiger', role: 'Coordinatore CA Prov. Varese' },
  { name: 'Chiara Menegotto', nickname: 'Mene', role: 'Resp. Operativo Prov. Varese' },
];

export const isOfficialCompiler = (name?: string): boolean => {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return n === 'andrea menegotto' || n === 'chiara menegotto';
};

export const KNOWN_OPERATORS = [
  { name: 'Andrea Menegotto', nickname: 'Tiger', role: 'Coordinatore CA Prov. Varese' },
  { name: 'Chiara Menegotto', nickname: 'Mene', role: 'Resp. Operativo Prov. Varese' },
];

/**
 * Ricava con precisione il nominativo reale del compilatore o autore registrato,
 * evitando rigorosamente l'uso del testo generico "Compilatore" o fallback arbitrari.
 */
function resolveAuthorName(
  report: ServiceReportData,
  driveUser: any,
  roster: RosterMember[] = [],
  activeOperator?: string
): string {
  // 1. Operatore attivo selezionato esplicitamente per questo dispositivo
  const storedOperator = (activeOperator || '').trim() || (() => {
    try {
      return localStorage.getItem('ca_active_operator_identity')?.trim() || '';
    } catch {
      return '';
    }
  })();
  if (storedOperator) {
    return storedOperator;
  }

  // 2. Controllo account Google autenticato (email o profilo)
  if (driveUser) {
    const email = (driveUser.email || '').toLowerCase().trim();
    if (email === 'am@andreamenegotto.it' || email.includes('andreamenegotto')) {
      return 'Andrea Menegotto';
    }
    if (email.includes('chiaramenegotto')) {
      return 'Chiara Menegotto';
    }
    if (email.includes('chiarapozzi')) {
      return 'Chiara Pozzi';
    }
    if (driveUser.displayName && driveUser.displayName.trim()) {
      return driveUser.displayName.trim();
    }
  }

  // 3. Compilatore designato nel report (se valorizzato e diverso da diciture generiche)
  if (
    report?.compilatore &&
    report.compilatore.trim() &&
    report.compilatore.trim().toLowerCase() !== 'compilatore'
  ) {
    return report.compilatore.trim();
  }

  // 4. Volontario contrassegnato come compilatore nella squadra attiva
  const teamComp = report?.squadra?.find((m) => m.isCompilatore && m.nomeCognome?.trim())?.nomeCognome?.trim();
  if (teamComp) return teamComp;

  // 5. Compilatore attivo dal registro presenze / anagrafica
  const rosterComp = roster.find((r) => r.isCompilatore && r.nomeCognome?.trim())?.nomeCognome?.trim();
  if (rosterComp) return rosterComp;

  // 6. Caposervizio del report
  if (
    report?.caposervizio &&
    report.caposervizio.trim() &&
    report.caposervizio.trim().toLowerCase() !== 'caposervizio'
  ) {
    return report.caposervizio.trim();
  }
  const teamCapo = report?.squadra?.find((m) => m.isCaposervizio && m.nomeCognome?.trim())?.nomeCognome?.trim();
  if (teamCapo) return teamCapo;

  // 7. Primo membro registrato nella squadra
  const firstMember = report?.squadra?.find((m) => m.nomeCognome?.trim())?.nomeCognome?.trim();
  if (firstMember) return firstMember;

  // 8. Eventuale email Google generica
  if (driveUser?.email && driveUser.email.trim()) {
    return driveUser.email.trim();
  }

  // 9. Predefinito sovrano dell'account di servizio (Andrea Menegotto)
  return 'Andrea Menegotto';
}

/**
 * Optimizes an uploaded surveillance/intervention photo for fast rendering
 */
function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        } else {
          resolve(result);
        }
      };
      img.onerror = () => resolve(result);
      img.src = result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Recupera e ricostruisce in modo resiliente le firme dei compilatori ufficiali
 * (Andrea Menegotto e Chiara Menegotto) scansionando tutte le chiavi
 * di archivio locali (versioni precedenti di firme e report) e garantendo i 2 compilatori ufficiali.
 */
function recoverSavedSignatures(): SavedSignature[] {
  const compilerKeys = ['Andrea Menegotto', 'Chiara Menegotto'];
  const map = new Map<string, SavedSignature>();

  // 1. Inizializza con le firme predefinite di sistema
  DEFAULT_SAVED_SIGNATURES.forEach((sig) => {
    map.set(sig.nomeOperatore.trim().toLowerCase(), { ...sig });
  });

  // 2. Scansiona tutte le chiavi di memoria locale dove possono risiedere firme salvate dall'utente
  const candidateKeys = [
    STORAGE_KEY_SAVED_SIGNATURES,
    'city_angels_saved_signatures_v2',
    'city_angels_saved_signatures_v1',
    'city_angels_saved_signatures',
    'city_angels_signatures_v2',
    'city_angels_signatures_v1',
    'city_angels_signatures',
    'signatures',
  ];

  for (const k of candidateKeys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((item: any) => {
          if (item && item.nomeOperatore && item.immagineUrl) {
            const op = item.nomeOperatore.trim();
            const matchedCompiler = compilerKeys.find(
              (c) => c.toLowerCase() === op.toLowerCase() || op.toLowerCase().includes(c.toLowerCase())
            );
            if (matchedCompiler) {
              const existing = map.get(matchedCompiler.toLowerCase());
              const isRealImage =
                typeof item.immagineUrl === 'string' &&
                item.immagineUrl.startsWith('data:image/') &&
                !item.immagineUrl.includes('<svg');
              if (isRealImage || !existing) {
                map.set(matchedCompiler.toLowerCase(), {
                  id: item.id || existing?.id || `sig-${Date.now()}`,
                  nomeOperatore: matchedCompiler,
                  label: item.label || `Firma Scansionata - ${matchedCompiler}`,
                  immagineUrl: item.immagineUrl,
                  isDefault: existing?.isDefault ?? false,
                });
              }
            }
          }
        });
      }
    } catch {
      // ignore
    }
  }

  // 3. Scansiona anche i report salvati in bozza (spesso contengono la firma effettivamente applicata)
  const reportKeys = [
    STORAGE_KEY_REPORT,
    'city_angels_airport_report_v6',
    'city_angels_airport_report_v5',
    'city_angels_airport_report_v4',
    'city_angels_airport_report_v3',
    'city_angels_airport_report_v2',
    'city_angels_airport_report_v1',
    'city_angels_airport_report',
  ];
  for (const rk of reportKeys) {
    try {
      const raw = localStorage.getItem(rk);
      if (!raw) continue;
      const r = JSON.parse(raw);
      if (r && r.compilatore && r.firmaImmagineUrl) {
        const comp = r.compilatore.trim();
        const matchedCompiler = compilerKeys.find(
          (c) => c.toLowerCase() === comp.toLowerCase() || comp.toLowerCase().includes(c.toLowerCase())
        );
        if (
          matchedCompiler &&
          typeof r.firmaImmagineUrl === 'string' &&
          r.firmaImmagineUrl.startsWith('data:image/') &&
          !r.firmaImmagineUrl.includes('<svg')
        ) {
          map.set(matchedCompiler.toLowerCase(), {
            id: `sig-${matchedCompiler.replace(/\s+/g, '-').toLowerCase()}`,
            nomeOperatore: matchedCompiler,
            label: `Firma Scansionata - ${matchedCompiler}`,
            immagineUrl: r.firmaImmagineUrl,
            isDefault: false,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // 4. Scansiona lo storico dei report
  const historyKeys = [
    'city_angels_history_reports_v4',
    'city_angels_history_reports_v3',
    'city_angels_history_reports_v2',
    'city_angels_history_reports_v1',
    'city_angels_history_reports',
  ];
  for (const hk of historyKeys) {
    try {
      const raw = localStorage.getItem(hk);
      if (!raw) continue;
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((entry: any) => {
          const r = entry?.report;
          if (r && r.compilatore && r.firmaImmagineUrl) {
            const comp = r.compilatore.trim();
            const matchedCompiler = compilerKeys.find(
              (c) => c.toLowerCase() === comp.toLowerCase() || comp.toLowerCase().includes(c.toLowerCase())
            );
            if (
              matchedCompiler &&
              typeof r.firmaImmagineUrl === 'string' &&
              r.firmaImmagineUrl.startsWith('data:image/') &&
              !r.firmaImmagineUrl.includes('<svg')
            ) {
              map.set(matchedCompiler.toLowerCase(), {
                id: `sig-${matchedCompiler.replace(/\s+/g, '-').toLowerCase()}`,
                nomeOperatore: matchedCompiler,
                label: `Firma Scansionata - ${matchedCompiler}`,
                immagineUrl: r.firmaImmagineUrl,
                isDefault: false,
              });
            }
          }
        });
      }
    } catch {
      // ignore
    }
  }

  // 5. Costruisci l'array finale ordinato: Andrea Menegotto, Chiara Menegotto
  const orderedResult: SavedSignature[] = [];
  compilerKeys.forEach((c) => {
    const existing = map.get(c.toLowerCase());
    if (existing) {
      orderedResult.push(existing);
      map.delete(c.toLowerCase());
    } else {
      const def = DEFAULT_SAVED_SIGNATURES.find((s) => s.nomeOperatore.toLowerCase() === c.toLowerCase());
      if (def) orderedResult.push({ ...def });
    }
  });

  // Aggiungi solo firme dei compilatori ufficiali autorizzati
  map.forEach((sig) => {
    if (isOfficialCompiler(sig.nomeOperatore)) {
      orderedResult.push(sig);
    }
  });

  return orderedResult;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('form');
  const [pageCount, setPageCount] = useState<number>(2);
  const [statusNotice, setStatusNotice] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [showOnlyPresentInEditor, setShowOnlyPresentInEditor] = useState<boolean>(false);
  const [newSubjectInputByRil, setNewSubjectInputByRil] = useState<Record<string, string>>({});

  // File Google Drive rilevati per archiviazione e interrogazione Gemini
  const [driveFilesList, setDriveFilesList] = useState<DriveFileMetadata[]>(() => {
    try {
      const cached = localStorage.getItem('city_angels_cached_drive_files_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    if (driveFilesList.length > 0) {
      try {
        localStorage.setItem('city_angels_cached_drive_files_v1', JSON.stringify(driveFilesList));
      } catch {
        // ignore
      }
    }
  }, [driveFilesList]);
  const [isDriveLoggedIn, setIsDriveLoggedIn] = useState<boolean>(false);
  const [driveUser, setDriveUser] = useState<any>(null);

  // Operatore attivo su questo specifico dispositivo (sovrano: Andrea Menegotto)
  const [activeOperator, setActiveOperator] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('ca_active_operator_identity');
      if (saved && saved.trim()) return saved.trim();
    } catch {
      // ignore
    }
    return 'Andrea Menegotto';
  });

  // URL dell'applicazione (attivo e di produzione)
  const SHARED_APP_PRODUCTION_URL = 'https://ais-pre-ux5hjugbrh5ek3skefaro4-669136959862.europe-west2.run.app';
  const activeAppUrl = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : SHARED_APP_PRODUCTION_URL;
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [isCopiedShareUrl, setIsCopiedShareUrl] = useState<boolean>(false);

  // Elenco Predefinito e Aggiornabile di Volontari e Operatori (Compilatori Ufficiali: Andrea Menegotto e Chiara Menegotto)
  const [roster, setRoster] = useState<RosterMember[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ROSTER);
      if (saved) {
        let parsed: RosterMember[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filtra tassativamente: mostra solo i compilatori e operatori ufficiali abilitati
          const filtered = parsed.filter((r) => isOfficialCompiler(r.nomeCognome));
          if (filtered.length >= 2) return filtered;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_ROSTER;
  });

  const rosterRef = useRef<RosterMember[]>(roster);
  rosterRef.current = roster;

  // Storico dei Report Precedenti (Memoria Servizi - Inclusi tutti i report 1-35 del 2026 e 2025: 62 report ufficiali)
  const [historyReports, setHistoryReports] = useState<HistoricalReportEntry[]>(() => {
    try {
      const savedV4 = localStorage.getItem(STORAGE_KEY_HISTORY);
      const savedV3 = localStorage.getItem('city_angels_history_reports_v3');
      const savedRaw = savedV4 || savedV3;
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = mergeReportEntries(INITIAL_HISTORICAL_REPORTS, parsed).map(
            sanitizeReportCompilatore
          );
          try {
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
            localStorage.removeItem('city_angels_history_reports_v3');
          } catch {
            // ignore
          }
          return merged;
        }
      }
    } catch {
      // ignore
    }
    const cleanSeed = INITIAL_HISTORICAL_REPORTS.map(sanitizeReportCompilatore);
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(cleanSeed));
    } catch {
      // ignore
    }
    return cleanSeed;
  });

  // Filtri, ricerca e modale di cancellazione dello Storico Completo dei Report
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyYearFilter, setHistoryYearFilter] = useState<'ALL' | '2026' | '2025'>('ALL');
  const [reportToDelete, setReportToDelete] = useState<HistoricalReportEntry | null>(null);
  const [deleteFromDriveChecked, setDeleteFromDriveChecked] = useState<boolean>(true);
  const [isDeletingReport, setIsDeletingReport] = useState<boolean>(false);

  // Modale per avvio Nuovo Report pulito da zero con numero progressivo automatico
  const [isNewReportModalOpen, setIsNewReportModalOpen] = useState<boolean>(false);
  const [newReportTargetNumber, setNewReportTargetNumber] = useState<number>(36);
  const [autoArchiveCurrentBeforeReset, setAutoArchiveCurrentBeforeReset] = useState<boolean>(true);

  // Rubrica persistente di nuovi nominativi/soggetti
  const [customSubjects, setCustomSubjects] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_SUBJECTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Targhe Mezzi Memorizzate (numeri di targa fissi per accesso Parcheggio P1)
  const [savedPlates, setSavedPlates] = useState<SavedLicensePlate[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SAVED_PLATES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_SAVED_PLATES;
  });

  const [showPlatesManager, setShowPlatesManager] = useState<boolean>(false);
  const [newPlateInput, setNewPlateInput] = useState<string>('');
  const [newPlateLabel, setNewPlateLabel] = useState<string>('');
  const [newPlateDef1, setNewPlateDef1] = useState<boolean>(false);
  const [newPlateDef2, setNewPlateDef2] = useState<boolean>(false);

  // Archivio Firme Scansionate degli Operatori (Compilatori Ufficiali: Andrea Menegotto, Chiara Menegotto)
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>(() => {
    return recoverSavedSignatures();
  });

  const [autoMatchSignature, setAutoMatchSignature] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_AUTO_MATCH_SIG) !== 'false';
    } catch {
      return true;
    }
  });

  const [newSigOperator, setNewSigOperator] = useState<string>('Andrea Menegotto');
  const [newSigLabel, setNewSigLabel] = useState<string>('');
  const [newSigDataUrl, setNewSigDataUrl] = useState<string>('');

  // Dati Report
  const [report, setReport] = useState<ServiceReportData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REPORT);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.numeroReport === 'number') {
          const norm = normalizeReportOrari(parsed);
          if (norm.squadra && norm.squadra.length > 0) {
            const filteredSquadra = norm.squadra.filter((m) => isOfficialCompiler(m.nomeCognome));
            norm.squadra =
              filteredSquadra.length > 0
                ? alignSquadraToRosterOrder(filteredSquadra, DEFAULT_ROSTER)
                : DEFAULT_ROSTER.map((r) => ({
                    id: r.id,
                    nomeCognome: r.nomeCognome,
                    nickname: r.nickname,
                    qualifica: r.qualifica,
                    orarioServizio: '',
                    note: '',
                    isCaposervizio: r.nomeCognome === 'Andrea Menegotto',
                    isCompilatore: r.nomeCognome === 'Andrea Menegotto',
                    isPresente: true,
                  }));
          }
          return norm;
        }
      }
    } catch {
      // ignore
    }
    const sampleNorm = normalizeReportOrari(SAMPLE_REPORT_DATA);
    if (sampleNorm.squadra && sampleNorm.squadra.length > 0) {
      sampleNorm.squadra = alignSquadraToRosterOrder(sampleNorm.squadra, DEFAULT_ROSTER);
    }
    return sampleNorm;
  });

  const [lastDraftSyncInfo, setLastDraftSyncInfo] = useState<{ by: string; at: string } | null>(null);
  const [lastArchiveSyncInfo, setLastArchiveSyncInfo] = useState<{ by: string; at: string } | null>(null);
  const [isCloudSyncingLive, setIsCloudSyncingLive] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const isApplyingRemoteReportRef = useRef<boolean>(false);
  const isInitialMountRef = useRef<boolean>(true);
  const hasHydratedCloudDraftRef = useRef<boolean>(false);
  const hasUserEditedDraftRef = useRef<boolean>(false);
  const lastRemoteTimestampRef = useRef<number>(0);
  const lastAppliedRemoteHashRef = useRef<string>('');
  const currentReportRef = useRef<ServiceReportData>(report);
  const applyIncomingRemoteDraftRef = useRef<(remoteData: CloudDraftMetadata) => void>(() => {});

  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const STORAGE_KEY_DELETED_USERS = 'city_angels_deleted_users_v2';
  const STORAGE_KEY_DELETED_LOCATIONS = 'city_angels_deleted_locations_v2';

  const [managedLocations, setManagedLocations] = useState<string[]>(KNOWN_LOCATIONS);
  const [managedUsers, setManagedUsers] = useState<string[]>(() => {
    return USER_REGISTRY.map((u) => formatUserRegistryName(u.nomeCognome));
  });

  useEffect(() => {
    // 1. Sincronizzazione in tempo reale utenti registrati su Firestore
    const unsubUsers = onSnapshot(
      collection(db, 'registered_users'),
      (snapshot) => {
        const deletedSet = new Set<string>();
        try {
          const cachedDel = JSON.parse(localStorage.getItem(STORAGE_KEY_DELETED_USERS) || '[]');
          if (Array.isArray(cachedDel)) {
            cachedDel.forEach((n: string) => deletedSet.add(n.toLowerCase()));
          }
        } catch {
          // ignore
        }

        const firestoreActive: string[] = [];
        snapshot.docs.forEach((d) => {
          const data = d.data();
          const raw = (data.nomeCognome || '').trim();
          if (!raw) return;
          const formatted = formatUserRegistryName(raw);
          if (data.deleted === true) {
            deletedSet.add(formatted.toLowerCase());
          } else {
            firestoreActive.push(formatted);
          }
        });

        // Utenti predefiniti
        const baseFormatted = USER_REGISTRY.map((u) => formatUserRegistryName(u.nomeCognome));

        // Escludi cancellati
        const activeBase = baseFormatted.filter((name) => !deletedSet.has(name.toLowerCase()));
        const activeRemote = firestoreActive.filter((name) => !deletedSet.has(name.toLowerCase()));

        // Merge unico case-insensitive
        const finalUsers: string[] = [];
        const seen = new Set<string>();
        for (const name of [...activeBase, ...activeRemote]) {
          const lower = name.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            finalUsers.push(name);
          }
        }
        setManagedUsers(finalUsers);
      },
      (error) => {
        console.warn('Realtime registered_users sync error:', error);
      }
    );

    // 2. Sincronizzazione in tempo reale luoghi monitorati su Firestore
    const unsubLocs = onSnapshot(
      collection(db, 'monitored_locations'),
      (snapshot) => {
        const deletedSet = new Set<string>();
        try {
          const cachedDel = JSON.parse(localStorage.getItem(STORAGE_KEY_DELETED_LOCATIONS) || '[]');
          if (Array.isArray(cachedDel)) {
            cachedDel.forEach((n: string) => deletedSet.add(n.toLowerCase()));
          }
        } catch {
          // ignore
        }

        const firestoreActive: string[] = [];
        snapshot.docs.forEach((d) => {
          const data = d.data();
          const name = (data.name || '').trim();
          if (!name) return;
          if (data.deleted === true) {
            deletedSet.add(name.toLowerCase());
          } else {
            firestoreActive.push(name);
          }
        });

        const activeBase = KNOWN_LOCATIONS.filter((l) => !deletedSet.has(l.toLowerCase()));
        const activeRemote = firestoreActive.filter((l) => !deletedSet.has(l.toLowerCase()));

        const finalLocs: string[] = [];
        const seen = new Set<string>();
        for (const loc of [...activeBase, ...activeRemote]) {
          const lower = loc.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            finalLocs.push(loc);
          }
        }
        setManagedLocations(finalLocs);
      },
      (error) => {
        console.warn('Realtime monitored_locations sync error:', error);
      }
    );

    // 3. Sincronizzazione in tempo reale firme dei compilatori su Firestore
    const unsubSignatures = onSnapshot(
      collection(db, 'saved_signatures'),
      (snapshot) => {
        if (snapshot.empty) {
          // Se la collezione è vuota su Firestore, effettua il seed con le firme recuperate
          const recovered = recoverSavedSignatures();
          recovered.forEach(async (sig) => {
            if (sig.immagineUrl) {
              const safeDocId = 'sig_' + encodeURIComponent(sig.nomeOperatore.toLowerCase()).replace(/[^a-zA-Z0-9_-]/g, '_');
              await setDoc(doc(db, 'saved_signatures', safeDocId), {
                nomeOperatore: sig.nomeOperatore,
                label: sig.label,
                immagineUrl: sig.immagineUrl,
                isDefault: sig.isDefault ?? false,
                updatedAt: new Date().toISOString(),
              }).catch(() => {});
            }
          });
          return;
        }

        setSavedSignatures((prev) => {
          const map = new Map<string, SavedSignature>();
          prev.forEach((s) => map.set(s.nomeOperatore.trim().toLowerCase(), s));

          snapshot.docs.forEach((d) => {
            const data = d.data();
            const opName = (data.nomeOperatore || '').trim();
            if (opName && data.immagineUrl) {
              map.set(opName.toLowerCase(), {
                id: d.id,
                nomeOperatore: opName,
                label: data.label || `Firma Scansionata - ${opName}`,
                immagineUrl: data.immagineUrl,
                isDefault: data.isDefault ?? false,
              });
            }
          });

          const priority = ['Andrea Menegotto', 'Chiara Menegotto'];
          const ordered: SavedSignature[] = [];
          priority.forEach((p) => {
            const found = map.get(p.toLowerCase());
            if (found) {
              ordered.push(found);
              map.delete(p.toLowerCase());
            }
          });
          // Solo i 2 compilatori ufficiali vengono inclusi
          return ordered;
        });
      },
      (error) => {
        console.warn('Realtime saved_signatures sync error:', error);
      }
    );

    return () => {
      unsubUsers();
      unsubLocs();
      unsubSignatures();
    };
  }, []);

  const handleAddNewUser = async (rawName: string) => {
    const clean = formatUserRegistryName(rawName);
    if (!clean || clean.length < 2) return;
    const lower = clean.toLowerCase();

    // Rimuovi da localStorage deleted_users se era cancellato
    try {
      const cachedDel = JSON.parse(localStorage.getItem(STORAGE_KEY_DELETED_USERS) || '[]');
      if (Array.isArray(cachedDel)) {
        const nextDel = cachedDel.filter((n: string) => n.toLowerCase() !== lower);
        localStorage.setItem(STORAGE_KEY_DELETED_USERS, JSON.stringify(nextDel));
      }
    } catch {
      // ignore
    }

    setManagedUsers((prev) => {
      if (prev.some((u) => u.toLowerCase() === lower)) return prev;
      return [...prev, clean];
    });

    try {
      const q = query(collection(db, 'registered_users'));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        if (d.data().nomeCognome?.toLowerCase() === lower && d.data().deleted === true) {
          await deleteDoc(d.ref);
        }
      }

      await addDoc(collection(db, 'registered_users'), {
        nomeCognome: clean,
        deleted: false,
        createdAt: new Date().toISOString(),
      });
      showNotice(`Utente ${clean} memorizzato e sincronizzato nel registro condiviso.`);
    } catch (err) {
      console.warn('Errore salvataggio utente su Firestore:', err);
    }
  };

  const handleAddNewLocation = async (rawLoc: string) => {
    const clean = rawLoc.trim();
    if (!clean || clean.length < 2) return;
    const lower = clean.toLowerCase();

    // Rimuovi da localStorage deleted_locations se era cancellato
    try {
      const cachedDel = JSON.parse(localStorage.getItem(STORAGE_KEY_DELETED_LOCATIONS) || '[]');
      if (Array.isArray(cachedDel)) {
        const nextDel = cachedDel.filter((n: string) => n.toLowerCase() !== lower);
        localStorage.setItem(STORAGE_KEY_DELETED_LOCATIONS, JSON.stringify(nextDel));
      }
    } catch {
      // ignore
    }

    setManagedLocations((prev) => {
      if (prev.some((l) => l.toLowerCase() === lower)) return prev;
      return [...prev, clean];
    });

    try {
      const q = query(collection(db, 'monitored_locations'));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        if (d.data().name?.toLowerCase() === lower && d.data().deleted === true) {
          await deleteDoc(d.ref);
        }
      }

      await addDoc(collection(db, 'monitored_locations'), {
        name: clean,
        deleted: false,
        createdAt: new Date().toISOString(),
      });
      showNotice(`Luogo "${clean}" memorizzato e sincronizzato nel registro condiviso.`);
    } catch (err) {
      console.warn('Errore salvataggio luogo su Firestore:', err);
    }
  };

  const handleRemoveUser = async (rawName: string) => {
    const clean = formatUserRegistryName(rawName);
    const lower = clean.toLowerCase();

    // 1. Rimuovi immediatamente dallo stato locale
    setManagedUsers((prev) => prev.filter((u) => u.toLowerCase() !== lower));

    // 2. Salva in localStorage per persistenza istantanea sul client
    try {
      const cachedDel = JSON.parse(localStorage.getItem(STORAGE_KEY_DELETED_USERS) || '[]');
      const set = new Set(Array.isArray(cachedDel) ? cachedDel.map((s: string) => s.toLowerCase()) : []);
      set.add(lower);
      localStorage.setItem(STORAGE_KEY_DELETED_USERS, JSON.stringify(Array.from(set)));
    } catch {
      // ignore
    }

    // 3. Sincronizza eliminazione su Firestore (cancella doc esistenti e aggiunge tombstone per sync multi-utente)
    try {
      const q = query(collection(db, 'registered_users'));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        if (d.data().nomeCognome?.toLowerCase() === lower) {
          await deleteDoc(d.ref);
        }
      }

      const safeId = 'del_' + encodeURIComponent(lower).replace(/[^a-zA-Z0-9_-]/g, '_');
      await setDoc(doc(db, 'registered_users', safeId), {
        nomeCognome: clean,
        deleted: true,
        deletedAt: new Date().toISOString(),
      });
      showNotice(`Utente ${clean} rimosso dal registro.`);
    } catch (err) {
      console.warn('Errore cancellazione utente da Firestore:', err);
    }
  };

  const handleRemoveLocation = async (rawLoc: string) => {
    const clean = rawLoc.trim();
    const lower = clean.toLowerCase();

    // 1. Rimuovi immediatamente dallo stato locale
    setManagedLocations((prev) => prev.filter((l) => l.toLowerCase() !== lower));

    // 2. Salva in localStorage per persistenza istantanea
    try {
      const cachedDel = JSON.parse(localStorage.getItem(STORAGE_KEY_DELETED_LOCATIONS) || '[]');
      const set = new Set(Array.isArray(cachedDel) ? cachedDel.map((s: string) => s.toLowerCase()) : []);
      set.add(lower);
      localStorage.setItem(STORAGE_KEY_DELETED_LOCATIONS, JSON.stringify(Array.from(set)));
    } catch {
      // ignore
    }

    // 3. Sincronizza cancellazione su Firestore
    try {
      const q = query(collection(db, 'monitored_locations'));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        if (d.data().name?.toLowerCase() === lower) {
          await deleteDoc(d.ref);
        }
      }

      const safeId = 'del_' + encodeURIComponent(lower).replace(/[^a-zA-Z0-9_-]/g, '_');
      await setDoc(doc(db, 'monitored_locations', safeId), {
        name: clean,
        deleted: true,
        deletedAt: new Date().toISOString(),
      });
      showNotice(`Luogo "${clean}" rimosso dal registro.`);
    } catch (err) {
      console.warn('Errore cancellazione luogo da Firestore:', err);
    }
  };

  // Configurazione Societaria / Intestazione (con campi distinti Associazione e Cooperativa)
  const [corporate, setCorporate] = useState<CorporateHeaderConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CORP);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CORPORATE_CONFIG,
          ...parsed,
          associazione: {
            ...DEFAULT_ASSOCIAZIONE_CONFIG,
            ...(parsed.associazione || {}),
          },
          cooperativa: {
            ...DEFAULT_COOPERATIVA_CONFIG,
            ...(parsed.cooperativa || {}),
          },
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_CORPORATE_CONFIG;
  });

  // Persistenza LocalStorage e Sincronizzazione Live Cloud su Firestore (PC & Smartphone Android)
  useEffect(() => {
    currentReportRef.current = report;
    const currentSerialized = JSON.stringify(report);
    try {
      localStorage.setItem(STORAGE_KEY_REPORT, currentSerialized);
    } catch {
      // ignore
    }

    // Al caricamento iniziale non sovrascrivere il cloud con la cache locale del browser
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    // Se il report corrisponde esattamente a quello appena applicato da remoto, non reinviare al cloud (evita echo ping-pong)
    if (lastAppliedRemoteHashRef.current && currentSerialized === lastAppliedRemoteHashRef.current) {
      isApplyingRemoteReportRef.current = false;
      return;
    }

    // Se arriviamo qui, c'è stata una reale modifica manuale dell'utente su questa interfaccia
    isApplyingRemoteReportRef.current = false;
    hasUserEditedDraftRef.current = true;

    // SICUREZZA MULTI-DISPOSITIVO:
    // Invia al cloud solo dopo l'idratazione iniziale se l'utente ha modificato attivamente i campi
    if (hasHydratedCloudDraftRef.current && hasUserEditedDraftRef.current) {
      setIsCloudSyncingLive(true);
      const userLabel = resolveAuthorName(report, driveUser, roster, activeOperator);
      pushDraftToCloudDebounced(report, userLabel)
        .catch(() => {})
        .finally(() => {
          setIsCloudSyncingLive(false);
        });
    }
  }, [report]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CORP, JSON.stringify(corporate));
    } catch {
      // ignore
    }
  }, [corporate]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(roster));
    } catch {
      // ignore
    }
  }, [roster]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historyReports));
    } catch {
      // ignore
    }
  }, [historyReports]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_SUBJECTS, JSON.stringify(customSubjects));
    } catch {
      // ignore
    }
  }, [customSubjects]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SAVED_PLATES, JSON.stringify(savedPlates));
    } catch {
      // ignore
    }
  }, [savedPlates]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SAVED_SIGNATURES, JSON.stringify(savedSignatures));
    } catch {
      // ignore
    }
  }, [savedSignatures]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_MATCH_SIG, String(autoMatchSignature));
    } catch {
      // ignore
    }
  }, [autoMatchSignature]);

  // Se il report attivo non ha targhe impostate, precompila automaticamente con le targhe fisse memorizzate
  useEffect(() => {
    const def1 = savedPlates.find((p) => p.isDefaultSbarra1)?.targa;
    const def2 = savedPlates.find((p) => p.isDefaultSbarra2)?.targa;
    if (def1 && !report.apertureSbarraInizio?.[0]?.targa) {
      updateBarrierEntry(0, 'targa', def1);
    }
    if (def2 && !report.apertureSbarraInizio?.[1]?.targa) {
      updateBarrierEntry(1, 'targa', def2);
    }
  }, []);

  // Mantieni costantemente attivo il collegamento a Google Drive e sincronizza lo storico all'avvio
  useEffect(() => {
    let currentFolderId = extractDriveFolderId(getStoredDriveFolderUrl());

    // Iscrizione in tempo reale alla cartella Drive salvata su Firestore da qualsiasi collaboratore
    const unsubDriveUrl = subscribeToDriveFolderUrl((remoteUrl) => {
      const newFolderId = extractDriveFolderId(remoteUrl);
      if (newFolderId && newFolderId !== currentFolderId) {
        currentFolderId = newFolderId;
        getAccessToken().then((token) => {
          if (token && currentFolderId) {
            loadHistoricalReportsFromDriveFolder(currentFolderId).then(({ files, reports }) => {
              setDriveFilesList(files);
              if (reports.length > 0) {
                setHistoryReports((prev) => {
                  const merged = mergeReportEntries(prev, reports);
                  try {
                    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
                  } catch {
                    // ignore
                  }
                  pushSharedArchiveToCloud(merged, 'Google Drive Auto-Sync').catch(() => {});
                  return merged;
                });
              }
            }).catch((err) => console.warn('Auto-sync cartella Google Drive da aggiornamento Firestore:', err));
          }
        });
      }
    });

    const unsubAuth = initAuth(
      async (user, token) => {
        setIsDriveLoggedIn(true);
        setDriveUser(user);
        if (user?.email) {
          const em = user.email.toLowerCase();
          if (em === 'am@andreamenegotto.it' || em.includes('andreamenegotto')) {
            handleSetActiveOperator('Andrea Menegotto', false);
          } else if (em.includes('chiaramenegotto')) {
            handleSetActiveOperator('Chiara Menegotto', false);
          } else if (em.includes('chiarapozzi')) {
            handleSetActiveOperator('Chiara Pozzi', false);
          }
        }
        if (currentFolderId && token) {
          try {
            const { files, reports } = await loadHistoricalReportsFromDriveFolder(currentFolderId);
            setDriveFilesList(files);
            if (reports.length > 0) {
              setHistoryReports((prev) => {
                const merged = mergeReportEntries(prev, reports);
                try {
                  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
                } catch {
                  // ignore
                }
                const userLabel =
                  user.displayName
                    ? `${user.displayName} (${user.email || ''})`.trim()
                    : (user.email || 'Google Drive Auto-Sync');
                pushSharedArchiveToCloud(merged, userLabel).catch(() => {});
                return merged;
              });
            }
          } catch (err) {
            console.warn('Auto-sync cartella Google Drive all\'avvio:', err);
          }
        }
      },
      () => {
        setIsDriveLoggedIn(false);
        setDriveUser(null);
      }
    );

    // Helper per applicare le modifiche remote garantendo che gli orari e i dati inseriti non vengano mai azzerati
    const applyIncomingRemoteDraft = (remoteData: CloudDraftMetadata) => {
      hasHydratedCloudDraftRef.current = true;
      if (!remoteData || !remoteData.report) return;

      // Se questo aggiornamento arriva dallo stesso client, evitiamo race-condition ed eco
      if (remoteData.clientId && remoteData.clientId === getOrCreateClientId()) {
        lastRemoteTimestampRef.current = Math.max(lastRemoteTimestampRef.current, remoteData.updatedAt || 0);
        return;
      }

      const currentRep = currentReportRef.current;
      const incomingRep = remoteData.report;
      const currentNum = Number(currentRep?.numeroReport) || 0;
      const incomingNum = Number(incomingRep?.numeroReport) || 0;

      // Se l'aggiornamento remoto è più vecchio di quello già applicato e riguarda lo STESSO report, ignoralo.
      // MA se il report remoto ha un numero superiore (es. nuovo Report 38 rispetto al 37), deve SEMPRE prevalere!
      if (
        incomingNum === currentNum &&
        remoteData.updatedAt &&
        lastRemoteTimestampRef.current &&
        remoteData.updatedAt < lastRemoteTimestampRef.current
      ) {
        return;
      }

      // Se il report remoto ha un numero superiore (es. PC ha creato Report 38 pulito):
      // Adotta il nuovo report e resetta lo stato di editing locale per non reinviare i dati del turno precedente
      let mergedReport: ServiceReportData;
      if (incomingNum > currentNum) {
        mergedReport = normalizeReportOrari(incomingRep);
        hasUserEditedDraftRef.current = false;
      } else if (incomingNum < currentNum) {
        // Il nostro dispositivo è già su un numero di report più avanzato, non retrocedere
        return;
      } else {
        // Stesso numero di report: unione collaborativa protetta senza mai cancellare testo o rilevazioni
        mergedReport = safeMergeReport(currentRep, incomingRep);
      }

      // Sanifica e pulisci la lista delle rilevazioni da elementi vuoti duplicati
      mergedReport.rilevazioni = sanitizeRilevazioniList(mergedReport.rilevazioni);

      if (mergedReport.squadra && mergedReport.squadra.length > 0) {
        mergedReport.squadra = alignSquadraToRosterOrder(mergedReport.squadra, rosterRef.current);
      }

      const serialized = JSON.stringify(mergedReport);
      const isDifferent =
        serialized !== JSON.stringify(currentReportRef.current);

      if (isDifferent) {
        lastAppliedRemoteHashRef.current = serialized;
        isApplyingRemoteReportRef.current = true;
        lastRemoteTimestampRef.current = remoteData.updatedAt || Date.now();
        setReport(mergedReport);
        currentReportRef.current = mergedReport;
        setLastDraftSyncInfo({ by: remoteData.updatedBy, at: remoteData.updatedAtIso || String(remoteData.updatedAt) });
        try {
          localStorage.setItem(STORAGE_KEY_REPORT, serialized);
        } catch {
          // ignore
        }
      }
    };

    applyIncomingRemoteDraftRef.current = applyIncomingRemoteDraft;

    // 2. Sincronizzazione in tempo reale della bozza collaborativa su Cloud Firestore (PC & Smartphone Android)
    const unsubDraft = subscribeToActiveDraft((remoteData) => {
      applyIncomingRemoteDraft(remoteData);
    });

    // 3. Verifica all'avvio se è presente una bozza Cloud condivisa attiva
    fetchDraftFromCloud()
      .then((cloudData) => {
        hasHydratedCloudDraftRef.current = true;
        if (cloudData && cloudData.report) {
          applyIncomingRemoteDraft(cloudData);
        }
      })
      .catch(() => {
        hasHydratedCloudDraftRef.current = true;
      });

    // 4. Sincronizzazione in tempo reale dell'archivio storico completo su Cloud Firestore (PC & Smartphone Android)
    const unsubArchive = subscribeToSharedArchive((remoteReports, updatedBy, updatedAtIso) => {
      setHistoryReports((prev) => {
        const merged = mergeReportEntries(prev, remoteReports);
        try {
          localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
        } catch {
          // ignore
        }
        return merged;
      });
      setLastArchiveSyncInfo({ by: updatedBy || 'Archivio Condiviso', at: updatedAtIso });
    });

    // Scarica l'archivio completo da Cloud Firestore all'avvio (o auto-popola il cloud se vuoto)
    fetchSharedArchiveFromCloud('Avvio App')
      .then((cloudReports) => {
        if (cloudReports && cloudReports.length > 0) {
          setHistoryReports((prev) => {
            const merged = mergeReportEntries(prev, cloudReports);
            try {
              localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
            } catch {
              // ignore
            }
            return merged;
          });
        }
      })
      .catch(() => {});

    // Gestione sicura del cambio scheda, riduzione a icona e chiusura browser (multi-dispositivo & multi-account)
    const handleFlushDraft = () => {
      if (document.visibilityState === 'hidden') {
        // Se la scheda viene ridotta a icona o chiusa, invia al cloud SOLO se ci sono state reali modifiche dell'utente
        if (hasHydratedCloudDraftRef.current && hasUserEditedDraftRef.current) {
          flushPendingDraftToCloud().catch(() => {});
        }
      } else if (document.visibilityState === 'visible') {
        // Quando la scheda ritorna in primo piano dopo essere stata ridotta o lasciata in background,
        // recupera immediatamente la bozza dal Cloud
        fetchDraftFromCloud()
          .then((cloudData) => {
            if (cloudData && cloudData.report) {
              applyIncomingRemoteDraft(cloudData);
            }
          })
          .catch(() => {});
      }
    };

    const handleBeforeUnload = () => {
      if (hasHydratedCloudDraftRef.current && hasUserEditedDraftRef.current) {
        flushPendingDraftToCloud().catch(() => {});
      }
    };

    window.addEventListener('visibilitychange', handleFlushDraft);
    window.addEventListener('pagehide', handleBeforeUnload);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubDriveUrl();
      unsubAuth();
      unsubDraft();
      unsubArchive();
      window.removeEventListener('visibilitychange', handleFlushDraft);
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? '' : prev));
    }, 4500);
  };

  const memoryIndex = useMemo(() => {
    return buildMemoryIndex(historyReports, customSubjects);
  }, [historyReports, customSubjects]);

  // Calcoli automatici in tempo reale
  const totalSubjects = useMemo(() => {
    return (report.rilevazioni || []).reduce(
      (sum, item) =>
        sum +
        (Number.isFinite(Number(item.numeroUtenti))
          ? Math.max(0, Number(item.numeroUtenti))
          : 0),
      0
    );
  }, [report.rilevazioni]);

  const totalEngagements = useMemo(() => {
    return (report.rilevazioni || []).filter((item) => Boolean(item.aggancioEffettuato)).length;
  }, [report.rilevazioni]);

  const updateField = <K extends keyof ServiceReportData>(
    key: K,
    value: ServiceReportData[K]
  ) => {
    hasUserEditedDraftRef.current = true;
    setReport((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === 'oraInizio' || key === 'oraFine') {
        return normalizeReportOrari(updated);
      }
      return updated;
    });
  };

  // Helper per ottenere l'elenco degli orari di servizio (garantisce almeno 1 elemento e che non mascheri mai orari inseriti)
  const currentServiceSlots: ServiceTimeSlot[] = useMemo(() => {
    if (report.orariServizio && report.orariServizio.length > 0) {
      const slots = report.orariServizio.map((s, idx) => {
        if (idx === 0) {
          const sCopy = { ...s };
          if (!sCopy.oraInizio?.trim() && report.oraInizio?.trim()) {
            sCopy.oraInizio = report.oraInizio;
          }
          if (!sCopy.oraFine?.trim() && report.oraFine?.trim()) {
            sCopy.oraFine = report.oraFine;
          }
          return sCopy;
        }
        return s;
      });
      return slots;
    }
    return [
      {
        id: 'slot-1',
        oraInizio: report.oraInizio || '',
        oraFine: report.oraFine || '',
        descrizione: report.orarioTestoLibero || '',
      },
    ];
  }, [report.orariServizio, report.oraInizio, report.oraFine, report.orarioTestoLibero]);

  const updateServiceSlot = (slotId: string, field: keyof ServiceTimeSlot, val: string) => {
    hasUserEditedDraftRef.current = true;
    setReport((prev) => {
      const existingSlots =
        prev.orariServizio && prev.orariServizio.length > 0
          ? [...prev.orariServizio]
          : [
              {
                id: 'slot-1',
                oraInizio: prev.oraInizio || '',
                oraFine: prev.oraFine || '',
                descrizione: prev.orarioTestoLibero || '',
              },
            ];

      const nextSlots = existingSlots.map((s) => (s.id === slotId ? { ...s, [field]: val } : s));

      // Sincronizza anche i campi legacy per massima retrocompatibilità
      const firstSlot = nextSlots[0];
      const lastSlot = nextSlots[nextSlots.length - 1];
      const descJoined = nextSlots
        .map((s) => s.descrizione?.trim())
        .filter(Boolean)
        .join('; ');

      return {
        ...prev,
        orariServizio: nextSlots,
        oraInizio: firstSlot?.oraInizio || '',
        oraFine: lastSlot?.oraFine || firstSlot?.oraFine || '',
        orarioTestoLibero: descJoined,
      };
    });
  };

  const addServiceSlot = () => {
    hasUserEditedDraftRef.current = true;
    setReport((prev) => {
      const existingSlots =
        prev.orariServizio && prev.orariServizio.length > 0
          ? [...prev.orariServizio]
          : [
              {
                id: 'slot-1',
                oraInizio: prev.oraInizio || '',
                oraFine: prev.oraFine || '',
                descrizione: prev.orarioTestoLibero || '',
              },
            ];

      const newSlot: ServiceTimeSlot = {
        id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        oraInizio: '',
        oraFine: '',
        descrizione: '',
      };

      const nextSlots = [...existingSlots, newSlot];

      return {
        ...prev,
        orariServizio: nextSlots,
      };
    });
  };

  const removeServiceSlot = (slotId: string) => {
    hasUserEditedDraftRef.current = true;
    setReport((prev) => {
      const existingSlots =
        prev.orariServizio && prev.orariServizio.length > 0
          ? [...prev.orariServizio]
          : [
              {
                id: 'slot-1',
                oraInizio: prev.oraInizio || '',
                oraFine: prev.oraFine || '',
                descrizione: prev.orarioTestoLibero || '',
              },
            ];

      if (existingSlots.length <= 1) {
        return {
          ...prev,
          orariServizio: [
            {
              id: existingSlots[0].id,
              oraInizio: '',
              oraFine: '',
              descrizione: '',
            },
          ],
          oraInizio: '',
          oraFine: '',
          orarioTestoLibero: '',
        };
      }

      const nextSlots = existingSlots.filter((s) => s.id !== slotId);
      const firstSlot = nextSlots[0];
      const lastSlot = nextSlots[nextSlots.length - 1];
      const descJoined = nextSlots
        .map((s) => s.descrizione?.trim())
        .filter(Boolean)
        .join('; ');

      return {
        ...prev,
        orariServizio: nextSlots,
        oraInizio: firstSlot?.oraInizio || '',
        oraFine: lastSlot?.oraFine || firstSlot?.oraFine || '',
        orarioTestoLibero: descJoined,
      };
    });
  };

  // Gestione Squadra e Spunta Presenze
  const isRosterMemberChecked = (member: RosterMember): boolean => {
    return report.squadra.some(
      (m) =>
        m.id === member.id ||
        (member.nomeCognome.trim() &&
          m.nomeCognome.trim().toLowerCase() === member.nomeCognome.trim().toLowerCase())
    );
  };

  const toggleRosterPresence = (member: RosterMember, checked: boolean) => {
    setReport((prev) => {
      const exists = prev.squadra.some(
        (m) =>
          m.id === member.id ||
          (member.nomeCognome.trim() &&
            m.nomeCognome.trim().toLowerCase() ===
              member.nomeCognome.trim().toLowerCase())
      );

      if (checked && !exists) {
        const added: TeamMember = {
          id: member.id,
          nomeCognome: member.nomeCognome,
          nickname: member.nickname,
          qualifica: member.qualifica,
          orarioServizio: '',
          note: '',
          isCaposervizio: member.isCaposervizio || false,
          isCompilatore: member.isCompilatore || false,
        };
        const aligned = alignSquadraToRosterOrder([...prev.squadra, added], rosterRef.current);
        return {
          ...prev,
          squadra: aligned,
        };
      }

      if (!checked && exists) {
        return {
          ...prev,
          squadra: prev.squadra.filter(
            (m) =>
              m.id !== member.id &&
              (!member.nomeCognome.trim() ||
                m.nomeCognome.trim().toLowerCase() !==
                  member.nomeCognome.trim().toLowerCase())
          ),
        };
      }

      return prev;
    });
  };

  const toggleCaposervizioForMember = (id: string, checked: boolean) => {
    setRoster((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isCaposervizio: checked } : r))
    );
    setReport((prev) => {
      const nextSquadra = prev.squadra.map((m) =>
        m.id === id ? { ...m, isCaposervizio: checked } : m
      );
      const capiservizioNames = nextSquadra
        .filter((m) => m.isCaposervizio && m.nomeCognome.trim())
        .map((m) => m.nomeCognome.trim());

      return {
        ...prev,
        squadra: nextSquadra,
        caposervizio: capiservizioNames.join(', '),
      };
    });
  };

  const toggleCompilatoreForMember = (id: string, checked: boolean) => {
    const targetMember = roster.find((r) => r.id === id);
    const targetName = targetMember?.nomeCognome?.trim() || '';

    if (checked && !isOfficialCompiler(targetName)) {
      showNotice('I soli compilatori autorizzati per il report sono Andrea Menegotto e Chiara Menegotto.');
      return;
    }

    // Aggiorna il roster: se checked è true, solo questo membro è compilatore e deve risultare presente
    setRoster((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            isCompilatore: checked,
            isPresente: checked ? true : r.isPresente,
          };
        }
        return checked ? { ...r, isCompilatore: false } : r;
      })
    );

    setReport((prev) => {
      let nextSquadra = prev.squadra.map((m) => {
        if (m.id === id) {
          return { ...m, isCompilatore: checked };
        }
        return checked ? { ...m, isCompilatore: false } : m;
      });

      if (checked && !nextSquadra.some((m) => m.id === id) && targetMember) {
        nextSquadra = alignSquadraToRosterOrder([
          ...nextSquadra,
          {
            ...targetMember,
            isCompilatore: true,
          },
        ], rosterRef.current);
      }

      let nextSigUrl = '';
      if (checked && targetName) {
        const found = savedSignatures.find(
          (s) =>
            s.nomeOperatore.trim().toLowerCase() === targetName.toLowerCase() ||
            targetName.toLowerCase().includes(s.nomeOperatore.trim().toLowerCase())
        );
        if (found) {
          nextSigUrl = found.immagineUrl;
          showNotice(`"${targetName}" compilatore: firma associata per la stampa.`);
        } else {
          showNotice(`"${targetName}" impostato come compilatore della scheda.`);
        }
      } else {
        showNotice('Nessun compilatore spuntato (firma a penna sul PDF stampato).');
      }

      return {
        ...prev,
        squadra: nextSquadra,
        compilatore: checked ? targetName : '',
        firmaImmagineUrl: nextSigUrl,
      };
    });
  };

  const handleSetActiveOperator = (name: string, syncWithCurrentReport = false) => {
    const clean = name.trim();
    if (!clean) return;
    setActiveOperator(clean);
    try {
      localStorage.setItem('ca_active_operator_identity', clean);
    } catch {
      // ignore
    }
    if (syncWithCurrentReport) {
      applyCompilerToReport(clean);
    } else {
      showNotice(`Operatore dispositivo impostato su: "${clean}"`);
    }
  };

  const applyCompilerToReport = (targetName: string) => {
    const clean = targetName.trim();
    if (!clean || !isOfficialCompiler(clean)) return;

    const targetMember = roster.find(
      (r) => r.nomeCognome?.trim().toLowerCase() === clean.toLowerCase()
    );

    const foundSig = savedSignatures.find(
      (s) =>
        s.nomeOperatore.trim().toLowerCase() === clean.toLowerCase() ||
        clean.toLowerCase().includes(s.nomeOperatore.trim().toLowerCase())
    );

    setReport((prev) => {
      let nextSquadra: TeamMember[] = (prev.squadra || []).map((m) => {
        const isMatch = m.nomeCognome?.trim().toLowerCase() === clean.toLowerCase();
        return {
          ...m,
          isCompilatore: isMatch,
          isPresente: isMatch ? true : m.isPresente,
        };
      });

      if (targetMember && !nextSquadra.some((m) => m.nomeCognome?.trim().toLowerCase() === clean.toLowerCase())) {
        nextSquadra = alignSquadraToRosterOrder([
          ...nextSquadra,
          {
            ...targetMember,
            isCompilatore: true,
            isPresente: true,
          },
        ], rosterRef.current);
      }

      return {
        ...prev,
        compilatore: clean,
        firmaImmagineUrl: foundSig ? foundSig.immagineUrl : prev.firmaImmagineUrl,
        squadra: nextSquadra,
      };
    });

    setRoster((prev) =>
      prev.map((r) => {
        const isMatch = r.nomeCognome?.trim().toLowerCase() === clean.toLowerCase();
        return {
          ...r,
          isCompilatore: isMatch,
          isPresente: isMatch ? true : r.isPresente,
        };
      })
    );

    showNotice(
      foundSig
        ? `"${clean}" impostato come compilatore (firma autografa collegata ✅).`
        : `"${clean}" impostato come compilatore della scheda.`
    );
  };

  const handleSetTodayDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    updateField('data', todayStr);
    showNotice(`Data impostata su oggi: ${formatDateIT(todayStr)}`);
  };

  const handleSetYesterdayDate = () => {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const yesterdayStr = `${y}-${m}-${d}`;
    updateField('data', yesterdayStr);
    showNotice(`Data impostata su ieri: ${formatDateIT(yesterdayStr)}`);
  };

  const addSavedSignature = async (
    nomeOperatore: string,
    label: string,
    immagineUrl: string,
    isDefault = false
  ) => {
    if (!immagineUrl) {
      showNotice('Carica prima un file immagine di firma scansionata.');
      return;
    }
    const opName = nomeOperatore.trim() || 'Operatore';
    const newSig: SavedSignature = {
      id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nomeOperatore: opName,
      label: label.trim() || `Firma Scansionata - ${opName}`,
      immagineUrl,
      isDefault,
    };

    setSavedSignatures((prev) => {
      const lower = opName.toLowerCase();
      const exists = prev.some((s) => s.nomeOperatore.trim().toLowerCase() === lower);
      if (exists) {
        return prev.map((s) =>
          s.nomeOperatore.trim().toLowerCase() === lower ? newSig : s
        );
      }
      return [newSig, ...prev];
    });

    // Applica subito al report corrente
    setReport((prev) => ({ ...prev, firmaImmagineUrl: immagineUrl }));
    setNewSigDataUrl('');
    setNewSigLabel('');
    showNotice(`Firma scansionata per "${opName}" memorizzata e sincronizzata!`);

    // Sincronizza nel database Cloud Firestore
    try {
      const safeDocId = 'sig_' + encodeURIComponent(opName.toLowerCase()).replace(/[^a-zA-Z0-9_-]/g, '_');
      await setDoc(doc(db, 'saved_signatures', safeDocId), {
        nomeOperatore: opName,
        label: newSig.label,
        immagineUrl,
        isDefault,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Avviso sincronizzazione firma su Firestore:', err);
    }
  };

  const resetCompilerSignature = async (compilerName: string) => {
    const def = DEFAULT_SAVED_SIGNATURES.find(
      (s) => s.nomeOperatore.toLowerCase() === compilerName.toLowerCase()
    );
    if (!def) return;

    setSavedSignatures((prev) =>
      prev.map((s) =>
        s.nomeOperatore.toLowerCase() === compilerName.toLowerCase() ? { ...def } : s
      )
    );

    if (report.compilatore?.toLowerCase().includes(compilerName.toLowerCase())) {
      setReport((r) => ({ ...r, firmaImmagineUrl: def.immagineUrl }));
    }

    try {
      const safeDocId = 'sig_' + encodeURIComponent(compilerName.toLowerCase()).replace(/[^a-zA-Z0-9_-]/g, '_');
      await setDoc(doc(db, 'saved_signatures', safeDocId), {
        nomeOperatore: compilerName,
        label: def.label,
        immagineUrl: def.immagineUrl,
        isDefault: def.isDefault ?? false,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // ignore
    }

    showNotice(`Firma per "${compilerName}" ripristinata al valore originale.`);
  };

  const handleTriggerSignatureRecovery = () => {
    const recovered = recoverSavedSignatures();
    setSavedSignatures(recovered);

    // Salva ciascuna su Firestore se non presente
    recovered.forEach(async (sig) => {
      try {
        const safeDocId = 'sig_' + encodeURIComponent(sig.nomeOperatore.toLowerCase()).replace(/[^a-zA-Z0-9_-]/g, '_');
        await setDoc(doc(db, 'saved_signatures', safeDocId), {
          nomeOperatore: sig.nomeOperatore,
          label: sig.label,
          immagineUrl: sig.immagineUrl,
          isDefault: sig.isDefault ?? false,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // ignore
      }
    });

    // Se il compilatore corrente corrisponde a uno dei 3, riapplica la firma recuperata
    const compName = report.compilatore?.trim();
    if (compName) {
      const matched = recovered.find(
        (s) =>
          s.nomeOperatore.toLowerCase() === compName.toLowerCase() ||
          compName.toLowerCase().includes(s.nomeOperatore.toLowerCase())
      );
      if (matched) {
        setReport((r) => ({ ...r, firmaImmagineUrl: matched.immagineUrl }));
      }
    }

    showNotice(`Scansione completata: ${recovered.length} firme sincronizzate con successo!`);
  };

  const removeSavedSignature = (id: string) => {
    setSavedSignatures((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target && report.firmaImmagineUrl === target.immagineUrl) {
        setReport((r) => ({ ...r, firmaImmagineUrl: '' }));
      }
      return prev.filter((s) => s.id !== id);
    });
    showNotice('Firma rimossa dall\'archivio.');
  };

  const handleSignatureUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetOperatorName?: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await processSignatureImageFile(file);
      const opName =
        targetOperatorName ||
        report.compilatore ||
        roster.find((r) => r.isCompilatore)?.nomeCognome ||
        'Andrea Menegotto';
      await addSavedSignature(opName, `Firma Scansionata - ${opName}`, processed);
    } catch (err) {
      console.error('Errore caricamento firma:', err);
      showNotice('Errore durante il caricamento dell\'immagine della firma.');
    }
    e.target.value = '';
  };

  const moveRosterMember = (id: string, direction: 'up' | 'down') => {
    hasUserEditedDraftRef.current = true;
    setRoster((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, moved);

      setReport((rep) => ({
        ...rep,
        squadra: alignSquadraToRosterOrder(rep.squadra, copy),
      }));

      try {
        localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(copy));
      } catch {
        // ignore
      }

      return copy;
    });
  };

  const updateRosterMember = (
    id: string,
    field: keyof Omit<RosterMember, 'id'>,
    value: string
  ) => {
    setRoster((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );

    setReport((prev) => ({
      ...prev,
      squadra: prev.squadra.map((m) => {
        if (m.id !== id) return m;
        if (field === 'nomeCognome') return { ...m, nomeCognome: value };
        if (field === 'nickname') return { ...m, nickname: value };
        if (field === 'qualifica') return { ...m, qualifica: value };
        return m;
      }),
    }));
  };

  const addNewRosterMember = () => {
    const newId = `ros-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newMember: RosterMember = {
      id: newId,
      nomeCognome: '',
      nickname: '',
      qualifica: 'Angelo semplice',
      orarioServizio: '',
      isPresente: true,
      isCaposervizio: false,
      isCompilatore: false,
    };
    setRoster((prev) => [...prev, newMember]);
    setReport((prev) => ({
      ...prev,
      squadra: [
        ...prev.squadra,
        {
          id: newId,
          nomeCognome: '',
          nickname: '',
          qualifica: 'Angelo semplice',
          orarioServizio: '',
          isCaposervizio: false,
          isCompilatore: false,
        },
      ],
    }));
    showNotice('Nuovo operatore aggiunto in fondo alla tabella.');
  };

  const removeRosterMember = (id: string) => {
    setRoster((prev) => prev.filter((item) => item.id !== id));
    setReport((prev) => ({
      ...prev,
      squadra: prev.squadra.filter((m) => m.id !== id),
    }));
  };

  // Gestione Aperture Sbarra Inizio Servizio
  const updateBarrierEntry = (index: 0 | 1, field: 'ora' | 'targa', val: string) => {
    setReport((prev) => {
      const copy: [typeof prev.apertureSbarraInizio[0], typeof prev.apertureSbarraInizio[1]] = [
        { ...prev.apertureSbarraInizio[0] },
        { ...prev.apertureSbarraInizio[1] },
      ];
      copy[index][field] = val;
      return { ...prev, apertureSbarraInizio: copy };
    });
  };

  // Funzioni di gestione Targhe Mezzi Fisse
  const handlePrecompileFixedPlates = () => {
    const def1 =
      savedPlates.find((p) => p.isDefaultSbarra1)?.targa ||
      savedPlates[0]?.targa ||
      '';
    const def2 =
      savedPlates.find((p) => p.isDefaultSbarra2)?.targa ||
      (savedPlates.length > 1 ? savedPlates[1]?.targa : '');

    setReport((prev) => ({
      ...prev,
      apertureSbarraInizio: [
        { ...prev.apertureSbarraInizio[0], targa: def1 },
        { ...prev.apertureSbarraInizio[1], targa: def2 },
      ],
    }));
    showNotice(
      `Targhe fisse applicate: Sbarra 1 = ${def1 || '—'}${
        def2 ? `, Sbarra 2 = ${def2}` : ''
      }`
    );
  };

  const addSavedPlate = (
    targa: string,
    label = '',
    isDefault1 = false,
    isDefault2 = false
  ) => {
    const cleanTarga = targa.trim().toUpperCase();
    if (!cleanTarga) {
      showNotice('Inserisci un numero di targa valido.');
      return;
    }
    setSavedPlates((prev) => {
      const exists = prev.find((p) => p.targa === cleanTarga);
      if (exists) {
        showNotice(`La targa "${cleanTarga}" è già memorizzata.`);
        return prev.map((p) =>
          p.targa === cleanTarga
            ? {
                ...p,
                label: label.trim() || p.label,
                isDefaultSbarra1: isDefault1 ? true : p.isDefaultSbarra1,
                isDefaultSbarra2: isDefault2 ? true : p.isDefaultSbarra2,
              }
            : p
        );
      }
      const updated = prev.map((p) => ({
        ...p,
        isDefaultSbarra1: isDefault1 ? false : p.isDefaultSbarra1,
        isDefaultSbarra2: isDefault2 ? false : p.isDefaultSbarra2,
      }));
      const newEntry: SavedLicensePlate = {
        id: `plate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        targa: cleanTarga,
        label: label.trim() || undefined,
        isDefaultSbarra1: isDefault1,
        isDefaultSbarra2: isDefault2,
      };
      return [...updated, newEntry];
    });
    setNewPlateInput('');
    setNewPlateLabel('');
    setNewPlateDef1(false);
    setNewPlateDef2(false);
    showNotice(`Targa fissa "${cleanTarga}" memorizzata con successo.`);
  };

  const removeSavedPlate = (id: string) => {
    setSavedPlates((prev) => prev.filter((p) => p.id !== id));
    showNotice('Targa rimossa dalla memoria.');
  };

  const togglePlateDefault = (id: string, sbarra: 1 | 2) => {
    setSavedPlates((prev) => {
      const target = prev.find((p) => p.id === id);
      if (!target) return prev;
      const key = sbarra === 1 ? 'isDefaultSbarra1' : 'isDefaultSbarra2';
      const newVal = !target[key];
      return prev.map((p) => {
        if (p.id === id) {
          return { ...p, [key]: newVal };
        }
        return newVal ? { ...p, [key]: false } : p;
      });
    });
    showNotice(`Targa predefinita per Sbarra ${sbarra} aggiornata.`);
  };

  // Rilevazioni
  const addRilevazione = () => {
    hasUserEditedDraftRef.current = true;
    const newRil: RilevazioneItem = {
      id: `ril-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      luogoIndividuazione: '',
      descrizione: '',
      numeroUtenti: 0,
      aggancioEffettuato: false,
      nominativiAssociati: [],
      operatoriCoinvolti: [],
      foto: [],
    };
    setReport((prev) => ({
      ...prev,
      rilevazioni: [...(prev.rilevazioni || []), newRil],
    }));
    showNotice('Aggiunto punto di rilevazione.');
  };

  const moveRilevazione = (index: number, direction: 'up' | 'down') => {
    hasUserEditedDraftRef.current = true;
    setReport((prev) => {
      const list = prev.rilevazioni || [];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      const copy = [...list];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return { ...prev, rilevazioni: copy };
    });
  };

  const updateRilevazione = <K extends keyof RilevazioneItem>(
    id: string,
    field: K,
    value: RilevazioneItem[K]
  ) => {
    hasUserEditedDraftRef.current = true;
    setReport((prev) => ({
      ...prev,
      rilevazioni: (prev.rilevazioni || []).map((r) =>
        r.id === id ? { ...r, [field]: value } : r
      ),
    }));
  };

  const removeRilevazione = (id: string) => {
    hasUserEditedDraftRef.current = true;
    const list = report.rilevazioni || [];
    const targetIndex = list.findIndex((r) => r.id === id);
    const alpha = targetIndex >= 0 ? indexToAlpha(targetIndex).toUpperCase() : '';

    setReport((prev) => {
      const currentList = prev.rilevazioni || [];
      const remaining = currentList.filter((r) => r.id !== id);
      return {
        ...prev,
        rilevazioni: remaining,
      };
    });

    showNotice(alpha ? `Punto ${alpha} eliminato.` : 'Punto eliminato.');
  };

  const handlePhotoUpload = async (
    rilevazioneId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    hasUserEditedDraftRef.current = true;
    const newPhotos: PhotoAttachment[] = [];
    for (const file of files) {
      const dataUrl = await processImageFile(file);
      newPhotos.push({
        id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        dataUrl,
      });
    }

    setReport((prev) => ({
      ...prev,
      rilevazioni: (prev.rilevazioni || []).map((r) =>
        r.id === rilevazioneId ? { ...r, foto: [...(r.foto || []), ...newPhotos] } : r
      ),
    }));

    e.target.value = '';
  };

  const removePhoto = (rilevazioneId: string, photoId: string) => {
    hasUserEditedDraftRef.current = true;
    setReport((prev) => ({
      ...prev,
      rilevazioni: (prev.rilevazioni || []).map((r) =>
        r.id === rilevazioneId
          ? { ...r, foto: (r.foto || []).filter((p) => p.id !== photoId) }
          : r
      ),
    }));
  };

  // Upload Logo Unico (opzionale con fedeltà ad alta risoluzione)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await processLogoImageFile(file);
    setCorporate((prev) => ({
      ...prev,
      logoUrl: dataUrl,
    }));
    showNotice('Logo ufficiale ad alta risoluzione caricato con successo.');
  };

  const [isSavingToDrive, setIsSavingToDrive] = useState<boolean>(false);
  const [isSyncingHistoryDrive, setIsSyncingHistoryDrive] = useState<boolean>(false);

  const handleSyncHistoryFromDrive = async () => {
    try {
      setIsSyncingHistoryDrive(true);
      let token = await getAccessToken();
      if (!token) {
        try {
          const authRes = await googleSignIn();
          if (authRes?.accessToken) {
            token = authRes.accessToken;
            setIsDriveLoggedIn(true);
            setDriveUser(authRes.user);
          }
        } catch (loginErr: any) {
          showNotice(loginErr?.message || 'Accesso Google necessario per sincronizzare i report da Google Drive.');
          return;
        }
      }
      if (!token) {
        showNotice('Accesso Google non completato.');
        return;
      }
      const savedFolderUrl = getStoredDriveFolderUrl() || DEFAULT_SHARED_DRIVE_FOLDER_URL;
      const folderId = extractDriveFolderId(savedFolderUrl) || DEFAULT_SHARED_DRIVE_FOLDER_ID;
      const { files, reports } = await loadHistoricalReportsFromDriveFolder(folderId);
      setDriveFilesList(files);
      const merged = mergeReportEntries(historyReports, reports);
      setHistoryReports(merged);
      try {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
      } catch {
        // ignore
      }
      const userLabel =
        driveUser?.displayName
          ? `${driveUser.displayName} (${driveUser.email || ''})`.trim()
          : (driveUser?.email || 'Google Drive Sync');
      pushSharedArchiveToCloud(merged, userLabel).catch(() => {});
      const hasReport36 = merged.some((e) => {
        const key = getReportNormalizedKey(e);
        return key === '2026-36' || (Number(e.report?.numeroReport) === 36 && !(e.report?.data || '').startsWith('2025'));
      });
      showNotice(
        `Google Drive sincronizzato: ${files.length} file rilevati, ${reports.length} report identificati. Storico aggiornato a ${merged.length} report${hasReport36 ? ' (Report 36 incluso)' : ''}.`
      );
    } catch (err: any) {
      console.error('Errore sincronizzazione Google Drive storico:', err);
      showNotice(err?.message || 'Errore durante la sincronizzazione da Google Drive.');
    } finally {
      setIsSyncingHistoryDrive(false);
    }
  };

  const [isDriveConnecting, setIsDriveConnecting] = useState<boolean>(false);

  const handleDriveToggleConnect = async () => {
    if (isDriveLoggedIn) {
      try {
        await logoutGoogle();
        setIsDriveLoggedIn(false);
        setDriveUser(null);
        showNotice('Google Drive disconnesso.');
      } catch (err: any) {
        console.warn('Errore disconnessione Drive:', err);
      }
    } else {
      try {
        setIsDriveConnecting(true);
        const res = await googleSignIn();
        if (res?.accessToken) {
          setIsDriveLoggedIn(true);
          setDriveUser(res.user);
          showNotice(`Google Drive connesso con successo (${res.user.email || res.user.displayName}).`);
          const savedFolderUrl = getStoredDriveFolderUrl();
          const folderId = extractDriveFolderId(savedFolderUrl);
          if (folderId) {
            const { files, reports } = await loadHistoricalReportsFromDriveFolder(folderId);
            setDriveFilesList(files);
            if (reports.length > 0) {
              setHistoryReports((prev) => {
                const merged = mergeReportEntries(prev, reports);
                const userLabel =
                  res.user?.displayName
                    ? `${res.user.displayName} (${res.user.email || ''})`.trim()
                    : (res.user?.email || 'Google Drive Sync');
                pushSharedArchiveToCloud(merged, userLabel).catch(() => {});
                return merged;
              });
            }
          }
        }
      } catch (err: any) {
        showNotice(err?.message || 'Accesso Google Drive non completato.');
      } finally {
        setIsDriveConnecting(false);
      }
    }
  };

  const handleDriveQuickConnect = handleDriveToggleConnect;

  // Archiviazione diretta nella sottocartella 2026 di Google Drive
  const handleArchiveToDrive2026 = async () => {
    try {
      setIsSavingToDrive(true);
      const savedFolderUrl = getStoredDriveFolderUrl() || DEFAULT_SHARED_DRIVE_FOLDER_URL;
      const folderId = extractDriveFolderId(savedFolderUrl) || DEFAULT_SHARED_DRIVE_FOLDER_ID;

      let token = await getAccessToken();
      if (!token) {
        try {
          const authRes = await googleSignIn();
          if (authRes?.accessToken) {
            token = authRes.accessToken;
            setIsDriveLoggedIn(true);
            setDriveUser(authRes.user);
          }
        } catch (loginErr: any) {
          setActiveTab('drive');
          showNotice(loginErr?.message || 'Effettua prima l\'accesso con Google per archiviare nella cartella Google Drive.');
          return;
        }
      }

      if (!token) {
        setActiveTab('drive');
        showNotice('Effettua prima l\'accesso con Google nella scheda Google Drive per archiviare nella cartella.');
        return;
      }

      if (!folderId) {
        setActiveTab('drive');
        showNotice('Cartella Google Drive non configurata. Verifica il collegamento nella scheda Google Drive.');
        return;
      }

      const { blob: pdfBlob, fileName: pdfFileName } = await generateReportPdfBlob(
        report,
        corporate,
        totalSubjects,
        totalEngagements
      );

      const localEntry = saveCurrentReportToHistory(false);

      const { pdfFile, jsonFile, targetFolderName } = await archiveReportToSharedDriveFolder(
        folderId,
        localEntry,
        pdfBlob,
        pdfFileName,
        '2026'
      );

      setDriveFilesList((prev) => [pdfFile, jsonFile, ...prev]);
      showNotice(
        `Report archiviato con successo nella sottocartella "${targetFolderName}" di Google Drive: "${pdfFile.name}" e "${jsonFile.name}".`
      );
      try {
        const { files, reports } = await loadHistoricalReportsFromDriveFolder(folderId);
        setDriveFilesList(files);
        if (reports.length > 0) {
          setHistoryReports((prev) => {
            const merged = mergeReportEntries(prev, reports);
            try {
              localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
            } catch {
              // ignore
            }
            pushSharedArchiveToCloud(merged, 'Google Drive Sincronizzazione').catch(() => {});
            return merged;
          });
        }
      } catch {
        // ignore
      }
    } catch (err: any) {
      console.error(err);
      showNotice(err?.message || 'Errore durante il salvataggio nella cartella Google Drive.');
    } finally {
      setIsSavingToDrive(false);
    }
  };

  // Generazione e Stampa PDF con archiviazione automatica su Drive 2026 se connesso
  const handleGeneratePdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const fileName = await generateAndDownloadReportPdf(
        report,
        corporate,
        totalSubjects,
        totalEngagements
      );

      // Salva e archivia SEMPRE il report nello storico dell'app e nel Cloud Firestore (immediatamente sincronizzato tra PC e Android)
      const localEntry = saveCurrentReportToHistory(false);

      // Se Google Drive è configurato con token e cartella, archivia automaticamente anche nella sottocartella 2026 di Drive
      const savedFolderUrl = getStoredDriveFolderUrl() || DEFAULT_SHARED_DRIVE_FOLDER_URL;
      const folderId = extractDriveFolderId(savedFolderUrl) || DEFAULT_SHARED_DRIVE_FOLDER_ID;
      const token = await getAccessToken();

      if (token && folderId) {
        try {
          const { blob: pdfBlob } = await generateReportPdfBlob(
            report,
            corporate,
            totalSubjects,
            totalEngagements
          );
          const { pdfFile, jsonFile, targetFolderName } = await archiveReportToSharedDriveFolder(
            folderId,
            localEntry,
            pdfBlob,
            fileName,
            '2026'
          );
          setDriveFilesList((prev) => [pdfFile, jsonFile, ...prev]);
          showNotice(`PDF salvato e archiviato nella sottocartella "${targetFolderName}" di Google Drive e sincronizzato in Cloud per tutti i dispositivi!`);
          return;
        } catch (driveErr) {
          console.warn('Auto-salvataggio su Google Drive fallito:', driveErr);
        }
      }

      showNotice(`PDF generato e scaricato: "${fileName}". Report archiviato e sincronizzato nel Cloud per tutti i dispositivi (PC e Android)!`);
    } catch (err) {
      console.error(err);
      showNotice('Errore durante la generazione del PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Salva nello storico locale
  const saveCurrentReportToHistory = (downloadJson = false) => {
    const safeNum = String(report.numeroReport ?? 36).padStart(2, '0');
    const safeDate = (report.data || 'servizio').replace(/-/g, '.');
    const fileName = `${safeNum}_Report_Servizio_MXP_${safeDate}.json`;
    const newEntry: HistoricalReportEntry = {
      id: `hist-${Date.now()}`,
      savedAt: new Date().toISOString(),
      fileName,
      report: JSON.parse(JSON.stringify(report)),
    };

    setHistoryReports((prev) => {
      const merged = mergeReportEntries(prev, [newEntry]);
      const userLabel = resolveAuthorName(report, driveUser, roster, activeOperator);
      pushSharedArchiveToCloud(merged, userLabel).catch(() => {});
      return merged;
    });

    if (downloadJson) {
      const blob = new Blob([JSON.stringify(newEntry, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotice(`Report archiviato e scaricato come "${fileName}".`);
    } else {
      showNotice('Report archiviato nello storico locale.');
    }
    return newEntry;
  };

  const handleForcePushToCloud = async () => {
    setIsCloudSyncingLive(true);
    try {
      const userLabel = resolveAuthorName(report, driveUser, roster, activeOperator);
      const saved = await pushDraftToCloudImmediate(report, userLabel);
      currentReportRef.current = report;
      lastAppliedRemoteHashRef.current = JSON.stringify(report);
      setLastDraftSyncInfo({ by: userLabel, at: saved.updatedAtIso });
      showNotice('Bozza sincronizzata con successo in tempo reale su Cloud Firestore per tutti i dispositivi!');
    } catch (err: any) {
      showNotice('Errore invio bozza al Cloud: ' + (err?.message || 'errore di connessione'));
    } finally {
      setIsCloudSyncingLive(false);
    }
  };

  const handleForcePullFromCloud = async () => {
    setIsCloudSyncingLive(true);
    try {
      const cloudData = await fetchDraftFromCloud();
      if (cloudData && cloudData.report) {
        const serialized = JSON.stringify(cloudData.report);
        lastAppliedRemoteHashRef.current = serialized;
        isApplyingRemoteReportRef.current = true;
        setReport(cloudData.report);
        currentReportRef.current = cloudData.report;
        setLastDraftSyncInfo({ by: cloudData.updatedBy, at: cloudData.updatedAtIso });
        localStorage.setItem(STORAGE_KEY_REPORT, serialized);
        showNotice(`Bozza aggiornata dal Cloud! Ultima modifica di ${cloudData.updatedBy}.`);
      } else {
        showNotice('Nessuna bozza presente sul Cloud.');
      }
    } catch (err: any) {
      showNotice('Errore recupero bozza dal Cloud: ' + (err?.message || 'errore di connessione'));
    } finally {
      setIsCloudSyncingLive(false);
    }
  };

  // Calcolo dinamico del prossimo numero progressivo in base a tutto lo storico archiviato
  const getNextProgressiveReportNumber = (): number => {
    const archivedNums: number[] = (historyReports || [])
      .map((entry) => {
        const n = Number(entry.report?.numeroReport);
        if (Number.isFinite(n) && n > 0) return n;
        const match = entry.fileName?.match(/(?:^|n\.?|report_servizio_mxp_)(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => Number.isFinite(n) && n > 0);

    const maxArchived = archivedNums.length > 0 ? Math.max(...archivedNums) : 36;
    const currentNum = Number(report.numeroReport) || 0;

    const baseMax = Math.max(maxArchived, currentNum);
    return baseMax > 0 ? baseMax + 1 : 37;
  };

  // Verifica se il report corrente è già archiviato e se è identico o presenta modifiche
  const isCurrentReportArchivedInHistory = (rep: ServiceReportData = report): {
    isArchived: boolean;
    isIdentical: boolean;
    entry?: HistoricalReportEntry;
  } => {
    const currentKey = getReportNormalizedKey({
      id: 'check-current',
      savedAt: '',
      report: rep,
    });
    const found = (historyReports || []).find(
      (e) => getReportNormalizedKey(e) === currentKey
    );
    if (!found) {
      return { isArchived: false, isIdentical: false };
    }
    const isIdentical = JSON.stringify(found.report) === JSON.stringify(rep);
    return { isArchived: true, isIdentical, entry: found };
  };

  // Caricamento sicuro di un report storico nell'editor: protegge e archivia la bozza corrente se modificata
  const handleLoadHistoricalReportToEditor = (targetReport: ServiceReportData) => {
    const curNum = Number(report.numeroReport) || 0;
    const targetNum = Number(targetReport.numeroReport) || 0;
    const archiveStatus = isCurrentReportArchivedInHistory(report);
    if (!archiveStatus.isIdentical) {
      try {
        saveCurrentReportToHistory(false);
      } catch (err) {
        console.warn('Avviso archiviazione automatica:', err);
      }
    }
    hasUserEditedDraftRef.current = false;
    setReport(JSON.parse(JSON.stringify(targetReport)));
    setActiveTab('form');
    showNotice(
      !archiveStatus.isIdentical
        ? `Bozza attiva (Report N. ${curNum || '—'}) salvata automaticamente nello storico. Caricato il Report N. ${targetNum || '—'} nell'editor.`
        : `Dati del Report N. ${targetNum || '—'} del ${formatDateIT(targetReport.data)} caricati nell'editor.`
    );
  };

  const handleManualHistoryReportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseUploadedReportFile(file);
      const rep = parsed.report;
      const repNum = rep.numeroReport || 0;
      const is2025 = (rep.data || '').startsWith('2025') || file.name.includes('2025');
      const targetYear = is2025 ? '2025' : '2026';
      const targetKey = `${targetYear}-${repNum}`;

      const existing = historyReports.find((h) => getReportNormalizedKey(h) === targetKey);

      const updatedEntry: HistoricalReportEntry = {
        id: existing ? existing.id : `uploaded-${Date.now()}`,
        savedAt: new Date().toISOString(),
        fileName: file.name,
        report: rep,
        driveFileId: existing?.driveFileId,
        driveWebViewLink: existing?.driveWebViewLink,
        driveWebContentLink: existing?.driveWebContentLink,
      };

      const merged = mergeReportEntries(historyReports, [updatedEntry]);
      setHistoryReports(merged);
      try {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
      } catch {
        // ignore
      }
      const userLabel = resolveAuthorName(report, driveUser, roster, activeOperator);
      await pushSharedArchiveToCloud(merged, userLabel);
      showNotice(
        `✅ Report N. ${repNum} (${formatDateIT(rep.data)}) importato e certificato! Presenze totali lette: ${parsed.extractedPresenze}. Sincronizzato sul Cloud!`
      );
    } catch (err: any) {
      showNotice(`Errore caricamento file report: ${err?.message || 'formato non valido'}`);
    }
  };

  const handleOpenNewReportModal = () => {
    const nextNum = getNextProgressiveReportNumber();
    setNewReportTargetNumber(nextNum);
    const archiveStatus = isCurrentReportArchivedInHistory(report);
    // Se è già archiviato ed identico nello storico locale, non serve archiviare di nuovo;
    // Se non è ancora archiviato o è stato modificato, attiva di default l'archiviazione
    setAutoArchiveCurrentBeforeReset(!archiveStatus.isIdentical);
    setIsNewReportModalOpen(true);
  };

  const handleConfirmNewCleanReport = () => {
    if (autoArchiveCurrentBeforeReset) {
      const archiveStatus = isCurrentReportArchivedInHistory(report);
      // Archivia solo se non è già identico nello storico locale
      if (!archiveStatus.isIdentical) {
        try {
          saveCurrentReportToHistory(false);
        } catch (err) {
          console.warn('Avviso archiviazione automatica:', err);
        }
      }
    }

    const nextNum = Math.max(1, Number(newReportTargetNumber) || getNextProgressiveReportNumber());

    const cleanReport: ServiceReportData = {
      numeroReport: nextNum,
      luogo: TESTO_FISSO_LUOGO,
      riferimentiCO: TESTO_FISSO_RIFERIMENTI_EMERGENZE,
      data: '',
      oraInizio: '',
      oraFine: '',
      orarioTestoLibero: '',
      orariServizio: [
        {
          id: `slot-${Date.now()}`,
          oraInizio: '',
          oraFine: '',
          descrizione: '',
        },
      ],
      apertureSbarraInizio: [
        { ora: '', targa: '' },
        { ora: '', targa: '' },
      ],
      luogoTermineFisso: TESTO_FISSO_LUOGO_TERMINE,
      comunicazioneInizioCO: '',
      comunicazioneFineCO: '',
      caposervizio: '',
      compilatore: activeOperator || 'Andrea Menegotto',
      firmaImmagineUrl: (() => {
        const targetOp = activeOperator || 'Andrea Menegotto';
        const s = savedSignatures.find(
          (sig) =>
            sig.nomeOperatore.trim().toLowerCase() === targetOp.toLowerCase() ||
            targetOp.toLowerCase().includes(sig.nomeOperatore.trim().toLowerCase())
        );
        return s ? s.immagineUrl : '';
      })(),
      squadra: (roster && roster.length > 0 ? roster : DEFAULT_ROSTER).map((r) => {
        const isMatch = r.nomeCognome?.trim().toLowerCase() === (activeOperator || 'Andrea Menegotto').toLowerCase();
        return {
          id: r.id,
          nomeCognome: r.nomeCognome,
          nickname: r.nickname,
          qualifica: r.qualifica,
          orarioServizio: '',
          note: '',
          isCaposervizio: false,
          isCompilatore: isMatch,
          isPresente: isMatch ? true : r.isPresente,
        };
      }),
      personaleEsternoAffiancamento: '',
      rilevazioni: [
        {
          id: `ril-${Date.now()}`,
          luogoIndividuazione: '',
          descrizione: '',
          numeroUtenti: 0,
          aggancioEffettuato: false,
          nominativiAssociati: [],
          operatoriCoinvolti: [],
          foto: [],
        },
      ],
      richiesteEmergenzaCOPS: '',
      richiesteEmergenzaCOSEA: '',
      richiesteEmergenzaProntoSoccorsoMXP: '',
      richiesteEmergenza: '',
      richiesteNonUrgenti: '',
      note: '',
      osservazioni: '',
    };

    hasHydratedCloudDraftRef.current = true;
    hasUserEditedDraftRef.current = true;
    setReport(cleanReport);
    currentReportRef.current = cleanReport;
    try {
      localStorage.setItem(STORAGE_KEY_REPORT, JSON.stringify(cleanReport));
    } catch {
      // ignore
    }

    // Propaga immediatamente il nuovo report pulito a tutti i dispositivi connessi (PC e smartphone Android)
    const userLabel = resolveAuthorName(cleanReport, driveUser, roster, activeOperator);
    pushDraftToCloudImmediate(cleanReport, userLabel).catch((err) => {
      console.warn('Errore propagazione nuovo report su Cloud:', err);
    });

    setIsNewReportModalOpen(false);
    setActiveTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showNotice(
      `Nuovo Report N. ${nextNum} pronto! Tutti i campi sono stati azzerati per iniziare una nuova compilazione.`
    );
  };

  const handleDeleteReportConfirmed = async () => {
    if (!reportToDelete) return;
    setIsDeletingReport(true);
    try {
      const repNum = reportToDelete.report.numeroReport ?? 0;
      const repDate = reportToDelete.report.data;
      let driveDetails = '';

      if (deleteFromDriveChecked) {
        const folderUrl = getStoredDriveFolderUrl();
        const folderId = extractDriveFolderId(folderUrl);
        try {
          const { deletedNames } = await deleteReportFilesFromDrive(
            folderId,
            repNum,
            repDate,
            reportToDelete.id
          );
          if (deletedNames.length > 0) {
            driveDetails = ` e rimossi ${deletedNames.length} file da Google Drive (${deletedNames.slice(0, 3).join(', ')})`;
            setDriveFilesList((prev) =>
              prev.filter((f) => {
                const lower = f.name.toLowerCase();
                return (
                  !lower.includes(`n${repNum}_`) &&
                  !lower.includes(`n.${repNum}`) &&
                  !lower.includes(repDate || '')
                );
              })
            );
          } else {
            driveDetails = ' (nessun file associato trovato su Google Drive)';
          }
        } catch (driveErr: any) {
          console.warn('Avviso eliminazione Google Drive:', driveErr);
          driveDetails = ` (avviso Google Drive: ${driveErr?.message || 'non eliminato da Drive'})`;
        }
      }

      setHistoryReports((prev) => {
        const targetKey = getReportNormalizedKey(reportToDelete);
        const updated = prev.filter(
          (item) => item.id !== reportToDelete.id && getReportNormalizedKey(item) !== targetKey
        );
        try {
          localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        const userLabel =
          driveUser?.displayName
            ? `${driveUser.displayName} (${driveUser.email || ''})`.trim()
            : (driveUser?.email || 'Collaboratore');
        pushSharedArchiveToCloud(updated, userLabel).catch(() => {});
        return updated;
      });

      showNotice(`Report N. ${repNum || '—'} del ${formatDateIT(repDate)} eliminato dallo storico${driveDetails}.`);
      setReportToDelete(null);
    } catch (err: any) {
      showNotice(`Errore durante l'eliminazione: ${err?.message || err}`);
    } finally {
      setIsDeletingReport(false);
    }
  };

  const handleDownloadDriveOriginalFile = async (entry: HistoricalReportEntry) => {
    const repNum = Number(entry.report?.numeroReport) || 0;
    const is2025 = (entry.report?.data || '').startsWith('2025') || (entry.fileName || '').includes('2025');
    const targetYear = is2025 ? '2025' : '2026';

    let driveFileId =
      entry.driveFileId ||
      (entry.id.startsWith('drive-') ? entry.id.replace(/^drive-(?:doc-)?/, '') : '');

    // Se l'id non è diretto da drive, cerca nei file scansionati da Google Drive
    if (!driveFileId && driveFilesList.length > 0) {
      const match = driveFilesList.find((f) => {
        const fn = f.name.toLowerCase();
        const fp = (f.folderPath || '').toLowerCase();
        const fYear = fp.includes('2025') || fn.includes('2025') ? '2025' : '2026';
        if (fYear !== targetYear) return false;
        const numMatch =
          fn.match(/(?:report|servizio|turno|verbale|n|num|n°|no)[._\s-]*(\d+)/i) ||
          fn.match(/^(\d+)[._\s-]/) ||
          fn.match(/[._\s-](\d+)(?:\.pdf|\.docx|\.doc|\.json|$)/i) ||
          fn.match(/(\d+)/);
        const num = numMatch ? parseInt(numMatch[1], 10) : 0;
        return num === repNum;
      });
      if (match) {
        driveFileId = match.id;
      }
    }

    let token = await getAccessToken();
    if (!token) {
      try {
        const authRes = await googleSignIn();
        token = authRes?.accessToken || null;
        if (token) {
          setIsDriveLoggedIn(true);
          setDriveUser(authRes?.user);
        }
      } catch {
        // ignore
      }
    }

    if (token && driveFileId) {
      try {
        setIsGeneratingPdf(true);
        showNotice(`Scaricamento del file originale N. ${repNum} da Google Drive in corso...`);
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media&supportsAllDrives=true`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const cleanName =
            entry.fileName?.replace(/^\[.*?\]\s*/, '') ||
            `Report_Servizio_N${repNum}_${targetYear}.pdf`;
          a.download = cleanName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showNotice(`File originale "${cleanName}" scaricato con successo da Google Drive!`);
          return;
        }
      } catch (err: any) {
        console.warn('Errore download da Drive:', err);
      } finally {
        setIsGeneratingPdf(false);
      }
    }

    // Se non scaricabile tramite API (o senza autenticazione), apri direttamente il collegamento PDF in Google Drive
    const targetUrl = driveFileId
      ? `https://drive.google.com/file/d/${driveFileId}/view`
      : entry.driveWebViewLink || (getStoredDriveFolderUrl() || DEFAULT_SHARED_DRIVE_FOLDER_URL);

    const anchor = document.createElement('a');
    anchor.href = targetUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    showNotice(`Apertura file originale del Report N. ${repNum} in Google Drive.`);
  };

  const handlePrintHistoryEntry = async (entry: HistoricalReportEntry) => {
    const is2025 = (entry.report?.data || '').startsWith('2025') || (entry.fileName || '').includes('2025');
    const isHistoricalUpTo36 = is2025 || (Number(entry.report?.numeroReport) <= 36);

    // Per i report fino al 36 si fa riferimento solo ed esclusivamente al file originale archiviato su Google Drive
    if (isHistoricalUpTo36) {
      await handleDownloadDriveOriginalFile(entry);
      return;
    }

    try {
      setIsGeneratingPdf(true);
      const rep = entry.report;
      const totSub = (rep.rilevazioni || []).reduce(
        (sum, r) => sum + (Number(r.numeroUtenti) || 0),
        0
      );
      const totEng = (rep.rilevazioni || []).filter((r) => r.aggancioEffettuato).length;
      await generateAndDownloadReportPdf(rep, corporate, totSub, totEng);
      showNotice(`PDF per Report N. ${rep.numeroReport ?? '—'} scaricato con successo!`);
    } catch (err: any) {
      showNotice(`Errore generazione PDF: ${err?.message || err}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const filteredHistoryReports = useMemo(() => {
    return historyReports.filter((entry) => {
      const rep = entry.report;
      const key = getReportNormalizedKey(entry);
      const is2025 = key.startsWith('2025');
      const is2026 = key.startsWith('2026') || !is2025;

      if (historyYearFilter === '2026' && !is2026) return false;
      if (historyYearFilter === '2025' && !is2025) return false;

      if (!historySearch.trim()) return true;
      const query = historySearch.toLowerCase().trim();
      const repNumStr = String(rep.numeroReport ?? '');
      const dateStr = rep.data || '';
      const dateItStr = formatDateIT(rep.data).toLowerCase();
      const capoStr = (rep.caposervizio || '').toLowerCase();
      const compStr = (rep.compilatore || '').toLowerCase();
      const notesStr = (rep.note || '').toLowerCase();
      const obsStr = (rep.osservazioni || '').toLowerCase();
      const rilStr = (rep.rilevazioni || [])
        .map((r) => `${r.luogoIndividuazione} ${r.descrizione}`)
        .join(' ')
        .toLowerCase();

      return (
        repNumStr.includes(query) ||
        dateStr.includes(query) ||
        dateItStr.includes(query) ||
        capoStr.includes(query) ||
        compStr.includes(query) ||
        notesStr.includes(query) ||
        obsStr.includes(query) ||
        rilStr.includes(query)
      );
    });
  }, [historyReports, historyYearFilter, historySearch]);

  const historyCounts = useMemo(() => {
    let count2026 = 0;
    let count2025 = 0;
    historyReports.forEach((entry) => {
      const key = getReportNormalizedKey(entry);
      if (key.startsWith('2025')) count2025++;
      else count2026++;
    });
    return { all: historyReports.length, y2026: count2026, y2025: count2025 };
  }, [historyReports]);

  const assoc = corporate.associazione || DEFAULT_ASSOCIAZIONE_CONFIG;
  const coop = corporate.cooperativa || DEFAULT_COOPERATIVA_CONFIG;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
      {/* TOP NAVIGATION BAR */}
      <header className="no-print sticky top-0 z-40 bg-slate-900 text-white border-b-2 border-[#df0a14] px-6 py-3 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <CityAngelsLogo size={36} customUrl={corporate.logoUrl} />
          <div>
            <span className="text-base font-bold tracking-tight text-white block">
              City Angels Varese
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono-tabular">
                Report di Servizio Aeroporto MXP · N. {report.numeroReport ?? 36}
              </span>
              <button
                type="button"
                onClick={() => {
                  fetchDraftFromCloud()
                    .then((d) => {
                      if (d && d.report) {
                        applyIncomingRemoteDraftRef.current(d);
                        showNotice(`Bozza sincronizzata dal Cloud: Report N. ${d.report.numeroReport || 38}`);
                      } else {
                        showNotice('Bozza Cloud già allineata.');
                      }
                    })
                    .catch(() => showNotice('Verifica cloud non riuscita.'));
                }}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                title="Tocca per forzare la verifica immediata della bozza dal Cloud"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Live Sync</span>
                <RefreshCw className="w-2.5 h-2.5 text-emerald-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="hidden lg:flex items-center gap-3.5 xl:gap-5 text-xs font-semibold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`py-1 transition-colors border-b-2 cursor-pointer ${
              activeTab === 'form'
                ? 'border-[#df0a14] text-white'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            Compilazione Report
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`py-1 transition-colors border-b-2 cursor-pointer ${
              activeTab === 'preview'
                ? 'border-[#df0a14] text-white'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            Anteprima A4 ({pageCount} pag.)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gemini')}
            className={`py-1 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'gemini'
                ? 'border-[#df0a14] text-white'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Interroga con Gemini</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('registry');
            }}
            className={`py-1 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'registry'
                ? 'border-[#df0a14] text-white'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-red-500" />
            <span>Registri (Utenti & Luoghi)</span>
          </button>
          {/* TAB GOOGLE DRIVE CON STATO REALE (CONNESSO / DISCONNESSO) */}
          <div className="flex items-center gap-1.5 py-1">
            <button
              type="button"
              onClick={() => setActiveTab('drive')}
              className={`transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 pb-0.5 ${
                activeTab === 'drive'
                  ? 'border-[#df0a14] text-white font-bold'
                  : 'border-transparent text-slate-300 hover:text-white'
              }`}
            >
              <CloudUpload className="w-3.5 h-3.5 text-blue-400" />
              <span>Google Drive</span>
            </button>
            {isDriveLoggedIn ? (
              <button
                type="button"
                onClick={handleDriveToggleConnect}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/60 rounded cursor-pointer transition-colors"
                title={`Google Drive: Connesso (${driveUser?.email || driveUser?.displayName || 'Autenticato'}). Clicca per disconnettere.`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Connesso</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDriveToggleConnect}
                disabled={isDriveConnecting}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded cursor-pointer transition-colors"
                title="Google Drive: Disconnesso. Clicca per connettere il tuo account Google."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                <span>{isDriveConnecting ? 'Accesso...' : 'Disconnesso'}</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`py-1 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'stats'
                ? 'border-[#df0a14] text-white'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
            <span>Statistiche</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('corporate')}
            className={`py-1 transition-colors border-b-2 cursor-pointer ${
              activeTab === 'corporate'
                ? 'border-[#df0a14] text-white'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            Dati Enti &amp; Firme
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-1 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-[#df0a14] text-white font-bold'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <FolderSync className="w-3.5 h-3.5 text-blue-400" />
            <span>Storico Report</span>
            <span className="px-1.5 py-0.5 bg-blue-900/90 border border-blue-500/50 text-[10px] rounded-full text-blue-200">
              {historyReports.length}
            </span>
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Pulsante Apri a Schermo Intero (senza chat AI Studio) */}
          <a
            href={SHARED_APP_PRODUCTION_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 rounded transition-colors cursor-pointer shadow-xs"
            title="Apri l'applicazione a schermo intero in una nuova scheda senza la chat di AI Studio"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Schermo Intero</span>
          </a>

          {/* Pulsante Pubblicazione / Condivisione App */}
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded transition-colors cursor-pointer shadow-xs"
            title="Visualizza e copia il link per condividere l'app con i collaboratori autorizzati"
          >
            <Share2 className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Condividi App</span>
          </button>


          <button
            type="button"
            onClick={handleArchiveToDrive2026}
            disabled={isSavingToDrive}
            title="Archivia sia il PDF A4 che il file JSON direttamente nella sottocartella 2026 di Google Drive"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-60 border border-blue-500 rounded transition-colors cursor-pointer shadow-xs"
          >
            <CloudUpload className="w-3.5 h-3.5 text-blue-200" />
            <span>{isSavingToDrive ? 'Salvataggio Drive...' : 'Archivia su Drive (2026)'}</span>
          </button>
          <button
            type="button"
            onClick={() => saveCurrentReportToHistory(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Archivia JSON</span>
          </button>
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={isGeneratingPdf}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-white bg-[#df0a14] rounded hover:bg-[#b80810] disabled:opacity-60 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isGeneratingPdf ? 'Generazione PDF...' : 'Stampa / Scarica PDF'}</span>
          </button>
          <button
            type="button"
            onClick={handleOpenNewReportModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 border border-emerald-500 rounded transition-colors cursor-pointer shadow-xs"
            title="Azzera tutti i campi del report e predispone il nuovo numero progressivo in base all'archiviazione"
          >
            <FilePlus2 className="w-3.5 h-3.5 text-emerald-200" />
            <span>Nuovo Report Pulito</span>
          </button>
        </div>
      </header>

      {/* Mobile Bar */}
      <div className="no-print lg:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto text-xs font-semibold shadow-2xs">
        <button
          type="button"
          onClick={handleOpenNewReportModal}
          className="px-3 py-1.5 rounded whitespace-nowrap flex items-center gap-1.5 font-bold text-white bg-emerald-700 hover:bg-emerald-600 shrink-0 shadow-xs cursor-pointer"
          title="Azzera tutti i campi del report e predispone il nuovo numero progressivo in base all'archiviazione"
        >
          <FilePlus2 className="w-3.5 h-3.5 text-emerald-200" />
          <span>Nuovo Report Pulito</span>
        </button>
        <button
          type="button"
          onClick={() => {
            fetchDraftFromCloud()
              .then((d) => {
                if (d && d.report) {
                  applyIncomingRemoteDraftRef.current(d);
                  showNotice(`Bozza Cloud sincronizzata: Report N. ${d.report.numeroReport || 38}`);
                } else {
                  showNotice('Bozza Cloud già allineata.');
                }
              })
              .catch(() => showNotice('Verifica cloud non riuscita.'));
          }}
          className="px-2 py-1 rounded whitespace-nowrap flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0 cursor-pointer"
          title="Tocca per verificare o forzare la sincronizzazione immediata della bozza dal Cloud"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Live Sync</span>
          <RefreshCw className="w-3 h-3 text-emerald-700" />
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('form')}
          className={`px-3 py-1.5 rounded whitespace-nowrap ${
            activeTab === 'form' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Compilazione
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`px-3 py-1.5 rounded whitespace-nowrap ${
            activeTab === 'preview' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Anteprima A4
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-3 py-1.5 rounded whitespace-nowrap flex items-center gap-1.5 font-bold ${
            activeTab === 'history' ? 'bg-[#df0a14] text-white shadow-xs' : 'text-slate-800 bg-blue-50/70 border border-blue-200 hover:bg-blue-100'
          }`}
        >
          <FolderSync className="w-3.5 h-3.5 text-blue-600" />
          <span>Storico Report ({historyReports.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gemini')}
          className={`px-3 py-1.5 rounded whitespace-nowrap flex items-center gap-1 ${
            activeTab === 'gemini' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-3 h-3 text-blue-400" />
          <span>Gemini AI</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('registry');
          }}
          className={`px-3 py-1.5 rounded whitespace-nowrap flex items-center gap-1 ${
            activeTab === 'registry' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-red-500" />
          <span>Registri (Utenti & Luoghi)</span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('drive')}
            className={`px-3 py-1.5 rounded whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'drive' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <CloudUpload className="w-3 h-3 text-blue-500" />
            <span>Google Drive</span>
          </button>
          <button
            type="button"
            onClick={handleDriveToggleConnect}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
              isDriveLoggedIn
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-slate-200 text-slate-700 border border-slate-300'
            }`}
            title={isDriveLoggedIn ? 'Google Drive connesso. Tocca per disconnettere.' : 'Google Drive disconnesso. Tocca per connettere.'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isDriveLoggedIn ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
            <span>{isDriveLoggedIn ? 'Connesso' : 'Disconnesso'}</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`px-3 py-1.5 rounded whitespace-nowrap flex items-center gap-1 ${
            activeTab === 'stats' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#df0a14]" />
          <span>Statistiche Presenze</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('corporate')}
          className={`px-3 py-1.5 rounded whitespace-nowrap ${
            activeTab === 'corporate' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Dati Enti &amp; Firme
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-[1140px] w-full mx-auto px-4 sm:px-6 py-6 print:p-0 print:m-0 print:max-w-none print:w-[210mm]">
        {/* Status Notice */}
        {statusNotice && (
          <div className="no-print mb-5 px-4 py-3 bg-slate-900 text-white text-xs font-semibold rounded-md flex items-center justify-between border-l-4 border-[#df0a14] shadow-xs">
            <span>{statusNotice}</span>
            <button
              type="button"
              onClick={() => setStatusNotice('')}
              className="text-slate-300 hover:text-white ml-4 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: COMPILAZIONE REPORT */}
        {activeTab === 'form' && (
          <div className="no-print space-y-6">
            {/* BANNER SINCRONIZZAZIONE LIVE MULTI-DISPOSITIVO E MULTI-UTENTE */}
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white rounded-lg p-3.5 sm:p-4 shadow-sm border border-emerald-600/40 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
              <div className="flex items-start sm:items-center gap-3">
                <div className="relative mt-1 sm:mt-0 shrink-0">
                  <span className="flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-400" />
                      Collaborazione Live Cloud Attiva
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-600/40 px-2 py-0.5 rounded-full">
                      <Smartphone className="w-3 h-3 text-emerald-300" /> Android
                      <span className="text-emerald-500">↔</span>
                      <Laptop className="w-3 h-3 text-emerald-300" /> PC
                    </span>
                    {isCloudSyncingLive && (
                      <span className="text-[11px] text-amber-300 flex items-center gap-1 font-medium animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" /> In sincronizzazione...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {lastDraftSyncInfo ? (
                      <>
                        Ultimo aggiornamento compilatore:{' '}
                        <strong className="text-emerald-300 font-semibold">
                          {(!lastDraftSyncInfo.by || lastDraftSyncInfo.by.toLowerCase() === 'compilatore')
                            ? resolveAuthorName(report, driveUser, roster, activeOperator)
                            : lastDraftSyncInfo.by}
                        </strong>{' '}
                        {formatSyncTimestamp(lastDraftSyncInfo.at)}.
                      </>
                    ) : (
                      <>
                        Compilatore attivo:{' '}
                        <strong className="text-emerald-300 font-semibold">
                          {resolveAuthorName(report, driveUser, roster, activeOperator)}
                        </strong>
                        . Bozza sincronizzata in tempo reale tra tutti i PC e smartphone Android.
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-emerald-900/60 flex-wrap text-xs">
                    <span className="text-[11px] text-slate-300 font-medium">Stai operando come:</span>
                    <select
                      value={activeOperator}
                      onChange={(e) => handleSetActiveOperator(e.target.value, false)}
                      className="bg-slate-900 text-emerald-300 font-bold text-xs rounded px-2 py-0.5 border border-emerald-500/70 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                    >
                      {KNOWN_OPERATORS.map((op) => (
                        <option key={op.name} value={op.name}>
                          {op.name} ({op.nickname})
                        </option>
                      ))}
                    </select>
                    {report.compilatore !== activeOperator && isOfficialCompiler(activeOperator) && (
                      <button
                        type="button"
                        onClick={() => applyCompilerToReport(activeOperator)}
                        className="px-2 py-0.5 text-[11px] font-bold text-emerald-200 bg-emerald-900/90 hover:bg-emerald-800 border border-emerald-500 rounded cursor-pointer transition-colors shadow-xs"
                        title="Imposta il compilatore del report con il nome di questo operatore"
                      >
                        ✍️ Imposta me come compilatore della scheda
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                <button
                  type="button"
                  onClick={handleForcePushToCloud}
                  disabled={isCloudSyncingLive}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-emerald-700 hover:bg-emerald-600 text-white transition-colors cursor-pointer border border-emerald-500 shadow-xs"
                  title="Invia immediatamente l'attuale bozza al Cloud Firestore per aggiornare tutti gli altri dispositivi"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncingLive ? 'animate-spin' : ''}`} />
                  <span>Sincronizza Ora</span>
                </button>
                <button
                  type="button"
                  onClick={handleForcePullFromCloud}
                  disabled={isCloudSyncingLive}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer border border-slate-600 shadow-xs"
                  title="Scarica e ricarica l'ultima bozza condivisa salvata da un collaboratore sul Cloud"
                >
                  <CloudDownload className="w-3.5 h-3.5 text-slate-300" />
                  <span>Ricarica dal Cloud</span>
                </button>
              </div>
            </div>

            {/* INTESTAZIONE: UN SOLO LOGO AL CENTRO + 2 BLOCCHI DISTINTI */}
            <section className="bg-white border border-slate-300 rounded-lg p-6 shadow-xs text-center">
              {/* UN SOLO LOGO AL CENTRO DELLA PAGINA CHE VALGA PER TUTTE E DUE LE REALTÀ */}
              <div className="flex justify-center mb-3">
                <CityAngelsLogo size={96} customUrl={corporate.logoUrl} />
              </div>

              {/* 2 Colonne distinte per Associazione e Cooperativa */}
              <div className="pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-left text-xs text-slate-800">
                <div className="border-r-0 md:border-r border-slate-200 pr-0 md:pr-4">
                  <div className="font-bold text-slate-900 text-[13px] mb-1 whitespace-pre-line">
                    {assoc.ragioneSociale}
                  </div>
                  <div>
                    <span className="font-semibold">Tel. emergenze e info:</span> {assoc.telEmergenze}
                  </div>
                  <div>
                    <span className="font-semibold">Email:</span>{' '}
                    <span className="text-blue-700 underline">{assoc.email}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Sito internet:</span>{' '}
                    <span className="text-blue-700 underline">{assoc.sitoWeb}</span>
                  </div>
                  {assoc.codiceFiscale?.trim() && (
                    <div>
                      <span className="font-semibold">C.F.:</span> {assoc.codiceFiscale}
                    </div>
                  )}
                </div>

                <div className="pl-0 md:pl-2">
                  <div className="font-bold text-slate-900 text-[13px] mb-0.5">
                    {coop.ragioneSociale}
                  </div>
                  <div className="text-[11.5px] text-slate-700">
                    {coop.sedeLegale} · tel: {coop.telefono}
                  </div>
                  <div className="text-[11.5px]">
                    <span className="font-semibold">Email:</span>{' '}
                    <span className="text-blue-700 underline">{coop.email}</span> ·{' '}
                    <span className="font-semibold">PEC:</span>{' '}
                    <span className="text-blue-700 underline">{coop.pec}</span>
                  </div>
                  <div className="text-[11.5px]">
                    <span className="font-semibold">Sito:</span>{' '}
                    <span className="text-blue-700 underline">{coop.sitoWeb}</span> ·{' '}
                    <span className="font-semibold">C.F./P.IVA:</span> {coop.cfPiva}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight mt-1">
                    {coop.iscrizioniRegistri}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-right">
                <button
                  type="button"
                  onClick={() => setActiveTab('corporate')}
                  className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Modifica dati enti o carica logo personalizzato</span>
                </button>
              </div>
            </section>

            {/* SEZIONE 1: DATI GENERALI DEL REPORT */}
            <section className="bg-white border border-slate-300 rounded-lg p-6 shadow-xs">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 pb-2 mb-4 border-b border-slate-200">
                1. Dati Generali del Report
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Numero report con input numerico e pulsante nuovo report */}
                <div className="md:col-span-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      REPORT DI SERVIZIO n.
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenNewReportModal}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                      title="Azzera campi e crea nuovo report da zero con progressivo calcolato"
                    >
                      <FilePlus2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Nuovo da zero (N. {getNextProgressiveReportNumber()})</span>
                    </button>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={report.numeroReport ?? 36}
                    onChange={(e) =>
                      updateField('numeroReport', parseInt(e.target.value, 10) || 36)
                    }
                    className="w-full h-10 px-3 text-sm font-bold bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                {/* Luogo fisso */}
                <div className="md:col-span-8">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Luogo (Testo Fisso)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={TESTO_FISSO_LUOGO}
                    className="w-full h-10 px-3 text-sm font-semibold bg-slate-100 border border-slate-300 rounded-md text-slate-800"
                  />
                </div>

                {/* Riferimenti emergenze fisso */}
                <div className="md:col-span-12">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Riferimenti emergenze (Testo Fisso)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={TESTO_FISSO_RIFERIMENTI_EMERGENZE}
                    className="w-full h-10 px-3 text-xs font-medium bg-slate-100 border border-slate-300 rounded-md text-slate-800"
                  />
                </div>

                {/* Data del servizio */}
                <div className="md:col-span-12 lg:col-span-5 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-bold text-slate-800">
                      Data del Servizio
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleSetTodayDate}
                        className="px-2 py-0.5 text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded cursor-pointer transition-colors shadow-2xs"
                        title="Imposta data odierna di oggi"
                      >
                        📅 Oggi
                      </button>
                      <button
                        type="button"
                        onClick={handleSetYesterdayDate}
                        className="px-2 py-0.5 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded cursor-pointer transition-colors shadow-2xs"
                        title="Imposta data di ieri"
                      >
                        Ieri
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={report.data}
                    onChange={(e) => updateField('data', e.target.value)}
                    className="w-full h-10 px-3 text-sm font-mono-tabular bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900"
                  />
                  <div className="text-[11px] text-slate-600">
                    {report.data ? (
                      <span className="font-semibold text-emerald-700">
                        {formatDateIT(report.data)}
                      </span>
                    ) : (
                      <span className="text-amber-700 italic">Nessuna data impostata. Tocca &quot;📅 Oggi&quot; per impostare subito la data odierna.</span>
                    )}
                  </div>
                </div>

                {/* Compilatore Designato della Scheda */}
                <div className="md:col-span-12 lg:col-span-7 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-blue-700" />
                      <span>Compilatore Ufficiale del Servizio</span>
                    </label>
                    {report.compilatore ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                        Designato: {report.compilatore}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                        Nessun compilatore designato
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyCompilerToReport('Andrea Menegotto')}
                      className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${
                        report.compilatore?.trim().toLowerCase() === 'andrea menegotto'
                          ? 'bg-blue-700 text-white border-blue-900 shadow-xs ring-2 ring-blue-300'
                          : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                      }`}
                      title="Imposta Andrea Menegotto (Tiger) come compilatore ufficiale"
                    >
                      <span>✏️ Andrea Menegotto (Tiger)</span>
                      {report.compilatore?.trim().toLowerCase() === 'andrea menegotto' && (
                        <span className="text-[10px] bg-white text-blue-900 px-1.5 py-0.5 rounded font-bold">SELEZIONATO</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCompilerToReport('Chiara Menegotto')}
                      className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${
                        report.compilatore?.trim().toLowerCase() === 'chiara menegotto'
                          ? 'bg-blue-700 text-white border-blue-900 shadow-xs ring-2 ring-blue-300'
                          : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                      }`}
                      title="Imposta Chiara Menegotto (Mene) come compilatore ufficiale"
                    >
                      <span>✏️ Chiara Menegotto (Mene)</span>
                      {report.compilatore?.trim().toLowerCase() === 'chiara menegotto' && (
                        <span className="text-[10px] bg-white text-blue-900 px-1.5 py-0.5 rounded font-bold">SELEZIONATO</span>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Compilatori ufficiali abilitati: <strong>Andrea Menegotto</strong> e <strong>Chiara Menegotto</strong>. Selezionando il nominativo, la firma ufficiale scansionata viene collegata automaticamente per la stampa A4.
                  </p>
                </div>

                {/* Box Orari dei Servizi (Fasce Orarie Multiple) */}
                <div className="md:col-span-12 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#df0a14]" />
                        <span>Orari dei Servizi ({currentServiceSlots.length})</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Registra una o più fasce orarie svolte nella stessa giornata (es. presidio pomeridiano, turno serale/notturno, emergenze o turni spezzati).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addServiceSlot}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer transition-colors shadow-xs shrink-0 self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Aggiungi Altro Servizio / Fascia Oraria</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {currentServiceSlots.map((slot, index) => (
                      <div
                        key={slot.id}
                        className="bg-white border border-slate-200 rounded-md p-3 space-y-2.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold rounded bg-slate-800 text-white">
                              Servizio {index + 1}
                            </span>
                            {slot.oraInizio && slot.oraFine ? (
                              <span className="text-xs font-semibold text-slate-700">
                                dalle ore <strong className="text-slate-900">{slot.oraInizio}</strong> alle ore <strong className="text-slate-900">{slot.oraFine}</strong>
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                Orario non ancora specificato
                              </span>
                            )}
                          </div>
                          {currentServiceSlots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeServiceSlot(slot.id)}
                              className="text-xs text-red-600 hover:text-red-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                              title="Rimuovi questo servizio"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Rimuovi</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                          <div className="md:col-span-3">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Ora Inizio
                            </label>
                            <input
                              type="time"
                              value={slot.oraInizio}
                              onChange={(e) => updateServiceSlot(slot.id, 'oraInizio', e.target.value)}
                              className="w-full h-9 px-2 text-xs font-mono-tabular bg-white border border-slate-300 rounded"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Ora Fine
                            </label>
                            <input
                              type="time"
                              value={slot.oraFine}
                              onChange={(e) => updateServiceSlot(slot.id, 'oraFine', e.target.value)}
                              className="w-full h-9 px-2 text-xs font-mono-tabular bg-white border border-slate-300 rounded"
                            />
                          </div>

                          <div className="md:col-span-6">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Dettaglio / Descrizione servizio (scrivi o scegli con ▼)
                            </label>
                            <ComboInputWithArrow
                              value={slot.descrizione || ''}
                              onChange={(val) => updateServiceSlot(slot.id, 'descrizione', val)}
                              options={OPZIONI_DETTAGLIO_ORARIO}
                              placeholder="Es. Presidio sociale e deterrenza"
                              inputClassName="h-9 text-xs font-medium"
                            />
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {OPZIONI_DETTAGLIO_ORARIO.slice(0, 3).map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => updateServiceSlot(slot.id, 'descrizione', opt)}
                                  className={`text-[9.5px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                                    slot.descrizione === opt
                                      ? 'bg-slate-900 text-white border-slate-900 font-bold'
                                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                                  }`}
                                  title={`Seleziona "${opt}"`}
                                >
                                  + {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* SEZIONE 2: LUOGHI INIZIO/TERMINE E COMUNICAZIONI CO PS */}
            <section className="bg-white border border-slate-300 rounded-lg p-6 shadow-xs">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 pb-2 mb-4 border-b border-slate-200">
                2. Luoghi di Inizio/Termine e Comunicazioni CO PS
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Luogo inizio: Parcheggio P1 con 2 registrazioni sbarra */}
                <div className="md:col-span-6 bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-200">
                    <div className="text-xs font-bold text-slate-900">
                      Luogo inizio servizio: <span className="text-[#df0a14]">Parcheggio P1</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handlePrecompileFixedPlates}
                        title="Compila automaticamente Sbarra 1 e Sbarra 2 con le targhe fisse memorizzate"
                        className="px-2 py-0.5 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Zap className="w-3 h-3 text-blue-600" />
                        <span>Applica targhe fisse</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPlatesManager((v) => !v)}
                        title="Gestisci elenco delle targhe fisse memorizzate"
                        className="px-2 py-0.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Car className="w-3 h-3 text-slate-600" />
                        <span>Targhe fisse ({savedPlates.length})</span>
                      </button>
                    </div>
                  </div>

                  {/* PANNELLO ESPANDIBILE: GESTIONE TARGHE FISSE */}
                  {showPlatesManager && (
                    <div className="bg-white border border-blue-200 rounded-md p-3 space-y-3 text-xs shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Car className="w-4 h-4 text-blue-600" />
                          <span>Memoria Numeri di Targa Fissi</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowPlatesManager(false)}
                          className="text-slate-400 hover:text-slate-600 font-bold px-1"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        I numeri di targa dei mezzi di servizio sono fissi. Memorizzali qui per ritrovarli suggeriti e precompilati in ogni servizio.
                      </p>

                      {/* Elenco targhe memorizzate */}
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {savedPlates.length === 0 ? (
                          <div className="text-[11px] text-slate-500 italic py-1">
                            Nessuna targa memorizzata. Aggiungine una qui sotto.
                          </div>
                        ) : (
                          savedPlates.map((sp) => (
                            <div
                              key={sp.id}
                              className="flex items-center justify-between gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900 text-[12px] bg-white px-1.5 py-0.5 border border-slate-300 rounded">
                                  {sp.targa}
                                </span>
                                {sp.label && (
                                  <span className="text-[11px] text-slate-600 truncate max-w-[160px]">
                                    {sp.label}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => togglePlateDefault(sp.id, 1)}
                                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded cursor-pointer ${
                                    sp.isDefaultSbarra1
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                      : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                                  }`}
                                  title="Imposta come predefinita per Sbarra 1"
                                >
                                  ⭐ Predef. Sb. 1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => togglePlateDefault(sp.id, 2)}
                                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded cursor-pointer ${
                                    sp.isDefaultSbarra2
                                      ? 'bg-blue-100 text-blue-900 border border-blue-300 font-bold'
                                      : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                                  }`}
                                  title="Imposta come predefinita per Sbarra 2"
                                >
                                  ⭐ Predef. Sb. 2
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeSavedPlate(sp.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                  title="Elimina targa dalla memoria"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Form per aggiungere una nuova targa fissa */}
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <div className="font-semibold text-slate-800 text-[11px]">
                          + Aggiungi nuova targa fissa:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <input
                            type="text"
                            placeholder="Targa (es. GA 123 CA)"
                            value={newPlateInput}
                            onChange={(e) => setNewPlateInput(e.target.value.toUpperCase())}
                            className="sm:col-span-4 h-7 px-2 text-xs font-mono uppercase bg-white border border-slate-300 rounded"
                          />
                          <input
                            type="text"
                            placeholder="Descrizione (es. Mezzo 1)"
                            value={newPlateLabel}
                            onChange={(e) => setNewPlateLabel(e.target.value)}
                            className="sm:col-span-5 h-7 px-2 text-xs bg-white border border-slate-300 rounded"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              addSavedPlate(
                                newPlateInput,
                                newPlateLabel,
                                newPlateDef1,
                                newPlateDef2
                              )
                            }
                            disabled={!newPlateInput.trim()}
                            className="sm:col-span-3 h-7 px-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded cursor-pointer"
                          >
                            Salva Targa
                          </button>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-slate-600">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newPlateDef1}
                              onChange={(e) => setNewPlateDef1(e.target.checked)}
                            />
                            <span>Imposta come predefinita Sbarra 1</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newPlateDef2}
                              onChange={(e) => setNewPlateDef2(e.target.checked)}
                            />
                            <span>Imposta come predefinita Sbarra 2</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SBARRA 1 */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-semibold text-slate-700">
                        Registrazione sbarra 1:
                      </span>
                      {savedPlates.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] text-slate-500">Targhe fisse:</span>
                          {savedPlates.map((sp) => (
                            <button
                              key={sp.id}
                              type="button"
                              onClick={() => updateBarrierEntry(0, 'targa', sp.targa)}
                              title={`Usa targa ${sp.targa}${sp.label ? ` (${sp.label})` : ''}`}
                              className={`px-1.5 py-0.5 text-[10px] font-mono rounded cursor-pointer transition-colors ${
                                report.apertureSbarraInizio[0]?.targa === sp.targa
                                  ? 'bg-[#df0a14] text-white font-bold'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {sp.targa} {sp.isDefaultSbarra1 ? '⭐' : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">ore:</span>
                      <input
                        type="time"
                        value={report.apertureSbarraInizio[0]?.ora || ''}
                        onChange={(e) => updateBarrierEntry(0, 'ora', e.target.value)}
                        className="h-8 px-2 text-xs bg-white border border-slate-300 rounded font-mono-tabular"
                      />
                      <span className="text-xs text-slate-600">targa mezzo:</span>
                      <div className="relative flex-1 flex items-center gap-1">
                        <input
                          type="text"
                          list="saved-plates-datalist"
                          placeholder="Es. GA 123 CA"
                          value={report.apertureSbarraInizio[0]?.targa || ''}
                          onChange={(e) => updateBarrierEntry(0, 'targa', e.target.value.toUpperCase())}
                          className="h-8 px-2 text-xs uppercase font-mono font-medium bg-white border border-slate-300 rounded flex-1"
                        />
                        {report.apertureSbarraInizio[0]?.targa?.trim() &&
                          !savedPlates.some(
                            (p) => p.targa === report.apertureSbarraInizio[0]?.targa?.trim()
                          ) && (
                            <button
                              type="button"
                              onClick={() =>
                                addSavedPlate(
                                  report.apertureSbarraInizio[0]?.targa,
                                  'Mezzo registrato',
                                  false,
                                  false
                                )
                              }
                              title="Memorizza questa targa nei numeri fissi"
                              className="px-2 h-8 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded hover:bg-emerald-100 whitespace-nowrap cursor-pointer"
                            >
                              + Memorizza
                            </button>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* SBARRA 2 (OPZIONALE) */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-semibold text-slate-700">
                        Registrazione sbarra 2 (opzionale):
                      </span>
                      {savedPlates.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] text-slate-500">Targhe fisse:</span>
                          {savedPlates.map((sp) => (
                            <button
                              key={sp.id}
                              type="button"
                              onClick={() => updateBarrierEntry(1, 'targa', sp.targa)}
                              title={`Usa targa ${sp.targa}${sp.label ? ` (${sp.label})` : ''}`}
                              className={`px-1.5 py-0.5 text-[10px] font-mono rounded cursor-pointer transition-colors ${
                                report.apertureSbarraInizio[1]?.targa === sp.targa
                                  ? 'bg-[#df0a14] text-white font-bold'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {sp.targa} {sp.isDefaultSbarra2 ? '⭐' : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">ore:</span>
                      <input
                        type="time"
                        value={report.apertureSbarraInizio[1]?.ora || ''}
                        onChange={(e) => updateBarrierEntry(1, 'ora', e.target.value)}
                        className="h-8 px-2 text-xs bg-white border border-slate-300 rounded font-mono-tabular"
                      />
                      <span className="text-xs text-slate-600">targa mezzo:</span>
                      <div className="relative flex-1 flex items-center gap-1">
                        <input
                          type="text"
                          list="saved-plates-datalist"
                          placeholder="Es. GA 456 CA"
                          value={report.apertureSbarraInizio[1]?.targa || ''}
                          onChange={(e) => updateBarrierEntry(1, 'targa', e.target.value.toUpperCase())}
                          className="h-8 px-2 text-xs uppercase font-mono font-medium bg-white border border-slate-300 rounded flex-1"
                        />
                        {report.apertureSbarraInizio[1]?.targa?.trim() &&
                          !savedPlates.some(
                            (p) => p.targa === report.apertureSbarraInizio[1]?.targa?.trim()
                          ) && (
                            <button
                              type="button"
                              onClick={() =>
                                addSavedPlate(
                                  report.apertureSbarraInizio[1]?.targa,
                                  'Mezzo registrato 2',
                                  false,
                                  false
                                )
                              }
                              title="Memorizza questa targa nei numeri fissi"
                              className="px-2 h-8 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded hover:bg-emerald-100 whitespace-nowrap cursor-pointer"
                            >
                              + Memorizza
                            </button>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Datalist per autocompletamento nativo dei numeri di targa salvati */}
                  <datalist id="saved-plates-datalist">
                    {savedPlates.map((sp) => (
                      <option key={sp.id} value={sp.targa}>
                        {sp.label ? `${sp.targa} - ${sp.label}` : sp.targa}
                      </option>
                    ))}
                  </datalist>
                </div>

                {/* Luogo termine servizio fisso */}
                <div className="md:col-span-6 bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-3">
                  <div className="text-xs font-bold text-slate-900">
                    Luogo termine servizio (Testo Fisso)
                  </div>
                  <div className="text-xs text-slate-700 bg-white p-2.5 rounded border border-slate-200 font-medium">
                    {TESTO_FISSO_LUOGO_TERMINE}
                  </div>
                </div>

                {/* Comunicazione inizio servizio a CO PS */}
                <div className="md:col-span-6">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Comunicazione inizio servizio a CO PS
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                      Effettuata, ore
                    </span>
                    <input
                      type="time"
                      value={report.comunicazioneInizioCO}
                      onChange={(e) => updateField('comunicazioneInizioCO', e.target.value)}
                      className="h-10 px-3 text-sm font-mono-tabular bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                {/* Comunicazione fine servizio a CO PS */}
                <div className="md:col-span-6">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Comunicazione fine servizio a CO PS
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                      Effettuata, ore
                    </span>
                    <input
                      type="time"
                      value={report.comunicazioneFineCO}
                      onChange={(e) => updateField('comunicazioneFineCO', e.target.value)}
                      className="h-10 px-3 text-sm font-mono-tabular bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* SEZIONE 3: SQUADRA IN SERVIZIO (6 OPERATORI PRE-COMPILATI, SENZA RUOLI PREFISSATI, CON CAPOSERVIZIO E COMPILATORE) */}
            <section className="bg-white border border-slate-300 rounded-lg p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#df0a14]" />
                    <span>3. Squadra in Servizio</span>
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Spunta la casella <strong>Presente</strong> per chi è in turno e spunta chi è il <strong>Compilatore</strong>: la relativa firma ufficiale verrà collegata automaticamente per la stampa del documento A4.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addNewRosterMember}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Aggiungi Operatore</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded-md">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                      <th className="p-2 text-center w-16">Pres.</th>
                      <th className="p-2 text-center w-12">Ord.</th>
                      <th className="p-2 text-left min-w-[160px]">Operatore (Nome Cognome)</th>
                      <th className="p-2 text-left w-24">Nick</th>
                      <th className="p-2 text-left min-w-[260px]">Qualifica Ufficiale</th>
                      <th className="p-2 text-center w-24">Caposervizio</th>
                      <th className="p-2 text-center w-32">Compilatore &amp; Firma</th>
                      <th className="p-2 text-center w-16">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {roster.map((member, idx) => {
                      const isPresent = isRosterMemberChecked(member);
                      const currentTeamObj = report.squadra.find((m) => m.id === member.id);
                      const isCapo = Boolean(currentTeamObj?.isCaposervizio ?? member.isCaposervizio);
                      const isComp = Boolean(currentTeamObj?.isCompilatore ?? member.isCompilatore);

                      return (
                        <tr
                          key={member.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            isPresent ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          {/* Spunta Presente */}
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={isPresent}
                              onChange={(e) => toggleRosterPresence(member, e.target.checked)}
                              className="w-4 h-4 accent-[#df0a14] rounded cursor-pointer"
                              title="Spunta se l'operatore è presente in questo servizio"
                            />
                          </td>

                          {/* Frecce Ordine */}
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveRosterMember(member.id, 'up')}
                                className="p-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                                title="Sposta su"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === roster.length - 1}
                                onClick={() => moveRosterMember(member.id, 'down')}
                                className="p-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                                title="Sposta giù"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* Nome e Cognome */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={member.nomeCognome}
                              placeholder="Nome e Cognome"
                              onChange={(e) =>
                                updateRosterMember(member.id, 'nomeCognome', e.target.value)
                              }
                              className="w-full px-2 py-1 border border-slate-300 rounded font-medium text-xs bg-white"
                            />
                          </td>

                          {/* Nickname */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={member.nickname}
                              placeholder="Nick"
                              onChange={(e) =>
                                updateRosterMember(member.id, 'nickname', e.target.value)
                              }
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                            />
                          </td>

                          {/* Qualifica Ufficiale (modificabile o selezionabile da tendina) */}
                          <td className="p-2">
                            <ComboInputWithArrow
                              value={member.qualifica}
                              onChange={(val) =>
                                updateRosterMember(member.id, 'qualifica', val)
                              }
                              options={QUALIFICHE_PREDEFINITE}
                              placeholder="Qualifica ufficiale"
                              inputClassName="h-8 text-[11px]"
                            />
                          </td>

                          {/* Checkbox Caposervizio */}
                          <td className="p-2 text-center">
                            <label className="inline-flex items-center justify-center p-1 rounded border border-slate-300 bg-white cursor-pointer hover:border-slate-400">
                              <input
                                type="checkbox"
                                checked={isCapo}
                                onChange={(e) =>
                                  toggleCaposervizioForMember(member.id, e.target.checked)
                                }
                                className="w-4 h-4 accent-[#df0a14] rounded cursor-pointer"
                              />
                            </label>
                          </td>

                          {/* Checkbox Compilatore della scheda */}
                          <td className="p-2 text-center">
                            {isOfficialCompiler(member.nomeCognome) ? (
                              <label
                                className={`inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-all border ${
                                  isComp
                                    ? 'bg-blue-700 text-white border-blue-800 font-bold shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-300 hover:border-blue-300 hover:bg-slate-50'
                                }`}
                                title={
                                  isComp
                                    ? `${member.nomeCognome} è il compilatore (firma collegata per la stampa)`
                                    : `Spunta per impostare ${member.nomeCognome} come compilatore con firma`
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={isComp}
                                  onChange={(e) =>
                                    toggleCompilatoreForMember(member.id, e.target.checked)
                                  }
                                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                                />
                                <span className="text-[11px] select-none whitespace-nowrap">
                                  {isComp ? 'Compilatore' : 'Spunta'}
                                </span>
                              </label>
                            ) : (
                              <span
                                className="text-[11px] text-slate-300 font-mono select-none"
                                title="I soli compilatori autorizzati sono Andrea Menegotto e Chiara Menegotto"
                              >
                                —
                              </span>
                            )}
                          </td>

                          {/* Rimuovi */}
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeRosterMember(member.id)}
                              className="text-slate-400 hover:text-red-700 p-1 cursor-pointer"
                              title="Rimuovi operatore dall'elenco"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Banner Riepilogo Compilatore e Firma */}
              <div className="mt-3.5 p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 border-slate-200">
                {report.compilatore ? (
                  <div className="flex items-center gap-2 text-slate-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>
                      Compilatore della scheda: <strong className="text-blue-950 font-bold">{report.compilatore}</strong>
                      {report.firmaImmagineUrl ? (
                        <span className="text-emerald-800 font-bold ml-1.5 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-700" />
                          Firma ufficiale associata per la stampa A4
                        </span>
                      ) : (
                        <span className="text-slate-600 italic ml-1.5">
                          (Riquadro pronto per la firma autografa manuale a penna sul foglio A4)
                        </span>
                      )}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0"></span>
                    <span>
                      Nessun operatore spuntato come <strong>Compilatore</strong> nella squadra: sul documento A4 il riquadro della firma rimarrà in bianco per la firma a penna.
                    </span>
                  </div>
                )}

                {report.compilatore && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentComp = roster.find(
                        (m) =>
                          m.nomeCognome.trim().toLowerCase() ===
                          report.compilatore?.trim().toLowerCase()
                      );
                      if (currentComp) {
                        toggleCompilatoreForMember(currentComp.id, false);
                      } else {
                        setReport((r) => ({ ...r, compilatore: '', firmaImmagineUrl: '' }));
                        setRoster((prev) => prev.map((m) => ({ ...m, isCompilatore: false })));
                      }
                    }}
                    className="text-[11px] text-red-600 hover:text-red-800 font-semibold underline cursor-pointer shrink-0 self-start sm:self-auto"
                  >
                    Deseleziona (firma a penna)
                  </button>
                )}
              </div>

              {/* Sotto la tabella: Personale esterno in affiancamento */}
              <div className="mt-4 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Personale in affiancamento
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateField('personaleEsternoAffiancamento', 'Ispettore Christian Saracino')}
                      className="px-2 py-0.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
                    >
                      + Isp. Christian Saracino
                    </button>
                    {report.personaleEsternoAffiancamento && (
                      <button
                        type="button"
                        onClick={() => updateField('personaleEsternoAffiancamento', '')}
                        className="px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded border border-slate-200 cursor-pointer"
                      >
                        Azzera
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  value={report.personaleEsternoAffiancamento}
                  onChange={(e) =>
                    updateField('personaleEsternoAffiancamento', e.target.value)
                  }
                  placeholder="Es. Ispettore Christian Saracino (oppure nominativo specifico persona in affiancamento)"
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-300 rounded-md"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Specificare sempre il nominativo della persona in affiancamento (es. Ispettore Christian Saracino o eventuale altro operatore). Non usare diciture generiche senza nominativo.
                </p>
              </div>
            </section>

            {/* SEZIONE 4: RILEVAZIONI E INTERVENTI EFFETTUATI */}
            <section className="bg-white border border-slate-300 rounded-lg p-6 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                    4. Rilevazioni e Interventi Effettuati
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Inserisci i punti di individuazione progressivi (Punto a, Punto b, ecc.), il numero di utenti e l&apos;esito del colloquio.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addRilevazione}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Aggiungi Punto Rilevazione</span>
                </button>
              </div>

              <div className="space-y-4">
                {/* BARRA CENTRALE DI RICERCA RAPIDA LUOGHI & UTENTI IN COMPILAZIONE */}
                <CompilationQuickSearchToolbar
                  locations={managedLocations}
                  users={managedUsers}
                  rilevazioni={report.rilevazioni}
                  onAddNewRilevazioneWithLocation={(locationName) => {
                    const newRil: RilevazioneItem = {
                      id: `ril-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      luogoIndividuazione: locationName,
                      descrizione: '',
                      numeroUtenti: 1,
                      aggancioEffettuato: true,
                      nominativiAssociati: [],
                      operatoriCoinvolti: [],
                      foto: [],
                    };
                    setReport((prev) => ({
                      ...prev,
                      rilevazioni: [...(prev.rilevazioni || []), newRil],
                    }));
                  }}
                  onAddNewRilevazioneWithUser={(userName) => {
                    const newRil: RilevazioneItem = {
                      id: `ril-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      luogoIndividuazione: '',
                      descrizione: '',
                      numeroUtenti: 1,
                      aggancioEffettuato: true,
                      nominativiAssociati: [userName],
                      operatoriCoinvolti: [],
                      foto: [],
                    };
                    setReport((prev) => ({
                      ...prev,
                      rilevazioni: [...(prev.rilevazioni || []), newRil],
                    }));
                  }}
                  onSetLocationToRilevazione={(rilId, locationName) => {
                    updateRilevazione(rilId, 'luogoIndividuazione', locationName);
                  }}
                  onAddUserToRilevazione={(rilId, userName) => {
                    const targetRil = (report.rilevazioni || []).find((r) => r.id === rilId);
                    if (!targetRil) return;
                    const existing = targetRil.nominativiAssociati || [];
                    const lower = (userName || '').trim().toLowerCase();
                    if (!existing.some((n) => (n || '').trim().toLowerCase() === lower)) {
                      updateRilevazione(rilId, 'nominativiAssociati', [...existing, userName.trim()]);
                    }
                  }}
                  onNotice={showNotice}
                />

                {(!report.rilevazioni || report.rilevazioni.length === 0) ? (
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center space-y-3 bg-white">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                      <MapPin className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Nessun punto di rilevazione attivo (area libera)
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                        Tutti i punti sono stati eliminati. Puoi inserire un nuovo punto in qualsiasi momento premendo il pulsante qui sotto o dalla barra di ricerca rapida in alto.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addRilevazione}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer shadow-xs transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Inserisci Punto Rilevazione (Punto A)</span>
                    </button>
                  </div>
                ) : (
                  report.rilevazioni.map((ril, index) => {
                    const alpha = indexToAlpha(index);

                    return (
                      <div
                        key={ril.id}
                        className="border border-slate-300 rounded-lg p-4 bg-slate-50/50 space-y-3"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="bg-[#df0a14] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold font-mono">
                              {alpha}
                            </span>
                            <span className="font-bold text-xs text-slate-900">
                              Punto {alpha}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveRilevazione(index, 'up')}
                              className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                              title="Sposta su"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === report.rilevazioni.length - 1}
                              onClick={() => moveRilevazione(index, 'down')}
                              className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                              title="Sposta giù"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRilevazione(ril.id)}
                              className="p-1 text-slate-400 hover:text-red-700 cursor-pointer ml-1"
                              title="Elimina punto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        {/* Luogo di individuazione */}
                        <div className="md:col-span-6">
                          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[#df0a14]" />
                              <span>Luogo di individuazione (cerca, digita o seleziona dai rapidi)</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              {managedLocations.length} luoghi monitorati
                            </span>
                          </label>
                          <SearchableLocationInput
                            id={`luogo-input-${ril.id}`}
                            value={ril.luogoIndividuazione}
                            onChange={(val) => {
                              updateRilevazione(ril.id, 'luogoIndividuazione', val);
                            }}
                            locations={managedLocations}
                            onAddNewLocation={handleAddNewLocation}
                            placeholder="Cerca o scrivi luogo (es. Porta 1, Vano CISL, Food Court)..."
                            inputClassName="h-9 text-xs"
                          />
                        </div>

                        {/* Numero Utenti */}
                        <div className="md:col-span-3">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Numero Utenti
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={ril.numeroUtenti}
                            onChange={(e) =>
                              updateRilevazione(
                                ril.id,
                                'numeroUtenti',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded font-semibold"
                          />
                        </div>

                        {/* Spunta Aggancio / Colloquio */}
                        <div className="md:col-span-3 flex items-end">
                          <label className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded bg-white w-full cursor-pointer h-9 select-none">
                            <input
                              type="checkbox"
                              checked={ril.aggancioEffettuato}
                              onChange={(e) =>
                                updateRilevazione(ril.id, 'aggancioEffettuato', e.target.checked)
                              }
                              className="w-4 h-4 accent-[#df0a14] rounded cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-800">
                              Colloquio / Aggancio
                            </span>
                          </label>
                        </div>

                        {/* Soggetti / Nominativi Associati (Prima l'indicazione del nome) */}
                        <div className="md:col-span-12">
                          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-[#df0a14]" />
                              <span>Soggetti / Utenti associati a questa rilevazione (ricerca e selezione diretta)</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              {managedUsers.length} utenti nel registro
                            </span>
                          </label>
                          <div className="bg-white border border-slate-300 rounded-md p-3 shadow-2xs">
                            <SearchableUserPicker
                              rilevazioneId={ril.id}
                              associatedUsers={ril.nominativiAssociati || []}
                              allUsers={managedUsers}
                              onToggleUser={(name) => {
                                const existing = ril.nominativiAssociati || [];
                                const lower = (name || '').trim().toLowerCase();
                                if (existing.some((n) => (n || '').trim().toLowerCase() === lower)) {
                                  updateRilevazione(
                                    ril.id,
                                    'nominativiAssociati',
                                    existing.filter((n) => (n || '').trim().toLowerCase() !== lower)
                                  );
                                } else {
                                  updateRilevazione(ril.id, 'nominativiAssociati', [...existing, name.trim()]);
                                }
                              }}
                              onAddUser={(name) => {
                                const existing = ril.nominativiAssociati || [];
                                const lower = (name || '').trim().toLowerCase();
                                if (!existing.some((n) => (n || '').trim().toLowerCase() === lower)) {
                                  updateRilevazione(ril.id, 'nominativiAssociati', [...existing, name.trim()]);
                                }
                              }}
                              onRemoveUser={(name) => {
                                const existing = ril.nominativiAssociati || [];
                                const lower = (name || '').trim().toLowerCase();
                                updateRilevazione(
                                  ril.id,
                                  'nominativiAssociati',
                                  existing.filter((n) => (n || '').trim().toLowerCase() !== lower)
                                );
                              }}
                              onCreateNewUser={async (name) => {
                                await handleAddNewUser(name);
                              }}
                              onNotice={showNotice}
                            />
                          </div>
                        </div>

                        {/* Descrizione della situazione riscontrata (Sotto i soggetti/utenti) */}
                        <div className="md:col-span-12">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Descrizione della situazione riscontrata / intervento
                          </label>
                          <textarea
                            rows={3}
                            value={ril.descrizione}
                            onChange={(e) => updateRilevazione(ril.id, 'descrizione', e.target.value)}
                            placeholder="Dettagli sull'utente, bisogni rilevati, supporto fornito, segnalazioni CO..."
                            className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900"
                          />
                        </div>

                        {/* Fotografie allegate (rispettano i criteri di impaginazione A4) */}
                        <div className="md:col-span-12">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-700">
                              Fotografie allegate (ridimensionate a cover per non scompaginare l&apos;A4)
                            </label>
                            <label className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 cursor-pointer">
                              <Camera className="w-3.5 h-3.5" />
                              <span>+ Aggiungi Foto</span>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handlePhotoUpload(ril.id, e)}
                                className="hidden"
                              />
                            </label>
                          </div>

                          {ril.foto.length > 0 ? (
                            <div className="flex flex-wrap gap-2.5">
                              {ril.foto.map((photo) => (
                                <div
                                  key={photo.id}
                                  className="relative group border border-slate-300 rounded overflow-hidden bg-white shadow-xs"
                                >
                                  <img
                                    src={photo.dataUrl}
                                    alt={photo.name}
                                    className="w-[120px] h-[90px] object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removePhoto(ril.id, photo.id)}
                                    className="absolute top-1 right-1 p-1 bg-red-700 text-white rounded opacity-90 hover:opacity-100 cursor-pointer"
                                    title="Elimina foto"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 italic">
                              Nessuna fotografia allegata per questo punto.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }))}
              </div>
            </section>

            {/* SEZIONE 5: RIEPILOGO, RICHIESTE EMERGENZA E NOTE */}
            <section className="bg-white border border-slate-300 rounded-lg p-6 shadow-xs">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 pb-2 mb-4 border-b border-slate-200">
                5. Riepilogo, Richieste Emergenza e Note
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Totale soggetti (in sola lettura) */}
                <div className="md:col-span-6 bg-slate-50 border border-slate-200 rounded-md p-3">
                  <span className="block text-xs font-semibold text-slate-700 mb-1">
                    Totale soggetti individuati nel corso del servizio
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold font-mono text-slate-900">
                      {totalSubjects}
                    </span>
                    <span className="text-xs text-slate-500">
                      (somma automatica utenti censiti)
                    </span>
                  </div>
                </div>

                {/* Totale agganci (in sola lettura) */}
                <div className="md:col-span-6 bg-slate-50 border border-slate-200 rounded-md p-3">
                  <span className="block text-xs font-semibold text-slate-700 mb-1">
                    Totale agganci / colloqui effettuati
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold font-mono text-slate-900">
                      {totalEngagements}
                    </span>
                    <span className="text-xs text-slate-500">
                      (punti con spunta &ldquo;Colloquio / Aggancio&rdquo;)
                    </span>
                  </div>
                </div>

                {/* Richieste Emergenza CO PS */}
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Richieste Intervento emergenza CO PS
                  </label>
                  <textarea
                    rows={2}
                    value={report.richiesteEmergenzaCOPS}
                    onChange={(e) => updateField('richiesteEmergenzaCOPS', e.target.value)}
                    placeholder="Nessuna //"
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>

                {/* Richieste Emergenza CO SEA */}
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Richieste Intervento emergenza CO SEA
                  </label>
                  <textarea
                    rows={2}
                    value={report.richiesteEmergenzaCOSEA}
                    onChange={(e) => updateField('richiesteEmergenzaCOSEA', e.target.value)}
                    placeholder="Nessuna //"
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>

                {/* Richieste Intervento emergenza Pronto soccorso MXP */}
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Richieste Intervento emergenza Pronto soccorso MXP
                  </label>
                  <textarea
                    rows={2}
                    value={report.richiesteEmergenzaProntoSoccorsoMXP || ''}
                    onChange={(e) => updateField('richiesteEmergenzaProntoSoccorsoMXP', e.target.value)}
                    placeholder="Nessuna //"
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>

                {/* Richieste non urgenti */}
                <div className="md:col-span-12">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Richieste di intervento non urgenti
                  </label>
                  <textarea
                    rows={2}
                    value={report.richiesteNonUrgenti}
                    onChange={(e) => updateField('richiesteNonUrgenti', e.target.value)}
                    placeholder="Nessuna //"
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>

                {/* Note */}
                <div className="md:col-span-6">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Note di servizio
                  </label>
                  <textarea
                    rows={2}
                    value={report.note}
                    onChange={(e) => updateField('note', e.target.value)}
                    placeholder="//"
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>

                {/* Osservazioni */}
                <div className="md:col-span-6">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Osservazioni
                  </label>
                  <textarea
                    rows={2}
                    value={report.osservazioni}
                    onChange={(e) => updateField('osservazioni', e.target.value)}
                    placeholder="//"
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: ANTEPRIMA A4 E STAMPA */}
        {activeTab === 'preview' && (
          <div className="space-y-6 print:space-y-0 print:m-0 print:p-0">
            <div className="no-print bg-white border border-slate-300 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Anteprima Documento Ufficiale A4 ({pageCount} Pagine)
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Fedele al modello originale: logo unico al centro, 2 blocchi societari, bordi e firma del compilatore.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleArchiveToDrive2026}
                  disabled={isSavingToDrive}
                  title="Salva PDF e JSON direttamente nella sottocartella 2026 di Google Drive"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-60 border border-blue-500 rounded cursor-pointer shadow-xs"
                >
                  <CloudUpload className="w-4 h-4 text-blue-200" />
                  <span>{isSavingToDrive ? 'Salvataggio su Drive...' : 'Archivia su Drive (2026)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Stampa Browser</span>
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#df0a14] rounded hover:bg-[#b80810] disabled:opacity-60 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>{isGeneratingPdf ? 'Generazione...' : 'Scarica PDF A4'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenNewReportModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 border border-emerald-500 rounded cursor-pointer shadow-xs"
                  title="Azzera tutti i campi del report e predispone il nuovo numero progressivo in base all'archiviazione"
                >
                  <FilePlus2 className="w-4 h-4 text-emerald-200" />
                  <span>Nuovo Report Pulito</span>
                </button>
              </div>
            </div>

            <A4PaginatedDocument
              report={report}
              corporate={corporate}
              totalSubjects={totalSubjects}
              totalEngagements={totalEngagements}
              onPageCountChange={setPageCount}
              previewMode={true}
              roster={roster}
            />
          </div>
        )}

        {/* TAB 3: INTERROGAZIONE CON GEMINI AI */}
        {activeTab === 'gemini' && (
          <div className="no-print">
            <GeminiReportsQueryPanel
              historyReports={historyReports}
              currentReport={report}
              driveFiles={driveFilesList}
              isDriveConnected={isDriveLoggedIn || driveFilesList.length > 0}
              onDriveFilesUpdated={(files) => {
                setDriveFilesList(files);
              }}
              onAddSubjectToDirectory={(name) => {
                if (name && !customSubjects.includes(name)) {
                  setCustomSubjects((prev) => [...prev, name]);
                  showNotice(`Soggetto "${name}" aggiunto alla rubrica!`);
                }
              }}
              onNotice={showNotice}
            />
          </div>
        )}

        {/* TAB 3.5: REGISTRO UTENTI E LUOGHI DI INDIVIDUAZIONE */}
        {activeTab === 'registry' && (
          <div className="no-print">
            <UserRegistryPanel
              historyReports={historyReports}
              currentReport={report}
              onUpdateReport={setReport}
              onNotice={showNotice}
              managedUsers={managedUsers}
              setManagedUsers={setManagedUsers}
              onAddUser={handleAddNewUser}
              onRemoveUser={handleRemoveUser}
              managedLocations={managedLocations}
              setManagedLocations={setManagedLocations}
              onAddLocation={handleAddNewLocation}
              onRemoveLocation={handleRemoveLocation}
            />
          </div>
        )}

        {/* TAB 4: GOOGLE DRIVE */}
        {activeTab === 'drive' && (
          <div className="no-print space-y-6">
            <GoogleDriveArchivePanel
              report={report}
              corporate={corporate}
              totalSubjects={totalSubjects}
              totalEngagements={totalEngagements}
              onReportsSyncedFromDrive={(synced) => {
                if (synced && synced.length > 0) {
                  setHistoryReports((prev) => {
                    const merged = mergeReportEntries(prev, synced);
                    try {
                      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
                    } catch {
                      // ignore
                    }
                    const userLabel =
                      driveUser?.displayName
                        ? `${driveUser.displayName} (${driveUser.email || ''})`.trim()
                        : (driveUser?.email || 'Google Drive Sync');
                    pushSharedArchiveToCloud(merged, userLabel).catch(() => {});
                    return merged;
                  });
                }
              }}
              onDriveFilesUpdated={(files) => {
                setDriveFilesList(files);
              }}
              onLocalArchiveReport={() => saveCurrentReportToHistory(false)}
              onNotice={showNotice}
            />

            {/* Banner di accesso diretto all'Elenco Completo dei Report e gestione cancellazioni */}
            <div className="bg-white border border-slate-300 rounded-lg p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 shrink-0">
                  <FolderSync className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Elenco Completo Report Archiviati</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                      {historyReports.length} Servizi
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Consulta la tabella dettagliata di tutti i report (2025 e 2026). Da lì puoi ricaricare ogni servizio nell&apos;editor, visualizzarne i dettagli o <strong>eliminarlo cancellando anche i file corrispondenti (PDF e JSON) da Google Drive</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="px-4 py-2.5 bg-[#1e3a8a] hover:bg-slate-900 text-white text-xs font-bold rounded-md inline-flex items-center gap-2 cursor-pointer transition-colors shrink-0 shadow-xs"
              >
                <FolderOpen className="w-4 h-4 text-blue-300" />
                <span>Apri Elenco &amp; Gestione Report</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: STATISTICHE PRESENZE (MODELLO CONSOLIDATO 2026) */}
        {activeTab === 'stats' && (
          <div className="no-print">
            <StatisticsPanel
              historyReports={historyReports}
              currentReport={report}
              onAskGeminiStats={() => setActiveTab('gemini')}
              onUpdateHistoryReport={(updatedEntry) => {
                setHistoryReports((prev) => {
                  const merged = mergeReportEntries(prev, [updatedEntry]);
                  try {
                    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
                  } catch {
                    // ignore
                  }
                  const userLabel = resolveAuthorName(report, driveUser, roster, activeOperator);
                  pushSharedArchiveToCloud(merged, userLabel).catch(() => {});
                  return merged;
                });
                if (report && Number(report.numeroReport) === Number(updatedEntry.report?.numeroReport)) {
                  setReport(JSON.parse(JSON.stringify(updatedEntry.report)));
                  currentReportRef.current = updatedEntry.report;
                  try {
                    localStorage.setItem(STORAGE_KEY_REPORT, JSON.stringify(updatedEntry.report));
                  } catch {
                    // ignore
                  }
                }
              }}
              onNotice={showNotice}
              onGenerateStatsPdf={async () => {
                const rows = historyReports.map((item) => {
                  const rep = item.report;
                  const num = rep.numeroReport ?? 0;
                  const sumRil = (rep.rilevazioni || []).reduce(
                    (sum, r) => sum + (Number.isFinite(Number(r.numeroUtenti)) ? Math.max(0, Number(r.numeroUtenti)) : 0),
                    0
                  );
                  const presenze = Number.isFinite((rep as any).totalePresenzeOverride)
                    ? Number((rep as any).totalePresenzeOverride)
                    : sumRil > 0
                    ? sumRil
                    : (Number.isFinite((rep as any).totalePresenze) ? Number((rep as any).totalePresenze) : 0);
                  const rilColloqui = (rep.rilevazioni || []).filter((r) => r.aggancioEffettuato).length;
                  const colloqui = Number.isFinite((rep as any).totaleColloquiOverride)
                    ? Number((rep as any).totaleColloquiOverride)
                    : Number.isFinite((rep as any).colloquiCount)
                    ? Number((rep as any).colloquiCount)
                    : rilColloqui;
                  const affiancamento = getSaracinoAffiancamentoForReport(rep);
                  return {
                    numeroReport: num,
                    data: rep.data,
                    caposervizio: rep.caposervizio || 'Andrea Menegotto',
                    presenze,
                    colloqui,
                    affiancamentoSaracino: affiancamento,
                  };
                });

                if (rows.length === 0) {
                  // Genera con i dati campione del Modello Ufficiale 2026 (Gen - Set 2026)
                  rows.push(
                    { numeroReport: 1, data: '2026-01-08', caposervizio: 'Andrea Menegotto', presenze: 41, colloqui: 0, affiancamentoSaracino: '' },
                    { numeroReport: 2, data: '2026-01-15', caposervizio: 'Andrea Menegotto', presenze: 45, colloqui: 0, affiancamentoSaracino: '' },
                    { numeroReport: 3, data: '2026-01-22', caposervizio: 'Andrea Menegotto', presenze: 75, colloqui: 2, affiancamentoSaracino: '' },
                    { numeroReport: 4, data: '2026-01-29', caposervizio: 'Andrea Menegotto', presenze: 45, colloqui: 3, affiancamentoSaracino: '' },
                    { numeroReport: 5, data: '2026-02-05', caposervizio: 'Andrea Menegotto', presenze: 60, colloqui: 4, affiancamentoSaracino: '' },
                    { numeroReport: 6, data: '2026-02-12', caposervizio: 'Andrea Menegotto', presenze: 10, colloqui: 1, affiancamentoSaracino: 'Sì (Pratiche rimpatrio)' },
                    { numeroReport: 7, data: '2026-02-19', caposervizio: 'Andrea Menegotto', presenze: 49, colloqui: 1, affiancamentoSaracino: '' },
                    { numeroReport: 8, data: '2026-02-26', caposervizio: 'Andrea Menegotto', presenze: 42, colloqui: 0, affiancamentoSaracino: 'Sì (Intervento 25/02)' },
                    { numeroReport: 9, data: '2026-03-05', caposervizio: 'Andrea Menegotto', presenze: 41, colloqui: 0, affiancamentoSaracino: '' },
                    { numeroReport: 10, data: '2026-03-12', caposervizio: 'Andrea Menegotto', presenze: 37, colloqui: 1, affiancamentoSaracino: '' },
                    { numeroReport: 11, data: '2026-03-19', caposervizio: 'Andrea Menegotto', presenze: 44, colloqui: 3, affiancamentoSaracino: '' },
                    { numeroReport: 12, data: '2026-03-26', caposervizio: 'Andrea Menegotto', presenze: 59, colloqui: 2, affiancamentoSaracino: '' },
                    { numeroReport: 13, data: '2026-04-02', caposervizio: 'Andrea Menegotto', presenze: 55, colloqui: 2, affiancamentoSaracino: '' },
                    { numeroReport: 14, data: '2026-04-09', caposervizio: 'Andrea Menegotto', presenze: 41, colloqui: 1, affiancamentoSaracino: '' },
                    { numeroReport: 15, data: '2026-04-16', caposervizio: 'Andrea Menegotto', presenze: 43, colloqui: 3, affiancamentoSaracino: '' },
                    { numeroReport: 16, data: '2026-04-23', caposervizio: 'Andrea Menegotto', presenze: 36, colloqui: 3, affiancamentoSaracino: 'Sì (Intervento in loco)' },
                    { numeroReport: 17, data: '2026-04-29', caposervizio: 'Andrea Menegotto', presenze: 43, colloqui: 4, affiancamentoSaracino: '' },
                    { numeroReport: 18, data: '2026-05-07', caposervizio: 'Andrea Menegotto', presenze: 47, colloqui: 2, affiancamentoSaracino: '' },
                    { numeroReport: 19, data: '2026-05-14', caposervizio: 'Andrea Menegotto', presenze: 45, colloqui: 1, affiancamentoSaracino: '' },
                    { numeroReport: 20, data: '2026-05-21', caposervizio: 'Andrea Menegotto', presenze: 41, colloqui: 0, affiancamentoSaracino: '' },
                    { numeroReport: 21, data: '2026-05-27', caposervizio: 'Andrea Menegotto', presenze: 51, colloqui: 2, affiancamentoSaracino: '' },
                    { numeroReport: 22, data: '2026-06-04', caposervizio: 'Andrea Menegotto', presenze: 63, colloqui: 3, affiancamentoSaracino: '' },
                    { numeroReport: 23, data: '2026-06-11', caposervizio: 'Andrea Menegotto', presenze: 31, colloqui: 5, affiancamentoSaracino: '' },
                    { numeroReport: 24, data: '2026-06-18', caposervizio: 'Andrea Menegotto', presenze: 37, colloqui: 4, affiancamentoSaracino: '' },
                    { numeroReport: 25, data: '2026-06-25', caposervizio: 'Andrea Menegotto', presenze: 46, colloqui: 1, affiancamentoSaracino: 'Sì (Affiancamento)' },
                    { numeroReport: 26, data: '2026-07-02', caposervizio: 'Andrea Menegotto', presenze: 50, colloqui: 1, affiancamentoSaracino: '' },
                    { numeroReport: 27, data: '2026-07-16', caposervizio: 'Andrea Menegotto', presenze: 38, colloqui: 3, affiancamentoSaracino: '' },
                    { numeroReport: 28, data: '2026-07-23', caposervizio: 'Andrea Menegotto', presenze: 42, colloqui: 3, affiancamentoSaracino: '' },
                    { numeroReport: 29, data: '2026-07-30', caposervizio: 'Andrea Menegotto', presenze: 36, colloqui: 1, affiancamentoSaracino: 'Sì (Affiancamento)' },
                    { numeroReport: 30, data: '2026-08-06', caposervizio: 'Andrea Menegotto', presenze: 55, colloqui: 2, affiancamentoSaracino: '' },
                    { numeroReport: 31, data: '2026-09-03', caposervizio: 'Andrea Menegotto', presenze: 46, colloqui: 2, affiancamentoSaracino: '' },
                    { numeroReport: 32, data: '2026-09-10', caposervizio: 'Andrea Menegotto', presenze: 53, colloqui: 1, affiancamentoSaracino: '' },
                    { numeroReport: 33, data: '2026-09-17', caposervizio: 'Andrea Menegotto', presenze: 61, colloqui: 1, affiancamentoSaracino: '' },
                    { numeroReport: 34, data: '2026-09-24', caposervizio: 'Andrea Menegotto', presenze: 60, colloqui: 2, affiancamentoSaracino: '' },
                    { numeroReport: 35, data: '2026-10-01', caposervizio: 'Andrea Menegotto', presenze: 76, colloqui: 2, affiancamentoSaracino: '' },
                    { numeroReport: 36, data: '2026-10-08', caposervizio: 'Andrea Menegotto', presenze: 48, colloqui: 2, affiancamentoSaracino: 'Sì (Affiancamento)' }
                  );
                }

                await generateStatisticsPdf(rows);
                showNotice('Report Statistico Consolidato PDF generato con successo!');
              }}
            />
          </div>
        )}

        {/* TAB 4: DATI ENTI / INTESTAZIONE SOCIETARIA */}
        {activeTab === 'corporate' && (
          <section className="no-print bg-white border border-slate-300 rounded-lg p-6 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Dati Enti e Intestazione Ufficiale
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Un solo logo al centro della pagina che vale per entrambe le realtà. Campi specifici e distinti per l&apos;Associazione e per la Cooperativa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCorporate(DEFAULT_CORPORATE_CONFIG)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ripristina Dati Predefiniti</span>
              </button>
            </div>

            {/* UN SOLO LOGO AL CENTRO */}
            <div className="border border-slate-200 rounded-lg p-5 bg-slate-50/50 text-center space-y-3">
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Logo Ufficiale City Angels Varese (Centrato in testata)
              </div>
              <div className="flex justify-center my-2">
                <CityAngelsLogo size={108} customUrl={corporate.logoUrl} />
              </div>
              <div className="flex items-center justify-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded hover:bg-slate-50 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-[#df0a14]" />
                  <span>Carica Logo Personalizzato (CA_Varese.jpg)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                {corporate.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setCorporate((prev) => ({ ...prev, logoUrl: '' }))}
                    className="px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-200 rounded hover:bg-red-50 cursor-pointer"
                  >
                    Usa Vettoriale Ufficiale
                  </button>
                )}
              </div>
            </div>

            {/* CAMPI DISTINTI PER LE DUE REALTÀ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ASSOCIAZIONE NAZIONALE */}
              <div className="border border-slate-300 rounded-lg p-5 space-y-3 bg-white">
                <div className="text-xs font-bold text-blue-900 uppercase tracking-wider pb-2 border-b border-slate-200">
                  Associazione Nazionale City Angels Italia ODV
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ragione Sociale (con a capo per coordinamento)
                  </label>
                  <textarea
                    rows={2}
                    value={assoc.ragioneSociale}
                    onChange={(e) =>
                      setCorporate((prev) => ({
                        ...prev,
                        associazione: { ...assoc, ragioneSociale: e.target.value },
                      }))
                    }
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefono per emergenze e info
                  </label>
                  <input
                    type="text"
                    value={assoc.telEmergenze}
                    onChange={(e) =>
                      setCorporate((prev) => ({
                        ...prev,
                        associazione: { ...assoc, telEmergenze: e.target.value },
                      }))
                    }
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="text"
                    value={assoc.email}
                    onChange={(e) =>
                      setCorporate((prev) => ({
                        ...prev,
                        associazione: { ...assoc, email: e.target.value },
                      }))
                    }
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sito Internet
                  </label>
                  <input
                    type="text"
                    value={assoc.sitoWeb}
                    onChange={(e) =>
                      setCorporate((prev) => ({
                        ...prev,
                        associazione: { ...assoc, sitoWeb: e.target.value },
                      }))
                    }
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Codice Fiscale (dedicato / opzionale)
                  </label>
                  <input
                    type="text"
                    value={assoc.codiceFiscale}
                    onChange={(e) =>
                      setCorporate((prev) => ({
                        ...prev,
                        associazione: { ...assoc, codiceFiscale: e.target.value },
                      }))
                    }
                    placeholder="C.F. dell'associazione (se disponibile)"
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              {/* COOPERATIVA SOCIALE */}
              <div className="border border-slate-300 rounded-lg p-5 space-y-3 bg-white">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-200">
                  CITY ANGELS VARESE Coop. soc.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ragione Sociale Cooperativa
                  </label>
                  <input
                    type="text"
                    value={coop.ragioneSociale}
                    onChange={(e) =>
                      setCorporate((prev) => ({
                        ...prev,
                        cooperativa: { ...coop, ragioneSociale: e.target.value },
                      }))
                    }
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-300 rounded font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sede Legale
                  </label>
                  <input
                    type="text"
                    value={coop.sedeLegale}
                    onChange={(e) =>
                      setCorporate((prev) => ({
                        ...prev,
                        cooperativa: { ...coop, sedeLegale: e.target.value },
                      }))
                    }
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefono
                  </label>
                  <input
                    type="text"
                    value={coop.telefono}
                    onChange={(e) =>
                      setCorporate((prev) => ({
                        ...prev,
                        cooperativa: { ...coop, telefono: e.target.value },
                      }))
                    }
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email
                    </label>
                    <input
                      type="text"
                      value={coop.email}
                      onChange={(e) =>
                        setCorporate((prev) => ({
                          ...prev,
                          cooperativa: { ...coop, email: e.target.value },
                        }))
                      }
                      className="w-full h-9 px-2 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      PEC
                    </label>
                    <input
                      type="text"
                      value={coop.pec}
                      onChange={(e) =>
                        setCorporate((prev) => ({
                          ...prev,
                          cooperativa: { ...coop, pec: e.target.value },
                        }))
                      }
                      className="w-full h-9 px-2 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sito Internet
                    </label>
                    <input
                      type="text"
                      value={coop.sitoWeb}
                      onChange={(e) =>
                        setCorporate((prev) => ({
                          ...prev,
                          cooperativa: { ...coop, sitoWeb: e.target.value },
                        }))
                      }
                      className="w-full h-9 px-2 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      C.F. e P. IVA
                    </label>
                    <input
                      type="text"
                      value={coop.cfPiva}
                      onChange={(e) =>
                        setCorporate((prev) => ({
                          ...prev,
                          cooperativa: { ...coop, cfPiva: e.target.value },
                        }))
                      }
                      className="w-full h-9 px-2 text-xs bg-white border border-slate-300 rounded font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Iscrizioni, Albi e RUNTS
                  </label>
                  <textarea
                    rows={3}
                    value={coop.iscrizioniRegistri}
                    onChange={(e) =>
                      setCorporate((prev) => ({
                        ...prev,
                        cooperativa: { ...coop, iscrizioniRegistri: e.target.value },
                      }))
                    }
                    className="w-full p-2 text-[11px] bg-white border border-slate-300 rounded leading-tight"
                  />
                </div>
              </div>
            </div>

            {/* GESTIONE TARGHE MEZZI FISSE (PARCHEGGIO P1 MXP) */}
            <div className="border border-slate-300 rounded-lg p-5 bg-white space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Car className="w-4 h-4 text-[#df0a14]" />
                    <span>Targhe Mezzi di Servizio Fisse (Accesso Parcheggio P1)</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    I mezzi di servizio dell&apos;Associazione e della Cooperativa City Angels hanno numeri di targa fissi. Tutte le targhe memorizzate qui restano salvate per sempre nel dispositivo e vengono suggerite o precompilate automaticamente in ogni report.
                  </p>
                </div>
              </div>

              {/* Elenco targhe memorizzate in tabella / card */}
              <div className="space-y-2">
                {savedPlates.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-2">
                    Nessun numero di targa memorizzato. Aggiungi il tuo primo mezzo qui sotto.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {savedPlates.map((sp) => (
                      <div
                        key={sp.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-col justify-between gap-2 shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-mono font-bold text-sm text-slate-900 tracking-wide bg-white px-2 py-0.5 border border-slate-300 rounded">
                              {sp.targa}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeSavedPlate(sp.id)}
                              className="text-slate-400 hover:text-red-700 p-1 cursor-pointer"
                              title="Elimina targa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="text-xs text-slate-600 font-medium">
                            {sp.label || 'Mezzo di servizio'}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => togglePlateDefault(sp.id, 1)}
                            className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                              sp.isDefaultSbarra1
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                            title="Imposta/Rimuovi come predefinita per Sbarra 1"
                          >
                            {sp.isDefaultSbarra1 ? '⭐ Default Sbarra 1' : 'Imposta Sb. 1'}
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePlateDefault(sp.id, 2)}
                            className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                              sp.isDefaultSbarra2
                                ? 'bg-blue-100 text-blue-900 border border-blue-300 font-bold'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                            title="Imposta/Rimuovi come predefinita per Sbarra 2"
                          >
                            {sp.isDefaultSbarra2 ? '⭐ Default Sbarra 2' : 'Imposta Sb. 2'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form aggiunta nuovo mezzo / targa */}
              <div className="pt-3 border-t border-slate-200 bg-slate-50/70 p-3.5 rounded-md space-y-2">
                <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-blue-700" />
                  <span>Aggiungi nuovo mezzo / numero di targa:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Numero Targa *
                    </label>
                    <input
                      type="text"
                      placeholder="Es. GA 123 CA"
                      value={newPlateInput}
                      onChange={(e) => setNewPlateInput(e.target.value.toUpperCase())}
                      className="w-full h-8 px-2 text-xs font-mono uppercase bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Descrizione mezzo (es. Panda CA Varese)
                    </label>
                    <input
                      type="text"
                      placeholder="Opzionale (es. Mezzo 1, Coordinatore)"
                      value={newPlateLabel}
                      onChange={(e) => setNewPlateLabel(e.target.value)}
                      className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div className="sm:col-span-3 flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        addSavedPlate(
                          newPlateInput,
                          newPlateLabel,
                          newPlateDef1,
                          newPlateDef2
                        )
                      }
                      disabled={!newPlateInput.trim()}
                      className="w-full h-8 px-3 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded cursor-pointer transition-colors"
                    >
                      Memorizza Targa
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-5 pt-1 text-[11px] text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPlateDef1}
                      onChange={(e) => setNewPlateDef1(e.target.checked)}
                      className="rounded text-blue-700"
                    />
                    <span>Assegna come targa predefinita per Sbarra 1</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPlateDef2}
                      onChange={(e) => setNewPlateDef2(e.target.checked)}
                      className="rounded text-blue-700"
                    />
                    <span>Assegna come targa predefinita per Sbarra 2</span>
                  </label>
                </div>
              </div>
            </div>

            {/* GESTIONE ARCHIVIO FIRME SCANSIONATE DEI COMPILATORI UFFICIALI */}
            <div className="border border-slate-300 rounded-lg p-5 bg-white space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-[#df0a14]" />
                    <span>Archivio Firme Scansionate dei Compilatori Ufficiali</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Carica o sostituisci le scansioni delle firme autografe per <strong>Andrea Menegotto (Tiger)</strong> e <strong>Chiara Menegotto (Mene)</strong>. Le firme sono sincronizzate nel database Cloud e accessibili a tutti i collaboratori autorizzati.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTriggerSignatureRecovery}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  title="Cerca e sincronizza firme precedentemente caricate in cache o salvate su Cloud"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Scansiona e Ripristina Firme</span>
                </button>
              </div>

              {/* Elenco Firme Salvate */}
              <div className="space-y-2">
                {savedSignatures.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-2">
                    Nessuna firma scansionata presente nell&apos;archivio. Aggiungi la tua prima firma qui sotto.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {savedSignatures
                      .filter((sig) => isOfficialCompiler(sig.nomeOperatore))
                      .map((sig) => {
                      const isCurrentReportSignature = report.firmaImmagineUrl === sig.immagineUrl;
                      const isCustomImage =
                        typeof sig.immagineUrl === 'string' &&
                        sig.immagineUrl.startsWith('data:image/') &&
                        !sig.immagineUrl.includes('<svg');
                      return (
                        <div
                          key={sig.id}
                          className={`p-3.5 border rounded-md flex flex-col justify-between gap-2.5 transition-all ${
                            isCurrentReportSignature
                              ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-bold text-xs text-slate-900">
                                {sig.nomeOperatore}
                              </span>
                              {isCustomImage ? (
                                <span className="text-[9.5px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded font-bold">
                                  Scansione Reale
                                </span>
                              ) : (
                                <span className="text-[9.5px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded font-medium">
                                  Tratto Base
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mb-2">
                              {sig.label || 'Firma Ufficiale'}
                            </div>
                            <div className="h-14 bg-white border border-slate-200 rounded p-1.5 flex items-center justify-center">
                              <img
                                src={sig.immagineUrl}
                                alt={sig.nomeOperatore}
                                className="max-h-11 max-w-full object-contain"
                              />
                            </div>
                          </div>

                          <div className="pt-2.5 border-t border-slate-200 space-y-2">
                            {/* Upload rapido per questo compilatore */}
                            <label className="w-full py-1 px-2 text-[11px] font-semibold text-slate-700 bg-white border border-dashed border-slate-300 rounded hover:bg-slate-50 flex items-center justify-center gap-1 cursor-pointer transition-colors">
                              <Upload className="w-3 h-3 text-[#df0a14]" />
                              <span>Sostituisci Immagine (.png, .jpg)</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    const proc = await processSignatureImageFile(f);
                                    await addSavedSignature(
                                      sig.nomeOperatore,
                                      `Firma Scansionata - ${sig.nomeOperatore}`,
                                      proc
                                    );
                                  }
                                  e.target.value = '';
                                }}
                                className="hidden"
                              />
                            </label>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  updateField('firmaImmagineUrl', sig.immagineUrl);
                                  showNotice(`Firma scansionata di "${sig.nomeOperatore}" applicata al report.`);
                                }}
                                className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                                  isCurrentReportSignature
                                    ? 'bg-blue-700 text-white font-bold'
                                    : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
                                }`}
                              >
                                {isCurrentReportSignature ? '✓ Attiva nel Report' : 'Usa nel Report'}
                              </button>

                              {isCustomImage && (
                                <button
                                  type="button"
                                  onClick={() => resetCompilerSignature(sig.nomeOperatore)}
                                  className="py-1.5 px-2 text-[10.5px] text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded font-medium cursor-pointer"
                                  title="Ripristina il tratto predefinito di sistema"
                                >
                                  Reset
                                </button>
                              )}

                              {isCurrentReportSignature && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateField('firmaImmagineUrl', '');
                                    showNotice('Firma rimossa: il campo rimarrà vuoto.');
                                  }}
                                  className="px-2 py-1.5 text-[10.5px] text-red-600 hover:text-red-800 bg-white border border-red-200 rounded font-semibold cursor-pointer"
                                  title="Rimuovi firma e lascia vuoto"
                                >
                                  Vuoto
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Form per caricare una nuova firma scansionata */}
              <div className="pt-3 border-t border-slate-200 bg-slate-50/70 p-3.5 rounded-md space-y-2">
                <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-blue-700" />
                  <span>Carica Nuova Firma Scansionata:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Operatore associato *
                    </label>
                    <select
                      value={newSigOperator}
                      onChange={(e) => {
                        setNewSigOperator(e.target.value);
                        if (!newSigLabel) {
                          setNewSigLabel(`Firma Scansionata - ${e.target.value}`);
                        }
                      }}
                      className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded font-semibold text-slate-800"
                    >
                      {OFFICIAL_COMPILERS.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.nickname})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Etichetta descrittiva
                    </label>
                    <input
                      type="text"
                      placeholder="Es. Firma autografa Tiger"
                      value={newSigLabel}
                      onChange={(e) => setNewSigLabel(e.target.value)}
                      className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      File immagine firma (.png, .jpg)
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 h-8 px-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 cursor-pointer flex items-center justify-center gap-1">
                        <Upload className="w-3.5 h-3.5 text-[#df0a14]" />
                        <span>{newSigDataUrl ? 'Cambia File' : 'Scegli File'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const proc = await processSignatureImageFile(file);
                              setNewSigDataUrl(proc);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      {newSigDataUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            addSavedSignature(
                              newSigOperator,
                              newSigLabel,
                              newSigDataUrl
                            )
                          }
                          className="h-8 px-3 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded cursor-pointer whitespace-nowrap transition-colors"
                        >
                          Salva Firma
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {newSigDataUrl && (
                  <div className="mt-2 flex items-center gap-3 p-2 bg-white border border-slate-200 rounded">
                    <span className="text-[11px] font-semibold text-slate-700">Anteprima file caricato:</span>
                    <div className="h-8 px-2 border border-slate-200 rounded flex items-center bg-slate-50">
                      <img
                        src={newSigDataUrl}
                        alt="Anteprima"
                        className="max-h-6 object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* TAB 5: STORICO DEI REPORT */}
        {activeTab === 'history' && (
          <section className="no-print bg-white border border-slate-300 rounded-lg p-5 sm:p-6 space-y-6 shadow-xs">
            {/* Header Storico */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <FolderSync className="w-5 h-5 text-blue-700" />
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Elenco Completo e Gestione Report Archiviati
                  </h2>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-xs">
                    {historyReports.length} Servizi Totali
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Archivio consolidato: include tutti i report <strong>dal 2025 al 2026 (fino al Report 36 e successivi)</strong> e la <strong>cartella condivisa Google Drive</strong>. Da qui puoi cercare, sincronizzare in tempo reale da Drive, ripristinare, stampare o cancellare qualsiasi report.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <label
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 border border-slate-950 rounded-md transition-colors cursor-pointer shadow-2xs"
                  title="Carica un report PDF o JSON (es. Report 38 o Report 39 corretti) per aggiornare direttamente lo storico e il cloud"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Carica Report (PDF o JSON)</span>
                  <input
                    type="file"
                    accept=".pdf,.json"
                    onChange={handleManualHistoryReportUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleSyncHistoryFromDrive}
                  disabled={isSyncingHistoryDrive}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 border border-blue-800 rounded-md transition-colors cursor-pointer shadow-2xs"
                  title="Esegue una scansione in tempo reale di Google Drive (cartella principale e sottocartelle 2026/2025) e aggiorna lo storico con i file caricati"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingHistoryDrive ? 'animate-spin' : ''}`} />
                  <span>{isSyncingHistoryDrive ? 'Sincronizzazione Drive...' : 'Sincronizza da Google Drive'}</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const cloudReports = await fetchSharedArchiveFromCloud('Aggiornamento Manuale');
                      const merged = mergeReportEntries(historyReports, cloudReports);
                      setHistoryReports(merged);
                      try {
                        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
                      } catch {
                        // ignore
                      }
                      showNotice(`Archivio Cloud sincronizzato con successo! ${merged.length} report storici allineati tra PC e Android.`);
                    } catch (e: any) {
                      showNotice('Errore sincronizzazione Cloud: ' + (e?.message || 'errore di connessione'));
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition-colors cursor-pointer shadow-2xs"
                  title="Sincronizza all'istante l'archivio con Cloud Firestore (condiviso bidirezionalmente tra tutti i dispositivi PC e smartphone Android)"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Sincronizza Cloud (PC & Android)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const merged = mergeReportEntries(INITIAL_HISTORICAL_REPORTS, historyReports);
                    setHistoryReports(merged);
                    try {
                      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
                    } catch {
                      // ignore
                    }
                    const userLabel =
                      driveUser?.displayName
                        ? `${driveUser.displayName} (${driveUser.email || ''})`.trim()
                        : (driveUser?.email || 'Ripristino Storico');
                    pushSharedArchiveToCloud(merged, userLabel).catch(() => {});
                    showNotice(`Storico consolidato e sincronizzato sul Cloud: aggiornati tutti i ${merged.length} report (incluso Report 36 per PC e Android).`);
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer shadow-2xs"
                  title="Ricarica i report base e consolida l'archivio locale e Cloud per tutti i dispositivi"
                >
                  <FolderSync className="w-3.5 h-3.5 text-blue-700" />
                  <span>Consolida Archivio ({INITIAL_HISTORICAL_REPORTS.length})</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenNewReportModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 border border-emerald-500 rounded-md transition-colors cursor-pointer shadow-2xs"
                  title="Azzera tutti i campi del report e predispone il nuovo numero progressivo in base all'archiviazione"
                >
                  <FilePlus2 className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Nuovo Report Pulito</span>
                </button>
              </div>
            </div>

            {/* Barra Filtri: Ricerca e Selezione Anno */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {/* Ricerca Testuale */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Cerca per N° report, data (es. 24/09 o 2026-09), caposervizio, note, varchi..."
                  className="w-full h-9 pl-3 pr-8 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filtri Anno */}
              <div className="flex items-center gap-1.5 shrink-0 text-xs font-semibold">
                <span className="text-slate-500 mr-1 text-[11px] hidden sm:inline">Filtra Anno:</span>
                <button
                  type="button"
                  onClick={() => setHistoryYearFilter('ALL')}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    historyYearFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Tutti ({historyCounts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryYearFilter('2026')}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    historyYearFilter === '2026'
                      ? 'bg-blue-800 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Anno 2026 ({historyCounts.y2026})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryYearFilter('2025')}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    historyYearFilter === '2025'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Anno 2025 ({historyCounts.y2025})
                </button>
              </div>
            </div>

            {/* Quick KPI Cards dei report visualizzati */}
            {filteredHistoryReports.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <div className="text-slate-500 font-medium">Report Visualizzati</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {filteredHistoryReports.length} <span className="text-xs text-slate-500 font-normal">/ {historyReports.length}</span>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <div className="text-slate-500 font-medium">Presenze Censite Totali</div>
                  <div className="text-lg font-bold text-[#df0a14] mt-0.5">
                    {filteredHistoryReports.reduce((sum, item) => {
                      const rep = item.report;
                      const s = (rep.rilevazioni || []).reduce(
                        (sub, r) => sub + (Number(r.numeroUtenti) || 0),
                        0
                      );
                      const p = Number.isFinite((rep as any).totalePresenzeOverride)
                        ? Number((rep as any).totalePresenzeOverride)
                        : s > 0
                        ? s
                        : (Number.isFinite((rep as any).totalePresenze) ? Number((rep as any).totalePresenze) : 0);
                      return sum + p;
                    }, 0)}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <div className="text-slate-500 font-medium">Colloqui / Agganci</div>
                  <div className="text-lg font-bold text-blue-700 mt-0.5">
                    {filteredHistoryReports.reduce(
                      (sum, item) =>
                        sum + (item.report.rilevazioni || []).filter((r) => r.aggancioEffettuato).length,
                      0
                    )}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <div className="text-slate-500 font-medium">Affiancamenti</div>
                  <div className="text-lg font-bold text-emerald-700 mt-0.5">
                    {filteredHistoryReports.filter((item) => !!getSaracinoAffiancamentoForReport(item.report)).length}
                  </div>
                </div>
              </div>
            )}

            {/* Tabella Report */}
            {filteredHistoryReports.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-slate-500 text-xs">
                <p className="font-semibold text-slate-700 text-sm mb-1">
                  Nessun report trovato con i filtri attuali.
                </p>
                <p>Prova a modificare il testo di ricerca o seleziona &ldquo;Tutti&rdquo;.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-2xs">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                      <th className="p-2.5 text-left whitespace-nowrap">Report &amp; Anno</th>
                      <th className="p-2.5 text-left whitespace-nowrap">Data Servizio</th>
                      <th className="p-2.5 text-left whitespace-nowrap">Caposervizio</th>
                      <th className="p-2.5 text-center whitespace-nowrap">Presenze Censite</th>
                      <th className="p-2.5 text-left">Affiancamento</th>
                      <th className="p-2.5 text-center whitespace-nowrap">Origine / Drive</th>
                      <th className="p-2.5 text-right whitespace-nowrap">Azioni Gestione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredHistoryReports.map((entry) => {
                      const rep = entry.report;
                      const repNum = Number(rep.numeroReport) || 0;
                      const affiancamento = getSaracinoAffiancamentoForReport(rep);
                      const is2025 = (rep.data || '').startsWith('2025') || (entry.fileName || '').includes('2025');
                      const yearBadge = is2025 ? '2025' : '2026';
                      const isHistoricalUpTo36 = is2025 || repNum <= 36;
                      const sumRil = (rep.rilevazioni || []).reduce(
                        (sum, r) => sum + (Number(r.numeroUtenti) || 0),
                        0
                      );
                      const presenzeTot = Number.isFinite((rep as any).totalePresenzeOverride)
                        ? Number((rep as any).totalePresenzeOverride)
                        : sumRil > 0
                        ? sumRil
                        : (Number.isFinite((rep as any).totalePresenze) ? Number((rep as any).totalePresenze) : 0);
                      const isFromDrive = entry.id.startsWith('drive-') || !!entry.fileName;

                      return (
                        <tr key={entry.id} className="hover:bg-blue-50/40 transition-colors">
                          <td className="p-2.5 font-bold whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-900 text-sm">
                                N. {rep.numeroReport ?? '—'}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                  is2025
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-blue-50 text-blue-800 border-blue-300'
                                }`}
                              >
                                {yearBadge}
                              </span>
                            </div>
                          </td>
                          <td className="p-2.5 font-medium text-slate-900 whitespace-nowrap">
                            {formatDateIT(rep.data)}
                          </td>
                          <td className="p-2.5 text-slate-900 font-semibold whitespace-nowrap">
                            {rep.caposervizio || 'Andrea Menegotto'}
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded font-bold text-xs bg-slate-100 text-slate-900 border border-slate-300">
                              {presenzeTot}
                            </span>
                          </td>
                          <td className="p-2.5 text-left">
                            {affiancamento ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                                {affiancamento}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            {isFromDrive ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded"
                                title={entry.fileName || 'Sincronizzato da Google Drive'}
                              >
                                <CloudUpload className="w-3 h-3 text-blue-600" />
                                <span>Google Drive</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                <Save className="w-3 h-3 text-slate-500" />
                                <span>Archivio Locale</span>
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {isHistoricalUpTo36 ? (
                                <>
                                  <a
                                    href={getDirectDriveFileUrl(entry, driveFilesList)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 border border-blue-800 rounded-md transition-colors shadow-2xs no-underline"
                                    title={`Collegamento diretto al file originale PDF archiviato su Google Drive (Report N. ${repNum})`}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-white" />
                                    <span>Scarica Originale Drive</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const is2025Rep = (rep.data || '').startsWith('2025') || (entry.fileName || '').includes('2025');
                                      const targetRep = (!is2025Rep && rep.numeroReport === 36) ? getCanonicalReport36() : rep;
                                      handleLoadHistoricalReportToEditor(targetRep);
                                    }}
                                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer"
                                    title="Consulta i dati storici del report nell'editor salvaguardando la bozza attiva"
                                  >
                                    Consulta
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleLoadHistoricalReportToEditor(entry.report);
                                    }}
                                    className="px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded transition-colors cursor-pointer"
                                    title="Carica questo report nei campi per visualizzarlo o modificarlo"
                                  >
                                    Carica nell&apos;Editor
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handlePrintHistoryEntry(entry)}
                                    disabled={isGeneratingPdf}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors cursor-pointer"
                                    title="Scarica il PDF A4 ufficiale elaborato dall'app"
                                  >
                                    <Download className="w-3.5 h-3.5 text-blue-700" />
                                    <span>PDF A4</span>
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setReportToDelete(entry);
                                  setDeleteFromDriveChecked(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors cursor-pointer"
                                title="Elimina questo report dallo storico e da Google Drive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Elimina</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Documento A4 ufficiale stampabile montato in background solo in caso di stampa da browser */}
        {isPrinting && activeTab !== 'preview' && (
          <div className="hidden print:block w-[210mm] m-0 p-0">
            <A4PaginatedDocument
              report={report}
              corporate={corporate}
              totalSubjects={totalSubjects}
              totalEngagements={totalEngagements}
              previewMode={false}
              roster={roster}
            />
          </div>
        )}
      </main>

      {/* MODALE DI CONFERMA CANCELLAZIONE REPORT (LOCALE & GOOGLE DRIVE) */}
      {reportToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingReport) {
              setReportToDelete(null);
            }
          }}
        >
          <div className="bg-white border border-slate-300 rounded-xl max-w-lg w-full p-5 shadow-2xl relative my-auto animate-in fade-in duration-200">
            <div className="flex items-start gap-3 pb-3 border-b border-slate-200">
              <div className="p-2.5 rounded-lg bg-red-100 text-red-700 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  Conferma Eliminazione Report N. {reportToDelete.report.numeroReport ?? '—'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Servizio del <strong>{formatDateIT(reportToDelete.report.data)}</strong>
                  {reportToDelete.report.caposervizio ? ` · Caposervizio: ${reportToDelete.report.caposervizio}` : ''}
                </p>
              </div>
              {!isDeletingReport && (
                <button
                  type="button"
                  onClick={() => setReportToDelete(null)}
                  className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-700">
              <p>
                Sei sicuro di voler eliminare questo report? Questa azione rimuoverà il verbale dallo storico dei servizi dell&apos;applicazione.
              </p>

              {/* Opzione eliminazione da Google Drive */}
              <div className="p-3.5 bg-red-50/80 border border-red-200 rounded-lg space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteFromDriveChecked}
                    onChange={(e) => setDeleteFromDriveChecked(e.target.checked)}
                    disabled={isDeletingReport}
                    className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-red-950 block">
                      Elimina anche i file da Google Drive (PDF e JSON)
                    </span>
                    <p className="text-[11px] text-red-800 mt-0.5 leading-relaxed">
                      Se attivo, l&apos;applicazione cercherà ed eliminerà contestualmente dalla cartella condivisa di <strong>Google Drive</strong> (sottocartelle 2025/2026) tutti i file associati a questo turno (PDF A4 e dati strutturati JSON).
                    </p>
                  </div>
                </label>
              </div>

              <div className="text-[11px] text-slate-500 font-mono-tabular bg-slate-50 p-2.5 rounded border border-slate-200">
                <div>ID identificativo: {reportToDelete.id}</div>
                {reportToDelete.fileName && <div>File associato: {reportToDelete.fileName}</div>}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setReportToDelete(null)}
                disabled={isDeletingReport}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleDeleteReportConfirmed}
                disabled={isDeletingReport}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
              >
                {isDeletingReport ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminazione in corso...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {deleteFromDriveChecked
                        ? 'Elimina da Storico e Drive'
                        : 'Elimina solo da Storico'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE DI CONFERMA NUOVO REPORT DA ZERO (AZZERA CAMPI & PROGRESSIVO) */}
      {isNewReportModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsNewReportModalOpen(false);
            }
          }}
        >
          <div className="bg-white border border-slate-300 rounded-xl max-w-lg w-full p-5 shadow-2xl relative my-auto animate-in fade-in duration-200">
            <div className="flex items-start gap-3 pb-3 border-b border-slate-200">
              <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                <FilePlus2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  Prepara Nuovo Report Pulito da Zero
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Azzera tutti i dati di compilazione e avvia il turno successivo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewReportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-700">
              {/* Box Progressivo */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-3.5 space-y-2">
                <label className="block text-xs font-bold text-emerald-950">
                  Numero progressivo assegnato (calcolato dall'archiviazione):
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 uppercase font-mono">
                      Report N.
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={newReportTargetNumber}
                      onChange={(e) =>
                        setNewReportTargetNumber(
                          Math.max(1, parseInt(e.target.value, 10) || 1)
                        )
                      }
                      className="w-24 h-9 px-3 text-base font-black text-slate-950 bg-white border border-emerald-400 rounded-md focus:ring-2 focus:ring-emerald-600 text-center font-mono shadow-2xs"
                    />
                  </div>
                  <span className="text-[11px] text-emerald-900 italic">
                    (Storico archiviato: max N.{' '}
                    {Math.max(
                      ...(historyReports
                        .map((e) => Number(e.report?.numeroReport) || 0)
                        .filter((n) => n > 0)),
                      35
                    )}
                    )
                  </span>
                </div>
              </div>

              {/* Dettaglio campi che vengono azzerati */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-[11.5px]">
                <div className="font-bold text-slate-800">
                  Cosa succede confermando:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                  <li>
                    Tutti i campi (data, orari, squadra, luoghi, punti di rilevazione, note e osservazioni) vengono{' '}
                    <strong>azzerati e ripuliti</strong>.
                  </li>
                  <li>
                    Viene inserito <strong>unicamente il nuovo numero progressivo N. {newReportTargetNumber}</strong>.
                  </li>
                  <li>
                    Il modulo sarà subito pronto per la compilazione del nuovo servizio da zero.
                  </li>
                </ul>
              </div>

              {/* Checkbox salvataggio di sicurezza se non già archiviata */}
              {(() => {
                const archiveStatus = isCurrentReportArchivedInHistory(report);
                return (
                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoArchiveCurrentBeforeReset}
                        onChange={(e) => setAutoArchiveCurrentBeforeReset(e.target.checked)}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="font-bold text-blue-950 block">
                          Archivia prima una copia del report attuale (N. {report.numeroReport ?? '—'}) nello storico locale se non già archiviata
                        </span>
                        {archiveStatus.isIdentical ? (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium bg-emerald-100/70 border border-emerald-300 rounded px-2.5 py-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Questo report risulta <strong>già archiviato nello storico locale</strong>. Nessun duplicato superfluo verrà generato.</span>
                          </div>
                        ) : archiveStatus.isArchived ? (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-blue-800 font-medium bg-blue-100/70 border border-blue-300 rounded px-2.5 py-1">
                            <FolderSync className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>Questo report è presente nello storico ma presenta <strong>modifiche non ancora archiviate</strong>: selezionando l&apos;opzione verrà aggiornato prima del reset.</span>
                          </div>
                        ) : (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-900 font-medium bg-amber-100/70 border border-amber-300 rounded px-2.5 py-1">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Questo report <strong>non è ancora archiviato nello storico locale</strong>: verrà salvato automaticamente per proteggere tutti i dati compilati.</span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                );
              })()}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsNewReportModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfirmNewCleanReport}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>Conferma e Crea Nuovo Report N. {newReportTargetNumber}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE CONDIVISIONE / PUBBLICAZIONE APP */}
      {showShareModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowShareModal(false);
          }}
        >
          <div className="bg-white border border-slate-300 rounded-xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl relative animate-in fade-in duration-200 my-auto">
            {/* Header Fisso Finestra */}
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-200 shrink-0 flex items-start justify-between bg-slate-50/80 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pubblicazione e Condivisione App
                  </h3>
                  <p className="text-xs text-slate-500">
                    Accesso per i collaboratori, manutenzione diretta e integrazione Google Drive
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                title="Chiudi finestra"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenuto Scorrevole con Barra di Scorrimento / Cursore Laterale sempre visibile */}
            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-4 text-xs text-slate-700 flex-1 overscroll-contain">
              {/* URL PUBBLICO PER I COLLABORATORI */}
              <div className="p-4 bg-blue-50/90 border-2 border-blue-400 rounded-lg space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                    <span>Link per i Collaboratori (Da condividere con la squadra)</span>
                  </div>
                  <span className="text-blue-800 font-bold bg-blue-200/80 px-2 py-0.5 rounded text-[10.5px]">
                    Condivisibile
                  </span>
                </div>
                <p className="text-[11.5px] text-blue-900 leading-relaxed">
                  Invia questo indirizzo ai tuoi colleghi e compilatori: apre l&apos;applicazione pulita a tutto schermo senza la barra laterale di AI Studio.
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={SHARED_APP_PRODUCTION_URL}
                    className="flex-1 h-9 px-3 text-xs bg-white border border-blue-300 rounded font-mono select-all text-slate-900 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator?.clipboard?.writeText) {
                        navigator.clipboard.writeText(SHARED_APP_PRODUCTION_URL).catch(() => {});
                      }
                      setIsCopiedShareUrl(true);
                      setTimeout(() => setIsCopiedShareUrl(false), 3000);
                    }}
                    className="h-9 px-4 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded shrink-0 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    {isCopiedShareUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Copiato!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copia Link per i Collaboratori</span>
                      </>
                    )}
                  </button>
                  <a
                    href={SHARED_APP_PRODUCTION_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 px-3 text-xs font-semibold text-blue-900 bg-white hover:bg-blue-100/70 border border-blue-300 rounded shrink-0 inline-flex items-center justify-center gap-1 transition-colors"
                    title="Apri link pubblico in nuova scheda"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Apri</span>
                  </a>
                </div>
              </div>

              {/* Guida Manutenzione */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-1">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  <span>Manutenzione continua da Google AI Studio:</span>
                </div>
                <p className="text-emerald-950 leading-relaxed">
                  Tu puoi continuare a fare tutte le modifiche e la manutenzione da qui, su Google AI Studio. 
                  Ogni modifica richiesta viene compilata ed è subito attiva senza dover riconfigurare nulla.
                </p>
              </div>

              {/* Guida Google Drive Collaboratori */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1.5">
                <div className="font-bold text-blue-900 flex items-center gap-1.5">
                  <CloudUpload className="w-4 h-4 text-blue-700" />
                  <span>Accesso Google Drive per i Collaboratori Autorizzati:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-700 leading-relaxed">
                  <li>
                    I collaboratori aprono il link dell&apos;app e vanno nella scheda <strong>Google Drive</strong>.
                  </li>
                  <li>
                    Cliccano su <strong>Sign in with Google</strong> (o <strong>Cambia account Google</strong>) e si collegano con il loro account Google diretto.
                  </li>
                  <li>
                    <strong>Permessi di scrittura su Drive</strong>: accertati di aver condiviso la cartella Google Drive con i loro account impostandoli con ruolo <strong>Editor</strong> (&quot;Può modificare&quot;).
                  </li>
                  <li>
                    I collaboratori con ruolo Editor potranno archiviare direttamente i report (PDF A4 e dati JSON) nella sottocartella <strong>2026</strong>.
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer Fisso */}
            <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50/90 rounded-b-xl flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                City Angels MXP T1 · Finestra a scorrimento completo
              </span>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="ml-auto px-5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md shadow-xs transition-colors cursor-pointer"
              >
                Chiudi Finestra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="no-print border-t border-slate-300 bg-white py-3.5 px-6 text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="font-medium">
          Associazione Nazionale City Angels Italia ODV · CITY ANGELS VARESE Coop. soc.
        </div>
        <div className="font-mono-tabular text-[11px] text-slate-500">
          Report di Servizio Aeroporto Internazionale MXP · T1
        </div>
      </footer>
    </div>
  );
}
