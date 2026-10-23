import { useState } from 'react';
import type { StaffRole } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { PageHead, Panel, Table, Money, Bar, Confirm, Tabs } from '../components/common';
import { STAFF_ROLES, ROLE_NAME, clubStaff, fireStaff, hireStaff, roleScore, staffCapacity, trainStaff } from '../../engine/infra/infra';
import { NATIONS } from '../../engine/data/nations';

export function StaffPage() {
  useGame();
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const [tab, setTab] = useState<'equipe' | 'mercado'>('equipe');
  const [role, setRole] = useState<StaffRole | ''>('');
  const [fire, setFire] = useState<string | null>(null);
  const mine = clubStaff(c, club);
  const free = Object.values(c.staff).filter((s) => !s.clubId && (!role || s.role === role)).sort((a, b) => b.ability - a.ability);
  const wages = mine.reduce((s, x) => s + x.wage, 0);
  const natName = (id: string) => NATIONS[id]?.name ?? id;
  return (
    <div className="page">
      <PageHead title="Comissão técnica" sub={`${mine.length} profissionais contratados`} actions={<span className="small"><Money v={wages} />/ano</span>} />
      <Panel title="Áreas e capacidade" flush>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Área</th><th className="c">Equipe</th><th>Eficiência</th><th>Impacto</th></tr></thead>
            <tbody>
              {STAFF_ROLES.map((r) => {
                const n = clubStaff(c, club, r.id).length;
                const cap = staffCapacity(club, r.id);
                return (
                  <tr key={r.id}>
                    <td><strong>{r.name}</strong></td>
                    <td className="c"><span className={n >= cap ? 'warn' : ''}>{n}/{cap}</span></td>
                    <td style={{ width: 140 }}><Bar v={roleScore(c, club, r.id) * 100} /></td>
                    <td className="small muted">{r.desc}{cap === 0 ? ' · exige Monitoramento juvenil nível 3' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="tiny muted" style={{ padding: 8 }}>A capacidade depende das instalações (Infraestrutura). Cada profissional extra rende menos que o anterior.</div>
      </Panel>
      <div style={{ height: 12 }} />
      <Tabs tabs={[{ id: 'equipe', label: `Minha equipe (${mine.length})` }, { id: 'mercado', label: 'Profissionais livres' }]} value={tab} onChange={setTab} />
      <div className="row" style={{ margin: '8px 0' }}>
        <select value={role} onChange={(e) => setRole(e.target.value as StaffRole | '')} aria-label="Filtrar área"><option value="">Todas as áreas</option>{STAFF_ROLES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      </div>
      {tab === 'equipe' ? (
        <Panel flush>
          <Table rows={mine.filter((s) => !role || s.role === role)} rowKey={(s) => s.id} initialSort={{ key: 'a', dir: -1 }} cols={[
            { key: 'n', label: 'Nome', render: (s) => <span>{s.name}{s.exPlayerId && <span className="chip star" style={{ marginLeft: 6 }}>ex-jogador</span>}</span>, sort: (s) => s.name },
            { key: 'r', label: 'Área', render: (s) => <span className="small">{ROLE_NAME[s.role]}</span>, sort: (s) => s.role },
            { key: 'a', label: 'Nível', render: (s) => `${s.ability}/20`, sort: (s) => s.ability, cls: 'n' },
            { key: 'sp', label: 'Especialidade', render: (s) => <span className="small muted">{s.specialty}</span> },
            { key: 'i', label: 'Idade', render: (s) => s.age, sort: (s) => s.age, cls: 'n' },
            { key: 'w', label: 'Salário/ano', render: (s) => <Money v={s.wage} />, sort: (s) => s.wage, cls: 'n' },
            { key: 'x', label: '', render: (s) => (
              <span className="row tight">
                <button className="btn sm" title={`Curso: +1 nível por ${Math.round(s.wage * 0.6).toLocaleString('pt-BR')}`} disabled={s.ability >= 20} onClick={() => store.act((cc) => trainStaff(cc, s.id), `${s.name} concluiu o curso de capacitação.`)}>Curso</button>
                <button className="btn sm danger" onClick={() => setFire(s.id)}>Dispensar</button>
              </span>
            ) },
          ]} empty="Nenhum profissional nesta área." />
        </Panel>
      ) : (
        <Panel flush>
          <Table rows={free} rowKey={(s) => s.id} maxRows={80} initialSort={{ key: 'a', dir: -1 }} cols={[
            { key: 'n', label: 'Nome', render: (s) => <span>{s.name}{s.exPlayerId && <span className="chip star" style={{ marginLeft: 6 }}>ex-jogador</span>}</span>, sort: (s) => s.name },
            { key: 'r', label: 'Área', render: (s) => <span className="small">{ROLE_NAME[s.role]}</span>, sort: (s) => s.role },
            { key: 'a', label: 'Nível', render: (s) => `${s.ability}/20`, sort: (s) => s.ability, cls: 'n' },
            { key: 'na', label: 'País', render: (s) => <span className="small">{natName(s.nat)}</span> },
            { key: 'i', label: 'Idade', render: (s) => s.age, sort: (s) => s.age, cls: 'n' },
            { key: 'w', label: 'Salário/ano', render: (s) => <Money v={s.wage} />, sort: (s) => s.wage, cls: 'n' },
            { key: 'x', label: '', render: (s) => {
              const full = clubStaff(c, club, s.role).length >= staffCapacity(club, s.role);
              return <button className="btn sm primary" disabled={full} title={full ? 'Capacidade da área atingida' : `Luva: ${Math.round(s.wage * 0.5).toLocaleString('pt-BR')}`} onClick={() => store.act((cc) => hireStaff(cc, s.id), `${s.name} contratado.`)}>Contratar</button>;
            } },
          ]} empty="Nenhum profissional livre com esse filtro." />
        </Panel>
      )}
      {fire && (() => {
        const s = c.staff[fire];
        return <Confirm title={`Dispensar ${s.name}?`} danger confirmLabel="Dispensar" text={<>A rescisão custa <strong><Money v={Math.round(s.wage * 0.5)} /></strong>. O profissional volta ao mercado.</>} onNo={() => setFire(null)} onYes={() => { store.act((cc) => fireStaff(cc, fire), 'Profissional dispensado.'); setFire(null); }} />;
      })()}
    </div>
  );
}
