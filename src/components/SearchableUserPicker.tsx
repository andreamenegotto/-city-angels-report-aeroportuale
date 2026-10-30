import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, User, Plus, Check, X, Users, ChevronDown, Sparkles } from 'lucide-react';
import { formatUserRegistryName } from '../utils/userRegistryData';

interface SearchableUserPickerProps {
  rilevazioneId: string;
  associatedUsers: string[];
  allUsers: string[];
  onToggleUser: (userName: string) => void;
  onAddUser: (userName: string) => void;
  onRemoveUser: (userName: string) => void;
  onCreateNewUser?: (userName: string) => void | Promise<void>;
  onNotice?: (msg: string) => void;
}

export const SearchableUserPicker: React.FC<SearchableUserPickerProps> = ({
  rilevazioneId,
  associatedUsers = [],
  allUsers = [],
  onAddUser,
  onRemoveUser,
  onCreateNewUser,
  onNotice,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Chiudi cliccando all'esterno se non è focusato
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Normalizza gli utenti associati
  const associatedSet = useMemo(() => {
    return new Set(
      (associatedUsers || [])
        .filter(Boolean)
        .map((u) => (u || '').trim().toLowerCase())
    );
  }, [associatedUsers]);

  // Filtra gli utenti in base alla ricerca o lettera iniziale
  const filteredUsers = useMemo(() => {
    let list = (allUsers || []).filter(Boolean);

    if (selectedLetter) {
      list = list.filter((name) => {
        const parts = (name || '').trim().split(/\s+/);
        // Controlla se la lettera corrisponde all'inizio del nome o del cognome
        return parts.some((p) => (p || '').toUpperCase().startsWith(selectedLetter));
      });
    }

    const q = (searchQuery || '').trim().toLowerCase();
    if (q) {
      list = list.filter((name) => (name || '').toLowerCase().includes(q));
    }

    return list;
  }, [allUsers, searchQuery, selectedLetter]);

  // Controlla se l'input attuale corrisponde a un utente già esistente
  const formattedInputName = useMemo(() => {
    return formatUserRegistryName(searchQuery || '');
  }, [searchQuery]);

  const exactMatchExists = useMemo(() => {
    if (!formattedInputName) return false;
    const lower = formattedInputName.toLowerCase();
    return (allUsers || []).some((u) => (u || '').toLowerCase() === lower);
  }, [allUsers, formattedInputName]);

  const handleSelectUser = (name: string) => {
    const cleanName = (name || '').trim();
    if (!cleanName) return;
    if (associatedSet.has(cleanName.toLowerCase())) {
      // Se già associato, rimuovilo
      onRemoveUser(cleanName);
      if (onNotice) onNotice(`Rimosso ${cleanName} dalla rilevazione.`);
    } else {
      // Altrimenti associalo
      onAddUser(cleanName);
      if (onNotice) onNotice(`Associato ${cleanName} alla rilevazione.`);
    }
  };

  const handleCreateAndAssociate = async () => {
    const clean = formatUserRegistryName(searchQuery || '');
    if (!clean || clean.length < 2) {
      if (onNotice) onNotice('Inserisci un nome o cognome valido (almeno 2 caratteri).');
      return;
    }

    if (onCreateNewUser) {
      await onCreateNewUser(clean);
    }
    onAddUser(clean);
    setSearchQuery('');
    setIsOpen(false);
    if (onNotice) onNotice(`Registrato e associato ${clean} con successo.`);
  };

  // Helper per evidenziare il testo cercato
  const highlightMatch = (text: string, query: string) => {
    const q = (query || '').trim();
    if (!q) return text || '';
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = (text || '').split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-slate-900 font-bold px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Tutte le lettere presenti per filtro rapido A-Z
  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    allUsers.forEach((name) => {
      const char = name.trim().charAt(0).toUpperCase();
      if (char >= 'A' && char <= 'Z') set.add(char);
    });
    return Array.from(set).sort();
  }, [allUsers]);

  return (
    <div ref={containerRef} className="space-y-2">
      {/* 1. TAG UTENTI ATTUALMENTE ASSOCIATI */}
      <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center p-2 bg-slate-50 border border-slate-200 rounded-md">
        {associatedUsers.length === 0 ? (
          <span className="text-[11px] text-slate-400 italic flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-300" />
            Nessun utente/soggetto associato a questa rilevazione. Cerca e seleziona dal registro qui sotto.
          </span>
        ) : (
          associatedUsers.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 bg-red-50 text-red-900 border border-red-200 text-xs px-2.5 py-1 rounded-full font-bold shadow-2xs group"
            >
              <User className="w-3 h-3 text-[#df0a14]" />
              <span>{name}</span>
              <button
                type="button"
                onClick={() => onRemoveUser(name)}
                className="text-red-400 hover:text-red-800 hover:bg-red-100 p-0.5 rounded-full cursor-pointer transition-colors"
                title={`Rimuovi ${name}`}
                aria-label={`Rimuovi ${name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {/* 2. AREA DI RICERCA LIVE UTENTI */}
      <div className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-2.5 pointer-events-none text-slate-400">
            <Search className="w-3.5 h-3.5 text-slate-400" />
          </div>

          <input
            ref={inputRef}
            id={`user-search-${rilevazioneId}`}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Cerca utente per nome o cognome nel registro (es. Rossi, Mario)..."
            className="w-full pl-8 pr-20 h-9 text-xs bg-white border border-slate-300 rounded-md font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
          />

          <div className="absolute right-1 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  if (inputRef.current) inputRef.current.focus();
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                title="Cancella ricerca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded flex items-center gap-1 cursor-pointer transition-colors"
              title="Apri/chiudi registro utenti"
            >
              <span>{isOpen ? 'Chiudi' : 'Sfoglia'}</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* 3. PANNELLO RISULTATI DI RICERCA INTERATTIVO (DIRETTO E RAPIDO) */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-300 rounded-lg shadow-xl overflow-hidden max-h-72 flex flex-col">
            {/* Intestazione del pannello con contatore e filtro alfabetico */}
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#df0a14]" />
                  <span>
                    {searchQuery.trim()
                      ? `Trovati ${filteredUsers.length} di ${allUsers.length} utenti`
                      : `Registro Utenti (${allUsers.length} totali)`}
                  </span>
                </span>
                <span className="text-[10px] text-slate-600 font-medium">
                  Clicca un nominativo per associarlo
                </span>
              </div>

              {/* Barra filtro alfabetico rapido */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setSelectedLetter(null)}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                    selectedLetter === null
                      ? 'bg-slate-800 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Tutti
                </button>
                {availableLetters.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
                    className={`px-1 py-0.5 text-[10px] font-semibold rounded cursor-pointer transition-colors min-w-[20px] text-center ${
                      selectedLetter === letter
                        ? 'bg-red-700 text-white font-bold'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>

            {/* Azione Aggiungi nuovo utente non presente nel registro */}
            {(searchQuery || '').trim().length >= 2 && !exactMatchExists && (
              <div className="p-2 bg-amber-50 border-b border-amber-200">
                <button
                  type="button"
                  onClick={handleCreateAndAssociate}
                  className="w-full text-left p-2 bg-white hover:bg-amber-100/60 border border-amber-300 rounded-md text-xs font-semibold text-amber-950 flex items-center justify-between cursor-pointer transition-colors shadow-2xs"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Plus className="w-4 h-4 text-amber-700 shrink-0" />
                    <span className="truncate">
                      Nuovo utente: <strong>&quot;{formattedInputName}&quot;</strong> (non presente)
                    </span>
                  </span>
                  <span className="text-[11px] font-bold text-white bg-amber-800 px-2 py-0.5 rounded shadow-2xs shrink-0 ml-2">
                    + Registra e Associa
                  </span>
                </button>
              </div>
            )}

            {/* Elenco dei nominativi con pulsanti di selezione diretta */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 p-1">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  <p>Nessun utente corrisponde a &quot;{searchQuery}&quot;.</p>
                  {(searchQuery || '').trim().length >= 2 && (
                    <p className="mt-1 text-[11px] text-amber-800 font-semibold">
                      Puoi registrarlo direttamente premendo il pulsante sopra!
                    </p>
                  )}
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isAssoc = associatedSet.has((user || '').trim().toLowerCase());

                  return (
                    <div
                      key={user}
                      onClick={() => handleSelectUser(user)}
                      className={`flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer text-xs ${
                        isAssoc
                          ? 'bg-red-50/80 hover:bg-red-100/70 border border-red-200'
                          : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            isAssoc
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {user.charAt(0).toUpperCase()}
                        </div>
                        <span className={`truncate ${isAssoc ? 'font-bold text-red-950' : 'font-medium'}`}>
                          {highlightMatch(user, searchQuery)}
                        </span>
                      </div>

                      <div className="shrink-0 ml-2 flex items-center gap-1.5">
                        {isAssoc ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded border border-red-300">
                            <Check className="w-3 h-3 text-red-700" />
                            <span>Associato</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectUser(user);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-white bg-slate-100 hover:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 hover:border-slate-900 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Associa</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
