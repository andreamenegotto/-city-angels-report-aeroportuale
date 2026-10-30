import React, { useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  Check,
  CloudUpload,
  ExternalLink,
  FolderSync,
  Link2,
  LogOut,
  RefreshCw,
  Users,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  CorporateHeaderConfig,
  ServiceReportData,
  formatDateIT,
} from '../types/report';
import { HistoricalReportEntry } from '../utils/reportHistoryMemory';
import { generateReportPdfBlob } from '../utils/pdfGenerator';
import {
  DEFAULT_SHARED_DRIVE_FOLDER_ID,
  DEFAULT_SHARED_DRIVE_FOLDER_URL,
  DriveFileMetadata,
  DriveFolderMetadata,
  archiveReportToSharedDriveFolder,
  extractDriveFolderId,
  getAccessToken,
  getSharedDriveFolderInfo,
  getStoredDriveFolderUrl,
  googleSignIn,
  initAuth,
  loadHistoricalReportsFromDriveFolder,
  logoutGoogle,
  setStoredDriveFolderUrl,
  subscribeToDriveFolderUrl,
} from '../utils/googleDriveService';

interface GoogleDriveArchivePanelProps {
  report: ServiceReportData;
  corporate: CorporateHeaderConfig;
  totalSubjects: number;
  totalEngagements: number;
  onReportsSyncedFromDrive: (entries: HistoricalReportEntry[]) => void;
  onLocalArchiveReport: () => HistoricalReportEntry;
  onNotice: (msg: string) => void;
  onDriveFilesUpdated?: (files: DriveFileMetadata[]) => void;
}

