import { puede, type Rol } from '@planix/shared-types';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { CabeceraPagina, Tarjeta } from './ui';

// =====================================================================
// Guarda de RUTA por grupo de permisos (PROD-4).
//
// `RutaProtegida` comprueba que haya sesión; esto comprueba que la
// sesión sirva para ESTA pantalla. Hasta ahora no existía: de las siete
// pantallas restringidas del sistema, la única que se defendía sola era
// `AdminTenants`, y las otras seis se montaban para cualquiera que
// escribiera la ruta en la barra de direcciones.
//
// Nunca hubo fuga de datos —la API responde 403 y los grupos del backend
// son la autoridad—, pero la aplicación se comportaba como si el sitio
// existiera para ese usuario: la pantalla se montaba, pedía y se quedaba
// vacía. Ocultar el enlace del menú no arregla eso; solo esconde el
// picaporte dejando la puerta abierta.
//
// NO REDIRIGE a propósito. Mandar a alguien a `/` sin decir nada se lee
// como un fallo de la aplicación, y quien escribió esa URL suele tener
// una razón: se la pasó un compañero, o la tenía en marcadores de cuando
// su rol era otro. Se le dice qué pasó.
// =====================================================================

export function RutaConPermiso({ grupo }: { grupo: Rol[] }) {
  const rol = useAuth((s) => s.sesion?.usuario.rol);

  if (!puede(rol, grupo)) {
    return (
      <div className="space-y-6">
        <CabeceraPagina
          titulo="Esta sección no es para tu usuario"
          descripcion="Tu rol no incluye el acceso a esta pantalla."
        />
        <Tarjeta className="p-6">
          <p className="text-cuerpo text-texto-suave">
            Si necesitas entrar, pídeselo al titular de la cuenta: es quien
            reparte los accesos desde <strong>Configuración → Usuarios</strong>.
          </p>
        </Tarjeta>
      </div>
    );
  }

  return <Outlet />;
}
