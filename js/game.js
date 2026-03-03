// ============================================================
//  GAME  (main loop)
//  playTurn → handleGoTile → handleTileLanding are the core
//  turn sequence.  startGame() is the page-load entry point.
// ============================================================

// ── Utility ──────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main turn ────────────────────────────────────────────────
async function playTurn() {
    if (state.isMoving) return;
    state.isMoving = true;

    const roll = Math.floor(Math.random() * 6) + 1;
    document.getElementById('dice-display').innerText = getDiceFace(roll);
    document.getElementById('roll-btn').disabled = true;
    log(`🎲 Rolled a ${roll}!`);

    for (let step = 0; step < roll; step++) {
        state.pos++;
        if (state.pos >= BOARD_SIZE) {
            state.pos = 0;
            updatePlayerVisual();
            await handleGoTile();
            // After GO on boss floor, landing = boss (handled by next iteration)
        }
        updatePlayerVisual();
        await delay(170);
    }

    document.getElementById('roll-btn').disabled = false;
    state.isMoving = false;
    await handleTileLanding(state.pos);
}

// ── GO tile ───────────────────────────────────────────────────
async function handleGoTile() {
    state.laps++;

    // Heal on passing GO
    const healAmt = 10 + (state.floor * 2);
    state.hp = Math.min(state.hp + healAmt, state.maxHp);
    log(`✅ Passed GO! +${healAmt} HP  (Lap ${state.laps}/3)`);
    updateUI();

    // Reroll unvisited tiles each lap for variety
    rerollActiveTiles();

    await delay(600);

    // Every 3 laps → floor complete, open shop, advance floor
    if (state.laps >= 3) {
        state.laps = 0;
        state.floor++;
        SaveManager.saveGame(state);

        // After floor 10 boss: advance to victory if won (handled in combat)
        // Otherwise show shop and reinit board
        if (state.floor <= BOSS_FLOOR) {
            openShop();
        }
    } else {
        SaveManager.saveGame(state);
    }
}

// ── Tile landing ─────────────────────────────────────────────
async function handleTileLanding(index) {
    if (index === 0) return; // GO tile handled above

    // On boss floor (10), every non-GO tile triggers the final boss
    if (state.floor === BOSS_FLOOR) {
        await startBattle('boss');
        return;
    }

    const tile = document.getElementById(`tile-${index}`);
    if (!tile) return;
    const type = tile.dataset.type;

    // Skip already-cleared tiles
    if (tile.dataset.visited === 'true') {
        log('Nothing here... already cleared.');
        return;
    }

    switch (type) {
        case 'boss':
        case 'miniboss':
            await startBattle(type === 'boss' ? 'boss' : 'miniboss');
            markTileVisited(index);
            break;

        case 'combat':
            await startBattle('enemy');
            markTileVisited(index);
            break;

        case 'loot': {
            openLootSelection(generateLootChoices(3));
            markTileVisited(index);
            break;
        }

        case 'heal': {
            const healAmt = 15 + state.floor * 3;
            state.hp = Math.min(state.hp + healAmt, state.maxHp);
            log(`💊 Found medicine! +${healAmt} HP`);
            markTileVisited(index);
            SaveManager.saveGame(state);
            updateUI();
            break;
        }

        case 'event':
            triggerEvent();
            markTileVisited(index);
            break;

        case 'gamble':
            triggerGamble();
            markTileVisited(index);
            break;

        case 'forge':
            triggerForge();
            markTileVisited(index);
            break;

        case 'empty':
        default:
            log('A quiet moment... rest while you can.');
            break;
    }
}

// ── Potion ───────────────────────────────────────────────────
function usePotion() {
    if ((state.potions || 0) <= 0) { log('No potions left!'); return; }
    if (state.hp >= state.maxHp)   { log('Already at full health!'); return; }
    state.potions--;
    const h = 50;
    state.hp = Math.min(state.hp + h, state.maxHp);
    log(`🧪 Potion used! +${h} HP`);
    refreshBattleHP(); // no-op when not in combat
    updateUI();
    SaveManager.saveGame(state);
}

// ── Init ─────────────────────────────────────────────────────
function startGame() {
    const saved = SaveManager.loadGame();
    if (saved) {
        Object.assign(state, saved);
        state.isMoving = false;
        // Restore equipment object shape in case older save lacks it
        state.equipment = Object.assign(
            { weapon: null, shield: null, boots: null, cloak: null },
            state.equipment || {}
        );
        recalcStats();
        log('Welcome back, adventurer!');
    } else {
        log('Welcome, adventurer!  Roll the dice to begin.');
    }

    loadSettings();
    initBoard();
    updateUI();
}

startGame();
