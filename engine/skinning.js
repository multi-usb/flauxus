/* ======================================================================
   FLAUXUS — engine/skinning.js
   Rig profesional de la entrega + clips Mixamo retargetizados.

   Los FBX `*_rig_Run.fbx` ya traen esqueleto, skin weights y texturas 2K.
   El problema es que sus huesos no comparten los ejes locales de Mixamo:
   copiar rotaciones absolutas (lo que hace SkeletonUtils.retargetClip) deja
   las piernas cruzadas y el cuerpo acostado. Aquí se retargetiza por DELTA
   MUNDIAL, que conserva la pose de reposo de cada rig:

     delta(hueso) = qMundoClip · qMundoReposo⁻¹
     qDestino     = delta · qMundoReposoDestino
     qLocal       = qPadreMundoAnimado⁻¹ · qDestino

   Los huesos que no existen en Mixamo (dedos recortados, `headfront`)
   heredan el delta de su padre. La cadera se mueve en el espacio local de
   su padre con la diferencia de posición mundial escalada por la altura.

   El resultado son dos AnimationClip por versión (idle y walk) que el
   AnimationMixer reproduce en bucle sobre el rig original, sin tocar sus
   pesos ni su topología.
   ====================================================================== */
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const V3 = THREE.Vector3, Q = THREE.Quaternion;
const loader = new FBXLoader();
const IDENTITY = new Q();
/* Mixamo camina con las piernas bastante abiertas; en estos rigs de
   caderas estrechas el paso se ve de robot. Solo el clip `walk` recibe
   una aducción constante de los muslos (≈6°) para cerrar la postura.
   El idle se queda tal cual. */
const WALK_LEG_TUCK = .105;

function loadFBX(url) {
  return new Promise((resolve, reject) => {
    loader.load(new URL(url, document.baseURI).href, resolve, undefined, reject);
  });
}

/* ======================================================================
   FUENTES MIXAMO — esqueleto y clip, una sola vez para todas las versiones
   ====================================================================== */
let mixamoPromise = null;

export function loadMixamo() {
  if (mixamoPromise) return mixamoPromise;
  mixamoPromise = Promise.all([
    loadFBX('personaje/Idle.fbx'),
    loadFBX('personaje/Walking.fbx')
  ]).then(([idleRoot, walkRoot]) => {
    const pack = root => {
      root.updateMatrixWorld(true);
      const bones = [];
      root.traverse(o => { if (o.isBone) bones.push(o); });
      if (!bones.length || !root.animations?.length) throw new Error('Mixamo sin esqueleto o clip');
      return { root, bones, clip: root.animations[0] };
    };
    return { idle: pack(idleRoot), walk: pack(walkRoot) };
  }).catch(err => {
    mixamoPromise = null;
    throw err;
  });
  return mixamoPromise;
}

/* ======================================================================
   PREPARACIÓN DEL RIG
   Escala a 2,6 m (la misma altura que usaba el juego), centra los pies en
   y=0 y guarda la pose de reposo NATIVA. No se usa Skeleton.pose(): en los
   rigs con armature rotada −90° y escala 100 reconstruye mal el bind y deja
   el cuerpo acostado.
   ====================================================================== */
export function prepareRig(root, targetHeight = 2.6) {
  root.updateMatrixWorld(true);
  let mesh = null;
  root.traverse(o => { if (!mesh && o.isSkinnedMesh) mesh = o; });
  if (!mesh) throw new Error('El FBX no trae SkinnedMesh');

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new V3());
  const k = targetHeight / Math.max(1e-6, size.y);
  root.scale.setScalar(k);
  root.position.set(
    -(box.min.x + box.max.x) * .5 * k,
    -box.min.y * k,
    -(box.min.z + box.max.z) * .5 * k
  );
  root.updateMatrixWorld(true);

  const restPose = [], bones = new Map();
  root.traverse(o => {
    if (!o.isBone) return;
    bones.set(o.name, o);
    restPose.push({ bone: o, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() });
  });
  if (!bones.has('mixamorigHips')) throw new Error('Rig sin mixamorigHips');

  return {
    root, mesh, skeleton: mesh.skeleton, bones, restPose,
    template: makeTemplate(bones), scale: k, height: size.y, clips: null
  };
}

