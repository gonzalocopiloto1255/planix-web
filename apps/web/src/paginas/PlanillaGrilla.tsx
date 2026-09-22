import { SkeletonTabla } from '../componentes/ui';
import type {
  ClaveVariable,
  FilaPlanillaDto,
  PlanillaPeriodoDto,
} from '@planix/shared-types';
import { CLAVES_CON_CODIGO_T22, CLAVES_MONTO } from '@planix/shared-types';
import type { ConceptoT22Dto } from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { asientoDePeriodo, generarAsientoPeriodo } from '../lib/asientos';
import {
  cerrarPeriodo,
  conceptosT22,
  etiquetaPeriodo,
  guardarVariables,
  obtenerPlanilla,
  soles,
} from '../lib/planillas';
import { useToasts } from '../stores/toast';

const NOMBRE_LINEA: Record<string, string> = {
  SUELDO: 'Remuneración básica',
  VACACIONES: 'Vacaciones gozadas',
  ASIG_FAMILIAR: 'Asignación familiar',
  HE25: 'Horas extras 25%',
  HE35: 'Horas extras 35%',
  FERIADO_TRABAJADO: 'Feriado trabajado',
  SUBSIDIO: 'Subsidio EsSalud',
  ING_AFECTO: 'Ingreso extraordinario',
  ING_NO_AFECTO: 'Ingreso no afecto',
  TARDANZA: 'Descuento por tardanzas',
  PERDIDA_DOMINICAL: 'Pérdida del dominical',
  ADELANTO_Q1: 'Adelanto de quincena',
  FERIADO_SOBRETASA: 'Sobretasa de descanso/feriado',
  REMUN_DIA_FERIADO: 'Remuneración 1 de mayo',
  RETENCION_JUDICIAL: 'Retención judicial',
  ONP: 'ONP (13%)',
  AFP_FONDO: 'AFP — fondo',
  AFP_PRIMA: 'AFP — prima de seguro',
  AFP_COMISION: 'AFP — comisión',
  RENTA_5TA: 'Renta de 5ta categoría',
  ESSALUD_VIDA: 'EsSalud + Vida',
  PRESTAMO: 'Préstamo / adelanto',
  DSCTO_VOLUNTARIO: 'Descuento voluntario',
  ESSALUD: 'EsSalud',
  CREDITO_EPS: 'Crédito EPS',
  SCTR_SALUD: 'SCTR salud',
  SCTR_PENSION: 'SCTR pensión',
  VIDA_LEY: 'Seguro Vida Ley',
  SENATI: 'SENATI',
};

/**
 * Columnas editables de la grilla (CLAUDE.md §7.1: el contador SOLO digita esto).
 *
 * EL ORDEN NO ES DECORATIVO: primero lo que se mide en días, horas o
 * minutos, y al final el bloque de importes en soles (`CLAVES_MONTO`),
 * dentro de él los ingresos y después los descuentos.
 *
 * `ADELANTO_Q1` cierra la lista **por la misma razón por la que el motor
 * lo emite el último de los descuentos** (`orquestador.ts`, §7.3): no es
 * un descuento como los demás —no reduce lo que el trabajador GANA, sino
 * lo que queda por PAGARLE, porque ya se le entregó—, así que va después
 * incluso del voluntario. La grilla se lee en el mismo orden que la
 * boleta que produce.
 *
 * EL RÓTULO SALE DE `NOMBRE_LINEA`, NO DE UNA CADENA NUEVA. El panel de
 * desglose ya nombra esta línea, y dos literales iguales en el mismo
 * archivo son dos que se pueden desincronizar: es el patrón que dejó
 * «EsSalud (9%)» en el catálogo de conceptos discutiendo con la tasa que
 * imprime la boleta. Por eso `NOMBRE_LINEA` se declara ANTES que esta
 * lista: al revés, leerlo aquí daría un ReferenceError al cargar el
 * módulo, no un aviso del compilador.
 */
