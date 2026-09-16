import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { WalletProvider } from './context/WalletContext';
import { NetworkProvider, useNetwork } from './context/NetworkContext';
import { REOWN_PROJECT_ID, REPO_URL } from './config/constants';
import { Home } from './pages/Home';
import { GenesisPage } from './pages/GenesisPage';
import { Whitepaper } from './pages/Whitepaper';
import { Deploy } from './pages/Deploy';
import { Bridge } from './pages/Bridge';
import { Security } from './pages/Security';

function Layout() {
  const { network } = useNetwork();
  const isTestnet = network.key === 'sepolia';
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      <main className="flex-1 w-full px-2.5">
        <div className="px-[1%] md:px-[5%]">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/genesis" element={<GenesisPage />} />
            <Route path="/whitepaper" element={<Whitepaper />} />
            <Route path="/bridge" element={<Bridge />} />
            <Route path="/security" element={<Security />} />
            <Route path="/deploy" element={<Deploy />} />
          </Routes>
        </div>
      </main>

      <footer className="bg-white mt-16 border-t border-platinum w-full px-2.5">
        <div className="py-12" style={{ paddingLeft: '5%', paddingRight: '5%' }}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
              <div>
                <h3 className="font-bold mb-4">ALGEBA</h3>
                <p className="text-sm text-muted">A number two strangers can both check.</p>
              </div>

              <div>
                <h3 className="font-bold mb-4 text-sm uppercase tracking-wide">Documentation</h3>
                <ul className="space-y-2">
                  <li>
                    <a href="/whitepaper" className="text-sm hover:underline text-navy">
                      Whitepaper
                    </a>
                  </li>
                  <li>
                    <a href="/genesis" className="text-sm hover:underline text-navy">
                      Genesis Guide
                    </a>
                  </li>
                  <li>
                    <a href="/" className="text-sm hover:underline text-navy">
                      Staking Guide
                    </a>
                  </li>
                  <li>
                    <a href="/security" className="text-sm hover:underline text-navy">
                      Security &amp; Audits
                    </a>
                  </li>
                  <li>
                    <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline text-navy">
                      Open Source
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold mb-4 text-sm uppercase tracking-wide">Network</h3>
                <ul className="space-y-2">
                  <li className="text-sm text-muted">Network: {network.label}{isTestnet ? ' Testnet' : ' Mainnet'}</li>
                  <li className="text-sm text-muted">Chain: Ethereum</li>
                  <li className="text-sm text-muted">Status: {isTestnet ? 'Testnet Only' : 'Live'}</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold mb-4 text-sm uppercase tracking-wide">Supply</h3>
                <ul className="space-y-2">
                  <li className="text-sm text-muted">Genesis: 50 AGB</li>
                  <li className="text-sm text-muted">Staking: 209,999,950 AGB</li>
                  <li className="text-sm text-muted">Max: 210,000,000 AGB</li>
                </ul>
              </div>
            </div>

            {isTestnet && (
              <div className="alert alert-primary mb-8">
                <strong>Notice:</strong> This is a testnet deployment for demonstration purposes only. Do not use with real assets. Data may be reset without notice.
              </div>
            )}

            <div className="pt-8 text-center text-sm border-t border-platinum text-muted">
              <p>© 2024 ALGEBA. All rights reserved.</p>
            </div>
        </div>
      </footer>
    </div>
  );
}

function AppContent() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-navy">
            <span className="text-white font-bold">Ａ</span>
          </div>
          <p className="text-muted">Loading ALGEBA...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

export default function App() {
  const projectId = REOWN_PROJECT_ID;

  if (!projectId || projectId.length === 0 || projectId === 'undefined') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <div className="card-body">
            <h1 className="text-2xl font-bold mb-4 text-navy">Configuration Error</h1>
            <p className="text-muted mb-4">
              Reown Project ID is not properly configured.
            </p>
            <p className="text-sm text-muted mb-4">
              Make sure your <code className="px-2 py-1 rounded-md bg-platinum">.env</code> file contains:
            </p>
            <code className="block rounded-md text-xs mb-4 text-left p-3 bg-platinum">
              VITE_REOWN_PROJECT_ID=1be41507b1e49aba1030c3d5d8bdefcd
            </code>
            <p className="text-xs text-muted">
              Restart the dev server after adding the .env file.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <NetworkProvider>
      <WalletProvider>
        <AppContent />
      </WalletProvider>
    </NetworkProvider>
  );
}
