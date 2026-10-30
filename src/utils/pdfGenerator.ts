import { jsPDF } from 'jspdf';
import {
  CorporateHeaderConfig,
  DEFAULT_ASSOCIAZIONE_CONFIG,
  DEFAULT_COOPERATIVA_CONFIG,
  DEFAULT_ROSTER,
  ServiceReportData,
  TESTO_FISSO_LUOGO,
  TESTO_FISSO_LUOGO_INIZIO_BASE,
  TESTO_FISSO_LUOGO_TERMINE,
  TESTO_FISSO_RIFERIMENTI_EMERGENZE,
  alignSquadraToRosterOrder,
  formatDateExtendedIT,
  formatDateIT,
  indexToAlpha,
} from '../types/report';
import { extractTaggedSubjectsFromText } from './reportHistoryMemory';
import { getOfficialLogoPngDataUrl } from '../components/CityAngelsLogo';

/**
 * Renders any image DataURL into a fixed 4:3 canvas using object-fit: cover math
 * so photos of ANY original resolution or aspect ratio never distort or break pagination.
 */
function renderImageCoverToJpeg(
  dataUrl: string,
  targetWidth = 300,
  targetHeight = 224
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        const imgW = img.width || targetWidth;
        const imgH = img.height || targetHeight;
        const scale = Math.max(targetWidth / imgW, targetHeight / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const offsetX = (targetWidth - drawW) / 2;
        const offsetY = (targetHeight - drawH) / 2;

        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Pre-renders a scanned or digital signature onto a crisp canvas
 */
function renderSignatureImageForPdf(
  dataUrl: string,
  targetW = 400,
  targetH = 120
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.clearRect(0, 0, targetW, targetH);

        const imgW = img.width || targetW;
        const imgH = img.height || targetH;
        const scale = Math.min(targetW / imgW, targetH / imgH, 1);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const offsetX = (targetW - drawW) / 2;
        const offsetY = (targetH - drawH) / 2;

        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function buildReportPdfDoc(
  report: ServiceReportData,
  corporate: CorporateHeaderConfig,
  totalSubjects: number,
  totalEngagements: number
): Promise<{ doc: jsPDF; fileName: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = 210;
  const pageH = 297;
  const marginX = 14;
  const contentW = pageW - marginX * 2; // 182mm
  const colLeftW = 52;
  const colRightW = contentW - colLeftW; // 130mm
  const bottomLimitY = pageH - 20;

  const activeLogoUrl =
    corporate.logoUrl ||
    corporate.logoAssociazioneUrl ||
    corporate.logoCooperativaUrl ||
    '';

  // Load high-resolution logo with exact aspect ratio preservation
  let logoObj: { dataUrl: string; format: 'JPEG' | 'PNG'; aspectRatio: number } | null = null;
  if (activeLogoUrl) {
    const loaded = await new Promise<{ dataUrl: string; format: 'JPEG' | 'PNG'; aspectRatio: number } | null>(
      (resolve) => {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const w = img.naturalWidth || img.width || 1;
            const h = img.naturalHeight || img.height || 1;
            const isPng = activeLogoUrl.startsWith('data:image/png') || activeLogoUrl.toLowerCase().includes('.png');
            resolve({
              dataUrl: activeLogoUrl,
              format: isPng ? 'PNG' : 'JPEG',
              aspectRatio: w / h,
            });
          };
          img.onerror = () => resolve(null);
          img.src = activeLogoUrl;
        } catch {
          resolve(null);
        }
      }
    );
    if (loaded) {
      logoObj = loaded;
    }
  }

  if (!logoObj) {
    const officialPng = await getOfficialLogoPngDataUrl(1000);
    if (officialPng) {
      logoObj = { dataUrl: officialPng, format: 'PNG', aspectRatio: 1.0 };
    }
  }

  const assoc = corporate.associazione || DEFAULT_ASSOCIAZIONE_CONFIG;
  const coop = corporate.cooperativa || DEFAULT_COOPERATIVA_CONFIG;

  const photoMap = new Map<string, string>();
  for (const ril of report.rilevazioni || []) {
    for (const ph of ril.foto || []) {
      const jpeg = await renderImageCoverToJpeg(ph.dataUrl, 300, 224);
      if (jpeg) {
        photoMap.set(ph.id, jpeg);
      }
    }
  }

  let signaturePngUrl: string | null = null;
  if (report.firmaImmagineUrl) {
    signaturePngUrl = await renderSignatureImageForPdf(report.firmaImmagineUrl, 400, 120);
  }

  const presentTeam = alignSquadraToRosterOrder(report.squadra || [], DEFAULT_ROSTER);

  const compilatoreDisplay = (() => {
    const checked = presentTeam
      .filter((m) => m.isCompilatore && m.nomeCognome.trim())
      .map((m) => m.nomeCognome.trim());
    if (checked.length > 0) return checked.join(', ');
    return (report.compilatore || '').trim();
  })();

  const engagedPointsText = (() => {
    const pts: string[] = [];
    (report.rilevazioni || []).forEach((r, idx) => {
      if (r.aggancioEffettuato) {
        pts.push(`punto ${indexToAlpha(idx)}`);
      }
    });
    return pts.length > 0 ? `Cfr. ${pts.join('; ')}` : '';
  })();

  let cursorY = 12;

  // --- PAGE 1 HEADER: 1 Single Logo Centered + 2 Tailored Entity Columns ---
  const drawFirstPageHeader = () => {
    const startY = 10;
    const centerX = pageW / 2;

    // 1 SOLO LOGO AL CENTRO DELLA PAGINA CHE VALE PER TUTTE E DUE LE REALTÀ (Proporzioni native perfette)
    if (logoObj) {
      const maxBoxW = 34;
      const maxBoxH = 26;
      let drawW = maxBoxW;
      let drawH = maxBoxH;
      const aspect = logoObj.aspectRatio || 1.0;

      if (aspect >= maxBoxW / maxBoxH) {
        drawW = maxBoxW;
        drawH = maxBoxW / aspect;
      } else {
        drawH = maxBoxH;
        drawW = maxBoxH * aspect;
      }

      const drawX = centerX - drawW / 2;
      const drawY = startY + (maxBoxH - drawH) / 2;
      doc.addImage(logoObj.dataUrl, logoObj.format, drawX, drawY, drawW, drawH);
    }

    const yStartBlocks = startY + 28;
    const blockColW = (contentW - 6) / 2;
    const col1X = marginX;
    const col2X = marginX + blockColW + 6;

    // Dividier line between logo and entity blocks
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(marginX, yStartBlocks - 1.5, marginX + contentW, yStartBlocks - 1.5);

    // Vertical separator line between the 2 columns
    doc.line(col2X - 3, yStartBlocks - 1, col2X - 3, yStartBlocks + 23);

    // --- COLONNA 1: ASSOCIAZIONE NAZIONALE ---
    let y1 = yStartBlocks + 2.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    const assocNameWrapped = doc.splitTextToSize(assoc.ragioneSociale, blockColW - 3);
    doc.text(assocNameWrapped, col1X, y1);
    y1 += assocNameWrapped.length * 3.1 + 0.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(30, 41, 59);

    doc.text(`Tel. emergenze e info: ${assoc.telEmergenze || '377-5502177'}`, col1X, y1);
    y1 += 3.0;

    doc.text(`Email: ${assoc.email || 'varese@cityangels.it'}`, col1X, y1);
    y1 += 3.0;

    doc.text(`Sito internet: ${assoc.sitoWeb || 'www.cityangels.it'}`, col1X, y1);
    y1 += 3.0;

    if (assoc.codiceFiscale?.trim()) {
      doc.text(`C.F.: ${assoc.codiceFiscale.trim()}`, col1X, y1);
      y1 += 3.0;
    }

    // --- COLONNA 2: COOPERATIVA SOCIALE ---
    let y2 = yStartBlocks + 2.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(coop.ragioneSociale || 'CITY ANGELS VARESE Coop. soc.', col2X, y2);
    y2 += 3.3;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(30, 41, 59);
    doc.text(`${coop.sedeLegale || 'via Severo Piatti n° 11 - 21100 Varese'} · tel.: ${coop.telefono || '377-5502177'}`, col2X, y2);
    y2 += 3.0;

    doc.text(`Email: ${coop.email || 'coopvarese@cityangels.it'} · PEC: ${coop.pec || 'cityangelsvarese20@pec.cgn.it'}`, col2X, y2);
    y2 += 3.0;

    doc.text(`Sito: ${coop.sitoWeb || 'cityangelsvarese.netlify.app'} · C.F./P.IVA: ${coop.cfPiva || '03787870124'}`, col2X, y2);
    y2 += 3.0;

    doc.setFontSize(5.8);
    doc.setTextColor(71, 85, 105);
    const regWrapped = doc.splitTextToSize(coop.iscrizioniRegistri || '', blockColW);
    doc.text(regWrapped, col2X, y2);
    y2 += regWrapped.length * 2.5;

    cursorY = Math.max(y1, y2) + 3;
  };

  // --- SUBSEQUENT PAGES HEADER: Only Compact Single Official Logo Centered ---
  const drawSubsequentPageHeader = () => {
    const startY = 9;
    const centerX = pageW / 2;
    if (logoObj) {
      const maxBoxW = 24;
      const maxBoxH = 18;
      let drawW = maxBoxW;
      let drawH = maxBoxH;
      const aspect = logoObj.aspectRatio || 1.0;

      if (aspect >= maxBoxW / maxBoxH) {
        drawW = maxBoxW;
        drawH = maxBoxW / aspect;
      } else {
        drawH = maxBoxH;
        drawW = maxBoxH * aspect;
      }

      const drawX = centerX - drawW / 2;
      const drawY = startY + (maxBoxH - drawH) / 2;
      doc.addImage(logoObj.dataUrl, logoObj.format, drawX, drawY, drawW, drawH);
    }
    cursorY = startY + 22;
  };

  const ensureSpace = (neededHeightMm: number) => {
    if (cursorY + neededHeightMm > bottomLimitY) {
      doc.addPage();
      drawSubsequentPageHeader();
    }
  };

  // Start Page 1
  drawFirstPageHeader();

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);

  // 1. Row: REPORT DI SERVIZIO n. 36
  const titleRowH = 10;
  ensureSpace(titleRowH);
  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, cursorY, contentW, titleRowH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `REPORT DI SERVIZIO n. ${report.numeroReport ?? 36}`,
    pageW / 2,
    cursorY + 6.8,
    { align: 'center' }
  );
  cursorY += titleRowH;

  // 2. Row: Compilato da & Firma
  const compilatoRowH = 15;
  ensureSpace(compilatoRowH);
  doc.setFillColor(255, 255, 255);
  doc.rect(marginX, cursorY, contentW, compilatoRowH, 'FD');

  const compLabelW = contentW * 0.52;
  const compValW = contentW * 0.24;
  const compSignW = contentW - compLabelW - compValW;

  doc.line(marginX + compLabelW, cursorY, marginX + compLabelW, cursorY + compilatoRowH);
  doc.line(
    marginX + compLabelW + compValW,
    cursorY,
    marginX + compLabelW + compValW,
    cursorY + compilatoRowH
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Compilato da:', marginX + compLabelW - 3, cursorY + 10, {
    align: 'right',
  });

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(9);
  doc.text(
    compilatoreDisplay || '—',
    marginX + compLabelW + compValW / 2,
    cursorY + 10,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Firma (Compilatore):', marginX + compLabelW + compValW + 2, cursorY + 4);

  if (signaturePngUrl) {
    try {
      doc.addImage(
        signaturePngUrl,
        'PNG',
        marginX + compLabelW + compValW + 3,
        cursorY + 5.5,
        compSignW - 6,
        compilatoRowH - 7
      );
    } catch {
      // ignore
    }
  } else {
    // Campo firma lasciato vuoto per apposizione manuale autografa post-stampa (come richiesto)
  }
  cursorY += compilatoRowH;

  // Helper for generic 2-column table rows
  const drawTableRow = (
    label: string,
    value: string,
    boldVal = false,
    extraLines: string[] = [],
    customValFontSize = 8
  ) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const labelLines = doc.splitTextToSize(label, colLeftW - 4);

    const valFontSize = customValFontSize || 8;
    doc.setFont('helvetica', boldVal ? 'bold' : 'normal');
    doc.setFontSize(valFontSize);
    const valLines = doc.splitTextToSize(value, colRightW - 4);
    const totalLinesCount = Math.max(
      labelLines.length,
      valLines.length + extraLines.length
    );
    const rowH = Math.max(valFontSize >= 10 ? 9.5 : 8, totalLinesCount * 4 + 3);

    ensureSpace(rowH);
    doc.setFillColor(255, 255, 255);
    doc.rect(marginX, cursorY, contentW, rowH, 'FD');
    doc.line(marginX + colLeftW, cursorY, marginX + colLeftW, cursorY + rowH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(labelLines, marginX + 2, cursorY + (rowH > 8 ? 6 : 5));

    doc.setFont('helvetica', boldVal ? 'bold' : 'normal');
    doc.setFontSize(valFontSize);
    doc.text(valLines, marginX + colLeftW + 2, cursorY + (rowH > 8 ? 6.2 : 5));

    if (extraLines.length > 0) {
      let extraY = cursorY + 5 + valLines.length * 4;
      extraLines.forEach((el) => {
        doc.text(el, marginX + colLeftW + 2, extraY);
        extraY += 4;
      });
    }

    cursorY += rowH;
  };

  // 3. Luogo: Aeroporto internazionale MXP, T1
  drawTableRow('Luogo:', TESTO_FISSO_LUOGO, true);

  // 4. Riferimenti emergenze fisso
  drawTableRow('Riferimenti emergenze:', TESTO_FISSO_RIFERIMENTI_EMERGENZE);

  // 5. Data del servizio (in grassetto, evidenziata e grandezza ~10.5pt simile al titolo report)
  drawTableRow(
    'Data del servizio:',
    report.data ? formatDateExtendedIT(report.data).toUpperCase() : '—',
    true,
    [],
    10.5
  );

  // 6. Orario del servizio (o orari multipli)
  const slots =
    report.orariServizio && report.orariServizio.length > 0
      ? report.orariServizio.filter((s) => s.oraInizio?.trim() || s.oraFine?.trim() || s.descrizione?.trim())
      : [];

  if (slots.length > 1) {
    const lines = slots.map((s, idx) => {
      const descPart = s.descrizione ? ` (${s.descrizione})` : '';
      return `Servizio ${idx + 1}: dalle ore ${s.oraInizio || '—'} alle ore ${s.oraFine || '—'}${descPart}`;
    });
    drawTableRow(`Orari dei servizi (${slots.length}):`, lines.join('\n'));
  } else {
    const s = slots[0];
    const oraIni = s?.oraInizio || report.oraInizio || '—';
    const oraFin = s?.oraFine || report.oraFine || '—';
    const desc = s?.descrizione || report.orarioTestoLibero || '';
    const orarioVal = `dalle ore: ${oraIni}  alle ore: ${oraFin}${desc ? ` (${desc})` : ''}`;
    drawTableRow('Orario del servizio:', orarioVal);
  }

  // 7. Luogo inizio servizio: Parcheggio P1 + 2 aperture sbarra
  const barrierEntries = report.apertureSbarraInizio || [
    { ora: '', targa: '' },
    { ora: '', targa: '' },
  ];
  const bLines = barrierEntries
    .filter((b) => b.ora.trim() || b.targa.trim())
    .map(
      (b) =>
        `${TESTO_FISSO_LUOGO_INIZIO_BASE} (apertura sbarra ore ${
          b.ora.trim() || '_____'
        } tramite lettura targa mezzo ${b.targa.trim().toUpperCase() || '_________'})`
    );
  if (bLines.length === 0) {
    bLines.push(
      `${TESTO_FISSO_LUOGO_INIZIO_BASE} (apertura sbarra ore _____ tramite lettura targa mezzo _________)`
    );
  }
  drawTableRow('Luogo inizio servizio:', bLines[0], false, bLines.slice(1));

  // 8. Luogo termine servizio: Parcheggio P1 (apertura sbarra tramite lettura targa mezzi)
  drawTableRow('Luogo termine servizio:', TESTO_FISSO_LUOGO_TERMINE);

  // 9. Comunicazione inizio servizio a CO PS: Effettuata, ore [INPUT]
  drawTableRow(
    'Comunicazione inizio servizio a CO PS:',
    `Effettuata, ore ${report.comunicazioneInizioCO || '______'}`
  );

  // 10. Comunicazione fine servizio a CO PS: Effettuata, ore [INPUT]
  drawTableRow(
    'Comunicazione fine servizio a CO PS:',
    `Effettuata, ore ${report.comunicazioneFineCO || '______'}`
  );

  // --- SQUADRA IN SERVIZIO TABLE ---
  cursorY += 2;
  const squadraHeaderH = 7;
  ensureSpace(squadraHeaderH + 18);
  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, cursorY, contentW, squadraHeaderH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Squadra in Servizio', marginX + 3, cursorY + 4.8);
  cursorY += squadraHeaderH;

  // Subheader columns
  const colIdxW = 10;
  const colOpW = 54;
  const colQualW = 86;
  const colCapoW = 16;
  const colCompW = 16;
  const subH = 6;
  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, cursorY, contentW, subH, 'FD');
  doc.setFontSize(7.5);
  doc.text('N°', marginX + colIdxW / 2, cursorY + 4.2, { align: 'center' });
  doc.text('Operatore (Nome e Cognome)', marginX + colIdxW + 2, cursorY + 4.2);
  doc.text(
    'Qualifica Ufficiale',
    marginX + colIdxW + colOpW + 2,
    cursorY + 4.2
  );
  doc.text(
    'Caposerv.',
    marginX + colIdxW + colOpW + colQualW + colCapoW / 2,
    cursorY + 4.2,
    { align: 'center' }
  );
  doc.text(
    'Compilat.',
    marginX + colIdxW + colOpW + colQualW + colCapoW + colCompW / 2,
    cursorY + 4.2,
    { align: 'center' }
  );
  doc.line(marginX + colIdxW, cursorY, marginX + colIdxW, cursorY + subH);
  doc.line(
    marginX + colIdxW + colOpW,
    cursorY,
    marginX + colIdxW + colOpW,
    cursorY + subH
  );
  doc.line(
    marginX + colIdxW + colOpW + colQualW,
    cursorY,
    marginX + colIdxW + colOpW + colQualW,
    cursorY + subH
  );
  doc.line(
    marginX + colIdxW + colOpW + colQualW + colCapoW,
    cursorY,
    marginX + colIdxW + colOpW + colQualW + colCapoW,
    cursorY + subH
  );
  cursorY += subH;

  // Squadra rows
  presentTeam.forEach((m, idx) => {
    const displayName = m.nomeCognome?.trim()
      ? `${m.nomeCognome.trim()}${
          m.nickname?.trim() ? ` "${m.nickname.trim()}"` : ''
        }`
      : ' ';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const qualLines = doc.splitTextToSize(m.qualifica || '—', colQualW - 4);
    const rowH = Math.max(7.5, qualLines.length * 3.3 + 2.5);

    ensureSpace(rowH);
    doc.setFillColor(255, 255, 255);
    doc.rect(marginX, cursorY, contentW, rowH, 'FD');

    doc.line(marginX + colIdxW, cursorY, marginX + colIdxW, cursorY + rowH);
    doc.line(
      marginX + colIdxW + colOpW,
      cursorY,
      marginX + colIdxW + colOpW,
      cursorY + rowH
    );
    doc.line(
      marginX + colIdxW + colOpW + colQualW,
      cursorY,
      marginX + colIdxW + colOpW + colQualW,
      cursorY + rowH
    );
    doc.line(
      marginX + colIdxW + colOpW + colQualW + colCapoW,
      cursorY,
      marginX + colIdxW + colOpW + colQualW + colCapoW,
      cursorY + rowH
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(idx + 1), marginX + colIdxW / 2, cursorY + 4.8, {
      align: 'center',
    });

    doc.setFont('helvetica', 'normal');
    doc.text(displayName, marginX + colIdxW + 2, cursorY + 4.8);

    doc.setFontSize(6.8);
    doc.text(qualLines, marginX + colIdxW + colOpW + 2, cursorY + 4.2);

    // Checkbox Caposervizio
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      m.isCaposervizio ? '[ X ]' : '[   ]',
      marginX + colIdxW + colOpW + colQualW + colCapoW / 2,
      cursorY + 4.8,
      { align: 'center' }
    );

    // Checkbox Compilatore
    doc.text(
      m.isCompilatore ? '[ X ]' : '[   ]',
      marginX + colIdxW + colOpW + colQualW + colCapoW + colCompW / 2,
      cursorY + 4.8,
      { align: 'center' }
    );

    cursorY += rowH;
  });

  // Personale esterno in affiancamento
  const extH = 8;
  ensureSpace(extH);
  doc.setFillColor(255, 255, 255);
  doc.rect(marginX, cursorY, contentW, extH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Personale esterno in affiancamento: ', marginX + 3, cursorY + 5.2);
  doc.setFont('helvetica', 'italic');
  doc.text(
    report.personaleEsternoAffiancamento?.trim() || 'Nessuno //',
    marginX + 55,
    cursorY + 5.2
  );
  cursorY += extH + 3;

  // --- RILEVAZIONI SECTION ---
  ensureSpace(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RILEVAZIONI E INTERVENTI EFFETTUATI', marginX, cursorY);
  doc.setLineWidth(0.4);
  doc.line(marginX, cursorY + 1.5, marginX + contentW, cursorY + 1.5);
  cursorY += 4;

  (report.rilevazioni || []).forEach((r, idx) => {
    const alpha = indexToAlpha(idx);
    const luogo = (r.luogoIndividuazione || r.areaTerminal || '').trim();
    const taggedSubs = [
      ...(r.nominativiAssociati || []),
      ...extractTaggedSubjectsFromText(r.descrizione || ''),
    ];
    const uniqueSubs = Array.from(new Set(taggedSubs));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const descText = (r.descrizione || '').trim();
    const descLines = descText ? doc.splitTextToSize(descText, contentW - 6) : [];

    const photos = r.foto || [];
    const photoRowH = photos.length > 0 ? 32 : 0;
    const tagsH = uniqueSubs.length > 0 ? 5.5 : 0;
    const descH = descLines.length > 0 ? descLines.length * 3.6 : 3;
    const estRilH = 7 + tagsH + descH + photoRowH + 4;

    ensureSpace(estRilH);

    // Box Header for Rilevazione
    const rilHeaderH = 6.5;
    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, cursorY, contentW, rilHeaderH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `PUNTO ${alpha}  |  Luogo di individuazione: ${luogo || '—'}`,
      marginX + 2.5,
      cursorY + 4.5
    );

    const rightMeta = `Utenti: ${r.numeroUtenti ?? 0}  |  Colloquio/Aggancio: ${
      r.aggancioEffettuato ? '[ Sì ]' : '[ No ]'
    }`;
    doc.setFontSize(7.5);
    doc.text(rightMeta, marginX + contentW - 2.5, cursorY + 4.5, {
      align: 'right',
    });
    cursorY += rilHeaderH;

    // Content container
    const contentH = estRilH - rilHeaderH;
    doc.setFillColor(255, 255, 255);
    doc.rect(marginX, cursorY, contentW, contentH, 'FD');

    let innerY = cursorY + 4;

    if (uniqueSubs.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(180, 83, 9);
      doc.text(
        `Soggetti/Nominativi individuati: ${uniqueSubs.join(', ')}`,
        marginX + 3,
        innerY
      );
      innerY += 4.5;
    }

    if (descLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(descLines, marginX + 3, innerY);
      innerY += descLines.length * 3.6 + 2;
    } else {
      // Lascia il campo in bianco senza alcuna dicitura
      innerY += 3;
    }

    // Render photos if present
    if (photos.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text(`FOTO DOCUMENTARIE PUNTO ${alpha}:`, marginX + 3, innerY);
      innerY += 3;

      const pW = 34;
      const pH = 24;
      let pX = marginX + 3;
      photos.slice(0, 4).forEach((p) => {
        const jpeg = photoMap.get(p.id);
        if (jpeg) {
          try {
            doc.addImage(jpeg, 'JPEG', pX, innerY, pW, pH);
            doc.setDrawColor(203, 213, 225);
            doc.rect(pX, innerY, pW, pH);
          } catch {
            // ignore image drawing errors
          }
        }
        pX += pW + 3;
      });
      innerY += pH + 2;
    }

    cursorY += contentH + 2;
  });

  // --- FINAL SUMMARY TABLE ---
  cursorY += 2;
  const summaryBoxH = 50;
  ensureSpace(summaryBoxH);

  // 1. Totale soggetti individuati - Mettiamo in evidenza il numero di presenze censite a livello grafico
  const drawTotaleSoggettiRow = () => {
    const label = 'Totale soggetti individuati nel corso del servizio:';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const labelLines = doc.splitTextToSize(label, colLeftW - 4);
    const rowH = 12;

    ensureSpace(rowH);
    doc.setFillColor(255, 255, 255);
    doc.rect(marginX, cursorY, contentW, rowH, 'FD');
    doc.line(marginX + colLeftW, cursorY, marginX + colLeftW, cursorY + rowH);

    doc.text(labelLines, marginX + 2, cursorY + 5);

    // Evidenziatore Grafico Giallo/Amber per il numero di presenze censite
    const badgeX = marginX + colLeftW + 3;
    const badgeY = cursorY + 1.8;
    const badgeW = 16;
    const badgeH = 8.4;
    doc.setFillColor(254, 243, 199); // amber-100
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.rect(badgeX, badgeY, badgeW, badgeH, 'FD');

    // Numero con carattere molto più grande
    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(String(totalSubjects), badgeX + badgeW / 2, badgeY + 6, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('persone censite complessivamente', badgeX + badgeW + 4, badgeY + 5.5);

    doc.setLineWidth(0.2); // reset
    cursorY += rowH;
  };

  drawTotaleSoggettiRow();

  // Totale agganci / colloqui
  drawTableRow(
    'Totale agganci / colloqui:',
    `${totalEngagements} ${engagedPointsText ? `(${engagedPointsText})` : ''}`,
    true
  );

  // 2. Richieste emergenza CO PS, CO SEA & Pronto Soccorso MXP
  const drawEmergencyRequestsRows = () => {
    const leftHeaderLabel = 'Richieste di intervento in emergenza – urgenza effettuate nel corso del servizio:';
    const copsText = report.richiesteEmergenzaCOPS?.trim() || report.richiesteEmergenza?.trim() || 'Nessuna //';
    const coseaText = report.richiesteEmergenzaCOSEA?.trim() || 'Nessuna //';
    const psMxpText = report.richiesteEmergenzaProntoSoccorsoMXP?.trim() || 'Nessuna //';

    const col1W = 50; // Prima colonna titolo
    const col2W = 30; // Seconda colonna etichetta emergenza (CO PS / CO SEA / Pronto Soccorso MXP)
    const col3W = contentW - col1W - col2W; // Terza colonna per il testo di dettaglio

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const copsValLines = doc.splitTextToSize(copsText, col3W - 4);
    const coseaValLines = doc.splitTextToSize(coseaText, col3W - 4);
    const psMxpValLines = doc.splitTextToSize(psMxpText, col3W - 4);

    const copsRowH = Math.max(6.5, copsValLines.length * 3.5 + 2.5);
    const coseaRowH = Math.max(6.5, coseaValLines.length * 3.5 + 2.5);
    const psMxpRowH = Math.max(6.5, psMxpValLines.length * 3.5 + 2.5);
    const totalEmergH = copsRowH + coseaRowH + psMxpRowH;

    ensureSpace(totalEmergH);

    // Disegna box principale
    doc.setFillColor(255, 255, 255);
    doc.rect(marginX, cursorY, contentW, totalEmergH, 'FD');

    // Linee di divisione verticali tra le 3 colonne
    doc.line(marginX + col1W, cursorY, marginX + col1W, cursorY + totalEmergH);
    doc.line(marginX + col1W + col2W, cursorY, marginX + col1W + col2W, cursorY + totalEmergH);

    // Linee orizzontali separatori tra le righe
    doc.line(marginX + col1W, cursorY + copsRowH, marginX + contentW, cursorY + copsRowH);
    doc.line(marginX + col1W, cursorY + copsRowH + coseaRowH, marginX + contentW, cursorY + copsRowH + coseaRowH);

    // Titolo sinistro
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const labelLines = doc.splitTextToSize(leftHeaderLabel, col1W - 4);
    doc.text(labelLines, marginX + 2, cursorY + 4.5);

    // Riga CO PS
    doc.setFont('helvetica', 'bold');
    doc.text('CO PS:', marginX + col1W + 1.5, cursorY + 4.2);
    doc.setFont('helvetica', 'normal');
    doc.text(copsValLines, marginX + col1W + col2W + 2, cursorY + 4.2);

    // Riga CO SEA
    const coseaY = cursorY + copsRowH;
    doc.setFont('helvetica', 'bold');
    doc.text('CO SEA:', marginX + col1W + 1.5, coseaY + 4.2);
    doc.setFont('helvetica', 'normal');
    doc.text(coseaValLines, marginX + col1W + col2W + 2, coseaY + 4.2);

    // Riga Pronto Soccorso MXP
    const psMxpY = cursorY + copsRowH + coseaRowH;
    doc.setFont('helvetica', 'bold');
    doc.text('Pronto Soccorso MXP:', marginX + col1W + 1.5, psMxpY + 4.2);
    doc.setFont('helvetica', 'normal');
    doc.text(psMxpValLines, marginX + col1W + col2W + 2, psMxpY + 4.2);

    cursorY += totalEmergH;
  };

  drawEmergencyRequestsRows();

  // Richieste non urgenti
  drawTableRow(
    'Richieste di intervento non urgenti:',
    report.richiesteNonUrgenti?.trim() || 'Nessuna //'
  );

  // Note
  drawTableRow(
    'Note:',
    report.note?.trim() ? `• ${report.note.trim()}` : '//'
  );

  // Osservazioni
  drawTableRow(
    'Osservazioni:',
    report.osservazioni?.trim() ? `• ${report.osservazioni.trim()}` : '//'
  );

  // Add Page Numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Pag. ${p} di ${totalPages}`, pageW / 2, pageH - 8, {
      align: 'center',
    });
  }

  const safeNum = String(report.numeroReport ?? 36).padStart(2, '0');
  const safeDate = (report.data || 'data').replace(/-/g, '.');
  const fileName = `${safeNum}_Report_Servizio_MXP_${safeDate}.pdf`;

  return { doc, fileName };
}

