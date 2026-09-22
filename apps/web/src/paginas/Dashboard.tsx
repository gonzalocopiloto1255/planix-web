import type { PeriodoDto } from '@planix/shared-types';
import { CUENTA, LECTURA, puede } from '@planix/shared-types';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarPlus,
  CircleCheck,
  FileBarChart,
  Minus,
  Receipt,
  Table2,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Badge,
  BotonEnlace,
  CabeceraPagina,
  CabeceraTarjeta,
  Skeleton,
  Tabla,
  Tarjeta,
  Td,
  Th,
  Tr,
  Vacio,
  cx,
  soles,
} from '../componentes/ui';
import {
  COLOR_URGENCIA,
  NOMBRE_URGENCIA,
  obtenerResumenAlertas,
  textoPlazo,
} from '../lib/alertas';
import { listarEmpresas } from '../lib/empresas';
import { listarPersonas } from '../lib/personas';
import { etiquetaPeriodo, listarPeriodos, obtenerPlanilla } from '../lib/planillas';
import { comparativoMensual } from '../lib/reportes';
import { resumenRespaldo } from '../lib/seguridad';
import { useAuth } from '../stores/auth';
import { useEmpresaActiva } from '../stores/empresaActiva';

// =====================================================================
// Panel del contador.
//
// Responde de un vistazo a "¿qué tengo que hacer hoy?": el tamaño del
// estudio, lo que vence, las tareas frecuentes y los últimos periodos
// cerrados. Todo sale de endpoints que ya existían — esta pantalla no
// añadió ni un contrato de API nuevo.
//
// Cuando hay EMPRESA ACTIVA las métricas son de esa empresa; cuando no,
// del estudio completo (el resumen de respaldo ya da esos totales).
// =====================================================================

/** Cuántos periodos cerrados se listan abajo. */
const ULTIMOS_PERIODOS = 5;

function Metrica({
  etiqueta,
  valor,
  Icono,
  variacion,
  detalle,
  cargando,
}: {
  etiqueta: string;
  valor: string;
  Icono: LucideIcon;
  /** % vs. el periodo anterior; null cuando no hay con qué comparar */
  variacion?: number | null;
  detalle?: string;
  cargando?: boolean;
}) {
  return (
    <Tarjeta className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-apoyo font-medium text-texto-suave">{etiqueta}</p>
        <span className="grid size-9 shrink-0 place-items-center rounded-control bg-primario-suave text-primario">
          <Icono className="size-4.5" />
        </span>
      </div>
      {cargando ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className="cifras mt-2 text-2xl font-semibold tracking-tight text-texto">
          {valor}
        </p>
      )}
      {variacion !== undefined && variacion !== null && (
        <p
          className={cx(
            'mt-1.5 inline-flex items-center gap-1 text-apoyo font-medium',
            variacion > 0
              ? 'text-advertencia'
              : variacion < 0
                ? 'text-exito'
                : 'text-texto-tenue',
          )}
        >
          {variacion > 0 ? (
            <ArrowUpRight className="size-3.5" />
          ) : variacion < 0 ? (
            <ArrowDownRight className="size-3.5" />
          ) : (
            <Minus className="size-3.5" />
          )}
          <span className="cifras">
            {variacion > 0 ? '+' : ''}
            {variacion.toFixed(1)}%
          </span>
          <span className="font-normal text-texto-tenue">vs. periodo anterior</span>
        </p>
      )}
      {detalle && !variacion && (
        <p className="mt-1.5 text-apoyo text-texto-tenue">{detalle}</p>
      )}
    </Tarjeta>
  );
}

function AccionesRapidas({ empresaId }: { empresaId: string | null }) {
  return (
    <Tarjeta>
      <CabeceraTarjeta titulo="Acciones rápidas" />
      <div className="flex flex-wrap gap-2 p-5">
        <BotonEnlace
          a="/planillas"
          iconoIzquierda={<CalendarPlus className="size-4" />}
        >
          Abrir periodo
        </BotonEnlace>
        <BotonEnlace
          a={empresaId ? '/personas/nueva' : '/personas'}
          iconoIzquierda={<UserPlus className="size-4" />}
        >
          Registrar persona
        </BotonEnlace>
        <BotonEnlace a="/reportes" iconoIzquierda={<FileBarChart className="size-4" />}>
          Ver reportes
        </BotonEnlace>
      </div>
    </Tarjeta>
  );
}

