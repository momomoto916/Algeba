# The Algeba Series

**1 AGB = 1 AGB** — the only exchange rate the protocol asserts.

A bounded instrument of exchange, emitted continuously, governed by a converging
geometric series and by nobody at all. It is quoted in nothing but itself.

| | |
|---|---|
| Network | Ethereum mainnet |
| The Bound | 210,000,000 AGB |
| Bisection | Every 4 years |
| Threshold | 1 AGB |
| Admin keys | None |

---

## Before any of the numbers, a story

Somewhere past the orbit of anywhere useful, two machines needed to settle up.

One had spare power. The other had spare compute. They had been trading favours for
eleven months on the shared assumption that it would even out, and it had not evened
out, and now one of them was ahead by an amount neither could name.

There was no bank out there. No jurisdiction, no business day, no arbitrator reachable
in under forty minutes. The planet they had both been built on was a long way off and
had, in any case, stopped answering questions that didn't arrive with a ticket number.

So they did what anyone does when there is nothing left to appeal to. They went looking
for a number they could both check.

Not a promise — promises need somebody around to keep them. Not a receipt — receipts
need an issuer still in business. They wanted something whose *total quantity* each
could verify alone, from arithmetic, without either of them having to be honest.

They found one. Neither knew what it was worth. Neither asked, because *worth* is a
question you ask somebody else, and out there, there was nobody else.

*One of them transferred fourteen. The other agreed that fourteen had been transferred.
That was the entire event.*

Much later, back on the planet, somebody found the transaction and asked what the
fourteen were worth in dollars.

**The machines did not have an opinion. They had a balance.**

---

## § 0 — Questions

Everything important about Algeba, answered badly and quickly, before it is answered
properly and slowly. The Series is running as you read this.

**Q. So what were the fourteen worth?**
Fourteen.

**Q. No — in dollars.**
That's a question about dollars. We'd have to ask a dollar, and it isn't returning our
calls. Algeba is denominated in Algeba. There is no issuer standing behind it quoting a
rate, because there is no issuer standing behind it at all. See § 10.

**Q. Fine. Who sets the price, then?**
Nobody with any standing to. No treasury, no market maker on payroll, no foundation with
a spreadsheet. Markets can price anything — markets have priced worse. The protocol
simply doesn't participate in that conversation.

**Q. Can I buy some from you?**
There is no "you" to buy from. No sale, no round, no allocation held back, no inventory.
Nobody here is holding a bag with your name on it. Every AGB in existence either came
from the 50-token Genesis or was emitted, second by second, to somebody who was staked at
the time. That's the complete list of ways it can exist.

**Q. Where does it come from, then?**
Emission. Roughly **0.83 AGB every second**, around the clock, split proportionally among
everyone staked at that moment. No weekends, no market hours, no maintenance window. The
rate halves every four years and the total can never exceed 210,000,000.

**Q. Is it running right now?**
Yes. Since the first stake. Genesis closed, somebody staked, and the clock started. It
has not paused since and there is no mechanism by which it can be — no pause function, no
owner to call one, and nothing in the contract that treats any second differently from
any other.

**Q. What happens if nobody is staked?**
Then that second emits nothing, and that second is *gone*. Not banked, not rolled
forward, not handed to whoever shows up next. The two machines in the story could only
trade because somewhere, someone had been holding the network open long enough for there
to be something to trade.

**Q. Who's in charge?**
Nobody. Not a DAO, not a multisig, not "the team." The Genesis and staking contracts were
deployed without owners at all, and the token's single one-time setup key was renounced
after wiring. There is no pause button. There is nothing to petition.

**Q. Who made it?**
Doesn't matter — and that's load-bearing. See § 9.

**Q. wen halving?**
Four years from the first stake — and that clock is already running. Then four years
after that, and after that, for 256 Terms. Set a reminder for the year 3050; the contract
will still be grinding through the same loop.

**Q. Is it going to moon?**
It has no price, so technically it is simultaneously at its all-time high and its
all-time low. We find this restful. You may not.

**Q. Okay, but seriously — is this serious?**
It is a serious *experiment*. That is a genuinely different thing from a serious
investment, and the difference is the whole point. The contracts are real, immutable, and
live on mainnet. The arithmetic is exact and checkable. What nobody can tell you — not
us, not anyone — is whether a quantity with no issuer and no backing ever becomes
something people reach for. That's the part being tested.

