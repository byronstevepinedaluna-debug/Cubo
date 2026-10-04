// app.js - Controlador principal de la aplicación web

import {
  COLOR_MAP,
  SOLVED_FACELET_COLORS,
  MOVES,
  INVERSE_MOVES,
  MOVE_DESCRIPTIONS,
  applyPerm,
  ALL_ROTATIONS
} from './cubeModel.js';
import { processCubeColors, validateColorCounts } from './colorValidator.js';
import { solveFromColors, generateScramble } from './cubeSolver.js';
import { Cube3D } from './cube3d.js';
import { TutorialController } from './tutorial.js';
import { deviceAuth } from './deviceAuth.js';

// Estado de la aplicación
let faceletColors = [...SOLVED_FACELET_COLORS];
let initialFaceletColors = [...SOLVED_FACELET_COLORS];
let selectedColor = 'white';
let currentSolution = [];
let currentSteps = [];
let currentStepIndex = 0;
let isAutoPlaying = false;
let autoPlayTimer = null;
let isProcessingStep = false;

// Elementos del DOM
const canvasContainer = document.getElementById('canvas-container');
const tabBtnPaint = document.getElementById('tab-btn-paint');
const tabBtnSolve = document.getElementById('tab-btn-solve');
const paintTabContent = document.getElementById('paint-tab-content');
const solveTabContent = document.getElementById('solve-tab-content');

// Botones de acciones rápidas
const btnQuickScramble = document.getElementById('btn-quick-scramble');
const btnQuickEdit = document.getElementById('btn-quick-edit');
const btnQuickSolve = document.getElementById('btn-quick-solve');
const btnQuickReset = document.getElementById('btn-quick-reset');
const btnResetCam = document.getElementById('btn-reset-cam');

// Paleta y Red 2D
const paletteButtons = document.querySelectorAll('.palette-btn');
const paletteSelectedName = document.getElementById('palette-selected-name');
const netStickers = document.querySelectorAll('.net-sticker');
const validationStatus = document.getElementById('validation-status');
const validationText = document.getElementById('validation-text');
const btnStartSolve = document.getElementById('btn-start-solve');
const btnClearColors = document.getElementById('btn-clear-colors');

// Controles de paso a paso
const stepperTrack = document.getElementById('stepper-track');
const solutionSummary = document.getElementById('solution-summary');
const solutionProgressText = document.getElementById('solution-progress-text');
const cardStepTag = document.getElementById('card-step-tag');
const cardMoveText = document.getElementById('card-move-text');
const cardDescText = document.getElementById('card-desc-text');
const cardProgressFill = document.getElementById('card-progress-fill');
const btnNextStep = document.getElementById('btn-next-step');
const btnPrevStep = document.getElementById('btn-prev-step');

const btnAutoPlay = document.getElementById('btn-autoplay');
const autoPlayIcon = document.getElementById('autoplay-icon');
const autoPlayText = document.getElementById('autoplay-text');
const btnRestartSteps = document.getElementById('btn-restart-steps');
const solvedCelebration = document.getElementById('solved-celebration');
const stepCard = document.getElementById('step-card');
const stepControlsContainer = document.getElementById('step-controls-container');
const btnScrambleAgain = document.getElementById('btn-scramble-again');
const btnEditAgain = document.getElementById('btn-edit-again');

// Pestaña de tutorial
const tabBtnTutorial = document.getElementById('tab-btn-tutorial');
const tutorialTabContent = document.getElementById('tutorial-tab-content');

// Instancias
let cube3D = null;
let tutorial = null;

// Inicialización
window.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializar escena 3D con callback para clics en pegatinas
  cube3D = new Cube3D(canvasContainer, (fid) => {
    paintFacelet(fid);
  });
  cube3D.updateColors(faceletColors);

  // 2. Inicializar controlador del tutorial interactivo (Método Oficial Humano)
  tutorial = new TutorialController(
    cube3D,
    (newColors) => {
      faceletColors = [...newColors];
      renderNet();
      updateColorCounts();
    },
    () => faceletColors
  );

  // 3. Configurar eventos de UI
  setupPaletteEvents();
  setupNetEvents();
  setupTabEvents();
  setupQuickActionEvents();
  setupStepControllerEvents();

  // 4. Renderizar vista inicial de la red 2D y validación
  renderNet();
  updateColorCounts();
  validateCurrentState();

  // 5. Inicializar sistema de autorización de red y dispositivos
  deviceAuth.init();
});

