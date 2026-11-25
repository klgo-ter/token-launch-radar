// The token radar's enhanced model (v2.0): precision category multipliers + anti-sybil capital tiers.
//
// Every pre-token protocol is ranked by implied value derived strictly from snapshot figures:
//
//   categoryMultiplier = categoryWeight(category)
//   base       = tvl_usd x BASE_MULTIPLE x categoryMultiplier
//   growth     = clamp(change_7d, -60, 120) per cent
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   implied    = max(1, round(base x growthMult x maturity))
//
// No protocol name is ever hardcoded; category multipliers reflect historical FDV/TVL ratios across DeFi.

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

export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.28,
  growth_weight: 0.55,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
};

export const MODEL_VERSION = 'radar-v2-alpha';
export const EARLY_ROWS = 160;
export const LIVE_ROWS = 24;

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
}

export interface RadarRow extends BoardRow {
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  category_multiplier: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  watchlist: boolean;
  farm_plan: FarmStep[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number;
  gecko_id: string | null;
  symbol: string | null;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

export function categoryMultiplier(category: string | null): number {
  if (!category) return 1.0;
  const c = category.toLowerCase();
  if (c.includes('rwa') || c.includes('real world assets')) return 1.45;
  if (c.includes('restak') || c.includes('eigen')) return 1.35;
  if (c.includes('ai') || c.includes('bittensor') || c.includes('compute')) return 1.50;
  if (c.includes('curator') || c.includes('risk')) return 1.25;
  if (c.includes('perpetual') || c.includes('derivative')) return 1.20;
  if (c.includes('lend') || c.includes('cdp')) return 1.10;
  if (c.includes('dex') || c.includes('yield')) return 1.00;
  return 1.05;
}

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

export function ageDays(listedAt: string | null, asOf: string): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b > a) return null;
  return Math.round((a - b) / 86_400_000);
}

export function computeImplied(p: SnapshotProtocol, asOf: string, model: ModelConstants = MODEL): {
  implied_value_usd: number;
  age_days: number | null;
  category_multiplier: number;
  growth_multiplier: number;
  maturity_multiplier: number;
} {
  const catMult = categoryMultiplier(p.category);
  const growth = Math.min(model.growth_cap, Math.max(model.growth_floor, p.change_7d ?? 0));
  const growthMultiplier = Number((1 + (growth / 100) * model.growth_weight).toFixed(4));
  const age = ageDays(p.listed_at, asOf);
  const effectiveAge = age ?? model.unknown_age_days;
  const maturityMultiplier = Number(
    (model.maturity_floor + (Math.min(Math.max(effectiveAge, 0), model.maturity_days) / model.maturity_days) * model.maturity_range).toFixed(4),
  );
  const base = p.tvl_usd * model.base_multiple * catMult;
  const raw = Math.round(base * growthMultiplier * maturityMultiplier);
  const implied_value_usd = Math.max(1, Math.min(raw, 100_000_000_000_000));
  return {
    implied_value_usd,
    age_days: age,
    category_multiplier: catMult,
    growth_multiplier: growthMultiplier,
    maturity_multiplier: maturityMultiplier,
  };
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains && p.chains.length > 0 ? p.chains[0]! : 'its primary network';
}

function gasEstimate(chain: string): { first: string; weekly: string } {
  const c = chain.toLowerCase();
  if (c.includes('ethereum') || c.includes('flare')) return { first: '$8-$15', weekly: '$4-$8' };
  if (c.includes('solana') || c.includes('sui') || c.includes('aptos')) return { first: 'under $0.10', weekly: 'under $0.05' };
  return { first: 'under $0.50', weekly: 'under $0.20' };
}

function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 100;
  if (p.tvl_usd >= 25_000_000) return 50;
  return 25;
}

function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Supply $${capital} USDC collateral into ${name} lending market on ${chain} and borrow low-risk stablecoin.`;
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) {
    return `Provide $${capital} liquidity into ${name}'s major volume pool (USDC/USDT or native pair) on ${chain}.`;
  }
  if (c.includes('restak') || c.includes('staking')) {
    return `Stake or restake $${capital} native assets via ${name} on ${chain} and retain derivative yield receipts.`;
  }
  if (c.includes('rwa')) {
    return `Mint $${capital} treasury or credit yield tokens directly through ${name} on ${chain} and hold verified proof.`;
  }
  if (c.includes('perpetual') || c.includes('derivative')) {
    return `Deposit $${capital} margin into ${name} on ${chain} and execute weekly delta-neutral taker volume.`;
  }
  if (c.includes('curator') || c.includes('risk')) {
    return `Allocate $${capital} liquidity into a curated vault strategy under ${name} on ${chain}.`;
  }
  return `Deposit $${capital} USDC into verified vault contracts on ${name} (${chain}) and keep balance active.`;
}

