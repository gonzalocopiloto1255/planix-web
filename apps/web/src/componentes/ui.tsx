import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';

// =====================================================================
// Componentes transversales del sistema de diseño.
//
// Todo lo que se repite en la app vive aquí: botones, campos, tablas,
// badges, tarjetas y skeletons. La regla es simple — si una pantalla
// necesita un control, lo IMPORTA de aquí; no reinventa clases sueltas.
// Así el día que cambie el radio o el color de foco, cambia en un sitio.
//
// Nada de colores literales: solo tokens de index.css.
// =====================================================================

/** Une clases ignorando las vacías (evita la dependencia de `clsx`). */
export function cx(...clases: (string | false | null | undefined)[]): string {
  return clases.filter(Boolean).join(' ');
}

// ------------------------- Botones -------------------------

type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro';
type TamanoBoton = 'sm' | 'md';

const BOTON_BASE =
  'transicion inline-flex items-center justify-center gap-2 rounded-control font-medium ' +
  'disabled:cursor-not-allowed disabled:opacity-55';

const BOTON_VARIANTE: Record<VarianteBoton, string> = {
  primario:
    'bg-primario text-white shadow-tarjeta hover:bg-primario-oscuro active:bg-primario-oscuro',
  secundario:
    'border border-borde bg-superficie text-texto hover:bg-fondo hover:border-borde-fuerte',
  fantasma: 'text-texto-suave hover:bg-fondo hover:text-texto',
  peligro:
    'border border-peligro/30 bg-peligro-suave text-peligro hover:bg-peligro hover:text-white',
};

const BOTON_TAMANO: Record<TamanoBoton, string> = {
  sm: 'h-8 px-3 text-apoyo',
  md: 'h-10 px-4 text-cuerpo',
};

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  /** Muestra el spinner y deshabilita: una acción en curso no se repite */
  cargando?: boolean;
  iconoIzquierda?: ReactNode;
  bloque?: boolean;
}

export function Boton({
  variante = 'primario',
  tamano = 'md',
  cargando = false,
  iconoIzquierda,
  bloque = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: BotonProps) {
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      className={cx(
        BOTON_BASE,
        BOTON_VARIANTE[variante],
        BOTON_TAMANO[tamano],
        bloque && 'w-full',
        className,
      )}
      {...props}
    >
      {cargando ? <Spinner /> : iconoIzquierda}
      {children}
    </button>
  );
}

/** Botón que navega. Mismo aspecto que <Boton>, semántica de enlace. */
export function BotonEnlace({
  a,
  variante = 'secundario',
  tamano = 'md',
  iconoIzquierda,
  className,
  children,
}: {
  a: string;
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  iconoIzquierda?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={a}
      className={cx(
        BOTON_BASE,
        BOTON_VARIANTE[variante],
        BOTON_TAMANO[tamano],
        className,
      )}
    >
      {iconoIzquierda}
      {children}
    </Link>
  );
}

