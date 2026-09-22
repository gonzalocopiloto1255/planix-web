import type { ConceptoLiquidacionDto } from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { generarAsientoLiquidacion } from '../lib/asientos';
import { SkeletonTabla } from '../componentes/ui';
import {
  abrirCertificado5ta,
  abrirLiquidacionPdf,
  emitirLiquidacion,
  listarLiquidaciones,
  previewLiquidacion,
} from '../lib/liquidaciones';
import { soles } from '../lib/planillas';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

function Seccion({
  titulo,
  conceptos,
  total,
}: {
  titulo: string;
  conceptos: ConceptoLiquidacionDto[];
  total?: string;
}) {
  if (conceptos.length === 0) {
    return null;
  }
  return (
    <section className="rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
      <h2 className="text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
        {titulo}
      </h2>
      <ul className="mt-3 space-y-2">
        {conceptos.map((c, i) => (
          <li key={`${c.codigo}-${i}`} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-cuerpo text-texto">{c.descripcion}</p>
              {c.detalle && <p className="text-apoyo text-texto-tenue">{c.detalle}</p>}
            </div>
            <span className="whitespace-nowrap text-cuerpo font-medium text-texto">
              {soles(c.monto)}
            </span>
          </li>
        ))}
      </ul>
      {total && (
        <p className="cifras mt-3 border-t border-borde pt-2 text-right text-cuerpo font-semibold text-texto">
          {soles(total)}
        </p>
      )}
    </section>
  );
}

