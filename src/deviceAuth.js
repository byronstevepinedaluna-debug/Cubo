import QRCode from 'qrcode';

// ========================================================
// GESTOR DE AUTENTICACIÓN Y CONTROL DE ACCESO A LA RED
// ========================================================

class DeviceAuthManager {
  constructor() {
    this.token = this.initToken();
    this.status = null;
    this.adminData = null;
    this.pollInterval = null;
    this.adminPollInterval = null;
    this.hasUnlocked = false;
    this.onAccessGrantedCallback = null;
  }

  // 1. Obtener o generar token criptográfico único para este navegador
  initToken() {
    let token = localStorage.getItem('cubo_device_token');
    if (!token) {
      if (window.crypto && crypto.randomUUID) {
        token = 'dev_' + crypto.randomUUID().replace(/-/g, '');
      } else {
        token = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      }
      localStorage.setItem('cubo_device_token', token);
    }
    return token;
  }

  // Sugerencia de nombre para el dispositivo basada en User Agent
  suggestDeviceName() {
    const ua = navigator.userAgent;
    let name = 'Mi Dispositivo';
    if (/iPhone/i.test(ua)) name = 'iPhone';
    else if (/iPad/i.test(ua)) name = 'iPad';
    else if (/Android/i.test(ua)) name = 'Celular Android';
    else if (/Macintosh/i.test(ua)) name = 'Mac';
    else if (/Windows/i.test(ua)) name = 'PC Windows';
    else if (/Linux/i.test(ua)) name = 'Linux';
    return `${name} (${this.token.slice(-4)})`;
  }

  // 2. Inicialización principal al cargar la aplicación
  async init(onAccessGranted) {
    this.onAccessGrantedCallback = onAccessGranted;

    try {
      const res = await fetch('/api/access/status', {
        headers: { 'x-device-token': this.token }
      });
      if (!res.ok) throw new Error('Servidor no disponible');
      this.status = await res.json();
    } catch (err) {
      console.warn('[DeviceAuth] No se pudo verificar con el servidor, permitiendo modo local:', err);
      if (this.onAccessGrantedCallback) this.onAccessGrantedCallback();
      return;
    }

    // Si es localhost (PC Anfitrión)
    if (this.status.isLocalhost) {
      this.setupAdminInterface();
      if (this.onAccessGrantedCallback) this.onAccessGrantedCallback();
      return;
    }

    // Si ya está permitido o el modo es abierto
    if (this.status.isAllowed) {
      this.hasUnlocked = true;
      if (this.onAccessGrantedCallback) this.onAccessGrantedCallback();
      return;
    }

    // Dispositivo no autorizado: mostrar pantalla de bloqueo
    this.showLockScreen();
  }

  // ========================================================
  // PANTALLA DE BLOQUEO (PARA DISPOSITIVOS EXTERNOS)
  // ========================================================
  showLockScreen() {
    let overlay = document.getElementById('access-lockscreen');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'access-lockscreen';
      overlay.className = 'access-lockscreen-overlay';
      document.body.appendChild(overlay);
    }

    const defaultName = localStorage.getItem('cubo_device_name') || this.suggestDeviceName();
    const isPending = Boolean(this.status?.isPending);

    overlay.innerHTML = `
      <div class="lockscreen-card">
        <div class="lockscreen-icon">🔒</div>
        <h2>Acceso Restringido</h2>
        <p class="lockscreen-desc">
          Este <strong>Solucionador de Cubo 2x2</strong> está corriendo en la red local del anfitrión. 
          Para interactuar, este dispositivo debe ser autorizado.
        </p>

        <div class="lockscreen-info-badge">
          <span>📱 Tu IP en la red:</span>
          <strong>${this.status?.clientIp || 'Detectando...'}</strong>
        </div>

        <div id="lockscreen-form-section">
          ${isPending ? `
            <div class="lockscreen-pending-box">
              <div class="spinner-pulse"></div>
              <h4>⏳ Solicitud enviada</h4>
              <p>Esperando que el anfitrión apruebe tu dispositivo en su pantalla...</p>
              <button id="btn-cancel-request" class="btn btn-secondary btn-sm" style="margin-top: 10px;">
                Editar nombre / Cancelar
              </button>
            </div>
          ` : `
            <div class="form-group-access">
              <label for="input-device-name">Identifica tu dispositivo:</label>
              <input type="text" id="input-device-name" class="input-access" value="${defaultName}" placeholder="Ej. iPhone de Carlos" maxlength="40" />
            </div>

