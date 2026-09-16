import { useEffect, useState } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { createNetworkPublicClient } from '../utils/publicClient';
import { ALGEBA_ABI, STAKING_ABI } from '../config/contracts';
import { formatBigIntNoFloat } from '../utils/formatting';
import './whitepaper.css';

// Figures that are compiled constants in the contracts and therefore cannot
// change — safe to render statically. Anything that moves is read on-chain below.
const TERMS = [
  { t: '0', years: '0 – 4', emission: '105,000,000', perDay: '71,868.6', cum: '105,000,000' },
  { t: '1', years: '4 – 8', emission: '52,500,000', perDay: '35,934.3', cum: '157,500,000' },
  { t: '2', years: '8 – 12', emission: '26,250,000', perDay: '17,967.1', cum: '183,750,000' },
  { t: '3', years: '12 – 16', emission: '13,125,000', perDay: '8,983.6', cum: '196,875,000' },
  { t: '4', years: '16 – 20', emission: '6,562,500', perDay: '4,491.8', cum: '203,437,500' },
  { t: '5', years: '20 – 24', emission: '3,281,250', perDay: '2,245.9', cum: '206,718,750' },
  { t: '6', years: '24 – 28', emission: '1,640,625', perDay: '1,122.9', cum: '208,359,375' },
  { t: '7', years: '28 – 32', emission: '820,312.5', perDay: '561.5', cum: '209,179,687.5' },
  { t: '8', years: '32 – 36', emission: '410,156.25', perDay: '280.7', cum: '209,589,843.8' },
];

// Each Term is half the one before, so each bar is half the width of its
// predecessor. Widths are the real proportions of the Bound, not decoration.
const BARS = [
  { w: 50, shade: 1.0, label: 'T₀', value: '105,000,000', sub: 'year 0–4' },
  { w: 25, shade: 0.88, label: 'T₁', value: '52,500,000', sub: 'year 4–8' },
  { w: 12.5, shade: 0.76, label: 'T₂', value: '26,250,000' },
  { w: 6.25, shade: 0.64, label: 'T₃' },
  { w: 3.125, shade: 0.54 },
  { w: 1.5625, shade: 0.46 },
  { w: 0.78125, shade: 0.38 },
  { w: 0.390625, shade: 0.32 },
  { w: 0.390625, shade: 0.24 },
];

