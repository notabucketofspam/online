import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		cssInjectedByJsPlugin()
	],
	base: '/chat/',
	server: {
		port: 10770,
	},
	define: {
		'process.env.NODE_ENV': JSON.stringify('production')
	},
	build: {
		lib: {
			entry: 'src/widget.tsx',
			name: 'LiveKitWidget',
			fileName: 'livekit-widget',
			formats: ['es']
		},
		outDir: 'dist',
		chunkSizeWarningLimit: 8000,
		cssCodeSplit: false,
		emptyOutDir: false,
		rolldownOptions: {
			treeshake: {
				moduleSideEffects: false
			}
		}
	}
});
