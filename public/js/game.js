// Game Engine - Main game loop with FPS/UPS control
class GameEngine {
    constructor(config = {}) {
        // Configuration
        this.targetFPS = config.targetFPS || 60;        // Frames per second (rendering)
        this.targetUPS = config.targetUPS || 60;        // Updates per second (logic)
        this.maxFrameSkip = config.maxFrameSkip || 5;    // Maximum updates per frame
        
        // Physics configuration
        this.config = {
            gravity: config.gravity || 9.81,           // Gravity in m/s² (Earth: 9.81)
            pixelsPerMeter: config.pixelsPerMeter || 100, // Scale: pixels per meter
            taxiStartX: config.taxiStartX || 0.5,      // Starting X position (0-1)
            taxiStartY: config.taxiStartY || 0.2,      // Starting Y position (0-1)
            thrusterForce: config.thrusterForce || 1500,  // Thruster force in pixels/s² (strong enough to overcome gravity)
            regularFlightThrust: config.regularFlightThrust || 500,  // Constant upward thrust in regular flight mode (slows fall, weaker than W thrust)
            hoverThrust: config.hoverThrust || null,     // Hover thrust in pixels/s² (null = auto-calculate to match gravity)
            hoverDamping: config.hoverDamping || 800,     // Hover damping force in pixels/s² (slows vertical velocity to zero)
            aiBotCount: config.aiBotCount || 2            // Number of AI bots to spawn
        };
        
        // Timing
        this.frameTime = 1000 / this.targetFPS;          // Time per frame in ms
        this.updateTime = 1000 / this.targetUPS;         // Time per update in ms
        this.lastFrameTime = 0;
        this.lastUpdateTime = 0;
        this.accumulator = 0;                             // Accumulated time for updates
        
        // State
        this.isRunning = false;
        this.isPaused = false;
        this.frameId = null;
        
        // Stats (optional, for debugging)
        this.stats = {
            fps: 0,
            ups: 0,
            frameCount: 0,
            updateCount: 0,
            lastStatsTime: 0
        };
        
        // Game state callbacks
        this.onUpdate = null;    // Called every update cycle
        this.onRender = null;    // Called every render cycle
        this.onInit = null;      // Called when game starts
        this.onPause = null;     // Called when game pauses
        this.onResume = null;    // Called when game resumes
        this.onStop = null;      // Called when game stops
    }
    
    // Start the game loop
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        this.lastFrameTime = performance.now();
        this.lastUpdateTime = this.lastFrameTime;
        this.accumulator = 0;
        this.resetStats();
        
        // Initialize game
        if (this.onInit) {
            this.onInit();
        }
        
        // Start the loop
        this.gameLoop(this.lastFrameTime);
    }
    
    // Stop the game loop
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        
        if (this.onStop) {
            this.onStop();
        }
    }
    
    // Pause the game loop
    pause() {
        if (!this.isRunning || this.isPaused) return;
        this.isPaused = true;
        if (this.onPause) {
            this.onPause();
        }
    }
    
    // Resume the game loop
    resume() {
        if (!this.isRunning || !this.isPaused) return;
        this.isPaused = false;
        this.lastFrameTime = performance.now();
        this.lastUpdateTime = this.lastFrameTime;
        if (this.onResume) {
            this.onResume();
        }
    }
    
    // Main game loop
    gameLoop(currentTime) {
        if (!this.isRunning) return;
        
        this.frameId = requestAnimationFrame((time) => this.gameLoop(time));
        
        if (this.isPaused) return;
        
        // Calculate delta time
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        // Update stats
        this.updateStats(deltaTime);
        
        // Accumulate time for updates
        this.accumulator += deltaTime;
        
        // Perform updates (with frame skipping protection)
        let updateCount = 0;
        while (this.accumulator >= this.updateTime && updateCount < this.maxFrameSkip) {
            if (this.onUpdate) {
                this.onUpdate(this.updateTime / 1000); // Pass delta in seconds
            }
            this.accumulator -= this.updateTime;
            this.stats.updateCount++;
            updateCount++;
        }
        
        // If we're lagging too much, reset accumulator to prevent spiral of death
        if (this.accumulator > this.updateTime * this.maxFrameSkip) {
            this.accumulator = this.updateTime * this.maxFrameSkip;
        }
        
        // Render (interpolate if needed for smooth rendering)
        if (this.onRender) {
            const alpha = this.accumulator / this.updateTime; // Interpolation factor
            this.onRender(alpha);
        }
        this.stats.frameCount++;
    }
    
    // Update performance stats
    updateStats(deltaTime) {
        const now = performance.now();
        const elapsed = now - this.stats.lastStatsTime;
        
        if (elapsed >= 1000) { // Update stats every second
            this.stats.fps = Math.round((this.stats.frameCount * 1000) / elapsed);
            this.stats.ups = Math.round((this.stats.updateCount * 1000) / elapsed);
            this.stats.frameCount = 0;
            this.stats.updateCount = 0;
            this.stats.lastStatsTime = now;
        }
    }
    
    // Reset stats
    resetStats() {
        this.stats.fps = 0;
        this.stats.ups = 0;
        this.stats.frameCount = 0;
        this.stats.updateCount = 0;
        this.stats.lastStatsTime = performance.now();
    }
    
    // Get current stats
    getStats() {
        return {
            fps: this.stats.fps,
            ups: this.stats.ups,
            isRunning: this.isRunning,
            isPaused: this.isPaused
        };
    }
}

