
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const levelElement = document.getElementById("level");
const livesElement = document.getElementById("lives");
const bestElement = document.getElementById("best");

const overlay = document.getElementById("overlay");
const message = document.getElementById("message");
const description = document.getElementById("description");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const soundBtn = document.getElementById("soundBtn");
const motionBtn = document.getElementById("motionBtn");

let gameState = "start";
let score = 0;
let level = 1;
let lives = 3;

let bestScore = Number(localStorage.getItem("starBest")) || 0;
let soundEnabled = localStorage.getItem("starSound") !== "false";
let reducedMotion = localStorage.getItem("starMotion") === "true";

let stars = [];
let particles = [];
let lastTime = 0;
let spawnTimer = 0;
let animationId = null;
let audioContext = null;

const basket = {
    x: 260,
    y: 350,
    width: 80,
    height: 20,
    speed: 6
};

const keys = {
    left: false,
    right: false
};

bestElement.textContent = bestScore;
updateSettingsButtons();

function drawBackground() {
    ctx.fillStyle = "#101a3a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 35; i++) {
        const x = (i * 83) % canvas.width;
        const y = (i * 47) % canvas.height;
        ctx.fillRect(x, y, 2, 2);
    }
}

function drawBasket() {
    ctx.fillStyle = "#ffb703";
    ctx.fillRect(
        basket.x,
        basket.y,
        basket.width,
        basket.height
    );

    ctx.fillStyle = "#fb8500";
    ctx.fillRect(
        basket.x + 8,
        basket.y + 5,
        basket.width - 16,
        basket.height
    );
}

function drawStars() {
    stars.forEach(star => {
        ctx.font = `${star.radius * 2}px Arial`;
        ctx.fillStyle = "#ffd43b";
        ctx.textAlign = "center";
        ctx.fillText("★", star.x, star.y);
    });
}

function drawParticles() {
    particles.forEach(particle => {
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = "#ffd43b";
        ctx.fillRect(
            particle.x,
            particle.y,
            4,
            4
        );
        ctx.globalAlpha = 1;
    });
}

function draw() {
    drawBackground();
    drawStars();
    drawBasket();
    drawParticles();
}

function createStar() {
    stars.push({
        x: Math.random() * (canvas.width - 30) + 15,
        y: -20,
        radius: 15,
        speed: 2 + level * 0.7
    });
}

function createParticles(x, y) {
    if (reducedMotion) return;

    for (let i = 0; i < 8; i++) {
        particles.push({
            x,
            y,
            life: 1,
            dx: Math.random() * 4 - 2,
            dy: Math.random() * 4 - 2
        });
    }
}

function updateParticles(factor) {
    particles.forEach(p => {
        p.x += p.dx * factor;
        p.y += p.dy * factor;
        p.life -= 0.025 * factor;
    });

    particles = particles.filter(p => p.life > 0);
}

