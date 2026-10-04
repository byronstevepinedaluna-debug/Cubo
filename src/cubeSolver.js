// cubeSolver.js - Algoritmo óptimo Bidirectional BFS para Cubo de Rubik 2x2

import {
  MOVES,
  INVERSE_MOVES,
  MOVE_DESCRIPTIONS,
  applyPerm,
  stateToKey,
  ALL_ROTATIONS
} from './cubeModel.js';
import { processCubeColors } from './colorValidator.js';

const SOLVED_STATE = Array.from({ length: 24 }, (_, i) => i);
// El espacio de búsqueda óptimo con DBL fijo se genera mediante los 9 movimientos de U, R y F
const SOLVER_MOVE_NAMES = ["U", "U2", "U'", "R", "R2", "R'", "F", "F2", "F'"];

// Tabla inversa precalculada (hasta profundidad 6)
// Contiene exactamente 62,360 estados y se calcula en ~30ms al iniciar.
let backwardMap = null;

export function initSolver() {
  if (backwardMap) return;

  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  backwardMap = new Map();

  const solvedKey = stateToKey(SOLVED_STATE);
  backwardMap.set(solvedKey, {
    moveFromHereToCurr: null,
    parentKey: null,
    depth: 0
  });

  const queue = [{
    state: SOLVED_STATE,
    key: solvedKey,
    depth: 0,
    lastFace: ''
  }];

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    if (curr.depth >= 6) continue;

    for (const m of SOLVER_MOVE_NAMES) {
      // Evitar movimientos consecutivos sobre la misma cara (e.g. U tras U')
      if (m[0] === curr.lastFace) continue;

      const nextState = applyPerm(curr.state, MOVES[m]);
      const nextKey = stateToKey(nextState);

      if (!backwardMap.has(nextKey)) {
        backwardMap.set(nextKey, {
          moveFromHereToCurr: INVERSE_MOVES[m],
          parentKey: curr.key,
          depth: curr.depth + 1
        });
        queue.push({
          state: nextState,
          key: nextKey,
          depth: curr.depth + 1,
          lastFace: m[0]
        });
      }
    }
  }

  const t1 = (typeof performance !== 'undefined' ? performance : Date).now();
  console.log(`[Solver 2x2] Tabla inversa calculada: ${backwardMap.size} estados en ${(t1 - t0).toFixed(1)}ms`);
}

// Resuelve un estado de 24 facetas retornando la lista óptima de movimientos
export function solveCube(state) {
  initSolver();

  const startKey = stateToKey(state);
  if (startKey === stateToKey(SOLVED_STATE)) {
    return [];
  }

  // Comprobar si ya está en la tabla inversa
  if (backwardMap.has(startKey)) {
    let bKey = startKey;
    const bPath = [];
    while (true) {
      const node = backwardMap.get(bKey);
      if (!node.moveFromHereToCurr) break;
      bPath.push(node.moveFromHereToCurr);
      bKey = node.parentKey;
    }
    return bPath;
  }

  // Búsqueda hacia adelante en amplitud (Forward BFS) hasta profundidad 5
  const fwdQueue = [{
    state: state,
    path: [],
    lastFace: ''
  }];
  let fwdHead = 0;

  while (fwdHead < fwdQueue.length) {
    const curr = fwdQueue[fwdHead++];
    const key = stateToKey(curr.state);

    if (backwardMap.has(key)) {
      let bKey = key;
      const bPath = [];
      while (true) {
        const node = backwardMap.get(bKey);
        if (!node.moveFromHereToCurr) break;
        bPath.push(node.moveFromHereToCurr);
        bKey = node.parentKey;
      }
      return [...curr.path, ...bPath];
    }

    if (curr.path.length >= 5) continue;

    for (const m of SOLVER_MOVE_NAMES) {
      if (m[0] === curr.lastFace) continue;

      const nextState = applyPerm(curr.state, MOVES[m]);
      fwdQueue.push({
        state: nextState,
        path: [...curr.path, m],
        lastFace: m[0]
      });
    }
  }

  // Si no se encontró dentro de profundidad 11 (teóricamente imposible para 2x2 válido)
  return null;
}

// Resuelve a partir de los 24 colores ingresados por el usuario
export function solveFromColors(faceletColors) {
  const processRes = processCubeColors(faceletColors);
  if (!processRes.valid) {
    return {
      success: false,
      error: processRes.error
    };
  }

  const moves = solveCube(processRes.state);
  if (moves === null) {
    return {
      success: false,
      error: "No se pudo encontrar una solución. El estado del cubo puede ser inválido o inalcanzable físicamente."
    };
  }

  const steps = moves.map((m, idx) => ({
    stepNumber: idx + 1,
    move: m,
    description: MOVE_DESCRIPTIONS[m] || `Girar ${m}`
  }));

  return {
    success: true,
    moves,
    steps,
    totalSteps: moves.length,
    normalizedColors: processRes.normalizedColors,
    rotationIndex: processRes.rotationIndex,
    isAlreadySolved: moves.length === 0
  };
}

// Genera un scramble aleatorio válido (lista de movimientos)
export function generateScramble(length = 9) {
  const scramble = [];
  let lastFace = '';
  for (let i = 0; i < length; i++) {
    const validMoves = SOLVER_MOVE_NAMES.filter(m => m[0] !== lastFace);
    const chosen = validMoves[Math.floor(Math.random() * validMoves.length)];
    scramble.push(chosen);
    lastFace = chosen[0];
  }
  return scramble;
}
