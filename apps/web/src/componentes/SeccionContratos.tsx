import type {
  ContratoDto,
  CrearContratoInput,
  TipoContrato,
} from '@planix/shared-types';
import {
  MODALIDADES_CONTRATO,
  etiquetaModalidadContrato,
} from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '../lib/api';
import {
  ESTILO_ESTADO,
  NOMBRE_ESTADO,
  NOMBRE_TIPO_CONTRATO,
  abrirPdfContrato,
  contratosDePersona,
  crearContrato,
  listarPlantillas,
  renovarContrato,
} from '../lib/contratos';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

// =====================================================================
// Contratos en la ficha de la persona (Sesión 17): banner "Sin contrato
// registrado", cadena de renovaciones, creación desde plantilla y PDF.
// Los valores del contrato quedan CONGELADOS al crearlo.
// =====================================================================

export function ModalRenovar({
  contrato,
  onCerrar,
  onExito,
}: {
  contrato: ContratoDto;
  onCerrar: () => void;
  onExito: () => void;
}) {
  const agregarToast = useToasts((s) => s.agregar);
  const [nuevoInicio, setNuevoInicio] = useState('');
  const [nuevoFin, setNuevoFin] = useState('');

  const renovar = useMutation({
    mutationFn: () => renovarContrato(contrato.id, { nuevoInicio, nuevoFin }),
    onSuccess: (r) => {
      agregarToast('exito', 'Contrato renovado: se generó el nuevo contrato de la cadena');
      for (const a of r.advertencias) {
        agregarToast('error', a);
      }
      onExito();
      onCerrar();
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo renovar'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-texto/40 p-4">
      <div className="w-full max-w-md rounded-tarjeta bg-superficie p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-texto">
          Renovar contrato — {contrato.apellidos}, {contrato.nombres}
        </h2>
        <p className="mt-1 text-apoyo text-texto-suave">
          La renovación crea un contrato NUEVO enlazado al anterior, con los datos vigentes
          de la ficha (sueldo actual). Una cadena de plazo fijo que supere los 5 años
          mostrará la advertencia legal (D.S. 003-97-TR art. 74).
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rc-inicio" className="block text-apoyo text-texto-suave">
              Nuevo inicio
            </label>
            <input
              id="rc-inicio"
              type="date"
              value={nuevoInicio}
              onChange={(e) => setNuevoInicio(e.target.value)}
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
            />
          </div>
          <div>
            <label htmlFor="rc-fin" className="block text-apoyo text-texto-suave">
              Nuevo fin
            </label>
            <input
              id="rc-fin"
              type="date"
              value={nuevoFin}
              onChange={(e) => setNuevoFin(e.target.value)}
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
            onClick={() => renovar.mutate()}
            disabled={renovar.isPending || !nuevoInicio || !nuevoFin}
            className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
          >
            {renovar.isPending ? 'Renovando…' : 'Renovar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BadgeEstado({ estado }: { estado: ContratoDto['estado'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-apoyo font-semibold ${ESTILO_ESTADO[estado]}`}
    >
      {NOMBRE_ESTADO[estado]}
    </span>
  );
}

function FormNuevoContrato({
  personaId,
  esPracticante,
  onCerrar,
}: {
  personaId: string;
  esPracticante: boolean;
  onCerrar: () => void;
}) {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [tipo, setTipo] = useState<TipoContrato>(
    esPracticante ? 'CONVENIO_PRACTICAS' : 'INDETERMINADO',
  );
  const [plantillaId, setPlantillaId] = useState('');
  const [inicio, setInicio] = useState(new Date().toISOString().slice(0, 10));
  const [fin, setFin] = useState('');
  // Modalidad contractual que se declara en el T-Registro (S20)
  const [modalidad, setModalidad] = useState('');
  const modalidadesDelTipo = MODALIDADES_CONTRATO.filter((m) => m.tipo === tipo);

  const { data: plantillas } = useQuery({
    queryKey: ['plantillas-contrato', empresa.id],
    queryFn: () => listarPlantillas(empresa.id as string),
    enabled: Boolean(empresa.id),
  });

  const finObligatorio = tipo === 'PLAZO_FIJO' || tipo === 'CONVENIO_PRACTICAS';

  const crear = useMutation({
    mutationFn: () => {
      const input: CrearContratoInput = {
        plantillaId: plantillaId || undefined,
        tipo,
        modalidad: modalidad || undefined,
        inicio,
        fin: fin || undefined,
      };
      return crearContrato(empresa.id as string, personaId, input);
    },
    onSuccess: (r) => {
      agregarToast('exito', 'Contrato registrado con sus valores congelados');
      for (const a of r.advertencias) {
        agregarToast('error', a);
      }
      void queryClient.invalidateQueries({ queryKey: ['contratos', personaId] });
      void queryClient.invalidateQueries({ queryKey: ['persona'] });
      onCerrar();
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo registrar'),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        crear.mutate();
      }}
      className="grid gap-3 rounded-control border border-borde p-4 sm:grid-cols-2"
    >
      <div>
        <label htmlFor="c-tipo" className="block text-apoyo text-texto-suave">Tipo</label>
        <select
          id="c-tipo"
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as TipoContrato);
            setModalidad('');
          }}
          className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
        >
          {esPracticante ? (
            <option value="CONVENIO_PRACTICAS">Convenio de prácticas (Ley 28518)</option>
          ) : (
            <>
              <option value="INDETERMINADO">Indeterminado</option>
              <option value="PLAZO_FIJO">Plazo fijo (sujeto a modalidad)</option>
              <option value="PART_TIME">Part-time</option>
            </>
          )}
        </select>
      </div>
      <div>
        <label htmlFor="c-modalidad" className="block text-apoyo text-texto-suave">
          Modalidad (así se declara en el T-Registro)
        </label>
        <select
          id="c-modalidad"
          value={modalidad}
          onChange={(e) => setModalidad(e.target.value)}
          className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
        >
          <option value="">
            {modalidadesDelTipo.length === 1
              ? `${modalidadesDelTipo[0].etiqueta} (automática)`
              : '— Elige la modalidad —'}
          </option>
          {modalidadesDelTipo.map((m) => (
            <option key={m.codigo} value={m.codigo}>{m.etiqueta}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="c-plantilla" className="block text-apoyo text-texto-suave">
          Plantilla (el contenido se genera con los datos vigentes)
        </label>
        <select
          id="c-plantilla"
          value={plantillaId}
          onChange={(e) => setPlantillaId(e.target.value)}
          className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
        >
          <option value="">Sin plantilla (solo registro, sin PDF)</option>
          {plantillas
            ?.filter((p) => p.activo)
            .map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
        </select>
      </div>
      <div>
        <label htmlFor="c-inicio" className="block text-apoyo text-texto-suave">Inicio</label>
        <input
          id="c-inicio"
          type="date"
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
          className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
        />
      </div>
      <div>
        <label htmlFor="c-fin" className="block text-apoyo text-texto-suave">
          Fin {finObligatorio ? '(obligatorio)' : '(opcional)'}
        </label>
        <input
          id="c-fin"
          type="date"
          value={fin}
          onChange={(e) => setFin(e.target.value)}
          className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
        />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={crear.isPending || !inicio || (finObligatorio && !fin)}
          className="rounded-control bg-primario px-4 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
        >
          {crear.isPending ? 'Generando…' : 'Registrar contrato'}
        </button>
      </div>
    </form>
  );
}

export function SeccionContratos({
  personaId,
  esPracticante,
}: {
  personaId: string;
  esPracticante: boolean;
}) {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [renovando, setRenovando] = useState<ContratoDto | null>(null);

  const { data: contratos } = useQuery({
    queryKey: ['contratos', personaId],
    queryFn: () => contratosDePersona(empresa.id as string, personaId),
    enabled: Boolean(empresa.id),
  });

  const sinContrato = contratos !== undefined && contratos.length === 0;

  return (
    <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
          {esPracticante ? 'Convenio de prácticas' : 'Contratos'}
        </h2>
        {!mostrandoForm && (
          <button
            type="button"
            onClick={() => setMostrandoForm(true)}
            className="rounded-control border border-borde-fuerte px-3 py-1.5 text-apoyo text-texto-suave hover:bg-fondo"
          >
            + {esPracticante ? 'Generar convenio' : 'Generar contrato'}
          </button>
        )}
      </div>

      {sinContrato && (
        <div className="mb-4 rounded-control border border-advertencia/30 bg-advertencia-suave px-4 py-3 text-cuerpo text-advertencia">
          <span className="font-semibold">Sin contrato registrado.</span>{' '}
          {esPracticante
            ? 'Genera el convenio de prácticas (Ley 28518) desde una plantilla.'
            : 'Genera el contrato desde una plantilla: los datos de la ficha se congelan en el documento.'}
        </div>
      )}

      {contratos && contratos.length > 0 && (
        <ol className="mb-4 space-y-2">
          {contratos.map((c) => (
            <li key={c.id} className="rounded-control bg-fondo px-3 py-2 text-cuerpo">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-texto">
                    {c.renovadoDe !== null && (
                      <span className="mr-1 text-texto-tenue">↳ Renovación:</span>
                    )}
                    {NOMBRE_TIPO_CONTRATO[c.tipo]}
                    <span className="ml-2 text-texto-suave">
                      {c.inicio} → {c.fin ?? 'indeterminado'}
                    </span>
                  </p>
                  <p className="text-apoyo text-texto-tenue">
                    {[etiquetaModalidadContrato(c.modalidad), c.plantillaNombre]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <BadgeEstado estado={c.estado} />
                  {c.pdfDisponible && (
                    <button
                      type="button"
                      onClick={() => void abrirPdfContrato(c.id)}
                      className="text-apoyo text-primario hover:underline"
                    >
                      Ver PDF
                    </button>
                  )}
                  {c.fin && c.estado !== 'RENOVADO' && (
                    <button
                      type="button"
                      onClick={() => setRenovando(c)}
                      className="text-apoyo text-primario hover:underline"
                    >
                      Renovar
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {mostrandoForm && (
        <FormNuevoContrato
          personaId={personaId}
          esPracticante={esPracticante}
          onCerrar={() => setMostrandoForm(false)}
        />
      )}

      {renovando && (
        <ModalRenovar
          contrato={renovando}
          onCerrar={() => setRenovando(null)}
          onExito={() => {
            void queryClient.invalidateQueries({ queryKey: ['contratos', personaId] });
          }}
        />
      )}
    </section>
  );
}
