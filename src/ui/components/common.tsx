import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type { Career, Player, Pos, World } from '../../engine/types';
import { POS_LINE, POS_SHORT, POS_NAME, ovrToLevel, playerLevel } from '../../engine/players/attributes';
import { fmtMoney } from '../../engine/finance/ledger';
import { starsOf } from '../../engine/awards/awards';
import { store, useGame } from '../store';
import { Icon } from './Icon';
import { Crest } from './graphics';

// ───────────────────────── valores ─────────────────────────

export function money(v: number, cur = '€'): string {
  return fmtMoney(v, cur);
}
export function Money({ v, cur, color = false }: { v: number; cur?: string; color?: boolean }) {
  const c = store.career?.config.currency ?? cur ?? '€';
  return <span className={`num ${color ? (v < 0 ? 'neg' : v > 0 ? 'pos' : '') : ''}`}>{fmtMoney(v, c)}</span>;
}

export function levelColor(l: number): string {
  if (l >= 23) return '#ffc83d';
  if (l >= 20) return '#c7e86a';
  if (l >= 16) return '#57d18b';
  if (l >= 12) return '#4cb3a6';
  if (l >= 8) return '#6aa3d6';
  if (l >= 4) return '#8c95b5';
  return '#8a7c86';
}

export function Lvl({ v, size, pot, tip }: { v: number; size?: 'sm' | 'lg'; pot?: boolean; tip?: string }) {
  const n = Math.round(v);
  return (
    <span className={`lvl ${size ?? ''} ${pot ? 'pot' : ''}`} style={pot ? { color: levelColor(n) } : { background: levelColor(n) }} data-tip={tip}>
      {n}
    </span>
  );
}

export function PosB({ pos }: { pos: Pos }) {
  return <span className={`posb ${POS_LINE[pos]}`} title={POS_NAME[pos]}>{POS_SHORT[pos]}</span>;
}

export function StarIcon({ red, tip }: { red?: boolean; tip: string }) {
  return (
    <span data-tip={tip} tabIndex={0} style={{ display: 'inline-flex' }} aria-label={tip}>
      <svg className="star-ico" viewBox="0 0 24 24" aria-hidden>
        {red ? (
          <>
            <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2 6.4 20.2l1.1-6.3L2.9 9.5l6.3-.9z" fill="#ff4b4b" stroke="#7a0f0f" strokeWidth="1" />
            <circle cx="12" cy="12" r="2.6" fill="#ffd9d9" />
          </>
        ) : (
          <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2 6.4 20.2l1.1-6.3L2.9 9.5l6.3-.9z" fill="#ffc83d" stroke="#8a5a00" strokeWidth="1" />
        )}
      </svg>
    </span>
  );
}

/** Estrelas de artilharia ao lado do nome (dourada = liga nacional, vermelha = competição internacional). */
export function Stars({ p, max = 6 }: { p: Pick<Player, 'achievements'>; max?: number }) {
  const { gold, red } = starsOf(p);
  if (!gold.length && !red.length) return null;
  const all = [...red.map((a) => ({ a, red: true })), ...gold.map((a) => ({ a, red: false }))];
  const shown = all.slice(0, max);
  return (
    <span className="stars">
      {shown.map(({ a, red }) => (
        <StarIcon key={a.key} red={red} tip={`${a.label}${a.goals ? ` — ${a.goals} gols` : ''}${a.clubName ? `\n${a.clubName}` : ''}`} />
      ))}
      {all.length > max && <span className="tiny muted">+{all.length - max}</span>}
    </span>
  );
}

export function PName({ p, link = true, club = false }: { p: Player; link?: boolean; club?: boolean }) {
  const c = store.career;
  const clubObj = club && p.clubId && c ? c.clubs[p.clubId] : null;
  return (
    <span className="pname">
      {link ? (
        <button type="button" className="link" onClick={(e) => { e.stopPropagation(); store.go({ name: 'player', id: p.id }); }}>{p.name}</button>
      ) : (
        <span>{p.name}</span>
      )}
      <Stars p={p} />
      {p.origin === 'creator' && <span className="chip star" tabIndex={0} aria-label="Craque criado no Criador de Craques (edição livre)" data-tip="Criado no Criador de Craques (edição livre)">CC</span>}
      {p.injury && <span role="img" tabIndex={0} aria-label={`Lesão: ${p.injury.name}, ${Math.ceil(p.injury.daysLeft)} dias`} data-tip={`${p.injury.name}: ${Math.ceil(p.injury.daysLeft)} dias`}><Icon name="injury" className="star-ico" /></span>}
      {clubObj && <span className="muted small">· {clubObj.short}</span>}
    </span>
  );
}

