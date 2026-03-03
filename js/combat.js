// ============================================================
//  COMBAT
//  Auto-battle loop with per-round animation.
//  Supports regular enemies, mini-bosses, and the final boss.
//
//  Enemy type affects:
//    - Name / colour on the battle header
//    - ATK / HP multipliers from ENEMY_CFG
//    - Gold reward on victory
//    - Whether victory ends the run (floor 10 boss)
// ============================================================

// Module-level reference — lets usePotion() refresh battle bars
let _activeBattleUIRefresh = null;

function refreshBattleHP() {
    if (_activeBattleUIRefresh) _activeBattleUIRefresh();
}

// ── Main battle entry ────────────────────────────────────────
/**
 * @param {'enemy'|'miniboss'|'boss'} type
 */
async function startBattle(type = 'enemy') {
    state.isMoving = true;

    const screen = document.getElementById('battle-screen');
    const logEl  = document.getElementById('battle-log');
    const nameEl = document.getElementById('enemy-name');

    // Theme the battle overlay
    screen.style.display = 'flex';
    screen.className = type === 'boss'     ? 'overlay overlay--boss'
                     : type === 'miniboss' ? 'overlay overlay--miniboss'
                     : 'overlay';

    // Header text
    const LABELS = { enemy: '⚔️  WILD ENEMY', miniboss: '💀  MINI BOSS', boss: '👹  FLOOR BOSS' };
    const COLORS = { enemy: 'var(--accent)',   miniboss: '#e67e22',       boss: '#ffcc00'      };
    nameEl.innerText   = LABELS[type];
    nameEl.style.color = COLORS[type];

    // Draw sprites
    const enemyCanvas = document.getElementById('battle-enemy-sprite');
    if (type === 'boss' || type === 'miniboss') drawBoss(enemyCanvas);
    else drawEnemy(enemyCanvas);
    drawHero(document.getElementById('battle-hero-sprite'));

    // ── Enemy stat calculation ─────────────────────────────────
    // lap-based difficulty ramp: each lap within a floor toughens enemies
    const lapMult    = 1 + (state.laps * ENEMY_CFG.lapAtkMult);
    const floorMult  = Math.pow(ENEMY_CFG.atkGrowth, state.floor - 1);
    const typeMult   = type === 'boss'     ? ENEMY_CFG.bossAtkMult
                     : type === 'miniboss' ? ENEMY_CFG.minibossAtkMult
                     : 1.0;
    const hpTypeMult = type === 'boss'     ? ENEMY_CFG.bossHpMult
                     : type === 'miniboss' ? ENEMY_CFG.minibossHpMult
                     : 1.0;
    const hpLapMult  = 1 + (state.laps * ENEMY_CFG.lapHpMult);

    const eAtk   = Math.floor(ENEMY_CFG.baseAtk * floorMult * typeMult * lapMult);
    const eMaxHp = Math.floor(ENEMY_CFG.baseHp  * Math.pow(ENEMY_CFG.hpGrowth, state.floor - 1) * hpTypeMult * hpLapMult);
    let   eHp    = eMaxHp;

    // ── Battle UI closure ──────────────────────────────────────
    const updateBattleUI = () => {
        const ePct = Math.max(0, (eHp / eMaxHp) * 100);
        const pPct = Math.max(0, (state.hp / state.maxHp) * 100);

        document.getElementById('e-hp-text').innerText  = `${Math.max(0, eHp)} / ${eMaxHp}`;
        document.getElementById('e-hp-bar').style.width = ePct + '%';
        document.getElementById('p-hp-text').innerText  = `${Math.max(0, state.hp)} / ${state.maxHp}`;
        document.getElementById('p-hp-bar').style.width = pPct + '%';
        document.getElementById('p-hp-bar').style.background =
            pPct < 25 ? '#e94560' : pPct < 50 ? '#ffcc00' : '#4ecca3';

        updateUI();
    };

    _activeBattleUIRefresh = updateBattleUI;
    updateBattleUI();
    await delay(500);

    // ── Combat loop ────────────────────────────────────────────
    while (eHp > 0 && state.hp > 0) {

        // Player turn
        eHp -= state.atk;
        let msg = `⚔️ You deal ${state.atk} dmg!`;
        if (state.vampirism > 0) {
            const steal = Math.floor(state.atk * (state.vampirism / 100));
            if (steal > 0) { state.hp = Math.min(state.hp + steal, state.maxHp); msg += ` 🦇+${steal}`; }
        }
        logEl.innerText = msg;
        logEl.className = 'battle-log battle-log--player';
        updateBattleUI();

        if (eHp <= 0) break;
        await delay(480);

        // Enemy turn
        if (Math.random() * 100 < (state.dodge || 0)) {
            logEl.innerText = '💨 Dodged!';
            logEl.className = 'battle-log battle-log--dodge';
        } else {
            const rawDmg   = Math.floor(eAtk * (0.8 + Math.random() * 0.4));
            const finalDmg = Math.max(1, rawDmg - (state.def || 0));
            state.hp -= finalDmg;
            const enemyMsg = type === 'boss'     ? `💀 Boss slams for ${finalDmg}!`
                           : type === 'miniboss' ? `💀 Mini-boss strikes for ${finalDmg}!`
                           : `👊 Enemy hits for ${finalDmg}!`;
            logEl.innerText = enemyMsg;
            logEl.className = 'battle-log battle-log--enemy';
        }
        updateBattleUI();
        if (state.hp <= 0) break;
        await delay(480);
    }

    _activeBattleUIRefresh = null;

    // ── Conclusion ─────────────────────────────────────────────
    if (state.hp <= 0) {
        logEl.innerText = '💀 Defeated...';
        logEl.className = 'battle-log battle-log--defeat';
        await delay(1200);
        state.hp = 0;
        SaveManager.saveGame(state);
        document.getElementById('battle-screen').style.display = 'none';
        showGameOverScreen();
        return;
    }

    // Victory
    const goldGain = type === 'boss'     ? state.floor * 30
                   : type === 'miniboss' ? state.floor * 15
                   : state.floor * 5;
    state.gold += goldGain;

    logEl.innerText = type === 'boss' ? '🏆 BOSS DEFEATED!' : type === 'miniboss' ? '🏅 Mini-boss down!' : '✅ Victory!';
    logEl.className = 'battle-log battle-log--victory';
    log(`Defeated! +${goldGain} gold.`);

    SaveManager.saveGame(state);
    await delay(800);

    // Final boss win → victory screen, skip loot
    if (type === 'boss' && state.floor === BOSS_FLOOR) {
        document.getElementById('battle-screen').style.display = 'none';
        showVictoryScreen();
        return;
    }

    // All other wins → 3-item loot selection
    openLootSelection(generateLootChoices(3));
}
