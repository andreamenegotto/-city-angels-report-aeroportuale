import React from 'react';

export const OFFICIAL_CITY_ANGELS_SVG = `<svg width="280" height="280" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <path id="ca-top-arc" d="M 28,124 A 92,92 0 1,1 212,124" fill="none" />
    <path id="ca-bottom-arc" d="M 28,130 A 94,94 0 0,0 212,130" fill="none" />
    <clipPath id="ca-skyline-clip">
      <circle cx="120" cy="124" r="68" />
    </clipPath>
  </defs>

  <!-- Outer white disc background without artificial red border -->
  <circle cx="120" cy="120" r="118" fill="#FFFFFF" />

  <!-- Top Curved Text: CITY ANGELS -->
  <text fill="#DF0A14" font-family="Georgia, 'Times New Roman', Times, serif" font-weight="900" font-size="28" letter-spacing="3.5">
    <textPath xlink:href="#ca-top-arc" href="#ca-top-arc" startOffset="50%" text-anchor="middle">
      CITY ANGELS
    </textPath>
  </text>

  <!-- Bottom Curved Text: SOLIDARIETÀ E SICUREZZA -->
  <text fill="#DF0A14" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="14.5" letter-spacing="1.4">
    <textPath xlink:href="#ca-bottom-arc" href="#ca-bottom-arc" startOffset="50%" text-anchor="middle">
      SOLIDARIETÀ E SICUREZZA
    </textPath>
  </text>

  <!-- Eagle with open wings (Red outline on white) -->
  <g stroke="#DF0A14" stroke-width="2.8" fill="#FFFFFF" stroke-linejoin="round">
    <path d="M 105,74 C 92,54 72,58 58,84 C 48,104 44,120 44,132 C 52,124 58,114 64,104 C 60,116 56,124 56,130 C 64,122 70,112 75,102 C 72,114 69,120 68,126 C 76,118 82,108 86,98 C 84,108 82,115 80,120 C 88,112 94,102 98,92 Z" />
    <path d="M 135,74 C 148,54 168,58 182,84 C 192,104 196,120 196,132 C 188,124 182,114 176,104 C 180,116 184,124 184,130 C 176,122 170,112 165,102 C 168,114 171,120 172,126 C 164,118 158,108 154,98 C 156,108 158,115 160,120 C 152,112 146,102 142,92 Z" />
    <path d="M 98,108 C 102,94 106,82 110,74 C 103,74 99,71 98,68 C 102,63 108,62 113,64 C 115,58 122,56 129,60 C 133,63 134,68 133,74 C 138,82 141,94 144,108 Z" />
  </g>
  <circle cx="117" cy="64" r="1.8" fill="#DF0A14" />
  <path d="M 100,68 Q 107,69 112,67" stroke="#DF0A14" stroke-width="2" fill="none" />

  <!-- Red Ribbon Banner with VARESE -->
  <path d="M 66,118 L 78,118 L 78,128 L 66,128 L 71,123 Z" fill="#DF0A14" />
  <path d="M 174,118 L 162,118 L 162,128 L 174,128 L 169,123 Z" fill="#DF0A14" />
  <rect x="75" y="109" width="90" height="18" rx="3" fill="#DF0A14" stroke="#FFFFFF" stroke-width="1.5" />
  <text x="120" y="122" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="11.5" letter-spacing="3.2">
    VARESE
  </text>

  <!-- Red City Skyline in Bottom Semicircle -->
  <g clip-path="url(#ca-skyline-clip)">
    <path d="M 50,152 L 62,152 L 62,132 L 76,132 L 76,145 L 88,145 L 88,136 L 96,136 L 96,129 L 112,129 L 112,136 L 122,136 L 122,150 L 127,150 L 127,135 L 138,135 L 138,148 L 145,129 L 151,148 L 162,148 L 162,133 L 180,133 L 180,152 L 192,152 L 192,200 L 50,200 Z" fill="#DF0A14" />
    <g fill="#FFFFFF">
      <rect x="65" y="136" width="2.5" height="3.5" />
      <rect x="70" y="136" width="2.5" height="3.5" />
      <rect x="65" y="143" width="2.5" height="3.5" />
      <rect x="70" y="143" width="2.5" height="3.5" />
      <rect x="65" y="150" width="2.5" height="3.5" />
      <rect x="70" y="150" width="2.5" height="3.5" />
      <rect x="92" y="140" width="2.5" height="3.5" />
      <rect x="98" y="133" width="2.5" height="3.5" />
      <rect x="104" y="133" width="2.5" height="3.5" />
      <rect x="98" y="140" width="2.5" height="3.5" />
      <rect x="104" y="140" width="2.5" height="3.5" />
      <rect x="110" y="140" width="2.5" height="3.5" />
      <rect x="92" y="147" width="2.5" height="3.5" />
      <rect x="98" y="147" width="2.5" height="3.5" />
      <rect x="104" y="147" width="2.5" height="3.5" />
      <rect x="110" y="147" width="2.5" height="3.5" />
      <rect x="92" y="154" width="2.5" height="3.5" />
      <rect x="98" y="154" width="2.5" height="3.5" />
      <rect x="104" y="154" width="2.5" height="3.5" />
      <rect x="110" y="154" width="2.5" height="3.5" />
      <rect x="129" y="139" width="2.5" height="3.5" />
      <rect x="134" y="139" width="2.5" height="3.5" />
      <rect x="129" y="146" width="2.5" height="3.5" />
      <rect x="134" y="146" width="2.5" height="3.5" />
      <rect x="129" y="153" width="2.5" height="3.5" />
      <rect x="134" y="153" width="2.5" height="3.5" />
      <rect x="165" y="137" width="2.5" height="3.5" />
      <rect x="171" y="137" width="2.5" height="3.5" />
      <rect x="176" y="137" width="2.5" height="3.5" />
      <rect x="165" y="144" width="2.5" height="3.5" />
      <rect x="171" y="144" width="2.5" height="3.5" />
      <rect x="176" y="144" width="2.5" height="3.5" />
      <rect x="165" y="151" width="2.5" height="3.5" />
      <rect x="171" y="151" width="2.5" height="3.5" />
      <rect x="176" y="151" width="2.5" height="3.5" />
      <rect x="78" y="162" width="2.5" height="3.5" />
      <rect x="85" y="162" width="2.5" height="3.5" />
      <rect x="98" y="162" width="2.5" height="3.5" />
      <rect x="105" y="162" width="2.5" height="3.5" />
      <rect x="118" y="162" width="2.5" height="3.5" />
      <rect x="129" y="162" width="2.5" height="3.5" />
      <rect x="146" y="162" width="2.5" height="3.5" />
      <rect x="158" y="162" width="2.5" height="3.5" />
      <rect x="92" y="171" width="2.5" height="3.5" />
      <rect x="104" y="171" width="2.5" height="3.5" />
      <rect x="115" y="171" width="2.5" height="3.5" />
      <rect x="128" y="171" width="2.5" height="3.5" />
      <rect x="142" y="171" width="2.5" height="3.5" />
    </g>
  </g>
</svg>`;

