import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  HistoricalReportEntry,
  INITIAL_HISTORICAL_REPORTS,
  OFFICIAL_PRESENZE_2025,
  OFFICIAL_PRESENZE_2026,
  OFFICIAL_SARACINO_AFFIANCAMENTI_2025,
  OFFICIAL_SARACINO_AFFIANCAMENTI_2026,
  getCanonicalReport36,
  getReportCorrectDate,
  getReportNormalizedKey,
  mergeReportEntries,
} from './reportHistoryMemory';
import {
  ServiceReportData,
  TESTO_FISSO_LUOGO_TERMINE,
  TESTO_FISSO_RIFERIMENTI_EMERGENZE,
} from '../types/report';
import {
  buildServiceReportFromExtractedPdf,
  extractReportDataFromPdfBytes,
} from './pdfArchiveParser';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
// Consente all'utente di selezionare direttamente il proprio account Google con cui autenticarsi
provider.setCustomParameters({ prompt: 'select_account' });

export const DEFAULT_SHARED_DRIVE_FOLDER_ID = '1pMxemf-XGqmjyZ_X_-oDLd0LEa0OopMf';
export const DEFAULT_SHARED_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1pMxemf-XGqmjyZ_X_-oDLd0LEa0OopMf';

export const STORAGE_KEY_SHARED_DRIVE_FOLDER = 'city_angels_shared_drive_folder_url_v1';

export function getStoredDriveFolderUrl(): string {
  try {
    const stored =
      localStorage.getItem(STORAGE_KEY_SHARED_DRIVE_FOLDER) ||
      sessionStorage.getItem(STORAGE_KEY_SHARED_DRIVE_FOLDER) ||
      localStorage.getItem('ca_shared_drive_folder_url_v1') ||
      sessionStorage.getItem('ca_shared_drive_folder_url_v1');
    if (stored && stored.trim().length > 0) {
      return stored.trim();
    }
    return DEFAULT_SHARED_DRIVE_FOLDER_URL;
  } catch {
    return DEFAULT_SHARED_DRIVE_FOLDER_URL;
  }
}

export function setStoredDriveFolderUrl(url: string): void {
  const cleanUrl = (url || '').trim();
  try {
    if (cleanUrl) {
      localStorage.setItem(STORAGE_KEY_SHARED_DRIVE_FOLDER, cleanUrl);
      localStorage.setItem('ca_shared_drive_folder_url_v1', cleanUrl);
      sessionStorage.setItem(STORAGE_KEY_SHARED_DRIVE_FOLDER, cleanUrl);
      sessionStorage.setItem('ca_shared_drive_folder_url_v1', cleanUrl);
    }
  } catch {
    // ignore
  }

  // Sincronizza anche su Firestore in tempo reale per tutti i collaboratori SOLO se l'URL non è vuoto
  if (cleanUrl) {
    try {
      const docRef = doc(db, 'app_settings', 'drive_config');
      setDoc(docRef, { folderUrl: cleanUrl, updatedAt: new Date().toISOString() }, { merge: true }).catch((err) => {
        console.warn('Impossibile salvare la configurazione Drive su Firestore:', err);
      });
    } catch (err) {
      console.warn('Errore persistenza Firestore per Drive folder:', err);
    }
  }
}

/**
 * Restituisce il collegamento diretto al file PDF o documento su Google Drive per una voce storica.
 */
export function getDirectDriveFileUrl(
  entry: HistoricalReportEntry,
  driveFiles: DriveFileMetadata[] = []
): string {
  if (entry.driveWebViewLink) return entry.driveWebViewLink;

  const directId =
    entry.driveFileId ||
    (entry.id?.startsWith('drive-') ? entry.id.replace(/^drive-(?:doc-)?/, '') : '');
  if (directId) {
    return `https://drive.google.com/file/d/${directId}/view`;
  }

  const repNum = Number(entry.report?.numeroReport) || 0;
  const is2025 =
    (entry.report?.data || '').startsWith('2025') ||
    (entry.fileName || '').includes('2025');
  const targetYear = is2025 ? '2025' : '2026';

  if (driveFiles && driveFiles.length > 0) {
    const match = driveFiles.find((f) => {
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
      return match.webViewLink || `https://drive.google.com/file/d/${match.id}/view`;
    }
  }

  return getStoredDriveFolderUrl() || DEFAULT_SHARED_DRIVE_FOLDER_URL;
}

/**
 * Restituisce il collegamento di download diretto al file originale binario su Google Drive.
 */
export function getDirectDriveDownloadUrl(
  entry: HistoricalReportEntry,
  driveFiles: DriveFileMetadata[] = []
): string {
  if (entry.driveWebContentLink) return entry.driveWebContentLink;
  const directId =
    entry.driveFileId ||
    (entry.id?.startsWith('drive-') ? entry.id.replace(/^drive-(?:doc-)?/, '') : '');
  if (directId) {
    return `https://drive.google.com/uc?export=download&id=${directId}`;
  }
  const repNum = Number(entry.report?.numeroReport) || 0;
  const is2025 =
    (entry.report?.data || '').startsWith('2025') ||
    (entry.fileName || '').includes('2025');
  const targetYear = is2025 ? '2025' : '2026';
  if (driveFiles && driveFiles.length > 0) {
    const match = driveFiles.find((f) => {
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
      return match.webContentLink || `https://drive.google.com/uc?export=download&id=${match.id}`;
    }
  }
  return getDirectDriveFileUrl(entry, driveFiles);
}

/**
 * Ascolta in tempo reale le modifiche all'URL della cartella condivisa su Firestore.
 * Quando l'amministratore o un collaboratore imposta la cartella, tutti i dispositivi la ricevono automaticamente.
 */
export function subscribeToDriveFolderUrl(callback: (folderUrl: string) => void): () => void {
  try {
    const docRef = doc(db, 'app_settings', 'drive_config');
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.folderUrl && typeof data.folderUrl === 'string') {
            try {
              localStorage.setItem(STORAGE_KEY_SHARED_DRIVE_FOLDER, data.folderUrl);
              sessionStorage.setItem(STORAGE_KEY_SHARED_DRIVE_FOLDER, data.folderUrl);
            } catch {
              // ignore
            }
            callback(data.folderUrl);
          }
        }
      },
      (err) => {
        console.warn('Errore ascolto drive_config su Firestore:', err);
      }
    );
    return unsub;
  } catch (err) {
    console.warn('Impossibile registrarsi all\'ascolto di drive_config:', err);
    return () => {};
  }
}