// Navy, lightened toward the page ground as the Terms shrink.
function shadeOf(k: number) {
  const [r, g, b] = [26, 31, 61];
  const mix = (c: number) => Math.round(c * k + 255 * (1 - k));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

interface LiveState {
  totalSupply?: bigint;
  totalStaked?: bigint;
  nextHalving?: bigint;
  currentEpoch?: bigint;
  failed?: boolean;
}

export function Whitepaper() {
  const { network } = useNetwork();
  const [live, setLive] = useState<LiveState>({});

  const { ALGEBA, STAKING } = network.contracts;
  const explorer = network.explorerUrl;

  useEffect(() => {
    if (!ALGEBA || !STAKING) {
      setLive({ failed: true });
      return;
    }

    let cancelled = false;
    const client = createNetworkPublicClient(network);

    (async () => {
      try {
        const [totalSupply, totalStaked, nextHalving, currentEpoch] = await Promise.all([
          client.readContract({ address: ALGEBA as `0x${string}`, abi: ALGEBA_ABI, functionName: 'totalSupply' }),
          client.readContract({ address: STAKING as `0x${string}`, abi: STAKING_ABI, functionName: 'totalStaked' }),
          client.readContract({ address: STAKING as `0x${string}`, abi: STAKING_ABI, functionName: 'nextHalvingTime' }),
          client.readContract({ address: STAKING as `0x${string}`, abi: STAKING_ABI, functionName: 'currentEpoch' }),
        ]);
        if (cancelled) return;
        setLive({
          totalSupply: totalSupply as bigint,
          totalStaked: totalStaked as bigint,
          nextHalving: nextHalving as bigint,
          currentEpoch: currentEpoch as bigint,
        });
      } catch {
        // A dead RPC must not blank the document — the prose stands on its own
        // and these cells fall back to "unavailable" rather than a wrong number.
        if (!cancelled) setLive({ failed: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ALGEBA, STAKING, network]);

  // nextHalvingTime() returns 0 until the first stake starts the clock.
  const halvingLabel = (() => {
    if (live.failed) return 'Unavailable';
    if (live.nextHalving === undefined) return '—';
    if (live.nextHalving === 0n) return 'Not started';
    return new Date(Number(live.nextHalving) * 1000).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  })();

  const supplyLabel = live.failed ? 'Unavailable' : live.totalSupply === undefined ? '—' : formatBigIntNoFloat(live.totalSupply);
  const stakedLabel = live.failed ? 'Unavailable' : live.totalStaked === undefined ? '—' : formatBigIntNoFloat(live.totalStaked);
  const termLabel = live.failed || live.currentEpoch === undefined ? 'T₀' : `T${live.currentEpoch.toString()}`;

  const addr = (a: string) => `${explorer}/address/${a}#readContract`;

  return (
    <div className="wp-doc">
      {/* ---------------- masthead ---------------- */}
      <header className="wp-masthead">
        <div className="wp-sigil">
          <span className="wp-live">Live on Ethereum mainnet · the Series is running</span>
          <span>An experiment in a medium of trade</span>
          <span>Authors unnamed</span>
        </div>

        <h1 className="wp-title">
          The <em>Algeba</em> Series
        </h1>

        <p className="wp-identity" role="img" aria-label="One AGB equals one AGB">
          <span>1 AGB</span>
          <em>=</em>
          <span>1 AGB</span>
        </p>
        <p className="wp-identity-note">The only exchange rate the protocol asserts.</p>

        <p className="wp-standfirst">
          A bounded instrument of exchange, emitted continuously, governed by a converging geometric
          series and by nobody at all. It is quoted in nothing but itself.
        </p>

        <dl className="wp-colophon">
          <div><dt>Network</dt><dd>Ethereum mainnet</dd></div>
          <div><dt>The Bound</dt><dd>210,000,000 AGB</dd></div>
          <div><dt>Bisection</dt><dd>Every 4 years</dd></div>
          <div><dt>Threshold</dt><dd>1 AGB</dd></div>
          <div><dt>Admin keys</dt><dd>None</dd></div>
        </dl>
      </header>

      {/* ---------------- prologue ---------------- */}
      <section className="wp-prologue">
        <p className="wp-prologue-label">Before any of the numbers, a story</p>
        <div className="wp-tale">
          <p>Somewhere past the orbit of anywhere useful, two machines needed to settle up.</p>
          <p>
            One had spare power. The other had spare compute. They had been trading favours for
            eleven months on the shared assumption that it would even out, and it had not evened out,
            and now one of them was ahead by an amount neither could name.
          </p>
          <p>
            There was no bank out there. No jurisdiction, no business day, no arbitrator reachable in
            under forty minutes. The planet they had both been built on was a long way off and had,
            in any case, stopped answering questions that didn't arrive with a ticket number.
          </p>
          <p>
            So they did what anyone does when there is nothing left to appeal to. They went looking
            for a number they could both check.
          </p>
          <p>
            Not a promise — promises need somebody around to keep them. Not a receipt — receipts need
            an issuer still in business. They wanted something whose <em>total quantity</em> each
            could verify alone, from arithmetic, without either of them having to be honest.
          </p>
          <p>
            They found one. Neither knew what it was worth. Neither asked, because <em>worth</em> is
            a question you ask somebody else, and out there, there was nobody else.
          </p>
          <p className="wp-beat">
            One of them transferred fourteen. The other agreed that fourteen had been transferred.
            That was the entire event.
          </p>
          <p className="wp-close">
            Much later, back on the planet, somebody found the transaction and asked what the
            fourteen were worth in dollars.
          </p>
          <p>The machines did not have an opinion. They had a balance.</p>
        </div>
      </section>

      {/* ---------------- § 0 questions ---------------- */}
      <section className="wp-section">
        <div className="wp-rail">
          <b>§ 0</b>
          <span>Questions</span>
          <p className="wp-gloss">
            Everything important about Algeba, answered badly and quickly, before it is answered
            properly and slowly.
          </p>
          <p className="wp-gloss">The Series is running as you read this.</p>
        </div>

        <div className="wp-qa">
          <dl>
            <div className="wp-pair">
              <dt>So what were the fourteen worth?</dt>
              <dd className="wp-terse">Fourteen.</dd>
            </div>

            <div className="wp-pair">
              <dt>No — in dollars.</dt>
              <dd>That's a question about dollars. We'd have to ask a dollar, and it isn't returning our calls.</dd>
              <dd>
                Algeba is denominated in Algeba. There is no issuer standing behind it quoting a
                rate, because there is no issuer standing behind it at all. See <strong>§ 9</strong>,
                where we take this considerably more seriously than we are taking it here.
              </dd>
            </div>

            <div className="wp-pair">
              <dt>Fine. Who sets the price, then?</dt>
              <dd>
                Nobody with any standing to. No treasury, no market maker on payroll, no foundation
                with a spreadsheet. Markets can price anything — markets have priced worse. The
                protocol simply doesn't participate in that conversation.
              </dd>
            </div>

            <div className="wp-pair">
              <dt>Can I buy some from you?</dt>
              <dd>
                There is no "you" to buy from. No sale, no round, no allocation held back, no
                inventory. Nobody here is holding a bag with your name on it.
              </dd>
              <dd>
                Every AGB in existence either came from the 50-token Genesis or was emitted, second
                by second, to somebody who was staked at the time. That's the complete list of ways
                it can exist.
              </dd>
            </div>

            <div className="wp-pair">
              <dt>Where does it come from, then?</dt>
              <dd>
                Emission. Roughly <strong>0.83 AGB every second</strong>, around the clock, split
                proportionally among everyone staked at that moment. No weekends, no market hours, no
                maintenance window. The rate halves every four years and the total can never exceed
                210,000,000.
              </dd>
            </div>

            <div className="wp-pair">
              <dt>Is it running right now?</dt>
              <dd className="wp-terse">Yes. Since the first stake.</dd>
              <dd>
                Genesis closed, somebody staked, and the clock started. It has not paused since and
                there is no mechanism by which it can be — no pause function, no owner to call one,
                and nothing in the contract that treats any second differently from any other.
              </dd>
              <dd>
                As you read this sentence, roughly <strong>0.83 AGB</strong> has been emitted. And
                again. It is doing that continuously, to whoever is staked, and it will keep doing it
                — halving every four years — for the next nine decades.
              </dd>
            </div>

            <div className="wp-pair">
              <dt>What happens if nobody is staked?</dt>
              <dd>
                Then that second emits nothing, and that second is <em>gone</em>. Not banked, not
                rolled forward, not handed to whoever shows up next.
              </dd>
              <dd>
                The two machines in the story could only trade because somewhere, someone had been
                holding the network open long enough for there to be something to trade. If nobody
                had bothered, there'd have been nothing out there to settle with.
              </dd>
            </div>

            <div className="wp-pair">
              <dt>Who's in charge?</dt>
              <dd>
                Nobody. Not a DAO, not a multisig, not "the team." The Genesis and staking contracts
                were deployed without owners at all, and the token's single one-time setup key was
                renounced after wiring. There is no pause button. There is nothing to petition.
              </dd>
            </div>

            <div className="wp-pair">
              <dt>Who made it?</dt>
              <dd className="wp-terse">Doesn't matter — and that's load-bearing.</dd>
              <dd>
                See <strong>§ 8</strong>. Briefly: a named founder is a control surface, and this is
                a system designed to have none.
              </dd>
            </div>

            <div className="wp-pair">
              <dt>wen halving?</dt>
              <dd>
                Four years from the first stake — and that clock is already running. Then four years
                after that, and after that, for 256 Terms. Set a reminder for the year 3050; the
                contract will still be grinding through the same loop.
              </dd>
            </div>

            <div className="wp-pair">
              <dt>Is it going to moon?</dt>
              <dd>
                It has no price, so technically it is simultaneously at its all-time high and its
                all-time low. We find this restful. You may not.
              </dd>
            </div>

            <div className="wp-pair">
              <dt>Okay, but seriously — is this serious?</dt>
              <dd>
                It is a serious <em>experiment</em>. That is a genuinely different thing from a
                serious investment, and the difference is the whole point.
              </dd>
              <dd>
                The contracts are real, immutable, and live on mainnet. The arithmetic is exact and
                checkable. What nobody can tell you — not us, not anyone — is whether a quantity with
                no issuer and no backing ever becomes something people reach for. That's the part
                being tested. Treat the number in your wallet the way the machines did: as a
                quantity, not a net worth.
              </dd>
            </div>
          </dl>

          <div className="wp-state">
            <div className="wp-state-head">
              <span><b>State of the experiment</b></span>
              <span>Genesis closed · the Series is running</span>
            </div>
            <dl className="wp-grid">
              <div className="wp-cell"><dt>Genesis</dt><dd>Closed<small>Finalized and divided</small></dd></div>
              <div className="wp-cell"><dt>Emission</dt><dd>Running<small>Since the first stake</small></dd></div>
              <div className="wp-cell"><dt>Current Term</dt><dd>{termLabel}<small>Of 256</small></dd></div>
              <div className="wp-cell"><dt>Rate</dt><dd>0.8318 /s<small>≈ 71,868 AGB per day</small></dd></div>
              <div className="wp-cell">
                <dt><span className="wp-tag">live</span>Total supply</dt>
                <dd className={live.totalSupply === undefined ? 'wp-pending' : undefined}>
                  {supplyLabel}<small>AGB minted so far</small>
                </dd>
              </div>
              <div className="wp-cell">
                <dt><span className="wp-tag">live</span>Total staked</dt>
                <dd className={live.totalStaked === undefined ? 'wp-pending' : undefined}>
                  {stakedLabel}<small>Holding the Series open</small>
                </dd>
              </div>
              <div className="wp-cell">
                <dt><span className="wp-tag">live</span>Bisection</dt>
                <dd className={live.nextHalving === undefined ? 'wp-pending' : undefined}>
                  {halvingLabel}<small>When the rate halves</small>
                </dd>
              </div>
              <div className="wp-cell"><dt>Owner</dt><dd>0x00…00<small>Renounced. No keys remain</small></dd></div>
            </dl>
            <p className="wp-state-note">
              Cells marked <span className="wp-tag">live</span> are read from mainnet when this page
              loads; the rest are compiled constants and cannot change. A document is a static thing
              describing a moving chain, so treat every figure here as a claim to be checked rather
              than a fact to be trusted — the addresses in <strong>§ 8</strong> will answer for
              themselves, and they outrank this page.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- § 1 proposition ---------------- */}
      <section className="wp-section">
        <div className="wp-rail">
          <b>§ 1</b>
          <span>The proposition</span>
          <p className="wp-gloss">Who this is for, and why the usual word for it is avoided.</p>
        </div>
        <div className="wp-body">
          <h2>A medium for counterparties who cannot shake hands</h2>
          <p>
            There's an old assumption buried in every settlement system: that at the end of the chain
            stands a person, in a jurisdiction, during business hours. Every layer above inherits it
            — the cut-off times, the reversals, the minimums, the correspondent bank three time zones
            away.
          </p>
          <p>
            The counterparties arriving now do not fit the assumption. A build agent paying another
            agent for inference. An autonomous system settling its own energy draw. A machine buying
            four seconds of bandwidth. A relay somewhere out past the light-delay, where no authority
            can be consulted in time and no reversal arrives before the transaction is already
            history.
          </p>
          <p className="wp-axiom">
            What these counterparties need is not credit. It is a quantity that means the same thing
            at both ends of the exchange, with nobody in the middle entitled to revise it.
          </p>
          <p>
            Algeba is an attempt at that quantity. We don't call it money. Money implies an issuer, a
            policy, a hand on the dial. AGB has none of these — it is a{' '}
            <strong>medium of trade</strong>: a bounded, verifiable, unit-identical thing two parties
            can move between them without either trusting the other, and without either petitioning a
            third.
          </p>
          <h3>Intended counterparties</h3>
          <ul>
            <li>
              <strong>Builders</strong> — developers wanting a settlement unit with no terms of
              service, no API key, and no counterparty to be de-platformed by.
            </li>
            <li>
              <strong>Agents</strong> — software transacting on its own behalf, at machine cadence,
              with no human in the loop to approve each move.
            </li>
            <li>
              <strong>Autonomous systems</strong> — devices, fleets and networks that must pay and be
              paid continuously while disconnected from any authority.
            </li>
            <li>
              <strong>Distant settlement</strong> — exchanges where round-trip latency makes
              permission structurally impossible, and only a unit that verifies locally can clear.
            </li>
          </ul>
        </div>
      </section>

      {/* ---------------- § 2 the bound ---------------- */}
      <section className="wp-section">
        <div className="wp-rail">
          <b>§ 2</b>
          <span>The Bound</span>
          <p className="wp-gloss">210,000,000 — the only number the system cannot be argued out of.</p>
        </div>
        <div className="wp-body">
          <h2>Everything begins from a ceiling that cannot move</h2>
          <p>
            There will be <strong>210,000,000 AGB</strong>. Not approximately, not subject to review
            — the figure is a compiled constant, and both paths that create a token check against it
            before minting. There is no public mint function, no owner who can raise it, and no
            upgrade proxy standing behind the contract waiting to swap out the logic.
          </p>
          <dl className="wp-grid">
            <div className="wp-cell"><dt>Max supply</dt><dd>210,000,000<small>Hard cap, compiled</small></dd></div>
            <div className="wp-cell"><dt>Emitted by series</dt><dd>209,999,950<small>Via staking, over ~90 years</small></dd></div>
            <div className="wp-cell"><dt>Genesis constant</dt><dd>50<small>Minted once, at birth</small></dd></div>
            <div className="wp-cell"><dt>Discretionary</dt><dd>0<small>No treasury, no reserve</small></dd></div>
          </dl>
          <p>
            Note what's absent from that table. No founder allocation. No team vesting, no advisor
            tranche, no marketing wallet, no ecosystem fund, no strategic reserve. Two rows are the
            whole supply: a series that pays out to whoever holds the network open, and fifty tokens
            minted at the beginning for the people who wrote it.
          </p>
        </div>
      </section>

      {/* ---------------- § 3 the constant ---------------- */}
      <section className="wp-section">
        <div className="wp-rail">
          <b>§ 3</b>
          <span>The Constant</span>
          <p className="wp-gloss">Fifty tokens, split evenly, priced at nothing.</p>
        </div>
        <div className="wp-body">
          <h2>Genesis: fifty, denominated one to one</h2>
          <p>
            At deployment the token contract minted exactly <strong>50 AGB</strong> — the Constant —
            and sent it to a Genesis contract with no owner, no administrator and no withdrawal path.
            That contract holds a Merkle root fixed at construction: a sealed list of addresses
            decided before the chain ever saw it, which nothing and nobody can add to or remove from
            afterward.
          </p>
          <p>
            Every wallet on that list could register once, paying only gas. When the window closed
            and <code>finalize()</code> was called, the Constant divided equally among those who
            showed up — one wallet, one share, no weighting and no tiers. That window is now shut,
            permanently, and nothing can reopen it.
          </p>
          <p>
            No price was struck. Nothing was paid in, nothing was raised, and no valuation was placed
            on what the contributors received. Their participation is denominated{' '}
            <strong>one to one in Algeba</strong>: an allocation measured against itself and against
            nothing else.
          </p>
          <p className="wp-axiom">
            Whatever a contributor holds, they hold in Algeba. It was never converted from anything,
            and it is not owed back as anything.
          </p>
          <p>
            The share is 50 divided by however many showed up. At a full house of fifty it lands at
            exactly one token each — which is also, exactly, the Threshold: the smallest position
            capable of opening the Series. Fewer participants means a larger share each, and the
            useful property holds either way: because no more than fifty could register,{' '}
            <strong>every Genesis wallet received at least enough to stake</strong>.
          </p>
          <p>
            That is the entire endowment. Not a reward and not a stake, but the minimum sufficient
            key to start the clock for everybody else.
          </p>
          <h3>Who was on the list</h3>
          <p>
            The contributors who wrote these contracts, and the builders committing to run projects
            that use AGB as a liquidity pair — the people who have to live inside the experiment for
            it to mean anything. No premine, no discount, no preferential rate. A single token and
            the same schedule as everyone who comes after.
          </p>
          <p>
            What they hold that others don't isn't supply. It's exposure. The native value of AGB is
            the trust its holders extend to it, and the first contributors are simply the first to
            extend any.
          </p>
        </div>
      </section>

      {/* ---------------- § 4 the series ---------------- */}
      <section className="wp-section">
        <div className="wp-rail">
          <b>§ 4</b>
          <span>The Series</span>
          <p className="wp-gloss">
            A geometric series of ratio ½, bisected every four years, converging on the Bound.
          </p>
        </div>
        <div className="wp-body">
          <h2>The Series, and the Bisection that shapes it</h2>
          <p>
            The remaining 209,999,950 AGB are not distributed. They are <em>emitted</em> — released
            continuously to whoever is staking, at a rate fixed by a geometric series.
          </p>
          <p>
            Time is divided into <strong>Terms</strong> of four years. The first, T₀, emits
            105,000,000 AGB — half the Bound. Every Term after emits exactly half of the one before.
            We call that event the <strong>Bisection</strong>. It is not a decision, not a vote, and
            not an announcement; it is a right-shift on a compiled constant that happens whether or
            not anyone is watching.
          </p>
          <dl className="wp-grid">
            <div className="wp-cell"><dt>Term length</dt><dd>126,230,400 s<small>4 years, by timestamp</small></dd></div>
            <div className="wp-cell"><dt>T₀ rate</dt><dd>0.8318 /s<small>≈ 71,868 AGB per day</small></dd></div>
            <div className="wp-cell"><dt>Terms defined</dt><dd>256<small>1,024 years of schedule</small></dd></div>
            <div className="wp-cell"><dt>Series ratio</dt><dd>1 / 2<small>Applied per Term, forever</small></dd></div>
          </dl>
        </div>

        <figure className="wp-figure">
          <figcaption className="wp-fig-head">
            <span>Figure 1 — <b>The Series, drawn to scale</b></span>
            <span>Each Term is half the one before it</span>
          </figcaption>
          <div
            className="wp-bisection"
            role="img"
            aria-label="A bar representing 210,000,000 AGB divided into halving terms: T-zero is 105 million filling half the bar, T-one 52.5 million a quarter, each subsequent term halving again into hairlines approaching a right edge that is never reached."
          >
            {BARS.map((b, i) => (
              <div
                key={i}
                className="wp-term"
                style={{ width: `${b.w}%`, background: shadeOf(b.shade) }}
              >
                {b.label && (
                  <span>
                    <b>{b.label}</b>
                    {b.value}
                    {b.sub && <><br />{b.sub}</>}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="wp-scale">
            <span>0</span>
            <span className="wp-bound">210,000,000 — the Bound, approached and never reached ▸</span>
          </div>
          <p className="wp-residue">
            <b>The residue.</b> Doubled, the series sums to exactly 210,000,000 — but a geometric
            series only ever <em>approaches</em> its limit. The schedule is therefore capped 50 AGB
            short, at 209,999,950. That gap, too small to draw at this scale, is the Genesis
            Constant. The contributors did not take a share of the supply. They occupy the distance
            between the series and its own limit.
          </p>
        </figure>

        <div className="wp-body">
          <h3>The schedule</h3>
          <div className="wp-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Term</th>
                  <th scope="col">Years</th>
                  <th scope="col">Emission</th>
                  <th scope="col">Per day</th>
                  <th scope="col">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {TERMS.map((r) => (
                  <tr key={r.t}>
                    <td>T<sub>{r.t}</sub></td>
                    <td>{r.years}</td>
                    <td>{r.emission}</td>
                    <td>{r.perDay}</td>
                    <td>{r.cum}</td>
                  </tr>
                ))}
                <tr>
                  <td>⋮</td><td>⋮</td><td>halves</td><td>halves</td><td>⋮</td>
                </tr>
                <tr className="wp-clamp">
                  <td>T<sub>22</sub></td><td>≈ 88 – 92</td><td>final wei</td><td>—</td><td>209,999,950</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Around the twenty-second Term — some ninety years after the first stake — the remaining
            emission falls below fifty tokens and the contract clamps. From there the Series is
            complete, the Bound is met exactly, and AGB becomes a closed quantity. Nothing further
            will ever be created. The schedule reserves 256 Terms, a thousand and twenty-four years
            of defined behaviour, largely so nobody ever has to ask what happens at the end.
          </p>
        </div>
      </section>

      {/* ---------------- § 5 the algebra ---------------- */}
      <section className="wp-section">
        <div className="wp-rail">
          <b>§ 5</b>
          <span>The Algebra</span>
          <p className="wp-gloss">
            The entire protocol, restated as nine expressions. There is nothing else in it.
          </p>
        </div>
        <div className="wp-body">
          <h2>The whole thing, in nine lines</h2>
          <p>
            Everything above can be read off from a handful of expressions. This is not a
            simplification of the contracts — it <em>is</em> the contracts. If a claim in this
            document doesn't reduce to one of these lines, treat the claim as decoration.
          </p>

          <p className="wp-legend">
            <b>B</b> the Bound · <b>E</b><sub>0</sub> first Term emission · <b>P</b> Term length in
            seconds · <b>C</b> the Genesis Constant
            <br />
            <b>t</b><sub>0</sub> first stake · <b>n</b> Term index · <b>S</b>(t) total staked ·{' '}
            <b>a</b><sub>u</sub> your position · <b>I</b> the accretion index
          </p>

          <h3>Supply</h3>

          <div className="wp-eq">
            <span className="wp-eq-body">
              <span className="wp-v">B</span><span className="wp-op">=</span>
              <span className="wp-lit">210,000,000</span>
            </span>
            <span className="wp-eq-tag">(1)</span>
          </div>

          <div className="wp-eq">
            <span className="wp-eq-body">
              <span className="wp-v">E</span><sub>n</sub><span className="wp-op">=</span>
              <span className="wp-v">E</span><sub>0</sub><span className="wp-op">·</span>2<sup>−n</sup>
              <span style={{ paddingLeft: '1.1em' }}>
                <span className="wp-v">E</span><sub>0</sub><span className="wp-op">=</span>
                <span className="wp-v">B</span>&#8202;/&#8202;2
              </span>
            </span>
            <span className="wp-eq-tag">(2)</span>
          </div>

          <p>
            Each Term emits half the one before. Doubling the first Term gives the sum of the entire
            infinite series — which is the Bound itself:
          </p>

          <div className="wp-eq">
            <span className="wp-eq-body">
              <span className="wp-bigop">
                <span className="wp-limit">∞</span>
                <span className="wp-glyph">∑</span>
                <span className="wp-limit">n=0</span>
              </span>
              <span className="wp-v">E</span><sub>n</sub><span className="wp-op">=</span>2
              <span className="wp-v">E</span><sub>0</sub><span className="wp-op">=</span>
              <span className="wp-v">B</span>
            </span>
            <span className="wp-eq-tag">(3)</span>
          </div>

          <p>
            But a convergent series never actually arrives. The schedule is clamped just below its
            own limit, and the shortfall is exactly what Genesis minted — so the two halves close the
            Bound precisely:
          </p>

          <div className="wp-eq">
            <span className="wp-eq-body">
              <span className="wp-v">B</span><span className="wp-op">=</span>
              <span className="wp-lit">209,999,950</span><span className="wp-op">+</span>
              <span className="wp-v">C</span>
              <span style={{ paddingLeft: '1.1em' }}>
                <span className="wp-v">C</span><span className="wp-op">=</span>
                <span className="wp-lit">50</span>
              </span>
            </span>
            <span className="wp-eq-tag">(4)</span>
          </div>

          <h3>Emission</h3>

          <div className="wp-eq">
            <span className="wp-eq-body">
              <span className="wp-v">n</span>(<span className="wp-v">t</span>)
              <span className="wp-op">=</span>⌊
              <span className="wp-frac">
                <span><span className="wp-v">t</span> − <span className="wp-v">t</span><sub>0</sub></span>
                <span><span className="wp-v">P</span></span>
              </span>
              ⌋
              <span style={{ paddingLeft: '1.1em' }}>
                <span className="wp-v">P</span><span className="wp-op">=</span>
                <span className="wp-lit">126,230,400</span> s
              </span>
            </span>
            <span className="wp-eq-tag">(5)</span>
          </div>

          <div className="wp-eq">
            <span className="wp-eq-body">
              <span className="wp-v">R</span>(<span className="wp-v">t</span>)
              <span className="wp-op">=</span>
              <span className="wp-frac">
                <span><span className="wp-v">E</span><sub>0</sub></span>
                <span>2<sup>n(t)</sup><span className="wp-v">P</span></span>
              </span>
              <span className="wp-op">⟹</span>
              <span className="wp-v">R</span>(<span className="wp-v">t</span><sub>0</sub>)
              <span className="wp-op">≈</span><span className="wp-lit">0.8318</span> AGB/s
            </span>
            <span className="wp-eq-tag">(6)</span>
          </div>

          <p>
            Note that <span className="wp-v">t</span> is wall-clock time, not block height. The
            Bisection lands on its calendar anniversary regardless of what Ethereum's block times do
            over the next thousand years.
          </p>

          <h3>Your share</h3>

          <p>
            A staker's reward is their fraction of the pool, integrated over every second they were
            in it. This is the only formula that matters to a participant:
          </p>

          <div className="wp-eq">
            <span className="wp-eq-body">
              <span className="wp-v">r</span><sub>u</sub><span className="wp-op">=</span>
              <span className="wp-bigop">
                <span className="wp-limit">t₂</span>
                <span className="wp-glyph">∫</span>
                <span className="wp-limit">t₁</span>
              </span>
              <span className="wp-frac">
                <span><span className="wp-v">a</span><sub>u</sub></span>
                <span><span className="wp-v">S</span>(<span className="wp-v">t</span>)</span>
              </span>
              <span className="wp-v">R</span>(<span className="wp-v">t</span>)&#8202;
              <span className="wp-v">dt</span>
            </span>
            <span className="wp-eq-tag">(7)</span>
          </div>

          <p>
            Computing that per user, on chain, would cost gas proportional to the number of stakers —
            which is how reward contracts die. Instead the protocol keeps a single global integral,
            the accretion index, and every position is priced against it by subtraction:
          </p>

          <div className="wp-eq">
            <span className="wp-eq-body">
              <span className="wp-v">I</span>(<span className="wp-v">t</span>)
              <span className="wp-op">=</span>
              <span className="wp-bigop">
                <span className="wp-limit">t</span>
                <span className="wp-glyph">∫</span>
                <span className="wp-limit">t₀</span>
              </span>
              <span className="wp-frac">
                <span><span className="wp-v">R</span>(<span className="wp-v">τ</span>)</span>
                <span><span className="wp-v">S</span>(<span className="wp-v">τ</span>)</span>
              </span>
              <span className="wp-v">dτ</span>
              <span className="wp-op">⟹</span>
              <span className="wp-v">r</span><sub>u</sub><span className="wp-op">=</span>
              <span className="wp-v">a</span><sub>u</sub>&#8202;[&#8202;
              <span className="wp-v">I</span>(<span className="wp-v">t</span><sub>2</sub>)
              <span className="wp-op">−</span>
              <span className="wp-v">I</span>(<span className="wp-v">t</span><sub>1</sub>)&#8202;]
            </span>
            <span className="wp-eq-tag">(8)</span>
          </div>

          <p>
            One subtraction and one multiplication, no matter how many people are staked. Ten
            thousand participants cost the same gas as one. The index is held at <code>1e36</code>{' '}
            precision, and the Threshold of § 6 exists precisely to keep it from being driven
            somewhere it cannot come back from.
          </p>

          <h3>The degenerate case</h3>

          <p>
            Everything above assumes somebody is staked. When nobody is, the fraction in (7) is
            undefined — and the protocol resolves that not by saving the emission, but by discarding
            it:
          </p>

          <div className="wp-eq">
            <span className="wp-eq-body">
              <span className="wp-v">S</span>(<span className="wp-v">t</span>)
              <span className="wp-op">=</span>0<span className="wp-op">⟹</span>
              <span className="wp-v">dI</span><span className="wp-op">=</span>0
              <span style={{ paddingLeft: '0.8em' }}>
                emission for that interval is never minted
              </span>
            </span>
            <span className="wp-eq-tag">(9)</span>
          </div>

          <p>
            Which has a consequence worth stating plainly: the Bound is a ceiling, not a target. If
            the network ever stands empty, the final supply lands permanently below 210,000,000, and
            there is no mechanism anywhere to make up the difference.
          </p>

          <p className="wp-axiom">
            And one line that is not derived from any of the others, because it cannot be — it is the
            axiom the rest is built on.
          </p>

          <div className="wp-eq" style={{ borderLeftColor: '#9C3A2C' }}>
            <span className="wp-eq-body">
              <span className="wp-lit" style={{ fontSize: '1em' }}>1 AGB</span>
              <span className="wp-op" style={{ color: '#9C3A2C' }}>=</span>
              <span className="wp-lit" style={{ fontSize: '1em' }}>1 AGB</span>
            </span>
            <span className="wp-eq-tag">(0)</span>
          </div>
        </div>
      </section>

      {/* ---------------- § 6 threshold ---------------- */}
      <section className="wp-section">
        <div className="wp-rail">
          <b>§ 6</b>
          <span>The Threshold</span>
          <p className="wp-gloss">One AGB opens a position. Nothing smaller does.</p>
        </div>
        <div className="wp-body">
          <h2>One token is the price of admission to the Series</h2>
          <p>
            Emission isn't granted, it's <em>held open</em>. To receive any part of the Series you
            stake, and the minimum position is exactly <strong>1 AGB</strong> — the Threshold. Below
            it, the contract refuses.
          </p>
          <p>
            The rule looks like a courtesy and is in fact load-bearing. A lone staker holding one wei
            could otherwise drive the accretion index of equation (8) high enough to overflow every
            ordinary-sized position behind them and freeze the contract permanently. The Threshold is
            what lets the arithmetic survive a century of unattended operation.
          </p>
          <h3>The four moves</h3>
          <ul>
            <li>
              <strong>Stake</strong> — deposit AGB. Your share of every subsequent second is your
              share of the total staked.
            </li>
            <li><strong>Claim</strong> — mint what has accrued to you, any time, no waiting period.</li>
            <li><strong>Compound</strong> — mint it straight back into your position instead.</li>
            <li>
              <strong>Unstake</strong> — withdraw principal and proportional accrued reward together.
              No lock, no cooldown, no exit fee.
            </li>
          </ul>
          <p>
            A fifth move exists that we hope is never used: <code>emergencyWithdraw()</code> returns
            principal alone, forfeits all unclaimed reward, and touches no part of the emission or
            minting path. It's there so no conceivable failure in the reward machinery can ever trap
            a position.
          </p>
        </div>
      </section>

      {/* ---------------- § 7 continuity ---------------- */}
      <section className="wp-section">
        <div className="wp-rail">
          <b>§ 7</b>
          <span>Continuity</span>
          <p className="wp-gloss">Per second, without pause, in wall-clock time.</p>
        </div>
        <div className="wp-body">
          <h2>It does not close</h2>
          <p>
            The Series is measured in seconds, not blocks. Every second that passes on Ethereum —
            through weekends, through holidays, through all the hours when every settlement system
            built by people is dark — emits its portion of the current Term to whoever is staked at
            that moment.
          </p>
          <p>
            This is deliberate. A block-denominated schedule drifts whenever block times change or
            slots are missed, and a century of drift makes a mockery of a halving date. Timestamps
            are fixed by the slot under proof-of-stake, so a proposer can't shift them.
          </p>
          <p className="wp-axiom">
            The clock starts at the first stake and never stops. But a second in which nobody is
            staked emits nothing — and that second does not roll forward. It is simply gone.
          </p>
          <p>
            The Series rewards presence, not patience. It pays only those actually holding it open,
            second by second, for exactly as long as they do.
          </p>
        </div>
      </section>

      {/* ---------------- § 8 immutability ---------------- */}
      <section className="wp-section">
        <div className="wp-rail">
          <b>§ 8</b>
          <span>Immutability</span>
          <p className="wp-gloss">What was removed, and the order it was removed in.</p>
        </div>
        <div className="wp-body">
          <h2>Nobody is in charge, and this is verifiable</h2>
          <p>
            "Decentralised" is usually a description of intent. Here it's a description of the
            bytecode. The source is open, the contracts are deployed on mainnet, and the absence of
            control is something you can check rather than take on faith.
          </p>

          <h3>The three addresses</h3>
          <div className="wp-contracts">
            {ALGEBA && (
              <a href={addr(ALGEBA)} target="_blank" rel="noopener noreferrer">
                <span className="wp-lbl">ALGEBA — the token</span>
                <span className="wp-addr">{ALGEBA}</span>
              </a>
            )}
            {network.contracts.GENESIS && (
              <a href={addr(network.contracts.GENESIS)} target="_blank" rel="noopener noreferrer">
                <span className="wp-lbl">Genesis — the Constant</span>
                <span className="wp-addr">{network.contracts.GENESIS}</span>
              </a>
            )}
            {STAKING && (
              <a href={addr(STAKING)} target="_blank" rel="noopener noreferrer">
                <span className="wp-lbl">Staking — the Series</span>
                <span className="wp-addr">{STAKING}</span>
              </a>
            )}
            {/* TODO: replace with the public source repository URL once published. */}
            <div className="wp-norepo">
              <span className="wp-lbl">Source repository</span>
              <span className="wp-addr">To be published</span>
            </div>
          </div>

          <p>
            Every claim in this section is a function call away. Ask the token for{' '}
            <code>owner()</code> and it returns the zero address — there is no administrator, because
            the slot that would hold one is empty. Ask it for <code>MAX_SUPPLY</code>, ask the
            staking contract for <code>halvingPeriod</code>, ask Genesis for its{' '}
            <code>merkleRoot</code>. None of them have a setter to change the answer.
          </p>

          <h3>Genesis</h3>
          <p>
            No owner. Not a renounced owner — the contract declares none. The Merkle root, the
            duration and the token address are all <code>immutable</code>, set at construction. No
            setter, no pause, no sweep, no privileged withdrawal. Even the few wei left over from
            dividing 50 by the participant count are deliberately stranded rather than recoverable,
            because a sweep function is a key, and a key is a party to be trusted.
          </p>
          <h3>Staking</h3>
          <p>
            No owner. No configurable parameter of any kind. The halving period, the token and the
            Genesis reference are fixed at construction. Nothing about the Series can be tuned after
            deployment by anyone, its authors included.
          </p>
          <h3>The token</h3>
          <p>
            One privileged function ever existed: a single, one-time, irreversible call wiring in the
            staking contract. It can be called once and never re-pointed. Once wired, ownership was
            renounced and the last key in the system ceased to exist. Minting is thereafter reachable
            only by the staking contract, only within the Series allocation, and only under the cap.
          </p>
          <p className="wp-axiom">
            No one is in charge of it. That is not a feature we added. It is what remains after we
            removed ourselves.
          </p>
        </div>
      </section>

      {/* ---------------- § 9 authorship ---------------- */}
      <section className="wp-section">
        <div className="wp-rail">
          <b>§ 9</b>
          <span>Authorship</span>
          <p className="wp-gloss">Why no names appear anywhere in this document.</p>
        </div>
        <div className="wp-body">
          <h2>The proof is the author</h2>
          <p>
            The contributors to Algeba are not named here and won't be named later. This isn't
            theatre and it isn't modesty. It follows from what the experiment is testing.
          </p>
          <p>
            A named founder is a control surface. Reputation invites petition; petition invites
            exception; exception is precisely what a fixed schedule exists to prevent. If there is
            somebody to ask, then eventually somebody asks — and the answer, whatever it is, becomes
            a policy. A medium of trade that can be petitioned is a medium of trade with a governor.
          </p>
          <p>
            There is also nothing left for an author to be trusted about. The cap is compiled. The
            Series is compiled. The keys are gone. Every claim in this document reduces to a constant
            in verified source that anybody can read in an afternoon.
          </p>
          <p className="wp-axiom">
            You are not asked to believe the authors. You are asked to read the arithmetic. What
            makes the coin is not who made it — it is that the proof holds without them.
          </p>
          <p>
            The contributors hold one token each, on the same terms as everyone else, and no ability
            to change anything. In time the names will be irrelevant, which is the point; the
            contracts will still be running, which is also the point.
          </p>
        </div>
      </section>

      {/* ---------------- § 10 the identity ---------------- */}
      <section className="wp-section">
        <div className="wp-rail">
          <b>§ 10</b>
          <span>The Identity</span>
          <p className="wp-gloss">
            a = a. The oldest axiom in algebra, pressed into service as a monetary policy.
          </p>
        </div>
        <div className="wp-body">
          <h2>One AGB equals one AGB</h2>
          <p className="wp-lead">
            Asked what Algeba is worth, the protocol returns the only answer it can prove:{' '}
            <strong>1 AGB = 1 AGB</strong>. It is the reflexive axiom — <em>a</em> = <em>a</em>, the
            first thing algebra establishes and the last thing it can be argued out of.
          </p>
          <p>
            This is not evasion. To quote AGB in dollars is to accept that the dollar is the real
            unit and Algeba the derivative one — that the answer to <em>what is it worth</em> lives
            outside the system, in someone else's ledger, subject to someone else's policy. Algeba
            declines the frame. Its units aren't claims on a reserve, receipts for a deposit, or
            denominated in any instrument an authority can expand at will.
          </p>
          <p className="wp-axiom">
            A quantity that can only be quoted against something else has already conceded that the
            something else is the real thing.
          </p>
          <p>
            AGB was not sold. No raise, no sale, no listing commitment, no valuation placed on it by
            anybody with standing to do so. It entered the world at zero and has no issuer obliged to
            redeem it at any figure. Markets may price it — markets will price anything. The protocol
            asserts nothing whatsoever about what they decide.
          </p>
          <p>
            What it does assert is scarcity, and that assertion it can keep: there will never be more
            than 210,000,000; the rate halves every four years on a clock nobody controls; and every
            one that exists had to be held open through real time by somebody to come into existence
            at all.
          </p>
          <p className="wp-axiom">
            Price is something a market may or may not assign. Scarcity is something the contract
            guarantees whether or not a market ever shows up.
          </p>
          <p>
            The native value of AGB, insofar as it has one, is the trust its users place in it — and
            nothing else. No cash flow, no collateral, no backing, no floor. That isn't a deficiency
            in the design; it is the experiment. We are testing whether the arithmetic alone is
            enough for a thing to become worth reaching for.
          </p>
          <p>
            It may not be. That's a legitimate outcome of an experiment, and you should treat it as
            the likely one.
          </p>
        </div>
      </section>

      {/* ---------------- § 11 entry ---------------- */}
      <section className="wp-section">
        <div className="wp-rail">
          <b>§ 11</b>
          <span>Entry</span>
          <p className="wp-gloss">There is no sale. There are three doors.</p>
        </div>
        <div className="wp-body">
          <h2>How anyone gets in</h2>
          <p>
            The Genesis allowlist was sealed at deployment, its window has shut, and that door is
            closed permanently — nobody can reopen it, the authors included. Everything after it is
            permissionless: no allowlist, no application, no gatekeeper. The Series doesn't care who
            holds it.
          </p>
          <ol>
            <li>
              <strong>Hold the Series open.</strong> Stake 1 AGB or more and receive a proportional
              share of every second emitted while you remain staked. This is the only path that
              creates new AGB, and it's open to any address.
            </li>
            <li>
              <strong>Through an ecosystem project.</strong> Builders running projects that pair AGB
              as liquidity route it outward — the most common way the first holders outside Genesis
              arrive.
            </li>
            <li>
              <strong>From an existing holder.</strong> AGB is a plain ERC-20. It moves the way any
              ERC-20 moves, to anyone, without permission.
            </li>
          </ol>
          <p>
            Note what is not on that list: there is no purchase from the project, because there is no
            project to purchase from. Nobody holds an inventory to sell you.
          </p>
        </div>
      </section>

      {/* ---------------- § 12 horizon ---------------- */}
      <section className="wp-section">
        <div className="wp-rail">
          <b>§ 12</b>
          <span>Horizon</span>
          <p className="wp-gloss">Why the schedule is written in centuries.</p>
        </div>
        <div className="wp-body">
          <h2>Written for counterparties who have not arrived yet</h2>
          <p>
            A thousand and twenty-four years of defined emission is an absurd figure for a piece of
            software, and it's chosen on purpose. Every parameter in Algeba is set as though the
            systems that will use it haven't been built, the counterparties haven't been born, and
            the distances haven't yet been crossed.
          </p>
          <p>
            Agents transacting continuously need a unit that doesn't close overnight. Autonomous
            systems operating unsupervised need one that can't be altered while they're out of
            contact. And settlement across genuine distance — where a message takes minutes each way
            and no authority can be reached in time — requires a unit whose validity is checkable
            locally, from the arithmetic alone, with nothing to consult and nobody to ask.
          </p>
          <p className="wp-axiom">
            The design constraint is not speed. It is that the rules must still hold when nobody can
            be reached to confirm them.
          </p>
          <p>
            We don't know whether any of this comes to pass. The contracts are indifferent either
            way: they will run the Series to its Bound whether used by ten thousand agents or by
            nobody at all. That indifference is the most durable property Algeba has.
          </p>
          <p>
            Two machines, somewhere past the orbit of anywhere useful, agreeing that fourteen had
            been transferred. That's the whole ambition. Everything in this document exists so that
            the number they agreed on could not be revised by anyone who wasn't there.
          </p>
        </div>
      </section>

      {/* ---------------- § 13 risk ---------------- */}
      <section className="wp-section">
        <div className="wp-rail">
          <b>§ 13</b>
          <span>Risk</span>
        </div>
        <div className="wp-notice">
          <h3>Read this as an experiment, not an investment</h3>
          <p>
            AGB has no price, no issuer, no redemption, no backing and no expectation of value. It is
            not an investment, a security, a deposit, or a claim on anything. Nothing in this
            document is financial advice or an offer of any kind, and the lighter passages above
            should not be mistaken for one either.
          </p>
          <p>
            The contracts are immutable. This means any defect in them is also immutable — it cannot
            be patched, paused or rescued, and no party has the ability to make anyone whole. The
            properties described here follow from the deployed source; read it and verify them
            yourself rather than relying on this summary.
          </p>
          <p>
            Emission accrues only while positions are open; unattended time is permanently forfeited
            and the final supply may land below the Bound. You should be prepared for AGB to be worth
            nothing, indefinitely, and you should participate only with that outcome fully accepted.
          </p>
        </div>
      </section>

      <footer className="wp-end">
        <span>ALGEBA · AGB · ERC-20 · Ethereum mainnet</span>
        <span>1 AGB = 1 AGB · Bound 210,000,000 · Ratio ½</span>
        <span>Open source · No owner · Authors unnamed</span>
      </footer>
    </div>
  );
}
