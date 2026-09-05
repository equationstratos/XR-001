import { defineConfig } from 'vite';

export default defineConfig({
  // Le point d'entree de developpement est src/index.html. La racine du depot
  // est reservee a index.html : la page AUTONOME generee par
  // `npm run build:single`, celle qui est publiee et qui fonctionne partout.
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // three est la seule grosse dependance : on l'isole pour un cache long terme.
        manualChunks: { three: ['three'] },
      },
    },
  },
});