const STORAGE_KEY_OAUTH_TOKEN = 'ca_drive_oauth_token_v2';
const STORAGE_KEY_OAUTH_EXPIRY = 'ca_drive_oauth_expiry_v2';

// Token cache with browser storage persistence
let isSigningIn = false;
let cachedAccessToken: string | null = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_OAUTH_TOKEN) || sessionStorage.getItem(STORAGE_KEY_OAUTH_TOKEN);
    const expiry = localStorage.getItem(STORAGE_KEY_OAUTH_EXPIRY) || sessionStorage.getItem(STORAGE_KEY_OAUTH_EXPIRY);
    if (saved && expiry && parseInt(expiry, 10) > Date.now()) {
      return saved;
    }
  } catch {
    // ignore
  }
  return null;
})();

export const saveAccessToken = (token: string, expiresInSeconds = 3500) => {
  cachedAccessToken = token;
  const expiry = String(Date.now() + expiresInSeconds * 1000);
  try {
    localStorage.setItem(STORAGE_KEY_OAUTH_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_OAUTH_EXPIRY, expiry);
    sessionStorage.setItem(STORAGE_KEY_OAUTH_TOKEN, token);
    sessionStorage.setItem(STORAGE_KEY_OAUTH_EXPIRY, expiry);
  } catch {
    // ignore
  }
};

export const clearAccessToken = () => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY_OAUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEY_OAUTH_EXPIRY);
    sessionStorage.removeItem(STORAGE_KEY_OAUTH_TOKEN);
    sessionStorage.removeItem(STORAGE_KEY_OAUTH_EXPIRY);
  } catch {
    // ignore
  }
};

/**
 * Verifica effettiva del token OAuth presso l'endpoint ufficiale di Google.
 * Restituisce true SOLO se il token è valido e non scaduto.
 */
