import React, { useState, useMemo } from 'react';
import { Search, MapPin, User, Plus, Check, ChevronDown, ChevronUp, Sparkles, Filter } from 'lucide-react';
import { RilevazioneItem, indexToAlpha } from '../types/report';

interface CompilationQuickSearchToolbarProps {
  locations: string[];
  users: string[];
  rilevazioni: RilevazioneItem[];
  onAddNewRilevazioneWithLocation: (locationName: string) => void;
  onAddNewRilevazioneWithUser: (userName: string) => void;
  onSetLocationToRilevazione: (rilId: string, locationName: string) => void;
  onAddUserToRilevazione: (rilId: string, userName: string) => void;
  onNotice: (msg: string) => void;
}

export const CompilationQuickSearchToolbar: React.FC<CompilationQuickSearchToolbarProps> = ({
  locations,
  users,
  rilevazioni,
  onAddNewRilevazioneWithLocation,
  onAddNewRilevazioneWithUser,
  onSetLocationToRilevazione,
  onAddUserToRilevazione,
  onNotice,
}) => {
  const [activeTab, setActiveTab] = useState<'locations' | 'users'>('locations');
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(true);

  // Filtra i luoghi
  const filteredLocations = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    const safeLocs = (locations || []).filter(Boolean);
    if (!q) return safeLocs.slice(0, 8); // Mostra primi 8 se vuoto
    return safeLocs.filter((loc) => (loc || '').toLowerCase().includes(q));
  }, [locations, searchQuery]);

  // Filtra gli utenti
  const filteredUsers = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    const safeUsers = (users || []).filter(Boolean);
    if (!q) return safeUsers.slice(0, 8); // Mostra primi 8 se vuoto
    return safeUsers.filter((u) => (u || '').toLowerCase().includes(q));
  }, [users, searchQuery]);

  // Helper per evidenziare la stringa cercata
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

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-lg p-3 sm:p-4 shadow-md border border-slate-700/80 mb-4 transition-all">
      {/* Intestazione Barra di Ricerca Rapida */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-red-600/90 rounded-md text-white shadow-2xs">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold tracking-wide flex items-center gap-2">
              <span>Ricerca Rapida Luoghi & Utenti in Compilazione</span>
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-red-500/30 text-red-200 border border-red-500/40">
                Selezione Diretta
              </span>
            </h3>
            <p className="text-[11px] text-slate-300">
              Digita per trovare immediatamente luoghi o persone e associarli o creare un nuovo punto con 1 click.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="self-end sm:self-auto text-xs text-slate-300 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 cursor-pointer transition-colors"
        >
          <span>{isOpen ? 'Comprimi' : 'Espandi area ricerca'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-3">
          {/* Switcher Tab: Luoghi vs Utenti */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setActiveTab('locations');
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'locations'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Cerca Luoghi ({locations.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('users');
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Cerca Utenti / Soggetti ({users.length})</span>
            </button>

            <span className="text-[10px] text-slate-400 ml-auto hidden md:inline">
              {rilevazioni.length} punti di servizio attualmente aperti
            </span>
          </div>

          {/* Campo di ricerca con input in tempo reale */}
          <div className="relative">
            <div className="absolute left-3 top-2.5 pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'locations'
                  ? 'Digita nome luogo o varco (es. Porta 1, CISL, Food Court, Caroselli, Stazione)...'
                  : 'Digita nome o cognome utente (es. Rossi, Mario, Alex, Deyanova)...'
              }
              className="w-full pl-9 pr-9 h-9 text-xs bg-slate-950/80 border border-slate-600 rounded-md text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                title="Cancella ricerca"
              >
                ✕
              </button>
            )}
          </div>

          {/* Griglia / Risultati di Ricerca con selezione diretta */}
          <div className="bg-slate-950/60 border border-slate-700/60 rounded-md p-2.5 max-h-56 overflow-y-auto space-y-1.5">
            {activeTab === 'locations' ? (
              /* RISULTATI RICERCA LUOGHI */
              filteredLocations.length === 0 ? (
                <div className="text-center py-3 text-xs text-slate-400">
                  Nessun luogo trovato per &quot;{searchQuery}&quot;.
                </div>
              ) : (
                filteredLocations.map((loc) => (
                  <div
                    key={loc}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        {highlightMatch(loc, searchQuery)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      {/* Assegna a punti esistenti (solo inserimento) */}
                      {(rilevazioni || []).map((ril, rIdx) => {
                        const alpha = indexToAlpha(rIdx);
                        const isAlready =
                          (ril.luogoIndividuazione || '').trim().toLowerCase() ===
                          (loc || '').trim().toLowerCase();

                        return (
                          <button
                            key={ril.id}
                            type="button"
                            onClick={() => {
                              onSetLocationToRilevazione(ril.id, loc);
                              onNotice(`Luogo "${loc}" impostato per il Punto ${alpha}.`);
                            }}
                            className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition-colors cursor-pointer border ${
                              isAlready
                                ? 'bg-emerald-800 text-emerald-100 border-emerald-600 hover:bg-emerald-700'
                                : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600'
                            }`}
                            title={`Imposta come luogo del Punto ${alpha}`}
                          >
                            {isAlready ? `✓ Punto ${alpha}` : `Punto ${alpha}`}
                          </button>
                        );
                      })}

                      {/* Crea nuovo punto */}
                      <button
                        type="button"
                        onClick={() => {
                          onAddNewRilevazioneWithLocation(loc);
                          onNotice(`Creato nuovo punto in "${loc}".`);
                        }}
                        className="px-2 py-0.5 text-[10px] rounded font-bold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 cursor-pointer transition-colors"
                        title="Crea una nuova rilevazione con questo luogo già preimpostato"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nuovo Punto</span>
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : (
              /* RISULTATI RICERCA UTENTI */
              filteredUsers.length === 0 ? (
                <div className="text-center py-3 text-xs text-slate-400">
                  Nessun utente trovato per &quot;{searchQuery}&quot;.
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-5 h-5 rounded-full bg-red-800/80 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {user.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        {highlightMatch(user, searchQuery)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      {/* Associa a punti esistenti (solo inserimento) */}
                      {(rilevazioni || []).map((ril, rIdx) => {
                        const alpha = indexToAlpha(rIdx);
                        const isAssoc = (ril.nominativiAssociati || []).some(
                          (n) => (n || '').trim().toLowerCase() === (user || '').trim().toLowerCase()
                        );

                        return (
                          <button
                            key={ril.id}
                            type="button"
                            onClick={() => {
                              if (isAssoc) {
                                onNotice(`${user} è già associato al Punto ${alpha}.`);
                              } else {
                                onAddUserToRilevazione(ril.id, user);
                                onNotice(`Associato ${user} al Punto ${alpha}.`);
                              }
                            }}
                            className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition-colors cursor-pointer border ${
                              isAssoc
                                ? 'bg-emerald-800 text-emerald-100 border-emerald-600'
                                : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600'
                            }`}
                            title={isAssoc ? `Già associato al Punto ${alpha}` : `Associa al Punto ${alpha}`}
                          >
                            {isAssoc ? `✓ Punto ${alpha}` : `+ Punto ${alpha}`}
                          </button>
                        );
                      })}

                      {/* Crea nuovo punto con questo utente */}
                      <button
                        type="button"
                        onClick={() => {
                          onAddNewRilevazioneWithUser(user);
                          onNotice(`Creato nuovo punto con ${user}.`);
                        }}
                        className="px-2 py-0.5 text-[10px] rounded font-bold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 cursor-pointer transition-colors"
                        title="Crea una nuova rilevazione con questo utente già associato"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nuovo Punto</span>
                      </button>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
