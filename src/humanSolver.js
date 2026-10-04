// humanSolver.js - Algoritmo humano didáctico para Cubo de Rubik 2x2 (Método LBL / Principiante Oficial)
// Enseña qué algoritmo usar, cuándo usarlo y cómo reconocer cada caso.

import {
  MOVES,
  INVERSE_MOVES,
  MOVE_DESCRIPTIONS,
  applyPerm,
  ALL_ROTATIONS
} from './cubeModel.js';

// Nombres y explicaciones gráficas de movimientos
export const MOVE_ACTION_INFO = {
  "R":  { arrow: "⬆️", action: "Sube Derecha", detail: "Gira la columna derecha hacia arriba" },
  "R'": { arrow: "⬇️", action: "Baja Derecha", detail: "Gira la columna derecha hacia abajo" },
  "R2": { arrow: "🔄", action: "Doble Derecha", detail: "Gira la columna derecha 180°" },
  "L":  { arrow: "⬇️", action: "Baja Izquierda", detail: "Gira la columna izquierda hacia abajo" },
  "L'": { arrow: "⬆️", action: "Sube Izquierda", detail: "Gira la columna izquierda hacia arriba" },
  "L2": { arrow: "🔄", action: "Doble Izquierda", detail: "Gira la columna izquierda 180°" },
  "U":  { arrow: "⬅️", action: "Arriba Izq", detail: "Capa superior en sentido horario" },
  "U'": { arrow: "➡️", action: "Arriba Der", detail: "Capa superior en sentido antihorario" },
  "U2": { arrow: "🔄", action: "Doble Arriba", detail: "Capa superior 180°" },
  "D":  { arrow: "➡️", action: "Base Der", detail: "Capa inferior hacia la derecha" },
  "D'": { arrow: "⬅️", action: "Base Izq", detail: "Capa inferior hacia la izquierda" },
  "D2": { arrow: "🔄", action: "Doble Base", detail: "Capa inferior 180°" },
  "F":  { arrow: "↷", action: "Frente Horario", detail: "Gira la cara frontal hacia la derecha" },
  "F'": { arrow: "↶", action: "Frente Antihorario", detail: "Gira la cara frontal hacia la izquierda" },
  "F2": { arrow: "🔄", action: "Doble Frente", detail: "Gira la cara frontal 180°" },
  "B":  { arrow: "↶", action: "Atrás Horario", detail: "Gira la cara trasera" },
  "B'": { arrow: "↷", action: "Atrás Antihorario", detail: "Gira la cara trasera al revés" },
  "B2": { arrow: "🔄", action: "Doble Atrás", detail: "Gira la cara trasera 180°" },
};

// Algoritmos humanos estándar
export const ALGORITHMS = {
  SUNE: {
    name: "SUNE (El Algoritmo Universal de Orientación)",
    moves: ["R", "U", "R'", "U", "R", "U2", "R'"],
    whenToUse: "Se usa siempre que la base blanca esté resuelta y quieras voltear las pegatinas amarillas hacia arriba. Si tienes 1 esquina amarilla arriba (Pez), ponla en la esquina frontal-izquierda y aplica SUNE. Si tienes 0 o 2, pon una faceta amarilla lateral a la izquierda y aplícalo para llegar a 1 esquina."
  },
  ANTI_SUNE: {
    name: "ANTI-SUNE (Variante Simétrica del Pez)",
    moves: ["R", "U2", "R'", "U'", "R", "U'", "R'"],
    whenToUse: "Úsalo cuando tengas 1 esquina amarilla arriba, pero el amarillo de la esquina vecina mire a la derecha en lugar de al frente."
  },
  OLL_H: {
    name: "OLL Doble Faro (H)",
    moves: ["R2", "U2", "R", "U2", "R2"],
    whenToUse: "Úsalo cuando no tengas ninguna esquina amarilla arriba (0 amarillos) y veas 2 faros al frente y 2 faros atrás."
  },
  OLL_PI: {
    name: "OLL Pi (Faros + Opuestos)",
    moves: ["F", "R", "U", "R'", "U'", "R", "U", "R'", "U'", "F'"],
    whenToUse: "Úsalo cuando tengas 0 amarillos arriba: un par de faros a la izquierda y dos amarillos opuestos a la derecha. (¡Es F + Sexy Move 2 veces + F'!)"
  },
  OLL_T: {
    name: "OLL T (Camaleón)",
    moves: ["R", "U", "R'", "U'", "R'", "F", "R", "F'"],
    whenToUse: "Úsalo cuando tengas 2 esquinas amarillas arriba juntas, y los otros 2 amarillos miren hacia afuera a los lados. (¡Sexy Move + Sledgehammer!)"
  },
  OLL_U: {
    name: "OLL U (Faros al Frente)",
    moves: ["F", "R", "U", "R'", "U'", "F'"],
    whenToUse: "Úsalo cuando tengas 2 esquinas amarillas arriba atrás, y 2 esquinas amarillas al frente como faros de auto. (¡F + Sexy Move + F'!)"
  },
  OLL_L: {
    name: "OLL L (Corbatín)",
    moves: ["F", "R'", "F'", "R", "U", "R", "U'", "R'"],
    whenToUse: "Úsalo cuando tengas 2 esquinas amarillas en diagonal arriba."
  },
  A_PERM: {
    name: "Algoritmo de la Barra (A-Perm / Permutación de Esquinas)",
    moves: ["R'", "F", "R'", "B2", "R", "F'", "R'", "B2", "R2"],
    whenToUse: "El algoritmo rey del 2x2. Úsalo cuando veas 2 esquinas con el mismo color juntas en un lateral (una barra). Pon esa barra mirando hacia ATRÁS (cara B) y aplica este algoritmo. ¡Intercambia las dos esquinas del frente sin romper el resto!"
  },
  Y_PERM: {
    name: "Algoritmo Diagonal (Y-Perm)",
    moves: ["F", "R", "U'", "R'", "U'", "R", "U", "R'", "F'", "R", "U", "R'", "U'", "R'", "F", "R", "F'"],
    whenToUse: "Úsalo cuando ninguna cara tenga dos colores iguales (esquinas cruzadas en diagonal). Puedes sostener el cubo desde cualquier lado y aplicarlo para resolver las esquinas."
  }
};

