import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

const canvas = document.querySelector("#scene");
const speedEl = document.querySelector("#speed");
const lapEl = document.querySelector("#lap");
const modeEl = document.querySelector("#mode");

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

const loader = new FBXLoader();
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
  runnerLoaded: false,
  isPaused: false,
  dragYaw: 0,
};

const cameraLookTarget = new THREE.Vector3();
const runner = new THREE.Group();
scene.add(runner);

let dogMesh = null;
let dogMixer = null;
let dogFacingOffset = 0;

const track = {
  start: -25,
  end: 320,
  widthLimit: 5.2,
};

const TERRAIN_Y_OFFSET = -3.7;
const SUN_OFFSET = new THREE.Vector3(22, 32, 8);
const MAX_DRAG_YAW = Math.PI * 0.42;
const DRAG_YAW_SENSITIVITY = 0.008;

const pointerState = {
  active: false,
  id: -1,
  lastX: 0,
  totalDx: 0,
  moved: false,
};

function togglePause() {
  state.isPaused = !state.isPaused;
}

function onPointerDown(event) {
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
      state.dragYaw + dx * DRAG_YAW_SENSITIVITY,
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
    togglePause();
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
  if (event.code === "Space") {
    if (!event.repeat) {
      togglePause();
    }
    event.preventDefault();
    return;
  }
  keys.add(event.code);
  if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
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

function sampleTrack(distance, lateral = 0) {
  const x = distance;
  const baseZ = Math.sin(distance * 0.08) * 6 + Math.sin(distance * 0.021) * 11;
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

    if (child.material) {
      child.material.flatShading = true;
      child.material.needsUpdate = true;
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
      const object = await loader.loadAsync(path);
      return object;
    } catch (error) {
      console.warn(`Load failed: ${path}`, error);
    }
  }
  return null;
}

function addHillyGround() {
  const width = 420;
  const depth = 170;
  const segW = 220;
  const segD = 110;

  const geometry = new THREE.PlaneGeometry(width, depth, segW, segD);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(140, 0, 0);

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

function updateHUD() {
  speedEl.textContent = `速度: ${state.currentSpeed.toFixed(1)}`;
  lapEl.textContent = `圈数: ${state.lap}`;
  modeEl.textContent = state.isPaused
    ? `状态: 暂停（拖拽角度 ${(THREE.MathUtils.radToDeg(state.dragYaw)).toFixed(0)}°）`
    : "状态: 奔跑";
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
  const tree = await loadFBX(["./assets/pack_animals/FBX/PineTree_2.fbx"]);
  const rock = await loadFBX(["./assets/pack_animals/FBX/Rock_2.fbx"]);
  if (!tree || !rock) {
    return;
  }

  configureRenderable(tree);
  configureRenderable(rock);
  scaleObjectToHeight(tree, 5.8);
  scaleObjectToHeight(rock, 1.6);

  for (let i = 0; i < 70; i += 1) {
    const isTree = Math.random() > 0.35;
    const template = isTree ? tree : rock;
    const clone = template.clone(true);
    const x = -5 + Math.random() * 340;
    const z = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 50);
    const y = worldGroundHeight(x, z) - (isTree ? 0.4 : 0.08);

    clone.position.set(x, y, z);
    clone.rotation.y = Math.random() * Math.PI * 2;
    const localScale = isTree
      ? 0.55 + Math.random() * 0.8
      : 0.6 + Math.random() * 0.65;
    clone.scale.multiplyScalar(localScale);
    scene.add(clone);
  }
}

async function setupRunner() {
  const dog = await loadFBX([
    "./assets/pack_nature/FBX/ShibaInu.fbx",
    "./assets/Dog/Dog.fbx",
  ]);

  if (!dog) {
    addFallbackDog();
    return;
  }

  dogMesh = dog;
  configureRenderable(dogMesh);
  scaleObjectToHeight(dogMesh, 1.35);
  const dogBox = new THREE.Box3().setFromObject(dogMesh);
  dogMesh.position.y += -dogBox.min.y + 0.02;
  dogMesh.rotation.y = 0;
  dogFacingOffset = 0;
  runner.add(dogMesh);

  if (dogMesh.animations && dogMesh.animations.length > 0) {
    dogMixer = new THREE.AnimationMixer(dogMesh);
    const runClip =
      dogMesh.animations.find((clip) => /run|walk|trot|gallop/i.test(clip.name)) ||
      dogMesh.animations[0];
    const action = dogMixer.clipAction(runClip);
    action.play();
  }

  state.runnerLoaded = true;
}

function updateRunner(delta) {
  if (!state.isPaused) {
    const left = keys.has("ArrowLeft") || keys.has("KeyA");
    const right = keys.has("ArrowRight") || keys.has("KeyD");
    const steering = (left ? -1 : 0) + (right ? 1 : 0);
    const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
    state.speed = sprinting ? state.sprintSpeed : state.minSpeed;

    state.lateral = THREE.MathUtils.clamp(
      state.lateral + steering * delta * 5.2,
      -track.widthLimit,
      track.widthLimit
    );
    state.distance += state.speed * delta;
    state.dragYaw = THREE.MathUtils.damp(state.dragYaw, 0, 5, delta);
  }

  state.currentSpeed = state.isPaused ? 0 : state.speed;

  if (state.distance > track.end) {
    state.distance = track.start;
    state.lateral *= 0.4;
    state.lap += 1;
  }

  const p = sampleTrack(state.distance, state.lateral);
  const ahead = sampleTrack(state.distance + 0.7, state.lateral);
  const forward = ahead.clone().sub(p).normalize();

  runner.position.copy(p);
  runner.lookAt(ahead);

  if (dogMesh) {
    dogMesh.rotation.y = dogFacingOffset + state.dragYaw;
  }

  const camTarget = p.clone().add(new THREE.Vector3(0, 1.5, 0));
  const desiredCam = camTarget
    .clone()
    .add(forward.clone().multiplyScalar(-7.4))
    .add(new THREE.Vector3(0, 3.3, 0));

  // Keep the shadow frustum centered around the runner to avoid shadow loss at distance.
  const sunLerp = 1 - Math.exp(-delta * 3.2);
  const targetLerp = 1 - Math.exp(-delta * 6);
  sun.position.lerp(p.clone().add(SUN_OFFSET), sunLerp);
  sunTarget.position.lerp(p, targetLerp);
  sunTarget.updateMatrixWorld();

  camera.position.lerp(desiredCam, 1 - Math.exp(-delta * 5));
  cameraLookTarget.lerp(camTarget, 1 - Math.exp(-delta * 8));
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

  updateHUD();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

async function bootstrap() {
  addHillyGround();
  addSkyDecor();
  await Promise.all([addMountains(), addScenery(), setupRunner()]);
  cameraLookTarget.copy(sampleTrack(state.distance));
  animate();
}

bootstrap();