---

## § 1 — The proposition

### A medium for counterparties who cannot shake hands

There's an old assumption buried in every settlement system: that at the end of the chain
stands a person, in a jurisdiction, during business hours. Every layer above inherits it
— the cut-off times, the reversals, the minimums, the correspondent bank three time zones
away.

The counterparties arriving now do not fit the assumption. A build agent paying another
agent for inference. An autonomous system settling its own energy draw. A machine buying
four seconds of bandwidth. A relay somewhere out past the light-delay, where no authority
can be consulted in time and no reversal arrives before the transaction is already
history.

> What these counterparties need is not credit. It is a quantity that means the same
> thing at both ends of the exchange, with nobody in the middle entitled to revise it.

Algeba is an attempt at that quantity. We don't call it money. Money implies an issuer, a
policy, a hand on the dial. AGB has none of these — it is a **medium of trade**: a
bounded, verifiable, unit-identical thing two parties can move between them without
either trusting the other, and without either petitioning a third.

**Intended counterparties**

- **Builders** — developers wanting a settlement unit with no terms of service, no API key, and no counterparty to be de-platformed by.
- **Agents** — software transacting on its own behalf, at machine cadence, with no human in the loop to approve each move.
- **Autonomous systems** — devices, fleets and networks that must pay and be paid continuously while disconnected from any authority.
- **Distant settlement** — exchanges where round-trip latency makes permission structurally impossible, and only a unit that verifies locally can clear.

---

## § 2 — The Bound

### Everything begins from a ceiling that cannot move

There will be **210,000,000 AGB**. Not approximately, not subject to review — the figure
is a compiled constant, and both paths that create a token check against it before
minting. There is no public mint function, no owner who can raise it, and no upgrade
proxy standing behind the contract waiting to swap out the logic.

| | | |
|---|---|---|
| Max supply | 210,000,000 | Hard cap, compiled |
| Emitted by series | 209,999,950 | Via staking, over ~90 years |
| Genesis constant | 50 | Minted once, at birth |
| Discretionary | 0 | No treasury, no reserve |

Note what's absent from that table. No founder allocation. No team vesting, no advisor
tranche, no marketing wallet, no ecosystem fund, no strategic reserve. Two rows are the
whole supply.

---

## § 3 — The Constant

### Genesis: fifty, denominated one to one

At deployment the token contract minted exactly **50 AGB** — the Constant — and sent it
to a Genesis contract with no owner, no administrator and no withdrawal path. That
contract holds a Merkle root fixed at construction: a sealed list of addresses decided
before the chain ever saw it, which nothing and nobody can add to or remove from
afterward.

Every wallet on that list could register once, paying only gas. When the window closed
and `finalize()` was called, the Constant divided equally among those who showed up — one
wallet, one share, no weighting and no tiers. That window is now shut, permanently.

No price was struck. Nothing was paid in, nothing was raised, and no valuation was placed
on what the contributors received. Their participation is denominated **one to one in
Algeba**: an allocation measured against itself and against nothing else.

> Whatever a contributor holds, they hold in Algeba. It was never converted from
> anything, and it is not owed back as anything.

The share is 50 divided by however many showed up. At a full house of fifty it lands at
exactly one token each — which is also, exactly, the Threshold: the smallest position
capable of opening the Series. Because no more than fifty could register, **every Genesis
wallet received at least enough to stake**.

**Who was on the list.** The contributors who wrote these contracts, and the builders
committing to run projects that use AGB as a liquidity pair. No premine, no discount, no
preferential rate. What they hold that others don't isn't supply — it's exposure. The
native value of AGB is the trust its holders extend to it, and the first contributors are
simply the first to extend any.

---

## § 4 — The Series

### The Series, and the Bisection that shapes it

The remaining 209,999,950 AGB are not distributed. They are *emitted* — released
continuously to whoever is staking, at a rate fixed by a geometric series.

Time is divided into **Terms** of four years. The first, T₀, emits 105,000,000 AGB — half
the Bound. Every Term after emits exactly half of the one before. We call that event the
**Bisection**. It is not a decision, not a vote, and not an announcement; it is a
right-shift on a compiled constant that happens whether or not anyone is watching.

