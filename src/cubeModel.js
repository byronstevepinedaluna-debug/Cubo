// cubeModel.js - Definiciones matemáticas y operaciones del cubo 2x2

export const FACE_NAMES = ['U', 'L', 'F', 'R', 'B', 'D'];

export const COLOR_MAP = {
  white:  { name: 'Blanco',   hex: '#FFFFFF', face: 'U' },
  orange: { name: 'Naranja',  hex: '#FF5800', face: 'L' },
  green:  { name: 'Verde',    hex: '#009B48', face: 'F' },
  red:    { name: 'Rojo',     hex: '#B71234', face: 'R' },
  blue:   { name: 'Azul',     hex: '#0045AD', face: 'B' },
  yellow: { name: 'Amarillo', hex: '#FFD500', face: 'D' }
};

// 24 facetas en estado resuelto estándar
export const SOLVED_FACELET_COLORS = [
  'white',  'white',  'white',  'white',   // U: 0..3
  'orange', 'orange', 'orange', 'orange',  // L: 4..7
  'green',  'green',  'green',  'green',   // F: 8..11
  'red',    'red',    'red',    'red',     // R: 12..15
  'blue',   'blue',   'blue',   'blue',    // B: 16..19
  'yellow', 'yellow', 'yellow', 'yellow'   // D: 20..23
];

// Las 8 esquinas con sus 3 facetas y colores resueltos
export const CORNERS = [
  { id: 0, name: 'UFL', faces: ['U', 'L', 'F'], faceletIds: [2, 5, 8],   colors: ['white', 'orange', 'green'] },
  { id: 1, name: 'UFR', faces: ['U', 'F', 'R'], faceletIds: [3, 9, 12],  colors: ['white', 'green', 'red'] },
  { id: 2, name: 'UBR', faces: ['U', 'R', 'B'], faceletIds: [1, 13, 16], colors: ['white', 'red', 'blue'] },
  { id: 3, name: 'UBL', faces: ['U', 'B', 'L'], faceletIds: [0, 17, 4],  colors: ['white', 'blue', 'orange'] },
  { id: 4, name: 'DFL', faces: ['D', 'F', 'L'], faceletIds: [20, 10, 7], colors: ['yellow', 'green', 'orange'] },
  { id: 5, name: 'DFR', faces: ['D', 'R', 'F'], faceletIds: [21, 14, 11],colors: ['yellow', 'red', 'green'] },
  { id: 6, name: 'DBR', faces: ['D', 'B', 'R'], faceletIds: [23, 18, 15],colors: ['yellow', 'blue', 'red'] },
  { id: 7, name: 'DBL', faces: ['D', 'L', 'B'], faceletIds: [22, 6, 19],  colors: ['yellow', 'orange', 'blue'] }, // Referencia fija
];

export function compose(p1, p2) {
  const res = new Array(24);
  for (let i = 0; i < 24; i++) res[i] = p2[p1[i]];
  return res;
}

export function power(p, n) {
  let curr = p;
  for (let i = 1; i < n; i++) curr = compose(curr, p);
  return curr;
}

export function applyPerm(arr, perm) {
  const next = new Array(24);
  for (let i = 0; i < 24; i++) next[i] = arr[perm[i]];
  return next;
}

export function stateToKey(s) {
  return String.fromCharCode(...s);
}

// Permutaciones canónicas físicas de giros de capa de 90° horario
const U_PERM = [2, 0, 3, 1, 8, 9, 6, 7, 12, 13, 10, 11, 16, 17, 14, 15, 4, 5, 18, 19, 20, 21, 22, 23];
const D_PERM = [0, 1, 2, 3, 4, 5, 18, 19, 8, 9, 6, 7, 12, 13, 10, 11, 16, 17, 14, 15, 22, 20, 23, 21];
const L_PERM = [19, 1, 17, 3, 6, 4, 7, 5, 0, 9, 2, 11, 12, 13, 14, 15, 16, 22, 18, 20, 8, 21, 10, 23];
const R_PERM = [0, 9, 2, 11, 4, 5, 6, 7, 8, 21, 10, 23, 14, 12, 15, 13, 3, 17, 1, 19, 20, 18, 22, 16];
const F_PERM = [0, 1, 7, 5, 4, 20, 6, 21, 10, 8, 11, 9, 2, 13, 3, 15, 16, 17, 18, 19, 14, 12, 22, 23];
const B_PERM = [13, 15, 2, 3, 1, 5, 0, 7, 8, 9, 10, 11, 12, 23, 14, 22, 18, 16, 19, 17, 20, 21, 4, 6];

export const MOVES = {
  "U":  U_PERM,
  "U2": power(U_PERM, 2),
  "U'": power(U_PERM, 3),
  "D":  D_PERM,
  "D2": power(D_PERM, 2),
  "D'": power(D_PERM, 3),
  "L":  L_PERM,
  "L2": power(L_PERM, 2),
  "L'": power(L_PERM, 3),
  "R":  R_PERM,
  "R2": power(R_PERM, 2),
  "R'": power(R_PERM, 3),
  "F":  F_PERM,
  "F2": power(F_PERM, 2),
  "F'": power(F_PERM, 3),
  "B":  B_PERM,
  "B2": power(B_PERM, 2),
  "B'": power(B_PERM, 3),
};

