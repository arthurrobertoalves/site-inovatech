document.addEventListener('DOMContentLoaded', function() {
    // Modal functionality
    const modalBtns = document.querySelectorAll('.project-modal-btn');
    const modals = document.querySelectorAll('.project-modal');
    const closeBtns = document.querySelectorAll('.close-modal');
    
    // Open modal
    modalBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const modalId = this.getAttribute('data-modal');
            document.getElementById(modalId).style.display = 'block';
            document.body.style.overflow = 'hidden';
        });
    });
    
    // Close modal
    closeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.project-modal').style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    });
    
    // Close when clicking outside
    window.addEventListener('click', function(e) {
        modals.forEach(modal => {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    });
    
    // Quiz functionality
    const quizOptions = document.querySelectorAll('.quiz-option');
    
    quizOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Remove active class from all options
            quizOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to clicked option
            this.classList.add('active');
            this.style.backgroundColor = 'var(--primary-dark)';
            this.style.color = 'white';
            this.style.borderColor = 'var(--primary-dark)';
            
            // Simulate next question after delay
            setTimeout(() => {
                alert('Resposta registrada! Próxima pergunta...');
                // In a real implementation, you would update the question and progress
            }, 500);
        });
    });
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        });
    });
});