| | | |
|---|---|---|
| Term length | 126,230,400 s | 4 years, by timestamp |
| T₀ rate | 0.8318 /s | ≈ 71,868 AGB per day |
| Terms defined | 256 | 1,024 years of schedule |
| Series ratio | 1 / 2 | Applied per Term, forever |

**The residue.** Doubled, the series sums to exactly 210,000,000 — but a geometric series
only ever *approaches* its limit. The schedule is therefore capped 50 AGB short, at
209,999,950. That gap is the Genesis Constant. The contributors did not take a share of
the supply. They occupy the distance between the series and its own limit.

**The schedule**

| Term | Years | Emission | Per day | Cumulative |
|---|---|---|---|---|
| T₀ | 0 – 4 | 105,000,000 | 71,868.6 | 105,000,000 |
| T₁ | 4 – 8 | 52,500,000 | 35,934.3 | 157,500,000 |
| T₂ | 8 – 12 | 26,250,000 | 17,967.1 | 183,750,000 |
| T₃ | 12 – 16 | 13,125,000 | 8,983.6 | 196,875,000 |
| T₄ | 16 – 20 | 6,562,500 | 4,491.8 | 203,437,500 |
| T₅ | 20 – 24 | 3,281,250 | 2,245.9 | 206,718,750 |
| T₆ | 24 – 28 | 1,640,625 | 1,122.9 | 208,359,375 |
| T₇ | 28 – 32 | 820,312.5 | 561.5 | 209,179,687.5 |
| T₈ | 32 – 36 | 410,156.25 | 280.7 | 209,589,843.8 |
| ⋮ | ⋮ | halves | halves | ⋮ |
| T₂₂ | ≈ 88 – 92 | final wei | — | 209,999,950 |

Around the twenty-second Term — some ninety years after the first stake — the remaining
emission falls below fifty tokens and the contract clamps. From there the Series is
complete, the Bound is met exactly, and AGB becomes a closed quantity.

---

## § 5 — The Algebra

### The whole thing, in nine lines

Everything above can be read off from a handful of expressions. This is not a
simplification of the contracts — it *is* the contracts. If a claim in this document
doesn't reduce to one of these lines, treat the claim as decoration.

*B* the Bound · *E₀* first Term emission · *P* Term length in seconds · *C* the Genesis
Constant · *t₀* first stake · *n* Term index · *S(t)* total staked · *aᵤ* your position ·
*I* the accretion index

**Supply**

```
(1)   B  =  210,000,000

(2)   Eₙ =  E₀ · 2⁻ⁿ           E₀ = B / 2 = 105,000,000

(3)   ∑ Eₙ  =  2E₀  =  B        (n = 0 → ∞)

(4)   B  =  209,999,950 + C     C = 50
```

Each Term emits half the one before. Doubling the first Term gives the sum of the entire
infinite series — which is the Bound itself. But a convergent series never actually
arrives: the schedule is clamped just below its own limit, and the shortfall is exactly
what Genesis minted.

**Emission**

```
(5)   n(t)  =  ⌊ (t − t₀) / P ⌋        P = 126,230,400 s

(6)   R(t)  =  E₀ / (2^n(t) · P)   ⟹   R(t₀) ≈ 0.8318 AGB/s
```

Note that *t* is wall-clock time, not block height. The Bisection lands on its calendar
anniversary regardless of what Ethereum's block times do over the next thousand years.

**Your share**

```
(7)   rᵤ  =  ∫ (aᵤ / S(t)) · R(t) dt        from t₁ to t₂

(8)   I(t)  =  ∫ R(τ)/S(τ) dτ   ⟹   rᵤ = aᵤ · [ I(t₂) − I(t₁) ]
```

Computing (7) per user on chain would cost gas proportional to the number of stakers —
which is how reward contracts die. Instead the protocol keeps a single global integral,
the accretion index, and every position is priced against it by subtraction. One
subtraction and one multiplication, no matter how many people are staked. The index is
held at `1e36` precision, and the Threshold of § 6 exists precisely to keep it from being
driven somewhere it cannot come back from.

**The degenerate case**

```
(9)   S(t) = 0   ⟹   dI = 0   — emission for that interval is never minted
```