            <button id="btn-request-access" class="btn btn-primary btn-block">
              <span>📡</span> Solicitar Acceso al Anfitrión
            </button>
          `}

          ${this.status?.pinRequired ? `
            <div class="lockscreen-pin-divider">
              <span>o si tienes el código PIN</span>
            </div>
            <div class="pin-group">
              <input type="password" id="input-pin-code" class="input-access pin-input" placeholder="PIN" maxlength="8" />
              <button id="btn-submit-pin" class="btn btn-secondary">
                Entrar con PIN
              </button>
            </div>
          ` : ''}
          <div id="lockscreen-msg" class="lockscreen-msg"></div>
        </div>
      </div>
    `;

    overlay.style.display = 'flex';

    // Vincular eventos
    const btnRequest = document.getElementById('btn-request-access');
    const btnCancel = document.getElementById('btn-cancel-request');
    const btnPin = document.getElementById('btn-submit-pin');
    const inputName = document.getElementById('input-device-name');

    if (btnRequest && inputName) {
      btnRequest.addEventListener('click', () => {
        const name = inputName.value.trim() || 'Dispositivo';
        localStorage.setItem('cubo_device_name', name);
        this.submitAccessRequest(name);
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        this.stopPollingStatus();
        this.status.isPending = false;
        this.showLockScreen();
      });
    }

    if (btnPin) {
      btnPin.addEventListener('click', () => {
        const pinInput = document.getElementById('input-pin-code');
        const pin = pinInput ? pinInput.value.trim() : '';
        const name = (inputName ? inputName.value.trim() : '') || defaultName;
        this.submitPin(pin, name);
      });
    }

