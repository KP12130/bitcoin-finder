'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaPaperPlane, FaComments, FaRobot } from 'react-icons/fa';
import { useChat } from '@/hooks/useChat';
import { useCurrency } from '@/hooks/useCurrency';
import { formatBTC } from '@/lib/utils';
import styles from './ChatSidebar.module.css';

export default function ChatSidebar() {
  const { messages, chatOpen, toggleChat, sendMessage } = useChat();
  const { activeSymbol } = useCurrency();
  const [inputText, setInputText] = useState('');
  const [onlineCount, setOnlineCount] = useState(140);
  
  const scrollRef = useRef(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatOpen]);

  // Simulate online user count fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount((prev) => {
        const offset = Math.floor(Math.random() * 7) - 3; // -3 to +3
        return Math.max(80, Math.min(300, prev + offset));
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const appendEmoji = (emoji) => {
    setInputText((prev) => {
      const updated = prev + emoji;
      return updated.substring(0, 150); // clamp limit
    });
  };

  if (!chatOpen) return null;

  return (
    <AnimatePresence>
      <div className={styles.chatDrawer}>
        {/* Toggle Backdrop guard for mobile */}
        <div className={styles.mobileBackdrop} onClick={toggleChat} />

        <motion.div
          className={styles.sidebar}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        >
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerTitleWrap}>
              <FaComments className={styles.chatIcon} />
              <div className={styles.headerText}>
                <h3>Social Room</h3>
                <span className={styles.onlineBadge}>
                  <span className={styles.pulseDot} />
                  {onlineCount} active players
                </span>
              </div>
            </div>
            <button className={styles.closeBtn} onClick={toggleChat} aria-label="Close chat">
              <FaTimes />
            </button>
          </div>

          {/* Messages list */}
          <div className={styles.messageList}>
            {messages.length === 0 ? (
              <div className={styles.emptyChat}>
                <p>No messages yet.</p>
                <span>Say hello in the chat box below!</span>
              </div>
            ) : (
              messages.map((msg) => {
                let formattedTime = '';
                try {
                  const dateVal = msg.created_at || msg.createdAt;
                  const d = dateVal ? new Date(dateVal) : new Date();
                  formattedTime = isNaN(d.getTime()) 
                    ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch (e) {
                  formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                
                return (
                  <div key={msg.id} className={`${styles.messageItem} ${msg.is_bot ? styles.botMessage : ''}`}>
                    <div className={styles.msgHeader}>
                      <span className={styles.avatarEmoji}>{msg.avatarEmoji || msg.avatar_emoji}</span>
                      <span className={styles.username}>{msg.username}</span>
                      {msg.is_bot && (
                        <span className={styles.botBadge}>
                          <FaRobot className={styles.botBadgeIcon} /> BOT
                        </span>
                      )}
                      <span className={styles.time}>{formattedTime}</span>
                    </div>

                    <div className={styles.msgBody}>
                      <p>{msg.message}</p>
                      
                      {/* Render Shared Bet Slip Card */}
                      {msg.bet_shared && (
                        <div className={`${styles.betCard} ${msg.bet_shared.won ? styles.betCardWin : styles.betCardLoss}`}>
                          <div className={styles.betCardHeader}>
                            <span className={styles.betCardGame}>
                              {msg.bet_shared.gameType === 'slots' ? 'Slots 🎰' :
                               msg.bet_shared.gameType === 'mines' ? 'Mines 💣' :
                               msg.bet_shared.gameType === 'crash' ? 'Crash 🚀' :
                               msg.bet_shared.gameType === 'dice' ? 'Dice 🎲' :
                               msg.bet_shared.gameType === 'limbo' ? 'Limbo 🎯' :
                               msg.bet_shared.gameType === 'tower' ? 'Tower 🏰' :
                               msg.bet_shared.gameType === 'hilo' ? 'Hi-Lo 📈' :
                               msg.bet_shared.gameType === 'blackjack' ? 'Blackjack 🃏' : 'Mining ⛏️'}
                            </span>
                            <span className={`${styles.betCardResult} ${msg.bet_shared.won ? styles.textWin : styles.textLoss}`}>
                              {msg.bet_shared.won ? 'WIN' : 'LOSS'}
                            </span>
                          </div>
                          <div className={styles.betCardBody}>
                            <div className={styles.betStat}>
                              <span>Wager</span>
                              <strong>{formatBTC(msg.bet_shared.bet)}</strong>
                            </div>
                            <div className={styles.betStat}>
                              <span>Multiplier</span>
                              <strong className={msg.bet_shared.won ? styles.textWin : ''}>
                                {parseFloat(msg.bet_shared.multiplier || 0).toFixed(2)}x
                              </strong>
                            </div>
                            <div className={styles.betStat}>
                              <span>Payout</span>
                              <strong className={msg.bet_shared.won ? styles.textWin : styles.textLoss}>
                                {msg.bet_shared.won ? '+' : '-'}
                                {formatBTC(Math.abs(msg.bet_shared.payout !== undefined ? msg.bet_shared.payout : (msg.bet_shared.bet || 0)))}
                              </strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {/* Dummy anchor to scroll to */}
            <div ref={scrollRef} />
          </div>

          {/* Footer Controls & Input */}
          <div className={styles.footer}>
            {/* Emoji shortcuts list */}
            <div className={styles.emojiList}>
              {['🔥', '💎', '🚀', '👑', '🤑', '⛏️', '🎰', '🍀'].map((emoji) => (
                <button
                  key={emoji}
                  className={styles.emojiShortcutBtn}
                  onClick={() => appendEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Message input element */}
            <div className={styles.inputWrap}>
              <input
                type="text"
                placeholder="Send a message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value.substring(0, 150))}
                onKeyDown={handleKeyDown}
                className={styles.chatInput}
                maxLength={150}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim()}
                className={styles.sendBtn}
                aria-label="Send message"
              >
                <FaPaperPlane />
              </button>
            </div>
            
            {/* Length indicators */}
            <span className={styles.charCounter}>
              {inputText.length}/150
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
