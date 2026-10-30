export interface BarrierEntry {
  ora: string;
  targa: string;
}

export interface SavedLicensePlate {
  id: string;
  targa: string;
  label?: string;
  isDefaultSbarra1?: boolean;
  isDefaultSbarra2?: boolean;
}

export interface SavedSignature {
  id: string;
  nomeOperatore: string; // Nome operatore/compilatore a cui associare la firma
  label: string; // Etichetta descrittiva
  immagineUrl: string; // Data URL dell'immagine scansionata
  isDefault?: boolean;
}

export const DEFAULT_SAVED_SIGNATURES: SavedSignature[] = [
  {
    id: 'sig-1',
    nomeOperatore: 'Andrea Menegotto',
    label: 'Firma Scansionata - Andrea Menegotto (Tiger)',
    immagineUrl:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60" width="240" height="60"><path d="M 20 42 C 35 15, 45 10, 50 38 C 55 45, 65 30, 75 35 C 85 40, 95 28, 105 34 C 120 40, 130 18, 145 25 C 160 32, 175 22, 195 28 M 30 25 L 180 22 M 15 50 C 70 42, 130 48, 220 38" fill="none" stroke="%231a365d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    isDefault: true,
  },
  {
    id: 'sig-2',
    nomeOperatore: 'Chiara Menegotto',
    label: 'Firma Scansionata - Chiara Menegotto (Mene)',
    immagineUrl:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60" width="240" height="60"><path d="M 20 40 C 30 20, 40 15, 45 35 C 50 42, 60 28, 68 33 C 78 38, 88 22, 98 30 C 110 36, 125 20, 140 28 C 155 35, 170 20, 190 25 M 18 26 L 175 22" fill="none" stroke="%231a365d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    isDefault: false,
  },
  {
    id: 'sig-3',
    nomeOperatore: 'Chiara Pozzi',
    label: 'Firma Scansionata - Chiara Pozzi (Gabry)',
    immagineUrl:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60" width="240" height="60"><path d="M 25 45 C 32 18, 42 12, 48 35 C 54 48, 62 26, 70 32 C 80 40, 92 15, 100 28 C 115 38, 135 18, 155 30 C 175 42, 190 20, 215 25 M 20 28 C 80 20, 140 26, 200 18 M 22 52 C 80 46, 150 50, 218 42" fill="none" stroke="%231a365d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    isDefault: false,
  },
];

export const DEFAULT_SAVED_PLATES: SavedLicensePlate[] = [
  {
    id: 'plate-1',
    targa: 'GA 123 CA',
    label: 'Mezzo di servizio 1 (City Angels)',
    isDefaultSbarra1: true,
    isDefaultSbarra2: false,
  },
  {
    id: 'plate-2',
    targa: 'GA 456 CA',
    label: 'Mezzo di servizio 2 (City Angels)',
    isDefaultSbarra1: false,
    isDefaultSbarra2: true,
  },
];

export interface RosterMember {
  id: string;
  nomeCognome: string;
  nickname: string;
  qualifica: string;
  orarioServizio: string;
  isPresente: boolean;
  isCaposervizio: boolean;
  isCompilatore: boolean;
}

export interface TeamMember {
  id: string;
  nomeCognome: string;
  nickname: string;
  qualifica: string;
  orarioServizio: string;
  note?: string;
  isCaposervizio?: boolean;
  isCompilatore?: boolean;
}

export interface PhotoAttachment {
  id: string;
  dataUrl: string;
  name: string;
}

export interface RilevazioneItem {
  id: string;
  luogoIndividuazione: string;
  areaTerminal?: string;
  descrizione: string;
  numeroUtenti: number;
  aggancioEffettuato: boolean;
  nominativiAssociati?: string[];
  operatoriCoinvolti?: string[];
  foto: PhotoAttachment[];
}

export interface AssociazioneEntityData {
  ragioneSociale: string;
  telEmergenze: string;
  email: string;
  sitoWeb: string;
  codiceFiscale: string;
}

export interface CooperativaEntityData {
  ragioneSociale: string;
  sedeLegale: string;
  telefono: string;
  email: string;
  pec: string;
  sitoWeb: string;
  cfPiva: string;
  iscrizioniRegistri: string;
}

