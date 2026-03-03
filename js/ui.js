// ============================================================
//  UI
//  All DOM-update routines, shop modal, game-over screen.
//  No game logic here — only reads state, writes DOM.
// ============================================================

// ── Log ──────────────────────────────────────────────────────
function log(msg) {
    document.getElementById('log').innerText = msg;
}

// ── Main stats panel ─────────────────────────────────────────
/**
 * Refresh every stat element on the board screen.
 * Call after any state mutation.
 */
function updateUI() {
    document.getElementById('stat-floor').innerText     = state.floor;
    document.getElementById('stat-lap').innerText       = `${state.laps}/3`;
    document.getElementById('stat-gold').innerText      = state.gold;
    document.getElementById('stat-atk').innerText       = state.atk;
    document.getElementById('stat-def').innerText       = state.def;
    document.getElementById('stat-dodge').innerText     = (state.dodge || 0) + '%';
    document.getElementById('stat-vampirism').innerText = (state.vampirism || 0) + '%';

    // Floor banner — special message for milestone floors
    const floorBanner = document.getElementById('floor-banner');
    if (state.floor === BOSS_FLOOR) {
        floorBanner.textContent = '⚠️ FLOOR 10 — THE FINAL BOSS AWAITS';
        floorBanner.style.display = 'block';
    } else if (state.floor === MINIBOSS_FLOOR) {
        floorBanner.textContent = '⚔️ FLOOR 5 — MINI-BOSS ON THE BOARD';
        floorBanner.style.display = 'block';
    } else {
        floorBanner.style.display = 'none';
    }

    // HP bar
    const hpPct = Math.max(0, Math.min(100, (state.hp / state.maxHp) * 100));
    const bar   = document.getElementById('board-hp-bar');
    bar.style.width      = hpPct + '%';
    bar.style.background = hpPct < 25 ? '#e94560' : hpPct < 50 ? '#ffcc00' : '#4ecca3';
    document.getElementById('board-hp-text').innerText = `${Math.max(0, state.hp)} / ${state.maxHp}`;

    // Potion buttons
    const hasPotions = (state.potions || 0) > 0;
    const brdBtn     = document.getElementById('board-potion-btn');
    const batBtn     = document.getElementById('battle-potion-btn');
    brdBtn.style.display = hasPotions ? 'block' : 'none';
    if (batBtn) batBtn.style.display = hasPotions ? 'flex' : 'none';
    document.getElementById('board-potion-count').innerText = state.potions || 0;
    const bpc = document.getElementById('battle-potion-count');
    if (bpc) bpc.innerText = state.potions || 0;
}

// ── Shop modal ───────────────────────────────────────────────
function openShop() {
    log('— Shop open! Spend wisely. —');
    document.getElementById('shop-gold').innerText = state.gold;

    const container = document.getElementById('shop-items');
    container.innerHTML = '';

    SHOP_ITEMS.forEach(item => {
        const canAfford = state.gold >= item.cost;
        const div       = document.createElement('div');
        div.className   = 'shop-item' + (canAfford ? '' : ' shop-item--locked');
        div.innerHTML   = `
            <div class="shop-item-info">
                <span class="shop-item-icon">${item.icon}</span>
                <div class="shop-item-text">
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-desc">${item.desc}</div>
                </div>
            </div>
            <button class="shop-buy-btn pixel-btn pixel-btn--gold"
                    ${canAfford ? '' : 'disabled'}
                    onclick="buyItem('${item.id}')">
                ${item.cost}💰
            </button>`;
        container.appendChild(div);
    });

    document.getElementById('shop-modal').style.display = 'flex';
}

function buyItem(id) {
    const item = SHOP_ITEMS.find(i => i.id === id);
    if (!item || state.gold < item.cost) { log('Not enough gold!'); return; }

    state.gold -= item.cost;

    switch (id) {
        case 'pot':  state.potions   += 1;                           break;
        case 'atk':  state.baseAtk   += 5; recalcStats();           break;
        case 'def':  state.baseDef    = (state.baseDef  || 0) + 3; recalcStats(); break;
        case 'vamp': state.baseVamp   = (state.baseVamp || 0) + 5; recalcStats(); break;
        case 'luck': state.luck      += 5;                           break;
    }

    log(`Bought: ${item.name}!`);
    openShop();
    updateUI();
}

function closeShop() {
    document.getElementById('shop-modal').style.display = 'none';
    SaveManager.saveGame(state);
}

// ── Game-over screen ─────────────────────────────────────────
function showGameOverScreen() {
    document.getElementById('go-floor').innerText = state.floor;
    document.getElementById('go-gold').innerText  = state.gold;
    document.getElementById('go-atk').innerText   = state.atk;
    document.getElementById('game-over-screen').style.display = 'flex';
}

// ── Victory screen ────────────────────────────────────────────
function showVictoryScreen() {
    document.getElementById('vc-gold').innerText  = state.gold;
    document.getElementById('vc-atk').innerText   = state.atk;
    document.getElementById('victory-screen').style.display = 'flex';
}

// ── Helpers ──────────────────────────────────────────────────
const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];
function getDiceFace(n) { return DICE_FACES[(n - 1)] || '🎲'; }
