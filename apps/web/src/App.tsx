import { CUENTA, LECTURA_CONTABLE, PLATAFORMA } from '@planix/shared-types';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { RutaConPermiso } from './componentes/RutaConPermiso';
import { RutaProtegida } from './componentes/RutaProtegida';
import { LayoutApp } from './layout/LayoutApp';
import { AceptarInvitacion } from './paginas/AceptarInvitacion';
import { Bienvenida } from './paginas/Bienvenida';
import { CambiarPassword } from './paginas/CambiarPassword';
import { AdminCronograma } from './paginas/AdminCronograma';
import { Feriados } from './paginas/Feriados';
import { AdminTasas } from './paginas/AdminTasas';
import { Alertas } from './paginas/Alertas';
import { Asientos } from './paginas/Asientos';
import { Auditoria } from './paginas/Auditoria';
import { AsientosConfiguracion } from './paginas/AsientosConfiguracion';
import { Configuracion } from './paginas/Configuracion';
import { Contratos } from './paginas/Contratos';
import { Cts } from './paginas/Cts';
import { Dashboard } from './paginas/Dashboard';
import { Gratificaciones } from './paginas/Gratificaciones';
import { Liquidacion, Liquidaciones } from './paginas/Liquidacion';
import { EmpresaForm } from './paginas/EmpresaForm';
import { Empresas } from './paginas/Empresas';
import { ImportadorPersonas } from './paginas/ImportadorPersonas';
import { Privacidad, Terminos } from './paginas/Legal';
import { Login } from './paginas/Login';
import { PersonaFicha } from './paginas/PersonaFicha';
import { PersonaForm } from './paginas/PersonaForm';
import { Personas } from './paginas/Personas';
import { PersonalExterno } from './paginas/PersonalExterno';
import { Prestamos } from './paginas/Prestamos';
import { PlanillaGrilla } from './paginas/PlanillaGrilla';
import { Planillas } from './paginas/Planillas';
import { Placeholder } from './paginas/Placeholder';
import { AdminTenants } from './paginas/AdminTenants';
import { Registro } from './paginas/Registro';
import { Reportes } from './paginas/Reportes';
import { Suscripcion } from './paginas/Suscripcion';
import { SuscripcionResultado } from './paginas/SuscripcionResultado';
import { Usuarios } from './paginas/Usuarios';
import { Utilidades } from './paginas/Utilidades';
import { NoEncontrada } from './paginas/NoEncontrada';
import { Vacaciones } from './paginas/Vacaciones';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        {/* Documentos legales: públicos, se enlazan desde el registro (S23) */}
        <Route path="/terminos" element={<Terminos />} />
        <Route path="/privacidad" element={<Privacidad />} />
        {/* Pública: el invitado llega del correo y aún no tiene cuenta */}
        <Route path="/invitacion/:token" element={<AceptarInvitacion />} />
        {/* Fuera de RutaProtegida: es donde RutaProtegida REDIRIGE, así
            que meterla dentro sería un bucle. */}
        <Route path="/cambiar-password" element={<CambiarPassword />} />

        <Route element={<RutaProtegida />}>
          <Route element={<LayoutApp />}>
            <Route index element={<Dashboard />} />
            <Route path="bienvenida" element={<Bienvenida />} />
            <Route path="empresas" element={<Empresas />} />
            <Route path="empresas/nueva" element={<EmpresaForm />} />
            <Route path="empresas/:id/editar" element={<EmpresaForm />} />
            <Route path="personas" element={<Personas />} />
            <Route path="personas/nueva" element={<PersonaForm />} />
            <Route path="personas/importar" element={<ImportadorPersonas />} />
            <Route path="personas/:id" element={<PersonaFicha />} />
            <Route path="personas/:id/editar" element={<PersonaForm />} />
            <Route path="planillas" element={<Planillas />} />
            <Route path="planillas/:id" element={<PlanillaGrilla />} />
            <Route path="beneficios" element={<Placeholder titulo="Beneficios" />} />
            <Route path="beneficios/cts" element={<Cts />} />
            <Route path="beneficios/gratificaciones" element={<Gratificaciones />} />
            <Route path="beneficios/vacaciones" element={<Vacaciones />} />
            <Route path="beneficios/liquidaciones" element={<Liquidaciones />} />
            <Route path="beneficios/liquidaciones/:personaId" element={<Liquidacion />} />
            <Route path="beneficios/utilidades" element={<Utilidades />} />
            <Route path="prestamos" element={<Prestamos />} />
            <Route path="personal-externo" element={<PersonalExterno />} />
            <Route path="contratos" element={<Contratos />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="reportes/comparativo" element={<Reportes />} />
            <Route path="alertas" element={<Alertas />} />
            <Route path="feriados" element={<Feriados />} />
            <Route path="configuracion" element={<Configuracion />} />

            {/* RUTAS RESTRINGIDAS (PROD-4). Ocultar el enlace del menú no
                impide entrar escribiendo la URL, y hasta aquí la única
                pantalla que se defendía sola era AdminTenants: las otras
                seis se montaban para cualquiera y se quedaban vacías con
                un 403 en la consola. El grupo es el MISMO que declara el
                controlador, para que las dos guardas no puedan divergir. */}
            <Route element={<RutaConPermiso grupo={LECTURA_CONTABLE} />}>
              <Route path="asientos" element={<Asientos />} />
              <Route path="asientos/configuracion" element={<AsientosConfiguracion />} />
              <Route path="suscripcion" element={<Suscripcion />} />
              <Route path="suscripcion/resultado" element={<SuscripcionResultado />} />
            </Route>
            <Route element={<RutaConPermiso grupo={CUENTA} />}>
              <Route path="configuracion/auditoria" element={<Auditoria />} />
              <Route path="configuracion/usuarios" element={<Usuarios />} />
            </Route>
            <Route element={<RutaConPermiso grupo={PLATAFORMA} />}>
              <Route path="admin/tenants" element={<AdminTenants />} />
              <Route path="admin/tasas" element={<AdminTasas />} />
              <Route path="admin/cronograma-sunat" element={<AdminCronograma />} />
            </Route>
          </Route>
        </Route>
        {/* Catch-all: una URL desconocida mostraba una pantalla en blanco
            (auditoría S23.8, BAJO-1). Va fuera de RutaProtegida para que
            también responda a quien no ha iniciado sesión, y la propia
            NoEncontrada se dibuja dentro del layout cuando la hay. */}
        <Route path="*" element={<NoEncontrada />} />
      </Routes>
    </BrowserRouter>
  );
}
