import * as THREE from 'three';
import { input } from './input.js';
import { buildCity } from './city.js';
import { buildTerrain } from './terrain.js';
import { makeWorld } from './world.js';
import { Car } from './vehicle.js';
import { Player } from './player.js';
import { Traffic, Peds } from './traffic.js';
import { Weapons } from './weapons.js';
import { Police } from './police.js';
import { Hud } from './hud.js';
import { GameAudio } from './audio.js';
import { roadCenter } from './config.js';

// ---------- Renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const SKY = 0xd8b78a;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 140, 850);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2200);

const hemi = new THREE.HemisphereLight(0xe8d4b0, 0x4a4238, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe0b0, 1.6);
sun.position.set(80, 120, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 500;
const S = 110;
sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
scene.add(sun, sun.target);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- World ----------
const city = buildCity(scene);
const terrain = buildTerrain(scene);
const world = makeWorld(city, terrain);
const traffic = new Traffic(scene);
const peds = new Peds(scene);
const police = new Police(scene, world);
const weapons = new Weapons(scene, world, city);
const hud = new Hud(city.blocks);
const audio = new GameAudio();

const SPAWN = { x: roadCenter(6) + 5, z: roadCenter(6) + 10 };
const player = new Player(scene, SPAWN.x, SPAWN.z);

let mode = 'foot';
let car = null;
let health = 100;
let mouseDown = false;
let overlayT = 0;

// camera state
let camYaw = 0, camPitch = 0.22;
const camPos = new THREE.Vector3(player.pos.x, 8, player.pos.z + 12);
let shake = 0;

// ---------- Pointer lock + mouse ----------
canvas.addEventListener('click', () => {
  if (started && document.pointerLockElement !== canvas) canvas.requestPointerLock();
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  camYaw -= e.movementX * 0.0026;
  camPitch = Math.max(-0.15, Math.min(0.9, camPitch + e.movementY * 0.0022));
});
document.addEventListener('mousedown', (e) => { if (e.button === 0) mouseDown = true; });
document.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });

// ---------- Enter / exit ----------
function tryEnterCar() {
  const found = traffic.nearest(player.pos, 3.6);
  if (!found) return;
  const { entry } = found;
  const heading = entry.mesh.rotation.y;
  const pos = entry.mesh.position.clone();
  traffic.remove(found);
  car = new Car(scene, entry.spec, entry.color, pos.x, pos.z, heading);
  player.mesh.visible = false;
  mode = 'drive';
  hud.toast(entry.spec.name);
}

function exitCar() {
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
  const out = car.pos.clone().add(side.multiplyScalar(2.4));
  const solved = world.resolve(out.x, out.z, player.radius, null);
  player.pos.set(solved.x, world.groundY(solved.x, solved.z) + 0.3, solved.z);
  player.heading = car.heading;
  player.mesh.visible = true;
  traffic.parked.push({ spec: car.spec, color: car.color, mesh: car.mesh, heading: car.heading });
  car = null;
  mode = 'foot';
}

// ---------- Death / arrest ----------
function showOverlay(text) {
  const el = document.getElementById('overlay');
  el.textContent = text;
  el.classList.add('on');
  overlayT = 2.2;
}

function respawn(atX, atZ) {
  if (mode === 'drive') { // abandon the car where it died
    traffic.parked.push({ spec: car.spec, color: car.color, mesh: car.mesh, heading: car.heading });
    car = null; mode = 'foot';
  }
  player.pos.set(atX, world.groundY(atX, atZ) + 0.3, atZ);
  player.mesh.visible = true;
  health = 100;
  police.clear();
}

// ---------- Shooting ----------
const camDir = new THREE.Vector3();
function handleWeapons(dt) {
  if (input.justPressed('Digit1')) weapons.switchTo(0);
  if (input.justPressed('Digit2')) weapons.switchTo(1);
  if (input.justPressed('Digit3')) weapons.switchTo(2);
  const armed = weapons.current > 0;
  player.gun.visible = armed && mode === 'foot';
  hud.setWeapon(weapons.spec.name, mode === 'foot');
  document.getElementById('crosshair').style.display = (armed && mode === 'foot') ? 'block' : 'none';

  if (mode !== 'foot' || !armed) return;
  const clicked = mouseDown && document.pointerLockElement === canvas;
  const firing = weapons.spec.auto ? clicked : (clicked && weapons.cooldown <= 0);
  if (!firing) return;

  camera.getWorldDirection(camDir);
  const origin = player.pos.clone();
  origin.y += 1.35;
  const targets = [];
  for (const p of peds.list) {
    if (p.mode !== 'down') targets.push({ pos: p.mesh.position, r: 0.9, ref: { kind: 'ped', p } });
  }
  for (const c of police.cops) targets.push({ pos: c.mesh.position, r: 1.9, yOff: 0.8, ref: { kind: 'cop', c } });
  const hit = weapons.fire(origin, camDir, targets);
  if (weapons.cooldown === 1 / weapons.spec.rate) { // a shot actually left the barrel
    audio.gunshot(weapons.current === 2 ? 0.7 : 1);
    police.crime(weapons.current === 2 ? 0.06 : 0.12); // gunfire draws heat by itself
    peds.scare(player.pos, 26);
    if (hit) {
      if (hit.target.kind === 'ped') { peds.knock(hit.target.p); police.crime(0.8); }
      if (hit.target.kind === 'cop') { hit.target.c.vel.multiplyScalar(0.3); police.crime(1.1); }
    }
  }
}

