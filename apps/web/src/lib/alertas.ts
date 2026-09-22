import type {
  ActualizacionTasaDto,
  AlertaDto,
  BandejaAlertasDto,
  CronogramaAnioDto,
  EstadoAlerta,
  FilaCronogramaInput,
  PanelTasasSbsDto,
  PreferenciasAlertasDto,
  PreferenciasAlertasInput,
  ResultadoCargaCronogramaDto,
  ResumenAlertasDto,
  UrgenciaAlerta,
} from '@planix/shared-types';
import { api, apiJson } from './api';
import { useAuth } from '../stores/auth';

// =====================================================================
// Alertas, calendario SUNAT y tasas SBS (Sesión 22 — §10).
//
// Todo el criterio vive en el backend: la UI muestra lo que el motor
// calculó (título, detalle, urgencia y el módulo donde se atiende) y solo
// aporta presentación.
// =====================================================================

export function obtenerBandeja(filtro: {
  empresaId?: string;
  estado?: EstadoAlerta;
} = {}): Promise<BandejaAlertasDto> {
  const query = new URLSearchParams();
  if (filtro.empresaId) {
    query.set('empresaId', filtro.empresaId);
  }
  if (filtro.estado) {
    query.set('estado', filtro.estado);
  }
  const sufijo = query.toString();
  return apiJson<BandejaAlertasDto>(`/alertas${sufijo ? `?${sufijo}` : ''}`);
}

export function obtenerResumenAlertas(): Promise<ResumenAlertasDto> {
  return apiJson<ResumenAlertasDto>('/alertas/resumen');
}

export function recalcularAlertas(): Promise<BandejaAlertasDto> {
  return apiJson<BandejaAlertasDto>('/alertas/recalcular', { method: 'POST' });
}

export function marcarAlerta(
  id: string,
  estado: 'VISTA' | 'RESUELTA',
): Promise<AlertaDto> {
  return apiJson<AlertaDto>(`/alertas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ estado }),
  });
}

export function obtenerPreferenciasAlertas(): Promise<PreferenciasAlertasDto> {
  return apiJson<PreferenciasAlertasDto>('/alertas/preferencias');
}

export function guardarPreferenciasAlertas(
  input: PreferenciasAlertasInput,
): Promise<PreferenciasAlertasDto> {
  return apiJson<PreferenciasAlertasDto>('/alertas/preferencias', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// ------------------------- Calendario SUNAT (superadmin) -------------------------

export function obtenerCronograma(anio: number): Promise<CronogramaAnioDto> {
  return apiJson<CronogramaAnioDto>(`/admin/cronograma-sunat?anio=${anio}`);
}

export function guardarFilaCronograma(input: FilaCronogramaInput) {
  return apiJson(`/admin/cronograma-sunat`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function borrarFilaCronograma(id: string) {
  return apiJson(`/admin/cronograma-sunat/${id}`, { method: 'DELETE' });
}

/** Carga masiva del cronograma. Multipart: sin el Content-Type del wrapper. */
export async function importarCronograma(
  archivo: File,
): Promise<ResultadoCargaCronogramaDto> {
  const datos = new FormData();
  datos.append('archivo', archivo);
  const token = useAuth.getState().sesion?.accessToken;
  const res = await fetch('/api/admin/cronograma-sunat/importar', {
    method: 'POST',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: datos,
  });
  if (!res.ok) {
    throw new Error('No se pudo procesar el archivo del cronograma');
  }
  return (await res.json()) as ResultadoCargaCronogramaDto;
}

export async function descargarPlantillaCronograma(): Promise<void> {
  const res = await api('/admin/cronograma-sunat/plantilla');
  const url = URL.createObjectURL(await res.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'cronograma-sunat-planix.xlsx';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ------------------------- Tasas SBS (superadmin) -------------------------

export function obtenerPanelTasas(): Promise<PanelTasasSbsDto> {
  return apiJson<PanelTasasSbsDto>('/admin/tasas');
}

export function revisarTasasSbs(): Promise<PanelTasasSbsDto> {
  return apiJson<PanelTasasSbsDto>('/admin/tasas/revisar', { method: 'POST' });
}

export function aprobarTasas(
  id: string,
  vigenteDesde?: string,
): Promise<PanelTasasSbsDto> {
  return apiJson<PanelTasasSbsDto>(`/admin/tasas/${id}/aprobar`, {
    method: 'POST',
    body: JSON.stringify(vigenteDesde ? { vigenteDesde } : {}),
  });
}

export function rechazarTasas(
  id: string,
  motivo?: string,
): Promise<PanelTasasSbsDto> {
  return apiJson<PanelTasasSbsDto>(`/admin/tasas/${id}/rechazar`, {
    method: 'POST',
    body: JSON.stringify(motivo ? { motivo } : {}),
  });
}

// ------------------------- Presentación -------------------------

/** Badge de urgencia por proximidad de la fecha objetivo. */
export const COLOR_URGENCIA: Record<UrgenciaAlerta, string> = {
  VENCIDA: 'bg-red-100 text-red-700',
  CRITICA: 'bg-orange-100 text-orange-700',
  PROXIMA: 'bg-amber-100 text-amber-700',
  INFORMATIVA: 'bg-slate-100 text-slate-600',
};

export const NOMBRE_URGENCIA: Record<UrgenciaAlerta, string> = {
  VENCIDA: 'Vencida',
  CRITICA: 'Urgente',
  PROXIMA: 'Próxima',
  INFORMATIVA: 'Informativa',
};

export const COLOR_ESTADO_ALERTA: Record<EstadoAlerta, string> = {
  PENDIENTE: 'bg-blue-100 text-blue-700',
  VISTA: 'bg-slate-100 text-slate-600',
  RESUELTA: 'bg-emerald-100 text-emerald-700',
};

/** "en 10 días" / "hace 3 días" / "sin fecha" — texto del plazo. */
export function textoPlazo(alerta: AlertaDto): string {
  if (alerta.diasRestantes === null) {
    return 'sin fecha límite';
  }
  const dias = alerta.diasRestantes;
  if (dias === 0) {
    return 'vence HOY';
  }
  if (dias < 0) {
    const pasados = Math.abs(dias);
    return `venció hace ${pasados} ${pasados === 1 ? 'día' : 'días'}`;
  }
  return `en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/** Porcentaje de la tasa para mostrarla legible: 0.0155 → "1.550 %" */
export function porcentaje(tasa: string): string {
  return `${(Number(tasa) * 100).toFixed(3)} %`;
}

/** Etiqueta del campo de tasa (para la comparativa lado a lado). */
export const NOMBRE_CAMPO_TASA: Record<string, string> = {
  fondo: 'Aporte al fondo',
  primaSeguro: 'Prima de seguro',
  comisionFlujo: 'Comisión sobre flujo',
  comisionSaldo: 'Comisión sobre saldo',
};

/** Campos que se comparan en la propuesta, en orden de lectura. */
export const CAMPOS_TASA: (keyof ActualizacionTasaDto['propuesto'])[] = [
  'fondo',
  'primaSeguro',
  'comisionFlujo',
  'comisionSaldo',
];
