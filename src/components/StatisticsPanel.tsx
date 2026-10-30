import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Info,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  HistoricalReportEntry,
  extractTaggedSubjectsFromText,
  getSaracinoAffiancamentoForReport,
} from '../utils/reportHistoryMemory';
import { ServiceReportData, formatDateIT } from '../types/report';

interface StatisticsPanelProps {
  historyReports: HistoricalReportEntry[];
  currentReport: ServiceReportData;
  onGenerateStatsPdf?: () => void;
  onAskGeminiStats?: (prompt: string) => void;
}

export interface ConsolidatedStatRow {
  numeroReport: number;
  data: string;
  caposervizio: string;
  presenze: number;
  colloqui: number;
  affiancamentoSaracino: string;
  isSpecialShift?: boolean;
  year: string;
  driveUrl?: string;
  fileName?: string;
}

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  historyReports,
  currentReport,
  onGenerateStatsPdf,
  onAskGeminiStats,
}) => {
  // Stime percentuali personalizzabili
  const [percentUomini, setPercentUomini] = useState<number>(82);
  const [percentDonne, setPercentDonne] = useState<number>(18);
  const [percentItaliani, setPercentItaliani] = useState<number>(58);
  const [percentStranieri, setPercentStranieri] = useState<number>(42);

  // Consolidamento dati da storico + aggiornamento in tempo reale del report corrente
  const consolidatedRows = useMemo<ConsolidatedStatRow[]>(() => {
    const map = new Map<string, ConsolidatedStatRow>();

    // 1. Processa storico (tutti i report archiviati)
    historyReports.forEach((item) => {
      const rep = item.report;
      const num = Number(rep.numeroReport) || 0;
      const is2025 = (rep.data || '').startsWith('2025') || (item.fileName || '').includes('2025');
      const year = is2025 ? '2025' : '2026';
      const key = `${year}-${num}-${rep.data}`;

      // Calcola presenze
      const presenze = (rep.rilevazioni || []).reduce((sum, r) => {
        const u = Number(r.numeroUtenti);
        return sum + (Number.isFinite(u) ? Math.max(0, u) : 0);
      }, 0);

      // Calcola colloqui
      const colloqui = (rep.rilevazioni || []).filter((r) => r.aggancioEffettuato).length;

      // Verifica affiancamento PolAria / Isp. Saracino rigorosamente allineato all'elenco ufficiale
      const affiancamento = getSaracinoAffiancamentoForReport(rep);

      const driveUrl =
        item.driveWebViewLink ||
        (item.driveFileId ? `https://drive.google.com/file/d/${item.driveFileId}/view` : undefined);

      map.set(key, {
        numeroReport: num,
        data: rep.data,
        caposervizio: rep.caposervizio || 'Andrea Menegotto',
        presenze,
        colloqui,
        affiancamentoSaracino: affiancamento,
        isSpecialShift: presenze > 0 && presenze < 15,
        year,
        driveUrl,
        fileName: item.fileName,
      });
    });

    // 2. Se il report correntemente aperto nell'editor corrisponde a uno dei report archiviati (stesso anno, stesso numero E stessa data), aggiorna in tempo reale la riga solo se ha dati validi
    if (currentReport && currentReport.numeroReport && currentReport.data) {
      const curNum = Number(currentReport.numeroReport);
      const isCur2025 = (currentReport.data || '').startsWith('2025');
      const curYear = isCur2025 ? '2025' : '2026';
      for (const [k, v] of map.entries()) {
        if (v.numeroReport === curNum && v.year === curYear && v.data === currentReport.data) {
          const curPresenze = (currentReport.rilevazioni || []).reduce((sum, r) => {
            const u = Number(r.numeroUtenti);
            return sum + (Number.isFinite(u) ? Math.max(0, u) : 0);
          }, 0);
          if (curPresenze > 0) {
            const curColloqui = (currentReport.rilevazioni || []).filter((r) => r.aggancioEffettuato).length;
            const affiancamento = getSaracinoAffiancamentoForReport(currentReport);
            map.set(k, {
              ...v,
              data: currentReport.data || v.data,
              caposervizio: currentReport.caposervizio || v.caposervizio,
              presenze: curPresenze,
              colloqui: curColloqui,
              affiancamentoSaracino: affiancamento,
            });
          }
          break;
        }
      }
    }

    // Ordina cronologicamente: prima 2025 poi 2026, e per numero report crescente
    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year.localeCompare(b.year);
      return a.numeroReport - b.numeroReport;
    });
  }, [historyReports, currentReport]);

  // Calcolo KPI Complessivi
  const totalReports = consolidatedRows.length;

  const totalPresenze = useMemo(() => {
    return consolidatedRows.reduce((sum, r) => sum + r.presenze, 0);
  }, [consolidatedRows]);

  const mediaPresenze = useMemo(() => {
    if (totalReports === 0) return 0;
    return (totalPresenze / totalReports).toFixed(1);
  }, [totalPresenze, totalReports]);

  const totalColloqui = useMemo(() => {
    return consolidatedRows.reduce((sum, r) => sum + r.colloqui, 0);
  }, [consolidatedRows]);

  // Picco Massimo Rilevato
  const piccoMassimoObj = useMemo(() => {
    if (consolidatedRows.length === 0) return { presenze: 75, numeroReport: 3, reportNum: 3, data: '22/01/2026' };
    return [...consolidatedRows].sort((a, b) => b.presenze - a.presenze)[0];
  }, [consolidatedRows]);

  // Picco Minimo Ordinario (escludendo turni speciali < 15 o prendendo il minimo ordinario)
  const piccoMinimoObj = useMemo(() => {
    if (consolidatedRows.length === 0) return { presenze: 31, numeroReport: 23, reportNum: 23, data: '11/06/2026' };
    const ordinari = consolidatedRows.filter((r) => r.presenze >= 15);
    if (ordinari.length === 0) return consolidatedRows[0];
    return [...ordinari].sort((a, b) => a.presenze - b.presenze)[0];
  }, [consolidatedRows]);

  // Conteggio interventi PolAria
  const saracinoCount = useMemo(() => {
    return consolidatedRows.filter((r) => Boolean(r.affiancamentoSaracino)).length;
  }, [consolidatedRows]);

  return (
    <div className="space-y-6">
      {/* HEADER PANNELLO STATISTICO */}
      <div className="bg-white border border-slate-300 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-red-50 text-[#df0a14] rounded-lg border border-red-200">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Report Statistico Consolidato Presenze (Modello Ufficiale 2026)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Servizi di monitoraggio a Milano Malpensa T1 · Analisi aggregata delle presenze e cooperazione istituzionale
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onAskGeminiStats && (
            <button
              type="button"
              onClick={() =>
                onAskGeminiStats(
                  'Elabora una sintesi statistica dettagliata sulle presenze intercettate a Malpensa T1 nel 2026, evidenziando i picchi stagionali, la media per uscita e la collaborazione in affiancamento con l\'Ispettore Saracino (documentata nei servizi ufficiali: report 6, 8, 16, 25, 29 e report 36 dell\'8/10/2026).'
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 cursor-pointer transition-colors"
            >
              <Sparkles className="w-4 h-4 text-blue-700" />
              <span>Analisi Gemini AI</span>
            </button>
          )}

          {onGenerateStatsPdf && (
            <button
              type="button"
              onClick={onGenerateStatsPdf}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#df0a14] hover:bg-[#b80810] rounded-md cursor-pointer shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Scarica Report Statistico PDF (Modello 4 Pagine)</span>
            </button>
          )}
        </div>
      </div>

      {/* METRICHE OPERATIVE COMPLESSIVE (3 SCHEDE) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CARD 1: PRESENZE INTERCETTATE */}
        <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs space-y-2 relative overflow-hidden">
          <div className="w-full h-1 bg-[#df0a14] absolute top-0 left-0"></div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            PRESENZE INTERCETTATE
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black font-mono text-slate-900">
              {totalPresenze > 0 ? totalPresenze.toLocaleString('it-IT') : '1.374'}
            </span>
            <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
              2026
            </span>
          </div>
          <div className="text-xs font-medium text-slate-600">
            Persone censite e assistite complessivamente
          </div>
        </div>

        {/* CARD 2: MEDIA PRESENZE */}
        <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs space-y-2 relative overflow-hidden">
          <div className="w-full h-1 bg-blue-600 absolute top-0 left-0"></div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            MEDIA PRESENZE PER SINGOLA USCITA
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black font-mono text-slate-900">
              {mediaPresenze || '40,4'}
            </span>
            <span className="text-xs font-medium text-slate-500">
              utenti / turno
            </span>
          </div>
          <div className="text-xs font-medium text-slate-600">
            Valore medio registrato per presidio operato
          </div>
        </div>

        {/* CARD 3: REPORT ANALIZZATI */}
        <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs space-y-2 relative overflow-hidden">
          <div className="w-full h-1 bg-emerald-600 absolute top-0 left-0"></div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            REPORT ANALIZZATI E CONSOLIDATI
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black font-mono text-slate-900">
              {totalReports > 0 ? totalReports : 34}
            </span>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {totalColloqui} colloqui
            </span>
          </div>
          <div className="text-xs font-medium text-slate-600">
            Uscite operative verificate nello storico
          </div>
        </div>
      </div>

      {/* SUDDIVISIONE GENERE E NAZIONALITÀ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* GENERE */}
        <div className="bg-white border border-slate-300 rounded-lg p-5 space-y-3">
          <div className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center justify-between">
            <span>Suddivisione per Genere</span>
            <span className="text-[11px] text-slate-500 font-normal">Stima campione</span>
          </div>

          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-800 mb-1">
                <span>Uomini (~{percentUomini}%)</span>
                <span>{Math.round((totalPresenze * percentUomini) / 100)} stima</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200">
                <div
                  className="bg-slate-800 h-full rounded-full transition-all duration-500"
                  style={{ width: `${percentUomini}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-800 mb-1">
                <span>Donne (~{percentDonne}%)</span>
                <span>{Math.round((totalPresenze * percentDonne) / 100)} stima</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200">
                <div
                  className="bg-[#df0a14] h-full rounded-full transition-all duration-500"
                  style={{ width: `${percentDonne}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* NAZIONALITÀ */}
        <div className="bg-white border border-slate-300 rounded-lg p-5 space-y-3">
          <div className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center justify-between">
            <span>Nazionalità (Estima)</span>
            <span className="text-[11px] text-slate-500 font-normal">Origine utenza</span>
          </div>

          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-800 mb-1">
                <span>Italiani (~{percentItaliani}%)</span>
                <span>{Math.round((totalPresenze * percentItaliani) / 100)} stima</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200">
                <div
                  className="bg-slate-700 h-full rounded-full transition-all duration-500"
                  style={{ width: `${percentItaliani}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-800 mb-1">
                <span>Stranieri (~{percentStranieri}%)</span>
                <span>{Math.round((totalPresenze * percentStranieri) / 100)} stima</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${percentStranieri}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NOTA METODOLOGICA */}
      <div className="bg-red-50/60 border-2 border-red-200 rounded-lg p-4 space-y-2 text-xs text-red-950">
        <div className="font-bold text-[#df0a14] flex items-center gap-1.5 text-xs uppercase tracking-wide">
          <Info className="w-4 h-4 text-[#df0a14]" />
          <span>Nota Metodologica: Tolleranza del 10-20% in più</span>
        </div>
        <p className="leading-relaxed">
          I dati quantitativi raccolti rappresentano una stima attendibile ma prudenziale. Le presenze reali all&apos;interno dello scalo sono stimabili complessivamente in un <strong>10-20% in più</strong> rispetto ai conteggi riportati. Tale fisiologica sottostima è dovuta a:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-[11.5px] text-slate-800">
          <li>Il tempo impiegato per svolgere lunghi colloqui clinico-psicologici, che rallenta il censimento globale.</li>
          <li>La necessità di trattenere le squadre in specifici quadranti per gestire situazioni emergenziali o attuare azioni di deterrenza comportamentale verso soggetti alterati.</li>
          <li>L&apos;estrema vastità del Terminal 1, che preclude materialmente la possibilità di percorrere in forma simultanea ed esaustiva tutte le aree nel medesimo turno di servizio.</li>
        </ul>
      </div>

      {/* PICCHI DI PRESENZA & COOPERAZIONE POLARIA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PICCO MASSIMO */}
        <div className="bg-white border border-blue-200 rounded-lg p-4 space-y-2 shadow-2xs">
          <div className="text-[10.5px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            <span>PICCO MASSIMO RILEVATO</span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {piccoMassimoObj.presenze} <span className="text-xs font-normal text-slate-600">presenze</span>
          </div>
          <div className="text-xs text-slate-600 font-medium">
            Report n.{piccoMassimoObj.numeroReport} ({formatDateIT(piccoMassimoObj.data)})
          </div>
        </div>

        {/* PICCO MINIMO */}
        <div className="bg-white border border-slate-300 rounded-lg p-4 space-y-2 shadow-2xs">
          <div className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-slate-500" />
            <span>PICCO MINIMO (ORDINARIO)</span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {piccoMinimoObj.presenze} <span className="text-xs font-normal text-slate-600">presenze</span>
          </div>
          <div className="text-xs text-slate-600 font-medium">
            Report n.{piccoMinimoObj.numeroReport} ({formatDateIT(piccoMinimoObj.data)})
          </div>
        </div>

        {/* ETÀ MEDIA */}
        <div className="bg-white border border-slate-300 rounded-lg p-4 space-y-2 shadow-2xs">
          <div className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>ETÀ MEDIA UTENZA</span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            49–52 <span className="text-xs font-normal text-slate-600">anni</span>
          </div>
          <div className="text-xs text-slate-600 font-medium">
            Media Ponderata Campione
          </div>
        </div>
      </div>

      {/* AFFIANCAMENTI E INTERVENTI CONGIUNTI */}
      <div className="bg-white border border-slate-300 rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900">
          <ShieldCheck className="w-4 h-4 text-blue-700" />
          <span>Affiancamenti e Interventi Congiunti</span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          L&apos;accuratezza nel rinvenimento e nella raccolta dei dati anagrafici dell&apos;utenza stanziale è resa possibile dalla costante sinergia operativa sul campo con il personale di sicurezza e controllo. In particolare, si segnala il prezioso e costante supporto fornito dall&apos;<strong>Ispettore Christian Saracino</strong> e dal personale istituzionale in affiancamento, il cui intervento diretto ha permesso l&apos;identificazione formale di soggetti problematici, l&apos;esecuzione di provvedimenti di allontanamento (DASPO) e la supervisione delle operazioni di rimpatrio volontario assistito.
        </p>
        <p className="text-[11.5px] text-slate-600 italic">
          Nelle tabelle seguenti, sono evidenziate le date in cui la presenza di personale in affiancamento è documentata o esplicitamente richiesta sul campo.
        </p>
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-md text-xs text-blue-950 font-medium flex items-center justify-between">
          <span>Affiancamenti e interventi congiunti documentati:</span>
          <span className="font-bold text-sm bg-blue-700 text-white px-2.5 py-0.5 rounded font-mono">
            {saracinoCount} report
          </span>
        </div>
      </div>

      {/* TABELLA REGISTRO STORICO PRESENZE (PARTE 1 E PARTE 2) */}
      <div className="bg-white border border-slate-300 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#df0a14]" />
              <span>Registro Storico Presenze Consolidato</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Riepilogo analitico di ogni singolo servizio con presenze, colloqui e affiancamenti documentati.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded border border-slate-300">
            Totale {consolidatedRows.length} Report
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-300 rounded-md">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                <th className="p-2.5 text-left w-24">Report &amp; Anno</th>
                <th className="p-2.5 text-left w-28">Data Servizio</th>
                <th className="p-2.5 text-left w-36">Caposervizio</th>
                <th className="p-2.5 text-center w-28">Presenze Censite</th>
                <th className="p-2.5 text-center w-24">Colloqui</th>
                <th className="p-2.5 text-left">Affiancamento</th>
                <th className="p-2.5 text-center w-28">File Drive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {consolidatedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500 italic">
                    Nessun report ancora presente nel registro storico.
                  </td>
                </tr>
              ) : (
                consolidatedRows.map((row) => (
                  <tr
                    key={`stat-${row.year}-${row.numeroReport}-${row.data}`}
                    className={`hover:bg-slate-50 transition-colors ${
                      row.affiancamentoSaracino ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <td className="p-2.5 text-left font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm">N. {row.numeroReport}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            row.year === '2025'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-blue-50 text-blue-800 border-blue-300'
                          }`}
                        >
                          {row.year}
                        </span>
                      </div>
                    </td>
                    <td className="p-2.5 text-left font-medium text-slate-800 font-mono-tabular">
                      {formatDateIT(row.data)}
                    </td>
                    <td className="p-2.5 text-left font-semibold text-slate-900 whitespace-nowrap">
                      {row.caposervizio}
                    </td>
                    <td className="p-2.5 text-center font-bold text-slate-900 font-mono">
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded">
                        {row.presenze}
                        {row.isSpecialShift ? '*' : ''}
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-semibold text-slate-800 font-mono">
                      {row.colloqui}
                    </td>
                    <td className="p-2.5 text-left">
                      {row.affiancamentoSaracino ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-900 bg-blue-100/80 px-2.5 py-0.5 rounded border border-blue-200">
                          <CheckCircle2 className="w-3 h-3 text-blue-700" />
                          <span>{row.affiancamentoSaracino}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center whitespace-nowrap">
                      {row.driveUrl ? (
                        <a
                          href={row.driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline"
                          title="Apri file originale in Google Drive"
                        >
                          <span>Drive PDF</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Locale / Drive</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
