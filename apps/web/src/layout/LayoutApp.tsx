import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  CalendarDays,
  BookOpen,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  FileBarChart,
  FileCheck,
  FileSignature,
  Gift,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  Palmtree,
  PiggyBank,
  Settings,
  ShieldCheck,
  Table2,
  TrendingUp,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LECTURA,
  LECTURA_CONTABLE,
  PLATAFORMA,
  puede,
  type Rol,
} from '@planix/shared-types';
import { Logo } from '../componentes/Logo';
import { Toasts } from '../componentes/Toasts';
import { cx } from '../componentes/ui';
import { obtenerResumenAlertas } from '../lib/alertas';
import { cerrarSesion } from '../lib/api';
import { obtenerSuscripcion } from '../lib/billing';
import { listarEmpresas } from '../lib/empresas';
import { useAuth } from '../stores/auth';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useSidebar } from '../stores/sidebar';

// =====================================================================
// Shell de la aplicación: sidebar agrupado + cabecera + contenido.
//
// La navegación se agrupa por FLUJO DE TRABAJO, no por orden de
// construcción: primero lo que se consulta a diario (empresas, personas),
// después la planilla, los beneficios, la gestión y por último el
// sistema. Con dieciséis módulos, una lista plana era imposible de barrer
// con la vista.
//
// PRESUPUESTO VERTICAL — 690px, y el objetivo es 700.
//
// La medida no se fija contra la pantalla sino contra el VIEWPORT CSS, que
// es bastante más pequeño: un portátil de 1920x1080 con el escalado de
// Windows al 125-150% (lo normal de fábrica) deja unos 700-780px útiles,
// no los 910 que da un 1080 sin escalar. Ese es el caso real de uso.
//
// De ahí las medidas de este archivo: ítem de 30px con icono de 16, cero
// separación entre ítems, grupos partidos por una LÍNEA en vez de por un
// encabezado de texto, el selector de empresa fuera (vive en el header) y
// pie de 36px. Total 690px, con 10px de margen sobre el objetivo.
//
// Si añades un módulo son 30px más y te comes el margen: el siguiente
// recorte disponible ya no es cosmético, hay que fusionar dos módulos.
// =====================================================================

interface Modulo {
  ruta: string;
  etiqueta: string;
  Icono: LucideIcon;
  exacto?: boolean;
  /**
   * Grupo de permisos que exige el endpoint con el que la pantalla ABRE
   * (PROD-4). Se filtra por lo que hace falta para ENTRAR, no por lo que
   * el usuario pueda hacer dentro: el administrador consulta el estado
   * de la suscripción aunque gestionarla siga siendo CUENTA (§12).
   *
   * Quince de los diecisiete son LECTURA. Los dos que no lo son —los
   * contables— eran los que se le ofrecían a PERSONAL, a quien §12 se
   * los niega «ni de lectura».
   */
  grupo: Rol[];
}

interface Grupo {
  /**
   * Ya NO se pinta: los grupos se separan con una línea. Sigue siendo
   * obligatorio porque va como `aria-label` de la lista — quien usa
   * lector de pantalla oye "lista, Beneficios" y conserva la agrupación
   * que la vista recibe por el separador.
   */
  titulo: string;
  modulos: Modulo[];
}

