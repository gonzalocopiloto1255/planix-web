import type { RegimenLaboral } from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, CirclePlus, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Boton,
  BotonEnlace,
  CabeceraPagina,
  Input,
  SkeletonTabla,
  Tabla,
  Tarjeta,
  Td,
  Th,
  Tr,
  Vacio,
  type TonoBadge,
} from '../componentes/ui';
import { ApiError } from '../lib/api';
import { desactivarEmpresa, listarEmpresas } from '../lib/empresas';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

const REGIMEN: Record<RegimenLaboral, { etiqueta: string; tono: TonoBadge }> = {
  GENERAL: { etiqueta: 'General', tono: 'primario' },
  PEQUENA_EMPRESA: { etiqueta: 'Pequeña empresa', tono: 'advertencia' },
  MICROEMPRESA: { etiqueta: 'Microempresa', tono: 'info' },
};

export function Empresas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const empresaActiva = useEmpresaActiva();
  const [buscar, setBuscar] = useState('');
  const [incluirInactivas, setIncluirInactivas] = useState(false);

  const { data: empresas, isPending } = useQuery({
    queryKey: ['empresas', buscar, incluirInactivas],
    queryFn: () => listarEmpresas({ buscar: buscar || undefined, incluirInactivas }),
  });

  const desactivar = useMutation({
    mutationFn: desactivarEmpresa,
    onSuccess: (empresa) => {
      agregarToast('exito', `${empresa.razonSocial} quedó desactivada`);
      if (empresaActiva.id === empresa.id) {
        empresaActiva.limpiar();
      }
      void queryClient.invalidateQueries({ queryKey: ['empresas'] });
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo desactivar'),
  });

  const hayEmpresas = (empresas?.length ?? 0) > 0;
  const listaVaciaSinFiltros =
    !isPending && !hayEmpresas && !buscar && !incluirInactivas;

  if (listaVaciaSinFiltros) {
    return (
      <Tarjeta>
        <Vacio
          icono={<Building2 className="size-6" />}
          titulo="Registra tu primera empresa cliente"
          descripcion="Las planillas, personas y beneficios se organizan por empresa. Empieza registrando a tu primer cliente del estudio."
          accion={
            <BotonEnlace
              a="/empresas/nueva"
              variante="primario"
              iconoIzquierda={<CirclePlus className="size-4" />}
            >
              Registrar empresa
            </BotonEnlace>
          }
        />
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-5">
      <CabeceraPagina
        titulo="Empresas"
        descripcion="Los clientes de tu estudio. Elige una como empresa activa para trabajar sobre ella."
        acciones={
          <BotonEnlace
            a="/empresas/nueva"
            variante="primario"
            iconoIzquierda={<CirclePlus className="size-4" />}
          >
            Nueva empresa
          </BotonEnlace>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-tenue" />
          <Input
            type="search"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por razón social o RUC…"
            className="pl-9"
            aria-label="Buscar empresas"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-cuerpo text-texto-suave">
          <input
            type="checkbox"
            checked={incluirInactivas}
            onChange={(e) => setIncluirInactivas(e.target.checked)}
            className="size-4 rounded border-borde-fuerte accent-primario"
          />
          Mostrar inactivas
        </label>
      </div>

      <Tarjeta>
        {isPending ? (
          <SkeletonTabla />
        ) : !hayEmpresas ? (
          <Vacio
            icono={<Search className="size-6" />}
            titulo="Sin resultados"
            descripcion="Ninguna empresa coincide con la búsqueda. Prueba con otro término o revisa si está inactiva."
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Razón social</Th>
                <Th>RUC</Th>
                <Th>Régimen laboral</Th>
                <Th>Estado</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {empresas?.map((e) => {
                const regimen = REGIMEN[e.regimenLaboral];
                const esActiva = empresaActiva.id === e.id;
                return (
                  <Tr key={e.id}>
                    <Td>
                      <p className="font-medium text-texto">{e.razonSocial}</p>
                      {e.nombreComercial && (
                        <p className="text-apoyo text-texto-tenue">
                          {e.nombreComercial}
                        </p>
                      )}
                    </Td>
                    <Td className="cifras text-texto-suave">{e.ruc}</Td>
                    <Td>
                      <Badge tono={regimen.tono}>{regimen.etiqueta}</Badge>
                    </Td>
                    <Td>
                      {e.activo ? (
                        <Badge tono="exito" icono={<CheckCircle2 className="size-3.5" />}>
                          Activa
                        </Badge>
                      ) : (
                        <Badge tono="neutro">Inactiva</Badge>
                      )}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        {e.activo && !esActiva && (
                          <Boton
                            tamano="sm"
                            variante="secundario"
                            onClick={() => {
                              empresaActiva.seleccionar(e.id, e.razonSocial);
                              agregarToast('exito', `Trabajando sobre ${e.razonSocial}`);
                            }}
                          >
                            Usar
                          </Boton>
                        )}
                        {esActiva && (
                          <Badge tono="primario" icono={<CheckCircle2 className="size-3.5" />}>
                            Activa ahora
                          </Badge>
                        )}
                        <Boton
                          tamano="sm"
                          variante="secundario"
                          onClick={() => navigate(`/empresas/${e.id}/editar`)}
                        >
                          Editar
                        </Boton>
                        {e.activo && (
                          <Boton
                            tamano="sm"
                            variante="peligro"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `¿Desactivar ${e.razonSocial}? Sus datos se conservan.`,
                                )
                              ) {
                                desactivar.mutate(e.id);
                              }
                            }}
                          >
                            Desactivar
                          </Boton>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>
    </div>
  );
}