// Game instance
let gameEngine = null;

// Taxi physics state
let taxi = {
    x: 0,           // X position in pixels
    y: 0,           // Y position in pixels
    vx: 0,          // X velocity in pixels/second
    vy: 0,          // Y velocity in pixels/second
    onGround: false, // Whether taxi is on the ground
    hoverMode: false, // Whether taxi is in hover mode
    facingRight: false, // Whether taxi is facing right (sprite faces left by default)
    landingGear: false // Whether landing gear is deployed
};

// Input state - track which keys are currently pressed
const keys = {
    w: false,
    s: false,
    a: false,
    d: false
};

// Audio system for pause/resume sounds
let gameAudioContext = null;
let pauseSoundBuffer = null;
let resumeSoundBuffer = null;

// Initialize game audio context
async function initGameAudio() {
    if (!gameAudioContext) {
        gameAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const sampleRate = gameAudioContext.sampleRate;
        
        // Generate pause sound ("digo digo" - two quick beeps)
        const pauseDuration = 0.2;
        const pauseLength = sampleRate * pauseDuration;
        const pauseBuffer = gameAudioContext.createBuffer(1, pauseLength, sampleRate);
        const pauseData = pauseBuffer.getChannelData(0);
        
        for (let i = 0; i < pauseLength; i++) {
            const t = i / sampleRate;
            const fadeOut = Math.max(0, 1 - (t / pauseDuration));
            
            // Two quick beeps: first at 400Hz, second at 500Hz
            let value = 0;
            if (t < 0.08) {
                // First beep
                value = Math.sin(2 * Math.PI * 400 * t) * 0.2;
            } else if (t >= 0.1 && t < 0.18) {
                // Second beep
                value = Math.sin(2 * Math.PI * 500 * (t - 0.1)) * 0.2;
            }
            
            pauseData[i] = value * fadeOut;
        }
        pauseSoundBuffer = pauseBuffer;
        
        // Generate resume sound ("digo digo" - two quick beeps, slightly higher pitch)
        const resumeDuration = 0.2;
        const resumeLength = sampleRate * resumeDuration;
        const resumeBuffer = gameAudioContext.createBuffer(1, resumeLength, sampleRate);
        const resumeData = resumeBuffer.getChannelData(0);
        
        for (let i = 0; i < resumeLength; i++) {
            const t = i / sampleRate;
            const fadeOut = Math.max(0, 1 - (t / resumeDuration));
            
            // Two quick beeps: first at 500Hz, second at 600Hz (higher than pause)
            let value = 0;
            if (t < 0.08) {
                // First beep
                value = Math.sin(2 * Math.PI * 500 * t) * 0.2;
            } else if (t >= 0.1 && t < 0.18) {
                // Second beep
                value = Math.sin(2 * Math.PI * 600 * (t - 0.1)) * 0.2;
            }
            
            resumeData[i] = value * fadeOut;
        }
        resumeSoundBuffer = resumeBuffer;
    }
    
    // Resume audio context if suspended - await to ensure it's ready
    if (gameAudioContext.state === 'suspended') {
        await gameAudioContext.resume();
    }
}

// Pre-warm audio context to prevent delays on first use
async function prewarmGameAudio() {
    if (!gameAudioContext || !pauseSoundBuffer) {
        await initGameAudio();
    }
    
    // Ensure context is running
    if (gameAudioContext.state === 'suspended') {
        await gameAudioContext.resume();
    }
}