export interface CorporateHeaderConfig {
  logoUrl: string;
  logoAssociazioneUrl?: string;
  logoCooperativaUrl?: string;
  titoloDocumento: string;
  associazione: AssociazioneEntityData;
  cooperativa: CooperativaEntityData;
  // Campi di compatibilità
  blocco1Associazione?: string;
  blocco2Cooperativa?: string;
  associazioneRagioneSociale?: string;
  cooperativaRagioneSociale?: string;
}

export interface ServiceTimeSlot {
  id: string;
  oraInizio: string;
  oraFine: string;
  descrizione?: string;
}

export interface ServiceReportData {
  numeroReport: number;
  luogo: string;
  riferimentiCO: string;
  data: string;
  oraInizio: string;
  oraFine: string;
  orarioTestoLibero: string;
  orariServizio?: ServiceTimeSlot[];
  apertureSbarraInizio: [BarrierEntry, BarrierEntry];
  luogoTermineFisso: string;
  comunicazioneInizioCO: string;
  comunicazioneFineCO: string;
  caposervizio: string;
  compilatore: string;
  firmaImmagineUrl?: string;
  squadra: TeamMember[];
  personaleEsternoAffiancamento: string;
  rilevazioni: RilevazioneItem[];
  richiesteEmergenzaCOPS: string;
  richiesteEmergenzaCOSEA: string;
  richiesteEmergenzaProntoSoccorsoMXP?: string;
  richiesteEmergenza: string;
  richiesteNonUrgenti: string;
  note: string;
  osservazioni: string;
}

export const TESTO_FISSO_LUOGO = 'Aeroporto internazionale MXP, T1';

export const TESTO_FISSO_RIFERIMENTI_EMERGENZE =
  'CO Security SEA: 02.74862999 | CO PS: 02.74867553-02.74867552 | Pronto Soccorso MXP: 02.74864444';

export const TESTO_FISSO_LUOGO_INIZIO_BASE = 'Parcheggio P1';

export const TESTO_FISSO_LUOGO_TERMINE =
  'Parcheggio P1 (apertura sbarra tramite lettura targa mezzi)';

export const DEFAULT_ASSOCIAZIONE_CONFIG: AssociazioneEntityData = {
  ragioneSociale:
    'Associazione Nazionale City Angels Italia ODV\nCoordinamento Provinciale di Varese',
  telEmergenze: '377-5502177',
  email: 'varese@cityangels.it',
  sitoWeb: 'www.cityangels.it',
  codiceFiscale: '',
};

export const DEFAULT_COOPERATIVA_CONFIG: CooperativaEntityData = {
  ragioneSociale: 'CITY ANGELS VARESE Coop. soc.',
  sedeLegale: 'via Severo Piatti n° 11 - 21100 Varese',
  telefono: '377-5502177',
  email: 'coopvarese@cityangels.it',
  pec: 'cityangelsvarese20@pec.cgn.it',
  sitoWeb: 'cityangelsvarese.netlify.app',
  cfPiva: '03787870124',
  iscrizioniRegistri:
    'Iscrizione Albo Società Cooperative n. C134264 - 21/09/2020 - Albo Regionale delle Cooperative Sociali – Lombardia: 07/11/2022 – sezione A | Iscrizione RUNTS: Imprese sociali – 8/04/2022 - n. repertorio: 28685',
};

export const BLOCCO_1_ASSOCIAZIONE_TESTO =
  'Associazione Nazionale City Angels Italia ODV\nCoordinamento Provinciale di Varese\ntel. per emergenze e info: 377-5502177\nvarese@cityangels.it\nwww.cityangels.it';

export const BLOCCO_2_COOPERATIVA_TESTO =
  'CITY ANGELS VARESE Coop. soc.\nvia Severo Piatti n° 11 - 21100 Varese\ntel.: 377-5502177\ncoopvarese@cityangels.it\ncityangelsvarese20@pec.cgn.it\ncityangelsvarese.netlify.app\nC.F.: e P. IVA: 03787870124\nIscrizione Albo Società Cooperative n. C134264 - 21/09/2020 - Albo Regionale delle Cooperative Sociali – Lombardia: 07/11/2022 – sezione A\nIscrizione RUNTS: Imprese sociali – 8/04/2022 - n. repertorio: 28685';

