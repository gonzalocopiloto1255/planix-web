import { SkeletonTabla } from '../componentes/ui';
import type {
  CuotaVentaInput,
  PeriodoVacacionalDto,
  VacacionesPersonaDto,
} from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { soles } from '../lib/planillas';
import { generarPeriodos, registrarVenta, vacacionesEmpresa } from '../lib/vacaciones';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

const SEMAFORO: Record<string, { clase: string; texto: string }> = {
  VIGENTE: { clase: 'bg-exito-suave text-exito', texto: 'Vigente' },
  POR_VENCER: { clase: 'bg-advertencia-suave text-advertencia', texto: 'Por vencer' },
  VENCIDO: { clase: 'bg-peligro-suave text-peligro', texto: 'Vencido' },
};

function Periodo({
  periodo,
  gerente,
}: {
  periodo: PeriodoVacacionalDto;
  gerente: boolean;
}) {
  // El gerente decide su descanso: sus vencidos no generan indemnización (§8.3)
  const semaforo =
    periodo.estado === 'VENCIDO' && gerente
      ? { clase: 'bg-fondo text-texto-suave', texto: 'Decide su descanso' }
      : SEMAFORO[periodo.estado];

  return (
    <tr className="border-b border-borde text-cuerpo last:border-0">
      <td className="px-3 py-2 font-medium text-texto">{periodo.etiqueta}</td>
      <td className="px-3 py-2 text-texto-suave">
        {periodo.inicio} → {periodo.fin}
      </td>
      <td className="px-3 py-2 text-center">{periodo.diasDerecho}</td>
      <td className="px-3 py-2 text-center">{periodo.diasGozados}</td>
      <td className="px-3 py-2 text-center">{periodo.diasVendidos}</td>
      <td className="px-3 py-2 text-center font-semibold text-texto">
        {periodo.saldoPendiente}
      </td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-apoyo font-medium ${semaforo.clase}`}>
          {semaforo.texto}
        </span>
        <p className="text-apoyo text-texto-tenue">
          {periodo.diasParaVencer >= 0
            ? `vence el ${periodo.venceEl} (${periodo.diasParaVencer} días)`
            : `venció el ${periodo.venceEl}`}
        </p>
      </td>
    </tr>
  );
}

/** Modal de VENTA: cronograma + banner legal con confirmación obligatoria (§8.3) */
function ModalVenta({
  persona,
  onCerrar,
}: {
  persona: VacacionesPersonaDto;
  onCerrar: () => void;
}) {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);

  const conSaldo = persona.periodos.filter((p) => Number(p.saldoPendiente) > 0);
  const [periodoId, setPeriodoId] = useState(conSaldo[0]?.id ?? '');
  const [dias, setDias] = useState(Math.min(persona.maximoVenta, Number(conSaldo[0]?.saldoPendiente ?? 0)));
  const [numeroCuotas, setNumeroCuotas] = useState(1);
  const [fechaAcuerdo, setFechaAcuerdo] = useState(new Date().toISOString().slice(0, 10));
  const [documentoRef, setDocumentoRef] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [montoEditado, setMontoEditado] = useState<string | null>(null);

  const valorDia = Number(persona.remuneracionComputable) / 30;
  const montoCalculado = (valorDia * dias).toFixed(2);
  const montoTotal = montoEditado ?? montoCalculado;
  const excede = dias > persona.maximoVenta;

  // Cronograma: cuotas iguales desde el mes siguiente (la última ajusta el resto)
  const construirCuotas = (): CuotaVentaInput[] => {
    const total = Number(montoTotal);
    const base = Math.floor((total / numeroCuotas) * 100) / 100;
    const hoy = new Date();
    return Array.from({ length: numeroCuotas }, (_, i) => {
      const fecha = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1 + i, 1));
      const monto = i === numeroCuotas - 1
        ? (total - base * (numeroCuotas - 1)).toFixed(2)
        : base.toFixed(2);
      return {
        anio: fecha.getUTCFullYear(),
        mes: fecha.getUTCMonth() + 1,
        monto,
      };
    });
  };
  const cuotas = construirCuotas();

  const vender = useMutation({
    mutationFn: () =>
      registrarVenta(empresa.id as string, persona.personaId, {
        periodoVacacionalId: periodoId,
        diasVendidos: dias,
        montoTotal,
        fechaAcuerdo,
        cuotas,
        confirmarOverride: excede ? confirmado : undefined,
        documentoRef: documentoRef || undefined,
      }),
    onSuccess: (r) => {
      agregarToast('exito', `Venta de ${dias} días registrada`);
      for (const a of r.advertencias) {
        agregarToast('advertencia', a);
      }
      void queryClient.invalidateQueries({ queryKey: ['vacaciones'] });
      onCerrar();
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo registrar la venta'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-texto/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-tarjeta bg-superficie p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-texto">
          Vender vacaciones · {persona.apellidos}, {persona.nombres}
        </h2>
        <p className="mt-1 text-apoyo text-texto-suave">
          Reducción del descanso (D.Leg. 713 art. 19) · máximo legal:{' '}
          <strong>{persona.maximoVenta} días</strong> · remuneración diaria{' '}
          {soles(valorDia.toFixed(2))}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="periodo" className="block text-apoyo text-texto-suave">
              Periodo vacacional
            </label>
            <select
              id="periodo"
              value={periodoId}
              onChange={(e) => setPeriodoId(e.target.value)}
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            >
              {conSaldo.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.etiqueta} — saldo {p.saldoPendiente} días
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="dias" className="block text-apoyo text-texto-suave">Días a vender</label>
              <input
                id="dias"
                type="number"
                min={1}
                value={dias}
                onChange={(e) => {
                  setDias(Number(e.target.value));
                  setMontoEditado(null);
                }}
                className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
              />
            </div>
            <div>
              <label htmlFor="monto" className="block text-apoyo text-texto-suave">
                Monto total (editable)
              </label>
              <input
                id="monto"
                value={montoTotal}
                onChange={(e) => setMontoEditado(e.target.value)}
                className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
              />
            </div>
            <div>
              <label htmlFor="fecha" className="block text-apoyo text-texto-suave">Fecha del acuerdo</label>
              <input
                id="fecha"
                type="date"
                value={fechaAcuerdo}
                onChange={(e) => setFechaAcuerdo(e.target.value)}
                className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cuotas" className="block text-apoyo text-texto-suave">
              Pago en cuotas (se cobran al cerrar cada planilla)
            </label>
            <input
              id="cuotas"
              type="number"
              min={1}
              max={24}
              value={numeroCuotas}
              onChange={(e) => setNumeroCuotas(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-24 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
            <ul className="mt-2 space-y-1 text-apoyo text-texto-suave">
              {cuotas.map((c, i) => (
                <li key={i}>
                  Cuota {i + 1}: {String(c.mes).padStart(2, '0')}/{c.anio} ·{' '}
                  {soles(c.monto)}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="doc" className="block text-apoyo text-texto-suave">
              Referencia del acuerdo escrito (opcional)
            </label>
            <input
              id="doc"
              value={documentoRef}
              onChange={(e) => setDocumentoRef(e.target.value)}
              placeholder="Acuerdo 001-2026"
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
          </div>
        </div>

        {excede && (
          <div className="mt-4 rounded-control border-2 border-peligro bg-peligro-suave p-3">
            <p className="text-cuerpo font-semibold text-peligro">
              Esta venta excede el máximo legal de {persona.maximoVenta} días
            </p>
            <p className="mt-1 text-apoyo text-peligro">
              Según el art. 19 del D.Leg. 713 el trabajador debe gozar al menos{' '}
              {persona.maximoVenta} días de descanso físico. El acuerdo podría ser
              observado por SUNAFIL. La operación quedará registrada en la auditoría.
            </p>
            <label className="mt-2 flex items-start gap-2 text-apoyo font-medium text-peligro">
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
                className="mt-0.5"
              />
              Confirmo que existe acuerdo escrito con el trabajador y asumo la observación
            </label>
          </div>
        )}

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
            onClick={() => vender.mutate()}
            disabled={vender.isPending || !periodoId || dias <= 0 || (excede && !confirmado)}
            className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
          >
            {vender.isPending ? 'Registrando…' : 'Registrar venta'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Vacaciones() {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [vendiendo, setVendiendo] = useState<VacacionesPersonaDto | null>(null);

  const { data: personas, isPending } = useQuery({
    queryKey: ['vacaciones', empresa.id],
    queryFn: () => vacacionesEmpresa(empresa.id as string),
    enabled: Boolean(empresa.id),
  });

  const generar = useMutation({
    mutationFn: () => generarPeriodos(empresa.id as string),
    onSuccess: (r) => {
      agregarToast(
        'exito',
        r.creados > 0
          ? `${r.creados} periodo(s) vacacionales generados`
          : 'No hay aniversarios nuevos que registrar',
      );
      void queryClient.invalidateQueries({ queryKey: ['vacaciones'] });
    },
  });

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <h1 className="text-subtitulo font-semibold text-texto">Elige la empresa activa</h1>
        <p className="mt-2 text-cuerpo text-texto-suave">
          Las vacaciones se llevan por empresa.{' '}
          <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-subtitulo font-semibold text-texto">
          Vacaciones · <span className="text-texto-tenue">{empresa.razonSocial}</span>
        </h1>
        <button
          type="button"
          onClick={() => generar.mutate()}
          disabled={generar.isPending}
          className="rounded-control border border-primario px-4 py-2 text-cuerpo font-semibold text-primario-oscuro hover:bg-primario-suave disabled:opacity-50"
        >
          {generar.isPending ? 'Generando…' : 'Generar periodos por aniversario'}
        </button>
      </div>

      {isPending && <SkeletonTabla />}

      <div className="space-y-3">
        {personas?.map((p) => {
          const vencidos = p.periodos.filter((x) => x.estado === 'VENCIDO').length;
          const porVencer = p.periodos.filter((x) => x.estado === 'POR_VENCER').length;
          const abierta = expandida === p.personaId;
          return (
            <div key={p.personaId} className="rounded-tarjeta bg-superficie shadow-tarjeta">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setExpandida(abierta ? null : p.personaId)}
                  className="text-left"
                >
                  <p className="font-medium text-texto">
                    {p.apellidos}, {p.nombres}
                    {p.gerenteDecideVacaciones && (
                      <span className="ml-2 rounded bg-fondo px-1.5 py-0.5 text-apoyo text-texto-suave">
                        decide su descanso
                      </span>
                    )}
                  </p>
                  <p className="text-apoyo text-texto-tenue">
                    {p.numeroDocumento} · saldo total {p.saldoTotal} días
                    {vencidos > 0 && !p.gerenteDecideVacaciones && (
                      <span className="ml-1 font-medium text-peligro">
                        · {vencidos} periodo(s) vencido(s) — indemnización estimada{' '}
                        {soles(p.indemnizacionEstimada)}
                      </span>
                    )}
                    {porVencer > 0 && (
                      <span className="ml-1 font-medium text-advertencia">
                        · {porVencer} por vencer
                      </span>
                    )}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  {Number(p.saldoVentasPorPagar) > 0 && (
                    <span className="rounded-control bg-primario-suave px-2.5 py-1 text-apoyo font-medium text-acento">
                      venta por pagar {soles(p.saldoVentasPorPagar)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setVendiendo(p)}
                    disabled={Number(p.saldoTotal) <= 0}
                    className="rounded-control border border-borde-fuerte px-3 py-1.5 text-apoyo text-texto-suave hover:bg-fondo disabled:opacity-40"
                  >
                    Vender días
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandida(abierta ? null : p.personaId)}
                    className="rounded-control border border-borde-fuerte px-3 py-1.5 text-apoyo text-texto-suave hover:bg-fondo"
                  >
                    {abierta ? 'Ocultar' : 'Ver periodos'}
                  </button>
                </div>
              </div>

              {abierta && (
                <div className="border-t border-borde px-4 py-3">
                  <table className="w-full text-left">
                    <thead className="text-apoyo uppercase text-texto-tenue">
                      <tr>
                        <th className="px-3 py-2">Periodo</th>
                        <th className="px-3 py-2">Rango</th>
                        <th className="px-3 py-2 text-center">Derecho</th>
                        <th className="px-3 py-2 text-center">Gozados</th>
                        <th className="px-3 py-2 text-center">Vendidos</th>
                        <th className="px-3 py-2 text-center">Saldo</th>
                        <th className="px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.periodos.map((periodo) => (
                        <Periodo
                          key={periodo.id}
                          periodo={periodo}
                          gerente={p.gerenteDecideVacaciones}
                        />
                      ))}
                    </tbody>
                  </table>

                  {p.ventas.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-apoyo font-semibold uppercase text-texto-tenue">
                        Ventas registradas
                      </h3>
                      <ul className="mt-1 space-y-1 text-cuerpo">
                        {p.ventas.map((v) => (
                          <li key={v.id} className="rounded-control bg-fondo px-3 py-2">
                            <span className="font-medium text-texto">
                              {v.diasVendidos} días del {v.periodoVacacionalEtiqueta}
                            </span>{' '}
                            · {soles(v.montoTotal)} · saldo por pagar{' '}
                            {soles(v.saldoPorPagar)}
                            {v.excedeLimiteLegal && (
                              <span className="ml-2 rounded bg-peligro-suave px-1.5 py-0.5 text-apoyo font-medium text-peligro">
                                excede el límite legal (override auditado)
                              </span>
                            )}
                            <p className="text-apoyo text-texto-tenue">
                              {v.cuotas.length} cuota(s):{' '}
                              {v.cuotas
                                .map(
                                  (c) =>
                                    `${String(c.mes).padStart(2, '0')}/${c.anio} ${soles(c.monto)}${c.pagadaEn ? ' ✓' : ''}`,
                                )
                                .join(' · ')}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-4">
                    <h3 className="text-apoyo font-semibold uppercase text-texto-tenue">
                      Línea de tiempo
                    </h3>
                    <ol className="mt-1 space-y-1 border-l-2 border-primario-suave pl-4 text-cuerpo">
                      {p.periodos.flatMap((periodo) =>
                        periodo.movimientos.map((m) => (
                          <li key={m.id} className="relative">
                            <span className="absolute -left-[1.35rem] top-2 h-2 w-2 rounded-full bg-primario" />
                            <span className="text-texto-suave">{m.fecha}</span> ·{' '}
                            <span className="font-medium text-texto">{m.tipo}</span>{' '}
                            {m.dias} días
                            {m.glosa && (
                              <span className="text-apoyo text-texto-tenue"> — {m.glosa}</span>
                            )}
                          </li>
                        )),
                      )}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {vendiendo && (
        <ModalVenta persona={vendiendo} onCerrar={() => setVendiendo(null)} />
      )}
    </div>
  );
}
