// colorValidator.js - Validación del cubo y conversión de colores a estado

import { CORNERS, COLOR_MAP, ALL_ROTATIONS, applyPerm } from './cubeModel.js';

const OPPOSITE_COLORS = {
  white: 'yellow',
  yellow: 'white',
  green: 'blue',
  blue: 'green',
  orange: 'red',
  red: 'orange'
};

const REQUIRED_COUNT = 4;
const VALID_COLOR_KEYS = Object.keys(COLOR_MAP);

export function validateColorCounts(faceletColors) {
  const counts = {
    white: 0, orange: 0, green: 0, red: 0, blue: 0, yellow: 0
  };

  let unpainted = 0;
  for (let i = 0; i < 24; i++) {
    const col = faceletColors[i];
    if (!col || !counts.hasOwnProperty(col)) {
      unpainted++;
    } else {
      counts[col]++;
    }
  }

  if (unpainted > 0) {
    return {
      valid: false,
      error: `Hay ${unpainted} facetas sin pintar. Pinta las 24 facetas del cubo.`,
      counts
    };
  }

  const errors = [];
  for (const col of VALID_COLOR_KEYS) {
    const diff = counts[col] - REQUIRED_COUNT;
    const name = COLOR_MAP[col].name;
    if (diff < 0) {
      errors.push(`Faltan ${Math.abs(diff)} de color ${name}`);
    } else if (diff > 0) {
      errors.push(`Sobran ${diff} de color ${name}`);
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      error: errors.join(', ') + '. Cada color debe tener exactamente 4 facetas.',
      counts
    };
  }

  return { valid: true, counts };
}

// Convertir 24 colores válidos al estado de permutación del solver
export function processCubeColors(rawFaceletColors) {
  // 1. Validar conteo
  const countCheck = validateColorCounts(rawFaceletColors);
  if (!countCheck.valid) {
    return countCheck;
  }

  // 2. Verificar que cada esquina tenga 3 colores válidos sin colores opuestos
  for (const corner of CORNERS) {
    const colors = corner.faceletIds.map(id => rawFaceletColors[id]);
    const uniqueColors = new Set(colors);
    if (uniqueColors.size < 3) {
      return {
        valid: false,
        error: `La esquina ${corner.name} tiene colores repetidos.`
      };
    }
    // Verificar opuestos
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        if (OPPOSITE_COLORS[colors[i]] === colors[j]) {
          return {
            valid: false,
            error: `La esquina ${corner.name} contiene colores opuestos (${COLOR_MAP[colors[i]].name} y ${COLOR_MAP[colors[j]].name}), lo cual es físicamente imposible.`
          };
        }
      }
    }
  }

  // 3. Probar las 24 rotaciones del cubo completo para normalizar la referencia DBL (amarillo-naranja-azul)
  // En la esquina DBL estándar (id 7):
  // faceletId 22 (D) = 'yellow'
  // faceletId 6 (L) = 'orange'
  // faceletId 19 (B) = 'blue'
  let bestRotation = null;
  let normalizedColors = null;

  for (let rIdx = 0; rIdx < ALL_ROTATIONS.length; rIdx++) {
    const rot = ALL_ROTATIONS[rIdx];
    const rotated = applyPerm(rawFaceletColors, rot);
    if (rotated[22] === 'yellow' && rotated[6] === 'orange' && rotated[19] === 'blue') {
      bestRotation = rIdx;
      normalizedColors = rotated;
      break;
    }
  }

  if (!normalizedColors) {
    return {
      valid: false,
      error: "No se encontró una pieza de esquina válida con Amarillo, Naranja y Azul para fijar la orientación del cubo."
    };
  }

  // 4. Mapear las 8 esquinas a sus piezas originales y calcular el estado
  const state = new Array(24);
  const foundPieces = new Set();
  let totalTwist = 0;

  for (const c of CORNERS) {
    const curColors = c.faceletIds.map(id => normalizedColors[id]);
    const piece = CORNERS.find(p => {
      const setP = new Set(p.colors);
      return curColors.every(col => setP.has(col));
    });

    if (!piece) {
      return {
        valid: false,
        error: `La combinación de colores en la posición ${c.name} (${curColors.map(k => COLOR_MAP[k].name).join('-')}) no corresponde a ninguna esquina real.`
      };
    }

    if (foundPieces.has(piece.id)) {
      return {
        valid: false,
        error: `Hay esquinas duplicadas con los mismos 3 colores (${piece.colors.map(k => COLOR_MAP[k].name).join('-')}).`
      };
    }
    foundPieces.add(piece.id);

    // Mapear cada faceta a su ID resuelto original
    for (let j = 0; j < 3; j++) {
      const col = curColors[j];
      const origIdx = piece.colors.indexOf(col);
      state[c.faceletIds[j]] = piece.faceletIds[origIdx];
    }

    // Calcular orientación/giro respecto a cara U o D (blanco o amarillo)
    // El primer color de c.colors es siempre U o D ('white' o 'yellow')
    const uOrDColor = piece.colors[0];
    const uOrDIndex = curColors.indexOf(uOrDColor);
    // uOrDIndex: 0 si está en cara U/D, 1 o 2 si está girada
    totalTwist += uOrDIndex;
  }

  // 5. Validar suma de giros modulo 3
  if (totalTwist % 3 !== 0) {
    return {
      valid: false,
      error: "El cubo tiene una o más esquinas giradas sobre sí mismas (suma de orientación inválida). Necesita ser desmontado o recolocado físicamente para tener solución."
    };
  }

  return {
    valid: true,
    state,
    normalizedColors,
    rotationIndex: bestRotation
  };
}
