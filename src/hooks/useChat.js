'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isDbEnabled } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';

// Profanity list for filtering messages
const BLOCKED_WORDS = ['fck', 'fuck', 'shit', 'crap', 'ass', 'bitch', 'scam', 'cheat', 'hack', 'spam', 'idiot', 'dick', 'pussy'];

// Custom crypto NPC bot pool
const BOT_PROFILES = [
  { username: 'SatoshiGiga', avatarEmoji: '🪙' },
  { username: 'LamboSoon', avatarEmoji: '🚀' },
  { username: 'HODL_King', avatarEmoji: '👑' },
  { username: 'MineMaster', avatarEmoji: '⛏️' },
  { username: 'SolanaBull', avatarEmoji: '🔥' },
  { username: 'Dogefather', avatarEmoji: '🐶' },
  { username: 'WhaleAlert', avatarEmoji: '🐳' },
  { username: 'CryptoCowboy', avatarEmoji: '🤠' },
  { username: 'BlockHustler', avatarEmoji: '🧱' },
  { username: 'EthMaxi', avatarEmoji: '💎' },
  { username: 'PlinkoWizard', avatarEmoji: '🧙' },
  { username: 'DiceRoll21', avatarEmoji: '🎲' },
  { username: 'MoonBoy', avatarEmoji: '🌙' },
  { username: 'BtcFinderBot', avatarEmoji: '🤖' },
  { username: 'RichMiner', avatarEmoji: '💰' },
  { username: 'GoldFinder', avatarEmoji: '✨' },
  { username: 'SatoshiDisciple', avatarEmoji: '📜' },
  { username: 'WtfGasFees', avatarEmoji: '⛽' },
  { username: 'HashPower', avatarEmoji: '⚡' },
  { username: 'VitalikFan', avatarEmoji: '👽' }
];

