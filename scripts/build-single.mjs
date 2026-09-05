/**
 * Produit une page AUTONOME : docs/index.html, un seul fichier contenant le
 * HTML, le CSS et la totalite du JavaScript (three.js compris) en ligne.
 *
 * Pourquoi : index.html a la racine est le point d'entree du projet, il
 * reference `./src/main.js` qui importe `three` par son nom de paquet. Un
 * navigateur ne sait pas resoudre un specificateur nu — servir le depot tel
 * quel donne une page qui ne demarre jamais. La page generee ici n'a aucune
 * dependance : elle fonctionne ouverte en double-clic (file://), deposee sur
 * n'importe quel hebergeur, ou publiee par GitHub Pages depuis /docs.
 */
import { build } from 'vite';
import { mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(root, '.single');
const dest = join(root, 'docs', 'index.html');

rmSync(tmp, { recursive: true, force: true });

await build({
  root,
  configFile: false,
  base: './',
  logLevel: 'warn',
  build: {
    outDir: tmp,
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 1e9,
    rollupOptions: {
      // un seul chunk : indispensable pour pouvoir tout mettre en ligne
      output: { inlineDynamicImports: true, entryFileNames: 'bundle.js', assetFileNames: 'bundle[extname]' },
    },
  },
});

const html = readFileSync(join(tmp, 'index.html'), 'utf8');
const js = readFileSync(join(tmp, 'bundle.js'), 'utf8');
const css = readFileSync(join(tmp, 'bundle.css'), 'utf8');

const out = html
  .replace(/<script[^>]*src="[^"]*bundle\.js"[^>]*><\/script>/,
    () => `<script type="module">\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`)
  .replace(/<link[^>]*href="[^"]*bundle\.css"[^>]*>/,
    () => `<style>\n${css}\n</style>`);

if (out.includes('bundle.js') || out.includes('bundle.css')) {
  throw new Error('Inlining incomplet : une reference externe subsiste.');
}

mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, out);
writeFileSync(join(root, 'docs', '.nojekyll'), '');
rmSync(tmp, { recursive: true, force: true });

console.log(`docs/index.html — ${(statSync(dest).size / 1024).toFixed(0)} ko, page autonome (aucune dependance externe)`);
