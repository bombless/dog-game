import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.querySelector("#scene");
const speedEl = document.querySelector("#speed");
const lapEl = document.querySelector("#lap");
const modeEl = document.querySelector("#mode");
const musicEl = document.querySelector("#music");
const dogModelEl = document.querySelector("#dog-model");

canvas.style.touchAction = "none";

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#87cdf8");
scene.fog = new THREE.Fog("#91c77f", 35, 190);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(-10, 7, 6);

const hemiLight = new THREE.HemisphereLight("#ddf7ff", "#8c6f4f", 1.1);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight("#fff4d4", 1.45);
sun.position.set(22, 32, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 160;
sun.shadow.camera.left = -55;
sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55;
sun.shadow.camera.bottom = -55;
const sunTarget = new THREE.Object3D();
sunTarget.position.set(0, 0, 0);
scene.add(sunTarget);
sun.target = sunTarget;
scene.add(sun);

const fbxLoader = new FBXLoader();
const gltfLoader = new GLTFLoader();
const clock = new THREE.Clock();
const keys = new Set();

const state = {
  lap: 0,
  distance: -25,
  lateral: 0,
  speed: 8,
  currentSpeed: 8,
  minSpeed: 8,
  sprintSpeed: 13,
  approachSpeed: 9,
  runHeadingYaw: 0,
  runDistance: 0,
  edgeBlocked: false,
  orbitAngle: 0,
  orbitProgress: 0,
  orbitDirection: 1,
  orbitCameraLocked: false,
  runnerLoaded: false,
  isPaused: false,
  dragYaw: 0,
  behavior: "run",
  targetPoint: new THREE.Vector3(),
};

const cameraLookTarget = new THREE.Vector3();
const runner = new THREE.Group();
scene.add(runner);

let dogMesh = null;
let dogMixer = null;
let dogFacingOffset = 0;
let dogModelEntries = [];
let activeDogModelIndex = -1;
const ambientMixers = [];

const track = {
  start: -25,
  end: 320,
  widthLimit: 5.2,
};

const TERRAIN_Y_OFFSET = -3.7;
const SUN_OFFSET = new THREE.Vector3(22, 32, 8);
const MAX_DRAG_YAW = Math.PI * 0.42;
const DRAG_YAW_SENSITIVITY = 0.008;
const TARGET_ORBIT_RADIUS = 1.45;
const TARGET_ORBIT_TOLERANCE = 0.08;
const TARGET_ORBIT_ANGULAR_SPEED = 2.4;
const FULL_CIRCLE_RAD = Math.PI * 2;
const TARGET_ORBIT_TURNS = 2;
const TARGET_ORBIT_TOTAL_RAD = FULL_CIRCLE_RAD * TARGET_ORBIT_TURNS;
const AMBIENT_ANIMAL_SPECS = [
  {
    name: "Cow",
    paths: ["./assets/pack_nature/FBX/Cow.fbx", "./Cow.fbx"],
    desiredHeight: 1.8,
    minCount: 1,
    maxCount: 2,
  },
  {
    name: "Bull",
    paths: ["./assets/pack_nature/FBX/Bull.fbx"],
    desiredHeight: 1.95,
    minCount: 1,
    maxCount: 2,
  },
  {
    name: "Deer",
    paths: ["./assets/pack_nature/FBX/Deer.fbx"],
    desiredHeight: 1.75,
    minCount: 1,
    maxCount: 2,
  },
  {
    name: "Stag",
    paths: ["./assets/pack_nature/FBX/Stag.fbx"],
    desiredHeight: 1.95,
    minCount: 1,
    maxCount: 2,
  },
  {
    name: "Alpaca",
    paths: ["./assets/pack_nature/FBX/Alpaca.fbx"],
    desiredHeight: 1.5,
    minCount: 1,
    maxCount: 2,
  },
  {
    name: "Donkey",
    paths: ["./assets/pack_nature/FBX/Donkey.fbx"],
    desiredHeight: 1.7,
    minCount: 1,
    maxCount: 2,
  },
  {
    name: "Horse",
    paths: ["./assets/pack_nature/FBX/Horse.fbx"],
    desiredHeight: 2.05,
    minCount: 1,
    maxCount: 2,
  },
  {
    name: "Horse_White",
    paths: ["./assets/pack_nature/FBX/Horse_White.fbx"],
    desiredHeight: 2.05,
    minCount: 1,
    maxCount: 2,
  },
  {
    name: "Fox",
    paths: ["./assets/pack_nature/FBX/Fox.fbx"],
    desiredHeight: 1.2,
    minCount: 1,
    maxCount: 2,
  },
  {
    name: "Wolf",
    paths: ["./assets/pack_nature/FBX/Wolf.fbx"],
    desiredHeight: 1.35,
    minCount: 1,
    maxCount: 2,
  },
  {
    name: "Husky",
    paths: ["./assets/pack_nature/FBX/Husky.fbx"],
    desiredHeight: 1.3,
    minCount: 1,
    maxCount: 2,
  },
  {
    name: "ShibaInu",
    paths: ["./assets/pack_nature/FBX/ShibaInu.fbx"],
    desiredHeight: 1.25,
    minCount: 1,
    maxCount: 2,
  },
];
const GROUND = {
  width: 420,
  depth: 170,
  centerX: 140,
  centerZ: 0,
  edgePadding: 2.2,
};
const GROUND_MIN_X = GROUND.centerX - GROUND.width * 0.5 + GROUND.edgePadding;
const GROUND_MAX_X = GROUND.centerX + GROUND.width * 0.5 - GROUND.edgePadding;
const GROUND_MIN_Z = GROUND.centerZ - GROUND.depth * 0.5 + GROUND.edgePadding;
const GROUND_MAX_Z = GROUND.centerZ + GROUND.depth * 0.5 - GROUND.edgePadding;

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const lastForward = new THREE.Vector3(1, 0, 0);
const upAxis = new THREE.Vector3(0, 1, 0);
const orbitCameraPosition = new THREE.Vector3();
const orbitCameraLookTarget = new THREE.Vector3();
let groundMesh = null;
let targetMarker = null;

const pointerState = {
  active: false,
  id: -1,
  lastX: 0,
  totalDx: 0,
  moved: false,
};

const MUSIC_TRACKS = [
  {
    title: "Searchlight Rag",
    src: "./assets/music/Searchlight_Rag.ogg",
  },
  {
    title: "Maple Leaf Rag",
    src: "./assets/music/Maple_Leaf_Rag.ogg",
  },
  {
    title: "Gymnopedie No. 1",
    src: "./assets/music/Gymnopedie_No_1.ogg",
  },
];

const bgm = new Audio();
bgm.preload = "auto";
bgm.loop = true;
bgm.volume = 0.42;

const musicState = {
  index: 0,
  unlocked: false,
  enabled: true,
};

function togglePause() {
  const willResume = state.isPaused;
  state.isPaused = !state.isPaused;
  if (willResume && state.behavior === "run") {
    const previewForward = new THREE.Vector3(
      Math.cos(state.runHeadingYaw),
      0,
      Math.sin(state.runHeadingYaw)
    ).applyAxisAngle(upAxis, state.dragYaw);
    state.runHeadingYaw = Math.atan2(previewForward.z, previewForward.x);
    state.dragYaw = 0;
  }
}

function setMusicTrack(index) {
  musicState.index = (index + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
  bgm.src = MUSIC_TRACKS[musicState.index].src;
  bgm.load();
}

function tryStartMusicFromUserGesture() {
  if (!musicState.enabled) {
    return;
  }
  if (!musicState.unlocked) {
    setMusicTrack(musicState.index);
  }
  bgm
    .play()
    .then(() => {
      musicState.unlocked = true;
    })
    .catch(() => {
      // Ignore blocked autoplay errors; next user interaction can retry.
    });
}

function toggleMusic() {
  musicState.enabled = !musicState.enabled;
  if (!musicState.enabled) {
    bgm.pause();
    return;
  }
  tryStartMusicFromUserGesture();
}

function playNextTrack() {
  setMusicTrack(musicState.index + 1);
  if (musicState.enabled) {
    tryStartMusicFromUserGesture();
  }
}

function ensureTargetMarker() {
  if (targetMarker) {
    return targetMarker;
  }
  targetMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 20, 20),
    new THREE.MeshStandardMaterial({
      color: "#e33b3b",
      emissive: "#7a1010",
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.05,
    })
  );
  targetMarker.castShadow = true;
  targetMarker.visible = false;
  scene.add(targetMarker);
  return targetMarker;
}

