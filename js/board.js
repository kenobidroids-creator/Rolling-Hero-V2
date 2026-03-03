// ============================================================
//  BOARD
//  Builds the tile grid, handles floor-specific tile layouts,
//  lap-based tile rerolling, and player token movement.
//
//  Floor rules:
//    Normal floors  → random tile distribution
//    MINIBOSS_FLOOR → mini-boss tile at the midpoint (tile 12)
//    BOSS_FLOOR     → ALL tiles are boss tiles (final floor)
//
//  Each lap: unvisited tiles reshuffle with heavier combat
//  weighting, reflecting a dungeon that grows more dangerous.
// ============================================================

// ── Grid coordinate map ──────────────────────────────────────
// Returns [row, col] pairs tracing the 7×7 perimeter clockwise.
// Index 0 is the top-left (GO tile).
function generateGridMap(dim) {
    const map = [];
    for (let i = 0; i < dim; i++)        map.push([0, i]);
    for (let i = 1; i < dim; i++)        map.push([i, dim - 1]);
    for (let i = dim - 2; i >= 0; i--)  map.push([dim - 1, i]);
    for (let i = dim - 2; i >= 1; i--)  map.push([i, 0]);
    return map;
}
const GRID_MAP = generateGridMap(BOARD_DIM);

// ── Base tile type pool ──────────────────────────────────────
// Weights are adjusted per lap: more combat, less healing.
const TILE_DEFS = [
    { type: 'combat', label: 'FIGHT', spriteKey: 'sword', weight: 4 },
    { type: 'loot',   label: 'LOOT',  spriteKey: 'chest', weight: 2 },
    { type: 'heal',   label: 'HEAL',  spriteKey: 'cross', weight: 2 },
    { type: 'empty',  label: '',      spriteKey: null,    weight: 2 },
];

/**
 * Pick a random tile type, adjusting combat/heal weights for the
 * current lap number (lap 0 = balanced, lap 2 = mostly combat).
 */
function weightedRandomTile(lap = 0) {
    const pool = TILE_DEFS.map(t => {
        let w = t.weight;
        if (t.type === 'combat') w += lap * 1.5;          // more fights each lap
        if (t.type === 'heal')   w = Math.max(0.5, w - lap * 0.5); // fewer heals
        return { ...t, w };
    });
    const total = pool.reduce((s, t) => s + t.w, 0);
    let r = Math.random() * total;
    for (const def of pool) { r -= def.w; if (r <= 0) return def; }
    return pool[0];
}

// ── Tile config resolver ─────────────────────────────────────
/**
 * Returns the tile config for a given board index on the current
 * floor, factoring in floor milestones.
 */
function getTileConfig(index, lap = 0) {
    if (index === 0) return { type: 'go', label: 'GO', spriteKey: null };

    if (state.floor === BOSS_FLOOR) {
        // Floor 10: every tile is the final boss
        return { type: 'boss', label: 'BOSS', spriteKey: 'boss' };
    }

    if (index === MINIBOSS_INDEX && state.floor === MINIBOSS_FLOOR) {
        // Floor 5: mini-boss at the halfway point
        return { type: 'miniboss', label: 'MINI', spriteKey: 'boss' };
    }

    return weightedRandomTile(lap);
}

// ── DOM tile factory ─────────────────────────────────────────
function buildTileEl(index, cfg) {
    const [row, col] = GRID_MAP[index];
    const tile = document.createElement('div');
    tile.className  = `tile tile--${cfg.type}`;
    tile.id         = `tile-${index}`;
    tile.dataset.index = index;
    tile.dataset.type  = cfg.type;
    tile.style.gridArea = `${row + 1} / ${col + 1}`;

    if (cfg.type === 'go') {
        tile.innerHTML = `<span class="tile-label tile-label--go">GO</span>`;
    } else if (cfg.type === 'boss') {
        tile.innerHTML = `
            <canvas class="tile-sprite" width="22" height="22" aria-hidden="true"></canvas>
            <span class="tile-label tile-label--boss">BOSS</span>`;
    } else if (cfg.type === 'miniboss') {
        tile.innerHTML = `
            <canvas class="tile-sprite" width="20" height="20" aria-hidden="true"></canvas>
            <span class="tile-label tile-label--miniboss">MINI</span>`;
    } else if (cfg.spriteKey) {
        tile.innerHTML = `
            <canvas class="tile-sprite" width="18" height="18" aria-hidden="true"></canvas>
            ${cfg.label ? `<span class="tile-label">${cfg.label}</span>` : ''}`;
    } else {
        tile.innerHTML = `<span class="tile-empty-dot">·</span>`;
    }

    return tile;
}

