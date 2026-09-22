import { SkeletonTabla } from '../componentes/ui';
import type {
  CuentaBancariaInput,
  MotivoCese,
  RetencionJudicialInput,
  TipoCuentaBancaria,
} from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SeccionContratos } from '../componentes/SeccionContratos';
import { ApiError } from '../lib/api';
import { crearRetencion, desactivarRetencion, listarRetenciones } from '../lib/judiciales';
import { abrirCertificado5ta, cesarPersona } from '../lib/liquidaciones';
import {
  guardarCuenta,
  historialPersona,
  listarCuentas,
  obtenerPersona,
} from '../lib/personas';
import { soles } from '../lib/planillas';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

const NOMBRE_CAMPO: Record<string, string> = {
  sueldoBasico: 'Sueldo básico',
  cargo: 'Cargo',
  categoria: 'Categoría',
  sistemaPension: 'Sistema de pensión',
  afp: 'AFP',
  tipoComision: 'Tipo de comisión',
  regimenLaboral: 'Régimen laboral',
  periodicidadPago: 'Periodicidad de pago',
  asignacionFamiliar: 'Asignación familiar',
  afiliadoEps: 'Afiliado EPS',
};

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  if (!valor) {
    return null;
  }
  return (
    <div>
      <dt className="text-apoyo uppercase text-texto-tenue">{etiqueta}</dt>
      <dd className="text-cuerpo font-medium text-texto">{valor}</dd>
    </div>
  );
}

function FormCuenta({
  tipo,
  personaId,
}: {
  tipo: TipoCuentaBancaria;
  personaId: string;
}) {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [datos, setDatos] = useState<CuentaBancariaInput>({
    banco: '',
    numero: '',
    moneda: 'PEN',
  });

  const guardar = useMutation({
    mutationFn: () => guardarCuenta(empresa.id as string, personaId, tipo, {
      ...datos,
      cci: datos.cci || undefined,
    }),
    onSuccess: () => {
      agregarToast('exito', `Cuenta ${tipo} guardada`);
      void queryClient.invalidateQueries({ queryKey: ['cuentas', personaId] });
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo guardar la cuenta'),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guardar.mutate();
      }}
      className="grid gap-2 sm:grid-cols-5"
    >
      <input
        placeholder="Banco"
        value={datos.banco}
        onChange={(e) => setDatos({ ...datos, banco: e.target.value })}
        className="rounded-control border border-borde-fuerte px-2 py-1.5 text-cuerpo"
      />
      <input
        placeholder="N° de cuenta"
        value={datos.numero}
        onChange={(e) => setDatos({ ...datos, numero: e.target.value })}
        className="rounded-control border border-borde-fuerte px-2 py-1.5 text-cuerpo"
      />
      <input
        placeholder="CCI (opcional)"
        value={datos.cci ?? ''}
        onChange={(e) => setDatos({ ...datos, cci: e.target.value })}
        className="rounded-control border border-borde-fuerte px-2 py-1.5 text-cuerpo"
      />
      <select
        value={datos.moneda}
        onChange={(e) => setDatos({ ...datos, moneda: e.target.value as 'PEN' | 'USD' })}
        disabled={tipo === 'HABERES'}
        className="rounded-control border border-borde-fuerte px-2 py-1.5 text-cuerpo"
      >
        <option value="PEN">S/ (soles)</option>
        {tipo === 'CTS' && <option value="USD">USD (dólares)</option>}
      </select>
      <button
        type="submit"
        disabled={guardar.isPending || !datos.banco || !datos.numero}
        className="rounded-control bg-primario px-3 py-1.5 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
      >
        Guardar {tipo === 'CTS' ? 'CTS' : 'haberes'}
      </button>
    </form>
  );
}

/**
 * Retenciones judiciales por alimentos (Sesión 16): el MOTOR las aplica
 * con prioridad absoluta desde la S6; aquí se registran (expediente,
 * juzgado, beneficiario y su cuenta, % O monto fijo — excluyentes,
 * vigencia). El resumen de cierre del periodo muestra cuánto depositar.
 */
