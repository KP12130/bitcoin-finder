'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './CrashGraph.module.css';

const GRAPH_W = 600;
const GRAPH_H = 340;
const PAD_L = 48;
const PAD_B = 36;
const PAD_R = 16;
const PAD_T = 20;

// Map multiplier value to canvas Y (log scale feels better)
function multToY(mult, maxMult = 200) {
  // 1.0x = bottom, higher = top. Use log scale.
  const logVal = Math.log(Math.max(1, mult));
  const logMax = Math.log(maxMult);
  const ratio = Math.min(1, logVal / logMax);
  return (GRAPH_H - PAD_B) - ratio * (GRAPH_H - PAD_B - PAD_T);
}

function timeToX(elapsed, maxElapsed = 30000) {
  const ratio = Math.min(1, elapsed / maxElapsed);
  return PAD_L + ratio * (GRAPH_W - PAD_L - PAD_R);
}

export default function CrashGraph({ phase, multiplier, history }) {
  const canvasRef = useRef(null);
  const pointsRef = useRef([]); // [{x, y}]
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);
  const MAX_ELAPSED = 30000; // 30s = full width

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = GRAPH_W * dpr;
    const H = GRAPH_H * dpr;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.scale(dpr, dpr);

    const crashed = phase === 'crashed';
    const lineColor = crashed ? '#ff4757' : '#00ff88';

    // Calculate dynamic scaling parameters
    const latestPoint = pointsRef.current[pointsRef.current.length - 1];
    const currentElapsed = latestPoint ? latestPoint.t : 0;
    const currentMult = latestPoint ? latestPoint.m : multiplier;

    const maxElapsed = Math.max(10000, currentElapsed * 1.3);
    const maxMult = Math.max(2, currentMult * 1.4);

    // ── Grid lines ──
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = PAD_T + (i / 5) * (GRAPH_H - PAD_B - PAD_T);
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(GRAPH_W - PAD_R, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      const x = PAD_L + (i / 5) * (GRAPH_W - PAD_L - PAD_R);
      ctx.beginPath();
      ctx.moveTo(x, PAD_T);
      ctx.lineTo(x, GRAPH_H - PAD_B);
      ctx.stroke();
    }

    // ── Axes ──
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD_L, PAD_T);
    ctx.lineTo(PAD_L, GRAPH_H - PAD_B);
    ctx.lineTo(GRAPH_W - PAD_R, GRAPH_H - PAD_B);
    ctx.stroke();

    // ── Curve ──
    if (pointsRef.current.length > 1) {
      const canvasPoints = pointsRef.current.map(p => {
        const x = timeToX(p.t, maxElapsed);
        const y = multToY(p.m, maxMult);
        return { x, y };
      });

      // Glow fill under curve
      const grad = ctx.createLinearGradient(0, PAD_T, 0, GRAPH_H - PAD_B);
      grad.addColorStop(0, crashed ? 'rgba(255,71,87,0.25)' : 'rgba(0,255,136,0.25)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.moveTo(canvasPoints[0].x, GRAPH_H - PAD_B);
      canvasPoints.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(canvasPoints[canvasPoints.length - 1].x, GRAPH_H - PAD_B);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Curve line with glow
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      canvasPoints.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Dot at tip
      if (!crashed) {
        const last = canvasPoints[canvasPoints.length - 1];
        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // ── Y-axis labels ──
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000].forEach(val => {
      if (val > maxMult) return;
      const y = multToY(val, maxMult);
      if (y > PAD_T && y < GRAPH_H - PAD_B) {
        ctx.fillText(`${val}x`, PAD_L - 6, y + 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(GRAPH_W - PAD_R, y);
        ctx.stroke();
      }
    });

    ctx.restore();
  }, [phase, multiplier]);

  // Running animation
  useEffect(() => {
    if (phase === 'running') {
      if (!startTimeRef.current) {
        startTimeRef.current = performance.now();
        pointsRef.current = []; // Clear graph curve points at the start of a new round
      }
      const elapsed = performance.now() - startTimeRef.current;
      pointsRef.current.push({ t: elapsed, m: multiplier });
      if (pointsRef.current.length > 800) pointsRef.current.shift(); // keep memory lean
      drawFrame();
    } else if (phase === 'crashed' || phase === 'cashedout') {
      drawFrame();
    }
  }, [multiplier, phase, drawFrame]);

  // Reset curve on new round
  useEffect(() => {
    if (phase === 'idle' || phase === 'betting') {
      pointsRef.current = [];
      startTimeRef.current = null;
      drawFrame();
    } else if (phase === 'crashed' || phase === 'cashedout') {
      // Clear start time so that a subsequent run starts fresh
      startTimeRef.current = null;
    }
  }, [phase, drawFrame]);

  // Setup canvas DPR scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = GRAPH_W * dpr;
    canvas.height = GRAPH_H * dpr;
    drawFrame();
  }, [drawFrame]);

  const isCrashed = phase === 'crashed';
  const isCashedOut = phase === 'cashedout';
  const isRunning = phase === 'running';

  return (
    <div className={`${styles.graphWrapper} ${isCrashed ? styles.crashed : ''}`}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={{ width: GRAPH_W, height: GRAPH_H }}
      />

      {/* Multiplier overlay */}
      <div className={styles.multiplierOverlay}>
        <AnimatePresence mode="wait">
          {isCrashed ? (
            <motion.div
              key="crashed"
              className={styles.crashedDisplay}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 10, stiffness: 200 }}
            >
              <div className={styles.crashEmoji}>💥</div>
              <div className={styles.crashedMult}>{multiplier.toFixed(2)}x</div>
              <div className={styles.crashedLabel}>CRASHED!</div>
            </motion.div>
          ) : isCashedOut ? (
            <motion.div
              key="cashedout"
              className={styles.cashedOutDisplay}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12 }}
            >
              <div className={styles.cashedEmoji}>💰</div>
              <div className={styles.cashedMult}>{multiplier.toFixed(2)}x</div>
              <div className={styles.cashedLabel}>CASHED OUT!</div>
            </motion.div>
          ) : isRunning ? (
            <motion.div
              key="running"
              className={styles.runningDisplay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className={styles.liveMult}>{multiplier.toFixed(2)}x</div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              className={styles.idleDisplay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className={styles.idleText}>🚀 Place your bet and launch!</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* History ticker */}
      {history.length > 0 && (
        <div className={styles.historyTicker}>
          {history.map((pt, i) => (
            <span
              key={i}
              className={`${styles.historyPill} ${
                pt >= 3 ? styles.pillHigh :
                pt >= 1.5 ? styles.pillMid :
                styles.pillLow
              }`}
            >
              {pt.toFixed(2)}x
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