const COLUMNAS: { clave: ClaveVariable; titulo: string; ancho: string }[] = [
  { clave: 'DIAS_LABORADOS', titulo: 'Días lab.', ancho: 'w-20' },
  { clave: 'FALTAS', titulo: 'Faltas', ancho: 'w-16' },
  { clave: 'TARDANZA_MIN', titulo: 'Tard. min', ancho: 'w-20' },
  { clave: 'HE25_HORAS', titulo: 'HE 25%', ancho: 'w-16' },
  { clave: 'HE35_HORAS', titulo: 'HE 35%', ancho: 'w-16' },
  { clave: 'FERIADO_TRABAJADO_DIAS', titulo: 'Feriado', ancho: 'w-16' },
  { clave: 'DIAS_VACACIONES', titulo: 'Vacac.', ancho: 'w-16' },
  { clave: 'DIAS_CITT', titulo: 'CITT', ancho: 'w-16' },
  { clave: 'DIAS_LSGH', titulo: 'Lic. s/g', ancho: 'w-16' },
  { clave: 'ING_AFECTO', titulo: 'Ing. afecto', ancho: 'w-24' },
  { clave: 'ING_NO_AFECTO', titulo: 'Ing. no afecto', ancho: 'w-28' },
  { clave: 'DSCTO_VOLUNTARIO', titulo: 'Dscto. vol.', ancho: 'w-24' },
  { clave: 'ADELANTO_Q1', titulo: NOMBRE_LINEA.ADELANTO_Q1, ancho: 'w-28' },
];

