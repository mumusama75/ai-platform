// 滚动显现动画
// 滚动显现动画
document.addEventListener('DOMContentLoaded', () => {
    function initAnimations() {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = entry.target;
                    target.classList.add('visible');
                    observer.unobserve(target);

                    // Cleanup for cards to restore snappy hover effects
                    if (target.classList.contains('bento-card')) {
                        setTimeout(() => {
                            // Remove animation classes so the element uses its default CSS transition
                            target.classList.remove('hero-reveal', 'visible');
                            // We also remove delay classes to be clean
                            target.classList.remove('delay-1', 'delay-2', 'delay-3', 'delay-4');

                            // Ensure opacity stays 1 (it is 1 by default for bento-card, so safe)
                            // Using a helper class if needed, but default should suffice.
                            target.style.opacity = '';
                            target.style.transform = '';
                            target.style.filter = '';
                        }, 1500); // Wait for 1.2s animation + buffer
                    }
                }
            });
        }, observerOptions);

        const fadeElements = document.querySelectorAll('.fade-in-up, .hero-reveal');
        fadeElements.forEach(el => observer.observe(el));
    }

    // Check if loading is already done (rare, but possible on refresh sometimes)
    if (document.body.classList.contains('loaded')) {
        initAnimations();
    } else {
        // Wait for 'loaded' class
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class' && document.body.classList.contains('loaded')) {
                    // Small delay to let the curtain fade out a bit before starting text animations
                    setTimeout(initAnimations, 500);
                    observer.disconnect();
                }
            });
        });
        observer.observe(document.body, { attributes: true });
    }


    // Scroll Indicator Logic
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                scrollIndicator.style.opacity = '0';
                scrollIndicator.style.transition = 'opacity 0.3s ease';
                scrollIndicator.style.pointerEvents = 'none'; // Disable clicks
            } else {
                // Optional: Show it again if at very top, or keep hidden?
                // Usually showing it again is nice if they go back to top.
                scrollIndicator.style.opacity = '0.7'; // Match CSS original opacity
                scrollIndicator.style.pointerEvents = 'all';
            }
        });
    }

    // --- Hero Smart Input Logic ---
    const input = document.getElementById('heroInput');
    const btn = document.getElementById('submitBtn');

    if (input && btn) {
        // Dynamic Placeholder Effect
        const placeholders = [
            "想画什么？试着输入: 一只戴眼镜的猫...",
            "想写什么？试着输入: 给客户的道歉信...",
            "想问什么？试着输入: 解释量子纠缠...",
            "Gemini 2.0 随时待命..."
        ];
        let pIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        let typeSpeed = 50;

        function typeWriter() {
            const currentText = placeholders[pIndex];

            if (!input.matches(':focus') && input.value === '') {
                if (isDeleting) {
                    input.setAttribute('placeholder', currentText.substring(0, charIndex - 1));
                    charIndex--;
                    typeSpeed = 30;
                } else {
                    input.setAttribute('placeholder', currentText.substring(0, charIndex + 1));
                    charIndex++;
                    typeSpeed = 80;
                }

                if (!isDeleting && charIndex === currentText.length) {
                    isDeleting = true;
                    typeSpeed = 2000;
                } else if (isDeleting && charIndex === 0) {
                    isDeleting = false;
                    pIndex = (pIndex + 1) % placeholders.length;
                    typeSpeed = 500;
                }
            } else if (input.matches(':focus')) {
                input.setAttribute('placeholder', '在此输入...');
            }

            setTimeout(typeWriter, typeSpeed);
        }

        // Start typing loop
        typeWriter();

        // Interaction Logic
        window.fillInput = function (text) {
            input.value = text;
            input.focus();
        };

        function handleSubmit() {
            const val = input.value.trim();
            if (!val) return;

            // Simple Intent Detection
            // In a real app, query params would be passed like ?q=...
            if (val.includes('画') || val.includes('图片') || val.includes('img') || val.includes('draw')) {
                window.location.href = 'image.html';
            } else if (val.includes('歌') || val.includes('music')) {
                window.location.href = 'music.html';
            } else {
                window.location.href = 'gemini-chat.html';
            }
        }

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSubmit();
        });

        btn.addEventListener('click', handleSubmit);
    }
});
