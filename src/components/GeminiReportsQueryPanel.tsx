import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudUpload,
  Copy,
  Download,
  ExternalLink,
  FileQuestion,
  FileText,
  FolderOpen,
  FolderSync,
  Link2,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Upload,
  User,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { HistoricalReportEntry } from '../utils/reportHistoryMemory';
import { isRealEmergencyRequest } from '../types/report';
import { USER_REGISTRY, RegisteredUser } from '../utils/userRegistryData';
import {
  DriveFileMetadata,
  DriveFolderMetadata,
  extractDriveFolderId,
  fetchDriveFileContentForAnalysis,
  getAccessToken,
  getSharedDriveFolderInfo,
  getStoredDriveFolderUrl,
  loadHistoricalReportsFromDriveFolder,
  setStoredDriveFolderUrl,
} from '../utils/googleDriveService';

interface GeminiReportsQueryPanelProps {
  historyReports: HistoricalReportEntry[];
  currentReport?: any;
  driveFiles?: DriveFileMetadata[];
  isDriveConnected?: boolean;
  onAddSubjectToDirectory?: (subjectName: string) => void;
  onNotice?: (msg: string) => void;
  onDriveFilesUpdated?: (files: DriveFileMetadata[]) => void;
}

interface AnalyzedLocalFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  textContent?: string;
  base64Data?: string;
}

