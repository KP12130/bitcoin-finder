import { Orbitron, Inter } from 'next/font/google';
import AuthGuard from '@/components/AuthGuard/AuthGuard';
import { LiveBetsProvider } from '@/hooks/useLiveBets';
import { CurrencyProvider } from '@/hooks/useCurrency';
import ThemeParticles from '@/components/ThemeParticles/ThemeParticles';
import JuiceEngine from '@/components/JuiceEngine/JuiceEngine';
import './globals.css';

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'Bitcoin Finder — Crypto Mining Casino',
  description: 'Mine for the hidden block number and win big! A provably-fair crypto casino game with virtual BTC.',
  keywords: 'bitcoin, casino, mining, crypto, game, gambling',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${orbitron.variable} ${inter.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeParticles />
        <JuiceEngine />
        <AuthGuard>
          <CurrencyProvider>
            <LiveBetsProvider>
              <main>{children}</main>
            </LiveBetsProvider>
          </CurrencyProvider>
        </AuthGuard>
      </body>
    </html>
  );
}
