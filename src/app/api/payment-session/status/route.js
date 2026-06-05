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

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || process.env.POLYGONSCAN_API_KEY || '';

// Inline Blockchain scanners per network
async function scanEVMChain(session, chainId) {
  const apiKey = ETHERSCAN_API_KEY;
  if (!apiKey) {
    console.warn('[EVM SCAN WARNING] Missing Etherscan API Key');
    return null;
  }

  const payoutAddr = session.payout_address.toLowerCase();
  const coin = session.crypto_currency.toUpperCase();
  const isToken = coin === 'USDT' || coin === 'USDC';
  const action = isToken ? 'tokentx' : 'txlist';

  // ERC20 Contract mappings on Ethereum (Chain 1) and Polygon (Chain 137)
  const tokenContracts = {
    1: {
      USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    },
    137: {
      USDT: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      USDC: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359'
    }
  };

  const contractAddress = isToken ? (tokenContracts[chainId]?.[coin] || '') : '';
  
  try {
    let url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=${action}&address=${payoutAddr}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey=${apiKey}`;
    if (isToken && contractAddress) {
      url += `&contractaddress=${contractAddress}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== '1' || !data.result) return null;

    for (const tx of data.result) {
      // Confirm destination matches payout address
      if (tx.to?.toLowerCase() !== payoutAddr) continue;

      // EVM decimals: ETH/POL (18 decimals), USDT/USDC (6 decimals)
      const decimals = isToken ? 6 : 18;
      const txValue = Number(tx.value) / Math.pow(10, decimals);

      // Match by exact crypto amount
      if (Number(session.crypto_amount).toFixed(6) === txValue.toFixed(6)) {
        console.log(`[EVM MATCH FOUND] Chain: ${chainId} | TxHash: ${tx.hash} | Amount: ${txValue} ${coin}`);
        return tx.hash;
      }
    }
  } catch (err) {
    console.error(`[EVM SCAN ERROR] Chain: ${chainId}`, err);
  }
  return null;
}

async function scanUTXOChain(session, explorerName) {
  const payoutAddr = session.payout_address;
  const coin = session.crypto_currency.toLowerCase();
  
  try {
    // Blockcypher public direct-to-wallet transactions indexer
    const res = await fetch(`https://api.blockcypher.com/v1/${explorerName}/main/addrs/${payoutAddr}/full?limit=50`);
    if (!res.ok) return null;
    const data = await res.json();

    const txs = data.txs || [];
    for (const tx of txs) {
      // Scan transaction outputs for our personal address
      const outputs = tx.outputs || [];
      for (const out of outputs) {
        const addresses = out.addresses || [];
        if (addresses.includes(payoutAddr)) {
          // Blockcypher UTXO scale is satoshis (10^8)
          const txValue = out.value / 1e8;
          
          if (Number(session.crypto_amount).toFixed(8) === txValue.toFixed(8)) {
            console.log(`[UTXO MATCH FOUND] Coin: ${coin} | TxHash: ${tx.hash} | Amount: ${txValue}`);
            return tx.hash;
          }
        }
      }
    }
  } catch (err) {
    console.error(`[UTXO SCAN ERROR] Coin: ${coin}`, err);
  }
  return null;
}

