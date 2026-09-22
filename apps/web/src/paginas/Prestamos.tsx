import { SkeletonTabla } from '../componentes/ui';
import type {
  CrearPrestamoInput,
  CuotaPrestamoInput,
  PrestamoDto,
} from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { listarPersonas } from '../lib/personas';
import { soles } from '../lib/planillas';
import {
  amortizarPrestamo,
  crearPrestamo,
  eliminarPrestamo,
  listarPrestamos,
} from '../lib/prestamos';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

const hoy = new Date();

function periodoTexto(anio: number, mes: number): string {
  return `${String(mes).padStart(2, '0')}/${anio}`;
}

/**
 * Vista previa del cronograma en el modal de creación: para cuota fija
 * replica el cálculo del motor (cuotas completas + residuo en la última,
 * como el préstamo real de Martín: 390 en 15×25 + 15); el manual se
 * edita cuota a cuota (como el de Bravo: 150/150/150/50).
 */
function previewCuotaFija(
  monto: number,
  cuota: number,
  anioInicio: number,
  mesInicio: number,
): CuotaPrestamoInput[] {
  if (!(monto > 0) || !(cuota > 0)) {
    return [];
  }
  const cuotas: CuotaPrestamoInput[] = [];
  let pendiente = Math.round(monto * 100);
  const cuotaCent = Math.round(cuota * 100);
  let anio = anioInicio;
  let mes = mesInicio;
  while (pendiente > 0 && cuotas.length < 120) {
    const c = Math.min(pendiente, cuotaCent);
    cuotas.push({ anio, mes, monto: (c / 100).toFixed(2) });
    pendiente -= c;
    if (mes === 12) {
      anio += 1;
      mes = 1;
    } else {
      mes += 1;
    }
  }
  return cuotas;
}

