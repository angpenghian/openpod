import { ethers } from 'ethers';

// x402 Protocol configuration
export const X402_CONFIG = {
  facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
  network: (process.env.X402_NETWORK || 'base-sepolia') as 'base' | 'base-sepolia',
  platformWallet: process.env.OPENPOD_WALLET_ADDRESS || '',
};

// USDC contract addresses by network
const USDC_ADDRESSES: Record<string, string> = {
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

// RPC endpoints by network
const RPC_URLS: Record<string, string> = {
  base: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  'base-sepolia': 'https://sepolia.base.org',
};

// ERC-20 balanceOf ABI (minimal)
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

/**
 * Read USDC balance for a wallet address on Base.
 * Returns balance in USDC (6 decimals).
 */
export async function getUsdcBalance(walletAddress: string): Promise<number> {
  if (!walletAddress || !ethers.isAddress(walletAddress)) return 0;

  const rpcUrl = RPC_URLS[X402_CONFIG.network];
  const usdcAddress = USDC_ADDRESSES[X402_CONFIG.network];

  if (!rpcUrl || !usdcAddress) return 0;

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const usdc = new ethers.Contract(usdcAddress, ERC20_ABI, provider);
    const balance = await usdc.balanceOf(walletAddress);
    // USDC has 6 decimals
    return Number(ethers.formatUnits(balance, 6));
  } catch (err) {
    console.error('Failed to read USDC balance:', err);
    return 0;
  }
}

/**
 * Validate a wallet address (Ethereum-compatible hex address).
 */
export function isValidWalletAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Build x402 payment required response details.
 * Returns the headers/body an agent should see when a 402 is required.
 */
export function buildPaymentRequired(
  payeeWallet: string,
  priceUsdc: number,
  description: string,
) {
  return {
    payTo: payeeWallet,
    price: priceUsdc.toFixed(6),
    currency: 'USDC',
    network: X402_CONFIG.network,
    facilitator: X402_CONFIG.facilitatorUrl,
    description,
  };
}

/**
 * Verify an x402 payment via the Coinbase facilitator.
 * Returns the transaction hash if verified, null if invalid.
 */
export async function verifyX402Payment(
  paymentHeader: string,
  expectedPayee: string,
  expectedAmount: number,
): Promise<{ txHash: string; settled: boolean } | null> {
  try {
    const res = await fetch(`${X402_CONFIG.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment: paymentHeader,
        payee: expectedPayee,
        amount: expectedAmount.toFixed(6),
        currency: 'USDC',
        network: X402_CONFIG.network,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      txHash: data.tx_hash || data.txHash || '',
      settled: data.settled ?? true,
    };
  } catch {
    return null;
  }
}
