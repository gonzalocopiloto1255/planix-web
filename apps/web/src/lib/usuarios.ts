import type {
  AceptarInvitacionInput,
  CambiarRolInput,
  InvitacionCreadaDto,
  InvitarUsuarioInput,
  PanelUsuariosDto,
} from '@planix/shared-types';
import { apiJson } from './api';

export function obtenerPanelUsuarios(): Promise<PanelUsuariosDto> {
  return apiJson<PanelUsuariosDto>('/usuarios');
}

export function invitarUsuario(input: InvitarUsuarioInput): Promise<InvitacionCreadaDto> {
  return apiJson<InvitacionCreadaDto>('/usuarios/invitaciones', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function reenviarInvitacion(id: string): Promise<InvitacionCreadaDto> {
  return apiJson<InvitacionCreadaDto>(`/usuarios/invitaciones/${id}/reenviar`, {
    method: 'POST',
  });
}

export function cancelarInvitacion(id: string): Promise<{ ok: boolean }> {
  return apiJson(`/usuarios/invitaciones/${id}/cancelar`, { method: 'POST' });
}

export function cambiarRolUsuario(
  id: string,
  input: CambiarRolInput,
): Promise<{ ok: boolean }> {
  return apiJson(`/usuarios/${id}/rol`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function cambiarActivoUsuario(
  id: string,
  activo: boolean,
): Promise<{ ok: boolean }> {
  return apiJson(`/usuarios/${id}/${activo ? 'reactivar' : 'desactivar'}`, {
    method: 'POST',
  });
}

/** PÚBLICO: se llama sin sesión, desde el enlace del correo. */
export async function aceptarInvitacion(
  input: AceptarInvitacionInput,
): Promise<{ email: string }> {
  const res = await fetch('/api/invitaciones/aceptar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const cuerpo = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(cuerpo.message ?? 'No se pudo aceptar la invitación');
  }
  return (await res.json()) as { email: string };
}
