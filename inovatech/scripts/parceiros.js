document.addEventListener('DOMContentLoaded', function() {
    const track = document.querySelector('.carrossel-track');
    const cards = document.querySelectorAll('.parceiro-card');
    const nextBtn = document.querySelector('.carrossel-btn.next');
    const prevBtn = document.querySelector('.carrossel-btn.prev');
    const indicators = document.querySelectorAll('.indicador');
    
    let currentIndex = 0;
    const cardWidth = cards[0].offsetWidth + 32; // width + gap
    
    function updateCarousel() {
        track.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
        
        // Atualiza indicadores
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === currentIndex);
        });
        
        // Desabilita botões quando necessário
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex >= cards.length - 1;
    }
    
    nextBtn.addEventListener('click', () => {
        if (currentIndex < cards.length - 1) {
            currentIndex++;
            updateCarousel();
        }
    });
    
    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            updateCarousel();
        }
    });
    
    // Navegação pelos indicadores
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            currentIndex = index;
            updateCarousel();
        });
    });
    
    // Inicializa o carrossel
    updateCarousel();
    
    // Adapta ao redimensionamento da tela
    window.addEventListener('resize', () => {
        cardWidth = cards[0].offsetWidth + 32;
        updateCarousel();
    });
});