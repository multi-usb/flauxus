// FLAUXUS · optimiza los escenarios del juego (atrio + 6 salas) para la web.
//
//   1. Blender (sin interfaz) convierte cada FBX a GLB, sin simplificar: se conserva cada triángulo.
//   2. glTF-Transform:
//      - quita la textura metal/rugosidad (el juego no la usa: AssetManager.prepareMaterials fija esos valores);
//      - comprime la geometría con meshopt (EXT_meshopt_compression; cuantización de 16 bits en posiciones);
//      - pasa color y normales a WebP.
//   Resultado: modelos/<nombre>.glb. Los .fbx de la raíz quedan como másters y no se publican.
//
// Uso (desde flauxus/juego, con las dependencias de ../landing instaladas):
//   node tools/optimizar-escenarios.mjs              → todos
//   node tools/optimizar-escenarios.mjs Nivel1_…fbx  → uno
// Requiere Blender 4.5+ (variable BLENDER si no está en la ruta por defecto).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..');
const require = createRequire(path.resolve(GAME, '../landing/package.json'));
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { dedup, prune, weld, meshopt, textureCompress } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder } = require('meshoptimizer');
const sharp = require('sharp');

const BLENDER = process.env.BLENDER || 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const OUT = path.join(GAME, 'modelos');
const ESCENARIOS = [
  'Atrio_nivel_completo_version_detallada.fbx',
  'Nivel1_DO_El_sonido_bello_nivel_completo.fbx',
  'Nivel2_RE_El_pulso_nivel_completo.fbx',
  'Nivel3_MI_El_fraseo_nivel_completo.fbx',
  'Nivel4_FAsostenido_El_cuerpo_nivel_completo.fbx',
  'Nivel5_SOL_A_Terrazas.fbx',
  'Nivel6_LAsostenido_Matar_al_padre_nivel_completo.fbx',
];

const BLENDER_PY = `
import bpy, sys
src, dst = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.fbx_import(filepath=src)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='AUTO',
                          export_cameras=False, export_lights=False, export_animations=False, export_yup=True)
`;

async function main() {
  const pick = process.argv.slice(2);
  const list = pick.length ? pick : ESCENARIOS;
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flauxus-glb-'));
  const py = path.join(tmp, 'fbx_to_glb.py');
  fs.writeFileSync(py, BLENDER_PY);
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

  for (const fbx of list) {
    const name = path.basename(fbx, '.fbx');
    const raw = path.join(tmp, `${name}.raw.glb`);
    const dst = path.join(OUT, `${name}.glb`);
    console.log(`· ${name}`);
    execFileSync(BLENDER, ['-b', '--factory-startup', '-P', py, '--', path.join(GAME, fbx), raw], { stdio: 'ignore' });

    const doc = await io.read(raw);
    for (const m of doc.getRoot().listMaterials()) m.setMetallicRoughnessTexture(null);
    await doc.transform(
      dedup(),
      prune(),
      weld(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(baseColor|emissive)/, quality: 88 }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^normal/, quality: 92 }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 14 }),
    );
    await io.write(dst, doc);
    const mb = (b) => (b / 1048576).toFixed(1);
    console.log(`  ${mb(fs.statSync(path.join(GAME, fbx)).size)} MB FBX → ${mb(fs.statSync(dst).size)} MB GLB`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });
