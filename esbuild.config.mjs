import fs from 'fs';
import * as esbuild from 'esbuild';
import envFilePlugin from 'esbuild-envfile-plugin';
import { version, dataCollectorVersion } from './src/version.js';

const header1 = fs.readFileSync('./header1.js', 'utf8').replace('${version}', version);
const header2 = fs.readFileSync('./header2.js', 'utf8').replace('${version}', dataCollectorVersion);

await esbuild.build({
  entryPoints: ['src/tahvel-userscripts.user.js'],
  plugins: [envFilePlugin],
  bundle: true,
  outfile: 'build/tahvel-userscripts.user.js',
  loader: {
    '.css': 'text',
    '.html': 'text'
  },
  format: 'iife',
  platform: 'browser',
  banner: { js: header1 },
  minify: false,
});

await esbuild.build({
  entryPoints: ['src/data-collector.js'],
  plugins: [envFilePlugin],
  bundle: true,
  outfile: 'build/data-collector.user.js',
  loader: {
    '.css': 'text',
    '.html': 'text'
  },
  format: 'iife',
  platform: 'browser',
  banner: { js: header2 },
  minify: false,
});
