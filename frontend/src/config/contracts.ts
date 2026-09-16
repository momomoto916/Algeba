// Sepolia-specific contract addresses. The LayerZero bridge (config/bridge.ts,
// pages/Bridge.tsx, pages/deploy/DeployBridge.tsx) always uses Sepolia as its
// home chain regardless of the Ethereum/Sepolia network switch in the header —
// this export exists for that fixed use. Everywhere else in the app should use
// useNetwork()'s current network.contracts instead (see context/NetworkContext).
export const CONTRACTS = {
  ALGEBA: import.meta.env.VITE_ALGEBA_ADDRESS_SEPOLIA || '',
  GENESIS: import.meta.env.VITE_GENESIS_ADDRESS_SEPOLIA || '',
  STAKING: import.meta.env.VITE_STAKING_ADDRESS_SEPOLIA || '',
};

// Contract ABIs
export const ALGEBA_ABI = [
  {
    "inputs": [],
    "name": "MAX_SUPPLY",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "GENESIS_ALLOCATION",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "STAKING_ALLOCATION",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "emittedSupply",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "stakingMinted",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "remainingStakingEmission",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }],
    "name": "allowance",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }],
    "name": "approve",
    "outputs": [{ "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export const GENESIS_ABI = [
  {
    "inputs": [{ "name": "proof", "type": "bytes32[]" }],
    "name": "participate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "finalize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "claim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "participantCount",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "finalized",
    "outputs": [{ "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "allocationOf",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "", "type": "address" }],
    "name": "eligible",
    "outputs": [{ "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "claimed",
    "outputs": [{ "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "allocationPerWallet",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "claimable",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "status",
    "outputs": [
      { "name": "open", "type": "bool" },
      { "name": "done", "type": "bool" },
      { "name": "remaining", "type": "uint256" },
      { "name": "participants", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const STAKING_ABI = [
  {
    "inputs": [{ "name": "amount", "type": "uint256" }],
    "name": "stake",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "claim",
    "outputs": [{ "name": "reward", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "compound",
    "outputs": [{ "name": "reward", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "amount", "type": "uint256" }],
    "name": "unstake",
    "outputs": [{ "name": "reward", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "emergencyWithdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalStaked",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "pendingReward",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "users",
    "outputs": [
      { "name": "amount", "type": "uint256" },
      { "name": "rewardDebt", "type": "uint256" },
      { "name": "rewards", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "currentEpoch",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "currentEmissionPerSecond",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextHalvingTime",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "emittedSupply",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
