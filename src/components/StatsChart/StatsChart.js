'use client';

import { useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BiLineChart } from 'react-icons/bi';
import styles from './StatsChart.module.css';

export default function StatsChart({ profitHistory = [] }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = 220;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);

    if (profitHistory.length < 2) return;

    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const profits = profitHistory.map((d) => d.profit);
    const minP = Math.min(0, ...profits);
    const maxP = Math.max(0, ...profits);
    const range = maxP - minP || 1;

    const xStep = chartW / (profitHistory.length - 1);

    const toX = (i) => padding.left + i * xStep;
    const toY = (v) => padding.top + chartH - ((v - minP) / range) * chartH;

    // ── Zero line ──
    const zeroY = toY(0);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(width - padding.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Axis labels ──
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(maxP.toFixed(2), padding.left - 6, padding.top + 4);
    ctx.fillText('0', padding.left - 6, zeroY + 3);
    ctx.fillText(minP.toFixed(2), padding.left - 6, padding.top + chartH + 4);

    // X-axis labels (first and last game)
    ctx.textAlign = 'center';
    ctx.fillText(profitHistory[0].game, toX(0), height - 6);
    ctx.fillText(
      profitHistory[profitHistory.length - 1].game,
      toX(profitHistory.length - 1),
      height - 6
    );

    // ── Build path ──
    const points = profitHistory.map((d, i) => ({ x: toX(i), y: toY(d.profit) }));

    // ── Fill gradient (green above zero, red below) ──
    // Above-zero fill
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, chartW, zeroY - padding.top);
    ctx.clip();

    const gradUp = ctx.createLinearGradient(0, padding.top, 0, zeroY);
    gradUp.addColorStop(0, 'rgba(0,255,136,0.18)');
    gradUp.addColorStop(1, 'rgba(0,255,136,0.02)');
    ctx.fillStyle = gradUp;
    ctx.beginPath();
    ctx.moveTo(points[0].x, zeroY);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, zeroY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Below-zero fill
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, zeroY, chartW, chartH - (zeroY - padding.top));
    ctx.clip();

    const gradDown = ctx.createLinearGradient(0, zeroY, 0, padding.top + chartH);
    gradDown.addColorStop(0, 'rgba(255,71,87,0.02)');
    gradDown.addColorStop(1, 'rgba(255,71,87,0.18)');
    ctx.fillStyle = gradDown;
    ctx.beginPath();
    ctx.moveTo(points[0].x, zeroY);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, zeroY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ── Line ──
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Draw line segments with color based on profit value
    for (let i = 0; i < points.length - 1; i++) {
      const avg = (profitHistory[i].profit + profitHistory[i + 1].profit) / 2;
      ctx.strokeStyle = avg >= 0 ? '#00ff88' : '#ff4757';
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i + 1].x, points[i + 1].y);
      ctx.stroke();
    }

    // ── Dots on last point ──
    const last = points[points.length - 1];
    const lastProfit = profitHistory[profitHistory.length - 1].profit;
    const dotColor = lastProfit >= 0 ? '#00ff88' : '#ff4757';
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Glow ring
    ctx.strokeStyle = dotColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [profitHistory]);

  useEffect(() => {
    draw();

    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  const hasData = profitHistory.length >= 2;

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.header}>
        <BiLineChart className={styles.headerIcon} />
        <h3 className={styles.title}>Profit / Loss Over Time</h3>
      </div>

      <div className={styles.canvasContainer} ref={containerRef}>
        {hasData ? (
          <canvas ref={canvasRef} className={styles.canvas} />
        ) : (
          <div className={styles.empty}>
            <p>Play some games to see your chart</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