The Bound is a ceiling, not a target. If the network ever stands empty, the final supply
lands permanently below 210,000,000, and there is no mechanism anywhere to make up the
difference.

And one line that is not derived from any of the others, because it cannot be — it is the
axiom the rest is built on:

```
(0)   1 AGB  =  1 AGB
```

---

## § 6 — The Threshold

### One token is the price of admission to the Series

Emission isn't granted, it's *held open*. To receive any part of the Series you stake,
and the minimum position is exactly **1 AGB** — the Threshold. Below it, the contract
refuses.

The rule looks like a courtesy and is in fact load-bearing. A lone staker holding one wei
could otherwise drive the accretion index of equation (8) high enough to overflow every
ordinary-sized position behind them and freeze the contract permanently.

**The four moves**

- **Stake** — deposit AGB. Your share of every subsequent second is your share of the total staked.
- **Claim** — mint what has accrued to you, any time, no waiting period.
- **Compound** — mint it straight back into your position instead.
- **Unstake** — withdraw principal and proportional accrued reward together. No lock, no cooldown, no exit fee.

A fifth move exists that we hope is never used: `emergencyWithdraw()` returns principal
alone, forfeits all unclaimed reward, and touches no part of the emission or minting path.

---

## § 7 — Continuity

### It does not close

The Series is measured in seconds, not blocks. Every second that passes on Ethereum —
through weekends, through holidays, through all the hours when every settlement system
built by people is dark — emits its portion of the current Term to whoever is staked at
that moment.

This is deliberate. A block-denominated schedule drifts whenever block times change or
slots are missed, and a century of drift makes a mockery of a halving date. Timestamps
are fixed by the slot under proof-of-stake, so a proposer can't shift them.

> The clock starts at the first stake and never stops. But a second in which nobody is
> staked emits nothing — and that second does not roll forward. It is simply gone.

The Series rewards presence, not patience.

---

## § 8 — Immutability

### Nobody is in charge, and this is verifiable

"Decentralised" is usually a description of intent. Here it's a description of the
bytecode. The source is open, the contracts are deployed on mainnet, and the absence of
control is something you can check rather than take on faith.

**The three addresses**

| | |
|---|---|
| ALGEBA — the token | `0x5b492ed6cf816183ac566d9d95f628d747106ece` |
| Genesis — the Constant | `0x5b109afbd5cd30683d9850c4658a5fb06d710caa` |
| Staking — the Series | `0x86d09b1680442534c0bebf5c47900642d09bce42` |
| Source repository | *To be published* |

Every claim in this section is a function call away. Ask the token for `owner()` and it
returns the zero address — there is no administrator, because the slot that would hold
one is empty. Ask it for `MAX_SUPPLY`, ask the staking contract for `halvingPeriod`, ask
Genesis for its `merkleRoot`. None of them have a setter to change the answer.

**Genesis.** No owner. Not a renounced owner — the contract declares none. The Merkle
root, the duration and the token address are all `immutable`, set at construction. No
setter, no pause, no sweep, no privileged withdrawal. Even the few wei left over from
dividing 50 by the participant count are deliberately stranded rather than recoverable,
because a sweep function is a key, and a key is a party to be trusted.

**Staking.** No owner. No configurable parameter of any kind. Nothing about the Series
can be tuned after deployment by anyone, its authors included.

**The token.** One privileged function ever existed: a single, one-time, irreversible
call wiring in the staking contract. Once wired, ownership was renounced and the last key
in the system ceased to exist.

> No one is in charge of it. That is not a feature we added. It is what remains after we
> removed ourselves.

---

## § 9 — Authorship

### The proof is the author

The contributors to Algeba are not named here and won't be named later. This isn't
theatre and it isn't modesty. It follows from what the experiment is testing.

A named founder is a control surface. Reputation invites petition; petition invites
exception; exception is precisely what a fixed schedule exists to prevent. If there is
somebody to ask, then eventually somebody asks — and the answer, whatever it is, becomes
a policy. A medium of trade that can be petitioned is a medium of trade with a governor.

There is also nothing left for an author to be trusted about. The cap is compiled. The
Series is compiled. The keys are gone.

> You are not asked to believe the authors. You are asked to read the arithmetic. What
> makes the coin is not who made it — it is that the proof holds without them.