// Comprueba si la capa inferior (blanca) está resuelta con su corona lateral
export function isWhiteLayerSolved(colors) {
  if (colors[20] !== 'white' || colors[21] !== 'white' || colors[22] !== 'white' || colors[23] !== 'white') return false;
  if (colors[10] !== colors[11]) return false; // Frente
  if (colors[14] !== colors[15]) return false; // Derecha
  if (colors[18] !== colors[19]) return false; // Atrás
  if (colors[6] !== colors[7]) return false;   // Izquierda
  return true;
}

// Comprueba si la cara superior (U) está toda orientada en amarillo
export function isOLLSolved(colors) {
  return colors[0] === 'yellow' && colors[1] === 'yellow' && colors[2] === 'yellow' && colors[3] === 'yellow';
}

// Comprueba si el cubo está 100% resuelto con D=blanco y U=amarillo
export function isCubeFullySolved(colors) {
  if (!isWhiteLayerSolved(colors) || !isOLLSolved(colors)) return false;
  // Comprobar que los laterales superiores coincidan con los inferiores
  if (colors[8] !== colors[10]) return false;
  if (colors[12] !== colors[14]) return false;
  if (colors[16] !== colors[18]) return false;
  if (colors[4] !== colors[6]) return false;
  return true;
}

// Analiza las barras de color en la capa superior (para PLL)
export function analyzePLLBars(colors) {
  const sides = [
    { face: 'F', name: 'Frontal (Verde)', pair: [colors[8], colors[9]], isBar: colors[8] === colors[9] },
    { face: 'R', name: 'Derecha (Rojo)', pair: [colors[12], colors[13]], isBar: colors[12] === colors[13] },
    { face: 'B', name: 'Trasera (Azul)', pair: [colors[16], colors[17]], isBar: colors[16] === colors[17] },
    { face: 'L', name: 'Izquierda (Naranja)', pair: [colors[4], colors[5]], isBar: colors[4] === colors[5] }
  ];
  const bars = sides.filter(s => s.isBar);
  return { sides, bars, barCount: bars.length };
}

// Resuelve la capa blanca mediante búsqueda BFS guiada por movimientos estándar
export function solveWhiteLayer(startColors) {
  if (isWhiteLayerSolved(startColors)) return [];

  const movesList = ["U", "U2", "U'", "R", "R2", "R'", "F", "F2", "F'"];
  const visited = new Set();
  const queue = [{ colors: startColors, moves: [] }];

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    if (curr.moves.length >= 6) continue;

    for (const m of movesList) {
      if (curr.moves.length > 0 && curr.moves[curr.moves.length - 1][0] === m[0]) continue;
      const nextColors = applyPerm(curr.colors, MOVES[m]);
      if (isWhiteLayerSolved(nextColors)) {
        return [...curr.moves, m];
      }
      const key = nextColors.join('');
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ colors: nextColors, moves: [...curr.moves, m] });
      }
    }
  }

  // Fallback con movimientos completos
  return [];
}

