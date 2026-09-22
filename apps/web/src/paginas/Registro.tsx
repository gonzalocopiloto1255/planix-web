import { zodResolver } from '@hookform/resolvers/zod';
import {
  registroSchema,
  sesionSchema,
  validarDigitoVerificadorRuc,
  type RegistroInput,
} from '@planix/shared-types';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { PantallaAcceso } from '../componentes/PantallaAcceso';
import { Aviso, Boton, Campo, cx, Input } from '../componentes/ui';
import { ApiError } from '../lib/api';
import { useAuth } from '../stores/auth';

export function Registro() {
  const navigate = useNavigate();
  const setSesion = useAuth((s) => s.setSesion);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegistroInput>({
    resolver: zodResolver(registroSchema),
    defaultValues: { tipo: 'ESTUDIO_CONTABLE' },
  });

  // De esto depende TODO el alta: si es EMPRESA se le crea sola su única
  // empresa cliente y nunca se le habla de "empresas cliente". Por eso la
  // pregunta va primero y en lenguaje llano, no como un desplegable de
  // "tipo de cuenta" que nadie sabe qué significa.
  const tipo = watch('tipo');
  const esEmpresa = tipo === 'EMPRESA';

  // Mismo criterio que la ficha de empresa: el dígito verificador AVISA,
  // no bloquea. SUNAT tiene RUC que no cumplen el algoritmo y frenar un
  // alta por eso sería peor que el problema que evita.
  const ruc = watch('rucEstudio');
  const rucConDigitoRaro =
    typeof ruc === 'string' &&
    /^(10|20)\d{9}$/.test(ruc) &&
    !validarDigitoVerificadorRuc(ruc);

  const onSubmit = handleSubmit(async (datos) => {
    setErrorGeneral(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      if (!res.ok) {
        throw new ApiError(
          res.status,
          res.status === 409
            ? 'Ya existe una cuenta con ese correo'
            : res.status === 429
              ? 'Demasiados intentos. Espera un minuto antes de volver a probar.'
              : 'No se pudo completar el registro, intenta de nuevo',
        );
      }
      setSesion(sesionSchema.parse(await res.json()));
      // A la bienvenida y no al panel: ve los planes antes de empezar,
      // sin que nada le bloquee el paso (S23.5).
      navigate('/bienvenida', { replace: true });
    } catch (e) {
      setErrorGeneral(
        e instanceof ApiError ? e.message : 'Error de conexión con el servidor',
      );
    }
  });

  return (
    <PantallaAcceso>
      <h1 className="text-titulo font-semibold tracking-tight text-texto">
        Crea tu cuenta
      </h1>
      <p className="mt-1.5 text-cuerpo text-texto-suave">
        Empieza con 30 días de prueba, sin tarjeta
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
        <fieldset>
          <legend className="text-apoyo font-medium text-texto-suave">
            ¿Cómo usarás Planix?
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  valor: 'ESTUDIO_CONTABLE',
                  titulo: 'Llevo las planillas de varias empresas',
                  pie: 'Estudio contable',
                },
                {
                  valor: 'EMPRESA',
                  titulo: 'Llevo la planilla de mi empresa',
                  pie: 'Empresa',
                },
              ] as const
            ).map((opcion) => (
              <label
                key={opcion.valor}
                className={cx(
                  'transicion flex cursor-pointer flex-col gap-1 rounded-control border p-3',
                  tipo === opcion.valor
                    ? 'border-primario bg-primario-suave'
                    : 'border-borde hover:border-borde-fuerte',
                )}
              >
                <span className="flex items-start gap-2">
                  <input
                    type="radio"
                    value={opcion.valor}
                    className="mt-1"
                    {...register('tipo')}
                  />
                  <span className="text-cuerpo font-medium text-texto">
                    {opcion.titulo}
                  </span>
                </span>
                <span className="pl-6 text-apoyo text-texto-tenue">{opcion.pie}</span>
              </label>
            ))}
          </div>
          {errors.tipo && (
            <p className="mt-1 text-apoyo text-peligro" role="alert">
              {errors.tipo.message}
            </p>
          )}
        </fieldset>

        <Campo
          etiqueta={esEmpresa ? 'Razón social de tu empresa' : 'Nombre del estudio contable'}
          htmlFor="nombreEstudio"
          error={errors.nombreEstudio?.message}
          requerido
        >
          <Input
            id="nombreEstudio"
            autoComplete="organization"
            placeholder={
              esEmpresa ? 'Comercial Los Andes S.A.C.' : 'Contabilidad y Asesoría SAC'
            }
            error={Boolean(errors.nombreEstudio)}
            {...register('nombreEstudio')}
          />
        </Campo>

        <Campo
          etiqueta={esEmpresa ? 'RUC de tu empresa' : 'RUC del estudio'}
          htmlFor="rucEstudio"
          error={errors.rucEstudio?.message}
          ayuda={
            esEmpresa
              ? 'Con este RUC se crea tu empresa en Planix'
              : 'Empieza en 10 (persona natural) o 20 (jurídica)'
          }
          requerido
        >
          <Input
            id="rucEstudio"
            inputMode="numeric"
            placeholder="20123456789"
            error={Boolean(errors.rucEstudio)}
            className="cifras"
            {...register('rucEstudio')}
          />
          {/* El dígito verificador AVISA pero no bloquea, igual que en la
              ficha de empresa: SUNAT tiene RUC que no cumplen el algoritmo
              y frenar un alta por eso sería peor que el problema. */}
          {rucConDigitoRaro && (
            <p className="mt-1 rounded bg-advertencia-suave px-2 py-1 text-apoyo text-advertencia">
              El dígito verificador no cuadra con el algoritmo de SUNAT. Puedes
              continuar, pero revisa que esté bien digitado.
            </p>
          )}
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo
            etiqueta="Nombres"
            htmlFor="nombres"
            error={errors.nombres?.message}
            requerido
          >
            <Input
              id="nombres"
              autoComplete="given-name"
              error={Boolean(errors.nombres)}
              {...register('nombres')}
            />
          </Campo>
          <Campo
            etiqueta="Apellidos"
            htmlFor="apellidos"
            error={errors.apellidos?.message}
            requerido
          >
            <Input
              id="apellidos"
              autoComplete="family-name"
              error={Boolean(errors.apellidos)}
              {...register('apellidos')}
            />
          </Campo>
        </div>

        <Campo
          etiqueta="Correo electrónico"
          htmlFor="email"
          error={errors.email?.message}
          requerido
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
          ayuda="Mínimo 10 caracteres, con letras y números"
          requerido
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••"
            error={Boolean(errors.password)}
            {...register('password')}
          />
        </Campo>

        {/* Consentimiento informado (Ley 29733, S23): obligatorio y bien
            visible. Queda registrado con su versión, la fecha y la IP. */}
        <div
          className={`rounded-tarjeta border p-3.5 ${
            errors.aceptaTerminos
              ? 'border-peligro/40 bg-peligro-suave'
              : 'border-borde bg-fondo'
          }`}
        >
          <label className="flex items-start gap-2.5 text-apoyo text-texto-suave">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-borde-fuerte text-primario accent-primario"
              {...register('aceptaTerminos')}
            />
            <span>
              He leído y acepto los{' '}
              <Link
                to="/terminos"
                target="_blank"
                className="font-medium text-primario hover:underline"
              >
                Términos de Servicio
              </Link>{' '}
              y el{' '}
              <Link
                to="/privacidad"
                target="_blank"
                className="font-medium text-primario hover:underline"
              >
                Aviso de Privacidad
              </Link>
              .
            </span>
          </label>
          {errors.aceptaTerminos && (
            <p className="mt-1.5 text-apoyo font-medium text-peligro" role="alert">
              {errors.aceptaTerminos.message}
            </p>
          )}
        </div>

        {errorGeneral && (
          <Aviso tono="peligro" icono={<UserPlus className="size-4" />}>
            {errorGeneral}
          </Aviso>
        )}

        <Boton type="submit" bloque cargando={isSubmitting}>
          Crear cuenta
        </Boton>
      </form>

      <p className="mt-6 text-center text-cuerpo text-texto-suave">
        ¿Ya tienes cuenta?{' '}
        <Link
          to="/login"
          className="transicion font-medium text-primario hover:text-primario-oscuro hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </PantallaAcceso>
  );
}
