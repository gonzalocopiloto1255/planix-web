import { SkeletonTabla } from '../componentes/ui';
import type {
  AsientoDto,
  AsientoResumenDto,
  FormatoExportAsiento,
  OrigenAsiento,
} from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import {
  exportarAsiento,
  generarAsientoCts,
  generarAsientoGratificacion,
  generarAsientoUtilidades,
  listarAsientos,
  obtenerAsiento,
} from '../lib/asientos';
import { soles } from '../lib/planillas';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

const hoy = new Date();

const ETIQUETA_ORIGEN: Record<OrigenAsiento, string> = {
  PLANILLA: 'Planilla',
  CTS_PROVISION: 'CTS · provisión',
  CTS_DEPOSITO: 'CTS · depósito',
  GRATIFICACION: 'Gratificación',
  LIQUIDACION: 'Liquidación',
  UTILIDADES: 'Utilidades',
};

const FORMATOS: { valor: FormatoExportAsiento; etiqueta: string }[] = [
  { valor: 'EXCEL_GENERICO', etiqueta: 'Excel' },
  { valor: 'CONCAR', etiqueta: 'CONCAR' },
  { valor: 'CSV', etiqueta: 'CSV' },
];

/** Detalle expandido de un asiento: líneas y totales (verde si cuadran). */
function DetalleAsiento({ asientoId }: { asientoId: string }) {
  const { data: asiento, isPending } = useQuery({
    queryKey: ['asiento', asientoId],
    queryFn: () => obtenerAsiento(asientoId),
  });

  if (isPending || !asiento) {
    return <SkeletonTabla />;
  }
  const cuadra = asiento.totalDebe === asiento.totalHaber;
  return (
    <div className="overflow-x-auto border-t border-borde bg-fondo px-4 py-3">
      <table className="w-full text-left text-apoyo">
        <thead className="text-texto-tenue">
          <tr>
            <th className="py-1 pr-3">Cuenta</th>
            <th className="py-1 pr-3">Denominación</th>
            <th className="py-1 pr-3">Auxiliar</th>
            <th className="py-1 pr-3">Glosa</th>
            <th className="cifras py-1 pr-3 text-right">Debe</th>
            <th className="cifras py-1 pr-3 text-right">Haber</th>
            <th className="py-1">C. costo</th>
          </tr>
        </thead>
        <tbody>
          {asiento.lineas.map((l, i) => (
            <tr key={i} className="border-t border-borde">
              <td className="py-1 pr-3 font-mono font-medium text-texto">{l.cuenta}</td>
              <td className="py-1 pr-3 text-texto-suave">{l.cuentaNombre ?? '—'}</td>
              <td className="py-1 pr-3 font-mono text-texto-suave">{l.auxiliar ?? ''}</td>
              <td className="py-1 pr-3 text-texto-suave">{l.glosa ?? ''}</td>
              <td className="cifras py-1 pr-3 text-right text-texto">
                {Number(l.debe) > 0 ? soles(l.debe) : ''}
              </td>
              <td className="cifras py-1 pr-3 text-right text-texto">
                {Number(l.haber) > 0 ? soles(l.haber) : ''}
              </td>
              <td className="py-1 text-texto-suave">{l.centroCosto ?? ''}</td>
            </tr>
          ))}
          <tr className={`border-t-2 border-borde font-bold ${cuadra ? 'text-exito' : 'text-peligro'}`}>
            <td className="py-1.5 pr-3" colSpan={4}>
              TOTALES {cuadra ? '· Debe = Haber ✓' : '· ¡DESCUADRADO!'}
            </td>
            <td className="cifras py-1.5 pr-3 text-right">{soles(asiento.totalDebe)}</td>
            <td className="cifras py-1.5 pr-3 text-right">{soles(asiento.totalHaber)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Panel para generar los asientos de beneficios ya registrados. */
function GenerarBeneficios({ empresaId }: { empresaId: string }) {
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [semestre, setSemestre] = useState(
    hoy.getMonth() + 1 >= 5 && hoy.getMonth() + 1 <= 10
      ? `MAY${hoy.getFullYear()}-OCT${hoy.getFullYear()}`
      : `NOV${hoy.getFullYear() - 1}-ABR${hoy.getFullYear()}`,
  );
  const [tipoCts, setTipoCts] = useState<'PROVISION' | 'DEPOSITO'>('PROVISION');
  const [anioGrati, setAnioGrati] = useState(hoy.getFullYear());
  const [mesGrati, setMesGrati] = useState<7 | 12>(hoy.getMonth() + 1 >= 12 ? 12 : 7);
  const [ejercicio, setEjercicio] = useState(hoy.getFullYear() - 1);

  const alTerminar = {
    onSuccess: (a: AsientoDto) => {
      agregarToast('exito', `Asiento generado: ${a.glosa}`);
      void queryClient.invalidateQueries({ queryKey: ['asientos'] });
    },
    onError: (e: unknown) => {
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo generar el asiento');
    },
  };

  const cts = useMutation({
    mutationFn: () => generarAsientoCts(empresaId, { semestre, tipo: tipoCts }),
    ...alTerminar,
  });
  const grati = useMutation({
    mutationFn: () =>
      generarAsientoGratificacion(empresaId, { anio: anioGrati, mes: mesGrati }),
    ...alTerminar,
  });
  const utilidades = useMutation({
    mutationFn: () => generarAsientoUtilidades(empresaId, { ejercicio }),
    ...alTerminar,
  });

  const estiloInput = 'mt-1 rounded-control border border-borde-fuerte px-2 py-1.5 text-cuerpo';
  const estiloBoton =
    'rounded-control border border-primario px-3 py-1.5 text-cuerpo font-medium text-primario-oscuro hover:bg-primario-suave disabled:opacity-50';

  return (
    <div className="rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
      <h2 className="text-cuerpo font-semibold text-texto">
        Generar asiento de beneficios registrados
      </h2>
      <p className="mt-1 text-apoyo text-texto-tenue">
        El asiento de la planilla se genera solo al cerrar el periodo. La liquidación se
        genera desde su propia pantalla. Un asiento ya exportado es inmutable.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor="semestre-cts" className="block text-apoyo text-texto-suave">Semestre CTS</label>
            <input
              id="semestre-cts"
              value={semestre}
              onChange={(e) => setSemestre(e.target.value.toUpperCase())}
              className={`${estiloInput} w-44 font-mono`}
            />
          </div>
          <div>
            <label htmlFor="tipo-cts" className="block text-apoyo text-texto-suave">Tipo</label>
            <select
              id="tipo-cts"
              value={tipoCts}
              onChange={(e) => setTipoCts(e.target.value as 'PROVISION' | 'DEPOSITO')}
              className={estiloInput}
            >
              <option value="PROVISION">Provisión</option>
              <option value="DEPOSITO">Depósito</option>
            </select>
          </div>
          <button type="button" onClick={() => cts.mutate()} disabled={cts.isPending} className={estiloBoton}>
            CTS
          </button>
        </div>

        <div className="flex items-end gap-2">
          <div>
            <label htmlFor="anio-grati" className="block text-apoyo text-texto-suave">Año</label>
            <input
              id="anio-grati"
              type="number"
              value={anioGrati}
              onChange={(e) => setAnioGrati(Number(e.target.value))}
              className={`${estiloInput} w-24`}
            />
          </div>
          <div>
            <label htmlFor="mes-grati" className="block text-apoyo text-texto-suave">Mes</label>
            <select
              id="mes-grati"
              value={mesGrati}
              onChange={(e) => setMesGrati(Number(e.target.value) as 7 | 12)}
              className={estiloInput}
            >
              <option value={7}>Julio</option>
              <option value={12}>Diciembre</option>
            </select>
          </div>
          <button type="button" onClick={() => grati.mutate()} disabled={grati.isPending} className={estiloBoton}>
            Gratificación
          </button>
        </div>

        <div className="flex items-end gap-2">
          <div>
            <label htmlFor="ejercicio" className="block text-apoyo text-texto-suave">Ejercicio</label>
            <input
              id="ejercicio"
              type="number"
              value={ejercicio}
              onChange={(e) => setEjercicio(Number(e.target.value))}
              className={`${estiloInput} w-24`}
            />
          </div>
          <button
            type="button"
            onClick={() => utilidades.mutate()}
            disabled={utilidades.isPending}
            className={estiloBoton}
          >
            Utilidades
          </button>
        </div>
      </div>
    </div>
  );
}

function FilaAsiento({ asiento }: { asiento: AsientoResumenDto }) {
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [abierto, setAbierto] = useState(false);
  const [formato, setFormato] = useState<FormatoExportAsiento>('EXCEL_GENERICO');

  const exportar = useMutation({
    mutationFn: () => exportarAsiento(asiento.id, formato),
    onSuccess: () => {
      agregarToast('exito', 'Asiento exportado: desde ahora es inmutable');
      void queryClient.invalidateQueries({ queryKey: ['asientos'] });
    },
    onError: (e) => {
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo exportar');
    },
  });

  return (
    <div className="border-b border-borde last:border-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="flex-1 text-left"
        >
          <p className="text-cuerpo font-medium text-texto">{asiento.glosa}</p>
          <p className="text-apoyo text-texto-tenue">
            {ETIQUETA_ORIGEN[asiento.origen]} · {asiento.fecha} ·{' '}
            {abierto ? 'ocultar detalle' : 'ver detalle'}
          </p>
        </button>
        <p className="text-cuerpo font-semibold text-texto">{soles(asiento.totalDebe)}</p>
        {asiento.exportadoEn ? (
          <span className="rounded bg-exito-suave px-2 py-1 text-apoyo font-medium text-exito">
            Exportado ({asiento.formatoExport === 'EXCEL_GENERICO' ? 'Excel' : asiento.formatoExport})
          </span>
        ) : (
          <span className="rounded bg-fondo px-2 py-1 text-apoyo text-texto-suave">
            Sin exportar
          </span>
        )}
        <div className="flex items-center gap-1">
          <select
            aria-label="Formato de exportación"
            value={formato}
            onChange={(e) => setFormato(e.target.value as FormatoExportAsiento)}
            className="rounded-control border border-borde-fuerte px-2 py-1 text-apoyo"
          >
            {FORMATOS.map((f) => (
              <option key={f.valor} value={f.valor}>{f.etiqueta}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => exportar.mutate()}
            disabled={exportar.isPending}
            className="rounded-control border border-borde-fuerte px-2.5 py-1 text-apoyo text-texto-suave hover:bg-fondo disabled:opacity-50"
          >
            {exportar.isPending ? 'Exportando…' : 'Exportar'}
          </button>
        </div>
      </div>
      {abierto && <DetalleAsiento asientoId={asiento.id} />}
    </div>
  );
}

export function Asientos() {
  const empresa = useEmpresaActiva();

  const { data: asientos, isPending } = useQuery({
    queryKey: ['asientos', empresa.id],
    queryFn: () => listarAsientos(empresa.id as string),
    enabled: Boolean(empresa.id),
  });

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <h1 className="text-subtitulo font-semibold text-texto">Elige la empresa activa</h1>
        <p className="mt-2 text-cuerpo text-texto-suave">
          Los asientos contables son por empresa.{' '}
          <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-subtitulo font-semibold text-texto">
          Asientos contables · <span className="text-texto-tenue">{empresa.razonSocial}</span>
        </h1>
        <Link
          to="/asientos/configuracion"
          className="rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo text-texto-suave hover:bg-fondo"
        >
          Plan de cuentas y mapeos
        </Link>
      </div>

      <GenerarBeneficios empresaId={empresa.id} />

      <div className="rounded-tarjeta bg-superficie shadow-tarjeta">
        {isPending && (
          <SkeletonTabla />
        )}
        {asientos && asientos.length === 0 && (
          <p className="px-4 py-8 text-center text-cuerpo text-texto-tenue">
            Aún no hay asientos: se generan automáticamente al cerrar un periodo, o desde
            el panel de beneficios.
          </p>
        )}
        {asientos?.map((a) => (
          <FilaAsiento key={a.id} asiento={a} />
        ))}
      </div>
    </div>
  );
}
