'use client';

import { useEffect, useState } from 'react';

const HALLOWEEN_EMOJIS = ['🦇', '🎃', '👻', '🕷️', '🕸️', '🦇', '👻', '🎃'];
const CHRISTMAS_EMOJIS = ['❄️', '⛄', '🎄', '⭐', '❄️', '🎅', '🎁', '❄️', '⛄', '❄️'];

function generateParticles(emojis, count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: emojis[i % emojis.length],
    left: `${Math.random() * 100}%`,
    duration: `${8 + Math.random() * 12}s`,
    swayDuration: `${3 + Math.random() * 4}s`,
    delay: `${-Math.random() * 15}s`,
    size: `${0.8 + Math.random() * 0.8}rem`,
  }));
}

export default function ThemeParticles() {
  const [theme, setTheme] = useState('default');
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const readTheme = () => {
      const t = localStorage.getItem('btcfinder_theme') || 'default';
      setTheme(t);
      if (t === 'halloween') {
        setParticles(generateParticles(HALLOWEEN_EMOJIS, 18));
      } else if (t === 'christmas') {
        setParticles(generateParticles(CHRISTMAS_EMOJIS, 25));
      } else {
        setParticles([]);
      }
    };

    readTheme();
    window.addEventListener('theme-change', readTheme);
    return () => window.removeEventListener('theme-change', readTheme);
  }, []);

  if (theme === 'default' || particles.length === 0) return null;

  return (
    <>
      {particles.map(p => (
        <span
          key={p.id}
          className="theme-particle"
          style={{
            left: p.left,
            top: '-30px',
            fontSize: p.size,
            animationDuration: `${p.duration}, ${p.swayDuration}`,
            animationDelay: `${p.delay}, ${p.delay}`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </>
  );
}
