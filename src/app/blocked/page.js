'use client';

import { motion } from 'framer-motion';
import { FaGlobe, FaLock } from 'react-icons/fa';
import styles from './page.module.css';

export default function BlockedPage() {
  return (
    <div className={styles.container}>
      <motion.div 
        className={styles.card}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className={styles.iconWrap}>
          <FaGlobe className={styles.globeIcon} />
          <FaLock className={styles.lockIcon} />
        </div>

        <h1 className={styles.title}>Access Restricted</h1>
        <p className={styles.status}>Error Code: 403 Forbidden</p>
        
        <div className={styles.divider} />

        <p className={styles.message}>
          Due to local licensing, regulatory compliance, and geographic restrictions, the entertainment services of **Satoshi Secure Gate** are not available in your region.
        </p>
        
        <p className={styles.submessage}>
          Access from your current IP address has been restricted. We apologize for any inconvenience.
        </p>

        <div className={styles.footer}>
          <p>© 2026 Satoshi Secure Gate. All rights reserved.</p>
        </div>
      </motion.div>
    </div>
  );
}
