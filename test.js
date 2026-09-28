const canvas = document.getElementById("snakeGame");
const ctx = canvas.getContext("2d");

const gridSize = 20;
const tileCount = canvas.width / gridSize;
let speed = 7;
let tickInterval = 1000 / speed;

// ---------- State machine ----------
const STATE_MENU = "menu";
const STATE_SETTINGS = "settings";
const STATE_MODES = "modes";
const STATE_CUSTOM = "customsnakes";
const STATE_COUNTDOWN = "countdown";
const STATE_PLAYING = "playing";
const STATE_GAMEOVER = "gameover";
let gameState = STATE_MENU;

let countdownStart = 0;
let buttons = [];

// ---------- Snake color ----------
const presetColors = ["#FF1744", "#FF9100", "#FFEA00", "#00E676", "#00E5FF", "#2979FF", "#D500F9", "#FFFFFF"];
let snakeColor = "#7CB342";

function shadeColor(hex, percent) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, Math.max(0, Math.round(r + (percent / 100) * 255)));
    g = Math.min(255, Math.max(0, Math.round(g + (percent / 100) * 255)));
    b = Math.min(255, Math.max(0, Math.round(b + (percent / 100) * 255)));
    return `rgb(${r},${g},${b})`;
}

function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = x => Math.round(255 * x).toString(16).padStart(2, "0");
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

// ---------- Custom snakes ----------
const RIKI_PHRASE = "RikiBawo";
let customSnake = null;

function textColorFor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 140 ? "#111111" : "#ffffff";
}

// ---------- Isla mode messages ----------
const ISLA_MESSAGES = [
    "You're so cute", "I love you", "You're beautiful",
    "You're baddd", "Love of my life", "You mean the world to me"
];
function randomIslaMessage() {
    return ISLA_MESSAGES[Math.floor(Math.random() * ISLA_MESSAGES.length)];
}

// ---------- Game modes ----------
const speedMap = { turtle: 4, normal: 7, fast: 11 };
let gameModes = {
    speed: "normal",
    explodingApples: false,
    rainingSwords: false,
    loveMode: false,
    turbo: false,
    spaceApples: false,
    islaMode: false
};

// ---------- Game variables ----------
let snake, prevSnake, food, dx, dy, score, applesEaten, gameOver;
let particles = [];
let spikes = [];
let treeApples = [];
let directionQueue = [];

const EXPLODE_TIME = 5000;

let swordTimer = 0;
const SWORD_BASE_INTERVAL = 4000;
const SWORD_MIN_INTERVAL = 1200;
let swordHazards = [];
let playElapsed = 0;

let rowSpikeTimer = 0;
let rowSpikeHazards = [];
const ROW_SPIKE_WARNING_TIME = 800;
const ROW_SPIKE_ACTIVE_TIME = 2000;

let loveMessage = null;

// ---------- Turbo state ----------
let shiftHeld = false;
let turboActive = false;
let turboHeldMs = 0;
let turboLossDebt = 0;
let turboTrailTimer = 0;

const trees = [
    { x: 0, y: 0 },
    { x: canvas.width, y: 0 },
    { x: 0, y: canvas.height },
    { x: canvas.width, y: canvas.height }
];

// ---------- Space background dressing ----------
const spaceStars = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 0.5 + Math.random() * 1.4,
    phase: Math.random() * Math.PI * 2,
    speed: 0.0015 + Math.random() * 0.0025
}));
const spacePlanets = [
    { x: 55, y: 55, r: 24, colorLight: "#ffe0b0", colorDark: "#9a5a1d", phase: 0.3, ring: false },
    { x: 345, y: 320, r: 17, colorLight: "#bfe9ff", colorDark: "#1c5c8a", phase: 2.1, ring: true },
    { x: 355, y: 70, r: 9, colorLight: "#ffd6e8", colorDark: "#a33b6a", phase: 4.0, ring: false }
];

function resetGame() {
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    prevSnake = snake.map(s => ({ ...s }));
    dx = 1;
    dy = 0;
    score = 0;
    applesEaten = 0;
    gameOver = false;
    speed = speedMap[gameModes.speed];
    tickInterval = 1000 / speed;
    particles = [];
    spikes = [];
    treeApples = [];
    directionQueue = [];
    swordTimer = 0;
    swordHazards = [];
    playElapsed = 0;
    rowSpikeTimer = 0;
    rowSpikeHazards = [];
    loveMessage = null;
    shiftHeld = false;
    turboActive = false;
    turboHeldMs = 0;
    turboLossDebt = 0;
    turboTrailTimer = 0;

    if (gameModes.spaceApples) {
        food = { x: Math.floor(Math.random() * tileCount), y: 0, yFloat: 0, spawnTime: performance.now() };
    } else {
        food = { x: 5, y: 5, spawnTime: performance.now() };
        generateFood();
        food.spawnTime = performance.now();
    }
}

// ---------- Main loop ----------
let lastTime = 0;
let accumulator = 0;
let frameNow = 0;

const menuStars = Array.from({ length: 40 }, () => ({
    x: Math.random() * 400,
    y: Math.random() * 400,
    r: 0.6 + Math.random() * 1.4,
    phase: Math.random() * Math.PI * 2,
    speed: 0.0015 + Math.random() * 0.002
}));

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const delta = timestamp - lastTime;
    lastTime = timestamp;
    frameNow = timestamp;

    turboActive = gameModes.turbo && shiftHeld && gameState === STATE_PLAYING && !gameOver;
    const effectiveTick = turboActive ? tickInterval / 1.7 : tickInterval;

    if (gameState === STATE_PLAYING && !gameOver) {
        accumulator += delta;
        while (accumulator >= effectiveTick) {
            updateGame();
            accumulator -= effectiveTick;
        }
        updateRealtime(delta);
    }

    updateParticles(delta);
    render(gameState === STATE_PLAYING && !gameOver ? accumulator / effectiveTick : 1);

    requestAnimationFrame(gameLoop);
}

