import type {
  EmpresaConAdvertencias,
  EmpresaDto,
  EmpresaInput,
} from '@planix/shared-types';
import { apiJson } from './api';

export function listarEmpresas(opciones?: {
  buscar?: string;
  incluirInactivas?: boolean;
}): Promise<EmpresaDto[]> {
  const params = new URLSearchParams();
  if (opciones?.buscar) {
    params.set('buscar', opciones.buscar);
  }
  if (opciones?.incluirInactivas) {
    params.set('incluirInactivas', 'true');
  }
  const qs = params.toString();
  return apiJson<EmpresaDto[]>(`/empresas${qs ? `?${qs}` : ''}`);
}

export function obtenerEmpresa(id: string): Promise<EmpresaDto> {
  return apiJson<EmpresaDto>(`/empresas/${id}`);
}

export function crearEmpresa(input: EmpresaInput): Promise<EmpresaConAdvertencias> {
  return apiJson<EmpresaConAdvertencias>('/empresas', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function actualizarEmpresa(
  id: string,
  input: EmpresaInput,
): Promise<EmpresaConAdvertencias> {
  return apiJson<EmpresaConAdvertencias>(`/empresas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function desactivarEmpresa(id: string): Promise<EmpresaDto> {
  return apiJson<EmpresaDto>(`/empresas/${id}`, { method: 'DELETE' });
}