export const verifyGoogleToken = async (token: string): Promise<boolean> => {
  if (!token || typeof token !== 'string' || token.trim().length === 0) return false;
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token.trim())}`
    );
    if (res.ok) {
      const data = await res.json();
      return !!(data?.aud || data?.sub || data?.email);
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Controlla lo stato reale e veritiero della connessione a Google Drive.
 */
export const checkDriveConnectionStatus = async (): Promise<{
  connected: boolean;
  user: { email?: string; displayName?: string } | null;
}> => {
  const token = await getAccessToken();
  if (!token) {
    return { connected: false, user: null };
  }
  const isValid = await verifyGoogleToken(token);
  if (!isValid) {
    clearAccessToken();
    clearStoredUserProfile();
    return { connected: false, user: null };
  }
  const profile = getStoredUserProfile();
  return { connected: true, user: profile };
};

/**
 * Assicura che esista un token di accesso valido a Google Drive,
 * richiedendo l'accesso se necessario.
 */
export const ensureDriveConnection = async (): Promise<string> => {
  const token = await getAccessToken();
  if (token) return token;
  const res = await googleSignIn();
  if (!res?.accessToken) {
    throw new Error('Accesso a Google Drive non completato.');
  }
  return res.accessToken;
};

const STORAGE_KEY_USER_PROFILE = 'ca_drive_user_profile_v1';

export function getStoredUserProfile(): { email?: string; displayName?: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER_PROFILE);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

export function saveStoredUserProfile(profile: { email?: string; displayName?: string }) {
  try {
    localStorage.setItem(STORAGE_KEY_USER_PROFILE, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

export function clearStoredUserProfile() {
  try {
    localStorage.removeItem(STORAGE_KEY_USER_PROFILE);
  } catch {
    // ignore
  }
}

declare global {
  interface Window {
    google?: any;
  }
}

/**
 * Autenticazione diretta OAuth2 con Google Identity Services (GIS).
 * Utilizza direttamente l'oAuthClientId Google senza dipendere dalla chiave API Firebase!
 */
export async function signInWithGoogleIdentityServices(): Promise<{
  user: User;
  accessToken: string;
}> {
  return new Promise((resolve, reject) => {
    const oAuthClientId = (firebaseConfig as any).oAuthClientId;
    if (!oAuthClientId) {
      reject(new Error('OAuth Client ID non presente nella configurazione.'));
      return;
    }

    const executeTokenRequest = () => {
      if (!window.google?.accounts?.oauth2) {
        reject(
          new Error(
            'Libreria di autenticazione Google non pronta. Ricarica la pagina e riprova.'
          )
        );
        return;
      }

      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: oAuthClientId,
          scope: SCOPES.join(' '),
          prompt: 'select_account',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              if (tokenResponse.error === 'popup_closed_by_user') {
                reject(new Error('Accesso Google annullato: schermata chiusa prima della selezione.'));
              } else {
                reject(new Error(`Errore autorizzazione Google: ${tokenResponse.error}`));
              }
              return;
            }

            if (!tokenResponse?.access_token) {
              reject(new Error('Nessun token di accesso ricevuto da Google.'));
              return;
            }

            const token = tokenResponse.access_token;
            const expiresIn = Number(tokenResponse.expires_in) || 3500;
            saveAccessToken(token, expiresIn);

            let email = '';
            let displayName = '';
            try {
              const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (profileRes.ok) {
                const info = await profileRes.json();
                email = info.email || '';
                displayName = info.name || info.email || '';
              }
            } catch {
              // ignore
            }

            const profile = {
              email: email || 'am@andreamenegotto.it',
              displayName: displayName || 'Andrea Menegotto',
            };
            saveStoredUserProfile(profile);

            const mockUser = {
              uid: 'google-oauth-user',
              email: profile.email,
              displayName: profile.displayName,
              emailVerified: true,
              isAnonymous: false,
              metadata: {},
              providerData: [],
              refreshToken: '',
              tenantId: null,
              delete: async () => {},
              getIdToken: async () => token,
              getIdTokenResult: async () => ({ token } as any),
              reload: async () => {},
              toJSON: () => ({}),
              phoneNumber: null,
              photoURL: null,
              providerId: 'google.com',
            } as unknown as User;

            resolve({ user: mockUser, accessToken: token });
          },
        });

        client.requestAccessToken();
      } catch (err: any) {
        reject(new Error(err?.message || 'Impossibile avviare la finestra di login Google.'));
      }
    };

    if (window.google?.accounts?.oauth2) {
      executeTokenRequest();
    } else {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval);
          executeTokenRequest();
        } else if (attempts > 20) {
          clearInterval(interval);
          reject(
            new Error(
              'Il servizio Google Sign-In non ha risposto in tempo. Verifica la connessione e riprova.'
            )
          );
        }
      }, 150);
    }
  });
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  let isCancelled = false;

  // 1. Verifica token salvato con Google Identity Services / tokeninfo
  const checkStoredAuth = async () => {
    const token = await getAccessToken();
    if (!token) {
      if (!isCancelled && onAuthFailure) onAuthFailure();
      return;
    }

    // Effettua la verifica reale con Google
    const isValid = await verifyGoogleToken(token);
    if (isCancelled) return;

    if (isValid) {
      const storedProfile = getStoredUserProfile();
      const mockUser = {
        uid: 'google-oauth-user',
        email: storedProfile?.email || 'am@andreamenegotto.it',
        displayName: storedProfile?.displayName || 'Andrea Menegotto',
      } as unknown as User;
      if (onAuthSuccess) onAuthSuccess(mockUser, token);
    } else {
      // Token non valido o scaduto: ripulisci e segnala disconnessione
      clearAccessToken();
      clearStoredUserProfile();
      if (onAuthFailure) onAuthFailure();
    }
  };

  checkStoredAuth().catch(() => {
    if (!isCancelled) {
      clearAccessToken();
      clearStoredUserProfile();
      if (onAuthFailure) onAuthFailure();
    }
  });

  // 2. Gestione del redirect su smartphone o browser con blocco popup
  getRedirectResult(auth)
    .then(async (result) => {
      if (isCancelled) return;
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          saveAccessToken(credential.accessToken);
          if (result.user.email || result.user.displayName) {
            saveStoredUserProfile({
              email: result.user.email || '',
              displayName: result.user.displayName || '',
            });
          }
          if (onAuthSuccess) onAuthSuccess(result.user, credential.accessToken);
        }
      }
    })
    .catch((err) => {
      console.warn('Controllo redirect Google Auth:', err);
    });

  const unsubFirebase = onAuthStateChanged(auth, async (user: User | null) => {
    if (isCancelled) return;
    if (user) {
      const token = await getAccessToken();
      if (token) {
        const isValid = await verifyGoogleToken(token);
        if (isCancelled) return;
        if (isValid) {
          if (user.email || user.displayName) {
            saveStoredUserProfile({
              email: user.email || '',
              displayName: user.displayName || '',
            });
          }
          if (onAuthSuccess) onAuthSuccess(user, token);
          return;
        }
      }
      if (!isSigningIn && onAuthFailure) {
        onAuthFailure();
      }
    } else {
      // Nessun utente Firebase: controlliamo se c'è un token GIS valido
      const token = await getAccessToken();
      if (!token) {
        clearAccessToken();
        clearStoredUserProfile();
        if (onAuthFailure) onAuthFailure();
      }
    }
  });

  return () => {
    isCancelled = true;
    unsubFirebase();
  };
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'Impossibile ottenere il token di accesso da Google. Assicurati di aver concesso i permessi di accesso a Google Drive nella schermata di accesso.'
      );
    }
    saveAccessToken(credential.accessToken);
    if (result.user.email || result.user.displayName) {
      saveStoredUserProfile({
        email: result.user.email || '',
        displayName: result.user.displayName || '',
      });
    }
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.warn('Accesso standard Firebase non riuscito, avvio Google Identity Services (GIS):', error);

    // Se la chiave API Firebase è scaduta/revocata o il popup è stato bloccato,
    // usiamo Google Identity Services che si autentica direttamente via OAuth client ID
    const isApiKeyError =
      error?.code === 'auth/api-key-expired' ||
      error?.code === 'auth/invalid-api-key' ||
      String(error?.message || '').toLowerCase().includes('api-key-expired') ||
      String(error?.message || '').toLowerCase().includes('renew');

    const isPopupIssue =
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/cancelled-popup-request';

    if (isApiKeyError || isPopupIssue || !error?.code?.includes('cancelled')) {
      try {
        const gisRes = await signInWithGoogleIdentityServices();
        return gisRes;
      } catch (gisErr: any) {
        console.error('Errore fallback Google Identity Services:', gisErr);
        if (error?.code === 'auth/popup-closed-by-user' || gisErr?.message?.includes('annullato')) {
          throw new Error('Accesso Google annullato.');
        }
        throw new Error(
          gisErr?.message ||
            'Accesso a Google Drive non riuscito. Verifica che i pop-up siano consentiti nel browser.'
        );
      }
    }

    if (error?.code === 'auth/popup-closed-by-user') {
      throw new Error('Accesso Google annullato: la schermata di login è stata chiusa prima della conferma.');
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_OAUTH_TOKEN) || sessionStorage.getItem(STORAGE_KEY_OAUTH_TOKEN);
    const expiry = localStorage.getItem(STORAGE_KEY_OAUTH_EXPIRY) || sessionStorage.getItem(STORAGE_KEY_OAUTH_EXPIRY);
    if (saved && expiry && parseInt(expiry, 10) > Date.now()) {
      cachedAccessToken = saved;
      return saved;
    }
  } catch {
    // ignore
  }
  return null;
};

export const logoutGoogle = async () => {
  try {
    await auth.signOut();
  } catch {
    // ignore
  }
  clearAccessToken();
  clearStoredUserProfile();
};

/**
 * Extracts the Google Drive Folder ID from any shared Drive folder URL or raw ID.
 * Supports:
 * - https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz?usp=sharing
 * - https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
 * - https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz
 * - Raw ID: 1AbCdEfGhIjKlMnOpQrStUvWxYz
 */
export function extractDriveFolderId(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';

  const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (foldersMatch && foldersMatch[1]) {
    return foldersMatch[1];
  }

  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) {
    return idParamMatch[1];
  }

  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  return '';
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: number;
  folderId?: string;
  folderPath?: string;
  isFolder?: boolean;
}

export interface DriveFolderMetadata {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface DriveFolderHierarchyResult {
  rootFolder: DriveFolderMetadata;
  subfolders: { id: string; name: string; fileCount: number }[];
  target2026FolderId?: string;
  allFiles: DriveFileMetadata[];
  historicalReports: HistoricalReportEntry[];
}

/**
 * Verifies and fetches the shared folder's name and webViewLink on Google Drive
 */
export async function getSharedDriveFolderInfo(
  folderId: string
): Promise<DriveFolderMetadata> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Autenticazione Google richiesta.');
  }

  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    folderId
  )}?supportsAllDrives=true&fields=id,name,webViewLink,mimeType`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearAccessToken();
      throw new Error(
        'Sessione Google scaduta o non valida (401). Tocca "Disconnetti" e poi "Sign in with Google" per riautenticarti.'
      );
    }
    if (res.status === 403) {
      throw new Error(
        'Permesso negato da Google Drive (403): questo account Google non ha accesso alla cartella. Verifica che il proprietario (am@andreamenegotto.it) abbia condiviso la cartella su Google Drive con questo account (es. chiaraj.menegotto@gmail.com) assegnandogli il ruolo di "Editor".'
      );
    }
    if (res.status === 404) {
      throw new Error(
        'Cartella Google Drive non trovata o non accessibile (404): per privacy Google nasconde le cartelle se non sono condivise con questo account. Chiedi al proprietario della cartella (am@andreamenegotto.it) di condividere la cartella su Google Drive con questo indirizzo email assegnandogli il ruolo di "Editor".'
      );
    }
    const errText = await res.text();
    throw new Error(
      `Impossibile accedere alla cartella condivisa (${res.status}): ${errText}`
    );
  }

  return await res.json();
}

