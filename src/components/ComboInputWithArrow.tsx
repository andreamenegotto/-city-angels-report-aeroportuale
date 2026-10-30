import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ComboInputWithArrowProps {
  id?: string;
  value: string;
  onChange: (newValue: string) => void;
  options: string[];
  placeholder?: string;
  inputClassName?: string;
}

export const ComboInputWithArrow: React.FC<ComboInputWithArrowProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = '',
  inputClassName = 'h-10 text-sm',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [open]);

  // Filtra opzioni in base al testo digitato se presente
  const filteredOptions = React.useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) return options;
    const matches = options.filter((opt) => opt.toLowerCase().includes(q));
    return matches.length > 0 ? matches : options;
  }, [options, value]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full pr-9 pl-3 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 ${inputClassName}`}
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          title="Mostra elenco opzioni"
          aria-label="Mostra elenco opzioni"
          className="absolute right-1 top-1 bottom-1 px-2 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-150 ${
              open ? 'rotate-180 text-slate-900' : ''
            }`}
          />
        </button>
      </div>

      {open && filteredOptions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto bg-white border border-slate-300 rounded-md shadow-lg py-1 divide-y divide-slate-100">
          {filteredOptions.map((opt) => {
            const isSelected =
              value.trim().toLowerCase() === opt.trim().toLowerCase();
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-800 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">{opt}</span>
                {isSelected && (
                  <span className="text-[11px] font-mono-tabular ml-2 shrink-0">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