/** Panel lateral: boleta preliminar con TODAS las líneas del engine */
function PanelDesglose({
  fila,
  onCerrar,
}: {
  fila: FilaPlanillaDto;
  onCerrar: () => void;
}) {
  const porTipo = (tipo: string) => fila.lineas.filter((l) => l.tipo === tipo);
  const Bloque = ({ titulo, tipo }: { titulo: string; tipo: string }) => {
    const lineas = porTipo(tipo);
    if (lineas.length === 0) {
      return null;
    }
    return (
      <div className="mt-4">
        <h3 className="text-apoyo font-semibold uppercase tracking-wide text-texto-tenue">
          {titulo}
        </h3>
        <ul className="mt-1 space-y-1">
          {lineas.map((l) => (
            <li key={l.codigo} className="flex justify-between text-cuerpo">
              <span className="text-texto-suave">
                {NOMBRE_LINEA[l.codigo] ?? l.codigo}
                {l.cantidad && Number(l.cantidad) > 0 && (
                  <span className="ml-1 text-apoyo text-texto-tenue">({l.cantidad})</span>
                )}
              </span>
              <span className="font-medium text-texto">{soles(l.monto)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <aside className="fixed right-0 top-0 z-40 h-full w-96 overflow-y-auto border-l border-borde bg-superficie p-6 shadow-xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-bold text-texto">
            {fila.apellidos}, {fila.nombres}
          </h2>
          <p className="text-apoyo text-texto-tenue">
            {fila.cargo ?? 'Sin cargo'} · {soles(fila.sueldoBasico)} básico
          </p>
        </div>
        <button type="button" onClick={onCerrar} className="text-texto-tenue hover:text-texto-suave">
          ✕
        </button>
      </div>
      <p className="mt-2 rounded bg-fondo px-2 py-1 text-apoyo text-texto-suave">
        Boleta preliminar · remuneración afecta {soles(fila.remuneracionAfecta)}
      </p>

      <Bloque titulo="Ingresos" tipo="INGRESO" />
      <Bloque titulo="Descuentos" tipo="DESCUENTO" />

      <div className="mt-4 flex justify-between border-t border-borde pt-3">
        <span className="font-semibold text-texto">Neto a pagar</span>
        <span className="font-bold text-primario-oscuro">{soles(fila.totales.netoPagar)}</span>
      </div>

      <Bloque titulo="Aportes del empleador" tipo="APORTE_EMPLEADOR" />
    </aside>
  );
}

/** Confirmación de cierre: resumen en UNA pantalla + advertencias (§13) */
function ModalCierre({
  planilla,
  cerrando,
  onConfirmar,
  onCancelar,
}: {
  planilla: PlanillaPeriodoDto;
  cerrando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-texto/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-tarjeta bg-superficie p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-texto">
          Cerrar {etiquetaPeriodo(planilla.periodo)}
        </h2>
        <p className="mt-1 text-cuerpo text-peligro">
          El cierre es <strong>irreversible</strong>: los cálculos quedan congelados y no
          hay reapertura. Las correcciones se hacen con un periodo de rectificación.
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-control bg-fondo p-3">
            <dt className="text-apoyo text-texto-suave">Trabajadores</dt>
            <dd className="text-lg font-bold text-texto">{planilla.filas.length}</dd>
          </div>
          <div className="rounded-control bg-fondo p-3">
            <dt className="text-apoyo text-texto-suave">Total ingresos</dt>
            <dd className="text-lg font-bold text-texto">
              {soles(planilla.totales.totalIngresos)}
            </dd>
          </div>
          <div className="rounded-control bg-fondo p-3">
            <dt className="text-apoyo text-texto-suave">Total descuentos</dt>
            <dd className="text-lg font-bold text-texto">
              {soles(planilla.totales.totalDescuentos)}
            </dd>
          </div>
          <div className="rounded-control bg-primario-suave p-3">
            <dt className="text-apoyo text-primario">Neto a pagar</dt>
            <dd className="text-lg font-bold text-primario-oscuro">
              {soles(planilla.totales.netoPagar)}
            </dd>
          </div>
          <div className="col-span-2 rounded-control bg-fondo p-3">
            <dt className="text-apoyo text-texto-suave">Aportes del empleador</dt>
            <dd className="text-lg font-bold text-texto">
              {soles(planilla.totales.totalAportesEmpleador)}
            </dd>
          </div>
        </dl>

        {/* Retenciones judiciales: el contador deposita manualmente — aquí
            va el dato exacto de cuánto y a quién (Sesión 16) */}
        {planilla.retencionesJudiciales.length > 0 && (
          <div className="mt-4 rounded-control bg-peligro-suave p-3">
            <p className="text-apoyo font-semibold uppercase text-peligro">
              Depósitos judiciales a realizar ({planilla.retencionesJudiciales.length})
            </p>
            <ul className="mt-1 space-y-1.5 text-cuerpo text-peligro">
              {planilla.retencionesJudiciales.map((r) => (
                <li key={r.personaId}>
                  <strong>{soles(r.monto)}</strong> de {r.apellidos}, {r.nombres} →{' '}
                  {r.beneficiario}
                  {r.bancoDeposito && (
                    <span className="text-peligro">
                      {' '}({r.bancoDeposito} {r.cuentaDeposito ?? 'sin cuenta'})
                    </span>
                  )}
                  <span className="text-apoyo text-peligro"> · Exp. {r.expediente}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {planilla.advertencias.length > 0 && (
          <div className="mt-4 rounded-control bg-advertencia-suave p-3">
            <p className="text-apoyo font-semibold uppercase text-advertencia">
              Advertencias ({planilla.advertencias.length})
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-cuerpo text-advertencia">
              {planilla.advertencias.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={cerrando}
            className="rounded-control bg-peligro px-5 py-2 text-cuerpo font-semibold text-white hover:bg-peligro disabled:opacity-50"
          >
            {cerrando ? 'Cerrando…' : 'Confirmar cierre definitivo'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlanillaGrilla() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);
  /** Ediciones locales pendientes de guardar (clave: personaId|clave) */
  const [borrador, setBorrador] = useState<Record<string, number>>({});
  /** Códigos de la T22 pendientes de guardar, con la misma clave compuesta. */
  const [borradorT22, setBorradorT22] = useState<Record<string, string>>({});
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: planilla, isPending } = useQuery({
    queryKey: ['planilla', id],
    queryFn: () => obtenerPlanilla(id as string),
    enabled: Boolean(id),
  });

  // Asiento contable del cierre (S19): existe solo con el periodo CERRADO
  const { data: asiento } = useQuery({
    queryKey: ['asiento-periodo', id],
    queryFn: () => asientoDePeriodo(id as string),
    enabled: Boolean(id) && planilla?.periodo.estado === 'CERRADO',
  });

  const guardar = useMutation({
    mutationFn: (
      filas: {
        personaId: string;
        variables: Record<string, number>;
        codigosT22?: Record<string, string | null>;
      }[],
    ) => guardarVariables(id as string, { filas } as never),
    onSuccess: (nueva) => {
      queryClient.setQueryData(['planilla', id], nueva);
      setBorrador({});
      setBorradorT22({});
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo guardar'),
  });

  const cerrar = useMutation({
    mutationFn: () => cerrarPeriodo(id as string),
    onSuccess: (nueva) => {
      queryClient.setQueryData(['planilla', id], nueva);
      void queryClient.invalidateQueries({ queryKey: ['periodos'] });
      setConfirmandoCierre(false);
      agregarToast('exito', 'Periodo cerrado: sus cálculos quedaron congelados');
    },
    onError: (e) => {
      setConfirmandoCierre(false);
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo cerrar el periodo');
    },
  });

  const regenerarAsiento = useMutation({
    mutationFn: () => generarAsientoPeriodo(id as string),
    onSuccess: (nuevo) => {
      queryClient.setQueryData(['asiento-periodo', id], nuevo);
      agregarToast('exito', 'Asiento contable generado');
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo generar el asiento'),
  });

  // Recálculo con debounce (~500 ms) tras dejar de teclear
  useEffect(() => {
    if (Object.keys(borrador).length === 0 && Object.keys(borradorT22).length === 0) {
      return;
    }
    if (debounce.current) {
      clearTimeout(debounce.current);
    }
    debounce.current = setTimeout(() => {
      const porPersona = new Map<string, Record<string, number>>();
      const codigosPorPersona = new Map<string, Record<string, string | null>>();
      for (const [clave, valor] of Object.entries(borrador)) {
        const [personaId, variable] = clave.split('|');
        const actual = porPersona.get(personaId) ?? {};
        actual[variable] = valor;
        porPersona.set(personaId, actual);
      }
      // Un código sin su monto no se guarda solo: el backend actualiza la
      // fila de esa clave, así que hay que mandar también el valor vigente.
      for (const [clave, codigo] of Object.entries(borradorT22)) {
        const [personaId, variable] = clave.split('|');
        const codigos = codigosPorPersona.get(personaId) ?? {};
        codigos[variable] = codigo === '' ? null : codigo;
        codigosPorPersona.set(personaId, codigos);

        const actual = porPersona.get(personaId) ?? {};
        if (actual[variable] === undefined) {
          const fila = planilla?.filas.find((f) => f.personaId === personaId);
          actual[variable] = fila?.variables[variable] ?? 0;
          porPersona.set(personaId, actual);
        }
      }
      guardar.mutate(
        [...porPersona.entries()].map(([personaId, variables]) => ({
          personaId,
          variables,
          codigosT22: codigosPorPersona.get(personaId),
        })),
      );
    }, 500);
    return () => {
      if (debounce.current) {
        clearTimeout(debounce.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrador, borradorT22]);

  if (isPending || !planilla) {
    return <SkeletonTabla />;
  }

  const cerrado = planilla.periodo.estado === 'CERRADO';
  const valorCelda = (fila: FilaPlanillaDto, clave: ClaveVariable): number =>
    borrador[`${fila.personaId}|${clave}`] ?? fila.variables[clave] ?? 0;

  const codigoT22De = (fila: FilaPlanillaDto, clave: ClaveVariable): string =>
    borradorT22[`${fila.personaId}|${clave}`] ?? fila.codigosT22?.[clave] ?? '';

  /** Navegación tipo Excel: Enter/flechas mueven entre celdas (Tab es nativo) */
  const alTeclear = (e: React.KeyboardEvent<HTMLInputElement>, f: number, c: number) => {
    const mover = (df: number, dc: number) => {
      e.preventDefault();
      const destino = document.querySelector<HTMLInputElement>(
        `[data-celda="${f + df}-${c + dc}"]`,
      );
      destino?.focus();
      destino?.select();
    };
    // OJO con selectionStart: en un <input type="number"> Chrome devuelve
    // SIEMPRE null (la API de selección no aplica a los inputs numéricos).
    // Comparándolo con la longitud del valor, la condición nunca se cumplía
    // y las flechas laterales no saltaban de celda. Con null se trata la
    // celda como si el cursor estuviera en el borde, que es además lo que
    // hace una hoja de cálculo: la flecha cambia de celda, no de carácter.
    const cursor = e.currentTarget.selectionStart;
    const enElFinal = cursor === null || cursor === e.currentTarget.value.length;
    const enElInicio = cursor === null || cursor === 0;

    if (e.key === 'Enter' || e.key === 'ArrowDown') mover(1, 0);
    else if (e.key === 'ArrowUp') mover(-1, 0);
    else if (e.key === 'ArrowRight' && enElFinal) mover(0, 1);
    else if (e.key === 'ArrowLeft' && enElInicio) mover(0, -1);
  };

  const filaSeleccionada = planilla.filas.find((f) => f.personaId === seleccionada);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-subtitulo font-semibold text-texto">
            {etiquetaPeriodo(planilla.periodo)}
          </h1>
          <p className="text-cuerpo text-texto-tenue">
            {cerrado ? (
              <span className="font-medium text-texto-suave">
                Periodo CERRADO — snapshot inmutable (§4.4)
              </span>
            ) : (
              'Digita solo las variables; el resto lo calcula el sistema'
            )}
            {guardar.isPending && (
              <span className="ml-2 text-primario">· calculando…</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/planillas"
            className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
          >
            ← Periodos
          </Link>
          {!cerrado && (
            <button
              type="button"
              onClick={() => setConfirmandoCierre(true)}
              className="rounded-control bg-peligro px-5 py-2 text-cuerpo font-semibold text-white hover:bg-peligro"
            >
              Cerrar periodo
            </button>
          )}
        </div>
      </div>

      {planilla.advertencias.length > 0 && !cerrado && (
        <div className="rounded-control bg-advertencia-suave px-4 py-2 text-cuerpo text-advertencia">
          {planilla.advertencias.length} advertencia(s) — se detallan al cerrar el periodo.
        </div>
      )}

      {!cerrado && (
        <CodigosT22
          filas={planilla.filas}
          valorCelda={valorCelda}
          codigoDe={codigoT22De}
          alElegir={(personaId, clave, codigo) =>
            setBorradorT22((b) => ({ ...b, [`${personaId}|${clave}`]: codigo }))
          }
        />
      )}

      {cerrado && asiento && (
        <div className="flex items-center justify-between rounded-control bg-exito-suave px-4 py-2 text-cuerpo text-exito">
          <span>
            Asiento contable generado: <strong>{asiento.glosa}</strong> · Debe = Haber ={' '}
            {soles(asiento.totalDebe)}
          </span>
          <Link to="/asientos" className="font-medium text-exito hover:underline">
            Ver en Asientos →
          </Link>
        </div>
      )}
      {cerrado && asiento === null && (
        <div className="flex items-center justify-between gap-3 rounded-control bg-advertencia-suave px-4 py-2 text-cuerpo text-advertencia">
          <span>
            El periodo cerró sin asiento contable (concepto sin mapeo): corrige la
            configuración en{' '}
            <Link to="/asientos/configuracion" className="font-medium hover:underline">
              Asientos → Configuración
            </Link>{' '}
            e inténtalo de nuevo.
          </span>
          <button
            type="button"
            onClick={() => regenerarAsiento.mutate()}
            disabled={regenerarAsiento.isPending}
            className="shrink-0 rounded-control border border-advertencia px-3 py-1 text-apoyo font-medium text-advertencia hover:bg-advertencia-suave disabled:opacity-50"
          >
            {regenerarAsiento.isPending ? 'Generando…' : 'Generar asiento'}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
        <table className="w-full border-collapse text-cuerpo">
          <thead className="sticky top-0 bg-fondo text-apoyo uppercase text-texto-suave">
            <tr>
              <th className="sticky left-0 z-10 border-b border-borde bg-fondo px-3 py-2 text-left">
                Trabajador
              </th>
              {COLUMNAS.map((c) => (
                <th key={c.clave} className="border-b border-borde px-2 py-2 text-center">
                  {c.titulo}
                </th>
              ))}
              <th className="cifras border-b border-borde bg-fondo px-3 py-2 text-right">Ingresos</th>
              <th className="cifras border-b border-borde bg-fondo px-3 py-2 text-right">Dsctos.</th>
              <th className="cifras border-b border-borde bg-fondo px-3 py-2 text-right">Neto</th>
            </tr>
          </thead>
          <tbody>
            {planilla.filas.map((f, indiceFila) => (
              <tr key={f.personaId} className="hover:bg-fondo/60">
                <td className="sticky left-0 z-10 border-b border-borde bg-superficie px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => setSeleccionada(f.personaId)}
                    className="text-left font-medium text-texto hover:text-primario-oscuro"
                  >
                    {f.apellidos}, {f.nombres}
                  </button>
                  <div className="flex flex-wrap gap-1">
                    {f.tienePrestamo && (
                      <span className="rounded bg-primario-suave px-1.5 text-[10px] font-medium text-acento">
                        préstamo
                      </span>
                    )}
                    {f.tieneRetencionJudicial && (
                      <span className="rounded bg-peligro-suave px-1.5 text-[10px] font-medium text-peligro">
                        judicial
                      </span>
                    )}
                    {f.tieneSubsidio && (
                      <span className="rounded bg-info-suave px-1.5 text-[10px] font-medium text-info">
                        subsidio
                      </span>
                    )}
                    {f.esJubilado && (
                      <span className="rounded bg-borde px-1.5 text-[10px] font-medium text-texto-suave">
                        jubilado
                      </span>
                    )}
                  </div>
                </td>

                {COLUMNAS.map((c, indiceCol) => (
                  <td key={c.clave} className="border-b border-borde p-0">
                    <input
                      type="number"
                      inputMode="decimal"
                      step={CLAVES_MONTO.includes(c.clave) ? '0.01' : '1'}
                      min={0}
                      disabled={cerrado}
                      data-celda={`${indiceFila}-${indiceCol}`}
                      value={valorCelda(f, c.clave)}
                      onFocus={(e) => e.currentTarget.select()}
                      onKeyDown={(e) => alTeclear(e, indiceFila, indiceCol)}
                      onChange={(e) =>
                        setBorrador((b) => ({
                          ...b,
                          [`${f.personaId}|${c.clave}`]: Number(e.target.value || 0),
                        }))
                      }
                      className={`${c.ancho} border-0 px-2 py-1.5 text-center cifras focus:bg-primario-suave focus:outline focus:outline-2 focus:outline-primario disabled:bg-fondo disabled:text-texto-tenue`}
                    />
                  </td>
                ))}

                <td className="border-b border-borde bg-fondo px-3 py-1.5 text-right text-texto-suave cifras">
                  {soles(f.totales.totalIngresos)}
                </td>
                <td className="border-b border-borde bg-fondo px-3 py-1.5 text-right text-texto-suave cifras">
                  {soles(f.totales.totalDescuentos)}
                </td>
                <td className="border-b border-borde bg-fondo px-3 py-1.5 text-right font-semibold text-texto cifras">
                  {soles(f.totales.netoPagar)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-fondo font-semibold text-texto">
              <td className="sticky left-0 z-10 bg-fondo px-3 py-2">
                Totales ({planilla.filas.length})
              </td>
              <td colSpan={COLUMNAS.length} className="cifras px-2 py-2 text-right text-apoyo font-normal text-texto-suave">
                Aportes del empleador: {soles(planilla.totales.totalAportesEmpleador)}
              </td>
              <td className="cifras px-3 py-2 text-right">{soles(planilla.totales.totalIngresos)}</td>
              <td className="cifras px-3 py-2 text-right">{soles(planilla.totales.totalDescuentos)}</td>
              <td className="cifras px-3 py-2 text-right text-primario-oscuro">
                {soles(planilla.totales.netoPagar)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {filaSeleccionada && (
        <PanelDesglose fila={filaSeleccionada} onCerrar={() => setSeleccionada(null)} />
      )}
      {confirmandoCierre && (
        <ModalCierre
          planilla={planilla}
          cerrando={cerrar.isPending}
          onConfirmar={() => cerrar.mutate()}
          onCancelar={() => setConfirmandoCierre(false)}
        />
      )}
    </div>
  );
}


// ---------------------------------------------------------------------
// Códigos de la tabla 22 para lo que el sistema no puede clasificar solo
// ---------------------------------------------------------------------

/**
 * Tres conceptos —ingreso afecto, no afecto y descuento voluntario— no
 * tienen un código único en la T22 de SUNAT: depende de QUÉ se pagó o
 * descontó, y eso solo lo sabe quien lo digitó. Sin código, esa línea se
 * omite del archivo del PLAME con aviso; nunca se adivina uno.
 *
 * Va en un panel bajo la tabla y no dentro de la celda a propósito: la
 * grilla es una hoja de cálculo con navegación por teclado, y meterle un
 * buscador dentro rompería justo lo que la hace rápida. Aquí, además,
 * todo lo pendiente se ve junto.
 */
function CodigosT22({
  filas,
  valorCelda,
  codigoDe,
  alElegir,
}: {
  filas: FilaPlanillaDto[];
  valorCelda: (f: FilaPlanillaDto, c: ClaveVariable) => number;
  codigoDe: (f: FilaPlanillaDto, c: ClaveVariable) => string;
  alElegir: (personaId: string, clave: ClaveVariable, codigo: string) => void;
}) {
  const { data: catalogo } = useQuery({
    queryKey: ['conceptos-t22'],
    queryFn: () => conceptosT22(),
  });

  const pendientes = filas.flatMap((f) =>
    CLAVES_CON_CODIGO_T22.filter((c) => valorCelda(f, c) > 0).map((clave) => ({
      fila: f,
      clave,
      monto: valorCelda(f, clave),
    })),
  );

  if (pendientes.length === 0 || !catalogo) {
    return null;
  }

  const ingresos = catalogo.filter(
    (c: ConceptoT22Dto) => c.tipo === 'INGRESO' && c.activo,
  );
  const descuentos = catalogo.filter(
    (c: ConceptoT22Dto) => c.tipo === 'DESCUENTO' && c.activo,
  );
  const sinClasificar = pendientes.filter(
    ({ fila, clave }) => !codigoDe(fila, clave),
  ).length;

  return (
    <section className="rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
      <h2 className="text-seccion font-semibold text-texto">Códigos para el PLAME</h2>
      <p className="mt-1 max-w-3xl text-apoyo text-texto-suave">
        Estos conceptos no tienen un código único en la tabla 22 de SUNAT: depende de qué
        se pagó o descontó. Elígelo aquí y se declarará solo en el archivo. Si lo dejas en
        blanco, la línea se omite del PLAME y tendrás que escribirla a mano en el PDT.
        {sinClasificar > 0 && (
          <strong className="ml-1 text-advertencia">
            Faltan {sinClasificar} por clasificar.
          </strong>
        )}
      </p>

      <ul className="mt-4 space-y-3">
        {pendientes.map(({ fila, clave, monto }) => {
          const codigo = codigoDe(fila, clave);
          const esDescuento = clave === 'DSCTO_VOLUNTARIO';
          return (
            <li
              key={`${fila.personaId}|${clave}`}
              className="flex flex-wrap items-center gap-3 border-b border-borde pb-3 last:border-0"
            >
              <span className="min-w-52 text-cuerpo text-texto">
                {fila.apellidos}, {fila.nombres}
              </span>
              <span className="min-w-44 text-apoyo text-texto-suave">
                {NOMBRE_LINEA[clave]} · {soles(String(monto))}
              </span>

              {esDescuento ? (
                // Solo hay dos opciones y ninguna por defecto: "deducible"
                // cambia la base imponible declarada, y elegir por el
                // contador sería equivocarse la mitad de las veces.
                <fieldset className="flex items-center gap-4">
                  <legend className="sr-only">
                    Tipo de descuento para {fila.apellidos}
                  </legend>
                  {descuentos.map((d: ConceptoT22Dto) => (
                    <label
                      key={d.codigo}
                      className="flex items-center gap-1.5 text-apoyo text-texto"
                    >
                      <input
                        type="radio"
                        name={`dscto-${fila.personaId}`}
                        checked={codigo === d.codigo}
                        onChange={() => alElegir(fila.personaId, clave, d.codigo)}
                      />
                      {d.codigo} — {d.codigo === '707' ? 'deducible' : 'no deducible'}
                    </label>
                  ))}
                </fieldset>
              ) : (
                <select
                  aria-label={`Código de la tabla 22 para ${fila.apellidos}`}
                  value={codigo}
                  onChange={(e) => alElegir(fila.personaId, clave, e.target.value)}
                  className="max-w-xl flex-1 rounded-control border border-borde-fuerte px-3 py-1.5 text-apoyo focus:border-primario focus:outline-none"
                >
                  <option value="">Sin clasificar — se omitirá del PLAME</option>
                  {ingresos
                    // El selector solo ofrece códigos con la MISMA
                    // afectación que la clave digitada: un ingreso afecto
                    // no debería declararse con un código no afecto.
                    .filter(
                      (c: ConceptoT22Dto) => c.afecto === (clave === 'ING_AFECTO'),
                    )
                    .map((c: ConceptoT22Dto) => (
                      <option key={c.codigo} value={c.codigo}>
                        {c.codigo} — {c.descripcion}
                      </option>
                    ))}
                </select>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
