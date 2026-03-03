// ============================================================
//  STATE & GAME DATA
//  Single source of truth for all runtime values.
//  Other modules read/write `state` directly.
//  recalcStats() must be called after any stat mutation.
// ============================================================

// ── Board dimensions ─────────────────────────────────────────
const BOARD_DIM  = 7;
const BOARD_SIZE = (BOARD_DIM * 4) - 4; // 24 tiles for 7×7 grid

// ── Floor milestones ─────────────────────────────────────────
// MINIBOSS_FLOOR: a special mini-boss tile appears at the halfway point
// BOSS_FLOOR:     every tile on the board becomes a boss tile
const MINIBOSS_FLOOR = 5;
const BOSS_FLOOR     = 10;
const MINIBOSS_INDEX = Math.floor(BOARD_SIZE / 2); // tile 12

// ── Live game state ──────────────────────────────────────────
const state = {
    pos:          0,      // current board tile index
    floor:        1,      // dungeon floor
    laps:         0,      // completed laps this floor (shop at 3)
    lapDifficulty:1.0,    // multiplier applied to enemy stats per lap
    gold:         0,
    hp:           100,
    maxHp:        100,

    // Base stats — modified directly by shop purchases
    baseAtk:   10,
    baseDef:   2,
    baseDodge: 1,
    baseMaxHp: 100,
    baseVamp:  0,

    // Derived stats — recalculated from base + equipment by recalcStats()
    atk:       10,
    def:       2,
    dodge:     1,
    vampirism: 0,
    luck:      1,
    potions:   1,

    isMoving:     false,
    visitedTiles: [], // indices of cleared tiles on the current floor

    // Equipment slots — each stores a full item object or null
    equipment: {
        weapon: null,
        shield: null,
        boots:  null,
        cloak:  null,
    },
};

// ── Stat recalculation ───────────────────────────────────────
/**
 * Rebuild derived stats (atk, def, dodge, maxHp, vampirism) from
 * the current base stats + all equipped item bonuses.
 * Must be called after: equipping/unequipping items, shop purchases.
 */
function recalcStats() {
    state.atk       = state.baseAtk;
    state.def       = state.baseDef;
    state.dodge     = state.baseDodge;
    state.vampirism = state.baseVamp || 0;

    const oldMax = state.maxHp;
    state.maxHp  = state.baseMaxHp;

    Object.values(state.equipment).forEach(item => {
        if (!item) return;
        state.atk       += item.atkBoost   || 0;
        state.def       += item.defBoost   || 0;
        state.dodge      = Math.min(50, state.dodge + (item.dodgeBoost || 0));
        state.maxHp     += item.hpBoost    || 0;
        state.vampirism += item.vampBoost  || 0;
    });

    // If max HP grew (e.g. equipping a cloak), heal by the difference
    const diff = state.maxHp - oldMax;
    if (diff > 0) state.hp = Math.min(state.hp + diff, state.maxHp);
    state.hp = Math.min(state.hp, state.maxHp); // clamp in case maxHp shrank
}

// ── Loot item templates ──────────────────────────────────────
// `slot` determines which equipment slot the item occupies.
// Base stat values are scaled by floor × rarity multiplier at drop time.
const ITEM_POOL = [
    { name: 'Sword',    icon: '⚔️',  slot: 'weapon', atk: 3, hp: 0, def: 0, dodge: 0 },
    { name: 'Shield',   icon: '🛡️', slot: 'shield', atk: 0, hp: 2, def: 3, dodge: 0 },
    { name: 'Boots',    icon: '🥾', slot: 'boots',  atk: 0, hp: 1, def: 1, dodge: 3 },
    { name: 'Cloak',    icon: '🧥', slot: 'cloak',  atk: 1, hp: 5, def: 1, dodge: 1 },
];

// Rarity tiers — driven by a luck-boosted random roll
const RARITIES = [
    { label: 'LEGENDARY', color: '#ffcc00', mult: 2.5, minRoll: 95 },
    { label: 'EPIC',      color: '#a335ee', mult: 1.8, minRoll: 80 },
    { label: 'RARE',      color: '#0070dd', mult: 1.3, minRoll: 50 },
    { label: 'COMMON',    color: '#aaaaaa', mult: 1.0, minRoll: 0  },
];

function rollRarity() {
    const roll = Math.random() * 100 + (state.luck || 0);
    return RARITIES.find(r => roll > r.minRoll) || RARITIES[RARITIES.length - 1];
}

// ── Enemy balancing ──────────────────────────────────────────
const ENEMY_CFG = {
    baseAtk:         15,   // regular enemy ATK on floor 1
    atkGrowth:       1.5,  // exponential ATK growth per floor
    baseHp:          25,   // regular enemy HP on floor 1
    hpGrowth:        1.5,  // exponential HP growth per floor
    bossAtkMult:     1.5,  // final boss ATK multiplier
    bossHpMult:      2.5,  // final boss HP multiplier
    minibossAtkMult: 1.25, // mini-boss ATK multiplier
    minibossHpMult:  1.75, // mini-boss HP multiplier
    lapAtkMult:      0.15, // extra ATK % per lap within a floor (difficulty ramp)
    lapHpMult:       0.12, // extra HP % per lap
};

// ── Shop catalogue ───────────────────────────────────────────
const SHOP_ITEMS = [
    { id: 'pot',  name: 'Health Potion', icon: '🧪', desc: '+1 Potion (heals 50 HP)',       cost: 30,  type: 'use' },
    { id: 'atk',  name: 'Weapon Stone',  icon: '⚔️',  desc: '+5 Base Attack permanently',  cost: 80,  type: 'mod' },
    { id: 'def',  name: 'Iron Guard',    icon: '🛡️', desc: '+3 Base Defense permanently',  cost: 80,  type: 'mod' },
    { id: 'vamp', name: 'Vampiric Rune', icon: '🦇', desc: '+5% Life Steal on attacks',    cost: 100, type: 'mod' },
    { id: 'luck', name: 'Lucky Coin',    icon: '🪙', desc: '+5 Luck (better loot odds)',   cost: 150, type: 'mod' },
];
