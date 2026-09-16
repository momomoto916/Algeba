# Algeba (AGB)

ALGEBA token ecosystem: Genesis event, staking with emissions, and cross-chain OFT (LayerZero).

Repository: https://github.com/momomoto916/Algeba

## Structure

| Folder | Description |
|---|---|
| `Contracts/` | Solidity contracts (Foundry): `ALGEBA`, `Genesis`, `Staking`, `AGBOFT`, `AGBOFTAdapter` |
| `frontend/` | React + Vite + TypeScript dApp (Reown / wagmi / ethers) |

## Getting started

```bash
# Frontend (also provides OpenZeppelin & LayerZero deps for the contracts)
cd frontend
npm install
cp .env.example .env   # fill in addresses, RPC URLs, Reown project ID
npm run dev

# Contracts
cd ../Contracts
forge build
forge test
```

> Note: `Contracts/foundry.toml` remaps `@openzeppelin` and `@layerzerolabs` to `../frontend/node_modules`, so run `npm install` in `frontend/` before building the contracts.
