/* ==================== 动态粒子背景效果 ==================== */

class ParticleBackground {
    constructor(options = {}) {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.mouse = { x: null, y: null, radius: 150 };
        this.animationId = null;

        // 配置
        this.config = {
            particleCount: options.particleCount || 80,
            particleColor: options.particleColor || '#00d4ff',
            lineColor: options.lineColor || 'rgba(0, 212, 255, 0.1)',
            particleSize: options.particleSize || 2,
            speed: options.speed || 0.5,
            connectDistance: options.connectDistance || 120,
            ...options
        };

        this.init();
    }

    init() {
        // 创建 canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'particleCanvas';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: -1;
        `;
        document.body.prepend(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        this.resize();
        this.createParticles();
        this.bindEvents();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.config.particleCount; i++) {
            this.particles.push(new Particle(this));
        }
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.resize();
            this.createParticles();
        });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mouseout', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 更新和绘制粒子
        this.particles.forEach(particle => {
            particle.update();
            particle.draw();
        });

        // 连接粒子
        this.connectParticles();

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    connectParticles() {
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.config.connectDistance) {
                    const opacity = 1 - distance / this.config.connectDistance;
                    this.ctx.strokeStyle = `rgba(0, 212, 255, ${opacity * 0.2})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                }
            }
        }
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.canvas) {
            this.canvas.remove();
        }
    }
}

class Particle {
    constructor(parent) {
        this.parent = parent;
        this.canvas = parent.canvas;
        this.ctx = parent.ctx;
        this.config = parent.config;

        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.size = Math.random() * this.config.particleSize + 1;
        this.speedX = (Math.random() - 0.5) * this.config.speed;
        this.speedY = (Math.random() - 0.5) * this.config.speed;
        this.opacity = Math.random() * 0.5 + 0.3;
    }

    update() {
        // 移动
        this.x += this.speedX;
        this.y += this.speedY;

        // 边界反弹
        if (this.x > this.canvas.width || this.x < 0) {
            this.speedX = -this.speedX;
        }
        if (this.y > this.canvas.height || this.y < 0) {
            this.speedY = -this.speedY;
        }

        // 鼠标交互
        const mouse = this.parent.mouse;
        if (mouse.x !== null && mouse.y !== null) {
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < mouse.radius) {
                const force = (mouse.radius - distance) / mouse.radius;
                const angle = Math.atan2(dy, dx);
                this.x += Math.cos(angle) * force * 2;
                this.y += Math.sin(angle) * force * 2;
            }
        }
    }

    draw() {
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(0, 212, 255, ${this.opacity})`;
        this.ctx.fill();
    }
}

// 初始化粒子背景
document.addEventListener('DOMContentLoaded', () => {
    // 只在首页启用粒子效果
    if (window.location.pathname === '/' ||
        window.location.pathname.includes('index.html') ||
        window.location.pathname.endsWith('/')) {
        window.particleBg = new ParticleBackground({
            particleCount: 60,
            speed: 0.3,
            connectDistance: 100
        });
    }
});