// Cambiar de pestaña
function switchTab(tabName) {
  tabBtnPaint.classList.toggle('active', tabName === 'paint');
  tabBtnSolve.classList.toggle('active', tabName === 'solve');
  if (tabBtnTutorial) tabBtnTutorial.classList.toggle('active', tabName === 'tutorial');

  paintTabContent.style.display = tabName === 'paint' ? 'block' : 'none';
  solveTabContent.style.display = tabName === 'solve' ? 'flex' : 'none';
  if (tutorialTabContent) tutorialTabContent.style.display = tabName === 'tutorial' ? 'flex' : 'none';

  if (tabName !== 'solve') {
    stopAutoPlay();
  }
}

function setupTabEvents() {
  tabBtnPaint.addEventListener('click', () => switchTab('paint'));
  tabBtnSolve.addEventListener('click', () => switchTab('solve'));
  if (tabBtnTutorial) {
    tabBtnTutorial.addEventListener('click', () => switchTab('tutorial'));
  }
}

// Configurar paleta de colores
function setupPaletteEvents() {
  paletteButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      paletteButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedColor = btn.dataset.color;
      const colName = COLOR_MAP[selectedColor].name;
      paletteSelectedName.textContent = `${colName} seleccionado`;
      paletteSelectedName.style.color = COLOR_MAP[selectedColor].hex;
    });
  });
}

// Configurar red 2D desplegada
function setupNetEvents() {
  netStickers.forEach(sticker => {
    sticker.addEventListener('click', () => {
      const fid = parseInt(sticker.dataset.fid, 10);
      paintFacelet(fid);
    });
  });

  btnClearColors.addEventListener('click', () => {
    faceletColors = new Array(24).fill(null);
    renderNet();
    cube3D.updateColors(faceletColors);
    updateColorCounts();
    validateCurrentState();
  });
}

// Pintar una faceta con el color seleccionado
function paintFacelet(fid) {
  if (fid < 0 || fid >= 24) return;
  faceletColors[fid] = selectedColor;
  renderNet();
  cube3D.updateColors(faceletColors);
  updateColorCounts();
  validateCurrentState();
}

// Renderizar la red 2D
function renderNet() {
  netStickers.forEach(sticker => {
    const fid = parseInt(sticker.dataset.fid, 10);
    const colKey = faceletColors[fid];
    if (colKey && COLOR_MAP[colKey]) {
      sticker.style.background = COLOR_MAP[colKey].hex;
    } else {
      sticker.style.background = '#252936'; // Gris oscuro si no está pintado
    }
  });
}

// Actualizar contadores de colores (4/4)
function updateColorCounts() {
  const counts = { white: 0, yellow: 0, green: 0, blue: 0, orange: 0, red: 0 };
  for (const col of faceletColors) {
    if (col && counts.hasOwnProperty(col)) {
      counts[col]++;
    }
  }

  for (const [col, count] of Object.entries(counts)) {
    const countEl = document.getElementById(`count-${col}`);
    if (countEl) {
      countEl.textContent = `${count}/4`;
      countEl.className = 'palette-count ' + (count === 4 ? 'valid' : 'invalid');
    }
  }
}

// Validar estado actual del cubo y mostrar mensaje
function validateCurrentState() {
  const countCheck = validateColorCounts(faceletColors);
  if (!countCheck.valid) {
    setValidationStatus(false, countCheck.error);
    btnStartSolve.disabled = true;
    return false;
  }

  const procRes = processCubeColors(faceletColors);
  if (!procRes.valid) {
    setValidationStatus(false, procRes.error);
    btnStartSolve.disabled = true;
    return false;
  }

  setValidationStatus(true, "Cubo configurado correctamente y listo para resolver.");
  btnStartSolve.disabled = false;
  return true;
}

function setValidationStatus(isValid, message) {
  validationStatus.className = 'status-box ' + (isValid ? 'status-valid' : 'status-invalid');
  validationStatus.querySelector('.status-icon').textContent = isValid ? '✓' : '⚠️';
  validationText.textContent = message;
}

// Configurar acciones rápidas
function setupQuickActionEvents() {
  // Mezclar cubo
  btnQuickScramble.addEventListener('click', () => {
    triggerScramble();
  });

  // Pintar cubo
  btnQuickEdit.addEventListener('click', () => {
    switchTab('paint');
  });

  // Resolver cubo
  btnQuickSolve.addEventListener('click', () => {
    triggerSolve();
  });

  // Reset a resuelto
  btnQuickReset.addEventListener('click', () => {
    resetToSolved();
  });

  btnResetCam.addEventListener('click', () => {
    cube3D.resetCamera();
  });

  btnStartSolve.addEventListener('click', () => {
    triggerSolve();
  });

  btnScrambleAgain.addEventListener('click', () => {
    triggerScramble();
  });

  btnEditAgain.addEventListener('click', () => {
    switchTab('paint');
  });
}

