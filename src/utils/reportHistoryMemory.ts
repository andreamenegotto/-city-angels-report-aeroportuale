import {
  LUOGHI_INDIVIDUAZIONE_PREDEFINITI,
  LUOGHI_PREDEFINITI,
  ServiceReportData,
} from '../types/report';

export interface HistoricalReportEntry {
  id: string;
  savedAt: string;
  fileName?: string;
  report: ServiceReportData;
  knownSubjectsTagged?: string[];
  driveFileId?: string;
  driveWebViewLink?: string;
  driveWebContentLink?: string;
}

export interface KnownVolunteer {
  nomeCognome: string;
  nickname: string;
  qualifica: string;
  note: string;
  presenzeCount: number;
  lastSeenDate: string;
}

export interface KnownSubjectRecord {
  nameOrAlias: string;
  usualArea: string;
  occurrences: number;
  lastSeenDate: string;
  lastSummary: string;
}

export interface MemoryIndex {
  volunteers: KnownVolunteer[];
  subjects: KnownSubjectRecord[];
  locations: string[];
  coReferences: string[];
  areas: string[];
  licensePlates: string[];
}

export const OFFICIAL_SARACINO_AFFIANCAMENTI_2026: Record<number, string> = {
  6: 'Ispettore Christian Saracino (Pratiche rimpatrio)',
  8: 'Ispettore Christian Saracino (Intervento 25/02)',
  16: 'Ispettore Christian Saracino (Intervento in loco)',
  25: 'Ispettore Christian Saracino',
  29: 'Ispettore Christian Saracino',
  36: 'Ispettore Christian Saracino',
};

export const OFFICIAL_SARACINO_AFFIANCAMENTI_2025: Record<number, string> = {
  25: 'Ispettore Christian Saracino (Identificazioni)',
};

export const OFFICIAL_PRESENZE_2025: Record<number, number> = {
  1: 34, 2: 36, 3: 38, 4: 40, 5: 42, 6: 39, 7: 41, 8: 37, 9: 35, 10: 23,
  11: 30, 12: 33, 13: 35, 14: 37, 15: 39, 16: 41, 17: 43, 18: 45, 19: 47,
  20: 50, 21: 54, 22: 58, 23: 35, 24: 20, 25: 35, 26: 0, 27: 41,
};

export const OFFICIAL_PRESENZE_2026: Record<number, number> = {
  1: 41, 2: 45, 3: 75, 4: 45, 5: 60, 6: 10, 7: 49, 8: 42, 9: 41, 10: 37,
  11: 44, 12: 59, 13: 55, 14: 41, 15: 43, 16: 36, 17: 43, 18: 47, 19: 45,
  20: 41, 21: 51, 22: 63, 23: 31, 24: 37, 25: 46, 26: 50, 27: 38, 28: 42,
  29: 36, 30: 55, 31: 46, 32: 53, 33: 61, 34: 60, 35: 76, 36: 48, 37: 78, 38: 19,
};

/**
 * Restituisce la dicitura esatta dell'affiancamento documentato per ciascun report.
 * Riconosce la presenza certificata dell'Ispettore Christian Saracino per il 2025 e 2026
 * (incluso il Report 36 dell'8 ottobre 2026) oppure il nominativo specifico di una persona esterna in affiancamento,
 * escludendo tassativamente qualsiasi dicitura generica "PolAria".
 */
export function getSaracinoAffiancamentoForReport(report: ServiceReportData): string {
  const num = report.numeroReport ?? 0;
  const is2025 = (report.data || '').startsWith('2025');
  const is2026 = (report.data || '').startsWith('2026') || !report.data;

  // 1. Allineamento rigoroso al Registro Ufficiale 2026
  if (is2026 && num in OFFICIAL_SARACINO_AFFIANCAMENTI_2026) {
    return OFFICIAL_SARACINO_AFFIANCAMENTI_2026[num];
  }

  // 2. Allineamento rigoroso al Registro Ufficiale 2025
  if (is2025 && num in OFFICIAL_SARACINO_AFFIANCAMENTI_2025) {
    return OFFICIAL_SARACINO_AFFIANCAMENTI_2025[num];
  }

  if (num === 36) {
    return 'Ispettore Christian Saracino';
  }

  // 3. Valutazione testo dinamico in personaleEsternoAffiancamento, note, osservazioni
  const affRaw = (report.personaleEsternoAffiancamento || '').trim();
  const affLower = affRaw.toLowerCase();
  const noteLower = (report.note || '').trim().toLowerCase();
  const obsLower = (report.osservazioni || '').trim().toLowerCase();
  const combinedText = `${affLower} ${noteLower} ${obsLower}`;

  if (combinedText.includes('saracino')) {
    if (combinedText.includes('rimpatrio')) return 'Ispettore Christian Saracino (Pratiche rimpatrio)';
    if (combinedText.includes('25/02')) return 'Ispettore Christian Saracino (Intervento 25/02)';
    if (combinedText.includes('in loco')) return 'Ispettore Christian Saracino (Intervento in loco)';
    if (combinedText.includes('identificazion')) return 'Ispettore Christian Saracino (Identificazioni)';
    return 'Ispettore Christian Saracino';
  }

  // 4. Se in futuro viene inserito un nominativo specifico (es. altro ispettore o agente in affiancamento)
  if (
    affRaw &&
    !affLower.includes('nessuno') &&
    affRaw !== '//' &&
    affLower !== 'polaria' &&
    affLower !== 'polizia di frontiera'
  ) {
    const cleanPerson = affRaw
      .replace(/\s*\(\s*polaria\s*\)/gi, '')
      .replace(/\s*\(\s*polizia di frontiera\s*\)/gi, '')
      .replace(/^polaria\s*[-–:/]?\s*/i, '')
      .replace(/^polizia di frontiera\s*[-–:/]?\s*/i, '')
      .trim();
    if (
      cleanPerson.length > 0 &&
      cleanPerson.toLowerCase() !== 'polaria' &&
      cleanPerson.toLowerCase() !== 'polizia di frontiera'
    ) {
      return cleanPerson;
    }
  }

  // Esclusione categorica di diciture generiche senza nominativo
  return '';
}

export function getReportCorrectDate(num: number, is2025: boolean): string {
  if (is2025) {
    const correctDates2025: Record<number, string> = {
      1: '2025-06-12', 2: '2025-06-19', 3: '2025-06-26', 4: '2025-07-03',
      5: '2025-07-10', 6: '2025-07-17', 7: '2025-07-24', 8: '2025-07-31',
      9: '2025-08-07', 10: '2025-08-28', 11: '2025-09-04', 12: '2025-09-11',
      13: '2025-09-18', 14: '2025-09-25', 15: '2025-10-02', 16: '2025-10-09',
      17: '2025-10-16', 18: '2025-10-23', 19: '2025-10-30', 20: '2025-11-06',
      21: '2025-11-13', 22: '2025-11-20', 23: '2025-11-27', 24: '2025-12-01',
      25: '2025-12-11', 26: '2025-12-12', 27: '2025-12-18'
    };
    return correctDates2025[num] || `2025-12-${String(Math.min(28, num % 28 || 15)).padStart(2, '0')}`;
  } else {
    const correctDates2026: Record<number, string> = {
      1: '2026-01-08', 2: '2026-01-15', 3: '2026-01-22', 4: '2026-01-29',
      5: '2026-02-05', 6: '2026-02-12', 7: '2026-02-19', 8: '2026-02-26',
      9: '2026-03-05', 10: '2026-03-12', 11: '2026-03-19', 12: '2026-03-26',
      13: '2026-04-02', 14: '2026-04-09', 15: '2026-04-16', 16: '2026-04-23',
      17: '2026-04-29', 18: '2026-05-07', 19: '2026-05-14', 20: '2026-05-21',
      21: '2026-05-27', 22: '2026-06-04', 23: '2026-06-11', 24: '2026-06-18',
      25: '2026-06-25', 26: '2026-07-02', 27: '2026-07-16', 28: '2026-07-23',
      29: '2026-07-30', 30: '2026-08-06', 31: '2026-09-03', 32: '2026-09-10',
      33: '2026-09-17', 34: '2026-09-24', 35: '2026-10-01', 36: '2026-10-08'
    };
    return correctDates2026[num] || `2026-10-${String(Math.min(28, num % 28 || 15)).padStart(2, '0')}`;
  }
}

