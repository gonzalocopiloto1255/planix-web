import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PantallaAcceso } from '../componentes/PantallaAcceso';
import { Aviso, Boton, Campo, Input } from '../componentes/ui';
import { aceptarInvitacion } from '../lib/usuarios';

// =====================================================================
// Pantalla PÚBLICA a la que llega el invitado desde el correo (S23.5).
// Todavía no tiene cuenta: aquí elige su contraseña y con eso se crea.
// Mismo tratamiento visual que el login, que es lo que verá después.
// =====================================================================

export function AceptarInvitacion() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== repetida) {
      setError('Las dos contraseñas no coinciden');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await aceptarInvitacion({ token, password });
      setListo(true);
      // Se le manda al login en vez de iniciarle sesión: que estrene la
      // contraseña que acaba de elegir confirma que la recuerda.
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar');
    } finally {
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <PantallaAcceso>
        <h1 className="text-titulo font-semibold tracking-tight text-texto">
          Cuenta lista
        </h1>
        <Aviso tono="exito" className="mt-4">
          Ya puedes entrar con tu correo y la contraseña que elegiste. Te llevamos
          al inicio de sesión…
        </Aviso>
      </PantallaAcceso>
    );
  }

  return (
    <PantallaAcceso>
      <h1 className="text-titulo font-semibold tracking-tight text-texto">
        Elige tu contraseña
      </h1>
      <p className="mt-1.5 text-cuerpo text-texto-suave">
        Te invitaron a Planix. Define una contraseña para entrar.
      </p>

      <form onSubmit={enviar} className="mt-7 space-y-4" noValidate>
        <Campo etiqueta="Contraseña" htmlFor="password" requerido>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Repite la contraseña" htmlFor="password2" requerido>
          <Input
            id="password2"
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
          />
        </Campo>

        {error && <Aviso tono="peligro">{error}</Aviso>}

        <Boton type="submit" bloque cargando={enviando}>
          Crear mi acceso
        </Boton>
      </form>
    </PantallaAcceso>
  );
}