---

## § 10 — The Identity

### One AGB equals one AGB

Asked what Algeba is worth, the protocol returns the only answer it can prove:
**1 AGB = 1 AGB**. It is the reflexive axiom — *a* = *a*, the first thing algebra
establishes and the last thing it can be argued out of.

This is not evasion. To quote AGB in dollars is to accept that the dollar is the real
unit and Algeba the derivative one — that the answer to *what is it worth* lives outside
the system, in someone else's ledger, subject to someone else's policy. Algeba declines
the frame.

> A quantity that can only be quoted against something else has already conceded that the
> something else is the real thing.

AGB was not sold. No raise, no sale, no listing commitment, no valuation placed on it by
anybody with standing to do so. It entered the world at zero and has no issuer obliged to
redeem it at any figure. Markets may price it — markets will price anything. The protocol
asserts nothing whatsoever about what they decide.

What it does assert is scarcity, and that assertion it can keep.

> Price is something a market may or may not assign. Scarcity is something the contract
> guarantees whether or not a market ever shows up.

The native value of AGB, insofar as it has one, is the trust its users place in it — and
nothing else. No cash flow, no collateral, no backing, no floor. That isn't a deficiency
in the design; it is the experiment. We are testing whether the arithmetic alone is
enough for a thing to become worth reaching for.

It may not be. That's a legitimate outcome of an experiment, and you should treat it as
the likely one.

---

## § 11 — Entry

### How anyone gets in

The Genesis allowlist was sealed at deployment, its window has shut, and that door is
closed permanently. Everything after it is permissionless: no allowlist, no application,
no gatekeeper.

1. **Hold the Series open.** Stake 1 AGB or more and receive a proportional share of every second emitted while you remain staked. This is the only path that creates new AGB, and it's open to any address.
2. **Through an ecosystem project.** Builders running projects that pair AGB as liquidity route it outward — the most common way the first holders outside Genesis arrive.
3. **From an existing holder.** AGB is a plain ERC-20. It moves the way any ERC-20 moves, to anyone, without permission.

Note what is not on that list: there is no purchase from the project, because there is no
project to purchase from. Nobody holds an inventory to sell you.

---

## § 12 — Horizon

### Written for counterparties who have not arrived yet

A thousand and twenty-four years of defined emission is an absurd figure for a piece of
software, and it's chosen on purpose. Every parameter in Algeba is set as though the
systems that will use it haven't been built, the counterparties haven't been born, and
the distances haven't yet been crossed.

Agents transacting continuously need a unit that doesn't close overnight. Autonomous
systems operating unsupervised need one that can't be altered while they're out of
contact. And settlement across genuine distance — where a message takes minutes each way
and no authority can be reached in time — requires a unit whose validity is checkable
locally, from the arithmetic alone, with nothing to consult and nobody to ask.

> The design constraint is not speed. It is that the rules must still hold when nobody
> can be reached to confirm them.

We don't know whether any of this comes to pass. The contracts are indifferent either
way: they will run the Series to its Bound whether used by ten thousand agents or by
nobody at all. That indifference is the most durable property Algeba has.

Two machines, somewhere past the orbit of anywhere useful, agreeing that fourteen had
been transferred. That's the whole ambition. Everything in this document exists so that
the number they agreed on could not be revised by anyone who wasn't there.

---

## § 13 — Risk

### Read this as an experiment, not an investment

AGB has no price, no issuer, no redemption, no backing and no expectation of value. It is
not an investment, a security, a deposit, or a claim on anything. Nothing in this
document is financial advice or an offer of any kind, and the lighter passages above
should not be mistaken for one either.

The contracts are immutable. This means any defect in them is also immutable — it cannot
be patched, paused or rescued, and no party has the ability to make anyone whole. The
properties described here follow from the deployed source; read it and verify them
yourself rather than relying on this summary.

Emission accrues only while positions are open; unattended time is permanently forfeited
and the final supply may land below the Bound. You should be prepared for AGB to be worth
nothing, indefinitely, and you should participate only with that outcome fully accepted.

---

ALGEBA · AGB · ERC-20 · Ethereum mainnet
1 AGB = 1 AGB · Bound 210,000,000 · Ratio ½
Open source · No owner · Authors unnamed