function setMoveTarget(worldPoint) {
  const marker = ensureTargetMarker();
  state.targetPoint.set(
    worldPoint.x,
    worldGroundHeight(worldPoint.x, worldPoint.z),
    worldPoint.z
  );
  marker.position.copy(state.targetPoint);
  marker.position.y += 0.3;
  marker.visible = true;

  state.behavior = "approach";
  state.orbitCameraLocked = false;
  state.orbitProgress = 0;
  const relX = runner.position.x - state.targetPoint.x;
  const relZ = runner.position.z - state.targetPoint.z;
  state.orbitAngle = Math.atan2(relZ, relX);
  const toTarget = new THREE.Vector3(-relX, 0, -relZ);
  const toTargetLen = toTarget.length();
  if (toTargetLen > 0.0001) {
    toTarget.multiplyScalar(1 / toTargetLen);
    const crossY = new THREE.Vector3(lastForward.x, 0, lastForward.z).cross(toTarget).y;
    state.orbitDirection = crossY >= 0 ? 1 : -1;
  } else {
    state.orbitDirection = 1;
  }
  state.isPaused = false;
  state.dragYaw = 0;
}

function setMoveTargetFromPointer(event) {
  if (!groundMesh || !state.runnerLoaded) {
    return false;
  }
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObject(groundMesh, false);
  if (hits.length === 0) {
    return false;
  }
  setMoveTarget(hits[0].point);
  return true;
}

