import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  build: {
    lib: {
      entry: 'src/goobo/detroit.ts',
      name: 'detroit',
      fileName: ()=>'detroit.js',
      formats: ['es']
    },
    outDir: 'dist/goobo',
    emptyOutDir: true
  },
});
