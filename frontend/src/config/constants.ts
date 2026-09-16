// Reown configuration - Read from environment or use default
export const REOWN_PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID || '1be41507b1e49aba1030c3d5d8bdefcd';

// Wallet allowed to access the /deploy page and nav item
export const DEPLOYER_WALLET = import.meta.env.VITE_DEPLOYER_WALLET || '';

// Token decimals
export const TOKEN_DECIMALS = 18;

// Formatting
export const DISPLAY_DECIMALS = 2;

// Network
export const SUPPORTED_CHAINS = [
  1, // Ethereum mainnet
  11155111, // Sepolia testnet
];

// Contract constants — these mirror the compiled constants in ALGEBA.sol /
// Genesis.sol and are live on mainnet; GENESIS_ALLOCATION of 50 AGB is the
// real Genesis Constant, not a placeholder.
export const STAKING_ALLOCATION = '209999950';
export const GENESIS_ALLOCATION = '50';
export const MAX_SUPPLY = '210000000'; // 210M AGB
export const FIRST_EPOCH_EMISSION = '105000000'; // MAX_SUPPLY / 2 — see Staking.sol for the TOTAL_EMISSION clamp
export const TOTAL_EMISSION = '209999950'; // matches STAKING_ALLOCATION
