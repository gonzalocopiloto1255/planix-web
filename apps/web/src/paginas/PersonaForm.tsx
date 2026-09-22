import { zodResolver } from '@hookform/resolvers/zod';
import {
  personaInputSchema,
  type PersonaInput,
  type TipoVinculo,
} from '@planix/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm, type FieldErrors, type UseFormRegisterReturn } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import { ApiError } from '../lib/api';
import { actualizarPersona, crearPersona, obtenerPersona } from '../lib/personas';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

type PersonaFormValues = z.input<typeof personaInputSchema>;

const vacioAUndefined = { setValueAs: (v: unknown) => (v === '' ? undefined : v) };

function Campo({
  etiqueta,
  registro,
  error,
  tipo = 'text',
  nota,
}: {
  etiqueta: string;
  registro: UseFormRegisterReturn;
  error?: string;
  tipo?: string;
  nota?: string;
}) {
  return (
    <div>
      <label htmlFor={registro.name} className="block text-cuerpo font-medium text-texto">
        {etiqueta}
      </label>
      <input
        id={registro.name}
        type={tipo}
        className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo focus:border-primario focus:outline-none"
        {...registro}
      />
      {nota && !error && <p className="mt-1 text-apoyo text-texto-tenue">{nota}</p>}
      {error && <p className="mt-1 text-cuerpo text-peligro">{error}</p>}
    </div>
  );
}

