import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '../lib/api';
import {
  confirmar2fa,
  descargarCodigosRespaldo,
  desactivar2fa,
  estado2fa,
  iniciar2fa,
  regenerarCodigos2fa,
} from '../lib/seguridad';
import { useToasts } from '../stores/toast';

// =====================================================================
// Sección "Seguridad" de Configuración (Sesión 23 — §12).
//
// El 2FA se ofrece de forma VISIBLE porque §12 lo pide para CONTADOR y
// SUPERADMIN: quien maneja las planillas de varias empresas guarda datos
// de decenas de personas.
//
// Los códigos de respaldo se muestran UNA sola vez, con su descarga a la
// vista: después solo existen hasheados y ni el sistema puede recuperarlos.
// =====================================================================

function CodigosRespaldo({
  codigos,
  onCerrar,
}: {
  codigos: string[];
  onCerrar: () => void;
}) {
  const [descargados, setDescargados] = useState(false);
  return (
    <div className="space-y-3 rounded-control border border-advertencia bg-advertencia-suave p-4">
      <p className="text-cuerpo font-semibold text-advertencia">
        Guarda estos {codigos.length} códigos de respaldo
      </p>
      <p className="text-cuerpo text-advertencia">
        Cada uno sirve <strong>una sola vez</strong> y son la única forma de
        entrar si pierdes el teléfono. No se volverán a mostrar.
      </p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-cuerpo text-texto">
        {codigos.map((c) => (
          <li key={c} className="rounded bg-superficie px-3 py-1.5 text-center">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            descargarCodigosRespaldo(codigos);
            setDescargados(true);
          }}
          className="rounded-control bg-advertencia px-4 py-2 text-cuerpo font-medium text-white hover:bg-advertencia"
        >
          Descargar códigos
        </button>
        <button
          type="button"
          onClick={onCerrar}
          disabled={!descargados}
          title={descargados ? '' : 'Descárgalos antes de continuar'}
          className="rounded-control border border-advertencia px-4 py-2 text-cuerpo text-advertencia disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ya los guardé
        </button>
      </div>
    </div>
  );
}

export function Seguridad2fa() {
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);

  const [inicio, setInicio] = useState<{ qrDataUrl: string; secretoManual: string } | null>(
    null,
  );
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [codigosNuevos, setCodigosNuevos] = useState<string[] | null>(null);

  const { data: estado } = useQuery({
    queryKey: ['estado-2fa'],
    queryFn: estado2fa,
  });

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ['estado-2fa'] });
  };
  const alError = (e: unknown) =>
    agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo completar');

  const empezar = useMutation({
    mutationFn: iniciar2fa,
    onSuccess: (datos) => {
      setInicio({ qrDataUrl: datos.qrDataUrl, secretoManual: datos.secretoManual });
      setCodigo('');
    },
    onError: alError,
  });

  const confirmar = useMutation({
    mutationFn: () => confirmar2fa(codigo),
    onSuccess: (datos) => {
      setInicio(null);
      setCodigo('');
      setCodigosNuevos(datos.codigosRespaldo);
      agregarToast('exito', 'Verificación en dos pasos activada');
      refrescar();
    },
    onError: alError,
  });

  const desactivar = useMutation({
    mutationFn: () => desactivar2fa(password, codigo),
    onSuccess: () => {
      setPassword('');
      setCodigo('');
      agregarToast('exito', 'Verificación en dos pasos desactivada');
      refrescar();
    },
    onError: alError,
  });

  const renovar = useMutation({
    mutationFn: () => regenerarCodigos2fa(codigo),
    onSuccess: (datos) => {
      setCodigo('');
      setCodigosNuevos(datos.codigosRespaldo);
      agregarToast('exito', 'Códigos de respaldo renovados');
      refrescar();
    },
    onError: alError,
  });

  return (
    <section className="max-w-2xl space-y-4 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-seccion font-semibold text-texto">
            Verificación en dos pasos
          </h2>
          <p className="text-cuerpo text-texto-suave">
            Un código de tu teléfono además de la contraseña. Muy recomendable:
            en Planix vive información laboral y bancaria de muchas personas.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-apoyo font-semibold ${
            estado?.habilitado
              ? 'bg-exito-suave text-exito'
              : 'bg-fondo text-texto-suave'
          }`}
        >
          {estado?.habilitado ? 'Activa' : 'Inactiva'}
        </span>
      </div>

      {codigosNuevos && (
        <CodigosRespaldo
          codigos={codigosNuevos}
          onCerrar={() => setCodigosNuevos(null)}
        />
      )}

      {!estado?.habilitado && !inicio && !codigosNuevos && (
        <button
          type="button"
          onClick={() => empezar.mutate()}
          disabled={empezar.isPending}
          className="rounded-control bg-primario px-4 py-2 text-cuerpo font-medium text-white hover:bg-primario-oscuro disabled:bg-borde"
        >
          Activar verificación en dos pasos
        </button>
      )}

      {inicio && (
        <div className="space-y-3 rounded-control border border-borde p-4">
          <p className="text-cuerpo text-texto-suave">
            1. Escanea este código con Google Authenticator, Authy o similar.
          </p>
          <img
            src={inicio.qrDataUrl}
            alt="Código QR para la app de autenticación"
            className="rounded border border-borde"
            width={200}
            height={200}
          />
          <p className="text-apoyo text-texto-suave">
            ¿No puedes escanear? Ingresa esta clave a mano:{' '}
            <code className="rounded bg-fondo px-2 py-0.5 font-mono">
              {inicio.secretoManual}
            </code>
          </p>
          <p className="text-cuerpo text-texto-suave">
            2. Escribe el código de 6 dígitos que muestra la app:
          </p>
          <div className="flex items-center gap-2">
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="w-32 rounded-control border border-borde-fuerte px-3 py-2 text-center font-mono text-lg"
            />
            <button
              type="button"
              onClick={() => confirmar.mutate()}
              disabled={confirmar.isPending || codigo.length < 6}
              className="rounded-control bg-primario px-4 py-2 text-cuerpo font-medium text-white hover:bg-primario-oscuro disabled:bg-borde"
            >
              Confirmar y activar
            </button>
            <button
              type="button"
              onClick={() => setInicio(null)}
              className="rounded-control px-3 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {estado?.habilitado && (
        <div className="space-y-4">
          <p className="text-cuerpo text-texto-suave">
            Te quedan{' '}
            <strong>{estado.codigosRespaldoDisponibles} códigos de respaldo</strong>{' '}
            sin usar.
          </p>

          <div className="space-y-2 rounded-control border border-borde p-4">
            <label
              htmlFor="codigo-2fa"
              className="block text-cuerpo font-medium text-texto"
            >
              Código de tu app (para cualquiera de las dos acciones)
            </label>
            <input
              id="codigo-2fa"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="w-32 rounded-control border border-borde-fuerte px-3 py-2 text-center font-mono"
            />

            <div className="flex flex-wrap items-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => renovar.mutate()}
                disabled={renovar.isPending || codigo.length < 6}
                className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto hover:bg-fondo disabled:opacity-50"
              >
                Renovar códigos de respaldo
              </button>
            </div>

            <div className="mt-4 space-y-2 border-t border-borde pt-4">
              <label
                htmlFor="password-2fa"
                className="block text-cuerpo font-medium text-texto"
              >
                Para DESACTIVAR, confirma también tu contraseña
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="password-2fa"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                  className="w-56 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
                />
                <button
                  type="button"
                  onClick={() => desactivar.mutate()}
                  disabled={
                    desactivar.isPending || codigo.length < 6 || password.length === 0
                  }
                  className="rounded-control border border-peligro px-4 py-2 text-cuerpo text-peligro hover:bg-peligro-suave disabled:opacity-50"
                >
                  Desactivar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
