import { zodResolver } from '@hookform/resolvers/zod';
import {
  exigeSegundoFactor,
  loginSchema,
  sesionSchema,
  type DesafioLoginDto,
  type LoginInput,
  type RespuestaLogin,
  type Sesion,
} from '@planix/shared-types';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { PantallaAcceso } from '../componentes/PantallaAcceso';
import { Aviso, Boton, Campo, Input } from '../componentes/ui';
import { ApiError } from '../lib/api';
import { completarLogin2fa } from '../lib/seguridad';
import { useAuth } from '../stores/auth';

/**
 * Paso extra del login cuando el usuario tiene 2FA (S23). Acepta el código
 * de la app o uno de respaldo; el desafío caduca a los 5 minutos.
 */
function SegundoFactor({
  desafio,
  onListo,
  onCancelar,
}: {
  desafio: string;
  onListo: (sesion: Sesion) => void;
  onCancelar: () => void;
}) {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const verificar = async () => {
    setEnviando(true);
    setError(null);
    try {
      onListo(sesionSchema.parse(await completarLogin2fa(desafio, codigo)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo verificar el código');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <PantallaAcceso>
      <div className="mb-6 grid size-11 place-items-center rounded-tarjeta bg-primario-suave text-primario">
        <ShieldCheck className="size-5.5" />
      </div>
      <h1 className="text-titulo font-semibold tracking-tight text-texto">
        Verificación en dos pasos
      </h1>
      <p className="mt-1.5 text-cuerpo text-texto-suave">
        Ingresa el código de tu app de autenticación. Si no tienes el teléfono a
        mano, usa uno de tus códigos de respaldo.
      </p>

      <form
        className="mt-7 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void verificar();
        }}
      >
        <Campo etiqueta="Código de verificación" htmlFor="codigo" error={error ?? undefined}>
          <Input
            id="codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoComplete="one-time-code"
            inputMode="numeric"
            autoFocus
            placeholder="000000"
            error={Boolean(error)}
            className="cifras text-center text-subtitulo tracking-[0.3em]"
          />
        </Campo>

        <Boton
          type="submit"
          bloque
          cargando={enviando}
          disabled={codigo.trim().length < 6}
        >
          Verificar e ingresar
        </Boton>
        <Boton variante="fantasma" bloque onClick={onCancelar}>
          Volver
        </Boton>
      </form>
    </PantallaAcceso>
  );
}

export function Login() {
  const navigate = useNavigate();
  const setSesion = useAuth((s) => s.setSesion);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [desafio, setDesafio] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (datos) => {
    setErrorGeneral(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      if (!res.ok) {
        throw new ApiError(
          res.status,
          res.status === 401
            ? 'Correo o contraseña incorrectos'
            : res.status === 429
              ? 'Demasiados intentos. Espera un minuto antes de volver a probar.'
              : 'No se pudo iniciar sesión, intenta de nuevo',
        );
      }
      const cuerpo = (await res.json()) as unknown;
      // Con 2FA activo el servidor NO manda tokens: manda el desafío (§12)
      if (exigeSegundoFactor(cuerpo as RespuestaLogin)) {
        setDesafio((cuerpo as DesafioLoginDto).desafio);
        return;
      }
      setSesion(sesionSchema.parse(cuerpo));
      navigate('/', { replace: true });
    } catch (e) {
      setErrorGeneral(
        e instanceof ApiError ? e.message : 'Error de conexión con el servidor',
      );
    }
  });

  // Segundo paso: el desafío por sí solo no da acceso, hace falta el código
  if (desafio) {
    return (
      <SegundoFactor
        desafio={desafio}
        onCancelar={() => setDesafio(null)}
        onListo={(sesion) => {
          setSesion(sesion);
          navigate('/', { replace: true });
        }}
      />
    );
  }

  return (
    <PantallaAcceso>
      <h1 className="text-titulo font-semibold tracking-tight text-texto">
        Inicia sesión
      </h1>
      <p className="mt-1.5 text-cuerpo text-texto-suave">
        Entra a la cuenta de tu estudio contable
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
        <Campo
          etiqueta="Correo electrónico"
          htmlFor="email"
          error={errors.email?.message}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@estudio.pe"
            error={Boolean(errors.email)}
            {...register('email')}
          />
        </Campo>

        <Campo
          etiqueta="Contraseña"
          htmlFor="password"
          error={errors.password?.message}
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••"
            error={Boolean(errors.password)}
            {...register('password')}
          />
        </Campo>

        {errorGeneral && (
          <Aviso tono="peligro" icono={<KeyRound className="size-4" />}>
            {errorGeneral}
          </Aviso>
        )}

        <Boton type="submit" bloque cargando={isSubmitting}>
          Ingresar
        </Boton>
      </form>

      <p className="mt-6 text-center text-cuerpo text-texto-suave">
        ¿Aún no tienes cuenta?{' '}
        <Link
          to="/registro"
          className="transicion font-medium text-primario hover:text-primario-oscuro hover:underline"
        >
          Registra tu estudio
        </Link>
      </p>
    </PantallaAcceso>
  );
}
