// tutorial.js - Controlador didáctico interactivo del Cubo de Rubik 2x2
// Implementa el Método Principiante / LBL Oficial (Capa Blanca, SUNE OLL, Algoritmo de la Barra PLL)
// Enseña qué algoritmo usar, cuándo usarlo y permite seleccionar colores y cubos reales.

import {
  MOVES,
  INVERSE_MOVES,
  applyPerm,
  ALL_ROTATIONS,
  SOLVED_FACELET_COLORS
} from './cubeModel.js';
import {
  generateHumanSolution,
  ALGORITHMS,
  MOVE_ACTION_INFO,
  isCubeFullySolved
} from './humanSolver.js';

// Base resuelta con D=Blanco y U=Amarillo (Rotación canónica 10)
const SOLVED_HUMAN_BASE = applyPerm(SOLVED_FACELET_COLORS, ALL_ROTATIONS[10]);

// Generador de casos típicos populares para aprender cada algoritmo en aislamiento
export function getPresetCube(presetKey) {
  let c = [...SOLVED_HUMAN_BASE];

  switch (presetKey) {
    case "sune": {
      // Aplicar inverso de Sune para crear el caso SUNE (1 esquina amarilla)
      // Anti-Sune inverso crea Sune directo
      const invSune = ["R", "U2", "R'", "U'", "R", "U'", "R'"];
      for (const m of invSune) c = applyPerm(c, MOVES[m]);
      return { colors: c, stageIndex: 1 };
    }
    case "anti-sune": {
      // Inverso de Anti-Sune crea el caso Anti-Sune
      const invAntiSune = ["R", "U", "R'", "U", "R", "U2", "R'"];
      for (const m of invAntiSune) c = applyPerm(c, MOVES[m]);
      return { colors: c, stageIndex: 1 };
    }
    case "oll-u": {
      // Faros al frente
      const invU = ["F", "R", "U", "R'", "U'", "F'"];
      for (const m of invU) c = applyPerm(c, MOVES[m]);
      return { colors: c, stageIndex: 1 };
    }
    case "oll-h": {
      // Doble faro
      const invH = ["R2", "U2", "R", "U2", "R2"];
      for (const m of invH) c = applyPerm(c, MOVES[m]);
      return { colors: c, stageIndex: 1 };
    }
    case "pll-bar": {
      // A-Perm invertido crea una barra en R
      const invA = ["R2", "B2", "R", "F", "R'", "B2", "R", "F'", "R"];
      for (const m of invA) c = applyPerm(c, MOVES[m]);
      return { colors: c, stageIndex: 2 };
    }
    case "pll-diag": {
      // Y-Perm crea el caso diagonal
      for (const m of ALGORITHMS.Y_PERM.moves) c = applyPerm(c, MOVES[m]);
      return { colors: c, stageIndex: 2 };
    }
    case "white-layer": {
      // Scramble simple de 4 giros en la capa blanca
      const sc = ["F", "R'", "F2", "U"];
      for (const m of sc) c = applyPerm(c, MOVES[m]);
      return { colors: c, stageIndex: 0 };
    }
    default:
      return { colors: c, stageIndex: 0 };
  }
}

export class TutorialController {
  constructor(cube3D, updateFaceletColorsCallback, getCurrentAppColorsCallback) {
    this.cube3D = cube3D;
    this.updateFaceletColors = updateFaceletColorsCallback;
    this.getCurrentAppColors = getCurrentAppColorsCallback;

    this.currentCubeColors = [...SOLVED_HUMAN_BASE];
    this.solutionData = null;
    this.currentStageIndex = 0;
    this.currentStepIndex = 0;
    this.stageColors = [];
    this.isProcessing = false;

    this.initDOM();
    // Cargar por defecto el caso más popular (SUNE)
    this.loadPreset("sune");
  }