export function Liquidacion() {
  const { personaId } = useParams<{ personaId: string }>();
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [confirmando, setConfirmando] = useState(false);

  const { data: p, isPending, error } = useQuery({
    queryKey: ['liquidacion-preview', empresa.id, personaId],
    queryFn: () => previewLiquidacion(empresa.id as string, personaId as string),
    enabled: Boolean(empresa.id && personaId),
    retry: false,
  });

  const { data: emitidas } = useQuery({
    queryKey: ['liquidaciones', empresa.id],
    queryFn: () => listarLiquidaciones(empresa.id as string),
    enabled: Boolean(empresa.id),
  });
  const emitida = emitidas?.find((l) => l.personaId === personaId);

  const emitir = useMutation({
    mutationFn: () => emitirLiquidacion(empresa.id as string, personaId as string),
    onSuccess: async (l) => {
      agregarToast('exito', 'Liquidación emitida');
      setConfirmando(false);
      void queryClient.invalidateQueries({ queryKey: ['liquidacion-preview'] });
      void queryClient.invalidateQueries({ queryKey: ['liquidaciones'] });
      await abrirLiquidacionPdf(l.id);
    },
    onError: (e) => {
      setConfirmando(false);
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo emitir');
    },
  });

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <p className="text-cuerpo text-texto-suave">
          Elige la empresa activa.{' '}
          <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }
  if (isPending) {
    return <p className="text-cuerpo text-texto-tenue">Calculando la liquidación…</p>;
  }
  if (error || !p) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <p className="text-cuerpo text-peligro">
          {error instanceof ApiError ? error.message : 'No se pudo calcular la liquidación'}
        </p>
        <Link to="/personas" className="mt-3 inline-block text-cuerpo text-primario hover:underline">
          ← Volver a personas
        </Link>
      </div>
    );
  }

  const porCodigo = (...codigos: string[]) =>
    p.conceptos.filter((c) => codigos.includes(c.codigo));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-subtitulo font-semibold text-texto">
            Liquidación de beneficios sociales
          </h1>
          <p className="text-cuerpo text-texto-suave">
            {p.apellidos}, {p.nombres} · {p.numeroDocumento}
          </p>
        </div>
        <Link
          to={`/personas/${p.personaId}`}
          className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
        >
          ← Ficha
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 rounded-tarjeta bg-superficie p-5 shadow-tarjeta sm:grid-cols-4">
        <div>
          <p className="text-apoyo text-texto-tenue">Ingreso</p>
          <p className="text-cuerpo font-medium text-texto">{p.fechaIngreso}</p>
        </div>
        <div>
          <p className="text-apoyo text-texto-tenue">Cese</p>
          <p className="text-cuerpo font-medium text-texto">{p.fechaCese}</p>
        </div>
        <div>
          <p className="text-apoyo text-texto-tenue">Tiempo de servicios</p>
          <p className="text-cuerpo font-medium text-texto">{p.tiempoServicios}</p>
        </div>
        <div>
          <p className="text-apoyo text-texto-tenue">Motivo</p>
          <p className="text-cuerpo font-medium text-texto">{p.motivoCese}</p>
        </div>
      </section>

      {p.advertencias.length > 0 && (
        <div className="rounded-control bg-advertencia-suave px-4 py-3 text-cuerpo text-advertencia">
          <ul className="list-disc space-y-1 pl-5">
            {p.advertencias.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <Seccion
        titulo="Vacaciones"
        conceptos={porCodigo(
          'VACACIONES_PENDIENTES',
          'INDEMNIZACION_VACACIONAL',
          'VACACIONES_TRUNCAS',
        )}
      />
      <Seccion titulo="CTS trunca" conceptos={porCodigo('CTS_TRUNCA')} />
      <Seccion
        titulo="Gratificación trunca"
        conceptos={porCodigo('GRATIFICACION_TRUNCA', 'BONIFICACION_GRATIFICACION')}
      />
      <Seccion titulo="Saldos a favor" conceptos={porCodigo('SALDO_A_FAVOR')} />
      <Seccion
        titulo="Descuentos"
        conceptos={porCodigo('PRESTAMO', 'RETENCION_JUDICIAL')}
        total={p.totalDescuentos}
      />

      {p.notas.length > 0 && (
        <div className="rounded-control bg-fondo px-4 py-3 text-apoyo text-texto-suave">
          <ul className="list-disc space-y-1 pl-5">
            {p.notas.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
        <div className="flex items-center justify-between text-cuerpo text-texto-suave">
          <span>Total de beneficios</span>
          <span>{soles(p.totalIngresos)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-cuerpo text-texto-suave">
          <span>Descuentos</span>
          <span>− {soles(p.totalDescuentos)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-borde pt-3">
          <span className="text-lg font-bold text-texto">NETO A PAGAR</span>
          <span className="text-titulo font-semibold text-primario-oscuro">{soles(p.netoPagar)}</span>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        {emitida ? (
          <>
            <span className="self-center text-cuerpo font-medium text-exito">
              Liquidación emitida
            </span>
            <button
              type="button"
              onClick={() => void abrirLiquidacionPdf(emitida.id)}
              className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
            >
              Descargar liquidación
            </button>
            <button
              type="button"
              onClick={() =>
                void abrirCertificado5ta(
                  empresa.id as string,
                  p.personaId,
                  new Date(p.fechaCese).getFullYear(),
                )
              }
              className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
            >
              Certificado de 5ta
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro"
          >
            Emitir liquidación
          </button>
        )}
      </div>

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-texto/40 p-4">
          <div className="w-full max-w-md rounded-tarjeta bg-superficie p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-texto">Emitir la liquidación</h2>
            <p className="mt-2 text-cuerpo text-texto-suave">
              Se emitirá la liquidación de <strong>{p.apellidos}, {p.nombres}</strong> por
              un neto de <strong>{soles(p.netoPagar)}</strong>.
            </p>
            <p className="mt-2 rounded bg-advertencia-suave px-3 py-2 text-apoyo text-advertencia">
              Al emitir: los préstamos pendientes quedan cancelados, las cuotas de venta de
              vacaciones se marcan pagadas y los periodos vacacionales quedan saldados. La
              liquidación es <strong>inmutable</strong>.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => emitir.mutate()}
                disabled={emitir.isPending}
                className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
              >
                {emitir.isPending ? 'Emitiendo…' : 'Confirmar y emitir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Listado de liquidaciones emitidas de la empresa */
export function Liquidaciones() {
  const empresa = useEmpresaActiva();
  const agregarToast = useToasts((s) => s.agregar);
  const { data: liquidaciones, isPending } = useQuery({
    queryKey: ['liquidaciones', empresa.id],
    queryFn: () => listarLiquidaciones(empresa.id as string),
    enabled: Boolean(empresa.id),
  });

  const asiento = useMutation({
    mutationFn: (liquidacionId: string) => generarAsientoLiquidacion(liquidacionId),
    onSuccess: (a) => agregarToast('exito', `Asiento generado: ${a.glosa}`),
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo generar el asiento'),
  });

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <p className="text-cuerpo text-texto-suave">
          Elige la empresa activa.{' '}
          <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-subtitulo font-semibold text-texto">
        Liquidaciones · <span className="text-texto-tenue">{empresa.razonSocial}</span>
      </h1>

      <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
        <table className="w-full text-left text-cuerpo">
          <thead className="border-b border-borde text-apoyo uppercase text-texto-tenue">
            <tr>
              <th className="px-4 py-3">Fecha de cese</th>
              <th className="px-4 py-3">Motivo</th>
              <th className="cifras px-4 py-3 text-right">Neto pagado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isPending && (
              <tr><td colSpan={4} className="p-0"><SkeletonTabla /></td></tr>
            )}
            {!isPending && liquidaciones?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-texto-tenue">
                  Aún no hay liquidaciones emitidas.
                </td>
              </tr>
            )}
            {liquidaciones?.map((l) => (
              <tr key={l.id} className="border-b border-borde last:border-0">
                <td className="px-4 py-3 text-texto">{l.fechaCese.slice(0, 10)}</td>
                <td className="px-4 py-3 text-texto-suave">{l.motivoCese}</td>
                <td className="cifras px-4 py-3 text-right font-semibold text-texto">
                  {soles(l.netoPagar)}
                </td>
                <td className="cifras px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => void abrirLiquidacionPdf(l.id)}
                    className="rounded-control border border-borde-fuerte px-2.5 py-1 text-apoyo text-texto-suave hover:bg-fondo"
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => asiento.mutate(l.id)}
                    disabled={asiento.isPending}
                    className="ml-2 rounded-control border border-borde-fuerte px-2.5 py-1 text-apoyo text-texto-suave hover:bg-fondo disabled:opacity-50"
                  >
                    Asiento
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
