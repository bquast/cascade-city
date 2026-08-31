import * as THREE from 'three';
import { input } from './input.js';
import { buildCity } from './city.js';
import { buildTerrain } from './terrain.js';
import { buildStunts } from './stunts.js';
import { makeWorld } from './world.js';
import { Car } from './vehicle.js';
import { Player } from './player.js';
import { Traffic, Peds } from './traffic.js';
import { Weapons } from './weapons.js';
import { Police } from './police.js';
import { Effects, charMesh } from './effects.js';
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
const stunts = buildStunts(scene);
const world = makeWorld(city, terrain, stunts);
const traffic = new Traffic(scene);
const peds = new Peds(scene);
const police = new Police(scene, world);
const weapons = new Weapons(scene, world, city);
const audio = new GameAudio();
const effects = new Effects(scene, audio);
const hud = new Hud(city.blocks);

const player = new Player(scene, roadCenter(6) + 5, roadCenter(6) + 10);

let mode = 'foot';
let car = null;
let health = 100;
let mouseDown = false;
let overlayT = 0;
let started = false;
let shake = 0;

// ---------- Aim rig: one yaw/pitch drives camera, crosshair, and bullets ----------
let aimYaw = 0;
let aimPitch = 0.10;          // positive = looking down
const AIM_UP = -0.55, AIM_DOWN = 0.95;

canvas.addEventListener('click', () => {
  if (started && document.pointerLockElement !== canvas) canvas.requestPointerLock();
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  aimYaw -= e.movementX * 0.0026;
  aimPitch = Math.max(AIM_UP, Math.min(AIM_DOWN, aimPitch + e.movementY * 0.0022));
});
document.addEventListener('mousedown', (e) => { if (e.button === 0) mouseDown = true; });
document.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });

const aimVec = new THREE.Vector3();
function aimDir() {
  const cp = Math.cos(aimPitch);
  return aimVec.set(-Math.sin(aimYaw) * cp, -Math.sin(aimPitch), -Math.cos(aimYaw) * cp);
}

// ---------- Vehicle destruction ----------
function explodeEntry(e) {
  if (e.dead) return;
  e.dead = true;
  e.speed = 0;
  effects.boom(e.mesh.position.clone());
  charMesh(e.mesh);
  splash(e.mesh.position);
}

function explodePlayerCar() {
  if (!car || car.dead) return;
  car.dead = true;
  effects.boom(car.pos.clone());
  charMesh(car.mesh);
  splash(car.pos);
  health = 0; // going up with the car
  traffic.parked.push({ spec: car.spec, color: car.color, mesh: car.mesh, heading: car.heading, hp: 0, dead: true });
  car = null;
  mode = 'foot';
  player.mesh.visible = true;
}

function splash(pos) {
  peds.scare(pos, 30);
  for (const p of peds.list) {
    if (p.mode !== 'down' && p.mesh.position.distanceTo(pos) < 8) { peds.knock(p); police.crime(0.5); }
  }
  for (const v of traffic.allVehicles()) {
    if (!v.dead && v.mesh.position.distanceTo(pos) < 8) {
      v.hp -= 80;
      if (v.hp <= 0) effects.chain(0.3 + Math.random() * 0.3, () => explodeEntry(v));
    }
  }
  if (car && !car.dead && car.pos.distanceTo(pos) < 8) {
    car.hp -= 60;
    if (car.hp <= 0) effects.chain(0.25, explodePlayerCar);
  }
  if (mode === 'foot' && player.pos.distanceTo(pos) < 8) {
    health -= 55 * (1 - player.pos.distanceTo(pos) / 8) + 10;
    shake = Math.min(0.8, shake + 0.5);
  }
  police.crime(1.0);
}

// ---------- Enter / exit ----------
function tryEnterCar() {
  const found = traffic.nearest(player.pos, 3.6);
  if (!found) return;
  const { entry } = found;
  const heading = entry.mesh.rotation.y;
  const pos = entry.mesh.position.clone();
  traffic.remove(found);
  car = new Car(scene, entry.spec, entry.color, pos.x, pos.z, heading);
  car.hp = entry.hp ?? 100;
  car.pos.y = pos.y;
  player.mesh.visible = car.spec.kind === 'bike';
  mode = 'drive';
  hud.toast(entry.spec.name);
}

