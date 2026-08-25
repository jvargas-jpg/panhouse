import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { crearAutor } from './autoresApi';

// Único formulario de esta pantalla: alta de autor. comercial y
// dirección son los únicos roles con permiso de escritura (ver
// ROLES_ESCRITURA_AUTORES en server/routes/autores.routes.ts).
export function CrearAutorForm() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [pais, setPais] = useState('');
  const [relevancia, setRelevancia] = useState('');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      crearAutor({
        nombre,
        email: email || undefined,
        telefono: telefono || undefined,
        pais: pais || undefined,
        relevancia: relevancia ? Number(relevancia) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autores'] });
      setNombre('');
      setEmail('');
      setTelefono('');
      setPais('');
      setRelevancia('');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <div className="sticky top-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl shadow-gray-200/50 sm:p-8">
      <h3 className="mb-6 border-b border-gray-100 pb-4 text-lg font-semibold text-gray-900">Registrar Nuevo Autor</h3>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="autor-nombre" className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Nombre
          </label>
          <input
            id="autor-nombre"
            type="text"
            required
            value={nombre}
            onChange={(event) => {
              setNombre(event.target.value);
              mutacion.reset();
            }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40"
          />
        </div>

        <div>
          <label htmlFor="autor-email" className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Correo
          </label>
          <input
            id="autor-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              mutacion.reset();
            }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40"
          />
        </div>

        <div>
          <label htmlFor="autor-telefono" className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Teléfono
          </label>
          <input
            id="autor-telefono"
            type="text"
            value={telefono}
            onChange={(event) => {
              setTelefono(event.target.value);
              mutacion.reset();
            }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40"
          />
        </div>

        <div>
          <label htmlFor="autor-pais" className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
            País
          </label>
          <input
            id="autor-pais"
            type="text"
            value={pais}
            onChange={(event) => {
              setPais(event.target.value);
              mutacion.reset();
            }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40"
          />
        </div>

        <div>
          <label htmlFor="autor-relevancia" className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Relevancia
          </label>
          <select
            id="autor-relevancia"
            value={relevancia}
            onChange={(event) => {
              setRelevancia(event.target.value);
              mutacion.reset();
            }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40"
          >
            <option value="">Sin definir</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={mutacion.isPending}
          className="mt-8 w-full rounded-lg bg-tinta py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
        >
          {mutacion.isPending ? 'Guardando…' : 'Crear Autor'}
        </button>
        {mutacion.isSuccess && <p className="mt-3 text-sm text-green-600">Guardado ✓</p>}
        {mutacion.isError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
          </p>
        )}
      </form>
    </div>
  );
}