function updateGame() {
    if (directionQueue.length) {
        const d = directionQueue.shift();
        dx = d.x;
        dy = d.y;
    }

    prevSnake = snake.map(s => ({ ...s }));
    moveSnake();

    if (checkGameOver()) {
        gameOver = true;
        gameState = STATE_GAMEOVER;
        return;
    }

    if (!gameModes.spaceApples) checkFoodCollision();
    checkSpikeCollision();
    checkTreeAppleCollision();
    checkSwordCollisionOnMove();
    checkRowSpikeCollision();
}

function updateRealtime(deltaMs) {
    const now = performance.now();

    if (gameModes.explodingApples && food && !gameModes.spaceApples) {
        if (now - food.spawnTime >= EXPLODE_TIME) {
            explodeFood();
        }
    }

    if (gameModes.spaceApples && food) {
        const fallSpeed = 1.1 + Math.min(score, 20) * 0.06;
        food.yFloat += (deltaMs / 1000) * fallSpeed;
        food.y = Math.min(tileCount - 1, Math.floor(food.yFloat));
        checkSpaceFoodCollision();
        if (food.yFloat >= tileCount) respawnSpaceFood();
    }

    if (gameModes.rainingSwords) {
        playElapsed += deltaMs;
        const speedUpSteps = Math.floor(playElapsed / 10000);
        const currentInterval = Math.max(SWORD_MIN_INTERVAL, SWORD_BASE_INTERVAL - speedUpSteps * 300);
        swordTimer += deltaMs;
        if (swordTimer >= currentInterval) {
            swordTimer = 0;
            const swordsPerWave = 1 + Math.floor(score / 4);
            spawnSwordWave(swordsPerWave);
        }
    }

    for (let i = swordHazards.length - 1; i >= 0; i--) {
        const h = swordHazards[i];
        h.elapsed += deltaMs;
        if (h.phase === "warning" && h.elapsed >= 1000) {
            h.phase = "impact";
            h.elapsed = 0;
            triggerSwordImpact(h);
        } else if (h.phase === "impact" && h.elapsed >= 550) {
            h.phase = "done";
        }
    }
    swordHazards = swordHazards.filter(h => h.phase !== "done");

    if (loveMessage) {
        loveMessage.elapsed += deltaMs;
        if (loveMessage.elapsed >= loveMessage.duration) loveMessage = null;
    }

    if (score > 5) {
        const stepsPast5 = Math.floor((score - 5) / 2);
        const rowSpikeInterval = Math.max(1500, 5000 - stepsPast5 * 500);
        rowSpikeTimer += deltaMs;
        if (rowSpikeTimer >= rowSpikeInterval) {
            rowSpikeTimer = 0;
            spawnRowSpikeHazard();
        }
    }

    for (let i = rowSpikeHazards.length - 1; i >= 0; i--) {
        const h = rowSpikeHazards[i];
        h.elapsed += deltaMs;
        if (h.phase === "warning" && h.elapsed >= ROW_SPIKE_WARNING_TIME) {
            h.phase = "active";
            h.elapsed = 0;
        } else if (h.phase === "active" && h.elapsed >= ROW_SPIKE_ACTIVE_TIME) {
            h.phase = "done";
        }
    }
    rowSpikeHazards = rowSpikeHazards.filter(h => h.phase !== "done");

    // ---- turbo debt / trail ----
    if (gameModes.turbo) {
        if (turboActive) {
            turboHeldMs += deltaMs;
            turboTrailTimer += deltaMs;
            if (turboTrailTimer >= 45) {
                turboTrailTimer = 0;
                const head = snake[0];
                const hx = head.x * gridSize + gridSize / 2;
                const hy = head.y * gridSize + gridSize / 2;
                particles.push({
                    x: hx - dx * gridSize * 0.4,
                    y: hy - dy * gridSize * 0.4,
                    vx: -dx * 40 + (Math.random() - 0.5) * 40,
                    vy: -dy * 40 + (Math.random() - 0.5) * 40,
                    life: 1,
                    decay: 2.6,
                    size: 3 + Math.random() * 3,
                    color: "255,152,0"
                });
            }
            if (turboHeldMs >= 3000) {
                turboHeldMs -= 3000;
                turboLossDebt += 1.5;
                while (turboLossDebt >= 1 && snake.length > 2) {
                    loseSquare();
                    turboLossDebt -= 1;
                }
            }
        } else {
            turboHeldMs = Math.max(0, turboHeldMs - deltaMs * 2);
        }
    }
}

// ---------- Rendering dispatch ----------
function render(alpha) {
    buttons = [];

    if (gameState === STATE_MENU) {
        clearScreen();
        renderMenu();
    } else if (gameState === STATE_SETTINGS) {
        clearScreen();
        renderSettings();
    } else if (gameState === STATE_MODES) {
        clearScreen();
        renderModes();
    } else if (gameState === STATE_CUSTOM) {
        clearScreen();
        renderCustomSnakes();
    } else if (gameState === STATE_COUNTDOWN) {
        clearGamePlayArea();
        renderGameBackground(1);
        renderCountdown();
    } else if (gameState === STATE_PLAYING) {
        clearGamePlayArea();
        renderGameBackground(alpha);
    } else if (gameState === STATE_GAMEOVER) {
        clearGamePlayArea();
        renderGameBackground(1);
        renderGameOverOverlay();
    }
}

function clearScreen() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#1c1c1c");
    grad.addColorStop(1, "#141414");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function clearGamePlayArea() {
    if (gameModes.spaceApples) {
        drawSpaceBackground();
    } else {
        for (let y = 0; y < tileCount; y++) {
            for (let x = 0; x < tileCount; x++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? "#1a1a1a" : "#242424";
                ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
            }
        }
    }
}

