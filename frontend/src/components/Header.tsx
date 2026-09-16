import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { requestWalletConnection, disconnectWallet, isDeployerWallet } from '../utils/wallet';
import { useWallet } from '../context/WalletContext';
import { useNetwork } from '../context/NetworkContext';
import { NETWORKS, type NetworkKey } from '../config/networks';
import { ensureChain } from '../utils/chainSwitch';
import type { Address } from 'viem';
import { formatAddress } from '../utils/formatting';
import logoAlgeba from '../assets/logo-algeba.png';

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/genesis', label: 'Genesis' },
  { to: '/bridge', label: 'Bridge' },
  { to: '/whitepaper', label: 'Whitepaper' },
];

export function Header() {
  const { walletAddress, isConnected, setWalletAddress, setIsConnected } = useWallet();
  const { networkKey, setNetworkKey } = useNetwork();
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const showDeployLink = isConnected && isDeployerWallet(walletAddress);

  const handleNetworkChange = async (newKey: NetworkKey) => {
    if (newKey === networkKey) return;

    // Nothing connected yet — just switch what the app displays.
    if (!isConnected) {
      setNetworkKey(newKey);
      return;
    }

    setIsSwitchingNetwork(true);
    try {
      await ensureChain(NETWORKS[newKey].chain);
      setNetworkKey(newKey);
    } catch (error) {
      console.error('Network switch rejected or failed:', error);
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const wallet = await requestWalletConnection();
      if (wallet.isConnected && wallet.address) {
        setIsConnected(true);
        setWalletAddress(wallet.address as Address);
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    const wallet = disconnectWallet();
    setIsConnected(wallet.isConnected);
    setWalletAddress(wallet.address);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-platinum-dark bg-white">
      <div className="w-full px-2.5 py-2">
        <div className="flex items-center justify-between gap-6" style={{ paddingLeft: '5%', paddingRight: '5%' }}>
          {/* Logo Section */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <img
              src={logoAlgeba}
              alt="ALGEBA"
              className="h-8 w-auto"
            />
          </div>

          {/* Nav Menu (desktop) */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
            {showDeployLink && (
              <NavLink
                to="/deploy"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Deploy
              </NavLink>
            )}
          </nav>

          {/* Right Section (desktop) */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            <select
              value={networkKey}
              onChange={(e) => handleNetworkChange(e.target.value as NetworkKey)}
              disabled={isSwitchingNetwork}
              title={isSwitchingNetwork ? 'Switching network...' : 'Select network'}
              className="text-xs font-semibold py-1.5 px-2 w-auto disabled:opacity-50"
              aria-label="Select network"
            >
              {Object.values(NETWORKS).map((n) => (
                <option key={n.key} value={n.key}>{n.label}</option>
              ))}
            </select>
            {isConnected && walletAddress ? (
              <button
                onClick={handleDisconnect}
                className="btn btn-secondary text-sm"
              >
                {formatAddress(walletAddress)}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="btn btn-primary text-sm"
              >
                {isLoading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>

          {/* Mobile menu toggle */}
          <div className="flex md:hidden items-center flex-shrink-0">
            <button
              onClick={() => setIsMenuOpen((open) => !open)}
              className="md:hidden inline-flex items-center justify-center p-1.5 rounded-sm border border-platinum-dark text-navy"
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {isMenuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M3 6h18M3 12h18M3 18h18" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Nav Menu (slide down) */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
          style={{ paddingLeft: '5%', paddingRight: '5%' }}
        >
          <nav className="flex flex-col gap-1 pt-3 pb-2 border-t border-platinum-dark mt-2">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setIsMenuOpen(false)}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
            {showDeployLink && (
              <NavLink
                to="/deploy"
                onClick={() => setIsMenuOpen(false)}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Deploy
              </NavLink>
            )}
          </nav>

          <div className="flex flex-col gap-2 pb-3 border-t border-platinum-dark pt-3">
            <select
              value={networkKey}
              onChange={(e) => handleNetworkChange(e.target.value as NetworkKey)}
              disabled={isSwitchingNetwork}
              title={isSwitchingNetwork ? 'Switching network...' : 'Select network'}
              className="text-xs font-semibold py-1.5 px-2 w-full disabled:opacity-50"
              aria-label="Select network"
            >
              {Object.values(NETWORKS).map((n) => (
                <option key={n.key} value={n.key}>{n.label}</option>
              ))}
            </select>
            {isConnected && walletAddress ? (
              <button
                onClick={() => { handleDisconnect(); setIsMenuOpen(false); }}
                className="btn btn-secondary text-sm w-full"
              >
                {formatAddress(walletAddress)}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="btn btn-primary text-sm w-full"
              >
                {isLoading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
