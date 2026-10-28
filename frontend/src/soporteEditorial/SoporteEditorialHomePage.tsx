import './soporteEditorialHome.css';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { TopBar } from '../layout/TopBar';
import { PRODUCTION_LOGO } from '../layout/RoleProjectNavigation';
import { RrppIcon } from '../rrpp/RrppIcons';
import { apiFetch } from '../lib/api';
import { useMe } from '../auth/useAuth';
import type { SoporteEditorialDashboard, ValidationItem } from '../../../shared/soporteEditorialHome';
import { SoporteEditorialCover as Cover, SoporteEditorialMobileNavigation, SoporteEditorialNavigation, soporteEditorialDate as date, soporteEditorialHomeKey, openValidationUrl } from './SoporteEditorialUi';

export { soporteEditorialHomeKey };

function Status({ item }: { item: ValidationItem }) {
  const label = item.deadlineState === 'vencido' ? 'Vencida' : item.stateLabel;
  const tone = item.deadlineState === 'vencido' ? 'red' : item.deadlineState === 'proximo_a_vencer' ? 'amber' : item.state === 'inProgress' ? 'blue' : 'neutral';
  return <span className={'se-status se-' + tone}><i aria-hidden="true" />{label}</span>;
}

function AttentionTable({ items }: { items: ValidationItem[] }) {
  return <table className="se-table"><caption className="sr-only">Una fila por ronda de validación de Calidad que requiere atención.</caption><thead><tr><th scope="col">Proyecto / Autor</th><th scope="col">Tipo de validación</th><th scope="col">Fecha límite</th><th scope="col">Estado</th><th scope="col"><span className="sr-only">Abrir validación</span></th></tr></thead><tbody>{items.map(item => <tr key={item.workItemId}>
    <td><div className="se-identity"><Cover url={item.coverUrl} /><div><strong title={item.code}>{item.title}</strong><span>{item.authors}</span></div></div></td>
    <td data-label="Tipo de validación"><strong>{item.validationType}</strong><small>F{item.numeroFase}.{item.ronda}</small></td>
    <td data-label="Fecha límite"><time className={item.deadlineState === 'vencido' ? 'se-overdue' : ''} dateTime={item.deadline ?? undefined}>{date(item.deadline)}</time>{item.deadlineState === 'proximo_a_vencer' && <small className="se-soon">Vence pronto</small>}</td>
    <td data-label="Estado"><Status item={item} /></td>
    <td><Link className="se-work-link" to={openValidationUrl(item.projectId)} aria-label={item.cta + ': ' + item.validationType + ' de ' + item.title}>{item.cta}<RrppIcon nombre="flecha" /></Link></td>
  </tr>)}</tbody></table>;
}

