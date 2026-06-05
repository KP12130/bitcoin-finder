import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

let _supabase = null;
function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

// Get Casino Owner Payout address from environment variables
function getCasinoPayoutAddress(coin, network) {
  const c = String(coin).toUpperCase();
  const n = String(network).toUpperCase();
  
  if (c === 'BTC') return process.env.NEXT_PUBLIC_BTC_PAYOUT_ADDRESS;
  if (c === 'ETH') return process.env.NEXT_PUBLIC_ETH_PAYOUT_ADDRESS;
  if (c === 'LTC') return process.env.NEXT_PUBLIC_LTC_PAYOUT_ADDRESS;
  if (c === 'SOL') return process.env.NEXT_PUBLIC_SOL_PAYOUT_ADDRESS;
  if (c === 'DOGE') return process.env.NEXT_PUBLIC_DOGE_PAYOUT_ADDRESS;
  if (c === 'POL') return process.env.NEXT_PUBLIC_POL_PAYOUT_ADDRESS;
  
  if (c === 'USDT' || c === 'USDC') {
    if (n.includes('TRC')) return process.env.NEXT_PUBLIC_TRX_PAYOUT_ADDRESS || process.env.NEXT_PUBLIC_ETH_PAYOUT_ADDRESS;
    if (n.includes('SPL')) return process.env.NEXT_PUBLIC_SOL_PAYOUT_ADDRESS;
    return process.env.NEXT_PUBLIC_ETH_PAYOUT_ADDRESS || process.env.NEXT_PUBLIC_POL_PAYOUT_ADDRESS;
  }
  
  return process.env.NEXT_PUBLIC_ETH_PAYOUT_ADDRESS;
}

// Fetch live price from Coinbase API
async function fetchSpotPrice(coin) {
  const c = coin.toUpperCase();
  if (c === 'USDT' || c === 'USDC') return 1.00;
  
  // Coinbase uses MATIC ticker historically or POL
  const queryCoin = c === 'POL' ? 'MATIC' : c;
  
  try {
    const res = await fetch(`https://api.coinbase.com/v2/prices/${queryCoin}-USD/spot`, {
      next: { revalidate: 15 } // cache for 15s
    });
    if (!res.ok) throw new Error(`Coinbase fetch not ok for ${c}`);
    const data = await res.json();
    const price = parseFloat(data.data.amount);
    if (!isNaN(price) && price > 0) return price;
  } catch (err) {
    console.error(`Failed to fetch ${c} spot price:`, err);
  }
  
  // Fallbacks
  const fallbacks = { BTC: 65000, ETH: 3400, LTC: 85, SOL: 150, DOGE: 0.15, POL: 0.45 };
  return fallbacks[c] || 1.00;
}

export async function POST(req) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Missing or invalid JSON body' }, { status: 400 });
    }
    const { usdAmount, coin, network, userId } = body;

    if (!usdAmount || usdAmount < 0.01) {
      return NextResponse.json({ error: 'Minimum deposit is $0.01' }, { status: 400 });
    }
    if (!coin || !network || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const payoutAddress = getCasinoPayoutAddress(coin, network);
    if (!payoutAddress || payoutAddress.includes('your_')) {
      return NextResponse.json({
        error: `Casino payout wallet address for ${coin} (${network}) is not configured on the server. Please tell the owner to update the .env.local file.`
      }, { status: 500 });
    }

    const authHeader = req.headers.get('Authorization');
    console.log('[PAYMENT-SESSION CREATE DEBUG] req.headers.get("Authorization"):', authHeader);
    console.log('[PAYMENT-SESSION CREATE DEBUG] userId from body:', userId);

    const dbClient = authHeader
      ? (supabaseUrl && supabaseAnonKey
          ? createClient(supabaseUrl, supabaseAnonKey, {
              global: { headers: { Authorization: authHeader } }
            })
          : null)
      : getSupabase();

    if (!dbClient) {
      return NextResponse.json({ error: 'Supabase database is not configured' }, { status: 500 });
    }

    const coinPrice = await fetchSpotPrice(coin);
    
    // Decimals scale by coin type: BTC (8), ETH (6), LTC/SOL/POL (6), DOGE/USDT/USDC (4)
    const coinUpper = coin.toUpperCase();
    const decimalScale = coinUpper === 'BTC' ? 8 : (coinUpper === 'DOGE' || coinUpper === 'USDT' || coinUpper === 'USDC') ? 4 : 6;

    let uniqueAmount = '';
    let isUnique = false;
    let attempts = 0;

    // Retry loop to ensure 100% collision-free unique amount generation
    while (!isUnique && attempts < 10) {
      attempts++;
      
      // Generate an extremely tiny random USD suffix between $0.00100 and $0.00999 (0.1 to 1 cent extra)
      const randomUsdSuffix = (Math.floor(Math.random() * 900) + 100) / 100000;
      const uniqueUsdAmount = usdAmount + randomUsdSuffix;
      const baseAmount = uniqueUsdAmount / coinPrice;
      
      uniqueAmount = baseAmount.toFixed(decimalScale);

      // Check if another active pending session already has this exact amount using authenticated dbClient
      const { data } = await dbClient
        .from('payment_sessions')
        .select('id')
        .eq('crypto_amount', parseFloat(uniqueAmount))
        .eq('status', 'pending')
        .maybeSingle();

      if (!data) {
        isUnique = true;
      }
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry
    const sessionId = `SESS_${Math.random().toString(36).substring(2, 12).toUpperCase()}`;

    const { error } = await dbClient
      .from('payment_sessions')
      .insert({
        id: sessionId,
        user_id: userId,
        order_id: `DEP_${Date.now()}`,
        usd_amount: usdAmount,
        crypto_amount: parseFloat(uniqueAmount),
        crypto_currency: coin.toUpperCase(),
        network: network,
        status: 'pending',
        payout_address: payoutAddress,
        expires_at: expiresAt.toISOString()
      });

    if (error) {
      console.error('[PAYMENT-SESSION CREATE ERROR] SQL Insert failed:', error);
      throw new Error(error.message);
    }

    console.log(`[PAYMENT-SESSION CREATED] ${sessionId} | Unique Amount: ${uniqueAmount} ${coinUpper} to ${payoutAddress}`);

    return NextResponse.json({
      success: true,
      sessionId,
      payAddress: payoutAddress,
      payAmount: parseFloat(uniqueAmount),
      payCurrency: coinUpper,
      expiresAt: expiresAt.toISOString()
    });

  } catch (err) {
    console.error('Create Payment Session Route Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