/**
 * Converts the official City Angels vector emblem into a high-resolution PNG data URL
 * so it can be added to jsPDF without relying on crude geometric shapes.
 */
export function getOfficialLogoPngDataUrl(size = 480): Promise<string> {
  return new Promise((resolve) => {
    try {
      const blob = new Blob([OFFICIAL_CITY_ANGELS_SVG], {
        type: 'image/svg+xml;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, size, size);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
          return;
        }
        URL.revokeObjectURL(url);
        resolve('');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('');
      };
      img.src = url;
    } catch {
      resolve('');
    }
  });
}

interface LogoProps {
  variant?: 'default' | 'compact' | 'associazione' | 'cooperativa';
  customUrl?: string;
  className?: string;
  size?: number;
}

export const CityAngelsLogo: React.FC<LogoProps> = ({
  variant = 'default',
  customUrl,
  className = '',
  size,
}) => {
  const isCompact = variant === 'compact';
  const dim = size || (isCompact ? 76 : 100);

  if (customUrl) {
    const maxW = dim;
    const maxH = isCompact ? Math.round(dim * 0.75) : Math.round(dim * 0.85);
    return (
      <div className={`inline-flex items-center justify-center print-logo-container ${className}`}>
        <img
          src={customUrl}
          alt="Logo Ufficiale City Angels Varese"
          style={{
            maxWidth: `${maxW}px`,
            maxHeight: `${maxH}px`,
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            imageRendering: '-webkit-optimize-contrast',
          }}
          className="object-contain block"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      dangerouslySetInnerHTML={{
        __html: OFFICIAL_CITY_ANGELS_SVG.replace(
          'width="280" height="280"',
          `width="${dim}" height="${dim}"`
        ),
      }}
    />
  );
};