function drawSpaceBackground() {
    const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 20, canvas.width / 2, canvas.height / 2, canvas.width * 0.75);
    grad.addColorStop(0, "#0d1330");
    grad.addColorStop(1, "#00000a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const s of spaceStars) {
        const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(frameNow * s.speed + s.phase));
        ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    }

    for (const p of spacePlanets) {
        const px = p.x + Math.sin(frameNow * 0.00006 + p.phase) * 8;
        const py = p.y;
        if (p.ring) {
            ctx.save();
            ctx.strokeStyle = "rgba(220,220,255,0.35)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(px, py, p.r * 1.8, p.r * 0.6, -0.3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        const g = ctx.createRadialGradient(px - p.r * 0.3, py - p.r * 0.3, p.r * 0.1, px, py, p.r);
        g.addColorStop(0, p.colorLight);
        g.addColorStop(1, p.colorDark);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();
    }
}

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawHeart(cx, cy, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    const topCurveHeight = size * 0.3;
    ctx.moveTo(cx, cy + topCurveHeight);
    ctx.bezierCurveTo(cx, cy, cx - size / 2, cy, cx - size / 2, cy + topCurveHeight);
    ctx.bezierCurveTo(cx - size / 2, cy + (size + topCurveHeight) / 2, cx, cy + (size + topCurveHeight) / 2, cx, cy + size);
    ctx.bezierCurveTo(cx, cy + (size + topCurveHeight) / 2, cx + size / 2, cy + (size + topCurveHeight) / 2, cx + size / 2, cy + topCurveHeight);
    ctx.bezierCurveTo(cx + size / 2, cy, cx, cy, cx, cy + topCurveHeight);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawButton(x, y, w, h, label, action, fillColor) {
    ctx.save();
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, shadeColor(fillColor || "#2e7d32", 15));
    grad.addColorStop(1, fillColor || "#2e7d32");
    ctx.fillStyle = grad;
    roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.restore();

    buttons.push({ x, y, w, h, action });
}