function HomeContent() {
  const q = useQuery({ queryKey: soporteEditorialHomeKey, queryFn: () => apiFetch<SoporteEditorialDashboard>('/calidad/inicio') });
  if (q.isPending) return <div className="se-skeleton" role="status" aria-label="Cargando la bandeja de Calidad"><div>{[1, 2, 3, 4].map(n => <i key={n} />)}</div><section>{[1, 2, 3, 4].map(n => <i key={n} />)}</section><aside /></div>;
  if (q.isError) return <section className="se-error"><RrppIcon nombre="riesgo" /><h2>No se pudo cargar tu Inicio</h2><p role="alert">No pudimos consultar la bandeja de Calidad. Inténtalo de nuevo.</p><button onClick={() => q.refetch()}>Reintentar</button></section>;
  const d = q.data;
  const summary = [
    { label: 'Validaciones activas', value: d.summary.active, icon: 'lista', tone: 'blue', help: 'Bandeja compartida de Calidad' },
    { label: 'Vencen pronto', value: d.summary.dueSoon, icon: 'actividad', tone: 'amber', help: 'En las próximas 24 horas' },
    { label: 'Vencidas', value: d.summary.overdue, icon: 'riesgo', tone: 'red', help: 'Requieren atención' },
    { label: 'Nuevas rondas', value: d.summary.newRounds, icon: 'proceso', tone: 'green', help: 'Pendientes de iniciar' },
  ] as const;
  return <div className="se-grid"><div className="se-main">
    <div className="se-summary" aria-label="Resumen de la bandeja de Calidad">{summary.map(s => <article className={'se-summary-card se-' + s.tone} key={s.label}><span className="se-summary-icon"><RrppIcon nombre={s.icon} /></span><div><strong>{s.value}</strong><h2>{s.label}</h2><small>{s.help}</small></div></article>)}</div>
    <section className="se-panel se-attention" aria-label="Validaciones que requieren atención"><header><h2>Requiere tu atención <span>{d.attentionItems.length}</span></h2></header>
      {d.attentionItems.length ? <AttentionTable items={d.attentionItems} /> : d.summary.active > 0
        ? <div className="se-empty"><RrppIcon nombre="check" /><h3>No hay validaciones que requieran atención inmediata.</h3><p>Las validaciones activas sin urgencia aparecen en Próximos vencimientos.</p></div>
        : <div className="se-empty"><RrppIcon nombre="check" /><h3>No hay validaciones activas en la bandeja de Calidad.</h3><p>Cuando Diseño entregue una nueva ronda para revisar, aparecerá aquí.</p></div>}
    </section>
    <section className="se-panel se-activity"><header><h2>Últimas actualizaciones</h2></header>
      {d.recentActivity.length ? <ul>{d.recentActivity.map(a => <li key={a.id}><RrppIcon nombre="actividad" /><div><strong>{a.label}</strong><span>{a.projectTitle}</span></div><time dateTime={a.at}>{date(a.at)}</time></li>)}</ul>
        : <p className="se-no-activity">Todavía no hay actividad reciente registrada.</p>}
    </section>
  </div><aside className="se-rail" aria-label="Próximos vencimientos y recordatorio">
    <section className="se-panel se-upcoming"><h2><RrppIcon nombre="calendario" />Próximos vencimientos</h2>
      {d.upcomingDeadlines.length ? <ul>{d.upcomingDeadlines.map(item => <li key={item.workItemId}><strong>{date(item.deadline, true)}</strong><Link to={openValidationUrl(item.projectId)}><span>{item.title}</span><small>{item.validationType}</small></Link>{item.deadlineState === 'proximo_a_vencer' && <em className="se-soon">Vence pronto</em>}</li>)}</ul>
        : <p>No tienes próximos vencimientos registrados.</p>}
    </section>
    <section className="se-panel se-reminder"><span className="se-reminder-icon"><RrppIcon nombre="libro" /></span><p>Revisa siempre el PDF diagramado comparándolo con la tripa fuente. Registra tus observaciones de forma clara para facilitar la siguiente ronda de Diseño.</p></section>
  </aside></div>;
}

export function SoporteEditorialHomePage() {
  const { data: user } = useMe();
  const today = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  return <CrmSidebarLayout nav={<SoporteEditorialNavigation active="inicio" />} logo={PRODUCTION_LOGO} sidebarWidth={224} sidebarBreakpoint="lg" contentMaxWidth="max-w-none" shellClassName="soporte-editorial-layout" contentClassName="soporte-editorial-home" footer={<p className="se-footer">Historias que conectan.</p>}>
    <div className="se-topbar"><div><RrppIcon nombre="libro" /><strong>Soporte Editorial</strong></div><TopBar compacto roleLabel="Soporte Editorial" /></div><SoporteEditorialMobileNavigation active="inicio" />
    <div className="se-body"><nav className="se-breadcrumb" aria-label="Ruta de navegación"><span>Soporte Editorial</span><RrppIcon nombre="flecha" /><strong>Inicio</strong></nav>
      <header className="se-page-header"><div><h1>Tu trabajo de hoy</h1>{user?.nombre && <p>Hola, {user.nombre}. Aquí tienes un resumen de la bandeja de Calidad y lo que requiere tu atención.</p>}</div><time>{today}</time></header>
      <HomeContent />
    </div>
  </CrmSidebarLayout>;
}
