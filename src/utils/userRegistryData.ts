export interface RegisteredUser {
  id: string;
  nomeCognome: string;
}

/**
 * Capitalizza la prima lettera di una parola e trasforma le altre in minuscolo.
 * Es: "mario" -> "Mario", "ALEX" -> "Alex"
 */
function capitalizeWord(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Formatta il nominativo utente garantendo:
 * - Solo il/i cognomi in MAIUSCOLO
 * - Il nome/i con l'iniziale MAIUSCOLA e il resto in minuscolo
 * Es: "Mario ROSSI", "Abdel MOUTAWAKIL", "Nedka Petrova DEYANOVA", "Claudio DI CRISTO", "Alex", "Marco B."
 */
export function formatUserRegistryName(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.length < 2) return trimmed;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    // Singolo nome (senza cognome) -> iniziale maiuscola
    return capitalizeWord(parts[0]);
  }

  // Particelle tipiche per cognomi composti (es: "DI CRISTO", "DE ROSA", "DEL PONTE")
  const particles = ['di', 'de', 'del', 'della', 'dello', 'degli', 'da', 'san', 'mc', 'von', 'van', 'lo', 'la'];

  // Se la penultima parola è una particella (es: "Claudio di Cristo" -> nome: "Claudio", cognome: "DI CRISTO")
  if (parts.length >= 3 && particles.includes(parts[parts.length - 2].toLowerCase())) {
    const nome = parts.slice(0, parts.length - 2).map(capitalizeWord).join(' ');
    const cognome = parts.slice(parts.length - 2).join(' ').toUpperCase();
    return `${nome} ${cognome}`;
  }

  // Ultima parola considerata cognome, precedenti considerate nome
  const nome = parts.slice(0, parts.length - 1).map(capitalizeWord).join(' ');
  const cognome = parts[parts.length - 1].toUpperCase();
  return `${nome} ${cognome}`;
}

export const USER_REGISTRY: RegisteredUser[] = [
  { id: 'reg-01', nomeCognome: 'Abdel MOUTAWAKIL' },
  { id: 'reg-02', nomeCognome: 'Alessandro TURSI' },
  { id: 'reg-03', nomeCognome: 'Alex' },
  { id: 'reg-04', nomeCognome: 'Alexio MASSIMINO' },
  { id: 'reg-05', nomeCognome: 'Alì MOHAMED' },
  { id: 'reg-06', nomeCognome: 'Arianna' },
  { id: 'reg-07', nomeCognome: 'Carla MENEGATTI' },
  { id: 'reg-08', nomeCognome: 'Carlo BLASICH' },
  { id: 'reg-09', nomeCognome: 'Caterina' },
  { id: 'reg-10', nomeCognome: 'Chiara RUSSO' },
  { id: 'reg-11', nomeCognome: 'Claudio DI CRISTO' },
  { id: 'reg-12', nomeCognome: 'Domenico CARLUCCI' },
  { id: 'reg-13', nomeCognome: 'Domenico RICHICHI' },
  { id: 'reg-14', nomeCognome: 'Eugenio' },
  { id: 'reg-15', nomeCognome: 'Eugenio BARBETTA' },
  { id: 'reg-16', nomeCognome: 'Fabrizio MAMONE' },
  { id: 'reg-17', nomeCognome: 'Fabio GRIFA' },
  { id: 'reg-18', nomeCognome: 'Fabio PALMULLI' },
  { id: 'reg-19', nomeCognome: 'Federico' },
  { id: 'reg-20', nomeCognome: 'Francesca TROIA' },
  { id: 'reg-21', nomeCognome: 'Francesco DENTALI' },
  { id: 'reg-22', nomeCognome: 'Francis OTIENO' },
  { id: 'reg-23', nomeCognome: 'Franco RONDINA' },
  { id: 'reg-24', nomeCognome: 'Fued' },
  { id: 'reg-25', nomeCognome: 'Gabriel' },
  { id: 'reg-26', nomeCognome: 'Gaetano ARGIOLAS' },
  { id: 'reg-27', nomeCognome: 'Giovanna' },
  { id: 'reg-28', nomeCognome: 'Giuseppe PAPALIA' },
  { id: 'reg-29', nomeCognome: 'Hisham' },
  { id: 'reg-30', nomeCognome: 'Lorenzo LOMAGISTRO' },
  { id: 'reg-31', nomeCognome: 'Luca' },
  { id: 'reg-32', nomeCognome: 'Luciano TOSCANO' },
  { id: 'reg-33', nomeCognome: 'Manuela BARBAGLIA' },
  { id: 'reg-34', nomeCognome: 'Marco' },
  { id: 'reg-35', nomeCognome: 'Marco B.' },
  { id: 'reg-36', nomeCognome: 'Massimo MILANI' },
  { id: 'reg-37', nomeCognome: 'Ned' },
  { id: 'reg-38', nomeCognome: 'Nedka Petrova DEYANOVA' },
  { id: 'reg-39', nomeCognome: 'Paola Ester' },
  { id: 'reg-40', nomeCognome: 'Pasquale' },
  { id: 'reg-41', nomeCognome: 'Patrick' },
  { id: 'reg-42', nomeCognome: 'Pellegrino ZAMPELLI' },
  { id: 'reg-43', nomeCognome: 'Peter TICHY' },
  { id: 'reg-44', nomeCognome: 'Raffaele COZZOLINO' },
  { id: 'reg-45', nomeCognome: 'Rino' },
  { id: 'reg-46', nomeCognome: 'Roberto BASINOTTI' },
  { id: 'reg-47', nomeCognome: 'Robinson SALCUDEAN' },
  { id: 'reg-48', nomeCognome: 'Salvatore' },
  { id: 'reg-49', nomeCognome: 'Sara' },
  { id: 'reg-50', nomeCognome: 'Sergio' },
  { id: 'reg-51', nomeCognome: 'Simona' },
  { id: 'reg-52', nomeCognome: 'Tiziano BOGNI' },
  { id: 'reg-53', nomeCognome: 'Tony' },
  { id: 'reg-54', nomeCognome: 'Zaccaria' }
];

export const KNOWN_LOCATIONS: string[] = [
  'Vano CISL',
  'Area Partenze',
  'Area Arrivi',
  'Parcheggio P1',
  'Parcheggio P2',
  'Terminal 1',
  'Terminal 2'
];
