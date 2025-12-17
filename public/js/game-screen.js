// Create starfield for game screen
function createGameStars() {
    const gameStarsContainer = document.getElementById('game-stars');
    if (!gameStarsContainer) return;
    
    // Clear existing stars
    gameStarsContainer.innerHTML = '';
    
    // Create more stars for the game screen (full window)
    for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'game-star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 2 + 's';
        gameStarsContainer.appendChild(star);
    }
}

// Initialize game screen stars when screen becomes active
function initGameScreen() {
    const gameScreen = document.getElementById('game-screen');
    if (!gameScreen) return;
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (gameScreen.classList.contains('active')) {
                    createGameStars();
                }
            }
        });
    });
    
    observer.observe(gameScreen, { attributes: true });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGameScreen);
} else {
    initGameScreen();
}