/**
 * Ensures a subfolder with given name exists inside parent folder, creating it if needed.
 */
export async function ensureSubfolderInDrive(
  parentFolderId: string,
  subfolderName = '2026'
): Promise<{ id: string; name: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Autenticazione Google richiesta.');
  }

  // 1. Check if the parentFolder itself is already the 2026 folder
  try {
    const parentInfo = await getSharedDriveFolderInfo(parentFolderId);
    if (parentInfo && (parentInfo.name.trim() === subfolderName || parentInfo.name.trim().toLowerCase() === subfolderName.toLowerCase())) {
      return { id: parentFolderId, name: parentInfo.name };
    }
  } catch {
    // continue
  }

  // 2. Search for existing subfolder inside parentFolder
  const q = `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`;

  const checkRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (checkRes.ok) {
    const data = await checkRes.json();
    const existing = (data.files || []).find(
      (f: any) =>
        f.name.trim() === subfolderName ||
        f.name.trim().toLowerCase() === subfolderName.toLowerCase() ||
        f.name.includes(subfolderName)
    );
    if (existing) {
      return { id: existing.id, name: existing.name };
    }
  }

  // 3. Create subfolder
  const createUrl = 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true';
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: subfolderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  });

  if (!createRes.ok) {
    if (createRes.status === 401) {
      clearAccessToken();
      throw new Error('Sessione Google scaduta (401). Effettua nuovamente il login con Google.');
    }
    if (createRes.status === 403) {
      throw new Error(
        `Permesso di scrittura negato su Google Drive (403): il tuo account Google non è abilitato come Editor per creare cartelle o salvare file in questa cartella condivisa. Chiedi al proprietario della cartella (am@andreamenegotto.it) di concederti i permessi di "Editor" su Google Drive.`
      );
    }
    const errText = await createRes.text();
    throw new Error(`Impossibile verificare/creare la sottocartella "${subfolderName}" su Drive (${createRes.status}): ${errText}`);
  }

  const created = await createRes.json();
  return { id: created.id, name: created.name || subfolderName };
}

/**
 * Scans a single Drive folder for its immediate children (both files and subfolders) with full pagination
 */
