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
  createInitialCleanReport,
} from '../types/report';
import { OFFICIAL_CITY_ANGELS_SVG } from '../components/CityAngelsLogo';

export function buildStandaloneHtml(
  corporate: CorporateHeaderConfig,
  initialReport?: ServiceReportData,
  roster: RosterMember[] = DEFAULT_ROSTER
): string {
  const cleanReport = initialReport || createInitialCleanReport(36);
  const defaultReportJson = JSON.stringify(cleanReport, null, 2);
  const corporateJson = JSON.stringify(corporate, null, 2);
  const rosterJson = JSON.stringify(roster, null, 2);

  const assoc = corporate.associazione || DEFAULT_ASSOCIAZIONE_CONFIG;
  const coop = corporate.cooperativa || DEFAULT_COOPERATIVA_CONFIG;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>City Angels Varese – Report di Servizio Aeroportuale</title>
  <style>
    :root {
      --ca-red: #df0a14;
      --slate-900: #0f172a;
      --slate-700: #334155;
      --slate-500: #64748b;
      --slate-300: #cbd5e1;
      --slate-200: #e2e8f0;
      --slate-100: #f1f5f9;
      --slate-50: #f8fafc;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 0;
      font-family: Calibri, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--slate-100);
      color: var(--slate-900);
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .tabular-nums {
      font-variant-numeric: tabular-nums;
    }

    .app-topbar {
      background: var(--slate-900);
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
      border-bottom: 3px solid var(--ca-red);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 15px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 6px;
      border: 1px solid transparent;
      cursor: pointer;
    }

    .btn-primary { background-color: var(--ca-red); color: #ffffff; }
    .btn-secondary { background-color: #ffffff; color: var(--slate-900); border-color: var(--slate-300); }
    .btn-danger { background-color: #fee2e2; color: #991b1b; border-color: #fecaca; padding: 5px 10px; font-size: 12px; }

    .workspace {
      max-width: 1120px;
      margin: 24px auto 60px;
      padding: 0 16px;
    }

    .card-section {
      background: #ffffff;
      border: 1px solid var(--slate-300);
      border-radius: 8px;
      padding: 20px 24px;
      margin-bottom: 20px;
    }

    .section-title {
      font-size: 15px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--slate-900);
      margin: 0 0 14px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--slate-900);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .grid-form {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 14px;
    }
    .col-12 { grid-column: span 12; }
    .col-6 { grid-column: span 6; }
    .col-4 { grid-column: span 4; }
    .col-3 { grid-column: span 3; }

    @media (max-width: 768px) {
      .col-6, .col-4, .col-3 { grid-column: span 12; }
    }

    label.field-label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: var(--slate-700);
      margin-bottom: 5px;
    }

    input[type="text"],
    input[type="date"],
    input[type="time"],
    input[type="number"],
    textarea {
      width: 100%;
      padding: 8px 10px;
      font-size: 13.5px;
      font-family: inherit;
      color: var(--slate-900);
      background: #ffffff;
      border: 1px solid var(--slate-300);
      border-radius: 6px;
    }

    input[readonly] {
      background: var(--slate-100);
      font-weight: 700;
    }

    table.form-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    table.form-table th,
    table.form-table td {
      border: 1px solid var(--slate-300);
      padding: 8px;
      text-align: left;
      font-size: 13px;
      vertical-align: top;
    }
    table.form-table th {
      background: var(--slate-100);
      font-weight: 700;
    }

    .report-photo-frame {
      width: 150px;
      max-width: 150px;
      height: 112px;
      object-fit: cover;
      border: 1px solid var(--slate-300);
      border-radius: 4px;
      background: var(--slate-50);
      display: block;
    }

    .a4-sheet {
      width: 210mm;
      height: 295mm;
      min-height: 295mm;
      max-height: 295mm;
      padding: 10mm 13mm;
      margin: 0 auto;
      background: #ffffff;
      color: #000000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      overflow: hidden;
    }

    .measure-sandbox {
      position: fixed;
      left: -9999px;
      top: 0;
      width: 184mm;
      visibility: hidden;
      pointer-events: none;
    }

    @page {
      size: A4 portrait;
      margin: 0mm;
    }

    @media print {
      html, body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 210mm !important;
      }
      .no-print { display: none !important; }
      .print-only-root { display: block !important; width: 210mm !important; }
      .a4-sheet {
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .a4-sheet:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .report-photo-frame, .report-photo-img {
        width: 150px !important;
        max-width: 150px !important;
        height: 112px !important;
        object-fit: cover !important;
      }
    }
  </style>
</head>
<body>
  <header class="app-topbar no-print">
    <div style="font-weight:700;font-size:16px;">City Angels Varese · Report di Servizio Aeroportuale</div>
    <div style="display:flex;gap:10px;">
      <button type="button" class="btn btn-secondary" onclick="resetCleanReport()">Libera Tutti i Campi</button>
      <button type="button" class="btn btn-primary" onclick="triggerPrint()">Stampa / Salva PDF (A4)</button>
    </div>
  </header>

  <main class="workspace no-print">
    <!-- 1. INTESTAZIONE E LOGO UNICO + 2 BLOCCHI SOCIETARI -->
    <section class="card-section" style="text-align:center;">
      <div id="logo-preview-container" style="margin-bottom:12px;"></div>
      <div style="margin-bottom:12px;">
        <label class="btn btn-secondary" style="font-size:12px;padding:5px 12px;">
          Carica Immagine Logo (opzionale)
          <input type="file" accept="image/*" style="display:none;" onchange="handleLogoUpload(event)" />
        </label>
      </div>

      <!-- 2 Colonne distinte per Associazione e Cooperativa -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;text-align:left;margin-top:12px;padding-top:12px;border-top:1px solid #cbd5e1;font-size:12px;line-height:1.4;">
        <div style="border-right:1px solid #e2e8f0;padding-right:16px;">
          <div style="font-weight:700;color:#0f172a;margin-bottom:4px;">${assoc.ragioneSociale}</div>
          <div><strong>Tel. emergenze e info:</strong> ${assoc.telEmergenze}</div>
          <div><strong>Email:</strong> ${assoc.email}</div>
          <div><strong>Sito:</strong> ${assoc.sitoWeb}</div>
          ${assoc.codiceFiscale ? `<div><strong>C.F.:</strong> ${assoc.codiceFiscale}</div>` : ''}
        </div>
        <div>
          <div style="font-weight:700;color:#0f172a;margin-bottom:4px;">${coop.ragioneSociale}</div>
          <div>${coop.sedeLegale} · tel: ${coop.telefono}</div>
          <div>Email: ${coop.email} · PEC: ${coop.pec}</div>
          <div>Sito: ${coop.sitoWeb} · C.F./P.IVA: ${coop.cfPiva}</div>
          <div style="font-size:10px;color:#64748b;margin-top:4px;">${coop.iscrizioniRegistri}</div>
        </div>
      </div>
    </section>

    <!-- 2. DATI GENERALI DEL REPORT & LUOGHI INIZIO/TERMINE E COMUNICAZIONI -->
    <section class="card-section">
      <h2 class="section-title">1. Dati Generali, Luoghi Inizio/Termine e Comunicazioni CO PS</h2>
      <div class="grid-form">
        <div class="col-4">
          <label class="field-label">REPORT DI SERVIZIO n. (Anno 2026 parte da 36)</label>
          <input type="number" id="inp-num-report" min="1" step="1" value="36" oninput="syncState()" />
        </div>
        <div class="col-8">
          <label class="field-label">Luogo (Testo Fisso)</label>
          <input type="text" id="inp-luogo" readonly value="${TESTO_FISSO_LUOGO}" />
        </div>
        <div class="col-12">
          <label class="field-label">Riferimenti emergenze (Testo Fisso)</label>
          <input type="text" id="inp-rif" readonly value="${TESTO_FISSO_RIFERIMENTI_EMERGENZE}" />
        </div>
        <div class="col-4">
          <label class="field-label">Data del Servizio</label>
          <input type="date" id="inp-data" onchange="syncState()" />
        </div>
        <div class="col-2">
          <label class="field-label">Ora Inizio</label>
          <input type="time" id="inp-inizio" onchange="syncState()" />
        </div>
        <div class="col-2">
          <label class="field-label">Ora Fine</label>
          <input type="time" id="inp-fine" onchange="syncState()" />
        </div>
        <div class="col-4">
          <label class="field-label">Orario Testo Libero (es. presidio continuativo)</label>
          <input type="text" id="inp-orario-testo" placeholder="Es. presidio continuativo" oninput="syncState()" />
        </div>
        <div class="col-6">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <label class="field-label" style="margin:0;">Luogo Inizio: Sbarra 1</label>
            <div id="sb1-quick-plates" style="display:flex;gap:4px;flex-wrap:wrap;"></div>
          </div>
          <div style="display:flex;gap:8px;">
            <input type="time" id="inp-sb1-ora" title="Ora apertura sbarra 1" onchange="syncState()" />
            <input type="text" id="inp-sb1-targa" list="standalone-plates-list" placeholder="Targa mezzo 1 (fissa)" oninput="this.value = this.value.toUpperCase(); syncState();" />
          </div>
        </div>
        <div class="col-6">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <label class="field-label" style="margin:0;">Luogo Inizio: Sbarra 2 (opzionale)</label>
            <div id="sb2-quick-plates" style="display:flex;gap:4px;flex-wrap:wrap;"></div>
          </div>
          <div style="display:flex;gap:8px;">
            <input type="time" id="inp-sb2-ora" title="Ora apertura sbarra 2" onchange="syncState()" />
            <input type="text" id="inp-sb2-targa" list="standalone-plates-list" placeholder="Targa mezzo 2 (fissa)" oninput="this.value = this.value.toUpperCase(); syncState();" />
          </div>
        </div>
        <datalist id="standalone-plates-list"></datalist>
        <div class="col-12">
          <label class="field-label">Luogo Termine Servizio (Testo Fisso)</label>
          <input type="text" readonly value="${TESTO_FISSO_LUOGO_TERMINE}" />
        </div>
        <div class="col-6">
          <label class="field-label">Comunicazione Inizio a CO PS: Effettuata, ore</label>
          <input type="time" id="inp-com-inizio" onchange="syncState()" />
        </div>
        <div class="col-6">
          <label class="field-label">Comunicazione Fine a CO PS: Effettuata, ore</label>
          <input type="time" id="inp-com-fine" onchange="syncState()" />
        </div>
      </div>
    </section>

    <!-- 3. SQUADRA IN SERVIZIO -->
    <section class="card-section">
      <h2 class="section-title">2. Squadra in Servizio</h2>
      <p style="font-size:12.5px;color:var(--slate-500);margin-top:0;">
        Operatori pre-compilati con qualifiche ufficiali. Nessun orario o ruolo è pre-impostato. Spunta <strong>Caposervizio</strong> e/o <strong>Compilatore</strong> per ciascun operatore.
      </p>
      <table class="form-table" id="roster-table">
        <thead>
          <tr>
            <th style="width:40px;">Pres.</th>
            <th>Operatore (Nome Cognome)</th>
            <th style="width:120px;">Nickname</th>
            <th>Qualifica Ufficiale</th>
            <th style="width:90px;text-align:center;">Caposervizio</th>
            <th style="width:90px;text-align:center;">Compilatore</th>
          </tr>
        </thead>
        <tbody id="roster-tbody"></tbody>
      </table>
      <div style="margin-top:14px;">
        <label class="field-label">Personale esterno in affiancamento (testo libero)</label>
        <input type="text" id="inp-esterni" placeholder="Indicare eventuale personale esterno o lasciare vuoto" oninput="syncState()" />
      </div>
    </section>

    <!-- 4. RILEVAZIONI ED INTERVENTI -->
    <section class="card-section">
      <div class="section-title">
        <span>3. Rilevazioni e Interventi Effettuati</span>
        <button type="button" class="btn btn-secondary" onclick="addRilevazione()">+ Aggiungi Rilevazione</button>
      </div>
      <div id="rilevazioni-container"></div>
    </section>

    <!-- 5. RIEPILOGO, EMERGENZE E NOTE -->
    <section class="card-section">
      <h2 class="section-title">4. Riepilogo, Richieste Emergenza e Note</h2>
      <div class="grid-form">
        <div class="col-6">
          <label class="field-label">Totale soggetti individuati (Calcolato in tempo reale)</label>
          <input type="number" id="tot-soggetti" readonly value="0" style="font-size:16px;font-weight:700;" />
        </div>
        <div class="col-6">
          <label class="field-label">Totale agganci / colloqui effettuati</label>
          <input type="number" id="tot-agganci" readonly value="0" style="font-size:16px;font-weight:700;" />
        </div>
        <div class="col-4">
          <label class="field-label">Richieste Intervento emergenza CO PS</label>
          <textarea rows="2" id="inp-em-ps" placeholder="Nessuna //" oninput="syncState()"></textarea>
        </div>
        <div class="col-4">
          <label class="field-label">Richieste Intervento emergenza CO SEA</label>
          <textarea rows="2" id="inp-em-sea" placeholder="Nessuna //" oninput="syncState()"></textarea>
        </div>
        <div class="col-4">
          <label class="field-label">Richieste Intervento emergenza Pronto soccorso MXP</label>
          <textarea rows="2" id="inp-em-ps-mxp" placeholder="Nessuna //" oninput="syncState()"></textarea>
        </div>
        <div class="col-12">
          <label class="field-label">Richieste di intervento non urgenti</label>
          <textarea rows="2" id="inp-non-urgenti" placeholder="Nessuna //" oninput="syncState()"></textarea>
        </div>
        <div class="col-6">
          <label class="field-label">Note</label>
          <textarea rows="2" id="inp-note" placeholder="//" oninput="syncState()"></textarea>
        </div>
        <div class="col-6">
          <label class="field-label">Osservazioni</label>
          <textarea rows="2" id="inp-osservazioni" placeholder="//" oninput="syncState()"></textarea>
        </div>
      </div>
    </section>
  </main>

  <!-- SEZIONE DI STAMPA A4 PAGINATA -->
  <div id="print-root" class="print-only-root"></div>
  <div id="measure-sandbox" class="measure-sandbox"></div>

  <script>
    const DEFAULT_SVG = \`${OFFICIAL_CITY_ANGELS_SVG}\`;

    let state = ${defaultReportJson};
    let CORPORATE = ${corporateJson};
    let ROSTER = ${rosterJson};

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function indexToAlpha(idx) {
      const char = String.fromCharCode((idx % 26) + 97);
      const rep = Math.floor(idx / 26) + 1;
      return char.repeat(rep);
    }

    function formatDateExtendedIT(iso) {
      if (!iso) return '—';
      const p = iso.split('-').map(Number);
      if (p.length !== 3) return iso;
      const d = new Date(p[0], p[1] - 1, p[2]);
      const g = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
      const m = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
      return g[d.getDay()] + ' ' + String(p[2]).padStart(2, '0') + ' ' + m[p[1]-1] + ' ' + p[0];
    }

    function getSingleLogoHtml(size) {
      if (CORPORATE.logoUrl) {
        return '<div style="display:inline-flex;align-items:center;justify-content:center;"><img src="' + CORPORATE.logoUrl + '" style="max-width:' + size + 'px;max-height:' + Math.round(size * 0.82) + 'px;width:auto;height:auto;object-fit:contain;" alt="Logo City Angels Varese" /></div>';
      }
      return '<div style="display:inline-flex;align-items:center;justify-content:center;">' + DEFAULT_SVG.replace('width="280" height="280"', 'width="' + size + '" height="' + size + '"') + '</div>';
    }

    function handleLogoUpload(e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = function(evt) {
        CORPORATE.logoUrl = evt.target.result;
        document.getElementById('logo-preview-container').innerHTML = getSingleLogoHtml(96);
      };
      r.readAsDataURL(f);
    }

    function renderRosterTable() {
      const tbody = document.getElementById('roster-tbody');
      tbody.innerHTML = ROSTER.map((m, i) => {
        const teamMember = state.squadra.find(s => s.id === m.id) || { isCaposervizio: false, isCompilatore: false };
        const isPres = state.squadra.some(s => s.id === m.id);
        return \`
          <tr>
            <td style="text-align:center;">
              <input type="checkbox" \${isPres ? 'checked' : ''} onchange="togglePresence('\${m.id}', this.checked)" />
            </td>
            <td><strong>\${escapeHtml(m.nomeCognome)}</strong></td>
            <td><input type="text" value="\${escapeHtml(m.nickname || '')}" placeholder="Nickname" oninput="updateMemberNick('\${m.id}', this.value)" style="padding:4px 6px;font-size:12px;" /></td>
            <td>\${escapeHtml(m.qualifica)}</td>
            <td style="text-align:center;">
              <input type="checkbox" \${teamMember.isCaposervizio ? 'checked' : ''} onchange="toggleCaposervizio('\${m.id}', this.checked)" />
            </td>
            <td style="text-align:center;">
              <input type="checkbox" \${teamMember.isCompilatore ? 'checked' : ''} onchange="toggleCompilatore('\${m.id}', this.checked)" />
            </td>
          </tr>
        \`;
      }).join('');
    }

    function togglePresence(id, checked) {
      if (checked) {
        const r = ROSTER.find(x => x.id === id);
        if (r && !state.squadra.some(s => s.id === id)) {
          state.squadra.push({ id: r.id, nomeCognome: r.nomeCognome, nickname: r.nickname, qualifica: r.qualifica, orarioServizio: '', isCaposervizio: false, isCompilatore: false });
          state.squadra.sort((a, b) => ROSTER.findIndex(x => x.id === a.id) - ROSTER.findIndex(x => x.id === b.id));
        }
      } else {
        state.squadra = state.squadra.filter(s => s.id !== id);
      }
      renderRosterTable();
    }

    function toggleCaposervizio(id, checked) {
      const m = state.squadra.find(s => s.id === id);
      if (m) m.isCaposervizio = checked;
      renderRosterTable();
    }

    function toggleCompilatore(id, checked) {
      const m = state.squadra.find(s => s.id === id);
      if (m) m.isCompilatore = checked;
      renderRosterTable();
    }

    function updateMemberNick(id, val) {
      const r = ROSTER.find(x => x.id === id);
      if (r) r.nickname = val;
      const s = state.squadra.find(x => x.id === id);
      if (s) s.nickname = val;
    }

    function renderRilevazioni() {
      const container = document.getElementById('rilevazioni-container');
      container.innerHTML = state.rilevazioni.map((r, idx) => {
        const alpha = indexToAlpha(idx);
        const photosHtml = (r.foto || []).map((ph, pIdx) => \`
          <div style="position:relative;display:inline-block;">
            <img src="\${ph.dataUrl}" class="report-photo-frame" alt="Foto \${alpha}" />
            <button type="button" class="btn btn-danger" style="position:absolute;top:2px;right:2px;padding:2px 6px;" onclick="removePhoto(\${idx}, \${pIdx})">X</button>
          </div>
        \`).join('');

        return \`
          <div class="card-section" style="margin-bottom:14px;border:1px solid var(--slate-300);padding:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <span style="font-weight:700;font-size:14px;">PUNTO \${alpha}</span>
              <button type="button" class="btn btn-danger" onclick="removeRilevazione(\${idx})">Rimuovi Punto</button>
            </div>
            <div class="grid-form">
              <div class="col-6">
                <label class="field-label">Luogo di individuazione (es. Porta 1 - Piano Arrivi)</label>
                <input type="text" value="\${escapeHtml(r.luogoIndividuazione || '')}" placeholder="Porta 1 - Piano Arrivi" oninput="state.rilevazioni[\${idx}].luogoIndividuazione = this.value" />
              </div>
              <div class="col-3">
                <label class="field-label">Numero Utenti</label>
                <input type="number" min="0" value="\${r.numeroUtenti || 0}" oninput="state.rilevazioni[\${idx}].numeroUtenti = parseInt(this.value, 10) || 0; updateTotals();" />
              </div>
              <div class="col-3" style="display:flex;align-items:flex-end;">
                <label style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;cursor:pointer;">
                  <input type="checkbox" \${r.aggancioEffettuato ? 'checked' : ''} onchange="state.rilevazioni[\${idx}].aggancioEffettuato = this.checked; updateTotals();" />
                  <span>Aggancio / Colloquio effettuato</span>
                </label>
              </div>
              <div class="col-12">
                <label class="field-label">Descrizione dell'intervento / situazione</label>
                <textarea rows="3" oninput="state.rilevazioni[\${idx}].descrizione = this.value">\${escapeHtml(r.descrizione)}</textarea>
              </div>
              <div class="col-12">
                <label class="field-label">Fotografie allegate (rispettano i margini A4)</label>
                <input type="file" accept="image/*" multiple onchange="handlePhotoUpload(event, \${idx})" />
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">\${photosHtml}</div>
              </div>
            </div>
          </div>
        \`;
      }).join('');
    }

    function addRilevazione() {
      state.rilevazioni.push({ id: 'ril-' + Date.now(), luogoIndividuazione: '', descrizione: '', numeroUtenti: 0, aggancioEffettuato: false, foto: [] });
      renderRilevazioni();
      updateTotals();
    }

    function removeRilevazione(idx) {
      state.rilevazioni.splice(idx, 1);
      renderRilevazioni();
      updateTotals();
    }

    function removePhoto(rilIdx, photoIdx) {
      state.rilevazioni[rilIdx].foto.splice(photoIdx, 1);
      renderRilevazioni();
    }

    function handlePhotoUpload(event, rilIdx) {
      const files = Array.from(event.target.files || []);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
          const img = new Image();
          img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 224;
            const ctx = canvas.getContext('2d');
            const scale = Math.max(300 / img.width, 224 / img.height);
            const dw = img.width * scale;
            const dh = img.height * scale;
            ctx.drawImage(img, (300 - dw)/2, (224 - dh)/2, dw, dh);
            state.rilevazioni[rilIdx].foto.push({ id: 'ph-' + Date.now(), name: file.name, dataUrl: canvas.toDataURL('image/jpeg', 0.88) });
            renderRilevazioni();
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    const STORAGE_KEY_SAVED_PLATES = 'city_angels_saved_license_plates_v2';
    let savedPlates = ['GA 123 CA', 'GA 456 CA'];
    try {
      const sp = localStorage.getItem(STORAGE_KEY_SAVED_PLATES);
      if (sp) {
        const parsed = JSON.parse(sp);
        if (Array.isArray(parsed) && parsed.length > 0) {
          savedPlates = parsed.map(function(x) { return typeof x === 'string' ? x : (x.targa || ''); }).filter(Boolean);
        }
      }
    } catch(e) {}

    function renderQuickPlates() {
      const datalist = document.getElementById('standalone-plates-list');
      if (datalist) {
        datalist.innerHTML = savedPlates.map(function(p) { return '<option value="' + escapeHtml(p) + '"></option>'; }).join('');
      }
      const b1 = document.getElementById('sb1-quick-plates');
      if (b1) {
        b1.innerHTML = savedPlates.map(function(p) {
          return '<button type="button" class="btn btn-secondary" style="font-size:10px;padding:1px 5px;font-family:monospace;cursor:pointer;" onclick="setPlate(0, \'' + escapeHtml(p) + '\')">' + escapeHtml(p) + '</button>';
        }).join('');
      }
      const b2 = document.getElementById('sb2-quick-plates');
      if (b2) {
        b2.innerHTML = savedPlates.map(function(p) {
          return '<button type="button" class="btn btn-secondary" style="font-size:10px;padding:1px 5px;font-family:monospace;cursor:pointer;" onclick="setPlate(1, \'' + escapeHtml(p) + '\')">' + escapeHtml(p) + '</button>';
        }).join('');
      }
    }

    function setPlate(idx, targa) {
      if (idx === 0) {
        document.getElementById('inp-sb1-targa').value = targa;
      } else {
        document.getElementById('inp-sb2-targa').value = targa;
      }
      syncState();
    }

    function syncState() {
      state.numeroReport = parseInt(document.getElementById('inp-num-report').value || '36', 10);
      state.data = document.getElementById('inp-data').value;
      state.oraInizio = document.getElementById('inp-inizio').value;
      state.oraFine = document.getElementById('inp-fine').value;
      state.orarioTestoLibero = document.getElementById('inp-orario-testo').value;

      const t1 = document.getElementById('inp-sb1-targa').value.trim().toUpperCase();
      const t2 = document.getElementById('inp-sb2-targa').value.trim().toUpperCase();
      let platesUpdated = false;
      if (t1 && !savedPlates.includes(t1)) {
        savedPlates.push(t1);
        platesUpdated = true;
      }
      if (t2 && !savedPlates.includes(t2)) {
        savedPlates.push(t2);
        platesUpdated = true;
      }
      if (platesUpdated) {
        try {
          localStorage.setItem(STORAGE_KEY_SAVED_PLATES, JSON.stringify(savedPlates.map(function(t, i) {
            return { id: 'plate-' + i, targa: t, isDefaultSbarra1: i === 0, isDefaultSbarra2: i === 1 };
          })));
        } catch(e) {}
        renderQuickPlates();
      }

      state.apertureSbarraInizio = [
        { ora: document.getElementById('inp-sb1-ora').value, targa: t1 },
        { ora: document.getElementById('inp-sb2-ora').value, targa: t2 }
      ];
      state.comunicazioneInizioCO = document.getElementById('inp-com-inizio').value;
      state.comunicazioneFineCO = document.getElementById('inp-com-fine').value;
      state.personaleEsternoAffiancamento = document.getElementById('inp-esterni').value;
      state.richiesteEmergenzaCOPS = document.getElementById('inp-em-ps').value;
      state.richiesteEmergenzaCOSEA = document.getElementById('inp-em-sea').value;
      state.richiesteEmergenzaProntoSoccorsoMXP = (document.getElementById('inp-em-ps-mxp') || {}).value || '';
      state.richiesteNonUrgenti = document.getElementById('inp-non-urgenti').value;
      state.note = document.getElementById('inp-note').value;
      state.osservazioni = document.getElementById('inp-osservazioni').value;
      updateTotals();
    }

    function updateTotals() {
      const totSoggetti = state.rilevazioni.reduce((acc, r) => acc + (parseInt(r.numeroUtenti, 10) || 0), 0);
      const totAgganci = state.rilevazioni.filter(r => Boolean(r.aggancioEffettuato)).length;
      document.getElementById('tot-soggetti').value = totSoggetti;
      document.getElementById('tot-agganci').value = totAgganci;
    }

    function resetCleanReport() {
      state.data = '';
      state.oraInizio = '';
      state.oraFine = '';
      state.orarioTestoLibero = '';
      state.apertureSbarraInizio = [{ ora: '', targa: '' }, { ora: '', targa: '' }];
      state.comunicazioneInizioCO = '';
      state.comunicazioneFineCO = '';
      state.personaleEsternoAffiancamento = '';
      state.rilevazioni = [{ id: 'ril-1', luogoIndividuazione: '', descrizione: '', numeroUtenti: 0, aggancioEffettuato: false, foto: [] }];
      state.richiesteEmergenzaCOPS = '';
      state.richiesteEmergenzaCOSEA = '';
      state.richiesteEmergenzaProntoSoccorsoMXP = '';
      state.richiesteNonUrgenti = '';
      state.note = '';
      state.osservazioni = '';
      initForm();
    }

    function initForm() {
      document.getElementById('logo-preview-container').innerHTML = getSingleLogoHtml(96);
      document.getElementById('inp-num-report').value = state.numeroReport || 36;
      document.getElementById('inp-data').value = state.data || '';
      document.getElementById('inp-inizio').value = state.oraInizio || '';
      document.getElementById('inp-fine').value = state.oraFine || '';
      document.getElementById('inp-orario-testo').value = state.orarioTestoLibero || '';

      const sb1Val = (state.apertureSbarraInizio && state.apertureSbarraInizio[0] && state.apertureSbarraInizio[0].targa) || savedPlates[0] || '';
      const sb2Val = (state.apertureSbarraInizio && state.apertureSbarraInizio[1] && state.apertureSbarraInizio[1].targa) || (savedPlates.length > 1 ? savedPlates[1] : '') || '';

      document.getElementById('inp-sb1-ora').value = (state.apertureSbarraInizio && state.apertureSbarraInizio[0] && state.apertureSbarraInizio[0].ora) || '';
      document.getElementById('inp-sb1-targa').value = sb1Val;
      document.getElementById('inp-sb2-ora').value = (state.apertureSbarraInizio && state.apertureSbarraInizio[1] && state.apertureSbarraInizio[1].ora) || '';
      document.getElementById('inp-sb2-targa').value = sb2Val;

      if (!state.apertureSbarraInizio || !state.apertureSbarraInizio[0] || !state.apertureSbarraInizio[0].targa) {
        if (!state.apertureSbarraInizio) state.apertureSbarraInizio = [{ ora: '', targa: '' }, { ora: '', targa: '' }];
        state.apertureSbarraInizio[0].targa = sb1Val;
        state.apertureSbarraInizio[1].targa = sb2Val;
      }

      renderQuickPlates();
      document.getElementById('inp-com-inizio').value = state.comunicazioneInizioCO || '';
      document.getElementById('inp-com-fine').value = state.comunicazioneFineCO || '';
      document.getElementById('inp-esterni').value = state.personaleEsternoAffiancamento || '';
      document.getElementById('inp-em-ps').value = state.richiesteEmergenzaCOPS || '';
      document.getElementById('inp-em-sea').value = state.richiesteEmergenzaCOSEA || '';
      if (document.getElementById('inp-em-ps-mxp')) {
        document.getElementById('inp-em-ps-mxp').value = state.richiesteEmergenzaProntoSoccorsoMXP || '';
      }
      document.getElementById('inp-non-urgenti').value = state.richiesteNonUrgenti || '';
      document.getElementById('inp-note').value = state.note || '';
      document.getElementById('inp-osservazioni').value = state.osservazioni || '';
      renderRosterTable();
      renderRilevazioni();
      updateTotals();
    }

    function buildPrintPages() {
      syncState();
      const totSoggetti = state.rilevazioni.reduce((acc, r) => acc + (parseInt(r.numeroUtenti, 10) || 0), 0);
      const totAgganci = state.rilevazioni.filter(r => Boolean(r.aggancioEffettuato)).length;
      const compilatori = state.squadra.filter(m => m.isCompilatore).map(m => m.nomeCognome).join(', ');

      const firstPageHeaderHtml = \`
        <header style="text-align:center;margin-bottom:8px;">
          <div>\${getSingleLogoHtml(88)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;text-align:left;margin-top:8px;padding-top:8px;border-top:1px solid #cbd5e1;font-size:8.5px;line-height:1.35;">
            <div style="border-right:1px solid #e2e8f0;padding-right:12px;">
              <div style="font-weight:700;color:#0f172a;margin-bottom:2px;white-space:pre-line;">\${escapeHtml(CORPORATE.associazione.ragioneSociale)}</div>
              <div><strong>Tel. emergenze e info:</strong> \${escapeHtml(CORPORATE.associazione.telEmergenze)}</div>
              <div><strong>Email:</strong> \${escapeHtml(CORPORATE.associazione.email)}</div>
              <div><strong>Sito:</strong> \${escapeHtml(CORPORATE.associazione.sitoWeb)}</div>
              \${CORPORATE.associazione.codiceFiscale ? '<div><strong>C.F.:</strong> ' + escapeHtml(CORPORATE.associazione.codiceFiscale) + '</div>' : ''}
            </div>
            <div>
              <div style="font-weight:700;color:#0f172a;margin-bottom:2px;">\${escapeHtml(CORPORATE.cooperativa.ragioneSociale)}</div>
              <div>\${escapeHtml(CORPORATE.cooperativa.sedeLegale)} · tel: \${escapeHtml(CORPORATE.cooperativa.telefono)}</div>
              <div>Email: \${escapeHtml(CORPORATE.cooperativa.email)} · PEC: \${escapeHtml(CORPORATE.cooperativa.pec)}</div>
              <div>Sito: \${escapeHtml(CORPORATE.cooperativa.sitoWeb)} · C.F./P.IVA: \${escapeHtml(CORPORATE.cooperativa.cfPiva)}</div>
              <div style="font-size:7px;color:#64748b;margin-top:2px;">\${escapeHtml(CORPORATE.cooperativa.iscrizioniRegistri)}</div>
            </div>
          </div>
        </header>
      \`;

      const subPageHeaderHtml = \`
        <header style="text-align:center;margin-bottom:8px;">
          \${getSingleLogoHtml(64)}
        </header>
      \`;

      const blocks = [];
      const sbList = (state.apertureSbarraInizio || []).filter(b => b.ora || b.targa);
      const sbHtml = sbList.length ? sbList.map(b => '<div>Parcheggio P1 (apertura sbarra ore ' + escapeHtml(b.ora || '____') + ' tramite lettura targa mezzo ' + escapeHtml((b.targa || '______').toUpperCase()) + ')</div>').join('') : '<div>Parcheggio P1 (apertura sbarra ore ____ tramite lettura targa mezzo ______)</div>';

      blocks.push(\`
        <table style="width:100%;border-collapse:collapse;border:1px solid #000;font-size:10.5px;">
          <tr><td colspan="3" style="border:1px solid #000;padding:8px;text-align:center;"><span style="background:#d4d4d8;padding:2px 8px;font-weight:700;font-size:13px;">REPORT DI SERVIZIO n. \${state.numeroReport}</span></td></tr>
          <tr>
            <td style="width:54%;border:1px solid #000;padding:6px;text-align:right;vertical-align:middle;font-weight:500;">Compilato da:</td>
            <td style="width:23%;border:1px solid #000;padding:6px;text-align:center;font-style:italic;font-weight:600;">\${escapeHtml(compilatori)}</td>
            <td style="width:23%;border:1px solid #000;padding:6px;text-align:center;"><div style="font-size:8.5px;color:#64748b;">Firma:</div><div style="min-height:26px;">&nbsp;</div></td>
          </tr>
          <tr><td style="width:28%;border:1px solid #000;padding:6px;font-weight:700;">Luogo:</td><td colspan="2" style="border:1px solid #000;padding:6px;font-weight:700;">\${escapeHtml(state.luogo)}</td></tr>
          <tr><td style="border:1px solid #000;padding:6px;font-weight:700;">Riferimenti emergenze:</td><td colspan="2" style="border:1px solid #000;padding:6px;font-size:9.5px;">CO Security SEA: 02.74862999 | CO PS: 02.74867553-02.74867552 | Pronto Soccorso MXP: 02.74864444</td></tr>
          <tr><td style="border:1px solid #000;padding:6px;font-weight:700;vertical-align:middle;">Data del servizio:</td><td colspan="2" style="border:1px solid #000;padding:6px;vertical-align:middle;"><span style="display:inline-block;background:#d4d4d8;padding:2px 8px;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.02em;">\${escapeHtml(formatDateExtendedIT(state.data))}</span></td></tr>
          \${(() => {
            const slots = (state.orariServizio && state.orariServizio.length > 0)
              ? state.orariServizio.filter((s: any) => s.oraInizio || s.oraFine || s.descrizione)
              : [];
            if (slots.length > 1) {
              const inner = slots.map((s: any, idx: number) =>
                \`<div style="margin-bottom:2px;"><strong>Servizio \${idx + 1}:</strong> dalle ore <strong>\${escapeHtml(s.oraInizio || '—')}</strong> alle ore <strong>\${escapeHtml(s.oraFine || '—')}</strong> \${s.descrizione ? '<em>(' + escapeHtml(s.descrizione) + ')</em>' : ''}</div>\`
              ).join('');
              return \`<tr><td style="border:1px solid #000;padding:6px;font-weight:700;">Orari dei servizi (\${slots.length}):</td><td colspan="2" style="border:1px solid #000;padding:6px;">\${inner}</td></tr>\`;
            }
            const s = slots[0];
            const ini = s?.oraInizio || state.oraInizio || '—';
            const fin = s?.oraFine || state.oraFine || '—';
            const desc = s?.descrizione || state.orarioTestoLibero || '';
            const txt = (ini !== '—' || fin !== '—' ? 'dalle ore: ' + ini + ' alle ore: ' + fin + ' ' : '') + (desc ? '(' + desc + ')' : '');
            return \`<tr><td style="border:1px solid #000;padding:6px;font-weight:700;">Orario del servizio:</td><td colspan="2" style="border:1px solid #000;padding:6px;">\${escapeHtml(txt)}</td></tr>\`;
          })()}
          <tr><td style="border:1px solid #000;padding:6px;font-weight:700;">Luogo inizio servizio:</td><td colspan="2" style="border:1px solid #000;padding:6px;">\${sbHtml}</td></tr>
          <tr><td style="border:1px solid #000;padding:6px;font-weight:700;">Luogo termine servizio:</td><td colspan="2" style="border:1px solid #000;padding:6px;">Parcheggio P1 (apertura sbarra tramite lettura targa mezzi)</td></tr>
          <tr><td style="border:1px solid #000;padding:6px;font-weight:700;">Comunicazione inizio servizio a CO PS:</td><td colspan="2" style="border:1px solid #000;padding:6px;">Effettuata, ore \${escapeHtml(state.comunicazioneInizioCO || '______')}</td></tr>
          <tr><td style="border:1px solid #000;padding:6px;font-weight:700;">Comunicazione fine servizio a CO PS:</td><td colspan="2" style="border:1px solid #000;padding:6px;">Effettuata, ore \${escapeHtml(state.comunicazioneFineCO || '______')}</td></tr>
        </table>
      \`);

      const teamRows = state.squadra.map((m, idx) => \`
        <tr>
          <td style="border:1px solid #000;padding:5px;text-align:center;">\${idx + 1}</td>
          <td style="border:1px solid #000;padding:5px;">\${escapeHtml(m.nomeCognome)}\${m.nickname ? ' "' + escapeHtml(m.nickname) + '"' : ''}</td>
          <td style="border:1px solid #000;padding:5px;font-size:9.5px;">\${escapeHtml(m.qualifica)}</td>
          <td style="border:1px solid #000;padding:5px;text-align:center;font-family:monospace;font-weight:700;">\${m.isCaposervizio ? '[ X ]' : '[   ]'}</td>
          <td style="border:1px solid #000;padding:5px;text-align:center;font-family:monospace;font-weight:700;">\${m.isCompilatore ? '[ X ]' : '[   ]'}</td>
        </tr>
      \`).join('');

      blocks.push(\`
        <table style="width:100%;border-collapse:collapse;border:1px solid #000;font-size:10px;margin-top:6px;">
          <thead>
            <tr style="background:#f1f5f9;"><th colspan="5" style="border:1px solid #000;padding:5px;text-align:left;">SQUADRA IN SERVIZIO</th></tr>
            <tr style="background:#f8fafc;font-size:9px;">
              <th style="border:1px solid #000;padding:4px;width:30px;">N°</th>
              <th style="border:1px solid #000;padding:4px;">Operatore (Nome Cognome)</th>
              <th style="border:1px solid #000;padding:4px;">Qualifica Ufficiale</th>
              <th style="border:1px solid #000;padding:4px;width:70px;text-align:center;">Caposerv.</th>
              <th style="border:1px solid #000;padding:4px;width:70px;text-align:center;">Compilat.</th>
            </tr>
          </thead>
          <tbody>
            \${teamRows}
            <tr>
              <td colspan="5" style="border:1px solid #000;padding:6px;"><strong>Personale esterno in affiancamento:</strong> <em>\${escapeHtml(state.personaleEsternoAffiancamento || 'Nessuno //')}</em></td>
            </tr>
          </tbody>
        </table>
      \`);

      // Rilevazioni
      state.rilevazioni.forEach((r, idx) => {
        const alpha = indexToAlpha(idx);
        const photosHtml = (r.foto || []).map(p => \`
          <img src="\${p.dataUrl}" class="report-photo-frame" alt="Foto \${alpha}" />
        \`).join('');

        blocks.push(\`
          <div style="border:1px solid #000;margin-top:6px;font-size:10px;">
            <div style="background:#f1f5f9;border-bottom:1px solid #000;padding:4px 8px;display:flex;justify-content:space-between;font-weight:700;">
              <span>PUNTO \${alpha} | Luogo di individuazione: \${escapeHtml(r.luogoIndividuazione || '—')}</span>
              <span>Utenti: \${r.numeroUtenti || 0} | Colloquio/Aggancio: \${r.aggancioEffettuato ? '[ Sì ]' : '[ No ]'}</span>
            </div>
            <div style="padding:6px;min-height:20px;white-space:pre-wrap;">\${escapeHtml(r.descrizione?.trim() || '')}</div>
            \${photosHtml ? '<div style="padding:4px 6px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;gap:6px;flex-wrap:wrap;">' + photosHtml + '</div>' : ''}
          </div>
        \`);
      });

      // Riepilogo
      blocks.push(\`
        <table style="width:100%;border-collapse:collapse;border:1px solid #000;font-size:10px;margin-top:6px;">
          <tr><td style="width:28%;border:1px solid #000;padding:5px;font-weight:700;">Totale soggetti individuati:</td><td colspan="2" style="border:1px solid #000;padding:6px;font-weight:700;"><span style="border:2px solid #000;background:#fef3c7;padding:2px 10px;font-size:18px;font-family:monospace;font-weight:900;margin-right:8px;display:inline-block;">\${totSoggetti}</span><span style="font-size:10.5px;font-weight:800;text-transform:uppercase;">persone censite complessivamente</span></td></tr>
          <tr><td style="width:28%;border:1px solid #000;padding:5px;font-weight:700;">Totale agganci / colloqui:</td><td colspan="2" style="border:1px solid #000;padding:5px;font-weight:700;">\${totAgganci}</td></tr>
          <tr><td rowspan="3" style="width:28%;border:1px solid #000;padding:5px;font-weight:700;vertical-align:top;">Richieste di intervento in emergenza – urgenza effettuate nel corso del servizio:</td><td style="width:12%;border:1px solid #000;padding:5px;font-weight:700;text-align:center;vertical-align:top;">CO PS:</td><td style="width:60%;border:1px solid #000;padding:5px;vertical-align:top;white-space:pre-wrap;">\${escapeHtml(state.richiesteEmergenzaCOPS || 'Nessuna //')}</td></tr>
          <tr><td style="width:12%;border:1px solid #000;padding:5px;font-weight:700;text-align:center;vertical-align:top;">CO SEA:</td><td style="width:60%;border:1px solid #000;padding:5px;vertical-align:top;white-space:pre-wrap;">\${escapeHtml(state.richiesteEmergenzaCOSEA || 'Nessuna //')}</td></tr>
          <tr><td style="width:12%;border:1px solid #000;padding:5px;font-weight:700;text-align:center;vertical-align:top;">Pronto Soccorso MXP:</td><td style="width:60%;border:1px solid #000;padding:5px;vertical-align:top;white-space:pre-wrap;">\${escapeHtml(state.richiesteEmergenzaProntoSoccorsoMXP || 'Nessuna //')}</td></tr>
          <tr><td style="border:1px solid #000;padding:5px;font-weight:700;">Richieste non urgenti:</td><td style="border:1px solid #000;padding:5px;">\${escapeHtml(state.richiesteNonUrgenti || 'Nessuna //')}</td></tr>
          <tr><td style="border:1px solid #000;padding:5px;font-weight:700;">Note:</td><td style="border:1px solid #000;padding:5px;">\${escapeHtml(state.note ? '• ' + state.note : '//')}</td></tr>
          <tr><td style="border:1px solid #000;padding:5px;font-weight:700;">Osservazioni:</td><td style="border:1px solid #000;padding:5px;">\${escapeHtml(state.osservazioni ? '• ' + state.osservazioni : '//')}</td></tr>
        </table>
      \`);

      // Page assembly
      const printRoot = document.getElementById('print-root');
      printRoot.innerHTML = '';

      const page1 = document.createElement('div');
      page1.className = 'a4-sheet';
      page1.innerHTML = firstPageHeaderHtml + '<div style="flex-grow:1;">' + blocks.slice(0, 2).join('') + '</div><footer style="text-align:center;font-size:9.5px;padding-top:4px;">Pag. 1 di 2</footer>';
      printRoot.appendChild(page1);

      if (blocks.length > 2) {
        const page2 = document.createElement('div');
        page2.className = 'a4-sheet';
        page2.innerHTML = subPageHeaderHtml + '<div style="flex-grow:1;">' + blocks.slice(2).join('') + '</div><footer style="text-align:center;font-size:9.5px;padding-top:4px;">Pag. 2 di 2</footer>';
        printRoot.appendChild(page2);
      }
    }

    function triggerPrint() {
      buildPrintPages();
      window.print();
    }

    window.addEventListener('DOMContentLoaded', initForm);
  </script>
</body>
</html>`;
}
