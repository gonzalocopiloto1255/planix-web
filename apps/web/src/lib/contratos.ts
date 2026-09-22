import type {
  ContratoDto,
  CrearContratoInput,
  PlantillaContratoDto,
  PlantillaContratoInput,
  RenovarContratoInput,
  RespuestaContratoDto,
  VencimientosContratosDto,
} from '@planix/shared-types';
import { api, apiJson } from './api';

// ------------------------- Plantillas -------------------------

export function listarPlantillas(empresaId: string): Promise<PlantillaContratoDto[]> {
  return apiJson(`/empresas/${empresaId}/plantillas-contrato`);
}

export function crearPlantilla(
  empresaId: string,
  input: PlantillaContratoInput,
): Promise<PlantillaContratoDto> {
  return apiJson(`/empresas/${empresaId}/plantillas-contrato`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function actualizarPlantilla(
  id: string,
  input: PlantillaContratoInput,
): Promise<PlantillaContratoDto> {
  return apiJson(`/plantillas-contrato/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// ------------------------- Contratos -------------------------

export function contratosDeEmpresa(empresaId: string): Promise<ContratoDto[]> {
  return apiJson(`/empresas/${empresaId}/contratos`);
}

export function vencimientosContratos(
  empresaId: string,
): Promise<VencimientosContratosDto> {
  return apiJson(`/empresas/${empresaId}/contratos/vencimientos`);
}

export function contratosDePersona(
  empresaId: string,
  personaId: string,
): Promise<ContratoDto[]> {
  return apiJson(`/empresas/${empresaId}/personas/${personaId}/contratos`);
}

export function crearContrato(
  empresaId: string,
  personaId: string,
  input: CrearContratoInput,
): Promise<RespuestaContratoDto> {
  return apiJson(`/empresas/${empresaId}/personas/${personaId}/contratos`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function renovarContrato(
  id: string,
  input: RenovarContratoInput,
): Promise<RespuestaContratoDto> {
  return apiJson(`/contratos/${id}/renovar`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function abrirPdfContrato(id: string): Promise<void> {
  const res = await api(`/contratos/${id}/pdf`);
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ------------------------- Presentación -------------------------

export const NOMBRE_TIPO_CONTRATO: Record<ContratoDto['tipo'], string> = {
  INDETERMINADO: 'Indeterminado',
  PLAZO_FIJO: 'Plazo fijo',
  PART_TIME: 'Part-time',
  CONVENIO_PRACTICAS: 'Convenio de prácticas',
};

/** Semáforo del estado calculado */
export const ESTILO_ESTADO: Record<ContratoDto['estado'], string> = {
  VIGENTE: 'bg-green-100 text-green-700',
  SIN_FIN: 'bg-green-100 text-green-700',
  POR_VENCER: 'bg-amber-100 text-amber-700',
  VENCIDO: 'bg-red-100 text-red-700',
  RENOVADO: 'bg-slate-100 text-slate-500',
};

export const NOMBRE_ESTADO: Record<ContratoDto['estado'], string> = {
  VIGENTE: 'Vigente',
  SIN_FIN: 'Sin fin (indeterminado)',
  POR_VENCER: 'Por vencer',
  VENCIDO: 'Vencido',
  RENOVADO: 'Renovado',
};
