import type { PracticanteMesDto } from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { crearRecibo, honorariosAnual, honorariosDelMes } from '../lib/honorarios';
import { soles } from '../lib/planillas';
import {
  abrirConstanciaSubvencion,
  registrarSubvencion,
  subvencionesDelMes,
} from '../lib/subvenciones';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

// =====================================================================
// PERSONAL EXTERNO (Sesión 16): honorarios de locadores (4ta) y
// subvenciones de practicantes comparten esta sección del sidebar —
// decisión documentada: ambos son pagos mensuales FUERA de la planilla
// de trabajadores (sin AFP/EsSalud/CTS/grati) y la contadora los
// gestiona juntos, así que una sola entrada con dos pestañas simplifica
// la navegación.
// =====================================================================

const hoy = new Date();

function SelectorMes({
  anio,
  mes,
  onCambiar,
}: {
  anio: number;
  mes: number;
  onCambiar: (anio: number, mes: number) => void;
}) {
  return (
    <div className="flex gap-2">
      <select
        aria-label="Mes"
        value={mes}
        onChange={(e) => onCambiar(anio, Number(e.target.value))}
        className="rounded-control border border-borde-fuerte px-2 py-1.5 text-cuerpo"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {String(i + 1).padStart(2, '0')}
          </option>
        ))}
      </select>
      <input
        aria-label="Año"
        type="number"
        value={anio}
        onChange={(e) => onCambiar(Number(e.target.value), mes)}
        className="w-24 rounded-control border border-borde-fuerte px-2 py-1.5 text-cuerpo"
      />
    </div>
  );
}

// ------------------------- HONORARIOS (4ta) -------------------------

