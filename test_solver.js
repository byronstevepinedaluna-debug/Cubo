// test_solver.js - Verificación automatizada del solucionador 2x2

import { SOLVED_FACELET_COLORS, MOVES, applyPerm } from './src/cubeModel.js';
import { solveFromColors, generateScramble } from './src/cubeSolver.js';
import { processCubeColors, validateColorCounts } from './src/colorValidator.js';

console.log("=== INICIANDO PRUEBAS DEL SOLUCIONADOR 2x2 ===");

// Prueba 1: Estado resuelto
console.log("\n[Prueba 1] Cubo ya resuelto:");
const solvedRes = solveFromColors(SOLVED_FACELET_COLORS);
console.log("Resuelto con éxito:", solvedRes.success);
console.log("Pasos necesarios:", solvedRes.moves.length);
if (!solvedRes.success || solvedRes.moves.length !== 0) {
  console.error("FALLÓ Prueba 1");
  process.exit(1);
}

// Prueba 2: Movimiento simple U
console.log("\n[Prueba 2] Movimiento simple U:");
const uScrambled = applyPerm(SOLVED_FACELET_COLORS, MOVES["U"]);
const uRes = solveFromColors(uScrambled);
console.log("Movimiento aplicado: U");
console.log("Solución encontrada:", uRes.moves.join(" "));
if (uRes.moves.join(" ") !== "U'") {
  console.error("FALLÓ Prueba 2: esperaba U', obtuve", uRes.moves.join(" "));
  process.exit(1);
}

// Prueba 3: Detección de errores en conteo de colores
console.log("\n[Prueba 3] Validación de colores inválidos:");
const badColors = [...SOLVED_FACELET_COLORS];
badColors[0] = 'red'; // Ahora hay 5 rojos y 3 blancos
const countRes = validateColorCounts(badColors);
console.log("Detectó error correctamente:", !countRes.valid);
console.log("Mensaje de error:", countRes.error);
if (countRes.valid) {
  console.error("FALLÓ Prueba 3: Debería haber fallado el conteo");
  process.exit(1);
}

// Prueba 4: Detección de esquina con colores opuestos
console.log("\n[Prueba 4] Detección de esquina físicamente imposible (blanco y amarillo):");
const impossibleColors = [...SOLVED_FACELET_COLORS];
// Esquina UFL tiene facetas 2, 5, 8 (blanco, naranja, verde)
// Si cambiamos verde (8) por amarillo, UFL tiene blanco y amarillo juntos
// Para mantener el conteo, cambiamos una faceta amarilla (20) por verde
impossibleColors[8] = 'yellow';
impossibleColors[20] = 'green';
const impRes = processCubeColors(impossibleColors);
console.log("Detectó esquina imposible:", !impRes.valid);
console.log("Mensaje de error:", impRes.error);
if (impRes.valid) {
  console.error("FALLÓ Prueba 4");
  process.exit(1);
}

// Prueba 5: Múltiples scrambles aleatorios de longitud 1 a 11
console.log("\n[Prueba 5] 20 scrambles aleatorios:");
for (let i = 1; i <= 20; i++) {
  const scrambleMoves = generateScramble(Math.floor(Math.random() * 8) + 3);
  let curColors = [...SOLVED_FACELET_COLORS];
  for (const m of scrambleMoves) {
    curColors = applyPerm(curColors, MOVES[m]);
  }

  const sol = solveFromColors(curColors);
  if (!sol.success) {
    console.error(`FALLÓ Scramble ${i}:`, sol.error);
    process.exit(1);
  }

  // Aplicar la solución y verificar que quede resuelto
  let verifyColors = [...curColors];
  for (const m of sol.moves) {
    verifyColors = applyPerm(verifyColors, MOVES[m]);
  }

  const isSolved = verifyColors.every((c, idx) => c === SOLVED_FACELET_COLORS[idx]);
  console.log(`Scramble ${i} (${scrambleMoves.length} giros: ${scrambleMoves.join(' ')}) -> Solución (${sol.moves.length} giros: ${sol.moves.join(' ')}) -> Éxito: ${isSolved}`);
  if (!isSolved) {
    console.error(`FALLÓ verificación de scramble ${i}`);
    process.exit(1);
  }
}

console.log("\n=== TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE ===");
