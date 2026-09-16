import type { Chain } from 'viem';

declare global {
  interface Window {
    ethereum?: any;
  }
}

/** Prompts the wallet to switch to `target`, adding it first if the wallet doesn't know it yet. */
export async function ensureChain(target: Chain) {
  if (!window.ethereum) throw new Error('MetaMask not installed');
  const hexId = `0x${target.id.toString(16)}`;
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] });
  } catch (err: any) {
    if (err?.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: hexId,
          chainName: target.name,
          nativeCurrency: target.nativeCurrency,
          rpcUrls: [target.rpcUrls.default.http[0]],
          blockExplorerUrls: target.blockExplorers?.default ? [target.blockExplorers.default.url] : [],
        }],
      });
    } else {
      throw err;
    }
  }
}