export const GeminiReportsQueryPanel: React.FC<GeminiReportsQueryPanelProps> = ({
  historyReports,
  currentReport,
  driveFiles = [],
  isDriveConnected = false,
  onAddSubjectToDirectory,
  onNotice,
  onDriveFilesUpdated,
}) => {
  const [userQuery, setUserQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [copiedAnswer, setCopiedAnswer] = useState<boolean>(false);

  // Gestione Ambito Cartella Drive (Radice + Sottocartelle 2025, 2026, MXP)
  const [folderUrlInput, setFolderUrlInput] = useState<string>(() => getStoredDriveFolderUrl());
  const [activeDriveFiles, setActiveDriveFiles] = useState<DriveFileMetadata[]>(driveFiles);
  const [activeSubfolders, setActiveSubfolders] = useState<{ id: string; name: string; fileCount: number }[]>([]);
  const [activeFolderInfo, setActiveFolderInfo] = useState<DriveFolderMetadata | null>(null);
  const [isScanningDrive, setIsScanningDrive] = useState<boolean>(false);
  const [showDriveFilesList, setShowDriveFilesList] = useState<boolean>(false);

  // Considera ESCLUSIVAMENTE file in formato PDF definitivi, escludendo categoricamente file DOC e DOCX
  const pdfDriveFiles = React.useMemo(() => {
    return activeDriveFiles.filter((f) => {
      if (f.isFolder) return false;
      const nameLower = (f.name || '').toLowerCase();
      const isWord =
        nameLower.endsWith('.doc') ||
        nameLower.endsWith('.docx') ||
        f.mimeType === 'application/msword' ||
        f.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (isWord) return false;
      return nameLower.endsWith('.pdf') || f.mimeType === 'application/pdf';
    });
  }, [activeDriveFiles]);

  const pdfSubfolders = React.useMemo(() => {
    return activeSubfolders.map((sf) => {
      const count = pdfDriveFiles.filter(
        (f) => f.folderId === sf.id || (f.folderPath && f.folderPath.includes(sf.name))
      ).length;
      return {
        ...sf,
        fileCount: count > 0 ? count : sf.fileCount,
      };
    });
  }, [activeSubfolders, pdfDriveFiles]);

  // Riconoscimento vocale & Registrazione Audio Multimodale
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [micPermissionDenied, setMicPermissionDenied] = useState<boolean>(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleInterrupt = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    if (onNotice) onNotice('Analisi e ricerca interrotta dall\'utente.');
  };

  // Lettura vocale (Text-To-Speech)
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // File addizionali caricati a mano dall'utente (PDF vecchi, file di testo, ecc.)
  const [manualFiles, setManualFiles] = useState<AnalyzedLocalFile[]>([]);
  const [isReadingFiles, setIsReadingFiles] = useState<boolean>(false);

  // Metriche
  const [metaInfo, setMetaInfo] = useState<{
    reportsCount: number;
    filesCount: number;
  } | null>(null);

  // Auto-scan Drive folder on mount if stored URL or token is present
  useEffect(() => {
    const savedUrl = getStoredDriveFolderUrl();
    const folderId = extractDriveFolderId(savedUrl);
    if (folderId && activeDriveFiles.length === 0) {
      handleScanDriveFolder(folderId);
    }
  }, []);

  useEffect(() => {
    if (driveFiles.length > 0 && activeDriveFiles.length === 0) {
      setActiveDriveFiles(driveFiles);
    }
  }, [driveFiles]);

  const handleScanDriveFolder = async (targetFolderId?: string) => {
    const rawUrl = targetFolderId || folderUrlInput || getStoredDriveFolderUrl();
    const folderId = extractDriveFolderId(rawUrl);
    if (!folderId) {
      if (onNotice) onNotice('Inserisci prima il link o ID della cartella Google Drive.');
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      if (onNotice) onNotice('Effettua l\'accesso con Google nella scheda Google Drive per autorizzare la lettura delle cartelle.');
      return;
    }

    setIsScanningDrive(true);
    setErrorMsg('');
    try {
      setStoredDriveFolderUrl(rawUrl);
      const info = await getSharedDriveFolderInfo(folderId);
      setActiveFolderInfo(info);

      const { files, reports, hierarchy } = await loadHistoricalReportsFromDriveFolder(folderId);
      setActiveDriveFiles(files);
      if (hierarchy?.subfolders) {
        setActiveSubfolders(hierarchy.subfolders);
      }
      if (onDriveFilesUpdated) {
        onDriveFilesUpdated(files);
      }
      if (onNotice) {
        onNotice(
          `Cartella "${info.name}" e sottocartelle scansionate (${files.length} file trovati per l'analisi Gemini).`
        );
      }
    } catch (err: any) {
      console.warn('Errore scansione cartella Drive per Gemini:', err);
      setErrorMsg(
        `Impossibile leggere la cartella Drive (${err?.message || 'Verifica permessi o link'}). Puoi comunque caricare i PDF a mano con il pulsante "Aggiungi File".`
      );
    } finally {
      setIsScanningDrive(false);
    }
  };

  const cleanupAudio = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    setIsListening(false);
    setAudioVolume(0);
    setRecordingSeconds(0);
  };

  useEffect(() => {
    const hasSpeech =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
    setSpeechSupported(!!hasSpeech);

    return () => {
      cleanupAudio();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startVoiceRecording = async () => {
    cleanupAudio();
    setMicPermissionDenied(false);
    setErrorMsg('');
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Questo browser o ambiente non supporta l\'acquisizione del microfono.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      setIsListening(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      // Web Audio Real-Time Volume Analyser
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioVolume(Math.min(100, Math.round((avg / 128) * 100)));
            animationFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (audioErr) {
        console.warn('Volume meter non disponibile:', audioErr);
      }

      // MediaRecorder for raw audio capture
      try {
        let mimeType = 'audio/webm;codecs=opus';
        if (typeof MediaRecorder !== 'undefined') {
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
            else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
            else if (MediaRecorder.isTypeSupported('audio/aac')) mimeType = 'audio/aac';
            else mimeType = '';
          }
          const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (evt) => {
            if (evt.data && evt.data.size > 0) {
              audioChunksRef.current.push(evt.data);
            }
          };

          recorder.start(250);
        }
      } catch (recErr) {
        console.warn('MediaRecorder non supportato:', recErr);
      }

      // Browser Speech-To-Text in parallel
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        try {
          const rec = new SpeechRecognitionClass();
          rec.lang = 'it-IT';
          rec.continuous = true;
          rec.interimResults = true;
          rec.maxAlternatives = 1;

          rec.onresult = (evt: any) => {
            let transcript = '';
            for (let i = 0; i < evt.results.length; i++) {
              transcript += evt.results[i][0].transcript;
            }
            if (transcript.trim()) {
              setUserQuery(transcript);
            }
          };

          rec.onerror = (evt: any) => {
            console.warn('SpeechRecognition warning:', evt?.error);
          };

          recognitionRef.current = rec;
          rec.start();
        } catch (speechErr) {
          console.warn('Impossibile avviare SpeechRecognition:', speechErr);
        }
      }

      if (onNotice) onNotice('Microfono attivo: parla pure, stiamo ascoltando...');
    } catch (err: any) {
      console.error('Errore microfono:', err);
      cleanupAudio();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicPermissionDenied(true);
        setErrorMsg('Accesso al microfono non consentito. Verifica i permessi nelle impostazioni del browser (o icona del lucchetto) e consenti l\'accesso al microfono.');
      } else {
        setErrorMsg(`Impossibile avviare il microfono: ${err.message || 'Dispositivo audio non disponibile'}.`);
      }
    }
  };

  const stopVoiceRecordingAndSubmit = async () => {
    const currentChunks = [...audioChunksRef.current];
    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
    const currentText = userQuery.trim();

    cleanupAudio();

    let audioBlob: Blob | null = null;
    if (currentChunks.length > 0) {
      audioBlob = new Blob(currentChunks, { type: mimeType });
    }

    if (currentText || audioBlob) {
      await executeGeminiQuery(currentText, audioBlob);
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      cleanupAudio();
    } else {
      startVoiceRecording();
    }
  };

  const toggleSpeechSynthesis = (textToRead: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onNotice) onNotice('Sintesi vocale non supportata da questo browser.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = textToRead.replace(/[#*•_`~[\]()]/g, ' ');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'it-IT';
    utterance.rate = 1.05;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const presetQueries = [
    {
      title: 'Modello Statistico Presenze',
      icon: Sparkles,
      query:
        'Sviluppa un modello statistico approfondito ed esaustivo delle presenze censite secondo i dati dell\'archivio (2025 e 2026). Includi: 1) Tabella e cifre chiave (totale presenze, media per turno, picchi); 2) Confronto temporale 2025 vs 2026; 3) Mappatura varchi e zone a maggior concentrazione (Porte 1/2, vano CISL, food court); 4) Indice di aggancio/colloqui e criticità emergenziali CO PS / CO SEA; 5) Raccomandazioni operative.',
    },
    {
      title: 'Storico 2025 e 2026 (Tutte le Cartelle)',
      icon: Clock,
      query:
        'Effettua una ricerca approfondita in tutte le cartelle e sottocartelle di Drive (inclusi i file 2025, 2026 e tutti i report di servizio fino al 36 e successivi). Elenca i soggetti censiti, le criticità ricorrenti e le differenze principali tra gli anni.',
    },
    {
      title: 'Nominativi & Alias',
      icon: Users,
      query:
        'Elenca tutti i nominativi, soggetti, soprannomi e alias censiti nei report (storico 2025, 2026 e attuale), specificando quante volte compaiono, dove sono stati individuati (es. varchi, porte, food court) e gli interventi effettuati.',
    },
    {
      title: 'Interventi CO PS & CO SEA (Solo Emergenze)',
      icon: ShieldAlert,
      query:
        'Riassumi tutte le richieste di intervento in emergenza o urgenza REALI effettuate a CO PS e CO SEA (escludendo categoricamente le chiamate ordinarie o normali per l\'inizio e il termine del servizio), con relative date, luoghi e motivazioni.',
    },
    {
      title: 'Zone e Varchi Critici (Porta 1, 2, CISL)',
      icon: MapPin,
      query:
        'Quali sono i luoghi e i varchi aeroportuali (es. Porte 1 e 2, vano CISL, food court, caroselli riconsegna bagagli) in cui si concentrano maggiormente le presenze e le criticità?',
    },
    {
      title: 'Accessi Mezzi e Targhe P1',
      icon: Sparkles,
      query:
        'Quali sono le targhe dei mezzi e gli orari di apertura sbarra registrati per l\'accesso al Parcheggio P1 nei vari turni di servizio?',
    },
  ];

  // Calcolo dati statistici per il cruscotto presenze censite (stessa base esatta dello storico locale di 62 report)
  const allReportsForStats = React.useMemo(() => {
    return historyReports;
  }, [historyReports]);

  const statsModel = React.useMemo(() => {
    let totalPresenze = 0;
    let totalAgganci = 0;
    let maxSingleShift = 0;
    let emergencyCOPSCount = 0;
    let emergencyCOSEACount = 0;

    allReportsForStats.forEach((entry) => {
      const r = entry.report || entry;
      let shiftPresenze = 0;

      (r.rilevazioni || []).forEach((ril: any) => {
        const u = parseInt(ril.numeroUtenti, 10) || 0;
        shiftPresenze += u;
        if (ril.aggancioEffettuato) totalAgganci++;
      });

      totalPresenze += shiftPresenze;
      if (shiftPresenze > maxSingleShift) maxSingleShift = shiftPresenze;

      if (isRealEmergencyRequest(r.richiesteEmergenzaCOPS || r.richiesteEmergenza)) emergencyCOPSCount++;
      if (isRealEmergencyRequest(r.richiesteEmergenzaCOSEA)) emergencyCOSEACount++;
    });

    const totalTurni = allReportsForStats.length || 1;
    const avgPresenzePerTurno = (totalPresenze / totalTurni).toFixed(1);

    return {
      totalTurni,
      totalPresenze,
      avgPresenzePerTurno,
      maxSingleShift,
      totalAgganci,
      emergencyCOPSCount,
      emergencyCOSEACount,
    };
  }, [allReportsForStats]);

  const handleManualFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsReadingFiles(true);
    const added: AnalyzedLocalFile[] = [];

    for (const f of files) {
      try {
        if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
          const arrayBuf = await f.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Data = btoa(binary);
          added.push({
            id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: f.name,
            mimeType: 'application/pdf',
            size: f.size,
            base64Data,
          });
        } else {
          const text = await f.text();
          added.push({
            id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: f.name,
            mimeType: f.type || 'text/plain',
            size: f.size,
            textContent: text,
          });
        }
      } catch (err) {
        console.error('Errore lettura file locale:', err);
      }
    }

    setManualFiles((prev) => [...prev, ...added]);
    setIsReadingFiles(false);
    if (onNotice) {
      onNotice(`Aggiunti ${added.length} file locali pronti per l'analisi con Gemini.`);
    }
    e.target.value = '';
  };

  const removeManualFile = (id: string) => {
    setManualFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const executeGeminiQuery = async (queryText?: string, audioBlob?: Blob | null) => {
    const q = (queryText !== undefined ? queryText : userQuery).trim();
    if (!q && !audioBlob) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setErrorMsg('');
    setLastQuery(q || 'Domanda vocale registrata');

    try {
      // 1. Prepare structured reports context
      const reportsList = [...historyReports];
      if (currentReport && currentReport.data && currentReport.numeroReport) {
        const isAlreadyInHistory = historyReports.some(
          (h) =>
            (h.report?.numeroReport === currentReport.numeroReport &&
              h.report?.data === currentReport.data) ||
            h.id === currentReport.id
        );
        if (!isAlreadyInHistory) {
          reportsList.unshift({
            id: 'current-service-draft',
            savedAt: new Date().toISOString(),
            fileName: `Report_Servizio_Bozza_N${currentReport.numeroReport}`,
            report: currentReport,
          });
        }
      }

      // 2. Fetch Drive files content across all subfolders (2025, 2026, etc.)
      const driveFilesPayload: any[] = [];
      const allAvailableDriveFiles =
        pdfDriveFiles.length > 0
          ? pdfDriveFiles
          : (activeDriveFiles.length > 0 ? activeDriveFiles : driveFiles).filter((f) => {
              const nameLower = (f.name || '').toLowerCase();
              return (
                !f.isFolder &&
                (nameLower.endsWith('.pdf') || f.mimeType === 'application/pdf') &&
                !nameLower.endsWith('.doc') &&
                !nameLower.endsWith('.docx')
              );
            });
      
      // Filtriamo per considerare ESCLUSIVAMENTE file in formato PDF definitivi,
      // escludendo categoricamente i file in DOC/DOCX e i file già inclusi nei dati strutturati dei report.
      const driveFilesToFetch = allAvailableDriveFiles
        .filter((f) => {
          if (f.isFolder) return false;
          const nameLower = f.name.toLowerCase();
          if (nameLower.endsWith('.doc') || nameLower.endsWith('.docx') || f.mimeType?.includes('word')) {
            return false;
          }
          const isPdf = nameLower.endsWith('.pdf') || f.mimeType === 'application/pdf';
          if (!isPdf) return false;

          const isReport = nameLower.includes('report') || nameLower.includes('servizio') || nameLower.includes('mxp') || /^\d+/.test(f.name);
          // Escludiamo i report duplicati in PDF: le informazioni strutturate complete sono già inviate in reportsData!
          if (isReport) return false;

          return true;
        })
        .slice(0, 8); // Limitiamo a massimo 8 file esterni PDF per massima reattività

      if (driveFilesToFetch.length > 0) {
        // Recuperiamo il contenuto dei file esterni in parallelo (molto veloce!)
        const fetchPromises = driveFilesToFetch.map(async (df) => {
          try {
            if (controller.signal.aborted) {
              throw new DOMException('Aborted', 'AbortError');
            }
            const fetched = await fetchDriveFileContentForAnalysis(
              df.id,
              df.mimeType,
              df.name,
              df.folderPath
            );
            return {
              id: fetched.id,
              name: fetched.name,
              mimeType: fetched.mimeType,
              folderPath: fetched.folderPath || df.folderPath,
              textContent: fetched.textContent,
              // Omettiamo base64Data per evitare payload JSON giganteschi che causano timeout o errori di rete
            };
          } catch (fetchErr) {
            console.warn(`Impossibile prelevare file Drive ${df.name}:`, fetchErr);
            return null;
          }
        });

        const fetchedFiles = await Promise.all(fetchPromises);
        fetchedFiles.forEach((f) => {
          if (f) driveFilesPayload.push(f);
        });
      }

      if (controller.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      // 3. Audio conversion to base64 if audioBlob is present
      let audioData: string | undefined;
      let audioMimeType: string | undefined;
      if (audioBlob) {
        audioMimeType = audioBlob.type || 'audio/webm';
        const arrayBuf = await audioBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        audioData = btoa(binary);
      }

      if (controller.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      // 4. Call server endpoint /api/gemini/query-reports
      const response = await fetch('/api/gemini/query-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          query: q || 'Richiesta vocale formulata a voce',
          audioData,
          audioMimeType,
          reportsData: reportsList,
          driveFiles: driveFilesPayload,
          uploadedFiles: manualFiles,
          userRegistry: USER_REGISTRY,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(
          errJson?.error ||
            `Errore durante la richiesta a Gemini (Status: ${response.status})`
        );
      }

      const data = await response.json();
      setLastAnswer(data.answer);
      setMetaInfo({
        reportsCount: data.analyzedReportsCount || reportsList.length,
        filesCount:
          data.analyzedFilesCount ||
          driveFilesPayload.length + manualFiles.length,
      });

      if (onNotice) {
        onNotice('Risposta generata con successo da Gemini.');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Interrogazione Gemini interrotta con AbortController.');
        return; // Don't show scary error message
      }
      console.error(err);
      setErrorMsg(
        err.message ||
          'Si è verificato un errore durante l’interrogazione con Gemini.'
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const handleCopyAnswer = async () => {
    if (!lastAnswer) return;
    try {
      await navigator.clipboard.writeText(lastAnswer);
      setCopiedAnswer(true);
      setTimeout(() => setCopiedAnswer(false), 2500);
      if (onNotice) onNotice('Risposta di Gemini copiata negli appunti!');
    } catch {
      // ignore
    }
  };

  const handleDownloadAnalysis = () => {
    if (!lastAnswer) return;
    const content = `ANALISI OPERATIVA REPORT CITY ANGELS VARESE - GEMINI AI\nData interrogazione: ${new Date().toLocaleString()}\nDomanda: ${lastQuery}\n\n${lastAnswer}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Analisi_Gemini_Report_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white border border-slate-700 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Integrazione Ufficiale Gemini AI (gemini-3.8-flash)</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-400" />
              <span>Interrogazione & Ricerca Operativa Report con Gemini</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Interroga in linguaggio naturale sia i report strutturati attuali sia i documenti e file precedenti archiviati nella cartella condivisa Google Drive (anche report pregressi in PDF o formato libero) per estrarre nominativi, luoghi, emergenze e dinamiche.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600/80 border border-blue-500 rounded-md hover:bg-blue-600 transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>+ Aggiungi File PDF</span>
              <input
                type="file"
                multiple
                accept=".pdf"
                onChange={handleManualFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Fonti collegate */}
        <div className="mt-5 pt-4 border-t border-slate-700/80 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>
              Report nello Storico Locale: <strong>{historyReports.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                isDriveConnected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            ></span>
            <span>
              Cartella Google Drive:{' '}
              <strong>
                {isDriveConnected
                  ? `Collegata (${pdfDriveFiles.length} file PDF definitivi in tutte le sottocartelle 2025/2026)`
                  : 'Non collegata (collegala nella scheda Google Drive)'}
              </strong>
            </span>
          </div>

          {manualFiles.length > 0 && (
            <div className="flex items-center gap-1.5 text-blue-300">
              <FileText className="w-3.5 h-3.5" />
              <span>
                Documenti locali aggiunti: <strong>{manualFiles.length} file</strong>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Banner Pulsante Altamente Visibile con Pulsante Interrompi Analisi */}
      {isLoading && (
        <div className="p-4 bg-blue-50 border-2 border-blue-200 text-blue-950 text-xs md:text-sm rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-pulse">
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600 shrink-0" />
            <div>
              <span className="font-bold">Analisi e ricerca in corso con Gemini AI...</span>
              <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                Stiamo leggendo e analizzando l&apos;intero archivio (storico 2025, 2026 e i file PDF di Google Drive). Questa operazione complessa richiede circa 10-30 secondi per via dell&apos;elevata precisione dei risultati.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInterrupt}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-md shadow-xs shrink-0 cursor-pointer transition-colors shrink-0"
          >
            <span>Interrompi Analisi</span>
          </button>
        </div>
      )}

      {/* 1. SEZIONE AMBITO DI RICERCA: GOOGLE DRIVE & SOTTOCARTELLE (2025, 2026, MXP) */}
      <section className="bg-white border border-slate-300 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <FolderSync className="w-5 h-5 text-[#1e3a8a]" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Ambito di Ricerca: Cartella Google Drive & Sottocartelle (2025–2026)
              </h3>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Gemini interroga l&apos;intero archivio: i report MXP correnti, i dati compilati e <strong>tutti i PDF e documenti storici salvati nelle cartelle 2025 e 2026</strong> (anche non generati dall&apos;app).
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleScanDriveFolder()}
            disabled={isScanningDrive}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-700 ${isScanningDrive ? 'animate-spin' : ''}`} />
            <span>{isScanningDrive ? 'Scansione in corso...' : 'Sincronizza / Scansiona Cartelle'}</span>
          </button>
        </div>

        {/* Info Cartella e Sottocartelle Rilevate */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-7 space-y-2">
            <label htmlFor="gemini-drive-url-input" className="block text-xs font-semibold text-slate-700">
              Link Cartella Condivisa Google Drive
            </label>
            <div className="relative flex items-center">
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                id="gemini-drive-url-input"
                type="text"
                value={folderUrlInput}
                onChange={(e) => {
                  setFolderUrlInput(e.target.value);
                  setStoredDriveFolderUrl(e.target.value);
                }}
                onBlur={() => {
                  if (folderUrlInput.trim()) {
                    handleScanDriveFolder(folderUrlInput);
                  }
                }}
                placeholder="Incolla link: https://drive.google.com/drive/folders/..."
                className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono-tabular"
              />
            </div>
            {activeFolderInfo ? (
              <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                <span>Cartella attiva: <strong>{activeFolderInfo.name}</strong></span>
                {activeFolderInfo.webViewLink && (
                  <a
                    href={activeFolderInfo.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#1e3a8a] underline font-semibold ml-1"
                  >
                    <span>Apri su Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">
                La cartella viene sincronizzata automaticamente con tutte le sottocartelle 2025 e 2026.
              </div>
            )}
          </div>

          <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-md p-3 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1">
                Documenti PDF Indicizzati per l&apos;Analisi ({pdfDriveFiles.length})
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {pdfSubfolders.length > 0 ? (
                  pdfSubfolders.map((sf) => (
                    <span
                      key={sf.id}
                      className="px-2 py-0.5 bg-white border border-slate-300 text-slate-800 font-bold text-[11px] rounded shadow-2xs"
                    >
                      📁 {sf.name} ({sf.fileCount})
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-500 italic">
                    {pdfDriveFiles.length > 0
                      ? `${pdfDriveFiles.length} file PDF rilevati nella cartella`
                      : 'Nessuna sottocartella rilevata al momento'}
                  </span>
                )}
              </div>
            </div>

            {pdfDriveFiles.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDriveFilesList((prev) => !prev)}
                className="mt-2 text-[11px] font-semibold text-blue-800 hover:text-blue-950 inline-flex items-center gap-1 cursor-pointer self-start"
              >
                <span>{showDriveFilesList ? 'Nascondi elenco file' : 'Mostra tutti i file PDF scansionati'}</span>
                {showDriveFilesList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Visualizzatore dettagliato dei file Drive scansionati */}
        {showDriveFilesList && pdfDriveFiles.length > 0 && (
          <div className="pt-3 border-t border-slate-200">
            <div className="text-xs font-bold text-slate-800 mb-2">
              File PDF definitivi inclusi nella memoria documentale di Gemini ({pdfDriveFiles.length} file PDF):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {pdfDriveFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-2 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <div className="truncate">
                      <span className="text-[10px] font-bold text-slate-500 mr-1">
                        [{file.folderPath || 'Radice'}]
                      </span>
                      <span className="font-medium text-slate-900">{file.name}</span>
                    </div>
                  </div>
                  {file.webViewLink && (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-400 hover:text-blue-700 shrink-0"
                      title="Apri file su Drive"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Lista file aggiunti a mano per l'analisi */}
      {manualFiles.length > 0 && (
        <section className="bg-white border border-slate-300 rounded-lg p-4">
          <div className="text-xs font-bold text-slate-900 mb-2 flex items-center justify-between">
            <span>File e PDF pregressi aggiunti per l&apos;interrogazione:</span>
            <span className="text-[11px] text-slate-500 font-normal">
              Verranno inviati a Gemini per l&apos;analisi
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {manualFiles.map((f) => (
              <div
                key={f.id}
                className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-100 border border-slate-300 rounded text-xs text-slate-800"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-medium max-w-[200px] truncate">{f.name}</span>
                <span className="text-[10px] text-slate-500">
                  ({Math.round(f.size / 1024)} KB)
                </span>
                <button
                  type="button"
                  onClick={() => removeManualFile(f.id)}
                  className="text-slate-400 hover:text-red-700 ml-1 cursor-pointer"
                  title="Rimuovi file"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cruscotto Modello Statistico Presenze Censite */}
      <section className="bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-white border-2 border-amber-300 rounded-lg p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-700" />
            <h3 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
              Modello Statistico Presenze Censite (Storico 2025–2026)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              const q = 'Sviluppa un modello statistico approfondito ed esaustivo delle presenze censite secondo i dati dell\'archivio (2025 e 2026). Includi: 1) Tabella e cifre chiave (totale presenze, media per turno, picchi); 2) Confronto temporale 2025 vs 2026; 3) Mappatura varchi e zone a maggior concentrazione (Porte 1/2, vano CISL, food court); 4) Indice di aggancio/colloqui e criticità emergenziali CO PS / CO SEA; 5) Raccomandazioni operative.';
              setUserQuery(q);
              executeGeminiQuery(q);
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-amber-950 bg-amber-200 hover:bg-amber-300 border border-amber-400 rounded-md transition-colors cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-800" />
            <span>Genera Modello Statistico Avanzato AI</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-white border border-amber-200 rounded-md shadow-2xs">
            <div className="text-[10.5px] font-bold text-slate-500 uppercase">
              Presenze Censite Totali
            </div>
            <div className="text-2xl font-black font-mono text-amber-950 mt-1 flex items-baseline gap-1">
              <span>{statsModel.totalPresenze}</span>
              <span className="text-[10px] font-bold text-amber-800">persone</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              su {statsModel.totalTurni} report caricati
            </div>
          </div>

          <div className="p-3 bg-white border border-amber-200 rounded-md shadow-2xs">
            <div className="text-[10.5px] font-bold text-slate-500 uppercase">
              Media Presenze / Turno
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1 flex items-baseline gap-1">
              <span>{statsModel.avgPresenzePerTurno}</span>
              <span className="text-[10px] font-bold text-slate-600">media</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              picco max: {statsModel.maxSingleShift} in 1 turno
            </div>
          </div>

          <div className="p-3 bg-white border border-amber-200 rounded-md shadow-2xs">
            <div className="text-[10.5px] font-bold text-slate-500 uppercase">
              Totale Colloqui / Agganci
            </div>
            <div className="text-2xl font-black font-mono text-emerald-800 mt-1 flex items-baseline gap-1">
              <span>{statsModel.totalAgganci}</span>
              <span className="text-[10px] font-bold text-emerald-700">interventi</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              contatti diretti avvenuti
            </div>
          </div>

          <div className="p-3 bg-white border border-amber-200 rounded-md shadow-2xs">
            <div className="text-[10.5px] font-bold text-slate-500 uppercase">
              Chiamate Emergenza CO
            </div>
            <div className="text-2xl font-black font-mono text-red-700 mt-1 flex items-baseline gap-1">
              <span>{statsModel.emergencyCOPSCount + statsModel.emergencyCOSEACount}</span>
              <span className="text-[10px] font-bold text-red-600">eventi</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              CO PS: {statsModel.emergencyCOPSCount} | CO SEA: {statsModel.emergencyCOSEACount}
            </div>
          </div>
        </div>
      </section>

      {/* Domande rapide preimpostate */}
      <section className="bg-white border border-slate-300 rounded-lg p-5 shadow-xs space-y-3">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Ricerche Rapide con 1 Clic</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {presetQueries.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setUserQuery(item.query);
                  executeGeminiQuery(item.query);
                }}
                disabled={isLoading}
                className="text-left p-3.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-blue-50/60 hover:border-blue-300 transition-colors flex flex-col justify-between cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-white border border-slate-200 rounded group-hover:border-blue-300 text-slate-700 group-hover:text-blue-700">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 group-hover:text-blue-900">
                    {item.title}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug">
                  {item.query}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Barra di ricerca e richiesta libera */}
      <section className="bg-white border border-slate-300 rounded-lg p-5 shadow-xs space-y-4">
        <label
          htmlFor="gemini-query-input"
          className="block text-xs font-bold text-slate-900"
        >
          Cosa vuoi sapere o cercare nei report (anche storici e su Drive)?
        </label>

        {/* Avviso Permesso Microfono Bloccato con Istruzioni Chiare */}
        {micPermissionDenied && (
          <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-lg text-xs text-amber-950 flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-900 flex items-center gap-2">
                <span>Microfono non accessibile dal browser</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Per abilitare la dettatura vocale: clicca sull&apos;icona del <strong>lucchetto 🔒</strong> o delle <strong>impostazioni sito</strong> a sinistra dell&apos;indirizzo web nella barra del browser, imposta <strong>Microfono</strong> su <strong>Consenti</strong> e ricarica la pagina.
              </p>
            </div>
          </div>
        )}

        {/* Indicatore vocale attivo con volume meter e controlli immediati */}
        {isListening && (
          <div className="p-3.5 bg-gradient-to-r from-red-50 to-rose-100 border-2 border-red-300 text-red-950 text-xs rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-red-600 text-white shrink-0 shadow-sm">
                <span className="absolute w-full h-full rounded-full bg-red-400 animate-ping opacity-75"></span>
                <Mic className="w-4.5 h-4.5 relative z-10" />
              </div>
              <div>
                <div className="font-bold flex items-center gap-2">
                  <span>Microfono in Ascolto Attivo</span>
                  <span className="px-2 py-0.5 bg-red-200 text-red-900 font-mono text-[10px] font-bold rounded">
                    0:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}
                  </span>
                  {/* Equalizzatore dinamico sensibile alla voce */}
                  <div className="flex items-end gap-0.5 h-4 ml-1">
                    {[0.3, 0.7, 1.0, 0.6, 0.4].map((multiplier, i) => {
                      const h = Math.max(3, Math.min(16, (audioVolume * multiplier) / 4));
                      return (
                        <span
                          key={i}
                          style={{ height: `${h}px` }}
                          className="w-1 bg-red-600 rounded-full transition-all duration-75"
                        ></span>
                      );
                    })}
                  </div>
                </div>
                <div className="text-[11px] text-red-800 mt-0.5 font-medium">
                  {userQuery.trim() ? (
                    <span>Trascritto: &ldquo;{userQuery}&rdquo;</span>
                  ) : (
                    <span>Parla liberamente in italiano: stiamo registrando la tua voce...</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={cleanupAudio}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={stopVoiceRecordingAndSubmit}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md cursor-pointer shadow-xs transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>Invia a Gemini</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              id="gemini-query-input"
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  executeGeminiQuery(userQuery);
                }
              }}
              placeholder="Es. 'Chi è la persona con la valigia rossa?', 'Quali soggetti sono stati visti più volte?', 'Interventi CO PS al piano partenze'..."
              className="w-full h-11 pl-9 pr-3 text-xs md:text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Pulsante Richiesta a Voce (Microfono) */}
          <button
            type="button"
            onClick={toggleVoiceInput}
            disabled={isLoading}
            title={
              isListening
                ? 'Clicca per fermare la registrazione vocale'
                : 'Fai una richiesta a voce a Gemini con il microfono'
            }
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-md border text-xs font-semibold cursor-pointer transition-all shrink-0 ${
              isListening
                ? 'bg-red-600 hover:bg-red-700 text-white border-red-700 animate-pulse shadow-md ring-2 ring-red-400'
                : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4 text-white" />
                <span>Ascolto...</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-[#df0a14]" />
                <span className="hidden sm:inline">Richiesta a Voce</span>
              </>
            )}
          </button>

          {isLoading ? (
            <button
              type="button"
              onClick={handleInterrupt}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors whitespace-nowrap cursor-pointer shadow-xs animate-pulse"
              title="Clicca per interrompere immediatamente l'analisi e la ricerca di Gemini"
            >
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Interrompi Analisi</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!userQuery.trim()}
              onClick={() => executeGeminiQuery(userQuery)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap cursor-pointer shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>Chiedi a Gemini</span>
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </section>

      {/* Box Risultato Analisi - Sempre visibile come quadro di risposta fisso */}
      <section className="bg-white border-2 border-slate-300 rounded-lg p-6 shadow-md space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
          <span>Quadro di Risposta - Elucubrazione Gemini AI</span>
        </h3>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-xs font-bold text-slate-700 animate-pulse">
              Gemini sta leggendo i report ed elaborando l&apos;analisi dettagliata...
            </span>
          </div>
        ) : lastAnswer ? (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Risposta all&apos;interrogazione:
                </div>
                <div className="text-xs font-bold text-slate-900 italic mt-0.5">
                  &ldquo;{lastQuery}&rdquo;
                </div>
                {metaInfo && (
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    Analizzati {metaInfo.reportsCount} report strutturati e {metaInfo.filesCount} documenti/file
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleSpeechSynthesis(lastAnswer)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border transition-colors cursor-pointer ${
                    isSpeaking
                      ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                      : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  }`}
                  title="Ascolta la risposta letta ad alta voce"
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                      <span>Ferma Voce</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ascolta Risposta</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCopyAnswer}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  {copiedAnswer ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Copiato!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copia</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadAnalysis}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Salva</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-md font-sans text-xs md:text-sm text-slate-950 whitespace-pre-wrap leading-relaxed shadow-3xs">
              {lastAnswer}
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-slate-400 italic text-xs leading-relaxed max-w-md mx-auto space-y-2">
            <div>Nessuna interrogazione attiva al momento.</div>
            <p className="text-[11px] text-slate-500 not-italic font-normal">
              Digita una domanda nella barra di ricerca sopra, clicca su uno dei pulsanti delle <strong>Ricerche Rapide con 1 Clic</strong>, o richiedi la generazione del <strong>Modello Statistico Avanzato</strong> per vedere l&apos;elaborato qui.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