function playSound(frequency, duration = 0.12) {
    if (!soundEnabled) return;

    try {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        if (!audioContext) {
            audioContext = new AudioContextClass();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.frequency.value = frequency;
        oscillator.type = "sine";

        gain.gain.setValueAtTime(0.12, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
        console.warn("Audio is not available:", error);
    }
}

function updateUI() {
    scoreElement.textContent = score;
    levelElement.textContent = level;
    livesElement.textContent = lives;
    bestElement.textContent = bestScore;
}

function updateScore() {
    score += 10;

    const newLevel = Math.floor(score / 100) + 1;
    level = Math.min(newLevel, 3);

    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("starBest", bestScore);
    }

    updateUI();

    if (score >= 300) {
        endGame("win");
    }
}

function updateStars(deltaTime) {
    spawnTimer += deltaTime;

    const spawnInterval = Math.max(350, 1000 - level * 180);

    if (spawnTimer >= spawnInterval) {
        createStar();
        spawnTimer = 0;
    }

    const factor = deltaTime / 16.67;
    const remainingStars = [];

    for (const star of stars) {
        star.y += star.speed * factor;

        const caught =
            star.y + star.radius >= basket.y &&
            star.y - star.radius <= basket.y + basket.height &&
            star.x >= basket.x &&
            star.x <= basket.x + basket.width;

        if (caught) {
            createParticles(star.x, star.y);
            updateScore();
            playSound(700);

            if (gameState !== "playing") break;
            continue;
        }

        if (star.y - star.radius > canvas.height) {
            lives = Math.max(0, lives - 1);
            updateUI();

            if (lives === 0) {
                endGame("lose");
                break;
            }
            continue;
        }

        remainingStars.push(star);
    }

    stars = gameState === "playing" ? remainingStars : [];
}

function updateBasket() {
    if (keys.left) {
        basket.x -= basket.speed;
    }

    if (keys.right) {
        basket.x += basket.speed;
    }

    basket.x = Math.max(
        0,
        Math.min(canvas.width - basket.width, basket.x)
    );
}

function gameLoop(timestamp) {
    if (gameState !== "playing") return;

    const deltaTime = Math.min(timestamp - lastTime || 16.67, 50);
    lastTime = timestamp;

    updateBasket();
    updateStars(deltaTime);
    updateParticles(deltaTime / 16.67);
    draw();

    if (gameState === "playing") {
        animationId = requestAnimationFrame(gameLoop);
    }
}

function startGame() {
    score = 0;
    level = 1;
    lives = 3;
    stars = [];
    particles = [];
    spawnTimer = 0;

    basket.x = (canvas.width - basket.width) / 2;

    updateUI();
    gameState = "playing";
    lastTime = 0;

    overlay.classList.add("hidden");
    pauseBtn.textContent = "Pause";

    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(gameLoop);
}

function pauseGame() {
    if (gameState === "playing") {
        gameState = "paused";
        cancelAnimationFrame(animationId);

        message.textContent = "Game Paused";
        description.textContent = "Take a break!";
        startBtn.textContent = "Resume";
        overlay.classList.remove("hidden");
        pauseBtn.textContent = "Resume";
    } else if (gameState === "paused") {
        gameState = "playing";
        overlay.classList.add("hidden");
        pauseBtn.textContent = "Pause";
        lastTime = 0;
        animationId = requestAnimationFrame(gameLoop);
    }
}

function endGame(result) {
    gameState = result;
    cancelAnimationFrame(animationId);

    if (result === "win") {
        message.textContent = "🎉 You Won!";
        description.textContent =
            `Congratulations! Your score is ${score}.`;
        playSound(1000, 0.3);
    } else {
        message.textContent = "Game Over!";
        description.textContent =
            `Your final score is ${score}.`;
        playSound(200, 0.4);
    }

    startBtn.textContent = "Play Again";
    overlay.classList.remove("hidden");
    pauseBtn.textContent = "Pause";
    draw();
}

startBtn.addEventListener("click", () => {
    if (gameState === "paused") {
        pauseGame();
    } else {
        startGame();
    }
});

pauseBtn.addEventListener("click", () => {
    if (gameState === "playing" || gameState === "paused") {
        pauseGame();
    }
});

document.addEventListener("keydown", event => {
    if (
        ["ArrowLeft", "ArrowRight", " "].includes(event.key)
    ) {
        event.preventDefault();
    }

    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        keys.left = true;
    }

    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        keys.right = true;
    }

    if (event.code === "Space" && !event.repeat) {
        if (gameState === "playing" || gameState === "paused") {
            pauseGame();
        }
    }
});

document.addEventListener("keyup", event => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        keys.left = false;
    }

    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        keys.right = false;
    }
});

function addTouchControl(button, direction) {
    button.addEventListener("pointerdown", event => {
        event.preventDefault();
        keys[direction] = true;
    });

    ["pointerup", "pointerleave", "pointercancel"].forEach(type => {
        button.addEventListener(type, () => {
            keys[direction] = false;
        });
    });
}

addTouchControl(document.getElementById("leftBtn"), "left");
addTouchControl(document.getElementById("rightBtn"), "right");

soundBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem("starSound", soundEnabled);
    updateSettingsButtons();

    if (soundEnabled) playSound(700);
});

motionBtn.addEventListener("click", () => {
    reducedMotion = !reducedMotion;
    localStorage.setItem("starMotion", reducedMotion);
    updateSettingsButtons();

    if (reducedMotion) particles = [];
});

function updateSettingsButtons() {
    soundBtn.textContent = soundEnabled ? "Sound: ON" : "Sound: OFF";

    motionBtn.textContent = reducedMotion
        ? "Reduced Motion: ON"
        : "Reduced Motion: OFF";
}

draw();
updateUI();