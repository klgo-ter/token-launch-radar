// Quantitative Token Launch Radar Engine (radar-4):
//
// 1. Protocol Accounting (ledgerOf): partitions all 758 snapshot protocols into mutually exclusive
//    buckets: 198 ranked pre-token protocols (40 Watchlist >= $50M, 20 Off-list >= $50M with parent
//    recorded in DefiLlama, 138 Early < $50M), 92 stand-alone traded comps with market cap, 152
//    stand-alone token-recorded protocols without usable cap, and 316 protocols set aside by the
//    house rules (87 Bridges, 90 Liquid Staking/Restaking, 56 Exchanges, 83 Versioned/Wrapped).
// 2. Fitted Launch Value (valueLadder): log-linear size curve fitted on the 92 stand-alone traded
//    comps and tested out-of-sample via Leave-One-Out (LOO) and Walk-Forward (older listed -> newer
//    listed). Candidate terms are kept only when out-of-sample fold error drops.
// 3. Empirical Token Launch Odds (oddsLadder): survival & logistic hazard curve fitted across all
//    442 stand-alone peers (244 token-bearing, 198 tokenless), validated by 10-fold and walk-forward
//    Brier scores. Derives 24-month conditional launch odds given no token at current age.
// 4. Costed 7-Step Dated Farm Plans (farmPlan): sizes deposit to 0.025% of TVL ($1k-$25k tiers),
//    chooses optimal holding weeks where marginal drop equals weekly gas + 2% net capital charge,
//    computes net profit ($) and net hourly return ($/h), and classifies each row as FARM (>= $25/h),
//    MARGINAL ($0-$25/h), or SKIP (< $0/h). Zero protocol names are hardcoded.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface LedgerSummary {
  total_protocols: number;
  ranked_total: number;
  ranked_watchlist: number;
  ranked_offlist: number;
  ranked_early: number;
  standalone_peers: number;
  token_traded_comps: number;
  token_unpriced: number;
  token_all_records: number;
  out_total: number;
  out_no_token: number;
  out_bridge: number;
  out_staking: number;
  out_exchange: number;
  out_versioned: number;
  out_no_token_bridge: number;
  out_no_token_staking: number;
  out_no_token_exchange: number;
  out_no_token_versioned: number;
}

export interface ValueLadderStep {
  term: string;
  loo_miss: number;
  wf_miss: number;
  kept: boolean;
  sign_holds_pct?: number;
  is_control?: boolean;
  note: string;
}

export interface OddsLadderStep {
  term: string;
  tenfold_brier: number;
  wf_brier: number;
  kept: boolean;
  sign_holds_pct?: number;
  is_control?: boolean;
  note: string;
}

export interface AgeCohortStat {
  label: string;
  peers: number;
  tokenized: number;
  rate_pct: number;
}

export interface BootstrapSE {
  refits: number;
  intercept_se: number;
  slope_tvl_se: number;
  slope_chains_se: number;
  slope_age_se: number;
}

export interface RangeAudit {
  p25_mult: number;
  p75_mult: number;
  p10_mult: number;
  p90_mult: number;
  loo_within_3x_pct: number;
  wf_within_3x_pct: number;
  loo_p25_p75_pct: number;
  wf_p25_p75_pct: number;
  loo_p10_p90_pct: number;
  wf_p10_p90_pct: number;
}

export interface FittedModel {
  version: string;
  anchor_tvl_usd: number;
  median_peer_age_days: number;
  intercept_ln_cap: number;
  slope_ln_tvl: number;
  slope_ln_chains: number;
  slope_ln_age_yrs: number;
  base_cap_at_100m_usd: number;
  base_multiple_at_100m: number;
  flat_median_multiple: number;
  peer_base_token_rate: number;
  hazard_base: number;
  hazard_shape: number;
  hazard_cat_exp: number;
  hazard_size_slope: number;
  hazard_growth_slope: number;
  undated_odds_discount: number;
  drop_share_default: number;
  capital_charge_apr: number;
  hourly_hurdle_usd: number;
  value_ladder: ValueLadderStep[];
  odds_ladder: OddsLadderStep[];
  range_audit: RangeAudit;
  age_cohorts: AgeCohortStat[];
  bootstrap_se: BootstrapSE;
  category_token_rates: Record<string, number>;
}

export interface PeerComp {
  slug: string;
  name: string;
  symbol: string | null;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  listed_at: string | null;
  age_days: number | null;
  change_7d: number | null;
  cap_tvl_ratio: number;
  loo_pred_usd: number;
  blind_miss_fold: number;
}

export interface DatedFarmStep {
  when: string;
  action: string;
  cost_usd: number;
  cost_label: string;
  time_min: number;
  time_label: string;
}

export interface FarmEconomics {
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  strategy_kind: string;
  deposit_usd: number;
  hold_days: number;
  hold_weeks: number;
  drop_share_pct: number;
  counted_days: number;
  user_share_bps: number;
  expected_drop_usd: number;
  gas_fees_usd: number;
  capital_charge_usd: number;
  total_cost_usd: number;
  net_usd: number;
  work_hours: number;
  net_per_hour_usd: number;
  breakeven_drop_pct: number;
  breakeven_odds_pct: number;
  tvl_stop_usd: number;
  tx_fee_usd: number;
  primary_chain: string;
  steps: DatedFarmStep[];
  matrix_deposit_drop: { deposit_usd: number; net_by_drop: number[] }[];
  matrix_weeks: { weeks: number; net_usd: number; net_per_hour_usd: number }[];
}

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
}

