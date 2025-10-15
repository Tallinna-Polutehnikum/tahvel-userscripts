import * as esbuild from 'esbuild';
import fs from 'fs';
import { version } from './src/version.js';

const header = fs.readFileSync('./header.js', 'utf8').replace('${version}', version);

await esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  outfile: 'build/tahvel-userscripts.user.js',
  format: 'iife',
  platform: 'browser',
  banner: { js: header },
  minify: false,
});