// ── Sprite pass ──────────────────────────────────────────────
function renderTileSprites() {
    document.querySelectorAll('.tile[data-type="boss"] .tile-sprite, .tile[data-type="miniboss"] .tile-sprite')
        .forEach(c => drawBoss(c));
    document.querySelectorAll('.tile[data-type="combat"] .tile-sprite').forEach(c => drawSword(c));
    document.querySelectorAll('.tile[data-type="loot"] .tile-sprite').forEach(c => drawChest(c));
    document.querySelectorAll('.tile[data-type="heal"] .tile-sprite').forEach(c => drawCross(c));
}

// ── Board initialisation ─────────────────────────────────────
/**
 * Tear down and rebuild the board for the current floor.
 * Clears visitedTiles so the new floor starts fresh.
 */
function initBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${BOARD_DIM}, 1fr)`;
    boardEl.style.gridTemplateRows    = `repeat(${BOARD_DIM}, 1fr)`;

    state.visitedTiles = [];
    state.pos          = 0;

    for (let i = 0; i < BOARD_SIZE; i++) {
        const cfg  = getTileConfig(i, state.laps);
        const tile = buildTileEl(i, cfg);
        boardEl.appendChild(tile);
    }

    // Boss floor visual flair — darken the whole board
    boardEl.classList.toggle('board--boss-floor', state.floor === BOSS_FLOOR);
    boardEl.classList.toggle('board--miniboss-floor', state.floor === MINIBOSS_FLOOR);

    renderTileSprites();
    updatePlayerVisual();
}

// ── Lap reroll ───────────────────────────────────────────────
/**
 * Called at the end of each lap (when player passes GO).
 * Rerolls unvisited, non-special tiles so the board feels fresh.
 * Each lap the difficulty weight shifts to produce harder encounters.
 */
function rerollActiveTiles() {
    for (let i = 1; i < BOARD_SIZE; i++) {
        const tile = document.getElementById(`tile-${i}`);
        if (!tile) continue;
        if (tile.dataset.visited === 'true') continue; // already cleared
        if (i === state.pos) continue;                  // player is standing here

        // Boss floor and mini-boss tile are always static
        if (state.floor === BOSS_FLOOR) continue;
        if (i === MINIBOSS_INDEX && state.floor === MINIBOSS_FLOOR) continue;

        const cfg = getTileConfig(i, state.laps);
        tile.className     = `tile tile--${cfg.type}`;
        tile.dataset.type  = cfg.type;

        if (cfg.type === 'combat' && cfg.spriteKey) {
            tile.innerHTML = `<canvas class="tile-sprite" width="18" height="18"></canvas><span class="tile-label">${cfg.label}</span>`;
        } else if (cfg.spriteKey) {
            tile.innerHTML = `<canvas class="tile-sprite" width="18" height="18"></canvas>${cfg.label ? `<span class="tile-label">${cfg.label}</span>` : ''}`;
        } else {
            tile.innerHTML = `<span class="tile-empty-dot">·</span>`;
        }
    }

    renderTileSprites();
    updatePlayerVisual(); // re-place hero token (innerHTML wipes it from current tile)
}

// ── Tile visited marking ─────────────────────────────────────
/**
 * Mark a tile as visited (cleared) — dims it and records index.
 */
function markTileVisited(index) {
    const tile = document.getElementById(`tile-${index}`);
    if (tile) {
        tile.dataset.visited = 'true';
        tile.classList.add('tile--visited');
    }
    if (!state.visitedTiles.includes(index)) {
        state.visitedTiles.push(index);
    }
}

// ── Player token ─────────────────────────────────────────────
/**
 * Remove the old hero token and place a fresh one at state.pos.
 */
function updatePlayerVisual() {
    document.querySelector('.player-token')?.remove();

    const tile = document.getElementById(`tile-${state.pos}`);
    if (!tile) return;

    const token = document.createElement('div');
    token.className = 'player-token';
    token.innerHTML = `<canvas class="player-sprite" width="22" height="22" aria-hidden="true"></canvas>`;
    tile.appendChild(token);
    drawHero(token.querySelector('.player-sprite'));
}
