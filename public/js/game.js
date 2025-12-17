// Game Engine - Main game loop with FPS/UPS control
class GameEngine {
    constructor(config = {}) {
        // Configuration
        this.targetFPS = config.targetFPS || 60;        // Frames per second (rendering)
        this.targetUPS = config.targetUPS || 60;        // Updates per second (logic)
        this.maxFrameSkip = config.maxFrameSkip || 5;    // Maximum updates per frame
        
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

// Audio system for pause/resume sounds
let gameAudioContext = null;
let pauseSoundBuffer = null;
let resumeSoundBuffer = null;

// Initialize game audio context
function initGameAudio() {
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
    
    // Resume audio context if suspended
    if (gameAudioContext.state === 'suspended') {
        gameAudioContext.resume();
    }
}

// Play pause sound
function playPauseSound() {
    if (!gameAudioContext || !pauseSoundBuffer) {
        initGameAudio();
        if (!pauseSoundBuffer) {
            requestAnimationFrame(playPauseSound);
            return;
        }
    }
    
    if (gameAudioContext.state === 'suspended') {
        gameAudioContext.resume();
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
function playResumeSound() {
    if (!gameAudioContext || !resumeSoundBuffer) {
        initGameAudio();
        if (!resumeSoundBuffer) {
            requestAnimationFrame(playResumeSound);
            return;
        }
    }
    
    if (gameAudioContext.state === 'suspended') {
        gameAudioContext.resume();
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
    
    // Create game engine with configurable FPS/UPS
    gameEngine = new GameEngine({
        targetFPS: 60,   // 60 frames per second for rendering
        targetUPS: 60,   // 60 updates per second for game logic
        maxFrameSkip: 5  // Max 5 updates per frame if lagging
    });
    
    // Set up game callbacks
    gameEngine.onInit = () => {
        console.log('Game initialized');
        // Initialize game entities, reset state, etc.
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
                    // Start game when screen becomes active
                    if (!gameEngine.isRunning) {
                        gameEngine.start();
                    }
                } else {
                    // Stop game when screen becomes inactive
                    if (gameEngine && gameEngine.isRunning) {
                        gameEngine.stop();
                    }
                }
            }
        });
    });
    
    observer.observe(gameScreen, { attributes: true });
    
    // Initialize audio for pause/resume sounds
    initGameAudio();
    
    // Add keyboard listener for pause/resume (only when game screen is active)
    document.addEventListener('keydown', (event) => {
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen && gameScreen.classList.contains('active') && gameEngine) {
            if (event.key === 'p' || event.key === 'P') {
                event.preventDefault();
                
                if (gameEngine.isPaused) {
                    gameEngine.resume();
                    playResumeSound();
                } else if (gameEngine.isRunning) {
                    gameEngine.pause();
                    playPauseSound();
                }
            }
        }
    });
}

// Game update logic (called every update cycle)
function updateGame(deltaTime) {
    // Update taxi position, physics, collisions, etc.
    // This runs at UPS rate (e.g., 60 times per second)
}

// Game render logic (called every render cycle)
function renderGame(alpha) {
    // Update visual positions, animations, etc.
    // This runs at FPS rate (e.g., 60 times per second)
    // alpha can be used for interpolation between updates
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
