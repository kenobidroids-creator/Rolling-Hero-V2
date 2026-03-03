// ============================================================
//  LOOT SELECTION
//  After defeating an enemy the player is shown 3 random item
//  cards and can equip one to a slot or sell it for gold.
//
//  Interaction model:
//    Desktop → hover card to preview stats  |  drag OR click+slot to equip
//    Mobile  → tap card to select & preview |  tap matching slot to equip
//
//  Equipment is slot-based (weapon / shield / boots / cloak).
//  recalcStats() is called after any equip to keep derived
//  stats (state.atk etc.) in sync with the base + gear totals.
// ============================================================

let _choices      = [];   // current 3-item offer
let _selectedIdx  = null; // index of the card the player has tapped/selected
let _compareTimer = null; // timeout id for tap-hold on mobile

const SLOT_LABELS = { weapon: 'WEAPON', shield: 'SHIELD', boots: 'BOOTS', cloak: 'CLOAK' };
const SLOT_DEFAULT_ICONS = { weapon: '⚔️', shield: '🛡️', boots: '🥾', cloak: '🧥' };

// ── Item generation ──────────────────────────────────────────
/**
 * Build a fully-scaled item object from a base template + rarity.
 */
function generateItem() {
    const rarity = rollRarity();
    const base   = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
    return {
        name:        `${rarity.label} ${base.name}`,
        icon:         base.icon,
        slot:         base.slot,
        rarity:       rarity.label,
        rarityColor:  rarity.color,
        atkBoost:     Math.floor(base.atk   * state.floor * rarity.mult),
        hpBoost:      Math.floor(base.hp    * state.floor * rarity.mult),
        defBoost:     Math.floor(base.def   * (1 + state.floor * 0.1) * rarity.mult),
        dodgeBoost:   Math.floor(base.dodge * rarity.mult),
        vampBoost:    0,
        sellValue:    Math.floor(15 * state.floor * rarity.mult),
    };
}

/**
 * Generate `count` distinct-slot loot choices.
 * Attempts to offer different slots when possible.
 */
function generateLootChoices(count = 3) {
    const choices = [];
    const usedSlots = new Set();
    let attempts = 0;
    while (choices.length < count && attempts < 20) {
        attempts++;
        const item = generateItem();
        // Prefer unique slots but don't block forever
        if (!usedSlots.has(item.slot) || attempts > 12) {
            choices.push(item);
            usedSlots.add(item.slot);
        }
    }
    return choices;
}

// ── Stat comparison builder ──────────────────────────────────
/**
 * Returns the inner HTML for a stat-comparison panel.
 * Shows current equipped item stats vs the incoming item.
 */
function buildComparisonHTML(item) {
    const current = state.equipment[item.slot];
    const rows = [
        { key: 'atkBoost',   label: 'ATK',   sym: '⚔️'  },
        { key: 'hpBoost',    label: 'HP',    sym: '❤️'  },
        { key: 'defBoost',   label: 'DEF',   sym: '🛡️' },
        { key: 'dodgeBoost', label: 'DODGE', sym: '💨'  },
    ];

    let rowsHTML = '';
    rows.forEach(({ key, label, sym }) => {
        const nv = item[key]    || 0;
        const cv = current ? (current[key] || 0) : 0;
        if (nv === 0 && cv === 0) return;
        const diff  = nv - cv;
        const color = diff > 0 ? '#4ecca3' : diff < 0 ? '#e94560' : '#aaa';
        const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '─';
        rowsHTML += `
            <div class="cmp-row">
                <span>${sym} ${label}</span>
                <span class="cmp-vals">
                    <span class="cmp-curr">${cv > 0 ? '+'+cv : cv}</span>
                    <span class="cmp-arrow" style="color:${color}">${arrow}</span>
                    <span class="cmp-new" style="color:${color}">+${nv}</span>
                </span>
            </div>`;
    });

    const currentName = current
        ? `<span style="color:${current.rarityColor || '#aaa'}">${current.name}</span>`
        : `<span class="cmp-empty-slot">Empty slot</span>`;

    return `
        <div class="cmp-slot-label">${SLOT_LABELS[item.slot]} SLOT</div>
        <div class="cmp-current-gear">Now: ${currentName}</div>
        <div class="cmp-divider"></div>
        ${rowsHTML || '<div class="cmp-no-change">No stat changes</div>'}
        <div class="cmp-sell-note">Sell value: ${item.sellValue}💰</div>`;
}

