import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'redirect-to-study',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const cleanUrl = (req.url || '').split('?')[0];
          if (cleanUrl === '' || cleanUrl === '/' || cleanUrl === '/study') {
            const query = (req.url || '').includes('?') ? (req.url || '').slice((req.url || '').indexOf('?')) : '';
            res.writeHead(302, { Location: `/study/${query}` });
            res.end();
            return;
          }
          if (req.url && (req.url.startsWith('/study/') || req.url === '/study') && !req.url.includes('.')) {
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
    host: true,
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: 'study/index.html',
      },
    },
  },
});