export function ClubName({ id, crest = true, short = false, link = true }: { id: string; crest?: boolean; short?: boolean; link?: boolean }) {
  const c = store.career;
  const club = c?.clubs[id];
  if (!club) return <span className="muted">—</span>;
  const me = c?.userClubId === id;
  const style = { display: 'inline-flex', flexWrap: 'nowrap' as const, alignItems: 'center', fontWeight: me ? 700 : undefined, color: me ? 'var(--accent)' : undefined };
  const inner = <>{crest && <Crest crest={club.crest} size={18} />}<span>{short ? club.short : club.name}</span></>;
  if (!link) return <span className="row tight" style={style}>{inner}</span>;
  return (
    <button type="button" className="row tight clubname-btn" style={{ ...style, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); store.go({ name: 'clubview', id }); }}>
      {inner}
    </button>
  );
}

export function Cond({ v }: { v: number }) {
  const col = v >= 85 ? 'var(--win)' : v >= 65 ? 'var(--draw)' : 'var(--loss)';
  return <span className="cond" data-tip={`Condição física: ${Math.round(v)}%`}><i style={{ width: `${Math.max(3, v)}%`, background: col }} /></span>;
}

export function Morale({ v }: { v: number }) {
  const label = v >= 80 ? 'Excelente' : v >= 65 ? 'Boa' : v >= 50 ? 'Regular' : v >= 35 ? 'Baixa' : 'Péssima';
  const cls = v >= 65 ? 'good' : v >= 50 ? '' : v >= 35 ? 'warn' : 'bad';
  return <span className={`chip ${cls}`}>{label}</span>;
}

export function Form({ f }: { f: string[] }) {
  return <span className="form-dots">{f.map((x, i) => <i key={i} className={x}>{x}</i>)}</span>;
}

export function Bar({ v, max = 100, color }: { v: number; max?: number; color?: string }) {
  return <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: color }} /></div>;
}

// ───────────────────────── tabela ordenável ─────────────────────────

export interface Col<T> {
  key: string;
  label: string;
  render: (r: T) => ReactNode;
  sort?: (r: T) => number | string;
  cls?: string;
  tip?: string;
}

export function Table<T>({ rows, cols, rowKey, onRow, rowCls, initialSort, empty = 'Nada para mostrar.', maxRows }: { rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; onRow?: (r: T) => void; rowCls?: (r: T) => string; initialSort?: { key: string; dir: 1 | -1 }; empty?: string; maxRows?: number }) {
  const [sort, setSort] = useState(initialSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = cols.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const fn = col.sort;
    return rows.slice().sort((a, b) => {
      const x = fn(a), y = fn(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, sort, cols]);
  const shown = maxRows ? sorted.slice(0, maxRows) : sorted;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={`${c.cls ?? ''} ${c.sort ? 'sortable' : ''} ${sort?.key === c.key ? 'sorted' : ''}`} aria-sort={c.sort ? (sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none') : undefined}>
                {c.sort ? (
                  <button type="button" className="th-sort" title={c.tip} onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key ? (-s.dir as 1 | -1) : -1 }))}>
                    {c.label}{sort?.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                  </button>
                ) : (
                  <span title={c.tip}>{c.label}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={rowKey(r)} className={`${onRow ? 'click' : ''} ${rowCls?.(r) ?? ''}`} onClick={onRow ? () => onRow(r) : undefined}>
              {cols.map((c) => <td key={c.key} className={c.cls}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="empty">{empty}</div>}
      {maxRows && rows.length > maxRows && <div className="tiny muted" style={{ padding: 8 }}>Mostrando {maxRows} de {rows.length}. Refine os filtros para ver outros.</div>}
    </div>
  );
}

// ───────────────────────── layout ─────────────────────────

export function Panel({ title, right, children, flush, className }: { title?: ReactNode; right?: ReactNode; children: ReactNode; flush?: boolean; className?: string }) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {(title || right) && (
        <div className="panel-h">
          {typeof title === 'string' ? <h3>{title}</h3> : title}
          {right && <div className="right">{right}</div>}
        </div>
      )}
      <div className={`panel-b ${flush ? 'flush' : ''}`}>{children}</div>
    </section>
  );
}

export function PageHead({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: boolean }) {
  return (
    <div className="page-head">
      {back && store.stack.length > 0 && <button className="icon-btn" onClick={() => store.back()} aria-label="Voltar"><Icon name="back" /></button>}
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  const onKey = (e: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -Infinity : e.key === 'End' ? Infinity : 0;
    if (!dir) return;
    e.preventDefault();
    const ni = dir === -Infinity ? 0 : dir === Infinity ? tabs.length - 1 : (i + dir + tabs.length) % tabs.length;
    onChange(tabs[ni].id);
    const btns = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
    btns?.[ni]?.focus();
  };
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t, i) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}>{t.label}</button>
      ))}
    </div>
  );
}