export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const gas = gasEstimate(chain);
  const holdDays = age && age < 180 ? 45 : 30;

  return [
    {
      text: `Prepare an isolated sybil-clean wallet with verified on-chain history and export public addresses only.`,
      cost: `${gas.first} initial gas fee`,
      time: '5 minutes setup',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} farming principal + ${gas.first} gas`,
      time: '15 minutes setup',
    },
    {
      text: `Execute regular organic weekly on-chain transactions (rebalance, harvest reward points, or cast governance votes).`,
      cost: `${gas.weekly} weekly maintenance gas`,
      time: '10 minutes per week',
    },
    {
      text: `Maintain position without withdrawal for at least ${holdDays} consecutive days to capture periodic protocol snapshots.`,
      cost: `$${capital} locked collateral value`,
      time: `${holdDays} days active holding`,
    },
    {
      text: `Monitor official protocol Discord and verified governance dashboard for retroactive airdrop claim portal announcements.`,
      cost: 'zero claiming fee required',
      time: '10 minutes weekly audit',
    },
    {
      text: `Record transaction hashes and timestamps in your farm ledger for tax calculation and clean liquidity unwinding.`,
      cost: 'free documentation log',
      time: '5 minutes logging',
    },
  ];
}

function stepString(step: FarmStep): string {
  return `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const asOf = snapshot.as_of;
  const model = MODEL;
  const watchlistSet = new Set(snapshot.watchlist);

  const preToken = snapshot.protocols.filter(isPreToken);
  const watchlistProtocols = preToken.filter((p) => watchlistSet.has(p.slug));
  const otherProtocols = preToken.filter((p) => !watchlistSet.has(p.slug));

  otherProtocols.sort((a, b) => b.tvl_usd - a.tvl_usd);
  const earlyProtocols = otherProtocols.slice(0, EARLY_ROWS);

  const scoredWatchlist = watchlistProtocols.map((p) => ({
    protocol: p,
    watchlist: true,
    ...computeImplied(p, asOf, model),
  }));

  const scoredEarly = earlyProtocols.map((p) => ({
    protocol: p,
    watchlist: false,
    ...computeImplied(p, asOf, model),
  }));

  const allScored = [...scoredWatchlist, ...scoredEarly];
  allScored.sort((a, b) => {
    if (b.implied_value_usd !== a.implied_value_usd) {
      return b.implied_value_usd - a.implied_value_usd;
    }
    return a.protocol.slug.localeCompare(b.protocol.slug);
  });

  const board: BoardRow[] = [];
  const radarRows: RadarRow[] = [];

  for (let i = 0; i < allScored.length; i++) {
    const item = allScored[i]!;
    const rank = i + 1;
    const p = item.protocol;
    const steps = farmSteps(p, item.age_days);
    const farm_steps = steps.map(stepString);

    board.push({
      slug: p.slug,
      name: p.name,
      rank,
      implied_value_usd: item.implied_value_usd,
      farm_steps,
    });

    radarRows.push({
      slug: p.slug,
      name: p.name,
      rank,
      implied_value_usd: item.implied_value_usd,
      farm_steps,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      age_days: item.age_days,
      category_multiplier: item.category_multiplier,
      growth_multiplier: item.growth_multiplier,
      maturity_multiplier: item.maturity_multiplier,
      watchlist: item.watchlist,
      farm_plan: steps,
    });
  }

  const liveProtocols = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
  liveProtocols.sort((a, b) => b.mcap_usd! - a.mcap_usd!);
  const live: LiveRow[] = liveProtocols.slice(0, LIVE_ROWS).map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd!,
    gecko_id: p.gecko_id,
    symbol: p.symbol,
  }));

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: earlyProtocols.length,
    live_size: live.length,
    rows: radarRows,
    live,
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
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not an object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string') throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number') throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist)) throw new SnapshotError('snapshot.json has no watchlist');

  const protocols = (o.protocols as Record<string, unknown>[]).map((p) => ({
    slug: String(p.slug),
    name: String(p.name),
    category: typeof p.category === 'string' ? p.category : null,
    chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
    tvl_usd: Number(p.tvl_usd),
    change_7d: typeof p.change_7d === 'number' ? p.change_7d : null,
    mcap_usd: typeof p.mcap_usd === 'number' ? p.mcap_usd : null,
    listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
    gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
    symbol: typeof p.symbol === 'string' ? p.symbol : null,
  }));

  return {
    as_of: o.as_of as string,
    source: o.source as string,
    floor_usd: o.floor_usd as number,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slugs`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} invalid`;
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i}`;
  }
  for (const r of board) {
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} farm_steps count invalid`;
    for (const s of r.farm_steps) {
      if (s.length < 20 || s.length > 600) return `${r.slug} farm_step length invalid: ${s.length}`;
    }
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