// ---------- Menu ----------
function drawMenuStarfield() {
    for (const s of menuStars) {
        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frameNow * s.speed + s.phase));
        ctx.fillStyle = `rgba(255,255,255,${twinkle * 0.7})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawMenuSnake() {
    const segCount = 10;
    const t = frameNow * 0.0025;
    const baseY = 190 - 50;
    const travel = canvas.width + 60;
    const headX = ((t * 60) % travel) - 30;

    for (let i = segCount - 1; i >= 0; i--) {
        const segX = headX - i * 12;
        const segY = baseY + Math.sin((segX * 0.05) + t * 3) * 14;
        const size = i === 0 ? 12 : 10 - i * 0.3;
        const alpha = 0.85 - i * 0.05;

        ctx.save();
        ctx.globalAlpha = Math.max(0.15, alpha);
        ctx.fillStyle = i === 0 ? shadeColor(snakeColor, 25) : snakeColor;
        ctx.beginPath();
        ctx.arc(segX, segY, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function renderMenu() {
    drawMenuStarfield();
    drawMenuSnake();

    ctx.textAlign = "center";

    const pulse = 0.5 + 0.5 * Math.sin(frameNow * 0.0022);
    ctx.save();
    ctx.shadowColor = `rgba(124, 179, 66, ${0.5 + pulse * 0.4})`;
    ctx.shadowBlur = 18 + pulse * 10;

    const titleGrad = ctx.createLinearGradient(canvas.width / 2 - 120, 0, canvas.width / 2 + 120, 0);
    titleGrad.addColorStop(0, "#A5D66B");
    titleGrad.addColorStop(0.5, "#FFEB3B");
    titleGrad.addColorStop(1, "#7CB342");
    ctx.fillStyle = titleGrad;
    ctx.font = "bold 42px Arial";
    ctx.fillText("Isla Snake", canvas.width / 2, 110);
    ctx.restore();

    ctx.fillStyle = "#888";
    ctx.font = "13px Arial";
    ctx.fillText("made by 546564564", canvas.width / 2, 132);

    ctx.font = "16px Arial";
    ctx.fillStyle = "#aaa";
    ctx.fillText("Use arrow keys or WASD to move", canvas.width / 2, 160);

    const btnW = 160;
    const btnH = 44;
    const cx = canvas.width / 2 - btnW / 2;

    drawButton(cx, 200, btnW, btnH, "Play", () => {
        resetGame();
        countdownStart = performance.now();
        gameState = STATE_COUNTDOWN;
    }, "#43A047");

    drawButton(cx, 260, btnW, btnH, "Settings", () => {
        gameState = STATE_SETTINGS;
    }, "#546E7A");

    ctx.textAlign = "left";
}

// ---------- Settings (redesigned: color wheel, no overlap) ----------
function drawColorWheel(cx, cy, r) {
    const slices = 180;
    for (let i = 0; i < slices; i++) {
        const a0 = (i / slices) * Math.PI * 2;
        const a1 = ((i + 1) / slices) * Math.PI * 2;
        const hue = (i / slices) * 360;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, a0, a1);
        ctx.closePath();
        ctx.fillStyle = `hsl(${hue},85%,50%)`;
        ctx.fill();
    }
    const satGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    satGrad.addColorStop(0, "rgba(255,255,255,0.9)");
    satGrad.addColorStop(0.18, "rgba(255,255,255,0.45)");
    satGrad.addColorStop(0.55, "rgba(255,255,255,0)");
    ctx.fillStyle = satGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    const glossGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 0, cx - r * 0.35, cy - r * 0.35, r * 0.7);
    glossGrad.addColorStop(0, "rgba(255,255,255,0.35)");
    glossGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glossGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function renderSettings() {
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "bold 24px Arial";
    ctx.fillText("Settings", canvas.width / 2, 30);

    ctx.font = "14px Arial";
    ctx.fillStyle = "#ccc";
    ctx.fillText("Tap the wheel to pick a color", canvas.width / 2, 50);
    ctx.textAlign = "left";

    const wheelCx = canvas.width / 2;
    const wheelCy = 108;
    const wheelR = 44;
    drawColorWheel(wheelCx, wheelCy, wheelR);

    buttons.push({
        x: wheelCx - wheelR, y: wheelCy - wheelR, w: wheelR * 2, h: wheelR * 2,
        action: (clickX, clickY) => {
            const ddx = clickX - wheelCx, ddy = clickY - wheelCy;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dist > wheelR) return;
            let angle = Math.atan2(ddy, ddx);
            if (angle < 0) angle += Math.PI * 2;
            const hue = (angle * 180) / Math.PI;
            const satFactor = Math.min(1, dist / wheelR);
            const sat = 15 + satFactor * 75;
            snakeColor = hslToHex(hue, sat, 50);
        }
    });

    // current color preview chip
    ctx.save();
    ctx.fillStyle = snakeColor;
    roundRect(wheelCx + wheelR + 14, wheelCy - 14, 28, 28, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // preset swatch row
    const swatchSize = 30;
    const gap = 8;
    const gridW = presetColors.length * swatchSize + (presetColors.length - 1) * gap;
    const startX = (canvas.width - gridW) / 2;
    const swatchY = 166;

    presetColors.forEach((color, i) => {
        const x = startX + i * (swatchSize + gap);
        ctx.save();
        ctx.fillStyle = color;
        roundRect(x, swatchY, swatchSize, swatchSize, 6);
        ctx.fill();
        if (color === snakeColor) {
            ctx.strokeStyle = "#FFEB3B";
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = "rgba(255,255,255,0.4)";
            ctx.lineWidth = 1.5;
        }
        ctx.stroke();
        ctx.restore();

        buttons.push({
            x, y: swatchY, w: swatchSize, h: swatchSize,
            action: () => { snakeColor = color; }
        });
    });

    const btnW = 190;
    const btnH = 38;
    const cx = canvas.width / 2 - btnW / 2;

    drawButton(cx, 208, btnW, btnH, "Mini-Games", () => {
        gameState = STATE_MODES;
    }, "#8E24AA");

    drawButton(cx, 254, btnW, btnH, "Custom Snakes", () => {
        gameState = STATE_CUSTOM;
    }, "#3949AB");

    drawButton(cx, 300, btnW, btnH, "Back", () => {
        gameState = STATE_MENU;
    }, "#546E7A");
}

// ---------- Custom snakes ----------
function renderCustomSnakes() {
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Custom Snakes", canvas.width / 2, 30);

    ctx.font = "13px Arial";
    ctx.fillStyle = "#ccc";
    ctx.fillText("Special skins with hidden messages", canvas.width / 2, 52);
    ctx.textAlign = "left";

    const btnW = 220;
    const btnH = 46;
    const cx = canvas.width / 2 - btnW / 2;

    drawButton(cx, 90, btnW, btnH, "Riki Snake", () => {
        customSnake = customSnake === "riki" ? null : "riki";
    }, customSnake === "riki" ? "#3949AB" : "#3a3a3a");

    ctx.fillStyle = "#888";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(customSnake === "riki" ? "On \u2014 segments spell a message" : "Off", canvas.width / 2, 150);
    ctx.textAlign = "left";

    drawButton(canvas.width / 2 - 75, 190, 150, 34, "Back", () => {
        gameState = STATE_SETTINGS;
    }, "#546E7A");
}

// ---------- Mini-game / mode select ----------
function renderModes() {
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Mini-Games", canvas.width / 2, 26);
    ctx.textAlign = "left";

    const btnW = 320;
    const btnH = 30;
    const cx = canvas.width / 2 - btnW / 2;
    let y = 42;

    ctx.fillStyle = "#ccc";
    ctx.font = "12px Arial";
    ctx.fillText("Speed", cx, y + 10);
    y += 15;

    const speedW = (btnW - 16) / 3;
    ["turtle", "normal", "fast"].forEach((s, i) => {
        const sx = cx + i * (speedW + 8);
        const active = gameModes.speed === s;
        drawButton(sx, y, speedW, btnH, s[0].toUpperCase() + s.slice(1), () => {
            gameModes.speed = s;
        }, active ? "#43A047" : "#3a3a3a");
    });
    y += btnH + 12;

    const toggles = [
        ["explodingApples", "Exploding Apples", "#E64A19"],
        ["rainingSwords", "Raining Swords", "#1976D2"],
        ["loveMode", "Love Mode", "#D81B60"],
        ["turbo", "Turbo (hold Shift)", "#FB8C00"],
        ["spaceApples", "Space Apples", "#5E35B1"],
        ["islaMode", "Isla Mode", "#EC407A"]
    ];

    toggles.forEach(([key, label, color]) => {
        drawButton(cx, y, btnW, btnH, label + ": " + (gameModes[key] ? "On" : "Off"), () => {
            gameModes[key] = !gameModes[key];
        }, gameModes[key] ? color : "#3a3a3a");
        y += btnH + 7;
    });

    y += 6;
    drawButton(canvas.width / 2 - 75, y, 150, 34, "Back", () => {
        gameState = STATE_SETTINGS;
    }, "#546E7A");
}

// ---------- Countdown ----------
function renderCountdown() {
    const elapsed = performance.now() - countdownStart;
    const fraction = Math.max(0, 1 - elapsed / 1000);

    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${0.18 * fraction})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (elapsed >= 1000) {
        gameState = STATE_PLAYING;
        lastTime = 0;
        accumulator = 0;
        food.spawnTime = performance.now();
    }
}

// ---------- Playing background ----------
function renderGameBackground(alpha) {
    if (!gameModes.spaceApples) drawTrees();
    drawSpikes();
    drawRowSpikeHazards();
    drawSwordHazards();
    drawFood();
    if (!gameModes.spaceApples) drawTreeApples();
    drawSnake(alpha);
    drawParticlesToCanvas();
    drawVignette();
    drawScore();
    drawTurboUI();
    drawLoveMessage();
}

function drawVignette() {
    const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width * 0.32, canvas.width / 2, canvas.height / 2, canvas.width * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawTurboUI() {
    if (!gameModes.turbo) return;
    const barW = 90, barH = 9, x = canvas.width - barW - 10, y = 10;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    roundRect(x, y, barW, barH, 4);
    ctx.fill();
    const fillW = Math.min(1, turboHeldMs / 3000) * barW;
    ctx.fillStyle = turboActive ? "#FF9800" : "#607D8B";
    roundRect(x, y, fillW, barH, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    roundRect(x, y, barW, barH, 4);
    ctx.stroke();
    ctx.fillStyle = turboActive ? "#FFB74D" : "#aaa";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "right";
    ctx.fillText(turboActive ? "TURBO" : "Hold Shift", x + barW, y + 21);
    ctx.textAlign = "left";
    ctx.restore();
}

function renderGameOverOverlay() {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "bold 32px Arial";
    ctx.fillText("Game Over!", canvas.width / 2, canvas.height / 2 - 60);

    ctx.font = "18px Arial";
    ctx.fillText("Score: " + score, canvas.width / 2, canvas.height / 2 - 25);
    ctx.textAlign = "left";

    const btnW = 160;
    const btnH = 44;
    const cx = canvas.width / 2 - btnW / 2;

    drawButton(cx, canvas.height / 2, btnW, btnH, "Play Again", () => {
        resetGame();
        countdownStart = performance.now();
        gameState = STATE_COUNTDOWN;
    }, "#43A047");

    drawButton(cx, canvas.height / 2 + 60, btnW, btnH, "Main Menu", () => {
        gameState = STATE_MENU;
    }, "#546E7A");
}

// ---------- Click handling ----------
canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;

    for (const btn of buttons) {
        if (clickX >= btn.x && clickX <= btn.x + btn.w &&
            clickY >= btn.y && clickY <= btn.y + btn.h) {
            btn.action(clickX, clickY);
            break;
        }
    }
});

// ---------- Snake ----------
function drawSnake(alpha) {
    for (let i = snake.length - 1; i >= 0; i--) {
        const cur = snake[i];
        const prev = prevSnake[i] || cur;

        let ix = prev.x + (cur.x - prev.x) * alpha;
        let iy = prev.y + (cur.y - prev.y) * alpha;
        if (Math.abs(cur.x - prev.x) > 1) ix = cur.x;
        if (Math.abs(cur.y - prev.y) > 1) iy = cur.y;

        const size = gridSize;
        const px = ix * gridSize - (size - gridSize) / 2;
        const py = iy * gridSize - (size - gridSize) / 2;

        if (i === 0) {
            ctx.save();
            ctx.shadowColor = turboActive ? "rgba(255,152,0,0.8)" : "rgba(255,255,255,0.4)";
            ctx.shadowBlur = turboActive ? 16 : 8;
            const grad = ctx.createLinearGradient(px, py, px + size, py + size);
            grad.addColorStop(0, shadeColor(snakeColor, 25));
            grad.addColorStop(1, snakeColor);
            ctx.fillStyle = grad;
            roundRect(px, py, size, size, 6);
            ctx.fill();
            ctx.restore();

            if (customSnake === "riki") {
                drawRikiLetter(i, px, py, size);
            } else {
                drawFace(px, py, size);
            }
        } else {
            ctx.fillStyle = i % 2 === 0 ? shadeColor(snakeColor, -10) : shadeColor(snakeColor, -20);
            roundRect(px, py, size, size, 4);
            ctx.fill();

            if (customSnake === "riki") {
                drawRikiLetter(i, px, py, size);
            }
        }
    }
}

function drawRikiLetter(i, px, py, size) {
    const ch = i < RIKI_PHRASE.length ? RIKI_PHRASE[i] : null;
    if (!ch || ch === " ") return;
    ctx.save();
    ctx.fillStyle = textColorFor(snakeColor);
    ctx.font = "bold " + Math.floor(size * 0.55) + "px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ch, px + size / 2, py + size / 2 + 1);
    ctx.restore();
}

function drawFace(px, py, size) {
    const dirX = dx;
    const dirY = dy;

    const cx = px + size / 2;
    const cy = py + size / 2;

    const perpX = -dirY;
    const perpY = dirX;

    const eyeOffset = size * 0.22;
    const eyeForward = size * 0.15;

    const eye1x = cx + dirX * eyeForward + perpX * eyeOffset;
    const eye1y = cy + dirY * eyeForward + perpY * eyeOffset;
    const eye2x = cx + dirX * eyeForward - perpX * eyeOffset;
    const eye2y = cy + dirY * eyeForward - perpY * eyeOffset;

    if (gameModes.loveMode) {
        const heartSize = size * 0.3;
        drawHeart(eye1x, eye1y - heartSize * 0.4, heartSize, "#FF1744");
        drawHeart(eye2x, eye2y - heartSize * 0.4, heartSize, "#FF1744");
    } else {
        const eyeR = size * 0.14;
        const pupilR = size * 0.07;

        ctx.fillStyle = snakeColor === "#FFFFFF" ? "#eee" : "white";
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(eye1x, eye1y, eyeR, 0, Math.PI * 2);
        ctx.arc(eye2x, eye2y, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.arc(eye1x + dirX * pupilR * 0.6, eye1y + dirY * pupilR * 0.6, pupilR, 0, Math.PI * 2);
        ctx.arc(eye2x + dirX * pupilR * 0.6, eye2y + dirY * pupilR * 0.6, pupilR, 0, Math.PI * 2);
        ctx.fill();
    }

    const mouthX = cx + dirX * size * 0.35;
    const mouthY = cy + dirY * size * 0.35;
    const mouthLen = size * 0.28;

    ctx.strokeStyle = "#1b1b1b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (dirX !== 0) {
        ctx.moveTo(mouthX, mouthY - mouthLen / 2);
        ctx.lineTo(mouthX, mouthY + mouthLen / 2);
    } else {
        ctx.moveTo(mouthX - mouthLen / 2, mouthY);
        ctx.lineTo(mouthX + mouthLen / 2, mouthY);
    }
    ctx.stroke();
}

function moveSnake() {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    snake.unshift(head);
    snake.pop();
}

document.addEventListener("keydown", changeDirection);
document.addEventListener("keydown", (event) => {
    if (event.key === "Shift") shiftHeld = true;
});
document.addEventListener("keyup", (event) => {
    if (event.key === "Shift") shiftHeld = false;
});

function changeDirection(event) {
    const keyPressed = event.keyCode;

    if ([37, 38, 39, 40].includes(keyPressed)) {
        event.preventDefault();
    }

    if (gameState !== STATE_PLAYING) return;

    let newDir = null;
    if (keyPressed === 37 || keyPressed === 65) newDir = { x: -1, y: 0 };
    else if (keyPressed === 38 || keyPressed === 87) newDir = { x: 0, y: -1 };
    else if (keyPressed === 39 || keyPressed === 68) newDir = { x: 1, y: 0 };
    else if (keyPressed === 40 || keyPressed === 83) newDir = { x: 0, y: 1 };
    if (!newDir) return;

    const last = directionQueue.length ? directionQueue[directionQueue.length - 1] : { x: dx, y: dy };
    if (newDir.x === -last.x && newDir.y === -last.y) return;
    if (newDir.x === last.x && newDir.y === last.y) return;

    if (directionQueue.length < 2) {
        directionQueue.push(newDir);
    }
}

// ---------- Food ----------
function drawFood() {
    const px = food.x * gridSize + gridSize / 2;
    const py = food.y * gridSize + gridSize / 2;
    const r = gridSize / 2 - 3;

    if (gameModes.loveMode) {
        drawHeart(px, py - r * 0.3, r * 1.7, "#FF4081");
    } else {
        ctx.save();
        ctx.shadowColor = "rgba(255, 87, 34, 0.7)";
        ctx.shadowBlur = 10;
        const grad = ctx.createRadialGradient(px - r / 3, py - r / 3, r / 4, px, py, r);
        grad.addColorStop(0, "#FFAB91");
        grad.addColorStop(1, "#FF5722");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = "#4CAF50";
        ctx.beginPath();
        ctx.ellipse(px + r * 0.3, py - r, r * 0.35, r * 0.18, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
    }

    if (gameModes.explodingApples && !gameModes.spaceApples) {
        const elapsed = performance.now() - food.spawnTime;
        const fraction = Math.max(0, 1 - elapsed / EXPLODE_TIME);
        const ringR = r + 6;
        ctx.save();
        ctx.strokeStyle = fraction > 0.3 ? "#FFEB3B" : "#FF1744";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, ringR, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

function checkFoodCollision() {
    if (snake[0].x === food.x && snake[0].y === food.y) {
        score++;
        applesEaten++;
        growSnake();
        spawnSplash(food.x, food.y, gameModes.loveMode);
        generateFood();
        food.spawnTime = performance.now();

        if (score % 3 === 0) {
            speed = speedMap[gameModes.speed] + Math.floor(score / 3);
            tickInterval = 1000 / speed;
            spawnSpike();
        }

        if (applesEaten % 2 === 0) {
            dropTreeApple();
        }

        if (gameModes.islaMode) {
            loveMessage = { text: randomIslaMessage(), elapsed: 0, duration: 1600 };
        } else if (gameModes.loveMode) {
            loveMessage = { text: "Isla loves you +" + applesEaten + " more", elapsed: 0, duration: 1600 };
        }
    }
}

function checkSpaceFoodCollision() {
    for (const seg of snake) {
        if (seg.x === food.x && seg.y === food.y) {
            score++;
            applesEaten++;
            growSnake();
            spawnSplash(food.x, food.y, gameModes.loveMode);
            respawnSpaceFood();
            if (score % 3 === 0) {
                speed = speedMap[gameModes.speed] + Math.floor(score / 3);
                tickInterval = 1000 / speed;
                spawnSpike();
            }
            if (gameModes.islaMode) {
                loveMessage = { text: randomIslaMessage(), elapsed: 0, duration: 1600 };
            } else if (gameModes.loveMode) {
                loveMessage = { text: "Isla loves you +" + applesEaten + " more", elapsed: 0, duration: 1600 };
            }
            break;
        }
    }
}

function respawnSpaceFood() {
    food.x = Math.floor(Math.random() * tileCount);
    food.y = 0;
    food.yFloat = 0;
    food.spawnTime = performance.now();
}

function explodeFood() {
    spawnSplash(food.x, food.y, false, true);
    const headDist = Math.abs(snake[0].x - food.x) + Math.abs(snake[0].y - food.y);
    if (headDist <= 1) loseSquare();
    generateFood();
    food.spawnTime = performance.now();
}

function growSnake() {
    const tail = { ...snake[snake.length - 1] };
    snake.push(tail);
    prevSnake.push({ ...tail });
}

function generateFood() {
    food.x = Math.floor(Math.random() * tileCount);
    food.y = Math.floor(Math.random() * tileCount);
    if (isOccupied(food.x, food.y)) generateFood();
}

function isOccupied(x, y) {
    if (snake.some(part => part.x === x && part.y === y)) return true;
    if (spikes.some(s => s.x === x && s.y === y)) return true;
    if (treeApples.some(a => a.x === x && a.y === y)) return true;
    return false;
}

// ---------- Corner trees + tree-dropped apples ----------
function drawTrees() {
    const treeSize = gridSize * 1.8;
    for (const t of trees) {
        ctx.save();
        const dirX = t.x === 0 ? 1 : -1;
        const dirY = t.y === 0 ? 1 : -1;
        const cx = t.x + dirX * treeSize * 0.35;
        const cy = t.y + dirY * treeSize * 0.35;

        ctx.fillStyle = "#6D4C41";
        ctx.fillRect(cx - treeSize * 0.08, cy - treeSize * 0.1, treeSize * 0.16, treeSize * 0.4);

        ctx.fillStyle = "#2E7D32";
        ctx.beginPath();
        ctx.arc(cx, cy - treeSize * 0.15, treeSize * 0.32, 0, Math.PI * 2);
        ctx.arc(cx - treeSize * 0.22, cy - treeSize * 0.05, treeSize * 0.24, 0, Math.PI * 2);
        ctx.arc(cx + treeSize * 0.22, cy - treeSize * 0.05, treeSize * 0.24, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

function dropTreeApple() {
    const corner = trees[Math.floor(Math.random() * trees.length)];
    const cellX = corner.x === 0 ? 0 : tileCount - 1;
    const cellY = corner.y === 0 ? 0 : tileCount - 1;

    let apple = { x: cellX, y: cellY };

    let attempts = 0;
    while (isOccupied(apple.x, apple.y) && attempts < 10) {
        apple = {
            x: Math.min(tileCount - 1, Math.max(0, cellX + (corner.x === 0 ? 1 : -1) * attempts)),
            y: Math.min(tileCount - 1, Math.max(0, cellY + (corner.y === 0 ? 1 : -1) * attempts))
        };
        attempts++;
    }

    treeApples.push(apple);
}

function drawTreeApples() {
    for (const a of treeApples) {
        const px = a.x * gridSize + gridSize / 2;
        const py = a.y * gridSize + gridSize / 2;
        const r = gridSize / 2 - 4;

        if (gameModes.loveMode) {
            drawHeart(px, py - r * 0.2, r * 1.5, "#F06292");
            continue;
        }

        ctx.save();
        ctx.shadowColor = "rgba(255, 235, 59, 0.7)";
        ctx.shadowBlur = 8;
        const grad = ctx.createRadialGradient(px - r / 3, py - r / 3, r / 4, px, py, r);
        grad.addColorStop(0, "#FFF59D");
        grad.addColorStop(1, "#FBC02D");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function checkTreeAppleCollision() {
    for (let i = treeApples.length - 1; i >= 0; i--) {
        const a = treeApples[i];
        if (snake[0].x === a.x && snake[0].y === a.y) {
            score++;
            growSnake();
            spawnSplash(a.x, a.y, gameModes.loveMode);
            treeApples.splice(i, 1);
            if (gameModes.islaMode) {
                loveMessage = { text: randomIslaMessage(), elapsed: 0, duration: 1600 };
            } else if (gameModes.loveMode) {
                applesEaten++;
                loveMessage = { text: "Isla loves you +" + applesEaten + " more", elapsed: 0, duration: 1600 };
            }
        }
    }
}

// ---------- VFX: splash particles ----------
function spawnSplash(gridX, gridY, isLove, isExplosion) {
    const centerX = gridX * gridSize + gridSize / 2;
    const centerY = gridY * gridSize + gridSize / 2;
    const particleCount = isExplosion ? 26 : 14;
    const baseColor = isExplosion ? "255, 87, 34" : (isLove ? "244, 67, 143" : "255, 87, 34");
    const speedMul = isExplosion ? 140 : 60;

    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.3;
        const speedPx = (1.2 + Math.random() * 1.8) * speedMul;
        particles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speedPx,
            vy: Math.sin(angle) * speedPx,
            life: 1.0,
            decay: (isExplosion ? 1.6 : 1.2) + Math.random() * 0.6,
            size: (isExplosion ? 4 : 2.5) + Math.random() * 2.5,
            color: baseColor
        });
    }
}

function updateParticles(deltaMs) {
    const dt = deltaMs / 1000;
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= p.decay * dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticlesToCanvas() {
    for (const p of particles) {
        ctx.fillStyle = `rgba(${p.color}, ${Math.max(p.life, 0)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * Math.max(p.life, 0), 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---------- Spikes ----------
function spawnSpike() {
    const wall = Math.floor(Math.random() * 4);
    let spike;

    if (wall === 0) spike = { x: Math.floor(Math.random() * tileCount), y: 0, side: "top" };
    else if (wall === 1) spike = { x: Math.floor(Math.random() * tileCount), y: tileCount - 1, side: "bottom" };
    else if (wall === 2) spike = { x: 0, y: Math.floor(Math.random() * tileCount), side: "left" };
    else spike = { x: tileCount - 1, y: Math.floor(Math.random() * tileCount), side: "right" };

    if (isOccupied(spike.x, spike.y) || spikes.some(s => s.x === spike.x && s.y === spike.y)) {
        spawnSpike();
        return;
    }

    spikes.push(spike);
}

function drawSpikeTriangle(cx, cy, r, side) {
    ctx.beginPath();
    if (side === "left") {
        ctx.moveTo(cx + r, cy);
        ctx.lineTo(cx - r, cy - r);
        ctx.lineTo(cx - r, cy + r);
    } else if (side === "right") {
        ctx.moveTo(cx - r, cy);
        ctx.lineTo(cx + r, cy - r);
        ctx.lineTo(cx + r, cy + r);
    } else if (side === "top") {
        ctx.moveTo(cx, cy + r);
        ctx.lineTo(cx - r, cy - r);
        ctx.lineTo(cx + r, cy - r);
    } else {
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx - r, cy + r);
        ctx.lineTo(cx + r, cy + r);
    }
    ctx.closePath();
}

function drawSpikes() {
    for (const s of spikes) {
        const cx = s.x * gridSize + gridSize / 2;
        const cy = s.y * gridSize + gridSize / 2;
        const r = gridSize / 2 - 2;

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        grad.addColorStop(0, "#ECEFF1");
        grad.addColorStop(1, "#90A4AE");
        ctx.fillStyle = grad;
        drawSpikeTriangle(cx, cy, r, s.side);
        ctx.fill();
        ctx.restore();
    }
}

function checkSpikeCollision() {
    const head = snake[0];
    for (let i = 0; i < spikes.length; i++) {
        if (spikes[i].x === head.x && spikes[i].y === head.y) {
            spikes.splice(i, 1);
            loseSquare();
            break;
        }
    }
}

// ---------- Raining swords ----------
function spawnSwordWave(count) {
    const usedCells = swordHazards.map(h => h.x + "," + h.y);
    let placed = 0;
    let attempts = 0;

    while (placed < count && attempts < count * 20) {
        attempts++;
        const x = Math.floor(Math.random() * tileCount);
        const y = Math.floor(Math.random() * tileCount);
        const key = x + "," + y;
        if (usedCells.includes(key)) continue;
        usedCells.push(key);
        swordHazards.push({ x, y, phase: "warning", elapsed: 0 });
        placed++;
    }
}

function triggerSwordImpact(hazard) {
    const cx = hazard.x * gridSize + gridSize / 2;
    const cy = hazard.y * gridSize + gridSize / 2;

    for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        const speedPx = 180 + Math.random() * 80;
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speedPx,
            vy: Math.sin(angle) * speedPx,
            life: 1.0,
            decay: 2.2,
            size: 3 + Math.random() * 2,
            color: "144, 202, 249"
        });
    }

    if (snake[0].x === hazard.x && snake[0].y === hazard.y) loseSquare();
}

