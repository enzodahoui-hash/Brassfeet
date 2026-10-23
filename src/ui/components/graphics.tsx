import { useId, useState } from 'react';
import type { Appearance, CrestDesign, KitDesign, PlayerPhoto, Stadium } from '../../engine/types';
import { contrastRatio } from '../../engine/kits/kits';

// ───────────────────────── Escudo ─────────────────────────

const SHAPES: Record<CrestDesign['shape'], string> = {
  shield: 'M50 4 L92 16 V52 C92 76 72 92 50 100 C28 92 8 76 8 52 V16 Z',
  round: 'M50 4 A48 48 0 1 1 49.9 4 Z',
  diamond: 'M50 2 L96 50 L50 98 L4 50 Z',
  classic: 'M10 6 H90 V40 C90 70 72 90 50 98 C28 90 10 70 10 40 Z',
  square: 'M8 8 H92 V92 H8 Z',
};
const SYMBOLS: Record<string, string> = {
  star: 'M50 30 l5.9 12 13.2 1.9-9.5 9.3 2.2 13.1L50 60.1 38.2 66.3l2.2-13.1-9.5-9.3 13.2-1.9z',
  ball: 'M50 32a16 16 0 1 0 0.1 0zM50 38l6 4.5-2.3 7h-7.4l-2.3-7z',
  crown: 'M32 62 L36 38 L45 50 L50 34 L55 50 L64 38 L68 62 Z',
  bird: 'M30 52 C40 40 48 40 50 46 C54 36 64 34 72 38 C64 40 60 46 58 52 C52 62 40 64 30 52 Z',
  lion: 'M50 32 C62 32 70 42 68 54 C66 64 58 70 50 70 C42 70 34 64 32 54 C30 42 38 32 50 32 Z M42 50 a2 2 0 1 0 0.1 0 M58 50 a2 2 0 1 0 0.1 0 M44 60 Q50 64 56 60',
  tower: 'M40 68 V40 H44 V34 H48 V40 H52 V34 H56 V40 H60 V68 Z',
  wave: 'M28 50 C36 42 42 58 50 50 C58 42 64 58 72 50 M28 60 C36 52 42 68 50 60 C58 52 64 68 72 60',
  bolt: 'M54 30 L38 54 H50 L46 72 L64 46 H52 Z',
  cross: 'M45 32 H55 V45 H68 V55 H55 V68 H45 V55 H32 V45 H45 Z',
};

export function Crest({ crest, size = 32, title }: { crest: CrestDesign; size?: number; title?: string }) {
  const id = useId().replace(/:/g, '');
  const { c1, c2, c3 } = crest;
  const pat = (() => {
    switch (crest.pattern) {
      case 'stripes': return [0, 1, 2, 3, 4].map((i) => <rect key={i} x={10 + i * 18} y="0" width="9" height="100" fill={c2} />);
      case 'halves': return <rect x="50" y="0" width="50" height="100" fill={c2} />;
      case 'sash': return <path d="M0 20 L20 0 L100 80 L80 100 Z" fill={c2} />;
      case 'chevron': return <path d="M0 30 L50 60 L100 30 V50 L50 80 L0 50 Z" fill={c2} />;
      case 'quarters': return <><rect x="50" y="0" width="50" height="50" fill={c2} /><rect x="0" y="50" width="50" height="50" fill={c2} /></>;
      case 'band': return <rect x="0" y="40" width="100" height="22" fill={c2} />;
      default: return null;
    }
  })();
  const textFill = contrastRatio(c3, c1) > 2.2 ? c3 : contrastRatio('#ffffff', c1) > 2.2 ? '#ffffff' : '#111111';
  return (
    <svg width={size} height={size} viewBox="0 0 100 104" role="img" aria-label={title ?? 'Escudo'} style={{ flex: 'none' }}>
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={`c${id}`}><path d={SHAPES[crest.shape]} /></clipPath>
      </defs>
      <g clipPath={`url(#c${id})`}>
        <rect x="0" y="0" width="100" height="104" fill={c1} />
        {pat}
      </g>
      <path d={SHAPES[crest.shape]} fill="none" stroke={c3} strokeWidth="4" />
      {crest.symbol !== 'none' && SYMBOLS[crest.symbol] && <path d={SYMBOLS[crest.symbol]} fill={crest.symbol === 'wave' ? 'none' : textFill} stroke={textFill} strokeWidth={crest.symbol === 'wave' || crest.symbol === 'lion' ? 3 : 1} opacity="0.92" transform="translate(0,-8)" />}
      <text x="50" y={crest.symbol === 'none' ? 62 : 86} textAnchor="middle" fontFamily="Saira Condensed, Arial Narrow, sans-serif" fontWeight="800" fontSize={crest.symbol === 'none' ? 34 : 18} fill={textFill} stroke={c1} strokeWidth="0.6">
        {crest.initials}
      </text>
      {Array.from({ length: Math.min(5, crest.stars) }, (_, i) => (
        <path key={i} d={SYMBOLS.star} transform={`translate(${(i - (Math.min(5, crest.stars) - 1) / 2) * 12 + 50 - 50 * 0.25},${-6}) scale(0.25)`} fill="#ffc83d" />
      ))}
    </svg>
  );
}

