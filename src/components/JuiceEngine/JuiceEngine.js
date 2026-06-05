'use client';

import { useEffect, useRef, useCallback } from 'react';
import { playSound } from '@/lib/audio';

export default function JuiceEngine() {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationFrameRef = useRef(null);
  // Store current canvas logical size so we don't re-set every frame
  const canvasSizeRef = useRef({ width: 0, height: 0, dpr: 1 });

  // ── Initialize & resize canvas ──────────────────────────────────────
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    // CSS size stays 100vw / 100vh via inline style
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    canvasSizeRef.current = { width, height, dpr };
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // ── Animation loop ───────────────────────────────────────────────────
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvasSizeRef.current;

    // Clear only — do NOT resize (that wipes everything!)
    ctx.clearRect(0, 0, width, height);

    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      // Physics
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4;    // gravity
      p.vx *= 0.985;  // air drag
      p.vy *= 0.985;
      p.rotation += p.rSpeed;

      // Draw confetti strip
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();

      // Fade near bottom
      if (p.y > height - 150) {
        p.opacity -= 0.025;
      }

      // Cull off-screen / fully faded
      if (p.y > height + 20 || p.opacity <= 0 || p.x < -40 || p.x > width + 40) {
        particles.splice(i, 1);
      }
    }

    if (particles.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvasSizeRef.current.width, canvasSizeRef.current.height);
      animationFrameRef.current = null;
    }
  }, []);

  // ── Confetti burst ───────────────────────────────────────────────────
  const spawnConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const colors = [
      '#ff6b6b', '#4ecdc4', '#ffe66d', '#6c5ce7',
      '#00ff88', '#f7931a', '#00d4ff', '#ff9ff3', '#54a0ff'
    ];

    const { width, height } = canvasSizeRef.current;
    const newParticles = [];

    // Left cannon
    for (let i = 0; i < 70; i++) {
      newParticles.push({
        x: width * 0.05,
        y: height,
        vx: 4 + Math.random() * 14,
        vy: -18 - Math.random() * 14,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: -10 + Math.random() * 20,
        w: 7 + Math.random() * 8,
        h: 13 + Math.random() * 10,
        opacity: 1,
      });
    }

    // Right cannon
    for (let i = 0; i < 70; i++) {
      newParticles.push({
        x: width * 0.95,
        y: height,
        vx: -4 - Math.random() * 14,
        vy: -18 - Math.random() * 14,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: -10 + Math.random() * 20,
        w: 7 + Math.random() * 8,
        h: 13 + Math.random() * 10,
        opacity: 1,
      });
    }

    particlesRef.current = [...particlesRef.current, ...newParticles];

    // Kick off the loop only if not already running
    if (!animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  // ── Big-win monitor ──────────────────────────────────────────────────
  useEffect(() => {
    const handleBetResult = (e) => {
      const bet = e.detail;
      if (!bet) return;

      const mult = Number(bet.multiplier || 0);
      const won = bet.won === true || bet.won === 'true' || bet.won === 1;

      if (won && mult >= 10) {
        spawnConfetti();
        playSound('win');
        setTimeout(() => playSound('cashout'), 200);
        setTimeout(() => playSound('win'), 400);
      }
    };

    window.addEventListener('new-game-result', handleBetResult);
    return () => {
      window.removeEventListener('new-game-result', handleBetResult);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [spawnConfetti]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable ||
          active.closest('[role="textbox"]') ||
          active.closest('.chat-input') ||
          active.closest('input') ||
          active.closest('textarea'))
      ) {
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        const buttons = Array.from(document.querySelectorAll('button'));
        const playBtn = buttons.find((btn) => {
          if (btn.disabled) return false;
          const text = btn.textContent.toLowerCase().trim();
          return (
            text.includes('deal') ||
            text.includes('roll') ||
            text.includes('spin') ||
            text.includes('drop') ||
            text.includes('play') ||
            text.includes('start') ||
            text.includes('scratch') ||
            text.includes('buy') ||
            text.includes('flip') ||
            text.includes('bet') ||
            text.includes('hit') ||
            text.includes('stand')
          );
        });
        if (playBtn) playBtn.click();

      } else if (e.key === '[') {
        const buttons = Array.from(document.querySelectorAll('button'));
        const halfBtn = buttons.find((btn) => {
          if (btn.disabled) return false;
          const text = btn.textContent.trim().toLowerCase();
          return text === '½' || text === 'half' || text === '1/2';
        });
        if (halfBtn) halfBtn.click();

      } else if (e.key === ']') {
        const buttons = Array.from(document.querySelectorAll('button'));
        const doubleBtn = buttons.find((btn) => {
          if (btn.disabled) return false;
          const text = btn.textContent.trim().toLowerCase();
          return text === '2x' || text === 'double' || text === '2×';
        });
        if (doubleBtn) doubleBtn.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}
