import { zodResolver } from '@hookform/resolvers/zod';
import {
  empresaInputSchema,
  validarDigitoVerificadorRuc,
  type EmpresaInput,
} from '@planix/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { z } from 'zod';
import { ApiError } from '../lib/api';
import { actualizarEmpresa, crearEmpresa, obtenerEmpresa } from '../lib/empresas';
import { useToasts } from '../stores/toast';

const REGIMENES: { valor: EmpresaInput['regimenLaboral']; nombre: string; descripcion: string }[] = [
  {
    valor: 'GENERAL',
    nombre: 'Régimen general',
    descripcion: 'CTS y gratificaciones completas · 30 días de vacaciones',
  },
  {
    valor: 'PEQUENA_EMPRESA',
    nombre: 'Pequeña empresa (REMYPE)',
    descripcion: 'Media CTS y media gratificación · 15 días de vacaciones',
  },
  {
    valor: 'MICROEMPRESA',
    nombre: 'Microempresa (REMYPE)',
    descripcion: 'Sin CTS ni gratificaciones · 15 días de vacaciones',
  },
];

const UTILIDADES: { valor: '0.05' | '0.08' | '0.10'; etiqueta: string }[] = [
  { valor: '0.10', etiqueta: '10% — pesca, telecomunicaciones e industria' },
  { valor: '0.08', etiqueta: '8% — minería y comercio' },
  { valor: '0.05', etiqueta: '5% — otras actividades' },
];

/** Índices de `Date.getUTCDay()`: 0 = domingo. */
const DIAS_SEMANA = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

const BANCOS = ['BCP', 'BBVA', 'INTERBANK', 'SCOTIABANK', 'BANBIF', 'PICHINCHA', 'OTRO'] as const;

/** El schema tiene defaults: el form trabaja con el tipo de ENTRADA de Zod */
type EmpresaFormValues = z.input<typeof empresaInputSchema>;

/** '' → undefined para los campos opcionales del schema compartido */
const vacioAUndefined = { setValueAs: (v: unknown) => (v === '' ? undefined : v) };

interface CampoTextoProps {
  etiqueta: string;
  registro: UseFormRegisterReturn;
  error?: string;
  nota?: string;
  placeholder?: string;
}

function CampoTexto({ etiqueta, registro, error, nota, placeholder }: CampoTextoProps) {
  return (
    <div>
      <label htmlFor={registro.name} className="block text-cuerpo font-medium text-texto">
        {etiqueta}
      </label>
      <input
        id={registro.name}
        type="text"
        placeholder={placeholder}
        className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo focus:border-primario focus:outline-none"
        {...registro}
      />
      {nota && !error && <p className="mt-1 text-apoyo text-texto-tenue">{nota}</p>}
      {error && <p className="mt-1 text-cuerpo text-peligro">{error}</p>}
    </div>
  );
}