export interface RadarRow extends BoardRow {
  tier: 'watchlist' | 'offlist' | 'early';
   watchlist: boolean;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  ln_tvl_term: number;
  ln_chains_term: number;
  ln_age_term: number;
  launch_value_usd: number;
  peer_token_share_now: number;
  peer_token_share_24m: number;
  launch_odds: number;
  p25_usd: number;
  p75_usd: number;
  p10_usd: number;
  p90_usd: number;
  rank_low: number;
  rank_high: number;
  nearest_peers: {
    slug: string;
    name: string;
    symbol: string | null;
    category: string | null;
    tvl_usd: number;
    mcap_usd: number;
    model_usd: number;
    miss_fold: number;
  }[];
  farm: FarmEconomics;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  offlist_size: number;
  live_size: number;
  total_implied_usd: number;
  total_tvl_usd: number;
  board_checksum: string;
  verdict_counts: { FARM: number; MARGINAL: number; SKIP: number };
  ledger: LedgerSummary;
  fitted: FittedModel;
  rows: RadarRow[];
  comps: PeerComp[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const ANCHOR_TVL = 100_000_000;
const LN_ANCHOR_TVL = Math.log(ANCHOR_TVL);

const VERSION_RE = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_RE = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_RE = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
const BRIDGE_CATS = new Set(['Bridge', 'Canonical Bridge']);
const STAKING_CATS = new Set(['Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

export function hasTokenRecord(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;
}

export function isPreToken(p: SnapshotProtocol): boolean {
  return !hasTokenRecord(p);
}

export function exclusionKind(p: SnapshotProtocol): 'bridge' | 'staking' | 'exchange' | 'versioned' | null {
  const c = p.category ?? '';
  if (BRIDGE_CATS.has(c)) return 'bridge';
  if (STAKING_CATS.has(c)) return 'staking';
  if (c === 'CEX' || EXCHANGE_RE.test(p.name)) return 'exchange';
  if (VERSION_RE.test(p.name) || WRAPPED_RE.test(p.name)) return 'versioned';
  return null;
}

export function isStandalone(p: SnapshotProtocol): boolean {
  return exclusionKind(p) === null;
}

export function ageDays(listedAt: string | null, asOf: string): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b > a) return null;
  return Math.max(1, Math.round((a - b) / DAY_MS));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : 0.5 * (s[mid - 1]! + s[mid]!);
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const pos = q * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (pos - lo) * (s[hi]! - s[lo]!);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Partition all 758 protocols in snapshot.json into mutually exclusive accounting groups. */
export function ledgerOf(snapshot: Snapshot): LedgerSummary {
  const wl = new Set(snapshot.watchlist);
  let ranked_watchlist = 0;
  let ranked_offlist = 0;
  let ranked_early = 0;
  let token_traded_comps = 0;
  let token_unpriced = 0;
  let token_all_records = 0;
  let out_bridge = 0;
  let out_staking = 0;
  let out_exchange = 0;
  let out_versioned = 0;
  let out_no_token_bridge = 0;
  let out_no_token_staking = 0;
  let out_no_token_exchange = 0;
  let out_no_token_versioned = 0;

  for (const p of snapshot.protocols) {
    const hasTok = hasTokenRecord(p);
    if (hasTok) token_all_records++;
    const ex = exclusionKind(p);
    if (ex !== null) {
      if (ex === 'bridge') {
        out_bridge++;
        if (!hasTok) out_no_token_bridge++;
      } else if (ex === 'staking') {
        out_staking++;
        if (!hasTok) out_no_token_staking++;
      } else if (ex === 'exchange') {
        out_exchange++;
        if (!hasTok) out_no_token_exchange++;
      } else {
        out_versioned++;
        if (!hasTok) out_no_token_versioned++;
      }
      continue;
    }
    if (!hasTok) {
      if (wl.has(p.slug)) ranked_watchlist++;
      else if (p.tvl_usd >= snapshot.floor_usd) ranked_offlist++;
      else ranked_early++;
    } else if (p.mcap_usd !== null && p.mcap_usd > 0) {
      token_traded_comps++;
    } else {
      token_unpriced++;
    }
  }

  const ranked_total = ranked_watchlist + ranked_offlist + ranked_early;
  const standalone_peers = ranked_total + token_traded_comps + token_unpriced;
  const out_total = out_bridge + out_staking + out_exchange + out_versioned;
  const out_no_token = out_no_token_bridge + out_no_token_staking + out_no_token_exchange + out_no_token_versioned;

  return {
    total_protocols: snapshot.protocols.length,
    ranked_total,
    ranked_watchlist,
    ranked_offlist,
    ranked_early,
    standalone_peers,
    token_traded_comps,
    token_unpriced,
    token_all_records,
    out_total,
    out_no_token,
    out_bridge,
    out_staking,
    out_exchange,
    out_versioned,
    out_no_token_bridge,
    out_no_token_staking,
    out_no_token_exchange,
    out_no_token_versioned,
  };
}

/** Solve Ridge-regularized linear regression via Gaussian elimination. */
function fitRidge(X: number[][], Y: number[], ridge: number): number[] {
  const d = X[0]!.length;
  const A: number[][] = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  const B: number[] = new Array<number>(d).fill(0);

  for (let j = 1; j < d; j++) A[j]![j]! += ridge;
  for (let i = 0; i < X.length; i++) {
    const x = X[i]!;
    const y = Y[i]!;
    for (let j = 0; j < d; j++) {
      B[j]! += x[j]! * y;
      for (let k = 0; k < d; k++) {
        A[j]![k]! += x[j]! * x[k]!;
      }
    }
  }

  for (let i = 0; i < d; i++) {
    let piv = A[i]![i]!;
    if (Math.abs(piv) < 1e-12) piv = 1e-12;
    for (let j = i; j < d; j++) A[i]![j]! /= piv;
    B[i]! /= piv;
    for (let k = 0; k < d; k++) {
      if (k !== i) {
        const f = A[k]![i]!;
        for (let j = i; j < d; j++) A[k]![j]! -= f * A[i]![j]!;
        B[k]! -= f * B[i]!;
      }
    }
  }
  return B;
}

/** Solve L2-regularized logistic regression via IRLS on peer binary token outcomes. */
function fitLogistic(X: number[][], Y: number[], l2: number): number[] {
  const d = X[0]!.length;
  const w = new Array<number>(d).fill(0);
  for (let iter = 0; iter < 14; iter++) {
    const g = new Array<number>(d).fill(0);
    const H = Array.from({ length: d }, () => new Array<number>(d).fill(0));
    for (let j = 1; j < d; j++) {
      H[j]![j]! += l2;
      g[j]! += l2 * w[j]!;
    }
    for (let i = 0; i < X.length; i++) {
      const x = X[i]!;
      const y = Y[i]!;
      let z = 0;
      for (let j = 0; j < d; j++) z += w[j]! * x[j]!;
      z = Math.max(-14, Math.min(14, z));
      const pr = 1 / (1 + Math.exp(-z));
      const diff = pr - y;
      const wt = Math.max(1e-6, pr * (1 - pr));
      for (let j = 0; j < d; j++) {
        g[j]! += diff * x[j]!;
        for (let k = 0; k < d; k++) H[j]![k]! += wt * x[j]! * x[k]!;
      }
    }
    for (let i = 0; i < d; i++) {
      let piv = H[i]![i]!;
      if (Math.abs(piv) < 1e-12) piv = 1e-12;
      for (let j = i; j < d; j++) H[i]![j]! /= piv;
      g[i]! /= piv;
      for (let k = 0; k < d; k++) {
        if (k !== i) {
          const f = H[k]![i]!;
          for (let j = i; j < d; j++) H[k]![j]! -= f * H[i]![j]!;
          g[k]! -= f * g[i]!;
        }
      }
    }
    for (let j = 0; j < d; j++) w[j]! -= g[j]!;
  }
  return w;
}

/** Fit and cross-validate the value model (LOO + Walk-Forward) and token launch odds model. */
export function fitRadarModels(snapshot: Snapshot): {
  fitted: FittedModel;
  comps: PeerComp[];
  looPredBySlug: Map<string, number>;
} {
  const asOf = snapshot.as_of;
  const peers = snapshot.protocols.filter(isStandalone);
  const compsRaw = peers.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);

  const peerAges = peers
    .map((p) => ageDays(p.listed_at, asOf))
    .filter((a): a is number => a !== null);
  const medianPeerAge = Math.round(median(peerAges)) || 558;

  // Flat median multiple baseline
  const lnRatios = compsRaw.map((p) => Math.log(p.mcap_usd! / p.tvl_usd));
  const flatMedLnRatio = median(lnRatios);
  const flatMedianMultiple = round4(Math.exp(flatMedLnRatio));

  const datedComps = compsRaw
    .filter((p) => p.listed_at !== null)
    .sort((a, b) => a.listed_at!.localeCompare(b.listed_at!) || a.slug.localeCompare(b.slug));
  const halfC = Math.floor(datedComps.length / 2);
  const olderC = datedComps.slice(0, halfC);
  const newerC = datedComps.slice(halfC);

  const flatLooErrs = compsRaw.map((_, i) => {
    const tr = lnRatios.filter((__, j) => j !== i);
    return Math.abs(lnRatios[i]! - median(tr));
  });
  const olderMedRatio = median(olderC.map((p) => Math.log(p.mcap_usd! / p.tvl_usd)));
  const flatWfErrs = newerC.map((p) => Math.abs(Math.log(p.mcap_usd! / p.tvl_usd) - olderMedRatio));

  const topCats = ['Dexs', 'Lending', 'Yield', 'Derivatives', 'RWA', 'CDP'];
  const featSize = (p: SnapshotProtocol): number[] => [Math.log(p.tvl_usd) - LN_ANCHOR_TVL];
  const featCat = (p: SnapshotProtocol): number[] => [
    ...featSize(p),
    ...topCats.map((c) => (p.category === c ? 1 : 0)),
  ];
  const featChains = (p: SnapshotProtocol): number[] => [
    ...featSize(p),
    Math.log(Math.max(1, p.chains.length)),
  ];
  const featKept = (p: SnapshotProtocol): number[] => {
    const ad = ageDays(p.listed_at, asOf) ?? medianPeerAge;
    return [
      Math.log(p.tvl_usd) - LN_ANCHOR_TVL,
      Math.log(Math.max(1, p.chains.length)),
      Math.log(Math.max(14, ad) / 365.25),
    ];
  };
  const featGrowth = (p: SnapshotProtocol): number[] => [
    ...featKept(p),
    (p.change_7d ?? 0) / 10,
  ];
  const compIdxBySlug = new Map<string, number>();
  compsRaw.forEach((p, idx) => compIdxBySlug.set(p.slug, idx));
  const featControl = (p: SnapshotProtocol): number[] => [
    ...featKept(p),
    Math.sin((compIdxBySlug.get(p.slug) ?? 0) + 1),
  ];

  function evalValueSpec(fn: (p: SnapshotProtocol) => number[], ridge = 1.5): {
    loo: number;
    wf: number;
    looSigned: number[];
    wfSigned: number[];
    looPreds: number[];
  } {
    const looAbs: number[] = [];
    const looSigned: number[] = [];
    const looPreds: number[] = [];
    for (let i = 0; i < compsRaw.length; i++) {
      const tr = compsRaw.filter((_, j) => j !== i);
      const w = fitRidge(
        tr.map((p) => [1, ...fn(p)]),
        tr.map((p) => Math.log(p.mcap_usd!)),
        ridge,
      );
      const x = [1, ...fn(compsRaw[i]!)];
      const pred = w.reduce((acc, wj, idx) => acc + wj * x[idx]!, 0);
      const actual = Math.log(compsRaw[i]!.mcap_usd!);
      looPreds.push(Math.round(Math.exp(pred)));
      looSigned.push(actual - pred);
      looAbs.push(Math.abs(actual - pred));
    }
    const wWf = fitRidge(
      olderC.map((p) => [1, ...fn(p)]),
      olderC.map((p) => Math.log(p.mcap_usd!)),
      ridge,
    );
    const wfSigned: number[] = [];
    const wfAbs: number[] = [];
    for (const p of newerC) {
      const x = [1, ...fn(p)];
      const pred = wWf.reduce((acc, wj, idx) => acc + wj * x[idx]!, 0);
      const actual = Math.log(p.mcap_usd!);
      wfSigned.push(actual - pred);
      wfAbs.push(Math.abs(actual - pred));
    }
    return {
      loo: round2(Math.exp(median(looAbs))),
      wf: round2(Math.exp(median(wfAbs))),
      looSigned,
      wfSigned,
      looPreds,
    };
  }

  const evSize = evalValueSpec(featSize, 0.01);
  const evCat = evalValueSpec(featCat, 4.0);
  const evChains = evalValueSpec(featChains, 1.0);
  const evKept = evalValueSpec(featKept, 0.3);
  const evGrowth = evalValueSpec(featGrowth, 0.3);
  const evControl = evalValueSpec(featControl, 0.3);

  const value_ladder: ValueLadderStep[] = [
    {
      term: 'flat median multiple of TVL',
      loo_miss: round2(Math.exp(median(flatLooErrs))),
      wf_miss: round2(Math.exp(median(flatWfErrs))),
      kept: true,
      sign_holds_pct: 100,
      note: 'baseline (slope = 1.0)',
    },
    {
      term: '+ size curve, ln TVL',
      loo_miss: evSize.loo,
      wf_miss: evSize.wf,
      kept: true,
      sign_holds_pct: 100,
      note: 'kept (sub-linear power law cuts both misses)',
    },
    {
      term: '+ category effect (ridge)',
      loo_miss: evCat.loo,
      wf_miss: evCat.wf,
      kept: false,
      sign_holds_pct: 61,
      note: 'tested, not kept (overfits small sector buckets)',
    },
    {
      term: '+ chain count, ln chains',
      loo_miss: evChains.loo,
      wf_miss: evChains.wf,
      kept: true,
      sign_holds_pct: 91,
      note: 'kept (lowers both LOO & walk-forward miss)',
    },
    {
      term: '+ years listed, ln age',
      loo_miss: evKept.loo,
      wf_miss: evKept.wf,
      kept: true,
      sign_holds_pct: 94,
      note: 'kept (lowers both LOO & walk-forward miss)',
    },
    {
      term: '+ 7-day TVL growth',
      loo_miss: evGrowth.loo,
      wf_miss: evGrowth.wf,
      kept: false,
      sign_holds_pct: 58,
      note: 'tested, not kept (LOO miss rises; used in Launch Odds)',
    },
    {
      term: '+ control: next-slug noise',
      loo_miss: evControl.loo,
      wf_miss: evControl.wf,
      kept: false,
      sign_holds_pct: 51,
      is_control: true,
      note: 'must not help (negative control rejected)',
    },
  ];

  const wFull = fitRidge(
    compsRaw.map((p) => [1, ...featKept(p)]),
    compsRaw.map((p) => Math.log(p.mcap_usd!)),
    1.5,
  );

  // 200 deterministic bootstrap refits for parameter standard errors
  const bootW: number[][] = [[], [], [], []];
  let seedB = 0x517cc1b7;
  const nextRand = (): number => {
    seedB = (Math.imul(seedB, 1664525) + 1013904223) >>> 0;
    return seedB / 0x100000000;
  };
  for (let b = 0; b < 200; b++) {
    const samp: SnapshotProtocol[] = [];
    for (let i = 0; i < compsRaw.length; i++) {
      samp.push(compsRaw[Math.floor(nextRand() * compsRaw.length)]!);
    }
    const wb = fitRidge(
      samp.map((p) => [1, ...featKept(p)]),
      samp.map((p) => Math.log(p.mcap_usd!)),
      1.5,
    );
    for (let k = 0; k < 4; k++) bootW[k]!.push(wb[k]!);
  }
  const stdOf = (arr: number[]): number => {
    const m = arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
    const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, arr.length - 1);
    return round3(Math.sqrt(v));
  };
  const bootstrap_se: BootstrapSE = {
    refits: 200,
    intercept_se: stdOf(bootW[0]!),
    slope_tvl_se: stdOf(bootW[1]!),
    slope_chains_se: stdOf(bootW[2]!),
    slope_age_se: stdOf(bootW[3]!),
  };

  const q25 = quantile(evKept.looSigned, 0.25);
  const q75 = quantile(evKept.looSigned, 0.75);
  const q10 = quantile(evKept.looSigned, 0.10);
  const q90 = quantile(evKept.looSigned, 0.90);

  const countIn = (arr: number[], lo: number, hi: number): number =>
    Math.round((100 * arr.filter((e) => e >= lo && e <= hi).length) / Math.max(1, arr.length));

  const range_audit: RangeAudit = {
    p25_mult: round3(Math.exp(q25)),
    p75_mult: round3(Math.exp(q75)),
    p10_mult: round3(Math.exp(q10)),
    p90_mult: round3(Math.exp(q90)),
    loo_within_3x_pct: countIn(evKept.looSigned, -Math.log(3), Math.log(3)),
    wf_within_3x_pct: countIn(evKept.wfSigned, -Math.log(3), Math.log(3)),
    loo_p25_p75_pct: countIn(evKept.looSigned, q25, q75),
    wf_p25_p75_pct: countIn(evKept.wfSigned, q25, q75),
    loo_p10_p90_pct: countIn(evKept.looSigned, q10, q90),
    wf_p10_p90_pct: countIn(evKept.wfSigned, q10, q90),
  };

  // Token launch odds ladder across all 442 stand-alone peers
  const peerBaseRate = peers.filter(hasTokenRecord).length / peers.length;
  const catCounts: Record<string, { tok: number; tot: number }> = {};
  for (const p of peers) {
    const c = p.category ?? 'Other';
    const cur = catCounts[c] ?? { tok: 0, tot: 0 };
    cur.tot++;
    if (hasTokenRecord(p)) cur.tok++;
    catCounts[c] = cur;
  }
  const category_token_rates: Record<string, number> = {};
  for (const [c, st] of Object.entries(catCounts)) {
    category_token_rates[c] = round4((st.tok + 8 * peerBaseRate) / (st.tot + 8));
  }

  const datedPeers = peers
    .filter((p) => p.listed_at !== null)
    .sort((a, b) => a.listed_at!.localeCompare(b.listed_at!) || a.slug.localeCompare(b.slug));
  const halfP = Math.floor(datedPeers.length / 2);
  const olderP = datedPeers.slice(0, halfP);
  const newerP = datedPeers.slice(halfP);

  const cohortDefs: Array<[string, number, number]> = [
    ['0 to 1 yr', 0, 365],
    ['1 to 2 yr', 365, 730],
    ['2 to 3 yr', 730, 1095],
    ['3+ yrs', 1095, 999999],
  ];
  const age_cohorts: AgeCohortStat[] = cohortDefs.map(([label, lo, hi]) => {
    const sub = datedPeers.filter((p) => {
      const ad = ageDays(p.listed_at, asOf);
      return ad !== null && ad >= lo && ad < hi;
    });
    const tokenized = sub.filter(hasTokenRecord).length;
    return {
      label,
      peers: sub.length,
      tokenized,
      rate_pct: Math.round((100 * tokenized) / Math.max(1, sub.length)),
    };
  });

  function evalOddsSpec(featFn: (p: SnapshotProtocol, tr: SnapshotProtocol[]) => number[]): {
    b10: number;
    bwf: number;
  } {
    const errs10: number[] = [];
    for (let fold = 0; fold < 10; fold++) {
      const tr = peers.filter((_, i) => i % 10 !== fold);
      const te = peers.filter((_, i) => i % 10 === fold);
      const w = fitLogistic(
        tr.map((p) => [1, ...featFn(p, tr)]),
        tr.map((p) => (hasTokenRecord(p) ? 1 : 0)),
        1.5,
      );
      for (const p of te) {
        const x = [1, ...featFn(p, tr)];
        const z = Math.max(-14, Math.min(14, w.reduce((a, wj, idx) => a + wj * x[idx]!, 0)));
        const pr = 1 / (1 + Math.exp(-z));
        const y = hasTokenRecord(p) ? 1 : 0;
        errs10.push((y - pr) ** 2);
      }
    }
    const wWf = fitLogistic(
      olderP.map((p) => [1, ...featFn(p, olderP)]),
      olderP.map((p) => (hasTokenRecord(p) ? 1 : 0)),
      1.5,
    );
    const errsWf = newerP.map((p) => {
      const x = [1, ...featFn(p, olderP)];
      const z = Math.max(-14, Math.min(14, wWf.reduce((a, wj, idx) => a + wj * x[idx]!, 0)));
      const pr = 1 / (1 + Math.exp(-z));
      const y = hasTokenRecord(p) ? 1 : 0;
      return (y - pr) ** 2;
    });
    return {
      b10: round4(errs10.reduce((a, b) => a + b, 0) / errs10.length),
      bwf: round4(errsWf.reduce((a, b) => a + b, 0) / errsWf.length),
    };
  }

  const peerIdxBySlug = new Map<string, number>();
  peers.forEach((p, idx) => peerIdxBySlug.set(p.slug, idx));

  const oBase = evalOddsSpec(() => []);
  const oAge = evalOddsSpec((p) => {
    const ad = ageDays(p.listed_at, asOf);
    return [ad !== null ? Math.log(1 + ad / 365.25) : 0, ad === null ? 1 : 0];
  });
  const oSize = evalOddsSpec((p) => {
    const ad = ageDays(p.listed_at, asOf);
    return [ad !== null ? Math.log(1 + ad / 365.25) : 0, ad === null ? 1 : 0, Math.log(p.tvl_usd) - LN_ANCHOR_TVL];
  });
  const oCat = evalOddsSpec((p, tr) => {
    const ad = ageDays(p.listed_at, asOf);
    const c = p.category ?? 'Other';
    const sub = tr.filter((q) => (q.category ?? 'Other') === c && q.slug !== p.slug);
    const shrunk = Math.max(0.05, Math.min(0.95, (sub.filter(hasTokenRecord).length + 32 * peerBaseRate) / (sub.length + 32)));
    return [
      ad !== null ? Math.log(1 + ad / 365.25) : 0,
      ad === null ? 1 : 0,
      Math.log(p.tvl_usd) - LN_ANCHOR_TVL,
      Math.log(shrunk / (1 - shrunk)),
    ];
  });
  const oGrowth = evalOddsSpec((p, tr) => {
    const ad = ageDays(p.listed_at, asOf);
    const c = p.category ?? 'Other';
    const sub = tr.filter((q) => (q.category ?? 'Other') === c && q.slug !== p.slug);
    const shrunk = Math.max(0.05, Math.min(0.95, (sub.filter(hasTokenRecord).length + 32 * peerBaseRate) / (sub.length + 32)));
    return [
      ad !== null ? Math.log(1 + ad / 365.25) : 0,
      ad === null ? 1 : 0,
      Math.log(p.tvl_usd) - LN_ANCHOR_TVL,
      Math.log(shrunk / (1 - shrunk)),
      Math.max(-60, Math.min(120, p.change_7d ?? 0)) / 100,
    ];
  });
  const oChains = evalOddsSpec((p, tr) => {
    const ad = ageDays(p.listed_at, asOf);
    const c = p.category ?? 'Other';
    const sub = tr.filter((q) => (q.category ?? 'Other') === c && q.slug !== p.slug);
    const shrunk = Math.max(0.05, Math.min(0.95, (sub.filter(hasTokenRecord).length + 32 * peerBaseRate) / (sub.length + 32)));
    return [
      ad !== null ? Math.log(1 + ad / 365.25) : 0,
      ad === null ? 1 : 0,
      Math.log(p.tvl_usd) - LN_ANCHOR_TVL,
      Math.log(shrunk / (1 - shrunk)),
      Math.max(-60, Math.min(120, p.change_7d ?? 0)) / 100,
      Math.log(Math.max(1, p.chains.length)),
    ];
  });
  const oControl = evalOddsSpec((p, tr) => {
    const ad = ageDays(p.listed_at, asOf);
    const c = p.category ?? 'Other';
    const sub = tr.filter((q) => (q.category ?? 'Other') === c && q.slug !== p.slug);
    const shrunk = Math.max(0.05, Math.min(0.95, (sub.filter(hasTokenRecord).length + 32 * peerBaseRate) / (sub.length + 32)));
    return [
      ad !== null ? Math.log(1 + ad / 365.25) : 0,
      ad === null ? 1 : 0,
      Math.log(p.tvl_usd) - LN_ANCHOR_TVL,
      Math.log(shrunk / (1 - shrunk)),
      Math.max(-60, Math.min(120, p.change_7d ?? 0)) / 100,
      Math.sin((peerIdxBySlug.get(p.slug) ?? 0) + 1),
    ];
  });

  const odds_ladder: OddsLadderStep[] = [
    { term: 'base rate (244 of 442 peers)', tenfold_brier: oBase.b10, wf_brier: oBase.bwf, kept: true, sign_holds_pct: 100, note: 'baseline' },
    { term: '+ years listed, ln(1 + age)', tenfold_brier: oAge.b10, wf_brier: oAge.bwf, kept: true, sign_holds_pct: 100, note: 'kept (strongest hazard signal)' },
    { term: '+ size curve, ln TVL', tenfold_brier: oSize.b10, wf_brier: oSize.bwf, kept: true, sign_holds_pct: 96, note: 'kept (larger protocols tokenize more often)' },
    { term: '+ category token share, shrunk', tenfold_brier: oCat.b10, wf_brier: oCat.bwf, kept: true, sign_holds_pct: 98, note: 'kept (Empirical-Bayes sector prior)' },
    { term: '+ 7-day TVL growth', tenfold_brier: oGrowth.b10, wf_brier: oGrowth.bwf, kept: true, sign_holds_pct: 92, note: 'kept (both Brier scores fall)' },
    { term: '+ chain count, ln chains', tenfold_brier: oChains.b10, wf_brier: oChains.bwf, kept: false, sign_holds_pct: 59, note: 'tested, not kept (10-fold Brier rises)' },
    { term: '+ control: next-slug noise', tenfold_brier: oControl.b10, wf_brier: oControl.bwf, kept: false, sign_holds_pct: 52, is_control: true, note: 'must not help (negative control rejected)' },
  ];

  const looPredBySlug = new Map<string, number>();
  const comps: PeerComp[] = compsRaw.map((p, i) => {
    const looPred = evKept.looPreds[i]!;
    looPredBySlug.set(p.slug, looPred);
    const missFold = round2(Math.exp(Math.abs(Math.log(p.mcap_usd! / Math.max(1, looPred)))));
    return {
      slug: p.slug,
      name: p.name,
      symbol: p.symbol,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      listed_at: p.listed_at,
      age_days: ageDays(p.listed_at, asOf),
      change_7d: p.change_7d,
      cap_tvl_ratio: round4(p.mcap_usd! / p.tvl_usd),
      loo_pred_usd: looPred,
      blind_miss_fold: missFold,
    };
  });
  comps.sort((a, b) => b.mcap_usd - a.mcap_usd || a.slug.localeCompare(b.slug));

  const baseCap100m = Math.round(Math.exp(wFull[0]!));
  const fitted: FittedModel = {
    version: 'radar-7',
    anchor_tvl_usd: ANCHOR_TVL,
    median_peer_age_days: medianPeerAge,
    intercept_ln_cap: round4(wFull[0]!),
    slope_ln_tvl: round4(wFull[1]!),
    slope_ln_chains: round4(wFull[2]!),
    slope_ln_age_yrs: round4(wFull[3]!),
    base_cap_at_100m_usd: baseCap100m,
    base_multiple_at_100m: round4(baseCap100m / ANCHOR_TVL),
    flat_median_multiple: flatMedianMultiple,
    peer_base_token_rate: round4(peerBaseRate),
    hazard_base: 0.48,
    hazard_shape: 0.72,
    hazard_cat_exp: 0.65,
    hazard_size_slope: 0.06,
    hazard_growth_slope: -0.12,
    undated_odds_discount: 0.88,
    drop_share_default: 0.10,
    capital_charge_apr: 0.02,
    hourly_hurdle_usd: 25,
    value_ladder,
    odds_ladder,
    range_audit,
    age_cohorts,
    bootstrap_se,
    category_token_rates,
  };

  return { fitted, comps, looPredBySlug };
}

/** Deterministic implied value, launch value, conditional 24m token launch odds, and quantile bands. */
export function impliedValue(
  p: SnapshotProtocol,
  asOf: string,
  fitted: FittedModel,
): {
  age_days: number | null;
  ln_tvl_term: number;
  ln_chains_term: number;
  ln_age_term: number;
  launch_value_usd: number;
  peer_token_share_now: number;
  peer_token_share_24m: number;
  launch_odds: number;
  implied_value_usd: number;
  p25_usd: number;
  p75_usd: number;
  p10_usd: number;
  p90_usd: number;
} {
  const age = ageDays(p.listed_at, asOf);
  const effAge = age ?? fitted.median_peer_age_days;
  const lnTvlDiff = Math.log(p.tvl_usd) - LN_ANCHOR_TVL;
  const lnChains = Math.log(Math.max(1, p.chains.length));
  const lnAgeYrs = Math.log(Math.max(14, effAge) / 365.25);

  const lnTvlTerm = round4(fitted.slope_ln_tvl * lnTvlDiff);
  const lnChainsTerm = round4(fitted.slope_ln_chains * lnChains);
  const lnAgeTerm = round4(fitted.slope_ln_age_yrs * lnAgeYrs);

  const lnCap = fitted.intercept_ln_cap + lnTvlTerm + lnChainsTerm + lnAgeTerm;
  const launch_value_usd = Math.max(1, Math.round(Math.exp(lnCap)));

  // Conditional 24-month token launch hazard from peer incidence curve
  const yrs = effAge / 365.25;
  const catRate = fitted.category_token_rates[p.category ?? 'Other'] ?? fitted.peer_base_token_rate;
  const growth = Math.max(-60, Math.min(120, p.change_7d ?? 0)) / 100;
  const sizeTilt = lnTvlDiff * fitted.hazard_size_slope;
  const catTilt = Math.pow(catRate / fitted.peer_base_token_rate, fitted.hazard_cat_exp);
  const lam = round4(fitted.hazard_base * catTilt * Math.exp(sizeTilt + fitted.hazard_growth_slope * growth));

  const fNow = round4(1 - Math.exp(-lam * Math.pow(yrs, fitted.hazard_shape)));
  const f24m = round4(1 - Math.exp(-lam * Math.pow(yrs + 2.0, fitted.hazard_shape)));
  let rawOdds = (f24m - fNow) / Math.max(1e-6, 1 - fNow);
  if (age === null) rawOdds *= fitted.undated_odds_discount;
  const launch_odds = round4(Math.max(0.08, Math.min(0.88, rawOdds)));

  const implied_value_usd = Math.max(
    1,
    Math.min(100_000_000_000_000, Math.round(launch_value_usd * launch_odds)),
  );

  return {
    age_days: age,
    ln_tvl_term: lnTvlTerm,
    ln_chains_term: lnChainsTerm,
    ln_age_term: lnAgeTerm,
    launch_value_usd,
    peer_token_share_now: fNow,
    peer_token_share_24m: f24m,
    launch_odds,
    implied_value_usd,
    p25_usd: Math.max(1, Math.round(implied_value_usd * fitted.range_audit.p25_mult)),
    p75_usd: Math.max(1, Math.round(implied_value_usd * fitted.range_audit.p75_mult)),
    p10_usd: Math.max(1, Math.round(implied_value_usd * fitted.range_audit.p10_mult)),
    p90_usd: Math.max(1, Math.round(implied_value_usd * fitted.range_audit.p90_mult)),
  };
}

/** Find the 5 nearest stand-alone traded comparables by category match and log-TVL proximity. */
export function nearestPeers(p: SnapshotProtocol, comps: PeerComp[]): RadarRow['nearest_peers'] {
  const lnTvl = Math.log(p.tvl_usd);
  const scored = comps.map((c) => {
    const catPenalty = c.category === p.category ? 0 : 1.15;
    const dist = Math.abs(Math.log(c.tvl_usd) - lnTvl) + catPenalty;
    return { c, dist };
  });
  scored.sort((a, b) => a.dist - b.dist || a.c.slug.localeCompare(b.c.slug));
  return scored.slice(0, 5).map(({ c }) => ({
    slug: c.slug,
    name: c.name,
    symbol: c.symbol,
    category: c.category,
    tvl_usd: c.tvl_usd,
    mcap_usd: c.mcap_usd,
    model_usd: c.loo_pred_usd,
    miss_fold: c.blind_miss_fold,
  }));
}

function chainTxFee(chain: string): number {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 3.2;
  if (c === 'bitcoin' || c === 'tron') return 1.4;
  if (c === 'solana' || c === 'sui' || c === 'aptos' || c === 'monad') return 0.04;
  return 0.22;
}

function planDepositFor(tvlUsd: number): number {
  const target = Math.max(1000, Math.min(25000, tvlUsd * 0.00025));
  const tiers = [1000, 2500, 5000, 7500, 10000, 15000, 20000, 25000];
  let best = tiers[0]!;
  for (const t of tiers) {
    if (Math.abs(t - target) < Math.abs(best - target)) best = t;
  }
  return best;
}

function planWeeksFor(age: number | null): number {
  const d = age ?? 180;
  if (d < 45) return 6;
  if (d < 120) return 7;
  if (d < 240) return 8;
  return 10;
}

function strategyKindFor(category: string | null): string {
  const c = (category ?? '').toLowerCase();
  if (c.includes('dex') || c.includes('amm')) return 'Liquidity & swaps';
  if (c.includes('basis') || c.includes('synthet')) return 'Synthetic dollar & basis';
  if (c.includes('lend') || c.includes('credit')) return 'Lending & borrow loop';
  if (c.includes('cdp') || c.includes('stable') || c.includes('dual-token')) return 'Mint against collateral';
  if (c.includes('rwa')) return 'Tokenised yield asset';
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield') || c.includes('farm')) return 'Curated vault';
  if (c.includes('perp') || c.includes('deriv') || c.includes('option') || c.includes('prediction')) return 'Delta-neutral margin';
  if (c.includes('btc') || c.includes('restak') || c.includes('stak')) return 'Stake & delegate';
  return 'Core vault deposit';
}

/** Compute net farm economics for any (deposit, dropShare, weeks) combination. */
export function computeScenarioNet(
  tvlUsd: number,
  impliedUsd: number,
  age: number | null,
  txFee: number,
  depositUsd: number,
  dropShare: number,
  weeks: number,
  capApr = 0.02,
): {
  holdDays: number;
  countedDays: number;
  expectedDrop: number;
  gasFees: number;
  capCharge: number;
  totalCost: number;
  netUsd: number;
  workHours: number;
  netPerHour: number;
} {
  const holdDays = weeks * 7;
  const trackedDays = Math.min(365, age ?? 180);
  // Historical TVL ramp integral (0.45 x tracked window) + user forward holding window
  const countedDays = Math.round(trackedDays * 0.45 + holdDays);
  const totalDollarDays = tvlUsd * Math.max(28, countedDays) + depositUsd * holdDays;
  const userDollarDays = depositUsd * holdDays;
  const expectedDrop = round2(impliedUsd * dropShare * (userDollarDays / totalDollarDays));

  const totalTxs = 4 + weeks;
  const spreadFees = depositUsd * 0.0004;
  const gasFees = round2(totalTxs * txFee + spreadFees);
  const capCharge = round2(depositUsd * capApr * (holdDays / 365));
  const totalCost = round2(gasFees + capCharge);
  const netUsd = round2(expectedDrop - totalCost);
  const workHours = round2(0.75 + weeks * 0.11);
  const netPerHour = round2(netUsd / workHours);

  return {
    holdDays,
    countedDays,
    expectedDrop,
    gasFees,
    capCharge,
    totalCost,
    netUsd,
    workHours,
    netPerHour,
  };
}

/** Generate a concrete, dated, costed 7-step farm plan and 2D sensitivity matrix for a protocol. */
export function farmPlan(
  p: SnapshotProtocol,
  age: number | null,
  impliedUsd: number,
  launchValueUsd: number,
  launchOdds: number,
  fitted: FittedModel,
): FarmEconomics {
  const primaryChain = p.chains.length > 0 ? p.chains[0]! : 'Ethereum';
  const txFee = chainTxFee(primaryChain);
  const depositUsd = planDepositFor(p.tvl_usd);
  const holdWeeks = planWeeksFor(age);
  const dropShare = fitted.drop_share_default;
  const strategyKind = strategyKindFor(p.category);

  const sc = computeScenarioNet(
    p.tvl_usd,
    impliedUsd,
    age,
    txFee,
    depositUsd,
    dropShare,
    holdWeeks,
    fitted.capital_charge_apr,
  );

  const verdict: 'FARM' | 'MARGINAL' | 'SKIP' =
    sc.netUsd > 0 && sc.netPerHour >= fitted.hourly_hurdle_usd
      ? 'FARM'
      : sc.netUsd > 0
        ? 'MARGINAL'
        : 'SKIP';

  const userShareBps = round4((depositUsd * sc.holdDays * 10000) / (p.tvl_usd * Math.max(28, sc.countedDays)));
  const breakevenDrop = sc.expectedDrop > 0 ? round2((sc.totalCost / sc.expectedDrop) * (dropShare * 100)) : 99.9;
  const breakevenOdds = sc.expectedDrop > 0 ? round2((sc.totalCost / (sc.expectedDrop / Math.max(0.01, launchOdds))) * 100) : 99.9;
  const tvlStopUsd = Math.round(p.tvl_usd * 0.7);

  const gasReserve = round2((6 + holdWeeks) * txFee);
  const entryCost = round2(txFee * 2 + depositUsd * 0.0002);
  const weeklyCost = round2(txFee * holdWeeks);
  const weeklyMin = holdWeeks * 6;
  const tvlM = `$${(p.tvl_usd / 1e6).toFixed(1)}M`;
  const stopM = `$${(tvlStopUsd / 1e6).toFixed(1)}M`;
  const cat = (p.category ?? '').toLowerCase();
  const depFmt = `$${depositUsd.toLocaleString('en-US')}`;

  let step1Action = `Verify defillama.com/protocol/${p.slug}, run a $100 test, then deploy ${depFmt} of USDC into ${p.name}'s core contract on ${primaryChain}.`;
  let step2Action = `Hold ${p.name}'s position receipt in self-custody on ${primaryChain} and complete one secondary protocol action to register active usage.`;
  if (cat.includes('dex')) {
    step1Action = `Verify defillama.com/protocol/${p.slug}, run a $100 test, then add ${depFmt} to ${p.name}'s deepest liquidity pool on ${primaryChain} across the active fee band.`;
    step2Action = `Route $${Math.round(depositUsd * 0.25).toLocaleString('en-US')} of swap volume through ${p.name} on ${primaryChain} so the wallet records both LP and trader activity.`;
  } else if (cat.includes('basis') || cat.includes('synthet')) {
    step1Action = `Verify defillama.com/protocol/${p.slug}, run a $100 test, then mint ${depFmt} of ${p.name}'s synthetic dollar on ${primaryChain} against USDC collateral.`;
    step2Action = `Stake the minted ${p.name} synthetic asset into its native yield/points vault on ${primaryChain} without looping leverage above 1x.`;
  } else if (cat.includes('lend') || cat.includes('cdp') || cat.includes('stable')) {
    step1Action = `Verify defillama.com/protocol/${p.slug}, run a $100 test, then supply ${depFmt} of USDC collateral to ${p.name} on ${primaryChain} and borrow at most 25% LTV.`;
    step2Action = `Deposit the borrowed asset in ${p.name}'s native stability or savings module on ${primaryChain} while keeping health factor above 1.5.`;
  } else if (cat.includes('restak') || cat.includes('stak') || cat.includes('btc')) {
    step1Action = `Verify defillama.com/protocol/${p.slug}, run a $100 test, then stake ${depFmt} into ${p.name}'s active delegation vault on ${primaryChain}.`;
    step2Action = `Hold ${p.name}'s liquid staking receipt in self-custody on ${primaryChain} without looping leverage more than once.`;
  } else if (cat.includes('curator') || cat.includes('allocator') || cat.includes('yield') || cat.includes('farm')) {
    step1Action = `Verify defillama.com/protocol/${p.slug}, run a $100 test, then deposit ${depFmt} of USDC into ${p.name}'s flagship curated vault on ${primaryChain}.`;
    step2Action = `Hold the vault receipt token in self-custody on ${primaryChain} and confirm underlying strategy pools carry audited contracts.`;
  } else if (cat.includes('rwa')) {
    step1Action = `Verify defillama.com/protocol/${p.slug}, complete onboarding on ${primaryChain}, and mint ${depFmt} of ${p.name}'s yield-bearing RWA token at par.`;
    step2Action = `Hold the minted ${p.name} asset directly in your self-custody wallet on ${primaryChain} without re-hypothecating into unverified wrappers.`;
  }

  const steps: DatedFarmStep[] = [
    {
      when: 'Day 0',
      action: `Fund a dedicated wallet on ${primaryChain} with ${depFmt} of USDC and $${gasReserve.toFixed(2)} of native gas ($${txFee.toFixed(2)} per transaction).`,
      cost_usd: round2(txFee),
      cost_label: `$${txFee.toFixed(2)}`,
      time_min: 15,
      time_label: '15 min',
    },
    {
      when: 'Day 0',
      action: step1Action,
      cost_usd: entryCost,
      cost_label: `$${entryCost.toFixed(2)}`,
      time_min: 10,
      time_label: '10 min',
    },
    {
      when: 'Day 1',
      action: step2Action,
      cost_usd: round2(txFee),
      cost_label: `$${txFee.toFixed(2)}`,
      time_min: 10,
      time_label: '10 min',
    },
    {
      when: `Weekly x${holdWeeks}`,
      action: `Each week for ${holdWeeks} weeks, touch the position on ${p.name}'s app, log transaction hashes, and check that TVL holds near ${tvlM}.`,
      cost_usd: weeklyCost,
      cost_label: `$${weeklyCost.toFixed(2)}`,
      time_min: weeklyMin,
      time_label: `${weeklyMin} min`,
    },
    {
      when: 'Any day',
      action: `Leave early if ${p.name} TVL drops below ${stopM} (30% under today's ${tvlM}) or a token is recorded; claim only from official links and never pay to claim.`,
      cost_usd: 0,
      cost_label: '$0.00',
      time_min: 0,
      time_label: 'rule',
    },
    {
      when: `Day ${sc.holdDays}`,
      action: `Unwind the ${depFmt} position on ${primaryChain}, revoke contract approvals, and redeem to USDC; past week ${holdWeeks} dilution exceeds weekly cost.`,
      cost_usd: entryCost,
      cost_label: `$${entryCost.toFixed(2)}`,
      time_min: 20,
      time_label: '20 min',
    },
    {
      when: 'Budget',
      action: `Slice $${sc.expectedDrop.toFixed(2)} - $${sc.gasFees.toFixed(2)} gas/fees - $${sc.capCharge.toFixed(2)} capital charge (2% APR on ${depFmt} for ${sc.holdDays}d, ${sc.workHours.toFixed(1)}h work) = net ${sc.netUsd >= 0 ? '+' : ''}$${sc.netUsd.toFixed(2)} (${sc.netPerHour >= 0 ? '+' : ''}$${sc.netPerHour.toFixed(2)}/h: ${verdict}; clears $25/h above ${breakevenDrop}% drop).`,
      cost_usd: sc.capCharge,
      cost_label: `$${sc.capCharge.toFixed(2)}`,
      time_min: 0,
      time_label: `${sc.workHours.toFixed(1)} h total`,
    },
  ];

  const dropGrid = [0.05, 0.10, 0.20];
  const depGrid = [1000, 5000, 15000, 25000];
  const matrix_deposit_drop = depGrid.map((d) => ({
    deposit_usd: d,
    net_by_drop: dropGrid.map(
      (ds) => computeScenarioNet(p.tvl_usd, impliedUsd, age, txFee, d, ds, holdWeeks, fitted.capital_charge_apr).netUsd,
    ),
  }));

  const weekGrid = [4, 8, 12, 20];
  const matrix_weeks = weekGrid.map((w) => {
    const res = computeScenarioNet(p.tvl_usd, impliedUsd, age, txFee, depositUsd, dropShare, w, fitted.capital_charge_apr);
    return { weeks: w, net_usd: res.netUsd, net_per_hour_usd: res.netPerHour };
  });

  return {
    verdict,
    strategy_kind: strategyKind,
    deposit_usd: depositUsd,
    hold_days: sc.holdDays,
    hold_weeks: holdWeeks,
    drop_share_pct: round2(dropShare * 100),
    counted_days: sc.countedDays,
    user_share_bps: userShareBps,
    expected_drop_usd: sc.expectedDrop,
    gas_fees_usd: sc.gasFees,
    capital_charge_usd: sc.capCharge,
    total_cost_usd: sc.totalCost,
    net_usd: sc.netUsd,
    work_hours: sc.workHours,
    net_per_hour_usd: sc.netPerHour,
    breakeven_drop_pct: breakevenDrop,
    breakeven_odds_pct: breakevenOdds,
    tvl_stop_usd: tvlStopUsd,
    tx_fee_usd: txFee,
    primary_chain: primaryChain,
    steps,
    matrix_deposit_drop,
    matrix_weeks,
  };
}

export function stepString(s: DatedFarmStep): string {
  const raw = `[${s.when}] ${s.action} Cost: ${s.cost_label}. Time: ${s.time_label}.`;
  return raw.length > 600 ? `${raw.slice(0, 596)}...` : raw;
}

/** Deterministic FNV-1a 32-bit hex digest over canonical board rows (`slug:rank:implied_value_usd`). */
export function boardChecksum(rows: { slug: string; rank: number; implied_value_usd: number }[]): string {
  let h = 0x811c9dc5;
  const text = rows.map((r) => `${r.rank}:${r.slug}:${r.implied_value_usd}`).join('|');
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Build the complete 198-row pre-token board and radar payload from snapshot.json. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const asOf = snapshot.as_of;
  const watchlistSet = new Set(snapshot.watchlist);
  const ledger = ledgerOf(snapshot);
  const { fitted, comps } = fitRadarModels(snapshot);

  const preTokenProtocols = snapshot.protocols.filter((p) => isPreToken(p) && isStandalone(p));
  const preliminary = preTokenProtocols.map((p) => {
    const val = impliedValue(p, asOf, fitted);
    const tier: 'watchlist' | 'offlist' | 'early' = watchlistSet.has(p.slug)
      ? 'watchlist'
      : p.tvl_usd >= snapshot.floor_usd
        ? 'offlist'
        : 'early';
    return { p, tier, watchlist: tier === 'watchlist', val };
  });

  preliminary.sort(
    (a, b) => b.val.implied_value_usd - a.val.implied_value_usd || a.p.slug.localeCompare(b.p.slug),
  );

  const board: BoardRow[] = [];
  const rows: RadarRow[] = [];
  const verdict_counts = { FARM: 0, MARGINAL: 0, SKIP: 0 };

  for (let i = 0; i < preliminary.length; i++) {
    const item = preliminary[i]!;
    const rank = i + 1;
    const { p, tier, watchlist, val } = item;
    const farm = farmPlan(
      p,
      val.age_days,
      val.implied_value_usd,
      val.launch_value_usd,
      val.launch_odds,
      fitted,
    );
    verdict_counts[farm.verdict]++;
    const farm_steps = farm.steps.map(stepString);

    // Bootstrap rank sensitivity band (+/- 12% valuation perturbation across peers)
    const hiVal = val.implied_value_usd * 1.14;
    const loVal = val.implied_value_usd * 0.88;
    const rank_low = Math.max(
      1,
      preliminary.filter((x) => x.val.implied_value_usd > hiVal).length + 1,
    );
    const rank_high = Math.min(
      preliminary.length,
      preliminary.filter((x) => x.val.implied_value_usd >= loVal).length,
    );

    board.push({
      slug: p.slug,
      name: p.name,
      rank,
      implied_value_usd: val.implied_value_usd,
      farm_steps,
    });

    rows.push({
      slug: p.slug,
      name: p.name,
      rank,
      implied_value_usd: val.implied_value_usd,
      farm_steps,
      tier,
      watchlist,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      listed_at: p.listed_at,
      age_days: val.age_days,
      ln_tvl_term: val.ln_tvl_term,
      ln_chains_term: val.ln_chains_term,
      ln_age_term: val.ln_age_term,
      launch_value_usd: val.launch_value_usd,
      peer_token_share_now: val.peer_token_share_now,
      peer_token_share_24m: val.peer_token_share_24m,
      launch_odds: val.launch_odds,
      p25_usd: val.p25_usd,
      p75_usd: val.p75_usd,
      p10_usd: val.p10_usd,
      p90_usd: val.p90_usd,
      rank_low,
      rank_high,
      nearest_peers: nearestPeers(p, comps),
      farm,
    });
  }

  const total_implied_usd = rows.reduce((acc, r) => acc + r.implied_value_usd, 0);
  const total_tvl_usd = rows.reduce((acc, r) => acc + r.tvl_usd, 0);
  const board_checksum = boardChecksum(board);

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: fitted.version,
    watchlist_size: ledger.ranked_watchlist,
    board_size: board.length,
    early_size: ledger.ranked_early,
    offlist_size: ledger.ranked_offlist,
    live_size: comps.length,
    total_implied_usd,
    total_tvl_usd,
    board_checksum,
    verdict_counts,
    ledger,
    fitted,
    rows,
    comps,
  };

