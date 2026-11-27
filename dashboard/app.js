// Token Launch Radar (radar-7) — self-verifying browser valuation & farm-plan engine.
// Recomputes all 198 pre-token valuations, counterfactual scenarios and 7-step costed farm plans
// live from the sealed DefiLlama snapshot, checking 100% identity with board.json / main.ts.
(function () {
'use strict';
var D = window.RADAR; if (!D) return;
var LN100 = Math.log(1e8);
var S = { view: 'board', slug: null, expanded: null, verdict: 'ALL', tier: 'all', category: 'all',
 chain: 'all', q: '', dep: 'plan', drop: 0.10, hor: 'best', sort: 'rank', dir: 1,
 compact: false, cmpOpen: false, boxOpen: false, tvlX: 1, gOv: null, addM: 0, cmp: [] };

function r2(n) { return Math.round(n * 100) / 100; }
function r4(n) { return Math.round(n * 10000) / 10000; }
function usd(n) {
 if (n === null || n === undefined || !isFinite(n)) return 'n/a';
 var a = Math.abs(n), s = n < 0 ? '-' : '';
 if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(2) + 'B';
 if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(1) + 'M';
 if (a >= 1e3) return s + '$' + Math.round(a).toLocaleString('en-US');
 return s + '$' + a.toFixed(2);
}
function susd(n) {
 if (n === null || n === undefined || !isFinite(n)) return 'n/a';
 var p = n > 0 ? '+' : n < 0 ? '-' : '', a = Math.abs(n);
 return a >= 1000 ? p + '$' + Math.round(a).toLocaleString('en-US') : p + '$' + a.toFixed(2);
}
function pct(n, d) {
 if (n === null || n === undefined || !isFinite(n)) return 'n/a';
 return (n > 0 ? '+' : '') + n.toFixed(d === undefined ? 1 : d) + '%';
}
function age(d) {
 if (d === null || d === undefined) return 'undated*';
 return d >= 365 ? (d / 365.25).toFixed(1) + ' yr' : Math.max(1, Math.round(d)) + 'd';
}
function el(tag, at) {
 var n = document.createElement(tag);
 if (at) Object.keys(at).forEach(function (k) {
  if (k === 'class') n.className = at[k];
  else if (k === 'text') n.textContent = at[k];
  else if (k === 'html') n.innerHTML = at[k];
  else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), at[k]);
  else if (at[k] !== null && at[k] !== undefined) n.setAttribute(k, at[k]);
 });
 for (var i = 2; i < arguments.length; i++) {
  var c = arguments[i];
  if (c === null || c === undefined) continue;
  if (Array.isArray(c)) c.forEach(function (x) { if (x) n.appendChild(x); });
  else n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
 }
 return n;
}
function btn(txt, fn, cls, pressed) {
 return el('button', { class: cls || 'action-btn', type: 'button', text: txt, 'aria-pressed': pressed ? 'true' : 'false', onclick: fn });
}
function td(c, cls) { return el('td', { class: cls, text: c }); }

/** 1. Protocol Accounting — every snapshot protocol in exactly one group (198 + 416 + 144 = 758). */
function ledgerOf(d) {
 var L = d.ledger, tokOther = L.token_all_records - L.token_traded_comps;
 return { total: L.total_protocols, groups: [
  { label: 'Ranked · Watchlist (>= $50M)', count: L.ranked_watchlist, color: '#0d7455' },
  { label: 'Ranked · Off-list (>= $50M, parent recorded)', count: L.ranked_offlist, color: '#533eb0' },
  { label: 'Ranked · Early (< $50M)', count: L.ranked_early, color: '#c46810' },
  { label: 'Token trades · Priced comp', count: L.token_traded_comps, color: '#109868' },
  { label: 'Token recorded · No usable cap', count: tokOther, color: '#3b82f6' },
  { label: 'Out · Bridge', count: L.out_no_token_bridge, color: '#64748b' },
  { label: 'Out · Staked form', count: L.out_no_token_staking, color: '#788896' },
  { label: 'Out · Exchange', count: L.out_no_token_exchange, color: '#94a3b8' },
  { label: 'Out · Versioned/wrapped', count: L.out_no_token_versioned, color: '#b0bec9' } ] };
}

/** 2A. launchValue — log-linear cap from TVL size curve, chain count and years listed. */
function launchValue(row, f) {
 var eA = row.age_days === null || row.age_days === undefined ? f.median_peer_age_days : row.age_days;
 var lnT = Math.log(Math.max(1, row.tvl_usd)) - LN100;
 var tT = r4(f.slope_ln_tvl * lnT);
 var tC = r4(f.slope_ln_chains * Math.log(Math.max(1, (row.chains || []).length)));
 var tA = r4(f.slope_ln_age_yrs * Math.log(Math.max(14, eA) / 365.25));
 return { v: Math.max(1, Math.round(Math.exp(f.intercept_ln_cap + tT + tC + tA))), tT: tT, tC: tC, tA: tA };
}

/** 2B. launchOdds — conditional 24-month peer hazard from age, category rate, TVL, 7d growth. */
function launchOdds(row, f) {
 var eA = row.age_days === null || row.age_days === undefined ? f.median_peer_age_days : row.age_days;
 var yrs = eA / 365.25, lnT = Math.log(Math.max(1, row.tvl_usd)) - LN100;
 var cr = f.category_token_rates[row.category || 'Other'];
 if (cr === undefined) cr = f.peer_base_token_rate;
 var g = Math.max(-60, Math.min(120, row.change_7d === null ? 0 : row.change_7d)) / 100;
 var lam = r4(f.hazard_base * Math.pow(cr / f.peer_base_token_rate, f.hazard_cat_exp) *
  Math.exp(lnT * f.hazard_size_slope + f.hazard_growth_slope * g));
 var f0 = r4(1 - Math.exp(-lam * Math.pow(yrs, f.hazard_shape)));
 var f2 = r4(1 - Math.exp(-lam * Math.pow(yrs + 2, f.hazard_shape)));
 var o = (f2 - f0) / Math.max(1e-6, 1 - f0);
 if (row.age_days === null) o *= f.undated_odds_discount;
 return { o: r4(Math.max(0.08, Math.min(0.88, o))), f0: f0, f2: f2 };
}

/** 2C. impliedValue — launchValue × launchOdds, plus held-out quantile bands. */
function impliedValue(row, f) {
 var lv = launchValue(row, f), lo = launchOdds(row, f);
 var iv = Math.max(1, Math.min(1e14, Math.round(lv.v * lo.o)));
 return { launch_value_usd: lv.v, launch_odds: lo.o, implied_value_usd: iv,
  p25_usd: Math.max(1, Math.round(iv * f.range_audit.p25_mult)),
  p75_usd: Math.max(1, Math.round(iv * f.range_audit.p75_mult)),
  p10_usd: Math.max(1, Math.round(iv * f.range_audit.p10_mult)),
  p90_usd: Math.max(1, Math.round(iv * f.range_audit.p90_mult)),
  ln_tvl_term: lv.tT, ln_chains_term: lv.tC, ln_age_term: lv.tA, f_now: lo.f0, f_24m: lo.f2 };
}

/** 2D. counterfactuals — calls impliedValue() on mutated copies of the record. */
function counterfactuals(row, f) {
 var bA = row.age_days === null ? f.median_peer_age_days : row.age_days;
 var specs = [
  ['As recorded in snapshot', row],
  ['TVL 30% lower (stop-loss trigger)', Object.assign({}, row, { tvl_usd: Math.round(row.tvl_usd * 0.7) })],
  ['TVL 50% higher (inflow surge)', Object.assign({}, row, { tvl_usd: Math.round(row.tvl_usd * 1.5) })],
  ['7-day TVL growth +25% (momentum)', Object.assign({}, row, { change_7d: 25 })],
  ['Six more months, still no token (+182d)', Object.assign({}, row, { age_days: bA + 182 })]
 ];
 return specs.map(function (sp) {
  var r = impliedValue(sp[1], f);
  var sc = scenNet(sp[1].tvl_usd, r.implied_value_usd, sp[1].age_days, row.farm.tx_fee_usd,
   row.farm.deposit_usd, S.drop, row.farm.hold_weeks, f.capital_charge_apr);
  return { label: sp[0], lv: r.launch_value_usd, o: r.launch_odds, iv: r.implied_value_usd,
   m: r.implied_value_usd / Math.max(1, row.implied_value_usd), nph: sc.nph };
 });
}