function checkSwordCollisionOnMove() {
    const head = snake[0];
    for (const h of swordHazards) {
        if (h.phase === "impact" && h.elapsed < 550 && h.x === head.x && h.y === head.y && !h.hitApplied) {
            h.hitApplied = true;
            loseSquare();
        }
    }
}

function drawSwordHazards() {
    for (const h of swordHazards) {
        const cx = h.x * gridSize + gridSize / 2;
        const cy = h.y * gridSize + gridSize / 2;

        if (h.phase === "warning") {
            const pulse = 0.5 + 0.5 * Math.sin(h.elapsed / 90);
            ctx.save();
            ctx.strokeStyle = `rgba(255, 23, 68, ${0.4 + pulse * 0.5})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, gridSize * 0.6, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = "rgba(255, 23, 68, 0.85)";
            ctx.font = "bold 16px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("!", cx, cy);
            ctx.restore();
        } else if (h.phase === "impact") {
            const t = h.elapsed / 550;
            ctx.save();
            for (let ring = 0; ring < 2; ring++) {
                const ringT = Math.min(1, t + ring * 0.2);
                const radius = ringT * 70;
                ctx.strokeStyle = `rgba(144, 202, 249, ${Math.max(0, 1 - ringT)})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();

            ctx.save();
            const bladeW = gridSize * 0.9;
            const bladeTopY = -60;
            const bladeBottomY = cy + gridSize * 0.3;
            const grad = ctx.createLinearGradient(cx - bladeW / 2, bladeTopY, cx + bladeW / 2, bladeBottomY);
            grad.addColorStop(0, "#BBDEFB");
            grad.addColorStop(0.5, "#2196F3");
            grad.addColorStop(1, "#0D47A1");
            ctx.fillStyle = grad;
            ctx.shadowColor = "rgba(33,150,243,0.8)";
            ctx.shadowBlur = 20;

            ctx.beginPath();
            ctx.moveTo(cx - bladeW / 2, bladeTopY);
            ctx.lineTo(cx + bladeW / 2, bladeTopY);
            ctx.lineTo(cx + bladeW / 2, bladeBottomY - gridSize * 0.6);
            ctx.lineTo(cx, bladeBottomY);
            ctx.lineTo(cx - bladeW / 2, bladeBottomY - gridSize * 0.6);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = "#78909C";
            ctx.fillRect(cx - bladeW, bladeBottomY - gridSize * 0.9, bladeW * 2, gridSize * 0.2);
            ctx.restore();
        }
    }
}