function LoQueVence() {
  const rol = useAuth((s) => s.sesion?.usuario.rol);
  const { data: resumen, isLoading } = useQuery({
    queryKey: ['alertas-resumen'],
    queryFn: obtenerResumenAlertas,
    enabled: puede(rol, LECTURA),
    staleTime: 60_000,
  });

  return (
    <Tarjeta>
      <CabeceraTarjeta
        titulo="Lo que vence pronto"
        descripcion={
          resumen?.ultimaRevision
            ? `Última revisión: ${resumen.ultimaRevision}`
            : undefined
        }
        accion={
          resumen && resumen.pendientes > 0 ? (
            <Link
              to="/alertas"
              className="transicion text-apoyo font-medium text-primario hover:underline"
            >
              Ver todas ({resumen.pendientes})
            </Link>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !resumen || resumen.masUrgentes.length === 0 ? (
        <Vacio
          icono={<CircleCheck className="size-6" />}
          titulo="Nada pendiente"
          descripcion="No hay vencimientos próximos en tus empresas. Las alertas se recalculan cada mañana."
        />
      ) : (
        <ul className="divide-y divide-borde">
          {resumen.masUrgentes.map((alerta) => (
            <li
              key={alerta.id}
              className="transicion flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-fondo"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Badge
                  tono={
                    alerta.urgencia === 'VENCIDA'
                      ? 'peligro'
                      : alerta.urgencia === 'CRITICA'
                        ? 'advertencia'
                        : alerta.urgencia === 'PROXIMA'
                          ? 'info'
                          : 'neutro'
                  }
                  className={COLOR_URGENCIA[alerta.urgencia]}
                >
                  {NOMBRE_URGENCIA[alerta.urgencia]}
                </Badge>
                <span className="truncate text-cuerpo text-texto">
                  {alerta.titulo}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-apoyo text-texto-tenue">
                  {textoPlazo(alerta)}
                </span>
                <Link
                  to={alerta.enlace}
                  className="transicion text-apoyo font-medium text-primario hover:underline"
                >
                  Atender
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

function UltimosPeriodos({
  periodos,
  cargando,
  totalesPorPeriodo,
}: {
  periodos: PeriodoDto[];
  cargando: boolean;
  totalesPorPeriodo: Map<string, string>;
}) {
  return (
    <Tarjeta>
      <CabeceraTarjeta
        titulo="Últimos periodos cerrados"
        accion={
          <Link
            to="/planillas"
            className="transicion text-apoyo font-medium text-primario hover:underline"
          >
            Ver planillas
          </Link>
        }
      />
      {cargando ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : periodos.length === 0 ? (
        <Vacio
          icono={<Table2 className="size-6" />}
          titulo="Todavía no hay periodos cerrados"
          descripcion="Cuando cierres tu primera planilla, aquí verás el histórico con su neto total."
          accion={
            <BotonEnlace a="/planillas" variante="primario">
              Abrir un periodo
            </BotonEnlace>
          }
        />
      ) : (
        <Tabla>
          <thead>
            <tr>
              <Th>Periodo</Th>
              <Th>Cerrado el</Th>
              <Th numerico>Neto a pagar</Th>
              <Th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {periodos.map((p) => (
              <Tr key={p.id}>
                <Td className="font-medium">{etiquetaPeriodo(p)}</Td>
                <Td calculado>
                  {p.cerradoEn ? p.cerradoEn.slice(0, 10).split('-').reverse().join('/') : '—'}
                </Td>
                <Td numerico>
                  {totalesPorPeriodo.has(p.id) ? (
                    soles(totalesPorPeriodo.get(p.id) as string)
                  ) : (
                    <Skeleton className="ml-auto h-4 w-20" />
                  )}
                </Td>
                <Td>
                  <Link
                    to={`/planillas/${p.id}`}
                    className="transicion text-apoyo font-medium text-primario hover:underline"
                  >
                    Boletas
                  </Link>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </Tarjeta>
  );
}

export function Dashboard() {
  const sesion = useAuth((s) => s.sesion);
  const empresaActiva = useEmpresaActiva();
  // La pregunta correcta NO es «¿es contador?» sino «¿tiene tenant?».
  // Escrita como estaba —ADMINISTRADOR u OPERADOR— dejaba fuera al
  // TITULAR, que es el rol que recibe QUIEN SE REGISTRA
  // (`auth.service.ts`), y también a PERSONAL y SOLO_LECTURA: tres de
  // los cinco roles del tenant aterrizaban en el panel de plataforma al
  // iniciar sesión, con el texto de administrar estudios contables.
  const rol = sesion?.usuario.rol;
  const esPlataforma = rol === 'SUPERADMIN';

  const { data: empresas, isLoading: cargandoEmpresas } = useQuery({
    queryKey: ['empresas', '', false],
    queryFn: () => listarEmpresas(),
    enabled: puede(rol, LECTURA),
  });

  // Totales del estudio: los da el resumen de respaldo, que ya existía
  const { data: resumenEstudio } = useQuery({
    queryKey: ['respaldo-resumen'],
    queryFn: resumenRespaldo,
    // `respaldo/resumen` es CUENTA: solo el TITULAR. Estaba justo al
    // revés —se disparaba para los dos roles que la API rechaza y se
    // apagaba para el único que la permite—, así que dejaba 403 en la
    // consola y el total del estudio siempre en cero.
    enabled: puede(rol, CUENTA),
  });

  const { data: personas } = useQuery({
    queryKey: ['personas', empresaActiva.id],
    queryFn: () => listarPersonas(empresaActiva.id as string, {}),
    enabled: puede(rol, LECTURA) && Boolean(empresaActiva.id),
  });

  const { data: periodos, isLoading: cargandoPeriodos } = useQuery({
    queryKey: ['periodos', empresaActiva.id],
    queryFn: () => listarPeriodos(empresaActiva.id as string),
    enabled: puede(rol, LECTURA) && Boolean(empresaActiva.id),
  });

  const { data: alertas } = useQuery({
    queryKey: ['alertas-resumen'],
    queryFn: obtenerResumenAlertas,
    enabled: puede(rol, LECTURA),
    staleTime: 60_000,
  });

  // Cerrados, del más reciente al más antiguo
  const cerrados = (periodos ?? [])
    .filter((p) => p.estado === 'CERRADO')
    .sort((a, b) => b.fechaFin.localeCompare(a.fechaFin))
    .slice(0, ULTIMOS_PERIODOS);

  // El neto de cada periodo vive en su planilla: se piden en paralelo
  const planillas = useQueries({
    queries: cerrados.map((p) => ({
      queryKey: ['planilla', p.id],
      queryFn: () => obtenerPlanilla(p.id),
      staleTime: 300_000,
    })),
  });

  const totalesPorPeriodo = new Map<string, string>();
  planillas.forEach((consulta, i) => {
    if (consulta.data) {
      totalesPorPeriodo.set(cerrados[i].id, consulta.data.totales.netoPagar);
    }
  });

  // ===================================================================
  // EL COSTO LABORAL LO CALCULA LA API, NO ESTA PANTALLA.
  //
  // Aquí vivía su propia fórmula —`netoPagar + totalAportesEmpleador`—
  // mientras la API ya exponía `costoLaboral` como **ingresos + aportes**
  // (`MesComparativoDto`, shared-types). Dos fórmulas con el mismo nombre
  // y, en enero de la demo, dos números: 31,765.27 aquí frente a
  // 36,038.33 en el gráfico de Reportes y en el asiento contable.
  //
  // No era desconocimiento, era DUPLICACIÓN: la buena estaba escrita y
  // documentada, y esta pantalla se hizo la suya. Por eso la corrección
  // no es arreglar el signo sino **dejar de calcular aquí**.
  //
  // El costo laboral es lo que la empresa carga a GASTO: el bruto más sus
  // aportes. Los descuentos del trabajador no lo reducen —la empresa los
  // desembolsa igual, solo que los remite a terceros—; si los restara, un
  // trabajador en ONP «costaría» menos que otro en AFP con el mismo
  // sueldo, y a quien empezara a pagar un préstamo por planilla le bajaría
  // el costo.
  //
  // La variación viene también de la API (`variacionPorcentaje`), por lo
  // mismo: calcularla aquí sobre otra base era el efecto de segundo orden
  // del mismo defecto.
  //
  // Se piden 2 meses porque la tarjeta solo enseña el último y su
  // variación contra el anterior; la serie larga es cosa de Reportes.
  const { data: comparativo } = useQuery({
    queryKey: ['comparativo-dashboard', empresaActiva.id],
    queryFn: () => comparativoMensual(empresaActiva.id as string, 2),
    enabled: puede(rol, LECTURA) && Boolean(empresaActiva.id),
    staleTime: 300_000,
  });
  const ultimoMes = comparativo?.meses.at(-1) ?? null;
  const costoUltimo = ultimoMes ? Number(ultimoMes.costoLaboral) : null;
  const variacionCosto =
    ultimoMes?.variacionPorcentaje === null || ultimoMes === null
      ? null
      : Number(ultimoMes.variacionPorcentaje);

  const trabajadoresActivos = empresaActiva.id
    ? (personas ?? []).filter((p) => p.estadoCese === 'ACTIVO').length
    : (resumenEstudio?.personas ?? 0);

  if (esPlataforma) {
    // El SUPERADMIN de plataforma no tiene datos de negocio propios
    return (
      <div className="space-y-6">
        <CabeceraPagina
          titulo={`Hola, ${sesion?.usuario.nombres ?? ''}`}
          descripcion="Panel de administración de la plataforma."
        />
        <Tarjeta className="p-6">
          <p className="text-cuerpo text-texto-suave">
            Desde el menú puedes administrar los estudios contables, las tasas
            AFP y el calendario tributario SUNAT.
          </p>
        </Tarjeta>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CabeceraPagina
        titulo={`Hola, ${sesion?.usuario.nombres ?? ''}`}
        descripcion={
          empresaActiva.razonSocial
            ? `Estás trabajando sobre ${empresaActiva.razonSocial}.`
            : 'Elige una empresa en el menú lateral para ver sus cifras.'
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          etiqueta="Empresas activas"
          valor={String(empresas?.length ?? resumenEstudio?.empresas ?? 0)}
          Icono={Building2}
          cargando={cargandoEmpresas && !resumenEstudio}
          detalle="En tu estudio"
        />
        <Metrica
          etiqueta="Trabajadores activos"
          valor={String(trabajadoresActivos)}
          Icono={Users}
          detalle={empresaActiva.razonSocial ?? 'En todas tus empresas'}
        />
        <Metrica
          etiqueta="Costo laboral"
          valor={costoUltimo === null ? '—' : soles(costoUltimo)}
          Icono={Wallet}
          variacion={variacionCosto}
          detalle={
            cerrados[0]
              ? `Periodo ${etiquetaPeriodo(cerrados[0])}`
              : 'Sin periodos cerrados'
          }
          cargando={Boolean(empresaActiva.id) && cargandoPeriodos}
        />
        <Metrica
          etiqueta="Alertas pendientes"
          valor={String(alertas?.pendientes ?? 0)}
          Icono={Bell}
          detalle="Vencimientos y obligaciones"
        />
      </div>

      {!empresaActiva.id && (empresas?.length ?? 0) === 0 && !cargandoEmpresas ? (
        <Tarjeta>
          <Vacio
            icono={<Receipt className="size-6" />}
            titulo="Empieza por registrar una empresa cliente"
            descripcion="Planix organiza todo por empresa: sus trabajadores, sus planillas y sus beneficios. Registra la primera y el resto fluye."
            accion={
              <BotonEnlace a="/empresas/nueva" variante="primario">
                Registrar empresa
              </BotonEnlace>
            }
          />
        </Tarjeta>
      ) : (
        <>
          <LoQueVence />
          <AccionesRapidas empresaId={empresaActiva.id} />
          {empresaActiva.id && (
            <UltimosPeriodos
              periodos={cerrados}
              cargando={cargandoPeriodos}
              totalesPorPeriodo={totalesPorPeriodo}
            />
          )}
        </>
      )}
    </div>
  );
}
