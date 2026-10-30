import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CorporateHeaderConfig,
  DEFAULT_ASSOCIAZIONE_CONFIG,
  DEFAULT_COOPERATIVA_CONFIG,
  DEFAULT_ROSTER,
  RosterMember,
  ServiceReportData,
  TESTO_FISSO_LUOGO,
  TESTO_FISSO_LUOGO_INIZIO_BASE,
  TESTO_FISSO_LUOGO_TERMINE,
  TESTO_FISSO_RIFERIMENTI_EMERGENZE,
  alignSquadraToRosterOrder,
  formatDateExtendedIT,
  indexToAlpha,
} from '../types/report';
import { extractTaggedSubjectsFromText } from '../utils/reportHistoryMemory';
import { CityAngelsLogo } from './CityAngelsLogo';

interface A4PaginatedDocumentProps {
  report: ServiceReportData;
  corporate: CorporateHeaderConfig;
  totalSubjects: number;
  totalEngagements: number;
  onPageCountChange?: (count: number) => void;
  previewMode?: boolean;
  roster?: RosterMember[];
}

export const A4PaginatedDocument: React.FC<A4PaginatedDocumentProps> = ({
  report,
  corporate,
  totalSubjects,
  totalEngagements,
  onPageCountChange,
  previewMode = false,
  roster,
}) => {
  const measureContainerRef = useRef<HTMLDivElement>(null);
  const pageHeightRef = useRef<HTMLDivElement>(null);
  const firstHeaderRef = useRef<HTMLDivElement>(null);
  const subHeaderRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const [pages, setPages] = useState<number[][]>([[0]]);

  const presentTeam = useMemo(() => {
    const list = report.squadra || [];
    return alignSquadraToRosterOrder(list, roster && roster.length > 0 ? roster : DEFAULT_ROSTER);
  }, [report.squadra, roster]);

  const compilatoreDisplay = useMemo(() => {
    const checkedCompilatori = presentTeam
      .filter((m) => m.isCompilatore && m.nomeCognome.trim())
      .map((m) => m.nomeCognome.trim());
    if (checkedCompilatori.length > 0) {
      return checkedCompilatori.join(', ');
    }
    if (report.compilatore?.trim()) return report.compilatore.trim();
    return '';
  }, [report.compilatore, presentTeam]);

  const engagedPointsText = useMemo(() => {
    const pts: string[] = [];
    (report.rilevazioni || []).forEach((r, idx) => {
      if (r.aggancioEffettuato) {
        pts.push(`punto ${indexToAlpha(idx)}`);
      }
    });
    return pts.length > 0 ? `Cfr. ${pts.join('; ')}` : '';
  }, [report.rilevazioni]);

  const barrierLines = useMemo(() => {
    const entries = report.apertureSbarraInizio || [
      { ora: '', targa: '' },
      { ora: '', targa: '' },
    ];
    const valid = entries.filter((b) => b.ora.trim() || b.targa.trim());
    if (valid.length === 0) {
      return [
        `${TESTO_FISSO_LUOGO_INIZIO_BASE} (apertura sbarra ore _____ tramite lettura targa mezzo _________)`,
      ];
    }
    return valid.map(
      (b) =>
        `${TESTO_FISSO_LUOGO_INIZIO_BASE} (apertura sbarra ore ${
          b.ora.trim() || '_____'
        } tramite lettura targa mezzo ${b.targa.trim().toUpperCase() || '_________'})`
    );
  }, [report.apertureSbarraInizio]);

  const serviceSlots = useMemo(() => {
    if (report.orariServizio && report.orariServizio.length > 0) {
      const valid = report.orariServizio.filter(
        (s) => s.oraInizio?.trim() || s.oraFine?.trim() || s.descrizione?.trim()
      );
      if (valid.length > 0) return valid;
    }
    return [
      {
        id: 'slot-default',
        oraInizio: report.oraInizio || '',
        oraFine: report.oraFine || '',
        descrizione: report.orarioTestoLibero || '',
      },
    ];
  }, [report.orariServizio, report.oraInizio, report.oraFine, report.orarioTestoLibero]);

  const activeLogoUrl =
    corporate.logoUrl ||
    corporate.logoAssociazioneUrl ||
    corporate.logoCooperativaUrl ||
    '';

  const assoc = corporate.associazione || DEFAULT_ASSOCIAZIONE_CONFIG;
  const coop = corporate.cooperativa || DEFAULT_COOPERATIVA_CONFIG;

  const blocks = useMemo(() => {
    const items: { id: string; node: React.ReactNode }[] = [];

    // BLOCK 0: Main Header Table (REPORT DI SERVIZIO n. 36 + Compilato da / Firma + Luogo + Riferimenti + Data + Orario + Luogo inizio)
    items.push({
      id: 'block-main-info',
      node: (
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed border-collapse border border-slate-900 text-[10.5px] text-slate-900">
            <tbody>
              {/* Titolo REPORT DI SERVIZIO n. 36 */}
              <tr className="border-b border-slate-900">
                <td colSpan={3} className="py-2.5 px-3 text-center">
                  <span className="inline-block bg-slate-300/85 px-3 py-1 text-sm font-bold tracking-wide text-slate-900 uppercase">
                    REPORT DI SERVIZIO n. {report.numeroReport ?? 36}
                  </span>
                </td>
              </tr>

              {/* Compilato da / Firma */}
              <tr className="border-b border-slate-900">
                <td className="w-[54%] border-r border-slate-900 p-2 text-right align-middle font-medium">
                  Compilato da:
                </td>
                <td className="w-[23%] border-r border-slate-900 p-2 text-center align-middle italic font-semibold">
                  {compilatoreDisplay || '\u00A0'}
                </td>
                <td className="w-[23%] p-1.5 text-center align-top min-h-[50px]">
                  <div className="text-[8.5px] text-slate-700 mb-1">Firma:</div>
                  {report.firmaImmagineUrl ? (
                    <img
                      src={report.firmaImmagineUrl}
                      alt="Firma Compilatore"
                      className="max-h-10 mx-auto object-contain"
                    />
                  ) : (
                    <div className="h-8 flex items-center justify-center text-xs">
                      {/* Spazio vuoto predisposto per firma manuale autografa */}
                      &nbsp;
                    </div>
                  )}
                </td>
              </tr>

              {/* Luogo fisso */}
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-2 font-bold align-top">
                  Luogo:
                </td>
                <td colSpan={2} className="p-2 font-medium">
                  {TESTO_FISSO_LUOGO}
                </td>
              </tr>

              {/* Riferimenti emergenze fisso */}
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-2 font-bold align-top">
                  Riferimenti emergenze:
                </td>
                <td colSpan={2} className="p-2 text-[10px] leading-tight font-medium">
                  {TESTO_FISSO_RIFERIMENTI_EMERGENZE}
                </td>
              </tr>

              {/* Data del servizio */}
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-2 font-bold align-middle">
                  Data del servizio:
                </td>
                <td colSpan={2} className="p-2 align-middle">
                  <span className="inline-block bg-slate-300/85 px-3 py-1 text-sm font-bold tracking-wide text-slate-900 uppercase">
                    {report.data ? formatDateExtendedIT(report.data) : '—'}
                  </span>
                </td>
              </tr>

              {/* Orario del servizio (singolo o multiplo) */}
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-2 font-bold align-top">
                  {serviceSlots.length > 1
                    ? `Orari dei servizi (${serviceSlots.length}):`
                    : 'Orario del servizio:'}
                </td>
                <td colSpan={2} className="p-2">
                  {serviceSlots.length === 1 ? (
                    <div className="flex flex-wrap items-center gap-x-4">
                      <span>
                        dalle ore:{' '}
                        <strong>{serviceSlots[0].oraInizio || '—'}</strong>
                      </span>
                      <span>
                        alle ore:{' '}
                        <strong>{serviceSlots[0].oraFine || '—'}</strong>
                      </span>
                      {serviceSlots[0].descrizione && (
                        <span className="italic text-slate-700">
                          ({serviceSlots[0].descrizione})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {serviceSlots.map((slot, idx) => (
                        <div
                          key={slot.id || idx}
                          className="flex flex-wrap items-center gap-x-3 text-[10.5px]"
                        >
                          <span className="font-bold text-slate-900 bg-slate-200/90 px-1.5 py-0.5 rounded text-[9.5px]">
                            Servizio {idx + 1}:
                          </span>
                          <span>
                            dalle ore: <strong>{slot.oraInizio || '—'}</strong>
                          </span>
                          <span>
                            alle ore: <strong>{slot.oraFine || '—'}</strong>
                          </span>
                          {slot.descrizione && (
                            <span className="italic text-slate-700">
                              ({slot.descrizione})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>

              {/* Luogo inizio servizio (Parcheggio P1 con 2 registrazioni sbarra) */}
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-2 font-bold align-top">
                  Luogo inizio servizio:
                </td>
                <td colSpan={2} className="p-2 space-y-1">
                  {barrierLines.map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </td>
              </tr>

              {/* Luogo termine servizio fisso */}
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-2 font-bold align-top">
                  Luogo termine servizio:
                </td>
                <td colSpan={2} className="p-2">
                  {TESTO_FISSO_LUOGO_TERMINE}
                </td>
              </tr>

              {/* Comunicazione inizio servizio a CO PS */}
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-2 font-bold align-top">
                  Comunicazione inizio servizio a CO PS:
                </td>
                <td colSpan={2} className="p-2">
                  Effettuata, ore{' '}
                  <strong className="underline decoration-slate-400 underline-offset-2">
                    {report.comunicazioneInizioCO || '______'}
                  </strong>
                </td>
              </tr>

              {/* Comunicazione fine servizio a CO PS */}
              <tr>
                <td className="border-r border-slate-900 p-2 font-bold align-top">
                  Comunicazione fine servizio a CO PS:
                </td>
                <td colSpan={2} className="p-2">
                  Effettuata, ore{' '}
                  <strong className="underline decoration-slate-400 underline-offset-2">
                    {report.comunicazioneFineCO || '______'}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ),
    });

    // BLOCK 1: Squadra in Servizio Table
    items.push({
      id: 'block-squadra',
      node: (
        <div className="w-full overflow-hidden mt-3">
          <table className="w-full table-fixed border-collapse border border-slate-900 text-[10px] text-slate-900">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-900 font-bold">
                <th colSpan={5} className="py-1.5 px-2 text-left uppercase tracking-wider text-[11px]">
                  Squadra in Servizio
                </th>
              </tr>
              <tr className="border-b border-slate-900 bg-slate-50 text-[9.5px]">
                <th className="w-[8%] border-r border-slate-900 p-1.5 text-center font-bold">
                  N°
                </th>
                <th className="w-[30%] border-r border-slate-900 p-1.5 text-left font-bold">
                  Operatore (Nome e Cognome)
                </th>
                <th className="w-[42%] border-r border-slate-900 p-1.5 text-left font-bold">
                  Qualifica Ufficiale
                </th>
                <th className="w-[10%] border-r border-slate-900 p-1.5 text-center font-bold">
                  Caposerv.
                </th>
                <th className="w-[10%] p-1.5 text-center font-bold">
                  Compilat.
                </th>
              </tr>
            </thead>
            <tbody>
              {presentTeam.map((member, index) => {
                const displayName = member.nomeCognome?.trim()
                  ? `${member.nomeCognome.trim()}${
                      member.nickname?.trim() ? ` "${member.nickname.trim()}"` : ''
                    }`
                  : '';

                return (
                  <tr
                    key={member.id || index}
                    className="border-b border-slate-900 last:border-b-0 hover:bg-slate-50/50"
                  >
                    <td className="border-r border-slate-900 p-1.5 text-center font-semibold">
                      {index + 1}
                    </td>
                    <td className="border-r border-slate-900 p-1.5 font-medium">
                      {displayName || '\u00A0'}
                    </td>
                    <td className="border-r border-slate-900 p-1.5 text-[9px] leading-snug">
                      {member.qualifica || '\u00A0'}
                    </td>
                    <td className="border-r border-slate-900 p-1.5 text-center">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {member.isCaposervizio ? '[ X ]' : '[   ]'}
                      </span>
                    </td>
                    <td className="p-1.5 text-center">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {member.isCompilatore ? '[ X ]' : '[   ]'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Personale esterno in affiancamento */}
          <div className="border-x border-b border-slate-900 p-2 text-[10px] text-slate-900 bg-white">
            <span className="font-bold">Personale esterno in affiancamento: </span>
            <span className="italic">
              {report.personaleEsternoAffiancamento?.trim() ||
                'Nessuno //'}
            </span>
          </div>
        </div>
      ),
    });

    // BLOCK 2: Rilevazioni Header Divider
    items.push({
      id: 'block-rilevazioni-title',
      node: (
        <div className="w-full mt-4 mb-2 border-b-2 border-slate-900 pb-1 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Rilevazioni e interventi effettuati
          </h2>
          <span className="text-[10px] text-slate-600 italic">
            Elenco progressivo con luogo di individuazione ed esito
          </span>
        </div>
      ),
    });

    // Individual Rilevazioni
    const rils = report.rilevazioni || [];
    if (rils.length === 0) {
      items.push({
        id: 'block-ril-empty',
        node: (
          <div className="w-full mb-3 border border-dashed border-slate-400 p-2 text-center text-[9.5px] text-slate-500 italic bg-slate-50">
            Nessun punto di rilevazione registrato nel corso del servizio.
          </div>
        ),
      });
    } else {
      rils.forEach((ril, index) => {
        const alpha = indexToAlpha(index);
        const luogo = (ril.luogoIndividuazione || ril.areaTerminal || '').trim();
        const assocSubs = [
          ...(ril.nominativiAssociati || []),
          ...extractTaggedSubjectsFromText(ril.descrizione || ''),
        ];
        const uniqueAssocSubs = Array.from(new Set(assocSubs));

        items.push({
          id: `block-ril-${ril.id || index}`,
          node: (
            <div className="w-full mb-3 border border-slate-900 text-[10px] text-slate-900 overflow-hidden bg-white break-inside-avoid">
              {/* Header riga della rilevazione */}
              <div className="bg-slate-100 border-b border-slate-900 px-2.5 py-1.5 flex items-center justify-between font-bold">
                <div className="flex items-center gap-2">
                  <span className="bg-slate-900 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                    {alpha}
                  </span>
                  <span className="text-[11px]">
                    Luogo di individuazione:{' '}
                    <span className="underline decoration-slate-400 font-semibold">
                      {luogo || '—'}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[9.5px]">
                  <span>
                    Utenti: <strong>{ril.numeroUtenti ?? 0}</strong>
                  </span>
                  <span className="border-l border-slate-300 pl-2">
                    Colloquio/Aggancio:{' '}
                    <strong className={ril.aggancioEffettuato ? 'text-emerald-700' : 'text-slate-600'}>
                      {ril.aggancioEffettuato ? '[ Sì ]' : '[ No ]'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Nominativi associati */}
              {uniqueAssocSubs.length > 0 && (
                <div className="px-2.5 py-1 bg-amber-50/70 border-b border-slate-200 text-[9px] flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-amber-900">Soggetti/Nominativi individuati:</span>
                  {uniqueAssocSubs.map((sub, sIdx) => (
                    <span
                      key={sIdx}
                      className="inline-block bg-white border border-amber-300 px-1.5 py-0.5 rounded text-amber-900 font-medium"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              )}

              {/* Descrizione intervento */}
              <div className="p-2.5 whitespace-pre-wrap leading-relaxed text-[10px] min-h-[22px]">
                {ril.descrizione?.trim() || ''}
              </div>

              {/* Foto allegate - Fixed ratio container to prevent any clipping */}
              {ril.foto && ril.foto.length > 0 && (
                <div className="p-2 bg-slate-50 border-t border-slate-200">
                  <div className="text-[8.5px] font-bold text-slate-600 uppercase mb-1.5">
                    Foto documentarie punto {alpha}:
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {ril.foto.map((photo) => (
                      <div
                        key={photo.id}
                        className="border border-slate-300 rounded overflow-hidden bg-white shadow-xs"
                      >
                        <div className="aspect-[4/3] w-full overflow-hidden flex items-center justify-center bg-slate-100">
                          <img
                            src={photo.dataUrl}
                            alt={photo.name || `Foto punto ${alpha}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        {photo.name && (
                          <div className="p-1 text-[8px] text-slate-600 truncate text-center">
                            {photo.name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ),
        });
      });
    }

    // BLOCK 3: Final Summary Table (Totale soggetti, Richieste CO PS/CO SEA, Note, Osservazioni)
    items.push({
      id: 'block-final-summary',
      node: (
        <div className="w-full overflow-hidden mt-3">
          <table className="w-full table-fixed border-collapse border border-slate-900 text-[10px] text-slate-900">
            <tbody>
              {/* Totale soggetti individuati */}
              <tr className="border-b border-slate-900">
                <td className="w-[28%] border-r border-slate-900 p-2 font-bold align-top leading-snug">
                  Totale soggetti individuati nel corso del servizio:
                </td>
                <td colSpan={2} className="w-[72%] p-2 align-middle">
                  <div className="flex items-center gap-3">
                    <span className="border-2 border-slate-900 px-4 py-1 font-black text-3xl font-mono bg-amber-100/90 text-slate-950 shadow-xs inline-block rounded-xs">
                      {totalSubjects}
                    </span>
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      persone censite complessivamente
                    </span>
                  </div>
                </td>
              </tr>

              {/* Totale agganci */}
              <tr className="border-b border-slate-900">
                <td className="w-[28%] border-r border-slate-900 p-2 font-bold align-top leading-snug">
                  Totale agganci / colloqui:
                </td>
                <td colSpan={2} className="w-[72%] p-2 align-middle">
                  <div className="flex items-center gap-3">
                    <span className="border border-slate-900 px-3 py-0.5 font-bold text-sm bg-slate-100">
                      {totalEngagements}
                    </span>
                    {engagedPointsText && (
                      <span className="text-[9.5px] italic text-slate-700">
                        ({engagedPointsText})
                      </span>
                    )}
                  </div>
                </td>
              </tr>

              {/* Richieste emergenza CO PS / CO SEA / Pronto Soccorso MXP */}
              <tr className="border-b border-slate-900">
                <td
                  rowSpan={3}
                  className="w-[28%] border-r border-slate-900 p-2 font-bold align-top leading-snug"
                >
                  Richieste di intervento in emergenza – urgenza effettuate nel
                  corso del servizio:
                </td>
                <td className="w-[12%] border-r border-slate-900 p-1.5 align-top font-bold whitespace-nowrap text-center text-[10px]">
                  CO PS:
                </td>
                <td className="w-[60%] p-2 align-top whitespace-pre-wrap">
                  {report.richiesteEmergenzaCOPS?.trim() ||
                    report.richiesteEmergenza?.trim() ||
                    'Nessuna //'}
                </td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="w-[12%] border-r border-slate-900 p-1.5 align-top font-bold whitespace-nowrap text-center text-[10px]">
                  CO SEA:
                </td>
                <td className="w-[60%] p-2 align-top whitespace-pre-wrap">
                  {report.richiesteEmergenzaCOSEA?.trim() || 'Nessuna //'}
                </td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="w-[12%] border-r border-slate-900 p-1.5 align-top font-bold text-center text-[10px] leading-tight">
                  Pronto Soccorso e MXP:
                </td>
                <td className="w-[60%] p-2 align-top whitespace-pre-wrap">
                  {report.richiesteEmergenzaProntoSoccorsoMXP?.trim() || 'Nessuna //'}
                </td>
              </tr>

              {/* Richieste non urgenti */}
              <tr className="border-b border-slate-900">
                <td className="w-[28%] border-r border-slate-900 p-2 font-bold align-top leading-snug">
                  Richieste di intervento non urgenti:
                </td>
                <td colSpan={2} className="w-[72%] p-2 align-top whitespace-pre-wrap">
                  {report.richiesteNonUrgenti?.trim() || 'Nessuna //'}
                </td>
              </tr>

              {/* Note */}
              <tr className="border-b border-slate-900">
                <td className="w-[28%] border-r border-slate-900 p-2 font-bold align-top">
                  Note:
                </td>
                <td colSpan={2} className="w-[72%] p-2 align-top whitespace-pre-wrap">
                  {report.note?.trim() ? `• ${report.note.trim()}` : '//'}
                </td>
              </tr>

              {/* Osservazioni */}
              <tr>
                <td className="w-[28%] border-r border-slate-900 p-2 font-bold align-top">
                  Osservazioni:
                </td>
                <td colSpan={2} className="w-[72%] p-2 align-top whitespace-pre-wrap">
                  {report.osservazioni?.trim()
                    ? `• ${report.osservazioni.trim()}`
                    : '//'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ),
    });

    return items;
  }, [
    report,
    presentTeam,
    compilatoreDisplay,
    barrierLines,
    totalSubjects,
    totalEngagements,
    engagedPointsText,
  ]);

  // First Page Header: Exactly 1 single centered official logo + 2 distinct corporate entity columns
  const renderFirstPageHeader = () => (
    <div className="a4-doc-header pb-3 mb-2 w-full text-center shrink-0">
      {/* 1 SOLO LOGO AL CENTRO DELLA PAGINA FEDELE ALL'ORIGINALE SENZA BORDATURA ROSSA */}
      <div className="flex justify-center mb-2">
        <CityAngelsLogo customUrl={activeLogoUrl} size={92} />
      </div>

      {/* DUE BLOCCHI DI TESTO SEPARATI E DISTINTI PER LE RAGIONI SOCIALI */}
      <div className="pt-2 border-t border-slate-300 grid grid-cols-2 gap-4 text-left text-[8.5px] leading-snug text-slate-900">
        {/* COLONNA 1: ASSOCIAZIONE NAZIONALE */}
        <div className="border-r border-slate-200 pr-3">
          <div className="font-bold text-[9px] text-slate-900 mb-1 leading-snug whitespace-pre-line">
            {assoc.ragioneSociale}
          </div>
          <div>
            <span className="font-semibold">Tel. emergenze e info:</span>{' '}
            {assoc.telEmergenze}
          </div>
          <div>
            <span className="font-semibold">Email:</span>{' '}
            <span className="text-blue-800 underline">{assoc.email}</span>
          </div>
          <div>
            <span className="font-semibold">Sito internet:</span>{' '}
            <span className="text-blue-800 underline">{assoc.sitoWeb}</span>
          </div>
          {assoc.codiceFiscale?.trim() && (
            <div>
              <span className="font-semibold">C.F.:</span> {assoc.codiceFiscale}
            </div>
          )}
        </div>

        {/* COLONNA 2: COOPERATIVA SOCIALE */}
        <div className="pl-1">
          <div className="font-bold text-[9px] text-slate-900 mb-0.5">
            {coop.ragioneSociale}
          </div>
          <div className="text-[8px] text-slate-800">
            {coop.sedeLegale} · tel.: {coop.telefono}
          </div>
          <div className="text-[8px]">
            <span className="font-semibold">Email:</span>{' '}
            <span className="text-blue-800 underline">{coop.email}</span> ·{' '}
            <span className="font-semibold">PEC:</span>{' '}
            <span className="text-blue-800 underline">{coop.pec}</span>
          </div>
          <div className="text-[8px]">
            <span className="font-semibold">Sito:</span>{' '}
            <span className="text-blue-800 underline">{coop.sitoWeb}</span> ·{' '}
            <span className="font-semibold">C.F./P.IVA:</span> {coop.cfPiva}
          </div>
          <div className="text-[7.5px] text-slate-700 leading-tight mt-0.5">
            {coop.iscrizioniRegistri}
          </div>
        </div>
      </div>
    </div>
  );

  // Subsequent Pages Header: Only the compact circular logo centered on top
  const renderSubsequentPageHeader = () => (
    <div className="a4-doc-header pb-2 mb-2 flex justify-center w-full shrink-0">
      <CityAngelsLogo variant="compact" customUrl={activeLogoUrl} size={64} />
    </div>
  );

  const renderPageFooter = (pageNumber: number, totalPagesCount: number) => (
    <div className="a4-doc-footer pt-2 mt-2 text-center text-[10px] font-semibold text-slate-800 shrink-0 w-full">
      Pag. {pageNumber} di {totalPagesCount}
    </div>
  );

  // Dynamic Pagination Engine based on measured DOM heights
  useLayoutEffect(() => {
    if (!measureContainerRef.current || !pageHeightRef.current) return;

    // Se il contenitore è nascosto (es. tab compilazione o display: none), non eseguire misurazioni inutili
    if (pageHeightRef.current.offsetHeight === 0 && !previewMode) {
      return;
    }

    const pageH = pageHeightRef.current.offsetHeight || 1122; // ~297mm in pixels
    const firstHeadH = firstHeaderRef.current?.offsetHeight || 160;
    const subHeadH = subHeaderRef.current?.offsetHeight || 80;
    const footH = footerRef.current?.offsetHeight || 30;

    const usableFirst = pageH - firstHeadH - footH - 80;
    const usableSub = pageH - subHeadH - footH - 80;

    const blockNodes = Array.from(measureContainerRef.current.children) as HTMLElement[];
    const blockHeights = blockNodes.map((el) => el.offsetHeight);

    const calculatedPages: number[][] = [];
    let currentPageBlocks: number[] = [];
    let currentY = 0;
    let isFirst = true;

    blockHeights.forEach((h, index) => {
      const maxH = isFirst ? usableFirst : usableSub;
      if (currentY + h > maxH && currentPageBlocks.length > 0) {
        calculatedPages.push(currentPageBlocks);
        currentPageBlocks = [index];
        currentY = h;
        isFirst = false;
      } else {
        currentPageBlocks.push(index);
        currentY += h;
      }
    });

    if (currentPageBlocks.length > 0) {
      calculatedPages.push(currentPageBlocks);
    }

    const finalPages = calculatedPages.length > 0 ? calculatedPages : [[0]];
    
    // Aggiorna lo stato solo se le pagine calcolate sono effettivamente cambiate
    setPages((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(finalPages)) {
        return prev;
      }
      return finalPages;
    });

    if (onPageCountChange) {
      onPageCountChange(finalPages.length);
    }
  }, [blocks, onPageCountChange, previewMode]);

  const displayPages = useMemo(() => {
    const sanitized = pages
      .map((pageBlockIndices) =>
        pageBlockIndices.filter((bIdx) => bIdx >= 0 && bIdx < blocks.length && Boolean(blocks[bIdx]))
      )
      .filter((pageBlockIndices) => pageBlockIndices.length > 0);
    return sanitized.length > 0 ? sanitized : [[0]];
  }, [pages, blocks]);

  return (
    <div className="w-full flex flex-col items-center print:block print:w-[210mm] print:m-0 print:p-0">
      {/* Hidden reference measurement nodes */}
      <div
        ref={measureContainerRef}
        className="no-print print:hidden measurement-node fixed -left-[9999px] top-0 w-[184mm] opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        {blocks.map((b, bIdx) => (
          <div key={b?.id || bIdx} className="w-full mb-3">
            {b?.node}
          </div>
        ))}
      </div>

      <div
        ref={pageHeightRef}
        className="no-print print:hidden measurement-node fixed -left-[9999px] top-0 h-[297mm] pointer-events-none"
        aria-hidden="true"
      />
      <div
        ref={firstHeaderRef}
        className="no-print print:hidden measurement-node fixed -left-[9999px] top-0 w-[184mm] pointer-events-none"
        aria-hidden="true"
      >
        {renderFirstPageHeader()}
      </div>
      <div
        ref={subHeaderRef}
        className="no-print print:hidden measurement-node fixed -left-[9999px] top-0 w-[184mm] pointer-events-none"
        aria-hidden="true"
      >
        {renderSubsequentPageHeader()}
      </div>
      <div
        ref={footerRef}
        className="no-print print:hidden measurement-node fixed -left-[9999px] top-0 w-[184mm] pointer-events-none"
        aria-hidden="true"
      >
        {renderPageFooter(1, 1)}
      </div>

      {/* Rendered A4 Pages */}
      <div className="print:block print:w-[210mm] print:gap-0 print:m-0 print:p-0 flex flex-col items-center gap-8 w-full max-w-[210mm]">
        {displayPages.map((pageBlockIndices, pageIndex) => {
          const isFirstPage = pageIndex === 0;

          return (
            <div
              key={pageIndex}
              className="a4-page bg-white text-slate-900 border border-slate-300 shadow-md print:shadow-none print:border-none print:m-0 print:p-[10mm] print:h-[296mm] print:max-h-[296mm] print:min-h-0 w-[210mm] min-h-[297mm] p-[13mm] flex flex-col justify-between box-border overflow-hidden relative"
            >
              {/* Header */}
              <div className="shrink-0 w-full">
                {isFirstPage
                  ? renderFirstPageHeader()
                  : renderSubsequentPageHeader()}
              </div>

              {/* Content Blocks for this page */}
              <div className="grow w-full flex flex-col justify-start">
                {pageBlockIndices.map((bIdx) => {
                  const block = blocks[bIdx];
                  if (!block) return null;
                  return (
                    <React.Fragment key={block.id || bIdx}>
                      {block.node}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="shrink-0 w-full">
                {renderPageFooter(pageIndex + 1, displayPages.length)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