/** FNV-1a 32-bit digest over canonical rows (rank:slug:implied_value_usd). */
function boardChecksum(rows) {
 var h = 0x811c9dc5, t = rows.map(function (r) { return r.rank + ':' + r.slug + ':' + r.implied_value_usd; }).join('|');
 for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
 return h.toString(16).padStart(8, '0');
}

/** 3. Farm economics & 7-step category-routed execution plan for any (deposit, drop share, weeks). */
function scenNet(tvl, iv, a, fee, dep, drop, wks, apr) {
 var hd = wks * 7, tr = Math.min(365, a === null ? 180 : a);
 var cd = Math.round(tr * 0.45 + hd);
 var dd = tvl * Math.max(28, cd) + dep * hd, ud = dep * hd;
 var ed = r2(iv * drop * (ud / dd));
 var gas = r2((4 + wks) * fee + dep * 0.0004);
 var cap = r2(dep * apr * (hd / 365));
 var net = r2(ed - gas - cap), wh = r2(0.75 + wks * 0.11);
 return { hd: hd, cd: cd, ed: ed, gas: gas, cap: cap, cost: r2(gas + cap), net: net, wh: wh, nph: r2(net / wh) };
}

function buildSteps(row, dep, wks, sc, fee, chain, verdict, beDrop) {
 var gRes = r2((6 + wks) * fee), eCost = r2(fee * 2 + dep * 0.0002), wCost = r2(fee * wks), wMin = wks * 6;
 var tvlM = '$' + (row.tvl_usd / 1e6).toFixed(1) + 'M', stopM = '$' + (Math.round(row.tvl_usd * 0.7) / 1e6).toFixed(1) + 'M';
 var cat = (row.category || '').toLowerCase(), depF = '$' + dep.toLocaleString('en-US');
 var s1 = 'Verify defillama.com/protocol/' + row.slug + ', run a $100 test, then deploy ' + depF + " of USDC into " + row.name + "'s core contract on " + chain + '.';
 var s2 = 'Hold ' + row.name + "'s position receipt in self-custody on " + chain + ' and complete one secondary protocol action to register active usage.';
 if (cat.indexOf('dex') >= 0) {
  s1 = 'Verify defillama.com/protocol/' + row.slug + ', run a $100 test, then add ' + depF + ' to ' + row.name + "'s deepest liquidity pool on " + chain + ' across the active fee band.';
  s2 = 'Route $' + Math.round(dep * 0.25).toLocaleString('en-US') + ' of swap volume through ' + row.name + ' on ' + chain + ' so the wallet records both LP and trader activity.';
 } else if (cat.indexOf('basis') >= 0 || cat.indexOf('synthet') >= 0) {
  s1 = 'Verify defillama.com/protocol/' + row.slug + ', run a $100 test, then mint ' + depF + ' of ' + row.name + "'s synthetic dollar on " + chain + ' against USDC collateral.';
  s2 = 'Stake the minted ' + row.name + ' synthetic asset into its native yield/points vault on ' + chain + ' without looping leverage above 1x.';
 } else if (cat.indexOf('lend') >= 0 || cat.indexOf('cdp') >= 0 || cat.indexOf('stable') >= 0) {
  s1 = 'Verify defillama.com/protocol/' + row.slug + ', run a $100 test, then supply ' + depF + ' of USDC collateral to ' + row.name + ' on ' + chain + ' and borrow at most 25% LTV.';
  s2 = 'Deposit the borrowed asset in ' + row.name + "'s native stability or savings module on " + chain + ' while keeping health factor above 1.5.';
 } else if (cat.indexOf('restak') >= 0 || cat.indexOf('stak') >= 0 || cat.indexOf('btc') >= 0) {
  s1 = 'Verify defillama.com/protocol/' + row.slug + ', run a $100 test, then stake ' + depF + ' into ' + row.name + "'s active delegation vault on " + chain + '.';
  s2 = 'Hold ' + row.name + "'s liquid staking receipt in self-custody on " + chain + ' without looping leverage more than once.';
 } else if (cat.indexOf('curator') >= 0 || cat.indexOf('allocator') >= 0 || cat.indexOf('yield') >= 0 || cat.indexOf('farm') >= 0) {
  s1 = 'Verify defillama.com/protocol/' + row.slug + ', run a $100 test, then deposit ' + depF + ' of USDC into ' + row.name + "'s flagship curated vault on " + chain + '.';
  s2 = 'Hold the vault receipt token in self-custody on ' + chain + ' and confirm underlying strategy pools carry audited contracts.';
 } else if (cat.indexOf('rwa') >= 0) {
  s1 = 'Verify defillama.com/protocol/' + row.slug + ', complete onboarding on ' + chain + ', and mint ' + depF + ' of ' + row.name + "'s yield-bearing RWA token at par.";
  s2 = 'Hold the minted ' + row.name + ' asset directly in your self-custody wallet on ' + chain + ' without re-hypothecating into unverified wrappers.';
 }
 return [
  { when: 'Day 0', action: 'Fund a dedicated wallet on ' + chain + ' with ' + depF + ' of USDC and $' + gRes.toFixed(2) + ' of native gas ($' + fee.toFixed(2) + ' per transaction).', cost_label: '$' + fee.toFixed(2), time_label: '15 min' },
  { when: 'Day 0', action: s1, cost_label: '$' + eCost.toFixed(2), time_label: '10 min' },
  { when: 'Day 1', action: s2, cost_label: '$' + fee.toFixed(2), time_label: '10 min' },
  { when: 'Weekly x' + wks, action: 'Each week for ' + wks + " weeks, touch the position on " + row.name + "'s app, log transaction hashes, and check that TVL holds near " + tvlM + '.', cost_label: '$' + wCost.toFixed(2), time_label: wMin + ' min' },
  { when: 'Any day', action: 'Leave early if ' + row.name + ' TVL drops below ' + stopM + " (30% under today's " + tvlM + ') or a token is recorded; claim only from official links and never pay to claim.', cost_label: '$0.00', time_label: 'rule' },
  { when: 'Day ' + sc.hd, action: 'Unwind the ' + depF + ' position on ' + chain + ', revoke contract approvals, and redeem to USDC; past week ' + wks + ' dilution exceeds weekly cost.', cost_label: '$' + eCost.toFixed(2), time_label: '20 min' },
  { when: 'Budget', action: 'Slice $' + sc.ed.toFixed(2) + ' - $' + sc.gas.toFixed(2) + ' gas/fees - $' + sc.cap.toFixed(2) + ' capital charge (2% APR on ' + depF + ' for ' + sc.hd + 'd, ' + sc.wh.toFixed(1) + 'h work) = net ' + (sc.net >= 0 ? '+' : '') + '$' + sc.net.toFixed(2) + ' (' + (sc.nph >= 0 ? '+' : '') + '$' + sc.nph.toFixed(2) + '/h: ' + verdict + '; clears $25/h above ' + beDrop + '% drop).', cost_label: '$' + sc.cap.toFixed(2), time_label: sc.wh.toFixed(1) + ' h total' }
 ];
}

