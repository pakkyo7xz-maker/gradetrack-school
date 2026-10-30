import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// mode "artifact": รวมเป็นไฟล์ JS เดียว (IIFE) เพื่อฝังลง HTML ไฟล์เดียวสำหรับเปิดบนเว็บ (claude.ai Artifact)
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { host: true, port: 5173 },
  build:
    mode === 'artifact'
      ? {
          outDir: 'dist-artifact',
          modulePreload: false,
          cssCodeSplit: false,
          rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
        }
      : {
          rollupOptions: { output: { manualChunks: { xlsx: ['xlsx'], react: ['react', 'react-dom'] } } },
        },
}));