function Spinner() {
  return (
    <svg
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

// ------------------------- Campos -------------------------

/** Alto, borde y anillo de foco comunes a input, select y textarea. */
export const CLASE_CAMPO =
  'transicion w-full rounded-control border border-borde bg-superficie px-3 text-cuerpo ' +
  'text-texto placeholder:text-texto-tenue hover:border-borde-fuerte ' +
  'focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25 ' +
  'disabled:cursor-not-allowed disabled:bg-fondo disabled:text-texto-tenue';

const ALTO_CAMPO = 'h-11'; // 44px: cómodo de tocar y de leer

interface CampoProps {
  etiqueta: string;
  htmlFor?: string;
  error?: string;
  ayuda?: string;
  requerido?: boolean;
  children: ReactNode;
}

/** Envoltorio con etiqueta, ayuda y error: mismo layout en toda la app. */
export function Campo({
  etiqueta,
  htmlFor,
  error,
  ayuda,
  requerido,
  children,
}: CampoProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-apoyo font-medium text-texto-suave"
      >
        {etiqueta}
        {requerido && <span className="ml-0.5 text-peligro">*</span>}
      </label>
      {children}
      {/* El error manda sobre la ayuda: no se apilan mensajes */}
      {error ? (
        <p className="text-apoyo text-peligro" role="alert">
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-apoyo text-texto-tenue">{ayuda}</p>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={cx(
        CLASE_CAMPO,
        ALTO_CAMPO,
        error && 'border-peligro focus:border-peligro focus:ring-peligro/25',
        className,
      )}
      aria-invalid={error || undefined}
      {...props}
    />
  );
}

export function Select({
  className,
  error,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select
      className={cx(
        CLASE_CAMPO,
        ALTO_CAMPO,
        'cursor-pointer',
        error && 'border-peligro focus:border-peligro focus:ring-peligro/25',
        className,
      )}
      aria-invalid={error || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

export function TextArea({
  className,
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={cx(
        CLASE_CAMPO,
        'py-2.5',
        error && 'border-peligro focus:border-peligro focus:ring-peligro/25',
        className,
      )}
      aria-invalid={error || undefined}
      {...props}
    />
  );
}

// ------------------------- Superficies -------------------------

export function Tarjeta({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cx(
        'rounded-tarjeta border border-borde bg-superficie shadow-tarjeta',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CabeceraTarjeta({
  titulo,
  descripcion,
  accion,
}: {
  titulo: ReactNode;
  descripcion?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-borde px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-seccion font-semibold text-texto">{titulo}</h2>
        {descripcion && (
          <p className="mt-0.5 text-apoyo text-texto-suave">{descripcion}</p>
        )}
      </div>
      {accion}
    </header>
  );
}

/** Encabezado de página: título, bajada y acciones a la derecha. */
export function CabeceraPagina({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-titulo font-semibold tracking-tight text-texto">
          {titulo}
        </h1>
        {descripcion && (
          <p className="mt-1 max-w-2xl text-cuerpo text-texto-suave">
            {descripcion}
          </p>
        )}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}

// ------------------------- Badges -------------------------

export type TonoBadge =
  | 'neutro'
  | 'primario'
  | 'exito'
  | 'advertencia'
  | 'peligro'
  | 'info';

const BADGE_TONO: Record<TonoBadge, string> = {
  neutro: 'bg-fondo text-texto-suave ring-borde',
  primario: 'bg-primario-suave text-primario ring-primario/20',
  exito: 'bg-exito-suave text-exito ring-exito/20',
  advertencia: 'bg-advertencia-suave text-advertencia ring-advertencia/25',
  peligro: 'bg-peligro-suave text-peligro ring-peligro/20',
  info: 'bg-info-suave text-info ring-info/20',
};

/**
 * Badge de estado. Admite un icono porque EL COLOR NUNCA ES EL ÚNICO
 * indicador: quien no distingue verde de rojo debe poder leerlo igual.
 */
export function Badge({
  tono = 'neutro',
  icono,
  children,
  className,
}: {
  tono?: TonoBadge;
  icono?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-control px-2 py-0.5 text-apoyo font-medium ring-1 ring-inset',
        BADGE_TONO[tono],
        className,
      )}
    >
      {icono}
      {children}
    </span>
  );
}

// ------------------------- Tablas -------------------------

/**
 * Contenedor de tabla con scroll horizontal propio: una tabla ancha no
 * puede hacer que la PÁGINA entera se desplace de lado.
 */
export function Tabla({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={cx('w-full border-collapse text-apoyo', className)}>
        {children}
      </table>
    </div>
  );
}

/** Encabezado: fondo suave, 12px mayúscula, pegajoso si la tabla es larga. */
export function Th({
  className,
  numerico = false,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numerico?: boolean }) {
  return (
    <th
      scope="col"
      className={cx(
        'border-b border-borde bg-fondo px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-texto-suave',
        numerico ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

/**
 * Celda. `numerico` alinea a la derecha y activa las cifras tabulares;
 * `calculado` la pinta en gris claro (dato que el sistema calculó, no
 * algo que se digite).
 */
export function Td({
  className,
  numerico = false,
  calculado = false,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  numerico?: boolean;
  calculado?: boolean;
}) {
  return (
    <td
      className={cx(
        'border-b border-borde px-3 py-2.5 align-middle',
        numerico && 'cifras text-right',
        calculado ? 'text-texto-tenue' : 'text-texto',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export function Tr({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cx('transicion hover:bg-fondo', className)} {...props}>
      {children}
    </tr>
  );
}

// ------------------------- Carga y vacíos -------------------------

/** Bloque gris que late: mejor que un "cargando…" que salta al llegar. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx('animate-pulse rounded-control bg-borde/60', className)}
      aria-hidden="true"
    />
  );
}

export function SkeletonTabla({ filas = 5 }: { filas?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando datos…</span>
      {Array.from({ length: filas }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function SkeletonTarjetas({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: cantidad }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
    </div>
  );
}

/**
 * Estado vacío con ilustración, no un párrafo gris: cuando no hay nada
 * que mostrar es justo cuando hay que decir qué hacer.
 */
export function Vacio({
  icono,
  titulo,
  descripcion,
  accion,
}: {
  icono?: ReactNode;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icono && (
        <div className="mb-4 grid size-14 place-items-center rounded-full bg-primario-suave text-primario">
          {icono}
        </div>
      )}
      <p className="text-seccion font-semibold text-texto">{titulo}</p>
      {descripcion && (
        <p className="mt-1 max-w-md text-cuerpo text-texto-suave">{descripcion}</p>
      )}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

// ------------------------- Avisos -------------------------

const AVISO_TONO: Record<TonoBadge, string> = {
  neutro: 'border-borde bg-fondo text-texto-suave',
  primario: 'border-primario/25 bg-primario-suave text-primario',
  exito: 'border-exito/25 bg-exito-suave text-exito',
  advertencia: 'border-advertencia/30 bg-advertencia-suave text-advertencia',
  peligro: 'border-peligro/25 bg-peligro-suave text-peligro',
  info: 'border-info/25 bg-info-suave text-info',
};

export function Aviso({
  tono = 'info',
  icono,
  titulo,
  children,
  className,
}: {
  tono?: TonoBadge;
  icono?: ReactNode;
  titulo?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      // Un aviso de PELIGRO aparece de golpe y suele ser la consecuencia
      // de lo que la persona acaba de hacer —"contraseña incorrecta", "no
      // se pudo guardar"—: sin role="alert" un lector de pantalla no lo
      // anuncia y quien no ve la pantalla se queda esperando. Los demás
      // tonos son informativos y no deben interrumpir la lectura.
      role={tono === 'peligro' ? 'alert' : undefined}
      className={cx(
        'flex gap-3 rounded-tarjeta border px-4 py-3 text-cuerpo',
        AVISO_TONO[tono],
        className,
      )}
    >
      {icono && <span className="mt-0.5 shrink-0">{icono}</span>}
      <div className="min-w-0">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children}
      </div>
    </div>
  );
}

// ------------------------- Formato (§13) -------------------------

/** S/ 1,234.56 — el formato de moneda del sistema. */
export function soles(monto: string | number): string {
  return `S/ ${Number(monto).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Monto listo para una celda: alineado a la derecha y con cifras fijas. */
export function Monto({
  valor,
  className,
}: {
  valor: string | number;
  className?: string;
}) {
  return <span className={cx('cifras', className)}>{soles(valor)}</span>;
}