function farmPlan(row) {
 var f = row.farm;
 var plain = S.dep === 'plan' && Math.abs(S.drop - 0.1) < 1e-6 && S.hor === 'best' && S.tvlX === 1 && S.gOv === null && S.addM === 0;
 if (plain) return f;
 var m = row;
 if (S.tvlX !== 1 || S.gOv !== null || S.addM !== 0) {
  var bA = row.age_days === null ? D.fitted.median_peer_age_days : row.age_days;
  m = Object.assign({}, row, { tvl_usd: Math.round(row.tvl_usd * S.tvlX),
   change_7d: S.gOv !== null ? S.gOv : row.change_7d,
   age_days: S.addM > 0 ? bA + S.addM * 30 : row.age_days });
  m.implied_value_usd = impliedValue(m, D.fitted).implied_value_usd;
 }
 var dep = S.dep === 'plan' ? f.deposit_usd : Number(S.dep);
 var wks = S.hor === 'best' ? f.hold_weeks : Number(S.hor);
 var sc = scenNet(m.tvl_usd, m.implied_value_usd, m.age_days, f.tx_fee_usd, dep, S.drop, wks, D.fitted.capital_charge_apr);
 var v = sc.net > 0 && sc.nph >= D.fitted.hourly_hurdle_usd ? 'FARM' : (sc.net > 0 ? 'MARGINAL' : 'SKIP');
 var be = sc.ed > 0 ? r2((sc.cost / sc.ed) * (S.drop * 100)) : 99.9;
 return Object.assign({}, f, { verdict: v, deposit_usd: dep, hold_weeks: wks, hold_days: sc.hd,
  expected_drop_usd: sc.ed, gas_fees_usd: sc.gas, capital_charge_usd: sc.cap, total_cost_usd: sc.cost,
  net_usd: sc.net, work_hours: sc.wh, net_per_hour_usd: sc.nph, breakeven_drop_pct: be,
  steps: buildSteps(m, dep, wks, sc, f.tx_fee_usd, f.primary_chain, v, be) });
}

/** Audit every row, ledger partition and all 7 farm steps against board.json and main.ts figures. */
function verifyIntegrity(d) {
 var ok = 0, stOk = 0, wlOk = 0, ordered = true, sum = 0, rec = [];
 for (var i = 0; i < d.rows.length; i++) {
  var r = d.rows[i], c = impliedValue(r, d.fitted), fp = r.farm;
  if (c.implied_value_usd === r.implied_value_usd && c.launch_value_usd === r.launch_value_usd) ok++;
  if (r.watchlist && r.tier === 'watchlist') wlOk++;
  var sc = scenNet(r.tvl_usd, r.implied_value_usd, r.age_days, fp.tx_fee_usd, fp.deposit_usd, 0.1, fp.hold_weeks, d.fitted.capital_charge_apr);
  var st = buildSteps(r, fp.deposit_usd, fp.hold_weeks, sc, fp.tx_fee_usd, fp.primary_chain, fp.verdict, fp.breakeven_drop_pct);
  var all7 = st.length === 7 && st.every(function (s, k) {
   return '[' + s.when + '] ' + s.action + ' Cost: ' + s.cost_label + '. Time: ' + s.time_label + '.' === r.farm_steps[k];
  });
  if (all7) stOk++;
  if (r.rank !== i + 1 || (i > 0 && c.implied_value_usd > rec[i - 1].implied_value_usd)) ordered = false;
  sum += c.implied_value_usd; rec.push({ rank: i + 1, slug: r.slug, implied_value_usd: c.implied_value_usd });
 }
 var h = boardChecksum(rec), ac = ledgerOf(d);
 var lSum = ac.groups.reduce(function (a, g) { return a + g.count; }, 0);
 return { matched: ok, stepsMatched: stOk, wlMatched: wlOk, ledgerSum: lSum, total: d.rows.length,
  ordered: ordered, sumImplied: sum, sumMatches: sum === d.total_implied_usd,
  checksum: h, checksumMatches: h === d.board_checksum };
}

function valueLadder(f) { return f.value_ladder; }
function oddsLadder(f) { return f.odds_ladder; }
function rangeOf(f) { return f.range_audit; }
function cohortRecord(f) { return f.age_cohorts || []; }

function readHash() {
 var h = (window.location.hash || '').replace(/^#/, '');
 if (!h) return;
 h.split('&').forEach(function (pr) {
  var p = pr.split('='), k = decodeURIComponent(p[0] || ''), v = decodeURIComponent(p[1] || '');
  if (k === 'view' && (v === 'board' || v === 'detail' || v === 'comps')) S.view = v;
  else if (k === 'slug' && v) S.slug = v;
  else if (k === 'expand' && v) S.expanded = v;
  else if (k === 'verdict' && v) S.verdict = v;
  else if (k === 'tier' && v) S.tier = v;
  else if (k === 'sort' && v) S.sort = v;
  else if (k === 'dir' && v) S.dir = Number(v) || 1;
  else if (k === 'compact') S.compact = v === '1' || v === 'true';
  else if (k === 'compare') S.cmpOpen = v === '1' || v === 'true';
 });
}

function visRows() {
 var q = S.q.trim().toLowerCase();
 return D.rows.filter(function (r) {
  var fp = farmPlan(r);
  if (S.verdict !== 'ALL' && fp.verdict !== S.verdict) return false;
  if (S.tier !== 'all' && r.tier !== S.tier) return false;
  if (S.category !== 'all' && (r.category || 'Other') !== S.category) return false;
  if (S.chain !== 'all' && (r.chains || []).indexOf(S.chain) < 0) return false;
  if (q) {
   var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + (r.chains || []).join(' ')).toLowerCase();
   if (hay.indexOf(q) < 0) return false;
  }
  return true;
 });
}
function sorted(list) {
 var k = S.sort, d = S.dir;
 return list.slice().sort(function (a, b) {
  var fa = farmPlan(a), fb = farmPlan(b), x = 0, y = 0;
  if (k === 'tvl') { x = a.tvl_usd; y = b.tvl_usd; }
  else if (k === 'growth') { x = a.change_7d === null ? -9999 : a.change_7d; y = b.change_7d === null ? -9999 : b.change_7d; }
  else if (k === 'age') { x = a.age_days === null ? -1 : a.age_days; y = b.age_days === null ? -1 : b.age_days; }
  else if (k === 'odds') { x = a.launch_odds; y = b.launch_odds; }
  else if (k === 'launch') { x = a.launch_value_usd; y = b.launch_value_usd; }
  else if (k === 'implied') { x = a.implied_value_usd; y = b.implied_value_usd; }
  else if (k === 'net') { x = fa.net_usd; y = fb.net_usd; }
  else if (k === 'net_hr') { x = fa.net_per_hour_usd; y = fb.net_per_hour_usd; }
  else { x = a.rank; y = b.rank; }
  return x < y ? -d : x > y ? d : a.rank - b.rank;
 });
}
function cmpSlugs() {
 if (S.cmp.length) return S.cmp;
 return D.rows.filter(function (r) { return farmPlan(r).verdict === 'FARM'; })
  .sort(function (a, b) { return farmPlan(b).net_per_hour_usd - farmPlan(a).net_per_hour_usd; })
  .slice(0, 3).map(function (r) { return r.slug; });
}
function defSlug() {
 if (S.slug) return S.slug;
 var f = D.rows.filter(function (r) { return r.tier === 'watchlist' && farmPlan(r).verdict === 'FARM'; });
 return (f[0] || D.rows[0]).slug;
}

function topbar() {
 return el('header', { class: 'topbar' },
  el('div', { class: 'brand-row' },
   el('span', { class: 'brand-title', text: 'Token Launch Radar' }),
   el('span', { class: 'brand-sub', text: 'pre-token protocols, valued from their own snapshot record' })),
  el('div', { class: 'top-meta' },
   el('span', { class: 'meta-pill', text: 'DefiLlama snapshot: ' + D.as_of }),
   el('span', { class: 'meta-pill', text: 'model ' + D.model_version + ' · refitted in browser' }),
   el('span', { class: 'meta-pill', text: 'seal ' + D.board_checksum + ' = main.ts' })));
}