const GRUPOS: Grupo[] = [
  {
    titulo: 'Principal',
    modulos: [
      { ruta: '/', etiqueta: 'Dashboard', Icono: LayoutDashboard, exacto: true, grupo: LECTURA },
      { ruta: '/empresas', etiqueta: 'Empresas', Icono: Building2, grupo: LECTURA },
      { ruta: '/personas', etiqueta: 'Personas', Icono: Users, grupo: LECTURA },
    ],
  },
  {
    titulo: 'Planilla',
    modulos: [
      { ruta: '/planillas', etiqueta: 'Planillas', Icono: Table2, grupo: LECTURA },
      { ruta: '/prestamos', etiqueta: 'Préstamos', Icono: HandCoins, grupo: LECTURA },
      // Honorarios (4ta) y subvenciones comparten sección desde la S16
      { ruta: '/personal-externo', etiqueta: 'Personal externo', Icono: UserCog, grupo: LECTURA },
    ],
  },
  {
    titulo: 'Beneficios',
    modulos: [
      { ruta: '/beneficios/cts', etiqueta: 'CTS', Icono: PiggyBank, grupo: LECTURA },
      { ruta: '/beneficios/gratificaciones', etiqueta: 'Gratificaciones', Icono: Gift, grupo: LECTURA },
      { ruta: '/beneficios/vacaciones', etiqueta: 'Vacaciones', Icono: Palmtree, grupo: LECTURA },
      { ruta: '/beneficios/liquidaciones', etiqueta: 'Liquidaciones', Icono: FileCheck, grupo: LECTURA },
      { ruta: '/beneficios/utilidades', etiqueta: 'Utilidades', Icono: TrendingUp, grupo: LECTURA },
    ],
  },
  {
    // "Reportes" era un grupo de UN solo ítem: el encabezado costaba más
    // alto que el propio enlace y no separaba nada. Vive dentro de Gestión.
    titulo: 'Gestión',
    modulos: [
      { ruta: '/contratos', etiqueta: 'Contratos', Icono: FileSignature, grupo: LECTURA },
      { ruta: '/alertas', etiqueta: 'Alertas', Icono: Bell, grupo: LECTURA },
      // Contable: §12 se lo niega a PERSONAL «ni de lectura» (PROD-4).
      { ruta: '/asientos', etiqueta: 'Asientos', Icono: BookOpen, grupo: LECTURA_CONTABLE },
      { ruta: '/reportes', etiqueta: 'Reportes', Icono: FileBarChart, grupo: LECTURA },
    ],
  },
  {
    titulo: 'Sistema',
    modulos: [
      // Contable igual que Asientos. Que el ADMINISTRADOR lo vea es
      // correcto: §12 le niega GESTIONAR la suscripción, no consultarla,
      // y los botones de suscribir y cancelar sí son CUENTA.
      { ruta: '/suscripcion', etiqueta: 'Suscripción', Icono: CreditCard, grupo: LECTURA_CONTABLE },
      { ruta: '/configuracion', etiqueta: 'Configuración', Icono: Settings, grupo: LECTURA },
    ],
  },
];

/** El SUPERADMIN de plataforma no navega datos de tenants (§12). */
const GRUPOS_PLATAFORMA: Grupo[] = [
  {
    titulo: 'Plataforma',
    modulos: [
      { ruta: '/admin/tenants', etiqueta: 'Estudios contables', Icono: Building2, grupo: PLATAFORMA },
      { ruta: '/admin/tasas', etiqueta: 'Tasas AFP (SBS)', Icono: TrendingUp, grupo: PLATAFORMA },
      {
        ruta: '/admin/cronograma-sunat',
        etiqueta: 'Calendario SUNAT',
        Icono: FileBarChart,
        grupo: PLATAFORMA,
      },
      { ruta: '/feriados', etiqueta: 'Feriados', Icono: CalendarDays, grupo: PLATAFORMA },
    ],
  },
];

function EnlaceModulo({
  modulo,
  colapsado,
}: {
  modulo: Modulo;
  colapsado: boolean;
}) {
  const { ruta, etiqueta, Icono, exacto } = modulo;
  return (
    <NavLink
      to={ruta}
      end={exacto}
      title={colapsado ? etiqueta : undefined}
      className={({ isActive }) =>
        cx(
          // 30px de alto: py-1 sobre el interlineado natural de 22px. La
          // fuente se queda en 14px —la legibilidad no se negocia—, lo que
          // se recorta es el aire y el icono (16px).
          'transicion relative flex items-center gap-2.5 rounded-control py-1 text-cuerpo font-medium',
          colapsado ? 'justify-center px-2' : 'px-3',
          isActive
            ? 'bg-nav-activo text-nav-activo-texto'
            : 'text-nav-texto hover:bg-nav-hover hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Barra de 3px: el estado activo no depende solo del color */}
          {isActive && (
            <span
              className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-nav-barra"
              aria-hidden="true"
            />
          )}
          <Icono className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {!colapsado && <span className="truncate">{etiqueta}</span>}
        </>
      )}
    </NavLink>
  );
}

/**
 * Selector de EMPRESA ACTIVA (§ Sesión 8). Vivía en el sidebar, bajo el
 * logo, y desde el recorte a 700px vive en el HEADER.
 *
 * No es solo ahorro de espacio (64px del presupuesto vertical): el
 * selector es un conmutador de CONTEXTO global, y el header ya lleva el
 * otro nivel del contexto —el estudio contable—, así que la línea se lee
 * entera, "estudio → empresa". Además el header es sticky, con lo que
 * sigue viéndose siempre, que era la razón de ponerlo en el sidebar.
 *
 * Sin empresas no pinta NADA: la llamada a "registra tu primera empresa"
 * vive en el dashboard y en la propia pantalla de Empresas.
 */
