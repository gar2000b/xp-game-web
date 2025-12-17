// Create starfield for start screen
const starsContainer = document.getElementById('stars');
for (let i = 0; i < 50; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.animationDelay = Math.random() * 2 + 's';
    starsContainer.appendChild(star);
}

// Credit tracking
let credits = 0;
const creditMessage = document.getElementById('credit-message');

function updateCreditMessage() {
    if (credits > 0) {
        creditMessage.textContent = `${credits} CREDIT${credits > 1 ? 'S' : ''}`;
    } else {
        creditMessage.textContent = 'INSERT COIN TO BEGIN (PRESS KEYS 1 || 2)';
    }
}

// Audio system - optimized for instant playback
let audioContext = null;
let coinSoundBuffer = null;

// Initialize audio context (browsers require user interaction)
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Pre-generate coin sound buffer for instant playback
        const sampleRate = audioContext.sampleRate;
        const duration = 0.15;
        const length = sampleRate * duration;
        const buffer = audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate coin drop sound (two overlapping tones with fade)
        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            const fadeOut = Math.max(0, 1 - (t / duration));
            
            // Two sine waves with frequency sweep
            const freq1 = 800 * Math.pow(400 / 800, t / 0.1);
            const freq2 = 1000 * Math.pow(500 / 1000, t / 0.1);
            
            data[i] = (
                Math.sin(2 * Math.PI * freq1 * t) * 0.15 +
                Math.sin(2 * Math.PI * freq2 * t) * 0.15
            ) * fadeOut;
        }
        
        coinSoundBuffer = buffer;
    }
    
    // Resume audio context if suspended (browser autoplay policy)
    // Note: We don't await here since this is called during initialization
    // The actual sound functions will await resume() when needed
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// Play coin sound using pre-generated buffer (instant playback)
async function playCoinSound() {
    if (!audioContext || !coinSoundBuffer) {
        initAudio();
        // If still not ready, try again on next frame
        if (!coinSoundBuffer) {
            requestAnimationFrame(playCoinSound);
            return;
        }
    }
    
    // Resume if suspended - await to ensure context is ready before playing
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    
    // Create buffer source for instant playback
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = coinSoundBuffer;
    gainNode.gain.value = 0.3;
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(0);
}

// Play space intro tune (3 seconds)
async function playSpaceIntro() {
    if (!audioContext) {
        initAudio();
    }
    
    // Resume if suspended - await to ensure context is ready before playing
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    
    const now = audioContext.currentTime;
    const duration = 3.0;
    
    // Space intro melody - rising sequence with sci-fi feel
    // Notes: C, E, G, C (octave up) - major arpeggio
    const notes = [
        { freq: 261.63, start: 0.0, duration: 0.4 },   // C4
        { freq: 329.63, start: 0.4, duration: 0.4 },  // E4
        { freq: 392.00, start: 0.8, duration: 0.4 },   // G4
        { freq: 523.25, start: 1.2, duration: 0.6 },  // C5
        { freq: 659.25, start: 1.8, duration: 0.6 },  // E5
        { freq: 783.99, start: 2.4, duration: 0.6 }    // G5
    ];
    
    notes.forEach((note, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = note.freq;
        
        // Fade in and out for each note
        gainNode.gain.setValueAtTime(0, now + note.start);
        gainNode.gain.linearRampToValueAtTime(0.2, now + note.start + 0.05);
        gainNode.gain.linearRampToValueAtTime(0.2, now + note.start + note.duration - 0.1);
        gainNode.gain.linearRampToValueAtTime(0, now + note.start + note.duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(now + note.start);
        oscillator.stop(now + note.start + note.duration);
    });
    
    // Add a subtle low-frequency sweep for atmosphere
    // const sweepOsc = audioContext.createOscillator();
    // const sweepGain = audioContext.createGain();
    
    // sweepOsc.type = 'sawtooth';
    // sweepOsc.frequency.setValueAtTime(100, now);
    // sweepOsc.frequency.exponentialRampToValueAtTime(200, now + duration);
    
    // sweepGain.gain.setValueAtTime(0, now);
    // sweepGain.gain.linearRampToValueAtTime(0.05, now + 0.5);
    // sweepGain.gain.linearRampToValueAtTime(0.05, now + duration - 0.5);
    // sweepGain.gain.linearRampToValueAtTime(0, now + duration);
    
    // sweepOsc.connect(sweepGain);
    // sweepGain.connect(audioContext.destination);
    
    // sweepOsc.start(now);
    // sweepOsc.stop(now + duration);
}

// Initialize audio on first user interaction
document.addEventListener('keydown', () => {
    if (!audioContext) {
        initAudio();
    }
}, { once: true });

// Check if we're in game mode
function isGameMode() {
    const gameScreen = document.getElementById('game-screen');
    return gameScreen && gameScreen.classList.contains('active');
}

// Handle coin insertion (keys 1 and 2), reset (key 0), start (Enter), and quit (ESC)
document.addEventListener('keydown', (event) => {
    const inGameMode = isGameMode();
    
    // ESC key - quit game and return to welcome screen
    if (event.key === 'Escape') {
        if (inGameMode) {
            const startScreen = document.getElementById('start-screen');
            const gameScreen = document.getElementById('game-screen');
            
            gameScreen.classList.remove('active');
            startScreen.classList.remove('hidden');
        }
        return;
    }
    
    // In game mode, disable all other keys except ESC
    if (inGameMode) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
        return;
    }
    
    // Start screen controls
    if (event.key === '1') {
        credits += 1;
        playCoinSound();
        updateCreditMessage();
    } else if (event.key === '2') {
        credits += 2;
        playCoinSound();
        updateCreditMessage();
    } else if (event.key === '0') {
        credits = 0;
        updateCreditMessage();
    } else if (event.key === 'Enter') {
        // Only start game if player has credits
        if (credits > 0) {
            credits -= 1;
            updateCreditMessage();
            playSpaceIntro();
            
            // Switch to game screen immediately
            const startScreen = document.getElementById('start-screen');
            const gameScreen = document.getElementById('game-screen');
            
            startScreen.classList.add('hidden');
            gameScreen.classList.add('active');
        }
    }
});
