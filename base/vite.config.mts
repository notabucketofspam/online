import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  input: "src/goobo/detroit.ts",
  build: {
    target: 'esnext',
    // lib: {
    //   entry: 'src/goobo/detroit.ts',
    //   name: 'detroit',
    //   fileName: ()=>'detroit.js',
    //   formats: ['es']
    // },
    outDir: 'dist/goobo',
		assetsDir: ".",
    emptyOutDir: true,
    minify: false,
    chunkSizeWarningLimit: 8000,
		copyPublicDir: false,
    rollupOptions: {
      external: ['chat', 'livekit-client'],
      output: {
				entryFileNames: 'detroit.js',
        paths: {
          'chat': "/dlc/chat/livekit-widget.js",
          'livekit-client': "/dlc/chat/livekit-client.js"
        },
      },
    },
  },
});
