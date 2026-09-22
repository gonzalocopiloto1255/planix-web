import { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { intentarRefresh } from '../lib/api';
import { useAuth } from '../stores/auth';
import { Logo } from './Logo';

/**
 * Guard de rutas: sin sesión → /login. Al cargar la app (token en memoria
 * perdido tras un F5) intenta UNA recuperación silenciosa con la cookie
 * httpOnly antes de decidir.
 */
export function RutaProtegida() {
  const sesion = useAuth((s) => s.sesion);
  const bootstrapPendiente = useAuth((s) => s.bootstrapPendiente);
  const terminarBootstrap = useAuth((s) => s.terminarBootstrap);
  const intentado = useRef(false);

  useEffect(() => {
    if (!sesion && bootstrapPendiente && !intentado.current) {
      intentado.current = true;
      void intentarRefresh().finally(() => terminarBootstrap());
    }
  }, [sesion, bootstrapPendiente, terminarBootstrap]);

  if (!sesion && bootstrapPendiente) {
    // Marca + spinner en vez de un texto suelto: el arranque tras un F5
    // es lo primero que se ve y no puede parecer una página rota
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-fondo">
        <Logo tamano={40} />
        <p className="flex items-center gap-2 text-cuerpo text-texto-tenue">
          <span
            className="size-3.5 animate-spin rounded-full border-2 border-borde border-t-primario"
            aria-hidden="true"
          />
          Cargando tu sesión…
        </p>
      </main>
    );
  }

  if (!sesion) {
    return <Navigate to="/login" replace />;
  }

  // Contraseña TEMPORAL sin cambiar (S23.5): no hay nada que hacer en la
  // app hasta cambiarla, y la API rechaza igualmente sus peticiones de
  // negocio. Se le lleva ahí desde cualquier ruta, no solo al entrar.
  if (sesion.usuario.debeCambiarPassword) {
    return <Navigate to="/cambiar-password" replace />;
  }

  return <Outlet />;
}
