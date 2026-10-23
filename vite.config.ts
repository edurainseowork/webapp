import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'redirect-to-study',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            res.writeHead(302, { Location: '/study/' });
            res.end();
            return;
          }
          if (req.url && req.url.startsWith('/study/') && !req.url.includes('.')) {
            req.url = '/study/index.html';
          }
          // Role desks live outside /study but are the same single-page app
          if (req.url && /^\/(mentorDesk|teacherAssistantDesk)(\/[^.]*)?(\?.*)?$/i.test(req.url)) {
            req.url = '/study/index.html';
          }
          next();
        });
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: 'study/index.html',
      },
    },
  },
});