function resetToSolved() {
  stopAutoPlay();
  faceletColors = [...SOLVED_FACELET_COLORS];
  initialFaceletColors = [...SOLVED_FACELET_COLORS];
  cube3D.updateColors(faceletColors);
  renderNet();
  updateColorCounts();
  validateCurrentState();
  currentSolution = [];
  currentSteps = [];
  currentStepIndex = 0;
  switchTab('paint');
}

// Mezclar cubo con secuencia aleatoria
async function triggerScramble() {
  stopAutoPlay();
  const scrambleMoves = generateScramble(8);
  let scrambledColors = [...SOLVED_FACELET_COLORS];
  for (const m of scrambleMoves) {
    scrambledColors = applyPerm(scrambledColors, MOVES[m]);
  }

  faceletColors = [...scrambledColors];
  initialFaceletColors = [...scrambledColors];
  cube3D.updateColors(faceletColors);
  renderNet();
  updateColorCounts();
  validateCurrentState();

  // Calcular solución automáticamente y preparar modo paso a paso
  prepareSolution();
}

// Resolver cubo
function triggerSolve() {
  if (!validateCurrentState()) {
    switchTab('paint');
    return;
  }
  prepareSolution();
}

// Preparar y cargar la solución en la interfaz paso a paso
function prepareSolution() {
  const result = solveFromColors(faceletColors);
  if (!result.success) {
    setValidationStatus(false, result.error);
    switchTab('paint');
    return;
  }

  // Si requirió rotación para normalizar a la referencia DBL estándar, sincronizar
  if (result.rotationIndex !== 0 && result.normalizedColors) {
    faceletColors = [...result.normalizedColors];
    cube3D.updateColors(faceletColors);
    renderNet();
    updateColorCounts();
  }

  // Guardar estado inicial para poder reiniciar
  initialFaceletColors = [...faceletColors];
  currentSolution = result.moves;
  currentSteps = result.steps;
  currentStepIndex = 0;

  // Renderizar la tira de pasos
  renderStepperTrack();
  updateStepCard();
  switchTab('solve');
}

// Renderizar chips de pasos
function renderStepperTrack() {
  stepperTrack.innerHTML = '';
  solutionSummary.textContent = `Solución óptima en ${currentSolution.length} movimientos:`;

  if (currentSolution.length === 0) {
    const emptyChip = document.createElement('div');
    emptyChip.className = 'step-chip completed';
    emptyChip.textContent = '¡Ya está resuelto!';
    stepperTrack.appendChild(emptyChip);
    return;
  }

  currentSteps.forEach((step, idx) => {
    const chip = document.createElement('div');
    chip.className = 'step-chip' + (idx === currentStepIndex ? ' active' : '');
    chip.id = `chip-step-${idx}`;
    chip.innerHTML = `<span>${step.stepNumber}.</span> <strong>${step.move}</strong>`;
    stepperTrack.appendChild(chip);
  });
}

