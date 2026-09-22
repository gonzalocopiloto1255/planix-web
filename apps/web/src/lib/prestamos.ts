import type {
  AmortizarPrestamoInput,
  CrearPrestamoInput,
  PrestamoDto,
} from '@planix/shared-types';
import { api, apiJson } from './api';

export function listarPrestamos(empresaId: string): Promise<PrestamoDto[]> {
  return apiJson(`/empresas/${empresaId}/prestamos`);
}

export function crearPrestamo(
  empresaId: string,
  personaId: string,
  input: CrearPrestamoInput,
): Promise<PrestamoDto> {
  return apiJson(`/empresas/${empresaId}/personas/${personaId}/prestamos`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function obtenerPrestamo(id: string): Promise<PrestamoDto> {
  return apiJson(`/prestamos/${id}`);
}

export function amortizarPrestamo(
  id: string,
  input: AmortizarPrestamoInput,
): Promise<PrestamoDto> {
  return apiJson(`/prestamos/${id}/amortizar`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function eliminarPrestamo(id: string): Promise<void> {
  // 204 sin body: no se parsea JSON
  await api(`/prestamos/${id}`, { method: 'DELETE' });
}
