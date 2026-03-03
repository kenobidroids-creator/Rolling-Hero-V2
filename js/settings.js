// ============================================================
//  SETTINGS
//  Manages the settings modal and the pixel / clean visual
//  mode toggle.  Settings are persisted separately from game
//  data so they survive a save reset.
// ============================================================

const SETTINGS_KEY = 'RH_Settings';

// Runtime settings object
const settings = {
    pixelMode: true,  // true = Press Start 2P + pixel borders; false = clean UI
};

// ── Persistence ──────────────────────────────────────────────
function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) Object.assign(settings, JSON.parse(raw));
    } catch (e) { /* ignore */ }
    _applySettings();
}

function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
    catch (e) { /* ignore */ }
}

// ── Apply to DOM ─────────────────────────────────────────────
function _applySettings() {
    document.body.classList.toggle('clean-mode', !settings.pixelMode);
    const label = document.getElementById('style-mode-label');
    if (label) label.textContent = settings.pixelMode ? '8-BIT PIXEL' : 'CLEAN';
    const indicator = document.getElementById('style-toggle-indicator');
    if (indicator) indicator.className = settings.pixelMode ? 'toggle-thumb' : 'toggle-thumb toggle-thumb--on';
}

// ── Toggle ───────────────────────────────────────────────────
function toggleVisualStyle() {
    settings.pixelMode = !settings.pixelMode;
    saveSettings();
    _applySettings();
}

// ── Modal open / close ───────────────────────────────────────
function openSettings() {
    document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
}
