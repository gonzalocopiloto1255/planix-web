import type { CalculoUtilidadesDto } from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import {
  abrirHojaUtilidades,
  calcularUtilidades,
  obligacionUtilidades,
  obtenerUtilidades,
  registrarUtilidades,
} from '../lib/utilidades';
import { soles } from '../lib/planillas';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

const hoy = new Date();

/**
 * Participación en las utilidades (D.Leg. 892, §8.5). El flujo primero
 * VERIFICA la obligación (MÁS de 20 trabajadores en promedio anual —
 * ≥21 redondeado — de los periodos cerrados); si la empresa no está
 * obligada muestra el promedio y solo permite continuar con un override
 * informado. Microempresa: excluida siempre.
 */
export function Utilidades() {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [ejercicio, setEjercicio] = useState(hoy.getFullYear() - 1);
  const [rentaNeta, setRentaNeta] = useState('');
  const [continuarNoObligada, setContinuarNoObligada] = useState(false);
  const [calculo, setCalculo] = useState<CalculoUtilidadesDto | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [anioPago, setAnioPago] = useState(hoy.getFullYear());
  const [mesPago, setMesPago] = useState(hoy.getMonth() + 1);
  const [fechaLimitePago, setFechaLimitePago] = useState('');

  const { data: obligacion, isPending: verificando } = useQuery({
    queryKey: ['utilidades-obligacion', empresa.id, ejercicio],
    queryFn: () => obligacionUtilidades(empresa.id as string, ejercicio),
    enabled: Boolean(empresa.id),
  });

  const { data: registrada } = useQuery({
    queryKey: ['utilidades-registrada', empresa.id, ejercicio],
    queryFn: () => obtenerUtilidades(empresa.id as string, ejercicio),
    enabled: Boolean(empresa.id),
    retry: false,
  });

  const calcular = useMutation({
    mutationFn: () =>
      calcularUtilidades(empresa.id as string, { ejercicio, rentaNeta }),
    onSuccess: setCalculo,
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo calcular'),
  });

  const registrar = useMutation({
    mutationFn: () =>
      registrarUtilidades(empresa.id as string, {
        ejercicio,
        rentaNeta,
        confirmarNoObligada: continuarNoObligada || undefined,
        anioPago,
        mesPago,
        fechaLimitePago: fechaLimitePago || undefined,
      }),
    onSuccess: () => {
      agregarToast('exito', `Utilidades del ${ejercicio} registradas`);
      setConfirmando(false);
      setCalculo(null);
      void queryClient.invalidateQueries({ queryKey: ['utilidades-registrada'] });
    },
    onError: (e) => {
      setConfirmando(false);
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo registrar');
    },
  });

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <h1 className="text-subtitulo font-semibold text-texto">Elige la empresa activa</h1>
        <p className="mt-2 text-cuerpo text-texto-suave">
          Las utilidades se calculan por empresa.{' '}
          <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }

  const esMicro = obligacion?.regimenLaboral === 'MICROEMPRESA';
  const puedeContinuar = Boolean(
    obligacion && !esMicro && (obligacion.obligada || continuarNoObligada),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-subtitulo font-semibold text-texto">
          Utilidades · <span className="text-texto-tenue">{empresa.razonSocial}</span>
        </h1>
        <div>
          <label htmlFor="ejercicio" className="block text-apoyo text-texto-suave">Ejercicio</label>
          <input
            id="ejercicio"
            type="number"
            value={ejercicio}
            onChange={(e) => {
              setEjercicio(Number(e.target.value));
              setCalculo(null);
              setContinuarNoObligada(false);
            }}
            className="mt-1 w-28 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
          />
        </div>
      </div>

      {/* ---- 1. Verificación de la obligación ---- */}
      {verificando && (
        <div className="rounded-tarjeta bg-superficie p-6 text-cuerpo text-texto-tenue shadow-tarjeta">
          Verificando la obligación de repartir…
        </div>
      )}
      {obligacion && (
        <div
          className={`rounded-tarjeta border p-4 text-cuerpo shadow-tarjeta ${
            obligacion.obligada
              ? 'border-exito bg-exito-suave text-exito'
              : 'border-advertencia/30 bg-advertencia-suave text-advertencia'
          }`}
        >
          <p className="font-semibold">{obligacion.motivo}</p>
          <p className="mt-1 text-apoyo">
            Promedio anual: <strong>{obligacion.promedioTrabajadores}</strong> trabajadores
            (de los periodos cerrados del {ejercicio}; umbral legal: más de{' '}
            {obligacion.umbral}). Régimen: {obligacion.regimenLaboral}.
          </p>
          {!obligacion.obligada && !esMicro && !continuarNoObligada && !registrada && (
            <button
              type="button"
              onClick={() => setContinuarNoObligada(true)}
              className="mt-3 rounded-control border border-advertencia px-3 py-1.5 text-apoyo font-semibold text-advertencia hover:bg-advertencia-suave"
            >
              Registrar de todos modos (override informado)
            </button>
          )}
          {continuarNoObligada && (
            <p className="mt-2 rounded bg-advertencia-suave px-3 py-2 text-apoyo">
              Continuarás bajo tu responsabilidad: la empresa no alcanza el promedio
              legal. El registro quedará auditado como override.
            </p>
          )}
        </div>
      )}

      {/* ---- 2. Ejercicio ya registrado: detalle + hojas ---- */}
      {registrada && (
        <div className="space-y-4 rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-texto">
                Utilidades del {registrada.ejercicio} — registradas
              </h2>
              <p className="text-apoyo text-texto-suave">
                Renta neta {soles(registrada.rentaNeta)} × {(Number(registrada.porcentaje) * 100).toFixed(0)}% ={' '}
                <strong>{soles(registrada.montoARepartir)}</strong> a repartir
                {Number(registrada.excedenteFondoempleo) > 0 &&
                  ` · Fondoempleo: ${soles(registrada.excedenteFondoempleo)}`}
                {registrada.fechaLimitePago && ` · pago hasta ${registrada.fechaLimitePago}`}
                {registrada.mesPago &&
                  ` · se paga en la planilla ${String(registrada.mesPago).padStart(2, '0')}/${registrada.anioPago}`}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-cuerpo">
              <thead className="border-b border-borde text-apoyo uppercase text-texto-tenue">
                <tr>
                  <th className="px-3 py-2">Trabajador</th>
                  <th className="px-3 py-2 text-center">Días</th>
                  <th className="cifras px-3 py-2 text-right">Rem. anual</th>
                  <th className="cifras px-3 py-2 text-right">Por días</th>
                  <th className="cifras px-3 py-2 text-right">Por rem.</th>
                  <th className="cifras px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-center">Pago</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {registrada.detalles.map((d) => (
                  <tr key={d.id} className="border-b border-borde last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-medium text-texto">{d.apellidos}, {d.nombres}</p>
                      <p className="text-apoyo text-texto-tenue">{d.numeroDocumento}</p>
                    </td>
                    <td className="px-3 py-2 text-center text-texto-suave">{d.diasLaborados}</td>
                    <td className="cifras px-3 py-2 text-right text-texto-suave">{soles(d.remuneracionAnual)}</td>
                    <td className="cifras px-3 py-2 text-right text-texto-suave">{soles(d.montoPorDias)}</td>
                    <td className="cifras px-3 py-2 text-right text-texto-suave">{soles(d.montoPorRem)}</td>
                    <td className="cifras px-3 py-2 text-right font-semibold text-texto">
                      {soles(d.montoTotal)}
                      {d.topeAplicado && (
                        <span className="ml-1 rounded bg-advertencia-suave px-1.5 py-0.5 text-apoyo text-advertencia">
                          tope 18
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-apoyo">
                      {d.pagadaEn ? (
                        <span className="text-exito">Pagada</span>
                      ) : (
                        <span className="text-texto-tenue">Pendiente</span>
                      )}
                    </td>
                    <td className="cifras px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void abrirHojaUtilidades(registrada.id, d.personaId)}
                        className="rounded-control border border-borde-fuerte px-2.5 py-1 text-apoyo text-texto-suave hover:bg-fondo"
                      >
                        Hoja PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- 3. Cálculo del reparto (si aún no está registrado) ---- */}
      {!registrada && puedeContinuar && (
        <div className="space-y-4 rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="rentaNeta" className="block text-apoyo text-texto-suave">
                Renta neta anual del {ejercicio} (S/)
              </label>
              <input
                id="rentaNeta"
                type="number"
                min={0}
                step="0.01"
                value={rentaNeta}
                onChange={(e) => setRentaNeta(e.target.value)}
                placeholder="0.00"
                className="mt-1 w-44 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
              />
            </div>
            <div>
              <span className="block text-apoyo text-texto-suave">% del sector</span>
              <p className="mt-1 rounded-control bg-fondo px-3 py-2 text-cuerpo font-semibold text-texto">
                {obligacion?.porcentajeSector
                  ? `${(Number(obligacion.porcentajeSector) * 100).toFixed(0)}%`
                  : 'Sin configurar (edítalo en la empresa)'}
              </p>
            </div>
            <button
              type="button"
              disabled={!rentaNeta || Number(rentaNeta) <= 0 || calcular.isPending}
              onClick={() => calcular.mutate()}
              className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
            >
              {calcular.isPending ? 'Calculando…' : 'Calcular reparto'}
            </button>
          </div>

          {calculo && (
            <>
              {calculo.advertencias.length > 0 && (
                <ul className="space-y-1 rounded-control bg-advertencia-suave p-3 text-apoyo text-advertencia">
                  {calculo.advertencias.map((a) => (
                    <li key={a}>• {a}</li>
                  ))}
                </ul>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-cuerpo">
                  <thead className="border-b border-borde text-apoyo uppercase text-texto-tenue">
                    <tr>
                      <th className="px-3 py-2">Trabajador</th>
                      <th className="px-3 py-2 text-center">Días laborados</th>
                      <th className="cifras px-3 py-2 text-right">Rem. anual</th>
                      <th className="cifras px-3 py-2 text-right">50% por días</th>
                      <th className="cifras px-3 py-2 text-right">50% por rem.</th>
                      <th className="cifras px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculo.filas.map((f) => (
                      <tr key={f.personaId} className="border-b border-borde last:border-0">
                        <td className="px-3 py-2">
                          <p className="font-medium text-texto">
                            {f.apellidos}, {f.nombres}
                            {f.cesado && (
                              <span className="ml-2 rounded bg-fondo px-1.5 py-0.5 text-apoyo text-texto-suave">
                                cesado {f.fechaCese}
                              </span>
                            )}
                          </p>
                          <p className="text-apoyo text-texto-tenue">{f.numeroDocumento}</p>
                        </td>
                        <td className="px-3 py-2 text-center text-texto-suave">{f.diasLaborados}</td>
                        <td className="cifras px-3 py-2 text-right text-texto-suave">{soles(f.remuneracionAnual)}</td>
                        <td className="cifras px-3 py-2 text-right text-texto-suave">{soles(f.montoPorDias)}</td>
                        <td className="cifras px-3 py-2 text-right text-texto-suave">{soles(f.montoPorRemuneracion)}</td>
                        <td className="cifras px-3 py-2 text-right font-semibold text-texto">
                          {soles(f.montoTotal)}
                          {f.topeAplicado && (
                            <span
                              className="ml-1 rounded bg-advertencia-suave px-1.5 py-0.5 text-apoyo text-advertencia"
                              title={`Tope: ${soles(f.tope)} (18 sueldos). Excedente a Fondoempleo: ${soles(f.excedenteFondoempleo)}`}
                            >
                              tope 18
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="text-cuerpo font-semibold text-texto">
                    <tr className="border-t border-borde">
                      <td className="px-3 py-2">TOTALES</td>
                      <td className="px-3 py-2 text-center">{calculo.totalDias}</td>
                      <td className="cifras px-3 py-2 text-right">{soles(calculo.totalRemuneraciones)}</td>
                      <td className="px-3 py-2" colSpan={2}></td>
                      <td className="cifras px-3 py-2 text-right">{soles(calculo.totalRepartido)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4 border-t border-borde pt-4">
                <div className="text-cuerpo">
                  <p className="text-apoyo text-texto-suave">
                    Monto a repartir ({(Number(calculo.porcentajeSector) * 100).toFixed(0)}% de{' '}
                    {soles(calculo.rentaNeta)})
                  </p>
                  <p className="text-subtitulo font-semibold text-primario-oscuro">{soles(calculo.montoARepartir)}</p>
                  {Number(calculo.excedenteFondoempleo) > 0 && (
                    <p className="text-apoyo text-advertencia">
                      Excedente a Fondoempleo: {soles(calculo.excedenteFondoempleo)} (no se
                      redistribuye)
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="mesPago" className="block text-apoyo text-texto-suave">
                      Planilla del mes de pago
                    </label>
                    <div className="mt-1 flex gap-2">
                      <select
                        id="mesPago"
                        value={mesPago}
                        onChange={(e) => setMesPago(Number(e.target.value))}
                        className="rounded-control border border-borde-fuerte px-2 py-2 text-cuerpo"
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {String(i + 1).padStart(2, '0')}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label="Año de pago"
                        type="number"
                        value={anioPago}
                        onChange={(e) => setAnioPago(Number(e.target.value))}
                        className="w-24 rounded-control border border-borde-fuerte px-2 py-2 text-cuerpo"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="fechaLimite" className="block text-apoyo text-texto-suave">
                      Fecha límite de pago (DJ + 30 días)
                    </label>
                    <input
                      id="fechaLimite"
                      type="date"
                      value={fechaLimitePago}
                      onChange={(e) => setFechaLimitePago(e.target.value)}
                      className="mt-1 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmando(true)}
                    className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro"
                  >
                    Registrar utilidades
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---- Modal de confirmación ---- */}
      {confirmando && calculo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-texto/40 p-4">
          <div className="w-full max-w-md rounded-tarjeta bg-superficie p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-texto">Registrar utilidades del {ejercicio}</h2>
            <p className="mt-2 text-cuerpo text-texto-suave">
              Se repartirán <strong>{soles(calculo.totalRepartido)}</strong> entre{' '}
              <strong>{calculo.filas.length}</strong> trabajadores
              {Number(calculo.excedenteFondoempleo) > 0 && (
                <> (más {soles(calculo.excedenteFondoempleo)} al Fondoempleo)</>
              )}
              . El pago entrará como ingreso en la planilla de{' '}
              <strong>{String(mesPago).padStart(2, '0')}/{anioPago}</strong>.
            </p>
            <p className="mt-2 rounded bg-fondo px-3 py-2 text-apoyo text-texto-suave">
              El registro es inmutable y genera la hoja de liquidación individual
              (obligatoria) de cada trabajador.
            </p>
            {continuarNoObligada && (
              <p className="mt-2 rounded bg-advertencia-suave px-3 py-2 text-apoyo text-advertencia">
                La empresa no está obligada: el registro quedará auditado como
                override informado.
              </p>
            )}
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
                onClick={() => registrar.mutate()}
                disabled={registrar.isPending}
                className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
              >
                {registrar.isPending ? 'Registrando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