/* Datos de reposo que necesita el IK de flauta, en espacio del grupo visual
   (el rig se prepara antes de colgarse de él, con el visual en identidad). */
function makeTemplate(bones) {
  const restWorldQuats = {}, restLocalQuats = {}, restDirs = {}, worldPos = new Map();
  for (const [name, b] of bones) {
    restWorldQuats[name] = b.getWorldQuaternion(new Q()).toArray();
    restLocalQuats[name] = b.quaternion.toArray();
    worldPos.set(name, b.getWorldPosition(new V3()));
  }
  for (const [name, b] of bones) {
    const child = b.children.find(c => c.isBone);
    if (child) restDirs[name] = child.getWorldPosition(new V3()).sub(worldPos.get(name)).normalize().toArray();
  }
  /* La mano no apunta al primer hijo (el pulgar): su dirección es su eje
     local Y, que es el que siguen los dedos. */
  for (const [name, b] of bones) {
    if (name.endsWith('Hand')) {
      restDirs[name] = new V3(0, 1, 0).applyQuaternion(new Q().fromArray(restWorldQuats[name])).toArray();
    }
  }
  return { restWorldQuats, restLocalQuats, restDirs };
}

function resetPose(rig) {
  for (const r of rig.restPose) {
    r.bone.position.copy(r.p);
    r.bone.quaternion.copy(r.q);
    r.bone.scale.copy(r.s);
  }
  rig.root.updateMatrixWorld(true);
}

/* Eje y signo de la aducción de cada muslo. Se calculan en la pose de
   reposo para que sirvan igual en los tres rigs (body y cyborg traen el
   armature rotado −90° y escala 100). */
function makeLegTuck(rig) {
  const left = rig.bones.get('mixamorigLeftUpLeg');
  const right = rig.bones.get('mixamorigRightUpLeg');
  const hips = rig.bones.get('mixamorigHips');
  if (!left || !right || !hips) return null;
  const lateral = left.getWorldPosition(new V3()).sub(right.getWorldPosition(new V3()));
  if (lateral.lengthSq() < 1e-8) return null;
  lateral.normalize();
  const axis = new V3(0, 1, 0).cross(lateral).normalize();
  const hip = hips.getWorldPosition(new V3());
  const map = new Map();
  for (const bone of [left, right]) {
    const side = Math.sign(bone.getWorldPosition(new V3()).sub(hip).dot(lateral)) || 1;
    map.set(bone.name, { axis, angle: side * WALK_LEG_TUCK });
  }
  return map;
}

function depthOf(b) { let d = 0, p = b.parent; while (p) { d++; p = p.parent; } return d; }
function orderedBones(bones) { return bones.slice().sort((a, b) => depthOf(a) - depthOf(b)); }

/* ======================================================================
   HORNEADO — delta mundial por hueso, 30 fps, bucle perfecto
   ====================================================================== */
export function bakeClips(rig, mixamo, fps = 30) {
  rig.clips = {
    idle: bakeClip(rig, mixamo.idle, 'idle', fps),
    walk: bakeClip(rig, mixamo.walk, 'walk', fps)
  };
  /* El rig plantilla se queda en su pose nativa: los clones arrancan
     erguidos y el primer frame del mixer ya coloca el idle. */
  resetPose(rig);
  return rig.clips;
}

