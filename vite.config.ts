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
          if (cleanUrl === '' || cleanUrl === '/' || cleanUrl === '/webapp') {
            const query = (req.url || '').includes('?') ? (req.url || '').slice((req.url || '').indexOf('?')) : '';
            res.writeHead(302, { Location: `/webapp/${query}` });
            res.end();
            return;
          }
          if (req.url && (req.url.startsWith('/webapp/') || req.url === '/webapp') && !req.url.includes('.')) {
            req.url = '/webapp/index.html';
          }
          // Role desks live outside /webapp but are the same single-page app
          if (req.url && /^\/(mentorDesk|teacherAssistantDesk)(\/[^.]*)?(\?.*)?$/i.test(req.url)) {
            req.url = '/webapp/index.html';
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
    // Everything under /webapp/ (www.edurain.in/webapp), so another site can route that one path here
    assetsDir: 'webapp/assets',
    rollupOptions: {
      input: {
        main: 'webapp/index.html',
      },
    },
  },
});