function ModalRecibo({
  personaId,
  nombre,
  onCerrar,
}: {
  personaId: string;
  nombre: string;
  onCerrar: () => void;
}) {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [numero, setNumero] = useState('');
  const [fechaEmision, setFechaEmision] = useState(hoy.toISOString().slice(0, 10));
  const [monto, setMonto] = useState('');
  const [glosa, setGlosa] = useState('');

  const crear = useMutation({
    mutationFn: () =>
      crearRecibo(empresa.id as string, personaId, {
        numero,
        fechaEmision,
        monto,
        glosa: glosa || undefined,
      }),
    onSuccess: (r) => {
      agregarToast(
        'exito',
        `Recibo ${r.recibo.numero}: retención ${soles(r.recibo.retencion8)}, neto ${soles(r.recibo.netoPagado)}`,
      );
      for (const a of r.advertencias) {
        agregarToast('error', a);
      }
      void queryClient.invalidateQueries({ queryKey: ['honorarios'] });
      onCerrar();
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo registrar el recibo'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-texto/40 p-4">
      <div className="w-full max-w-md rounded-tarjeta bg-superficie p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-texto">Nuevo recibo — {nombre}</h2>
        <p className="mt-1 text-apoyo text-texto-suave">
          Si el monto supera el umbral (S/ 1,500) y no hay suspensión vigente, el sistema
          retiene el 8% sobre el TOTAL del recibo.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="r-numero" className="block text-apoyo text-texto-suave">
              Número (ej. E001-123)
            </label>
            <input
              id="r-numero"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="r-fecha" className="block text-apoyo text-texto-suave">Fecha de emisión</label>
              <input
                id="r-fecha"
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
              />
            </div>
            <div>
              <label htmlFor="r-monto" className="block text-apoyo text-texto-suave">Monto (S/)</label>
              <input
                id="r-monto"
                type="number"
                min={0}
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
              />
            </div>
          </div>
          <div>
            <label htmlFor="r-glosa" className="block text-apoyo text-texto-suave">Glosa (opcional)</label>
            <input
              id="r-glosa"
              value={glosa}
              onChange={(e) => setGlosa(e.target.value)}
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!numero || !(Number(monto) > 0) || crear.isPending}
            onClick={() => crear.mutate()}
            className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
          >
            {crear.isPending ? 'Registrando…' : 'Registrar recibo'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabHonorarios() {
  const empresa = useEmpresaActiva();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [reciboPara, setReciboPara] = useState<{ id: string; nombre: string } | null>(null);
  const [verAnual, setVerAnual] = useState(false);

  const { data: delMes } = useQuery({
    queryKey: ['honorarios', empresa.id, anio, mes],
    queryFn: () => honorariosDelMes(empresa.id as string, anio, mes),
    enabled: Boolean(empresa.id),
  });
  const { data: anual } = useQuery({
    queryKey: ['honorarios-anual', empresa.id, anio],
    queryFn: () => honorariosAnual(empresa.id as string, anio),
    enabled: Boolean(empresa.id) && verAnual,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SelectorMes anio={anio} mes={mes} onCambiar={(a, m) => { setAnio(a); setMes(m); }} />
        <label className="flex items-center gap-2 text-cuerpo text-texto-suave">
          <input type="checkbox" checked={verAnual} onChange={(e) => setVerAnual(e.target.checked)} />
          Ver reporte anual {anio}
        </label>
      </div>

      {!verAnual && (
        <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
          {!delMes || delMes.filas.length === 0 ? (
            <p className="p-6 text-cuerpo text-texto-tenue">
              Sin locadores registrados en la empresa (Personas → nuevo locador).
            </p>
          ) : (
            <table className="w-full text-left text-cuerpo">
              <thead className="border-b border-borde text-apoyo uppercase text-texto-tenue">
                <tr>
                  <th className="px-4 py-3">Locador</th>
                  <th className="px-4 py-3">Suspensión 4ta</th>
                  <th className="px-4 py-3">Recibos del mes</th>
                  <th className="cifras px-4 py-3 text-right">Monto</th>
                  <th className="cifras px-4 py-3 text-right">Retención 8%</th>
                  <th className="cifras px-4 py-3 text-right">Neto</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {delMes.filas.map((f) => (
                  <tr key={f.personaId} className="border-b border-borde last:border-0 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-texto">{f.apellidos}, {f.nombres}</p>
                      <p className="text-apoyo text-texto-tenue">RUC {f.rucLocador ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-apoyo">
                      {f.suspensionVigente ? (
                        <span className="rounded bg-exito-suave px-2 py-0.5 text-exito">
                          Vigente hasta {f.suspensionVigenteHasta}
                        </span>
                      ) : f.suspensionVigenteHasta ? (
                        <span className="rounded bg-peligro-suave px-2 py-0.5 text-peligro">
                          VENCIDA el {f.suspensionVigenteHasta}
                        </span>
                      ) : (
                        <span className="text-texto-tenue">Sin suspensión</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-apoyo text-texto-suave">
                      {f.recibos.length === 0
                        ? '—'
                        : f.recibos.map((r) => (
                            <p key={r.id}>
                              {r.numero} · {r.fechaEmision} · {soles(r.monto)}
                              {Number(r.retencion8) > 0 && ` (ret. ${soles(r.retencion8)})`}
                            </p>
                          ))}
                    </td>
                    <td className="cifras px-4 py-3 text-right text-texto-suave">{soles(f.totalMonto)}</td>
                    <td className="cifras px-4 py-3 text-right text-texto-suave">{soles(f.totalRetencion)}</td>
                    <td className="cifras px-4 py-3 text-right font-semibold text-texto">
                      {soles(f.totalNeto)}
                    </td>
                    <td className="cifras px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setReciboPara({ id: f.personaId, nombre: `${f.apellidos}, ${f.nombres}` })
                        }
                        className="rounded-control border border-borde-fuerte px-3 py-1 text-apoyo text-texto-suave hover:bg-fondo"
                      >
                        + Recibo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-cuerpo font-semibold text-texto">
                <tr className="border-t border-borde">
                  <td className="px-4 py-3" colSpan={3}>TOTALES {String(mes).padStart(2, '0')}/{anio}</td>
                  <td className="cifras px-4 py-3 text-right">{soles(delMes.totalMonto)}</td>
                  <td className="cifras px-4 py-3 text-right">{soles(delMes.totalRetencion)}</td>
                  <td className="cifras px-4 py-3 text-right">{soles(delMes.totalNeto)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {verAnual && anual && (
        <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
          <table className="w-full text-left text-cuerpo">
            <thead className="border-b border-borde text-apoyo uppercase text-texto-tenue">
              <tr>
                <th className="px-4 py-3">Locador</th>
                <th className="px-4 py-3 text-center">Recibos</th>
                <th className="cifras px-4 py-3 text-right">Total pagado</th>
                <th className="cifras px-4 py-3 text-right">Total retenido</th>
                <th className="cifras px-4 py-3 text-right">Neto</th>
              </tr>
            </thead>
            <tbody>
              {anual.filas.map((f) => (
                <tr key={f.personaId} className="border-b border-borde last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-texto">{f.apellidos}, {f.nombres}</p>
                    <p className="text-apoyo text-texto-tenue">RUC {f.rucLocador ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-center text-texto-suave">{f.cantidadRecibos}</td>
                  <td className="cifras px-4 py-3 text-right text-texto-suave">{soles(f.totalMonto)}</td>
                  <td className="cifras px-4 py-3 text-right text-texto-suave">{soles(f.totalRetencion)}</td>
                  <td className="cifras px-4 py-3 text-right font-semibold text-texto">{soles(f.totalNeto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-cuerpo font-semibold text-texto">
              <tr className="border-t border-borde">
                <td className="px-4 py-3">TOTAL {anio}</td>
                <td></td>
                <td className="cifras px-4 py-3 text-right">{soles(anual.totalMonto)}</td>
                <td className="cifras px-4 py-3 text-right">{soles(anual.totalRetencion)}</td>
                <td className="cifras px-4 py-3 text-right">{soles(anual.totalNeto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {reciboPara && (
        <ModalRecibo
          personaId={reciboPara.id}
          nombre={reciboPara.nombre}
          onCerrar={() => setReciboPara(null)}
        />
      )}
    </div>
  );
}

// ----------------------- SUBVENCIONES (28518) -----------------------

function ModalPagoSubvencion({
  fila,
  anio,
  mes,
  onCerrar,
}: {
  fila: PracticanteMesDto;
  anio: number;
  mes: number;
  onCerrar: () => void;
}) {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [diasDescontados, setDiasDescontados] = useState(0);
  const [incluirMedia, setIncluirMedia] = useState(fila.proponeMediaSubvencion);

  const registrar = useMutation({
    mutationFn: () =>
      registrarSubvencion(empresa.id as string, fila.personaId, {
        anio,
        mes,
        diasDescontados: diasDescontados || undefined,
        incluirMediaSubvencion: incluirMedia || undefined,
      }),
    onSuccess: (r) => {
      agregarToast('exito', `Subvención pagada: ${soles(r.subvencion.total)}`);
      for (const a of r.advertencias) {
        agregarToast('error', a);
      }
      void queryClient.invalidateQueries({ queryKey: ['subvenciones'] });
      onCerrar();
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo registrar el pago'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-texto/40 p-4">
      <div className="w-full max-w-md rounded-tarjeta bg-superficie p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-texto">
          Pagar subvención — {fila.apellidos}, {fila.nombres}
        </h2>
        <p className="mt-1 text-apoyo text-texto-suave">
          {String(mes).padStart(2, '0')}/{anio} · subvención mensual {soles(fila.subvencionMensual)} ·
          convenio {fila.convenioInicio} → {fila.convenioFin}
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="s-dias" className="block text-apoyo text-texto-suave">
              Días a descontar (base 30)
            </label>
            <input
              id="s-dias"
              type="number"
              min={0}
              max={30}
              value={diasDescontados}
              onChange={(e) => setDiasDescontados(Number(e.target.value))}
              className="mt-1 w-28 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
          </div>
          {fila.proponeMediaSubvencion && (
            <label className="flex items-start gap-2 rounded-control bg-primario-suave p-3 text-cuerpo text-primario">
              <input
                type="checkbox"
                checked={incluirMedia}
                onChange={(e) => setIncluirMedia(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Este mes cumple {fila.mesesCumplidos} meses continuos de convenio: corresponde{' '}
                <strong>media subvención adicional de {soles(fila.mediaSubvencionMonto)}</strong>{' '}
                (Ley 28518). Se paga solo si la confirmas.
              </span>
            </label>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={registrar.isPending}
            onClick={() => registrar.mutate()}
            className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
          >
            {registrar.isPending ? 'Registrando…' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabSubvenciones() {
  const empresa = useEmpresaActiva();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [pagando, setPagando] = useState<PracticanteMesDto | null>(null);

  const { data } = useQuery({
    queryKey: ['subvenciones', empresa.id, anio, mes],
    queryFn: () => subvencionesDelMes(empresa.id as string, anio, mes),
    enabled: Boolean(empresa.id),
  });

  return (
    <div className="space-y-4">
      <SelectorMes anio={anio} mes={mes} onCambiar={(a, m) => { setAnio(a); setMes(m); }} />

      <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
        {!data || data.filas.length === 0 ? (
          <p className="p-6 text-cuerpo text-texto-tenue">
            Sin practicantes activos en la empresa (Personas → nuevo practicante).
          </p>
        ) : (
          <table className="w-full text-left text-cuerpo">
            <thead className="border-b border-borde text-apoyo uppercase text-texto-tenue">
              <tr>
                <th className="px-4 py-3">Practicante</th>
                <th className="px-4 py-3">Convenio</th>
                <th className="cifras px-4 py-3 text-right">Subvención</th>
                <th className="px-4 py-3">Semestre</th>
                <th className="px-4 py-3">Pago del mes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.filas.map((f) => (
                <tr key={f.personaId} className="border-b border-borde last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-texto">{f.apellidos}, {f.nombres}</p>
                    <p className="text-apoyo text-texto-tenue">{f.numeroDocumento}</p>
                  </td>
                  <td className="px-4 py-3 text-apoyo text-texto-suave">
                    {f.convenioInicio} → {f.convenioFin}
                    <p className="text-texto-tenue">{f.mesesCumplidos} mes(es) cumplidos</p>
                  </td>
                  <td className="cifras px-4 py-3 text-right text-texto-suave">
                    {soles(f.subvencionMensual)}
                  </td>
                  <td className="px-4 py-3 text-apoyo">
                    {f.proponeMediaSubvencion ? (
                      <span className="rounded bg-primario-suave px-2 py-0.5 font-semibold text-primario">
                        + media subvención {soles(f.mediaSubvencionMonto)}
                      </span>
                    ) : (
                      <span className="text-texto-tenue">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-apoyo">
                    {f.pago ? (
                      <span className="text-exito">
                        Pagada {soles(f.pago.total)}
                        {Number(f.pago.mediaSubvencion) > 0 && ' (incluye media)'}
                      </span>
                    ) : (
                      <span className="text-texto-tenue">Pendiente</span>
                    )}
                  </td>
                  <td className="cifras px-4 py-3 text-right">
                    {f.pago ? (
                      <button
                        type="button"
                        onClick={() => void abrirConstanciaSubvencion((f.pago as { id: string }).id)}
                        className="rounded-control border border-borde-fuerte px-3 py-1 text-apoyo text-texto-suave hover:bg-fondo"
                      >
                        Constancia PDF
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPagando(f)}
                        className="rounded-control bg-primario px-3 py-1 text-apoyo font-semibold text-white hover:bg-primario-oscuro"
                      >
                        Pagar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-cuerpo font-semibold text-texto">
              <tr className="border-t border-borde">
                <td className="px-4 py-3" colSpan={4}>
                  TOTAL PAGADO {String(mes).padStart(2, '0')}/{anio}
                </td>
                <td className="px-4 py-3" colSpan={2}>{soles(data.totalPagado)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {pagando && (
        <ModalPagoSubvencion
          fila={pagando}
          anio={anio}
          mes={mes}
          onCerrar={() => setPagando(null)}
        />
      )}
    </div>
  );
}

/** Personal externo: honorarios (4ta) y subvenciones (practicantes). */
export function PersonalExterno() {
  const empresa = useEmpresaActiva();
  const [tab, setTab] = useState<'HONORARIOS' | 'SUBVENCIONES'>('HONORARIOS');

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <h1 className="text-subtitulo font-semibold text-texto">Elige la empresa activa</h1>
        <p className="mt-2 text-cuerpo text-texto-suave">
          Honorarios y subvenciones se gestionan por empresa.{' '}
          <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-subtitulo font-semibold text-texto">
          Personal externo · <span className="text-texto-tenue">{empresa.razonSocial}</span>
        </h1>
        <div className="flex rounded-control border border-borde bg-superficie p-1">
          <button
            type="button"
            onClick={() => setTab('HONORARIOS')}
            className={`rounded-md px-4 py-1.5 text-cuerpo font-medium ${
              tab === 'HONORARIOS' ? 'bg-primario text-white' : 'text-texto-suave hover:bg-fondo'
            }`}
          >
            Honorarios (4ta)
          </button>
          <button
            type="button"
            onClick={() => setTab('SUBVENCIONES')}
            className={`rounded-md px-4 py-1.5 text-cuerpo font-medium ${
              tab === 'SUBVENCIONES' ? 'bg-primario text-white' : 'text-texto-suave hover:bg-fondo'
            }`}
          >
            Subvenciones (practicantes)
          </button>
        </div>
      </div>

      {tab === 'HONORARIOS' ? <TabHonorarios /> : <TabSubvenciones />}
    </div>
  );
}