async function listImmediateFolderItems(
  folderId: string,
  folderPathName = ''
): Promise<{ files: DriveFileMetadata[]; subfolders: { id: string; name: string }[] }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Autenticazione Google richiesta.');
  }

  const files: DriveFileMetadata[] = [];
  const subfolders: { id: string; name: string }[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const q = `'${folderId}' in parents and trashed = false`;
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      q
    )}&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=modifiedTime desc&pageSize=100&fields=nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,webContentLink,size)`;

    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        clearAccessToken();
        throw new Error('Sessione Google scaduta (401). Tocca "Sign in with Google" per riautenticarti.');
      }
      if (res.status === 403 || res.status === 404) {
        throw new Error(
          'Accesso negato alla cartella Google Drive: assicurati che la cartella sia stata condivisa con questo account con ruolo "Editor".'
        );
      }
      throw new Error(`Errore lettura cartella Google Drive (${res.status}).`);
    }

    const data = await res.json();
    const rawList: any[] = data.files || [];

    for (const item of rawList) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        subfolders.push({ id: item.id, name: item.name });
      } else {
        const nameLower = (item.name || '').toLowerCase();
        // Escludiamo categoricamente tutti i file in formato DOC/DOCX/Word:
        // si considerano esclusivamente i file PDF definitivi (e i file JSON di sistema)
        const isWordDoc =
          nameLower.endsWith('.doc') ||
          nameLower.endsWith('.docx') ||
          item.mimeType === 'application/msword' ||
          item.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        if (isWordDoc) {
          continue;
        }

        files.push({
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          modifiedTime: item.modifiedTime,
          webViewLink: item.webViewLink,
          size: item.size ? parseInt(item.size, 10) : undefined,
          folderId,
          folderPath: folderPathName || 'Cartella Principale',
        });
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return { files, subfolders };
}

/**
 * RECURSIVE SCANNER: Scans the root folder and ALL subfolders (including 2025, 2026,
 * and any nested folders) so past reports from 2025 and 2026 are all identified for Gemini.
 */
export async function scanDriveHierarchyRecursively(
  rootFolderId: string
): Promise<DriveFolderHierarchyResult> {
  const rootInfo = await getSharedDriveFolderInfo(rootFolderId);
  const allFiles: DriveFileMetadata[] = [];
  const subfoldersInfo: { id: string; name: string; fileCount: number }[] = [];
  let target2026FolderId: string | undefined;

  // Breadth-first traversal of all subfolders up to 4 levels deep
  interface QueueItem {
    folderId: string;
    path: string;
    depth: number;
  }

  const queue: QueueItem[] = [
    { folderId: rootFolderId, path: rootInfo.name || 'Cartella Principale', depth: 0 },
  ];
  const visited = new Set<string>([rootFolderId]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    try {
      const items = await listImmediateFolderItems(
        current.folderId,
        current.depth === 0 ? '' : current.path
      );

      allFiles.push(...items.files);

      if (current.depth > 0) {
        subfoldersInfo.push({
          id: current.folderId,
          name: current.path,
          fileCount: items.files.length,
        });
      }

      // Check if current or subfolder is 2026
      for (const sub of items.subfolders) {
        const is2026 = sub.name.trim() === '2026' || sub.name.toLowerCase().includes('2026');
        if (is2026 && !target2026FolderId) {
          target2026FolderId = sub.id;
        }

        if (!visited.has(sub.id) && current.depth < 4) {
          visited.add(sub.id);
          const nextPath =
            current.depth === 0 ? sub.name : `${current.path} / ${sub.name}`;
          queue.push({
            folderId: sub.id,
            path: nextPath,
            depth: current.depth + 1,
          });
        }
      }
    } catch (scanErr) {
      console.warn(`Errore scansione cartella "${current.path}":`, scanErr);
    }
  }

  // If no 2026 subfolder was discovered, automatically ensure it exists for continuous archiving
  if (!target2026FolderId) {
    try {
      const ensured = await ensureSubfolderInDrive(rootFolderId, '2026');
      target2026FolderId = ensured.id;
      subfoldersInfo.push({
        id: ensured.id,
        name: '2026',
        fileCount: 0,
      });
    } catch (createErr) {
      console.warn('Impossibile verificare/creare sottocartella 2026:', createErr);
    }
  }

  // Extract and parse structured JSON reports found in any of the folders
  const jsonFiles = allFiles.filter(
    (f) => f.name.endsWith('.json') || f.mimeType === 'application/json'
  );
  const historicalReports: HistoricalReportEntry[] = [];
  const token = await getAccessToken();

  for (const jf of jsonFiles) {
    if (!token) break;
    try {
      const dlUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        jf.id
      )}?alt=media&supportsAllDrives=true`;
      const res = await fetch(dlUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const parsed = await res.json();
      if (parsed && parsed.report && Array.isArray(parsed.report.squadra)) {
        const is2025Report = (parsed.report.data || '').startsWith('2025') || (jf.folderPath || '').includes('2025');
        if (!is2025Report && Number(parsed.report.numeroReport) === 36) {
          historicalReports.push({
            id: parsed.id || `drive-${jf.id}`,
            savedAt: jf.modifiedTime || '2026-10-08T22:30:00.000Z',
            fileName: `${jf.folderPath ? `[${jf.folderPath}] ` : ''}${jf.name}`,
            driveFileId: jf.id,
            driveWebViewLink: jf.webViewLink || `https://drive.google.com/file/d/${jf.id}/view`,
            driveWebContentLink: jf.webContentLink,
            report: getCanonicalReport36(),
          });
          continue;
        }
        historicalReports.push({
          ...parsed,
          id: parsed.id || `drive-${jf.id}`,
          fileName: `${jf.folderPath ? `[${jf.folderPath}] ` : ''}${jf.name}`,
          driveFileId: jf.id,
          driveWebViewLink: jf.webViewLink || `https://drive.google.com/file/d/${jf.id}/view`,
          driveWebContentLink: jf.webContentLink,
        });
      } else if (parsed && Array.isArray(parsed.squadra)) {
        const is2025Report = (parsed.data || '').startsWith('2025') || (jf.folderPath || '').includes('2025');
        if (!is2025Report && Number(parsed.numeroReport) === 36) {
          historicalReports.push({
            id: `drive-${jf.id}`,
            savedAt: jf.modifiedTime || '2026-10-08T22:30:00.000Z',
            fileName: `${jf.folderPath ? `[${jf.folderPath}] ` : ''}${jf.name}`,
            driveFileId: jf.id,
            driveWebViewLink: jf.webViewLink || `https://drive.google.com/file/d/${jf.id}/view`,
            driveWebContentLink: jf.webContentLink,
            report: getCanonicalReport36(),
          });
          continue;
        }
        historicalReports.push({
          id: `drive-${jf.id}`,
          savedAt: jf.modifiedTime || new Date().toISOString(),
          fileName: `${jf.folderPath ? `[${jf.folderPath}] ` : ''}${jf.name}`,
          driveFileId: jf.id,
          driveWebViewLink: jf.webViewLink || `https://drive.google.com/file/d/${jf.id}/view`,
          driveWebContentLink: jf.webContentLink,
          report: parsed as ServiceReportData,
        });
      }
    } catch {
      // skip invalid JSON
    }
  }

  // Convert non-JSON documents (PDF and DOC) found in 2025 and 2026 Drive subfolders into historical report entries
  for (const file of allFiles) {
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.mimeType === 'application/pdf';
    const isDoc =
      file.name.toLowerCase().endsWith('.docx') ||
      file.name.toLowerCase().endsWith('.doc') ||
      file.mimeType?.includes('word') ||
      file.mimeType?.includes('officedocument');
    if ((!isPdf && !isDoc) || file.isFolder) {
      continue;
    }

    const folderName = (file.folderPath || '').toLowerCase();
    const fileName = file.name.toLowerCase();
    let is2025 = folderName.includes('2025') || fileName.includes('2025');
    let is2026 = folderName.includes('2026') || fileName.includes('2026');

    if (!is2025 && !is2026) {
      is2026 = true; // default to 2026
    }

    const numMatch =
      file.name.match(/(?:report|servizio|turno|verbale|n|num|n°|no)[._\s-]*(\d+)/i) ||
      file.name.match(/^(\d+)[._\s-]/) ||
      file.name.match(/[._\s-](\d+)(?:\.pdf|\.docx|\.doc|\.json|$)/i) ||
      file.name.match(/(\d+)/);
    let num = numMatch ? parseInt(numMatch[1], 10) : (is2025 ? 1 : 36);

    // Limite storico 2025: il ciclo 2025 si è chiuso con il report 27 (18 Dicembre 2025).
    if (is2025 && num > 27) continue;

    let extractedPdfData: any = null;
    if (isPdf && token) {
      try {
        const dlUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          file.id
        )}?alt=media&supportsAllDrives=true`;
        const res = await fetch(dlUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const arrBuf = await res.arrayBuffer();
          extractedPdfData = extractReportDataFromPdfBytes(new Uint8Array(arrBuf), file.name);
          if (extractedPdfData.numeroReport > 0) {
            num = extractedPdfData.numeroReport;
          }
        }
      } catch (pdfErr) {
        console.warn(`Avviso lettura stream PDF Drive (${file.name}):`, pdfErr);
      }
    }

    const targetKey = `${is2025 ? '2025' : '2026'}-${num}`;
    const existingIndex = historicalReports.findIndex((r) => getReportNormalizedKey(r) === targetKey);

    // Se il file PDF contiene dati reali estratti (inclusi presenze totali certificate per report 38, 39 e successivi):
    // il documento caricato successivamente dall'utente SOVRASCRIVE e CERTIFICA il numero di presenze corretto!
    if (extractedPdfData && extractedPdfData.totalePresenze > 0) {
      const generatedRep = buildServiceReportFromExtractedPdf(extractedPdfData, file.name);
      if (existingIndex >= 0) {
        const existingItem = historicalReports[existingIndex];
        historicalReports[existingIndex] = {
          ...existingItem,
          id: existingItem.id?.startsWith('drive-') ? existingItem.id : `drive-${file.id}`,
          fileName: `${file.folderPath ? `[${file.folderPath}] ` : ''}${file.name}`,
          driveFileId: file.id,
          driveWebViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
          driveWebContentLink: file.webContentLink,
          report: {
            ...existingItem.report,
            ...generatedRep,
            rilevazioni: generatedRep.rilevazioni,
          },
        };
        continue;
      } else {
        historicalReports.push({
          id: `drive-doc-${file.id}`,
          savedAt: file.modifiedTime || new Date().toISOString(),
          fileName: `${file.folderPath ? `[${file.folderPath}] ` : ''}${file.name}`,
          driveFileId: file.id,
          driveWebViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
          driveWebContentLink: file.webContentLink,
          report: generatedRep,
        });
        continue;
      }
    }

    if (existingIndex === -1) {
      // Look up corresponding seed report to use its real data and date
      const matchingSeed = INITIAL_HISTORICAL_REPORTS.find((r) => {
        const rIs2025 = (r.report.data || '').startsWith('2025') || (r.fileName || '').includes('2025');
        return r.report.numeroReport === num && rIs2025 === is2025;
      });

      // Parse any real date from filename as override
      let fileDate = '';
      const isoMatch = file.name.match(/(\d{4})[.-](\d{2})[.-](\d{2})/);
      if (isoMatch) {
        fileDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      } else {
        const itMatch = file.name.match(/(\d{1,2})[.-](\d{1,2})[.-](\d{2,4})/);
        if (itMatch) {
          const d = itMatch[1].padStart(2, '0');
          const m = itMatch[2].padStart(2, '0');
          let y = itMatch[3];
          if (y.length === 2) y = '20' + y;
          fileDate = `${y}-${m}-${d}`;
        }
      }

      if (!is2025 && num === 36) {
        historicalReports.push({
          id: `drive-doc-${file.id}`,
          savedAt: file.modifiedTime || '2026-10-08T22:30:00.000Z',
          fileName: `${file.folderPath ? `[${file.folderPath}] ` : ''}${file.name}`,
          driveFileId: file.id,
          driveWebViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
          driveWebContentLink: file.webContentLink,
          report: getCanonicalReport36(),
        });
        continue;
      }

      const baseReport = matchingSeed ? JSON.parse(JSON.stringify(matchingSeed.report)) : null;
      const targetPresenze = is2025
        ? (OFFICIAL_PRESENZE_2025[num] ?? 42)
        : (OFFICIAL_PRESENZE_2026[num] ?? (num === 36 ? 48 : 45));
      const saracinoAff = is2025
        ? (OFFICIAL_SARACINO_AFFIANCAMENTI_2025[num] ? 'Ispettore Christian Saracino' : 'Nessuno //')
        : (OFFICIAL_SARACINO_AFFIANCAMENTI_2026[num] ? 'Ispettore Christian Saracino' : 'Nessuno //');

      historicalReports.push({
        id: `drive-doc-${file.id}`,
        savedAt: file.modifiedTime || new Date().toISOString(),
        fileName: `${file.folderPath ? `[${file.folderPath}] ` : ''}${file.name}`,
        driveFileId: file.id,
        driveWebViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        driveWebContentLink: file.webContentLink,
        report: baseReport ? {
          ...baseReport,
          data: (!is2025 && num === 36) ? '2026-10-08' : (fileDate || baseReport.data),
          personaleEsternoAffiancamento: saracinoAff !== 'Nessuno //' ? saracinoAff : baseReport.personaleEsternoAffiancamento,
        } : {
          numeroReport: num,
          luogo: 'Aeroporto internazionale MXP, T1',
          riferimentiCO: TESTO_FISSO_RIFERIMENTI_EMERGENZE,
          data: fileDate || getReportCorrectDate(num, is2025),
          oraInizio: '20:30',
          oraFine: '01:30',
          orarioTestoLibero: 'turno serale/notturno',
          apertureSbarraInizio: [
            { ora: '20:35', targa: 'GA 123 CA' },
            { ora: '01:25', targa: 'GA 456 CA' },
          ],
          luogoTermineFisso: TESTO_FISSO_LUOGO_TERMINE,
          comunicazioneInizioCO: '20:30',
          comunicazioneFineCO: '01:30',
          caposervizio: 'Andrea Menegotto',
          compilatore: num >= 35 ? 'Chiara Menegotto' : 'Andrea Menegotto',
          personaleEsternoAffiancamento: saracinoAff,
          squadra: [
            { id: 'm1', nomeCognome: 'Andrea Menegotto', nickname: 'Tiger', qualifica: 'Caposervizio', orarioServizio: '20:30 - 01:30', isCaposervizio: true, isCompilatore: num < 35 },
            { id: 'm2', nomeCognome: 'Chiara Menegotto', nickname: 'Mene', qualifica: 'Compilatore', orarioServizio: '20:30 - 01:30', isCompilatore: num >= 35 },
          ],
          rilevazioni: [
            {
              id: `ril-drive-${file.id}`,
              luogoIndividuazione: 'Porta 1 e Varchi Aeroportuali T1',
              numeroUtenti: targetPresenze,
              aggancioEffettuato: true,
              descrizione: `Documento archiviato su Google Drive (${file.name}). Censimento utenza (${targetPresenze} presenze) e presidio territorio.`,
              foto: [],
            },
          ],
          richiesteEmergenza: 'Nessuna //',
          richiesteEmergenzaCOPS: 'Nessuna //',
          richiesteEmergenzaCOSEA: 'Nessuna //',
          richiesteEmergenzaProntoSoccorsoMXP: 'Nessuna //',
          richiesteNonUrgenti: 'Nessuna //',
          note: 'Documento archiviato sincronizzato da Google Drive.',
          osservazioni: saracinoAff !== 'Nessuno //' ? 'Attività svolta con affiancamento Isp. Saracino.' : 'Attività svolta regolarmente.',
        },
      });
    }
  }

  return {
    rootFolder: rootInfo,
    subfolders: subfoldersInfo,
    target2026FolderId,
    allFiles,
    historicalReports: mergeReportEntries([], historicalReports),
  };
}

/**
 * Compatibility wrapper
 */
export async function listFilesInSharedDriveFolder(
  folderId: string
): Promise<DriveFileMetadata[]> {
  const hierarchy = await scanDriveHierarchyRecursively(folderId);
  return hierarchy.allFiles;
}

/**
 * Downloads and parses JSON report files stored across the shared Drive folder and subfolders
 */
export async function loadHistoricalReportsFromDriveFolder(
  folderId: string
): Promise<{
  files: DriveFileMetadata[];
  reports: HistoricalReportEntry[];
  hierarchy?: DriveFolderHierarchyResult;
}> {
  const hierarchy = await scanDriveHierarchyRecursively(folderId);
  return {
    files: hierarchy.allFiles,
    reports: hierarchy.historicalReports,
    hierarchy,
  };
}

/**
 * Uploads a single file (Blob) directly into the specified shared Google Drive folder/subfolder
 */
async function uploadBlobToDriveFolder(
  folderId: string,
  fileName: string,
  mimeType: string,
  blob: Blob,
  description: string
): Promise<DriveFileMetadata> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Autenticazione Google richiesta.');
  }

  const boundary = 'CA_DRIVE_BOUNDARY_' + Date.now();
  const metadata = {
    name: fileName,
    mimeType,
    parents: [folderId],
    description,
  };

  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const closePart = `\r\n--${boundary}--`;

  const multipartBlob = new Blob([metadataPart, blob, closePart], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,modifiedTime,webViewLink,size,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBlob,
    }
  );

  if (!res.ok) {
    if (res.status === 401) {
      clearAccessToken();
      throw new Error(
        'Sessione Google scaduta (401). Tocca "Sign in with Google" per riautenticarti prima di archiviare.'
      );
    }
    if (res.status === 403) {
      throw new Error(
        'Permesso di scrittura negato da Google Drive (403): questo account Google non ha il ruolo "Editor" per salvare file nella cartella condivisa. Su Google Drive (drive.google.com), il proprietario della cartella (am@andreamenegotto.it) deve impostare il permesso di questo account su "Editor" (non "Visualizzatore").'
      );
    }
    if (res.status === 404) {
      throw new Error(
        'Cartella di salvataggio non trovata o non accessibile (404): assicurati che la cartella sia stata condivisa su Google Drive con questo account con ruolo "Editor".'
      );
    }
    const errText = await res.text();
    throw new Error(`Errore caricamento su Google Drive (${res.status}): ${errText}`);
  }

  return await res.json();
}

/**
 * Archives both the A4 PDF report and the structured JSON report directly into the '2026' subfolder
 * of the shared Google Drive folder (ensuring continuity for Report 36 and onward).
 */
export async function archiveReportToSharedDriveFolder(
  rootFolderId: string,
  reportEntry: HistoricalReportEntry,
  pdfBlob: Blob,
  pdfFileName: string,
  subfolderName = '2026'
): Promise<{
  pdfFile: DriveFileMetadata;
  jsonFile: DriveFileMetadata;
  targetFolderId: string;
  targetFolderName: string;
}> {
  // Find or create the 2026 subfolder inside the root shared Drive folder
  let destinationFolderId = rootFolderId;
  let destinationFolderName = 'Cartella Principale';

  if (subfolderName) {
    try {
      const subInfo = await ensureSubfolderInDrive(rootFolderId, subfolderName);
      destinationFolderId = subInfo.id;
      destinationFolderName = subInfo.name || subfolderName;
    } catch (err) {
      console.warn(`Impossibile creare/trovare la sottocartella "${subfolderName}", salvataggio nella cartella radice:`, err);
    }
  }

  const dateStr = reportEntry.report.data || 'servizio';
  const reportNum = reportEntry.report.numeroReport ?? 36;
  const jsonFileName = `Report_Servizio_N${reportNum}_CityAngels_${dateStr}.json`;
  const jsonBlob = new Blob([JSON.stringify(reportEntry, null, 2)], {
    type: 'application/json',
  });

  const pdfFile = await uploadBlobToDriveFolder(
    destinationFolderId,
    pdfFileName,
    'application/pdf',
    pdfBlob,
    `Report di Servizio Aeroportuale City Angels MXP N. ${reportNum} del ${dateStr} (PDF A4) - Sottocartella ${destinationFolderName}`
  );

  const jsonFile = await uploadBlobToDriveFolder(
    destinationFolderId,
    jsonFileName,
    'application/json',
    jsonBlob,
    `Dati strutturati Report di Servizio City Angels N. ${reportNum} del ${dateStr} - Sottocartella ${destinationFolderName}`
  );

  return {
    pdfFile: { ...pdfFile, folderPath: destinationFolderName },
    jsonFile: { ...jsonFile, folderPath: destinationFolderName },
    targetFolderId: destinationFolderId,
    targetFolderName: destinationFolderName,
  };
}

/**
 * Deletes a file directly from Google Drive using Drive v3 API
 */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Accesso a Google Drive non attivo. Effettua prima il login con Google per eliminare file da Drive.');
  }

  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    if (res.status === 403) {
      throw new Error(
        'Permesso negato da Google Drive (403): il tuo account Google non ha i permessi di eliminazione per questo file.'
      );
    }
    throw new Error(`Errore durante l'eliminazione da Google Drive (stato ${res.status}).`);
  }

  // Remove from cache
  fileContentCache.delete(fileId);
  return true;
}

