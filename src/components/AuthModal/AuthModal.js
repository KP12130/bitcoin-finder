'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaUser, FaEnvelope, FaLock, FaCheck } from 'react-icons/fa';
import { supabase } from '@/lib/supabase';
import styles from './AuthModal.module.css';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (tab === 'login') {
        // Sign In
        const { data, error: authErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authErr) throw authErr;

        // Enforce email verification
        if (!data.user?.email_confirmed_at) {
          setError('Please verify your email before signing in. Check your inbox for the confirmation link.');
          return;
        }

        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      } else {
        // Sign Up
        if (!username || username.trim().length < 3) {
          throw new Error('Username must be at least 3 characters.');
        }

        const { data, error: authErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim(),
              avatar: 'miner',
            },
          },
        });
        if (authErr) throw authErr;

        if (data?.session) {
          // Automatic sign in on registration if configured in Supabase
          if (onAuthSuccess) onAuthSuccess(data.user);
          onClose();
        } else {
          setSuccessMsg('Registration successful! Please check your email for a verification link.');
          // Reset inputs
          setEmail('');
          setPassword('');
          setUsername('');
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  }, [tab, email, password, username, onAuthSuccess, onClose]);

  const handleResend = useCallback(async () => {
    setResendLoading(true);
    setResendSuccess(false);
    try {
      await supabase.auth.resend({ type: 'signup', email });
      setResendSuccess(true);
    } catch (e) {
      // silently ignore
    } finally {
      setResendLoading(false);
    }
  }, [email]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <FaTimes />
            </button>

            {/* Header Tabs */}
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`}
                onClick={() => { setTab('login'); setError(''); setSuccessMsg(''); setResendSuccess(false); }}
              >
                Sign In
              </button>
              <button
                className={`${styles.tab} ${tab === 'register' ? styles.tabActive : ''}`}
                onClick={() => { setTab('register'); setError(''); setSuccessMsg(''); setResendSuccess(false); }}
              >
                Register
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className={styles.form}>
              <h2 className={styles.title}>
                {tab === 'login' ? 'Welcome Back!' : 'Start Your Climb'}
              </h2>
              <p className={styles.subtitle}>
                {tab === 'login'
                  ? 'Access your cloud balances and history'
                  : 'Register a cloud account to sync bets and safe balances'}
              </p>

              {/* Success Message */}
              {successMsg && (
                <div className={styles.successBox}>
                  <FaCheck className={styles.successIcon} />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Error Message */}
              {error && <div className={styles.errorBox}>{error}</div>}

              {/* Resend Verification Email */}
              {error && error.includes('verify your email') && (
                <div style={{ textAlign: 'center', marginTop: '-0.5rem' }}>
                  {resendSuccess ? (
                    <p style={{ color: '#00ff88', fontSize: '0.75rem', fontWeight: '700' }}>✅ Email sent! Check your inbox.</p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendLoading}
                      style={{
                        background: 'rgba(0,212,255,0.1)',
                        border: '1px solid rgba(0,212,255,0.3)',
                        borderRadius: '8px',
                        padding: '0.4rem 1rem',
                        color: '#00d4ff',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      {resendLoading ? 'Sending...' : '📧 Resend Verification Email'}
                    </button>
                  )}
                </div>
              )}

              {/* Username field (Register only) */}
              {tab === 'register' && (
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Username</label>
                  <div className={styles.inputWrapper}>
                    <FaUser className={styles.inputIcon} />
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Email Address</label>
                <div className={styles.inputWrapper}>
                  <FaEnvelope className={styles.inputIcon} />
                  <input
                    type="email"
                    className={styles.input}
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setResendSuccess(false); }}
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Password</label>
                <div className={styles.inputWrapper}>
                  <FaLock className={styles.inputIcon} />
                  <input
                    type="password"
                    className={styles.input}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={loading}
                className={styles.submitBtn}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <span className={styles.spinner} />
                ) : tab === 'login' ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