function onPointerDown(event) {
  tryStartMusicFromUserGesture();
  if (pointerState.active) {
    return;
  }
  pointerState.active = true;
  pointerState.id = event.pointerId;
  pointerState.lastX = event.clientX;
  pointerState.totalDx = 0;
  pointerState.moved = false;
  canvas.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (!pointerState.active || event.pointerId !== pointerState.id) {
    return;
  }

  const dx = event.clientX - pointerState.lastX;
  pointerState.lastX = event.clientX;
  pointerState.totalDx += dx;

  if (Math.abs(pointerState.totalDx) > 4) {
    pointerState.moved = true;
  }

  if (state.isPaused) {
    state.dragYaw = THREE.MathUtils.clamp(
      state.dragYaw - dx * DRAG_YAW_SENSITIVITY,
      -MAX_DRAG_YAW,
      MAX_DRAG_YAW
    );
  }
}

function onPointerUp(event) {
  if (!pointerState.active || event.pointerId !== pointerState.id) {
    return;
  }

  if (!pointerState.moved) {
    setMoveTargetFromPointer(event);
  }

  pointerState.active = false;
  pointerState.id = -1;
  pointerState.totalDx = 0;
  pointerState.moved = false;
  canvas.releasePointerCapture(event.pointerId);
}

canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyK") {
    if (!event.repeat) {
      cycleDogModel();
    }
    event.preventDefault();
    return;
  }
  if (event.code === "KeyM") {
    if (!event.repeat) {
      toggleMusic();
    }
    event.preventDefault();
    return;
  }
  if (event.code === "KeyN") {
    if (!event.repeat) {
      playNextTrack();
    }
    event.preventDefault();
    return;
  }
  if (event.code === "Space") {
    if (!event.repeat) {
      togglePause();
    }
    tryStartMusicFromUserGesture();
    event.preventDefault();
    return;
  }
  tryStartMusicFromUserGesture();
  keys.add(event.code);
  if (["ArrowLeft", "ArrowRight", "Space", "KeyK"].includes(event.code)) {
    event.preventDefault();
  }
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

function terrainHeight(x, z) {
  return (
    Math.sin(x * 0.06) * 2.7 +
    Math.sin((x + z) * 0.09) * 1.35 +
    Math.cos(z * 0.08) * 1.2
  );
}

function worldGroundHeight(x, z) {
  return terrainHeight(x, z) + TERRAIN_Y_OFFSET;
}

function trackCenterZ(distance) {
  return Math.sin(distance * 0.08) * 6 + Math.sin(distance * 0.021) * 11;
}

function isInsideGroundBounds(x, z) {
  return x >= GROUND_MIN_X && x <= GROUND_MAX_X && z >= GROUND_MIN_Z && z <= GROUND_MAX_Z;
}

function sampleTrack(distance, lateral = 0) {
  const x = distance;
  const baseZ = trackCenterZ(distance);
  const z = baseZ + lateral;
  const y = worldGroundHeight(x, z);
  return new THREE.Vector3(x, y, z);
}

function configureRenderable(object3d) {
  object3d.traverse((child) => {
    if (!child.isMesh) {
      return;
    }
    child.castShadow = true;
    child.receiveShadow = true;

    if (!child.material) {
      return;
    }

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) {
      const hasBaseMap = Boolean(material.map);
      if (hasBaseMap) {
        material.flatShading = false;
        material.map.colorSpace = THREE.SRGBColorSpace;
      } else {
        material.flatShading = true;
      }
      material.needsUpdate = true;
    }
  });
}

function scaleObjectToHeight(object3d, desiredHeight) {
  const box = new THREE.Box3().setFromObject(object3d);
  const size = box.getSize(new THREE.Vector3());
  if (size.y <= 0.0001) {
    return;
  }
  const uniformScale = desiredHeight / size.y;
  object3d.scale.multiplyScalar(uniformScale);
}

async function loadFBX(paths) {
  for (const path of paths) {
    try {
      const object = await fbxLoader.loadAsync(path);
      return object;
    } catch (error) {
      console.warn(`Load failed: ${path}`, error);
    }
  }
  return null;
}

async function loadGLTF(paths) {
  for (const path of paths) {
    try {
      const asset = await gltfLoader.loadAsync(path);
      return asset.scene ?? asset.scenes?.[0] ?? null;
    } catch (error) {
      console.warn(`Load failed: ${path}`, error);
    }
  }
  return null;
}