let modalSeq = 0;
export function Modal({ title, onClose, children, footer, size }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'wide' | 'narrow' }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useRef(`modal-title-${++modalSeq}`).current;
  const labelled = typeof title === 'string';
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
    (focusables()[0] ?? node).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key === ' ') { e.stopPropagation(); return; } // não deixa o atalho global (espaço = avançar) agir com um modal aberto
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) { e.preventDefault(); node.focus(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    node.addEventListener('keydown', onKey);
    return () => { node.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal ${size ?? ''}`} role="dialog" aria-modal="true" aria-labelledby={labelled ? titleId : undefined} tabIndex={-1}>
        <div className="modal-h">
          {labelled ? <h2 id={titleId}>{title}</h2> : title}
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ title, text, confirmLabel = 'Confirmar', danger, onYes, onNo }: { title: string; text: ReactNode; confirmLabel?: string; danger?: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <Modal title={title} onClose={onNo} size="narrow" footer={<><button className="btn" onClick={onNo}>Cancelar</button><button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onYes}>{confirmLabel}</button></>}>
      <div style={{ color: 'var(--text-2)' }}>{text}</div>
    </Modal>
  );
}

/** Props que tornam um elemento não-semântico (div/span) clicável acessível por teclado (Enter/Espaço). */
export function clickable(onClick?: () => void): { role?: 'button'; tabIndex?: number; onClick?: () => void; onKeyDown?: (e: ReactKeyboardEvent) => void } {
  if (!onClick) return {};
  return {
    role: 'button',
    tabIndex: 0,
    onClick,
    onKeyDown: (e: ReactKeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } },
  };
}

export interface MenuItem { label: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }
/** Menu de estouro acessível (aria-haspopup/expanded, fecha no Escape e no clique fora). */
export function Menu({ label = 'Mais', icon = 'menu', items, align = 'right' }: { label?: string; icon?: string; items: MenuItem[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); ref.current?.querySelector<HTMLButtonElement>('button')?.focus(); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  if (!items.length) return null;
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}><Icon name={icon} />{label}</button>
      {open && (
        <div className={`menu-pop ${align}`} role="menu">
          {items.map((it, i) => (
            <button key={i} type="button" role="menuitem" className={it.danger ? 'danger' : ''} disabled={it.disabled} onClick={() => { setOpen(false); it.onClick(); }}>{it.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Toasts() {
  const s = useGame();
  return (
    <div className={`toasts ${s.live ? "in-live" : ""}`} aria-live="polite">
      {s.toasts.map((t) => <div key={t.id} className={`toast ${t.kind === 'err' ? 'err' : t.kind === 'warn' ? 'warn' : ''}`} onClick={() => { s.toasts = s.toasts.filter((x) => x.id !== t.id); s.bump(); }}>{t.text}</div>)}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export function NumInput({ value, onChange, min, max, step = 1, width = 90, id }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; width?: number; id?: string }) {
  return <input id={id} type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} style={{ width }} onChange={(e) => onChange(Number(e.target.value))} />;
}

/** Gráfico de barras simples (SVG) com escala única. */
export function Bars({ data, height = 120, color = 'var(--pitch)', neg = 'var(--loss)', fmt }: { data: { label: string; v: number; v2?: number }[]; height?: number; color?: string; neg?: string; fmt?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => Math.max(Math.abs(d.v), Math.abs(d.v2 ?? 0))));
  const w = Math.max(240, data.length * 34);
  const bw = Math.min(26, (w - 20) / Math.max(1, data.length) - 6);
  return (
    <div className="tbl-wrap">
      <svg viewBox={`0 0 ${w} ${height + 34}`} width="100%" style={{ minWidth: Math.min(w, 520), display: 'block' }}>
        <line x1="0" y1={height} x2={w} y2={height} stroke="var(--line-2)" />
        {data.map((d, i) => {
          const x = 10 + i * ((w - 20) / data.length);
          const h1 = (Math.abs(d.v) / max) * (height - 10);
          const h2 = d.v2 !== undefined ? (Math.abs(d.v2) / max) * (height - 10) : 0;
          return (
            <g key={i}>
              <title>{`${d.label}: ${fmt ? fmt(d.v) : d.v}${d.v2 !== undefined ? ` / ${fmt ? fmt(d.v2) : d.v2}` : ''}`}</title>
              <rect x={x} y={height - h1} width={d.v2 !== undefined ? bw / 2 : bw} height={h1} fill={d.v < 0 ? neg : color} rx="2" />
              {d.v2 !== undefined && <rect x={x + bw / 2 + 1} y={height - h2} width={bw / 2} height={h2} fill={neg} rx="2" />}
              <text x={x + bw / 2} y={height + 14} textAnchor="middle" fontSize="10" fill="var(--muted)">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LevelPair({ p, est }: { p: Player; est?: { low: number; high: number } }) {
  const lvl = playerLevel(p);
  return (
    <span className="row tight" style={{ flexWrap: 'nowrap' }}>
      <Lvl v={lvl} size="sm" tip={`Nível atual ${ovrToLevel(p.ovr).toFixed(1)} (nota ${p.ovr.toFixed(0)}/100)`} />
      {est ? <span className="small muted" data-tip="Potencial estimado pela comissão da base">{est.low}–{est.high}</span> : <Lvl v={ovrToLevel(p.pot)} size="sm" pot tip="Potencial" />}
    </span>
  );
}

export function ageOf(c: Career | World, p: Player): number {
  const season = 'season' in c ? (c as Career).season : c.config.startYear;
  return season - p.birthYear;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
