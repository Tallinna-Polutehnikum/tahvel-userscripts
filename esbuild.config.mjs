import fs from 'fs';
import * as esbuild from 'esbuild';
import envFilePlugin from 'esbuild-envfile-plugin';
import { version, dataCollectorVersion } from './src/version.js';

const header1 = fs.readFileSync('./header1.js', 'utf8').replace('${version}', version);
const header1dev = fs.readFileSync('./header1dev.js', 'utf8').replace('${version}', version);
const header2 = fs.readFileSync('./header2.js', 'utf8').replace('${version}', dataCollectorVersion);
const header2dev = fs.readFileSync('./header2dev.js', 'utf8').replace('${version}', dataCollectorVersion);

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
  minify: true,
});

await esbuild.build({
  entryPoints: ['src/tahvel-userscripts.user.js'],
  plugins: [envFilePlugin],
  bundle: true,
  outfile: 'build/tahvel-userscripts-dev.user.js',
  loader: {
    '.css': 'text',
    '.html': 'text'
  },
  format: 'iife',
  platform: 'browser',
  banner: { js: header1dev },
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
  minify: true,
});

await esbuild.build({
  entryPoints: ['src/data-collector.js'],
  plugins: [envFilePlugin],
  bundle: true,
  outfile: 'build/data-collector-dev.user.js',
  loader: {
    '.css': 'text',
    '.html': 'text'
  },
  format: 'iife',
  platform: 'browser',
  banner: { js: header2dev },
  minify: false,
});