function addHillyGround() {
  const width = GROUND.width;
  const depth = GROUND.depth;
  const segW = 220;
  const segD = 110;

  const geometry = new THREE.PlaneGeometry(width, depth, segW, segD);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(GROUND.centerX, 0, GROUND.centerZ);

  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, worldGroundHeight(x, z));
  }

  geometry.computeVertexNormals();

  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: "#74b95f",
      roughness: 0.95,
      metalness: 0.02,
      flatShading: true,
    })
  );
  ground.receiveShadow = true;
  groundMesh = ground;
  scene.add(ground);
}

function addFallbackDog() {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.7, 0.35),
    new THREE.MeshStandardMaterial({ color: "#e9dcc6", roughness: 0.8 })
  );
  body.castShadow = true;
  body.position.y = 0.7;
  dogMesh = body;
  runner.add(dogMesh);
  state.runnerLoaded = true;
}

function getActiveDogModelLabel() {
  if (activeDogModelIndex < 0 || activeDogModelIndex >= dogModelEntries.length) {
    return "方块狗";
  }
  return dogModelEntries[activeDogModelIndex].label;
}

function setActiveDogModel(index) {
  if (dogModelEntries.length === 0) {
    return;
  }
  const wrappedIndex = THREE.MathUtils.euclideanModulo(index, dogModelEntries.length);
  const nextEntry = dogModelEntries[wrappedIndex];
  if (!nextEntry) {
    return;
  }

  if (dogMesh && dogMesh.parent === runner) {
    runner.remove(dogMesh);
  }

  activeDogModelIndex = wrappedIndex;
  dogMesh = nextEntry.mesh;
  dogMixer = null;
  dogFacingOffset = nextEntry.facingOffset;

  dogMesh.visible = true;
  runner.add(dogMesh);
  startDogAnimationForEntry(nextEntry);
}

function cycleDogModel() {
  if (dogModelEntries.length <= 1) {
    return;
  }
  setActiveDogModel(activeDogModelIndex + 1);
}

function pickRunnerClip(clips, mode = "default") {
  if (!clips || clips.length === 0) {
    return null;
  }
  if (mode === "shiba") {
    const shibaGallop = clips.find((clip) =>
      /(^|[|_:/\s])gallop($|[|_:/\s])/i.test(clip.name)
    );
    if (shibaGallop) {
      return shibaGallop;
    }
    const shibaWalk = clips.find((clip) =>
      /(^|[|_:/\s])walk($|[|_:/\s])/i.test(clip.name)
    );
    if (shibaWalk) {
      return shibaWalk;
    }
    return clips[0];
  }
  if (mode === "dog-force-run") {
    const dogRun = clips.find((clip) => /(^|[|_:/\s])run($|[|_:/\s])/i.test(clip.name));
    if (dogRun) {
      return dogRun;
    }
    const dogWalk = clips.find((clip) => /(^|[|_:/\s])walk($|[|_:/\s])/i.test(clip.name));
    if (dogWalk) {
      return dogWalk;
    }
    return clips[0];
  }

  const exactRun = clips.find((clip) => /(^|[|_:/\s])run($|[|_:/\s])/i.test(clip.name));
  if (exactRun) {
    return exactRun;
  }
  const exactWalk = clips.find((clip) => /(^|[|_:/\s])walk($|[|_:/\s])/i.test(clip.name));
  if (exactWalk) {
    return exactWalk;
  }
  return (
    clips.find((clip) => /run|walk|trot|gallop|jog|sprint/i.test(clip.name)) || clips[0]
  );
}

function buildDogModelEntry(
  rawDog,
  { label, desiredHeight, facingOffset = 0, clipMode = "default" }
) {
  if (!rawDog) {
    return null;
  }

  configureRenderable(rawDog);
  scaleObjectToHeight(rawDog, desiredHeight);
  const dogBox = new THREE.Box3().setFromObject(rawDog);
  rawDog.position.y += -dogBox.min.y + 0.02;
  rawDog.rotation.y = 0;
  rawDog.visible = false;

  return {
    label,
    mesh: rawDog,
    clipMode,
    facingOffset,
  };
}

function startDogAnimationForEntry(entry) {
  if (!entry || !entry.mesh) {
    return;
  }

  const clips = entry.mesh.animations ?? [];
  if (clips.length === 0) {
    dogMixer = null;
    return;
  }

  const runClip = pickRunnerClip(clips, entry.clipMode);
  if (!runClip) {
    dogMixer = null;
    return;
  }

  dogMixer = new THREE.AnimationMixer(entry.mesh);
  const runAction = dogMixer.clipAction(runClip);
  runAction.enabled = true;
  runAction.clampWhenFinished = false;
  runAction.setLoop(THREE.LoopRepeat, Infinity);
  runAction.setEffectiveWeight(1);
  runAction.setEffectiveTimeScale(1);
  runAction.reset();
  runAction.play();
}