// Play pause sound
async function playPauseSound() {
    // Ensure audio is initialized and ready
    await prewarmGameAudio();
    
    if (!gameAudioContext || !pauseSoundBuffer) {
        return; // Should not happen after prewarm, but safety check
    }
    
    // Resume if suspended - await to ensure context is ready before playing
    if (gameAudioContext.state === 'suspended') {
        await gameAudioContext.resume();
    }
    
    const source = gameAudioContext.createBufferSource();
    const gainNode = gameAudioContext.createGain();
    
    source.buffer = pauseSoundBuffer;
    gainNode.gain.value = 0.3;
    
    source.connect(gainNode);
    gainNode.connect(gameAudioContext.destination);
    source.start(0);
}

// Play resume sound
async function playResumeSound() {
    // Ensure audio is initialized and ready
    await prewarmGameAudio();
    
    if (!gameAudioContext || !resumeSoundBuffer) {
        return; // Should not happen after prewarm, but safety check
    }
    
    // Resume if suspended - await to ensure context is ready before playing
    if (gameAudioContext.state === 'suspended') {
        await gameAudioContext.resume();
    }
    
    const source = gameAudioContext.createBufferSource();
    const gainNode = gameAudioContext.createGain();
    
    source.buffer = resumeSoundBuffer;
    gainNode.gain.value = 0.3;
    
    source.connect(gainNode);
    gainNode.connect(gameAudioContext.destination);
    source.start(0);
}