export const INVERSE_MOVES = {
  "U": "U'", "U'": "U", "U2": "U2",
  "D": "D'", "D'": "D", "D2": "D2",
  "L": "L'", "L'": "L", "L2": "L2",
  "R": "R'", "R'": "R", "R2": "R2",
  "F": "F'", "F'": "F", "F2": "F2",
  "B": "B'", "B'": "B", "B2": "B2"
};

export const MOVE_DESCRIPTIONS = {
  "U":  "Girar cara Superior (blanca) 90° en sentido horario",
  "U'": "Girar cara Superior 90° en sentido antihorario",
  "U2": "Girar cara Superior 180°",
  "D":  "Girar cara Inferior (amarilla) 90° en sentido horario",
  "D'": "Girar cara Inferior 90° en sentido antihorario",
  "D2": "Girar cara Inferior 180°",
  "L":  "Girar cara Izquierda (naranja) 90° en sentido horario",
  "L'": "Girar cara Izquierda 90° en sentido antihorario",
  "L2": "Girar cara Izquierda 180°",
  "R":  "Girar cara Derecha (roja) 90° en sentido horario",
  "R'": "Girar cara Derecha 90° en sentido antihorario",
  "R2": "Girar cara Derecha 180°",
  "F":  "Girar cara Frontal (verde) 90° en sentido horario",
  "F'": "Girar cara Frontal 90° en sentido antihorario",
  "F2": "Girar cara Frontal 180°",
  "B":  "Girar cara Posterior (azul) 90° en sentido horario",
  "B'": "Girar cara Posterior 90° en sentido antihorario",
  "B2": "Girar cara Posterior 180°",
};

// Geometría canónica de facetas en 3D
const FACELET_GEOMETRY = [
  // U
  { pos: [-1,  1.2, -1], norm: [0, 1, 0] },
  { pos: [ 1,  1.2, -1], norm: [0, 1, 0] },
  { pos: [-1,  1.2,  1], norm: [0, 1, 0] },
  { pos: [ 1,  1.2,  1], norm: [0, 1, 0] },
  // L
  { pos: [-1.2,  1, -1], norm: [-1, 0, 0] },
  { pos: [-1.2,  1,  1], norm: [-1, 0, 0] },
  { pos: [-1.2, -1, -1], norm: [-1, 0, 0] },
  { pos: [-1.2, -1,  1], norm: [-1, 0, 0] },
  // F
  { pos: [-1,  1,  1.2], norm: [0, 0, 1] },
  { pos: [ 1,  1,  1.2], norm: [0, 0, 1] },
  { pos: [-1, -1,  1.2], norm: [0, 0, 1] },
  { pos: [ 1, -1,  1.2], norm: [0, 0, 1] },
  // R
  { pos: [ 1.2,  1,  1], norm: [1, 0, 0] },
  { pos: [ 1.2,  1, -1], norm: [1, 0, 0] },
  { pos: [ 1.2, -1,  1], norm: [1, 0, 0] },
  { pos: [ 1.2, -1, -1], norm: [1, 0, 0] },
  // B
  { pos: [ 1,  1, -1.2], norm: [0, 0, -1] },
  { pos: [-1,  1, -1.2], norm: [0, 0, -1] },
  { pos: [ 1, -1, -1.2], norm: [0, 0, -1] },
  { pos: [-1, -1, -1.2], norm: [0, 0, -1] },
  // D
  { pos: [-1, -1.2,  1], norm: [0, -1, 0] },
  { pos: [ 1, -1.2,  1], norm: [0, -1, 0] },
  { pos: [-1, -1.2, -1], norm: [0, -1, 0] },
  { pos: [ 1, -1.2, -1], norm: [0, -1, 0] },
];

function rotateClockwise(vec, axis) {
  const [x, y, z] = vec;
  if (axis === 'Y') return [-z, y, x];
  if (axis === 'X') return [x, z, -y];
  if (axis === 'Z') return [y, -x, z];
}

function getWholeRotation(axis) {
  const perm = new Array(24);
  for (let i = 0; i < 24; i++) {
    const f = FACELET_GEOMETRY[i];
    const rotPos = rotateClockwise(f.pos, axis);
    const rotNorm = rotateClockwise(f.norm, axis);
    const matchIdx = FACELET_GEOMETRY.findIndex(target => 
      Math.hypot(target.pos[0] - rotPos[0], target.pos[1] - rotPos[1], target.pos[2] - rotPos[2]) < 0.1 &&
      Math.hypot(target.norm[0] - rotNorm[0], target.norm[1] - rotNorm[1], target.norm[2] - rotNorm[2]) < 0.1
    );
    perm[matchIdx] = i;
  }
  return perm;
}

function computeAllRotations() {
  const rotX = getWholeRotation('X');
  const rotY = getWholeRotation('Y');
  const rotZ = getWholeRotation('Z');

  const rotations = [];
  const visited = new Set();
  const id = Array.from({length: 24}, (_, i) => i);
  rotations.push(id);
  visited.add(stateToKey(id));
  const q = [id];
  let h = 0;
  while(h < q.length) {
    const cur = q[h++];
    for (const r of [rotX, rotY, rotZ]) {
      const nxt = compose(cur, r);
      const k = stateToKey(nxt);
      if (!visited.has(k)) {
        visited.add(k);
        rotations.push(nxt);
        q.push(nxt);
      }
    }
  }
  return rotations;
}

export const ALL_ROTATIONS = computeAllRotations();
