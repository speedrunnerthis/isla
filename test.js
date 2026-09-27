const canvas = document.getElementById("snakeGame");
const ctx = canvas.getContext("2d");

// Game configuration
const gridSize = 20;
const tileCount = canvas.width / gridSize;
let speed = 7; // Game speed (frames per second)

// Game variables
let snake = [{ x: 10, y: 10 }];
let food = { x: 5, y: 5 };
let dx = 1; // Horizontal velocity
let dy = 0; // Vertical velocity
let score = 0;

// Main game loop
function drawGame() {
    moveSnake();
    
    if (checkGameOver()) {
        ctx.fillStyle = "white";
        ctx.font = "30px Arial";
        ctx.fillText("Game Over!", canvas.width / 4, canvas.height / 2);
        return; 
    }

    clearScreen();
    checkFoodCollision();
    drawFood();
    drawSnake();
    drawScore();

    setTimeout(drawGame, 1000 / speed);
}

// Clear canvas each frame
function clearScreen() {
    ctx.fillStyle = "#1c1c1c"; // Dark background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Draw the snake
function drawSnake() {
    ctx.fillStyle = "#4CAF50"; // Green snake
    for (let i = 0; i < snake.length; i++) {
        // Make the head a slightly different color
        ctx.fillStyle = i === 0 ? "#8BC34A" : "#4CAF50";
        ctx.fillRect(snake[i].x * gridSize, snake[i].y * gridSize, gridSize - 2, gridSize - 2);
    }
}

// Move snake forward
function moveSnake() {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    snake.unshift(head);
    snake.pop();
}

// Listen for keyboard arrow keys
window.addEventListener("keydown", changeDirection);

function changeDirection(event) {
    const keyPressed = event.keyCode;
    const goingUp = dy === -1;
    const goingDown = dy === 1;
    const goingRight = dx === 1;
    const goingLeft = dx === -1;

    if (keyPressed === 37 && !goingRight) { dx = -1; dy = 0; } // Left arrow
    if (keyPressed === 38 && !goingDown) { dx = 0; dy = -1; }  // Up arrow
    if (keyPressed === 39 && !goingLeft) { dx = 1; dy = 0; }   // Right arrow
    if (keyPressed === 40 && !goingUp) { dx = 0; dy = 1; }     // Down arrow
}

// Handle food mechanics
function drawFood() {
    ctx.fillStyle = "#FF5722"; // Red food
    ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);
}

function checkFoodCollision() {
    if (snake[0].x === food.x && snake[0].y === food.y) {
        score++;
        growSnake();
        generateFood();
        // Slightly increase speed as score goes up
        if (score % 3 === 0) speed++; 
    }
}

function growSnake() {
    const tail = { ...snake[snake.length - 1] };
    snake.push(tail);
}

function generateFood() {
    food.x = Math.floor(Math.random() * tileCount);
    food.y = Math.floor(Math.random() * tileCount);

    // Ensure food doesn't spawn inside the snake
    for (let part of snake) {
        if (part.x === food.x && part.y === food.y) {
            generateFood();
        }
    }
}

// Condition checking
function checkGameOver() {
    // Wall collisions
    if (snake[0].x < 0 || snake[0].x >= tileCount || snake[0].y < 0 || snake[0].y >= tileCount) {
        return true;
    }
    // Self collisions
    for (let i = 1; i < snake.length; i++) {
        if (snake[i].x === snake[0].x && snake[i].y === 0) return true;
        if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) {
            return true;
        }
    }
    return false;
}

function drawScore() {
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Score: " + score, 10, 20);
}

// Start the game
generateFood();
drawGame();