export function EmpresaForm() {
  const { id } = useParams<{ id: string }>();
  const esEdicion = Boolean(id);
  const navigate = useNavigate();
  const agregarToast = useToasts((s) => s.agregar);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const { data: existente } = useQuery({
    queryKey: ['empresa', id],
    queryFn: () => obtenerEmpresa(id as string),
    enabled: esEdicion,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EmpresaFormValues, unknown, EmpresaInput>({
    resolver: zodResolver(empresaInputSchema),
    defaultValues: {
      tieneEps: false,
      aportaSenati: false,
      buenContribuyente: false,
      regimenLaboral: 'GENERAL',
      jornadaDiariaHoras: 8,
      // El flujo de la contadora: la quincena paga la mitad de todo (S20)
      modalidadPrimeraQuincena: 'MITAD_DE_TODO',
      diasLaborablesSemana: 6,
      diaDescansoSemanal: 0,
      redondeoRetencion5ta: 'SIN_REDONDEO',
    },
  });

  useEffect(() => {
    if (existente) {
      reset({
        ruc: existente.ruc,
        razonSocial: existente.razonSocial,
        nombreComercial: existente.nombreComercial ?? undefined,
        direccion: existente.direccion ?? undefined,
        regimenLaboral: existente.regimenLaboral,
        tieneEps: existente.tieneEps,
        epsNombre: existente.epsNombre ?? undefined,
        tasaSctrSalud: existente.tasaSctrSalud ?? undefined,
        tasaSctrPension: existente.tasaSctrPension ?? undefined,
        primaVidaLey: existente.primaVidaLey ?? undefined,
        aportaSenati: existente.aportaSenati,
        buenContribuyente: existente.buenContribuyente,
        porcentajeUtilidades:
          (existente.porcentajeUtilidades as EmpresaInput['porcentajeUtilidades']) ?? undefined,
        jornadaDiariaHoras: Number(existente.jornadaDiariaHoras),
        bancoHaberes:
          (existente.bancoHaberes as EmpresaInput['bancoHaberes']) ?? undefined,
        modalidadPrimeraQuincena: existente.modalidadPrimeraQuincena,
        diasLaborablesSemana: existente.diasLaborablesSemana,
        diaDescansoSemanal: existente.diaDescansoSemanal,
        redondeoRetencion5ta: existente.redondeoRetencion5ta,
      });
    }
  }, [existente, reset]);

  const tieneEps = watch('tieneEps');
  const ruc = watch('ruc');
  const rucConTypo =
    typeof ruc === 'string' && /^(10|20)\d{9}$/.test(ruc) && !validarDigitoVerificadorRuc(ruc);

  const onSubmit = handleSubmit(async (datos) => {
    setErrorGeneral(null);
    try {
      const resultado = esEdicion
        ? await actualizarEmpresa(id as string, datos)
        : await crearEmpresa(datos);
      agregarToast(
        'exito',
        esEdicion
          ? `${resultado.empresa.razonSocial} actualizada`
          : `${resultado.empresa.razonSocial} registrada`,
      );
      for (const advertencia of resultado.advertencias) {
        agregarToast('advertencia', advertencia);
      }
      navigate('/empresas');
    } catch (e) {
      setErrorGeneral(
        e instanceof ApiError ? e.message : 'Error de conexión con el servidor',
      );
    }
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-subtitulo font-semibold text-texto">
          {esEdicion ? 'Editar empresa' : 'Nueva empresa cliente'}
        </h1>
        <Link to="/empresas" className="text-cuerpo text-primario hover:underline">
          ← Volver a empresas
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {/* ------------------- Datos generales ------------------- */}
        <section className="space-y-4 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
          <h2 className="text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
            Datos generales
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <CampoTexto
                etiqueta="RUC"
                registro={register('ruc')}
                error={errors.ruc?.message}
                placeholder="20123456789"
              />
              {rucConTypo && (
                <p className="mt-1 rounded bg-advertencia-suave px-2 py-1 text-apoyo text-advertencia">
                  El dígito verificador no cuadra con el algoritmo de SUNAT.
                  Puedes guardar igual, pero revisa que esté bien digitado.
                </p>
              )}
            </div>
            <CampoTexto
              etiqueta="Razón social"
              registro={register('razonSocial')}
              error={errors.razonSocial?.message}
            />
            <CampoTexto
              etiqueta="Nombre comercial (opcional)"
              registro={register('nombreComercial', vacioAUndefined)}
              error={errors.nombreComercial?.message}
            />
            <CampoTexto
              etiqueta="Dirección (opcional)"
              registro={register('direccion', vacioAUndefined)}
              error={errors.direccion?.message}
            />
          </div>

          <fieldset>
            <legend className="text-cuerpo font-medium text-texto">Régimen laboral</legend>
            <div className="mt-2 space-y-2">
              {REGIMENES.map((r) => (
                <label
                  key={r.valor}
                  className="flex cursor-pointer items-start gap-3 rounded-control border border-borde p-3 hover:bg-fondo"
                >
                  <input
                    type="radio"
                    value={r.valor}
                    className="mt-1"
                    {...register('regimenLaboral')}
                  />
                  <span>
                    <span className="block text-cuerpo font-medium text-texto">{r.nombre}</span>
                    <span className="block text-apoyo text-texto-suave">{r.descripcion}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        {/* ------------------- Salud y seguros ------------------- */}
        <section className="space-y-4 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
          <h2 className="text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
            Salud y seguros
          </h2>
          <label className="flex items-center gap-2 text-cuerpo text-texto">
            <input type="checkbox" {...register('tieneEps')} />
            La empresa tiene convenio con una EPS
          </label>
          {tieneEps && (
            <CampoTexto
              etiqueta="Nombre de la EPS"
              registro={register('epsNombre', vacioAUndefined)}
              error={errors.epsNombre?.message}
              placeholder="Rimac EPS, Pacífico EPS…"
            />
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoTexto
              etiqueta="Tasa SCTR salud"
              registro={register('tasaSctrSalud', vacioAUndefined)}
              error={errors.tasaSctrSalud?.message}
              nota="Entre 0 y 0.05 según riesgo"
              placeholder="0.0123"
            />
            <CampoTexto
              etiqueta="Tasa SCTR pensión"
              registro={register('tasaSctrPension', vacioAUndefined)}
              error={errors.tasaSctrPension?.message}
              nota="Entre 0 y 0.05 según riesgo"
              placeholder="0.0117"
            />
            <CampoTexto
              etiqueta="Prima Vida Ley"
              registro={register('primaVidaLey', vacioAUndefined)}
              error={errors.primaVidaLey?.message}
              nota="Según póliza"
              placeholder="0.0071"
            />
          </div>
          <label className="flex items-center gap-2 text-cuerpo text-texto">
            <input type="checkbox" {...register('aportaSenati')} />
            Aporta SENATI
            <span className="text-apoyo text-texto-tenue">
              (solo industriales con más de 20 trabajadores)
            </span>
          </label>
          <label className="flex items-center gap-2 text-cuerpo text-texto">
            <input type="checkbox" {...register('buenContribuyente')} />
            Buen contribuyente
            <span className="text-apoyo text-texto-tenue">
              (SUNAT le da fechas de vencimiento distintas)
            </span>
          </label>
        </section>

        {/* ------------------- Configuración ------------------- */}
        <section className="space-y-4 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
          <h2 className="text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
            Configuración
          </h2>
          <div>
            <label htmlFor="porcentajeUtilidades" className="block text-cuerpo font-medium text-texto">
              Participación de utilidades (si aplica)
            </label>
            <select
              id="porcentajeUtilidades"
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo focus:border-primario focus:outline-none"
              {...register('porcentajeUtilidades', vacioAUndefined)}
            >
              <option value="">No reparte utilidades</option>
              {UTILIDADES.map((u) => (
                <option key={u.valor} value={u.valor}>
                  {u.etiqueta}
                </option>
              ))}
            </select>
            {errors.porcentajeUtilidades && (
              <p className="mt-1 text-cuerpo text-peligro">{errors.porcentajeUtilidades.message}</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="jornadaDiariaHoras" className="block text-cuerpo font-medium text-texto">
                Jornada diaria (horas)
              </label>
              <input
                id="jornadaDiariaHoras"
                type="number"
                step="0.5"
                min={4}
                max={12}
                className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo focus:border-primario focus:outline-none"
                {...register('jornadaDiariaHoras', { valueAsNumber: true })}
              />
              {errors.jornadaDiariaHoras && (
                <p className="mt-1 text-cuerpo text-peligro">{errors.jornadaDiariaHoras.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="bancoHaberes" className="block text-cuerpo font-medium text-texto">
                Banco de pago de haberes
              </label>
              <select
                id="bancoHaberes"
                className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo focus:border-primario focus:outline-none"
                {...register('bancoHaberes', vacioAUndefined)}
              >
                <option value="">Sin definir</option>
                {BANCOS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/*
            AQUÍ ESTABA «Días laborables por semana», y se retiró en la S24.
            Su texto prometía que determinaba cuánto dominical se pierde por
            falta, y eso es FALSO para un trabajador mensual o quincenal: el
            art. 2 del D.S. 012-92-TR divide entre los días del PERÍODO DE
            PAGO (30 o 15), no entre los de la semana. La columna sigue en la
            base —es el divisor del art. 1, el de los semanales y
            destajeros—, pero mientras Planix no represente esos vínculos no
            hay nada que configurar y un campo que no hace nada es peor que
            no tenerlo.
          */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="diaDescansoSemanal"
                className="block text-cuerpo font-medium text-texto"
              >
                Día de descanso semanal
              </label>
              <select
                id="diaDescansoSemanal"
                className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo focus:border-primario focus:outline-none"
                {...register('diaDescansoSemanal', { valueAsNumber: true })}
              >
                {DIAS_SEMANA.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-menor text-texto-suave">
                Si el 1 de mayo cae en este día, la ley manda pagar un jornal más
                por el feriado, además del descanso (D.S. 012-92-TR art. 9).
              </p>
            </div>
          </div>
          <div>
            <label
              htmlFor="redondeoRetencion5ta"
              className="block text-cuerpo font-medium text-texto"
            >
              Redondeo de la retención de 5.ª categoría
            </label>
            <select
              id="redondeoRetencion5ta"
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo focus:border-primario focus:outline-none"
              {...register('redondeoRetencion5ta')}
            >
              <option value="SIN_REDONDEO">Sin redondeo — dos decimales</option>
              <option value="ENTERO_NORMAL">Al sol más cercano</option>
              <option value="ENTERO_ARRIBA">Siempre al sol de arriba</option>
            </select>
            <p className="mt-1 text-menor text-texto-suave">
              <strong>Ninguna norma de SUNAT lo impone.</strong> La ley define el
              método —proyección, 7 UIT, tramos, divisores— pero no el redondeo. En el
              PDT los tributos se declaran en soles enteros, y de ahí que muchos
              estudios redondeen la boleta para que cuadre con lo declarado. Elige el
              criterio del tuyo.
            </p>
          </div>
          <div>
            <label
              htmlFor="modalidadPrimeraQuincena"
              className="block text-cuerpo font-medium text-texto"
            >
              Pago de la primera quincena
            </label>
            <select
              id="modalidadPrimeraQuincena"
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo focus:border-primario focus:outline-none"
              {...register('modalidadPrimeraQuincena')}
            >
              <option value="MITAD_DE_TODO">
                Mitad de TODO el sueldo (50% de cada concepto)
              </option>
              <option value="ADELANTO_BASICO">
                Adelanto del básico (los conceptos mensuales se pagan al cerrar el mes)
              </option>
            </select>
            <p className="mt-1 text-apoyo text-texto-suave">
              Con &ldquo;mitad de todo&rdquo; cada quincena paga el 50% de la asignación
              familiar, del EsSalud y de la retención de 5ta; con &ldquo;adelanto&rdquo; esos
              conceptos van completos en el periodo que cierra el mes.
            </p>
          </div>
        </section>

        {errorGeneral && (
          <p className="rounded-control bg-peligro-suave px-3 py-2 text-cuerpo text-peligro">{errorGeneral}</p>
        )}

        <div className="flex justify-end gap-3">
          <Link
            to="/empresas"
            className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Registrar empresa'}
          </button>
        </div>
      </form>
    </div>
  );
}
