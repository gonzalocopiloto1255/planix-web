import type { FilaGratiDto, MesGratificacion } from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import {
  abrirBoletaGrati,
  abrirPlanillaGrati,
  calcularGratificaciones,
  listarGratificaciones,
  registrarGratificaciones,
} from '../lib/gratificaciones';
import { soles } from '../lib/planillas';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

const hoy = new Date();

function Desglose({ fila }: { fila: FilaGratiDto }) {
  const d = fila.desglose;
  return (
    <div className="text-apoyo leading-relaxed text-texto-suave">
      <div>Básico {soles(d.sueldoBasico)}</div>
      {Number(d.asignacionFamiliar) > 0 && (
        <div>+ Asig. familiar {soles(d.asignacionFamiliar)}</div>
      )}
      {d.aplicaRegla3De6 ? (
        <div className="text-exito">
          + Promedio HE {soles(d.promedioHorasExtras)} ({d.mesesConHorasExtras} de 6 meses)
        </div>
      ) : d.mesesConHorasExtras > 0 ? (
        <div className="text-advertencia">
          HE excluidas: solo {d.mesesConHorasExtras} de 6 meses (la norma exige 3)
        </div>
      ) : null}
    </div>
  );
}

export function Gratificaciones() {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState<MesGratificacion>(hoy.getMonth() + 1 <= 7 ? 7 : 12);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);

  const { data: calculo, isPending } = useQuery({
    queryKey: ['grati', empresa.id, anio, mes],
    queryFn: () => calcularGratificaciones(empresa.id as string, { anio, mes }),
    enabled: Boolean(empresa.id),
  });

  const { data: registradas } = useQuery({
    queryKey: ['grati-registradas', empresa.id, anio, mes],
    queryFn: () => listarGratificaciones(empresa.id as string, anio, mes),
    enabled: Boolean(empresa.id),
  });

  useEffect(() => {
    if (calculo) {
      setSeleccion(
        new Set(
          calculo.filas
            .filter((f) => !f.yaRegistrada && Number(f.total) > 0)
            .map((f) => f.personaId),
        ),
      );
    }
  }, [calculo]);

  const registrar = useMutation({
    mutationFn: () =>
      registrarGratificaciones(empresa.id as string, {
        anio,
        mes,
        personaIds: [...seleccion],
      }),
    onSuccess: (creadas) => {
      agregarToast('exito', `${creadas.length} gratificación(es) registradas`);
      setConfirmando(false);
      void queryClient.invalidateQueries({ queryKey: ['grati'] });
      void queryClient.invalidateQueries({ queryKey: ['grati-registradas'] });
    },
    onError: (e) => {
      setConfirmando(false);
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudieron registrar');
    },
  });

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <h1 className="text-subtitulo font-semibold text-texto">Elige la empresa activa</h1>
        <p className="mt-2 text-cuerpo text-texto-suave">
          Las gratificaciones se calculan por empresa.{' '}
          <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }

  const totalSeleccionado = (calculo?.filas ?? [])
    .filter((f) => seleccion.has(f.personaId))
    .reduce((acc, f) => acc + Number(f.total), 0);
  const hayRegistradas = (registradas?.length ?? 0) > 0;

  const alternar = (personaId: string) =>
    setSeleccion((s) => {
      const nueva = new Set(s);
      if (nueva.has(personaId)) {
        nueva.delete(personaId);
      } else {
        nueva.add(personaId);
      }
      return nueva;
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-subtitulo font-semibold text-texto">
          Gratificaciones · <span className="text-texto-tenue">{empresa.razonSocial}</span>
        </h1>
        <div className="flex items-end gap-3">
          <div>
            <label htmlFor="mes" className="block text-apoyo text-texto-suave">Periodo</label>
            <select
              id="mes"
              value={mes}
              onChange={(e) => setMes(Number(e.target.value) as MesGratificacion)}
              className="mt-1 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            >
              <option value={7}>Julio (semestre ene-jun)</option>
              <option value={12}>Diciembre (semestre jul-dic)</option>
            </select>
          </div>
          <div>
            <label htmlFor="anio" className="block text-apoyo text-texto-suave">Año</label>
            <input
              id="anio"
              type="number"
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="mt-1 w-24 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
          </div>
          {hayRegistradas && (
            <button
              type="button"
              onClick={() => void abrirPlanillaGrati(empresa.id as string, anio, mes)}
              className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
            >
              Planilla PDF
            </button>
          )}
        </div>
      </div>

      {calculo && (
        <p className="text-cuerpo text-texto-suave">
          Semestre computable <strong>{calculo.semestre}</strong> ({calculo.fechaInicio} al{' '}
          {calculo.fechaFin}) · fecha límite de pago: <strong>{calculo.fechaLimite}</strong>
        </p>
      )}

      <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
        <table className="w-full text-left text-cuerpo">
          <thead className="border-b border-borde text-apoyo uppercase text-texto-tenue">
            <tr>
              <th className="w-8 px-3 py-3"></th>
              <th className="px-3 py-3">Trabajador</th>
              <th className="px-3 py-3">Remuneración computable</th>
              <th className="px-3 py-3 text-center">Meses</th>
              <th className="cifras px-3 py-3 text-right">Gratificación</th>
              <th className="cifras px-3 py-3 text-right">Bonificación</th>
              <th className="cifras px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isPending && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-texto-tenue">Calculando…</td></tr>
            )}
            {calculo?.filas.map((f) => {
              const noCorresponde = f.regimenLaboral === 'MICROEMPRESA';
              const registrada = registradas?.find((g) => g.personaId === f.personaId);
              return (
                <tr
                  key={f.personaId}
                  className={`border-b border-borde last:border-0 ${noCorresponde ? 'text-texto-tenue' : ''}`}
                >
                  <td className="px-3 py-2">
                    {!noCorresponde && !f.yaRegistrada && Number(f.total) > 0 && (
                      <input
                        type="checkbox"
                        checked={seleccion.has(f.personaId)}
                        onChange={() => alternar(f.personaId)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <p className={noCorresponde ? '' : 'font-medium text-texto'}>
                      {f.apellidos}, {f.nombres}
                    </p>
                    <p className="text-apoyo text-texto-tenue">
                      {f.numeroDocumento}
                      {f.afiliadoEps && ' · EPS'}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {noCorresponde ? (
                      <span className="text-apoyo">No corresponde (microempresa)</span>
                    ) : (
                      <>
                        <p className="font-medium text-texto">
                          {soles(f.desglose.remComputable)}
                        </p>
                        <Desglose fila={f} />
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-texto-suave">
                    {noCorresponde ? '—' : f.mesesCompletos}
                  </td>
                  <td className="cifras px-3 py-2 text-right text-texto">
                    {noCorresponde ? '—' : soles(f.gratificacion)}
                  </td>
                  <td className="cifras px-3 py-2 text-right text-texto">
                    {noCorresponde ? (
                      '—'
                    ) : (
                      <>
                        {soles(f.bonificacion)}
                        <span className="ml-1 text-apoyo text-texto-tenue">
                          ({(Number(f.tasaBonificacion) * 100).toFixed(2)}%)
                        </span>
                      </>
                    )}
                  </td>
                  <td className="cifras px-3 py-2 text-right font-semibold text-texto">
                    {noCorresponde ? <span className="font-normal">—</span> : soles(f.total)}
                  </td>
                  <td className="cifras px-3 py-2 text-right">
                    {registrada && (
                      <>
                        <button
                          type="button"
                          onClick={() => void abrirBoletaGrati(registrada.id)}
                          className="rounded-control border border-borde-fuerte px-2.5 py-1 text-apoyo text-texto-suave hover:bg-fondo"
                        >
                          Boleta
                        </button>
                        <p className="mt-1 text-apoyo text-exito">Registrada</p>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
        <div>
          <p className="text-apoyo text-texto-suave">
            Total seleccionado ({seleccion.size} trabajadores)
          </p>
          <p className="text-subtitulo font-semibold text-primario-oscuro">{soles(totalSeleccionado)}</p>
          {calculo && (
            <p className="text-apoyo text-texto-tenue">
              Gratificaciones {soles(calculo.totalGratificaciones)} + bonificaciones{' '}
              {soles(calculo.totalBonificaciones)}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={seleccion.size === 0}
          onClick={() => setConfirmando(true)}
          className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
        >
          Registrar gratificaciones
        </button>
      </div>

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-texto/40 p-4">
          <div className="w-full max-w-md rounded-tarjeta bg-superficie p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-texto">Registrar gratificaciones</h2>
            <p className="mt-2 text-cuerpo text-texto-suave">
              Se registrarán <strong>{seleccion.size}</strong> gratificaciones de{' '}
              <strong>{mes === 7 ? 'julio' : 'diciembre'} {anio}</strong> por un total de{' '}
              <strong>{soles(totalSeleccionado)}</strong> (incluida la bonificación
              extraordinaria de la Ley 29351).
            </p>
            <p className="mt-2 rounded bg-advertencia-suave px-3 py-2 text-apoyo text-advertencia">
              La remuneración computable que se guarde alimentará el 1/6 de la CTS del
              semestre siguiente.
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
