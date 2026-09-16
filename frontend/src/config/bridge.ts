// LayerZero V2 bridge config: Sepolia (AGB home chain) <-> Base Sepolia Testnet.
//
// Endpoint IDs are LayerZero's own chain identifiers (NOT the EVM chain ID) and
// are stable/public: https://docs.layerzero.network/v2/deployments/chains/sepolia
// and https://docs.layerzero.network/v2/deployments/chains/base-sepolia
export const LZ_EID = {
  SEPOLIA: 40161,
  BASE_SEPOLIA: 40245,
} as const;

// Verified LayerZero EndpointV2 addresses, stored in .env. The Sepolia one has
// been confirmed; Base Sepolia is left blank until verified against the docs
// link above — do not hardcode a guessed default here (a wrong-but-valid-looking
// address deploys "successfully" but produces a bridge that silently doesn't work).
export const LZ_ENDPOINT_DEFAULTS = {
  SEPOLIA: import.meta.env.VITE_LZ_ENDPOINT_SEPOLIA || '',
  BASE_SEPOLIA: import.meta.env.VITE_LZ_ENDPOINT_BASE_SEPOLIA || '',
} as const;

// Deployed OFT contract addresses — filled in via the Deploy page's Bridge tab
export const OFT_CONTRACTS = {
  ADAPTER_SEPOLIA: import.meta.env.VITE_OFT_ADAPTER_ADDRESS || '',
  OFT_BASE_SEPOLIA: import.meta.env.VITE_OFT_BASE_SEPOLIA_ADDRESS || '',
};

export function layerZeroScanUrl(txHash: string) {
  return `https://testnet.layerzeroscan.com/tx/${txHash}`;
}

// Minimal ABI covering what the Deploy and Bridge pages need from both
// AGBOFTAdapter (Sepolia) and AGBOFT (Base Sepolia) — both share this surface since
// OFTAdapter/OFT both extend the same OFTCore.
export const OFT_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'approvalRequired',
    outputs: [{ type: 'bool' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ name: 'eid', type: 'uint32' }],
    name: 'peers',
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: '_eid', type: 'uint32' },
      { name: '_peer', type: 'bytes32' },
    ],
    name: 'setPeer',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        name: '_sendParam',
        type: 'tuple',
        components: [
          { name: 'dstEid', type: 'uint32' },
          { name: 'to', type: 'bytes32' },
          { name: 'amountLD', type: 'uint256' },
          { name: 'minAmountLD', type: 'uint256' },
          { name: 'extraOptions', type: 'bytes' },
          { name: 'composeMsg', type: 'bytes' },
          { name: 'oftCmd', type: 'bytes' },
        ],
      },
      { name: '_payInLzToken', type: 'bool' },
    ],
    name: 'quoteSend',
    outputs: [
      {
        name: 'msgFee',
        type: 'tuple',
        components: [
          { name: 'nativeFee', type: 'uint256' },
          { name: 'lzTokenFee', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        name: '_sendParam',
        type: 'tuple',
        components: [
          { name: 'dstEid', type: 'uint32' },
          { name: 'to', type: 'bytes32' },
          { name: 'amountLD', type: 'uint256' },
          { name: 'minAmountLD', type: 'uint256' },
          { name: 'extraOptions', type: 'bytes' },
          { name: 'composeMsg', type: 'bytes' },
          { name: 'oftCmd', type: 'bytes' },
        ],
      },
      {
        name: '_fee',
        type: 'tuple',
        components: [
          { name: 'nativeFee', type: 'uint256' },
          { name: 'lzTokenFee', type: 'uint256' },
        ],
      },
      { name: '_refundAddress', type: 'address' },
    ],
    name: 'send',
    outputs: [
      {
        name: 'msgReceipt',
        type: 'tuple',
        components: [
          { name: 'guid', type: 'bytes32' },
          { name: 'nonce', type: 'uint64' },
          {
            name: 'fee',
            type: 'tuple',
            components: [
              { name: 'nativeFee', type: 'uint256' },
              { name: 'lzTokenFee', type: 'uint256' },
            ],
          },
        ],
      },
      {
        name: 'oftReceipt',
        type: 'tuple',
        components: [
          { name: 'amountSentLD', type: 'uint256' },
          { name: 'amountReceivedLD', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;
