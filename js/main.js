import * as THREE from 'three';
import { input } from './input.js';
import { buildCity } from './city.js';
import { Car, CATALOG } from './vehicle.js';
import { Player } from './player.js';
import { Traffic, Peds } from './traffic.js';
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
const SKY = 0xd8b78a; // late-afternoon haze
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 110, 420);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const hemi = new THREE.HemisphereLight(0xe8d4b0, 0x4a4238, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe0b0, 1.6);
sun.position.set(80, 120, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 400;
const S = 90;
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
const traffic = new Traffic(scene);
const peds = new Peds(scene);
const hud = new Hud(city.blocks);
const audio = new GameAudio();

const player = new Player(scene, roadCenter(4) + 5, roadCenter(4) + 10);

let mode = 'foot';   // 'foot' | 'drive'
let car = null;      // Car instance while driving
let camYaw = 0;
const camPos = new THREE.Vector3(player.pos.x, 8, player.pos.z + 12);

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
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading)); // car's left
  const out = car.pos.clone().add(side.multiplyScalar(2.4));
  const solved = city.resolve(out.x, out.z, player.radius, null);
  player.pos.set(solved.x, 0.3, solved.z);
  player.heading = car.heading;
  player.mesh.visible = true;
  // leave the car where it is, re-jackable as "parked"
  traffic.parked.push({ spec: car.spec, color: car.color, mesh: car.mesh, heading: car.heading });
  car = null;
  mode = 'foot';
}

// ---------- Camera ----------
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  let anchor, dist, height, headTo;
  if (mode === 'drive') {
    anchor = car.pos; headTo = car.heading;
    const s = Math.min(1, car.vel.length() / 30);
    dist = 9 + s * 3.5; height = 4 + s * 1.2;
  } else {
    anchor = player.pos; headTo = player.heading;
    dist = 7; height = 3.2;
  }
  let dh = headTo - camYaw;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  camYaw += dh * Math.min(1, dt * (mode === 'drive' ? 2.2 : 3.5));

  const behind = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw)); // opposite of forward(-sin,-cos)
  const want = anchor.clone().add(behind.multiplyScalar(dist)).setY(height);
  camPos.lerp(want, Math.min(1, dt * 5));
  camera.position.copy(camPos);
  camTarget.copy(anchor).setY(anchor.y + 1.6);
  camera.lookAt(camTarget);

  // keep the shadow camera centered on the action
  sun.position.set(anchor.x + 80, 120, anchor.z + 40);
  sun.target.position.copy(anchor);
}

// ---------- Loop ----------
const clock = new THREE.Clock();
let started = false;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  if (!started) { renderer.render(scene, camera); return; }

  const ax = input.axis();
  const hit = { building: false, wall: false };

  if (mode === 'foot') {
    player.update(dt, ax, input.down('ShiftLeft') || input.down('ShiftRight'), camYaw, city);
    const near = traffic.nearest(player.pos, 3.6);
    hud.hint(near ? 'Press E to enter vehicle' : '');
    if (near && input.justPressed('KeyE')) tryEnterCar();
    audio.engine(0, 0, false);
    peds.update(dt, player.pos, 0, 0.1, city);
    traffic.update(dt, player.pos, 0);
    hud.update(dt, player.pos, player.heading, traffic, mode);
  } else {
    const throttle = ax.y;
    const steer = -ax.x;
    const hb = input.down('Space');
    const vA = car.drive(dt, throttle, steer, hb, city, hit);
    if (hit.building || hit.wall) audio.thud();
    if (traffic.collideWithPlayer(car.pos, car.vel)) {
      car.vel.multiplyScalar(0.4);
      audio.thud();
    }
    if (input.justPressed('KeyH')) {
      audio.horn();
      peds.scare(car.pos, 12);
    }
    const speed = car.vel.length();
    peds.update(dt, car.pos, speed, car.radius, city);
    traffic.update(dt, car.pos, speed);
    hud.setSpeed(car.speedMph());
    hud.hint(speed < 3 ? 'Press E to exit' : '');
    if (speed < 3 && input.justPressed('KeyE')) exitCar();
    audio.engine(speed, throttle, true);
    hud.update(dt, car ? car.pos : player.pos, car ? car.heading : player.heading, traffic, mode);
  }

  updateCamera(dt);
  input.endFrame();
  renderer.render(scene, camera);
}

document.getElementById('play').addEventListener('click', () => {
  document.getElementById('start').classList.add('hidden');
  audio.init();
  started = true;
});

tick();