// Actualizar tarjeta del paso actual y botones
function updateStepCard() {
  const total = currentSolution.length;
  solutionProgressText.textContent = `Paso ${currentStepIndex} de ${total}`;

  // Actualizar clases de chips
  currentSteps.forEach((_, idx) => {
    const chip = document.getElementById(`chip-step-${idx}`);
    if (!chip) return;
    chip.classList.remove('active', 'completed');
    if (idx < currentStepIndex) {
      chip.classList.add('completed');
    } else if (idx === currentStepIndex) {
      chip.classList.add('active');
      chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  });

  // Si ya se completaron todos los pasos o ya estaba resuelto
  if (total === 0 || currentStepIndex >= total) {
    cardProgressFill.style.width = '100%';
    stepCard.style.display = 'none';
    stepControlsContainer.style.display = 'none';
    solvedCelebration.style.display = 'flex';
    stopAutoPlay();
    return;
  }

  stepCard.style.display = 'flex';
  stepControlsContainer.style.display = 'flex';
  solvedCelebration.style.display = 'none';

  const currentMove = currentSolution[currentStepIndex];
  const currentStep = currentSteps[currentStepIndex];

  cardStepTag.textContent = `PASO ${currentStepIndex + 1} DE ${total}`;
  cardMoveText.textContent = currentMove;
  cardDescText.textContent = currentStep.description;

  const pct = (currentStepIndex / total) * 100;
  cardProgressFill.style.width = `${pct}%`;

  btnPrevStep.disabled = currentStepIndex <= 0 || isProcessingStep;
  btnNextStep.disabled = currentStepIndex >= total || isProcessingStep;
}

// Controles Paso a Paso (Requisito: Clic para el siguiente paso)
function setupStepControllerEvents() {
  // Siguiente Paso con un clic
  btnNextStep.addEventListener('click', async () => {
    await executeNextStep();
  });

  // Paso Anterior
  btnPrevStep.addEventListener('click', async () => {
    await executePrevStep();
  });

  // Auto-play
  btnAutoPlay.addEventListener('click', () => {
    if (isAutoPlaying) {
      stopAutoPlay();
    } else {
      startAutoPlay();
    }
  });

  // Reiniciar pasos
  btnRestartSteps.addEventListener('click', () => {
    restartSteps();
  });
}

// Ejecutar siguiente paso con animación 3D
async function executeNextStep() {
  if (isProcessingStep || currentStepIndex >= currentSolution.length) return;
  isProcessingStep = true;
  setButtonsProcessingState(true);

  const move = currentSolution[currentStepIndex];
  const nextColors = applyPerm(faceletColors, MOVES[move]);

  try {
    // 1. Ejecutar animación 3D de giro de capa y sincronizar colores exactos
    await cube3D.animateMove(move, nextColors, isAutoPlaying ? 200 : 320);

    // 2. Actualizar estado lógico de colores y red 2D
    faceletColors = nextColors;
    renderNet();

    // 3. Avanzar índice
    currentStepIndex++;
    updateStepCard();
  } catch (err) {
    console.error("Error al ejecutar movimiento:", err);
  } finally {
    isProcessingStep = false;
    setButtonsProcessingState(false);
  }
}

// Ejecutar paso anterior (desrotar)
async function executePrevStep() {
  if (isProcessingStep || currentStepIndex <= 0) return;
  isProcessingStep = true;
  setButtonsProcessingState(true);

  const prevMove = currentSolution[currentStepIndex - 1];
  const inverseMove = INVERSE_MOVES[prevMove];
  const prevColors = applyPerm(faceletColors, MOVES[inverseMove]);

  try {
    await cube3D.animateMove(inverseMove, prevColors, 280);
    faceletColors = prevColors;
    renderNet();

    currentStepIndex--;
    updateStepCard();
  } catch (err) {
    console.error("Error al retroceder movimiento:", err);
  } finally {
    isProcessingStep = false;
    setButtonsProcessingState(false);
  }
}

// Reiniciar secuencia de pasos
function restartSteps() {
  stopAutoPlay();
  currentStepIndex = 0;
  faceletColors = [...initialFaceletColors];
  cube3D.updateColors(faceletColors);
  renderNet();
  updateStepCard();
}

function setButtonsProcessingState(processing) {
  btnNextStep.disabled = processing || currentStepIndex >= currentSolution.length;
  btnPrevStep.disabled = processing || currentStepIndex <= 0;
}

// Auto-play
function startAutoPlay() {
  if (currentStepIndex >= currentSolution.length) {
    restartSteps();
  }
  isAutoPlaying = true;
  autoPlayIcon.textContent = '⏸️';
  autoPlayText.textContent = 'Pausar';
  btnAutoPlay.classList.add('btn-primary');
  btnAutoPlay.classList.remove('btn-secondary');

  runAutoPlayLoop();
}

function stopAutoPlay() {
  isAutoPlaying = false;
  if (autoPlayTimer) clearTimeout(autoPlayTimer);
  autoPlayIcon.textContent = '▶️';
  autoPlayText.textContent = 'Auto-Play';
  btnAutoPlay.classList.remove('btn-primary');
  btnAutoPlay.classList.add('btn-secondary');
}

async function runAutoPlayLoop() {
  if (!isAutoPlaying) return;

  if (currentStepIndex < currentSolution.length) {
    await executeNextStep();
    if (isAutoPlaying && currentStepIndex < currentSolution.length) {
      autoPlayTimer = setTimeout(() => {
        runAutoPlayLoop();
      }, 200);
    } else {
      stopAutoPlay();
    }
  } else {
    stopAutoPlay();
  }
}