function updateHUD() {
  speedEl.textContent = `速度: ${state.currentSpeed.toFixed(1)}`;
  lapEl.textContent = `圈数: ${state.lap}`;
  const track = MUSIC_TRACKS[musicState.index];
  const musicStatus = !musicState.enabled
    ? "已关闭"
    : bgm.paused
      ? "待播放"
      : "播放中";
  musicEl.textContent = `音乐: ${musicStatus} - ${track.title}`;
  if (dogModelEl) {
    dogModelEl.textContent = `狗模型: ${getActiveDogModelLabel()}（K 可切换）`;
  }
  if (state.isPaused) {
    modeEl.textContent = `状态: 暂停（拖拽角度 ${(THREE.MathUtils.radToDeg(state.dragYaw)).toFixed(0)}°）`;
    return;
  }
  if (state.behavior === "approach") {
    modeEl.textContent = "状态: 正在靠近红球";
    return;
  }
  if (state.behavior === "orbit") {
    const progress = Math.min(100, (state.orbitProgress / TARGET_ORBIT_TOTAL_RAD) * 100);
    modeEl.textContent = `状态: 绕圈中 ${progress.toFixed(0)}%`;
    return;
  }
  if (state.edgeBlocked) {
    modeEl.textContent = "状态: 到达草地边缘（转向后可继续）";
    return;
  }
  modeEl.textContent = "状态: 奔跑";
}

function addSkyDecor() {
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: "#f5fbff",
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
  });

  for (let i = 0; i < 14; i += 1) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(1 + Math.random() * 1.4, 9, 9),
      cloudMaterial
    );
    puff.position.set(
      -40 + Math.random() * 380,
      16 + Math.random() * 20,
      -55 + Math.random() * 110
    );
    puff.scale.set(1.6, 0.8, 1.2);
    scene.add(puff);
  }
}

async function addMountains() {
  const mountain = await loadFBX([
    "./assets/Mountain/Mountain_Single.fbx",
    "./assets/pack_animals/FBX/Rock_5.fbx",
  ]);

  if (!mountain) {
    return;
  }

  configureRenderable(mountain);
  scaleObjectToHeight(mountain, 16);

  const placements = [
    { x: 5, z: -34, rot: 0.12, scale: 1.2 },
    { x: 88, z: 38, rot: -0.48, scale: 0.95 },
    { x: 196, z: -36, rot: 0.3, scale: 1.3 },
    { x: 286, z: 42, rot: -0.24, scale: 1.05 },
  ];

  for (const place of placements) {
    const clone = mountain.clone(true);
    clone.position.set(place.x, worldGroundHeight(place.x, place.z) + 1.7, place.z);
    clone.scale.multiplyScalar(place.scale);
    clone.rotation.y = place.rot;
    scene.add(clone);
  }
}

