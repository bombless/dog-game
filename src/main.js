import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

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
  runnerLoaded: false,
  isPaused: false,
  dragYaw: 0,
  behavior: "run",
  waitRemaining: 0,
  targetPoint: new THREE.Vector3(),
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
const TARGET_WAIT_SECONDS = 6;
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
let groundMesh = null;
let targetMarker = null;

const pointerState = {
  active: false,
  id: -1,
  lastX: 0,
  totalDx: 0,
  moved: false,
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
  state.waitRemaining = TARGET_WAIT_SECONDS;
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

  if (state.isPaused || state.behavior === "wait") {
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

function updateHUD() {
  speedEl.textContent = `速度: ${state.currentSpeed.toFixed(1)}`;
  lapEl.textContent = `圈数: ${state.lap}`;
  if (state.isPaused) {
    modeEl.textContent = `状态: 暂停（拖拽角度 ${(THREE.MathUtils.radToDeg(state.dragYaw)).toFixed(0)}°）`;
    return;
  }
  if (state.behavior === "approach") {
    modeEl.textContent = "状态: 正在靠近红球";
    return;
  }
  if (state.behavior === "wait") {
    modeEl.textContent = `状态: 已到达，等待 ${state.waitRemaining.toFixed(1)}s`;
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
  const tree =
    (await loadGLTF([
      "./assets/pack_animals_gltf/glTF/BirchTree_1.gltf",
      "./assets/pack_animals_gltf/glTF/MapleTree_1.gltf",
    ])) ||
    (await loadFBX(["./assets/pack_animals/FBX/PineTree_2.fbx"]));
  const bush =
    (await loadGLTF(["./assets/pack_animals_gltf/glTF/Bush_Large.gltf"])) ||
    (await loadFBX(["./assets/pack_animals/FBX/Bush_Large.fbx"]));
  const rock = await loadFBX(["./assets/pack_animals/FBX/Rock_2.fbx"]);
  if (!tree || !bush || !rock) {
    return;
  }

  configureRenderable(tree);
  configureRenderable(bush);
  configureRenderable(rock);
  scaleObjectToHeight(tree, 5.8);
  scaleObjectToHeight(bush, 1.6);
  scaleObjectToHeight(rock, 1.6);

  for (let i = 0; i < 70; i += 1) {
    const roll = Math.random();
    const isTree = roll > 0.4;
    const isBush = !isTree && roll > 0.2;
    const template = isTree ? tree : isBush ? bush : rock;
    const clone = template.clone(true);
    const x = -5 + Math.random() * 340;
    const z = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 50);
    const y = worldGroundHeight(x, z) - (isTree ? 0.35 : 0.06);

    clone.position.set(x, y, z);
    clone.rotation.y = Math.random() * Math.PI * 2;
    const localScale = isTree
      ? 0.55 + Math.random() * 0.8
      : isBush
        ? 0.65 + Math.random() * 0.6
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
        if (distanceToTarget <= 0.35 || step >= distanceToTarget) {
          p.x = state.targetPoint.x;
          p.z = state.targetPoint.z;
          p.y = worldGroundHeight(p.x, p.z);
          state.behavior = "wait";
          state.waitRemaining = TARGET_WAIT_SECONDS;
        } else {
          p.x += targetDirection.x * step;
          p.z += targetDirection.z * step;
          p.y = worldGroundHeight(p.x, p.z);
        }
      }
      ahead = p.clone().add(targetDirection.multiplyScalar(0.8));
      state.currentSpeed = state.isPaused ? 0 : state.approachSpeed;
    }

    if (state.behavior === "wait") {
      state.currentSpeed = 0;
      if (!state.isPaused) {
        state.waitRemaining = Math.max(0, state.waitRemaining - delta);
        if (state.waitRemaining <= 0) {
          state.runHeadingYaw = Math.atan2(lastForward.z, lastForward.x) + state.dragYaw;
          state.dragYaw = 0;
          state.behavior = "run";
          if (targetMarker) {
            targetMarker.visible = false;
          }
        }
      }
      ahead = p.clone().add(lastForward.clone().multiplyScalar(0.8));
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
  if (state.isPaused || state.behavior === "wait") {
    lookForward.applyAxisAngle(upAxis, state.dragYaw);
    lookForward.normalize();
  }

  runner.position.copy(p);
  runner.lookAt(p.clone().add(lookForward));

  if (dogMesh) {
    dogMesh.rotation.y = dogFacingOffset;
  }

  const camTarget = p.clone().add(new THREE.Vector3(0, 1.5, 0));
  const desiredCam = camTarget
    .clone()
    .add(lookForward.clone().multiplyScalar(-7.4))
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
    dogMixer.timeScale = state.isPaused || state.behavior === "wait" ? 0 : 1;
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