function loseSquare() {
    if (snake.length > 1) {
        snake.pop();
        prevSnake.pop();
    }
}

// ---------- Full row/column spike hazard ----------
function spawnRowSpikeHazard() {
    const orientation = Math.random() < 0.5 ? "row" : "col";
    const index = Math.floor(Math.random() * tileCount);
    rowSpikeHazards.push({ orientation, index, phase: "warning", elapsed: 0, hitApplied: false });
}

function drawRowSpikeHazards() {
    for (const h of rowSpikeHazards) {
        if (h.orientation === "row") {
            const y = h.index * gridSize;
            if (h.phase === "warning") {
                const pulse = 0.5 + 0.5 * Math.sin(h.elapsed / 80);
                ctx.fillStyle = `rgba(255, 23, 68, ${0.15 + pulse * 0.25})`;
                ctx.fillRect(0, y, canvas.width, gridSize);
                ctx.strokeStyle = `rgba(255, 23, 68, ${0.5 + pulse * 0.5})`;
                ctx.lineWidth = 2;
                ctx.strokeRect(0, y, canvas.width, gridSize);
            } else if (h.phase === "active") {
                ctx.save();
                ctx.shadowColor = "rgba(255, 23, 68, 0.8)";
                ctx.shadowBlur = 12;
                for (let x = 0; x < tileCount; x++) {
                    const cx = x * gridSize + gridSize / 2;
                    const cy = y + gridSize / 2;
                    const r = gridSize / 2 - 2;
                    const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
                    grad.addColorStop(0, "#FF8A80");
                    grad.addColorStop(1, "#D50000");
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - r);
                    ctx.lineTo(cx - r, cy + r);
                    ctx.lineTo(cx + r, cy + r);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            }
        } else {
            const x = h.index * gridSize;
            if (h.phase === "warning") {
                const pulse = 0.5 + 0.5 * Math.sin(h.elapsed / 80);
                ctx.fillStyle = `rgba(255, 23, 68, ${0.15 + pulse * 0.25})`;
                ctx.fillRect(x, 0, gridSize, canvas.height);
                ctx.strokeStyle = `rgba(255, 23, 68, ${0.5 + pulse * 0.5})`;
                ctx.lineWidth = 2;
                ctx.strokeRect(x, 0, gridSize, canvas.height);
            } else if (h.phase === "active") {
                ctx.save();
                ctx.shadowColor = "rgba(255, 23, 68, 0.8)";
                ctx.shadowBlur = 12;
                for (let y = 0; y < tileCount; y++) {
                    const cx = x + gridSize / 2;
                    const cy = y * gridSize + gridSize / 2;
                    const r = gridSize / 2 - 2;
                    const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
                    grad.addColorStop(0, "#FF8A80");
                    grad.addColorStop(1, "#D50000");
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.moveTo(cx - r, cy);
                    ctx.lineTo(cx + r, cy - r);
                    ctx.lineTo(cx + r, cy + r);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            }
        }
    }
}

function checkRowSpikeCollision() {
    const head = snake[0];
    for (const h of rowSpikeHazards) {
        if (h.phase !== "active") continue;
        const hit = h.orientation === "row" ? head.y === h.index : head.x === h.index;
        if (hit && !h.hitApplied) {
            h.hitApplied = true;
            loseSquare();
        }
    }
}

// ---------- Love message ----------
function drawLoveMessage() {
    if (!loveMessage) return;
    const fraction = 1 - loveMessage.elapsed / loveMessage.duration;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, fraction * 1.5));
    ctx.fillStyle = "#FF4081";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(loveMessage.text, canvas.width / 2, 40);
    ctx.restore();
    ctx.textAlign = "left";
}

// ---------- Game over check ----------
function checkGameOver() {
    if (snake[0].x < 0 || snake[0].x >= tileCount || snake[0].y < 0 || snake[0].y >= tileCount) return true;
    for (let i = 1; i < snake.length; i++) {
        if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) return true;
    }
    return false;
}

function drawScore() {
    ctx.fillStyle = "white";
    ctx.font = "bold 16px Arial";
    ctx.fillText("Score: " + score, 10, 20);
}

// ---------- Start ----------
resetGame();
requestAnimationFrame(gameLoop);