export function getCanonicalReport36(): ServiceReportData {
  return {
    numeroReport: 36,
    luogo: 'Aeroporto internazionale MXP, T1',
    riferimentiCO: 'CO Security SEA: 02.74862999 | CO PS: 02.74867553 | Pronto Soccorso: 02.74864444',
    data: '2026-10-08',
    oraInizio: '20:30',
    oraFine: '01:30',
    orarioTestoLibero: 'turno serale/notturno',
    apertureSbarraInizio: [
      { ora: '20:35', targa: 'GA 123 CA' },
      { ora: '01:25', targa: 'GA 456 CA' },
    ],
    luogoTermineFisso: 'Parcheggio P1 (apertura sbarra tramite lettura targa mezzi)',
    comunicazioneInizioCO: '20:30',
    comunicazioneFineCO: '01:30',
    caposervizio: 'Andrea Menegotto',
    compilatore: 'Chiara Menegotto',
    personaleEsternoAffiancamento: 'Ispettore Christian Saracino',
    squadra: [
      { id: 'm1', nomeCognome: 'Andrea Menegotto', nickname: 'Tiger', qualifica: 'Caposervizio', orarioServizio: '20:30 - 01:30', isCaposervizio: true, isCompilatore: false },
      { id: 'm2', nomeCognome: 'Chiara Menegotto', nickname: 'Mene', qualifica: 'Compilatore', orarioServizio: '20:30 - 01:30', isCaposervizio: false, isCompilatore: true },
      { id: 'm3', nomeCognome: 'Ambra Mazzoni', nickname: 'Trilly', qualifica: "Operatrice d'Emergenza / Counsellor", orarioServizio: '20:30 - 01:30', isCompilatore: false },
      { id: 'm4', nomeCognome: 'Roberto S.', nickname: 'Roby', qualifica: 'Volontario Operativo OdV', orarioServizio: '20:30 - 01:30', isCompilatore: false },
    ],
    rilevazioni: [
      {
        id: 'ril-2026-36-1',
        luogoIndividuazione: 'Porta 1 e Porta 2 - Piano Arrivi T1',
        numeroUtenti: 31,
        aggancioEffettuato: true,
        descrizione: 'Presidio serale/notturno varchi T1 e censimento utenza stanziale (31 utenti censiti).',
        foto: [],
      },
      {
        id: 'ril-2026-36-2',
        luogoIndividuazione: 'Food Court e Vano CISL - Piano Partenze',
        numeroUtenti: 17,
        aggancioEffettuato: true,
        descrizione: 'Monitoraggio aree ristorazione e vano ascensori stanziali (17 utenti censiti).',
        foto: [],
      },
    ],
    richiesteEmergenza: 'Nessuna //',
    richiesteEmergenzaCOPS: 'Nessuna //',
    richiesteEmergenzaCOSEA: 'Nessuna //',
    richiesteEmergenzaProntoSoccorsoMXP: 'Nessuna //',
    richiesteNonUrgenti: 'Nessuna //',
    note: 'Servizio di pattugliamento n. 36 svolto regolarmente giovedì 8 ottobre 2026. Monitoraggio e censimento utenza stanziale (48 presenze rilevate), presidio varchi e cooperazione attiva con le forze dell\'ordine.',
    osservazioni: 'Presenza in affiancamento dell\'Ispettore Christian Saracino per le verifiche di sicurezza e censimento congiunto dell\'utenza stanziale.',
  };
}