function kpis() {
 var f = D.fitted, vl = valueLadder(f), ol = oddsLadder(f), ra = rangeOf(f);
 var bV = vl[0], fV = vl[4], bO = ol[0], fO = ol[4], c = { FARM: 0, MARGINAL: 0, SKIP: 0 };
 var kV = vl.slice(1).filter(function (x) { return x.kept; }).length;
 var kO = ol.slice(1).filter(function (x) { return x.kept; }).length;
 D.rows.forEach(function (r) { c[farmPlan(r).verdict]++; });
 function card(h, v, sub) { return el('div', { class: 'kpi-card' }, el('span', { class: 'kpi-head', text: h }), v, el('span', { class: 'kpi-sub', text: sub })); }
 return el('section', { class: 'kpi-grid' },
  card('Out-of-Sample Miss, Walk-Fwd', el('div', { class: 'kpi-val' }, 'x' + fV.wf_miss.toFixed(2) + ' ', el('span', { class: 'vs', text: 'vs x' + bV.wf_miss.toFixed(2) + ' flat' })),
   'older -> newer listed tokens; LOO x' + fV.loo_miss.toFixed(2) + ' vs x' + bV.loo_miss.toFixed(2)),
  card('Is the Printed Range Honest?', el('div', { class: 'kpi-val', text: ra.wf_p25_p75_pct + '% · ' + ra.wf_p10_p90_pct + '%' }),
   'newer caps inside P25-P75 (stated 50%) & P10-P90 (80%)'),
  card('Token Odds vs Base, Brier', el('div', { class: 'kpi-val' }, fO.wf_brier.toFixed(4) + ' ', el('span', { class: 'vs', text: 'vs ' + bO.wf_brier.toFixed(4) })),
   'walk-forward across 442 peers; 10-fold ' + fO.tenfold_brier.toFixed(4) + ' vs ' + bO.tenfold_brier.toFixed(4)),
  card('Terms That Survived Both Tests', el('div', { class: 'kpi-val', text: kV + ' of ' + (vl.length - 1) + ' · ' + kO + ' of ' + (ol.length - 1) }),
   'every kept term lowers both blind tests; noise controls rejected'),
  card('Worth Farming (>= $25/h)', el('div', { class: 'kpi-val', style: 'color:var(--green)', text: c.FARM + ' of ' + D.board_size }),
   'net of gas, spread & 2% capital charge (' + c.MARGINAL + ' marginal, ' + c.SKIP + ' skip)'),
  card('Watchlist & Full Ledger', el('div', { class: 'kpi-val', text: D.watchlist_size + ' / ' + D.watchlist_size }),
   '+ ' + D.offlist_size + ' off-list (>= $50M) + ' + D.early_size + ' early (< $50M) = ' + D.board_size));
}

function accounting(a) {
 var ac = ledgerOf(D), L = D.ledger, f = D.fitted;
 return el('section', { class: 'panel-box' },
  el('div', { class: 'formula-banner', text:
   'impliedValue(row) = launchValue(row) × launchOdds(row) · launchValue = $' + (f.base_cap_at_100m_usd / 1e6).toFixed(2) +
   'M × exp(' + f.slope_ln_tvl + '·ln(TVL/$100M) ' + f.slope_ln_chains + '·ln(chains) ' + f.slope_ln_age_yrs +
   '·ln(years_listed)) · launchOdds = (F(t+2y)-F(t))/(1-F(t))' }),
  el('div', { class: 'sec-head' },
   el('div', { class: 'sec-title' }, el('span', { text: 'PROTOCOL ACCOUNTING' }), el('span', { class: 'fn-tag', text: 'ledgerOf()' }),
    el('span', { style: 'text-transform:none;font-weight:400;color:var(--muted)', text:
     'all ' + L.total_protocols + ' snapshot protocols in one group each: ' + L.ranked_total + ' ranked pre-token, ' +
     L.token_all_records + ' recording a token (' + L.token_traded_comps + ' priced comps + ' + (L.token_all_records - L.token_traded_comps) + ' other), ' + L.out_no_token + ' tokenless excluded' }))),
  el('div', { class: 'acct-bar' }, ac.groups.map(function (g) {
   return el('div', { class: 'acct-seg', style: 'width:' + ((g.count / ac.total) * 100).toFixed(2) + '%;background:' + g.color, title: g.label + ': ' + g.count });
  })),
  el('div', { class: 'acct-legend' }, ac.groups.map(function (g) {
   return el('span', { class: 'leg-item' }, el('span', { class: 'leg-dot', style: 'background:' + g.color }),
    el('span', { text: g.label + ' ' }), el('b', { text: String(g.count) }));
  })),
  el('div', { class: 'integrity-strip' },
   el('span', { class: 'chk-pill', text: (a.matched === a.total ? '✓ ' : '✗ ') + 'this table = board.json: ' + a.matched + '/' + a.total + ' rows recomputed' }),
   el('span', { class: 'chk-pill', text: (a.ordered ? '✓ ' : '✗ ') + 'ranks 1-' + a.total + ' in order, values never rise' }),
   el('span', { class: 'chk-pill', text: (a.sumMatches && a.checksumMatches ? '✓ ' : '✗ ') + 'total $' + a.sumImplied.toLocaleString('en-US') + ' · seal ' + a.checksum + ' = main.ts' }),
   el('span', { class: 'chk-pill', text: (a.wlMatched === D.watchlist_size && a.ledgerSum === L.total_protocols ? '✓ ' : '✗ ') + 'watchlist ' + a.wlMatched + '/' + D.watchlist_size + ' · ledger ' + a.ledgerSum + '/' + L.total_protocols }),
   el('span', { class: 'chk-pill', text: (a.stepsMatched === a.total ? '✓ ' : '✗ ') + a.stepsMatched + '/' + a.total + ' plans × 7 costed steps · 0 names hardcoded' })));
}

function ladderTable(rows, kind) {
 var body = rows.map(function (st, i) {
  var cls = st.is_control ? 'st-ctrl' : st.kept ? 'st-kept' : 'st-drop';
  var txt = i === 0 ? 'baseline' : st.is_control ? 'must not help' : st.kept ? 'kept' : 'tested, not kept';
  return el('tr', null,
   td(st.term), td(kind === 'v' ? 'x' + st.loo_miss.toFixed(2) : st.tenfold_brier.toFixed(4), 'num'),
   td(kind === 'v' ? 'x' + st.wf_miss.toFixed(2) : st.wf_brier.toFixed(4), 'num'),
   td((st.sign_holds_pct || 100) + '%', 'num'),
   el('td', { class: 'num' }, el('span', { class: cls, text: txt })));
 });
 return el('table', { class: 'ev-table' },
  el('thead', null, el('tr', null, el('th', { text: 'Term, added in order' }),
   el('th', { class: 'num', text: kind === 'v' ? 'LOO' : '10-Fold' }),
   el('th', { class: 'num', text: 'Walk-Fwd' }), el('th', { class: 'num', text: 'Sign' }),
   el('th', { class: 'num', text: 'Decision' }))),
  el('tbody', null, body));
}

