import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMe } from '../auth/useAuth';
import { fetchDecision, responderInfoDecision } from './decisionesApi';
import './decisiones.css';

/** Contextual response for the actual requester; never a resolution inbox. */
export function RespuestaDecisionPage() {
  const { id } = useParams();
  const { data: user } = useMe();
  const cache = useQueryClient();
  const [mensaje, setMensaje] = useState('');
  const detalle = useQuery({
    queryKey: ['decisiones', 'detalle', id],
    queryFn: () => fetchDecision(id!),
    enabled: !!id,
  });
  const mutation = useMutation({
    mutationFn: () =>
      responderInfoDecision(id!, mensaje, detalle.data?.version),
    onSuccess: async () => {
      setMensaje('');
      await Promise.all(
        [
          'decisiones',
          'notificaciones',
          'jefatura',
          'correcciones',
          'seguimiento',
          'ficha',
        ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
  const d = detalle.data;
  return (
    <section className="jd-detail jd-response-page">
      <header className="jd-detail-header">
        <h1>Solicitud de revisión de Jefatura</h1>
        <Link to="/">Volver</Link>
      </header>
      <div className="jd-detail-body">
        {detalle.isLoading && <p>Cargando solicitud…</p>}
        {detalle.isError && (
          <div className="jd-error" role="alert">
            No pudimos abrir esta solicitud.{' '}
            <button onClick={() => detalle.refetch()}>Reintentar</button>
          </div>
        )}
        {d && (
          <>
            <h2>{d.titulo}</h2>
            <p>
              {d.autores} · #{d.codigo}
            </p>
            <section className="jd-ask">
              <h3>{d.subject}</h3>
              <p>{d.requestMessage}</p>
            </section>
            {d.requestedInfoMessage && (
              <section className="jd-info-exchange">
                <h3>Información solicitada</h3>
                <p>{d.requestedInfoMessage}</p>
                {d.respondedInfoMessage && (
                  <>
                    <h3>Respuesta enviada</h3>
                    <p>{d.respondedInfoMessage}</p>
                  </>
                )}
              </section>
            )}
            {d.status === 'informacion_solicitada' &&
            d.requestedByUserId === user?.id ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  mutation.mutate();
                }}
              >
                <fieldset
                  disabled={mutation.isPending}
                  className="jd-response-fields"
                >
                  <label
                    className="jd-confirm-field"
                    htmlFor="decision-respuesta"
                  >
                    Tu respuesta
                    <textarea
                      id="decision-respuesta"
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      maxLength={2000}
                      required
                    />
                  </label>
                  {mutation.isError && (
                    <p className="jd-action-error" role="alert">
                      {mutation.error.message}
                    </p>
                  )}
                  <button
                    className="jd-btn-primary"
                    disabled={!mensaje.trim() || mutation.isPending}
                  >
                    {mutation.isPending ? 'Enviando…' : 'Enviar respuesta'}
                  </button>
                </fieldset>
              </form>
            ) : (
              <p role="status">
                {d.status === 'resuelta'
                  ? `Jefatura ${d.resolutionType === 'approved' ? 'aprobó' : d.resolutionType === 'rejected' ? 'rechazó' : 'canceló'} este caso. ${d.resolutionMessage ?? ''}`
                  : 'La solicitud está pendiente de revisión de Jefatura.'}
              </p>
            )}
            <Link to={`/proyectos/${d.proyectoId}`}>Ver Proyecto 360°</Link>
          </>
        )}
      </div>
    </section>
  );
}