const BOT_BANTER = [
  'Bitcoin is looking extremely strong today, heading straight to $100k!',
  'Anyone playing Limbo? Trying to hit that elusive 1000x multiplier.',
  'Slots are absolutely on fire today, just hit a 50x reels combo!',
  'Imagine selling your BTC now. Pure madness.',
  'Is it just me, or does Tower hard mode pay out like crazy if you clear 4 levels?',
  'HODL guys, the bull run is just getting started 🚀',
  'What felt color theme are you guys using? Royal Purple looks so VIP.',
  'Just registered my custom client seed, provably fair gaming is awesome.',
  'Solana is pumping today, ◎ Solana to the moon!',
  'No KYC is the best feature of this platform. Zero registration hassle.',
  'Can we get a green felt pump in the house?',
  'Plinko edges are hard to hit, but that payout is worth it.',
  'Has anyone completed all mining achievements? The 980x block badge is tough.',
  'Just converted my balance to DOGE. Ð Dogecoin speed is clean!',
  'Always check your seed hashes on the audit panel, completely transparent.',
  'Mining game is super cozy, finding hidden blocks feels like actual digging ⛏️',
  'Don\'t leverage too high, keep your wagers consistent and manage risk.',
  'Double down on Blackjack when dealer shows a 5 or 6, easiest win of my life.'
];

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const { profile } = useProfile();
  
  const messagesRef = useRef([]);
  messagesRef.current = messages;

  // 1. Toggle sidebar open/closed
  const toggleChat = useCallback(() => {
    setChatOpen((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('btcfinder_chat_open', String(next));
        window.dispatchEvent(new CustomEvent('chat-toggle-state', { detail: next }));
      }
      return next;
    });
  }, []);

  // Sync open state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('btcfinder_chat_open');
      if (saved === 'true') {
        setChatOpen(true);
      }

      const handleToggleEvent = (e) => {
        setChatOpen(e.detail);
      };
      window.addEventListener('chat-toggle-state', handleToggleEvent);
      return () => window.removeEventListener('chat-toggle-state', handleToggleEvent);
    }
  }, []);

  // 2. Profanity filter
  const filterProfanity = useCallback((text) => {
    let filtered = text;
    BLOCKED_WORDS.forEach((word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      filtered = filtered.replace(regex, '***');
    });
    return filtered;
  }, []);

  // 3. Send message handler
  const sendMessage = useCallback(async (text, betShared = null) => {
    if (!text.trim() && !betShared) return;

    const rawMsg = text.substring(0, 150); // limit length
    const cleanMsg = filterProfanity(rawMsg);
    
    // Set user info
    const username = profile?.username || 'Guest_' + Math.floor(1000 + Math.random() * 9000);
    const avatarEmoji = profile?.avatarEmoji || '⛏️';
    
    const newMsg = {
      id: `temp-${Date.now()}-${Math.random()}`,
      username,
      avatarEmoji,
      message: cleanMsg,
      bet_shared: betShared,
      is_bot: false,
      created_at: new Date().toISOString()
    };

    // Optimistic local append so chat renders instantly
    setMessages((prev) => {
      if (prev.some((m) => m.message === newMsg.message && m.username === newMsg.username && typeof m.id === 'string' && m.id.startsWith('temp-'))) {
        return prev;
      }
      return [...prev, newMsg].slice(-50);
    });

    if (isDbEnabled()) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from('chat_messages')
            .insert({
              user_id: user.id,
              username,
              avatar_emoji: avatarEmoji,
              message: cleanMsg,
              bet_shared: betShared,
              is_bot: false
            });
          if (error) throw error;
        }
      } catch (err) {
        console.error('Error inserting message to Supabase:', err);
      }
    }
  }, [profile, filterProfanity]);

  // 4. Fetch initial database messages and subscribe to real-time additions
  useEffect(() => {
    if (!isDbEnabled()) {
      // Preload welcome bot messages for offline mode
      setMessages([
        {
          id: 'welcome-1',
          username: 'BtcFinderBot',
          avatarEmoji: '🤖',
          message: 'Welcome to the Bitcoin Finder Social Room! Chat is fully active. 💬',
          is_bot: true,
          created_at: new Date(Date.now() - 60000).toISOString()
        },
        {
          id: 'welcome-2',
          username: 'SatoshiGiga',
          avatarEmoji: '🪙',
          message: 'Feel free to play games and share your bet slips in the chat! 🚀',
          is_bot: true,
          created_at: new Date(Date.now() - 30000).toISOString()
        }
      ]);
      return;
    }

    // Load last 50 messages
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (error) throw error;
        
        // Reverse so chronological order
        setMessages(data.reverse());
      } catch (err) {
        console.error('Failed to fetch chat history:', err);
      }
    };

    fetchMessages();

    // Subscribe to real-time insert channel using a unique namespace to prevent multi-instance conflicts
    const channelId = `chat_messages_realtime_${Math.random().toString(36).substring(2, 10)}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, (payload) => {
        const newMsg = payload.new;
        setMessages((prev) => {
          // Check if we already have this message (either by DB ID or matching content of temporary message)
          const exists = prev.some((m) => 
            m.id === newMsg.id || 
            (m.username === newMsg.username && 
             m.message === newMsg.message && 
             typeof m.id === 'string' && 
             m.id.startsWith('temp-'))
          );

          if (exists) {
            // Replace the optimistic temp message with the actual DB message to secure the official ID and timestamp
            return prev.map((m) => 
              (m.username === newMsg.username && m.message === newMsg.message && typeof m.id === 'string' && m.id.startsWith('temp-'))
              ? newMsg
              : m
            );
          }
          return [...prev, newMsg].slice(-50);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 5. Bot Banter generator
  useEffect(() => {
    const triggerBotMessage = () => {
      // Pick random bot profile
      const bot = BOT_PROFILES[Math.floor(Math.random() * BOT_PROFILES.length)];
      
      // Determine message type: 85% normal text banter, 15% bot sharing a simulated bet
      const isBetShare = Math.random() < 0.15;
      
      let message = '';
      let betShared = null;
      
      if (isBetShare) {
        const games = ['Mine', 'Slots', 'Crash', 'Dice', 'Plinko', 'Mines', 'Limbo', 'Tower', 'Hi-Lo', 'Blackjack'];
        const chosenGame = games[Math.floor(Math.random() * games.length)];
        const bet = parseFloat((5 + Math.random() * 95).toFixed(2));
        const won = Math.random() > 0.5;
        const multiplier = won ? parseFloat((1.2 + Math.random() * 8.8).toFixed(2)) : 0;
        const payout = won ? parseFloat((bet * multiplier).toFixed(2)) : 0;
        
        message = `Shared a bet on ${chosenGame}!`;
        betShared = {
          gameType: chosenGame.toLowerCase(),
          bet,
          multiplier,
          payout,
          won
        };
      } else {
        message = BOT_BANTER[Math.floor(Math.random() * BOT_BANTER.length)];
      }

      const botMsg = {
        id: `bot-${Date.now()}-${Math.random()}`,
        username: bot.username,
        avatarEmoji: bot.avatarEmoji,
        message,
        bet_shared: betShared,
        is_bot: true,
        created_at: new Date().toISOString()
      };

      // Append bot messages strictly locally to prevent db clutter
      setMessages((prev) => [...prev, botMsg].slice(-50));

      // Reschedule bot timer
      const nextDelay = 12000 + Math.random() * 13000; // 12s - 25s
      botTimerRef.current = setTimeout(triggerBotMessage, nextDelay);
    };

    // First delay before starting bot chats
    const botTimerRef = { current: setTimeout(triggerBotMessage, 15000) };

    return () => {
      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current);
      }
    };
  }, []);

  // 6. Bot reactions to user bets
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleNewBetSlip = (e) => {
      const bet = e.detail;
      // React only to actual player wagers
      if (!bet.isPlayer) return;

      const playerUsername = bet.name || 'Player';
      const isHighWin = bet.won && (parseFloat(bet.multiplier) >= 5.0 || bet.payout >= 100);
      const isHighLoss = !bet.won && bet.bet >= 150;

      if (isHighWin || isHighLoss) {
        // Schedule a bot response 2-4 seconds after game settles
        setTimeout(() => {
          const bot = BOT_PROFILES[Math.floor(Math.random() * BOT_PROFILES.length)];
          let message = '';

          if (isHighWin) {
            const winReactions = [
              `Sheesh @${playerUsername}, what an absolute hit on ${bet.game}! 🔥`,
              `Congrats @${playerUsername}! Insane multiplier.`,
              `Wow, congrats @${playerUsername}! Payout is huge. 🚀`,
              `Teach me your secrets @${playerUsername}, that was awesome!`,
              `Absolute legend @${playerUsername}. Going to the moon soon!`
            ];
            message = winReactions[Math.floor(Math.random() * winReactions.length)];
          } else {
            const lossReactions = [
              `Oof, tough break @${playerUsername}... that was a huge wager.`,
              `F for @${playerUsername} on ${bet.game}. You will get it back next round!`,
              `Unfortunate @${playerUsername} 😢, rest up and reload.`,
              `Unlucky block search @${playerUsername}, keep pushing.`
            ];
            message = lossReactions[Math.floor(Math.random() * lossReactions.length)];
          }

          const botMsg = {
            id: `bot-react-${Date.now()}-${Math.random()}`,
            username: bot.username,
            avatarEmoji: bot.avatarEmoji,
            message,
            bet_shared: null,
            is_bot: true,
            created_at: new Date().toISOString()
          };

          setMessages((prev) => [...prev, botMsg].slice(-50));
        }, 2000 + Math.random() * 2000);
      }
    };

    window.addEventListener('new-bet-slip', handleNewBetSlip);
    return () => window.removeEventListener('new-bet-slip', handleNewBetSlip);
  }, []);

  // 7. Share a bet manually via event dispatcher
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleShareBetEvent = (e) => {
      const entry = e.detail;
      const betShared = {
        gameType: entry.gameType || 'mine',
        bet: entry.bet,
        multiplier: entry.multiplier || (entry.won ? (entry.payout / entry.bet) : 0),
        payout: entry.payout,
        won: entry.won
      };
      
      const gameLabel = entry.gameType === 'slots' ? 'Slots' :
                        entry.gameType === 'mines' ? 'Mines' :
                        entry.gameType === 'crash' ? 'Crash' :
                        entry.gameType === 'dice' ? 'Dice' :
                        entry.gameType === 'limbo' ? 'Limbo' :
                        entry.gameType === 'tower' ? 'Tower' :
                        entry.gameType === 'hilo' ? 'Hi-Lo' :
                        entry.gameType === 'blackjack' ? 'Blackjack' : 'Mining';

      sendMessage(`Shared my bet slip on ${gameLabel}!`, betShared);
    };

    window.addEventListener('share-bet', handleShareBetEvent);
    return () => window.removeEventListener('share-bet', handleShareBetEvent);
  }, [sendMessage]);

  return {
    messages,
    chatOpen,
    toggleChat,
    sendMessage
  };
}