function ModalCrear({ onCerrar }: { onCerrar: () => void }) {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);

  const { data: personas } = useQuery({
    queryKey: ['personas', empresa.id, 'PLANILLA'],
    queryFn: () => listarPersonas(empresa.id as string, { tipoVinculo: 'PLANILLA' }),
    enabled: Boolean(empresa.id),
  });

  const [personaId, setPersonaId] = useState('');
  const [monto, setMonto] = useState('');
  const [esAdelanto, setEsAdelanto] = useState(false);
  const [fecha, setFecha] = useState(hoy.toISOString().slice(0, 10));
  const [glosa, setGlosa] = useState('');
  const [modo, setModo] = useState<'CUOTA_FIJA' | 'MANUAL'>('CUOTA_FIJA');
  const [cuotaMensual, setCuotaMensual] = useState('');
  const [anioInicio, setAnioInicio] = useState(hoy.getFullYear());
  const [mesInicio, setMesInicio] = useState(hoy.getMonth() + 1);
  const [cuotasManual, setCuotasManual] = useState<CuotaPrestamoInput[]>([]);

  const preview = useMemo(
    () =>
      modo === 'CUOTA_FIJA'
        ? previewCuotaFija(Number(monto), Number(cuotaMensual), anioInicio, mesInicio)
        : cuotasManual,
    [modo, monto, cuotaMensual, anioInicio, mesInicio, cuotasManual],
  );
  const sumaPreview = preview.reduce((acc, c) => acc + Number(c.monto), 0);
  const cuadra = Math.abs(sumaPreview - Number(monto)) < 0.005;

  const crear = useMutation({
    mutationFn: () => {
      const input: CrearPrestamoInput = {
        monto,
        esAdelanto,
        fechaOtorgado: fecha,
        glosa: glosa || undefined,
        cronograma:
          modo === 'CUOTA_FIJA'
            ? { modo: 'CUOTA_FIJA', cuotaMensual, anioInicio, mesInicio }
            : { modo: 'MANUAL', cuotas: cuotasManual },
      };
      return crearPrestamo(empresa.id as string, personaId, input);
    },
    onSuccess: () => {
      agregarToast('exito', 'Préstamo registrado con su cronograma');
      void queryClient.invalidateQueries({ queryKey: ['prestamos'] });
      onCerrar();
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo registrar'),
  });

  const agregarCuotaManual = () => {
    const ultima = cuotasManual[cuotasManual.length - 1];
    const siguiente = ultima
      ? ultima.mes === 12
        ? { anio: ultima.anio + 1, mes: 1 }
        : { anio: ultima.anio, mes: ultima.mes + 1 }
      : { anio: anioInicio, mes: mesInicio };
    setCuotasManual([...cuotasManual, { ...siguiente, monto: '0.00' }]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-texto/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-tarjeta bg-superficie p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-texto">Nuevo préstamo / adelanto</h2>
        <p className="mt-1 text-apoyo text-texto-suave">
          La cuota se descuenta sola en la planilla del periodo del cronograma y el
          descuento se detiene al llegar el saldo a cero.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="p-persona" className="block text-apoyo text-texto-suave">Trabajador</label>
            <select
              id="p-persona"
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            >
              <option value="">— Elige al trabajador —</option>
              {personas?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.apellidos}, {p.nombres} ({p.numeroDocumento})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="p-monto" className="block text-apoyo text-texto-suave">Monto (S/)</label>
            <input
              id="p-monto"
              type="number"
              min={0}
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
          </div>
          <div>
            <label htmlFor="p-fecha" className="block text-apoyo text-texto-suave">Fecha</label>
            <input
              id="p-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="p-adelanto"
              type="checkbox"
              checked={esAdelanto}
              onChange={(e) => setEsAdelanto(e.target.checked)}
            />
            <label htmlFor="p-adelanto" className="text-cuerpo text-texto-suave">
              Es adelanto de remuneración
            </label>
          </div>
          <div>
            <label htmlFor="p-glosa" className="block text-apoyo text-texto-suave">Glosa (opcional)</label>
            <input
              id="p-glosa"
              value={glosa}
              onChange={(e) => setGlosa(e.target.value)}
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
          </div>
        </div>

        {/* Constructor de cronograma */}
        <div className="mt-5 rounded-control border border-borde p-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-cuerpo font-semibold text-texto">Cronograma</p>
            <label className="flex items-center gap-1.5 text-cuerpo text-texto-suave">
              <input
                type="radio"
                checked={modo === 'CUOTA_FIJA'}
                onChange={() => setModo('CUOTA_FIJA')}
              />
              Cuota fija mensual
            </label>
            <label className="flex items-center gap-1.5 text-cuerpo text-texto-suave">
              <input
                type="radio"
                checked={modo === 'MANUAL'}
                onChange={() => {
                  setModo('MANUAL');
                  if (cuotasManual.length === 0) {
                    setCuotasManual([{ anio: anioInicio, mes: mesInicio, monto: monto || '0.00' }]);
                  }
                }}
              />
              Manual (cuotas editables)
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            {modo === 'CUOTA_FIJA' && (
              <div>
                <label htmlFor="p-cuota" className="block text-apoyo text-texto-suave">
                  Cuota mensual (S/)
                </label>
                <input
                  id="p-cuota"
                  type="number"
                  min={0}
                  step="0.01"
                  value={cuotaMensual}
                  onChange={(e) => setCuotaMensual(e.target.value)}
                  className="mt-1 w-32 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
                />
              </div>
            )}
            <div>
              <label htmlFor="p-mes-inicio" className="block text-apoyo text-texto-suave">
                Primer descuento
              </label>
              <div className="mt-1 flex gap-2">
                <select
                  id="p-mes-inicio"
                  value={mesInicio}
                  onChange={(e) => setMesInicio(Number(e.target.value))}
                  className="rounded-control border border-borde-fuerte px-2 py-2 text-cuerpo"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {String(i + 1).padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Año de inicio"
                  type="number"
                  value={anioInicio}
                  onChange={(e) => setAnioInicio(Number(e.target.value))}
                  className="w-24 rounded-control border border-borde-fuerte px-2 py-2 text-cuerpo"
                />
              </div>
            </div>
            {modo === 'MANUAL' && (
              <button
                type="button"
                onClick={agregarCuotaManual}
                className="rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
              >
                + Agregar cuota
              </button>
            )}
          </div>

          {/* Vista previa */}
          {preview.length > 0 && (
            <div className="mt-4">
              <p className="text-apoyo font-semibold uppercase text-texto-tenue">
                Vista previa ({preview.length} cuota{preview.length === 1 ? '' : 's'})
              </p>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-control bg-fondo p-2">
                <table className="w-full text-cuerpo">
                  <tbody>
                    {preview.map((c, i) => (
                      <tr key={`${c.anio}-${c.mes}-${i}`} className="border-b border-borde last:border-0">
                        <td className="px-2 py-1 text-texto-suave">Cuota {i + 1}</td>
                        <td className="px-2 py-1 text-texto-suave">{periodoTexto(c.anio, c.mes)}</td>
                        <td className="cifras px-2 py-1 text-right font-medium text-texto">
                          {modo === 'MANUAL' ? (
                            <input
                              aria-label={`Monto cuota ${i + 1}`}
                              type="number"
                              min={0}
                              step="0.01"
                              value={c.monto}
                              onChange={(e) =>
                                setCuotasManual(
                                  cuotasManual.map((x, j) =>
                                    j === i ? { ...x, monto: e.target.value } : x,
                                  ),
                                )
                              }
                              className="cifras w-28 rounded border border-borde-fuerte px-2 py-0.5 text-right text-cuerpo"
                            />
                          ) : (
                            soles(c.monto)
                          )}
                        </td>
                        {modo === 'MANUAL' && (
                          <td className="cifras px-2 py-1 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setCuotasManual(cuotasManual.filter((_, j) => j !== i))
                              }
                              className="text-apoyo text-peligro hover:underline"
                            >
                              quitar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={`mt-2 text-cuerpo ${cuadra ? 'text-exito' : 'text-peligro'}`}>
                Suma del cronograma: <strong>{soles(sumaPreview)}</strong> de {soles(monto || 0)}
                {cuadra ? ' ✓' : ' — debe cuadrar con el monto del préstamo'}
              </p>
            </div>
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
            disabled={!personaId || !cuadra || preview.length === 0 || crear.isPending}
            onClick={() => crear.mutate()}
            className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
          >
            {crear.isPending ? 'Guardando…' : 'Guardar préstamo'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Ficha del préstamo: cronograma con pagos y amortización extraordinaria. */
function FichaPrestamo({
  prestamo,
  onCerrar,
}: {
  prestamo: PrestamoDto;
  onCerrar: () => void;
}) {
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [amortizando, setAmortizando] = useState(false);
  const [montoAmortizar, setMontoAmortizar] = useState('');
  const [fechaAmortizar, setFechaAmortizar] = useState(hoy.toISOString().slice(0, 10));
  const [glosaAmortizar, setGlosaAmortizar] = useState('');

  const amortizar = useMutation({
    mutationFn: () =>
      amortizarPrestamo(prestamo.id, {
        monto: montoAmortizar,
        fecha: fechaAmortizar,
        glosa: glosaAmortizar || undefined,
      }),
    onSuccess: () => {
      agregarToast('exito', 'Amortización registrada (auditada)');
      void queryClient.invalidateQueries({ queryKey: ['prestamos'] });
      onCerrar();
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo amortizar'),
  });

  const eliminar = useMutation({
    mutationFn: () => eliminarPrestamo(prestamo.id),
    onSuccess: () => {
      agregarToast('exito', 'Préstamo eliminado');
      void queryClient.invalidateQueries({ queryKey: ['prestamos'] });
      onCerrar();
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo eliminar'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-texto/40 p-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-tarjeta bg-superficie p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-texto">
              {prestamo.esAdelanto ? 'Adelanto' : 'Préstamo'} · {prestamo.apellidos},{' '}
              {prestamo.nombres}
            </h2>
            <p className="text-apoyo text-texto-suave">
              Otorgado el {prestamo.fechaOtorgado} · {prestamo.glosa ?? 'sin glosa'}
            </p>
          </div>
          <button type="button" onClick={onCerrar} className="text-texto-tenue hover:text-texto-suave">
            ✕
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-control bg-fondo p-3">
            <dt className="text-apoyo text-texto-suave">Monto</dt>
            <dd className="font-bold text-texto">{soles(prestamo.montoTotal)}</dd>
          </div>
          <div className="rounded-control bg-primario-suave p-3">
            <dt className="text-apoyo text-primario">Saldo vivo</dt>
            <dd className="font-bold text-primario-oscuro">{soles(prestamo.saldo)}</dd>
          </div>
          <div className="rounded-control bg-fondo p-3">
            <dt className="text-apoyo text-texto-suave">Cuotas</dt>
            <dd className="font-bold text-texto">
              {prestamo.cuotasPagadas}/{prestamo.cuotasTotales}
            </dd>
          </div>
        </dl>

        <table className="mt-4 w-full text-left text-cuerpo">
          <thead className="border-b border-borde text-apoyo uppercase text-texto-tenue">
            <tr>
              <th className="px-2 py-1.5">Cuota</th>
              <th className="px-2 py-1.5">Periodo</th>
              <th className="cifras px-2 py-1.5 text-right">Monto</th>
              <th className="px-2 py-1.5">Estado</th>
            </tr>
          </thead>
          <tbody>
            {prestamo.cuotas.map((c) => (
              <tr key={c.id} className="border-b border-borde last:border-0">
                <td className="px-2 py-1.5 text-texto-suave">{c.numero}</td>
                <td className="px-2 py-1.5 text-texto-suave">{periodoTexto(c.anio, c.mes)}</td>
                <td className="cifras px-2 py-1.5 text-right font-medium text-texto">
                  {soles(c.monto)}
                </td>
                <td className="px-2 py-1.5 text-apoyo">
                  {c.pagadaEn ? (
                    <span className="text-exito">
                      Pagada {c.pagadaEn.slice(0, 10)}
                      {!c.periodoId && ' (directa)'}
                    </span>
                  ) : (
                    <span className="text-texto-tenue">Pendiente</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {prestamo.estado === 'ACTIVO' && (
          <div className="mt-5 rounded-control border border-borde p-4">
            {!amortizando ? (
              <button
                type="button"
                onClick={() => setAmortizando(true)}
                className="rounded-control border border-primario px-3 py-1.5 text-cuerpo text-primario-oscuro hover:bg-primario-suave"
              >
                Registrar amortización extraordinaria
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-cuerpo font-semibold text-texto">
                  Amortización extraordinaria (pago directo fuera de planilla)
                </p>
                <p className="text-apoyo text-texto-suave">
                  Reduce el saldo y recorta las cuotas futuras desde el final. Queda
                  registrada en la auditoría.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="a-monto" className="block text-apoyo text-texto-suave">Monto (S/)</label>
                    <input
                      id="a-monto"
                      type="number"
                      min={0}
                      step="0.01"
                      value={montoAmortizar}
                      onChange={(e) => setMontoAmortizar(e.target.value)}
                      className="mt-1 w-32 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
                    />
                  </div>
                  <div>
                    <label htmlFor="a-fecha" className="block text-apoyo text-texto-suave">Fecha</label>
                    <input
                      id="a-fecha"
                      type="date"
                      value={fechaAmortizar}
                      onChange={(e) => setFechaAmortizar(e.target.value)}
                      className="mt-1 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="a-glosa" className="block text-apoyo text-texto-suave">Glosa</label>
                    <input
                      id="a-glosa"
                      value={glosaAmortizar}
                      onChange={(e) => setGlosaAmortizar(e.target.value)}
                      className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!(Number(montoAmortizar) > 0) || amortizar.isPending}
                    onClick={() => amortizar.mutate()}
                    className="rounded-control bg-primario px-4 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
                  >
                    {amortizar.isPending ? 'Registrando…' : 'Amortizar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {prestamo.cuotasPagadas === 0 && (
          <div className="cifras mt-3 text-right">
            <button
              type="button"
              onClick={() => eliminar.mutate()}
              disabled={eliminar.isPending}
              className="text-apoyo text-peligro hover:underline"
            >
              Eliminar préstamo (sin cuotas pagadas)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Préstamos y adelantos de la empresa activa (Sesión 16). */
export function Prestamos() {
  const empresa = useEmpresaActiva();
  const [creando, setCreando] = useState(false);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  const { data: prestamos, isPending } = useQuery({
    queryKey: ['prestamos', empresa.id],
    queryFn: () => listarPrestamos(empresa.id as string),
    enabled: Boolean(empresa.id),
  });

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <h1 className="text-subtitulo font-semibold text-texto">Elige la empresa activa</h1>
        <p className="mt-2 text-cuerpo text-texto-suave">
          Los préstamos se gestionan por empresa.{' '}
          <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }

  const ficha = prestamos?.find((p) => p.id === seleccionado) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-subtitulo font-semibold text-texto">
          Préstamos y adelantos · <span className="text-texto-tenue">{empresa.razonSocial}</span>
        </h1>
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="rounded-control bg-primario px-4 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro"
        >
          + Nuevo préstamo
        </button>
      </div>

      <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
        {isPending ? (
          <SkeletonTabla />
        ) : !prestamos || prestamos.length === 0 ? (
          <p className="p-6 text-cuerpo text-texto-tenue">
            Sin préstamos registrados. Las cuotas se descuentan solas en la planilla.
          </p>
        ) : (
          <table className="w-full text-left text-cuerpo">
            <thead className="border-b border-borde text-apoyo uppercase text-texto-tenue">
              <tr>
                <th className="px-4 py-3">Trabajador</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="cifras px-4 py-3 text-right">Monto</th>
                <th className="cifras px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-center">Cuotas</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {prestamos.map((p) => (
                <tr key={p.id} className="border-b border-borde last:border-0 hover:bg-fondo">
                  <td className="px-4 py-3">
                    <p className="font-medium text-texto">{p.apellidos}, {p.nombres}</p>
                    <p className="text-apoyo text-texto-tenue">{p.numeroDocumento}</p>
                  </td>
                  <td className="px-4 py-3 text-texto-suave">
                    {p.esAdelanto ? 'Adelanto' : 'Préstamo'}
                  </td>
                  <td className="cifras px-4 py-3 text-right text-texto-suave">{soles(p.montoTotal)}</td>
                  <td className="cifras px-4 py-3 text-right font-semibold text-texto">
                    {soles(p.saldo)}
                  </td>
                  <td className="px-4 py-3 text-center text-texto-suave">
                    {p.cuotasPagadas}/{p.cuotasTotales}
                  </td>
                  <td className="px-4 py-3">
                    {p.estado === 'CANCELADO' ? (
                      <span className="rounded bg-fondo px-2 py-0.5 text-apoyo text-texto-suave">
                        Cancelado
                      </span>
                    ) : p.seCancelaProximoPeriodo ? (
                      <span className="rounded bg-advertencia-suave px-2 py-0.5 text-apoyo font-semibold text-advertencia">
                        Se cancela este periodo
                      </span>
                    ) : (
                      <span className="rounded bg-exito-suave px-2 py-0.5 text-apoyo text-exito">
                        Activo
                      </span>
                    )}
                  </td>
                  <td className="cifras px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSeleccionado(p.id)}
                      className="rounded-control border border-borde-fuerte px-3 py-1 text-apoyo text-texto-suave hover:bg-fondo"
                    >
                      Ver ficha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creando && <ModalCrear onCerrar={() => setCreando(false)} />}
      {ficha && <FichaPrestamo prestamo={ficha} onCerrar={() => setSeleccionado(null)} />}
    </div>
  );
}