function evidence() {
 var f = D.fitted, se = f.bootstrap_se, ra = rangeOf(f), co = cohortRecord(f);
 return el('section', { class: 'evidence-grid' },
  el('div', { class: 'ev-card' },
   el('div', { class: 'sec-title' }, el('span', { text: '1. Value if a token launches' }), el('span', { class: 'fn-tag', text: 'valueLadder()' })),
   el('div', { class: 'ev-sub', text: 'Kept only if it lowers both LOO and walk-forward miss (92 comps)' }),
   ladderTable(valueLadder(f), 'v'),
   el('div', { class: 'ev-foot', text: 'Fitted ± bootstrap s.e. (' + se.refits + ' refits): $100M base $' + (f.base_cap_at_100m_usd / 1e6).toFixed(1) +
    'M; ln(TVL) +' + f.slope_ln_tvl + '±' + se.slope_tvl_se + '; ln(chains) ' + f.slope_ln_chains + '±' + se.slope_chains_se +
    '; ln(age) ' + f.slope_ln_age_yrs + '±' + se.slope_age_se + '.' })),
  el('div', { class: 'ev-card' },
   el('div', { class: 'sec-title' }, el('span', { text: '2. Token launch odds (24m hazard)' }), el('span', { class: 'fn-tag', text: 'oddsLadder()' })),
   el('div', { class: 'ev-sub', text: 'Out-of-sample Brier across 442 peers (244 token, 198 pre-token)' }),
   ladderTable(oddsLadder(f), 'o'),
   el('div', { class: 'ev-foot', text: '7-day growth fails LOO on cap pricing (dropped); it lowers both Brier scores in oddsLadder() (kept).' })),
  el('div', { class: 'ev-card' },
   el('div', { class: 'sec-title' }, el('span', { text: '3. Range honesty & peer cohort record' }), el('span', { class: 'fn-tag', text: 'rangeOf()' })),
   el('table', { class: 'ev-table' },
    el('thead', null, el('tr', null, el('th', { text: 'Held-out coverage check' }), el('th', { class: 'num', text: 'LOO' }), el('th', { class: 'num', text: 'Walk-Fwd' }))),
    el('tbody', null,
     el('tr', null, td('within x3 of the model'), td(ra.loo_within_3x_pct + '%', 'num'), td(ra.wf_within_3x_pct + '%', 'num')),
     el('tr', null, td('inside P25-P75 (stated 50%)'), td(ra.loo_p25_p75_pct + '%', 'num'), td(ra.wf_p25_p75_pct + '%', 'num')),
     el('tr', null, td('inside P10-P90 (stated 80%)'), td(ra.loo_p10_p90_pct + '%', 'num'), td(ra.wf_p10_p90_pct + '%', 'num')))),
   el('div', { class: 'sec-title', style: 'margin:6px 0 3px' }, el('span', { text: "The peers' record behind the odds" })),
   el('table', { class: 'ev-table' },
    el('thead', null, el('tr', null, el('th', { text: 'Age cohort' }), el('th', { class: 'num', text: 'Stand-alone' }), el('th', { class: 'num', text: 'Record token' }))),
    el('tbody', null, co.map(function (c) {
     return el('tr', null, td(c.label + ' listed'), td(c.peers + ' peers', 'num'), td(c.tokenized + ' (' + c.rate_pct + '%)', 'num'));
    })))));
}

function compareDrawer() {
 var items = cmpSlugs().map(function (s) { return D.rows.find(function (r) { return r.slug === s; }); }).filter(Boolean);
 if (!items.length) return null;
 return el('section', { class: 'compare-strip' },
  el('div', { class: 'sec-head', style: 'margin-bottom:2px' },
   el('div', { class: 'sec-title' }, el('span', { text: 'SIDE-BY-SIDE PROTOCOL COMPARISON' }), el('span', { class: 'fn-tag', text: 'compareProtocols()' }),
    el('span', { style: 'text-transform:none;font-weight:400;color:var(--muted)', text:
     'top ' + items.length + ' FARM candidates head-to-head on snapshot figures and net-of-cost economics' })),
   btn('Hide Compare ▴', function () { S.cmpOpen = false; render(); })),
  el('div', { class: 'cmp-grid' }, items.map(function (r) {
   var fp = farmPlan(r);
   function row(l, v) { return el('div', { class: 'cmp-row' }, el('span', { text: l }), el('span', { text: v })); }
   return el('div', { class: 'cmp-card' },
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px' },
     el('div', { class: 'proto-main' }, el('span', { class: 'rk-num', text: '#' + r.rank }), el('span', { text: r.name }),
      el('span', { class: 'tier-badge tier-' + r.tier, text: r.tier === 'watchlist' ? 'WATCHLIST' : r.tier === 'offlist' ? 'OFF-LIST' : 'EARLY' })),
     el('span', { class: 'v-badge v-' + fp.verdict, text: fp.verdict + ' ' + susd(fp.net_per_hour_usd) + '/h' })),
    row('TVL · 7D · Age', usd(r.tvl_usd) + ' · ' + pct(r.change_7d, 1) + ' · ' + age(r.age_days)),
    row('If Launched × 24m Odds', usd(r.launch_value_usd) + ' × ' + Math.round(r.launch_odds * 100) + '%'),
    row('Implied Value (P25-P75)', usd(r.implied_value_usd) + ' (' + usd(r.p25_usd) + '-' + usd(r.p75_usd) + ')'),
    row('Plan Net · Break-even Drop', susd(fp.net_usd) + ' on $' + fp.deposit_usd.toLocaleString('en-US') + ' · BE ' + fp.breakeven_drop_pct + '%'));
  })));
}

function sandbox() {
 function sel(opts, cur, fn) {
  return el('select', { class: 'ctrl-select', onchange: function (e) { fn(e.target.value); } }, opts.map(function (o) {
   return el('option', { value: o[0], text: o[1], selected: String(cur) === o[0] ? 'selected' : null });
  }));
 }
 return el('section', { class: 'compare-strip' },
  el('div', { class: 'sec-head' },
   el('div', { class: 'sec-title' }, el('span', { text: 'LIVE MODEL SANDBOX — COUNTERFACTUAL BOARD RE-PRICING' }), el('span', { class: 'fn-tag', text: 'impliedValue() × scenNet()' })),
   el('div', { style: 'display:flex;gap:8px' },
    btn('Reset Shocks', function () { S.tvlX = 1; S.gOv = null; S.addM = 0; render(); }),
    btn('Close Sandbox ▴', function () { S.boxOpen = false; render(); }))),
  el('div', { class: 'ctrl-row', style: 'font:500 11.5px var(--mono);color:var(--ink-dim)' },
   el('label', null, 'TVL Shock: ', sel([['0.7', '-30% TVL (drawdown)'], ['1', '1.00x (snapshot TVL)'], ['1.5', '+50% TVL (inflow surge)']], S.tvlX, function (v) { S.tvlX = Number(v); render(); })),
   el('label', null, '7-Day Growth: ', sel([['snap', 'as recorded'], ['-20', '-20% weekly outflow'], ['0', '0% flat week'], ['25', '+25% momentum spike']], S.gOv === null ? 'snap' : S.gOv, function (v) { S.gOv = v === 'snap' ? null : Number(v); render(); })),
   el('label', null, 'Elapsed No-Token Time: ', sel([['0', '+0 months (today)'], ['6', '+6 months still no token'], ['12', '+12 months still no token']], S.addM, function (v) { S.addM = Number(v); render(); }))));
}