// Initialize game when game screen becomes active
function initGame() {
    const gameScreen = document.getElementById('game-screen');
    if (!gameScreen) return;
    
    // Create game engine with configurable FPS/UPS and physics
    gameEngine = new GameEngine({
        targetFPS: 60,   // 60 frames per second for rendering
        targetUPS: 60,   // 60 updates per second for game logic
        maxFrameSkip: 5, // Max 5 updates per frame if lagging
        
        // Physics configuration
        gravity: 9.81,           // Earth gravity in m/s² (can be adjusted)
        pixelsPerMeter: 100,     // Scale: pixels per meter (for physics calculations)
        taxiStartX: 0.5,          // Starting X position (0-1, where 0.5 is center)
        taxiStartY: 0.5,          // Starting Y position (0-1, where 0.5 is center)
        thrusterForce: 1500,      // Thruster force in pixels/s² (strong enough to overcome gravity)
        regularFlightThrust: 500,   // Constant upward thrust in regular flight mode (slows fall, weaker than W thrust)
        hoverThrust: null,        // Hover thrust in pixels/s² (null = auto-calculate to match gravity)
        hoverDamping: 800,         // Hover damping force in pixels/s² (slows vertical velocity to zero)
        aiBotCount: 2              // Number of AI bots to spawn
    });
    
    // Set up game callbacks
    gameEngine.onInit = () => {
        console.log('Game initialized');
        // Initialize taxi position (x and y represent center position)
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Set taxi center position
        taxi.x = screenWidth * gameEngine.config.taxiStartX;  // Center X (0.5 = middle)
        taxi.y = screenHeight * gameEngine.config.taxiStartY; // Y position from top
        taxi.vx = 0;
        taxi.vy = 0;
        taxi.onGround = false;
        taxi.hoverMode = false;
        taxi.facingRight = false; // Start facing left (default sprite direction)
        taxi.landingGear = false; // Start with landing gear retracted
        
        // Sprite is already positioned by MutationObserver when screen becomes active
        // Just ensure it's visible and update position if needed
        const taxiSprite = document.getElementById('taxi-sprite');
        if (taxiSprite) {
            taxiSprite.style.visibility = 'visible';
            // Set initial sprite based on landing gear state
            taxiSprite.src = taxi.landingGear ? 'assets/taxi-gear.png' : 'assets/taxi.png';
            const taxiWidth = taxiSprite.offsetWidth || 0;
            taxiSprite.style.left = (taxi.x - taxiWidth / 2) + 'px';
            taxiSprite.style.top = taxi.y + 'px';
        }
        
        // Create and position AI bots
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen) {
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            const aiBotCount = gameEngine.config.aiBotCount;
            
            // Remove existing AI bot sprites
            const existingBots = gameScreen.querySelectorAll('[id^="ai-bot-sprite-"]');
            existingBots.forEach(bot => bot.remove());
            
            // Create AI bot sprites
            for (let i = 0; i < aiBotCount; i++) {
                const aiBotSprite = document.createElement('img');
                aiBotSprite.id = `ai-bot-sprite-${i}`;
                aiBotSprite.src = 'assets/ai.png';
                aiBotSprite.alt = `AI Bot ${i + 1}`;
                aiBotSprite.className = 'ai-bot-sprite';
                aiBotSprite.draggable = false; // Prevent image dragging
                aiBotSprite.style.position = 'absolute';
                aiBotSprite.style.zIndex = '9';
                aiBotSprite.style.imageRendering = 'pixelated';
                aiBotSprite.style.imageRendering = '-moz-crisp-edges';
                aiBotSprite.style.imageRendering = 'crisp-edges';
                aiBotSprite.style.visibility = 'visible';
                
                // Position: first in center, subsequent ones to the right
                const aiBotWidth = 32; // Approximate width, will be updated after image loads
                const aiBotHeight = 32; // Approximate height
                const centerX = screenWidth / 2;
                const centerY = screenHeight / 2;
                const spacing = 50; // Space between bots
                
                // First bot centered, second bot 100px to the right (50px + 50px more)
                let botX;
                if (i === 0) {
                    botX = centerX - aiBotWidth / 2;
                } else {
                    // Second bot is 100px to the right (spacing * 2)
                    botX = centerX + spacing * 2 - aiBotWidth / 2;
                }
                
                aiBotSprite.style.left = botX + 'px';
                aiBotSprite.style.top = (centerY - aiBotHeight / 2) + 'px';
                
                // Update position after image loads to get actual dimensions
                aiBotSprite.onload = function() {
                    const actualWidth = this.offsetWidth || 32;
                    const actualHeight = this.offsetHeight || 32;
                    let actualBotX;
                    if (i === 0) {
                        actualBotX = centerX - actualWidth / 2;
                    } else {
                        // Second bot is 100px to the right (spacing * 2)
                        actualBotX = centerX + spacing * 2 - actualWidth / 2;
                    }
                    this.style.left = actualBotX + 'px';
                    this.style.top = (centerY - actualHeight / 2) + 'px';
                };
                
                gameScreen.appendChild(aiBotSprite);
            }
        }
    };
    
    gameEngine.onUpdate = (deltaTime) => {
        // Update game logic here
        // deltaTime is in seconds (e.g., 0.016 for 60 UPS)
        updateGame(deltaTime);
    };
    
    gameEngine.onRender = (alpha) => {
        // Render game here
        // alpha is interpolation factor (0-1) for smooth rendering
        renderGame(alpha);
    };
    
    gameEngine.onStop = () => {
        console.log('Game stopped');
        // Cleanup if needed
    };
    
    // Watch for game screen activation
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (gameScreen.classList.contains('active')) {
                    // Position taxi sprite immediately when screen becomes active (before game starts)
                    const taxiSprite = document.getElementById('taxi-sprite');
                    if (taxiSprite) {
                        const screenWidth = window.innerWidth;
                        const screenHeight = window.innerHeight;
                        const taxiWidth = taxiSprite.offsetWidth || 0;
                        const taxiX = screenWidth * gameEngine.config.taxiStartX;
                        const taxiY = screenHeight * gameEngine.config.taxiStartY;
                        
                        // Set initial sprite (landing gear starts retracted)
                        taxiSprite.src = 'assets/taxi.png';
                        taxiSprite.style.visibility = 'visible';
                        taxiSprite.style.left = (taxiX - taxiWidth / 2) + 'px';
                        taxiSprite.style.top = taxiY + 'px';
                    }
                    
                    // AI bots will be created in onInit, just ensure game screen is ready
                    
                    // Start game when screen becomes active
                    if (!gameEngine.isRunning) {
                        // Pre-warm audio context before starting game to prevent delay on first pause
                        prewarmGameAudio().then(() => {
                            gameEngine.start();
                        });
                    }
                } else {
                    // Stop game when screen becomes inactive
                    if (gameEngine && gameEngine.isRunning) {
                        gameEngine.stop();
                    }
                    // Hide taxi sprite when leaving game screen
                    const taxiSprite = document.getElementById('taxi-sprite');
                    if (taxiSprite) {
                        taxiSprite.style.visibility = 'hidden';
                    }
                    // Hide AI bot sprites when leaving game screen
                    const aiBotSprites = gameScreen.querySelectorAll('[id^="ai-bot-sprite-"]');
                    aiBotSprites.forEach(bot => {
                        bot.style.visibility = 'hidden';
                    });
                }
            }
        });
    });
    
    observer.observe(gameScreen, { attributes: true });
    
    // Initialize audio for pause/resume sounds (don't await, but pre-warm when game starts)
    initGameAudio();
    
    // Add keyboard listeners for pause/resume and thruster controls
    document.addEventListener('keydown', (event) => {
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen && gameScreen.classList.contains('active') && gameEngine) {
            const key = event.key.toLowerCase();
            
            // Pause/resume
            if (key === 'p') {
                event.preventDefault();
                
                if (gameEngine.isPaused) {
                    gameEngine.resume();
                    playResumeSound();
                } else if (gameEngine.isRunning) {
                    gameEngine.pause();
                    playPauseSound();
                }
            }
            
            // Hover mode toggle
            if (key === 'h' || key === 'H') {
                event.preventDefault();
                if (gameEngine.isRunning && !gameEngine.isPaused) {
                    taxi.hoverMode = !taxi.hoverMode;
                }
            }
            
            // Landing gear toggle
            if (event.key === ' ') { // Spacebar
                event.preventDefault();
                if (gameEngine.isRunning && !gameEngine.isPaused) {
                    taxi.landingGear = !taxi.landingGear;
                }
            }
            
            // Thruster controls (only when game is running and not paused)
            if (gameEngine.isRunning && !gameEngine.isPaused) {
                // WASD keys
                if (key === 'w' || key === 's' || key === 'a' || key === 'd') {
                    event.preventDefault();
                    keys[key] = true;
                }
                // Arrow keys (mapped to WASD)
                else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    keys.w = true;
                }
                else if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    keys.s = true;
                }
                else if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    keys.a = true;
                }
                else if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    keys.d = true;
                }
            }
        }
    });
    
    document.addEventListener('keyup', (event) => {
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen && gameScreen.classList.contains('active') && gameEngine) {
            const key = event.key.toLowerCase();
            
            // Release thruster controls
            // WASD keys
            if (key === 'w' || key === 's' || key === 'a' || key === 'd') {
                event.preventDefault();
                keys[key] = false;
            }
            // Arrow keys (mapped to WASD)
            else if (event.key === 'ArrowUp') {
                event.preventDefault();
                keys.w = false;
            }
            else if (event.key === 'ArrowDown') {
                event.preventDefault();
                keys.s = false;
            }
            else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                keys.a = false;
            }
            else if (event.key === 'ArrowRight') {
                event.preventDefault();
                keys.d = false;
            }
        }
    });
}

