import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-root-mp4',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const decodedUrl = decodeURIComponent(req.url || '');
          let videoPath: string | null = null;

          if (
            decodedUrl === '/video.mp4' ||
            decodedUrl === '/final video hod.mp4' ||
            decodedUrl === '/final-video.mp4'
          ) {
            videoPath = fs.existsSync(path.resolve(__dirname, 'public', 'video.mp4'))
              ? path.resolve(__dirname, 'public', 'video.mp4')
              : path.resolve(__dirname, 'final video hod.mp4');
          } else if (
            decodedUrl === '/intro.mp4' ||
            decodedUrl === '/final  hod.mp4' ||
            decodedUrl === '/final hod.mp4' ||
            decodedUrl === '/final clip .mp4' ||
            decodedUrl === '/intro-clip.mp4'
          ) {
            videoPath = fs.existsSync(path.resolve(__dirname, 'public', 'intro.mp4'))
              ? path.resolve(__dirname, 'public', 'intro.mp4')
              : fs.existsSync(path.resolve(__dirname, 'final  hod.mp4'))
              ? path.resolve(__dirname, 'final  hod.mp4')
              : path.resolve(__dirname, 'final clip .mp4');
          }

          if (videoPath && fs.existsSync(videoPath)) {
            const stat = fs.statSync(videoPath);
            const fileSize = stat.size;
            const range = req.headers.range;

            if (range) {
              const parts = range.replace(/bytes=/, '').split('-');
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
              const chunksize = end - start + 1;
              const file = fs.createReadStream(videoPath, { start, end });
              res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
              });
              file.pipe(res);
              return;
            } else {
              res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
                'Accept-Ranges': 'bytes',
              });
              fs.createReadStream(videoPath).pipe(res);
              return;
            }
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
  },
});