function bakeClip(rig, source, name, fps) {
  const duration = source.clip.duration;
  const frames = Math.max(2, Math.round(duration * fps) + 1);
  const dt = duration / (frames - 1);

  resetPose(rig);
  const legTuck = name === 'walk' ? makeLegTuck(rig) : null;
  const tgtBones = orderedBones(rig.skeleton.bones);
  const tgtRestQ = new Map(), objRestQ = new Map();
  for (const b of tgtBones) {
    const q = b.getWorldQuaternion(new Q());
    tgtRestQ.set(b.name, q);
    objRestQ.set(b, q);
    if (b.parent && !objRestQ.has(b.parent)) objRestQ.set(b.parent, b.parent.getWorldQuaternion(new Q()));
  }
  const hip = rig.bones.get('mixamorigHips');
  const hipParent = hip.parent;
  hipParent.updateMatrixWorld(true);
  const hipParentInv = new THREE.Matrix4().copy(hipParent.matrixWorld).invert();
  const hipRestW = hip.getWorldPosition(new V3());

  source.root.updateMatrixWorld(true);
  const srcBones = source.bones;
  const srcRestQ = new Map(), srcRestW = new Map();
  for (const b of srcBones) {
    srcRestQ.set(b.name, b.getWorldQuaternion(new Q()));
    srcRestW.set(b.name, b.getWorldPosition(new V3()));
  }
  const srcHip = srcBones.find(b => b.name === 'mixamorigHips');
  const srcHipRest = srcRestW.get('mixamorigHips');
  const k = hipRestW.y / srcHipRest.y; // cm de Mixamo → unidades del rig

  const mixer = new THREE.AnimationMixer(source.root);
  mixer.clipAction(source.clip).play();
  mixer.update(0);

  const tracks = new Map();
  const hipTimes = new Float32Array(frames);
  const hipValues = new Float32Array(frames * 3);

  for (let f = 0; f < frames; f++) {
    const time = f * dt;
    if (f > 0) mixer.update(dt);
    source.root.updateMatrixWorld(true);

    /* Delta mundial de cada hueso Mixamo respecto de su reposo. */
    const srcDelta = new Map();
    for (const b of srcBones) {
      const q0 = srcRestQ.get(b.name);
      if (!q0) continue;
      const q1 = b.getWorldQuaternion(new Q());
      srcDelta.set(b.name, q1.multiply(q0.clone().invert()));
    }

    /* Aplicación jerárquica sobre el reposo del destino. */
    const worldQ = new Map();
    for (const b of tgtBones) {
      let D = srcDelta.get(b.name);
      if (!D) {
        const parentD = b.parent ? srcDelta.get(b.parent.name) : null;
        D = parentD ? parentD.clone() : IDENTITY.clone();
      }
      const desiredW = D.clone().multiply(tgtRestQ.get(b.name));
      const parentW = b.parent
        ? (worldQ.get(b.parent) || objRestQ.get(b.parent) || IDENTITY.clone())
        : IDENTITY.clone();
      let localQ = parentW.clone().invert().multiply(desiredW);
      worldQ.set(b, desiredW);

      /* El muslo se cierra en espacio mundial. `worldQ` guarda la pose
         sin cerrar: así los hijos conservan sus locales y toda la pierna
         gira junta. Si se actualizara, el pie compensaría y solo giraría
         el muslo. */
      const tuck = legTuck?.get(b.name);
      if (tuck) {
        const qTuck = new Q().setFromAxisAngle(tuck.axis, tuck.angle);
        localQ = parentW.clone().invert().multiply(qTuck).multiply(desiredW);
      }

      let tr = tracks.get(b.name);
      if (!tr) {
        tr = { times: new Float32Array(frames), values: new Float32Array(frames * 4) };
        tracks.set(b.name, tr);
      }
      tr.times[f] = time;
      localQ.toArray(tr.values, f * 4);
    }

    /* Cadera: reposo + diferencia mundial escalada. Se pasa al espacio local
       del padre (la armature), que puede tener rotación y escala. */
    const p = srcHip.getWorldPosition(new V3());
    const local = new V3(
      hipRestW.x + (p.x - srcHipRest.x) * k,
      hipRestW.y + (p.y - srcHipRest.y) * k,
      hipRestW.z + (p.z - srcHipRest.z) * k
    ).applyMatrix4(hipParentInv);
    hipTimes[f] = time;
    hipValues[f * 3] = local.x;
    hipValues[f * 3 + 1] = local.y;
    hipValues[f * 3 + 2] = local.z;
  }

  mixer.uncacheAction(source.clip);

  const out = [];
  for (const [boneName, tr] of tracks) {
    out.push(new THREE.QuaternionKeyframeTrack(boneName + '.quaternion', tr.times, tr.values));
  }
  out.push(new THREE.VectorKeyframeTrack('mixamorigHips.position', hipTimes, hipValues));
  return new THREE.AnimationClip(name, duration, out);
}