function exitCar() {
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
  const out = car.pos.clone().add(side.multiplyScalar(car.spec.kind === 'bike' ? 1.3 : 2.4));
  const solved = world.resolve(out.x, out.z, player.radius, null);
  player.pos.set(solved.x, world.groundY(solved.x, solved.z) + 0.3, solved.z);
  player.heading = car.heading;
  player.mesh.visible = true;
  player.mesh.rotation.set(0, player.heading, 0);
  traffic.parked.push({ spec: car.spec, color: car.color, mesh: car.mesh, heading: car.heading, hp: car.hp, dead: false });
  car = null;
  mode = 'foot';
}

// rider pose on the bike
function poseRider() {
  player.mesh.position.copy(car.pos);
  player.mesh.position.y += 0.62;
  player.mesh.rotation.set(car.mesh.rotation.x, car.heading, car.mesh.rotation.z);
  player.mesh.userData.legs[0].rotation.x = -1.15;
  player.mesh.userData.legs[1].rotation.x = -1.15;
  player.mesh.userData.arms[0].rotation.x = -0.85;
  player.mesh.userData.arms[1].rotation.x = -0.85;
}

// ---------- Death / arrest ----------
function showOverlay(text) {
  const el = document.getElementById('overlay');
  el.textContent = text;
  el.classList.add('on');
  overlayT = 2.2;
}

function respawn(atX, atZ) {
  if (mode === 'drive' && car) {
    traffic.parked.push({ spec: car.spec, color: car.color, mesh: car.mesh, heading: car.heading, hp: car.hp, dead: car.dead });
    car = null;
  }
  mode = 'foot';
  player.pos.set(atX, world.groundY(atX, atZ) + 0.3, atZ);
  player.mesh.visible = true;
  player.mesh.rotation.set(0, 0, 0);
  health = 100;
  police.clear();
}

// ---------- Shooting (on foot AND drive-by) ----------
function handleWeapons(dt) {
  if (input.justPressed('Digit1')) weapons.switchTo(0);
  if (input.justPressed('Digit2')) weapons.switchTo(1);
  if (input.justPressed('Digit3')) weapons.switchTo(2);
  const armed = weapons.current > 0;
  player.gun.visible = armed && mode === 'foot';
  hud.setWeapon(weapons.spec.name, true);
  document.getElementById('crosshair').style.display = armed ? 'block' : 'none';
  if (!armed) return;

  const firing = mouseDown && document.pointerLockElement === canvas && weapons.cooldown <= 0;
  if (!firing) return;

  const origin = mode === 'drive'
    ? car.pos.clone().add(new THREE.Vector3(0, car.spec.kind === 'bike' ? 1.5 : 1.3, 0))
    : player.pos.clone().add(new THREE.Vector3(0, 1.35, 0));

  const targets = [];
  for (const p of peds.list) {
    if (p.mode !== 'down') targets.push({ pos: p.mesh.position, r: 0.9, ref: { kind: 'ped', p } });
  }
  for (const c of police.cops) targets.push({ pos: c.mesh.position, r: 2.0, yOff: 0.8, ref: { kind: 'cop', c } });
  for (const v of traffic.allVehicles()) {
    if (!v.dead) targets.push({ pos: v.mesh.position, r: 2.2, yOff: 0.8, ref: { kind: 'car', v } });
  }

  const hit = weapons.fire(origin, aimDir(), targets);
  audio.gunshot(weapons.current === 2 ? 0.7 : 1);
  police.crime(weapons.current === 2 ? 0.06 : 0.12);
  peds.scare(mode === 'drive' ? car.pos : player.pos, 26);
  const dmg = weapons.current === 2 ? 9 : 16;
  if (hit) {
    if (hit.target.kind === 'ped') { peds.knock(hit.target.p); police.crime(0.8); }
    if (hit.target.kind === 'cop') {
      const c = hit.target.c;
      c.hp = (c.hp ?? 100) - dmg * 1.5;
      police.crime(0.5);
      if (c.hp <= 0) { effects.boom(c.mesh.position.clone()); splash(c.mesh.position); police.removeCop(c); police.crime(1.2); }
    }
    if (hit.target.kind === 'car') {
      const v = hit.target.v;
      v.hp -= dmg;
      if (v.hp <= 0) { explodeEntry(v); police.crime(1.0); }
    }
  }
}

