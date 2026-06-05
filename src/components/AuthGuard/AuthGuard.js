'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { FaBitcoin } from 'react-icons/fa';
import { supabase, isDbEnabled } from '@/lib/supabase';

// Routes that don't require authentication
const PUBLIC_PATHS = ['/'];

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // DB not configured → run in demo mode, no auth needed
    if (!isDbEnabled()) {
      setReady(true);
      return;
    }

    const check = (session) => {
      const isAuthed = !!session?.user;
      const isPublic = PUBLIC_PATHS.includes(pathname);

      if (!isAuthed && !isPublic) {
        // Trying to access a protected page → kick to landing
        router.replace('/');
        return false;
      }

      if (isAuthed && isPublic) {
        // Already logged in and on landing → send to lobby
        router.replace('/lobby');
        return false;
      }

      return true; // correct page for their auth state
    };

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (check(session)) setReady(true);
    });

    // Listen for login / logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!check(session)) setReady(false); // reset while redirecting
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Show a minimal spinner while checking auth
  if (!ready) {
    return (
        <div suppressHydrationWarning style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <motion.div
          suppressHydrationWarning
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          style={{ color: '#f7931a', fontSize: '2.5rem', filter: 'drop-shadow(0 0 16px rgba(247,147,26,0.5))' }}
        >
          <div suppressHydrationWarning>
            <FaBitcoin />
          </div>
        </motion.div>
      </div>
    );
  }

  return children;
}
