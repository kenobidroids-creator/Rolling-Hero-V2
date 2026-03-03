// ============================================================
//  MINI-GAMES
//  Three tile-triggered mini-games inspired by Heroll:
//
//  EVENT  tile → random story event (buff, debuff, or gold)
//  GAMBLE tile → Card Flip: pick 1 of 3 face-down cards
//  FORGE  tile → spend gold to upgrade an equipped item's ATK
//
//  All mini-games use a shared modal (#minigame-modal).
// ============================================================

// ── Shared modal helpers ─────────────────────────────────────
function _openMG(html) {
    document.getElementById('minigame-body').innerHTML = html;
    document.getElementById('minigame-modal').style.display = 'flex';
}
function closeMiniGame() {
    document.getElementById('minigame-modal').style.display = 'none';
    state.isMoving = false;
    SaveManager.saveGame(state);
    updateUI();
}

// ── EVENT tile ───────────────────────────────────────────────
// 10 possible story events with a variety of outcomes.
const EVENTS = [
    {
        icon: '⛩️', title: 'Ancient Shrine',
        desc: 'You kneel before the ancient stones. A warm light washes over you.',
        fn: () => { const h = 20 + state.floor * 3; state.hp = Math.min(state.hp + h, state.maxHp); return `+${h} HP restored`; }
    },
    {
        icon: '💀', title: 'Cursed Idol',
        desc: 'You reach for the idol… it bites.',
        fn: () => { const d = 10 + state.floor * 2; state.hp = Math.max(1, state.hp - d); return `-${d} HP (cursed)`; }
    },
    {
        icon: '💰', title: 'Forgotten Stash',
        desc: 'Behind a loose stone you find someone else\'s gold.',
        fn: () => { const g = 15 + state.floor * 5; state.gold += g; return `+${g} gold`; }
    },
    {
        icon: '⚡', title: 'Power Surge',
        desc: 'Lightning courses through your veins. You feel invincible — briefly.',
        fn: () => { state.baseAtk += 2; recalcStats(); return '+2 Base ATK (permanent)'; }
    },
    {
        icon: '🌿', title: 'Healing Herb',
        desc: 'A rare herb grows in the dungeon cracks. You chew it without asking questions.',
        fn: () => { const h = 30; state.hp = Math.min(state.hp + h, state.maxHp); return `+${h} HP`; }
    },
    {
        icon: '🧪', title: 'Mysterious Vial',
        desc: 'You drink the unlabelled potion. Always a good idea.',
        fn: () => { state.potions += 1; return '+1 Potion added'; }
    },
    {
        icon: '🪤', title: 'Trap!',
        desc: 'A pressure plate. You spotted it just a moment too late.',
        fn: () => { const d = 8 + state.floor * 2; state.hp = Math.max(1, state.hp - d); return `-${d} HP (trap damage)`; }
    },
    {
        icon: '🔮', title: 'Seer\'s Vision',
        desc: 'A spectral seer reveals the dungeon\'s secrets to you. Your luck improves.',
        fn: () => { state.luck += 3; return '+3 Luck (better loot)'; }
    },
    {
        icon: '🛡️', title: 'Iron Blessing',
        desc: 'The spirit of a fallen warrior grants you resilience.',
        fn: () => { state.baseDef += 1; recalcStats(); return '+1 Base DEF (permanent)'; }
    },
    {
        icon: '🎁', title: 'Mystery Gift',
        desc: 'A box with no markings. It could be anything. It\'s a potion.',
        fn: () => { state.potions += 1; const g = 10; state.gold += g; return `+1 Potion, +${g} gold`; }
    },
];

function triggerEvent() {
    const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    const result = ev.fn(); // apply effect immediately

    _openMG(`
        <div class="mg-event">
            <div class="mg-icon">${ev.icon}</div>
            <div class="mg-title">${ev.title}</div>
            <p class="mg-desc">${ev.desc}</p>
            <div class="mg-result">${result}</div>
            <button class="pixel-btn pixel-btn--teal full-btn" onclick="closeMiniGame()">CONTINUE</button>
        </div>`);
}

// ── GAMBLE tile — Card Flip ───────────────────────────────────
// 3 face-down cards: one GOLD, one TRAP, one EMPTY.
// Player picks one — revealed immediately.
let _cardRevealed = false;

