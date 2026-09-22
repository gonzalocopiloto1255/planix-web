import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PantallaAcceso } from '../componentes/PantallaAcceso';
import { Aviso, Boton, Campo, Input } from '../componentes/ui';
import { api, cerrarSesion } from '../lib/api';

// =====================================================================
// Cambio OBLIGATORIO de contraseña (S23.5).
//
// A esta pantalla llega quien entró con una contraseña temporal, la que
// el titular le dio en mano. Hasta que la cambie no puede usar nada: la
// API rechaza sus peticiones de negocio, así que esto no es un trámite
// que se pueda saltar navegando a otra ruta.
// =====================================================================

export function CambiarPassword() {
  const navigate = useNavigate();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nueva !== repetida) {
      setError('Las dos contraseñas nuevas no coinciden');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await api('/auth/password', {
        method: 'POST',
        body: JSON.stringify({ passwordActual: actual, passwordNueva: nueva }),
      });
      // El cambio revoca TODAS las sesiones, incluida esta: hay que
      // volver a entrar, y así se estrena la contraseña nueva.
      await cerrarSesion();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <PantallaAcceso>
      <h1 className="text-titulo font-semibold tracking-tight text-texto">
        Cambia tu contraseña
      </h1>
      <p className="mt-1.5 text-cuerpo text-texto-suave">
        Entraste con una contraseña temporal. Elige una propia para empezar a
        trabajar.
      </p>

      <form onSubmit={enviar} className="mt-7 space-y-4" noValidate>
        <Campo etiqueta="Contraseña temporal" htmlFor="actual" requerido>
          <Input
            id="actual"
            type="password"
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
        </Campo>
        <Campo
          etiqueta="Contraseña nueva"
          htmlFor="nueva"
          ayuda="Mínimo 10 caracteres, con letras y números"
          requerido
        >
          <Input
            id="nueva"
            type="password"
            autoComplete="new-password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Repite la nueva" htmlFor="repetida" requerido>
          <Input
            id="repetida"
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
          />
        </Campo>

        {error && <Aviso tono="peligro">{error}</Aviso>}

        <Boton type="submit" bloque cargando={enviando}>
          Guardar y volver a entrar
        </Boton>
      </form>
    </PantallaAcceso>
  );
}