export function generateHistoricalReportsSeed(): HistoricalReportEntry[] {
  const entries: HistoricalReportEntry[] = [];

  // --- 2025 REPORTS (Cartella Drive 2025: 27 report effettivi) ---
  const reports2025Data = [
    { num: 1, date: '2025-06-12', presenze: 34, colloqui: 3, desc: 'Avvio servizi regolari. Presidio e monitoraggio varchi T1.' },
    { num: 2, date: '2025-06-19', presenze: 36, colloqui: 4, desc: 'Pattugliamento Piano Arrivi. Assistenza a soggetti vulnerabili.' },
    { num: 3, date: '2025-06-26', presenze: 38, colloqui: 4, desc: 'Monitoraggio Food Court e vano CISL. Contatti con personale di scalo.' },
    { num: 4, date: '2025-07-03', presenze: 40, colloqui: 5, desc: 'Presidio serale. Verificata area caroselli bagagli.' },
    { num: 5, date: '2025-07-10', presenze: 42, colloqui: 6, desc: 'Controlli preventivi area esterna ed interna Terminal 1.' },
    { num: 6, date: '2025-07-17', presenze: 39, colloqui: 4, desc: 'Ispezione Spazio Calmo Porta 1 e Porta 2.' },
    { num: 7, date: '2025-07-24', presenze: 41, colloqui: 5, desc: 'Servizio diurno e serale coordinato. Monitoraggio varchi aeroportuali.' },
    { num: 8, date: '2025-07-31', presenze: 37, colloqui: 4, desc: 'Aumento passeggeri per festività. Presidio e supporto informativo.' },
    { num: 9, date: '2025-08-07', presenze: 35, colloqui: 3, desc: 'Pattugliamento e verifica sbarra sosta Parcheggio P1.' },
    { num: 10, date: '2025-08-28', presenze: 23, colloqui: 1, desc: 'Riduzione estiva presenze. Controllo area riconsegna bagagli.' },
    { num: 11, date: '2025-09-04', presenze: 30, colloqui: 3, desc: 'Clima mite. Spostamento parziale utenza stanziale verso aree esterne.' },
    { num: 12, date: '2025-09-11', presenze: 33, colloqui: 3, desc: 'Presidio serale-notturno. Supporto e somministrazione generi di prima necessità.' },
    { num: 13, date: '2025-09-18', presenze: 35, colloqui: 4, desc: 'Ininizio stagione autunnale. Monitoraggio condizionamento e varchi T1.' },
    { num: 14, date: '2025-09-25', presenze: 37, colloqui: 4, desc: 'Ondata di freddo iniziale. Distribuzione coperte e generi di conforto.' },
    { num: 15, date: '2025-10-02', presenze: 39, colloqui: 4, desc: 'Grande afflusso turistico. Presidio Piano Partenze e Arrivi.' },
    { num: 16, date: '2025-10-09', presenze: 41, colloqui: 5, desc: 'Monitoraggio stanziali e supporto PolAria.' },
    { num: 17, date: '2025-10-16', presenze: 43, colloqui: 5, desc: 'Controlli esodo autunnale. Ispezione aree sensibili del Terminal 1.' },
    { num: 18, date: '2025-10-23', presenze: 45, colloqui: 6, desc: 'Pattugliamento coordinato e censimento anagrafico periodico.' },
    { num: 19, date: '2025-10-30', presenze: 47, colloqui: 5, desc: 'Presidio serale-notturno T1. Monitoraggio varchi Porte 1 e 2. Individuati soggetti stanziali.' },
    { num: 20, date: '2025-11-06', presenze: 50, colloqui: 4, desc: 'Pattugliamento Piano Arrivi e Partenze T1. [Soggetto noto: Mario S.] presente in area caroselli.' },
    { num: 21, date: '2025-11-13', presenze: 54, colloqui: 4, desc: 'Controllo area Food Court e vano CISL. Assistenza e supporto informativo all\'utenza vulnerabile.' },
    { num: 22, date: '2025-11-20', presenze: 58, colloqui: 6, desc: 'Servizio diurno e serale. Valore massimo rilevato. Verificati accessi Parcheggio P1. Chiamata CO SEA per verifica varchi.' },
    { num: 23, date: '2025-11-27', presenze: 35, colloqui: 1, desc: 'Aumento afflusso utenza stanziale con primi freddi. Intervento congiunto PolAria per censimento.' },
    { num: 24, date: '2025-12-01', presenze: 20, colloqui: 0, desc: 'Servizio straordinario sotto ordinanza e coordinamento Questura (Valenza statistica NO).' },
    { num: 25, date: '2025-12-11', presenze: 35, colloqui: 1, desc: 'Monitoraggio invernale ad alta intensità. Coordinamento con Ispettore Saracino per identificazioni.' },
    { num: 26, date: '2025-12-12', presenze: 0, colloqui: 0, desc: 'Intervento urgente TSO. Johannes HUTANG "l\'olandese" accompagnato per cure mediche (Valenza statistica NO).' },
    { num: 27, date: '2025-12-18', presenze: 41, colloqui: 1, desc: 'Report di servizio del 18 Dicembre. [Soggetto noto: Francesco DENTALI, MIMMO] presenti presso Porta US2329. Presenza di Gianfranco DI DIO su letto gonfiabile.' },
  ];

  const validCompilers = ['Chiara Pozzi', 'Chiara Menegotto', 'Andrea Menegotto'];

  reports2025Data.forEach((item) => {
    const comp = validCompilers[item.num % validCompilers.length];
    const saracinoAffiancamentoText = OFFICIAL_SARACINO_AFFIANCAMENTI_2025[item.num];
    const u1 = Math.round(item.presenze * 0.6);
    const u2 = item.presenze - u1;
    entries.push({
      id: `seed-2025-${item.num}`,
      savedAt: `${item.date}T22:30:00.000Z`,
      fileName: `[Cartella 2025 Drive] Report_Servizio_MXP_${item.num}_2025.json`,
      report: {
        numeroReport: item.num,
        luogo: 'Aeroporto internazionale MXP, T1',
        riferimentiCO: 'CO Security SEA: 02.74862999 | CO PS: 02.74867553',
        data: item.date,
        oraInizio: '20:30',
        oraFine: '01:30',
        orarioTestoLibero: 'turno serale/notturno',
        apertureSbarraInizio: [
          { ora: '20:35', targa: 'GA 123 CA' },
          { ora: '01:25', targa: 'GA 456 CA' },
        ],
        luogoTermineFisso: 'Parcheggio P1 (apertura sbarra tramite lettura targa mezzi)',
        comunicazioneInizioCO: '20:30',
        comunicazioneFineCO: '01:30',
        caposervizio: 'Andrea Menegotto',
        compilatore: comp,
        personaleEsternoAffiancamento: saracinoAffiancamentoText || 'Nessuno //',
        squadra: [
          { id: 'm1', nomeCognome: 'Andrea Menegotto', nickname: 'Tiger', qualifica: 'Caposervizio', orarioServizio: '20:30 - 01:30', isCaposervizio: true, isCompilatore: comp === 'Andrea Menegotto' },
          { id: 'm2', nomeCognome: comp === 'Andrea Menegotto' ? 'Chiara Pozzi' : comp, nickname: comp.includes('Pozzi') ? 'Gabry' : comp.includes('Chiara Menegotto') ? 'Mene' : 'Tiger', qualifica: 'Compilatore', orarioServizio: '20:30 - 01:30', isCompilatore: comp !== 'Andrea Menegotto' },
          { id: 'm3', nomeCognome: 'Ambra Mazzoni', nickname: 'Trilly', qualifica: "Operatrice d'Emergenza", orarioServizio: '20:30 - 01:30', isCompilatore: false },
        ],
        rilevazioni: [
          {
            id: `ril-2025-${item.num}-1`,
            luogoIndividuazione: 'Porta 1 - Piano Arrivi',
            numeroUtenti: u1,
            aggancioEffettuato: true,
            descrizione: item.desc,
            foto: [],
          },
          {
            id: `ril-2025-${item.num}-2`,
            luogoIndividuazione: 'Porta 2 e Food Court',
            numeroUtenti: u2,
            aggancioEffettuato: item.colloqui > 5,
            descrizione: 'Pattugliamento e monitoraggio continuativo dell\'area aeroportuale.',
            foto: [],
          },
        ],
        richiesteEmergenza: 'Nessuna //',
        richiesteEmergenzaCOPS: 'Nessuna //',
        richiesteEmergenzaCOSEA: 'Nessuna //',
        richiesteEmergenzaProntoSoccorsoMXP: 'Nessuna //',
        richiesteNonUrgenti: 'Nessuna //',
        note: 'Servizio svolto regolarmente.',
        osservazioni: 'Sintonia operativa con le forze dell\'ordine di scalo.',
      },
    });
  });

  // --- 2026 REPORTS 1 TO 35 ---
  const reports2026Config = [
    { num: 1, date: '2026-01-08', presenze: 41, colloqui: 0, desc: 'Primo report solare 2026. Presidio varchi e censimento iniziale utenza stanziale.' },
    { num: 2, date: '2026-01-15', presenze: 45, colloqui: 0, desc: 'Monitoraggio stanziali presso Porta 1 e Porta 2. [Soggetto noto: Marco S.] individuato.' },
    { num: 3, date: '2026-01-22', presenze: 75, colloqui: 2, desc: 'PICCO MASSIMO RILEVATO INVERNO. Aumento presenze per freddo intenso. Attuati molteplici colloqui e supporto.' },
    { num: 4, date: '2026-01-29', presenze: 45, colloqui: 3, desc: 'Controlli e censimento esteso T1. Cooperazione con personale SEA Security.' },
    { num: 5, date: '2026-02-05', presenze: 60, colloqui: 4, desc: 'Presidio serale. Verificati varchi d\'accesso e Spazio Calmo 1 e 2.' },
    { num: 6, date: '2026-02-12', presenze: 10, colloqui: 1, desc: 'TURNO SPECIALE LIMITATO T2 (10 presenze). Bassa affluenza sul Terminal 2 per pratiche di rimpatrio assistito con Ispettore Saracino.' },
    { num: 7, date: '2026-02-19', presenze: 49, colloqui: 1, desc: 'Controllo area Arrivi e Partenze T1. [Soggetto noto: Giuseppe N.] presente al vano CISL.' },
    { num: 8, date: '2026-02-26', presenze: 42, colloqui: 0, desc: 'Attività ordinaria di prevenzione e supporto. Coordinamento operativo con PolAria (intervento 25/02). Registrati accessi sbarra Parcheggio P1.' },
    { num: 9, date: '2026-03-05', presenze: 41, colloqui: 0, desc: 'Aumento contatti presso Food Court. Verificata presenza soggetti con bagagli stanziali.' },
    { num: 10, date: '2026-03-12', presenze: 37, colloqui: 1, desc: 'Monitoraggio continuativo. Segnalazione non urgente alla CO PS per rilievo bagaglio cruento.' },
    { num: 11, date: '2026-03-19', presenze: 44, colloqui: 3, desc: 'Pattugliamento e assistenza sanitaria di base. Supporto ad un viaggiatore disorientato.' },
    { num: 12, date: '2026-03-26', presenze: 59, colloqui: 2, desc: 'Ispezione Spazio Calmo 3 e 4. Situazione sotto controllo in tutta l\'aerostazione.' },
    { num: 13, date: '2026-04-02', presenze: 55, colloqui: 2, desc: 'Incremento viaggiatori e passeggeri in transito pasquale. Presidio Porta 1 e Porta 2.' },
    { num: 14, date: '2026-04-09', presenze: 41, colloqui: 1, desc: 'Pattugliamento serale ordinario presso varchi e piano arrivi T1.' },
    { num: 15, date: '2026-04-16', presenze: 43, colloqui: 3, desc: 'Presidio serale, identificazione soggetti e verifiche anagrafiche ordinarie.' },
    { num: 16, date: '2026-04-23', presenze: 36, colloqui: 3, desc: 'Uscita congiunta con PolAria e Ispettore Saracino (intervento in loco). Notificati 2 provvedimenti di allontanamento DASPO.' },
    { num: 17, date: '2026-04-29', presenze: 43, colloqui: 4, desc: 'Monitoraggio ponte del 1° Maggio. Flusso costante di utenza stanziale.' },
    { num: 18, date: '2026-05-07', presenze: 47, colloqui: 2, desc: 'Controllo caroselli riconsegna bagagli e varchi di uscita.' },
    { num: 19, date: '2026-05-14', presenze: 45, colloqui: 1, desc: 'Assistenza e distribuzione generi di prima necessità. [Soggetto noto: Roberto K.] censito.' },
    { num: 20, date: '2026-05-21', presenze: 41, colloqui: 0, desc: 'Verifiche periodiche sbarra P1 e targa mezzo operativo GA 123 CA.' },
    { num: 21, date: '2026-05-27', presenze: 51, colloqui: 2, desc: 'Rilevate nuove presenze stanziali in vista della stagione estiva.' },
    { num: 22, date: '2026-06-04', presenze: 63, colloqui: 3, desc: 'Pattugliamento diurno/serale. Clima mite con spostamento verso aree esterne.' },
    { num: 23, date: '2026-06-11', presenze: 31, colloqui: 5, desc: 'PICCO MINIMO ORDINARIO. Minima presenza stanziale registrata nei varchi interni T1.' },
    { num: 24, date: '2026-06-18', presenze: 37, colloqui: 4, desc: 'Primi caldi estivi. L\'aerostazione climatizzata richiama soggetti dall\'esterno.' },
    { num: 25, date: '2026-06-25', presenze: 46, colloqui: 1, desc: 'Monitoraggio climatizzato T1 con affiancamento operativo Ispettore Saracino (PolAria). Rilevati soggetti vulnerabili presso Food Court.' },
    { num: 26, date: '2026-07-02', presenze: 50, colloqui: 1, desc: 'Ondata di calore estivo. L\'aerostazione si conferma polo attrattivo.' },
    { num: 27, date: '2026-07-16', presenze: 38, colloqui: 3, desc: 'Ininizio picco estivo presenze. Supporto e somministrazione acqua all\'utenza.' },
    { num: 28, date: '2026-07-23', presenze: 42, colloqui: 3, desc: 'Servizio diurno e serale ordinario. Monitoraggio varchi e supporto passeggeri.' },
    { num: 29, date: '2026-07-30', presenze: 36, colloqui: 1, desc: 'Servizio con affiancamento Ispettore Saracino (PolAria). Chiamata CO PS per lite verbale tra due soggetti stanziali presso Porta 2.' },
    { num: 30, date: '2026-08-06', presenze: 55, colloqui: 2, desc: 'Controlli intensivi esodo estivo. Presidio continuativo Piano Arrivi T1.' },
    { num: 31, date: '2026-09-03', presenze: 46, colloqui: 2, desc: 'Alta concentrazione stanziale. Assistenza integrata e censimento nominativi.' },
    { num: 32, date: '2026-09-10', presenze: 53, colloqui: 1, desc: 'Presidio controesodo. Verificati varchi e Spazio Calmo 5.' },
    { num: 33, date: '2026-09-17', presenze: 61, colloqui: 1, desc: 'Rientro ai flussi standard di inizio autunno. Monitoraggio costante T1.' },
    { num: 34, date: '2026-09-24', presenze: 60, colloqui: 2, desc: 'Servizio serale. Intervento coordinato con CO Security SEA.' },
    { num: 35, date: '2026-10-01', presenze: 76, colloqui: 2, desc: 'Report n. 35. Transizione verso i mesi freddi. Censimento ordinario completato. Presenza di Carla MENEGATTI, Nedka Petrova DEYANOVA, Massimo "Max" MILANI. Consegna passaporto smarrito.', compiler: 'Chiara Menegotto' },
    { num: 36, date: '2026-10-08', presenze: 48, colloqui: 2, desc: 'Report n. 36. Servizio serale/notturno T1 Malpensa (giovedì 8 ottobre 2026). Monitoraggio e censimento utenza stanziale (48 presenze rilevate), presidio varchi e coordinamento.', compiler: 'Chiara Menegotto' },
  ];

  reports2026Config.forEach((item) => {
    if (item.num === 36) {
      entries.push({
        id: `seed-2026-36`,
        savedAt: `2026-10-08T22:30:00.000Z`,
        fileName: `36_Report_Servizio_MXP_2026.10.08.json`,
        report: getCanonicalReport36(),
      });
      return;
    }

    const safeNumStr = String(item.num).padStart(2, '0');
    const comp = item.compiler || validCompilers[item.num % validCompilers.length];
    const saracinoAffiancamentoText = OFFICIAL_SARACINO_AFFIANCAMENTI_2026[item.num];
    const u1 = Math.round(item.presenze * 0.65);
    const u2 = item.presenze - u1;
    entries.push({
      id: `seed-2026-${item.num}`,
      savedAt: `${item.date}T22:30:00.000Z`,
      fileName: `${safeNumStr}_Report_Servizio_MXP_${item.date.replace(/-/g, '.')}.json`,
      report: {
        numeroReport: item.num,
        luogo: 'Aeroporto internazionale MXP, T1',
        riferimentiCO: 'CO Security SEA: 02.74862999 | CO PS: 02.74867553 | Pronto Soccorso: 02.74864444',
        data: item.date,
        oraInizio: '20:30',
        oraFine: '01:30',
        orarioTestoLibero: 'turno serale/notturno',
        apertureSbarraInizio: [
          { ora: '20:35', targa: 'GA 123 CA' },
          { ora: '01:25', targa: 'GA 456 CA' },
        ],
        luogoTermineFisso: 'Parcheggio P1 (apertura sbarra tramite lettura targa mezzi)',
        comunicazioneInizioCO: '20:30',
        comunicazioneFineCO: '01:30',
        caposervizio: 'Andrea Menegotto',
        compilatore: comp,
        personaleEsternoAffiancamento: saracinoAffiancamentoText || 'Nessuno //',
        squadra: [
          { id: 'm1', nomeCognome: 'Andrea Menegotto', nickname: 'Tiger', qualifica: 'Caposervizio', orarioServizio: '20:30 - 01:30', isCaposervizio: true, isCompilatore: comp === 'Andrea Menegotto' },
          { id: 'm2', nomeCognome: comp === 'Andrea Menegotto' ? 'Chiara Pozzi' : comp, nickname: comp.includes('Pozzi') ? 'Gabry' : comp.includes('Chiara Menegotto') ? 'Mene' : 'Tiger', qualifica: 'Compilatore', orarioServizio: '20:30 - 01:30', isCompilatore: comp !== 'Andrea Menegotto' },
          { id: 'm3', nomeCognome: 'Ambra Mazzoni', nickname: 'Trilly', qualifica: "Operatrice d'Emergenza / Counsellor", orarioServizio: '20:30 - 01:30', isCompilatore: false },
          { id: 'm4', nomeCognome: 'Roberto S.', nickname: 'Roby', qualifica: 'Volontario Operativo OdV', orarioServizio: '20:30 - 01:30' },
        ],
        rilevazioni: [
          {
            id: `ril-2026-${item.num}-1`,
            luogoIndividuazione: 'Porta 1 e Porta 2 - Piano Arrivi T1',
            numeroUtenti: u1,
            aggancioEffettuato: true,
            descrizione: item.desc,
            foto: [],
          },
          {
            id: `ril-2026-${item.num}-2`,
            luogoIndividuazione: 'Food Court e Vano CISL - Piano Partenze',
            numeroUtenti: u2,
            aggancioEffettuato: item.colloqui > 6,
            descrizione: 'Ispezione e monitoraggio stanziali nelle aree ristorazione e vani ascensori.',
            foto: [],
          },
        ],
        richiesteEmergenza: item.num === 29 ? 'Intervento effettuato ore 22:15 per lite verbale.' : 'Nessuna //',
        richiesteEmergenzaCOPS: item.num === 29 ? 'Intervento effettuato ore 22:15 per lite verbale.' : 'Nessuna //',
        richiesteEmergenzaCOSEA: 'Nessuna //',
        richiesteEmergenzaProntoSoccorsoMXP: 'Nessuna //',
        richiesteNonUrgenti: item.num === 10 ? 'Segnalato bagaglio incustodito ore 21:40.' : 'Nessuna //',
        note: `Servizio di pattugliamento n. ${item.num} svolto regolarmente.`,
        osservazioni: 'Sinergia positiva con il personale di scalo PolAria e SEA Security.',
      },
    });
  });

  return entries;
}

