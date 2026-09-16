# ALGEBA - DeFi Staking & Genesis Platform

A minimalist React frontend for the ALGEBA token ecosystem featuring wallet connection, staking, and genesis events.

## Features

- **Wallet Connection**: Reown (WalletConnect v3) integration for secure wallet management
- **Dashboard**: Real-time statistics on total supply, staking metrics, and emission rates
- **Genesis Event**: Participate in genesis allocation and claim tokens
- **Staking**: Stake tokens, earn rewards, compound, and unstake
- **Emission Schedule**: Visual representation of token halving schedule
- **Minimalist Design**: Clean, intuitive UI with focus on usability

## Setup Instructions

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Contract Addresses

Update the contract addresses in `src/config/contracts.ts`:

```typescript
export const CONTRACTS = {
  ALGEBA: '0x...', // Your ALGEBA token address
  GENESIS: '0x...', // Your Genesis contract address
  STAKING: '0x...', // Your Staking contract address
};
```

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Project Structure

```
src/
├── components/
│   ├── Header.tsx           # Navigation & wallet connection
│   ├── Stats.tsx            # Dashboard statistics
│   ├── Genesis.tsx          # Genesis participation & claiming
│   ├── Staking.tsx          # Staking operations
│   └── EmissionChart.tsx    # Halving schedule visualization
├── config/
│   ├── contracts.ts         # Contract addresses & ABIs
│   └── constants.ts         # App constants & configuration
├── utils/
│   ├── formatting.ts        # Number & address formatting
│   └── web3.ts              # Web3 utilities & contract reads
├── types/
│   └── index.ts             # TypeScript interfaces
└── App.tsx
```

## Key Technologies

- **React 18**: Modern UI framework
- **TypeScript**: Type-safe development
- **Vite**: Lightning-fast build tool
- **TailwindCSS**: Minimalist styling
- **Viem**: Lightweight Ethereum library
- **Reown AppKit**: Wallet connection
- **Recharts**: Data visualization

## Building for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

## Network Support

The app supports Ethereum and Sepolia testnet. To add more networks, update `src/App.tsx`:

```typescript
import { mainnet, sepolia, arbitrum } from 'viem/chains';

const networks = [mainnet, sepolia, arbitrum];
```

## License

MIT
