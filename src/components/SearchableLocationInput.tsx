import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, MapPin, Plus, Check, X, ChevronDown } from 'lucide-react';

interface SearchableLocationInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  locations: string[];
  onAddNewLocation?: (newLoc: string) => void | Promise<void>;
  placeholder?: string;
  inputClassName?: string;
}

// Luoghi più frequenti / strategici all'aeroporto per selezione rapida istantanea a 1 click
const POPULAR_LOCATIONS = [
  'Porta 1 - Piano Arrivi',
  'Porta 2 - Vano CISL',
  'Porta 4 - Piano Arrivi',
  'Food Court - Piano Arrivi',
  'Stazione Ferroviaria / Fuori Stazione',
];

export const SearchableLocationInput: React.FC<SearchableLocationInputProps> = ({
  id,
  value = '',
  onChange,
  locations = [],
  onAddNewLocation,
  placeholder = 'Cerca o scrivi luogo (es. Porta 1, Vano CISL)...',
  inputClassName = 'h-9 text-xs',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value || '');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizza lo stato locale quando il valore esterno cambia
  useEffect(() => {
    setSearchQuery(value || '');
  }, [value]);

  // Chiudi cliccando fuori
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filtra i luoghi in base alla ricerca (case-insensitive)
  const filteredLocations = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    const safeLocs = (locations || []).filter(Boolean);
    if (!q) {
      return safeLocs;
    }
    return safeLocs.filter((loc) => (loc || '').toLowerCase().includes(q));
  }, [locations, searchQuery]);

  // Controlla se la query corrisponde esattamente a uno dei luoghi esistenti
  const exactMatchExists = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return true;
    return (locations || []).some((loc) => (loc || '').toLowerCase() === q);
  }, [locations, searchQuery]);

  const handleSelectLocation = (locName: string) => {
    const safe = locName || '';
    onChange(safe);
    setSearchQuery(safe);
    setIsOpen(false);
  };

  const handleCreateNewLocation = async () => {
    const clean = (searchQuery || '').trim();
    if (!clean || clean.length < 2) return;
    if (onAddNewLocation) {
      await onAddNewLocation(clean);
    }
    onChange(clean);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSearchQuery('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredLocations.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredLocations.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredLocations.length) {
        handleSelectLocation(filteredLocations[highlightedIndex]);
      } else if (!exactMatchExists && (searchQuery || '').trim().length >= 2) {
        handleCreateNewLocation();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Helper per evidenziare la stringa cercata
  const highlightMatch = (text: string, query: string) => {
    const q = (query || '').trim();
    if (!q) return text;
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
    <div ref={containerRef} className="relative w-full space-y-1.5">
      {/* Campo di ricerca / selezione */}
      <div className="relative flex items-center">
        <div className="absolute left-2.5 pointer-events-none text-slate-400">
          <Search className="w-3.5 h-3.5" />
        </div>

        <input
          id={id}
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            const nextVal = e.target.value;
            setSearchQuery(nextVal);
            onChange(nextVal);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full pl-8 pr-16 bg-white border border-slate-300 rounded-md font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 ${inputClassName}`}
        />

        <div className="absolute right-1 flex items-center gap-0.5">
          {searchQuery && (
            <button
              type="button"
              onClick={handleClear}
              title="Cancella luogo"
              aria-label="Cancella luogo"
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              if (!isOpen && inputRef.current) {
                inputRef.current.focus();
              }
            }}
            title={isOpen ? 'Chiudi elenco luoghi' : 'Mostra tutti i luoghi'}
            aria-label="Mostra tutti i luoghi"
            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${
                isOpen ? 'rotate-180 text-slate-900' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Suggerimenti rapidi / chip frequenti */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] text-slate-600 font-medium mr-0.5">Rapidi:</span>
        {POPULAR_LOCATIONS.map((popLoc) => {
          const isSelected = value.trim().toLowerCase() === popLoc.toLowerCase();
          return (
            <button
              key={popLoc}
              type="button"
              onClick={() => handleSelectLocation(popLoc)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-all cursor-pointer font-medium border ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-2xs'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:border-slate-300'
              }`}
              title={`Imposta "${popLoc}"`}
            >
              {isSelected ? '✓ ' : ''}{popLoc}
            </button>
          );
        })}
      </div>

      {/* Menu a tendina dei risultati di ricerca */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-300 rounded-md shadow-xl overflow-hidden max-h-64 flex flex-col">
          {/* Barra riassunto contatore */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#df0a14]" />
              <span>
                {searchQuery.trim()
                  ? `Risultati: ${filteredLocations.length} di ${locations.length} luoghi`
                  : `Tutti i luoghi disponibili (${locations.length})`}
              </span>
            </span>
            <span className="text-[10px] text-slate-600 font-normal">
              Fai click per selezionare
            </span>
          </div>

          {/* Opzione aggiunta nuovo luogo se digitato e non presente */}
          {!exactMatchExists && (searchQuery || '').trim().length >= 2 && (
            <div className="p-1.5 bg-amber-50/70 border-b border-amber-200">
              <button
                type="button"
                onClick={handleCreateNewLocation}
                className="w-full text-left px-2.5 py-1.5 text-xs text-amber-900 bg-amber-100/70 hover:bg-amber-200/80 rounded font-semibold flex items-center justify-between cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Plus className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                  <span>
                    Aggiungi nuovo luogo: <strong className="font-bold text-amber-950">&quot;{(searchQuery || '').trim()}&quot;</strong>
                  </span>
                </span>
                <span className="text-[10px] uppercase font-bold text-amber-800 bg-white px-1.5 py-0.5 rounded border border-amber-300 shrink-0 ml-2">
                  + Salva
                </span>
              </button>
            </div>
          )}

          {/* Elenco dei luoghi filtrati */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {filteredLocations.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                Nessun luogo trovato per &quot;{searchQuery}&quot;.
                <div className="mt-1 text-[11px] text-slate-400">
                  Usa il pulsante sopra per salvarlo come nuovo luogo monitorato.
                </div>
              </div>
            ) : (
              filteredLocations.map((loc, idx) => {
                const isSelected =
                  (value || '').trim().toLowerCase() === (loc || '').trim().toLowerCase();
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={`${loc}-${idx}`}
                    type="button"
                    onClick={() => handleSelectLocation(loc)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-slate-900 text-white font-semibold'
                        : isHighlighted
                        ? 'bg-slate-100 text-slate-900 font-medium'
                        : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <MapPin
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-red-400' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">
                        {highlightMatch(loc, searchQuery)}
                      </span>
                    </span>

                    {isSelected ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-white shrink-0 ml-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Selezionato</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 group-hover:text-slate-700 shrink-0 ml-2">
                        Seleziona
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