// Game update logic (called every update cycle)
function updateGame(deltaTime) {
    const thrusterForce = gameEngine.config.thrusterForce;
    const gravityPixels = gameEngine.config.gravity * gameEngine.config.pixelsPerMeter;
    
    // Calculate hover thrust (auto-calculate to match gravity if not specified)
    let hoverThrust = gameEngine.config.hoverThrust;
    if (hoverThrust === null || hoverThrust === undefined) {
        hoverThrust = gravityPixels; // Match gravity exactly for perfect hover
    }
    
    if (taxi.hoverMode) {
        // Hover mode: intelligent damping to slow down to hover
        
        // Apply damping force opposite to vertical velocity (slows down movement)
        const hoverDamping = gameEngine.config.hoverDamping;
        if (taxi.vy > 0) {
            // Falling down - apply upward damping to slow the fall
            taxi.vy -= hoverDamping * deltaTime;
            // Clamp to zero if we've overshot
            if (taxi.vy < 0) taxi.vy = 0;
        } else if (taxi.vy < 0) {
            // Moving up - apply downward damping to slow the rise
            taxi.vy += hoverDamping * deltaTime;
            // Clamp to zero if we've overshot
            if (taxi.vy > 0) taxi.vy = 0;
        }
        
        // Apply horizontal damping to slow down horizontal movement
        if (taxi.vx > 0) {
            // Moving right - apply leftward damping to slow the movement
            taxi.vx -= hoverDamping * deltaTime;
            // Clamp to zero if we've overshot
            if (taxi.vx < 0) taxi.vx = 0;
        } else if (taxi.vx < 0) {
            // Moving left - apply rightward damping to slow the movement
            taxi.vx += hoverDamping * deltaTime;
            // Clamp to zero if we've overshot
            if (taxi.vx > 0) taxi.vx = 0;
        }
        
        // Once velocity is near zero, apply hover thrust to counteract gravity
        // This maintains the hover position
        taxi.vy -= hoverThrust * deltaTime;
        
        // W and S still work in hover mode for fine vertical adjustment
        if (keys.w) {
            // Extra thrust up (on top of hover thrust)
            taxi.vy -= thrusterForce * deltaTime;
        }
        if (keys.s) {
            // Extra thrust down (reduces hover thrust effect)
            taxi.vy += thrusterForce * deltaTime;
        }
        
        // Apply gravity
        taxi.vy += gravityPixels * deltaTime;
        
        // In hover mode, left/right thrusters only affect horizontal movement
        if (keys.a) {
            taxi.vx -= thrusterForce * deltaTime;
            taxi.facingRight = false; // Face left when pressing 'a'
        }
        if (keys.d) {
            taxi.vx += thrusterForce * deltaTime;
            taxi.facingRight = true; // Face right when pressing 'd'
        }
    } else {
        // Regular mode: normal thruster controls with constant upward thrust to slow fall
        
        // Constant upward thrust in regular flight (slows the fall, more realistic)
        const regularFlightThrust = gameEngine.config.regularFlightThrust;
        taxi.vy -= regularFlightThrust * deltaTime;
        
        // Manual thruster controls
        if (keys.w) {
            // Extra thrust up (on top of regular flight thrust)
            taxi.vy -= thrusterForce * deltaTime;
        }
        if (keys.s) {
            // Thrust down (adds to gravity, overrides regular flight thrust)
            taxi.vy += thrusterForce * deltaTime;
        }
        if (keys.a) {
            // Thrust left
            taxi.vx -= thrusterForce * deltaTime;
            taxi.facingRight = false; // Face left when pressing 'a'
        }
        if (keys.d) {
            // Thrust right
            taxi.vx += thrusterForce * deltaTime;
            taxi.facingRight = true; // Face right when pressing 'd'
        }
        
        // Apply gravity (convert m/s² to pixels/s²)
        taxi.vy += gravityPixels * deltaTime;
    }
    
    // Update position based on velocity (momentum is preserved)
    taxi.x += taxi.vx * deltaTime;
    taxi.y += taxi.vy * deltaTime;
    
    // Check collision with screen boundaries
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const taxiSprite = document.getElementById('taxi-sprite');
    const taxiWidth = taxiSprite ? taxiSprite.offsetWidth : 0;
    const taxiHeight = taxiSprite ? taxiSprite.offsetHeight : 0;
    
    // Left and right boundaries
    const leftBoundary = taxiWidth / 2;
    const rightBoundary = screenWidth - taxiWidth / 2;
    if (taxi.x < leftBoundary) {
        taxi.x = leftBoundary;
        taxi.vx = 0; // Stop horizontal velocity on collision
    } else if (taxi.x > rightBoundary) {
        taxi.x = rightBoundary;
        taxi.vx = 0; // Stop horizontal velocity on collision
    }
    
    // Top and bottom boundaries
    const topBoundary = 0;
    const bottomBoundary = screenHeight - taxiHeight;
    if (taxi.y < topBoundary) {
        taxi.y = topBoundary;
        taxi.vy = 0; // Stop vertical velocity on collision
        taxi.onGround = false; // Not on ground if hitting top
    } else if (taxi.y >= bottomBoundary) {
        taxi.y = bottomBoundary;
        taxi.vy = 0;
        taxi.onGround = true;
    } else {
        taxi.onGround = false; // Not on ground if in the air
    }
}

// Game render logic (called every render cycle)
function renderGame(alpha) {
    // Update taxi sprite position
    const taxiSprite = document.getElementById('taxi-sprite');
    if (taxiSprite) {
        // Update sprite image based on landing gear state
        if (taxi.landingGear) {
            taxiSprite.src = 'assets/taxi-gear.png';
        } else {
            taxiSprite.src = 'assets/taxi.png';
        }
        
        // Center horizontally on the x position
        const taxiWidth = taxiSprite.offsetWidth || 0;
        taxiSprite.style.left = (taxi.x - taxiWidth / 2) + 'px';
        taxiSprite.style.top = taxi.y + 'px';
        
        // Flip sprite horizontally when facing right
        if (taxi.facingRight) {
            taxiSprite.style.transform = 'scaleX(-1)';
        } else {
            taxiSprite.style.transform = 'scaleX(1)';
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameEngine, gameEngine };
}
