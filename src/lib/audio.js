'use client';

// Web Audio API Casino Audio Synthesis Engine
let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    console.warn('AudioContext initialization failed:', e);
    return null;
  }
}

// Retrieve settings from LocalStorage
function getAudioSettings() {
  if (typeof window === 'undefined') return { volume: 50, muted: false };
  try {
    const stored = localStorage.getItem('btcfinder_vip_settings');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {}
  return { volume: 50, muted: false };
}

export function playSound(type) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const { volume, muted } = getAudioSettings();
    if (muted || volume <= 0) return;

    const masterVolume = volume / 100;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (type) {
      case 'slide': // Zip / Card slide dealing
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
        gain.gain.setValueAtTime(masterVolume * 0.12, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;

      case 'flip': // Soft flip scrape / click
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);
        gain.gain.setValueAtTime(masterVolume * 0.15, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
        break;

      case 'win': // Cheerful arpeggio
        {
          osc.type = 'sine';
          const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
          gain.gain.setValueAtTime(masterVolume * 0.15, now);
          notes.forEach((freq, idx) => {
            const noteTime = now + idx * 0.07;
            osc.frequency.setValueAtTime(freq, noteTime);
          });
          gain.gain.setValueAtTime(masterVolume * 0.15, now);
          gain.gain.setValueAtTime(masterVolume * 0.15, now + 0.2);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc.start(now);
          osc.stop(now + 0.5);
        }
        break;

      case 'loss': // Sad descending pitch
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(55, now + 0.35);
        gain.gain.setValueAtTime(masterVolume * 0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
        break;

      case 'cashout': // Cash register / golden chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.frequency.setValueAtTime(1318.51, now + 0.06); // E6
        osc.frequency.setValueAtTime(1567.98, now + 0.12); // G6
        gain.gain.setValueAtTime(masterVolume * 0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
        break;

      case 'tick': // Short high-pitch click
        osc.type = 'sine';
        osc.frequency.setValueAtTime(750, now);
        gain.gain.setValueAtTime(masterVolume * 0.04, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.015);
        osc.start(now);
        osc.stop(now + 0.015);
        break;

      case 'explosion': // White noise filtering crash
        try {
          const bufferSize = ctx.sampleRate * 0.45;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          const noise = ctx.createBufferSource();
          noise.buffer = buffer;

          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(650, now);
          filter.frequency.exponentialRampToValueAtTime(20, now + 0.45);

          noise.connect(filter);
          filter.connect(gain);

          gain.gain.setValueAtTime(masterVolume * 0.28, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

          noise.start(now);
          noise.stop(now + 0.45);
        } catch (err) {
          // Fallback tone if buffer fails
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(100, now);
          osc.frequency.linearRampToValueAtTime(20, now + 0.3);
          gain.gain.setValueAtTime(masterVolume * 0.2, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
        }
        break;

      case 'spin': // Clicky mechanical reel click
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.06);
        gain.gain.setValueAtTime(masterVolume * 0.06, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
        break;

      default:
        break;
    }
  } catch (audioErr) {
    console.warn('Audio playSound encountered an error:', audioErr);
  }
}