export const GoogleDriveArchivePanel: React.FC<GoogleDriveArchivePanelProps> = ({
  report,
  corporate,
  totalSubjects,
  totalEngagements,
  onReportsSyncedFromDrive,
  onLocalArchiveReport,
  onNotice,
  onDriveFilesUpdated,
}) => {
  const [driveUser, setDriveUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const [folderUrlInput, setFolderUrlInput] = useState<string>(() => {
    return getStoredDriveFolderUrl() || DEFAULT_SHARED_DRIVE_FOLDER_URL;
  });

  const [folderInfo, setFolderInfo] = useState<DriveFolderMetadata | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFileMetadata[]>([]);
  const [isLoadingFolder, setIsLoadingFolder] = useState<boolean>(false);
  const [isArchivingDrive, setIsArchivingDrive] = useState<boolean>(false);
  const [driveError, setDriveError] = useState<string>('');
  const [showConfirmUploadModal, setShowConfirmUploadModal] = useState<boolean>(false);

  const [subfoldersList, setSubfoldersList] = useState<{ id: string; name: string; fileCount: number }[]>([]);

  const folderId = extractDriveFolderId(folderUrlInput) || DEFAULT_SHARED_DRIVE_FOLDER_ID;

  // Sincronizza l'URL locale e Firestore solo se valido
  useEffect(() => {
    if (folderUrlInput && folderUrlInput.trim().length > 0) {
      setStoredDriveFolderUrl(folderUrlInput.trim());
    }
  }, [folderUrlInput]);

  // Ascolta aggiornamenti in tempo reale su Firestore: se l'amministratore imposta la cartella, tutti i collaboratori la ricevono
  useEffect(() => {
    const unsub = subscribeToDriveFolderUrl((remoteUrl) => {
      if (remoteUrl && remoteUrl.trim().length > 0 && remoteUrl !== folderUrlInput) {
        setFolderUrlInput(remoteUrl.trim());
      }
    });
    return () => unsub();
  }, [folderUrlInput]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (u, token) => {
        setDriveUser(u);
        setHasToken(true);
        if (folderId && token && !folderInfo) {
          handleSyncSharedFolder(folderId);
        }
      },
      () => {
        setDriveUser(null);
        setHasToken(false);
      }
    );
    return () => unsubscribe();
  }, [folderId]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setDriveError('');
    try {
      const res = await googleSignIn();
      if (res) {
        setDriveUser(res.user);
        setHasToken(true);
        onNotice(`Connesso a Google Drive come ${res.user.email || res.user.displayName}.`);
        if (folderId) {
          await handleSyncSharedFolder(folderId);
        }
      }
    } catch (err: any) {
      setDriveError(err?.message || 'Accesso a Google Drive annullato o non riuscito.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setDriveUser(null);
    setHasToken(false);
    setFolderInfo(null);
    setDriveFiles([]);
    setSubfoldersList([]);
    onNotice('Disconnesso da Google Drive.');
  };

  const handleSyncSharedFolder = async (overrideFolderId?: string) => {
    const targetId = overrideFolderId || folderId;
    if (!targetId) {
      setDriveError(
        'Incolla prima il link (o ID) della cartella condivisa di Google Drive.'
      );
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setHasToken(false);
      setDriveError('Effettua prima il login con Google per accedere alla cartella.');
      return;
    }

    setIsLoadingFolder(true);
    setDriveError('');
    try {
      const info = await getSharedDriveFolderInfo(targetId);
      setFolderInfo(info);
      const { files, reports, hierarchy } = await loadHistoricalReportsFromDriveFolder(targetId);
      setDriveFiles(files);
      if (hierarchy?.subfolders) {
        setSubfoldersList(hierarchy.subfolders);
      }
      if (onDriveFilesUpdated) {
        onDriveFilesUpdated(files);
      }
      if (reports.length > 0) {
        onReportsSyncedFromDrive(reports);
      }
      onNotice(
        `Cartella Google Drive "${info.name}" e sottocartelle sincronizzate (${files.length} file trovati in 2025/2026, ${reports.length} report strutturati caricati).`
      );
    } catch (err: any) {
      setDriveError(
        err?.message ||
          'Errore durante la connessione alla cartella condivisa su Google Drive.'
      );
    } finally {
      setIsLoadingFolder(false);
    }
  };

  const executeConfirmedDriveArchive = async () => {
    setShowConfirmUploadModal(false);
    if (!folderId) return;

    const token = await getAccessToken();
    if (!token) {
      setHasToken(false);
      setDriveError('Sessione Google scaduta. Clicca su "Sign in with Google".');
      return;
    }

    setIsArchivingDrive(true);
    setDriveError('');
    try {
      const localEntry = onLocalArchiveReport();
      const { blob, fileName } = await generateReportPdfBlob(
        report,
        corporate,
        totalSubjects,
        totalEngagements
      );

      const { pdfFile, jsonFile, targetFolderName } = await archiveReportToSharedDriveFolder(
        folderId,
        localEntry,
        blob,
        fileName,
        '2026'
      );

      setDriveFiles((prev) => [pdfFile, jsonFile, ...prev]);
      onNotice(
        `Report salvato con successo nella sottocartella "${targetFolderName}" di Google Drive: "${pdfFile.name}" e "${jsonFile.name}".`
      );
      try {
        await handleSyncSharedFolder(folderId);
      } catch {
        // ignore
      }
    } catch (err: any) {
      setDriveError(
        err?.message || 'Errore durante il salvataggio nella cartella Google Drive.'
      );
    } finally {
      setIsArchivingDrive(false);
    }
  };

  return (
    <div className="bg-white border border-slate-300 rounded-lg p-5 mb-6 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <CloudUpload className="w-5 h-5 text-[#1e3a8a]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Archiviazione in Cartella Condivisa Google Drive
            </h2>
            {hasToken && driveUser && (
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-900 rounded">
                Connesso: {driveUser.email || driveUser.displayName}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Incolla qui (ora o quando disponibile) il link della cartella condivisa su{' '}
            <strong>Google Drive</strong> per archiviare automaticamente ogni report (in formato{' '}
            <strong>PDF A4</strong> + <strong>JSON</strong>) e sincronizzare lo storico dei servizi.
          </p>
        </div>

        {/* Official Google Sign-In / Sign-Out Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {!hasToken ? (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="inline-flex items-center gap-2.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="w-4 h-4 block shrink-0"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
              <span>
                {isLoggingIn ? 'Connessione in corso...' : 'Sign in with Google'}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors cursor-pointer shadow-2xs"
                title="Consente di selezionare o cambiare account Google autorizzato"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                <span>{isLoggingIn ? 'Accesso in corso...' : 'Cambia account Google'}</span>
              </button>
              <button
                type="button"
                onClick={handleGoogleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnetti Google</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Box Collaboratori e Permessi Google Drive */}
      <div className="mt-3.5 p-3.5 bg-blue-50/80 border border-blue-200 rounded-md text-xs text-slate-700">
        <div className="flex items-start gap-2.5">
          <Users className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-blue-900">
              Accesso Multi-Utente e Permessi di Scrittura su Google Drive
            </div>
            <p className="leading-relaxed">
              Tutti i collaboratori autorizzati possono accedere all’app tramite il link pubblico condiviso e collegarsi con il proprio account Google personale.
              I collaboratori abilitati con ruolo <strong>Editor</strong> sulla cartella condivisa di Drive possono archiviare direttamente i report (PDF A4 e JSON) e sincronizzare in tempo reale lo storico dei servizi.
            </p>
            {hasToken && driveUser && (
              <div className="text-[11px] text-blue-900 font-semibold pt-0.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Account Google attivo: <strong>{driveUser.email || driveUser.displayName}</strong></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input Collegamento Cartella Condivisa + Azioni */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
        <div className="lg:col-span-7">
          <label
            htmlFor="drive-folder-link"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Collegamento (Link URL) o ID della Cartella Condivisa Google Drive
          </label>
          <div className="relative flex items-center">
            <Link2 className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              id="drive-folder-link"
              type="text"
              value={folderUrlInput}
              onChange={(e) => setFolderUrlInput(e.target.value)}
              placeholder="Incolla qui il link: https://drive.google.com/drive/folders/..."
              className="w-full h-10 pl-9 pr-3 text-xs sm:text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono-tabular"
            />
          </div>
          {folderId ? (
            <div className="text-[11px] text-emerald-800 font-mono-tabular mt-1 flex items-center gap-2">
              <span>✓ ID Cartella rilevato: {folderId}</span>
              {folderInfo && (
                <a
                  href={
                    folderInfo.webViewLink ||
                    `https://drive.google.com/drive/folders/${folderId}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#1e3a8a] underline font-sans font-semibold"
                >
                  <span>Apri &ldquo;{folderInfo.name}&rdquo; su Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 mt-1">
              Puoi inserire o aggiornare il link della cartella condivisa in qualsiasi momento.
            </div>
          )}
        </div>

        <div className="lg:col-span-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={!folderId || isLoadingFolder}
            onClick={() => handleSyncSharedFolder()}
            className="h-10 px-3.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-45 border border-slate-300 rounded-md inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingFolder ? 'animate-spin' : ''}`}
            />
            <span>
              {isLoadingFolder ? 'Lettura Cartella...' : 'Sincronizza da Cartella Drive'}
            </span>
          </button>

          <button
            type="button"
            disabled={!folderId || isArchivingDrive}
            onClick={() => {
              if (!hasToken) {
                setDriveError(
                  'Effettua prima l’accesso cliccando su "Sign in with Google".'
                );
                return;
              }
              setShowConfirmUploadModal(true);
            }}
            className="h-10 px-4 text-xs font-semibold text-white bg-[#1e3a8a] hover:bg-slate-900 disabled:opacity-45 rounded-md inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <FolderSync className="w-4 h-4" />
            <span>
              {isArchivingDrive
                ? 'Archiviazione su Drive...'
                : 'Archivia Report su Google Drive'}
            </span>
          </button>
        </div>
      </div>

      {/* Indicatore Destinazione Archiviazione 2026 e Sottocartelle Scansionate */}
      <div className="mt-3.5 p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-800">
          <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
            📁 Destinazione: Sottocartella &quot;2026&quot;
          </span>
          <span className="text-slate-600">
            I report successivi (dal N. 36 in avanti) vengono archiviati in continuità nella sottocartella <strong>2026</strong>.
          </span>
        </div>

        {subfoldersList.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 font-medium">Sottocartelle rilevate:</span>
            {subfoldersList.map((sf) => (
              <span
                key={sf.id}
                className="px-2 py-0.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded text-[11px]"
              >
                {sf.name} ({sf.fileCount} file)
              </span>
            ))}
          </div>
        )}
      </div>

      {driveError && (
        <div className="mt-3.5 p-3.5 bg-red-50 border border-red-300 text-red-900 text-xs rounded-md space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="font-bold flex items-center gap-1.5 text-red-950">
              <span>⚠️ Avviso sincronizzazione / salvataggio su Google Drive:</span>
            </div>
            <button
              type="button"
              onClick={() => setDriveError('')}
              className="text-red-700 hover:text-red-950 font-bold p-0.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
          <p className="leading-relaxed font-medium">{driveError}</p>
          {driveUser && (
            <div className="mt-2.5 p-2.5 bg-white/90 border border-red-200 rounded text-[11.5px] text-slate-800 space-y-1">
              <div>
                <strong>Account Google attualmente connesso:</strong>{' '}
                <span className="font-mono text-red-800 font-bold">{driveUser.email || driveUser.displayName}</span>
              </div>
              <div className="text-slate-600 leading-relaxed pt-0.5">
                💡 <strong>Come risolvere se l&apos;account è diverso dal proprietario:</strong> Apri Google Drive dal computer del proprietario (am@andreamenegotto.it), fai clic destro sulla cartella di servizio City Angels, clicca su <strong>Condividi</strong> e aggiungi <strong>{driveUser.email}</strong> assegnando il ruolo di <strong>Editor</strong> (necessario per salvare i nuovi report in formato PDF e JSON).
              </div>
            </div>
          )}
        </div>
      )}

      {driveFiles.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200">
          <div className="text-xs font-bold text-slate-800 mb-2">
            File presenti nella cartella e sottocartelle (2025, 2026) ({driveFiles.length}):
          </div>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
            {driveFiles.slice(0, 16).map((f) => (
              <a
                key={f.id}
                href={
                  f.webViewLink ||
                  `https://drive.google.com/file/d/${f.id}/view`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded text-slate-800 font-mono-tabular"
              >
                <Check className="w-3 h-3 text-emerald-700 shrink-0" />
                <span className="text-slate-500 font-sans text-[10px]">
                  {f.folderPath ? `[${f.folderPath}]` : ''}
                </span>
                <span className="truncate max-w-[200px]">{f.name}</span>
                <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Explicit Confirmation Modal before uploading/modifying files in the shared Google Drive folder */}
      {showConfirmUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-md w-full p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              Conferma Archiviazione nella Sottocartella &quot;2026&quot;
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Stai per caricare e archiviare nella <strong>sottocartella 2026</strong> della cartella di Google Drive (
              <code className="font-mono-tabular text-slate-900">
                {folderInfo?.name || folderId}
              </code>
              ) i seguenti file del servizio N. {report.numeroReport ?? 36} del{' '}
              <strong>{formatDateIT(report.data)}</strong>:
            </p>
            <ul className="mt-2.5 space-y-1 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded p-2.5 text-slate-800">
              <li>
                1. Report_Servizio_N{report.numeroReport ?? 36}_{report.data || 'Aeroporto'}.pdf (PDF A4)
              </li>
              <li>
                2. Report_Servizio_N{report.numeroReport ?? 36}_{report.data || 'Aeroporto'}.json (Dati strutturati)
              </li>
            </ul>
            <p className="text-[11px] text-emerald-800 font-medium mt-2 bg-emerald-50 p-2 rounded border border-emerald-200">
              ✓ Continuità storica garantita: i file verranno posizionati nella cartella <strong>2026</strong> insieme agli altri report dell&apos;anno.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmUploadModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={executeConfirmedDriveArchive}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#c8102e] hover:bg-[#a50d26] rounded-md cursor-pointer"
              >
                Conferma e Archivia in 2026
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