export const DEFAULT_CORPORATE_CONFIG: CorporateHeaderConfig = {
  logoUrl: '',
  logoAssociazioneUrl: '',
  logoCooperativaUrl: '',
  titoloDocumento: 'REPORT DI SERVIZIO n.',
  associazione: { ...DEFAULT_ASSOCIAZIONE_CONFIG },
  cooperativa: { ...DEFAULT_COOPERATIVA_CONFIG },
  blocco1Associazione: BLOCCO_1_ASSOCIAZIONE_TESTO,
  blocco2Cooperativa: BLOCCO_2_COOPERATIVA_TESTO,
};

/**
 * Squadra pre-compilata con i 6 operatori ufficiali e le relative qualifiche.
 * Nessun orario o ruolo specifico della serata è pre-impostato.
 */
export const DEFAULT_ROSTER: RosterMember[] = [
  {
    id: 'op-1',
    nomeCognome: 'Andrea Menegotto',
    nickname: 'Tiger',
    qualifica:
      'Coordinatore CA Provincia di Varese - Presidente Coop., Consulente e Formatore esperto in compliance, safety, security e autodifesa',
    orarioServizio: '',
    isPresente: true,
    isCaposervizio: false,
    isCompilatore: false,
  },
  {
    id: 'op-2',
    nomeCognome: 'Ambra Mazzoni',
    nickname: 'Trilly',
    qualifica:
      "Coordinatrice Varese città - Amministratore Cooperativa, Operatrice d'Emergenza, Counsellor",
    orarioServizio: '',
    isPresente: true,
    isCaposervizio: false,
    isCompilatore: false,
  },
  {
    id: 'op-3',
    nomeCognome: 'Chiara Menegotto',
    nickname: 'Mene',
    qualifica:
      "Responsabile Operativo CA Provincia di Varese, Responsabile Progettazione Coop., Operatrice d'emergenza, Sociologa e Progettista Sociale",
    orarioServizio: '',
    isPresente: true,
    isCaposervizio: false,
    isCompilatore: false,
  },
  {
    id: 'op-4',
    nomeCognome: 'Chiara Pozzi',
    nickname: 'Gabry',
    qualifica:
      'Coordinatrice CA Sezioni Busto Arsizio - Gallarate, Vice Presidente Coop., Psicologa Clinica - area Neuropsicologia - esperta in Psicologia Giuridica',
    orarioServizio: '',
    isPresente: true,
    isCaposervizio: false,
    isCompilatore: false,
  },
  {
    id: 'op-5',
    nomeCognome: 'Fabio Brandolini',
    nickname: 'Brando',
    qualifica: 'Caposquadra CA',
    orarioServizio: '',
    isPresente: true,
    isCaposervizio: false,
    isCompilatore: false,
  },
  {
    id: 'op-6',
    nomeCognome: 'Elena Giussani',
    nickname: 'Spider',
    qualifica: 'Angelo semplice, Avvocato',
    orarioServizio: '',
    isPresente: true,
    isCaposervizio: false,
    isCompilatore: false,
  },
  {
    id: 'op-7',
    nomeCognome: 'Stefania Massarenti',
    nickname: 'Diana',
    qualifica: 'Angelo semplice',
    orarioServizio: '',
    isPresente: true,
    isCaposervizio: false,
    isCompilatore: false,
  },
];

/**
 * Allinea rigorosamente l'ordine della squadra all'elenco fisso del roster.
 * I membri non trovati vengono posizionati in fondo (indice 9999), MAI in cima (-1).
 */