async function addScenery() {
  const treeGltfPaths = [
    "./assets/pack_animals_gltf/glTF/BirchTree_1.gltf",
    "./assets/pack_animals_gltf/glTF/BirchTree_2.gltf",
    "./assets/pack_animals_gltf/glTF/BirchTree_3.gltf",
    "./assets/pack_animals_gltf/glTF/BirchTree_4.gltf",
    "./assets/pack_animals_gltf/glTF/BirchTree_5.gltf",
    "./assets/pack_animals_gltf/glTF/MapleTree_1.gltf",
    "./assets/pack_animals_gltf/glTF/MapleTree_2.gltf",
    "./assets/pack_animals_gltf/glTF/MapleTree_3.gltf",
    "./assets/pack_animals_gltf/glTF/MapleTree_4.gltf",
    "./assets/pack_animals_gltf/glTF/MapleTree_5.gltf",
    "./assets/pack_animals_gltf/glTF/DeadTree_3.gltf",
    "./assets/pack_animals_gltf/glTF/DeadTree_7.gltf",
  ];
  const bushGltfPaths = [
    "./assets/pack_animals_gltf/glTF/Bush.gltf",
    "./assets/pack_animals_gltf/glTF/Bush_Large.gltf",
    "./assets/pack_animals_gltf/glTF/Bush_Flowers.gltf",
    "./assets/pack_animals_gltf/glTF/Bush_Small.gltf",
    "./assets/pack_animals_gltf/glTF/Bush_Large_Flowers.gltf",
    "./assets/pack_animals_gltf/glTF/Bush_Small_Flowers.gltf",
  ];
  const rockFbxPaths = [
    "./assets/pack_animals/FBX/Rock_1.fbx",
    "./assets/pack_animals/FBX/Rock_2.fbx",
    "./assets/pack_animals/FBX/Rock_3.fbx",
    "./assets/pack_animals/FBX/Rock_4.fbx",
    "./assets/pack_animals/FBX/Rock_5.fbx",
  ];

  const [treeTemplatesRaw, bushTemplatesRaw, rockTemplatesRaw] = await Promise.all([
    Promise.all(treeGltfPaths.map((path) => loadGLTF([path]))),
    Promise.all(bushGltfPaths.map((path) => loadGLTF([path]))),
    Promise.all(rockFbxPaths.map((path) => loadFBX([path]))),
  ]);

  const treeTemplates = treeTemplatesRaw.filter(Boolean);
  const bushTemplates = bushTemplatesRaw.filter(Boolean);
  const rockTemplates = rockTemplatesRaw.filter(Boolean);

  // Safety fallback in case glTF files are not present.
  if (treeTemplates.length === 0) {
    const fallbackTree = await loadFBX(["./assets/pack_animals/FBX/PineTree_2.fbx"]);
    if (fallbackTree) {
      treeTemplates.push(fallbackTree);
    }
  }
  if (bushTemplates.length === 0) {
    const fallbackBush = await loadFBX(["./assets/pack_animals/FBX/Bush_Large.fbx"]);
    if (fallbackBush) {
      bushTemplates.push(fallbackBush);
    }
  }
  if (rockTemplates.length === 0) {
    const fallbackRock = await loadFBX(["./assets/pack_animals/FBX/Rock_2.fbx"]);
    if (fallbackRock) {
      rockTemplates.push(fallbackRock);
    }
  }

  if (treeTemplates.length === 0 || bushTemplates.length === 0 || rockTemplates.length === 0) {
    return;
  }

  for (const tree of treeTemplates) {
    configureRenderable(tree);
    scaleObjectToHeight(tree, 5.8);
  }
  for (const bush of bushTemplates) {
    configureRenderable(bush);
    scaleObjectToHeight(bush, 1.6);
  }
  for (const rock of rockTemplates) {
    configureRenderable(rock);
    scaleObjectToHeight(rock, 1.6);
  }

  const chooseRandom = (items) => items[Math.floor(Math.random() * items.length)];

  for (let i = 0; i < 120; i += 1) {
    const roll = Math.random();
    const isTree = roll > 0.34;
    const isBush = !isTree && roll > 0.12;
    const template = isTree
      ? chooseRandom(treeTemplates)
      : isBush
        ? chooseRandom(bushTemplates)
        : chooseRandom(rockTemplates);

    const clone = template.clone(true);
    const x = -5 + Math.random() * 340;
    const z = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 52);
    const y = worldGroundHeight(x, z) - (isTree ? 0.35 : 0.06);

    clone.position.set(x, y, z);
    clone.rotation.y = Math.random() * Math.PI * 2;
    const localScale = isTree
      ? 0.5 + Math.random() * 0.9
      : isBush
        ? 0.55 + Math.random() * 0.75
        : 0.55 + Math.random() * 0.7;
    clone.scale.multiplyScalar(localScale);
    scene.add(clone);
  }
}

