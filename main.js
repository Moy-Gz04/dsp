import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

let scene, camera, renderer, controller;
let bullets = [], spheres = [], font;
let score = 0, scoreText;
let gameStarted = false;
let startButtonMesh, instructionMesh;
let gameOverElements = [];

const clock = new THREE.Clock();

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.6, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);
  document.body.appendChild(VRButton.createButton(renderer));

  controller = renderer.xr.getController(0);
  controller.addEventListener("selectstart", handleController);
  scene.add(controller);

  const light = new THREE.HemisphereLight(0xffffff, 0x444444);
  scene.add(light);

  const fontLoader = new FontLoader();
  fontLoader.load('https://unpkg.com/three@0.157.0/examples/fonts/helvetiker_bold.typeface.json', loadedFont => {
    font = loadedFont;
    showStartScreen();
  });
}

function showStartScreen() {
  instructionMesh = createText3D('Destruye las esferas\nantes de que escapen', 0.15, 0x00ffff);
  instructionMesh.position.set(-1.3, 1.6, -3);
  scene.add(instructionMesh);

  startButtonMesh = createText3D('[ COMENZAR ]', 0.2, 0xff00ff);
  startButtonMesh.position.set(-0.9, 1.2, -3);
  startButtonMesh.name = "start_button";
  scene.add(startButtonMesh);
}

function startGame() {
  scene.remove(instructionMesh);
  scene.remove(startButtonMesh);
  gameStarted = true;
  createScoreText();
  setInterval(spawnSphere, 1300);
}

function spawnSphere() {
  const color = new THREE.Color().setHSL(Math.random(), 1, 0.5);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 32, 32),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1 })
  );
  sphere.position.set(Math.random() * 3 - 1.5, -1, -3);
  sphere.userData.velocity = new THREE.Vector3(0, 0.01, 0);
  scene.add(sphere);
  spheres.push(sphere);
}

function handleController() {
  const ray = new THREE.Raycaster();
  const tempMatrix = new THREE.Matrix4().identity().extractRotation(controller.matrixWorld);
  ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  ray.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  const intersects = ray.intersectObjects(scene.children);
  for (const hit of intersects) {
    if (!gameStarted && hit.object.name === "start_button") return startGame();
    if (!gameStarted && hit.object.name === "retry_button") return location.reload();
    if (!gameStarted && hit.object.name === "exit_button") return window.close();
  }

  if (!gameStarted) return;

  // Crear la bala con dirección correcta
  const bullet = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
  );

  const tempDirMatrix = new THREE.Matrix4().extractRotation(controller.matrixWorld);
  const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(tempDirMatrix).normalize();
  const position = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);

  bullet.position.copy(position);
  bullet.userData.velocity = direction.multiplyScalar(3); // puedes ajustar la velocidad aquí

  scene.add(bullet);
  bullets.push(bullet);
}

function createText3D(text, size, color) {
  const geometry = new TextGeometry(text, {
    font,
    size,
    height: 0.05
  });
  const material = new THREE.MeshStandardMaterial({ color, metalness: 0.5, emissive: color });
  return new THREE.Mesh(geometry, material);
}

function createScoreText() {
  if (scoreText) scene.remove(scoreText);
  scoreText = createText3D(`Destruidas: ${score}`, 0.15, 0x00ffcc);
  scoreText.position.set(-1.2, 0.5, -4);
  scene.add(scoreText);
}

function createExplosion(pos) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true })
  );
  mesh.position.copy(pos);
  scene.add(mesh);

  let scale = 0.3, alpha = 1;
  const animate = () => {
    scale += 0.05;
    alpha -= 0.07;
    mesh.scale.set(scale, scale, scale);
    mesh.material.opacity = alpha;
    if (alpha <= 0) scene.remove(mesh);
    else requestAnimationFrame(animate);
  };
  animate();
}

function triggerGameOver() {
  gameStarted = false;
  bullets.forEach(b => scene.remove(b));
  spheres.forEach(s => scene.remove(s));
  bullets = [];
  spheres = [];

  const text = createText3D(`Has obtenido ${score} puntos`, 0.18, 0xff0000);
  text.position.set(-1.2, 1.5, -2.5);
  scene.add(text);
  gameOverElements.push(text);

  const retry = createText3D("[ REINTENTAR ]", 0.2, 0x00ff00);
  retry.position.set(-1, 1.1, -2.5);
  retry.name = "retry_button";
  scene.add(retry);
  gameOverElements.push(retry);

  const exit = createText3D("[ SALIR ]", 0.2, 0xff00ff);
  exit.position.set(-0.5, 0.7, -2.5);
  exit.name = "exit_button";
  scene.add(exit);
  gameOverElements.push(exit);
}

function animate() {
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();

    if (!gameStarted) return;

    bullets.forEach(b => {
      b.position.addScaledVector(b.userData.velocity, delta * 60);
    });

    spheres.forEach((s, i) => {
      s.position.add(s.userData.velocity);
      bullets.forEach((b, j) => {
        if (s.position.distanceTo(b.position) < 0.25) {
          createExplosion(s.position);
          scene.remove(s);
          scene.remove(b);
          spheres.splice(i, 1);
          bullets.splice(j, 1);
          score++;
          createScoreText();
        }
      });

      if (s.position.y > 2.5) {
        triggerGameOver();
      }
    });

    renderer.render(scene, camera);
  });
}
