// Conjunto de ícones próprio (traço simples, 24×24) — sem bibliotecas externas.
const P: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  news: 'M4 5h13v14H5a1 1 0 0 1-1-1zM17 8h3v10a1 1 0 0 1-1 1h-2M7 9h7M7 12h7M7 15h4',
  squad: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a2.5 2.5 0 1 0 0-5M18 14c2 .5 3.5 2.5 3.5 5',
  youth: 'M12 3l2 5h5l-4 3 1.5 5L12 13l-4.5 3L9 11 5 8h5z',
  tactics: 'M4 4h16v16H4zM12 4v16M4 12h4M16 12h4M8 8a1 1 0 1 0 0 .1M16 16a1 1 0 1 0 0 .1',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M16 14h0',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6',
  market: 'M4 7h16l-1.5 11a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7zM9 7V5a3 3 0 0 1 6 0v2',
  money: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 10v4M18 10v4',
  building: 'M4 20V9l6-4v15M10 20V3l10 5v12M2 20h20M14 10h2M14 13h2M14 16h2M6 12h2M6 15h2',
  stadium: 'M3 10c0-2.8 4-5 9-5s9 2.2 9 5v5c0 2.8-4 5-9 5s-9-2.2-9-5zM3 10c0 2.8 4 5 9 5s9-2.2 9-5M8 9.5h8',
  shirt: 'M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z',
  staff: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7M16 4.5l2-1.5',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
  editor: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  star: 'M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2 6.4 20.2l1.1-6.3L2.9 9.5l6.3-.9z',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14l-1.5 7 5-3 5 3-1.5-7',
  save: 'M5 3h11l3 3v15H5zM8 3v6h7V3M8 21v-7h8v7',
  play: 'M7 4l13 8-13 8z',
  ff: 'M3 5l8 7-8 7zM12 5l8 7-8 7z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  day: 'M12 4v2M12 18v2M4 12h2M18 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1-2 2-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21h-3v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1-2-2 .1-.1A1.6 1.6 0 0 0 4.6 15H3v-3h.2a1.6 1.6 0 0 0 1.1-2.7l-.1-.1 2-2 .1.1A1.6 1.6 0 0 0 9 6.2V3h3v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1 2 2-.1.1A1.6 1.6 0 0 0 19.8 9H21v3h-.2',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  check: 'M5 12l5 5 9-10',
  warn: 'M12 3l10 18H2zM12 10v5M12 18v.1',
  injury: 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z',
  transfer: 'M4 8h13l-3-3M20 16H7l3 3',
  ball: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7l3.5 2.5-1.3 4h-4.4l-1.3-4zM12 3v4M15.5 9.5l4-1.5M14.2 13.5l2.6 3.5M9.8 13.5l-2.6 3.5M8.5 9.5l-4-1.5',
  board: 'M4 4h16v12H4zM8 20h8M12 16v4M7 12l3-3 2 2 4-4',
  retire: 'M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM5 21v-2a7 7 0 0 1 14 0v2M3 12h3M18 12h3',
  kit: 'M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z',
  continental: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18',
  match: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7l3.5 2.5-1.3 4h-4.4l-1.3-4z',
  sub: 'M7 4v12l-3-3M17 20V8l3 3',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.1',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  swap: 'M7 7h12l-3-3M17 17H5l3 3',
  wand: 'M4 20l10-10M14 6l1-3 1 3 3 1-3 1-1 3-1-3-3-1zM18 13l.5-1.5L20 11l-1.5-.5L18 9l-.5 1.5L16 11l1.5.5z',
};

export function Icon({ name, className = 'ico', title }: { name: string; className?: string; title?: string }) {
  const d = P[name] ?? P.info;
  const filled = name === 'star' || name === 'play';
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={d} />
    </svg>
  );
}

export function BrandMark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden>
      <rect x="1.5" y="1.5" width="29" height="29" rx="6" fill="#14241c" stroke="#e9c24b" strokeWidth="1.5" />
      <path d="M7 24V9h9M7 16h7" stroke="#e6eee8" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M18 24V9l3.5 7L25 9v15" stroke="#e9c24b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
