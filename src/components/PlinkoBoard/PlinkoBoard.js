'use client';

import { useEffect, useRef, useCallback } from 'react';
import { playSound } from '@/lib/audio';
import styles from './PlinkoBoard.module.css';

// Palette mapping matching risk tiers
const RISK_COLORS = {
  low:    ['#00ff88', '#00e577'],
  medium: ['#ffd700', '#ffa500'],
  high:   ['#ff4757', '#ff6b81'],
};

export default function PlinkoBoard({ rows, risk, multipliers, dropTrigger }) {
  const canvasRef = useRef(null);
  const ballsRef = useRef([]);
  const pegsRef = useRef([]); // Stores pegs with their active pulse opacity
  const bucketsRef = useRef([]); // Stores landing buckets
  const floatingTextsRef = useRef([]); // Stores floating payout texts
  const dropTriggerRef = useRef(dropTrigger);

  // Sync dropTrigger ref to avoid effect recreation
  useEffect(() => {
    dropTriggerRef.current = dropTrigger;
  }, [dropTrigger]);

  // Set up board pegs and buckets coordinates whenever rows or multipliers change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = 600;
    const height = 550;
    canvas.width = width;
    canvas.height = height;

    const pegRowsCount = Number(rows);
    const startY = 60;
    const spacingY = (height - 120) / pegRowsCount;

    // 1. Generate peg pyramid
    const newPegs = [];
    for (let r = 0; r < pegRowsCount; r++) {
      const pegsInRow = r + 3; // Start with 3 pegs, expand
      const spacingX = (width - 80) / (pegRowsCount + 2);
      const rowWidth = (pegsInRow - 1) * spacingX;
      const startX = (width - rowWidth) / 2;

      for (let p = 0; p < pegsInRow; p++) {
        newPegs.push({
          x: startX + p * spacingX,
          y: startY + r * spacingY,
          radius: 4,
          pulse: 0, // 0 to 1, fades out
        });
      }
    }
    pegsRef.current = newPegs;

    // 2. Generate bottom buckets
    const bucketCount = pegRowsCount + 1;
    const bucketSpacing = (width - 40) / bucketCount;
    const bucketStartY = height - 40;
    const newBuckets = [];

    for (let b = 0; b < bucketCount; b++) {
      newBuckets.push({
        x: 20 + b * bucketSpacing + bucketSpacing / 2,
        y: bucketStartY,
        width: bucketSpacing - 4,
        height: 32,
        mult: multipliers[b] || 1,
        pulse: 0,
      });
    }
    bucketsRef.current = newBuckets;
  }, [rows, multipliers]);

  // External controller trigger for dropping a new ball
  useEffect(() => {
    if (!dropTrigger) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { ballId, path, resolvePayout, payout, multiplier, rows: dropRows, risk: dropRisk } = dropTrigger;

    const pegRowsCount = Number(dropRows);
    const spacingY = (canvas.height - 120) / pegRowsCount;
    const startY = 60;

    // Setup chronological target coordinates
    const targetSteps = [];
    const spacingX = (canvas.width - 80) / (pegRowsCount + 2);

    for (let r = 0; r < pegRowsCount; r++) {
      const pegsInRow = r + 3;
      const rowWidth = (pegsInRow - 1) * spacingX;
      const startX = (canvas.width - rowWidth) / 2;

      // Deterministic binary direction path index
      const routeIdx = path.slice(0, r + 1).reduce((sum, val) => sum + val, 0);
      const targetPegX = startX + routeIdx * spacingX;

      targetSteps.push({
        x: targetPegX,
        y: startY + r * spacingY,
        pegIndex: pegsRef.current.findIndex(
          (p) => Math.abs(p.y - (startY + r * spacingY)) < 2 && Math.abs(p.x - targetPegX) < spacingX
        ),
      });
    }

    // Dynamic color matching risk level
    const colors = RISK_COLORS[dropRisk] || ['#ffd700', '#ffa500'];
    const primaryColor = colors[0];

    // Push new physical ball instance
    ballsRef.current.push({
      id: ballId,
      x: canvas.width / 2 + (Math.random() * 6 - 3), // Minor center jitter
      y: 10,
      vx: 0,
      vy: 1.2,
      radius: 6,
      color: primaryColor,
      currentRow: -1,
      targetSteps,
      resolvePayout,
      payout,
      multiplier,
    });
  }, [dropTrigger]);

  // Main 60FPS physics loop
  useEffect(() => {
    let animationId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const update = () => {
      // 1. Clear with gradient
      ctx.fillStyle = '#0a0e18';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw background grid glows
      ctx.strokeStyle = 'rgba(255,255,255,0.015)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }

      const pegRowsCount = Number(rows);
      const spacingY = (canvas.height - 120) / pegRowsCount;
      const gravity = 0.16;

      // 2. Physics logic for balls
      const balls = ballsRef.current;
      for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];

        // Apply constant gravitational pull
        ball.vy += gravity;
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Trace row height to coordinate peg collision index
        const relativeY = ball.y - 60;
        const estimatedRow = Math.floor(relativeY / spacingY);

        if (estimatedRow > ball.currentRow && estimatedRow < pegRowsCount) {
          ball.currentRow = estimatedRow;
          const step = ball.targetSteps[estimatedRow];

          if (step) {
            // Apply bounce vector direction towards targets
            const diffX = step.x - ball.x;
            ball.vx = diffX * 0.08 + (Math.random() * 0.4 - 0.2);
            ball.vy = Math.min(ball.vy, 3); // Cap drop speed for elastic fluidity

            // Pulse hitting peg
            if (pegsRef.current[step.pegIndex]) {
              pegsRef.current[step.pegIndex].pulse = 1.0;
              playSound('tick');
            }
          }
        }

        // Check if ball landed in bucket at the bottom
        const bucketStartY = canvas.height - 42;
        if (ball.y >= bucketStartY) {
          // Resolve balance payout logic immediately
          if (ball.resolvePayout) ball.resolvePayout();

          // Pulse corresponding bottom bucket container
          const bucketSpacing = (canvas.width - 40) / (pegRowsCount + 1);
          const bucketIndex = Math.max(
            0,
            Math.min(pegRowsCount, Math.floor((ball.x - 20) / bucketSpacing))
          );
          if (bucketsRef.current[bucketIndex]) {
            bucketsRef.current[bucketIndex].pulse = 1.0;
          }

          // Play chimes based on multiplier size
          if (ball.multiplier >= 1.5) {
            playSound('cashout');
          } else {
            playSound('slide');
          }

          // Spawn floating payout indicators
          floatingTextsRef.current.push({
            x: ball.x,
            y: bucketStartY - 10,
            text: ball.multiplier >= 1.0 ? `+$${ball.payout.toFixed(2)}` : `${ball.multiplier}x`,
            color: ball.multiplier >= 1.0 ? '#00ff88' : 'rgba(255,255,255,0.4)',
            alpha: 1.0,
            vy: -1.0,
          });

          // Prune resolved ball from rendering
          balls.splice(i, 1);
        }
      }

      // 3. Draw Pegs
      pegsRef.current.forEach((peg) => {
        const radius = peg.radius + (peg.pulse * 3);
        const glowAlpha = peg.pulse * 0.4;

        if (glowAlpha > 0.01) {
          const grad = ctx.createRadialGradient(peg.x, peg.y, peg.radius, peg.x, peg.y, radius * 2);
          grad.addColorStop(0, 'rgba(247,147,26,0.3)');
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(peg.x, peg.y, radius * 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = peg.pulse > 0.1 ? `rgba(247,147,26,${0.4 + peg.pulse * 0.6})` : 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
        ctx.fill();

        // Fade pulse animations
        if (peg.pulse > 0) peg.pulse -= 0.06;
      });

      // 4. Draw Buckets
      bucketsRef.current.forEach((bucket) => {
        const pulseAmt = bucket.pulse;
        const color = bucket.mult >= 10 ? '#ff4757' : bucket.mult >= 1.5 ? '#ffd700' : '#00ff88';

        ctx.save();
        ctx.translate(bucket.x, bucket.y);

        // Neon outline
        ctx.strokeStyle = pulseAmt > 0.1 ? `rgba(255,255,255,${pulseAmt})` : `rgba(255,255,255,0.06)`;
        ctx.lineWidth = 1;
        ctx.strokeRect(-bucket.width / 2, -16, bucket.width, bucket.height);

        // Fill background based on hit scale
        ctx.fillStyle = pulseAmt > 0.05
          ? `rgba(${bucket.mult >= 1.5 ? '247,147,26' : '0,255,136'}, ${0.15 + pulseAmt * 0.2})`
          : 'rgba(255,255,255,0.01)';
        ctx.fillRect(-bucket.width / 2, -16, bucket.width, bucket.height);

        // Underglow indicator
        if (pulseAmt > 0) {
          ctx.shadowBlur = 12 * pulseAmt;
          ctx.shadowColor = color;
        }

        // Payout text
        ctx.fillStyle = color;
        ctx.font = '800 9px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${bucket.mult}x`, 0, 4);

        ctx.restore();

        // Fade pulse decay
        if (bucket.pulse > 0) bucket.pulse -= 0.05;
      });

      // 5. Draw active falling balls
      balls.forEach((ball) => {
        // Neon ball trailing particles
        ctx.shadowBlur = 10;
        ctx.shadowColor = ball.color;
        ctx.fillStyle = ball.color;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset canvas state
      });

      // 6. Draw floating texts
      const floatingTexts = floatingTextsRef.current;
      for (let j = floatingTexts.length - 1; j >= 0; j--) {
        const txt = floatingTexts[j];
        txt.y += txt.vy;
        txt.alpha -= 0.02;

        ctx.fillStyle = txt.color;
        ctx.font = 'bold 9px Orbitron, sans-serif';
        ctx.globalAlpha = Math.max(0, txt.alpha);
        ctx.textAlign = 'center';
        ctx.fillText(txt.text, txt.x, txt.y);
        ctx.globalAlpha = 1.0; // Reset

        if (txt.alpha <= 0) {
          floatingTexts.splice(j, 1);
        }
      }

      animationId = requestAnimationFrame(update);
    };

    update();
    return () => cancelAnimationFrame(animationId);
  }, [rows]);

  return (
    <div className={styles.boardWrap}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.topFunnel}>
        <div className={styles.funnelHole} />
      </div>
    </div>
  );
}
