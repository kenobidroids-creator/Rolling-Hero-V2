// ============================================================
//  PIXEL ART SPRITES
//  Sprites are defined as 8×8 palette-indexed grids.
//  drawSprite(canvas, spriteKey, scale) renders any sprite.
//  All sprites use index 0 = transparent.
// ============================================================


// ── Sprite definitions ───────────────────────────────────────
// p  = colour palette  (index 0 is always transparent/null)
// d  = flat 64-value array (row-major, 8 values per row)
const SPRITES = {

    // Knight hero — silver armour, red trim, gold visor
    hero: {
        p: [null, '#b8c8ff', '#e94560', '#0a0a22', '#ffcc00', '#8090cc'],
        d: [
            0,0,1,4,4,1,0,0,  // helmet crown + gold band
            0,1,1,4,4,1,1,0,  // visor
            0,1,5,3,3,5,1,0,  // shadowed eyes
            0,0,2,1,1,2,0,0,  // red neck guard
            0,2,1,1,1,1,2,0,  // chest plate shoulders
            2,1,1,2,2,1,1,2,  // torso + belt detail
            0,0,1,5,5,1,0,0,  // thighs
            0,1,1,0,0,1,1,0,  // boots
        ]
    },

    // Goblin enemy — sickly green, white eyes, dark outline
    enemy: {
        p: [null, '#6dbe6d', '#2d5a27', '#ffffff', '#0f1f0f', '#4ecca3'],
        d: [
            0,0,4,2,2,4,0,0,  // pointed ears
            0,4,2,1,1,2,4,0,  // head outline
            4,2,3,1,1,3,2,4,  // white glowing eyes
            0,4,1,2,2,1,4,0,  // snout
            0,4,2,1,1,2,4,0,  // torso
            4,2,1,4,4,1,2,4,  // ribs / mid-body
            0,4,2,0,0,2,4,0,  // legs
            4,2,0,0,0,0,2,4,  // feet/claws
        ]
    },

    // Demon boss — deep crimson, gold horns, fire-orange eyes
    boss: {
        p: [null, '#8b0000', '#ffcc00', '#ff6600', '#2d0000', '#cc2200'],
        d: [
            2,0,4,1,1,4,0,2,  // curved golden horns
            0,5,1,1,1,1,5,0,  // head
            5,2,3,1,1,3,2,5,  // fire-orange eyes
            5,1,1,4,4,1,1,5,  // snout / dark nostrils
            0,2,5,1,1,5,2,0,  // upper chest
            5,1,2,1,1,2,1,5,  // torso detail
            0,5,1,4,4,1,5,0,  // upper legs
            5,0,4,0,0,4,0,5,  // clawed feet
        ]
    },

    // Treasure chest — gold and brown
    chest: {
        p: [null, '#8b5e2a', '#ffcc00', '#5a3a10', '#ffe080', '#333'],
        d: [
            0,0,2,2,2,2,0,0,  // lid arc
            0,2,4,4,4,4,2,0,  // lid top
            2,4,2,2,2,2,4,2,  // lid front + latch
            2,1,1,2,2,1,1,2,  // box top edge
            1,1,1,1,1,1,1,1,  // box front
            1,2,1,1,1,1,2,1,  // corner bolts
            1,1,1,1,1,1,1,1,  // box base
            0,3,3,3,3,3,3,0,  // shadow
        ]
    },

    // Health cross — white + red
    cross: {
        p: [null, '#e94560', '#ffffff', '#aa2040', '#550010'],
        d: [
            0,0,0,2,2,0,0,0,
            0,0,2,2,2,2,0,0,
            0,2,1,1,1,1,2,0,
            2,2,1,2,2,1,2,2,
            2,2,1,2,2,1,2,2,
            0,2,1,1,1,1,2,0,
            0,0,2,2,2,2,0,0,
            0,0,0,2,2,0,0,0,
        ]
    },

    // Sword icon — for combat tiles
    sword: {
        p: [null, '#c0c8ff', '#888', '#ffcc00', '#555'],
        d: [
            0,0,0,0,0,0,3,3,  // pommel gold
            0,0,0,0,0,1,4,3,  // grip start
            0,0,0,0,1,4,0,0,  // grip
            0,0,0,1,4,0,0,0,  // blade start
            0,2,1,4,0,0,0,0,  // crossguard
            0,1,4,0,0,0,0,0,  // blade
            1,4,0,0,0,0,0,0,  // blade tip approach
            4,0,0,0,0,0,0,0,  // tip
        ]
    },
};


// ── Renderer ─────────────────────────────────────────────────
/**
 * Draw a named sprite onto a canvas element.
 * @param {HTMLCanvasElement} canvas  - target canvas
 * @param {string}            key     - key in SPRITES (e.g. 'hero')
 * @param {number}            [scale] - pixel size multiplier (default: auto from canvas width)
 */
function drawSprite(canvas, key, scale) {
    const sprite = SPRITES[key];
    if (!canvas || !sprite) return;

    const ctx   = canvas.getContext('2d');
    const dim   = 8;                                      // sprite is always 8×8
    const px    = scale || Math.floor(canvas.width / dim); // pixels per sprite-pixel

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    sprite.d.forEach((colorIdx, i) => {
        const color = sprite.p[colorIdx];
        if (!color) return; // transparent

        const row = Math.floor(i / dim);
        const col = i % dim;
        ctx.fillStyle = color;
        ctx.fillRect(col * px, row * px, px, px);
    });
}


// ── Convenience wrappers ─────────────────────────────────────
const drawHero   = (c, sc) => drawSprite(c, 'hero',   sc);
const drawEnemy  = (c, sc) => drawSprite(c, 'enemy',  sc);
const drawBoss   = (c, sc) => drawSprite(c, 'boss',   sc);
const drawChest  = (c, sc) => drawSprite(c, 'chest',  sc);
const drawCross  = (c, sc) => drawSprite(c, 'cross',  sc);
const drawSword  = (c, sc) => drawSprite(c, 'sword',  sc);
