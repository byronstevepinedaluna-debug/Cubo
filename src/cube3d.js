// cube3d.js - Visualizador 3D y motor de animación con Three.js

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COLOR_MAP, CORNERS, FACE_NAMES } from './cubeModel.js';

export class Cube3D {
  constructor(containerElement, onStickerClick = null) {
    this.container = containerElement;
    this.onStickerClick = onStickerClick;
    this.isAnimating = false;
    this.cubies = [];
    this.stickers = []; // { mesh, cubie, initialFaceletId, currentFaceletId }

    this.initScene();
    this.createCube();
    this.setupEvents();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initScene() {
    const width = this.container.clientWidth || 500;
    const height = this.container.clientHeight || 450;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(4.2, 3.8, 5.2);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3.0;
    this.controls.maxDistance = 12.0;
    this.controls.target.set(0, 0, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight1.position.set(5, 10, 7);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight2.position.set(-6, -4, -5);
    this.scene.add(dirLight2);

    // Raycaster for sticker click detection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Group to hold all cubies
    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);
  }

  // Crea una textura redondeada y estética para las pegatinas
  createStickerTexture(hexColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Fondo oscuro (plástico)
    ctx.fillStyle = '#141416';
    ctx.fillRect(0, 0, 128, 128);

    // Pegatina con esquinas redondeadas
    const r = 16;
    const pad = 6;
    const w = 128 - pad * 2;
    const h = 128 - pad * 2;

    ctx.beginPath();
    ctx.moveTo(pad + r, pad);
    ctx.arcTo(pad + w, pad, pad + w, pad + h, r);
    ctx.arcTo(pad + w, pad + h, pad, pad + h, r);
    ctx.arcTo(pad, pad + h, pad, pad, r);
    ctx.arcTo(pad, pad, pad + w, pad, r);
    ctx.closePath();

    ctx.fillStyle = hexColor;
    ctx.fill();

    // Sutil bisel/borde brillante en la pegatina
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  createCube() {
    // Definición de las 8 esquinas con sus coordenadas (x, y, z) en {-0.5, 0.5}
    const cubieDefs = [
      { id: 0, pos: [-0.5,  0.5,  0.5], stickers: [{ face: 'U', norm: [0, 1, 0], fid: 2 }, { face: 'L', norm: [-1, 0, 0], fid: 5 }, { face: 'F', norm: [0, 0, 1], fid: 8 }] },
      { id: 1, pos: [ 0.5,  0.5,  0.5], stickers: [{ face: 'U', norm: [0, 1, 0], fid: 3 }, { face: 'F', norm: [0, 0, 1], fid: 9 }, { face: 'R', norm: [1, 0, 0], fid: 12 }] },
      { id: 2, pos: [ 0.5,  0.5, -0.5], stickers: [{ face: 'U', norm: [0, 1, 0], fid: 1 }, { face: 'R', norm: [1, 0, 0], fid: 13 }, { face: 'B', norm: [0, 0, -1], fid: 16 }] },
      { id: 3, pos: [-0.5,  0.5, -0.5], stickers: [{ face: 'U', norm: [0, 1, 0], fid: 0 }, { face: 'B', norm: [0, 0, -1], fid: 17 }, { face: 'L', norm: [-1, 0, 0], fid: 4 }] },
      { id: 4, pos: [-0.5, -0.5,  0.5], stickers: [{ face: 'D', norm: [0, -1, 0], fid: 20 }, { face: 'F', norm: [0, 0, 1], fid: 10 }, { face: 'L', norm: [-1, 0, 0], fid: 7 }] },
      { id: 5, pos: [ 0.5, -0.5,  0.5], stickers: [{ face: 'D', norm: [0, -1, 0], fid: 21 }, { face: 'R', norm: [1, 0, 0], fid: 14 }, { face: 'F', norm: [0, 0, 1], fid: 11 }] },
      { id: 6, pos: [ 0.5, -0.5, -0.5], stickers: [{ face: 'D', norm: [0, -1, 0], fid: 23 }, { face: 'B', norm: [0, 0, -1], fid: 18 }, { face: 'R', norm: [1, 0, 0], fid: 15 }] },
      { id: 7, pos: [-0.5, -0.5, -0.5], stickers: [{ face: 'D', norm: [0, -1, 0], fid: 22 }, { face: 'L', norm: [-1, 0, 0], fid: 6 }, { face: 'B', norm: [0, 0, -1], fid: 19 }] },
    ];

    const cubieGeo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.6,
      metalness: 0.1
    });

    const stickerGeo = new THREE.PlaneGeometry(0.86, 0.86);

    this.cubies = [];
    this.stickers = [];

    for (const def of cubieDefs) {
      const cubieMesh = new THREE.Mesh(cubieGeo, bodyMat);
      cubieMesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
      cubieMesh.userData = { id: def.id, originalPos: [...def.pos] };

      // Añadir las 3 pegatinas
      for (const st of def.stickers) {
        const mat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.35,
          metalness: 0.05
        });

        const stMesh = new THREE.Mesh(stickerGeo, mat);
        stMesh.userData = {
          faceletId: st.fid,
          face: st.face,
          cubie: cubieMesh,
          initialNormal: new THREE.Vector3(...st.norm)
        };

        // Posicionar pegatina en la cara externa del cubie
        const offset = 0.485;
        stMesh.position.set(st.norm[0] * offset, st.norm[1] * offset, st.norm[2] * offset);

        // Orientar plano de la pegatina hacia la normal
        if (st.norm[1] === 1) { // U (arriba)
          stMesh.rotation.x = -Math.PI / 2;
        } else if (st.norm[1] === -1) { // D (abajo)
          stMesh.rotation.x = Math.PI / 2;
        } else if (st.norm[0] === 1) { // R (derecha)
          stMesh.rotation.y = Math.PI / 2;
        } else if (st.norm[0] === -1) { // L (izquierda)
          stMesh.rotation.y = -Math.PI / 2;
        } else if (st.norm[2] === -1) { // B (atrás)
          stMesh.rotation.y = Math.PI;
        }
        // F (frontal) no necesita rotación (mira hacia +Z por defecto)

        cubieMesh.add(stMesh);
        this.stickers.push(stMesh);
      }