// ── Card builder ─────────────────────────────────────────────
function buildCard(item, index) {
    const card = document.createElement('div');
    card.className      = 'loot-card';
    card.draggable      = true;
    card.dataset.index  = index;
    card.dataset.slot   = item.slot;

    const statLines = [
        item.atkBoost   > 0 ? `ATK+${item.atkBoost}`   : null,
        item.hpBoost    > 0 ? `HP+${item.hpBoost}`     : null,
        item.defBoost   > 0 ? `DEF+${item.defBoost}`   : null,
        item.dodgeBoost > 0 ? `DODGE+${item.dodgeBoost}` : null,
    ].filter(Boolean).join('  ');

    card.innerHTML = `
        <div class="loot-card-rarity" style="color:${item.rarityColor}; border-color:${item.rarityColor}40">
            ${item.rarity}
        </div>
        <div class="loot-card-icon">${item.icon}</div>
        <div class="loot-card-name" style="color:${item.rarityColor}">${item.name}</div>
        <div class="loot-card-slot-badge">→ ${SLOT_LABELS[item.slot]}</div>
        <div class="loot-card-stats">${statLines || 'No bonuses'}</div>`;

    // ── Desktop hover ──
    card.addEventListener('mouseenter', () => _showComparison(index, card));
    card.addEventListener('mouseleave', () => {
        if (_selectedIdx !== index) _hideComparison();
    });

    // ── Click / tap to select ──
    card.addEventListener('click', () => _selectCard(index, card));

    // ── Touch hold to show comparison without selecting ──
    card.addEventListener('touchstart', () => {
        _compareTimer = setTimeout(() => _showComparison(index, card), 380);
    }, { passive: true });
    card.addEventListener('touchend',  () => clearTimeout(_compareTimer));
    card.addEventListener('touchmove', () => clearTimeout(_compareTimer));

    // ── HTML5 drag (desktop + some mobile browsers) ──
    card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('loot-index', index);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('loot-card--dragging');
        _hideComparison();
    });
    card.addEventListener('dragend', () => {
        card.classList.remove('loot-card--dragging');
    });

    return card;
}

// ── Card selection state ─────────────────────────────────────
function _selectCard(index, cardEl) {
    if (_selectedIdx === index) {
        // Deselect on second tap
        cardEl.classList.remove('loot-card--selected');
        _selectedIdx = null;
        _hideComparison();
        return;
    }
    document.querySelectorAll('.loot-card--selected').forEach(c => c.classList.remove('loot-card--selected'));
    cardEl.classList.add('loot-card--selected');
    _selectedIdx = index;
    _showComparison(index, cardEl);
}

// ── Comparison tooltip positioning ───────────────────────────
function _showComparison(itemIndex, anchorEl) {
    const item    = _choices[itemIndex];
    const tooltip = document.getElementById('stat-comparison');
    if (!item || !tooltip) return;

    tooltip.innerHTML    = buildComparisonHTML(item);
    tooltip.style.display = 'block';

    // Position: try to the right of the card, fall back to left
    const anchor = anchorEl.getBoundingClientRect();
    const panel  = document.getElementById('loot-selection').getBoundingClientRect();
    const tW     = 200; // tooltip estimated width

    let left = anchor.right - panel.left + 8;
    if (left + tW > panel.width - 8) {
        left = anchor.left - panel.left - tW - 8;
    }
    left = Math.max(4, Math.min(left, panel.width - tW - 4));

    const top = Math.max(4, anchor.top - panel.top);
    tooltip.style.left = left + 'px';
    tooltip.style.top  = top  + 'px';
}

function _hideComparison() {
    const t = document.getElementById('stat-comparison');
    if (t) t.style.display = 'none';
}

