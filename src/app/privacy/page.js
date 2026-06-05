'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaUserShield } from 'react-icons/fa';
import styles from '../terms/page.module.css'; // Re-use the high-end terms stylesheet

export default function PrivacyPage() {
  return (
    <div className={styles.container}>
      <motion.div 
        className={styles.card}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Back navigation */}
        <Link href="/" className={styles.backBtn}>
          <FaArrowLeft /> Back to Home
        </Link>

        <div className={styles.header}>
          <FaUserShield className={styles.logoIcon} />
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.subtitle}>Last Updated: May 31, 2026</p>
        </div>

        <div className={styles.divider} />

        <div className={styles.content}>
          <section className={styles.section}>
            <h2>1. Our Sovereign Privacy Philosophy 🛡️</h2>
            <p>
              We believe that financial privacy, digital sovereignty, and personal identity protection are fundamental human rights. 
              Bitcoin Finder operates on a **100% Zero-KYC, non-custodial, direct-to-wallet** architecture. We do not gather, store, sell, or share your real-world identity data because **we do not collect it in the first place.**
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Information We Never Collect ❌</h2>
            <p>
              We strictly enforce a zero-knowledge data policy. We **never** ask for, collect, or process:
            </p>
            <ul>
              <li>Your physical name, biological gender, or date of birth.</li>
              <li>Your physical address, billing address, or geolocation details.</li>
              <li>Your phone number or personal communication IDs.</li>
              <li>Copies of your government ID, passport, driver's license, or biometric data.</li>
              <li>Credit card numbers, bank routing credentials, or fiat currency accounts.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>3. Information We Collect (Minimal Metadata) 📂</h2>
            <p>
              To maintain player profiles, track balances, and verify wagers, we collect only the bare minimum of technical metadata:
            </p>
            <ul>
              <li><strong>Account Credentials:</strong> A chosen unique username and an email address. The email is strictly used for account registration, password resets, and secure MFA codes (like your double-passcode admin portals).</li>
              <li><strong>Public Cryptographic Keys:</strong> Public blockchain wallet addresses (such as SOL, BTC, LTC, POL, or ETH addresses) which you choose to link for making deposits or requesting manual withdrawals. We never have access to your private keys or seed phrases!</li>
              <li><strong>Transactional Logs:</strong> Detailed history of wagers, payouts, game outcomes, and deposit/withdrawal request states, securely synced under your profile ID.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>4. On-Chain Anonymity & Public Ledgers</h2>
            <p>
              Please note that all deposit transfers and withdrawal settlements take place on public blockchains (like Bitcoin, Ethereum, Solana, and Polygon). All on-chain transfers (amounts, timestamps, sender/receiver addresses, and transaction hashes) are inherently public, permanent, and traceable on the public ledger. The Platform has no control over public blockchain explorer tracking.
            </p>
          </section>

          <section className={styles.section}>
            <h2>5. Cookies & Authentication Sessions</h2>
            <p>
              We use secure, localized browser storage (`sessionStorage` and `localStorage`) to maintain your active authentication session while you navigate our platform:
            </p>
            <ul>
              <li><strong>Sovereign Credentials storage:</strong> Your sign-in tokens are saved in secure storage so you don't have to re-enter your password on every tab.</li>
              <li><strong>Admin security isolation:</strong> The double-passcode credentials for the Administrative Security Gate are saved **only** in `sessionStorage`. They are instantly and automatically deleted from memory the moment you close your browser tab, preventing cross-device credential leaks.</li>
              <li>We do not utilize any third-party tracking, advertising, or profiling cookies.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>6. Third-Party Integrations</h2>
            <p>
              Our transaction verification scanner queries public blockchain indexers (such as Etherscan, Blockcypher, and Solana public RPC endpoints) to match exact unique deposit wagers. These public APIs only receive your public wallet address and session parameters; they never receive any personal account details.
            </p>
          </section>

          <section className={styles.section}>
            <h2>7. Contact & Data Rights</h2>
            <p>
              Because we do not store your real-world identity, we cannot delete data based on physical names. However, you can manage your account profile, change your avatar, or request the deletion of your account credentials at any time directly under the Profile dashboard.
            </p>
          </section>
        </div>

        <div className={styles.footer}>
          <p>© 2026 Satoshi Secure Gate. All rights reserved.</p>
        </div>
      </motion.div>
    </div>
  );
}