    if (isPending) {
      this.startPollingStatus();
    }
  }

  // Enviar solicitud de acceso
  async submitAccessRequest(name) {
    const msgEl = document.getElementById('lockscreen-msg');
    try {
      if (msgEl) msgEl.innerText = 'Enviando solicitud...';
      const res = await fetch('/api/access/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.token, name })
      });
      const data = await res.json();
      if (data.status === 'already_allowed') {
        this.unlockApp();
        return;
      }
      this.status.isPending = true;
      this.showLockScreen();
    } catch (err) {
      if (msgEl) {
        msgEl.innerText = '❌ Error al conectar con el anfitrión. Intenta de nuevo.';
        msgEl.style.color = 'var(--danger)';
      }
    }
  }

  // Enviar PIN
  async submitPin(pin, name) {
    const msgEl = document.getElementById('lockscreen-msg');
    if (!pin) {
      if (msgEl) {
        msgEl.innerText = 'Por favor escribe el PIN.';
        msgEl.style.color = 'var(--warning)';
      }
      return;
    }

    try {
      const res = await fetch('/api/access/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.token, name, pin })
      });
      const data = await res.json();
      if (data.success) {
        this.unlockApp();
      } else {
        if (msgEl) {
          msgEl.innerText = '❌ ' + (data.error || 'PIN incorrecto');
          msgEl.style.color = 'var(--danger)';
        }
      }
    } catch (err) {
      if (msgEl) {
        msgEl.innerText = '❌ Error al verificar PIN.';
        msgEl.style.color = 'var(--danger)';
      }
    }
  }

  // Sondeo para saber si el anfitrión ya aprobó la solicitud
  startPollingStatus() {
    this.stopPollingStatus();
    this.pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/access/status', {
          headers: { 'x-device-token': this.token }
        });
        if (res.ok) {
          const status = await res.json();
          if (status.isAllowed) {
            this.stopPollingStatus();
            this.unlockApp();
          }
        }
      } catch (e) {
        // Ignorar fallos temporales de red
      }
    }, 2500);
  }

  stopPollingStatus() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // Desbloquear la aplicación tras ser autorizado
  unlockApp() {
    this.stopPollingStatus();
    this.hasUnlocked = true;

    const overlay = document.getElementById('access-lockscreen');
    if (overlay) {
      overlay.innerHTML = `
        <div class="lockscreen-card animate-success">
          <div class="lockscreen-icon" style="color: var(--success); font-size: 3rem;">✅</div>
          <h2>¡Acceso Autorizado!</h2>
          <p class="lockscreen-desc">El anfitrión te ha permitido entrar. Iniciando el cubo...</p>
        </div>
      `;
      setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => {
          overlay.style.display = 'none';
          if (this.onAccessGrantedCallback) this.onAccessGrantedCallback();
        }, 500);
      }, 1000);
    } else {
      if (this.onAccessGrantedCallback) this.onAccessGrantedCallback();
    }
  }

  // ========================================================
  // PANEL DE ADMINISTRADOR (EXCLUSIVO PARA PC ANFITRIÓN)
  // ========================================================
  setupAdminInterface() {
    // 1. Inyectar botón de administrador en el header
    const headerBadges = document.querySelector('.header-badges');
    if (headerBadges && !document.getElementById('btn-open-admin-devices')) {
      const adminBtn = document.createElement('button');
      adminBtn.id = 'btn-open-admin-devices';
      adminBtn.className = 'admin-header-btn';
      adminBtn.innerHTML = `
        <span class="icon">🛡️</span>
        <span class="text">Red y Dispositivos</span>
        <span id="admin-pending-badge" class="badge-count" style="display: none;">0</span>
      `;
      adminBtn.title = 'Configurar acceso a la red local y autorizar dispositivos';
      adminBtn.addEventListener('click', () => this.openAdminModal());
      headerBadges.prepend(adminBtn);
    }

    // 2. Inyectar estructura del modal en el body
    this.createAdminModalStructure();

    // 3. Iniciar sondeo periódico de administrador para detectar nuevas solicitudes
    this.fetchAdminData();
    this.adminPollInterval = setInterval(() => this.fetchAdminData(), 4000);
  }

  createAdminModalStructure() {
    if (document.getElementById('admin-devices-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'admin-devices-modal';
    modal.className = 'admin-modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="admin-modal-container">
        <!-- Encabezado del Modal -->
        <div class="admin-modal-header">
          <div class="admin-title-group">
            <span class="admin-header-icon">🛡️</span>
            <div>
              <h3>Control de Dispositivos y Red Local</h3>
              <p class="subtitle">Gestiona quién puede acceder al cubo en tu Wi-Fi</p>
            </div>
          </div>
          <button id="btn-close-admin-modal" class="btn-close-modal" title="Cerrar">✖</button>
        </div>

        <!-- Contenido desplazable -->
        <div class="admin-modal-body">
          <!-- 1. Enlace de Red y Código QR -->
          <div class="admin-card-section">
            <h4>🌐 Conexión en tu Red Wi-Fi</h4>
            <p class="section-desc">Comparte este enlace o muestra el código QR a cualquier celular conectado a tu red:</p>
            <div class="network-share-box">
              <div class="url-copy-row">
                <input type="text" id="admin-network-url" readonly class="input-access input-url" value="..." />
                <button id="btn-copy-network-url" class="btn btn-secondary">
                  <span>📋</span> Copiar
                </button>
              </div>
              <div class="qrcode-wrapper">
                <canvas id="admin-qrcode-canvas"></canvas>
                <span class="qr-hint">📱 Apunta la cámara del celular para abrir al instante</span>
              </div>
            </div>
          </div>

          <!-- 2. Modo de Acceso (Restringido vs Abierto) -->
          <div class="admin-card-section">
            <h4>🔒 Modo de Acceso</h4>
            <div class="mode-selector">
              <label class="mode-option" id="mode-opt-restricted">
                <input type="radio" name="access-mode" value="restricted" checked />
                <div class="mode-option-text">
                  <strong>Lista Blanca (Recomendado)</strong>
                  <span>Solo dispositivos que apruebes o tengan el PIN pueden entrar.</span>
                </div>
              </label>
              <label class="mode-option" id="mode-opt-open">
                <input type="radio" name="access-mode" value="open" />
                <div class="mode-option-text">
                  <strong>Acceso Abierto</strong>
                  <span>Cualquiera en tu red local puede jugar sin pedir autorización.</span>
                </div>
              </label>
            </div>
          </div>

          <!-- 3. Autorizar por IP Manualmente y Guía de IP Estática (Opciones 1 y 2) -->
          <div class="admin-card-section">
            <div class="section-header-row">
              <h4>➕ Autorizar Dispositivo por IP (Opción 1)</h4>
            </div>
            <p class="section-desc">Escribe la IP de un celular o computadora para autorizarlo antes de que entre a la página:</p>
            <div class="manual-ip-row">
              <input type="text" id="admin-manual-ip" class="input-access" placeholder="IP (ej. 192.168.1.150)" style="max-width: 170px;" />
              <input type="text" id="admin-manual-name" class="input-access" placeholder="Nombre (ej. Celular de Pedro)" />
              <button id="btn-admin-add-ip" class="btn btn-primary" style="white-space: nowrap;">
                <span>➕</span> Autorizar IP
              </button>
            </div>
            <div id="admin-manual-ip-msg" class="admin-feedback-msg"></div>

            <!-- Guía interactiva paso a paso para configurar IP estática en celular (Opción 2) -->
            <details class="guide-details" id="guide-static-ip">
              <summary class="guide-summary">
                <span>📱 ¿Cómo asignarle una IP fija al celular? (Opción 2: Paso a paso)</span>
              </summary>
              <div class="guide-content">
                <p>Para que un teléfono siempre tenga la misma dirección IP fija en tu casa:</p>
                <ol class="guide-steps">
                  <li>En el teléfono ve a <strong>Ajustes > Wi-Fi</strong>.</li>
                  <li>Toca la red Wi-Fi de tu casa (icono ⚙️ en Android o <strong>(i)</strong> en iPhone).</li>
                  <li>Busca <strong>Ajustes de IP</strong> y cámbialo de <strong>DHCP</strong> a <strong>Estática / Manual</strong>.</li>
                  <li>En <strong>Dirección IP</strong> pon una disponible: <strong class="highlight-ip" id="guide-suggested-ip">192.168.1.150</strong>.</li>
                  <li>Puerta de enlace / Router: <code id="guide-gateway">192.168.1.1</code>.</li>
                  <li>Máscara de red: <code>255.255.255.0</code> (o longitud de prefijo <code>24</code>).</li>
                  <li>DNS (opcional): <code>8.8.8.8</code> y <code>1.1.1.1</code>.</li>
                </ol>
                <p class="guide-tip">💡 Una vez guardada en el celular, solo escribe esa IP arriba y dale a <strong>"Autorizar IP"</strong>.</p>
              </div>
            </details>
          </div>

          <!-- 3. PIN Rápido (Opcional) -->
          <div class="admin-card-section">
            <h4>🔑 PIN de Acceso Rápido (Opcional)</h4>
            <p class="section-desc">Si defines un PIN, otros pueden escribirlo en su pantalla para auto-aprobarse:</p>
            <div class="pin-setting-row">
              <input type="text" id="admin-pin-input" class="input-access" placeholder="Ej. 1234 (vacío para desactivar)" maxlength="10" />
              <button id="btn-save-pin" class="btn btn-secondary">
                Guardar PIN
              </button>
            </div>
          </div>

          <!-- 4. Solicitudes Pendientes de Aprobación -->
          <div class="admin-card-section">
            <div class="section-header-row">
              <h4>⏳ Solicitudes Pendientes</h4>
              <span id="admin-pending-count-label" class="badge">0 pendientes</span>
            </div>
            <div id="admin-pending-list" class="devices-list">
              <p class="empty-state">No hay solicitudes pendientes en este momento.</p>
            </div>
          </div>

          <!-- 5. Dispositivos Autorizados -->
          <div class="admin-card-section">
            <div class="section-header-row">
              <h4>✅ Dispositivos Autorizados</h4>
              <span id="admin-allowed-count-label" class="badge">0 autorizados</span>
            </div>
            <div id="admin-allowed-list" class="devices-list">
              <p class="empty-state">Aún no hay dispositivos externos autorizados.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Eventos del modal
    document.getElementById('btn-close-admin-modal').addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });

    // Copiar URL
    document.getElementById('btn-copy-network-url').addEventListener('click', () => {
      const urlInput = document.getElementById('admin-network-url');
      if (urlInput) {
        urlInput.select();
        navigator.clipboard.writeText(urlInput.value).then(() => {
          const btn = document.getElementById('btn-copy-network-url');
          const original = btn.innerHTML;
          btn.innerHTML = '<span>✅</span> ¡Copiado!';
          setTimeout(() => { btn.innerHTML = original; }, 2000);
        });
      }
    });

    // Cambiar Modo
    document.querySelectorAll('input[name="access-mode"]').forEach(radio => {
      radio.addEventListener('change', async (e) => {
        const mode = e.target.value;
        try {
          await fetch('/api/access/admin/toggle-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
          });
          this.fetchAdminData();
        } catch (err) {
          console.error('Error al cambiar modo:', err);
        }
      });
    });

    // Guardar PIN
    document.getElementById('btn-save-pin').addEventListener('click', async () => {
      const pinInput = document.getElementById('admin-pin-input');
      const pin = pinInput.value.trim();
      try {
        await fetch('/api/access/admin/set-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        const btn = document.getElementById('btn-save-pin');
        btn.innerText = '¡Guardado!';
        setTimeout(() => { btn.innerText = 'Guardar PIN'; }, 1500);
        this.fetchAdminData();
      } catch (err) {
        console.error('Error al guardar PIN:', err);
      }
    });

    // Agregar IP manualmente (Opción 1)
    const btnAddIp = document.getElementById('btn-admin-add-ip');
    if (btnAddIp) {
      btnAddIp.addEventListener('click', async () => {
        const ipInput = document.getElementById('admin-manual-ip');
        const nameInput = document.getElementById('admin-manual-name');
        const msgEl = document.getElementById('admin-manual-ip-msg');
        const ip = ipInput ? ipInput.value.trim() : '';
        const name = nameInput ? nameInput.value.trim() : '';

        if (!ip) {
          if (msgEl) msgEl.innerHTML = '<span style="color: var(--danger)">❌ Por favor ingresa una dirección IP.</span>';
          return;
        }

        try {
          if (msgEl) msgEl.innerHTML = '<span style="color: var(--accent)">Guardando...</span>';
          const res = await fetch('/api/access/admin/add-ip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, name })
          });
          const data = await res.json();
          if (data.success) {
            if (msgEl) {
              msgEl.innerHTML = `<span style="color: var(--success)">✅ IP <strong>${this.escapeHtml(ip)}</strong> autorizada con éxito. Ya puede entrar al cubo.</span>`;
            }
            if (ipInput) ipInput.value = '';
            if (nameInput) nameInput.value = '';
            this.fetchAdminData();
            setTimeout(() => { if (msgEl) msgEl.innerHTML = ''; }, 4000);
          } else {
            if (msgEl) msgEl.innerHTML = `<span style="color: var(--danger)">❌ ${data.error || 'Error al guardar'}</span>`;
          }
        } catch (err) {
          if (msgEl) msgEl.innerHTML = '<span style="color: var(--danger)">❌ Error al conectar con el servidor.</span>';
        }
      });
    }
  }

  openAdminModal() {
    const modal = document.getElementById('admin-devices-modal');
    if (modal) {
      modal.style.display = 'flex';
      this.fetchAdminData();
    }
  }

  // Obtener datos del servidor para el panel de administración
  async fetchAdminData() {
    try {
      const res = await fetch('/api/access/admin/data');
      if (!res.ok) return;
      this.adminData = await res.json();
      this.renderAdminView();
    } catch (e) {
      // Ignorar errores puntuales
    }
  }

  // Renderizar información en el modal y la insignia del header
  renderAdminView() {
    if (!this.adminData) return;

    // Actualizar insignia en el header
    const pendingBadge = document.getElementById('admin-pending-badge');
    const pendingCount = this.adminData.pendingRequests.length;
    if (pendingBadge) {
      if (pendingCount > 0) {
        pendingBadge.style.display = 'inline-block';
        pendingBadge.innerText = pendingCount;
      } else {
        pendingBadge.style.display = 'none';
      }
    }

    // Actualizar campos del modal si está abierto
    const urlInput = document.getElementById('admin-network-url');
    if (urlInput && this.adminData.networkUrl) {
      if (urlInput.value !== this.adminData.networkUrl) {
        urlInput.value = this.adminData.networkUrl;
        this.renderQrCode(this.adminData.networkUrl);
      }
    }

    // Modo de acceso
    const modeRestricted = document.querySelector('input[value="restricted"]');
    const modeOpen = document.querySelector('input[value="open"]');
    if (modeRestricted && modeOpen) {
      if (this.adminData.mode === 'open') modeOpen.checked = true;
      else modeRestricted.checked = true;
    }

    // PIN
    const pinInput = document.getElementById('admin-pin-input');
    if (pinInput && document.activeElement !== pinInput) {
      pinInput.value = this.adminData.pin || '';
    }

    // Actualizar guía de IP estática y placeholders con la subred real
    if (this.adminData.localIp && this.adminData.localIp !== '127.0.0.1') {
      const parts = this.adminData.localIp.split('.');
      if (parts.length === 4) {
        const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
        const suggestedEl = document.getElementById('guide-suggested-ip');
        const gatewayEl = document.getElementById('guide-gateway');
        const manualIpEl = document.getElementById('admin-manual-ip');

        if (suggestedEl) suggestedEl.innerText = `${subnet}.150`;
        if (gatewayEl) gatewayEl.innerText = `${subnet}.1`;
        if (manualIpEl && !manualIpEl.value) {
          manualIpEl.placeholder = `Ej. ${subnet}.150`;
        }
      }
    }

    // Lista de Solicitudes Pendientes
    const pendingListEl = document.getElementById('admin-pending-list');
    const pendingLabel = document.getElementById('admin-pending-count-label');
    if (pendingLabel) pendingLabel.innerText = `${pendingCount} pendientes`;

    if (pendingListEl) {
      if (pendingCount === 0) {
        pendingListEl.innerHTML = `<p class="empty-state">No hay solicitudes pendientes en este momento.</p>`;
      } else {
        pendingListEl.innerHTML = this.adminData.pendingRequests.map(req => `
          <div class="device-item pending">
            <div class="device-info">
              <span class="device-name">📱 ${this.escapeHtml(req.name)}</span>
              <div class="device-sub">
                <span class="device-ip">IP: ${req.ip}</span>
                <span class="device-time">${new Date(req.requestedAt).toLocaleTimeString()}</span>
              </div>
            </div>
            <div class="device-actions">
              <button class="btn btn-sm btn-success" data-action="approve" data-token="${req.token}" data-name="${this.escapeHtml(req.name)}" data-id="${req.id}">
                ✓ Aprobar
              </button>
              <button class="btn btn-sm btn-danger" data-action="reject" data-token="${req.token}" data-id="${req.id}">
                ✕ Rechazar
              </button>
            </div>
          </div>
        `).join('');

        // Vincular eventos de botones aprobar/rechazar
        pendingListEl.querySelectorAll('button[data-action="approve"]').forEach(btn => {
          btn.addEventListener('click', () => this.approveRequest(btn.dataset.token, btn.dataset.name, btn.dataset.id));
        });
        pendingListEl.querySelectorAll('button[data-action="reject"]').forEach(btn => {
          btn.addEventListener('click', () => this.rejectRequest(btn.dataset.token, btn.dataset.id));
        });
      }
    }

    // Lista de Dispositivos Autorizados
    const allowedListEl = document.getElementById('admin-allowed-list');
    const allowedCountLabel = document.getElementById('admin-allowed-count-label');
    const allowedCount = this.adminData.allowedDevices.length;
    if (allowedCountLabel) allowedCountLabel.innerText = `${allowedCount} autorizados`;

    if (allowedListEl) {
      if (allowedCount === 0) {
        allowedListEl.innerHTML = `<p class="empty-state">Aún no hay dispositivos externos autorizados.</p>`;
      } else {
        allowedListEl.innerHTML = this.adminData.allowedDevices.map(dev => `
          <div class="device-item allowed">
            <div class="device-info">
              <span class="device-name">📱 ${this.escapeHtml(dev.name)}</span>
              <div class="device-sub">
                <span class="device-ip">IP: ${dev.ip || 'LAN'}</span>
                <span class="device-time">Último acceso: ${dev.lastSeen ? new Date(dev.lastSeen).toLocaleTimeString() : 'Hoy'}</span>
              </div>
            </div>
            <div class="device-actions">
              <button class="btn btn-sm btn-danger-outline" data-action="revoke" data-token="${dev.token}">
                🗑️ Revocar
              </button>
            </div>
          </div>
        `).join('');

        // Vincular eventos de revocar
        allowedListEl.querySelectorAll('button[data-action="revoke"]').forEach(btn => {
          btn.addEventListener('click', () => this.revokeDevice(btn.dataset.token));
        });
      }
    }
  }

  // Generar Código QR en el Canvas
  renderQrCode(url) {
    const canvas = document.getElementById('admin-qrcode-canvas');
    if (canvas && url) {
      QRCode.toCanvas(canvas, url, {
        width: 180,
        margin: 2,
        color: {
          dark: '#0f1117',
          light: '#ffffff'
        }
      }, (err) => {
        if (err) console.error('Error generando QR:', err);
      });
    }
  }

  // Acciones de Administrador
  async approveRequest(token, name, requestId) {
    try {
      await fetch('/api/access/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, requestId })
      });
      this.fetchAdminData();
    } catch (e) {
      console.error('Error aprobando:', e);
    }
  }

  async rejectRequest(token, requestId) {
    try {
      await fetch('/api/access/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, requestId })
      });
      this.fetchAdminData();
    } catch (e) {
      console.error('Error rechazando:', e);
    }
  }

  async revokeDevice(token) {
    if (!confirm('¿Deseas revocar el acceso a este dispositivo? Dejará de poder ver el cubo inmediatamente.')) return;
    try {
      await fetch('/api/access/admin/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      this.fetchAdminData();
    } catch (e) {
      console.error('Error revocando:', e);
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export const deviceAuth = new DeviceAuthManager();
