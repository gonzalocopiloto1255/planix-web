// =====================================================================
// Identidad de Planix.
//
// El símbolo es un cuadrado redondeado con degradado índigo→violeta y
// tres filas blancas de distinto ancho: las filas de una planilla. La del
// medio va destacada (más opaca y un poco más alta), que es lo que da
// lectura a 24px — a ese tamaño tres barras iguales se ven como una
// mancha.
//
// El degradado necesita un id ÚNICO por instancia: si el sidebar y el
// login pintan dos logos con el mismo id, el navegador resuelve ambos con
// la primera definición y el segundo puede quedarse sin degradado.
// =====================================================================
import { useId } from 'react';

interface LogoProps {
  /** Alto del símbolo en píxeles (24 en el sidebar, 48-64 en el login) */
  tamano?: number;
  /** Símbolo + palabra, o solo el símbolo (sidebar colapsado, favicon) */
  variante?: 'completo' | 'simbolo';
  /**
   * Sobre qué se pinta:
   * - `claro`  superficie blanca → símbolo con degradado, palabra oscura.
   * - `oscuro` navegación índigo → símbolo con su degradado (el fondo es
   *   oscuro pero apagado, así que el degradado destaca en vez de
   *   perderse) y palabra en blanco con la "x" en índigo claro.
   * - `color`  panel de marca del login → todo en blanco, porque ahí el
   *   fondo YA es el degradado y repetirlo lo anularía.
   */
  fondo?: 'claro' | 'oscuro' | 'color';
  className?: string;
}

export function Logo({
  tamano = 32,
  variante = 'completo',
  fondo = 'claro',
  className,
}: LogoProps) {
  const id = useId();
  const degradado = `planix-degradado-${id}`;
  const invertido = fondo === 'color';

  const simbolo = (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Planix"
      className="shrink-0"
    >
      <defs>
        <linearGradient id={degradado} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect
        width="32"
        height="32"
        rx="8"
        fill={invertido ? '#FFFFFF' : `url(#${degradado})`}
      />
      {/* Tres filas de planilla: corta, destacada y media */}
      <rect
        x="8"
        y="9"
        width="12"
        height="2.5"
        rx="1.25"
        fill={invertido ? '#4F46E5' : '#FFFFFF'}
        fillOpacity={invertido ? 0.55 : 0.7}
      />
      <rect
        x="8"
        y="14"
        width="16"
        height="3.5"
        rx="1.75"
        fill={invertido ? '#4F46E5' : '#FFFFFF'}
      />
      <rect
        x="8"
        y="20.5"
        width="9"
        height="2.5"
        rx="1.25"
        fill={invertido ? '#4F46E5' : '#FFFFFF'}
        fillOpacity={invertido ? 0.55 : 0.7}
      />
    </svg>
  );

  if (variante === 'simbolo') {
    return <span className={className}>{simbolo}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      {simbolo}
      <span
        // La palabra escala con el símbolo para que el conjunto no se
        // descuadre entre el sidebar (24px) y el login (48px)
        style={{ fontSize: tamano * 0.72, lineHeight: 1 }}
        className={`font-semibold tracking-tight ${
          fondo === 'claro' ? 'text-texto' : 'text-white'
        }`}
      >
        Plani
        {/* La "x" en violeta ata la palabra al degradado del símbolo. Sobre
            el degradado del login se deja en blanco (repetirlo lo anula) y
            sobre la navegación oscura sube al índigo claro, que ahí sí
            contrasta (8.3:1) sin perder el guiño de color. */}
        <span
          className={
            fondo === 'claro'
              ? 'text-acento'
              : fondo === 'oscuro'
                ? 'text-nav-activo-texto'
                : 'text-white'
          }
        >
          x
        </span>
      </span>
    </span>
  );
}
