'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaShieldAlt } from 'react-icons/fa';
import styles from './page.module.css';

export default function TermsPage() {
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
          <FaShieldAlt className={styles.logoIcon} />
          <h1 className={styles.title}>Terms of Service</h1>
          <p className={styles.subtitle}>Last Updated: May 31, 2026</p>
        </div>

        <div className={styles.divider} />

        <div className={styles.content}>
          <section className={styles.section}>
            <h2>1. Contractual Relationship & Agreement</h2>
            <p>
              These Terms of Service ("Terms") govern your access and use of the Bitcoin Finder application, services, and associated smart contract integrations (collectively, the "Platform"). By accessing the Platform, registering an account, or initiating any cryptocurrency transaction, you agree to be bound by these Terms. If you do not agree to these Terms, you must immediately cease all access and use.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Eligibility & Age Restrictions (Strictly 18+)</h2>
            <p>
              You must be at least **18 years of age** (or the age of majority in your jurisdiction, whichever is higher) to access or use the Platform. The Platform does not solicit or permit registrations from underage users. By using the Platform, you represent and warrant that you meet this age requirement and hold full legal capacity to enter into binding agreements.
            </p>
          </section>

          <section className={styles.section}>
            <h2>3. Cryptographic Entertainment & Financial Risk Disclaimer</h2>
            <p>
              Bitcoin Finder is a decentralized, provably-fair virtual mining and prediction platform. 
            </p>
            <div className={styles.alertWarning}>
              <strong>⚠️ CRITICAL DISCLAIMER:</strong> All wagers, wagers, and transactions on this Platform carry high financial risk. Virtual asset values can fluctuate rapidly. You are solely responsible for any losses incurred. **NO REFUNDS OR BALANCE ADJUSTMENTS** will be made under any circumstances. You should never bet money you cannot afford to lose.
            </div>
          </section>

          <section className={styles.section}>
            <h2>4. Non-Custodial "Direct-to-Wallet" Model</h2>
            <p>
              The Platform utilizes a 100% decentralized, non-custodial, direct-to-wallet deposit architecture:
            </p>
            <ul>
              <li>When depositing, player assets are transferred **directly** to the designated outcome wallet of the administrator on-chain.</li>
              <li>The Platform does not operate a fiat bank, holding account, or centralized merchant custodial panel.</li>
              <li>Withdrawals are processed **manually** by the administrator following standard security, double-spend, and block confirmation verification reviews.</li>
              <li>You acknowledge and accept that processing delays may occur during blockchain congestion or security audits.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>5. Provably Fair Verification & Auditing</h2>
            <p>
              All game outcomes are determined deterministically using public SHA-256 seed-hashing algorithms:
              `SHA-256(ServerSeed - ClientSeed - Nonce)`. 
              Admins and players can audit and verify past round outcomes under the Verification Panel to prove that results are completely transparent, mathematically unbiased, and free from administrative manipulation.
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. Prohibited Jurisdictions & Legal Compliance</h2>
            <p>
              Access to cryptocurrency wagering may be restricted or prohibited in certain countries, states, or jurisdictions (including, but not limited to, the United States, the United Kingdom, and heavily regulated markets). 
              It is your sole responsibility to ensure that your access and use of the Platform complies with all local laws and regulations. You assume all legal and financial liabilities arising from local non-compliance.
            </p>
          </section>

          <section className={styles.section}>
            <h2>7. Limitation of Liability</h2>
            <p>
              THE PLATFORM IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND. In no event shall the Platform developers, administrators, or owners be liable for any indirect, incidental, special, consequential, or punitive damages (including loss of profits, cryptocurrency, or data) arising out of your access or inability to access the service.
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
