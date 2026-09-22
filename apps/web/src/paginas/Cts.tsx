import type { FilaCtsDto, SemestreCts } from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import {
  abrirConstanciaCts,
  calcularCts,
  depositarCts,
  listarDepositosCts,
} from '../lib/cts';
import { soles } from '../lib/planillas';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

const hoy = new Date();

function Desglose({ fila }: { fila: FilaCtsDto }) {
  const d = fila.desglose;
  return (
    <div className="text-apoyo leading-relaxed text-texto-suave">
      <div>Básico {soles(d.sueldoBasico)}</div>
      {Number(d.asignacionFamiliar) > 0 && <div>+ Asig. familiar {soles(d.asignacionFamiliar)}</div>}
      {Number(d.sextoGratificacion) > 0 && <div>+ 1/6 gratificación {soles(d.sextoGratificacion)}</div>}
      {d.aplicaRegla3De6 ? (
        <div className="text-exito">
          + Promedio HE {soles(d.promedioHorasExtras)} ({d.mesesConHorasExtras} de 6 meses)
        </div>
      ) : (
        <div className="text-advertencia">
          HE excluidas: solo {d.mesesConHorasExtras} de 6 meses (la norma exige 3)
        </div>
      )}
    </div>
  );
}

export function Cts() {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [semestre, setSemestre] = useState<SemestreCts>(
    hoy.getMonth() + 1 >= 5 && hoy.getMonth() + 1 <= 10 ? 'MAY_OCT' : 'NOV_ABR',
  );
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [tcManual, setTcManual] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  const { data: calculo, isPending } = useQuery({
    queryKey: ['cts', empresa.id, anio, semestre],
    queryFn: () => calcularCts(empresa.id as string, { anio, semestre }),
    enabled: Boolean(empresa.id),
  });

  const { data: depositos } = useQuery({
    queryKey: ['cts-depositos', empresa.id, anio, semestre],
    queryFn: () => listarDepositosCts(empresa.id as string, anio, semestre),
    enabled: Boolean(empresa.id),
  });

  // Preselecciona a quienes tienen CTS por depositar y cuenta registrada
  useEffect(() => {
    if (calculo) {
      setSeleccion(
        new Set(
          calculo.filas
            .filter((f) => !f.yaDepositado && Number(f.montoSoles) > 0 && f.banco)
            .map((f) => f.personaId),
        ),
      );
    }
  }, [calculo]);

  const depositar = useMutation({
    mutationFn: () =>
      depositarCts(empresa.id as string, {
        anio,
        semestre,
        fechaDeposito: new Date().toISOString().slice(0, 10),
        personaIds: [...seleccion],
        tipoCambioManual: tcManual || undefined,
      }),
    onSuccess: (creados) => {
      agregarToast('exito', `${creados.length} depósito(s) registrados`);
      setConfirmando(false);
      void queryClient.invalidateQueries({ queryKey: ['cts'] });
      void queryClient.invalidateQueries({ queryKey: ['cts-depositos'] });
    },
    onError: (e) => {
      setConfirmando(false);
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudieron registrar los depósitos');
    },
  });

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <h1 className="text-subtitulo font-semibold text-texto">Elige la empresa activa</h1>
        <p className="mt-2 text-cuerpo text-texto-suave">
          La CTS se deposita por empresa.{' '}
          <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }

  const hayUsd = calculo?.filas.some((f) => seleccion.has(f.personaId) && f.moneda === 'USD');
  const totalSeleccionado = (calculo?.filas ?? [])
    .filter((f) => seleccion.has(f.personaId))
    .reduce((acc, f) => acc + Number(f.montoSoles), 0);

  const alternar = (personaId: string) => {
    setSeleccion((s) => {
      const nueva = new Set(s);
      if (nueva.has(personaId)) {
        nueva.delete(personaId);
      } else {
        nueva.add(personaId);
      }
      return nueva;
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-subtitulo font-semibold text-texto">
          CTS · <span className="text-texto-tenue">{empresa.razonSocial}</span>
        </h1>
        <div className="flex items-end gap-3">
          <div>
            <label htmlFor="semestre" className="block text-apoyo text-texto-suave">Semestre</label>
            <select
              id="semestre"
              value={semestre}
              onChange={(e) => setSemestre(e.target.value as SemestreCts)}
              className="mt-1 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            >
              <option value="MAY_OCT">Mayo – Octubre (deposita hasta el 15-nov)</option>
              <option value="NOV_ABR">Noviembre – Abril (deposita hasta el 15-may)</option>
            </select>
          </div>
          <div>
            <label htmlFor="anio" className="block text-apoyo text-texto-suave">Año de inicio</label>
            <input
              id="anio"
              type="number"
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="mt-1 w-24 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
          </div>
        </div>
      </div>

      {calculo && (
        <p className="text-cuerpo text-texto-suave">
          Semestre <strong>{calculo.semestre}</strong> ({calculo.fechaInicio} al {calculo.fechaFin}) ·
          fecha límite de depósito: <strong>{calculo.fechaLimite}</strong>
        </p>
      )}

      {calculo && calculo.advertencias.length > 0 && (
        <div className="rounded-control bg-peligro-suave px-4 py-3 text-cuerpo text-peligro">
          <p className="font-semibold">Faltan cuentas CTS por registrar:</p>
          <ul className="mt-1 list-disc pl-5">
            {calculo.advertencias.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
        <table className="w-full text-left text-cuerpo">
          <thead className="border-b border-borde text-apoyo uppercase text-texto-tenue">
            <tr>
              <th className="px-3 py-3 w-8"></th>
              <th className="px-3 py-3">Trabajador</th>
              <th className="px-3 py-3">Remuneración computable</th>
              <th className="px-3 py-3 text-center">Tiempo</th>
              <th className="cifras px-3 py-3 text-right">CTS a depositar</th>
              <th className="px-3 py-3">Cuenta CTS</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isPending && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-texto-tenue">Calculando…</td></tr>
            )}
            {calculo?.filas.map((f) => {
              const noCorresponde = f.regimenLaboral === 'MICROEMPRESA';
              const deposito = depositos?.find((d) => d.personaId === f.personaId);
              return (
                <tr
                  key={f.personaId}
                  className={`border-b border-borde last:border-0 ${noCorresponde ? 'text-texto-tenue' : ''}`}
                >
                  <td className="px-3 py-2">
                    {!noCorresponde && !f.yaDepositado && Number(f.montoSoles) > 0 && (
                      <input
                        type="checkbox"
                        checked={seleccion.has(f.personaId)}
                        onChange={() => alternar(f.personaId)}
                        disabled={!f.banco}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <p className={noCorresponde ? '' : 'font-medium text-texto'}>
                      {f.apellidos}, {f.nombres}
                    </p>
                    <p className="text-apoyo text-texto-tenue">{f.numeroDocumento}</p>
                  </td>
                  <td className="px-3 py-2">
                    {noCorresponde ? (
                      <span className="text-apoyo">No corresponde (microempresa)</span>
                    ) : (
                      <>
                        <p className="font-medium text-texto">{soles(f.desglose.remComputable)}</p>
                        <Desglose fila={f} />
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-texto-suave">
                    {noCorresponde ? '—' : `${f.mesesCompletos} m ${f.diasAdicionales} d`}
                  </td>
                  <td className="cifras px-3 py-2 text-right font-semibold text-texto">
                    {noCorresponde ? <span className="font-normal">—</span> : soles(f.montoSoles)}
                    {f.nota && !noCorresponde && (
                      <p className="text-apoyo font-normal text-advertencia">{f.nota}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {noCorresponde ? (
                      '—'
                    ) : f.banco ? (
                      <span className="text-texto-suave">
                        {f.banco} · {f.cuenta}
                        <span className="ml-1 rounded bg-fondo px-1 text-apoyo">{f.moneda}</span>
                      </span>
                    ) : (
                      <span className="font-medium text-peligro">Falta la cuenta CTS</span>
                    )}
                  </td>
                  <td className="cifras px-3 py-2 text-right">
                    {f.yaDepositado && deposito && (
                      <button
                        type="button"
                        onClick={() => void abrirConstanciaCts(deposito.id)}
                        className="rounded-control border border-borde-fuerte px-2.5 py-1 text-apoyo text-texto-suave hover:bg-fondo"
                      >
                        Constancia
                      </button>
                    )}
                    {f.yaDepositado && (
                      <p className="mt-1 text-apoyo text-exito">Depositada</p>
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
          <p className="text-apoyo text-texto-suave">Total seleccionado ({seleccion.size} trabajadores)</p>
          <p className="text-subtitulo font-semibold text-primario-oscuro">{soles(totalSeleccionado)}</p>
        </div>
        <div className="flex items-end gap-3">
          {hayUsd && (
            <div>
              <label htmlFor="tc" className="block text-apoyo text-texto-suave">
                TC venta manual (si SUNAT no responde)
              </label>
              <input
                id="tc"
                value={tcManual}
                onChange={(e) => setTcManual(e.target.value)}
                placeholder="3.755"
                className="mt-1 w-28 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
              />
            </div>
          )}
          <button
            type="button"
            disabled={seleccion.size === 0}
            onClick={() => setConfirmando(true)}
            className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
          >
            Registrar depósitos
          </button>
        </div>
      </div>

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-texto/40 p-4">
          <div className="w-full max-w-md rounded-tarjeta bg-superficie p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-texto">Registrar depósitos de CTS</h2>
            <p className="mt-2 text-cuerpo text-texto-suave">
              Se registrarán <strong>{seleccion.size}</strong> depósitos del semestre{' '}
              <strong>{calculo?.semestre}</strong> por un total de{' '}
              <strong>{soles(totalSeleccionado)}</strong>.
            </p>
            {hayUsd && (
              <p className="mt-2 rounded bg-advertencia-suave px-3 py-2 text-cuerpo text-advertencia">
                Hay cuentas en dólares: se convertirán con el tipo de cambio venta SUNAT del
                día {tcManual && `(manual: ${tcManual})`}.
              </p>
            )}
            <p className="mt-2 text-cuerpo text-peligro">
              El depósito queda registrado de forma definitiva por trabajador y semestre.
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
                onClick={() => depositar.mutate()}
                disabled={depositar.isPending}
                className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
              >
                {depositar.isPending ? 'Registrando…' : 'Confirmar depósitos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
