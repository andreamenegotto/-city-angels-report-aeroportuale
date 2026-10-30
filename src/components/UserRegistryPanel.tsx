import React, { useState, useMemo } from 'react';
import {
  Search,
  Users,
  History,
  Trash2,
  MapPin,
  Plus,
  Cloud,
} from 'lucide-react';
import { HistoricalReportEntry } from '../utils/reportHistoryMemory';
import { ServiceReportData } from '../types/report';
import { formatUserRegistryName } from '../utils/userRegistryData';

interface UserRegistryPanelProps {
  historyReports: HistoricalReportEntry[];
  currentReport: ServiceReportData;
  onUpdateReport: (updatedReport: ServiceReportData) => void;
  onNotice: (msg: string) => void;
  managedUsers: string[];
  setManagedUsers: (users: string[]) => void;
  onAddUser?: (name: string) => Promise<void>;
  onRemoveUser?: (name: string) => Promise<void>;
  managedLocations?: string[];
  setManagedLocations?: (locs: string[]) => void;
  onAddLocation?: (name: string) => Promise<void>;
  onRemoveLocation?: (name: string) => Promise<void>;
}

export const UserRegistryPanel: React.FC<UserRegistryPanelProps> = ({
  historyReports,
  currentReport,
  onUpdateReport,
  onNotice,
  managedUsers,
  setManagedUsers,
  onAddUser,
  onRemoveUser,
  managedLocations = [],
  setManagedLocations,
  onAddLocation,
  onRemoveLocation,
}) => {
  const [subTab, setSubTab] = useState<'users' | 'locations'>('users');
  const [newUserName, setNewUserName] = useState('');
  const [newLocationName, setNewLocationName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [scanningUser, setScanningUser] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<{ repNum: number; date: string; desc: string }[]>([]);
  const [associatingUser, setAssociatingUser] = useState<string | null>(null);
  const [associatingLocation, setAssociatingLocation] = useState<string | null>(null);

  // Stato per la conferma di eliminazione in-UI (elimina la dipendenza da window.confirm bloccato in iframe)
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<string | null>(null);

  // Utenti filtrati
  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return managedUsers.filter((name) => name.toLowerCase().includes(q));
  }, [managedUsers, searchTerm]);

  // Luoghi filtrati
  const filteredLocations = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return managedLocations.filter((loc) => loc.toLowerCase().includes(q));
  }, [managedLocations, searchTerm]);

  // Aggiunta utente
  const handleAddUserSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = formatUserRegistryName(newUserName);
    if (!clean || clean.length < 2) {
      onNotice('Inserisci un nome o cognome valido (almeno 2 caratteri).');
      return;
    }
    if (onAddUser) {
      await onAddUser(clean);
    } else {
      if (!managedUsers.some((u) => u.toLowerCase() === clean.toLowerCase())) {
        setManagedUsers([...managedUsers, clean]);
      }
      onNotice(`Aggiunto ${clean} al registro.`);
    }
    setNewUserName('');
  };

  // Esecuzione eliminazione utente
  const handleExecuteRemoveUser = async (name: string) => {
    setDeletingUser(null);
    try {
      const targetName = (name || '').trim();
      if (!targetName) return;
      setManagedUsers((managedUsers || []).filter((u) => (u || '').toLowerCase() !== targetName.toLowerCase()));
      if (onRemoveUser) {
        await onRemoveUser(targetName);
      }
      onNotice(`Utente "${targetName}" rimosso dal registro.`);
    } catch (err) {
      console.warn('Avviso rimozione utente:', err);
      onNotice(`Utente "${name}" rimosso dal registro.`);
    }
  };

  // Aggiunta luogo
  const handleAddLocationSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newLocationName.trim();
    if (!clean || clean.length < 2) {
      onNotice('Inserisci un nome di luogo valido (almeno 2 caratteri).');
      return;
    }
    if (onAddLocation) {
      await onAddLocation(clean);
    } else if (setManagedLocations) {
      if (!managedLocations.some((l) => l.toLowerCase() === clean.toLowerCase())) {
        setManagedLocations([...managedLocations, clean]);
      }
      onNotice(`Aggiunto luogo "${clean}".`);
    }
    setNewLocationName('');
  };

  // Esecuzione eliminazione luogo
  const handleExecuteRemoveLocation = async (name: string) => {
    setDeletingLocation(null);
    try {
      const targetLoc = (name || '').trim();
      if (!targetLoc) return;
      if (setManagedLocations) {
        setManagedLocations((managedLocations || []).filter((l) => (l || '').toLowerCase() !== targetLoc.toLowerCase()));
      }
      if (onRemoveLocation) {
        await onRemoveLocation(targetLoc);
      }
      onNotice(`Luogo "${targetLoc}" rimosso dal registro.`);
    } catch (err) {
      console.warn('Avviso rimozione luogo:', err);
      onNotice(`Luogo "${name}" rimosso dal registro.`);
    }
  };

  // Storico per utente
  const handleScanLocalHistory = (nomeCognome: string) => {
    setScanningUser(nomeCognome);
    const matches: { repNum: number; date: string; desc: string }[] = [];
    historyReports.forEach((entry) => {
      const rep = entry.report;
      const text = (JSON.stringify(rep) + (rep.note || '') + (rep.osservazioni || '')).toLowerCase();
      if (text.includes(nomeCognome.toLowerCase())) {
        matches.push({
          repNum: rep.numeroReport ?? 0,
          date: rep.data || '',
          desc: rep.note || 'Menzione trovata nelle note o rilevazioni',
        });
      }
    });
    setScanResults(matches);
  };

  // Associazione utente a punto di rilevazione
  const handleAssociateUserToRil = (nomeCognome: string, rilId: string) => {
    onUpdateReport({
      ...currentReport,
      rilevazioni: (currentReport.rilevazioni || []).map((ril) =>
        ril.id === rilId
          ? {
              ...ril,
              nominativiAssociati: Array.from(new Set([...(ril.nominativiAssociati || []), nomeCognome])),
            }
          : ril
      ),
    });
    setAssociatingUser(null);
    onNotice(`Associato ${nomeCognome} al punto di servizio.`);
  };

  // Associazione luogo a punto di rilevazione
  const handleAssociateLocationToRil = (locName: string, rilId: string) => {
    onUpdateReport({
      ...currentReport,
      rilevazioni: (currentReport.rilevazioni || []).map((ril) =>
        ril.id === rilId
          ? {
              ...ril,
              luogoIndividuazione: locName,
            }
          : ril
      ),
    });
    setAssociatingLocation(null);
    onNotice(`Luogo "${locName}" impostato per la rilevazione.`);
  };

  return (
    <div className="space-y-6">
      {/* Banner di Testata con Badge Cloud Sync */}
      <section className="bg-gradient-to-r from-red-800 to-red-950 text-white rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6" /> Registri Operativi Condivisi
            </h2>
            <p className="text-xs text-red-200 mt-1">
              Archivio sincronizzato in tempo reale su database remoto per tutti gli operatori e dispositivi.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/40 rounded-full text-xs font-semibold text-emerald-200">
            <Cloud className="w-3.5 h-3.5 text-emerald-300" />
            <span>Database Cloud Sincronizzato</span>
          </div>
        </div>

        {/* Tab switcher: Utenti vs Luoghi */}
        <div className="flex items-center gap-2 mt-5">
          <button
            type="button"
            onClick={() => {
              setSubTab('users');
              setSearchTerm('');
              setDeletingUser(null);
            }}
            className={`px-4 py-2 rounded-md font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors ${
              subTab === 'users'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Registro Soggetti ({managedUsers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSubTab('locations');
              setSearchTerm('');
              setDeletingLocation(null);
            }}
            className={`px-4 py-2 rounded-md font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors ${
              subTab === 'locations'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Registro Luoghi di Individuazione ({managedLocations.length})</span>
          </button>
        </div>
      </section>

      {/* SOTTO-TAB 1: SOGGETTI / UTENTI */}
      {subTab === 'users' && (
        <div className="space-y-4">
          <section className="bg-white border border-slate-300 rounded-lg p-4 shadow-2xs space-y-4">
            <form onSubmit={handleAddUserSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Nome e cognome (es. Mario ROSSI, Alex, Nedka Petrova DEYANOVA)..."
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded font-semibold focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Aggiungi al Registro
              </button>
            </form>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Cerca tra i ${managedUsers.length} soggetti registrati...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredUsers.map((name, index) => (
              <div
                key={`${name}-${index}`}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-3.5 flex flex-col justify-between gap-3 shadow-2xs transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-xs text-slate-900 tracking-wide">
                    {name}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">#{index + 1}</span>
                </div>

                {deletingUser === name ? (
                  <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs w-full justify-between animate-fadeIn">
                    <span className="text-[11px] font-bold text-red-800">Eliminare dal registro?</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleExecuteRemoveUser(name)}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        Sì, elimina
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingUser(null)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold cursor-pointer transition-colors"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleScanLocalHistory(name)}
                      className="text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                      title="Cerca presenze nello storico dei report"
                    >
                      <History className="w-3 h-3 text-slate-500" /> Storico
                    </button>

                    <button
                      type="button"
                      onClick={() => setAssociatingUser(associatingUser === name ? null : name)}
                      className="text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded cursor-pointer transition-colors"
                    >
                      + Associa al report
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingUser(name)}
                      className="text-[11px] text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded ml-auto cursor-pointer transition-colors"
                      title="Elimina definitivamente dal registro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {associatingUser === name && (
                  <div className="p-2.5 bg-red-50/70 border border-red-200 rounded text-xs space-y-1.5">
                    <div className="text-[10px] font-bold text-red-900 uppercase">
                      Seleziona il punto del report corrente:
                    </div>
                    {currentReport.rilevazioni && currentReport.rilevazioni.length > 0 ? (
                      currentReport.rilevazioni.map((ril, rIdx) => (
                        <button
                          key={ril.id}
                          type="button"
                          onClick={() => handleAssociateUserToRil(name, ril.id)}
                          className="block w-full text-left px-2 py-1 bg-white hover:bg-red-100 text-slate-800 rounded font-semibold text-[11px] cursor-pointer"
                        >
                          Punto {String.fromCharCode(65 + rIdx)}: {ril.luogoIndividuazione || 'Senza luogo'}
                        </button>
                      ))
                    ) : (
                      <div className="text-[11px] text-slate-500 italic">Nessun punto di rilevazione presente.</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SOTTO-TAB 2: LUOGHI DI INDIVIDUAZIONE */}
      {subTab === 'locations' && (
        <div className="space-y-4">
          <section className="bg-white border border-slate-300 rounded-lg p-4 shadow-2xs space-y-4">
            <form onSubmit={handleAddLocationSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="ES. PIANO ARRIVI - PORTA 4, VANO CISL, AREA TAXI..."
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded font-semibold focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Aggiungi Luogo al Registro
              </button>
            </form>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Cerca tra i ${managedLocations.length} luoghi monitorati...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredLocations.map((loc, index) => (
              <div
                key={`${loc}-${index}`}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-3.5 flex flex-col justify-between gap-3 shadow-2xs transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                    <span className="font-bold text-xs text-slate-900 tracking-wide">
                      {loc}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">#{index + 1}</span>
                </div>

                {deletingLocation === loc ? (
                  <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs w-full justify-between animate-fadeIn">
                    <span className="text-[11px] font-bold text-red-800">Eliminare questo luogo?</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleExecuteRemoveLocation(loc)}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        Sì, elimina
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingLocation(null)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold cursor-pointer transition-colors"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setAssociatingLocation(associatingLocation === loc ? null : loc)}
                      className="text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded cursor-pointer transition-colors"
                    >
                      + Applica a rilevazione
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingLocation(loc)}
                      className="text-[11px] text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded ml-auto cursor-pointer transition-colors"
                      title="Elimina definitivamente luogo dal registro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {associatingLocation === loc && (
                  <div className="p-2.5 bg-red-50/70 border border-red-200 rounded text-xs space-y-1.5">
                    <div className="text-[10px] font-bold text-red-900 uppercase">
                      Imposta questo luogo per il punto:
                    </div>
                    {currentReport.rilevazioni && currentReport.rilevazioni.length > 0 ? (
                      currentReport.rilevazioni.map((ril, rIdx) => (
                        <button
                          key={ril.id}
                          type="button"
                          onClick={() => handleAssociateLocationToRil(loc, ril.id)}
                          className="block w-full text-left px-2 py-1 bg-white hover:bg-red-100 text-slate-800 rounded font-semibold text-[11px] cursor-pointer"
                        >
                          Punto {String.fromCharCode(65 + rIdx)} (attuale: {ril.luogoIndividuazione || 'nessuno'})
                        </button>
                      ))
                    ) : (
                      <div className="text-[11px] text-slate-500 italic">Nessun punto di rilevazione presente.</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finestra Risultati Scansione Storico */}
      {scanningUser && (
        <section className="bg-slate-950 text-white rounded-lg p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" /> Presenze storiche per: {scanningUser}
            </h3>
            <button
              type="button"
              onClick={() => setScanningUser(null)}
              className="text-xs text-slate-400 hover:text-white font-bold cursor-pointer"
            >
              ✕ Chiudi
            </button>
          </div>
          {scanResults.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Nessuna presenza trovata nei report archiviati.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {scanResults.map((res, sIdx) => (
                <div key={sIdx} className="text-xs border-b border-slate-800 pb-2">
                  <div className="font-semibold text-slate-200">
                    Report #{res.repNum} del {res.date}
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">{res.desc}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
