import type {
  AdminTenantDto,
  EstadoSuscripcion,
  PlanDto,
  SuscribirRespuestaDto,
  SuscripcionDto,
} from '@planix/shared-types';
import { apiJson } from './api';

// =====================================================================
// Suscripción del estudio (Sesión 21 — §11). El estado lo manda SIEMPRE
// el backend: la UI nunca "activa" nada por su cuenta, solo consulta
// hasta que el webhook de Mercado Pago confirma.
// =====================================================================

export function listarPlanes(): Promise<PlanDto[]> {
  return apiJson<PlanDto[]>('/billing/planes');
}

export function obtenerSuscripcion(): Promise<SuscripcionDto> {
  return apiJson<SuscripcionDto>('/billing/suscripcion');
}

export function suscribir(planId: string): Promise<SuscribirRespuestaDto> {
  return apiJson<SuscribirRespuestaDto>('/billing/suscribir', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  });
}

export function cancelarSuscripcion(): Promise<SuscripcionDto> {
  return apiJson<SuscripcionDto>('/billing/cancelar', { method: 'POST' });
}

// ------------------------- Panel de superadmin -------------------------

export function listarTenants(): Promise<AdminTenantDto[]> {
  return apiJson<AdminTenantDto[]>('/admin/tenants');
}

export function otorgarCortesia(tenantId: string): Promise<AdminTenantDto> {
  return apiJson<AdminTenantDto>(`/admin/tenants/${tenantId}/cortesia`, {
    method: 'POST',
  });
}

export function revocarCortesia(tenantId: string): Promise<AdminTenantDto> {
  return apiJson<AdminTenantDto>(
    `/admin/tenants/${tenantId}/revocar-cortesia`,
    { method: 'POST' },
  );
}

// ------------------------- Presentación -------------------------

export const NOMBRE_ESTADO_SUSCRIPCION: Record<EstadoSuscripcion, string> = {
  TRIAL: 'Prueba gratuita',
  ACTIVE: 'Activa',
  PAST_DUE: 'Pago pendiente',
  SUSPENDED: 'Inactiva',
  CANCELED: 'Cancelada',
  COMPLIMENTARY: 'Cortesía',
};

/** Colores del badge de estado (mismo criterio que el resto del sistema). */
export const COLOR_ESTADO_SUSCRIPCION: Record<EstadoSuscripcion, string> = {
  TRIAL: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PAST_DUE: 'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  CANCELED: 'bg-slate-200 text-slate-600',
  COMPLIMENTARY: 'bg-violet-100 text-violet-700',
};

/** S/ 1,234.56 — formato de moneda del sistema (§13). */
export function soles(monto: string): string {
  return `S/ ${Number(monto).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