// ───────────────────────── Camisa ─────────────────────────

const BODY = 'M62 18 L40 26 L12 44 L22 80 L40 74 L40 206 L160 206 L160 74 L178 80 L188 44 L160 26 L138 18 C130 30 70 30 62 18 Z';
const BODY_LONG = 'M62 18 L40 26 L18 50 L6 150 L24 154 L40 84 L40 206 L160 206 L160 84 L176 154 L194 150 L182 50 L160 26 L138 18 C130 30 70 30 62 18 Z';

export function Shirt({ design, size = 160, back = false, name, number, crest, showSponsor = true }: { design: KitDesign; size?: number; back?: boolean; name?: string; number?: number; crest?: CrestDesign; showSponsor?: boolean }) {
  const id = useId().replace(/:/g, '');
  const d = design;
  const body = d.sleeves === 'long' ? BODY_LONG : BODY;
  const sleeveFill = d.sleeveColor === 'primary' ? d.primary : d.sleeveColor === 'secondary' ? d.secondary : d.detail;
  const pattern = (() => {
    switch (d.pattern) {
      case 'vstripes': return Array.from({ length: 6 }, (_, i) => <rect key={i} x={46 + i * 22} y="0" width="11" height="220" fill={d.secondary} />);
      case 'hstripes': return Array.from({ length: 9 }, (_, i) => <rect key={i} x="0" y={30 + i * 22} width="200" height="10" fill={d.secondary} />);
      case 'hoops': return Array.from({ length: 4 }, (_, i) => <rect key={i} x="0" y={50 + i * 44} width="200" height="22" fill={d.secondary} />);
      case 'pinstripes': return Array.from({ length: 14 }, (_, i) => <rect key={i} x={44 + i * 9} y="0" width="2" height="220" fill={d.secondary} />);
      case 'diagonal': return <g transform="rotate(-30 100 110)">{Array.from({ length: 10 }, (_, i) => <rect key={i} x={-60 + i * 36} y="-60" width="16" height="340" fill={d.secondary} />)}</g>;
      case 'sash': return <path d="M150 18 L176 30 L60 206 L28 206 Z" fill={d.secondary} />;
      case 'halves': return <rect x="100" y="0" width="100" height="220" fill={d.secondary} />;
      case 'gradient': return <rect x="0" y="0" width="200" height="220" fill={`url(#g${id})`} />;
      case 'geometric': return Array.from({ length: 5 }, (_, r) => Array.from({ length: 6 }, (_, k) => <path key={`${r}-${k}`} d={`M${36 + k * 26 + (r % 2) * 13} ${60 + r * 30} l13 -22 l13 22 z`} fill={d.secondary} opacity="0.85" />));
      case 'chevron': return <path d="M40 70 L100 110 L160 70 L160 94 L100 134 L40 94 Z" fill={d.secondary} />;
      default: return null;
    }
  })();
  const collar = (() => {
    switch (d.collar) {
      case 'v': return <path d="M62 18 L100 52 L138 18" fill="none" stroke={d.detail} strokeWidth="6" strokeLinejoin="round" />;
      case 'polo': return <><path d="M62 18 C70 30 130 30 138 18 L128 12 C116 20 84 20 72 12 Z" fill={d.detail} /><path d="M100 26 V48" stroke={d.detail} strokeWidth="4" /></>;
      case 'crew': return <path d="M62 18 C70 34 130 34 138 18" fill="none" stroke={d.detail} strokeWidth="7" />;
      default: return <path d="M62 18 C70 30 130 30 138 18" fill="none" stroke={d.detail} strokeWidth="5" />;
    }
  })();
  const deco = (() => {
    switch (d.decoration) {
      case 'shoulder': return [0, 1, 2].map((i) => <g key={i}><path d={`M${56 - i * 5} ${22 + i * 4} L${28 - i * 3} ${44 + i * 4}`} stroke={d.detail} strokeWidth="3" /><path d={`M${144 + i * 5} ${22 + i * 4} L${172 + i * 3} ${44 + i * 4}`} stroke={d.detail} strokeWidth="3" /></g>);
      case 'sidepanels': return <><rect x="40" y="84" width="12" height="122" fill={d.detail} /><rect x="148" y="84" width="12" height="122" fill={d.detail} /></>;
      case 'chestband': return <rect x="40" y="70" width="120" height="14" fill={d.detail} />;
      case 'pinline': return <path d={body} fill="none" stroke={d.detail} strokeWidth="3" />;
      default: return null;
    }
  })();
  const num = back ? number ?? 10 : undefined;
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 200 220" role="img" aria-label={back ? 'Costas da camisa' : 'Frente da camisa'}>
      <defs>
        <clipPath id={`k${id}`}><path d={body} /></clipPath>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={d.primary} /><stop offset="1" stopColor={d.secondary} /></linearGradient>
      </defs>
      <g clipPath={`url(#k${id})`}>
        <rect x="0" y="0" width="200" height="220" fill={d.primary} />
        {pattern}
        <path d={d.sleeves === 'long' ? 'M40 26 L18 50 L6 150 L24 154 L40 84 Z M160 26 L182 50 L194 150 L176 154 L160 84 Z' : 'M40 26 L12 44 L22 80 L40 74 Z M160 26 L188 44 L178 80 L160 74 Z'} fill={sleeveFill} />
        {d.cuffs && (d.sleeves === 'long' ? <><path d="M6 140 L24 144 L24 154 L6 150 Z" fill={d.detail} /><path d="M194 140 L176 144 L176 154 L194 150 Z" fill={d.detail} /></> : <><path d="M14 70 L36 64 L40 74 L22 80 Z" fill={d.detail} /><path d="M186 70 L164 64 L160 74 L178 80 Z" fill={d.detail} /></>)}
        {deco}
      </g>
      <path d={body} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
      {back ? (
        <>
          <path d="M62 18 C70 24 130 24 138 18" fill="none" stroke={d.detail} strokeWidth="5" />
          {name && <text x="100" y="66" textAnchor="middle" fontFamily="Saira Condensed, Arial Narrow, sans-serif" fontWeight="700" fontSize="18" letterSpacing="2" fill={d.numberColor}>{name.toUpperCase().slice(0, 14)}</text>}
          <text x="100" y="150" textAnchor="middle" fontFamily="Saira Condensed, Arial Narrow, sans-serif" fontWeight="800" fontSize="74" fill={d.numberColor} stroke="rgba(0,0,0,0.25)" strokeWidth="1">{num}</text>
        </>
      ) : (
        <>
          {collar}
          <text x="66" y="62" fontFamily="Barlow, sans-serif" fontWeight="800" fontSize="9" fill={d.numberColor} opacity="0.9">{d.brand.toUpperCase()}</text>
          {crest ? <g transform="translate(118,44) scale(0.2)"><CrestInner crest={crest} /></g> : <circle cx="130" cy="56" r="9" fill={d.detail} />}
          {showSponsor && d.sponsor && <text x="100" y="118" textAnchor="middle" fontFamily="Saira Condensed, Arial Narrow, sans-serif" fontWeight="800" fontSize={d.sponsor.length > 12 ? 17 : 21} fill={d.numberColor} stroke="rgba(0,0,0,0.2)" strokeWidth="0.6">{d.sponsor.toUpperCase()}</text>}
        </>
      )}
    </svg>
  );
}