const VALID_COMPILERS_ROTATION = ['Chiara Pozzi', 'Chiara Menegotto', 'Andrea Menegotto'];

export function sanitizeReportCompilatore(entry: HistoricalReportEntry): HistoricalReportEntry {
  if (!entry || !entry.report) return entry;
  const rep = { ...entry.report };

  const rawNum = rep.numeroReport;
  let num = typeof rawNum === 'number' ? rawNum : 0;
  if (!num || num <= 0) {
    const m = String(rawNum ?? '').match(/\d+/);
    if (m) num = parseInt(m[0], 10);
  }

  const dataStr = (rep.data || '').trim();
  const fileName = (entry.fileName || '').trim();
  const idStr = (entry.id || '').trim();
  const is2025 =
    dataStr.startsWith('2025') ||
    dataStr.includes('/2025') ||
    dataStr.includes('.2025') ||
    fileName.includes('2025') ||
    idStr.includes('2025');

  // Solo per i report consolidati ufficiali (1-36 del 2026 e 1-27 del 2025)
  // allineiamo con le date ufficiali di turno storico
  if (is2025 && num >= 1 && num <= 27) {
    rep.data = getReportCorrectDate(num, true);
  } else if (!is2025 && num >= 1 && num <= 36) {
    if (!rep.data || num === 36) {
      rep.data = getReportCorrectDate(num, false);
    }
  } else if (!rep.data) {
    rep.data = new Date().toISOString().split('T')[0];
  }

  // Allineamento dati reali confermati per il Report 36: giovedì 8 ottobre 2026, 48 presenze, e affiancamento Ispettore Saracino
  if (!is2025 && num === 36) {
    rep.data = '2026-10-08';
    rep.caposervizio = 'Andrea Menegotto';
    rep.compilatore = 'Chiara Menegotto';
    rep.personaleEsternoAffiancamento = 'Ispettore Christian Saracino';
    if (!rep.osservazioni || !rep.osservazioni.toLowerCase().includes('saracino')) {
      rep.osservazioni = 'Presenza in affiancamento dell\'Ispettore Christian Saracino per le verifiche di sicurezza e censimento congiunto dell\'utenza stanziale.';
    }
    if (entry.fileName) {
      entry.fileName = entry.fileName
        .replace(/10[._-]06/g, '10.08')
        .replace(/06[._-]10/g, '08.10')
        .replace(/6[._\s]+ottobre/gi, '8 ottobre')
        .replace(/2026-10-06/g, '2026-10-08');
    }
    const curTotal = (rep.rilevazioni || []).reduce(
      (sum, r) => sum + (Number(r.numeroUtenti) || 0),
      0
    );
    if (curTotal !== 48) {
      if (!rep.rilevazioni || rep.rilevazioni.length === 0) {
        rep.rilevazioni = [
          {
            id: 'ril-2026-36-1',
            luogoIndividuazione: 'Porta 1 e Porta 2 - Piano Arrivi T1',
            numeroUtenti: 31,
            aggancioEffettuato: true,
            descrizione: 'Presidio serale/notturno varchi T1 e censimento utenza stanziale (31 utenti censiti).',
            foto: [],
          },
          {
            id: 'ril-2026-36-2',
            luogoIndividuazione: 'Food Court e Vano CISL - Piano Partenze',
            numeroUtenti: 17,
            aggancioEffettuato: true,
            descrizione: 'Monitoraggio aree ristorazione e vano ascensori stanziali (17 utenti censiti).',
            foto: [],
          },
        ];
      } else if (rep.rilevazioni.length === 1) {
        rep.rilevazioni[0].numeroUtenti = 48;
      } else {
        rep.rilevazioni[0].numeroUtenti = 31;
        rep.rilevazioni[1].numeroUtenti = 17;
      }
    }
  } else if (is2025 && num in OFFICIAL_PRESENZE_2025) {
    const targetPresenze = OFFICIAL_PRESENZE_2025[num];
    const curTotal = (rep.rilevazioni || []).reduce(
      (sum, r) => sum + (Number(r.numeroUtenti) || 0),
      0
    );
    if (curTotal !== targetPresenze) {
      if (!rep.rilevazioni || rep.rilevazioni.length === 0) {
        rep.rilevazioni = [
          {
            id: `ril-2025-${num}-1`,
            luogoIndividuazione: 'Porta 1 - Piano Arrivi',
            numeroUtenti: targetPresenze,
            aggancioEffettuato: true,
            descrizione: 'Presidio e censimento utenza stanziale.',
            foto: [],
          },
        ];
      } else if (rep.rilevazioni.length === 1) {
        rep.rilevazioni[0].numeroUtenti = targetPresenze;
      } else {
        const u1 = Math.round(targetPresenze * 0.6);
        rep.rilevazioni[0].numeroUtenti = u1;
        rep.rilevazioni[1].numeroUtenti = targetPresenze - u1;
      }
    }
  } else if (!is2025 && num in OFFICIAL_PRESENZE_2026) {
    const targetPresenze = OFFICIAL_PRESENZE_2026[num];
    const curTotal = (rep.rilevazioni || []).reduce(
      (sum, r) => sum + (Number(r.numeroUtenti) || 0),
      0
    );
    if (curTotal !== targetPresenze) {
      if (!rep.rilevazioni || rep.rilevazioni.length === 0) {
        rep.rilevazioni = [
          {
            id: `ril-2026-${num}-1`,
            luogoIndividuazione: 'Porta 1 e Porta 2 - Piano Arrivi T1',
            numeroUtenti: targetPresenze,
            aggancioEffettuato: true,
            descrizione: 'Presidio serale e censimento utenza stanziale.',
            foto: [],
          },
        ];
      } else if (rep.rilevazioni.length === 1) {
        rep.rilevazioni[0].numeroUtenti = targetPresenze;
      } else {
        const u1 = Math.round(targetPresenze * 0.65);
        rep.rilevazioni[0].numeroUtenti = u1;
        rep.rilevazioni[1].numeroUtenti = targetPresenze - u1;
      }
    }
  }

  // Allineamento affiancamento Saracino per gli altri report ufficiali
  if (is2025 && num in OFFICIAL_SARACINO_AFFIANCAMENTI_2025) {
    const txt = OFFICIAL_SARACINO_AFFIANCAMENTI_2025[num];
    if (!rep.personaleEsternoAffiancamento || rep.personaleEsternoAffiancamento.includes('Nessuno')) {
      rep.personaleEsternoAffiancamento = txt;
    }
  } else if (!is2025 && num in OFFICIAL_SARACINO_AFFIANCAMENTI_2026 && num !== 36) {
    const txt = OFFICIAL_SARACINO_AFFIANCAMENTI_2026[num];
    if (!rep.personaleEsternoAffiancamento || rep.personaleEsternoAffiancamento.includes('Nessuno')) {
      rep.personaleEsternoAffiancamento = txt;
    }
  }

  const cleanComp = (rep.compilatore || '').trim().toLowerCase();
  const isOldCompiler =
    !cleanComp ||
    cleanComp.includes('ambra') ||
    cleanComp.includes('mazzoni') ||
    !(
      cleanComp.includes('menegotto') ||
      cleanComp.includes('pozzi') ||
      cleanComp.includes('chiara') ||
      cleanComp.includes('andrea')
    );

  let fixedCompilatore = rep.compilatore;
  if (!is2025 && (num === 35 || num === 36)) {
    fixedCompilatore = 'Chiara Menegotto';
  } else if (isOldCompiler) {
    fixedCompilatore = VALID_COMPILERS_ROTATION[num % VALID_COMPILERS_ROTATION.length];
  }

  const nextSquadra = (rep.squadra || []).map((member) => {
    if (member.nomeCognome?.includes('Ambra Mazzoni')) {
      return {
        ...member,
        isCompilatore: false,
        qualifica: member.qualifica === 'Compilatore' ? "Operatrice d'Emergenza" : member.qualifica,
      };
    }
    if (member.nomeCognome?.includes(fixedCompilatore)) {
      return {
        ...member,
        isCompilatore: true,
      };
    }
    return member;
  });

  const compilerInSquadra = nextSquadra.some(
    (m) => m.nomeCognome?.includes(fixedCompilatore) && m.isCompilatore
  );

  if (!compilerInSquadra) {
    const existing = nextSquadra.find((m) => m.nomeCognome?.includes(fixedCompilatore));
    if (existing) {
      existing.isCompilatore = true;
    } else {
      nextSquadra.push({
        id: `comp-${fixedCompilatore.replace(/\s+/g, '-').toLowerCase()}`,
        nomeCognome: fixedCompilatore,
        nickname: fixedCompilatore.includes('Pozzi') ? 'Gabry' : fixedCompilatore.includes('Chiara Menegotto') ? 'Mene' : 'Tiger',
        qualifica: 'Compilatore',
        orarioServizio: rep.oraInizio && rep.oraFine ? `${rep.oraInizio} - ${rep.oraFine}` : '20:30 - 01:30',
        isCompilatore: true,
      });
    }
  }

  // Allinea rigorosamente il personale esterno in affiancamento per i report 1-34 del 2026
  if (!is2025 && num >= 1 && num <= 34) {
    const officialAff = OFFICIAL_SARACINO_AFFIANCAMENTI_2026[num];
    if (officialAff) {
      rep.personaleEsternoAffiancamento = officialAff;
    } else {
      rep.personaleEsternoAffiancamento = 'Nessuno //';
    }
  }

  return {
    ...entry,
    report: {
      ...rep,
      compilatore: fixedCompilatore,
      squadra: nextSquadra,
    },
  };
}

