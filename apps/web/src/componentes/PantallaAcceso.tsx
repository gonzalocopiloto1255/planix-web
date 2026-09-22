import { FileCheck2, ScrollText, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from './Logo';

// =====================================================================
// Marco de las pantallas de acceso (login, registro, verificación 2FA).
//
// Pantalla dividida: a la izquierda la marca —es lo primero que ve
// alguien que evalúa el producto—, a la derecha el formulario. En móvil
// el panel de marca desaparece entero: ocupa sitio y no deja escribir.
//
// El degradado va de #4338CA a #7C3AED con una malla de puntos muy tenue
// (.textura-marca): da textura sin competir con el texto blanco.
// =====================================================================

const BENEFICIOS = [
  {
    Icono: ScrollText,
    texto: 'Cálculos conforme a la normativa peruana',
  },
  {
    Icono: FileCheck2,
    texto: 'Boletas, AFPnet, PLAME y asientos en un clic',
  },
  {
    Icono: ShieldCheck,
    texto: 'Tus datos siempre tuyos, exportables cuando quieras',
  },
];

export function PantallaAcceso({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen bg-superficie">
      {/* ---- Marca (55%, fuera en móvil) ---- */}
      <aside
        className="relative hidden w-[55%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#4338CA] to-[#7C3AED] p-12 lg:flex"
        aria-hidden="true"
      >
        <div className="textura-marca absolute inset-0" />

        <div className="relative">
          <Logo tamano={40} fondo="color" />
        </div>

        <div className="relative max-w-lg">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-white">
            Planillas de sueldos, sin planillas de Excel
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/80">
            El sistema que calcula, declara y archiva por ti, para todas las
            empresas de tu estudio contable.
          </p>

          <ul className="mt-10 space-y-4">
            {BENEFICIOS.map(({ Icono, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-white/90">
                <span className="grid size-9 shrink-0 place-items-center rounded-control bg-white/15 ring-1 ring-inset ring-white/20">
                  <Icono className="size-4.5" strokeWidth={2} />
                </span>
                <span className="text-cuerpo">{texto}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-apoyo text-white/50">
          Hecho para estudios contables del Perú
        </p>
      </aside>

      {/* ---- Formulario (45%) ---- */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-10 lg:w-[45%]">
        <div className="w-full max-w-sm">
          {/* En móvil el logo va aquí: el panel de marca no existe */}
          <div className="mb-8 lg:hidden">
            <Logo tamano={36} />
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
