import type {
  CuentaBancariaDto,
  CuentaBancariaInput,
  PersonaConAdvertencias,
  PersonaDto,
  PersonaHistorialDto,
  PersonaInput,
  ResultadoImportacion,
  TipoCuentaBancaria,
  TipoVinculo,
} from '@planix/shared-types';
import { api, apiJson } from './api';

export function listarPersonas(
  empresaId: string,
  opciones?: { tipoVinculo?: TipoVinculo; buscar?: string; incluirCesados?: boolean },
): Promise<PersonaDto[]> {
  const params = new URLSearchParams();
  if (opciones?.tipoVinculo) params.set('tipoVinculo', opciones.tipoVinculo);
  if (opciones?.buscar) params.set('buscar', opciones.buscar);
  if (opciones?.incluirCesados) params.set('incluirCesados', 'true');
  const qs = params.toString();
  return apiJson(`/empresas/${empresaId}/personas${qs ? `?${qs}` : ''}`);
}

export function obtenerPersona(empresaId: string, id: string): Promise<PersonaDto> {
  return apiJson(`/empresas/${empresaId}/personas/${id}`);
}

export function crearPersona(
  empresaId: string,
  input: PersonaInput,
): Promise<PersonaConAdvertencias> {
  return apiJson(`/empresas/${empresaId}/personas`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function actualizarPersona(
  empresaId: string,
  id: string,
  input: PersonaInput,
): Promise<PersonaConAdvertencias> {
  return apiJson(`/empresas/${empresaId}/personas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function cesarPersona(empresaId: string, id: string): Promise<PersonaDto> {
  return apiJson(`/empresas/${empresaId}/personas/${id}`, { method: 'DELETE' });
}

export function historialPersona(
  empresaId: string,
  id: string,
): Promise<PersonaHistorialDto[]> {
  return apiJson(`/empresas/${empresaId}/personas/${id}/historial`);
}

export function listarCuentas(
  empresaId: string,
  id: string,
): Promise<CuentaBancariaDto[]> {
  return apiJson(`/empresas/${empresaId}/personas/${id}/cuentas`);
}

export function guardarCuenta(
  empresaId: string,
  id: string,
  tipo: TipoCuentaBancaria,
  input: CuentaBancariaInput,
): Promise<CuentaBancariaDto> {
  return apiJson(`/empresas/${empresaId}/personas/${id}/cuentas/${tipo}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function descargarPlantilla(empresaId: string): Promise<void> {
  const res = await api(`/empresas/${empresaId}/importador/plantilla`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'plantilla-importacion-planix.xlsx';
  enlace.click();
  URL.revokeObjectURL(url);
}

export async function importarArchivo(
  empresaId: string,
  archivo: File,
): Promise<ResultadoImportacion> {
  const fd = new FormData();
  fd.append('archivo', archivo);
  // No usar el wrapper apiJson: multipart no lleva Content-Type manual
  const { useAuth } = await import('../stores/auth');
  const token = useAuth.getState().sesion?.accessToken;
  const res = await fetch(`/api/empresas/${empresaId}/importador`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    throw new Error('No se pudo procesar el archivo');
  }
  return (await res.json()) as ResultadoImportacion;
}