export function getReportNormalizedKey(item: HistoricalReportEntry): string {
  const r = item && item.report ? item.report : (item as any);
  const dataStr = (r?.data || '').trim();
  const fileName = (item?.fileName || '').trim();
  const idStr = (item?.id || '').trim();

  // 1. Riconoscimento robusto dell'anno di riferimento (2025 vs 2026)
  let year = '';
  const dateYearMatch = dataStr.match(/\b(2025|2026)\b/);
  if (dateYearMatch) {
    year = dateYearMatch[1];
  } else if (dataStr.startsWith('2025') || dataStr.endsWith('/2025') || dataStr.endsWith('.2025')) {
    year = '2025';
  } else if (dataStr.startsWith('2026') || dataStr.endsWith('/2026') || dataStr.endsWith('.2026')) {
    year = '2026';
  } else if (fileName.includes('2025') || idStr.includes('2025')) {
    year = '2025';
  } else if (fileName.includes('2026') || idStr.includes('2026')) {
    year = '2026';
  }

  // 2. Estrazione pulita e univoca del numero di report
  let num = Number(r?.numeroReport);
  if (!Number.isFinite(num) || num <= 0) {
    const rawNumStr = String(r?.numeroReport ?? '');
    const numMatch = rawNumStr.match(/\d+/);
    if (numMatch) {
      num = parseInt(numMatch[0], 10);
    }
  }
  if (!Number.isFinite(num) || num <= 0) {
    const fileMatch = fileName.match(/(?:report|n|num|n°|turno)[._\s-]*(\d+)/i) || fileName.match(/^(\d+)[._\s-]/);
    if (fileMatch) {
      num = parseInt(fileMatch[1], 10);
    }
  }
  if (!Number.isFinite(num) || num <= 0) {
    const idMatch = idStr.match(/(?:rep|report|seed|doc)?[_-]?(\d+)$/i);
    if (idMatch) {
      num = parseInt(idMatch[1], 10);
    }
  }

  // Se l'anno non è ancora determinato, deducilo dai limiti storici
  if (!year) {
    if (fileName.toLowerCase().includes('2025') || idStr.includes('2025')) {
      year = '2025';
    } else {
      year = '2026';
    }
  }

  // CHIAVE UNICA ASSOLUTA: ogni report N dell'anno X ha SEMPRE la stessa chiave
  if (num > 0) {
    return `${year}-${num}`;
  }

  // Fallback per report privi di numero: normalizza la data
  let normalizedDate = dataStr;
  const itMatch = dataStr.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (itMatch) {
    normalizedDate = `${itMatch[3]}-${itMatch[2].padStart(2, '0')}-${itMatch[1].padStart(2, '0')}`;
  }
  return `${year}-date-${normalizedDate || idStr || 'unknown'}`;
}

