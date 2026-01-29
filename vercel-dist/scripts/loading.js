(function () {
    // Note: 'html-loading' class is already added by inline script in head to prevent FOUC.

    document.addEventListener('DOMContentLoaded', () => {
        // Now body is safe to access
        document.body.classList.add('is-loading');
        document.body.style.overflow = 'hidden';

        const transformer = document.getElementById('loader-transformer');
        const fill = document.getElementById('loader-fill');
        const curtain = document.getElementById('initial-curtain');
        const realNavbar = document.querySelector('.navbar');

        let progress = 0;

        // Simulating load progress
        // In a real app, you might hook this into image load events or other metrics
        const interval = setInterval(() => {
            // Random increment
            let increment = Math.random() * 5;

            // Slow down near the end
            if (progress > 80) increment = Math.random() * 2;

            progress += increment;

            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                startTransition();
            }

            if (fill) fill.style.width = `${progress}%`;
        }, 30); // ~3 seconds total load time roughly

        function startTransition() {
            // Slight delay before morphing
            setTimeout(() => {
                // 1. Morph the loader into a navbar shape
                if (transformer) transformer.classList.add('is-navbar');

                // 2. Fade out the black curtain to reveal the "page" (which is actually hidden by CSS state)
                if (curtain) curtain.classList.add('fade-out');

                // 3. Trigger the page content reveal CSS
                // Wait just a bit for the curtain to start fading so we don't see the jump
                // 3. Trigger the page content reveal CSS
                // Wait just a bit for the curtain to start fading so we don't see the jump
                setTimeout(() => {
                    document.body.classList.remove('is-loading');
                    document.body.classList.add('loaded');
                    document.body.style.overflow = ''; // Restore scroll
                }, 300);

                // 4. Final Cleanup: Swap fake nav for real nav
                // The morph animation takes about 0.8s + 0.3s delay = 1.1s total
                // We wait until it's fully in place
                setTimeout(() => {
                    // At this point, the real navbar is fading in (via .loaded class)
                    // and matches the visual state of the transformer EXACTLY.

                    // Reveal Real Navbar
                    document.body.classList.add('navbar-ready');
                    document.documentElement.classList.remove('html-loading'); // Remove protection here

                    // We can now safely remove the loader elements
                    if (transformer) transformer.style.display = 'none';
                    if (curtain) curtain.style.display = 'none'; // Ensure it's gone

                    // Clean up classes if needed, or leave .loaded
                }, 1200);

            }, 200);
        }
    });
})();