// Identifica el caso de OLL y devuelve el algoritmo óptimo humano
export function solveOLL(startColors) {
  if (isOLLSolved(startColors)) {
    return {
      caseName: "Cara Amarilla Ya Orientada",
      badge: "Completado",
      setupMoves: [],
      algMoves: [],
      allMoves: [],
      recognition: "¡Las 4 esquinas de la cara superior ya tienen el color amarillo mirando hacia arriba!",
      whenToUse: "No necesitas aplicar ningún algoritmo en este paso. Pasa directamente a la permutación (PLL).",
      howToHold: "Mantén el cubo con la cara blanca abajo y la cara amarilla arriba."
    };
  }

  // Probar alineaciones U / U' / U2 y coincidencias con los 7 casos OLL
  const uRotations = ["", "U", "U'", "U2"];
  const ollCandidates = [
    { id: "Sune", alg: ALGORITHMS.SUNE.moves, name: "SUNE (Pez)", desc: "1 esquina amarilla arriba. El pez mira hacia la izquierda." },
    { id: "AntiSune", alg: ALGORITHMS.ANTI_SUNE.moves, name: "ANTI-SUNE (Pez Invertido)", desc: "1 esquina amarilla arriba. Variante simétrica de Sune." },
    { id: "U", alg: ALGORITHMS.OLL_U.moves, name: "Caso U (Faros al Frente)", desc: "2 amarillos arriba atrás y 2 faros amarillos mirando al frente." },
    { id: "T", alg: ALGORITHMS.OLL_T.moves, name: "Caso T (Camaleón)", desc: "2 amarillos arriba juntos y 2 laterales mirando a los lados." },
    { id: "L", alg: ALGORITHMS.OLL_L.moves, name: "Caso L (Corbatín)", desc: "2 amarillos arriba en diagonal." },
    { id: "H", alg: ALGORITHMS.OLL_H.moves, name: "Caso H (Faros Dobles)", desc: "0 amarillos arriba: 2 faros al frente y 2 faros atrás." },
    { id: "Pi", alg: ALGORITHMS.OLL_PI.moves, name: "Caso Pi (Faros Laterales)", desc: "0 amarillos arriba: 2 faros a la izquierda y 2 opuestos." }
  ];

  for (const uMove of uRotations) {
    let testColors = [...startColors];
    if (uMove) testColors = applyPerm(testColors, MOVES[uMove]);

    for (const cand of ollCandidates) {
      let c = [...testColors];
      for (const m of cand.alg) c = applyPerm(c, MOVES[m]);

      if (isOLLSolved(c)) {
        const setup = uMove ? [uMove] : [];
        const fullMoves = [...setup, ...cand.alg];
        const algMeta = ALGORITHMS[cand.id] || ALGORITHMS.SUNE;

        return {
          caseName: cand.name,
          badge: cand.id === "Sune" ? "Más Popular" : "Algoritmo Estándar",
          setupMoves: setup,
          algMoves: cand.alg,
          allMoves: fullMoves,
          recognition: cand.desc,
          whenToUse: algMeta.whenToUse,
          howToHold: setup.length > 0 
            ? `Primero gira la capa superior con ${setup[0]} para alinear el caso. Luego mantén la base blanca abajo.` 
            : "Mantén la base blanca abajo y la cara amarilla arriba como indica la ilustración."
        };
      }
    }
  }

  // Si requiere dos aplicaciones de SUNE (enfoque universal para principiantes)
  return {
    caseName: "Método Universal SUNE",
    badge: "1 Solo Algoritmo",
    setupMoves: [],
    algMoves: ALGORITHMS.SUNE.moves,
    allMoves: ALGORITHMS.SUNE.moves,
    recognition: "Aplica SUNE una vez para reducir a 1 esquina amarilla (el Pez), y luego aplícalo de nuevo.",
    whenToUse: ALGORITHMS.SUNE.whenToUse,
    howToHold: "Coloca cualquier esquina con faceta amarilla a la izquierda y ejecuta SUNE."
  };
}