export async function generateReportPdfBlob(
  report: ServiceReportData,
  corporate: CorporateHeaderConfig,
  totalSubjects: number,
  totalEngagements: number
): Promise<{ blob: Blob; fileName: string }> {
  const { doc, fileName } = await buildReportPdfDoc(
    report,
    corporate,
    totalSubjects,
    totalEngagements
  );
  return { blob: doc.output('blob'), fileName };
}

export async function generateAndDownloadReportPdf(
  report: ServiceReportData,
  corporate: CorporateHeaderConfig,
  totalSubjects: number,
  totalEngagements: number
): Promise<string> {
  const { doc, fileName } = await buildReportPdfDoc(
    report,
    corporate,
    totalSubjects,
    totalEngagements
  );
  doc.save(fileName);
  return fileName;
}

/**
 * Generates the official 4-page Consolidated Statistical Report PDF (Modello Ufficiale Presenze)
 */
export async function generateStatisticsPdf(
  rows: {
    numeroReport: number;
    data: string;
    caposervizio?: string;
    presenze: number;
    colloqui: number;
    affiancamentoSaracino: string;
  }[]
): Promise<string> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = 210;
  const pageH = 297;
  const marginX = 14;
  const contentW = pageW - marginX * 2; // 182mm

  // Aggregati
  const totalReports = rows.length || 34;
  const totalPresenze = rows.reduce((s, r) => sumPresenze(s, r.presenze), 0) || 1374;
  const mediaPresenze = (totalPresenze / totalReports).toFixed(1);

  function sumPresenze(s: number, p: number) {
    return s + (Number.isFinite(p) ? p : 0);
  }

  const piccoMax = [...rows].sort((a, b) => b.presenze - a.presenze)[0] || {
    presenze: 75,
    numeroReport: 3,
    data: '2026-01-22',
  };
  const ordRows = rows.filter((r) => r.presenze >= 15);
  const piccoMin = [...(ordRows.length ? ordRows : rows)].sort(
    (a, b) => a.presenze - b.presenze
  )[0] || { presenze: 31, numeroReport: 23, data: '2026-06-11' };

  const footerText =
    'City Angels Italia OdV - Coordinamento Provinciale di Varese - CITY ANGELS VARESE Coop. soc.';

  // --- PAGINA 1 ---
  // Banner Rosso
  doc.setFillColor(223, 10, 20); // #df0a14
  doc.rect(marginX, 14, contentW, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('Report Statistico Aggiornato', marginX + 5, 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    'Servizi a Milano Malpensa T1 | Periodo: Gennaio – Settembre 2026',
    marginX + 5,
    30
  );

  // Introduzione
  let y = 43;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const introText =
    "Il presente documento integra le rilevazioni del primo semestre (gennaio-giugno 2026) con i dati estratti dai report operativi successivi. L'obiettivo è fornire un quadro aggiornato, consolidato e preciso della fenomenologia legata alla marginalità estrema e alla stanzialità all'interno dell'hub internazionale di Malpensa.";
  const introLines = doc.splitTextToSize(introText, contentW);
  doc.text(introLines, marginX, y);
  y += introLines.length * 4 + 5;

  // Titolo Sezione Metriche
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Metriche Operative Complessive', marginX, y);
  y += 5;

  // 3 KPI Boxes
  const boxW = (contentW - 8) / 3; // ~58mm
  const boxH = 26;

  // Box 1
  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, y, boxW, boxH, 'F');
  doc.setFillColor(223, 10, 20);
  doc.rect(marginX, y, boxW, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(String(totalPresenze), marginX + boxW / 2, y + 12, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('PRESENZE INTERCETTATE', marginX + boxW / 2, y + 18, { align: 'center' });
  doc.text('(GEN-SET 2026)', marginX + boxW / 2, y + 22, { align: 'center' });

  // Box 2
  const b2X = marginX + boxW + 4;
  doc.setFillColor(248, 250, 252);
  doc.rect(b2X, y, boxW, boxH, 'F');
  doc.setFillColor(223, 10, 20);
  doc.rect(b2X, y, boxW, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(String(mediaPresenze), b2X + boxW / 2, y + 12, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('MEDIA PRESENZE', b2X + boxW / 2, y + 18, { align: 'center' });
  doc.text('PER SINGOLA USCITA', b2X + boxW / 2, y + 22, { align: 'center' });

  // Box 3
  const b3X = b2X + boxW + 4;
  doc.setFillColor(248, 250, 252);
  doc.rect(b3X, y, boxW, boxH, 'F');
  doc.setFillColor(223, 10, 20);
  doc.rect(b3X, y, boxW, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(String(totalReports), b3X + boxW / 2, y + 12, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('REPORT ANALIZZATI', b3X + boxW / 2, y + 18, { align: 'center' });
  doc.text('E CONSOLIDATI', b3X + boxW / 2, y + 22, { align: 'center' });

  y += boxH + 8;

  // Genere e Nazionalità Cards
  const subBoxW = (contentW - 6) / 2;
  const subBoxH = 34;

  // Genere
  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, y, subBoxW, subBoxH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Suddivisione per Genere', marginX + subBoxW / 2, y + 6, {
    align: 'center',
  });

  doc.setFontSize(7.5);
  doc.text('Uomini (~82%)', marginX + 6, y + 13);
  doc.setFillColor(30, 41, 59);
  doc.rect(marginX + 6, y + 15, subBoxW - 12, 3, 'F');

  doc.text('Donne (~18%)', marginX + 6, y + 24);
  doc.setFillColor(223, 10, 20);
  doc.rect(marginX + 6, y + 26, (subBoxW - 12) * 0.18, 3, 'F');

  // Nazionalità
  const n2X = marginX + subBoxW + 6;
  doc.setFillColor(248, 250, 252);
  doc.rect(n2X, y, subBoxW, subBoxH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Nazionalità (Estima)', n2X + subBoxW / 2, y + 6, {
    align: 'center',
  });

  doc.setFontSize(7.5);
  doc.text('Italiani (~58%)', n2X + 6, y + 13);
  doc.setFillColor(30, 41, 59);
  doc.rect(n2X + 6, y + 15, (subBoxW - 12) * 0.58, 3, 'F');

  doc.text('Stranieri (~42%)', n2X + 6, y + 24);
  doc.setFillColor(37, 99, 235);
  doc.rect(n2X + 6, y + 26, (subBoxW - 12) * 0.42, 3, 'F');

  y += subBoxH + 8;

  // Nota Metodologica
  doc.setFillColor(254, 242, 242); // bg-red-50
  doc.rect(marginX, y, contentW, 58, 'F');
  doc.setFillColor(223, 10, 20);
  doc.rect(marginX, y, 1.5, 58, 'F');

  let ny = y + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(223, 10, 20);
  doc.text('Nota Metodologica: Tolleranza del 10-20% in più', marginX + 5, ny);
  ny += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  const noteBody =
    'I dati quantitativi raccolti rappresentano una stima attendibile ma prudenziale. Le presenze reali all\'interno dello scalo sono stimabili complessivamente in un 10-20% in più rispetto ai conteggi riportati. Tale fisiologica sottostima è dovuta a:';
  const noteLines = doc.splitTextToSize(noteBody, contentW - 10);
  doc.text(noteLines, marginX + 5, ny);
  ny += noteLines.length * 3.8 + 3;

  doc.text(
    '• Il tempo impiegato per svolgere lunghi colloqui clinico-psicologici, che rallenta il censimento globale.',
    marginX + 7,
    ny
  );
  ny += 4.5;
  doc.text(
    '• La necessità di trattenere le squadre in specifici quadranti per gestire situazioni emergenziali.',
    marginX + 7,
    ny
  );
  ny += 4.5;
  doc.text(
    '• L\'estrema vastità del Terminal 1, che preclude la possibilità di percorrere in forma simultanea tutte le aree.',
    marginX + 7,
    ny
  );

  // Footer Pag 1
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(footerText, marginX, pageH - 8);
  doc.text('Pagina 1 di 4', pageW - marginX, pageH - 8, { align: 'right' });

  // --- PAGINA 2 ---
  doc.addPage();
  y = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Analisi dei Picchi e Cooperazione Istituzionale', marginX, y);
  doc.setLineWidth(0.3);
  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, y + 2, marginX + contentW, y + 2);
  y += 8;

  // 3 Boxes Picchi
  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, y, boxW, boxH, 'F');
  doc.setFillColor(37, 99, 235);
  doc.rect(marginX, y, boxW, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(37, 99, 235);
  doc.text('PICCO MASSIMO RILEVATO', marginX + boxW / 2, y + 5, { align: 'center' });
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(`${piccoMax.presenze} presenze`, marginX + boxW / 2, y + 14, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Report n.${piccoMax.numeroReport} (${formatDateIT(piccoMax.data)})`,
    marginX + boxW / 2,
    y + 20,
    { align: 'center' }
  );

  doc.setFillColor(248, 250, 252);
  doc.rect(b2X, y, boxW, boxH, 'F');
  doc.setFillColor(37, 99, 235);
  doc.rect(b2X, y, boxW, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(37, 99, 235);
  doc.text('PICCO MINIMO (ORDINARIO)', b2X + boxW / 2, y + 5, { align: 'center' });
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(`${piccoMin.presenze} presenze`, b2X + boxW / 2, y + 14, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Report n.${piccoMin.numeroReport} (${formatDateIT(piccoMin.data)})`,
    b2X + boxW / 2,
    y + 20,
    { align: 'center' }
  );

  doc.setFillColor(248, 250, 252);
  doc.rect(b3X, y, boxW, boxH, 'F');
  doc.setFillColor(37, 99, 235);
  doc.rect(b3X, y, boxW, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(37, 99, 235);
  doc.text('ETÀ MEDIA UTENZA', b3X + boxW / 2, y + 5, { align: 'center' });
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('49–52 anni', b3X + boxW / 2, y + 14, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Media Ponderata', b3X + boxW / 2, y + 20, { align: 'center' });

  y += boxH + 6;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    '*Nota al picco minimo: Il valore assoluto più basso è di 10 presenze (Report n. 6 del 12/02/2026), tuttavia si trattava di un turno speciale limitato al Terminal 2.',
    marginX,
    y
  );
  y += 8;

  // Box Affiancamento Ispettore Saracino
  doc.setFillColor(240, 246, 255);
  doc.rect(marginX, y, contentW, 46, 'F');
  doc.setLineWidth(0.3);
  doc.setDrawColor(191, 219, 254);
  doc.rect(marginX, y, contentW, 46, 'D');

  let py = y + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text('Affiancamenti e interventi congiunti con Ispettore C. Saracino', marginX + 5, py);
  py += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  const polBody =
    "L'accuratezza nel rinvenimento e nella raccolta dei dati anagrafici dell'utenza stanziale è resa possibile dalla costante sinergia operativa sul campo. Le uscite congiunte con la Polizia di Frontiera si sono rivelate determinanti. In particolare, si segnala il prezioso e costante supporto fornito dall'Ispettore Christian Saracino, il cui intervento diretto ha permesso l'identificazione formale di soggetti problematici, l'esecuzione di provvedimenti di allontanamento (DASPO) e la supervisione delle operazioni di rimpatrio volontario assistito.";
  const polLines = doc.splitTextToSize(polBody, contentW - 10);
  doc.text(polLines, marginX + 5, py);

  y += 54;

  // Testo sui recenti 9 report
  const recText =
    "Nel corso degli ultimi report, in aggiunta al tasso medio di contatti stabilizzato nei mesi invernali, sono stati portati a termine nuovi agganci/colloqui operativi. Tali interventi hanno permesso di aggiornare l'anagrafica e di inquadrare clinicamente nuovi soggetti emersi nello scalo a seguito delle ondate di calore estive, che hanno trasformato l'aerostazione climatizzata in un polo attrattivo per il periodo caldo.";
  const recLines = doc.splitTextToSize(recText, contentW);
  doc.text(recLines, marginX, y);

  // Footer Pag 2
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(footerText, marginX, pageH - 8);
  doc.text('Pagina 2 di 4', pageW - marginX, pageH - 8, { align: 'right' });

  // --- PAGINE 3 e 4: REGISTRO STORICO TABELLARE ---
  const part1 = rows.slice(0, 19);
  const part2 = rows.slice(19);

  // Helper per disegnare la tabella
  const drawTablePage = (
    title: string,
    pageData: typeof rows,
    pageNumber: number
  ) => {
    doc.addPage();
    let ty = 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(title, marginX, ty);
    doc.setLineWidth(0.3);
    doc.setDrawColor(203, 213, 225);
    doc.line(marginX, ty + 2, marginX + contentW, ty + 2);
    ty += 8;

    // Table Header
    const rowH = 8;
    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, ty, contentW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    doc.text('Report N.', marginX + 4, ty + 5.5);
    doc.text('Data', marginX + 25, ty + 5.5);
    doc.text('Caposervizio', marginX + 54, ty + 5.5);
    doc.text('Presenze', marginX + 104, ty + 5.5, { align: 'center' });
    doc.text('Colloqui', marginX + 128, ty + 5.5, { align: 'center' });
    doc.text('Affiancamento', marginX + 144, ty + 5.5);

    ty += rowH;

    // Table Rows
    pageData.forEach((r) => {
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, ty + rowH, marginX + contentW, ty + rowH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(String(r.numeroReport), marginX + 8, ty + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.text(formatDateIT(r.data), marginX + 25, ty + 5.5);
      doc.text(r.caposervizio || 'Andrea Menegotto', marginX + 54, ty + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.text(String(r.presenze), marginX + 104, ty + 5.5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.text(String(r.colloqui), marginX + 128, ty + 5.5, { align: 'center' });

      if (r.affiancamentoSaracino) {
        doc.setFillColor(239, 246, 255);
        doc.rect(marginX + 142, ty + 1.5, 38, 5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(30, 58, 138);
        doc.text(r.affiancamentoSaracino, marginX + 144, ty + 5);
      }

      ty += rowH;
    });

    // Footer
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(footerText, marginX, pageH - 8);
    doc.text(`Pagina ${pageNumber} di 4`, pageW - marginX, pageH - 8, {
      align: 'right',
    });
  };

  drawTablePage('Registro Storico Presenze (Parte 1: Gen - Mag)', part1, 3);
  drawTablePage('Registro Storico Presenze (Parte 2: Mag - Set)', part2, 4);

  const statsFileName = `Report_Statistico_Presenze_MXP_2026.pdf`;
  doc.save(statsFileName);
  return statsFileName;
}
