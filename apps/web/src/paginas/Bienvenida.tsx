import { useQuery } from '@tanstack/react-query';
import { Check, Rocket } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Boton, soles } from '../componentes/ui';
import { listarPlanes } from '../lib/billing';

// =====================================================================
// Bienvenida tras el registro (S23.5).
//
// Enseña los planes ANTES de que empiece a trabajar, pero sin pedir
// tarjeta ni poner una puerta: el trial va con todo desbloqueado y la
// conversión se juega en que pruebe el producto entero. El botón
// principal es entrar, no comprar.
// =====================================================================

export function Bienvenida() {
  const navigate = useNavigate();
  const { data: planes } = useQuery({ queryKey: ['planes'], queryFn: listarPlanes });

  const dePago = (planes ?? []).filter((p) => p.codigo !== 'TRIAL');

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-4">
      <header className="text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primario-suave text-primario">
          <Rocket className="size-7" />
        </div>
        <h1 className="text-titulo font-semibold tracking-tight text-texto">
          Tu cuenta está lista
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-cuerpo text-texto-suave">
          Tienes 30 días de prueba con todo desbloqueado. Cuando quieras, elige
          tu plan.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Boton onClick={() => navigate('/', { replace: true })}>
            Empezar a usar Planix
          </Boton>
          <Link
            to="/suscripcion"
            className="transicion inline-flex h-10 items-center rounded-control border border-borde-fuerte px-4 text-cuerpo text-texto hover:bg-fondo"
          >
            Ver planes y suscribirme
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {dePago.map((plan) => (
          <article
            key={plan.id}
            className="rounded-tarjeta border border-borde bg-superficie p-5 shadow-tarjeta"
          >
            <h2 className="text-seccion font-semibold text-texto">{plan.nombre}</h2>
            <p className="cifras mt-1 text-subtitulo font-semibold text-texto">
              {soles(plan.precio)}
              <span className="text-cuerpo font-normal text-texto-tenue"> /mes</span>
            </p>
            <ul className="mt-3 space-y-1.5 text-apoyo text-texto-suave">
              <li className="flex gap-2">
                <Check className="size-4 shrink-0 text-exito" />
                {plan.maxEmpresas === null
                  ? 'Empresas ilimitadas'
                  : `${plan.maxEmpresas} empresas`}
              </li>
              <li className="flex gap-2">
                <Check className="size-4 shrink-0 text-exito" />
                {plan.maxTrabajadores === null
                  ? 'Trabajadores ilimitados'
                  : `${plan.maxTrabajadores} trabajadores`}
              </li>
              <li className="flex gap-2">
                <Check className="size-4 shrink-0 text-exito" />
                {plan.maxUsuarios === null
                  ? 'Usuarios ilimitados'
                  : `${plan.maxUsuarios} usuarios`}
              </li>
            </ul>
          </article>
        ))}
      </section>

      <p className="text-center text-apoyo text-texto-tenue">
        No se te pide tarjeta ahora. Al terminar la prueba tus datos siguen
        siendo tuyos: podrás consultarlos y descargarlos siempre.
      </p>
    </div>
  );
}