/** Escudo desenhado dentro de outro SVG (sem elemento <svg> próprio). */
function CrestInner({ crest }: { crest: CrestDesign }) {
  return (
    <>
      <path d={SHAPES[crest.shape]} fill={crest.c1} stroke={crest.c3} strokeWidth="5" />
      <text x="50" y="64" textAnchor="middle" fontFamily="Saira Condensed, sans-serif" fontWeight="800" fontSize="34" fill={crest.c3}>{crest.initials}</text>
    </>
  );
}

export function MiniShirt({ design, size = 30, number }: { design: KitDesign; size?: number; number?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 220" className="shirt-mini" aria-hidden>
      <path d={BODY} fill={design.primary} stroke="rgba(0,0,0,0.5)" strokeWidth="6" />
      {design.pattern === 'vstripes' && [0, 1, 2].map((i) => <rect key={i} x={62 + i * 30} y="30" width="14" height="176" fill={design.secondary} />)}
      {(design.pattern === 'hstripes' || design.pattern === 'hoops') && [0, 1, 2].map((i) => <rect key={i} x="40" y={70 + i * 46} width="120" height="20" fill={design.secondary} />)}
      {design.pattern === 'halves' && <rect x="100" y="24" width="60" height="182" fill={design.secondary} />}
      {design.pattern === 'sash' && <path d="M150 18 L176 30 L60 206 L28 206 Z" fill={design.secondary} />}
      {number !== undefined && <text x="100" y="150" textAnchor="middle" fontFamily="Saira Condensed, sans-serif" fontWeight="800" fontSize="96" fill={design.numberColor}>{number}</text>}
    </svg>
  );
}