// ── Equipment slot renderer ───────────────────────────────────
function renderEquipmentSlots() {
    const container = document.getElementById('equipment-slots');
    container.innerHTML = '';

    Object.keys(SLOT_LABELS).forEach(slotKey => {
        const equipped = state.equipment[slotKey];
        const slot = document.createElement('div');
        slot.className    = 'equip-slot';
        slot.dataset.slot = slotKey;

        slot.innerHTML = `
            <div class="equip-slot-icon">${equipped ? equipped.icon : SLOT_DEFAULT_ICONS[slotKey]}</div>
            <div class="equip-slot-name">${SLOT_LABELS[slotKey]}</div>
            <div class="equip-slot-item ${equipped ? '' : 'equip-slot-empty'}"
                 style="color:${equipped ? (equipped.rarityColor || '#aaa') : ''}">
                ${equipped ? equipped.name : 'Empty'}
            </div>`;

        // ── Click to equip selected card into this slot ──
        slot.addEventListener('click', () => {
            if (_selectedIdx === null) return;
            const item = _choices[_selectedIdx];
            if (!item) return;
            if (item.slot !== slotKey) {
                // Wrong slot — flash red
                slot.classList.add('equip-slot--wrong');
                setTimeout(() => slot.classList.remove('equip-slot--wrong'), 500);
                return;
            }
            _doEquip(item, _selectedIdx);
        });

        // ── Drag-over highlighting ──
        slot.addEventListener('dragover', e => {
            e.preventDefault();
            const idx  = parseInt(e.dataTransfer.getData('loot-index') ?? -1);
            const item = _choices[idx];
            if (item && item.slot === slotKey) {
                slot.classList.add('equip-slot--highlight');
            }
        });
        slot.addEventListener('dragleave', () => {
            slot.classList.remove('equip-slot--highlight');
        });
        slot.addEventListener('drop', e => {
            e.preventDefault();
            slot.classList.remove('equip-slot--highlight');
            const idx  = parseInt(e.dataTransfer.getData('loot-index'));
            const item = _choices[idx];
            if (item && item.slot === slotKey) {
                _doEquip(item, idx);
            }
        });

        container.appendChild(slot);
    });
}

// ── Equip action ─────────────────────────────────────────────
function _doEquip(item, cardIndex) {
    // Trade-in: give 50 % sell value for whatever was in the slot
    const current = state.equipment[item.slot];
    if (current) state.gold += Math.floor(current.sellValue * 0.5);

    state.equipment[item.slot] = item;
    recalcStats();

    // Remove the used card
    _choices.splice(cardIndex, 1);
    _selectedIdx = null;
    _hideComparison();

    SaveManager.saveGame(state);
    updateUI();

    if (_choices.length === 0) {
        closeLootSelection();
        return;
    }
    // Re-render with remaining choices
    _renderChoices();
    renderEquipmentSlots();
}

// ── Sell action ───────────────────────────────────────────────
function sellLootCard(index) {
    const item = _choices[index];
    if (!item) return;
    state.gold += item.sellValue;
    _choices.splice(index, 1);
    _selectedIdx = null;
    _hideComparison();
    SaveManager.saveGame(state);
    updateUI();
    if (_choices.length === 0) { closeLootSelection(); return; }
    _renderChoices();
    renderEquipmentSlots();
}

// ── Open / close ─────────────────────────────────────────────
function openLootSelection(items) {
    _choices     = items || generateLootChoices(3);
    _selectedIdx = null;
    _hideComparison();

    _renderChoices();
    renderEquipmentSlots();

    document.getElementById('loot-selection').style.display = 'flex';
}

function _renderChoices() {
    const grid = document.getElementById('loot-cards');
    grid.innerHTML = '';
    _choices.forEach((item, i) => {
        const card = buildCard(item, i);

        // Sell button inside each card
        const sellBtn = document.createElement('button');
        sellBtn.className   = 'loot-card-sell-btn';
        sellBtn.textContent = `Sell ${item.sellValue}💰`;
        sellBtn.onclick     = (e) => { e.stopPropagation(); sellLootCard(i); };
        card.appendChild(sellBtn);

        grid.appendChild(card);
    });
}

function closeLootSelection() {
    document.getElementById('loot-selection').style.display    = 'none';
    document.getElementById('battle-screen').style.display     = 'none';
    _hideComparison();
    _choices     = [];
    _selectedIdx = null;
    state.isMoving = false;
    SaveManager.saveGame(state);
    updateUI();
}
