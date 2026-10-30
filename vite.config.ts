import { readFile } from 'node:fs/promises';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** import x from './font.ttf?base64' → สตริง base64 ของไฟล์ (ใช้ฝังฟอนต์ไทยลง PDF) */
function base64Import(): Plugin {
  return {
    name: 'base64-import',
    enforce: 'pre',
    async load(id) {
      if (!id.endsWith('?base64')) return null;
      const data = await readFile(id.slice(0, -'?base64'.length));
      return `export default ${JSON.stringify(data.toString('base64'))};`;
    },
  };
}

// mode "artifact": รวมเป็นไฟล์ JS เดียว (IIFE) เพื่อฝังลง HTML ไฟล์เดียวสำหรับเปิดบนเว็บ (claude.ai Artifact)
export default defineConfig(({ mode }) => ({
  plugins: [base64Import(), react()],
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
