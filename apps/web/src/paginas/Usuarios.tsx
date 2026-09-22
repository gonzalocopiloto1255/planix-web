import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DESCRIPCION_ROL,
  ROLES_ASIGNABLES,
  type RolAsignable,
  type UsuarioTenantDto,
} from '@planix/shared-types';
import { Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import {
  Aviso,
  Badge,
  Boton,
  Campo,
  cx,
  Input,
  Skeleton,
  Tabla,
  Td,
  Th,
  Tr,
  Vacio,
} from '../componentes/ui';
import { useToasts } from '../stores/toast';
import {
  cambiarActivoUsuario,
  cambiarRolUsuario,
  cancelarInvitacion,
  invitarUsuario,
  obtenerPanelUsuarios,
  reenviarInvitacion,
} from '../lib/usuarios';

// =====================================================================
// Usuarios del estudio (Sesión 23.5). Solo el TITULAR llega aquí.
//
// La pantalla muestra la DESCRIPCIÓN de cada rol al elegirlo, no solo el
// nombre: quien reparte accesos tiene que saber qué está dando, y "quién
// puede cerrar un periodo" no se deduce de una etiqueta.
// =====================================================================

// La lista sale de shared-types, no de aquí: era la TERCERA copia de lo
// mismo (el grupo del backend, el schema y esta), y una lista repetida
// es una lista que algún día deja de coincidir.
const ROLES: RolAsignable[] = ROLES_ASIGNABLES;

function FormularioInvitacion({ onListo }: { onListo: () => void }) {
  const agregarToast = useToasts((s) => s.agregar);
  const [email, setEmail] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [rol, setRol] = useState<RolAsignable>('OPERADOR');
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invitar = useMutation({
    mutationFn: () => invitarUsuario({ email, nombres, apellidos, rol }),
    onSuccess: (r) => {
      setError(null);
      if (r.passwordTemporal) {
        // Sin correo configurado no hay enlace que enviar: la contraseña
        // se muestra UNA vez para que el titular la entregue en mano.
        setPasswordTemporal(r.passwordTemporal);
      } else {
        agregarToast('exito', `Invitación enviada a ${email}`);
        setEmail('');
        setNombres('');
        setApellidos('');
      }
      onListo();
    },
    onError: (e: Error & { mensaje?: string }) => setError(e.mensaje ?? e.message),
  });

  if (passwordTemporal) {
    return (
      <Aviso tono="advertencia" titulo="Entrega esta contraseña en persona">
        <p className="mt-1">
          No hay correo configurado, así que no se envió ningún enlace. La cuenta
          de <strong>{email}</strong> ya está creada y tendrá que cambiar la
          contraseña al entrar por primera vez.
        </p>
        <p className="cifras mt-2 rounded-control bg-superficie px-3 py-2 text-seccion font-semibold">
          {passwordTemporal}
        </p>
        <p className="mt-2 text-apoyo">
          No se volverá a mostrar. Cópiala antes de cerrar.
        </p>
        <Boton
          className="mt-3"
          variante="secundario"
          onClick={() => {
            setPasswordTemporal(null);
            setEmail('');
            setNombres('');
            setApellidos('');
          }}
        >
          Entendido
        </Boton>
      </Aviso>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        invitar.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombres" htmlFor="inv-nombres" requerido>
          <Input
            id="inv-nombres"
            value={nombres}
            onChange={(e) => setNombres(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Apellidos" htmlFor="inv-apellidos" requerido>
          <Input
            id="inv-apellidos"
            value={apellidos}
            onChange={(e) => setApellidos(e.target.value)}
          />
        </Campo>
      </div>

      <Campo etiqueta="Correo electrónico" htmlFor="inv-email" requerido>
        <Input
          id="inv-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Campo>

      <fieldset>
        <legend className="text-apoyo font-medium text-texto-suave">Rol</legend>
        <div className="mt-2 space-y-2">
          {ROLES.map((r) => (
            <label
              key={r}
              className={cx(
                'transicion flex cursor-pointer gap-3 rounded-control border p-3',
                rol === r
                  ? 'border-primario bg-primario-suave'
                  : 'border-borde hover:border-borde-fuerte',
              )}
            >
              <input
                type="radio"
                name="rol"
                className="mt-1"
                checked={rol === r}
                onChange={() => setRol(r)}
              />
              <span className="min-w-0">
                <span className="block text-cuerpo font-medium text-texto">
                  {DESCRIPCION_ROL[r].etiqueta}
                </span>
                <span className="block text-apoyo text-texto-suave">
                  {DESCRIPCION_ROL[r].detalle}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && <Aviso tono="peligro">{error}</Aviso>}

      <Boton type="submit" cargando={invitar.isPending} iconoIzquierda={<UserPlus className="size-4" />}>
        Enviar invitación
      </Boton>
    </form>
  );
}

function FilaUsuario({ usuario, onCambio }: { usuario: UsuarioTenantDto; onCambio: () => void }) {
  const agregarToast = useToasts((s) => s.agregar);
  const cambiarRol = useMutation({
    mutationFn: (rol: RolAsignable) => cambiarRolUsuario(usuario.id, { rol }),
    onSuccess: () => {
      agregarToast('exito', 'Rol actualizado');
      onCambio();
    },
    onError: (e: Error) => agregarToast('error', e.message),
  });
  const cambiarActivo = useMutation({
    mutationFn: (activo: boolean) => cambiarActivoUsuario(usuario.id, activo),
    onSuccess: () => {
      agregarToast('exito', 'Usuario actualizado');
      onCambio();
    },
    onError: (e: Error) => agregarToast('error', e.message),
  });

  return (
    <Tr>
      <Td>
        <span className="font-medium text-texto">
          {usuario.apellidos}, {usuario.nombres}
        </span>
        {usuario.esUnoMismo && (
          <span className="ml-2 text-apoyo text-texto-tenue">(tú)</span>
        )}
        <span className="block text-apoyo text-texto-tenue">{usuario.email}</span>
      </Td>
      <Td>
        <select
          aria-label={`Rol de ${usuario.email}`}
          value={usuario.rol}
          disabled={cambiarRol.isPending}
          onChange={(e) => cambiarRol.mutate(e.target.value as RolAsignable)}
          className="transicion rounded-control border border-borde bg-superficie px-2 py-1 text-apoyo text-texto hover:border-borde-fuerte focus:border-primario focus:outline-none"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {DESCRIPCION_ROL[r].etiqueta}
            </option>
          ))}
        </select>
      </Td>
      <Td>
        {usuario.activo ? (
          <Badge tono="exito">Activo</Badge>
        ) : (
          <Badge tono="neutro">Desactivado</Badge>
        )}
        {usuario.debeCambiarPassword && (
          <Badge tono="advertencia">
            Debe cambiar clave
          </Badge>
        )}
      </Td>
      <Td>
        {usuario.ultimoLogin
          ? new Date(usuario.ultimoLogin).toLocaleString('es-PE')
          : 'Nunca'}
      </Td>
      <Td className="text-right">
        <Boton
          variante="secundario"
          tamano="sm"
          cargando={cambiarActivo.isPending}
          onClick={() => cambiarActivo.mutate(!usuario.activo)}
        >
          {usuario.activo ? 'Desactivar' : 'Reactivar'}
        </Boton>
      </Td>
    </Tr>
  );
}

export function Usuarios() {
  const agregarToast = useToasts((s) => s.agregar);
  const queryClient = useQueryClient();
  const [invitando, setInvitando] = useState(false);

  const { data: panel, isPending } = useQuery({
    queryKey: ['usuarios'],
    queryFn: obtenerPanelUsuarios,
  });

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
  };

  const cancelar = useMutation({
    mutationFn: cancelarInvitacion,
    onSuccess: () => {
      agregarToast('exito', 'Invitación cancelada');
      refrescar();
    },
    onError: (e: Error) => agregarToast('error', e.message),
  });
  const reenviar = useMutation({
    mutationFn: reenviarInvitacion,
    onSuccess: () => {
      agregarToast('exito', 'Invitación reenviada');
      refrescar();
    },
    onError: (e: Error) => agregarToast('error', e.message),
  });

  if (isPending || !panel) {
    return <Skeleton className="h-64" />;
  }

  const sinPlazas =
    panel.maxUsuarios !== null && panel.ocupados >= panel.maxUsuarios;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-subtitulo font-semibold text-texto">Usuarios</h1>
          <p className="text-cuerpo text-texto-tenue">
            Quién entra a tu estudio y qué puede hacer.{' '}
            <span className="cifras font-medium text-texto-suave">
              {panel.ocupados}
              {panel.maxUsuarios !== null ? ` de ${panel.maxUsuarios}` : ''} usuarios
            </span>
            {panel.maxUsuarios === null && ' (sin límite en tu plan)'}
          </p>
        </div>
        {!invitando && (
          <Boton
            onClick={() => setInvitando(true)}
            disabled={sinPlazas}
            iconoIzquierda={<UserPlus className="size-4" />}
          >
            Invitar usuario
          </Boton>
        )}
      </div>

      {sinPlazas && (
        <Aviso tono="advertencia" icono={<ShieldCheck className="size-4" />}>
          Tu plan permite hasta {panel.maxUsuarios} usuarios. Mejora tu plan para
          agregar más.
        </Aviso>
      )}

      {invitando && (
        <section className="rounded-tarjeta border border-borde bg-superficie p-5 shadow-tarjeta">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-seccion font-semibold text-texto">Invitar a alguien</h2>
            <Boton variante="secundario" tamano="sm" onClick={() => setInvitando(false)}>
              Cerrar
            </Boton>
          </div>
          <FormularioInvitacion onListo={refrescar} />
        </section>
      )}

      <section className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
        <Tabla>
          <thead>
            <Tr>
              <Th>Usuario</Th>
              <Th>Rol</Th>
              <Th>Estado</Th>
              <Th>Último acceso</Th>
              <Th className="text-right">Acciones</Th>
            </Tr>
          </thead>
          <tbody>
            {panel.usuarios.map((u) => (
              <FilaUsuario key={u.id} usuario={u} onCambio={refrescar} />
            ))}
          </tbody>
        </Tabla>
      </section>

      <section className="rounded-tarjeta bg-superficie shadow-tarjeta">
        <h2 className="border-b border-borde px-5 py-4 text-seccion font-semibold text-texto">
          Invitaciones pendientes
        </h2>
        {panel.invitaciones.length === 0 ? (
          <Vacio
            icono={<Mail className="size-6" />}
            titulo="No hay invitaciones pendientes"
            descripcion="Cuando invites a alguien aparecerá aquí hasta que acepte."
          />
        ) : (
          <div className="overflow-x-auto">
            <Tabla>
              <thead>
                <Tr>
                  <Th>Correo</Th>
                  <Th>Rol</Th>
                  <Th>Vence</Th>
                  <Th className="text-right">Acciones</Th>
                </Tr>
              </thead>
              <tbody>
                {panel.invitaciones.map((i) => (
                  <Tr key={i.id}>
                    <Td>{i.email}</Td>
                    <Td>{DESCRIPCION_ROL[i.rol as RolAsignable]?.etiqueta ?? i.rol}</Td>
                    <Td>
                      {i.vencida ? (
                        <Badge tono="peligro">Vencida</Badge>
                      ) : (
                        new Date(i.expiraEn).toLocaleString('es-PE')
                      )}
                    </Td>
                    <Td className="space-x-2 text-right">
                      <Boton
                        variante="secundario"
                        tamano="sm"
                        cargando={reenviar.isPending}
                        onClick={() => reenviar.mutate(i.id)}
                      >
                        Reenviar
                      </Boton>
                      <Boton
                        variante="peligro"
                        tamano="sm"
                        cargando={cancelar.isPending}
                        onClick={() => cancelar.mutate(i.id)}
                      >
                        Cancelar
                      </Boton>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabla>
          </div>
        )}
      </section>
    </div>
  );
}
