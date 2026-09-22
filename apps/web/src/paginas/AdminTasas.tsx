import type { ActualizacionTasaDto } from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  CAMPOS_TASA,
  NOMBRE_CAMPO_TASA,
  aprobarTasas,
  obtenerPanelTasas,
  porcentaje,
  rechazarTasas,
  revisarTasasSbs,
} from '../lib/alertas';
import { ApiError } from '../lib/api';
import { useToasts } from '../stores/toast';

// =====================================================================
// Aprobación de tasas de la SBS (Sesión 22 — §10.1). SOLO SUPERADMIN.
//
// La regla del proyecto es que NADIE aplica tasas a ciegas: el job
// mensual solo propone, y esta pantalla existe para que un humano compare
// lo vigente con lo detectado y decida. Aprobar crea una vigencia NUEVA
// (la anterior se cierra, no se sobreescribe: las planillas viejas deben
// seguir calculándose con las tasas de su periodo).
// =====================================================================

function Comparativa({ propuesta }: { propuesta: ActualizacionTasaDto }) {
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [vigenteDesde, setVigenteDesde] = useState(propuesta.propuesto.vigenteDesde);
  const [motivo, setMotivo] = useState('');

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['panel-tasas'] });
  };

  const aprobar = useMutation({
    mutationFn: () => aprobarTasas(propuesta.id, vigenteDesde),
    onSuccess: () => {
      agregarToast(
        'exito',
        `Tasas de ${propuesta.administradora} aprobadas: rigen desde ${vigenteDesde}`,
      );
      invalidar();
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo aprobar'),
  });

  const rechazar = useMutation({
    mutationFn: () => rechazarTasas(propuesta.id, motivo || undefined),
    onSuccess: () => {
      agregarToast('exito', 'Propuesta rechazada: no se cambió ninguna tasa');
      invalidar();
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo rechazar'),
  });

  return (
    <article className="rounded-tarjeta border border-advertencia bg-superficie p-5 shadow-tarjeta">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-seccion font-semibold text-texto">
            {propuesta.administradora}
          </h3>
          <p className="text-apoyo text-texto-tenue">
            Detectada el {propuesta.detectadaEn} ·{' '}
            <a
              href={propuesta.fuenteUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              fuente SBS
            </a>
          </p>
        </div>
        <span className="rounded-full bg-advertencia-suave px-3 py-1 text-apoyo font-semibold text-advertencia">
          Pendiente de aprobación
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-cuerpo">
          <thead>
            <tr className="border-b border-borde text-apoyo uppercase text-texto-tenue">
              <th className="py-2">Concepto</th>
              <th className="py-2">Vigente hoy</th>
              <th className="py-2">Propuesto</th>
            </tr>
          </thead>
          <tbody>
            {CAMPOS_TASA.map((campo) => {
              const cambia = propuesta.camposDistintos.includes(campo);
              const vigente = propuesta.vigente?.[campo] ?? null;
              return (
                <tr key={campo} className="border-b border-borde">
                  <td className="py-2 text-texto-suave">{NOMBRE_CAMPO_TASA[campo]}</td>
                  <td className="py-2 text-texto-suave">
                    {vigente ? porcentaje(vigente) : '—'}
                  </td>
                  <td
                    className={`py-2 font-medium ${cambia ? 'text-advertencia' : 'text-texto-suave'}`}
                  >
                    {porcentaje(propuesta.propuesto[campo])}
                    {cambia && ' ←'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-apoyo text-texto-suave">
        El aporte al fondo lo fija la ley, no la web de la SBS: se conserva el
        vigente. Solo los campos marcados cambian.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-borde pt-4">
        <div>
          <label
            htmlFor={`vigencia-${propuesta.id}`}
            className="block text-apoyo font-medium text-texto-suave"
          >
            Rige desde
          </label>
          <input
            id={`vigencia-${propuesta.id}`}
            type="date"
            value={vigenteDesde}
            onChange={(e) => setVigenteDesde(e.target.value)}
            className="mt-1 rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo"
          />
        </div>
        <button
          type="button"
          onClick={() => aprobar.mutate()}
          disabled={aprobar.isPending}
          className="rounded-control bg-exito px-4 py-2 text-cuerpo font-medium text-white hover:bg-exito disabled:bg-borde"
        >
          Aprobar y versionar
        </button>
        <div className="flex-1">
          <label
            htmlFor={`motivo-${propuesta.id}`}
            className="block text-apoyo font-medium text-texto-suave"
          >
            Motivo del rechazo (opcional)
          </label>
          <input
            id={`motivo-${propuesta.id}`}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Aún no publicada oficialmente…"
            className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo"
          />
        </div>
        <button
          type="button"
          onClick={() => rechazar.mutate()}
          disabled={rechazar.isPending}
          className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
        >
          Rechazar
        </button>
      </div>
    </article>
  );
}

export function AdminTasas() {
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);

  const { data: panel } = useQuery({
    queryKey: ['panel-tasas'],
    queryFn: obtenerPanelTasas,
  });

  const revisar = useMutation({
    mutationFn: revisarTasasSbs,
    onSuccess: (nuevo) => {
      agregarToast(
        nuevo.pendientes.length > 0 ? 'advertencia' : 'exito',
        nuevo.pendientes.length > 0
          ? `${nuevo.pendientes.length} propuesta(s) esperando tu aprobación`
          : 'La SBS no muestra cambios respecto a lo vigente',
      );
      void queryClient.invalidateQueries({ queryKey: ['panel-tasas'] });
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo revisar'),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-titulo font-semibold text-texto">Tasas AFP (SBS)</h1>
          <p className="text-cuerpo text-texto-suave">
            El job mensual revisa la página de la SBS y propone los cambios.
            Ninguna tasa se aplica sin que la apruebes aquí.
          </p>
        </div>
        <button
          type="button"
          onClick={() => revisar.mutate()}
          disabled={revisar.isPending}
          className="rounded-control bg-primario px-4 py-2 text-cuerpo font-medium text-white hover:bg-primario-oscuro disabled:bg-borde"
        >
          {revisar.isPending ? 'Consultando la SBS…' : 'Revisar ahora'}
        </button>
      </header>

      {panel?.ultimoFallo && (
        <div className="rounded-tarjeta border border-peligro/30 bg-peligro-suave p-4 text-cuerpo text-peligro">
          <p className="font-semibold">
            La última lectura de la SBS falló ({panel.ultimoFallo.fecha})
          </p>
          <p className="mt-1">{panel.ultimoFallo.motivo}</p>
          <p className="mt-1 text-apoyo">
            El scraping es frágil por naturaleza: si la SBS rediseñó su página,
            actualiza SBS_TASAS_URL o carga las tasas a mano. Nada se aplicó.
          </p>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-seccion font-semibold text-texto">
          Propuestas pendientes
        </h2>
        {panel?.pendientes.length === 0 ? (
          <p className="rounded-tarjeta bg-superficie p-6 text-cuerpo text-texto-suave shadow-tarjeta">
            Nada pendiente. Última revisión: {panel.ultimaRevision ?? 'nunca'}.
          </p>
        ) : (
          panel?.pendientes.map((p) => <Comparativa key={p.id} propuesta={p} />)
        )}
      </section>

      <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <h2 className="mb-3 text-seccion font-semibold text-texto">
          Tasas vigentes hoy
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-cuerpo">
            <thead>
              <tr className="border-b border-borde text-apoyo uppercase text-texto-tenue">
                <th className="py-2">AFP</th>
                <th className="py-2">Fondo</th>
                <th className="py-2">Prima</th>
                <th className="py-2">Com. flujo</th>
                <th className="py-2">Com. saldo</th>
                <th className="py-2">Desde</th>
                <th className="py-2">Hasta</th>
              </tr>
            </thead>
            <tbody>
              {panel?.vigentes.map((t) => (
                <tr key={t.administradora} className="border-b border-borde">
                  <td className="py-2 font-medium text-texto">
                    {t.administradora}
                  </td>
                  <td className="py-2">{porcentaje(t.fondo)}</td>
                  <td className="py-2">{porcentaje(t.primaSeguro)}</td>
                  <td className="py-2">{porcentaje(t.comisionFlujo)}</td>
                  <td className="py-2">{porcentaje(t.comisionSaldo)}</td>
                  <td className="py-2 text-texto-suave">{t.vigenteDesde}</td>
                  <td className="py-2 text-texto-suave">{t.vigenteHasta ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-apoyo text-texto-tenue">Fuente configurada: {panel?.fuenteUrl}</p>
      </section>
    </div>
  );
}
