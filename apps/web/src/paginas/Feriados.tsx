import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Boton, CabeceraPagina, Input, Tabla, Tarjeta, Td, Th } from '../componentes/ui';
import { ApiError } from '../lib/api';
import {
  borrarFeriadoEmpresa,
  borrarFeriadoNacional,
  guardarFeriadoEmpresa,
  guardarFeriadoNacional,
  obtenerFeriadosEmpresa,
  obtenerFeriadosNacionales,
} from '../lib/feriados';
import { useAuth } from '../stores/auth';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

// =====================================================================
// Feriados (§7.2). Dos niveles, como funciona en la práctica peruana:
//
//  * NACIONALES: dato de plataforma, los administra el SUPERADMIN. Valen
//    para todo el país y cambian por ley.
//  * DE LA EMPRESA: el aniversario de la ciudad, el día del sector. Los
//    lleva el contador. La misma lista sirve para declarar que se dio
//    DESCANSO SUSTITUTORIO por un feriado nacional.
//
// De aquí sale qué días generan pago triple al trabajarse, y el aviso
// de la pantalla de cierre cuando lo digitado no cuadra con el catálogo.
// =====================================================================

const DIAS_SEMANA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

/** Día de la semana de una fecha de calendario (se lee en UTC, sin huso). */
function diaDe(iso: string): string {
  return DIAS_SEMANA[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

export function Feriados() {
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const rol = useAuth((s) => s.sesion?.usuario.rol);
  const empresaId = useEmpresaActiva((s) => s.id);
  const razonSocial = useEmpresaActiva((s) => s.razonSocial);
  const esSuperadmin = rol === 'SUPERADMIN';

  const [anio, setAnio] = useState(new Date().getFullYear());
  const [nuevoNacional, setNuevoNacional] = useState({
    fecha: '',
    descripcion: '',
    normaLegal: '',
  });
  const [nuevoPropio, setNuevoPropio] = useState({
    fecha: '',
    descripcion: '',
    descansoSustitutorio: false,
  });

  const { data: nacionales } = useQuery({
    queryKey: ['feriados-nacionales', anio],
    queryFn: () => obtenerFeriadosNacionales(anio),
  });

  const { data: propios } = useQuery({
    queryKey: ['feriados-empresa', empresaId, anio],
    queryFn: () => obtenerFeriadosEmpresa(empresaId as string, anio),
    enabled: Boolean(empresaId) && !esSuperadmin,
  });

  const fallo = (e: unknown) =>
    agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo guardar');

  const guardarNacional = useMutation({
    mutationFn: () =>
      guardarFeriadoNacional({
        fecha: nuevoNacional.fecha,
        descripcion: nuevoNacional.descripcion,
        normaLegal: nuevoNacional.normaLegal || null,
      }),
    onSuccess: () => {
      agregarToast('exito', 'Feriado nacional guardado');
      setNuevoNacional({ fecha: '', descripcion: '', normaLegal: '' });
      void queryClient.invalidateQueries({ queryKey: ['feriados-nacionales'] });
    },
    onError: fallo,
  });

  const quitarNacional = useMutation({
    mutationFn: borrarFeriadoNacional,
    onSuccess: () => {
      agregarToast('exito', 'Feriado eliminado');
      void queryClient.invalidateQueries({ queryKey: ['feriados-nacionales'] });
    },
    onError: fallo,
  });

  const guardarPropio = useMutation({
    mutationFn: () => guardarFeriadoEmpresa(empresaId as string, nuevoPropio),
    onSuccess: () => {
      agregarToast('exito', 'Feriado de la empresa guardado');
      setNuevoPropio({ fecha: '', descripcion: '', descansoSustitutorio: false });
      void queryClient.invalidateQueries({ queryKey: ['feriados-empresa'] });
    },
    onError: fallo,
  });

  const quitarPropio = useMutation({
    mutationFn: (id: string) => borrarFeriadoEmpresa(empresaId as string, id),
    onSuccess: () => {
      agregarToast('exito', 'Feriado eliminado');
      void queryClient.invalidateQueries({ queryKey: ['feriados-empresa'] });
    },
    onError: fallo,
  });

  return (
    <div className="space-y-6">
      <CabeceraPagina
        titulo="Feriados"
        descripcion="Los feriados nacionales valen para todo el país; cada empresa añade los suyos. Un feriado trabajado sin descanso sustitutorio se paga triple (D.Leg. 713 art. 9)."
      />

      <div className="flex items-center gap-3">
        <label htmlFor="anio" className="text-cuerpo font-medium text-texto">
          Año
        </label>
        <Input
          id="anio"
          type="number"
          min={2000}
          max={2100}
          className="w-32"
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
        />
      </div>

      <Tarjeta>
        <h2 className="mb-3 text-cuerpo font-semibold text-texto">Feriados nacionales</h2>
        {esSuperadmin ? (
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Input
              type="date"
              aria-label="Fecha del feriado nacional"
              value={nuevoNacional.fecha}
              onChange={(e) =>
                setNuevoNacional({ ...nuevoNacional, fecha: e.target.value })
              }
            />
            <Input
              placeholder="Descripción"
              aria-label="Descripción del feriado nacional"
              value={nuevoNacional.descripcion}
              onChange={(e) =>
                setNuevoNacional({ ...nuevoNacional, descripcion: e.target.value })
              }
            />
            <Input
              placeholder="Norma legal (opcional)"
              aria-label="Norma legal"
              value={nuevoNacional.normaLegal}
              onChange={(e) =>
                setNuevoNacional({ ...nuevoNacional, normaLegal: e.target.value })
              }
            />
            <Boton
              onClick={() => guardarNacional.mutate()}
              disabled={!nuevoNacional.fecha || nuevoNacional.descripcion.length < 3}
            >
              Agregar
            </Boton>
          </div>
        ) : (
          <p className="mb-3 text-apoyo text-texto-suave">
            Los administra Planix. Si falta uno, avísanos: el sistema no inventa fechas
            oficiales.
          </p>
        )}
        <Tabla>
          <thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Día</Th>
              <Th>Descripción</Th>
              <Th>Norma</Th>
              {esSuperadmin && <Th> </Th>}
            </tr>
          </thead>
          <tbody>
            {(nacionales ?? []).map((f) => (
              <tr key={f.id}>
                <Td>{f.fechaTexto}</Td>
                <Td>{diaDe(f.fecha)}</Td>
                <Td>{f.descripcion}</Td>
                <Td>{f.normaLegal ?? '—'}</Td>
                {esSuperadmin && (
                  <Td>
                    <Boton
                      variante="fantasma"
                      tamano="sm"
                      onClick={() => quitarNacional.mutate(f.id)}
                    >
                      Quitar
                    </Boton>
                  </Td>
                )}
              </tr>
            ))}
            {(nacionales ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-texto-suave">
                  Sin feriados cargados para {anio}.
                </td>
              </tr>
            )}
          </tbody>
        </Tabla>
      </Tarjeta>

      {!esSuperadmin && (
        <Tarjeta>
          <h2 className="mb-1 text-cuerpo font-semibold text-texto">
            Feriados de {razonSocial ?? 'la empresa'}
          </h2>
          <p className="mb-4 text-apoyo text-texto-suave">
            El aniversario de la ciudad, el día del sector, un paro regional. También se
            registra aquí el <strong>descanso sustitutorio</strong>: si se trabajó un
            feriado nacional y se compensó con otro día libre, anota esa misma fecha con
            la casilla marcada y no se pagará triple.
          </p>
          {!empresaId ? (
            <p className="text-cuerpo text-texto-suave">Selecciona una empresa primero.</p>
          ) : (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-4">
                <Input
                  type="date"
                  aria-label="Fecha del feriado de la empresa"
                  value={nuevoPropio.fecha}
                  onChange={(e) =>
                    setNuevoPropio({ ...nuevoPropio, fecha: e.target.value })
                  }
                />
                <Input
                  placeholder="Descripción"
                  aria-label="Descripción del feriado de la empresa"
                  value={nuevoPropio.descripcion}
                  onChange={(e) =>
                    setNuevoPropio({ ...nuevoPropio, descripcion: e.target.value })
                  }
                />
                <label className="flex items-center gap-2 text-cuerpo text-texto">
                  <input
                    type="checkbox"
                    checked={nuevoPropio.descansoSustitutorio}
                    onChange={(e) =>
                      setNuevoPropio({
                        ...nuevoPropio,
                        descansoSustitutorio: e.target.checked,
                      })
                    }
                  />
                  Con descanso sustitutorio
                </label>
                <Boton
                  onClick={() => guardarPropio.mutate()}
                  disabled={!nuevoPropio.fecha || nuevoPropio.descripcion.length < 3}
                >
                  Agregar
                </Boton>
              </div>
              <Tabla>
                <thead>
                  <tr>
                    <Th>Fecha</Th>
                    <Th>Día</Th>
                    <Th>Descripción</Th>
                    <Th>Pago triple</Th>
                    <Th> </Th>
                  </tr>
                </thead>
                <tbody>
                  {(propios ?? []).map((f) => (
                    <tr key={f.id}>
                      <Td>{f.fechaTexto}</Td>
                      <Td>{diaDe(f.fecha)}</Td>
                      <Td>
                        {f.descripcion}
                        {f.esNacional && (
                          <span className="ml-2 text-menor text-texto-tenue">
                            (también nacional)
                          </span>
                        )}
                      </Td>
                      <Td>{f.descansoSustitutorio ? 'No, hubo sustitutorio' : 'Sí'}</Td>
                      <Td>
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          onClick={() => quitarPropio.mutate(f.id)}
                        >
                          Quitar
                        </Boton>
                      </Td>
                    </tr>
                  ))}
                  {(propios ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-texto-suave">
                        Esta empresa no tiene feriados propios en {anio}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Tabla>
            </>
          )}
        </Tarjeta>
      )}
    </div>
  );
}