export function alignSquadraToRosterOrder(
  squadra: TeamMember[],
  rosterList: RosterMember[]
): TeamMember[] {
  if (!squadra || squadra.length === 0) return [];
  if (!rosterList || rosterList.length === 0) return squadra;

  const getPos = (m: TeamMember): number => {
    // 1. Corrispondenza per ID univoco
    const idxById = rosterList.findIndex((r) => r.id === m.id);
    if (idxById !== -1) return idxById;

    // 2. Corrispondenza per Nome e Cognome (case-insensitive)
    const mName = (m.nomeCognome || '').trim().toLowerCase();
    if (mName) {
      const idxByName = rosterList.findIndex(
        (r) => (r.nomeCognome || '').trim().toLowerCase() === mName
      );
      if (idxByName !== -1) return idxByName;
    }

    // 3. Corrispondenza per Nickname (es. "Diana", "Tiger", "Trilly")
    const mNick = (m.nickname || '').trim().toLowerCase();
    if (mNick) {
      const idxByNick = rosterList.findIndex(
        (r) => (r.nickname || '').trim().toLowerCase() === mNick
      );
      if (idxByNick !== -1) return idxByNick;
    }

    // Fallback sicuro: in fondo alla lista, MAI in cima
    return 9999;
  };

  return [...squadra].sort((a, b) => getPos(a) - getPos(b));
}

export const QUALIFICHE_PREDEFINITE: string[] = [
  'Coordinatore CA Provincia di Varese - Presidente Coop., Consulente e Formatore esperto in compliance, safety, security e autodifesa',
  "Coordinatrice Varese città - Amministratore Cooperativa, Operatrice d'Emergenza, Counsellor",
  "Responsabile Operativo CA Provincia di Varese, Responsabile Progettazione Coop., Operatrice d'emergenza, Sociologa e Progettista Sociale",
  'Coordinatrice CA Sezioni Busto Arsizio - Gallarate, Vice Presidente Coop., Psicologa Clinica - area Neuropsicologia - esperta in Psicologia Giuridica',
  'Caposquadra CA',
  'Vice Caposquadra CA',
  'Angelo semplice, Avvocato',
  'Angelo semplice',
  'Operatore Coop. Sociale',
];

export const LUOGHI_PREDEFINITI: string[] = [TESTO_FISSO_LUOGO];

export const LUOGHI_INDIVIDUAZIONE_PREDEFINITI: string[] = [
  'Porta 1 - Piano Arrivi',
  'Porta 2 - Vano CISL',
  'Porta 4 - Piano Arrivi',
  'Porta 5 - Piano Arrivi',
  'Porta 6 / Porta 7 - Piano Arrivi',
  'Food Court - Piano Arrivi',
  'Food Court - Piano Partenze',
  'Pret a Manger - Piano Arrivi',
  'Zona RossoPomodoro',
  'Stazione Ferroviaria / Fuori Stazione',
  'Corridoio della Cappella',
  'Zona Carosello',
  'Porta 12 / Check-in Area 2',
  'Porta 14 / Porta 15 / Porta 17 - Piano Partenze',
  'Spazio Calmo 5 - Piano Uffici',
];

export const OPZIONI_DETTAGLIO_ORARIO: string[] = [
  'Presidio sociale e deterrenza',
  'Monitoraggio, presidio sociale e deterrenza',
  'Affiancamento servizio di Ordine Pubblico in base a Ordinanza Questura',
  'Presidio continuativo',
  'Presidio serale-notturno',
  'Presidio diurno e monitoraggio varchi',
];

export function indexToAlpha(index: number): string {
  if (typeof index !== 'number' || isNaN(index) || index < 0) {
    return 'a';
  }
  const safeIndex = Math.floor(index);
  const baseChar = String.fromCharCode((safeIndex % 26) + 97);
  const repeatCount = Math.max(1, Math.floor(safeIndex / 26) + 1);
  return baseChar.repeat(repeatCount);
}