  initDOM() {
    // Botones de fuente y casos
    this.btnLoadCurrent = document.getElementById('btn-tut-load-current');
    this.btnScramble = document.getElementById('btn-tut-scramble');
    this.presetButtons = document.querySelectorAll('.tut-preset-chip');

    // Navegación de etapas
    this.stageNavButtons = document.querySelectorAll('.tutorial-stage-btn');
    this.stageTitle = document.getElementById('tut-stage-title');
    this.stageBadge = document.getElementById('tut-stage-badge');
    this.stageObjective = document.getElementById('tut-stage-objective');

    // Cajas didácticas
    this.stageRecognition = document.getElementById('tut-stage-recognition');
    this.stageWhen = document.getElementById('tut-stage-when');
    this.stageHold = document.getElementById('tut-stage-hold');
    this.stageAlgName = document.getElementById('tut-algorithm-name');

    // Tira de movimientos y controles
    this.movesContainer = document.getElementById('tut-moves-grid');
    this.stepCounter = document.getElementById('tut-step-counter');
    this.demoStatus = document.getElementById('tut-demo-status');
    this.btnNextMove = document.getElementById('btn-tut-next-step');
    this.btnPrevMove = document.getElementById('btn-tut-prev-step');
    this.btnResetStage = document.getElementById('btn-tut-reset');

    this.btnPrevStage = document.getElementById('btn-tut-prev-stage');
    this.btnNextStage = document.getElementById('btn-tut-next-stage');

    // Eventos
    if (this.btnLoadCurrent) {
      this.btnLoadCurrent.addEventListener('click', () => {
        this.loadFromCurrentAppCube();
      });
    }

    if (this.btnScramble) {
      this.btnScramble.addEventListener('click', () => {
        this.scrambleForPractice();
      });
    }

    this.presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.presetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const presetKey = btn.dataset.preset;
        this.loadPreset(presetKey);
      });
    });

    this.stageNavButtons.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        this.loadStage(idx);
      });
    });

    if (this.btnPrevStage) {
      this.btnPrevStage.addEventListener('click', () => {
        if (this.currentStageIndex > 0) {
          this.loadStage(this.currentStageIndex - 1);
        }
      });
    }

    if (this.btnNextStage) {
      this.btnNextStage.addEventListener('click', () => {
        if (this.solutionData && this.currentStageIndex < this.solutionData.stages.length - 1) {
          this.loadStage(this.currentStageIndex + 1);
        }
      });
    }

    if (this.btnNextMove) {
      this.btnNextMove.addEventListener('click', async () => {
        await this.executeNextMove();
      });
    }

    if (this.btnPrevMove) {
      this.btnPrevMove.addEventListener('click', async () => {
        await this.executePrevMove();
      });
    }

    if (this.btnResetStage) {
      this.btnResetStage.addEventListener('click', () => {
        this.resetStage();
      });
    }
  }

  // Cargar caso preset típico (Sune, A-Perm, etc.)
  loadPreset(presetKey) {
    const preset = getPresetCube(presetKey);
    this.currentCubeColors = [...preset.colors];
    this.solutionData = generateHumanSolution(this.currentCubeColors);

    // Seleccionar el botón preset activo
    this.presetButtons.forEach(b => {
      b.classList.toggle('active', b.dataset.preset === presetKey);
    });

    this.loadStage(preset.stageIndex);
  }

  // Cargar los colores del cubo actual pintado o mezclado por el usuario
  loadFromCurrentAppCube() {
    if (!this.getCurrentAppColors) return;
    const currentColors = this.getCurrentAppColors();
    this.currentCubeColors = [...currentColors];
    this.solutionData = generateHumanSolution(this.currentCubeColors);

    // Deseleccionar presets
    this.presetButtons.forEach(b => b.classList.remove('active'));

    // Buscar primera etapa que tenga movimientos pendientes
    let targetStage = 0;
    for (let i = 0; i < this.solutionData.stages.length; i++) {
      if (this.solutionData.stages[i].moves.length > 0) {
        targetStage = i;
        break;
      }
    }

    this.loadStage(targetStage);
  }

  // Generar scramble aleatorio para practicar resolución completa
  scrambleForPractice() {
    let sc = [...SOLVED_HUMAN_BASE];
    const scMoves = ["U", "R", "F", "U2", "R'", "F2", "U'", "R2", "F'"];
    for (let j = 0; j < 7; j++) {
      const rm = scMoves[Math.floor(Math.random() * scMoves.length)];
      sc = applyPerm(sc, MOVES[rm]);
    }
    this.currentCubeColors = [...sc];
    this.solutionData = generateHumanSolution(this.currentCubeColors);
    this.presetButtons.forEach(b => b.classList.remove('active'));
    this.loadStage(0);
  }

  // Cargar una etapa específica
  loadStage(index) {
    if (!this.solutionData || index < 0 || index >= this.solutionData.stages.length) return;
    this.currentStageIndex = index;
    this.currentStepIndex = 0;

    const stage = this.solutionData.stages[index];
    this.stageColors = [...stage.startColors];

    // Actualizar 3D y 2D con los colores iniciales de esta etapa
    this.updateFaceletColors(this.stageColors);
    this.cube3D.updateColors(this.stageColors);

    // Actualizar botones de navegación entre etapas
    this.stageNavButtons.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === index);
    });

    if (this.btnPrevStage) this.btnPrevStage.disabled = index === 0;
    if (this.btnNextStage) this.btnNextStage.disabled = index === this.solutionData.stages.length - 1;

    // Actualizar textos didácticos
    if (this.stageTitle) this.stageTitle.textContent = stage.title;
    if (this.stageBadge) this.stageBadge.textContent = stage.badge;
    if (this.stageObjective) this.stageObjective.textContent = stage.objective;
    if (this.stageRecognition) this.stageRecognition.textContent = stage.recognition;
    if (this.stageWhen) this.stageWhen.textContent = stage.whenToUse;
    if (this.stageHold) this.stageHold.textContent = stage.howToHold;
    if (this.stageAlgName) this.stageAlgName.textContent = stage.algorithmName;

    // Renderizar tarjetas de movimientos
    this.renderMoveCards(stage);
    this.updateStepUI();
  }

  renderMoveCards(stage) {
    this.movesContainer.innerHTML = '';
    if (stage.moves.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.color = '#10b981';
      emptyMsg.style.fontWeight = 'bold';
      emptyMsg.style.padding = '0.5rem';
      emptyMsg.textContent = '✔️ ¡Esta etapa ya está resuelta en tu cubo! Pasa a la siguiente.';
      this.movesContainer.appendChild(emptyMsg);
      return;
    }

    stage.moveCards.forEach((mc, cIdx) => {
      const card = document.createElement('div');
      card.className = 'tut-move-card';
      card.id = `tut-card-${cIdx}`;
      card.innerHTML = `
        <div class="tut-move-arrow">${mc.arrow}</div>
        <div class="tut-move-code">${mc.move}</div>
        <div class="tut-move-action">${mc.action}</div>
        <div class="tut-move-detail">${mc.detail}</div>
      `;
      this.movesContainer.appendChild(card);
    });
  }

  updateStepUI() {
    const stage = this.solutionData.stages[this.currentStageIndex];
    const total = stage.moves.length;

    if (this.stepCounter) {
      this.stepCounter.textContent = `Movimiento ${this.currentStepIndex} de ${total}`;
    }

    // Iluminar la tarjeta activa
    stage.moveCards.forEach((_, cIdx) => {
      const cardEl = document.getElementById(`tut-card-${cIdx}`);
      if (!cardEl) return;
      cardEl.classList.remove('active-demo', 'completed-demo');

      if (cIdx < this.currentStepIndex) {
        cardEl.classList.add('completed-demo');
      } else if (cIdx === this.currentStepIndex) {
        cardEl.classList.add('active-demo');
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });

    // Botones de avanzar/retroceder
    if (this.btnPrevMove) {
      this.btnPrevMove.disabled = this.currentStepIndex <= 0 || this.isProcessing;
    }

    if (this.btnNextMove) {
      this.btnNextMove.disabled = this.currentStepIndex >= total || this.isProcessing;
      if (total === 0) {
        this.btnNextMove.innerHTML = `<span>Etapa ya resuelta</span> <span>✓</span>`;
      } else if (this.currentStepIndex >= total) {
        this.btnNextMove.innerHTML = `<span>¡Etapa Lista! Pasar a Siguiente</span> <span>🎉</span>`;
      } else {
        const nextMoveName = stage.moves[this.currentStepIndex];
        const nextInfo = stage.moveCards[this.currentStepIndex];
        this.btnNextMove.innerHTML = `<span>Giro: ${nextMoveName} (${nextInfo.action})</span> <span>➡️</span>`;
      }
    }

    // Mensaje de estado
    if (total === 0) {
      this.demoStatus.innerHTML = `✅ <strong>Esta etapa ya está lista.</strong> Pulsa <em>"Siguiente Etapa ➡️"</em> abajo para continuar resolviendo.`;
    } else if (this.currentStepIndex === 0) {
      const firstMove = stage.moves[0];
      const cardInfo = stage.moveCards[0];
      this.demoStatus.innerHTML = `👉 Haz clic en <strong>"${firstMove} (${cardInfo.action}) ➡️"</strong> para dar el primer paso.`;
    } else if (this.currentStepIndex < total) {
      const lastMove = stage.moves[this.currentStepIndex - 1];
      const nextMove = stage.moves[this.currentStepIndex];
      const nextCardInfo = stage.moveCards[this.currentStepIndex];
      this.demoStatus.innerHTML = `✔️ Ejecutado: <strong>${lastMove}</strong>. Siguiente movimiento: <strong>${nextMove} (${nextCardInfo.action})</strong>.`;
    } else {
      const isLastStage = this.currentStageIndex === this.solutionData.stages.length - 1;
      if (isLastStage) {
        this.demoStatus.innerHTML = `🎉 <strong>¡CUBO 100% RESUELTO!</strong> Has completado todos los pasos usando el método estándar oficial. ¡Felicidades!`;
      } else {
        this.demoStatus.innerHTML = `🎉 <strong>¡Etapa completada!</strong> Mira el cubo 3D: el objetivo se ha cumplido. Haz clic en <em>"Siguiente Etapa ➡️"</em> para continuar.`;
      }
    }
  }

  // Avanzar un movimiento con animación 3D
  async executeNextMove() {
    const stage = this.solutionData.stages[this.currentStageIndex];
    if (this.isProcessing) return;

    // Si ya completó la etapa, avanzar a la siguiente etapa automáticamente
    if (this.currentStepIndex >= stage.moves.length) {
      if (this.currentStageIndex < this.solutionData.stages.length - 1) {
        this.loadStage(this.currentStageIndex + 1);
      }
      return;
    }

    this.isProcessing = true;
    if (this.btnNextMove) this.btnNextMove.disabled = true;
    if (this.btnPrevMove) this.btnPrevMove.disabled = true;

    const move = stage.moves[this.currentStepIndex];
    const nextColors = applyPerm(this.stageColors, MOVES[move]);

    try {
      await this.cube3D.animateMove(move, nextColors, 320);
      this.stageColors = nextColors;
      this.updateFaceletColors(this.stageColors);
      this.currentStepIndex++;
    } catch (err) {
      console.error("Error en movimiento del tutorial:", err);
    } finally {
      this.isProcessing = false;
      this.updateStepUI();
    }
  }

  // Retroceder un movimiento con animación 3D
  async executePrevMove() {
    const stage = this.solutionData.stages[this.currentStageIndex];
    if (this.isProcessing || this.currentStepIndex <= 0) return;
    this.isProcessing = true;
    if (this.btnNextMove) this.btnNextMove.disabled = true;
    if (this.btnPrevMove) this.btnPrevMove.disabled = true;

    const prevMove = stage.moves[this.currentStepIndex - 1];
    const invMove = INVERSE_MOVES[prevMove];
    const prevColors = applyPerm(this.stageColors, MOVES[invMove]);

    try {
      await this.cube3D.animateMove(invMove, prevColors, 280);
      this.stageColors = prevColors;
      this.updateFaceletColors(this.stageColors);
      this.currentStepIndex--;
    } catch (err) {
      console.error("Error al retroceder movimiento en tutorial:", err);
    } finally {
      this.isProcessing = false;
      this.updateStepUI();
    }
  }

  // Reiniciar la etapa actual a su posición de inicio
  resetStage() {
    const stage = this.solutionData.stages[this.currentStageIndex];
    this.currentStepIndex = 0;
    this.stageColors = [...stage.startColors];
    this.updateFaceletColors(this.stageColors);
    this.cube3D.updateColors(this.stageColors);
    this.updateStepUI();
  }
}
