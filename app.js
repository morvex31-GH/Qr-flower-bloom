// 1. Target URL extraction from search params
const urlParams = new URLSearchParams(window.location.search);
const targetUrl = urlParams.get('u') || 'https://instagram.com/armaan.deep31';
document.getElementById('target-url-label').textContent = targetUrl;

// 2. Generate standard QR Code matrix
function generateQrMatrix(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const matrix = [];

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        matrix.push({ r, c, total: count });
      }
    }
  }
  return { points: matrix, size: count };
}

const { points: qrPoints, size: qrSize } = generateQrMatrix(targetUrl);
const totalFlowers = qrPoints.length;

// 3. Three.js Scene Setup
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 45);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xfff6ee, 1.2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(20, 40, 30);
dirLight.castShadow = true;
scene.add(dirLight);

// 4. Ceramic Vase
const vaseGeo = new THREE.CylinderGeometry(2.2, 3.4, 7.5, 32);
const vaseMat = new THREE.MeshStandardMaterial({
  color: 0xf3eee7,
  roughness: 0.35,
  metalness: 0.05
});
const vase = new THREE.Mesh(vaseGeo, vaseMat);
vase.position.set(0, -7.5, 0);
scene.add(vase);

// 5. Flower Petal Geometry & InstancedMesh
// Simple teardrop petal shape extruded
const petalShape = new THREE.Shape();
petalShape.moveTo(0, 0);
petalShape.bezierCurveTo(0.4, 0.4, 0.5, 1.0, 0, 1.4);
petalShape.bezierCurveTo(-0.5, 1.0, -0.4, 0.4, 0, 0);

const extrudeSettings = { depth: 0.1, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.05, bevelThickness: 0.05 };
const flowerGeometry = new THREE.ExtrudeGeometry(petalShape, extrudeSettings);
flowerGeometry.center();

const flowerMaterial = new THREE.MeshStandardMaterial({
  roughness: 0.4,
  metalness: 0.1
});

const instancedFlowers = new THREE.InstancedMesh(flowerGeometry, flowerMaterial, totalFlowers);
scene.add(instancedFlowers);

// Color palette (Peony / Rose tones)
const palette = [
  new THREE.Color('#382823'), // Deep contrast for scannability
  new THREE.Color('#543932'),
  new THREE.Color('#422d28')
];

// Precompute Bouquet vs QR Positions
const bouquetPositions = [];
const bouquetRotations = [];
const qrPositions = [];
const qrRotations = [];

const qrScale = 22; // overall dimension in 3D world units
const step = qrScale / qrSize;

for (let i = 0; i < totalFlowers; i++) {
  // Flower Color
  const color = palette[i % palette.length];
  instancedFlowers.setColorAt(i, color);

  // Bouquet configuration (spherical distribution clustered above the vase)
  const phi = Math.acos(-1 + (2 * i) / totalFlowers);
  const theta = Math.sqrt(totalFlowers * Math.PI) * phi;
  const radius = 4.5 + Math.random() * 2.2;

  bouquetPositions.push(new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta) - 1.5,
    radius * Math.cos(phi)
  ));

  bouquetRotations.push(new THREE.Euler(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  ));

  // QR configuration (flat scannable grid facing camera)
  const pt = qrPoints[i];
  const qx = (pt.c - qrSize / 2 + 0.5) * step;
  const qy = -(pt.r - qrSize / 2 + 0.5) * step; // inverted Y for image coordinates
  const qz = 0;

  qrPositions.push(new THREE.Vector3(qx, qy, qz));
  qrRotations.push(new THREE.Euler(0, 0, 0)); // Flat facing forward
}
instancedFlowers.instanceColor.needsUpdate = true;

// 6. Animation State & Morphing Logic
let isBloomed = false;
const animObj = { progress: 0 };
const dummy = new THREE.Object3D();

function updateTransforms() {
  const p = animObj.progress;
  for (let i = 0; i < totalFlowers; i++) {
    // Interpolate Position
    const pos = new THREE.Vector3().lerpVectors(bouquetPositions[i], qrPositions[i], p);

    // Interpolate Rotation
    const rx = THREE.MathUtils.lerp(bouquetRotations[i].x, qrRotations[i].x, p);
    const ry = THREE.MathUtils.lerp(bouquetRotations[i].y, qrRotations[i].y, p);
    const rz = THREE.MathUtils.lerp(bouquetRotations[i].z, qrRotations[i].z, p);

    dummy.position.copy(pos);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.setScalar(THREE.MathUtils.lerp(0.9, 0.75, p));
    dummy.updateMatrix();

    instancedFlowers.setMatrixAt(i, dummy.matrix);
  }
  instancedFlowers.instanceMatrix.needsUpdate = true;

  // Fade or move vase downward when bloomed
  vase.position.y = THREE.MathUtils.lerp(-7.5, -25, p);
  vase.scale.setScalar(1 - p * 0.8);
}

function toggleBloom() {
  isBloomed = !isBloomed;
  const btn = document.getElementById('toggle-btn');
  const status = document.getElementById('status-text');

  gsap.to(animObj, {
    progress: isBloomed ? 1 : 0,
    duration: 1.8,
    ease: 'power3.inOut',
    onUpdate: updateTransforms,
    onComplete: () => {
      btn.textContent = isBloomed ? 'Fold to Bouquet' : 'Bloom Bouquet';
      status.textContent = isBloomed ? 'Scan with your camera phone' : 'Tap anywhere to bloom into a scannable QR code';
    }
  });
}

// Event Listeners
document.getElementById('toggle-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleBloom();
});

window.addEventListener('click', () => {
  toggleBloom();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Render Loop
updateTransforms();

function animate() {
  requestAnimationFrame(animate);

  // Gentle idle wobble when in bouquet state
  if (animObj.progress === 0) {
    instancedFlowers.rotation.y += 0.003;
    vase.rotation.y += 0.003;
  } else if (animObj.progress === 1) {
    instancedFlowers.rotation.y = 0;
  }

  renderer.render(scene, camera);
}
animate();