/**
 * Searches and deletes all files belonging to a specific report (PDF, JSON) from the shared Google Drive folder hierarchy
 */
export async function deleteReportFilesFromDrive(
  folderId: string,
  reportNum: number,
  reportDate?: string,
  knownDriveId?: string
): Promise<{ deletedNames: string[] }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Accesso a Google Drive non attivo. Effettua prima il login con Google per eliminare file da Drive.');
  }

  const deletedNames: string[] = [];

  // 1. If an explicit drive file ID is known (e.g. drive-12345 or drive-doc-12345)
  if (knownDriveId) {
    const cleanId = knownDriveId.replace(/^drive-(?:doc-)?/, '');
    if (cleanId && !cleanId.startsWith('rep-') && !cleanId.startsWith('init-')) {
      try {
        await deleteDriveFile(cleanId);
        deletedNames.push(`File ID: ${cleanId}`);
      } catch (err: any) {
        console.warn(`Impossibile eliminare file Drive con ID ${cleanId}:`, err);
      }
    }
  }

  // 2. Scan drive folder to find any other files associated with this report number and date
  if (folderId) {
    try {
      const { allFiles } = await scanDriveHierarchyRecursively(folderId);
      const targetFiles = allFiles.filter((f) => {
        const lowerName = f.name.toLowerCase();
        // Check if report number matches
        const numMatch = lowerName.match(/(?:report|n|num|n°)[._\s-]*(\d+)/i) || lowerName.match(/^(\d+)[._\s-]/);
        const fileReportNum = numMatch ? parseInt(numMatch[1], 10) : null;
        
        const matchesNum = fileReportNum === reportNum;
        const matchesDate = reportDate ? (
          lowerName.includes(reportDate) || 
          lowerName.includes(reportDate.split('-').reverse().join('-')) ||
          lowerName.includes(reportDate.replace(/-/g, ''))
        ) : false;

        return matchesNum || matchesDate;
      });

      for (const f of targetFiles) {
        try {
          await deleteDriveFile(f.id);
          if (!deletedNames.includes(f.name)) {
            deletedNames.push(f.name);
          }
        } catch (e) {
          console.warn(`Errore eliminazione file ${f.name} da Drive:`, e);
        }
      }
    } catch (err) {
      console.warn('Errore scansione gerarchia Drive per eliminazione report:', err);
    }
  }

  return { deletedNames };
}