function SeccionRetencionesJudiciales({ personaId }: { personaId: string }) {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [tipo, setTipo] = useState<'PORCENTAJE' | 'MONTO_FIJO'>('PORCENTAJE');
  const [datos, setDatos] = useState({
    expediente: '',
    juzgado: '',
    beneficiario: '',
    bancoDeposito: '',
    cuentaDeposito: '',
    valor: '',
    vigenteDesde: new Date().toISOString().slice(0, 10),
    vigenteHasta: '',
  });

  const { data: retenciones } = useQuery({
    queryKey: ['retenciones-judiciales', personaId],
    queryFn: () => listarRetenciones(empresa.id as string, personaId),
    enabled: Boolean(empresa.id),
  });

  const crear = useMutation({
    mutationFn: () => {
      const input: RetencionJudicialInput = {
        expediente: datos.expediente,
        juzgado: datos.juzgado,
        beneficiario: datos.beneficiario,
        bancoDeposito: datos.bancoDeposito || undefined,
        cuentaDeposito: datos.cuentaDeposito || undefined,
        porcentaje: tipo === 'PORCENTAJE' ? datos.valor : undefined,
        montoFijo: tipo === 'MONTO_FIJO' ? datos.valor : undefined,
        vigenteDesde: datos.vigenteDesde,
        vigenteHasta: datos.vigenteHasta || undefined,
      };
      return crearRetencion(empresa.id as string, personaId, input);
    },
    onSuccess: () => {
      agregarToast('exito', 'Retención judicial registrada: se aplicará con prioridad absoluta');
      setMostrandoForm(false);
      void queryClient.invalidateQueries({ queryKey: ['retenciones-judiciales', personaId] });
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo registrar'),
  });

  const desactivar = useMutation({
    mutationFn: (id: string) => desactivarRetencion(id),
    onSuccess: () => {
      agregarToast('exito', 'Retención desactivada (queda en el historial)');
      void queryClient.invalidateQueries({ queryKey: ['retenciones-judiciales', personaId] });
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo desactivar'),
  });

  return (
    <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
          Retenciones judiciales (alimentos)
        </h2>
        {!mostrandoForm && (
          <button
            type="button"
            onClick={() => setMostrandoForm(true)}
            className="rounded-control border border-borde-fuerte px-3 py-1.5 text-apoyo text-texto-suave hover:bg-fondo"
          >
            + Registrar retención
          </button>
        )}
      </div>

      {retenciones && retenciones.length > 0 && (
        <ul className="mb-4 space-y-2">
          {retenciones.map((r) => (
            <li
              key={r.id}
              className={`rounded-control px-3 py-2 text-cuerpo ${r.activa ? 'bg-peligro-suave' : 'bg-fondo opacity-60'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-texto">
                    Exp. {r.expediente} · {r.juzgado}
                    {!r.activa && ' · INACTIVA'}
                  </p>
                  <p className="text-apoyo text-texto-suave">
                    Beneficiario: {r.beneficiario}
                    {r.bancoDeposito && ` · ${r.bancoDeposito} ${r.cuentaDeposito ?? ''}`}
                    {' · '}
                    {r.porcentaje
                      ? `${(Number(r.porcentaje) * 100).toFixed(0)}% de la remuneración`
                      : `monto fijo ${soles(r.montoFijo ?? '0')}`}
                    {' · '}desde {r.vigenteDesde}
                    {r.vigenteHasta && ` hasta ${r.vigenteHasta}`}
                  </p>
                </div>
                {r.activa && (
                  <button
                    type="button"
                    onClick={() => desactivar.mutate(r.id)}
                    className="text-apoyo text-peligro hover:underline"
                  >
                    Desactivar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {(!retenciones || retenciones.length === 0) && !mostrandoForm && (
        <p className="text-cuerpo text-texto-tenue">
          Sin retenciones judiciales. Al registrarlas, el motor las descuenta con
          prioridad absoluta (hasta 60% por alimentos) y el cierre del periodo indica
          cuánto depositar al beneficiario.
        </p>
      )}

      {mostrandoForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            crear.mutate();
          }}
          className="grid gap-3 rounded-control border border-borde p-4 sm:grid-cols-2"
        >
          <input
            placeholder="Expediente (ej. 00123-2026)"
            value={datos.expediente}
            onChange={(e) => setDatos({ ...datos, expediente: e.target.value })}
            className="rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
          />
          <input
            placeholder="Juzgado"
            value={datos.juzgado}
            onChange={(e) => setDatos({ ...datos, juzgado: e.target.value })}
            className="rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
          />
          <input
            placeholder="Beneficiario"
            value={datos.beneficiario}
            onChange={(e) => setDatos({ ...datos, beneficiario: e.target.value })}
            className="rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Banco (depósito)"
              value={datos.bancoDeposito}
              onChange={(e) => setDatos({ ...datos, bancoDeposito: e.target.value })}
              className="rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
            <input
              placeholder="Cuenta"
              value={datos.cuentaDeposito}
              onChange={(e) => setDatos({ ...datos, cuentaDeposito: e.target.value })}
              className="rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
          </div>
          <div className="flex items-end gap-2">
            <div>
              <span className="block text-apoyo text-texto-suave">Tipo (excluyentes)</span>
              <select
                aria-label="Tipo de retención"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as 'PORCENTAJE' | 'MONTO_FIJO')}
                className="mt-1 rounded-control border border-borde-fuerte px-2 py-2 text-cuerpo"
              >
                <option value="PORCENTAJE">Porcentaje</option>
                <option value="MONTO_FIJO">Monto fijo</option>
              </select>
            </div>
            <input
              aria-label="Valor de la retención"
              placeholder={tipo === 'PORCENTAJE' ? '0.30 (máx 0.60)' : 'S/ monto'}
              value={datos.valor}
              onChange={(e) => setDatos({ ...datos, valor: e.target.value })}
              className="flex-1 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="rj-desde" className="block text-apoyo text-texto-suave">Vigente desde</label>
              <input
                id="rj-desde"
                type="date"
                value={datos.vigenteDesde}
                onChange={(e) => setDatos({ ...datos, vigenteDesde: e.target.value })}
                className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
              />
            </div>
            <div>
              <label htmlFor="rj-hasta" className="block text-apoyo text-texto-suave">Hasta (opcional)</label>
              <input
                id="rj-hasta"
                type="date"
                value={datos.vigenteHasta}
                onChange={(e) => setDatos({ ...datos, vigenteHasta: e.target.value })}
                className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => setMostrandoForm(false)}
              className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                crear.isPending ||
                !datos.expediente ||
                !datos.juzgado ||
                !datos.beneficiario ||
                !datos.valor
              }
              className="rounded-control bg-primario px-4 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
            >
              {crear.isPending ? 'Guardando…' : 'Guardar retención'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

const MOTIVOS: { valor: MotivoCese; texto: string }[] = [
  { valor: 'RENUNCIA', texto: 'Renuncia' },
  { valor: 'DESPIDO', texto: 'Despido' },
  { valor: 'MUTUO_ACUERDO', texto: 'Mutuo acuerdo' },
  { valor: 'VENCIMIENTO_CONTRATO', texto: 'Vencimiento de contrato' },
  { valor: 'JUBILACION', texto: 'Jubilación' },
  { valor: 'FALLECIMIENTO', texto: 'Fallecimiento' },
  { valor: 'OTRO', texto: 'Otro' },
];

/** Modal de CESE: al registrarlo, lleva a la pantalla de liquidación (§8.4) */
function ModalCese({
  personaId,
  onCerrar,
}: {
  personaId: string;
  onCerrar: () => void;
}) {
  const empresa = useEmpresaActiva();
  const navigate = useNavigate();
  const agregarToast = useToasts((s) => s.agregar);
  const [fechaCese, setFechaCese] = useState(new Date().toISOString().slice(0, 10));
  const [motivoCese, setMotivoCese] = useState<MotivoCese>('RENUNCIA');
  const [observacion, setObservacion] = useState('');

  const cesar = useMutation({
    mutationFn: () =>
      cesarPersona(empresa.id as string, personaId, {
        fechaCese,
        motivoCese,
        observacion: observacion || undefined,
      }),
    onSuccess: () => {
      agregarToast('exito', 'Cese registrado: revisa la liquidación');
      navigate(`/beneficios/liquidaciones/${personaId}`);
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo registrar el cese'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-texto/40 p-4">
      <div className="w-full max-w-md rounded-tarjeta bg-superficie p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-texto">Registrar cese</h2>
        <p className="mt-1 text-cuerpo text-texto-suave">
          Al registrarlo se calculará su liquidación de beneficios sociales.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="fechaCese" className="block text-apoyo text-texto-suave">
              Fecha de cese
            </label>
            <input
              id="fechaCese"
              type="date"
              value={fechaCese}
              onChange={(e) => setFechaCese(e.target.value)}
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
          </div>
          <div>
            <label htmlFor="motivoCese" className="block text-apoyo text-texto-suave">Motivo</label>
            <select
              id="motivoCese"
              value={motivoCese}
              onChange={(e) => setMotivoCese(e.target.value as MotivoCese)}
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            >
              {MOTIVOS.map((m) => (
                <option key={m.valor} value={m.valor}>{m.texto}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="observacion" className="block text-apoyo text-texto-suave">
              Observación (opcional)
            </label>
            <input
              id="observacion"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => cesar.mutate()}
            disabled={cesar.isPending}
            className="rounded-control bg-peligro px-5 py-2 text-cuerpo font-semibold text-white hover:bg-peligro disabled:opacity-50"
          >
            {cesar.isPending ? 'Registrando…' : 'Registrar cese'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PersonaFicha() {
  const { id } = useParams<{ id: string }>();
  const empresa = useEmpresaActiva();
  const [cesando, setCesando] = useState(false);

  const { data: persona } = useQuery({
    queryKey: ['persona', empresa.id, id],
    queryFn: () => obtenerPersona(empresa.id as string, id as string),
    enabled: Boolean(empresa.id && id),
  });
  const { data: cuentas } = useQuery({
    queryKey: ['cuentas', id],
    queryFn: () => listarCuentas(empresa.id as string, id as string),
    enabled: Boolean(empresa.id && id),
  });
  const { data: historial } = useQuery({
    queryKey: ['historial', id],
    queryFn: () => historialPersona(empresa.id as string, id as string),
    enabled: Boolean(empresa.id && id),
  });

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <p className="text-cuerpo text-texto-suave">
          Elige la empresa activa. <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }
  if (!persona) {
    return <SkeletonTabla />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-subtitulo font-semibold text-texto">
            {persona.apellidos}, {persona.nombres}
          </h1>
          <p className="text-cuerpo text-texto-tenue">
            {persona.tipoDocumento} {persona.numeroDocumento} ·{' '}
            {persona.tipoVinculo === 'PLANILLA'
              ? 'Trabajador de planilla'
              : persona.tipoVinculo === 'LOCADOR'
                ? 'Locador de servicios (4ta)'
                : 'Practicante'}
            {persona.estadoCese === 'CESADO' && ' · CESADO'}
          </p>
        </div>
        <div className="flex gap-2">
          {persona.tipoVinculo === 'PLANILLA' && (
            <button
              type="button"
              onClick={() =>
                void abrirCertificado5ta(
                  empresa.id as string,
                  persona.id,
                  new Date().getFullYear(),
                )
              }
              className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
              title="Certificado de rentas y retenciones de 5ta (activos y cesados)"
            >
              Certificado 5ta
            </button>
          )}
          {persona.tipoVinculo === 'PLANILLA' && (
            persona.estadoCese === 'CESADO' ? (
              <Link
                to={`/beneficios/liquidaciones/${persona.id}`}
                className="rounded-control border border-primario px-4 py-2 text-cuerpo font-medium text-primario-oscuro hover:bg-primario-suave"
              >
                Ver liquidación
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setCesando(true)}
                className="rounded-control border border-peligro px-4 py-2 text-cuerpo text-peligro hover:bg-peligro-suave"
              >
                Registrar cese
              </button>
            )
          )}
          <Link
            to={`/personas/${persona.id}/editar`}
            className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
          >
            Editar
          </Link>
          <Link to="/personas" className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo">
            ← Volver
          </Link>
        </div>
      </div>

      <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <h2 className="mb-4 text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">Datos</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Dato etiqueta="Fecha de ingreso" valor={persona.fechaIngreso.slice(0, 10)} />
          <Dato etiqueta="Fecha de nacimiento" valor={persona.fechaNacimiento?.slice(0, 10)} />
          <Dato etiqueta="Cargo" valor={persona.cargo} />
          <Dato etiqueta="Categoría" valor={persona.categoria} />
          <Dato etiqueta="Régimen laboral" valor={persona.regimenLaboral} />
          <Dato etiqueta="Sueldo básico" valor={persona.sueldoBasico ? `S/ ${persona.sueldoBasico}` : null} />
          <Dato
            etiqueta="Pensión"
            valor={persona.sistemaPension === 'AFP' ? `AFP ${persona.afp ?? ''} (${persona.tipoComision ?? ''})` : persona.sistemaPension}
          />
          <Dato etiqueta="CUSPP" valor={persona.cuspp} />
          <Dato etiqueta="RUC" valor={persona.rucLocador} />
          <Dato etiqueta="Subvención" valor={persona.subvencionMensual ? `S/ ${persona.subvencionMensual}` : null} />
          <Dato
            etiqueta="Convenio"
            valor={persona.convenioInicio ? `${persona.convenioInicio.slice(0, 10)} → ${persona.convenioFin?.slice(0, 10)}` : null}
          />
          <Dato etiqueta="Email" valor={persona.email} />
        </dl>
      </section>

      <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <h2 className="mb-4 text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
          Cuentas bancarias
        </h2>
        {cuentas && cuentas.length > 0 && (
          <ul className="mb-4 space-y-2">
            {cuentas.map((c) => (
              <li key={c.id} className="flex flex-wrap gap-3 rounded-control bg-fondo px-3 py-2 text-cuerpo">
                <span className="font-semibold text-texto">{c.tipo}</span>
                <span>{c.banco}</span>
                <span className="font-mono">{c.numero}</span>
                {c.cci && <span className="font-mono text-texto-tenue">CCI {c.cci}</span>}
                <span className="text-texto-suave">{c.moneda}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-3">
          <FormCuenta tipo="HABERES" personaId={persona.id} />
          {persona.tipoVinculo === 'PLANILLA' && <FormCuenta tipo="CTS" personaId={persona.id} />}
        </div>
      </section>

      {persona.tipoVinculo !== 'LOCADOR' && (
        <SeccionContratos
          personaId={persona.id}
          esPracticante={persona.tipoVinculo === 'PRACTICANTE'}
        />
      )}

      {persona.tipoVinculo === 'PLANILLA' && (
        <SeccionRetencionesJudiciales personaId={persona.id} />
      )}

      <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <h2 className="mb-4 text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
          Línea de tiempo (historial de cambios)
        </h2>
        {!historial || historial.length === 0 ? (
          <p className="text-cuerpo text-texto-tenue">
            Sin cambios registrados: el historial se crea automáticamente al editar campos
            relevantes (sueldo, cargo, pensión…).
          </p>
        ) : (
          <ol className="space-y-3 border-l-2 border-primario-suave pl-4">
            {historial.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primario" />
                <p className="text-cuerpo text-texto">
                  <span className="font-semibold">{NOMBRE_CAMPO[h.campo] ?? h.campo}</span>:{' '}
                  <span className="text-texto-suave">{h.valorAnterior ?? '—'}</span>
                  {' → '}
                  <span className="font-medium">{h.valorNuevo}</span>
                </p>
                <p className="text-apoyo text-texto-tenue">
                  Vigente desde {h.vigenteDesde.slice(0, 10)}
                  {h.registradoPorNombre && ` · registrado por ${h.registradoPorNombre}`}
                  {new Date(h.vigenteDesde) > new Date() && ' · PROGRAMADO'}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {cesando && (
        <ModalCese personaId={persona.id} onCerrar={() => setCesando(false)} />
      )}
    </div>
  );
}
