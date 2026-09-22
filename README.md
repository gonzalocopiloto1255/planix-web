# Planix — Frontend

Interfaz web de **Planix**, un sistema SaaS multi-tenant de gestión de planillas
de sueldos conforme a la legislación laboral peruana. React 19 + Vite 7 +
TypeScript en modo estricto, con Tailwind CSS 4, TanStack Query y Zustand.

Este repositorio contiene **solo la capa de presentación**: 38 pantallas y los
esquemas de validación que comparte con el servidor.

## Ver el sistema funcionando

**https://planix-web-rouge.vercel.app**

Requiere cuenta: puede crearse una desde la propia pantalla de registro.

> El backend corre en el plan gratuito de Render, que suspende el servicio tras
> 15 minutos sin tráfico. **La primera carga puede tardar cerca de un minuto**
> mientras el servidor despierta; a partir de ahí responde con normalidad.

## Cómo se relaciona con el backend

Planix está partido en dos repositorios, y la línea no es arbitraria.

- **Este repositorio (público)** — el frontend y `@planix/shared-types`, el
  paquete de contratos: los esquemas Zod que describen qué viaja entre el
  navegador y la API. Al ser compartidos, cliente y servidor validan con la
  misma definición y no pueden desincronizarse en silencio.
- **El backend (privado)** — la API NestJS, el esquema de base de datos y el
  motor de cálculo. Se mantiene cerrado por dos razones: contiene la
  implementación de las reglas laborales y tributarias peruanas —el valor del
  producto—, y gobierna el acceso a datos personales de trabajadores (DNI,
  remuneraciones, información de salud), cuyo tratamiento regula la Ley 29733
  de Protección de Datos Personales.

El frontend **no calcula nada**. Ni un sol se suma aquí: pide, muestra y envía.
Todo importe que aparece en pantalla lo produjo el motor de cálculo del
servidor. Es una decisión deliberada — el mismo número no puede computarse en
dos sitios con dos redondeos distintos.

Tampoco decide permisos. Las restricciones de rol que verás en el menú y en las
rutas son **comodidad, no seguridad**: la autorización real la aplica la API en
cada petición, y el frontend solo evita ofrecer botones que darían 403.

## Requisitos

- Node.js 24 o superior (ver `.nvmrc`)
- pnpm 11

## Puesta en marcha

```bash
pnpm install
pnpm build     # construye shared-types y luego el frontend
pnpm dev       # servidor de desarrollo en http://localhost:5173
```

**El orden importa.** `pnpm build` desde la raíz construye primero
`packages/shared-types` y después `apps/web`, porque el frontend resuelve sus
tipos desde el `dist/` del paquete compartido. Si entras a `apps/web` y compilas
ahí directamente sin haber construido antes shared-types, TypeScript falla con
`TS2305: has no exported member`.

En desarrollo, Vite hace proxy de `/api` a `http://localhost:3000`, donde se
espera la API. Se puede apuntar a otro sitio con `PLANIX_API_URL`. Sin un
backend levantado la aplicación carga, pero cualquier pantalla con datos
mostrará un error de red: es una interfaz, no una demo autónoma.

## Estructura

```
apps/web/src/
├── paginas/      38 pantallas en 38 archivos, una o varias por módulo
├── componentes/  librería de UI transversal y guardas de ruta
├── lib/          cliente HTTP y funciones por módulo de la API
├── stores/       estado de cliente con Zustand (sesión, empresa activa, avisos)
└── layout/       estructura de la aplicación

packages/shared-types/
└── src/index.ts  esquemas Zod y tipos compartidos con la API
```

## Despliegue

Se despliega como sitio estático. `vercel.example.json` muestra la configuración
usada: un rewrite que envía `/api/*` al backend y un fallback a `index.html`
para el enrutado del lado del cliente.

El rewrite no es opcional. La sesión se sostiene con una cookie `httpOnly`
marcada `SameSite=Strict`; sirviendo la API bajo el mismo origen que la web, la
cookie viaja como primera parte y la sesión sobrevive a una recarga. Apuntando
el frontend directamente a otro dominio, se perdería en cada F5.

**El despliegue en producción no sale de este repositorio.** Vercel construye
Planix desde el monorepo privado donde se desarrolla; aquí no hay ninguna
integración de despliegue conectada.

## Estado

Sistema en producción. Este repositorio se publica como **copia derivada** del
monorepo privado: se regenera desde él y no se aceptan cambios directos, que se
perderían en la siguiente regeneración.

**Última regeneración: 22/09/2026.**

## Licencia

Software propietario. El código puede consultarse con fines de evaluación
académica; no se autoriza su uso, copia ni distribución. Ver [LICENSE](./LICENSE).