// Resuelve la permutación PLL (colocar esquinas en su lugar y alineación final)
export function solvePLL(startColors) {
  const pllInfo = analyzePLLBars(startColors);

  // Caso 1: Todas las barras resueltas (solo falta AUF)
  if (pllInfo.barCount === 4) {
    for (const auf of ["", "U", "U'", "U2"]) {
      let testC = [...startColors];
      if (auf) testC = applyPerm(testC, MOVES[auf]);
      if (isCubeFullySolved(testC)) {
        return {
          caseName: "Capa Superior Orientada y Permutada",
          badge: "¡Casi Resuelto!",
          setupMoves: [],
          algMoves: auf ? [auf] : [],
          allMoves: auf ? [auf] : [],
          recognition: "¡Todas las esquinas ya están emparejadas!",
          whenToUse: "Solo necesitas alinear la capa superior (AUF) con la capa base.",
          howToHold: "Gira la capa superior hasta hacer coincidir todos los colores."
        };
      }
    }
  }

  // Caso 2: Hay al menos 1 barra (Intercambio adyacente - Algoritmo de la Barra / A-Perm)
  if (pllInfo.barCount >= 1) {
    const barFace = pllInfo.bars[0].face;
    const setupMap = { 'B': null, 'R': "U'", 'L': "U", 'F': "U2" };
    const setupMove = setupMap[barFace];
    const setupList = setupMove ? [setupMove] : [];

    let c = [...startColors];
    for (const m of setupList) c = applyPerm(c, MOVES[m]);
    for (const m of ALGORITHMS.A_PERM.moves) c = applyPerm(c, MOVES[m]);

    // Buscar AUF para terminar
    let aufMove = null;
    for (const auf of ["", "U", "U'", "U2"]) {
      let testC = [...c];
      if (auf) testC = applyPerm(testC, MOVES[auf]);
      if (isCubeFullySolved(testC)) {
        aufMove = auf;
        break;
      }
    }

    const allMoves = [...setupList, ...ALGORITHMS.A_PERM.moves, ...(aufMove ? [aufMove] : [])];

    return {
      caseName: "Caso Barra (Intercambio Adyacente)",
      badge: "Algoritmo de la Barra",
      setupMoves: setupList,
      algMoves: ALGORITHMS.A_PERM.moves,
      allMoves,
      recognition: `Tienes una barra de 2 colores iguales en la cara ${pllInfo.bars[0].name}.`,
      whenToUse: ALGORITHMS.A_PERM.whenToUse,
      howToHold: setupList.length > 0 
        ? `Gira la capa superior con ${setupList.join(' ')} para colocar la barra mirando hacia ATRÁS (cara B). Luego aplica el algoritmo.` 
        : "La barra ya está mirando hacia ATRÁS (cara B). Aplica el algoritmo directamente."
    };
  }

  // Caso 3: No hay ninguna barra (Intercambio Diagonal / Y-Perm)
  let c = [...startColors];
  for (const m of ALGORITHMS.Y_PERM.moves) c = applyPerm(c, MOVES[m]);

  let aufMove = null;
  for (const auf of ["", "U", "U'", "U2"]) {
    let testC = [...c];
    if (auf) testC = applyPerm(testC, MOVES[auf]);
    if (isCubeFullySolved(testC)) {
      aufMove = auf;
      break;
    }
  }

  const allMoves = [...ALGORITHMS.Y_PERM.moves, ...(aufMove ? [aufMove] : [])];

  return {
    caseName: "Caso Diagonal (Sin Barras)",
    badge: "Intercambio Diagonal",
    setupMoves: [],
    algMoves: ALGORITHMS.Y_PERM.moves,
    allMoves,
    recognition: "Ningún lateral tiene 2 colores iguales. Las esquinas están intercambiadas en diagonal (X).",
    whenToUse: ALGORITHMS.Y_PERM.whenToUse,
    howToHold: "Puedes sostener el cubo desde cualquier lado (con blanco abajo y amarillo arriba) y ejecutar el algoritmo."
  };
}