function exportFile(kind) {
 var rows = sorted(visRows()), name, content, mime;
 if (kind === 'json') { content = JSON.stringify(rows, null, 2); mime = 'application/json'; name = 'token-radar-filtered.json'; }
 else {
  var head = ['rank', 'slug', 'name', 'tier', 'category', 'tvl_usd', 'change_7d', 'age_days', 'launch_odds', 'launch_value_usd', 'implied_value_usd', 'verdict', 'deposit_usd', 'net_usd', 'net_per_hour_usd'].join(',');
  content = [head].concat(rows.map(function (r) {
   var fp = farmPlan(r);
   return [r.rank, r.slug, '"' + r.name.replace(/"/g, '""') + '"', r.tier, '"' + (r.category || '') + '"', r.tvl_usd,
    r.change_7d || 0, r.age_days || '', r.launch_odds, r.launch_value_usd, r.implied_value_usd, fp.verdict, fp.deposit_usd, fp.net_usd, fp.net_per_hour_usd].join(',');
  })).join('\n');
  mime = 'text/csv'; name = 'token-radar-filtered.csv';
 }
 var url = URL.createObjectURL(new Blob([content], { type: mime })), a = document.createElement('a');
 a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

function controls(rows) {
 var c = { ALL: D.rows.length, FARM: 0, MARGINAL: 0, SKIP: 0 };
 D.rows.forEach(function (r) { c[farmPlan(r).verdict]++; });
 function pill(txt, on, fn) { return btn(txt, fn, 'pill-btn', on); }
 function vBtn(k, l) {
  return pill(l + ' ' + c[k], S.view === 'board' && S.verdict === k, function () {
   S.view = 'board'; S.verdict = k; if (k === 'FARM') { S.sort = 'net_hr'; S.dir = -1; } render();
  });
 }
 function tBtn(k, l) { return pill(l, S.view === 'board' && S.tier === k, function () { S.view = 'board'; S.tier = k; render(); }); }
 var cats = Array.from(new Set(D.rows.map(function (r) { return r.category || 'Other'; }))).sort();
 var chs = Array.from(new Set(D.rows.reduce(function (a, r) { return a.concat(r.chains || []); }, []))).sort();
 var vi = rows.reduce(function (a, r) { return a + r.implied_value_usd; }, 0);
 var vt = rows.reduce(function (a, r) { return a + r.tvl_usd; }, 0);
 var sLbl = S.sort === 'net_hr' ? 'net / hour, high to low' : S.sort;
 return el('section', { class: 'controls-bar' },
  el('div', { class: 'ctrl-row' },
   el('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap' },
    el('div', { class: 'pill-group' }, [vBtn('ALL', 'All'), vBtn('FARM', 'Farm'), vBtn('MARGINAL', 'Marginal'), vBtn('SKIP', 'Skip')]),
    el('div', { class: 'pill-group' }, [tBtn('all', 'All ' + D.board_size), tBtn('watchlist', 'Watchlist ' + D.watchlist_size),
     tBtn('offlist', 'Off-list ' + D.offlist_size), tBtn('early', 'Early ' + D.early_size),
     pill('Live Tokens ' + D.comps.length, S.view === 'comps', function () { S.view = S.view === 'comps' ? 'board' : 'comps'; render(); }),
     pill('Sandbox', S.boxOpen, function () { S.boxOpen = !S.boxOpen; render(); })]),
    el('input', { id: 'radar-search', class: 'ctrl-input', style: 'min-width:190px', type: 'search', placeholder: 'Filter protocol, category or chain...',
     value: S.q, oninput: function (e) { S.q = e.target.value; render(); } })),
   el('div', { class: 'scen-group' },
    el('span', { text: 'DEPOSIT' }),
    el('select', { class: 'ctrl-select', onchange: function (e) { S.dep = e.target.value; render(); } },
     [['plan', 'plan (0.025% TVL)'], ['1000', '$1,000'], ['5000', '$5,000'], ['15000', '$15,000'], ['25000', '$25,000']].map(function (o) {
      return el('option', { value: o[0], text: o[1], selected: S.dep === o[0] ? 'selected' : null });
     })),
    el('span', { text: 'DROP' }),
    el('select', { class: 'ctrl-select', onchange: function (e) { S.drop = Number(e.target.value); render(); } },
     [['0.05', '5%'], ['0.07', '7%'], ['0.1', '10%'], ['0.15', '15%']].map(function (o) {
      return el('option', { value: o[0], text: o[1], selected: Math.abs(S.drop - Number(o[0])) < 1e-9 ? 'selected' : null });
     })),
    el('span', { text: 'HOLD' }),
    el('select', { class: 'ctrl-select', onchange: function (e) { S.hor = e.target.value; render(); } },
     [['best', 'optimal wks'], ['6', '6 wks'], ['8', '8 wks'], ['12', '12 wks']].map(function (o) {
      return el('option', { value: o[0], text: o[1], selected: S.hor === o[0] ? 'selected' : null });
     })),
    el('span', { style: 'font:600 11.5px var(--mono);color:var(--ink-dim);margin-left:4px', text:
     (S.verdict === 'ALL' ? '' : 'Filtered to ' + S.verdict + ' · sorted by ' + sLbl + ' — ') +
     rows.length + '/' + D.board_size + ' rows (' + usd(vt) + ' TVL · ' + usd(vi) + ' implied)' }))));
}

function expanded(r, fp) {
 return el('tr', { class: 'expand-row' },
  el('td', { colspan: '11' },
   el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:3px' },
    el('div', { class: 'sec-title' }, el('span', { text: r.name + ' — 7-Step Dated Farm Execution Plan (' + fp.strategy_kind + ' on ' + fp.primary_chain + ')' }),
     el('span', { class: 'fn-tag', text: 'farmPlan()' })),
    btn('Open Full Protocol Detail & Comparables ->', function (e) { e.stopPropagation(); S.view = 'detail'; S.slug = r.slug; render(); })),
   el('table', { class: 'steps-table' },
    el('thead', null, el('tr', null, el('th', { text: 'When' }), el('th', { text: 'Concrete Step & Exit Rule' }),
     el('th', { class: 'num', text: 'Cost' }), el('th', { class: 'num', text: 'Time' }))),
    el('tbody', null, fp.steps.map(function (st, i) {
     return el('tr', null, td((i + 1) + '. ' + st.when, 'step-when'), td(st.action), td(st.cost_label, 'num'), td(st.time_label, 'num'));
    }))),
   el('div', { class: 'step-summary' },
    el('span', { text: 'All-in: 7 steps over ' + fp.hold_days + ' days on $' + fp.deposit_usd.toLocaleString('en-US') + ', against a modelled slice of $' +
     fp.expected_drop_usd.toFixed(2) + ' (break-even drop share ' + fp.breakeven_drop_pct + '%, stop-loss TVL ' + usd(fp.tvl_stop_usd) + ')' }),
    el('span', { class: fp.net_usd >= 0 ? 'pos' : 'neg', text: 'Net ' + susd(fp.net_usd) + ' (' + susd(fp.net_per_hour_usd) + '/h · ' +
     fp.work_hours.toFixed(1) + 'h work · ' + fp.verdict + ')' }))));
}