function randomIntInclusive(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickAmbientAnimalClip(clips) {
  if (!clips || clips.length === 0) {
    return null;
  }
  const eating = clips.find((clip) => /(^|[|_:/\s])eating($|[|_:/\s])/i.test(clip.name));
  if (eating) {
    return eating;
  }
  const headLow = clips.find((clip) => /headlow|head_low|head low/i.test(clip.name));
  if (headLow) {
    return headLow;
  }
  const idle = clips.find((clip) => /(^|[|_:/\s])idle($|[|_:/\s])/i.test(clip.name));
  if (idle) {
    return idle;
  }
  const walk = clips.find((clip) => /(^|[|_:/\s])walk($|[|_:/\s])/i.test(clip.name));
  if (walk) {
    return walk;
  }
  return clips[0];
}

async function addAmbientAnimals() {
  const spawnJobs = [];
  for (const spec of AMBIENT_ANIMAL_SPECS) {
    const count = randomIntInclusive(spec.minCount, spec.maxCount);
    for (let i = 0; i < count; i += 1) {
      spawnJobs.push({ spec, promise: loadFBX(spec.paths) });
    }
  }

  const loadedAnimals = await Promise.all(spawnJobs.map((job) => job.promise));
  if (loadedAnimals.every((animal) => !animal)) {
    return;
  }

  for (let i = 0; i < loadedAnimals.length; i += 1) {
    const animal = loadedAnimals[i];
    const spec = spawnJobs[i].spec;
    if (!animal) {
      continue;
    }

    configureRenderable(animal);
    scaleObjectToHeight(animal, spec.desiredHeight);
    const animalBox = new THREE.Box3().setFromObject(animal);
    const footOffsetY = -animalBox.min.y;
    const animalClips = animal.animations ?? [];
    const ambientClip = pickAmbientAnimalClip(animalClips);

    const side = Math.random() > 0.5 ? 1 : -1;
    const x = GROUND_MIN_X + 18 + Math.random() * (GROUND_MAX_X - GROUND_MIN_X - 36);
    const z = side * (17 + Math.random() * 35);
    animal.position.set(x, worldGroundHeight(x, z) + footOffsetY, z);
    animal.rotation.y = Math.random() * Math.PI * 2;

    const scaleJitter = 0.88 + Math.random() * 0.25;
    animal.scale.multiplyScalar(scaleJitter);
    scene.add(animal);

    if (ambientClip) {
      const mixer = new THREE.AnimationMixer(animal);
      const action = mixer.clipAction(ambientClip);
      action.enabled = true;
      action.clampWhenFinished = false;
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(0.8 + Math.random() * 0.3);
      action.play();
      mixer.setTime(Math.random() * Math.max(0.01, ambientClip.duration));
      ambientMixers.push(mixer);
    }
  }
}

async function setupRunner() {
  const [shibaDog, classicDog] = await Promise.all([
    loadFBX(["./assets/pack_nature/FBX/ShibaInu.fbx"]),
    loadFBX(["./assets/Dog/Dog.fbx"]),
  ]);

  dogModelEntries = [
    buildDogModelEntry(shibaDog, {
      label: "ShibaInu",
      desiredHeight: 1.35,
      facingOffset: 0,
      clipMode: "shiba",
    }),
    buildDogModelEntry(classicDog, {
      label: "Dog",
      desiredHeight: 1.35,
      facingOffset: 0,
      clipMode: "dog-force-run",
    }),
  ].filter(Boolean);

  if (dogModelEntries.length === 0) {
    addFallbackDog();
    return;
  }

  setActiveDogModel(0);

  state.runnerLoaded = true;
}

function updateRunner(delta) {
  let p = runner.position.clone();
  let ahead = p.clone().add(lastForward);

  if (state.behavior === "run") {
    const steering = (keys.has("ArrowLeft") || keys.has("KeyA") ? -1 : 0) +
      (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0);
    const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const baseSpeed = sprinting ? state.sprintSpeed : state.minSpeed;

    if (!state.isPaused) {
      if (Math.abs(state.dragYaw) > 1e-4) {
        const previewForward = new THREE.Vector3(
          Math.cos(state.runHeadingYaw),
          0,
          Math.sin(state.runHeadingYaw)
        ).applyAxisAngle(upAxis, state.dragYaw);
        state.runHeadingYaw = Math.atan2(previewForward.z, previewForward.x);
        state.dragYaw = 0;
      }
      state.speed = baseSpeed;
      state.runHeadingYaw += steering * delta * 1.9;
      const runForward = new THREE.Vector3(
        Math.cos(state.runHeadingYaw),
        0,
        Math.sin(state.runHeadingYaw)
      );
      const nextX = p.x + runForward.x * state.speed * delta;
      const nextZ = p.z + runForward.z * state.speed * delta;
      if (isInsideGroundBounds(nextX, nextZ)) {
        p.x = nextX;
        p.z = nextZ;
        p.y = worldGroundHeight(p.x, p.z);
        state.runDistance += state.speed * delta;
        state.lap = Math.floor(state.runDistance / (track.end - track.start));
        state.edgeBlocked = false;
      } else {
        p.y = worldGroundHeight(p.x, p.z);
        state.edgeBlocked = true;
      }
    } else {
      p.y = worldGroundHeight(p.x, p.z);
      state.edgeBlocked = false;
    }

    const runForward = new THREE.Vector3(
      Math.cos(state.runHeadingYaw),
      0,
      Math.sin(state.runHeadingYaw)
    );
    ahead = p.clone().add(runForward.multiplyScalar(0.7));
    state.currentSpeed = state.isPaused || state.edgeBlocked ? 0 : state.speed;
  } else {
    state.edgeBlocked = false;
    p.y = worldGroundHeight(p.x, p.z);
    const toTarget = new THREE.Vector3(
      state.targetPoint.x - p.x,
      0,
      state.targetPoint.z - p.z
    );
    const distanceToTarget = toTarget.length();
    const targetDirection =
      distanceToTarget > 0.0001
        ? toTarget.clone().multiplyScalar(1 / distanceToTarget)
        : lastForward.clone();

    if (state.behavior === "approach") {
      if (!state.isPaused) {
        const step = state.approachSpeed * delta;
        const distanceToOrbit = Math.max(0, distanceToTarget - TARGET_ORBIT_RADIUS);
        if (distanceToOrbit <= TARGET_ORBIT_TOLERANCE || step >= distanceToOrbit) {
          const relX = p.x - state.targetPoint.x;
          const relZ = p.z - state.targetPoint.z;
          const relLen = Math.hypot(relX, relZ);
          if (relLen > 0.0001) {
            p.x = state.targetPoint.x + (relX / relLen) * TARGET_ORBIT_RADIUS;
            p.z = state.targetPoint.z + (relZ / relLen) * TARGET_ORBIT_RADIUS;
            state.orbitAngle = Math.atan2(relZ / relLen, relX / relLen);
          } else {
            const fallback = lastForward
              .clone()
              .applyAxisAngle(upAxis, -state.orbitDirection * Math.PI * 0.5);
            p.x = state.targetPoint.x + fallback.x * TARGET_ORBIT_RADIUS;
            p.z = state.targetPoint.z + fallback.z * TARGET_ORBIT_RADIUS;
            state.orbitAngle = Math.atan2(fallback.z, fallback.x);
          }
          p.y = worldGroundHeight(p.x, p.z);
          state.orbitProgress = 0;
          state.behavior = "orbit";
        } else {
          const move = Math.min(step, distanceToOrbit);
          p.x += targetDirection.x * move;
          p.z += targetDirection.z * move;
          p.y = worldGroundHeight(p.x, p.z);
        }
      }
      ahead = p.clone().add(targetDirection.multiplyScalar(0.8));
      state.currentSpeed = state.isPaused ? 0 : state.approachSpeed;
    }

    if (state.behavior === "orbit") {
      if (!state.isPaused) {
        const remaining = Math.max(0, TARGET_ORBIT_TOTAL_RAD - state.orbitProgress);
        const deltaAngle = Math.min(TARGET_ORBIT_ANGULAR_SPEED * delta, remaining);
        state.orbitProgress += deltaAngle;
        state.orbitAngle += deltaAngle * state.orbitDirection;
      }

      const cosA = Math.cos(state.orbitAngle);
      const sinA = Math.sin(state.orbitAngle);
      p.x = state.targetPoint.x + cosA * TARGET_ORBIT_RADIUS;
      p.z = state.targetPoint.z + sinA * TARGET_ORBIT_RADIUS;
      p.y = worldGroundHeight(p.x, p.z);

      const tangent = new THREE.Vector3(
        -sinA * state.orbitDirection,
        0,
        cosA * state.orbitDirection
      );
      ahead = p.clone().add(tangent.multiplyScalar(0.85));
      state.currentSpeed = state.isPaused ? 0 : TARGET_ORBIT_RADIUS * TARGET_ORBIT_ANGULAR_SPEED;

      if (state.orbitProgress >= TARGET_ORBIT_TOTAL_RAD - 1e-6) {
        state.runHeadingYaw = Math.atan2(tangent.z, tangent.x);
        state.dragYaw = 0;
        state.behavior = "run";
        if (targetMarker) {
          targetMarker.visible = false;
        }
      }
    }
  }

  const baseForward = ahead.clone().sub(p);
  if (baseForward.lengthSq() < 1e-6) {
    baseForward.copy(lastForward);
  } else {
    baseForward.normalize();
    lastForward.copy(baseForward);
  }

  const lookForward = baseForward.clone();
  if (state.isPaused) {
    lookForward.applyAxisAngle(upAxis, state.dragYaw);
    lookForward.normalize();
  }

  runner.position.copy(p);
  runner.lookAt(p.clone().add(lookForward));

  if (dogMesh) {
    dogMesh.rotation.y = dogFacingOffset;
  }

  const camTarget = p.clone().add(new THREE.Vector3(0, 1.5, 0));

  // Keep the shadow frustum centered around the runner to avoid shadow loss at distance.
  const sunLerp = 1 - Math.exp(-delta * 3.2);
  const targetLerp = 1 - Math.exp(-delta * 6);
  sun.position.lerp(p.clone().add(SUN_OFFSET), sunLerp);
  sunTarget.position.lerp(p, targetLerp);
  sunTarget.updateMatrixWorld();

  if (state.behavior === "orbit") {
    if (!state.orbitCameraLocked) {
      orbitCameraPosition.copy(camera.position);
      orbitCameraLookTarget.copy(cameraLookTarget);
      state.orbitCameraLocked = true;
    }
    camera.position.copy(orbitCameraPosition);
    cameraLookTarget.copy(orbitCameraLookTarget);
  } else {
    state.orbitCameraLocked = false;
    const desiredCam = camTarget
      .clone()
      .add(lookForward.clone().multiplyScalar(-7.4))
      .add(new THREE.Vector3(0, 3.3, 0));
    camera.position.lerp(desiredCam, 1 - Math.exp(-delta * 5));
    cameraLookTarget.lerp(camTarget, 1 - Math.exp(-delta * 8));
  }
  camera.lookAt(cameraLookTarget);
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);

  if (state.runnerLoaded) {
    updateRunner(delta);
  }

  if (dogMixer) {
    dogMixer.timeScale = state.isPaused ? 0 : 1;
    dogMixer.update(delta);
  }
  for (const mixer of ambientMixers) {
    mixer.update(delta);
  }

  updateHUD();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

async function bootstrap() {
  addHillyGround();
  addSkyDecor();
  await Promise.all([addMountains(), addScenery(), addAmbientAnimals(), setupRunner()]);
  setMusicTrack(0);
  const start = sampleTrack(state.distance, state.lateral);
  const startAhead = sampleTrack(state.distance + 0.7, state.lateral);
  const startForward = startAhead.clone().sub(start).normalize();
  runner.position.copy(start);
  lastForward.copy(startForward);
  state.runHeadingYaw = Math.atan2(startForward.z, startForward.x);
  cameraLookTarget.copy(start.clone().add(startForward));
  animate();
}

bootstrap();
