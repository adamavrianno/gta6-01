// Porto Verde: Neon Tide — the entry program for make.fun's gta6-01 bounty.
//
// It hands the game in: the static game/ folder and the screenshots/ folder are
// copied from this repository into the output directory, and a dossier.json is
// written there with the kit's buildDossier. The program runs on Node 22 with
// the standard library only, and it never deletes the output directory itself —
// the grader mounts that directory, so only its contents are refreshed.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

function refreshDir(target: string, source: string): void {
  // Replace one output sub-directory with a fresh copy of the source.
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

function handIn(): void {
  mkdirSync(outDir, { recursive: true });
  refreshDir(join(outDir, 'game'), join(repoRoot, 'game'));
  if (existsSync(join(repoRoot, 'screenshots'))) {
    refreshDir(join(outDir, 'screenshots'), join(repoRoot, 'screenshots'));
  }
  // The scorer's caps for this bounty: dossier text, screenshot count/size,
  // and the game/ file-count and byte limits.
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

handIn();