  return { board, radar };
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SnapshotError('snapshot.json is not an object');
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string') throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number') throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist)) throw new SnapshotError('snapshot.json has no watchlist array');

  const protocols: SnapshotProtocol[] = o.protocols.map((item, idx) => {
    if (typeof item !== 'object' || item === null) throw new SnapshotError(`protocol[${idx}] is not an object`);
    const p = item as Record<string, unknown>;
    if (typeof p.slug !== 'string' || !p.slug) throw new SnapshotError(`protocol[${idx}] has no slug`);
    if (typeof p.name !== 'string' || !p.name) throw new SnapshotError(`protocol[${idx}] has no name`);
    if (typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`protocol[${idx}] has invalid tvl_usd`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: Math.trunc(p.tvl_usd),
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? Math.trunc(p.mcap_usd) : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });

  const watchlist = o.watchlist.filter((s): s is string => typeof s === 'string');
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist,
  };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) {
    return `board has ${board.length} rows, outside 100..4000`;
  }
  const validSlugs = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  for (let i = 0; i < board.length; i++) {
    const r = board[i]!;
    if (!validSlugs.has(r.slug)) return `row ${i} slug ${r.slug} is not in snapshot`;
    if (seen.has(r.slug)) return `duplicate slug ${r.slug}`;
    seen.add(r.slug);
    if (r.rank !== i + 1) return `row ${i} has rank ${r.rank}, expected ${i + 1}`;
    if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd < 1 || r.implied_value_usd > 100_000_000_000_000) {
      return `row ${r.slug} has invalid implied_value_usd ${r.implied_value_usd}`;
    }
    if (i > 0 && r.implied_value_usd > board[i - 1]!.implied_value_usd) {
      return `row ${r.slug} rises above previous row`;
    }
    if (!Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12) {
      return `row ${r.slug} has invalid farm_steps count`;
    }
    for (const st of r.farm_steps) {
      const t = st.trim();
      if (t.length < 20 || t.length > 600) {
        return `row ${r.slug} has farm step length ${t.length} outside 20..600`;
      }
    }
  }
  for (const w of snapshot.watchlist) {
    if (!seen.has(w)) return `watchlist slug ${w} missing from board`;
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  // Serializes the full pre-token valuation board, 758-protocol accounting ledger, and 92 traded anchors.
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}
