// ============================================================
//  SAVE MANAGER
//  Handles localStorage persistence for the entire game state.
//  Call SaveManager.saveGame(state) after any state mutation.
//  Call SaveManager.loadGame() on startup to restore progress.
// ============================================================

const SAVE_KEY = "RollingHero_Save";

const SaveManager = {

    // Serialise and persist the full state object
    saveGame(gameState) {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
        } catch (e) {
            console.error("SaveManager: failed to save —", e);
        }
    },

    // Deserialise and return the saved state, or null if none exists
    loadGame() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.error("SaveManager: failed to load —", e);
        }
        return null;
    },

    // Wipe save data and reload for a completely fresh run
    resetGame() {
        if (confirm("Reset ALL progress? This cannot be undone!")) {
            localStorage.removeItem(SAVE_KEY);
            location.reload();
        }
    }
};
