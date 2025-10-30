import * as esbuild from 'esbuild';
import fs from 'fs';
import { version, dataCollectorVersion } from './src/version.js';

const header1 = fs.readFileSync('./header1.js', 'utf8').replace('${version}', version);
const header2 = fs.readFileSync('./header2.js', 'utf8').replace('${version}', dataCollectorVersion);

await esbuild.build({
  entryPoints: ['src/tahvel-userscripts.user.js'],
  bundle: true,
  outfile: 'build/tahvel-userscripts.user.js',
  format: 'iife',
  platform: 'browser',
  banner: { js: header1 },
  minify: false,
});

await esbuild.build({
  entryPoints: ['src/data-collector.js'],
  bundle: true,
  outfile: 'build/data-collector.user.js',
  format: 'iife',
  platform: 'browser',
  banner: { js: header2 },
  minify: false,
});
