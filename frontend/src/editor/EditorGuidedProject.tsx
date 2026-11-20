import { useState, type FormEvent } from 'react';
import type { EditorialReviewGuide, EditorialReviewKind, EditorialReviewVersion } from '../../../shared/editorialReview';
import { readEditorialFile } from '../lib/editorialFiles';
import { submitEditorReview } from './editorApi';
import { EdicionExtraccionWizard } from './EditorMiTrabajo';
import { RrppIcon } from '../rrpp/RrppIcons';

const statusLabel=(review:EditorialReviewVersion|null)=>!review?'Por enviar':({pending:'Esperando al Autor',approved:'Aprobado por el Autor',changes_requested:'Feedback por aplicar',cancelled:'Solicitud retirada'}[review.status]);
export function TitleProposalFields({titles,onChange,disabled=false}:{titles:string[];onChange:(titles:string[])=>void;disabled?:boolean}){
  return <fieldset className="mw-title-fields" disabled={disabled}><legend>Posibles títulos</legend><p>El Autor podrá elegir uno o pedir nuevas propuestas después de aprobar la tripa.</p>{titles.map((title,index)=><div className="mw-title-row" key={index}><label>Propuesta {index+1}<input required minLength={2} maxLength={200} value={title} onChange={e=>onChange(titles.map((t,i)=>i===index?e.target.value:t))}/></label>{titles.length>1&&<button type="button" className="eo-text-button" aria-label={'Eliminar propuesta '+(index+1)} onClick={()=>onChange(titles.filter((_,i)=>i!==index))}>Eliminar</button>}</div>)}<button type="button" className="ec-secondary" disabled={titles.length>=20} onClick={()=>onChange([...titles,''])}>Añadir otro título</button></fieldset>;
}
export function ReviewStatus({review}:{review:EditorialReviewVersion|null}){
  if(!review)return null;
  return <div className={'mw-review-status mw-review-'+review.status} role="status"><strong>{statusLabel(review)} · v{review.metadata.version}</strong>{review.status==='pending'&&<p>El Autor recibió esta versión en su dashboard. Te notificaremos cuando responda.</p>}{review.status==='approved'&&<p>Esta versión quedó aprobada y se conserva en el historial.</p>}{review.feedback&&<blockquote>{review.feedback}</blockquote>}{review.response?.feedbackFile&&<a className="ec-primary" href={review.response.feedbackFile.url} target="_blank" rel="noreferrer">Descargar {review.metadata.kind==='chapter'?`capítulo ${review.metadata.chapterNumber}`:'tripa'} con feedback ↗</a>}{review.file&&<a className="ec-secondary" href={review.file.url} target="_blank" rel="noreferrer">Abrir versión enviada ↗</a>}</div>;
}
function ReviewHistory({items}:{items:EditorialReviewVersion[]}){
  if(!items.length)return null;
  return <details className="mw-review-history"><summary>Historial de versiones ({items.length})</summary><ol>{items.map(r=><li key={r.id}><strong>v{r.metadata.version} · {statusLabel(r)}</strong><small>{new Date(r.requestedAt).toLocaleString('es-VE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Caracas'})}</small>{r.file&&<a href={r.file.url} target="_blank" rel="noreferrer">Descargar versión</a>}{r.response?.feedbackFile&&<a href={r.response.feedbackFile.url} target="_blank" rel="noreferrer">Descargar feedback</a>}{r.feedback&&<p>{r.feedback}</p>}{r.response?.selectedTitle&&<p>Título elegido: {r.response.selectedTitle}</p>}</li>)}</ol></details>;
}
function ReviewUploadForm({guide,kind,number,previous,onDone}:{guide:EditorialReviewGuide;kind:EditorialReviewKind;number?:number;previous:EditorialReviewVersion|null;onDone:()=>Promise<void>}){
  const [file,setFile]=useState<File|null>(null),[titles,setTitles]=useState(previous?.metadata.proposedTitles??['','']),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [requestKey]=useState(()=>crypto.randomUUID());
  async function submit(e:FormEvent){
    e.preventDefault();if(busy)return;setBusy(true);setError('');
    try{
      if(kind!=='titles'&&!file)throw new Error('Selecciona el documento que vas a enviar al Autor.');
      await submitEditorReview(guide.projectId,{kind,chapterNumber:number,expectedVersion:previous?.metadata.version??0,requestKey,
        ...(file?{file:await readEditorialFile(file)}:{}),...(kind!=='chapter'?{proposedTitles:titles.map(t=>t.trim())}:{}),...(kind==='manuscript'?{chaptersConfirmed:confirmed}:{})});
      await onDone();
    }catch(e){setError(e instanceof Error?e.message:'No se pudo enviar la revisión.');}finally{setBusy(false);}
  }
  const next=(previous?.metadata.version??0)+1;
  return <form className="ep-form mw-review-form" onSubmit={submit}><fieldset disabled={busy||!!guide.blockedReason||!guide.authorHasAccount}>
    <legend>{kind==='titles'?'Enviar nuevas propuestas':`Subir ${kind==='chapter'?`Capítulo ${number}`:'tripa completa'} · v${next}`}</legend>
    {previous?.status==='changes_requested'&&<p>Aplica los comentarios y envía una nueva versión. La anterior y su feedback se conservan.</p>}
    {kind!=='titles'&&<label>Documento Word o PDF<input type="file" required accept=".doc,.docx,.pdf" onChange={e=>setFile(e.target.files?.[0]??null)}/><small>Hasta 20 MB · Se guardará como {kind==='chapter'?`Capítulo ${number}`:'Tripa completa'} v{next} en Edición.</small></label>}
    {kind!=='chapter'&&<TitleProposalFields titles={titles} onChange={setTitles}/>}
    {kind==='manuscript'&&<label className="mw-check-label"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo que esta tripa incluye todos los capítulos aprobados del libro.</label>}
    {error&&<p role="alert" className="eo-error">{error}</p>}<button className="ec-primary" disabled={busy}>{busy?'Guardando y enviando…':kind==='titles'?'Enviar títulos al Autor':`Guardar v${next} y enviar al Autor`}</button>
  </fieldset></form>;
}
export function EditorGuidedProject({guide:g,onBack,onRefetch}:{guide:EditorialReviewGuide;onBack:()=>void;onRefetch:()=>Promise<void>}){
  const [chosenStep,setStep]=useState<string|null>(null),[chapter,setChapter]=useState<number|null>(null),[extra,setExtra]=useState('');
  const step=chosenStep??g.currentStep;
  const numbers=g.chapters.map(c=>c.number),activeNumber=chapter??g.chapters.find(c=>c.latest?.status==='changes_requested'||!c.latest)?.number??numbers[0]??1;
  const current=g.chapters.find(c=>c.number===activeNumber);
  const allApproved=g.chapters.length>0&&g.chapters.every(c=>c.latest?.status==='approved');
  if(step==='interviews'&&g.extraction)return <EdicionExtraccionWizard item={{title:g.title,authors:g.authors,projectId:g.projectId}} extraction={g.extraction} onBack={onBack} onRefetch={()=>{void onRefetch();}} onContinue={()=>setStep('chapters')}/>;
  const steps=[...(g.extraction?[['interviews','Entrevistas']]:[]),['chapters','Capítulos'],['manuscript','Tripa completa'],['titles','Título del libro']];
  return <section className="mw-page mw-wizard-page mw-editor-guide" aria-label="Guía de edición del proyecto">
    <button type="button" className="mw-wizard-back" onClick={onBack}><RrppIcon nombre="flecha" className="mw-wizard-back-icon"/>Volver a Mi trabajo</button>
    <header className="mw-wizard-header"><span className="ap-eyebrow">GUÍA DE EDICIÓN</span><h1>{g.title}</h1><p>{g.authors}</p></header>
    <nav className="mw-wizard-steps" aria-label="Pasos de edición">{steps.map(([key,label],index)=><button key={key} type="button" className={'mw-wizard-step'+(step===key?' is-active':'')} onClick={()=>setStep(key)} disabled={(key==='manuscript'&&!allApproved)||(key==='titles'&&g.manuscript?.status!=='approved')}><span>{index+1}</span>{label}</button>)}</nav>
    {g.blockedReason&&<p className="eo-error" role="alert">{g.blockedReason}</p>}{!g.authorHasAccount&&<p className="eo-notice">El Autor necesita una cuenta activa. Solicita al Especialista que lo invite para poder enviarle los capítulos.</p>}
    {step==='interviews'&&!g.extraction&&<div className="mw-wizard-card"><h2>Esperando el cronograma de entrevistas</h2><p>El Especialista debe programar las sesiones de extracción antes de comenzar. Cuando estén listas, aparecerán aquí.</p></div>}
    {step==='chapters'&&<>
      <div className="mw-wizard-card"><span className="ap-eyebrow">UN CAPÍTULO, UNA REVISIÓN A LA VEZ</span><h2>Capítulos para revisar con el Autor</h2><p>Sube cada capítulo. Cuando el Autor devuelva sus comentarios, descarga su archivo y envía la siguiente versión hasta que lo apruebe.</p>
        <nav className="mw-chapter-grid" aria-label="Capítulos del proyecto">{g.chapters.map(c=><button type="button" key={c.number} aria-pressed={activeNumber===c.number} onClick={()=>setChapter(c.number)}><strong>Capítulo {c.number}</strong><small>{statusLabel(c.latest)}{c.latest?` · v${c.latest.metadata.version}`:''}</small></button>)}</nav>
        {!g.manuscript&&<form className="mw-add-chapter" onSubmit={e=>{e.preventDefault();setChapter(Number(extra));setExtra('');}}><label>Añadir otro capítulo<input aria-label="Número del nuevo capítulo" type="number" min={1} max={200} required value={extra} onChange={e=>setExtra(e.target.value)}/></label><button className="ec-secondary">Abrir capítulo</button></form>}
      </div>
      <article className="mw-wizard-card mw-chapter-focus"><h2>Capítulo {activeNumber}</h2><ReviewStatus review={current?.latest??null}/>
        {(!current?.latest||['changes_requested','cancelled'].includes(current.latest.status))&&!g.manuscript&&g.currentStep!=='interviews'&&<ReviewUploadForm key={`chapter-${activeNumber}-${current?.latest?.id??'new'}`} guide={g} kind="chapter" number={activeNumber} previous={current?.latest??null} onDone={onRefetch}/>}
        <ReviewHistory items={current?.history??[]}/>
      </article>
      {allApproved&&<button className="ec-primary mw-wizard-continue" onClick={()=>setStep('manuscript')}>Todos los capítulos están aprobados · Continuar a tripa completa →</button>}
    </>}
    {step==='manuscript'&&<article className="mw-wizard-card"><span className="ap-eyebrow">EL LIBRO COMPLETO</span><h2>Tripa completa y posibles títulos</h2><p>Reúne los capítulos aprobados en un solo archivo y escribe debajo las propuestas de título.</p><ReviewStatus review={g.manuscript}/>
      {allApproved&&(!g.manuscript||['changes_requested','cancelled'].includes(g.manuscript.status))&&<ReviewUploadForm key={g.manuscript?.id??'manuscript-new'} guide={g} kind="manuscript" previous={g.manuscript} onDone={onRefetch}/>}
      {g.manuscript?.metadata.proposedTitles&&<div className="mw-title-preview"><h3>Títulos enviados con esta versión</h3><ol>{g.manuscript.metadata.proposedTitles.map(t=><li key={t}>{t}</li>)}</ol></div>}
      <ReviewHistory items={g.history.filter(r=>r.metadata.kind==='manuscript')}/>
      {g.manuscript?.status==='approved'&&<button className="ec-primary mw-wizard-continue" onClick={()=>setStep('titles')}>Continuar a la elección del título →</button>}
    </article>}
    {(step==='titles'||step==='complete')&&<article className="mw-wizard-card"><span className="ap-eyebrow">EL NOMBRE DE SU HISTORIA</span><h2>{g.titles?.status==='approved'?'Título aprobado':'Títulos propuestos al Autor'}</h2><ReviewStatus review={g.titles}/>
      {g.titles?.status==='approved'?<div className="mw-approved-title"><h3>{g.selectedTitle}</h3><p>El Autor aprobó todos los capítulos, la tripa completa y el título. La edición está lista para el siguiente proceso editorial.</p></div>:g.titles&&['changes_requested','cancelled'].includes(g.titles.status)?<ReviewUploadForm key={g.titles.id} guide={g} kind="titles" previous={g.titles} onDone={onRefetch}/>:<ol className="mw-title-preview">{g.titles?.metadata.proposedTitles?.map(t=><li key={t}>{t}</li>)}</ol>}
      <ReviewHistory items={g.history.filter(r=>r.metadata.kind==='titles')}/>
    </article>}
  </section>;
}