function Selector({
  etiqueta,
  registro,
  opciones,
  error,
  nota,
  permitirVacio,
}: {
  etiqueta: string;
  registro: UseFormRegisterReturn;
  opciones: { valor: string; texto: string }[];
  error?: string;
  nota?: string;
  permitirVacio?: string;
}) {
  return (
    <div>
      <label htmlFor={registro.name} className="block text-cuerpo font-medium text-texto">
        {etiqueta}
      </label>
      <select
        id={registro.name}
        className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo focus:border-primario focus:outline-none"
        {...registro}
      >
        {permitirVacio !== undefined && <option value="">{permitirVacio}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
      {nota && !error && <p className="mt-1 text-apoyo text-texto-tenue">{nota}</p>}
      {error && <p className="mt-1 text-cuerpo text-peligro">{error}</p>}
    </div>
  );
}

export function PersonaForm() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const esEdicion = Boolean(id);
  const navigate = useNavigate();
  const empresa = useEmpresaActiva();
  const agregarToast = useToasts((s) => s.agregar);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoVinculo>(
    (params.get('tipo') as TipoVinculo) || 'PLANILLA',
  );

  const { data: existente } = useQuery({
    queryKey: ['persona', empresa.id, id],
    queryFn: () => obtenerPersona(empresa.id as string, id as string),
    enabled: esEdicion && Boolean(empresa.id),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors: erroresForm, isSubmitting },
  } = useForm<PersonaFormValues, unknown, PersonaInput>({
    resolver: zodResolver(personaInputSchema),
    shouldUnregister: true, // al cambiar de vínculo se descartan los campos ajenos
    defaultValues: { tipoVinculo: tipo, tipoDocumento: 'DNI' },
  });
  // Los errores llegan tipados por variante; se leen por nombre de campo
  const errors = erroresForm as FieldErrors<Record<string, unknown>>;
  const err = (campo: string) => errors[campo]?.message as string | undefined;

  useEffect(() => {
    if (existente) {
      setTipo(existente.tipoVinculo);
      reset({
        tipoVinculo: existente.tipoVinculo,
        tipoDocumento: existente.tipoDocumento as 'DNI' | 'CE',
        numeroDocumento: existente.numeroDocumento,
        nombres: existente.nombres,
        apellidos: existente.apellidos,
        fechaNacimiento: existente.fechaNacimiento?.slice(0, 10),
        nacionalidad: existente.nacionalidad,
        direccion: existente.direccion ?? undefined,
        email: existente.email ?? undefined,
        telefono: existente.telefono ?? undefined,
        ...(existente.tipoVinculo === 'PLANILLA'
          ? {
              cargo: existente.cargo ?? undefined,
              categoria: existente.categoria ?? 'EMPLEADO',
              periodicidadPago: existente.periodicidadPago ?? 'FIN_DE_MES',
              fechaIngreso: existente.fechaIngreso.slice(0, 10),
              regimenLaboral: existente.regimenLaboral ?? undefined,
              sueldoBasico: existente.sueldoBasico ?? '0',
              asignacionFamiliar: existente.asignacionFamiliar,
              jornadaNocturna: existente.jornadaNocturna,
              diasLaborablesSemana: existente.diasLaborablesSemana,
              sistemaPension: existente.sistemaPension ?? 'ONP',
              afp: existente.afp ?? undefined,
              cuspp: existente.cuspp ?? undefined,
              tipoComision: existente.tipoComision ?? undefined,
              afiliadoEps: existente.afiliadoEps,
              essaludVida: existente.essaludVida,
              ingresosTercerosAnual: existente.ingresosTercerosAnual ?? undefined,
              proyeccionHorasExtrasMes:
                existente.proyeccionHorasExtrasMes ?? undefined,
            }
          : existente.tipoVinculo === 'LOCADOR'
            ? {
                fechaIngreso: existente.fechaIngreso.slice(0, 10),
                rucLocador: existente.rucLocador ?? '',
                suspensionRetencion: existente.suspensionRetencion,
                suspensionConstancia: existente.suspensionConstancia ?? undefined,
                suspensionVigenteHasta: existente.suspensionVigenteHasta?.slice(0, 10),
              }
            : {
                subvencionMensual: existente.subvencionMensual ?? '0',
                convenioInicio: existente.convenioInicio?.slice(0, 10) ?? '',
                convenioFin: existente.convenioFin?.slice(0, 10) ?? '',
              }),
      } as PersonaFormValues);
    }
  }, [existente, reset]);

  const sistemaPension = watch('sistemaPension' as never) as unknown as string | undefined;
  const suspension = watch('suspensionRetencion' as never) as unknown as boolean | undefined;

  const onSubmit = handleSubmit(async (datos) => {
    setErrorGeneral(null);
    try {
      const resultado = esEdicion
        ? await actualizarPersona(empresa.id as string, id as string, datos)
        : await crearPersona(empresa.id as string, datos);
      agregarToast(
        'exito',
        `${resultado.persona.nombres} ${resultado.persona.apellidos} ${esEdicion ? 'actualizado' : 'registrado'}`,
      );
      for (const advertencia of resultado.advertencias) {
        agregarToast('advertencia', advertencia);
      }
      navigate(`/personas/${resultado.persona.id}`);
    } catch (e) {
      setErrorGeneral(e instanceof ApiError ? e.message : 'Error de conexión con el servidor');
    }
  });

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <p className="text-cuerpo text-texto-suave">
          Elige la empresa activa para registrar personas.{' '}
          <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-subtitulo font-semibold text-texto">
          {esEdicion ? 'Editar persona' : 'Nueva persona'} ·{' '}
          <span className="text-texto-tenue">{empresa.razonSocial}</span>
        </h1>
        <Link to="/personas" className="text-cuerpo text-primario hover:underline">
          ← Volver a personas
        </Link>
      </div>

      {!esEdicion && (
        <div className="flex gap-1 rounded-tarjeta bg-superficie p-1 shadow-tarjeta">
          {(['PLANILLA', 'LOCADOR', 'PRACTICANTE'] as TipoVinculo[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTipo(t);
                reset({ tipoVinculo: t, tipoDocumento: 'DNI' } as PersonaFormValues);
              }}
              className={`flex-1 rounded-control px-4 py-2 text-cuerpo font-medium ${
                tipo === t ? 'bg-primario text-white' : 'text-texto-suave hover:bg-fondo'
              }`}
            >
              {t === 'PLANILLA' ? 'Trabajador' : t === 'LOCADOR' ? 'Locador (4ta)' : 'Practicante'}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <input type="hidden" value={tipo} {...register('tipoVinculo')} />

        <section className="space-y-4 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
          <h2 className="text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
            Identificación
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Selector
              etiqueta="Tipo de documento"
              registro={register('tipoDocumento')}
              opciones={[
                { valor: 'DNI', texto: 'DNI' },
                { valor: 'CE', texto: 'Carné de extranjería' },
              ]}
              error={err('tipoDocumento')}
            />
            <Campo etiqueta="Número de documento" registro={register('numeroDocumento')} error={err('numeroDocumento')} />
            <Campo etiqueta="Fecha de nacimiento" tipo="date" registro={register('fechaNacimiento', vacioAUndefined)} error={err('fechaNacimiento')} />
            <Campo etiqueta="Nombres" registro={register('nombres')} error={err('nombres')} />
            <Campo etiqueta="Apellidos" registro={register('apellidos')} error={err('apellidos')} />
            <Campo etiqueta="Email (para boletas)" tipo="email" registro={register('email', vacioAUndefined)} error={err('email')} />
            {/* Nacionalidad: dato que pide el T-Registro (S20) */}
            <Campo etiqueta="Nacionalidad" registro={register('nacionalidad', vacioAUndefined)} error={err('nacionalidad')} />
          </div>
        </section>

        {tipo === 'PLANILLA' && (
          <section className="space-y-4 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
            <h2 className="text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
              Vínculo laboral
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="Cargo" registro={register('cargo' as never, vacioAUndefined)} error={err('cargo')} />
              <Selector
                etiqueta="Categoría"
                registro={register('categoria' as never)}
                opciones={[
                  { valor: 'EMPLEADO', texto: 'Empleado' },
                  { valor: 'OBRERO', texto: 'Obrero' },
                ]}
                error={err('categoria')}
              />
              <Selector
                etiqueta="Periodicidad de pago"
                registro={register('periodicidadPago' as never)}
                opciones={[
                  { valor: 'FIN_DE_MES', texto: 'Fin de mes' },
                  { valor: 'QUINCENAL', texto: 'Quincenal' },
                ]}
                nota="Quincenal: aparece en ambas quincenas"
                error={err('periodicidadPago')}
              />
              <Campo etiqueta="Fecha de ingreso" tipo="date" registro={register('fechaIngreso' as never)} error={err('fechaIngreso')} />
              <Selector
                etiqueta="Régimen laboral"
                registro={register('regimenLaboral' as never, vacioAUndefined)}
                permitirVacio="El de la empresa"
                opciones={[
                  { valor: 'GENERAL', texto: 'General' },
                  { valor: 'PEQUENA_EMPRESA', texto: 'Pequeña empresa' },
                  { valor: 'MICROEMPRESA', texto: 'Microempresa' },
                ]}
                nota="El del trabajador manda: se fija al contratar"
                error={err('regimenLaboral')}
              />
              <Campo etiqueta="Sueldo básico (S/)" registro={register('sueldoBasico' as never)} error={err('sueldoBasico')} />
              {/*
                «Días laborables por semana» se retiró en la S24: no decide
                el descuento del dominical de un trabajador mensual. Ver la
                nota del formulario de empresa.
              */}
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-cuerpo text-texto">
                <input type="checkbox" {...register('asignacionFamiliar' as never)} />
                Asignación familiar
                <span className="text-apoyo text-texto-tenue">(10% de la RMV, se calcula sola)</span>
              </label>
              <label className="flex items-center gap-2 text-cuerpo text-texto">
                <input type="checkbox" {...register('jornadaNocturna' as never)} />
                Jornada nocturna
                <span className="text-apoyo text-texto-tenue">(mínimo RMV × 1.35)</span>
              </label>
            </div>

            <h2 className="pt-2 text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
              Sistema pensionario
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Selector
                etiqueta="Sistema de pensión"
                registro={register('sistemaPension' as never)}
                opciones={[
                  { valor: 'ONP', texto: 'ONP (13%)' },
                  { valor: 'AFP', texto: 'AFP' },
                  { valor: 'JUBILADO_AFP', texto: 'Jubilado AFP (sin descuento)' },
                  { valor: 'JUBILADO_ONP', texto: 'Jubilado ONP (sin descuento)' },
                ]}
                error={err('sistemaPension')}
              />
              {sistemaPension === 'AFP' && (
                <>
                  <Selector
                    etiqueta="AFP"
                    registro={register('afp' as never, vacioAUndefined)}
                    permitirVacio="—"
                    opciones={['HABITAT', 'INTEGRA', 'PRIMA', 'PROFUTURO'].map((a) => ({ valor: a, texto: a }))}
                    error={err('afp')}
                  />
                  <Campo etiqueta="CUSPP" registro={register('cuspp' as never, vacioAUndefined)} nota="12 caracteres" error={err('cuspp')} />
                  <Selector
                    etiqueta="Tipo de comisión"
                    registro={register('tipoComision' as never, vacioAUndefined)}
                    permitirVacio="—"
                    opciones={[
                      { valor: 'FLUJO', texto: 'FLUJO (se descuenta en planilla)' },
                      { valor: 'MIXTA', texto: 'MIXTA (no se descuenta en planilla)' },
                    ]}
                    nota="MIXTA: la comisión la cobra la AFP del fondo"
                    error={err('tipoComision')}
                  />
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-cuerpo text-texto">
                <input type="checkbox" {...register('afiliadoEps' as never)} />
                Afiliado a EPS
              </label>
              <label className="flex items-center gap-2 text-cuerpo text-texto">
                <input type="checkbox" {...register('essaludVida' as never)} />
                EsSalud+Vida
                <span className="text-apoyo text-texto-tenue">(descuento fijo mensual)</span>
              </label>
            </div>
            {/*
              Renta de 5.ª. Estos dos campos EXISTEN en la base desde hace
              tiempo y no estaban en el formulario, que es el mismo agujero
              que se documentó con el redondeo de la empresa: una columna
              que nadie puede editar no es configuración.
            */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etiqueta="Ingresos anuales de otros empleadores (S/)"
                registro={register('ingresosTercerosAnual' as never, vacioAUndefined)}
                nota="Para proyectar la retención de 5.ª. Déjalo vacío si solo trabaja aquí."
                error={err('ingresosTercerosAnual')}
              />
              <Campo
                etiqueta="Horas extras esperadas al mes (S/)"
                registro={register('proyeccionHorasExtrasMes' as never, vacioAUndefined)}
                nota="Solo si hace horas TODOS los meses. Vacío = no se proyectan, que es lo normado."
                error={err('proyeccionHorasExtrasMes')}
              />
            </div>
          </section>
        )}

        {tipo === 'LOCADOR' && (
          <section className="space-y-4 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
            <h2 className="text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
              Locador de servicios (4ta categoría)
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etiqueta="RUC"
                registro={register('rucLocador' as never)}
                nota="11 dígitos, empieza en 10"
                error={err('rucLocador')}
              />
              <Campo etiqueta="Inicio de servicios" tipo="date" registro={register('fechaIngreso' as never)} error={err('fechaIngreso')} />
            </div>
            <label className="flex items-center gap-2 text-cuerpo text-texto">
              <input type="checkbox" {...register('suspensionRetencion' as never)} />
              Tiene suspensión de retenciones (Formulario 1609)
              <span className="text-apoyo text-texto-tenue">— sin ella se retiene 8% si el recibo supera S/ 1,500</span>
            </label>
            {suspension && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="N° de constancia" registro={register('suspensionConstancia' as never, vacioAUndefined)} error={err('suspensionConstancia')} />
                <Campo
                  etiqueta="Vigente hasta"
                  tipo="date"
                  registro={register('suspensionVigenteHasta' as never, vacioAUndefined)}
                  nota="Caduca cada 31 de diciembre"
                  error={err('suspensionVigenteHasta')}
                />
              </div>
            )}
          </section>
        )}

        {tipo === 'PRACTICANTE' && (
          <section className="space-y-4 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
            <h2 className="text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
              Convenio de prácticas (Ley 28518)
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo
                etiqueta="Subvención mensual (S/)"
                registro={register('subvencionMensual' as never)}
                nota="No menor a la RMV en jornada completa"
                error={err('subvencionMensual')}
              />
              <Campo etiqueta="Convenio: inicio" tipo="date" registro={register('convenioInicio' as never)} error={err('convenioInicio')} />
              <Campo etiqueta="Convenio: fin" tipo="date" registro={register('convenioFin' as never)} error={err('convenioFin')} />
            </div>
            <p className="text-apoyo text-texto-tenue">
              Media subvención adicional por cada 6 meses continuos; sin CTS, gratificación ni descuento AFP/ONP.
            </p>
          </section>
        )}

        {esEdicion && (
          <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
            <Campo
              etiqueta="Fecha efectiva del cambio (opcional)"
              tipo="date"
              registro={register('vigenteDesde', vacioAUndefined)}
              nota="Si es futura (ej. aumento desde el 1 del mes que viene), el cambio queda programado y se aplicará en esa fecha"
              error={err('vigenteDesde')}
            />
          </section>
        )}

        {errorGeneral && (
          <p className="rounded-control bg-peligro-suave px-3 py-2 text-cuerpo text-peligro">{errorGeneral}</p>
        )}

        <div className="flex justify-end gap-3">
          <Link
            to="/personas"
            className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