// Genera la resolución humana completa paso a paso dividida en las 3 etapas para el usuario
export function generateHumanSolution(rawFaceletColors) {
  let workingColors = [...rawFaceletColors];
  let bestRotIndex = -1;

  for (let i = 0; i < ALL_ROTATIONS.length; i++) {
    const rotColors = applyPerm(rawFaceletColors, ALL_ROTATIONS[i]);
    const whiteCountOnD = [20, 21, 22, 23].filter(idx => rotColors[idx] === 'white').length;
    if (whiteCountOnD >= 3) {
      bestRotIndex = i;
      workingColors = rotColors;
      break;
    }
  }

  if (bestRotIndex === -1) {
    for (let i = 0; i < ALL_ROTATIONS.length; i++) {
      const rotColors = applyPerm(rawFaceletColors, ALL_ROTATIONS[i]);
      if (rotColors[22] === 'white') {
        bestRotIndex = i;
        workingColors = rotColors;
        break;
      }
    }
  }

  if (bestRotIndex === -1) {
    bestRotIndex = 10;
    workingColors = applyPerm(rawFaceletColors, ALL_ROTATIONS[10]);
  }

  const stages = [];
  let currentColors = [...workingColors];

  // ETAPA 1: Capa Blanca (Corona Inferior)
  const whiteMoves = solveWhiteLayer(currentColors);
  let whiteEndColors = [...currentColors];
  const whiteStepColors = [whiteEndColors];
  for (const m of whiteMoves) {
    whiteEndColors = applyPerm(whiteEndColors, MOVES[m]);
    whiteStepColors.push(whiteEndColors);
  }

  stages.push({
    id: 1,
    key: "stage-white",
    title: "Etapa 1: La Corona Blanca (Primera Capa)",
    badge: "Paso Fundamental",
    objective: "Armar toda la base blanca (abajo) asegurando que los colores laterales coincidan entre sí formando una corona uniforme.",
    recognition: isWhiteLayerSolved(currentColors)
      ? "¡La capa blanca ya está completamente resuelta en la base!"
      : "Tienes piezas blancas repartidas por el cubo. El objetivo es colocarlas abajo.",
    whenToUse: "Es siempre el primer paso que realiza cualquier persona al resolver un cubo 2x2. Al colocar la cara blanca en la parte inferior, tienes libertad de girar la capa superior sin desarmarla.",
    howToHold: "Sostén el cubo de modo que la cara blanca quede abajo (D).",
    algorithmName: "Inserciones Intuitivas / Sexy Move (R U R' U')",
    moves: whiteMoves,
    moveCards: whiteMoves.map(m => ({ move: m, ...MOVE_ACTION_INFO[m] })),
    startColors: [...currentColors],
    endColors: [...whiteEndColors],
    stepColors: whiteStepColors
  });

  currentColors = [...whiteEndColors];

  // ETAPA 2: OLL (Orientar Última Capa Amarilla)
  const ollResult = solveOLL(currentColors);
  let ollEndColors = [...currentColors];
  const ollStepColors = [ollEndColors];
  for (const m of ollResult.allMoves) {
    ollEndColors = applyPerm(ollEndColors, MOVES[m]);
    ollStepColors.push(ollEndColors);
  }

  stages.push({
    id: 2,
    key: "stage-oll",
    title: "Etapa 2: Orientar la Capa Amarilla (OLL)",
    badge: ollResult.badge,
    objective: "Hacer que las 4 pegatinas amarillas miren hacia arriba, logrando una cara superior 100% amarilla.",
    recognition: ollResult.recognition,
    whenToUse: ollResult.whenToUse,
    howToHold: ollResult.howToHold,
    algorithmName: ollResult.caseName,
    moves: ollResult.allMoves,
    moveCards: ollResult.allMoves.map(m => ({ move: m, ...MOVE_ACTION_INFO[m] })),
    startColors: [...currentColors],
    endColors: [...ollEndColors],
    stepColors: ollStepColors
  });

  currentColors = [...ollEndColors];

  // ETAPA 3: PLL (Permutar Última Capa - Resolver Cubo)
  const pllResult = solvePLL(currentColors);
  let pllEndColors = [...currentColors];
  const pllStepColors = [pllEndColors];
  for (const m of pllResult.allMoves) {
    pllEndColors = applyPerm(pllEndColors, MOVES[m]);
    pllStepColors.push(pllEndColors);
  }

  stages.push({
    id: 3,
    key: "stage-pll",
    title: "Etapa 3: Permutar y Resolver (PLL)",
    badge: pllResult.badge,
    objective: "Intercambiar las esquinas de la capa superior para que los colores laterales coincidan con la base y el cubo quede completamente resuelto.",
    recognition: pllResult.recognition,
    whenToUse: pllResult.whenToUse,
    howToHold: pllResult.howToHold,
    algorithmName: pllResult.caseName,
    moves: pllResult.allMoves,
    moveCards: pllResult.allMoves.map(m => ({ move: m, ...MOVE_ACTION_INFO[m] })),
    startColors: [...currentColors],
    endColors: [...pllEndColors],
    stepColors: pllStepColors
  });

  return {
    success: true,
    rotationIndex: bestRotIndex,
    stages,
    totalMoves: whiteMoves.length + ollResult.allMoves.length + pllResult.allMoves.length
  };
}