// ---------- Camera ----------
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  let anchor, dist, height;
  if (mode === 'drive') {
    anchor = car.pos;
    const s = Math.min(1, car.vel.length() / 30);
    dist = 9 + s * 3.5; height = 4 + s * 1.2;
    // driving: camera trails the car heading, mouse offset relaxes back
    let dh = car.heading - camYaw;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    camYaw += dh * Math.min(1, dt * 2.2);
  } else {
    anchor = player.pos;
    dist = 6.5; height = 2.6;
  }
  const cp = Math.max(0.05, camPitch);
  const off = new THREE.Vector3(
    Math.sin(camYaw) * Math.cos(cp),
    Math.sin(cp),
    Math.cos(camYaw) * Math.cos(cp)
  ).multiplyScalar(dist);
  off.y = Math.max(off.y, 1.2);
  const want = anchor.clone().add(off);
  want.y += height * 0.4;
  // keep the camera above the terrain
  want.y = Math.max(want.y, world.groundY(want.x, want.z) + 1.4);
  camPos.lerp(want, Math.min(1, dt * 6));
  camera.position.copy(camPos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 2.5);
  }
  camTarget.copy(anchor).setY(anchor.y + 1.6);
  camera.lookAt(camTarget);

  sun.position.set(anchor.x + 80, anchor.y + 120, anchor.z + 40);
  sun.target.position.copy(anchor);
}

// ---------- Loop ----------
const clock = new THREE.Clock();
let started = false;

const onPedDown = () => police.crime(0.9);

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  if (!started) { renderer.render(scene, camera); return; }

  if (overlayT > 0) {
    overlayT -= dt;
    if (overlayT <= 0) document.getElementById('overlay').classList.remove('on');
  }

  const ax = input.axis();
  const hit = { building: false, wall: false, tree: false };
  let threatPos = player.pos, threatSpeed = 0, threatR = 0.1;

  if (mode === 'foot') {
    const aiming = weapons.current > 0 && mouseDown && document.pointerLockElement === canvas;
    player.update(dt, ax, input.down('ShiftLeft') || input.down('ShiftRight'), camYaw, world, aiming);
    const near = traffic.nearest(player.pos, 3.6);
    hud.hint(near ? 'Press E to enter vehicle' : '');
    if (near && input.justPressed('KeyE')) tryEnterCar();
    audio.engine(0, 0, false);
  } else {
    const throttle = ax.y;
    const steer = -ax.x;
    const vA = car.drive(dt, throttle, steer, input.down('Space'), world, hit);
    if (hit.building || hit.wall || hit.tree) { audio.thud(); shake = Math.min(0.5, shake + 0.2); }
    if (traffic.collideWithPlayer(car.pos, car.vel)) { car.vel.multiplyScalar(0.4); audio.thud(); }
    if (input.justPressed('KeyH')) { audio.horn(); peds.scare(car.pos, 12); }
    const speed = car.vel.length();
    hud.setSpeed(car.speedMph());
    hud.hint(speed < 3 ? 'Press E to exit' : '');
    if (speed < 3 && input.justPressed('KeyE')) exitCar();
    audio.engine(speed, throttle, true);
    threatPos = car.pos; threatSpeed = speed; threatR = car.radius;
  }

  handleWeapons(dt);
  weapons.update(dt);
  peds.update(dt, threatPos, threatSpeed, threatR, world, onPedDown);
  traffic.update(dt, threatPos, threatSpeed);

  const pSpeed = mode === 'drive' ? car.vel.length() : player.speed;
  const ev = police.update(dt, threatPos, mode === 'drive', pSpeed);
  if (ev.rammedPlayer) {
    shake = Math.min(0.6, shake + 0.3);
    audio.thud();
    if (mode === 'foot') health -= 30;
    else car.vel.multiplyScalar(0.55);
  }
  let nearestCop = 1e9;
  for (const c of police.cops) nearestCop = Math.min(nearestCop, c.mesh.position.distanceTo(threatPos));
  audio.siren(dt, police.stars > 0, nearestCop === 1e9 ? 999 : nearestCop);

  if (ev.busted) {
    showOverlay('BUSTED');
    respawn(roadCenter(5) + 6, roadCenter(4) + 8);
  } else if (health <= 0) {
    showOverlay('WASTED');
    respawn(roadCenter(7) + 6, roadCenter(8) + 8);
  }
  hud.setHealth(health);

  const headingNow = mode === 'drive' ? car.heading : player.heading;
  hud.update(dt, threatPos, headingNow, traffic, police, mode);

  updateCamera(dt);
  input.endFrame();
  renderer.render(scene, camera);
}

document.getElementById('play').addEventListener('click', () => {
  document.getElementById('start').classList.add('hidden');
  audio.init();
  audio.initExtras();
  started = true;
  canvas.requestPointerLock();
});

tick();
