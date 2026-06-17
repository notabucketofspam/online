import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [plugin()],
	base: '/chat/',
    server: {
        port: 10770,
    },
    build: {
        outDir: 'dist',
			chunkSizeWarningLimit: 2000,
    }
})