async function scanSolanaChain(session) {
  const payoutAddr = session.payout_address;
  const coin = session.crypto_currency.toUpperCase();
  const isToken = coin === 'USDT' || coin === 'USDC';
  
  try {
    // Solana Public JSON-RPC Endpoint
    const res = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [payoutAddr, { limit: 15 }]
      })
    });
    
    if (!res.ok) return null;
    const data = await res.json();
    const sigs = data.result || [];

    for (const sigInfo of sigs) {
      // Query transaction details
      const txRes = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [sigInfo.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
        })
      });

      if (!txRes.ok) continue;
      const txData = await txRes.json();
      const tx = txData.result;
      if (!tx) continue;

      // Parse transfer values from parsed transaction instructions
      const instructions = tx.transaction?.message?.instructions || [];
      for (const inst of instructions) {
        if (inst.program === 'system' && inst.parsed?.type === 'transfer' && !isToken) {
          const info = inst.parsed.info;
          if (info.destination === payoutAddr) {
            // Native SOL (9 decimals)
            const amountSol = info.lamports / 1e9;
            if (Number(session.crypto_amount).toFixed(4) === amountSol.toFixed(4)) {
              console.log(`[SOLANA MATCH FOUND] Signature: ${sigInfo.signature} | Amount: ${amountSol}`);
              return sigInfo.signature;
            }
          }
        } else if (inst.program === 'spl-token' && inst.parsed?.type === 'transferChecked' && isToken) {
          const info = inst.parsed.info;
          if (info.destination === payoutAddr) {
            // SPL Token USDT/USDC (6 decimals)
            const amountToken = Number(info.tokenAmount.amount) / 1e6;
            if (Number(session.crypto_amount).toFixed(4) === amountToken.toFixed(4)) {
              console.log(`[SOLANA TOKEN MATCH FOUND] Signature: ${sigInfo.signature} | Amount: ${amountToken} ${coin}`);
              return sigInfo.signature;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[SOLANA SCAN ERROR]', err);
  }
  return null;
}

export async function GET(req) {
  try {
    const authHeader = req.headers.get('Authorization');
    console.log('[PAYMENT-SESSION STATUS DEBUG] req.headers.get("Authorization"):', authHeader);

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

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 });
    }

    const { data: session, error } = await dbClient
      .from('payment_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !session) {
      return NextResponse.json({ error: 'Payment session not found' }, { status: 404 });
    }

    // Return cached finished states instantly
    if (session.status !== 'pending') {
      return NextResponse.json({ success: true, status: session.status });
    }

    // Set status to expired if duration exceeded (15 minutes)
    if (new Date() > new Date(session.expires_at)) {
      await dbClient
        .from('payment_sessions')
        .update({ status: 'expired' })
        .eq('id', sessionId);
      return NextResponse.json({ success: true, status: 'expired' });
    }

    // ── Perform Active Blockchain Scans ──
    const networkUpper = session.network.toUpperCase();
    const coinUpper = session.crypto_currency.toUpperCase();
    let txHash = null;

    if (networkUpper.includes('POLYGON')) {
      txHash = await scanEVMChain(session, 137); // Chain 137 = Polygon Mainnet
    } else if (networkUpper.includes('ERC-20') || networkUpper.includes('ETHEREUM')) {
      txHash = await scanEVMChain(session, 1);   // Chain 1 = Ethereum Mainnet
    } else if (coinUpper === 'BTC') {
      txHash = await scanUTXOChain(session, 'btc');
    } else if (coinUpper === 'LTC') {
      txHash = await scanUTXOChain(session, 'ltc');
    } else if (coinUpper === 'DOGE') {
      txHash = await scanUTXOChain(session, 'doge');
    } else if (coinUpper === 'SOL' || networkUpper.includes('SPL')) {
      txHash = await scanSolanaChain(session);
    }

    // ── Credit Account & Settle Ledger if Matched ──
    if (txHash) {
      // 1. Update Payment Session Status to completed
      await dbClient
        .from('payment_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);

      // 2. Fetch Player Balance
      const { data: profile } = await dbClient
        .from('profiles')
        .select('balance')
        .eq('id', session.user_id)
        .single();

      if (profile) {
        const usdAmount = Number(session.usd_amount);
        const newBalance = Number((Number(profile.balance) + usdAmount).toFixed(2));

        // 3. Credit Player Account Balance
        await dbClient
          .from('profiles')
          .update({ balance: newBalance })
          .eq('id', session.user_id);

        // 4. Log Deposit transaction into Ledger history
        await dbClient
          .from('ledger')
          .insert({
            id: `PAY_${sessionId}`,
            user_id: session.user_id,
            type: 'deposit',
            amount: usdAmount,
            fee: 0.00,
            crypto_currency: coinUpper,
            crypto_amount: Number(session.crypto_amount),
            status: 'completed',
            label: `Real Direct-to-Wallet ${coinUpper} Deposit`,
            txid: txHash,
            address: session.payout_address
          });

        console.log(`[PAYMENT-SESSION COMPLETED] Settle Success: $${usdAmount} USD credited to ${session.user_id}`);
        return NextResponse.json({ success: true, status: 'completed', txHash });
      }
    }

    return NextResponse.json({ success: true, status: 'pending' });

  } catch (err) {
    console.error('Verify Payment Status Route Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
