const SEVERITY_STYLES: Record<string, string> = {
  High: 'bg-red-50 text-red-700 border border-red-200',
  Medium: 'bg-orange-50 text-orange-700 border border-orange-200',
  Low: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  Info: 'bg-platinum text-navy border border-platinum-dark',
};

const STATUS_STYLES: Record<string, string> = {
  'Accepted Risk': 'bg-platinum text-navy border border-platinum-dark',
  Fixed: 'bg-green-50 text-green-700 border border-green-200',
  Open: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
};

function SeverityBadge({ level }: { level: string }) {
  return <span className={`badge ${SEVERITY_STYLES[level] ?? SEVERITY_STYLES.Info}`}>{level}</span>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLES[status] ?? STATUS_STYLES['Accepted Risk']}`}>{status}</span>;
}

// Status palette is fixed by design convention (never re-themed to brand colors),
// so a score band always reads the same regardless of site skin.
function scoreColor(score: number): string {
  if (score >= 90) return '#0ca30c'; // good
  if (score >= 75) return '#fab219'; // warning
  if (score >= 50) return '#ec835a'; // serious
  return '#d03b3b'; // critical
}

interface ScoreCategory {
  label: string;
  weight: number;
  score: number;
  note: string;
}

const SCORE_CATEGORIES: ScoreCategory[] = [
  { label: 'Reentrancy & checks-effects-interactions', weight: 15, score: 98, note: 'nonReentrant on every state-changing external function; state updated before external calls throughout.' },
  { label: 'Access control & privilege minimization', weight: 15, score: 96, note: 'Only one owner-gated function exists (ALGEBA.setStaking, one-time); every access-control path is now covered by tests, not just manual review.' },
  { label: 'Arithmetic & emission logic', weight: 15, score: 93, note: 'Second-pass audit found and fixed two real bugs here (AGB-05 dust-stake index overflow, AGB-06 end-of-emission principal lock), both proven with attack tests before fixing. The supply cap was never breakable, and the halving schedule is correct. Scored below the other strong categories because both fixes are new and have only been reviewed internally.' },
  { label: 'Centralization / key-compromise resilience', weight: 15, score: 95, note: 'Staking and Genesis have no owner at all; ALGEBA ownership is renounced on Sepolia testnet (verified on-chain: owner() returns the zero address). Only remaining step is repeating the renounce on mainnet after setStaking() there. Scope: AGBOFT/AGBOFTAdapter (the LayerZero bridge contracts) are audited separately — not included here.' },
  { label: 'Static analysis (Slither)', weight: 10, score: 96, note: 'Full run across all in-scope contracts, re-run after fixes: no real high/medium findings, only known false positives on == 0 guard checks. After the switch to a timestamp-based schedule it also reports 9 low-severity “timestamp” notes, which are reviewed and not exploitable on Ethereum mainnet (see AGB-09). Slither did not detect AGB-05 or AGB-06; those needed manual review and attack tests.' },
  { label: 'Sybil / economic design resistance', weight: 10, score: 90, note: 'Fixed via an immutable Merkle-root whitelist (see AGB-01): only pre-approved addresses can ever register, verified with a dedicated 500-fake-wallet attack simulation. Not a perfect 100 — on-chain enforcement is airtight, but real-world protection still depends on how carefully the whitelist itself was curated off-chain.' },
  { label: 'Documentation & code clarity', weight: 10, score: 90, note: 'NatSpec present on all public functions; corrected after this review caught one stale comment.' },
  { label: 'Automated test coverage', weight: 10, score: 96, note: '72 tests (unit, fuzz, timestamp-schedule, stateful invariant, and a 40-scenario full-lifetime simulation). Staking.sol has 100% line, branch, and function coverage; Genesis.sol 100% of lines; ALGEBA.sol 94%. The invariant suite now fails on any blocked exit instead of silently ignoring it, which was the blind spot that let AGB-05 and AGB-06 through the first pass.' },
];

const COMPOSITE_SCORE = Math.round(
  SCORE_CATEGORIES.reduce((sum, c) => sum + c.score * (c.weight / 100), 0)
);

function ScoreMeter({ category }: { category: ScoreCategory }) {
  const color = scoreColor(category.score);
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-sm font-medium text-navy">
          {category.label} <span className="text-xs text-muted">({category.weight}%)</span>
        </span>
        <span className="text-sm font-semibold text-navy shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {category.score}/100
        </span>
      </div>
      <div className="h-2 rounded-full bg-platinum overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${category.score}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-muted mt-1.5">{category.note}</p>
    </div>
  );
}

interface Finding {
  id: string;
  title: string;
  severity: 'High' | 'Medium' | 'Low' | 'Info';
  status: 'Accepted Risk' | 'Fixed' | 'Open';
  contract: string;
  summary: string;
  detail: string;
  resolution: string;
}

const FINDINGS: Finding[] = [
  {
    id: 'AGB-01',
    title: 'Genesis registration had no Sybil resistance',
    severity: 'High',
    status: 'Fixed',
    contract: 'Genesis.sol',
    summary:
      'participate() originally allowed any address to register once, with no allowlist, KYC, or cost beyond gas. A single actor controlling many wallets could register repeatedly and capture a disproportionate share of the fixed 50 AGB genesis pool, since the payout is split evenly across all registrants.',
    detail:
      'Weighed against a permissionless, wallet-based design philosophy (deliberately no identity/KYC of any kind), then reconsidered once the specific goal was clarified: permissionless participation and Sybil resistance are separable if the gate is a fixed, pre-curated address list rather than an identity check. An immutable Merkle-root allowlist achieves that — no owner, no KYC, no updatable admin list, just a one-time, pre-finalized set of addresses committed at deploy time.',
    resolution:
      'Fixed: Genesis.sol now takes an immutable merkleRoot_ constructor argument (cannot be changed after deployment — no setter, no owner) and participate(bytes32[] proof) verifies the caller against it before registering. Verified with a dedicated test simulating the exact attack described above: 500 non-whitelisted wallets attempt to register and all revert with NotWhitelisted, while only the pre-approved addresses succeed. The whitelist itself must be fully finalized before deployment — see scripts/build-genesis-whitelist.mjs.',
  },
  {
    id: 'AGB-02',
    title: 'ALGEBA ↔ Staking wiring is a one-time, irreversible action',
    severity: 'Medium',
    status: 'Accepted Risk',
    contract: 'ALGEBA.sol',
    summary:
      'setStaking() can only ever be called once (StakingAlreadySet guard), and Staking’s token/genesis addresses are immutable at construction. A wrong address at deploy time permanently breaks reward minting, with no on-chain recovery path.',
    detail:
      'Evaluated against a 48-hour correction window and a two-step propose/confirm pattern, both of which would add a small recoverability window at the cost of weakening the immutability guarantee.',
    resolution:
      'Decision: keep the current immutable, one-shot design. Risk is mitigated entirely through deployment process — automated post-deploy sanity checks, a testnet dry run, and executing the mainnet setStaking() call via a multisig rather than a single EOA. The contract documents this explicitly and recommends renouncing ALGEBA ownership immediately after setStaking() is called, since the owner role carries no further privilege afterward — already done and verified on-chain on Sepolia; the same step is still outstanding on mainnet.',
  },
  {
    id: 'AGB-03',
    title: 'Stale doc comment overstated the Genesis allocation',
    severity: 'Info',
    status: 'Fixed',
    contract: 'ALGEBA.sol',
    summary:
      'A comment stated Genesis was "pre-funded with 10M AGB," contradicting the actual GENESIS_ALLOCATION constant of 50 AGB.',
    detail: 'Documentation-only issue; no behavioral impact. Could have misled a future contributor or external auditor about actual tokenomics.',
    resolution: 'Fixed — comment corrected to reference the real constants (GENESIS_ALLOCATION, STAKING_ALLOCATION).',
  },
  {
    id: 'AGB-04',
    title: 'Genesis rounding dust is permanently unclaimed',
    severity: 'Info',
    status: 'Fixed',
    contract: 'Genesis.sol',
    summary:
      'allocationPerWallet() uses integer division (GENESIS_ALLOCATION / participantCount); the remainder wei is never distributed and there is no sweep function.',
    detail: 'Accepted trade-off: adding a sweep function would require a privileged withdrawal path, which was judged a worse trust trade-off than leaving a few wei of dust unclaimed.',
    resolution: 'Fixed — behavior documented explicitly in code (allocationPerWallet()) rather than changed.',
  },
  {
    id: 'AGB-05',
    title: 'A 1-wei stake could permanently cap how much anyone can stake',
    severity: 'High',
    status: 'Fixed',
    contract: 'Staking.sol',
    summary:
      'accRewardPerShare grows in inverse proportion to totalStaked and never decreases. A sole staker holding 1 wei inflated it until any normal-sized position overflowed in stake(), reverting for everyone, permanently.',
    detail:
      'Found in the second-pass audit and proven with an attack test using the Deploy page’s real halving setting. For 1 wei plus gas, about 6.7 hours as the only staker made a 10 AGB stake revert. After the attacker left, no position larger than ~5.8 AGB could ever exist again, and a longer attack pushes that limit toward zero. The attacker also earns 100% of emission while doing it. Missed by the first audit, the original test suite, and Slither.',
    resolution:
      'Fixed: added MIN_STAKE = 1 AGB. Every position must be either 0 or at least 1 AGB, and a partial unstake cannot leave dust. That bounds accRewardPerShare for the contract’s whole life at TOTAL_EMISSION × PRECISION / MIN_STAKE (≈2.1e44). Any possible position times that bound stays roughly 2.6 million times below the uint256 limit. Regression test: a sole staker sitting at exactly 1 AGB through the entire schedule (the worst case) still leaves the largest realistic position (≈210M AGB) stakeable and withdrawable. A new invariant checks that no position ever falls between 0 and MIN_STAKE.',
  },
  {
    id: 'AGB-06',
    title: 'The last staker’s principal could be locked at the end of emission',
    severity: 'Medium',
    status: 'Fixed',
    contract: 'Staking.sol',
    summary:
      'Floor rounding in per-user reward accounting can leave total owed rewards a few wei above what ALGEBA can still mint. Once emission is exhausted, the final claim exceeds the mint cap and reverts. Because unstake() minted the reward before returning principal, that staker’s principal was stuck permanently.',
    detail:
      'Found in the second-pass audit and proven with a full-lifetime simulation. In 20 of 40 randomized scenarios run past emission exhaustion, owed rewards exceeded the mint cap by 1–8 wei, and one staker could not exit, including positions of about 3.4M AGB. With a 4-year halving period this could only occur about 88 years after launch, and only if the pool is never empty for more than roughly a minute. It is still exactly the end-of-emission failure the protocol has to survive.',
    resolution:
      'Fixed in two layers. (1) claim(), compound(), and unstake() cap every payout at ALGEBA’s remaining mintable amount, so the last claimers forfeit a few wei of dust instead of reverting. (2) A new emergencyWithdraw() returns principal without touching emission or minting, so no present or future reward-path failure can trap principal. Regression test: the same 40 scenarios, which still hit the over-cap condition, now end with every staker exiting successfully. A new invariant fails if any full unstake or emergency withdraw ever reverts across 128,000 random calls.',
  },
  {
    id: 'AGB-07',
    title: 'The first staker captures all emission until others join',
    severity: 'Low',
    status: 'Accepted Risk',
    contract: 'Staking.sol',
    summary:
      'Emission starts at the first stake after Genesis is finalized and is shared pro rata by stake. With a 4-year halving period that is about 0.83 AGB per second (~72,000 AGB/day), while only 50 AGB exists at launch. Whoever stakes first earns everything until anyone else stakes.',
    detail:
      'This is how the reward math is designed, not a way to mint more than the schedule allows: total emission is unaffected, only who receives it. It does make launch timing matter.',
    resolution:
      'Operational: coordinate all whitelisted wallets to claim from Genesis and stake at the same time at launch.',
  },
  {
    id: 'AGB-08',
    title: 'If no whitelisted wallet participates, staking can never start',
    severity: 'Low',
    status: 'Accepted Risk',
    contract: 'Genesis.sol',
    summary:
      'All 50 AGB in existence sits in Genesis. If no whitelisted wallet participates before the window closes, finalize() leaves every token locked forever, nobody can stake, and the 209,999,950 AGB staking allocation can never be minted.',
    detail:
      'Adding a fallback recipient would add a privileged address to a contract that currently has none. The deployer wallet is on the whitelist, which makes this unlikely in practice.',
    resolution:
      'Operational: make sure at least one whitelisted wallet (the deployer’s) participates. Also keep the whitelist at 50 addresses or fewer so every wallet receives at least MIN_STAKE (1 AGB) and can stake on its own.',
  },
  {
    id: 'AGB-09',
    title: 'Halving schedule was tied to block count, not calendar time',
    severity: 'Low',
    status: 'Fixed',
    contract: 'Staking.sol',
    summary:
      'Halvings were counted in blocks (10,520,000 blocks ≈ 4 years at 12-second blocks). Missed slots already stretched that to about 4.04 years. If Ethereum ever shortened its block time, for example to the 6-second slots that have been discussed, every “4-year” halving would arrive in about 2 years.',
    detail:
      'This could never break the supply cap or per-epoch amounts, only the calendar pace of emission, which is part of what the protocol promises.',
    resolution:
      'Fixed: the schedule now runs on block.timestamp. halvingPeriod is set in seconds at deployment (4 years = 126,230,400), and each halving lands exactly that long after the first stake regardless of block time or missed slots. The cap, per-epoch amounts, halving math, and both second-pass fixes are unchanged. On Ethereum mainnet a block’s timestamp is fixed by its slot, so validators cannot shift it. Slither’s 9 “timestamp” notes on Staking.sol were reviewed for that reason and are not exploitable there. Tests confirm that blocks alone never advance the schedule, elapsed time alone does, halvings land exactly on each period boundary, and a real 4-year first epoch emits its full 105M AGB.',
  },
  {
    id: 'AGB-11',
    title: 'Empty-pool periods lose emission permanently',
    severity: 'Info',
    status: 'Accepted Risk',
    contract: 'Staking.sol',
    summary:
      'Any stretch of time with nothing staked permanently forfeits that stretch’s emission. It is not handed to later stakers.',
    detail:
      'This cannot break the supply cap. At the start, the schedule emits about 0.83 AGB per second, so if the pool sits empty for more than roughly one minute early on, the full 209,999,950 AGB will never be reached. The maximum supply is a ceiling, not a guarantee.',
    resolution: 'Documented behavior. Worth stating plainly in the whitepaper.',
  },
  {
    id: 'AGB-10',
    title: 'Deploy defaults and reward views need attention before mainnet',
    severity: 'Info',
    status: 'Open',
    contract: 'Deploy page / Staking.sol views',
    summary:
      'The Deploy page used to default the Genesis window to 0.2 hours (12 minutes), too short for a real launch. currentEmissionPerSecond() and nextHalvingTime() keep reporting emission after the cap is exhausted, and pendingReward() does not show the few-wei end-of-emission cap from AGB-06.',
    detail: 'None of these affect funds; they affect launch configuration and what the UI displays.',
    resolution: 'Partly resolved: the Genesis duration input is now in minutes and defaults to 1440 (24 hours). Still open: the display-only views, which can be addressed in the frontend.',
  },
];

const SCOPE = [
  { name: 'ALGEBA.sol', role: 'Fixed-cap ERC-20 token, staking-gated minting', lines: 63 },
  { name: 'Genesis.sol', role: 'Fair-launch registration and claim contract', lines: 127 },
  { name: 'Staking.sol', role: 'Permissionless staking with a timestamp-based halving schedule', lines: 284 },
];

const ROLES = [
  {
    role: 'ALGEBA owner',
    holder: 'None — ownership renounced on Sepolia testnet (owner() verified on-chain as the zero address). Must be repeated on mainnet after setStaking() there.',
    powers: 'None. setStaking() was callable once only, already exercised at launch, and is now permanently unreachable since there is no owner left to call it.',
    blastRadius: 'N/A — no privileged role exists on this deployment.',
  },
  {
    role: 'Staking',
    holder: 'No owner — fully immutable',
    powers: 'None. No pause, no upgrade, no admin mint.',
    blastRadius: 'N/A — no privileged role exists in this contract.',
  },
  {
    role: 'Genesis',
    holder: 'No owner — fully immutable',
    powers: 'None. No pause, no upgrade, no fund recovery.',
    blastRadius: 'N/A — no privileged role exists in this contract.',
  },
];

interface FnCoverage {
  fn: string;
  access: string;
  reentrancy: string;
  cei: string;
  arithmetic: string;
  tested: boolean;
}

const COVERAGE: Record<string, FnCoverage[]> = {
  'ALGEBA.sol': [
    { fn: 'setStaking(address)', access: 'onlyOwner, one-time', reentrancy: 'N/A — no external call', cei: 'N/A', arithmetic: 'N/A', tested: true },
    { fn: 'mintStakingReward(address,uint256)', access: 'staking contract only', reentrancy: 'N/A — no external call', cei: 'N/A', arithmetic: 'Double-capped (allocation + max supply)', tested: true },
  ],
  'Genesis.sol': [
    { fn: 'participate(bytes32[] proof)', access: 'Merkle-whitelist gated, immutable root (AGB-01, fixed)', reentrancy: 'nonReentrant', cei: 'Correct', arithmetic: 'N/A', tested: true },
    { fn: 'finalize()', access: 'Permissionless, time-gated', reentrancy: 'N/A — no external call', cei: 'N/A', arithmetic: 'N/A', tested: true },
    { fn: 'claim()', access: 'Self only, one-time', reentrancy: 'nonReentrant', cei: 'Correct (claimed=true before transfer)', arithmetic: 'Integer division dust (AGB-04)', tested: true },
  ],
  'Staking.sol': [
    { fn: 'stake(uint256)', access: 'Permissionless, gated on Genesis finalized; position must end at 1 AGB or more', reentrancy: 'nonReentrant', cei: 'Correct (no ERC20 hooks on ALGEBA)', arithmetic: 'Index overflow bounded by MIN_STAKE (AGB-05, fixed)', tested: true },
    { fn: 'claim()', access: 'Self only', reentrancy: 'nonReentrant', cei: 'Correct', arithmetic: 'Payout capped at mintable (AGB-06, fixed)', tested: true },
    { fn: 'compound()', access: 'Self only', reentrancy: 'nonReentrant', cei: 'Correct', arithmetic: 'Payout capped at mintable (AGB-06, fixed)', tested: true },
    { fn: 'unstake(uint256)', access: 'Self only; cannot leave a dust position', reentrancy: 'nonReentrant', cei: 'Correct', arithmetic: 'Payout capped at mintable, so principal can always be returned (AGB-06, fixed)', tested: true },
    { fn: 'emergencyWithdraw()', access: 'Self only', reentrancy: 'nonReentrant', cei: 'Correct (state zeroed before transfer)', arithmetic: 'None — principal only, never touches emission or minting', tested: true },
  ],
};

export function Security() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Security &amp; Audits</h1>
        <p className="page-subtitle">Internal audit methodology, score, findings, and status for the ALGEBA contracts</p>
      </div>

      <div className="space-y-6 py-2.5 px-2">
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-bold mb-0">Executive summary</h2>
          </div>
          <div className="card-body space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex items-end gap-2 shrink-0">
                <span className="font-bold text-navy leading-none" style={{ fontSize: '3rem' }}>
                  {COMPOSITE_SCORE}
                </span>
                <span className="text-lg text-muted mb-1">/ 100</span>
              </div>
              <p className="text-sm text-navy">
                <strong>Strong — production-capable, after a second-pass audit.</strong> This score is a
                weighted composite across 8 categories (breakdown below), not a vanity number. A deeper second
                pass, built around attack tests and a full-lifetime emission simulation, found two real bugs in
                Staking.sol that the first pass missed. One was a cheap dust-stake attack that could permanently
                cap staking (AGB-05, High). The other could lock the last staker&rsquo;s principal at the end of
                emission (AGB-06, Medium). Both were proven exploitable, fixed, and are now covered by permanent
                regression tests. The halving schedule now runs on timestamps, so each halving lands exactly 4 years
                apart regardless of Ethereum block time (AGB-09). Genesis enforces an immutable Merkle whitelist
                (AGB-01), and ALGEBA ownership is renounced (verified on-chain on Sepolia). Every item, including
                the corrections to the first pass, is documented below with its reasoning.
              </p>
              <p className="text-xs text-muted">
                Scope note: AGBOFT.sol and AGBOFTAdapter.sol (the LayerZero bridge contracts) are intentionally
                excluded from this report — they&rsquo;re being audited separately.
              </p>
            </div>

            <div>
              {SCORE_CATEGORIES.map((c) => (
                <ScoreMeter key={c.label} category={c} />
              ))}
            </div>
          </div>
        </div>

        <div className="alert alert-primary mb-0">
          <strong>Scope of this review:</strong> this is an internal, tool-assisted audit (static analysis +
          manual review against the SWC Registry and SCSVS checklist), not a substitute for an independent
          third-party audit. No audit — internal or paid — can guarantee a contract will never be
          exploited; the goal here is to eliminate every known vulnerability class this process can catch, then
          layer defense-in-depth (multisig-controlled admin actions, no upgradeability, hard-capped supply) on
          top. Before any deployment that will hold real user funds, we recommend a paid audit from an
          established firm and an ongoing bug bounty.
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-bold mb-0">Methodology &amp; scope</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-4 rounded-md border border-platinum bg-platinum">
                <p className="text-xs text-muted uppercase font-medium tracking-wide">Standards</p>
                <p className="text-sm font-semibold mt-2">SWC Registry &middot; SCSVS L2</p>
                <p className="text-xs text-muted mt-1">OWASP-ASVS-style checklist for smart contracts</p>
              </div>
              <div className="p-4 rounded-md border border-platinum bg-platinum">
                <p className="text-xs text-muted uppercase font-medium tracking-wide">Tooling</p>
                <p className="text-sm font-semibold mt-2">Slither static analysis</p>
                <p className="text-xs text-muted mt-1">102 contracts (incl. dependencies), 100 detectors</p>
              </div>
              <div className="p-4 rounded-md border border-platinum bg-platinum">
                <p className="text-xs text-muted uppercase font-medium tracking-wide">Scope</p>
                <p className="text-sm font-semibold mt-2">3 contracts, 474 lines</p>
                <p className="text-xs text-muted mt-1">Token, Genesis, Staking (bridge contracts audited separately)</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left font-bold">Contract</th>
                    <th className="px-4 py-2 text-left font-bold">Role</th>
                    <th className="px-4 py-2 text-right font-bold">Lines</th>
                  </tr>
                </thead>
                <tbody>
                  {SCOPE.map((c) => (
                    <tr key={c.name}>
                      <td className="px-4 py-2 font-mono text-xs">{c.name}</td>
                      <td className="px-4 py-2 text-muted">{c.role}</td>
                      <td className="px-4 py-2 text-right">{c.lines}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-bold mb-0">Privileged roles &amp; centralization</h2>
          </div>
          <div className="card-body">
            <p className="text-sm text-muted mb-4">
              Who can do what, and what happens if that key is compromised — the first thing a sophisticated
              reader checks.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left font-bold">Role</th>
                    <th className="px-4 py-2 text-left font-bold">Held by</th>
                    <th className="px-4 py-2 text-left font-bold">Powers</th>
                    <th className="px-4 py-2 text-left font-bold">Blast radius if compromised</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map((r) => (
                    <tr key={r.role}>
                      <td className="px-4 py-2 font-semibold text-navy">{r.role}</td>
                      <td className="px-4 py-2 text-muted">{r.holder}</td>
                      <td className="px-4 py-2 text-muted">{r.powers}</td>
                      <td className="px-4 py-2 text-muted">{r.blastRadius}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-bold mb-0">Test suite</h2>
          </div>
          <div className="card-body space-y-4">
            <p className="text-sm text-navy mb-0">
              A Foundry test suite was added as part of this review to close what was previously the largest
              gap in this report (0% automated coverage). All 72 tests pass. They include tests that check the
              Merkle whitelist (AGB-01) against the same OpenZeppelin JS library used at deploy time, via
              Foundry FFI, and permanent regression tests for both second-pass findings (AGB-05, AGB-06).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left font-bold">Contract</th>
                    <th className="px-4 py-2 text-left font-bold">Tests</th>
                    <th className="px-4 py-2 text-right font-bold">Line coverage</th>
                    <th className="px-4 py-2 text-right font-bold">Branch coverage</th>
                    <th className="px-4 py-2 text-right font-bold">Function coverage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">ALGEBA.sol</td>
                    <td className="px-4 py-2 text-muted">12 (incl. 1 fuzz)</td>
                    <td className="px-4 py-2 text-right">94.4%</td>
                    <td className="px-4 py-2 text-right">85.7%</td>
                    <td className="px-4 py-2 text-right">100%</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">Genesis.sol</td>
                    <td className="px-4 py-2 text-muted">21 (incl. 2 fuzz)</td>
                    <td className="px-4 py-2 text-right">100%</td>
                    <td className="px-4 py-2 text-right">93.8%</td>
                    <td className="px-4 py-2 text-right">100%</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">Staking.sol</td>
                    <td className="px-4 py-2 text-muted">37 (incl. 2 fuzz, 4 timestamp-schedule) + stateful invariant suite + 40-scenario full-lifetime simulation</td>
                    <td className="px-4 py-2 text-right">100%</td>
                    <td className="px-4 py-2 text-right">100%</td>
                    <td className="px-4 py-2 text-right">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted mb-0">
              The Staking invariant suite ran 256 randomized sequences (128,000 total calls of stake / unstake /
              claim / compound / emergency withdraw / block-warp, in random order and amounts). After every
              single call it checked six properties: total staked equals the sum of recorded stakes; the
              contract holds enough AGB to cover every principal; cumulative emission never exceeds the cap;
              ALGEBA&rsquo;s supply never exceeds its cap; no position sits between 0 and the 1 AGB minimum;
              and no full unstake or emergency withdraw ever fails. There were zero violations across all
              128,000 calls.
            </p>
            <p className="text-sm text-muted mb-0">
              A correction to the first pass: the earlier invariant suite silently ignored reverted actions, so
              a staker being unable to exit would not have been caught. That blind spot is how AGB-05 and
              AGB-06 got through. Any blocked exit now fails the suite. A separate full-lifetime simulation runs
              40 scenarios past emission exhaustion and requires every staker to exit successfully. It also
              asserts that the scenarios actually reached the over-cap condition, so a pass means the fix worked
              rather than the problem never occurring.
            </p>
            <p className="text-sm text-muted mb-0">
              The remaining uncovered branches are in ALGEBA and Genesis and are unreachable through the public
              interface given the current constants. They are kept as defense-in-depth. ALGEBA&rsquo;s second
              max-supply check in mintStakingReward can never trip first, because STAKING_ALLOCATION +
              GENESIS_ALLOCATION equals MAX_SUPPLY exactly. Genesis&rsquo;s zero-allocation check in claim()
              can&rsquo;t fire, because a registered wallet implies participantCount &gt;= 1. A second correction:
              an earlier version of this report said two branches in Staking were unreachable too. The
              full-lifetime simulation reaches both, and Staking is now at 100% branch coverage.
            </p>
            <p className="text-sm text-muted mb-0">
              Separately, all three priority contracts were manually deployed and exercised end-to-end on Sepolia
              testnet, confirming correct deployment wiring and happy-path behavior in a live environment —
              real evidence, but distinct from and not a substitute for the automated suite above.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-bold mb-0">Function-by-function coverage</h2>
          </div>
          <div className="card-body space-y-6">
            <p className="text-sm text-muted mb-0">
              Every state-changing external/public function across the priority contracts, and what was checked
              against it. Read-only (view) functions are omitted from this table but are directly covered too
              (see Test suite above).
            </p>
            {Object.entries(COVERAGE).map(([contract, fns]) => (
              <div key={contract}>
                <h3 className="text-sm font-bold mb-2 font-mono">{contract}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left font-bold">Function</th>
                        <th className="px-4 py-2 text-left font-bold">Access control</th>
                        <th className="px-4 py-2 text-left font-bold">Reentrancy</th>
                        <th className="px-4 py-2 text-left font-bold">CEI order</th>
                        <th className="px-4 py-2 text-left font-bold">Arithmetic</th>
                        <th className="px-4 py-2 text-center font-bold">Tested</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fns.map((f) => (
                        <tr key={f.fn}>
                          <td className="px-4 py-2 font-mono text-xs">{f.fn}</td>
                          <td className="px-4 py-2 text-muted">{f.access}</td>
                          <td className="px-4 py-2 text-muted">{f.reentrancy}</td>
                          <td className="px-4 py-2 text-muted">{f.cei}</td>
                          <td className="px-4 py-2 text-muted">{f.arithmetic}</td>
                          <td className="px-4 py-2 text-center">
                            {f.tested ? (
                              <span className="text-green-700 font-bold">✓</span>
                            ) : (
                              <span className="text-red-600 font-bold">✗</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-bold mb-0">Findings</h2>
          </div>
          <div className="card-body space-y-6">
            {FINDINGS.map((f) => (
              <div key={f.id} className="border border-platinum-dark rounded-md p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-muted">{f.id}</span>
                    <h3 className="text-sm font-bold mb-0">{f.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge level={f.severity} />
                    <StatusBadge status={f.status} />
                  </div>
                </div>
                <p className="text-xs text-muted mb-2 font-mono">{f.contract}</p>
                <p className="text-sm text-navy mb-2">{f.summary}</p>
                <p className="text-sm text-muted mb-2">{f.detail}</p>
                <p className="text-sm text-navy"><strong>Resolution:</strong> {f.resolution}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-bold mb-0">Before mainnet</h2>
          </div>
          <div className="card-body">
            <ul className="text-sm space-y-2 list-disc list-inside text-navy">
              <li>Genesis whitelist finalized (up to 21 addresses) and its Merkle root generated via the Deploy page's whitelist builder before deploying Genesis on mainnet — the root is immutable and cannot be changed afterward</li>
              <li>Fresh deployment of all three contracts using the fixed, timestamp-based Staking.sol (AGB-05, AGB-06, AGB-09), with the halving period left at 4 years on the Deploy page. The current Sepolia deployment runs the pre-fix, block-based Staking and should be treated as retired.</li>
              <li>Confirm the Genesis duration on the Deploy page. It defaults to 1440 minutes (24 hours); make sure that is long enough for every whitelisted wallet to participate (AGB-10).</li>
              <li>Make sure the deployer&rsquo;s whitelisted wallet participates in Genesis, and keep the whitelist at 50 addresses or fewer so each wallet receives at least 1 AGB, the minimum stake (AGB-08).</li>
              <li>Coordinate whitelisted wallets to claim and stake together at launch, so no single early staker collects all early emission (AGB-07).</li>
              <li>Independent third-party audit from an established firm, in addition to this internal review. This second pass found two bugs the first missed; an outside reviewer is the next line of defense.</li>
              <li>Bug bounty program (e.g. Immunefi) live before or at mainnet launch</li>
              <li>ALGEBA ownership renounced immediately after setStaking() is called on mainnet (already done and verified on Sepolia testnet as a dry run)</li>
              <li>Deployment executed from a written runbook with automated sanity checks, rehearsed on testnet first</li>
              <li>AGBOFT.sol and AGBOFTAdapter.sol (LayerZero bridge contracts) — separate audit in progress, not covered by this report; still requires a multisig-held delegate before mainnet</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