export const INITIAL_HISTORICAL_REPORTS: HistoricalReportEntry[] = generateHistoricalReportsSeed().map(sanitizeReportCompilatore);

export function mergeReportEntries(
  baseList: HistoricalReportEntry[],
  newList: HistoricalReportEntry[]
): HistoricalReportEntry[] {
  const map = new Map<string, HistoricalReportEntry>();

  const allItems = [...(baseList || []), ...(newList || [])];

  allItems.forEach((rawItem) => {
    if (!rawItem || !rawItem.report) return;
    const sanitized = sanitizeReportCompilatore(rawItem);
    const key = getReportNormalizedKey(sanitized);

    if (!map.has(key)) {
      map.set(key, sanitized);
      return;
    }

    const existing = map.get(key)!;
    const is2025 = key.startsWith('2025');
    const numMatch = key.match(/(\d+)$/);
    const num = numMatch ? parseInt(numMatch[1], 10) : (sanitized.report.numeroReport || 0);

    // Se esiste già una voce per questo report (stesso numero e anno):
    // 1. Privilegia i dati strutturati JSON completi rispetto ai placeholder da soli file PDF
    // Per Report 36: consolida sempre il report canonico reale (48 utenti, 8 ottobre 2026, Ispettore Saracino) associando l'eventuale file Drive
    if (!is2025 && num === 36) {
      const canonical = getCanonicalReport36();
      const driveId = sanitized.id?.startsWith('drive-')
        ? sanitized.id
        : existing.id?.startsWith('drive-')
        ? existing.id
        : existing.id;
      const driveFileId = sanitized.driveFileId || existing.driveFileId || (driveId.startsWith('drive-') ? driveId.replace(/^drive-(?:doc-)?/, '') : undefined);
      const driveFileName = sanitized.fileName || existing.fileName || '36_Report_Servizio_MXP_2026.10.08.pdf';
      const driveWebViewLink = sanitized.driveWebViewLink || existing.driveWebViewLink || (driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : undefined);
      map.set(key, {
        id: driveId,
        savedAt: existing.savedAt || sanitized.savedAt || '2026-10-08T22:30:00.000Z',
        fileName: driveFileName,
        driveFileId,
        driveWebViewLink,
        driveWebContentLink: sanitized.driveWebContentLink || existing.driveWebContentLink,
        report: {
          ...canonical,
          data: '2026-10-08',
          compilatore: 'Chiara Menegotto',
          caposervizio: 'Andrea Menegotto',
          personaleEsternoAffiancamento: 'Ispettore Christian Saracino',
        },
      });
      return;
    }

    const existingIsDocPlaceholder = (existing.id || '').startsWith('drive-doc-');
    const newIsDocPlaceholder = (sanitized.id || '').startsWith('drive-doc-');

    if (existingIsDocPlaceholder && !newIsDocPlaceholder) {
      map.set(key, {
        ...sanitized,
        driveFileId: sanitized.driveFileId || existing.driveFileId,
        driveWebViewLink: sanitized.driveWebViewLink || existing.driveWebViewLink,
        driveWebContentLink: sanitized.driveWebContentLink || existing.driveWebContentLink,
      });
      return;
    }
    if (!existingIsDocPlaceholder && newIsDocPlaceholder) {
      // Mantieni la voce ricca esistente associando i riferimenti Drive
      map.set(key, {
        ...existing,
        driveFileId: sanitized.driveFileId || existing.driveFileId || sanitized.id.replace(/^drive-(?:doc-)?/, ''),
        driveWebViewLink: sanitized.driveWebViewLink || existing.driveWebViewLink,
        driveWebContentLink: sanitized.driveWebContentLink || existing.driveWebContentLink,
      });
      return;
    }

    // 2. Per i report consolidati ufficiali (1-36 del 2026 e 1-27 del 2025)
    const isOfficialConsolidated = (!is2025 && num >= 1 && num <= 36) || (is2025 && num >= 1 && num <= 27);

    if (isOfficialConsolidated) {
      // Se sanitized ha un ID Google Drive o un fileName Drive associato, aggiorna l'ID/fileName preservando la ricchezza dati
      const driveFileId = sanitized.driveFileId || existing.driveFileId || (sanitized.id?.startsWith('drive-') ? sanitized.id.replace(/^drive-(?:doc-)?/, '') : undefined);
      const driveWebViewLink = sanitized.driveWebViewLink || existing.driveWebViewLink || (driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : undefined);
      map.set(key, {
        ...existing,
        id: sanitized.id?.startsWith('drive-') ? sanitized.id : existing.id,
        fileName: sanitized.fileName || existing.fileName,
        driveFileId,
        driveWebViewLink,
        driveWebContentLink: sanitized.driveWebContentLink || existing.driveWebContentLink,
        report: {
          ...existing.report,
          ...(sanitized.report?.rilevazioni && sanitized.report.rilevazioni.length > 0 ? { rilevazioni: sanitized.report.rilevazioni } : {}),
          ...(!is2025 && num === 36 ? { data: '2026-10-08', caposervizio: 'Andrea Menegotto', compilatore: 'Chiara Menegotto', personaleEsternoAffiancamento: 'Ispettore Christian Saracino' } : sanitized.report?.data ? { data: sanitized.report.data } : {}),
          ...(sanitized.report?.compilatore ? { compilatore: sanitized.report.compilatore } : {}),
        },
      });
      return;
    }

    // 3. Per i nuovi report (> 36 del 2026 o nuovi inserimenti):
    // Seleziona la versione con rilevazioni reali popolate o proveniente direttamente da Google Drive
    const timeExisting = existing.savedAt ? new Date(existing.savedAt).getTime() : 0;
    const timeNew = sanitized.savedAt ? new Date(sanitized.savedAt).getTime() : 0;
    
    const countPopulated = (list: any[] = []) =>
      list.filter((r) => r && (r.luogoIndividuazione?.trim() || r.descrizione?.trim() || Number(r.numeroUtenti) > 0)).length;

    const newPopulated = countPopulated(sanitized.report?.rilevazioni);
    const existingPopulated = countPopulated(existing.report?.rilevazioni);

    const fromDrive = Boolean(sanitized.id?.startsWith('drive-') || sanitized.driveFileId);
    const existingFromDrive = Boolean(existing.id?.startsWith('drive-') || existing.driveFileId);

    // Pulisci le rilevazioni dagli slot vuoti duplicati
    if (Array.isArray(sanitized.report?.rilevazioni)) {
      sanitized.report.rilevazioni = sanitized.report.rilevazioni.filter(
        (r) => r && (r.luogoIndividuazione?.trim() || r.descrizione?.trim() || Number(r.numeroUtenti) > 0)
      );
    }
    if (Array.isArray(existing.report?.rilevazioni)) {
      existing.report.rilevazioni = existing.report.rilevazioni.filter(
        (r) => r && (r.luogoIndividuazione?.trim() || r.descrizione?.trim() || Number(r.numeroUtenti) > 0)
      );
    }

    if (
      (fromDrive && !existingFromDrive) ||
      newPopulated > existingPopulated ||
      (newPopulated === existingPopulated && timeNew >= timeExisting)
    ) {
      map.set(key, {
        ...sanitized,
        driveFileId: sanitized.driveFileId || existing.driveFileId,
        driveWebViewLink: sanitized.driveWebViewLink || existing.driveWebViewLink,
        driveWebContentLink: sanitized.driveWebContentLink || existing.driveWebContentLink,
      });
    } else {
      map.set(key, {
        ...existing,
        driveFileId: sanitized.driveFileId || existing.driveFileId,
        driveWebViewLink: sanitized.driveWebViewLink || existing.driveWebViewLink,
        driveWebContentLink: sanitized.driveWebContentLink || existing.driveWebContentLink,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const keyA = getReportNormalizedKey(a);
    const keyB = getReportNormalizedKey(b);
    const is2025A = keyA.startsWith('2025');
    const is2025B = keyB.startsWith('2025');

    if (is2025A !== is2025B) {
      return is2025A ? 1 : -1;
    }

    const numMatchA = keyA.match(/(\d+)$/);
    const numMatchB = keyB.match(/(\d+)$/);
    const numA = numMatchA ? parseInt(numMatchA[1], 10) : (Number(a.report?.numeroReport) || 0);
    const numB = numMatchB ? parseInt(numMatchB[1], 10) : (Number(b.report?.numeroReport) || 0);

    return numB - numA;
  });
}

export function deduplicateHistoricalReports(
  entries: HistoricalReportEntry[]
): HistoricalReportEntry[] {
  return mergeReportEntries([], entries);
}

/**
 * Extracts bracketed subject tags like `[Soggetto noto: Nome]` from a description
 */
export function extractTaggedSubjectsFromText(text: string): string[] {
  const matches: string[] = [];
  const regex = /\[Soggetto noto:\s*([^\]]+)\]/gi;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match !== null) {
    const clean = match[1].trim();
    if (clean && !matches.includes(clean)) {
      matches.push(clean);
    }
    match = regex.exec(text);
  }
  return matches;
}

/**
 * Builds an indexed memory of volunteers, recurring subjects, locations, and areas
 * from all stored/imported historical reports + custom saved subjects.
 */
export function buildMemoryIndex(
  history: HistoricalReportEntry[],
  customSubjects: string[] = []
): MemoryIndex {
  const volunteerMap = new Map<string, KnownVolunteer>();
  const subjectMap = new Map<string, KnownSubjectRecord>();
  const locationsSet = new Set<string>(LUOGHI_PREDEFINITI);
  const coSet = new Set<string>([
    'CO SEA / Presidio Serale-Notturno',
    'CO SEA / Presidio Diurno',
    'CO Polaria / Coordinamento Scalo',
  ]);
  const areasSet = new Set<string>(LUOGHI_INDIVIDUAZIONE_PREDEFINITI);
  const platesSet = new Set<string>();

  const sorted = [...history].sort((a, b) =>
    (a.report.data || '').localeCompare(b.report.data || '')
  );

  sorted.forEach((entry) => {
    const rep = entry.report;
    if (rep.luogo?.trim()) locationsSet.add(rep.luogo.trim());
    if (rep.riferimentiCO?.trim()) coSet.add(rep.riferimentiCO.trim());

    (rep.apertureSbarraInizio || []).forEach((b) => {
      const t = (b.targa || '').trim().toUpperCase();
      if (t) platesSet.add(t);
    });

    (rep.squadra || []).forEach((m) => {
      const name = (m.nomeCognome || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      const existing = volunteerMap.get(key);
      volunteerMap.set(key, {
        nomeCognome: name,
        nickname: m.nickname?.trim() || existing?.nickname || '',
        qualifica: m.qualifica?.trim() || existing?.qualifica || 'Volontario OdV',
        note: m.note?.trim() || existing?.note || '',
        presenzeCount: (existing?.presenzeCount || 0) + 1,
        lastSeenDate: rep.data || existing?.lastSeenDate || '',
      });
    });

    (rep.rilevazioni || []).forEach((ril) => {
      const luogoRil = (ril.luogoIndividuazione || ril.areaTerminal || '').trim();
      if (luogoRil) {
        areasSet.add(luogoRil);
      }
      const combinedTags = new Set<string>([
        ...(ril.nominativiAssociati || []),
        ...extractTaggedSubjectsFromText(ril.descrizione || ''),
      ]);

      combinedTags.forEach((tag) => {
        const cleanTag = tag.trim();
        if (!cleanTag) return;
        const key = cleanTag.toLowerCase();
        const prev = subjectMap.get(key);
        subjectMap.set(key, {
          nameOrAlias: cleanTag,
          usualArea: luogoRil || prev?.usualArea || 'Area Aeroportuale',
          occurrences: (prev?.occurrences || 0) + 1,
          lastSeenDate: rep.data || prev?.lastSeenDate || '',
          lastSummary: (ril.descrizione || '')
            .replace(/\[Soggetto noto:\s*[^\]]+\]\s*/gi, '')
            .trim(),
        });
      });
    });
  });

  customSubjects.forEach((sub) => {
    const clean = sub.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (!subjectMap.has(key)) {
      subjectMap.set(key, {
        nameOrAlias: clean,
        usualArea: 'Rubrica Nominativi',
        occurrences: 1,
        lastSeenDate: new Date().toISOString().split('T')[0],
        lastSummary: 'Nominativo registrato.',
      });
    }
  });

  return {
    volunteers: Array.from(volunteerMap.values()).sort(
      (a, b) =>
        b.presenzeCount - a.presenzeCount ||
        a.nomeCognome.localeCompare(b.nomeCognome)
    ),
    subjects: Array.from(subjectMap.values()).sort(
      (a, b) =>
        b.occurrences - a.occurrences ||
        a.nameOrAlias.localeCompare(b.nameOrAlias)
    ),
    locations: Array.from(locationsSet),
    coReferences: Array.from(coSet),
    areas: Array.from(areasSet),
    licensePlates: Array.from(platesSet),
  };
}

/**
 * Parses an imported file (.json or .html exported report) from a local/Drive folder
 * into one or more HistoricalReportEntry objects.
 */
export async function parseReportFile(file: File): Promise<HistoricalReportEntry[]> {
  const text = await file.text();
  const entries: HistoricalReportEntry[] = [];

  if (
    file.name.endsWith('.json') ||
    text.trim().startsWith('{') ||
    text.trim().startsWith('[')
  ) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        parsed.forEach((item, idx) => {
          if (item && item.report && item.report.squadra) {
            entries.push(item);
          } else if (item && item.squadra && item.rilevazioni) {
            entries.push({
              id: `imp-${Date.now()}-${idx}`,
              savedAt: new Date().toISOString(),
              fileName: file.name,
              report: item,
            });
          }
        });
        if (entries.length > 0) return entries;
      } else if (parsed && parsed.report && parsed.report.squadra) {
        return [{ ...parsed, fileName: file.name }];
      } else if (parsed && parsed.squadra && parsed.rilevazioni) {
        return [
          {
            id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            savedAt: new Date().toISOString(),
            fileName: file.name,
            report: parsed,
          },
        ];
      }
    } catch {
      // fallback
    }
  }

  const stateMatch = text.match(/let\s+state\s*=\s*(\{[\s\S]*?\});\s*function/);
  if (stateMatch && stateMatch[1]) {
    try {
      const extractedReport = JSON.parse(stateMatch[1]);
      if (extractedReport && Array.isArray(extractedReport.squadra)) {
        return [
          {
            id: `imp-html-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            savedAt: new Date().toISOString(),
            fileName: file.name,
            report: extractedReport,
          },
        ];
      }
    } catch {
      // ignore
    }
  }

  return entries;
}
