import './correctorHome.css';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';


import { RrppIcon } from '../rrpp/RrppIcons';
import { apiFetch } from '../lib/api';
import type { CorrectorDashboard, CorrectorHomeItem } from '../../../shared/correctorHome';
import { CorrectorCover as Cover, CorrectorNavigation, correctorDate as date, correctorHomeKey, workUrl as workUrlBase } from './CorrectorUi';

export { correctorHomeKey };
const workUrl = (item?: CorrectorHomeItem) => workUrlBase(item?.workItemId);
function Status({ item }: { item: CorrectorHomeItem }) {
  const label = item.deadlineState === 'vencido' ? 'Vencida' : item.stateLabel;
  const tone = item.deadlineState === 'vencido' ? 'red' : item.state === 'completed' ? 'green' : item.state === 'blocked' ? 'red' : item.state === 'inProgress' ? 'amber' : 'neutral';
  return <span className={'coh-status coh-' + tone}><i aria-hidden="true" />{label}</span>;
}
function CorrectionList({ items }: { items: CorrectorHomeItem[] }) {
  return <table className="coh-table"><caption className="sr-only">Una fila por intervención de corrección asignada a tu cuenta.</caption><thead><tr><th scope="col">Proyecto / Autor</th><th scope="col">Intervención</th><th scope="col">Fecha límite</th><th scope="col">Estado</th><th scope="col"><span className="sr-only">Abrir trabajo</span></th></tr></thead><tbody>{items.map(item => <tr key={item.workItemId}>
    <td><div className="coh-identity"><Cover url={item.coverUrl} /><div><strong title={item.code}>{item.title}</strong><span>{item.authors}</span></div></div></td>
    <td data-label="Intervención"><strong>{item.intervention}</strong>{item.blocker && <small className="coh-blocker-reason">{item.blocker}</small>}</td>
    <td data-label="Fecha límite"><time className={item.deadlineState === 'vencido' ? 'coh-overdue' : ''} dateTime={item.deadline ?? undefined}>{item.state === 'paused' ? 'Proyecto en pausa' : date(item.deadline)}</time>{item.deadlineState === 'proximo_a_vencer' && <small className="coh-soon">Vence pronto</small>}</td>
    <td data-label="Estado"><Status item={item} /></td><td><Link className="coh-work-link" to={workUrl(item)} aria-label={item.cta + ': ' + item.intervention + ' de ' + item.title}>{item.cta}<RrppIcon nombre="flecha" /></Link></td>
  </tr>)}</tbody></table>;
}
function HomeContent() {
  const q = useQuery({ queryKey: correctorHomeKey, queryFn: () => apiFetch<CorrectorDashboard>('/correcciones/inicio') });
  if (q.isPending) return <div className="coh-skeleton" role="status" aria-label="Cargando tus correcciones"><div>{[1, 2, 3, 4].map(n => <i key={n} />)}</div><section>{[1, 2, 3, 4].map(n => <i key={n} />)}</section><aside /></div>;
  if (q.isError) return <section className="coh-error"><RrppIcon nombre="riesgo" /><h2>No se pudo cargar tu Inicio</h2><p role="alert">No pudimos consultar tus correcciones. Inténtalo de nuevo.</p><button onClick={() => q.refetch()}>Reintentar</button></section>;
  const d = q.data;
  const summary = [{ label: 'Correcciones activas', value: d.summary.active, icon: 'lista', tone: 'blue', help: 'Asignadas a tu cuenta' }, { label: 'Vencen pronto', value: d.summary.dueSoon, icon: 'actividad', tone: 'amber', help: 'Según su plazo de corrección' }, { label: 'Vencidas', value: d.summary.overdue, icon: 'riesgo', tone: 'red', help: 'Pendientes a tu cargo' }, { label: 'Entregadas este mes', value: d.summary.completedThisMonth, icon: 'check', tone: 'green', help: d.monthLabel }] as const;
  const quick = d.attentionItems.find(i => i.actionable);
  return <div className="coh-grid"><div className="coh-main">
    <div className="coh-summary" aria-label="Resumen de tus correcciones">{summary.map(s => <article className={'coh-summary-card coh-' + s.tone} key={s.label}><span className="coh-summary-icon"><RrppIcon nombre={s.icon} /></span><div><strong>{s.value}</strong><h2>{s.label}</h2><small>{s.help}</small></div></article>)}</div>
    <section className="coh-panel coh-attention" aria-label="Correcciones que requieren tu atención"><header><h2>Requiere tu atención <span>{d.activeTotal}</span></h2>{d.activeTotal > 0 && <Link to={workUrl()}>Ver todo mi trabajo <RrppIcon nombre="flecha" /></Link>}</header>
      {d.attentionItems.length ? <CorrectionList items={d.attentionItems} /> : <div className="coh-empty"><RrppIcon nombre="check" /><h3>No tienes correcciones asignadas actualmente.</h3><p>Cuando recibas una nueva asignación aparecerá aquí.</p></div>}
      {d.activeTotal > d.attentionItems.length && <footer>Mostrando {d.attentionItems.length} de {d.activeTotal} correcciones activas.</footer>}
    </section>
    {d.recentCompleted.length > 0 && <section className="coh-panel coh-completed"><header><h2>Entregadas este mes</h2><span>{d.monthLabel}</span></header><ul>{d.recentCompleted.map(item => <li key={item.workItemId}><RrppIcon nombre="check" /><div><strong>{item.title}</strong><span>{item.intervention} · {date(item.completedAt)}</span></div><Link to={workUrl(item)}>Ver entrega <RrppIcon nombre="flecha" /></Link></li>)}</ul></section>}
  </div><aside className="coh-rail" aria-label="Ayuda y próxima entrega">
    <section className="coh-panel coh-guide"><span className="coh-guide-icon"><RrppIcon nombre="libro" /></span><h2>Tu trabajo, en tres pasos</h2><ol><li><span>1</span><div><strong>Revisa el material</strong><p>Abre el documento de «Para corregir».</p></div></li><li><span>2</span><div><strong>Realiza la corrección</strong><p>Usa control de cambios y prepara el informe técnico.</p></div></li><li><span>3</span><div><strong>Registra tu entrega</strong><p>Deja ambos archivos en «Corregido» y registra tu entrega.</p></div></li></ol></section>
    <section className="coh-panel coh-next"><h2><RrppIcon nombre="calendario" />Próxima entrega</h2>{d.nextDeadline ? <><strong>{d.nextDeadline.title}</strong><p>{d.nextDeadline.intervention}</p><time dateTime={d.nextDeadline.deadline!}>{date(d.nextDeadline.deadline, true)}</time><Link to={workUrl(d.nextDeadline)}>Abrir trabajo <RrppIcon nombre="flecha" /></Link></> : <p>No tienes próximas entregas con fecha registrada.</p>}</section>
    {quick && <Link className="coh-quick" to={workUrl(quick)}><RrppIcon nombre="proceso" /><span>{quick.cta}<span>{quick.title}</span></span><RrppIcon nombre="flecha" /></Link>}
  </aside></div>;
}
export function CorrectorHomePage() {
  const today = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  return <CrmSidebarLayout nav={<CorrectorNavigation active="inicio" />}    contentMaxWidth="max-w-none" shellClassName="corrector-layout" contentClassName="corrector-home" >

    <div className="coh-body"><nav className="coh-breadcrumb" aria-label="Ruta de navegación"><span>Corrector</span><RrppIcon nombre="flecha" /><strong>Inicio</strong></nav><header className="coh-page-header"><div><h1>Inicio</h1><p>Aquí puedes ver tus correcciones activas y lo que necesita tu atención.</p></div><time>{today}</time></header><HomeContent /></div>
  </CrmSidebarLayout>;
}