function triggerGamble() {
    _cardRevealed = false;
    const betBase = 10 + state.floor * 5;

    // Shuffle outcomes
    const outcomes = [
        { type: 'gold',  icon: '💰', label: 'GOLD!',    msg: `+${betBase * 2} gold!`,  fn: () => { state.gold += betBase * 2; } },
        { type: 'trap',  icon: '💀', label: 'TRAP!',    msg: `-${Math.floor(state.maxHp * .15)} HP`,
          fn: () => { state.hp = Math.max(1, state.hp - Math.floor(state.maxHp * .15)); } },
        { type: 'empty', icon: '💨', label: 'NOTHING',  msg: 'Better luck next time.', fn: () => {} },
    ].sort(() => Math.random() - .5);

    function renderCards(revealIdx = -1) {
        return outcomes.map((o, i) => {
            const revealed = revealIdx === i;
            const flipped  = revealIdx >= 0; // all cards flip after pick
            return `<div class="mg-card ${revealed ? 'mg-card--' + o.type : flipped ? 'mg-card--back' : ''}"
                         onclick="${!flipped ? `_pickCard(${i})` : ''}">
                ${revealed ? `<div class="mg-card-icon">${o.icon}</div>
                              <div class="mg-card-label">${o.label}</div>` 
                           : `<div class="mg-card-back">?</div>`}
            </div>`;
        }).join('');
    }

    // expose pickCard globally so onclick works
    window._pickCard = function(idx) {
        if (_cardRevealed) return;
        _cardRevealed = true;
        outcomes[idx].fn();
        document.getElementById('mg-cards').innerHTML = renderCards(idx);
        document.getElementById('mg-result').textContent = outcomes[idx].msg;
        document.getElementById('mg-result').style.display = 'block';
        document.getElementById('mg-continue').style.display = 'block';
        SaveManager.saveGame(state);
        updateUI();
    };

    _openMG(`
        <div class="mg-gamble">
            <div class="mg-icon">🎰</div>
            <div class="mg-title">CARD FLIP</div>
            <p class="mg-desc">Pick one card. One hides gold, one holds a trap, one is empty.</p>
            <div id="mg-cards" class="mg-cards-row">${renderCards()}</div>
            <div id="mg-result" class="mg-result" style="display:none"></div>
            <button id="mg-continue" class="pixel-btn pixel-btn--teal full-btn"
                    style="display:none" onclick="closeMiniGame()">CONTINUE</button>
        </div>`);
}

// ── FORGE tile — Item Upgrade ────────────────────────────────
// Spend gold to permanently boost an equipped item.
// Only weapon and shield can be forged (ATK / DEF boost).
const FORGE_COST_BASE = 40;

function triggerForge() {
    const forgeCost = FORGE_COST_BASE + state.floor * 10;

    // Build option rows for each forgeable equipped item
    const slots = ['weapon', 'shield', 'boots', 'cloak'];
    let optionsHTML = '';

    slots.forEach(slot => {
        const item = state.equipment[slot];
        const boostKey  = slot === 'weapon' ? 'atkBoost' : slot === 'shield' ? 'defBoost'
                        : slot === 'boots'  ? 'dodgeBoost' : 'hpBoost';
        const boostLabel = slot === 'weapon' ? '+2 ATK'  : slot === 'shield' ? '+2 DEF'
                         : slot === 'boots'  ? '+2 DODGE': '+5 HP';
        const canAfford  = state.gold >= forgeCost;
        const hasItem    = !!item;

        optionsHTML += `
            <div class="forge-row ${(!hasItem || !canAfford) ? 'forge-row--disabled' : ''}">
                <div class="forge-slot-info">
                    <span class="forge-slot-icon">${item ? item.icon : '○'}</span>
                    <div>
                        <div class="forge-slot-name">${slot.toUpperCase()}</div>
                        <div class="forge-slot-item" style="color:${item ? item.rarityColor || '#aaa' : '#303060'}">
                            ${item ? item.name : 'Empty slot'}
                        </div>
                    </div>
                </div>
                <button class="pixel-btn pixel-btn--gold"
                        ${(!hasItem || !canAfford) ? 'disabled' : ''}
                        onclick="_forgeSlot('${slot}','${boostKey}')">
                    ${boostLabel}<br><span style="font-size:.35rem;color:#ffcc0099">${forgeCost}💰</span>
                </button>
            </div>`;
    });

    const canAffordAny = state.gold >= forgeCost &&
        slots.some(s => !!state.equipment[s]);

    _openMG(`
        <div class="mg-forge">
            <div class="mg-icon">🔨</div>
            <div class="mg-title">THE FORGE</div>
            <p class="mg-desc">Spend gold to permanently upgrade equipped gear.</p>
            <div class="mg-gold-display">Your gold: <b>${state.gold}</b>💰</div>
            ${!canAffordAny ? '<p class="mg-no-gold">Not enough gold — come back richer.</p>' : ''}
            <div class="forge-options">${optionsHTML}</div>
            <button class="pixel-btn pixel-btn--grey full-btn" onclick="closeMiniGame()">LEAVE FORGE</button>
        </div>`);

    window._forgeSlot = function(slot, boostKey) {
        if (state.gold < forgeCost) return;
        if (!state.equipment[slot]) return;

        state.gold -= forgeCost;
        state.equipment[slot][boostKey] = (state.equipment[slot][boostKey] || 0) + (boostKey === 'hpBoost' ? 5 : 2);
        recalcStats();
        SaveManager.saveGame(state);

        // Re-render the forge modal with updated values
        triggerForge();
    };
}