/* ======================================================================
   IK DE FLAUTA — dos huesos por brazo sobre la pose del mixer
   ====================================================================== */
const _shoulder = new V3(), _target = new V3(), _targetLocal = new V3(), _axis = new V3(), _base = new V3(),
  _perp = new V3(), _elbow = new V3(), _dir = new V3(), _rest = new V3(),
  _qDelta = new Q(), _qRest = new Q(), _qParent = new Q(), _qDesired = new Q(),
  _qLocal = new Q(), _qCurl = new Q(), _scale = new V3(), _qVisual = new Q(),
  _palm = new V3(), _xW = new V3(), _zW = new V3(), _fingerAxis = new V3(1, 0, 0),
  _basis = new THREE.Matrix4();

/* Curl extra de los dedos para el rig original (el único con falanges).
   Se suma a la pose del mixer en el espacio local de cada falange: +X
   flexiona hacia la palma, que tras orientar la muñeca es el lado donde
   queda el tubo. Los ángulos son suaves para que la mano sujete sin
   cerrarse en un puño. */
const FLUTE_FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
const FLUTE_FINGER_CURL = {
  Index: [.26, .36, .24],
  Middle: [.28, .38, .26],
  Ring: [.26, .36, .24],
  Pinky: [.22, .32, .22]
};