// ───────────────────────── Avatar ─────────────────────────

const SKIN = ['#f3d2b5', '#e5b48f', '#c98e66', '#a06a45', '#7a4c2e', '#4d2f1c'];
const HAIR = ['#1c1410', '#3d2618', '#6b4423', '#b07a3f', '#d9b36a', '#8a8a8a'];

export function Avatar({ a, kit, size = 64 }: { a: Appearance; kit?: KitDesign; size?: number }) {
  const skin = SKIN[a.skin % SKIN.length];
  const hair = HAIR[a.hairColor % HAIR.length];
  const shirt = kit?.primary ?? '#2f9e63';
  const trim = kit?.detail ?? '#ffffff';
  const hairPath = [
    'M30 40 C30 22 70 22 70 40 C64 30 36 30 30 40 Z',
    'M28 44 C26 18 74 18 72 44 C68 32 32 32 28 44 Z',
    'M30 38 C34 26 66 26 70 38 L70 34 C66 20 34 20 30 34 Z',
    'M27 46 C24 16 76 16 73 46 C72 36 68 30 50 30 C32 30 28 36 27 46 Z M27 46 L27 56 L31 54 Z M73 46 L73 56 L69 54 Z',
    'M32 34 C36 24 64 24 68 34 Z',
    'M26 50 C20 14 80 14 74 50 C74 40 70 28 50 28 C30 28 26 40 26 50 Z M26 50 C24 62 30 66 30 66 L30 50 Z M74 50 C76 62 70 66 70 66 L70 50 Z',
    'M40 22 C46 16 54 16 60 22 L58 30 L42 30 Z',
    '',
  ][a.hair % 8];
  const beard = ['', 'M36 56 C40 70 60 70 64 56 C60 64 40 64 36 56 Z', 'M34 52 C34 74 66 74 66 52 C62 66 38 66 34 52 Z', 'M44 62 C46 66 54 66 56 62 Z', 'M36 54 C38 72 62 72 64 54 L60 56 C56 66 44 66 40 56 Z'][a.beard % 5];
  const jaw = ['M32 42 C32 70 68 70 68 42 C68 26 32 26 32 42 Z', 'M33 40 C31 72 69 72 67 40 C67 24 33 24 33 40 Z', 'M31 44 C33 68 67 68 69 44 C69 26 31 26 31 44 Z', 'M33 42 C35 72 65 72 67 42 C67 24 33 24 33 42 Z'][a.face % 4];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ flex: 'none', borderRadius: 8, background: 'linear-gradient(160deg,#1e3a2b,#0d1913)' }}>
      <path d="M14 100 C16 78 32 72 50 72 C68 72 84 78 86 100 Z" fill={shirt} />
      <path d="M40 72 L50 82 L60 72" fill="none" stroke={trim} strokeWidth="3" />
      <rect x="44" y="60" width="12" height="14" fill={skin} />
      <path d={jaw} fill={skin} />
      <ellipse cx="31" cy="46" rx="3" ry="5" fill={skin} />
      <ellipse cx="69" cy="46" rx="3" ry="5" fill={skin} />
      {hairPath && <path d={hairPath} fill={hair} />}
      {beard && <path d={beard} fill={hair} opacity="0.9" />}
      <circle cx="42" cy="46" r="2.2" fill="#1a1a1a" />
      <circle cx="58" cy="46" r="2.2" fill="#1a1a1a" />
      <path d="M38 40 L46 39 M54 39 L62 40" stroke={hair} strokeWidth="2" strokeLinecap="round" />
      <path d="M45 58 Q50 61 55 58" fill="none" stroke="#5a2f22" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Foto real (Wikimedia Commons, licença livre) com volta automática ao desenho se não carregar. */
export function Face({ a, photo, kit, size = 64 }: { a: Appearance; photo?: PlayerPhoto; kit?: KitDesign; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!photo || broken) return <Avatar a={a} kit={kit} size={size} />;
  return (
    <img className="face" src={photo.src} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer"
      title={`Foto: ${photo.author} · ${photo.license} (Wikimedia Commons)`} onError={() => setBroken(true)} style={{ width: size, height: size }} />
  );
}

/** Página da foto no Wikimedia Commons (licença e autoria completas). */
export function commonsPage(src: string): string {
  const parts = src.split('/thumb/')[1]?.split('/') ?? [];
  return parts[2] ? `https://commons.wikimedia.org/wiki/File:${parts[2]}` : 'https://commons.wikimedia.org/';
}

// ───────────────────────── Estádio (vista esquemática) ─────────────────────────

export function StadiumView({ st, colors, width = 560 }: { st: Stadium; colors: [string, string, string]; width?: number }) {
  const id = useId().replace(/:/g, '');
  const sec = (name: string) => st.sectors.find((s) => s.name === name) ?? st.sectors[0];
  const depth = (s: Stadium['sectors'][number]) => 14 + Math.min(70, Math.sqrt(s.capacity) * 0.45) + s.tiers * 4;
  const N = sec('Norte'), S = sec('Sul'), L = sec('Leste'), O = sec('Oeste');
  const pitch = { x: 170, y: 110, w: 260, h: 170 };
  const dn = depth(N), ds = depth(S), dl = depth(L), dO = depth(O);
  const stand = (x: number, y: number, w: number, h: number, s: Stadium['sectors'][number], key: string) => {
    const closed = s.closed > 0 ? s.closed / Math.max(1, s.capacity) : 0;
    const seatColor = s.seatLevel >= 7 ? colors[0] : s.seatLevel >= 4 ? '#6c7f74' : '#4a5a51';
    return (
      <g key={key}>
        <rect x={x} y={y} width={w} height={h} fill={seatColor} stroke="#0b1510" strokeWidth="2" rx="4" />
        {Array.from({ length: s.tiers }, (_, i) => (
          <rect key={i} x={x + 3} y={y + 3 + (i * (h - 6)) / s.tiers} width={w - 6} height={(h - 6) / s.tiers - 2} fill="none" stroke="rgba(255,255,255,0.12)" />
        ))}
        {s.covered && <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} fill="rgba(220,235,255,0.14)" stroke="rgba(220,235,255,0.5)" strokeDasharray="5 3" rx="5" />}
        {closed > 0 && <rect x={x} y={y} width={w} height={h} fill={`url(#h${id})`} rx="4" />}
      </g>
    );
  };
  const lights = Math.min(4, Math.max(1, Math.round(st.pitch.lighting / 2.5)));
  const towers = [[pitch.x - dO - 18, pitch.y - dn - 18], [pitch.x + pitch.w + dl + 18, pitch.y - dn - 18], [pitch.x - dO - 18, pitch.y + pitch.h + ds + 18], [pitch.x + pitch.w + dl + 18, pitch.y + pitch.h + ds + 18]].slice(0, lights);
  const grass = st.pitch.condition > 70 ? '#2f8f55' : st.pitch.condition > 45 ? '#5f8f3d' : '#8a7f3c';
  return (
    <svg viewBox="0 0 600 390" width="100%" style={{ maxWidth: width, display: 'block' }} role="img" aria-label={`Vista esquemática do ${st.name}`}>
      <defs>
        <pattern id={`h${id}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="rgba(240,96,90,0.55)" /></pattern>
        <radialGradient id={`l${id}`}><stop offset="0" stopColor="rgba(255,244,200,0.55)" /><stop offset="1" stopColor="rgba(255,244,200,0)" /></radialGradient>
      </defs>
      <rect x="0" y="0" width="600" height="390" fill="#0b1510" rx="10" />
      {Array.from({ length: Math.min(10, st.parking) }, (_, i) => <rect key={i} x={14 + i * 20} y={350} width="16" height="26" fill="#1c2a23" stroke="#2c3f34" />)}
      {stand(pitch.x, pitch.y - dn, pitch.w, dn - 6, N, 'n')}
      {stand(pitch.x, pitch.y + pitch.h + 6, pitch.w, ds - 6, S, 's')}
      {stand(pitch.x + pitch.w + 6, pitch.y - dn + 10, dl - 6, pitch.h + dn + ds - 20, L, 'l')}
      {stand(pitch.x - dO, pitch.y - dn + 10, dO - 6, pitch.h + dn + ds - 20, O, 'o')}
      {st.boxes > 0 && <rect x={pitch.x - 16} y={pitch.y + 20} width="8" height={pitch.h - 40} fill="#e9c24b" opacity={Math.min(1, 0.3 + st.boxes / 80)} />}
      <rect x={pitch.x} y={pitch.y} width={pitch.w} height={pitch.h} fill={grass} stroke="#d9efe1" strokeWidth="2" />
      <line x1={pitch.x + pitch.w / 2} y1={pitch.y} x2={pitch.x + pitch.w / 2} y2={pitch.y + pitch.h} stroke="#d9efe1" strokeWidth="1.5" />
      <circle cx={pitch.x + pitch.w / 2} cy={pitch.y + pitch.h / 2} r="22" fill="none" stroke="#d9efe1" strokeWidth="1.5" />
      <rect x={pitch.x} y={pitch.y + 50} width="34" height="70" fill="none" stroke="#d9efe1" strokeWidth="1.5" />
      <rect x={pitch.x + pitch.w - 34} y={pitch.y + 50} width="34" height="70" fill="none" stroke="#d9efe1" strokeWidth="1.5" />
      {st.screens >= 3 && <><rect x={pitch.x + 20} y={pitch.y - dn - 2} width="40" height="8" fill="#5aa7e3" /><rect x={pitch.x + pitch.w - 60} y={pitch.y + pitch.h + ds - 6} width="40" height="8" fill="#5aa7e3" /></>}
      {towers.map(([x, y], i) => (
        <g key={i}><circle cx={x} cy={y} r={30 + st.pitch.lighting * 3} fill={`url(#l${id})`} /><rect x={x - 4} y={y - 4} width="8" height="8" fill="#fff4c8" /></g>
      ))}
      {Array.from({ length: Math.min(6, st.shops) }, (_, i) => <rect key={i} x={520 + (i % 2) * 22} y={20 + Math.floor(i / 2) * 22} width="16" height="16" rx="3" fill={colors[1]} stroke="#0b1510" />)}
      <text x="300" y="24" textAnchor="middle" fill="#e6eee8" fontFamily="Saira Condensed, sans-serif" fontWeight="700" fontSize="18">{st.name.toUpperCase()}</text>
    </svg>
  );
}