// ---------- Camera ----------
const camPos = new THREE.Vector3(0, 8, 20);
const lookAt = new THREE.Vector3();
function updateCamera(dt) {
  const driving = mode === 'drive';
  const anchor = driving ? car.pos : player.pos;
  const aimingHeld = weapons.current > 0 && mouseDown && document.pointerLockElement === canvas;

  if (driving && !aimingHeld) {
    // trail the car; mouse offsets relax back so you can glance around
    let dh = car.heading - aimYaw;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    aimYaw += dh * Math.min(1, dt * 2.0);
    aimPitch += (0.12 - aimPitch) * Math.min(1, dt * 1.5);
  }

  const dist = driving ? 9 + Math.min(1, car.vel.length() / 30) * 3.5 : 6.0;
  const eyeH = driving ? 1.9 : 1.55;
  const dir = aimDir();
  const eye = anchor.clone();
  eye.y += eyeH;
  const want = eye.clone().sub(dir.clone().multiplyScalar(dist));
  want.y = Math.max(want.y, world.groundY(want.x, want.z) + 1.2);
  camPos.lerp(want, Math.min(1, dt * (aimingHeld ? 14 : 6)));
  camera.position.copy(camPos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 2.5);
  }
  lookAt.copy(eye).add(dir.clone().multiplyScalar(24));
  camera.lookAt(lookAt);

  sun.position.set(anchor.x + 80, anchor.y + 120, anchor.z + 40);
  sun.target.position.copy(anchor);
}

// ---------- Loop ----------
const clock = new THREE.Clock();

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
  const hit = { building: false, wall: false, tree: false, landed: false };
  let threatPos = player.pos, threatSpeed = 0, threatR = 0.1;

  if (mode === 'foot') {
    const aiming = weapons.current > 0 && mouseDown && document.pointerLockElement === canvas;
    player.update(dt, ax, input.down('ShiftLeft') || input.down('ShiftRight'), aimYaw, world, aiming);
    const near = traffic.nearest(player.pos, 3.6);
    hud.hint(near ? 'Press E to enter vehicle' : '');
    if (near && input.justPressed('KeyE')) tryEnterCar();
    audio.engine(0, 0, false);
  } else {
    const speedBefore = car.vel.length();
    car.drive(dt, ax.y, -ax.x, input.down('Space'), world, hit);
    if (hit.building || hit.wall || hit.tree) {
      audio.thud();
      shake = Math.min(0.5, shake + 0.15);
      const dmg = Math.max(0, (speedBefore - 9) * 1.1);
      if (dmg > 0) car.hp -= dmg;
    }
    if (hit.landed) { shake = Math.min(0.5, shake + 0.2); audio.thud(); }
    const bumped = traffic.collideWithPlayer(car.pos, speedBefore);
    if (bumped) {
      car.vel.multiplyScalar(0.45);
      audio.thud();
      car.hp -= Math.max(0, (speedBefore - 14) * 0.5);
      if (bumped.hp <= 0) { explodeEntry(bumped); police.crime(1.0); }
    }
    if (input.justPressed('KeyH')) { audio.horn(); peds.scare(car.pos, 12); }
    if (car.hp <= 0 && !car.dead) explodePlayerCar();
    if (car) {
      const speed = car.vel.length();
      hud.setSpeed(car.speedMph());
      hud.hint(car.airborne ? '' : speed < 3 ? 'Press E to exit' : '');
      if (!car.airborne && speed < 3 && input.justPressed('KeyE')) exitCar();
      audio.engine(speed, ax.y, true);
      if (car && car.spec.kind === 'bike') poseRider();
      threatPos = car.pos; threatSpeed = speed; threatR = car.radius + (car.spec.kind === 'bike' ? 0.3 : 0);
    }
  }

  handleWeapons(dt);
  weapons.update(dt);
  effects.update(dt);
  peds.update(dt, threatPos, threatSpeed, threatR, world, onPedDown);
  traffic.update(dt, threatPos, threatSpeed);

  const pSpeed = mode === 'drive' && car ? car.vel.length() : player.speed;
  const ev = police.update(dt, threatPos, mode === 'drive', pSpeed);
  if (ev.rammedPlayer) {
    shake = Math.min(0.6, shake + 0.3);
    audio.thud();
    if (mode === 'foot') health -= 30;
    else if (car) { car.vel.multiplyScalar(0.55); car.hp -= 7; }
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

  const headingNow = mode === 'drive' && car ? car.heading : player.heading;
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
