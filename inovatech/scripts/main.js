/**
 * InovaTech - Main JavaScript
 * Modularizado e otimizado para performance
 * Atualizado com correção para scroll mobile
 */

document.addEventListener('DOMContentLoaded', () => {
    // Configurações globais
    const config = {
        scrollOffset: 80,
        scrollThreshold: 100
    };

    // Inicializa componentes
    initNavigation(config);
    initCarousel();
    initCurrentYear();
});

/**
 * Navegação principal
 */
function initNavigation({ scrollOffset, scrollThreshold }) {
    const header = document.querySelector('.header');
    const toggler = document.querySelector('.navbar-toggler');
    const menu = document.querySelector('.navbar-collapse');
    
    if (!toggler || !menu) return;
    
    // Controle do menu mobile
    const toggleMenu = (isOpen) => {
        toggler.classList.toggle('active', isOpen);
        menu.classList.toggle('active', isOpen);
        toggler.setAttribute('aria-expanded', isOpen);
        document.body.classList.toggle('no-scroll', isOpen);
    };
    
    toggler.addEventListener('click', () => {
        const isOpen = toggler.classList.contains('active');
        toggleMenu(!isOpen);
    });
    
    // Fechar menu ao clicar em links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => toggleMenu(false));
    });
    
    // Sticky header

    // Scroll suave
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (!target) return;
            
            e.preventDefault();
            
            window.scrollTo({
                top: target.offsetTop - scrollOffset,
                behavior: 'smooth'
            });
        });
    });
}

/**
 * Carrossel de parceiros - Atualizado com gestos otimizados para mobile
 */
function initCarousel() {
    const carrossel = document.querySelector('.parceiros-carrossel');
    if (!carrossel) return;
    
    let isDragging = false;
    let startPos = { x: 0, y: 0 };
    let currentScroll = 0;
    
    // Eventos de mouse/touch
    const handleStart = (e) => {
        isDragging = true;
        startPos = {
            x: getPosition(e).x,
            y: getPosition(e).y
        };
        currentScroll = carrossel.scrollLeft;
        carrossel.style.cursor = 'grabbing';
        carrossel.style.scrollBehavior = 'auto';
    };
    
    const handleMove = (e) => {
        if (!isDragging) return;
        
        const currentPos = getPosition(e);
        const dx = currentPos.x - startPos.x;
        const dy = currentPos.y - startPos.y;
        
        // Verifica se o movimento é predominantemente horizontal
        if (Math.abs(dx) > Math.abs(dy)) {
            e.preventDefault();
            const walk = dx * 2;
            carrossel.scrollLeft = currentScroll - walk;
        }
    };
    
    const handleEnd = () => {
        isDragging = false;
        carrossel.style.cursor = 'grab';
        carrossel.style.scrollBehavior = 'smooth';
    };
    
    // Adiciona event listeners com opção passive false para touchmove
    carrossel.addEventListener('mousedown', handleStart);
    carrossel.addEventListener('touchstart', handleStart, { passive: true });
    carrossel.addEventListener('mousemove', handleMove);
    carrossel.addEventListener('touchmove', handleMove, { passive: false });
    carrossel.addEventListener('mouseup', handleEnd);
    carrossel.addEventListener('touchend', handleEnd, { passive: true });
    carrossel.addEventListener('mouseleave', handleEnd);
}

/**
 * Utilitários
 */
function initCurrentYear() {
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

function throttle(fn, wait) {
    let time = Date.now();
    return function() {
        if ((time + wait - Date.now()) < 0) {
            fn();
            time = Date.now();
        }
    };
}

function getPosition(e) {
    return {
        x: e.type.includes('touch') ? e.touches[0].clientX : e.clientX,
        y: e.type.includes('touch') ? e.touches[0].clientY  : e.clientY
    };
}