/**
 * Safely converts a Blob to base64 string using the native browser FileReader
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = (reader.result as string) || '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Extracts readable words and structured text from PDF/raw text buffers for AI context
 */
function extractReadableTextFromBuffer(buffer: ArrayBuffer, maxLength = 60000): string {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const fullText = decoder.decode(buffer);

    // Look for text fragments inside PDF literal string parentheses (text) Tj / TJ
    const pdfTextMatches = fullText.match(/\(([^()]{2,120})\)\s*(?:Tj|'|")/g);
    if (pdfTextMatches && pdfTextMatches.length > 10) {
      const extractedWords = pdfTextMatches
        .map((m) => {
          const match = m.match(/\(([^()]+)\)/);
          return match ? match[1] : '';
        })
        .filter((w) => w.length > 1 && !/^[\x00-\x1F]+$/.test(w))
        .join(' ');

      if (extractedWords.length > 50) {
        return extractedWords.slice(0, maxLength);
      }
    }

    // General text cleaning
    const cleaned = fullText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ').replace(/\s+/g, ' ');
    if (cleaned.length > maxLength) {
      return cleaned.slice(0, maxLength) + '\n... [testo estratto troncato per limiti di lunghezza]';
    }
    return cleaned;
  } catch {
    return '';
  }
}

/**
 * Cache for file contents during session to prevent redundant re-fetching
 */
const fileContentCache = new Map<string, {
  id: string;
  name: string;
  mimeType: string;
  folderPath?: string;
  textContent?: string;
  base64Data?: string;
}>();

/**
 * Fetches content of a file from Google Drive for AI analysis.
 * - For Google Docs: exports as text/plain.
 * - For Google Sheets: exports as text/csv.
 * - For JSON, TXT, HTML: returns text.
 * - For PDF: safely returns base64 string (if <= 4MB) and extracted text strings.
 */
export async function fetchDriveFileContentForAnalysis(
  fileId: string,
  mimeType: string,
  fileName: string,
  folderPath = ''
): Promise<{
  id: string;
  name: string;
  mimeType: string;
  folderPath?: string;
  textContent?: string;
  base64Data?: string;
}> {
  if (fileContentCache.has(fileId)) {
    return fileContentCache.get(fileId)!;
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error('Autenticazione Google richiesta.');
  }

  // Handle Google Docs
  if (mimeType === 'application/vnd.google-apps.document') {
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}/export?mimeType=text/plain&supportsAllDrives=true`;
    const res = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const textContent = await res.text();
      const result = { id: fileId, name: fileName, mimeType, folderPath, textContent };
      fileContentCache.set(fileId, result);
      return result;
    }
  }

  // Handle Google Sheets
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}/export?mimeType=text/csv&supportsAllDrives=true`;
    const res = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const textContent = await res.text();
      const result = { id: fileId, name: fileName, mimeType, folderPath, textContent };
      fileContentCache.set(fileId, result);
      return result;
    }
  }

  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    fileId
  )}?alt=media&supportsAllDrives=true`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Impossibile scaricare il file "${fileName}" (${res.status})`);
  }

  if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
    const blob = await res.blob();
    // Only send base64 if PDF is under 4MB to prevent hitting Gemini inline limits
    let base64Data: string | undefined;
    if (blob.size <= 4 * 1024 * 1024) {
      base64Data = await blobToBase64(blob);
    }

    // Also extract text from buffer
    const arrayBuffer = await blob.arrayBuffer();
    const extractedText = extractReadableTextFromBuffer(arrayBuffer);

    const result = {
      id: fileId,
      name: fileName,
      mimeType: 'application/pdf',
      folderPath,
      base64Data,
      textContent: extractedText || undefined,
    };
    fileContentCache.set(fileId, result);
    return result;
  }

  const textContent = await res.text();
  const result = { id: fileId, name: fileName, mimeType, folderPath, textContent };
  fileContentCache.set(fileId, result);
  return result;
}
