import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// La API a la que se hace proxy y los puertos son CONFIGURABLES por
// entorno para que la suite end-to-end pueda levantar su propia pareja
// api+web (3100/5273) sin chocar con el `pnpm dev` que el desarrollador
// tenga abierto en 3000/5173. En desarrollo no hay que definir nada.
const apiDestino = process.env.PLANIX_API_URL ?? 'http://localhost:3000';
const puertoWeb = Number(process.env.PLANIX_WEB_PORT ?? 5173);

const proxy = {
  '/api': {
    target: apiDestino,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: puertoWeb, proxy },
  // `vite preview` NO hereda server.proxy: sirve el build de dist y sin
  // este bloque las llamadas a /api caerían en un 404 del propio Vite.
  // La suite e2e prueba contra el build de producción, no contra el dev
  // server, así que este proxy es el que usan los tests.
  preview: { port: puertoWeb, proxy },
});
