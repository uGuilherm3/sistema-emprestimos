import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import os from 'os'

// Lê o IPv4 real da máquina via interfaces de rede do SO
function getMachineIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'IP não identificado';
}

export default defineConfig({
  base: '/sistema-emprestimos/',
  server: {
    host: true,
    proxy: {
      '/api/printers-data': {
        target: 'http://192.168.0.253:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/printers-data/, '/api'), 
      },
    }
  },
  plugins: [
    react(),
    tailwindcss(), // <- Novo plugin do Tailwind v4
    nodePolyfills(),
    {
      name: 'machine-ip-plugin',
      configureServer(server) {
        const ip = getMachineIP();
        
        // Redireciona /sistema-emprestimos para /sistema-emprestimos/ se a barra faltar
        server.middlewares.use((req, res, next) => {
          if (req.url === '/sistema-emprestimos') {
            res.writeHead(301, { Location: '/sistema-emprestimos/' });
            res.end();
            return;
          }
          next();
        });

        server.middlewares.use('/api/machine-ip', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ip }));
        });
      }
    }
  ],
})