function solveArm(shoulder, target, L1, L2, pole, outElbow) {
  _axis.copy(target).sub(shoulder);
  let d = _axis.length();
  d = Math.min(Math.max(d, Math.abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4);
  _axis.normalize();
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  _base.copy(shoulder).addScaledVector(_axis, a);
  _perp.copy(pole).addScaledVector(_axis, -pole.dot(_axis));
  if (_perp.lengthSq() < 1e-6) _perp.set(0, 0, 1);
  _perp.normalize();
  outElbow.copy(_base).addScaledVector(_perp, h);
}

export function applyFluteIK(avatar, blend, targets, handDirs, poles, handRolls, flutePos = null) {
  if (blend <= 0.001) return;
  const { bones, template, visual, mesh } = avatar;
  if (!bones || !template || !mesh) return;

  visual.getWorldQuaternion(_qVisual);
  mesh.getWorldScale(_scale);
  const s = _scale.x || 1;

  for (const side of ['Left', 'Right']) {
    const shoulder = bones.get('mixamorig' + side + 'Shoulder');
    const arm = bones.get('mixamorig' + side + 'Arm');
    const fore = bones.get('mixamorig' + side + 'ForeArm');
    const hand = bones.get('mixamorig' + side + 'Hand');
    if (!arm || !fore || !hand) continue;

    /* Clavícula a su pose de reposo: evita que el idle abra un hombro más
       que el otro y mantiene la flauta estable respecto de la boca. */
    if (shoulder) {
      const restQ = template.restLocalQuats['mixamorig' + side + 'Shoulder'];
      if (restQ) {
        _qLocal.fromArray(restQ);
        shoulder.quaternion.slerp(_qLocal, blend);
        shoulder.updateWorldMatrix(false, false);
      }
    }

    const L1 = fore.position.length() * s;
    const L2 = hand.position.length() * s;

    arm.getWorldPosition(_shoulder);
    _target.set(targets[side][0], targets[side][1], targets[side][2]);
    _targetLocal.copy(_target);
    visual.localToWorld(_target);

    const p = poles && poles[side] ? poles[side] : [side === 'Left' ? 1 : -1, -0.4, -0.2];
    const pole = new V3(p[0], p[1], p[2]).applyQuaternion(_qVisual);
    solveArm(_shoulder, _target, L1, L2, pole, _elbow);

    /* Brazo superior: rotar la dirección de reposo hacia hombro→codo. */
    _rest.fromArray(template.restDirs['mixamorig' + side + 'Arm']).applyQuaternion(_qVisual);
    _dir.copy(_elbow).sub(_shoulder).normalize();
    _qDelta.setFromUnitVectors(_rest, _dir);
    _qRest.fromArray(template.restWorldQuats['mixamorig' + side + 'Arm']).premultiply(_qVisual);
    _qDesired.copy(_qDelta).multiply(_qRest);
    arm.parent.getWorldQuaternion(_qParent);
    _qLocal.copy(_qParent).invert().multiply(_qDesired);
    arm.quaternion.slerp(_qLocal, blend);
    arm.updateWorldMatrix(false, false);

    /* Antebrazo: rotar codo→muñeca. */
    _rest.fromArray(template.restDirs['mixamorig' + side + 'ForeArm']).applyQuaternion(_qVisual);
    _dir.copy(_target).sub(_elbow).normalize();
    _qDelta.setFromUnitVectors(_rest, _dir);
    _qRest.fromArray(template.restWorldQuats['mixamorig' + side + 'ForeArm']).premultiply(_qVisual);
    _qDesired.copy(_qDelta).multiply(_qRest);
    _qParent.copy(arm.quaternion).premultiply(arm.parent.getWorldQuaternion(new Q()));
    _qLocal.copy(_qParent).invert().multiply(_qDesired);
    fore.quaternion.slerp(_qLocal, blend);
    fore.updateWorldMatrix(false, false);

    /* Muñeca: orientación determinista en vez de heredar el roll del idle.
       El eje local +Y de la mano apunta hacia los dedos y el +Z es la
       palma. La palma se calcula como la perpendicular desde la muñeca al
       eje del tubo (el tubo corre en X, así que solo importa el plano YZ):
       de este modo el tubo queda apoyado del lado de la palma y los dedos
       no lo atraviesan. Antes el roll venía del mixer y a veces la palma
       miraba hacia abajo, con el tubo cruzando los nudillos. */
    if (handDirs && handDirs[side]) {
      _dir.fromArray(handDirs[side]).normalize();
      let palmOk = false;
      if (flutePos) {
        _palm.copy(flutePos).sub(_targetLocal);
        _palm.x = 0;
        _palm.addScaledVector(_dir, -_palm.dot(_dir));
        palmOk = _palm.lengthSq() > 1e-6;
        if (palmOk) _palm.normalize();
      }
      if (!palmOk) {
        /* Sin flauta: palma hacia arriba; si los dedos ya apuntan arriba,
           se usa el frente como respaldo. */
        _palm.set(0, 1, 0).addScaledVector(_dir, -_dir.y);
        if (_palm.lengthSq() < 1e-6) _palm.set(0, 0, 1).addScaledVector(_dir, -_dir.z);
        _palm.normalize();
      }
      _dir.applyQuaternion(_qVisual).normalize();
      _palm.applyQuaternion(_qVisual).normalize();
      _xW.crossVectors(_dir, _palm).normalize();
      _zW.crossVectors(_xW, _dir).normalize();
      _basis.makeBasis(_xW, _dir, _zW);
      const qHand = new Q().setFromRotationMatrix(_basis);
      if (handRolls && handRolls[side]) qHand.multiply(new Q().setFromAxisAngle(new V3(0, 1, 0), handRolls[side]));
      const foreWorld = fore.getWorldQuaternion(new Q());
      _qLocal.copy(foreWorld).invert().multiply(qHand);
      hand.quaternion.slerp(_qLocal, blend);
      hand.updateWorldMatrix(false, false);
    }

    /* Dedos: el rig original sí trae falanges. Se añade un curl local
       proporcional al fundido; los rigs sin dedos (body/cyborg) conservan
       la mano rígida y el tubo se apoya igualmente del lado de la palma. */
    if (handDirs && handDirs[side] && blend > .02) {
      for (const finger of FLUTE_FINGERS) {
        const angles = FLUTE_FINGER_CURL[finger];
        for (let i = 0; i < angles.length; i++) {
          const fb = bones.get('mixamorig' + side + 'Hand' + finger + (i + 1));
          if (!fb) continue;
          _qCurl.setFromAxisAngle(_fingerAxis, angles[i] * blend);
          fb.quaternion.multiply(_qCurl);
          fb.updateWorldMatrix(false, false);
        }
      }
    }
  }
}
