import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { consultarAuditoria } from '../lib/seguridad';
import { SkeletonTabla } from '../componentes/ui';

// =====================================================================
// Historial de auditoría del estudio (Sesión 23 — §4.6).
//
// Solo lectura y solo del propio tenant (lo garantiza el backend). Muestra
// el antes/después de cada mutación sensible: quién cambió un sueldo, quién
// cerró un periodo, quién activó el 2FA y desde qué IP.
// =====================================================================

function Json({ valor }: { valor: unknown }) {
  if (valor === null || valor === undefined) {
    return <span className="text-texto-tenue">—</span>;
  }
  return (
    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-fondo p-2 text-apoyo text-texto-suave">
      {JSON.stringify(valor, null, 1)}
    </pre>
  );
}

export function Auditoria() {
  const [entidad, setEntidad] = useState('');
  const [accion, setAccion] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['auditoria', entidad, accion, desde, hasta, pagina],
    queryFn: () => consultarAuditoria({ entidad, accion, desde, hasta, pagina }),
  });

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  const filtrar = (aplicar: () => void) => {
    aplicar();
    setPagina(1);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-titulo font-semibold text-texto">Auditoría</h1>
        <p className="text-cuerpo text-texto-suave">
          Quién hizo qué y cuándo en tu estudio. El registro es de solo
          lectura: nadie puede editarlo ni borrarlo, tampoco tú.
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
        <div>
          <label htmlFor="entidad" className="block text-apoyo font-medium text-texto-suave">
            Entidad
          </label>
          <select
            id="entidad"
            value={entidad}
            onChange={(e) => filtrar(() => setEntidad(e.target.value))}
            className="mt-1 rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo"
          >
            <option value="">Todas</option>
            {data?.entidades.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="accion" className="block text-apoyo font-medium text-texto-suave">
            Acción
          </label>
          <select
            id="accion"
            value={accion}
            onChange={(e) => filtrar(() => setAccion(e.target.value))}
            className="mt-1 rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo"
          >
            <option value="">Todas</option>
            {data?.acciones.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="desde" className="block text-apoyo font-medium text-texto-suave">
            Desde
          </label>
          <input
            id="desde"
            type="date"
            value={desde}
            onChange={(e) => filtrar(() => setDesde(e.target.value))}
            className="mt-1 rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo"
          />
        </div>
        <div>
          <label htmlFor="hasta" className="block text-apoyo font-medium text-texto-suave">
            Hasta
          </label>
          <input
            id="hasta"
            type="date"
            value={hasta}
            onChange={(e) => filtrar(() => setHasta(e.target.value))}
            className="mt-1 rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo"
          />
        </div>
        {data && (
          <span className="text-cuerpo text-texto-suave">
            {data.total} registro(s)
          </span>
        )}
      </section>

      {isLoading && <SkeletonTabla />}

      {data && data.registros.length === 0 && (
        <p className="rounded-tarjeta bg-superficie p-8 text-center text-cuerpo text-texto-suave shadow-tarjeta">
          Sin movimientos con estos filtros.
        </p>
      )}

      {data && data.registros.length > 0 && (
        <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
          <table className="w-full text-left text-cuerpo">
            <thead>
              <tr className="border-b border-borde text-apoyo uppercase text-texto-tenue">
                <th className="p-3">Fecha</th>
                <th className="p-3">Usuario</th>
                <th className="p-3">Entidad</th>
                <th className="p-3">Acción</th>
                <th className="p-3">Antes</th>
                <th className="p-3">Después</th>
                <th className="p-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.registros.map((r) => (
                <tr key={r.id} className="border-b border-borde align-top">
                  <td className="whitespace-nowrap p-3 text-texto-suave">
                    {r.creadoEn}
                  </td>
                  <td className="p-3 text-texto-suave">{r.usuarioNombre ?? '—'}</td>
                  <td className="p-3 text-texto-suave">{r.entidad}</td>
                  <td className="p-3 font-medium text-texto">{r.accion}</td>
                  <td className="max-w-64 p-3">
                    <Json valor={r.antes} />
                  </td>
                  <td className="max-w-64 p-3">
                    <Json valor={r.despues} />
                  </td>
                  <td className="whitespace-nowrap p-3 text-apoyo text-texto-tenue">
                    {r.ip ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina === 1}
            className="rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-cuerpo text-texto-suave">
            Página {pagina} de {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={pagina >= totalPaginas}
            className="rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
