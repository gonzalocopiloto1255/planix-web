import type { TipoPeriodo } from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { SkeletonTabla } from '../componentes/ui';
import {
  abrirPeriodo,
  etiquetaPeriodo,
  listarPeriodos,
  NOMBRE_MES,
} from '../lib/planillas';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

const hoy = new Date();

export function Planillas() {
  const empresa = useEmpresaActiva();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [tipo, setTipo] = useState<TipoPeriodo>('MENSUAL');

  const { data: periodos, isPending } = useQuery({
    queryKey: ['periodos', empresa.id],
    queryFn: () => listarPeriodos(empresa.id as string),
    enabled: Boolean(empresa.id),
  });

  const abrir = useMutation({
    mutationFn: () => abrirPeriodo(empresa.id as string, { anio, mes, tipo }),
    onSuccess: (r) => {
      agregarToast('exito', `Periodo ${etiquetaPeriodo(r.periodo)} abierto`);
      for (const a of r.advertencias) {
        agregarToast('advertencia', a);
      }
      void queryClient.invalidateQueries({ queryKey: ['periodos'] });
      navigate(`/planillas/${r.periodo.id}`);
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo abrir el periodo'),
  });

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <h1 className="text-subtitulo font-semibold text-texto">Elige la empresa activa</h1>
        <p className="mt-2 text-cuerpo text-texto-suave">
          Las planillas se llevan por empresa. Selecciónala en el menú superior o{' '}
          <Link to="/empresas" className="text-primario underline">ve a Empresas</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-subtitulo font-semibold text-texto">
        Planillas · <span className="text-texto-tenue">{empresa.razonSocial}</span>
      </h1>

      <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <h2 className="text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
          Abrir un periodo
        </h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="mes" className="block text-apoyo text-texto-suave">Mes</label>
            <select
              id="mes"
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="mt-1 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            >
              {NOMBRE_MES.map((n, i) => (
                <option key={n} value={i + 1}>{n}</option>
              ))}
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
          <div>
            <label htmlFor="tipo" className="block text-apoyo text-texto-suave">Tipo</label>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoPeriodo)}
              className="mt-1 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            >
              <option value="MENSUAL">Mensual</option>
              <option value="PRIMERA_QUINCENA">Primera quincena</option>
              <option value="SEGUNDA_QUINCENA">Segunda quincena</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => abrir.mutate()}
            disabled={abrir.isPending}
            className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
          >
            {abrir.isPending ? 'Abriendo…' : 'Abrir periodo'}
          </button>
        </div>
      </section>

      <section className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
        <table className="w-full text-left text-cuerpo">
          <thead className="border-b border-borde text-apoyo uppercase text-texto-tenue">
            <tr>
              <th className="px-4 py-3">Periodo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Cerrado el</th>
            </tr>
          </thead>
          <tbody>
            {isPending && (
              <tr><td colSpan={3} className="p-0"><SkeletonTabla /></td></tr>
            )}
            {!isPending && periodos?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-texto-tenue">
                  Aún no has abierto ningún periodo para esta empresa.
                </td>
              </tr>
            )}
            {periodos?.map((p) => (
              <tr
                key={p.id}
                onClick={() => navigate(`/planillas/${p.id}`)}
                className="cursor-pointer border-b border-borde last:border-0 hover:bg-fondo"
              >
                <td className="px-4 py-3 font-medium text-texto">{etiquetaPeriodo(p)}</td>
                <td className="px-4 py-3">
                  {p.estado === 'ABIERTO' ? (
                    <span className="rounded-full bg-advertencia-suave px-2.5 py-1 text-apoyo font-medium text-advertencia">
                      Abierto
                    </span>
                  ) : (
                    <span className="rounded-full bg-borde px-2.5 py-1 text-apoyo font-medium text-texto-suave">
                      Cerrado
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-texto-suave">
                  {p.cerradoEn ? p.cerradoEn.slice(0, 10) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
