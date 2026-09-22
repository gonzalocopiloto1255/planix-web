import type {
  Estado2faDto,
  FiltroAuditoria,
  Inicio2faDto,
  PaginaAuditoriaDto,
  RespuestaActivacion2faDto,
  ResumenExportDto,
  Sesion,
} from '@planix/shared-types';
import { api, apiJson } from './api';

// =====================================================================
// Seguridad y cumplimiento (Sesión 23 — §12 y Ley 29733): segundo factor,
// historial de auditoría y exportación de datos.
// =====================================================================

export function estado2fa(): Promise<Estado2faDto> {
  return apiJson<Estado2faDto>('/auth/2fa');
}

export function iniciar2fa(): Promise<Inicio2faDto> {
  return apiJson<Inicio2faDto>('/auth/2fa/iniciar', { method: 'POST' });
}

export function confirmar2fa(codigo: string): Promise<RespuestaActivacion2faDto> {
  return apiJson<RespuestaActivacion2faDto>('/auth/2fa/confirmar', {
    method: 'POST',
    body: JSON.stringify({ codigo }),
  });
}

export function desactivar2fa(
  password: string,
  codigo: string,
): Promise<Estado2faDto> {
  return apiJson<Estado2faDto>('/auth/2fa/desactivar', {
    method: 'POST',
    body: JSON.stringify({ password, codigo }),
  });
}

export function regenerarCodigos2fa(
  codigo: string,
): Promise<RespuestaActivacion2faDto> {
  return apiJson<RespuestaActivacion2faDto>('/auth/2fa/codigos-respaldo', {
    method: 'POST',
    body: JSON.stringify({ codigo }),
  });
}

/** Segundo paso del login: canjea el desafío por la sesión. */
export function completarLogin2fa(
  desafio: string,
  codigo: string,
): Promise<Sesion> {
  return apiJson<Sesion>('/auth/login/2fa', {
    method: 'POST',
    body: JSON.stringify({ desafio, codigo }),
  });
}

// ------------------------- Auditoría -------------------------

export function consultarAuditoria(
  filtro: Partial<FiltroAuditoria>,
): Promise<PaginaAuditoriaDto> {
  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtro)) {
    if (valor !== undefined && valor !== '') {
      query.set(clave, String(valor));
    }
  }
  const sufijo = query.toString();
  return apiJson<PaginaAuditoriaDto>(`/auditoria${sufijo ? `?${sufijo}` : ''}`);
}

// ------------------------- Respaldo y portabilidad -------------------------

export function resumenRespaldo(): Promise<ResumenExportDto> {
  return apiJson<ResumenExportDto>('/respaldo/resumen');
}

/** Descarga MIS datos en Excel (derecho de portabilidad, Ley 29733). */
export async function descargarMisDatos(): Promise<void> {
  const res = await api('/respaldo/mis-datos.xlsx');
  const url = URL.createObjectURL(await res.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'planix-mis-datos.xlsx';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Descarga los códigos de respaldo como archivo de texto (una sola vez). */
export function descargarCodigosRespaldo(codigos: string[]): void {
  const contenido = [
    'Códigos de respaldo de Planix',
    'Cada código sirve UNA sola vez. Guárdalos en un lugar seguro:',
    'son la única forma de entrar si pierdes el teléfono.',
    '',
    ...codigos.map((c, i) => `${i + 1}. ${c}`),
  ].join('\n');
  const url = URL.createObjectURL(
    new Blob([contenido], { type: 'text/plain;charset=utf-8' }),
  );
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'planix-codigos-respaldo.txt';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