export function isRealEmergencyRequest(text?: string | null): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  if (
    !clean ||
    clean === 'nessuna //' ||
    clean === 'nessuna' ||
    clean === '//' ||
    clean === '-' ||
    clean === '—' ||
    clean === 'n.a.' ||
    clean === 'n.d.'
  ) {
    return false;
  }

  // Chiamate o comunicazioni ordinarie / normali di inizio e termine servizio
  const isRoutineOrNormalCall =
    clean.includes('inizio servizio') ||
    clean.includes('fine servizio') ||
    clean.includes('termine servizio') ||
    clean.includes('inizio e fine') ||
    clean.includes('inizio e termine') ||
    clean.includes('inizio/fine') ||
    clean.includes('inizio/termine') ||
    clean.includes('comunicazione inizio') ||
    clean.includes('comunicazione fine') ||
    clean.includes('comunicazione routine') ||
    clean.includes('comunicazione ordinaria') ||
    clean.includes('chiamata ordinaria') ||
    clean.includes('chiamate ordinarie') ||
    clean.includes('chiamata normale') ||
    clean.includes('chiamate normali') ||
    clean.includes('chiamata co ps') ||
    clean.includes('chiamata co sea') ||
    clean.includes('contattata co ps per inizio') ||
    clean.includes('contattata co sea per inizio') ||
    clean.includes('comunicato alla centrale') ||
    clean.includes('comunicato a co') ||
    clean.includes('routine') ||
    clean.includes('ordinaria') ||
    clean.includes('effettuata, ore') ||
    clean.includes('effettuata ore');

  // Eventi reali di emergenza/urgenza che prevalgono sul testo di routine
  const isGenuineEmergency =
    clean.includes('lite') ||
    clean.includes('aggressione') ||
    clean.includes('rissa') ||
    clean.includes('malore') ||
    clean.includes('infortunio') ||
    clean.includes('furto') ||
    clean.includes('soccorso') ||
    clean.includes('118') ||
    clean.includes('bagaglio incustodito') ||
    clean.includes('allontanamento') ||
    clean.includes('daspo') ||
    clean.includes('arresto') ||
    clean.includes('intervento') ||
    clean.includes('urgente') ||
    clean.includes('emergenza') ||
    clean.includes('scorta') ||
    clean.includes('tso') ||
    clean.includes('ambulanza') ||
    clean.includes('polaria');

  if (isRoutineOrNormalCall && !isGenuineEmergency) {
    return false;
  }

  return true;
}

export function formatDateIT(isoDate: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
}

export function formatDateExtendedIT(isoDate: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate;
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const giorni = [
    'Domenica',
    'Lunedì',
    'Martedì',
    'Mercoledì',
    'Giovedì',
    'Venerdì',
    'Sabato',
  ];
  const mesi = [
    'Gennaio',
    'Febbraio',
    'Marzo',
    'Aprile',
    'Maggio',
    'Giugno',
    'Luglio',
    'Agosto',
    'Settembre',
    'Ottobre',
    'Novembre',
    'Dicembre',
  ];
  const dayName = giorni[dateObj.getDay()];
  const dayNum = String(parts[2]).padStart(2, '0');
  const monthName = mesi[parts[1] - 1];
  return `${dayName} ${dayNum} ${monthName} ${parts[0]}`;
}

export function createInitialCleanReport(numeroReport = 37): ServiceReportData {
  return {
    numeroReport,
    luogo: TESTO_FISSO_LUOGO,
    riferimentiCO: TESTO_FISSO_RIFERIMENTI_EMERGENZE,
    data: '',
    oraInizio: '',
    oraFine: '',
    orarioTestoLibero: '',
    orariServizio: [
      {
        id: 'slot-1',
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
    compilatore: '',
    squadra: DEFAULT_ROSTER.map((r) => ({
      id: r.id,
      nomeCognome: r.nomeCognome,
      nickname: r.nickname,
      qualifica: r.qualifica,
      orarioServizio: '',
      note: '',
      isCaposervizio: false,
      isCompilatore: false,
    })),
    personaleEsternoAffiancamento: '',
    rilevazioni: [
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
    ],
    richiesteEmergenzaCOPS: '',
    richiesteEmergenzaCOSEA: '',
    richiesteEmergenzaProntoSoccorsoMXP: '',
    richiesteEmergenza: '',
    richiesteNonUrgenti: '',
    note: '',
    osservazioni: '',
  };
}

export const SAMPLE_REPORT_DATA: ServiceReportData = createInitialCleanReport(37);
export const EMPTY_REPORT_DATA: ServiceReportData = createInitialCleanReport(37);