      this.cubeGroup.add(cubieMesh);
      this.cubies.push(cubieMesh);
    }
  }

  // Asigna colores a las 24 facetas según el arreglo
  updateColors(faceletColors) {
    // Resetear posiciones y rotaciones de cubies si se actualiza directamente
    this.resetTransforms();

    for (const stMesh of this.stickers) {
      const fid = stMesh.userData.faceletId;
      const colorKey = faceletColors[fid];
      if (colorKey && COLOR_MAP[colorKey]) {
        stMesh.material.color.set(COLOR_MAP[colorKey].hex);
      } else {
        stMesh.material.color.set(0x333338); // Color sin pintar
      }
    }
  }

  // Resetea todas las transformaciones 3D a la posición canónica
  resetTransforms() {
    for (const cubie of this.cubies) {
      cubie.rotation.set(0, 0, 0);
      const orig = cubie.userData.originalPos;
      cubie.position.set(orig[0], orig[1], orig[2]);
      cubie.updateMatrixWorld(true);
    }
  }

  // Animación suave de un movimiento de capa (ej: U, R', F2)
  animateMove(move, targetColors = null, duration = 320) {
    if (this.isAnimating) return Promise.reject("Ya hay una animación en curso");
    this.isAnimating = true;

    return new Promise((resolve) => {
      const face = move[0];
      const isDouble = move.includes('2');
      const isInverse = move.includes("'");

      // Identificar eje y condición de capa
      let axis = new THREE.Vector3();
      let filter = null;
      let angle = -Math.PI / 2; // Giro canónico horario

      if (face === 'U') {
        axis.set(0, 1, 0);
        filter = (c) => c.position.y > 0.1;
      } else if (face === 'D') {
        axis.set(0, 1, 0);
        filter = (c) => c.position.y < -0.1;
        angle = Math.PI / 2;
      } else if (face === 'R') {
        axis.set(1, 0, 0);
        filter = (c) => c.position.x > 0.1;
      } else if (face === 'L') {
        axis.set(1, 0, 0);
        filter = (c) => c.position.x < -0.1;
        angle = Math.PI / 2;
      } else if (face === 'F') {
        axis.set(0, 0, 1);
        filter = (c) => c.position.z > 0.1;
      } else if (face === 'B') {
        axis.set(0, 0, 1);
        filter = (c) => c.position.z < -0.1;
        angle = Math.PI / 2;
      }

      if (isDouble) {
        angle *= 2;
      } else if (isInverse) {
        angle *= -1;
      }

      // Crear grupo temporal pivote
      const pivot = new THREE.Group();
      this.cubeGroup.add(pivot);

      // Seleccionar los 4 cubies que pertenecen a la capa
      const layerCubies = this.cubies.filter(filter);
      for (const cubie of layerCubies) {
        pivot.attach(cubie);
      }

      const startTime = performance.now();

      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1.0);

        // Easing cúbico suave
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        pivot.rotation.set(0, 0, 0);
        if (axis.x === 1) pivot.rotation.x = angle * eased;
        if (axis.y === 1) pivot.rotation.y = angle * eased;
        if (axis.z === 1) pivot.rotation.z = angle * eased;

        if (progress < 1.0) {
          requestAnimationFrame(step);
        } else {
          // Finalizar rotación
          for (const cubie of layerCubies) {
            this.cubeGroup.attach(cubie);
          }
          this.cubeGroup.remove(pivot);

          // Resetear todas las transformaciones a estado canónico limpio
          this.resetTransforms();

          // Aplicar los colores exactos resultantes del movimiento
          if (targetColors) {
            this.updateColors(targetColors);
          }

          this.isAnimating = false;
          resolve();
        }
      };

      requestAnimationFrame(step);
    });
  }

  // Detección de clics en las pegatinas 3D
  setupEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      this.pointerDownX = e.clientX;
      this.pointerDownY = e.clientY;
    });

    dom.addEventListener('pointerup', (e) => {
      // Si hubo arrastre para rotar la cámara, ignorar clic
      const dist = Math.hypot(e.clientX - this.pointerDownX, e.clientY - this.pointerDownY);
      if (dist > 5) return;

      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.stickers);

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        const fid = clickedMesh.userData.faceletId;
        if (this.onStickerClick && fid !== undefined && fid !== null) {
          this.onStickerClick(fid);
        }
      }
    });

    // Resize
    window.addEventListener('resize', () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w && h) {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      }
    });
  }

  // Identifica a qué índice de faceta (0..23) corresponde una pegatina en su orientación espacial actual
  identifySpatialFacelet(stickerMesh) {
    const worldNorm = new THREE.Vector3();
    stickerMesh.getWorldDirection(worldNorm);
    // Nota: getWorldDirection para PlaneGeometry apunta a +Z local.
    const worldPos = new THREE.Vector3();
    stickerMesh.getWorldPosition(worldPos);

    const x = worldPos.x;
    const y = worldPos.y;
    const z = worldPos.z;

    // Cara U (y > 0.6)
    if (y > 0.6) {
      if (x < 0 && z < 0) return 0; // U0 (UBL)
      if (x > 0 && z < 0) return 1; // U1 (UBR)
      if (x < 0 && z > 0) return 2; // U2 (UFL)
      if (x > 0 && z > 0) return 3; // U3 (UFR)
    }
    // Cara D (y < -0.6)
    if (y < -0.6) {
      if (x < 0 && z > 0) return 20; // D0 (DFL)
      if (x > 0 && z > 0) return 21; // D1 (DFR)
      if (x < 0 && z < 0) return 22; // D2 (DBL)
      if (x > 0 && z < 0) return 23; // D3 (DBR)
    }
    // Cara F (z > 0.6)
    if (z > 0.6) {
      if (x < 0 && y > 0) return 8;  // F0 (TL)
      if (x > 0 && y > 0) return 9;  // F1 (TR)
      if (x < 0 && y < 0) return 10; // F2 (BL)
      if (x > 0 && y < 0) return 11; // F3 (BR)
    }
    // Cara B (z < -0.6)
    if (z < -0.6) {
      if (x > 0 && y > 0) return 16; // B0 (TL mirando desde atrás: x>0)
      if (x < 0 && y > 0) return 17; // B1 (TR)
      if (x > 0 && y < 0) return 18; // B2 (BL)
      if (x < 0 && y < 0) return 19; // B3 (BR)
    }
    // Cara L (x < -0.6)
    if (x < -0.6) {
      if (z < 0 && y > 0) return 4; // L0
      if (z > 0 && y > 0) return 5; // L1
      if (z < 0 && y < 0) return 6; // L2
      if (z > 0 && y < 0) return 7; // L3
    }
    // Cara R (x > 0.6)
    if (x > 0.6) {
      if (z > 0 && y > 0) return 12; // R0
      if (z < 0 && y > 0) return 13; // R1
      if (z > 0 && y < 0) return 14; // R2
      if (z < 0 && y < 0) return 15; // R3
    }

    return stickerMesh.userData.faceletId;
  }

  // Vista predeterminada centrada
  resetCamera() {
    this.camera.position.set(4.2, 3.8, 5.2);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  animate() {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