function boardTable(rows) {
 function th(k, l, num) {
  return el('th', { class: num ? 'num' : null }, btn(l + (S.sort === k ? (S.dir > 0 ? ' ▲' : ' ▼') : ''), function () {
   if (S.sort === k) S.dir = -S.dir; else { S.sort = k; S.dir = k === 'rank' ? 1 : -1; } render();
  }, 'th-btn'));
 }
 var tb = el('tbody');
 rows.forEach(function (r) {
  var fp = farmPlan(r), open = S.expanded === r.slug;
  tb.appendChild(el('tr', { class: 'data-row', 'data-expanded': open ? 'true' : 'false',
   onclick: function () { S.expanded = open ? null : r.slug; render(); } },
   el('td', { style: 'white-space:nowrap' }, el('span', { class: 'rk-num', text: '#' + r.rank }), el('span', { class: 'rk-band', text: r.rank_low + '-' + r.rank_high })),
   el('td', null,
    el('div', { class: 'proto-main' },
     el('span', { class: 'proto-link', text: r.name, onclick: function (e) { e.stopPropagation(); S.view = 'detail'; S.slug = r.slug; render(); } }),
     el('span', { class: 'tier-badge tier-' + r.tier, text: r.tier === 'watchlist' ? 'WATCHLIST' : r.tier === 'offlist' ? 'OFF-LIST' : 'EARLY' })),
    el('span', { class: 'proto-sub', text: (r.category || 'DeFi') + ' · ' + (r.chains.slice(0, 2).join(', ') || 'Ethereum') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') })),
   td(usd(r.tvl_usd), 'num'),
   td(pct(r.change_7d, 1), 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg')),
   td(age(r.age_days), 'num'),
   el('td', { class: 'num' }, el('b', { text: Math.round(r.launch_odds * 100) + '%' })),
   td(usd(r.launch_value_usd), 'num'),
   el('td', { class: 'num' }, el('b', { style: 'color:var(--accent)', text: usd(r.implied_value_usd) }),
    el('span', { class: 'sub-mono', text: usd(r.p25_usd) + ' - ' + usd(r.p75_usd) })),
   el('td', { class: 'num' }, el('span', { class: 'v-badge v-' + fp.verdict, text: fp.verdict + ' ' + susd(fp.net_usd) }),
    el('span', { class: 'sub-mono', text: '$' + fp.expected_drop_usd.toFixed(0) + ' slice - $' + fp.total_cost_usd.toFixed(0) + ' cost' })),
   el('td', { class: 'num' }, el('b', { class: fp.net_per_hour_usd >= 0 ? 'pos' : 'neg', text: susd(fp.net_per_hour_usd) + '/h' })),
   el('td', { style: 'white-space:nowrap' },
    el('span', { style: 'font-weight:600;color:var(--ink-dim);display:block', text: fp.strategy_kind + ' · ' + fp.primary_chain }),
    el('span', { class: 'sub-mono', text: '$' + fp.deposit_usd.toLocaleString('en-US') + ' · ' + fp.hold_days + 'd · ' + fp.work_hours.toFixed(1) + 'h · 7 steps' }))));
  if (open) tb.appendChild(expanded(r, fp));
 });
 return el('section', { class: 'table-panel' },
  el('table', { class: 'board-table' },
   el('thead', null, el('tr', null, th('rank', '# · Range'), el('th', { text: 'Protocol & Tier' }), th('tvl', 'TVL', 1),
    th('growth', '7D', 1), th('age', 'No Token For', 1), th('odds', 'Token Odds', 1), th('launch', 'If It Launches', 1),
    th('implied', 'Implied Value · P25-P75', 1), th('net', 'Verdict · Net of Fees', 1), th('net_hr', 'Net / Hour', 1),
    el('th', { text: 'Farm Plan' }))),
   tb));
}

function compsTable() {
 return el('section', { class: 'table-panel' },
  el('table', { class: 'board-table' },
   el('thead', null, el('tr', null, el('th', { text: '#' }), el('th', { text: 'Traded Comparable Protocol (Stand-Alone Anchor)' }),
    el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: 'Real Market Cap' }),
    el('th', { class: 'num', text: 'Cap / TVL' }), el('th', { class: 'num', text: 'Held-Out LOO Model' }),
    el('th', { class: 'num', text: 'Blind Miss' }), el('th', { class: 'num', text: 'Listed Age' }))),
   el('tbody', null, D.comps.map(function (c, i) {
    return el('tr', { class: 'data-row' }, td('#' + (i + 1), 'rk-num'),
     el('td', null, el('div', { class: 'proto-main' }, el('span', { text: c.name }),
      el('span', { class: 'tier-badge tier-watchlist', text: c.symbol || 'TOKEN' })),
      el('span', { class: 'proto-sub', text: (c.category || 'DeFi') + ' · ' + (c.chains.slice(0, 3).join(', ') || 'Multi-chain') })),
     td(usd(c.tvl_usd), 'num'), td(usd(c.mcap_usd), 'num'), td('x' + c.cap_tvl_ratio.toFixed(2), 'num'),
     td(usd(c.loo_pred_usd), 'num'), td('x' + c.blind_miss_fold.toFixed(2), 'num'), td(age(c.age_days), 'num'));
   }))));
}

function detailView() {
 var row = D.rows.find(function (r) { return r.slug === defSlug(); }) || D.rows[0];
 var fp = farmPlan(row), f = D.fitted, calc = impliedValue(row, f);
 var pv = D.rows[Math.max(0, row.rank - 2)], nx = D.rows[Math.min(D.rows.length - 1, row.rank)];
 var nav = el('div', { class: 'detail-bar' },
  btn('<- Back to Board (filters kept)', function () { S.view = 'board'; render(); }),
  el('div', { style: 'font:600 12px var(--mono);color:var(--muted)', text: 'Rank #' + row.rank + ' of ' + D.board_size +
   ' by implied value · bootstrap rank range #' + row.rank_low + '-#' + row.rank_high }),
  el('div', { style: 'display:flex;gap:6px' },
   btn('<- #' + pv.rank + ' ' + pv.name, function () { S.slug = pv.slug; render(); }),
   btn('#' + nx.rank + ' ' + nx.name + ' ->', function () { S.slug = nx.slug; render(); })));
 var hdr = el('section', { class: 'detail-header' },
  el('div', null,
   el('div', { class: 'detail-title' },
    el('span', { style: 'color:var(--muted);font-family:var(--mono)', text: '#' + row.rank }), el('span', { text: row.name }),
    el('span', { class: 'tier-badge tier-' + row.tier, text: row.tier === 'watchlist' ? 'WATCHLIST (>= $50M)' : row.tier === 'offlist' ? 'OFF-LIST (>= $50M, PARENT RECORDED)' : 'EARLY (< $50M)' }),
    el('span', { class: 'tier-badge', style: 'background:var(--surface-3);color:var(--ink-dim)', text: 'RECORDS NO TOKEN' })),
   el('div', { style: 'color:var(--muted);font-size:12.5px;margin-top:3px', text:
    (row.category || 'DeFi') + ' · Chains: ' + (row.chains.join(', ') || 'Ethereum') + ' · Listed: ' +
    (row.listed_at || 'undated (' + f.median_peer_age_days + 'd peer median)') + ' · TVL ' + usd(row.tvl_usd) + ' · 7D change: ' + pct(row.change_7d, 2) })),
  el('div', { class: 'detail-kpis' },
   el('div', { class: 'dkpi' }, el('div', { class: 'dkpi-lbl', text: 'If Token Launches' }), el('div', { class: 'dkpi-val', text: usd(row.launch_value_usd) })),
   el('div', { class: 'dkpi' }, el('div', { class: 'dkpi-lbl', text: '24m Launch Odds' }), el('div', { class: 'dkpi-val', text: (row.launch_odds * 100).toFixed(1) + '%' })),
   el('div', { class: 'dkpi' }, el('div', { class: 'dkpi-lbl', text: 'Implied Value (P25-P75)' }),
    el('div', { class: 'dkpi-val', style: 'color:var(--accent)', text: usd(row.implied_value_usd) }),
    el('div', { class: 'sub-mono', text: usd(row.p25_usd) + ' to ' + usd(row.p75_usd) })),
   el('div', { class: 'dkpi' }, el('div', { class: 'dkpi-lbl', text: 'Farm Verdict' }),
    el('div', { class: 'dkpi-val' }, el('span', { class: 'v-badge v-' + fp.verdict, style: 'font-size:13px;padding:3px 8px', text: fp.verdict + ' ' + susd(fp.net_per_hour_usd) + '/h' })))));

 var left = el('div', { class: 'panel-box', style: 'margin-bottom:0' },
  el('div', { class: 'sec-head' },
   el('div', { class: 'sec-title' }, el('span', { text: 'How the Figure Is Made' }), el('span', { class: 'fn-tag', text: 'impliedValue() = launchValue() × launchOdds()' })),
   el('span', { class: 'chk-pill', text: (calc.implied_value_usd === row.implied_value_usd ? '✓ ' : '✗ ') + 'Browser recompute = $' + calc.implied_value_usd.toLocaleString('en-US') })),
  el('table', { class: 'buildup-table' }, el('tbody', null,
   el('tr', null, td('TVL today (DefiLlama ' + D.as_of + ')'), td(usd(row.tvl_usd), 'num')),
   el('tr', null, td('Curve base at $100M TVL (intercept ' + f.intercept_ln_cap + ')'), td(usd(f.base_cap_at_100m_usd), 'num')),
   el('tr', null, td('+ size curve, ln(TVL/$100M) × ' + f.slope_ln_tvl), td((calc.ln_tvl_term >= 0 ? '+' : '') + calc.ln_tvl_term.toFixed(3) + ' (×' + Math.exp(calc.ln_tvl_term).toFixed(2) + ')', 'num')),
   el('tr', null, td('+ chain count, ln(' + Math.max(1, row.chains.length) + ' chains) × ' + f.slope_ln_chains), td(calc.ln_chains_term.toFixed(3) + ' (×' + Math.exp(calc.ln_chains_term).toFixed(2) + ')', 'num')),
   el('tr', null, td('+ years listed, ln(' + age(row.age_days) + ') × ' + f.slope_ln_age_yrs), td((calc.ln_age_term >= 0 ? '+' : '') + calc.ln_age_term.toFixed(3) + ' (×' + Math.exp(calc.ln_age_term).toFixed(2) + ')', 'num')),
   el('tr', { class: 'buildup-total' }, td('= Value if a token launches (launchValue)'), td('$' + calc.launch_value_usd.toLocaleString('en-US'), 'num')),
   el('tr', null, td('Peer token share now -> in 24m (' + (row.category || 'sector') + ', 7d ' + pct(row.change_7d, 1) + ')'),
    td(Math.round(calc.f_now * 100) + '% -> ' + Math.round(calc.f_24m * 100) + '%', 'num')),
   el('tr', null, td('× Conditional 24-month token launch odds (launchOdds)'), td((calc.launch_odds * 100).toFixed(1) + '%', 'num')),
   el('tr', { class: 'buildup-total' }, td('= Implied Launch Value (board.json rank #' + row.rank + ')'), td('$' + calc.implied_value_usd.toLocaleString('en-US'), 'num')),
   el('tr', null, td('Held-out LOO bands: P25-P75 (50%) / P10-P90 (80%)'),
    td(usd(calc.p25_usd) + '-' + usd(calc.p75_usd) + ' / ' + usd(calc.p10_usd) + '-' + usd(calc.p90_usd), 'num')))),
  el('div', { class: 'sec-title', style: 'margin:10px 0 4px' }, el('span', { text: 'What Moves the Value — impliedValue() on a Changed Record' }), el('span', { class: 'fn-tag', text: 'counterfactuals()' })),
  el('table', { class: 'peers-table' },
   el('thead', null, el('tr', null, el('th', { text: 'Scenario' }), el('th', { class: 'num', text: 'If Launched' }), el('th', { class: 'num', text: '24m Odds' }),
    el('th', { class: 'num', text: 'Implied' }), el('th', { class: 'num', text: 'vs Now' }), el('th', { class: 'num', text: 'Net / Hr' }))),
   el('tbody', null, counterfactuals(row, f).map(function (c) {
    return el('tr', null, td(c.label), td(usd(c.lv), 'num'), td((c.o * 100).toFixed(1) + '%', 'num'),
     td(usd(c.iv), 'num'), td('x' + c.m.toFixed(2), 'num'), td(susd(c.nph) + '/h', 'num ' + (c.nph >= 0 ? 'pos' : 'neg')));
   }))),
  el('div', { class: 'sec-title', style: 'margin:10px 0 4px' }, el('span', { text: 'Nearest Priced Peers — Their Tokens Trade' }), el('span', { class: 'fn-tag', text: 'nearestPeers()' })),
  el('table', { class: 'peers-table' },
   el('thead', null, el('tr', null, el('th', { text: 'Token Peer' }), el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: 'Market Cap' }),
    el('th', { class: 'num', text: 'Cap / TVL' }), el('th', { class: 'num', text: 'Held-Out Fit' }), el('th', { class: 'num', text: 'Blind Miss' }))),
   el('tbody', null, row.nearest_peers.slice(0, 5).map(function (p) {
    return el('tr', null, el('td', null, el('b', { text: p.name }), el('span', { class: 'sub-mono', text: (p.symbol || '') + ' · ' + (p.category || '') })),
     td(usd(p.tvl_usd), 'num'), td(usd(p.mcap_usd), 'num'), td('x' + (p.mcap_usd / Math.max(1, p.tvl_usd)).toFixed(2), 'num'),
     td(usd(p.model_usd), 'num'), td('x' + p.miss_fold.toFixed(2), 'num'));
   }))));

 var right = el('div', { class: 'panel-box', style: 'margin-bottom:0' },
  el('div', { class: 'sec-head' },
   el('div', { class: 'sec-title' }, el('span', { text: 'Farm Plan: ' + fp.strategy_kind + ' on ' + fp.primary_chain + ' · $' + fp.deposit_usd.toLocaleString('en-US') + ' for ' + fp.hold_days + ' Days' }),
    el('span', { class: 'fn-tag', text: 'farmPlan()' })),
   el('span', { style: 'font:600 11px var(--mono);color:var(--ink-dim)', text: fp.hold_weeks + ' weeks · ' + fp.drop_share_pct + '% drop share · ' + fp.work_hours.toFixed(1) + 'h hands-on' })),
  el('div', { class: 'formula-banner', style: 'margin-bottom:7px', text:
   'Slice $' + fp.expected_drop_usd.toFixed(2) + ' - $' + fp.gas_fees_usd.toFixed(2) + ' gas/fees - $' + fp.capital_charge_usd.toFixed(2) +
   ' capital charge (2% APR on $' + fp.deposit_usd.toLocaleString('en-US') + ' for ' + fp.hold_days + 'd) = net ' + susd(fp.net_usd) +
   ' (' + susd(fp.net_per_hour_usd) + '/h: ' + fp.verdict + '). Clears fees above ' + fp.breakeven_drop_pct + '% drop share and ' +
   fp.breakeven_odds_pct + '% launch odds. Stop-loss exit if TVL falls below ' + usd(fp.tvl_stop_usd) + ' (-30%).' }),
  el('table', { class: 'steps-table' },
   el('thead', null, el('tr', null, el('th', { text: 'When' }), el('th', { text: 'Step & Exit Rule' }), el('th', { class: 'num', text: 'Cost' }), el('th', { class: 'num', text: 'Time' }))),
   el('tbody', null, fp.steps.map(function (st, i) {
    return el('tr', null, td((i + 1) + '. ' + st.when, 'step-when'), td(st.action), td(st.cost_label, 'num'), td(st.time_label, 'num'));
   }))),
  el('div', { class: 'matrix-duo' },
   el('div', null, el('div', { class: 'sec-title', style: 'margin:6px 0 3px', text: 'Net ($) by Deposit × Drop Share' }),
    el('table', { class: 'matrix-table' },
     el('thead', null, el('tr', null, el('th', { text: 'Deposit' }), el('th', { class: 'num', text: '5% Drop' }),
      el('th', { class: 'num', text: '10% Drop' }), el('th', { class: 'num', text: '20% Drop' }))),
     el('tbody', null, fp.matrix_deposit_drop.map(function (m) {
      return el('tr', null, td('$' + m.deposit_usd.toLocaleString('en-US'), 'step-when'),
       m.net_by_drop.map(function (v) { return td(susd(v), 'num ' + (v >= 0 ? 'pos' : 'neg')); }));
     })))),
   el('div', null, el('div', { class: 'sec-title', style: 'margin:6px 0 3px', text: 'Net by Weeks Held on $' + fp.deposit_usd.toLocaleString('en-US') }),
    el('table', { class: 'matrix-table' },
     el('thead', null, el('tr', null, el('th', { text: 'Horizon' }), el('th', { class: 'num', text: 'Net ($)' }), el('th', { class: 'num', text: 'Net / Hr' }))),
     el('tbody', null, fp.matrix_weeks.map(function (m) {
      return el('tr', null, td(m.weeks + ' wks (' + m.weeks * 7 + 'd)', 'step-when'), td(susd(m.net_usd), 'num ' + (m.net_usd >= 0 ? 'pos' : 'neg')),
       td(susd(m.net_per_hour_usd) + '/h', 'num ' + (m.net_per_hour_usd >= 0 ? 'pos' : 'neg')));
     }))))));
 return el('div', null, nav, hdr, el('div', { class: 'detail-grid' }, left, right));
}

var root = document.getElementById('board');
var audit = verifyIntegrity(D);

function render() {
 root.innerHTML = '';
 var w = el('div', { class: 'wrap' });
 w.appendChild(topbar());
 if (S.view === 'detail') {
  w.appendChild(detailView());
 } else {
  var rows = sorted(visRows());
  w.appendChild(kpis());
  w.appendChild(accounting(audit));
  if (!S.compact) w.appendChild(evidence());
  w.appendChild(controls(rows));
  if (S.boxOpen) w.appendChild(sandbox());
  if (S.cmpOpen) w.appendChild(compareDrawer());
  w.appendChild(S.view === 'comps' ? compsTable() : boardTable(rows));
 }
 root.appendChild(w);
}

window.addEventListener('keydown', function (e) {
 if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
 if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
  e.preventDefault();
  var i = document.getElementById('radar-search');
  if (i) i.focus();
 } else if (e.key === 'Escape' && S.view === 'detail') { S.view = 'board'; render(); }
});
window.addEventListener('hashchange', function () { readHash(); render(); });
readHash();
render();
})();