function SelectorEmpresaActiva() {
  const empresaActiva = useEmpresaActiva();
  const { data: empresas } = useQuery({
    queryKey: ['empresas', '', false],
    queryFn: () => listarEmpresas(),
  });

  // Con una sola empresa se fija sola como activa: no tiene sentido pedir
  // que elija entre una opción. Va en un efecto y no en el render porque
  // escribir en el store mientras se pinta provoca un render en cascada.
  const unica = empresas?.length === 1 ? empresas[0] : undefined;
  const idActivo = empresaActiva.id;
  const seleccionar = empresaActiva.seleccionar;
  useEffect(() => {
    if (unica && idActivo !== unica.id) {
      seleccionar(unica.id, unica.razonSocial);
    }
  }, [unica, idActivo, seleccionar]);

  if (!empresas || empresas.length === 0) {
    return null;
  }

  // Con UNA sola empresa el selector no elige nada: es un desplegable de
  // un elemento que ocupa sitio y hace pensar que falta configurar algo.
  // Es el caso de todo tenant de tipo EMPRESA (S23.5), que tiene la suya
  // y ninguna más. Se muestra el nombre y se deja fijada como activa.
  if (empresas.length === 1) {
    const unica = empresas[0];
    return (
      <div className="flex min-w-0 items-center gap-2">
        <Building2 className="size-4 shrink-0 text-texto-tenue" aria-hidden="true" />
        <span className="truncate text-apoyo font-medium text-texto">
          {unica.razonSocial}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Building2 className="size-4 shrink-0 text-texto-tenue" aria-hidden="true" />
      {/* La etiqueta desaparece de la vista en pantallas estrechas, pero
          NUNCA del árbol de accesibilidad: sr-only la mantiene. */}
      <label
        htmlFor="empresa-activa"
        className="sr-only shrink-0 text-apoyo font-medium text-texto-tenue lg:not-sr-only"
      >
        Empresa
      </label>
      <select
        id="empresa-activa"
        value={empresaActiva.id ?? ''}
        onChange={(e) => {
          const empresa = empresas.find((x) => x.id === e.target.value);
          if (empresa) {
            empresaActiva.seleccionar(empresa.id, empresa.razonSocial);
          } else {
            empresaActiva.limpiar();
          }
        }}
        className="transicion h-8 max-w-56 min-w-0 cursor-pointer truncate rounded-control border border-borde bg-superficie px-2 text-apoyo font-medium text-texto hover:border-borde-fuerte focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25"
      >
        <option value="">— Elige la empresa —</option>
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.razonSocial}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Campana de alertas: el número son las PENDIENTE del estudio. El conteo
 * lo da el backend; aquí solo se pinta y se refresca cada cinco minutos.
 */
function CampanaAlertas() {
  const rol = useAuth((s) => s.sesion?.usuario.rol);
  const { data: resumen } = useQuery({
    queryKey: ['alertas-resumen'],
    queryFn: obtenerResumenAlertas,
    // El grupo del endpoint, no una lista a mano: `alertas/resumen` es
    // LECTURA, así que la ve todo el que entra al tenant. Enumerarlo
    // dejaba fuera al titular, al personal y al de solo lectura.
    enabled: puede(rol, LECTURA),
    staleTime: 60_000,
    refetchInterval: 300_000,
  });

  if (!resumen) {
    return null;
  }

  const pendientes = resumen.pendientes;
  return (
    <Link
      to="/alertas"
      aria-label={`Alertas: ${pendientes} pendiente(s)`}
      title={
        pendientes === 0
          ? 'No tienes alertas pendientes'
          : `${pendientes} alerta(s) pendiente(s)`
      }
      className="transicion relative grid size-10 place-items-center rounded-control border border-borde bg-superficie text-texto-suave hover:border-borde-fuerte hover:text-texto"
    >
      <Bell className="size-4.5" />
      {pendientes > 0 && (
        <span className="cifras absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-peligro px-1 text-center text-[11px] font-bold leading-5 text-white">
          {pendientes > 99 ? '99+' : pendientes}
        </span>
      )}
    </Link>
  );
}

/**
 * Banner global del estado de la suscripción (§11). Solo aparece cuando
 * hay algo que avisar. El texto viene del backend: una sola fuente.
 */
function BannerSuscripcion() {
  const rol = useAuth((s) => s.sesion?.usuario.rol);
  const { data: suscripcion } = useQuery({
    queryKey: ['suscripcion'],
    queryFn: obtenerSuscripcion,
    // LECTURA_CONTABLE, que es lo que exige `billing/suscripcion`. El
    // TITULAR es quien gestiona la suscripción (§12): que el aviso de
    // «tu pago falló» lo viera el operador y no quien puede pagarlo era
    // justo el escenario que este banner existe para evitar.
    enabled: puede(rol, LECTURA_CONTABLE),
    staleTime: 60_000,
  });

  if (!suscripcion?.banner) {
    return null;
  }

  const tono = !suscripcion.puedeEscribir
    ? 'border-peligro/25 bg-peligro-suave text-peligro'
    : suscripcion.estado === 'PAST_DUE'
      ? 'border-advertencia/30 bg-advertencia-suave text-advertencia'
      : 'border-primario/20 bg-primario-suave text-primario';

  return (
    <div
      className={cx(
        'flex items-center justify-between gap-4 border-b px-6 py-2 text-apoyo',
        tono,
      )}
    >
      <span className="flex items-center gap-2">
        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
        {suscripcion.banner}
      </span>
      <Link to="/suscripcion" className="shrink-0 font-semibold underline">
        Ver planes
      </Link>
    </div>
  );
}

export function LayoutApp() {
  const navigate = useNavigate();
  const ubicacion = useLocation();
  const sesion = useAuth((s) => s.sesion);
  const { colapsado, alternar } = useSidebar();
  const esPlataforma = sesion?.usuario.rol === 'SUPERADMIN';
  // El menú se filtra por rol (PROD-4): antes los cinco roles del tenant
  // veían los mismos diecisiete enlaces. Un grupo que se queda sin
  // módulos no se pinta —dibujaría su línea separadora y su `aria-label`
  // sin nada dentro—, aunque hoy con ningún rol llegue a pasar: los dos
  // contables conviven con módulos de LECTURA en sus grupos.
  const grupos = (esPlataforma ? GRUPOS_PLATAFORMA : GRUPOS)
    .map((g) => ({ ...g, modulos: g.modulos.filter((m) => puede(sesion?.usuario.rol, m.grupo)) }))
    .filter((g) => g.modulos.length > 0);

  // Menú de MÓVIL. No se persiste como el colapso: ahí es una preferencia
  // de trabajo, aquí es un cajón que se abre, se usa y se cierra.
  const [menuAbierto, setMenuAbierto] = useState(false);
  // Navegar cierra el cajón; si no, tapa la pantalla a la que acabas de ir.
  useEffect(() => setMenuAbierto(false), [ubicacion.pathname]);

  const salir = async () => {
    await cerrarSesion();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-fondo">
      {/* Fondo que atrapa el clic fuera del cajón. Solo en móvil. */}
      {menuAbierto && (
        <div
          className="fixed inset-0 z-30 bg-texto/40 lg:hidden"
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />
      )}

      {/* data-tema="oscuro" no pinta nada por sí solo: es el gancho de los
          dos ajustes que no se pueden expresar con utilidades (el color
          del foco por teclado y las <option> del select nativo). */}
      <aside
        data-tema="oscuro"
        className={cx(
          // Sin borde derecho: el salto de oscuro a claro ya es el límite,
          // y una línea gris encima lo ensuciaría.
          'transicion flex h-screen flex-col overflow-hidden bg-nav',
          // MÓVIL: el sidebar sale del flujo y se aparta. Fijo en el flujo
          // se comía 240 de los 375px de un teléfono y empujaba la página
          // 136px a la derecha — la app entera se leía en diagonal.
          'fixed inset-y-0 left-0 z-40',
          // `invisible` además del desplazamiento: un elemento solo movido
          // con translate sigue estando en el orden de tabulación, así que
          // el teclado se perdería en un menú que no se ve. Con
          // visibility:hidden desaparece del foco y la transición se
          // conserva (a diferencia de display:none).
          menuAbierto ? 'translate-x-0' : 'invisible -translate-x-full',
          // ESCRITORIO (lg+): vuelve a la columna de siempre.
          'lg:visible lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 lg:shrink-0',
          colapsado ? 'w-16' : 'w-60',
        )}
      >
        {/* Estos 64px son los mismos del header, y su borde inferior
            continúa el del header: una sola línea horizontal cruza la app
            de lado a lado y ata las dos zonas en vez de dejar el header
            flotando como una franja suelta. */}
        <div
          className={cx(
            'flex h-16 shrink-0 items-center border-b border-nav-borde',
            colapsado ? 'justify-center px-2' : 'px-4',
          )}
        >
          <Link to="/" aria-label="Ir al panel">
            <Logo
              tamano={colapsado ? 30 : 28}
              variante={colapsado ? 'simbolo' : 'completo'}
              fondo="oscuro"
            />
          </Link>
        </div>

        {/* min-h-0 es lo que obliga al scroll a quedarse DENTRO del nav en
            vez de estirar el aside y empujar el pie fuera de la pantalla. */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5">
          {grupos.map((grupo, i) => (
            // Los encabezados de texto costaban 18px cada uno y solo cuatro
            // ya eran 72. Se sustituyen por una línea: la agrupación se
            // sigue VIENDO, ocupa 17px por corte en vez de 28, y el nombre
            // del grupo no se pierde — viaja en el aria-label de la lista,
            // así que un lector de pantalla anuncia "lista, Beneficios".
            <ul
              key={grupo.titulo}
              aria-label={grupo.titulo}
              className={cx(i > 0 && 'mt-2 border-t border-nav-borde pt-2')}
            >
              {grupo.modulos.map((modulo) => (
                <li key={modulo.ruta}>
                  <EnlaceModulo modulo={modulo} colapsado={colapsado} />
                </li>
              ))}
            </ul>
          ))}
        </nav>

        {/* Contraer a solo iconos es una preferencia de escritorio: en el
            cajón de móvil no significa nada, porque el cajón ya se cierra. */}
        <button
          type="button"
          onClick={alternar}
          aria-label={colapsado ? 'Expandir el menú' : 'Contraer el menú'}
          className="transicion hidden h-9 shrink-0 items-center justify-center gap-2 border-t border-nav-borde text-apoyo text-nav-encabezado hover:bg-nav-hover hover:text-white lg:flex"
        >
          {colapsado ? (
            <ChevronsRight className="size-4" />
          ) : (
            <>
              <ChevronsLeft className="size-4" />
              Contraer
            </>
          )}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-borde bg-superficie/90 px-4 backdrop-blur lg:gap-4 lg:px-6">
          {/* Contexto de trabajo, de lo general a lo concreto:
              estudio contable → empresa activa. */}
          <div className="flex min-w-0 items-center gap-3 lg:gap-4">
            <button
              type="button"
              onClick={() => setMenuAbierto(true)}
              aria-label="Abrir el menú"
              aria-expanded={menuAbierto}
              className="transicion grid size-10 shrink-0 place-items-center rounded-control border border-borde text-texto-suave hover:border-borde-fuerte hover:text-texto lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            {/* El bloque de identidad cede el sitio en móvil: quien trabaja
                en un teléfono ya sabe en qué estudio está, y lo que no puede
                faltar es el selector de empresa. */}
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-cuerpo font-semibold text-texto">
                {sesion?.usuario.nombreEstudio ?? 'Plataforma Planix'}
              </p>
              <p className="truncate text-apoyo text-texto-tenue">
                {sesion?.usuario.nombres} {sesion?.usuario.apellidos} ·{' '}
                {sesion?.usuario.rol}
              </p>
            </div>
            {!esPlataforma && (
              <>
                <span
                  className="hidden h-8 w-px shrink-0 bg-borde lg:block"
                  aria-hidden="true"
                />
                <SelectorEmpresaActiva />
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CampanaAlertas />
            <button
              type="button"
              onClick={() => void salir()}
              className="transicion flex h-10 items-center gap-2 rounded-control border border-borde px-3 text-apoyo text-texto-suave hover:border-borde-fuerte hover:text-texto"
            >
              <LogOut className="size-4" />
              Salir
            </button>
          </div>
        </header>

        <BannerSuscripcion />

        <main className="flex-1 p-6">
          <Outlet />
        </main>

        {/* Aviso legal en el pie (Ley 29733, S23) */}
        <footer className="border-t border-borde px-6 py-3 text-apoyo text-texto-tenue">
          Planix trata datos personales de trabajadores por cuenta de tu estudio
          contable.{' '}
          <Link to="/privacidad" className="underline hover:text-texto-suave">
            Aviso de Privacidad
          </Link>{' '}
          ·{' '}
          <Link to="/terminos" className="underline hover:text-texto-suave">
            Términos de Servicio
          </Link>
        </footer>
      </div>
      <Toasts />
    </div>
  );
}
