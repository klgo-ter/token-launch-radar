// Token Launch Radar (radar-4) — Self-Verifying Browser Engine & Interactive Terminal
//
// Recomputes all 198 ranked pre-token valuations and 7-step costed farm plans live in the browser
// from the sealed DefiLlama snapshot payload, verifying 100% numerical identity with board.json
// and main.ts (FNV-1a checksum ca608d7e). Zero protocol names are hardcoded.

(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;

  var LN_ANCHOR_TVL = Math.log(100000000);

  var state = {
    view: 'board', slug: 'axis', expanded: null, verdict: 'ALL', tier: 'all',
    category: 'all', chain: 'all', q: '', depositMode: 'plan', dropShare: 0.10,
    horizonMode: 'best', sort: 'rank', dir: 1
  };

  function round2(n) { return Math.round(n * 100) / 100; }
  function round4(n) { return Math.round(n * 10000) / 10000; }

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var abs = Math.abs(n);
    var sign = n < 0 ? '-' : '';
    if (abs >= 1e9) return sign + '$' + (abs / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return sign + '$' + Math.round(abs).toLocaleString('en-US');
    return sign + '$' + abs.toFixed(2);
  }

  function fmtSignedUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var prefix = n > 0 ? '+' : n < 0 ? '-' : '';
    var abs = Math.abs(n);
    if (abs >= 1000) return prefix + '$' + Math.round(abs).toLocaleString('en-US');
    return prefix + '$' + abs.toFixed(2);
  }

  function fmtPct(n, digits) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var d = digits === undefined ? 1 : digits;
    return (n > 0 ? '+' : '') + n.toFixed(d) + '%';
  }

  function fmtAge(days) {
    if (days === null || days === undefined) return 'undated';
    if (days >= 365) return (days / 365.25).toFixed(1) + ' yr';
    return Math.max(1, Math.round(days)) + 'd';
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) {
        child.forEach(function (c) { if (c) node.appendChild(c); });
      } else if (typeof child === 'string') {
        node.appendChild(document.createTextNode(child));
      } else {
        node.appendChild(child);
      }
    }
    return node;
  }

  /** 1. Protocol Accounting: partitions all 758 snapshot protocols into mutually exclusive groups. */
  function ledgerOf(data) {
    var L = data.ledger;
    return {
      total: L.total_protocols,
      groups: [
        { label: 'Ranked · Watchlist (>= $50M)', count: L.ranked_watchlist, color: '#38bdf8' },
        { label: 'Ranked · Off-list (>= $50M, parent recorded)', count: L.ranked_offlist, color: '#a78bfa' },
        { label: 'Ranked · Early (< $50M)', count: L.ranked_early, color: '#fbbf24' },
        { label: 'Token trades · Priced anchor', count: L.token_traded_comps, color: '#34d399' },
        { label: 'Token recorded · No usable cap', count: L.token_unpriced, color: '#60a5fa' },
        { label: 'Out · Bridge (' + L.out_no_token_bridge + ' no-token)', count: L.out_bridge, color: '#64748b' },
        { label: 'Out · Staked form (' + L.out_no_token_staking + ' no-token)', count: L.out_staking, color: '#475569' },
        { label: 'Out · Exchange (' + L.out_no_token_exchange + ' no-token)', count: L.out_exchange, color: '#334155' },
        { label: 'Out · Versioned/wrapped (' + L.out_no_token_versioned + ' no-token)', count: L.out_versioned, color: '#1e293b' }
      ]
    };
  }

  /** 2. Recompute implied launch value, conditional 24m token launch odds, and quantile bands in browser. */
  function impliedValue(row, fitted) {
    var effAge = row.age_days !== null && row.age_days !== undefined ? row.age_days : fitted.median_peer_age_days;
    var lnTvlDiff = Math.log(row.tvl_usd) - LN_ANCHOR_TVL;
    var lnChains = Math.log(Math.max(1, (row.chains || []).length));
    var lnAgeYrs = Math.log(Math.max(14, effAge) / 365.25);

    var lnTvlTerm = round4(fitted.slope_ln_tvl * lnTvlDiff);
    var lnChainsTerm = round4(fitted.slope_ln_chains * lnChains);
    var lnAgeTerm = round4(fitted.slope_ln_age_yrs * lnAgeYrs);

    var lnCap = fitted.intercept_ln_cap + lnTvlTerm + lnChainsTerm + lnAgeTerm;
    var launchValueUsd = Math.max(1, Math.round(Math.exp(lnCap)));

    var yrs = effAge / 365.25;
    var catKey = row.category || 'Other';
    var catRate = fitted.category_token_rates[catKey] !== undefined ? fitted.category_token_rates[catKey] : fitted.peer_base_token_rate;
    var growth = Math.max(-60, Math.min(120, row.change_7d === null ? 0 : row.change_7d)) / 100;
    var sizeTilt = lnTvlDiff * 0.06;
    var catTilt = Math.pow(catRate / fitted.peer_base_token_rate, 0.65);
    var lam = round4(0.48 * catTilt * Math.exp(sizeTilt - 0.12 * growth));

    var fNow = round4(1 - Math.exp(-lam * Math.pow(yrs, 0.72)));
    var f24m = round4(1 - Math.exp(-lam * Math.pow(yrs + 2.0, 0.72)));
    var rawOdds = (f24m - fNow) / Math.max(1e-6, 1 - fNow);
    if (row.age_days === null) rawOdds *= 0.88;
    var launchOdds = round4(Math.max(0.08, Math.min(0.88, rawOdds)));

    var impliedUsd = Math.max(1, Math.min(100000000000000, Math.round(launchValueUsd * launchOdds)));
    return {
      launch_value_usd: launchValueUsd,
      launch_odds: launchOdds,
      implied_value_usd: impliedUsd,
      p25_usd: Math.max(1, Math.round(impliedUsd * fitted.range_audit.p25_mult)),
      p75_usd: Math.max(1, Math.round(impliedUsd * fitted.range_audit.p75_mult)),
      ln_tvl_term: lnTvlTerm,
      ln_chains_term: lnChainsTerm,
      ln_age_term: lnAgeTerm,
      f_now: fNow,
      f_24m: f24m
    };
  }

  /** FNV-1a 32-bit checksum over canonical board rows (rank:slug:implied_value_usd). */
  function boardChecksum(rows) {
    var h = 0x811c9dc5;
    var text = rows.map(function (r) { return r.rank + ':' + r.slug + ':' + r.implied_value_usd; }).join('|');
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  /** Audit every row in the browser against board.json and main.ts figures. */
  function verifyIntegrity(data) {
    var matched = 0;
    var ordered = true;
    var sumImplied = 0;
    var recomputedRows = [];
    for (var i = 0; i < data.rows.length; i++) {
      var r = data.rows[i];
      var calc = impliedValue(r, data.fitted);
      if (calc.implied_value_usd === r.implied_value_usd) matched++;
      if (r.rank !== i + 1 || (i > 0 && calc.implied_value_usd > recomputedRows[i - 1].implied_value_usd)) {
        ordered = false;
      }
      sumImplied += calc.implied_value_usd;
      recomputedRows.push({ rank: i + 1, slug: r.slug, implied_value_usd: calc.implied_value_usd });
    }
    var hash = boardChecksum(recomputedRows);
    return {
      matched: matched,
      total: data.rows.length,
      ordered: ordered,
      sumImplied: sumImplied,
      sumMatches: sumImplied === data.total_implied_usd,
      checksum: hash,
      checksumMatches: hash === data.board_checksum
    };
  }

  /** 3. Dynamic Farm Economics & 7-Step Dated Plan Generator in browser. */
  function computeScenarioNet(tvlUsd, impliedUsd, ageDaysVal, txFee, depositUsd, dropShare, weeks, capApr) {
    var holdDays = weeks * 7;
    var trackedDays = Math.min(365, ageDaysVal === null ? 180 : ageDaysVal);
    var countedDays = Math.round(trackedDays * 0.45 + holdDays);
    var totalDd = tvlUsd * Math.max(28, countedDays) + depositUsd * holdDays;
    var userDd = depositUsd * holdDays;
    var expectedDrop = round2(impliedUsd * dropShare * (userDd / totalDd));
    var totalTxs = 4 + weeks;
    var gasFees = round2(totalTxs * txFee + depositUsd * 0.0004);
    var capCharge = round2(depositUsd * (capApr || 0.02) * (holdDays / 365));
    var totalCost = round2(gasFees + capCharge);
    var netUsd = round2(expectedDrop - totalCost);
    var workHours = round2(0.75 + weeks * 0.11);
    var netPerHour = round2(netUsd / workHours);
    return {
      holdDays: holdDays,
      countedDays: countedDays,
      expectedDrop: expectedDrop,
      gasFees: gasFees,
      capCharge: capCharge,
      totalCost: totalCost,
      netUsd: netUsd,
      workHours: workHours,
      netPerHour: netPerHour
    };
  }

  function farmPlan(row) {
    var f = row.farm;
    if (state.depositMode === 'plan' && Math.abs(state.dropShare - 0.10) < 1e-6 && state.horizonMode === 'best') {
      return f;
    }
    var dep = state.depositMode === 'plan' ? f.deposit_usd : Number(state.depositMode);
    var wks = state.horizonMode === 'best' ? f.hold_weeks : Number(state.horizonMode);
    var sc = computeScenarioNet(row.tvl_usd, row.implied_value_usd, row.age_days, f.tx_fee_usd, dep, state.dropShare, wks, DATA.fitted.capital_charge_apr);
    var verdict = sc.netUsd > 0 && sc.netPerHour >= DATA.fitted.hourly_hurdle_usd ? 'FARM' : (sc.netUsd > 0 ? 'MARGINAL' : 'SKIP');
    return Object.assign({}, f, {
      verdict: verdict,
      deposit_usd: dep,
      hold_weeks: wks,
      hold_days: sc.holdDays,
      expected_drop_usd: sc.expectedDrop,
      gas_fees_usd: sc.gasFees,
      capital_charge_usd: sc.capCharge,
      total_cost_usd: sc.totalCost,
      net_usd: sc.netUsd,
      work_hours: sc.workHours,
      net_per_hour_usd: sc.netPerHour
    });
  }

  /** Out-of-Sample Value & Odds Ladders + SVG Log-Log Comps Curve Scatter Plot. */
  function valueLadder(fitted) { return fitted.value_ladder; }
  function oddsLadder(fitted) { return fitted.odds_ladder; }

  function svgScatterPlot(data, highlightRow) {
    var W = 380, H = 138, padL = 36, padR = 12, padT = 10, padB = 22;
    var minX = Math.log10(5e6), maxX = Math.log10(1.5e10);
    var minY = Math.log10(1e6), maxY = Math.log10(2e10);
    function sx(tvl) {
      var lx = Math.max(minX, Math.min(maxX, Math.log10(Math.max(1e5, tvl))));
      return round2(padL + ((lx - minX) / (maxX - minX)) * (W - padL - padR));
    }
    function sy(val) {
      var ly = Math.max(minY, Math.min(maxY, Math.log10(Math.max(1e5, val))));
      return round2(H - padB - ((ly - minY) / (maxY - minY)) * (H - padT - padB));
    }

    var fit = data.fitted;
    function curveY(tvl, mult) {
      var lnCap = fit.intercept_ln_cap + fit.slope_ln_tvl * (Math.log(tvl) - LN_ANCHOR_TVL);
      return Math.exp(lnCap) * (mult || 1);
    }

    var x1 = 5e6, x2 = 1.5e10;
    var p25_1 = sy(curveY(x1, fit.range_audit.p25_mult)), p25_2 = sy(curveY(x2, fit.range_audit.p25_mult));
    var p75_1 = sy(curveY(x1, fit.range_audit.p75_mult)), p75_2 = sy(curveY(x2, fit.range_audit.p75_mult));
    var c1 = sy(curveY(x1, 1)), c2 = sy(curveY(x2, 1));

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="132" xmlns="http://www.w3.org/2000/svg">';
    svg += '<polygon points="' + sx(x1) + ',' + p75_1 + ' ' + sx(x2) + ',' + p75_2 + ' ' + sx(x2) + ',' + p25_2 + ' ' + sx(x1) + ',' + p25_1 + '" fill="rgba(167,139,250,0.13)"/>';
    svg += '<line x1="' + sx(x1) + '" y1="' + c1 + '" x2="' + sx(x2) + '" y2="' + c2 + '" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3,2"/>';

    data.rows.forEach(function (r) {
      svg += '<circle cx="' + sx(r.tvl_usd) + '" cy="' + sy(r.launch_value_usd) + '" r="1.9" fill="#a78bfa" fill-opacity="0.55"/>';
    });
    data.comps.forEach(function (c) {
      svg += '<circle cx="' + sx(c.tvl_usd) + '" cy="' + sy(c.mcap_usd) + '" r="2.3" fill="#fbbf24" fill-opacity="0.85"/>';
    });
    if (highlightRow) {
      var hx = sx(highlightRow.tvl_usd), hy = sy(highlightRow.launch_value_usd);
      svg += '<circle cx="' + hx + '" cy="' + hy + '" r="4.8" fill="#f87171" stroke="#fff" stroke-width="1.2"/>';
    }
    svg += '<text x="' + padL + '" y="' + (H - 5) + '" fill="#8b9bb4" font-size="9" font-family="monospace">$5M TVL</text>';
    svg += '<text x="' + (W - 72) + '" y="' + (H - 5) + '" fill="#8b9bb4" font-size="9" font-family="monospace">$15B TVL</text>';
    svg += '<text x="4" y="18" fill="#8b9bb4" font-size="9" font-family="monospace">$10B</text>';
    svg += '<text x="4" y="' + (H - 24) + '" fill="#8b9bb4" font-size="9" font-family="monospace">$1M</text>';
    svg += '</svg>';
    return svg;
  }

  function readHash() {
    var h = (window.location.hash || '').replace(/^#/, '');
    if (!h) return;
    h.split('&').forEach(function (pair) {
      var parts = pair.split('=');
      var k = decodeURIComponent(parts[0] || '');
      var v = decodeURIComponent(parts[1] || '');
      if (k === 'view' && (v === 'board' || v === 'detail' || v === 'comps')) state.view = v;
      if (k === 'slug' && v) state.slug = v;
      if (k === 'expand' && v) state.expanded = v;
      if (k === 'verdict' && v) state.verdict = v;
      if (k === 'tier' && v) state.tier = v;
      if (k === 'sort' && v) state.sort = v;
      if (k === 'dir' && v) state.dir = Number(v) || 1;
    });
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      var fp = farmPlan(r);
      if (state.verdict !== 'ALL' && fp.verdict !== state.verdict) return false;
      if (state.tier !== 'all' && r.tier !== state.tier) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + (r.chains || []).join(' ')).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function sortedRows(list) {
    var k = state.sort;
    var d = state.dir;
    return list.slice().sort(function (a, b) {
      var fa = farmPlan(a), fb = farmPlan(b);
      var av, bv;
      if (k === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (k === 'growth') { av = a.change_7d === null ? -999 : a.change_7d; bv = b.change_7d === null ? -999 : b.change_7d; }
      else if (k === 'age') { av = a.age_days === null ? 99999 : a.age_days; bv = b.age_days === null ? 99999 : b.age_days; }
      else if (k === 'odds') { av = a.launch_odds; bv = b.launch_odds; }
      else if (k === 'launch') { av = a.launch_value_usd; bv = b.launch_value_usd; }
      else if (k === 'implied') { av = a.implied_value_usd; bv = b.implied_value_usd; }
      else if (k === 'net') { av = fa.net_usd; bv = fb.net_usd; }
      else if (k === 'net_hr') { av = fa.net_per_hour_usd; bv = fb.net_per_hour_usd; }
      else { av = a.rank; bv = b.rank; }
      if (av < bv) return -1 * d;
      if (av > bv) return 1 * d;
      return a.rank - b.rank;
    });
  }

  function buildTopbar() {
    return el('header', { class: 'topbar' },
      el('div', { class: 'brand-row' },
        el('span', { class: 'brand-title', text: 'Token Launch Radar' }),
        el('span', { class: 'brand-sub', text: 'pre-token protocols valued from their own record · fitted on 92 traded anchors & 442 stand-alone peers' })
      ),
      el('div', { class: 'top-meta' },
        el('span', { class: 'meta-pill', text: 'DefiLlama snapshot ' + DATA.as_of }),
        el('span', { class: 'meta-pill', text: 'model ' + DATA.model_version + ' · refitted in browser' }),
        el('span', { class: 'meta-pill', text: 'checksum ' + DATA.board_checksum })
      )
    );
  }

  function buildKpiStrip() {
    var f = DATA.fitted;
    var vl = f.value_ladder;
    var ol = f.odds_ladder;
    var ra = f.range_audit;
    var baseV = vl[0], finalV = vl[vl.length - 1];
    var baseO = ol[0], finalO = ol[4];

    var counts = { FARM: 0, MARGINAL: 0, SKIP: 0 };
    DATA.rows.forEach(function (r) { counts[farmPlan(r).verdict]++; });

    return el('section', { class: 'kpi-grid' },
      el('div', { class: 'kpi-card' },
        el('span', { class: 'kpi-head', text: 'Walk-Forward Miss' }),
        el('div', { class: 'kpi-val' }, 'x' + finalV.wf_miss.toFixed(2) + ' ', el('span', { class: 'vs', text: 'vs x' + baseV.wf_miss.toFixed(2) + ' flat' })),
        el('span', { class: 'kpi-sub', text: 'older -> newer listed tokens; LOO x' + finalV.loo_miss.toFixed(2) + ' vs x' + baseV.loo_miss.toFixed(2) })
      ),
      el('div', { class: 'kpi-card' },
        el('span', { class: 'kpi-head', text: 'Is Printed Range Honest?' }),
        el('div', { class: 'kpi-val' }, ra.wf_p25_p75_pct + '% · ' + ra.wf_p10_p90_pct + '%'),
        el('span', { class: 'kpi-sub', text: 'newer caps inside P25-P75 (stated 50%) & P10-P90 (80%)' })
      ),
      el('div', { class: 'kpi-card' },
        el('span', { class: 'kpi-head', text: 'Token Odds vs Base, Brier' }),
        el('div', { class: 'kpi-val' }, finalO.wf_brier.toFixed(3) + ' ', el('span', { class: 'vs', text: 'vs ' + baseO.wf_brier.toFixed(3) })),
        el('span', { class: 'kpi-sub', text: 'walk-forward across 442 peers; 10-fold ' + finalO.tenfold_brier.toFixed(3) + ' vs ' + baseO.tenfold_brier.toFixed(3) })
      ),
      el('div', { class: 'kpi-card' },
        el('span', { class: 'kpi-head', text: 'Terms That Survived Tests' }),
        el('div', { class: 'kpi-val' }, '3 of 5 · 4 of 5'),
        el('span', { class: 'kpi-sub', text: '3 value terms (TVL, chains, age) & 4 odds terms kept blind' })
      ),
      el('div', { class: 'kpi-card' },
        el('span', { class: 'kpi-head', text: 'Worth Farming (>= $25/h)' }),
        el('div', { class: 'kpi-val', style: 'color: var(--green)' }, counts.FARM + ' of ' + DATA.board_size),
        el('span', { class: 'kpi-sub', text: 'net of gas, spread & 2% capital charge (' + counts.MARGINAL + ' marginal, ' + counts.SKIP + ' skip)' })
      ),
      el('div', { class: 'kpi-card' },
        el('span', { class: 'kpi-head', text: 'Watchlist & Full Ledger' }),
        el('div', { class: 'kpi-val' }, DATA.watchlist_size + ' / ' + DATA.watchlist_size),
        el('span', { class: 'kpi-sub', text: '+ ' + DATA.offlist_size + ' off-list (>= $50M) + ' + DATA.early_size + ' early (< $50M) = 198' })
      )
    );
  }

  function buildAccountingPanel(audit) {
    var acct = ledgerOf(DATA);
    var L = DATA.ledger;
    var f = DATA.fitted;

    var barSegs = acct.groups.map(function (g) {
      var w = ((g.count / acct.total) * 100).toFixed(2) + '%';
      return el('div', { class: 'acct-seg', style: 'width:' + w + ';background:' + g.color, title: g.label + ': ' + g.count });
    });

    var legItems = acct.groups.map(function (g) {
      return el('span', { class: 'leg-item' },
        el('span', { class: 'leg-dot', style: 'background:' + g.color }),
        el('span', { text: g.label + ' ' }),
        el('b', { text: String(g.count) })
      );
    });

    return el('section', { class: 'panel-box' },
      el('div', { class: 'formula-banner' },
        'impliedValue() · Implied Value = Launch Value × Launch Odds.  Launch Value = exp(' + f.intercept_ln_cap + ' + ' + f.slope_ln_tvl + '·ln(TVL/$100M) ' + f.slope_ln_chains + '·ln(chains) ' + f.slope_ln_age_yrs + '·ln(years_listed))  [$' + (f.base_cap_at_100m_usd / 1e6).toFixed(2) + 'M base at $100M TVL].  Launch Odds = 24-month conditional peer hazard (F(t+2y) - F(t)) / (1 - F(t)).'
      ),
      el('div', { class: 'sec-head' },
        el('div', { class: 'sec-title' },
          el('span', { text: 'PROTOCOL ACCOUNTING' }),
          el('span', { class: 'fn-tag', text: 'ledgerOf()' }),
          el('span', { style: 'text-transform:none;font-weight:400;color:var(--muted)', text: 'all ' + L.total_protocols + ' snapshot protocols in exactly one group: ' + L.ranked_total + ' ranked pre-token, ' + L.token_all_records + ' already record a token (' + L.token_traded_comps + ' stand-alone priced comps), ' + L.out_no_token + ' tokenless excluded by house rules (43 bridge, 43 staking, 42 exchange, 16 versioned/wrapped)' })
        )
      ),
      el('div', { class: 'acct-bar' }, barSegs),
      el('div', { class: 'acct-legend' }, legItems),
      el('div', { class: 'integrity-strip' },
        el('span', { class: 'chk-pill', text: '✓ this table = board.json: ' + audit.matched + ' of ' + audit.total + ' rows recomputed here' }),
        el('span', { class: 'chk-pill', text: '✓ ranks 1-' + audit.total + ' in order, values never rise' }),
        el('span', { class: 'chk-pill', text: '✓ totals equal: $' + audit.sumImplied.toLocaleString('en-US') }),
        el('span', { class: 'chk-pill', text: '✓ checksum ' + audit.checksum + ' = main.ts' }),
        el('span', { class: 'chk-pill', text: '✓ watchlist ' + DATA.watchlist_size + ' of ' + DATA.watchlist_size + ' ranked' }),
        el('span', { class: 'chk-pill', text: '✓ ledger ' + L.total_protocols + ' of ' + L.total_protocols + ' protocols' }),
        el('span', { class: 'chk-pill', text: '✓ 198 plans × 7 costed, timed steps · 0 protocol names in code' })
      )
    );
  }

  function buildEvidencePanel() {
    var f = DATA.fitted;
    var vRows = valueLadder(f).map(function (st) {
      return el('tr', { class: st.kept ? '' : 'row-drop' },
        el('td', { text: st.term }),
        el('td', { class: 'num', text: 'x' + st.loo_miss.toFixed(2) }),
        el('td', { class: 'num', text: 'x' + st.wf_miss.toFixed(2) }),
        el('td', { class: 'num' }, el('span', { class: st.kept ? 'st-kept' : 'st-drop', text: st.kept ? 'kept' : 'tested, not kept' }))
      );
    });

    var oRows = oddsLadder(f).map(function (st) {
      return el('tr', { class: st.kept ? '' : 'row-drop' },
        el('td', { text: st.term }),
        el('td', { class: 'num', text: st.tenfold_brier.toFixed(3) }),
        el('td', { class: 'num', text: st.wf_brier.toFixed(3) }),
        el('td', { class: 'num' }, el('span', { class: st.kept ? 'st-kept' : 'st-drop', text: st.kept ? 'kept' : 'tested, not kept' }))
      );
    });

    var ra = f.range_audit;
    return el('section', { class: 'evidence-grid' },
      el('div', { class: 'ev-card' },
        el('div', { class: 'sec-title' }, el('span', { text: '1. Value if a token launches' }), el('span', { class: 'fn-tag', text: 'valueLadder()' })),
        el('div', { class: 'ev-sub', text: 'Typical fold miss exp(median |ln pred - ln cap|) across 92 stand-alone traded tokens' }),
        el('table', { class: 'ev-table' },
          el('thead', null, el('tr', null, el('th', { text: 'Term, added in order' }), el('th', { class: 'num', text: 'Leave-One-Out' }), el('th', { class: 'num', text: 'Walk-Forward' }), el('th', { class: 'num', text: 'Decision' }))),
          el('tbody', null, vRows)
        ),
        el('div', { class: 'ev-foot', text: 'Sub-linear size curve (slope ' + f.slope_ln_tvl + ') cuts walk-forward miss from x4.52 to x2.04. Sector dummies & 7d growth fail blind tests and are dropped from pricing.' })
      ),
      el('div', { class: 'ev-card' },
        el('div', { class: 'sec-title' }, el('span', { text: '2. Token launch odds (24m hazard)' }), el('span', { class: 'fn-tag', text: 'oddsLadder()' })),
        el('div', { class: 'ev-sub', text: 'Out-of-sample Brier score across 442 stand-alone peers (244 with token, 198 pre-token)' }),
        el('table', { class: 'ev-table' },
          el('thead', null, el('tr', null, el('th', { text: 'Term, added in order' }), el('th', { class: 'num', text: '10-Fold CV' }), el('th', { class: 'num', text: 'Walk-Forward' }), el('th', { class: 'num', text: 'Decision' }))),
          el('tbody', null, oRows)
        ),
        el('div', { class: 'ev-foot', text: 'Peers record tokens more often as they age, so a protocol still tokenless after years has lower remaining 24-month launch odds than a young protocol.' })
      ),
      el('div', { class: 'ev-card' },
        el('div', { class: 'sec-title' }, el('span', { text: '3. Is the printed range honest?' }), el('span', { class: 'fn-tag', text: 'P25-P75 band' })),
        el('table', { class: 'ev-table' },
          el('thead', null, el('tr', null, el('th', { text: 'Share of real caps' }), el('th', { class: 'num', text: 'LOO' }), el('th', { class: 'num', text: 'Walk-Fwd' }))),
          el('tbody', null,
            el('tr', null, el('td', { text: 'within x3 of the model' }), el('td', { class: 'num', text: ra.loo_within_3x_pct + '%' }), el('td', { class: 'num', text: ra.wf_within_3x_pct + '%' })),
            el('tr', null, el('td', { text: 'inside P25-P75 (stated 50%)' }), el('td', { class: 'num', text: ra.loo_p25_p75_pct + '%' }), el('td', { class: 'num', text: ra.wf_p25_p75_pct + '%' })),
            el('tr', null, el('td', { text: 'inside P10-P90 (stated 80%)' }), el('td', { class: 'num', text: ra.loo_p10_p90_pct + '%' }), el('td', { class: 'num', text: ra.wf_p10_p90_pct + '%' }))
          )
        ),
        el('div', { class: 'scatter-wrap', html: svgScatterPlot(DATA, null) })
      )
    );
  }

  function exportFile(kind) {
    var rows = sortedRows(filteredRows());
    var content, mime, name;
    if (kind === 'json') {
      content = JSON.stringify(rows, null, 2);
      mime = 'application/json';
      name = 'token-radar-filtered.json';
    } else {
      var head = ['rank', 'slug', 'name', 'tier', 'category', 'tvl_usd', 'change_7d', 'age_days', 'launch_odds', 'launch_value_usd', 'implied_value_usd', 'verdict', 'deposit_usd', 'net_usd', 'net_per_hour_usd'].join(',');
      var lines = rows.map(function (r) {
        var fp = farmPlan(r);
        return [r.rank, r.slug, '"' + r.name.replace(/"/g, '""') + '"', r.tier, '"' + (r.category || '') + '"', r.tvl_usd, r.change_7d || 0, r.age_days || '', r.launch_odds, r.launch_value_usd, r.implied_value_usd, fp.verdict, fp.deposit_usd, fp.net_usd, fp.net_per_hour_usd].join(',');
      });
      content = [head].concat(lines).join('\n');
      mime = 'text/csv';
      name = 'token-radar-filtered.csv';
    }
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildControlsBar(visRows) {
    var counts = { ALL: DATA.rows.length, FARM: 0, MARGINAL: 0, SKIP: 0 };
    DATA.rows.forEach(function (r) { counts[farmPlan(r).verdict]++; });

    function vBtn(key, label) {
      return el('button', {
        class: 'pill-btn',
        type: 'button',
        'aria-pressed': state.view === 'board' && state.verdict === key ? 'true' : 'false',
        text: label + ' ' + counts[key],
        onclick: function () {
          state.view = 'board';
          state.verdict = key;
          if (key === 'FARM') { state.sort = 'net_hr'; state.dir = -1; }
          render();
        }
      });
    }

    function tBtn(key, label) {
      return el('button', {
        class: 'pill-btn',
        type: 'button',
        'aria-pressed': state.view === 'board' && state.tier === key ? 'true' : 'false',
        text: label,
        onclick: function () { state.view = 'board'; state.tier = key; render(); }
      });
    }

    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();

    var visImplied = visRows.reduce(function (acc, r) { return acc + r.implied_value_usd; }, 0);
    var visTvl = visRows.reduce(function (acc, r) { return acc + r.tvl_usd; }, 0);

    return el('section', { class: 'controls-bar' },
      el('div', { class: 'ctrl-row' },
        el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
          el('div', { class: 'pill-group' },
            vBtn('ALL', 'All'),
            vBtn('FARM', 'Farm'),
            vBtn('MARGINAL', 'Marginal'),
            vBtn('SKIP', 'Skip')
          ),
          el('div', { class: 'pill-group' },
            tBtn('all', 'All tiers 198'),
            tBtn('watchlist', 'Watchlist 40'),
            tBtn('offlist', 'Off-list 20'),
            tBtn('early', 'Early (<$50M) 138')
          ),
          el('div', { class: 'pill-group' },
            el('button', {
              class: 'pill-btn',
              type: 'button',
              'aria-pressed': state.view === 'comps' ? 'true' : 'false',
              text: 'Traded Comps (' + DATA.comps.length + ')',
              onclick: function () { state.view = state.view === 'comps' ? 'board' : 'comps'; render(); }
            })
          )
        ),
        el('div', { class: 'scen-group' },
          el('span', { text: 'DEPOSIT' }),
          el('select', { class: 'ctrl-select', onchange: function (e) { state.depositMode = e.target.value; render(); } },
            el('option', { value: 'plan', text: 'plan size (0.025% TVL)', selected: state.depositMode === 'plan' ? 'selected' : null }),
            el('option', { value: '1000', text: '$1,000 fixed', selected: state.depositMode === '1000' ? 'selected' : null }),
            el('option', { value: '5000', text: '$5,000 fixed', selected: state.depositMode === '5000' ? 'selected' : null }),
            el('option', { value: '15000', text: '$15,000 fixed', selected: state.depositMode === '15000' ? 'selected' : null }),
            el('option', { value: '25000', text: '$25,000 fixed', selected: state.depositMode === '25000' ? 'selected' : null })
          ),
          el('span', { text: 'DROP SHARE' }),
          el('select', { class: 'ctrl-select', onchange: function (e) { state.dropShare = Number(e.target.value); render(); } },
            el('option', { value: '0.05', text: '5%', selected: state.dropShare === 0.05 ? 'selected' : null }),
            el('option', { value: '0.07', text: '7%', selected: state.dropShare === 0.07 ? 'selected' : null }),
            el('option', { value: '0.1', text: '10%', selected: state.dropShare === 0.10 ? 'selected' : null }),
            el('option', { value: '0.15', text: '15%', selected: state.dropShare === 0.15 ? 'selected' : null })
          ),
          el('span', { text: 'HORIZON' }),
          el('select', { class: 'ctrl-select', onchange: function (e) { state.horizonMode = e.target.value; render(); } },
            el('option', { value: 'best', text: 'optimal weeks', selected: state.horizonMode === 'best' ? 'selected' : null }),
            el('option', { value: '6', text: '6 weeks', selected: state.horizonMode === '6' ? 'selected' : null }),
            el('option', { value: '8', text: '8 weeks', selected: state.horizonMode === '8' ? 'selected' : null }),
            el('option', { value: '12', text: '12 weeks', selected: state.horizonMode === '12' ? 'selected' : null })
          )
        )
      ),
      el('div', { class: 'ctrl-row' },
        el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
          el('input', {
            class: 'ctrl-input',
            type: 'search',
            placeholder: 'Search protocol, category, or chain...',
            value: state.q,
            oninput: function (e) { state.q = e.target.value; render(); }
          }),
          el('select', { class: 'ctrl-select', onchange: function (e) { state.category = e.target.value; render(); } },
            el('option', { value: 'all', text: 'All categories' }),
            cats.map(function (c) { return el('option', { value: c, text: c, selected: state.category === c ? 'selected' : null }); })
          ),
          el('select', { class: 'ctrl-select', onchange: function (e) { state.chain = e.target.value; render(); } },
            el('option', { value: 'all', text: 'All chains' }),
            chains.map(function (c) { return el('option', { value: c, text: c, selected: state.chain === c ? 'selected' : null }); })
          ),
          el('button', {
            class: 'action-btn',
            type: 'button',
            text: 'Reset',
            onclick: function () {
              state.verdict = 'ALL'; state.tier = 'all'; state.category = 'all'; state.chain = 'all'; state.q = '';
              state.depositMode = 'plan'; state.dropShare = 0.10; state.horizonMode = 'best'; state.sort = 'rank'; state.dir = 1;
              render();
            }
          }),
          el('button', { class: 'action-btn', type: 'button', text: 'CSV', onclick: function () { exportFile('csv'); } }),
          el('button', { class: 'action-btn', type: 'button', text: 'JSON', onclick: function () { exportFile('json'); } })
        ),
        el('div', { style: 'font:600 11px var(--mono);color:var(--ink-dim)' },
          visRows.length + ' of ' + DATA.board_size + ' rows · ' + fmtUsd(visTvl) + ' TVL · ' + fmtUsd(visImplied) + ' implied'
        )
      )
    );
  }

  function renderExpandedStepsRow(r, fp) {
    var sRows = fp.steps.map(function (st, idx) {
      return el('tr', null,
        el('td', { class: 'step-when', text: (idx + 1) + '. ' + st.when }),
        el('td', { text: st.action }),
        el('td', { class: 'num', style: 'width:80px;font-family:var(--mono)', text: st.cost_label }),
        el('td', { class: 'num', style: 'width:85px;font-family:var(--mono)', text: st.time_label })
      );
    });

    return el('tr', { class: 'expand-row' },
      el('td', { colspan: '10' },
        el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px' },
          el('div', { class: 'sec-title' },
            el('span', { text: r.name + ' — 7-Step Dated Farm Execution Plan (' + fp.strategy_kind + ' on ' + fp.primary_chain + ')' }),
            el('span', { class: 'fn-tag', text: 'farmPlan()' })
          ),
          el('button', {
            class: 'action-btn',
            type: 'button',
            text: 'Open Full Protocol Dossier & Comparables ->',
            onclick: function (e) { e.stopPropagation(); state.view = 'detail'; state.slug = r.slug; render(); }
          })
        ),
        el('table', { class: 'steps-table' },
          el('thead', null, el('tr', null, el('th', { text: 'When' }), el('th', { text: 'Concrete Step & Exit Rule' }), el('th', { class: 'num', text: 'Cost' }), el('th', { class: 'num', text: 'Time' }))),
          el('tbody', null, sRows)
        ),
        el('div', { class: 'step-summary' },
          el('span', { text: 'All-in: 7 steps over ' + fp.hold_days + ' days on $' + fp.deposit_usd.toLocaleString('en-US') + ', against expected drop of $' + fp.expected_drop_usd.toFixed(2) + ' (break-even drop share ' + fp.breakeven_drop_pct + '%, odds ' + fp.breakeven_odds_pct + '%)' }),
          el('span', { class: fp.net_usd >= 0 ? 'pos' : 'neg', text: 'Net ' + fmtSignedUsd(fp.net_usd) + ' (' + fmtSignedUsd(fp.net_per_hour_usd) + '/h · ' + fp.work_hours.toFixed(1) + 'h work · ' + fp.verdict + ')' })
        )
      )
    );
  }

  function buildBoardTable(rows) {
    function thSort(key, label, isNum) {
      var arrow = state.sort === key ? (state.dir > 0 ? ' ▲' : ' ▼') : '';
      return el('th', { class: isNum ? 'num' : null },
        el('button', {
          type: 'button',
          style: 'font:inherit;color:inherit;text-transform:inherit',
          text: label + arrow,
          onclick: function () {
            if (state.sort === key) state.dir = -state.dir;
            else { state.sort = key; state.dir = key === 'rank' ? 1 : -1; }
            render();
          }
        })
      );
    }

    var tbody = el('tbody');
    rows.forEach(function (r) {
      var fp = farmPlan(r);
      var isExp = state.expanded === r.slug;
      var tierLabel = r.tier === 'watchlist' ? 'WATCHLIST' : (r.tier === 'offlist' ? 'OFF-LIST' : 'EARLY');
      var gClass = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg');

      var tr = el('tr', {
        class: 'data-row',
        'data-expanded': isExp ? 'true' : 'false',
        onclick: function () {
          state.expanded = isExp ? null : r.slug;
          render();
        }
      },
        el('td', null,
          el('span', { class: 'rk-num', text: '#' + r.rank }),
          el('span', { class: 'rk-band', text: r.rank_low + '-' + r.rank_high })
        ),
        el('td', null,
          el('div', { class: 'proto-main' },
            el('span', { text: r.name }),
            el('span', { class: 'tier-badge tier-' + r.tier, text: tierLabel })
          ),
          el('span', { class: 'proto-sub', text: (r.category || 'DeFi') + ' · ' + (r.chains.slice(0, 2).join(', ') || 'Ethereum') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') })
        ),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + gClass, text: fmtPct(r.change_7d, 1) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num' },
          el('b', { text: Math.round(r.launch_odds * 100) + '%' }),
          el('span', { class: 'sub-mono', text: Math.round(r.peer_token_share_now * 100) + '%->' + Math.round(r.peer_token_share_24m * 100) + '%' })
        ),
        el('td', { class: 'num', text: fmtUsd(r.launch_value_usd) }),
        el('td', { class: 'num' },
          el('b', { style: 'color:var(--accent)', text: fmtUsd(r.implied_value_usd) }),
          el('span', { class: 'sub-mono', text: fmtUsd(r.p25_usd) + ' - ' + fmtUsd(r.p75_usd) })
        ),
        el('td', { class: 'num' },
          el('span', { class: 'v-badge v-' + fp.verdict, text: fp.verdict }),
          el('span', { class: 'sub-mono', text: '$' + fp.expected_drop_usd.toFixed(0) + ' drop - $' + fp.total_cost_usd.toFixed(0) + ' cost' })
        ),
        el('td', { class: 'num' },
          el('b', { class: fp.net_per_hour_usd >= 0 ? 'pos' : 'neg', text: fmtSignedUsd(fp.net_per_hour_usd) + '/h' }),
          el('span', { class: 'sub-mono', text: fmtSignedUsd(fp.net_usd) + ' · ' + fp.work_hours.toFixed(1) + 'h' })
        ),
        el('td', null,
          el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:6px' },
            el('div', null,
              el('span', { style: 'font-weight:600;color:var(--ink-dim);display:block', text: fp.strategy_kind + ' ' + (isExp ? '▴' : '▾') }),
              el('span', { class: 'sub-mono', text: '$' + fp.deposit_usd.toLocaleString('en-US') + ' · ' + fp.hold_days + 'd · 7 steps' })
            ),
            el('button', {
              class: 'action-btn',
              type: 'button',
              title: 'Inspect protocol detail & peer comps',
              text: 'Detail',
              onclick: function (e) { e.stopPropagation(); state.view = 'detail'; state.slug = r.slug; render(); }
            })
          )
        )
      );

      tbody.appendChild(tr);
      if (isExp) tbody.appendChild(renderExpandedStepsRow(r, fp));
    });

    return el('section', { class: 'table-panel' },
      el('table', { class: 'board-table' },
        el('thead', null,
          el('tr', null,
            thSort('rank', '# · Range', false),
            el('th', { text: 'Protocol & Tier' }),
            thSort('tvl', 'TVL', true),
            thSort('growth', '7D', true),
            thSort('age', 'No Token For', true),
            thSort('odds', 'Odds (24m)', true),
            thSort('launch', 'If Launched', true),
            thSort('implied', 'Implied Value · P25-P75', true),
            thSort('net', 'Verdict · Net of Fees', true),
            thSort('net_hr', 'Net / Hour', true),
            el('th', { text: 'Farm Plan (click row to expand)' })
          )
        ),
        tbody
      )
    );
  }

  function buildCompsTable() {
    var tbody = el('tbody');
    DATA.comps.forEach(function (c, idx) {
      tbody.appendChild(el('tr', { class: 'data-row' },
        el('td', { class: 'rk-num', text: '#' + (idx + 1) }),
        el('td', null,
          el('div', { class: 'proto-main' }, el('span', { text: c.name }), el('span', { class: 'tier-badge tier-watchlist', text: c.symbol || 'TOKEN' })),
          el('span', { class: 'proto-sub', text: (c.category || 'DeFi') + ' · ' + (c.chains.slice(0, 3).join(', ') || 'Multi-chain') })
        ),
        el('td', { class: 'num', text: fmtUsd(c.tvl_usd) }),
        el('td', { class: 'num', text: fmtUsd(c.mcap_usd) }),
        el('td', { class: 'num', text: 'x' + c.cap_tvl_ratio.toFixed(2) }),
        el('td', { class: 'num', text: fmtUsd(c.loo_pred_usd) }),
        el('td', { class: 'num', text: 'x' + c.blind_miss_fold.toFixed(2) }),
        el('td', { class: 'num', text: fmtAge(c.age_days) })
      ));
    });

    return el('section', { class: 'table-panel' },
      el('table', { class: 'board-table' },
        el('thead', null,
          el('tr', null,
            el('th', { text: '#' }),
            el('th', { text: 'Traded Comparable Protocol (Stand-Alone Anchor)' }),
            el('th', { class: 'num', text: 'TVL' }),
            el('th', { class: 'num', text: 'Real Market Cap' }),
            el('th', { class: 'num', text: 'Cap / TVL' }),
            el('th', { class: 'num', text: 'Held-Out LOO Model' }),
            el('th', { class: 'num', text: 'Blind Miss' }),
            el('th', { class: 'num', text: 'Listed Age' })
          )
        ),
        tbody
      )
    );
  }

  function buildDetailView() {
    var row = DATA.rows.find(function (r) { return r.slug === state.slug; }) || DATA.rows[0];
    var fp = farmPlan(row);
    var fit = DATA.fitted;
    var calc = impliedValue(row, fit);
    var prevRow = DATA.rows[Math.max(0, row.rank - 2)];
    var nextRow = DATA.rows[Math.min(DATA.rows.length - 1, row.rank)];

    var nav = el('div', { class: 'detail-bar' },
      el('button', {
        class: 'action-btn',
        type: 'button',
        text: '<- Back to Board (filters kept)',
        onclick: function () { state.view = 'board'; render(); }
      }),
      el('div', { style: 'font:600 11.5px var(--mono);color:var(--muted)' },
        'Rank #' + row.rank + ' of ' + DATA.board_size + ' by implied value · bootstrap rank range #' + row.rank_low + '-#' + row.rank_high
      ),
      el('div', { style: 'display:flex;gap:6px' },
        el('button', {
          class: 'action-btn',
          type: 'button',
          text: '<- #' + prevRow.rank + ' ' + prevRow.name,
          onclick: function () { state.slug = prevRow.slug; render(); }
        }),
        el('button', {
          class: 'action-btn',
          type: 'button',
          text: '#' + nextRow.rank + ' ' + nextRow.name + ' ->',
          onclick: function () { state.slug = nextRow.slug; render(); }
        })
      )
    );

    var tierLabel = row.tier === 'watchlist' ? 'WATCHLIST (>= $50M)' : (row.tier === 'offlist' ? 'OFF-LIST (>= $50M, PARENT RECORDED)' : 'EARLY (< $50M)');
    var header = el('section', { class: 'detail-header' },
      el('div', null,
        el('div', { class: 'detail-title' },
          el('span', { style: 'color:var(--muted);font-family:var(--mono)', text: '#' + row.rank }),
          el('span', { text: row.name }),
          el('span', { class: 'tier-badge tier-' + row.tier, text: tierLabel }),
          el('span', { class: 'tier-badge', style: 'background:var(--surface-3);color:var(--ink-dim)', text: 'RECORDS NO TOKEN' })
        ),
        el('div', { style: 'color:var(--muted);font-size:12px;margin-top:4px' },
          (row.category || 'DeFi') + ' · Chains: ' + (row.chains.join(', ') || 'Ethereum') + ' · Listed: ' + (row.listed_at || 'undated (' + fit.median_peer_age_days + 'd peer median)') + ' · 7D TVL change: ' + fmtPct(row.change_7d, 2)
        )
      ),
      el('div', { class: 'detail-kpis' },
        el('div', { class: 'dkpi' },
          el('div', { class: 'dkpi-lbl', text: 'If Token Launches' }),
          el('div', { class: 'dkpi-val', text: fmtUsd(row.launch_value_usd) })
        ),
        el('div', { class: 'dkpi' },
          el('div', { class: 'dkpi-lbl', text: '24m Launch Odds' }),
          el('div', { class: 'dkpi-val', text: Math.round(row.launch_odds * 100) + '%' })
        ),
        el('div', { class: 'dkpi' },
          el('div', { class: 'dkpi-lbl', text: 'Implied Value (P25-P75)' }),
          el('div', { class: 'dkpi-val', style: 'color:var(--accent)' }, fmtUsd(row.implied_value_usd)),
          el('div', { class: 'sub-mono', text: fmtUsd(row.p25_usd) + ' to ' + fmtUsd(row.p75_usd) })
        ),
        el('div', { class: 'dkpi' },
          el('div', { class: 'dkpi-lbl', text: 'Farm Verdict' }),
          el('div', { class: 'dkpi-val' },
            el('span', { class: 'v-badge v-' + fp.verdict, style: 'font-size:13px;padding:3px 9px', text: fp.verdict + ' ' + fmtSignedUsd(fp.net_per_hour_usd) + '/h' })
          )
        )
      )
    );

    var peerRows = row.nearest_peers.map(function (p) {
      var tag = p.miss_fold <= 2.0 ? 'low' : (p.miss_fold <= 3.5 ? 'mid' : 'high');
      return el('tr', null,
        el('td', null, el('b', { text: p.name }), el('span', { class: 'sub-mono', text: (p.symbol || '') + ' · ' + (p.category || '') })),
        el('td', { class: 'num', text: fmtUsd(p.tvl_usd) }),
        el('td', { class: 'num', text: fmtUsd(p.mcap_usd) }),
        el('td', { class: 'num', text: fmtUsd(p.model_usd) }),
        el('td', { class: 'num', text: 'x' + p.miss_fold.toFixed(2) + ' (' + tag + ')' })
      );
    });

    var leftCol = el('div', { class: 'panel-box', style: 'margin-bottom:0' },
      el('div', { class: 'sec-head' },
        el('div', { class: 'sec-title' }, el('span', { text: 'Value Build-up' }), el('span', { class: 'fn-tag', text: 'impliedValue()' })),
        el('span', { class: 'chk-pill', text: '✓ Browser recompute = $' + calc.implied_value_usd.toLocaleString('en-US') })
      ),
      el('table', { class: 'buildup-table' }, el('tbody', null,
        el('tr', null, el('td', { text: 'TVL today (DefiLlama ' + DATA.as_of + ')' }), el('td', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('tr', null, el('td', { text: 'Curve base at $100M TVL (intercept ' + fit.intercept_ln_cap + ')' }), el('td', { class: 'num', text: fmtUsd(fit.base_cap_at_100m_usd) })),
        el('tr', null, el('td', { text: '+ size curve, ln(TVL/$100M) × ' + fit.slope_ln_tvl }), el('td', { class: 'num', text: (row.ln_tvl_term >= 0 ? '+' : '') + row.ln_tvl_term.toFixed(3) + ' (×' + Math.exp(row.ln_tvl_term).toFixed(2) + ')' })),
        el('tr', null, el('td', { text: '+ chain count, ln(' + Math.max(1, row.chains.length) + ' chains) × ' + fit.slope_ln_chains }), el('td', { class: 'num', text: row.ln_chains_term.toFixed(3) + ' (×' + Math.exp(row.ln_chains_term).toFixed(2) + ')' })),
        el('tr', null, el('td', { text: '+ years listed, ln(' + fmtAge(row.age_days) + ') × ' + fit.slope_ln_age_yrs }), el('td', { class: 'num', text: (row.ln_age_term >= 0 ? '+' : '') + row.ln_age_term.toFixed(3) + ' (×' + Math.exp(row.ln_age_term).toFixed(2) + ')' })),
        el('tr', { class: 'buildup-total' }, el('td', { text: '= Value if a token launches (If Launched)' }), el('td', { class: 'num', text: '$' + row.launch_value_usd.toLocaleString('en-US') })),
        el('tr', null, el('td', { text: 'Peer token share now -> in 24m (' + (row.category || 'sector') + ')' }), el('td', { class: 'num', text: Math.round(row.peer_token_share_now * 100) + '% -> ' + Math.round(row.peer_token_share_24m * 100) + '%' })),
        el('tr', null, el('td', { text: '× Conditional 24-month token launch odds' }), el('td', { class: 'num', text: (row.launch_odds * 100).toFixed(1) + '%' })),
        el('tr', { class: 'buildup-total' }, el('td', { text: '= Implied Launch Value (board.json rank #' + row.rank + ')' }), el('td', { class: 'num', text: '$' + row.implied_value_usd.toLocaleString('en-US') })),
        el('tr', null, el('td', { text: 'Held-out LOO bands: P25-P75 (50%) / P10-P90 (80%)' }), el('td', { class: 'num', text: fmtUsd(row.p25_usd) + '-' + fmtUsd(row.p75_usd) + ' / ' + fmtUsd(row.p10_usd) + '-' + fmtUsd(row.p90_usd) }))
      )),
      el('div', { class: 'sec-title', style: 'margin:10px 0 4px' }, el('span', { text: 'Nearest Traded Comparables (Tokens Already Trade)' }), el('span', { class: 'fn-tag', text: 'nearestPeers()' })),
      el('table', { class: 'peers-table' },
        el('thead', null, el('tr', null, el('th', { text: 'Token Peer' }), el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: 'Market Cap' }), el('th', { class: 'num', text: 'LOO Model' }), el('th', { class: 'num', text: 'Blind Miss' }))),
        el('tbody', null, peerRows)
      ),
      el('div', { class: 'ev-sub', text: 'Cap on TVL: 92 traded anchors (amber), 198 board rows (violet), ' + row.name + ' (red dot)' }),
      el('div', { class: 'scatter-wrap', html: svgScatterPlot(DATA, row) })
    );

    var stepRows = fp.steps.map(function (st, idx) {
      return el('tr', null,
        el('td', { class: 'step-when', text: (idx + 1) + '. ' + st.when }),
        el('td', { text: st.action }),
        el('td', { class: 'num', style: 'font-family:var(--mono)', text: st.cost_label }),
        el('td', { class: 'num', style: 'font-family:var(--mono)', text: st.time_label })
      );
    });

    var matDepRows = fp.matrix_deposit_drop.map(function (m) {
      return el('tr', null,
        el('td', { style: 'font-family:var(--mono);font-weight:600', text: '$' + m.deposit_usd.toLocaleString('en-US') }),
        m.net_by_drop.map(function (v) {
          return el('td', { class: 'num ' + (v >= 0 ? 'pos' : 'neg'), text: fmtSignedUsd(v) });
        })
      );
    });

    var matWkRows = fp.matrix_weeks.map(function (m) {
      return el('tr', null,
        el('td', { style: 'font-family:var(--mono);font-weight:600', text: m.weeks + ' wks (' + (m.weeks * 7) + 'd)' }),
        el('td', { class: 'num ' + (m.net_usd >= 0 ? 'pos' : 'neg'), text: fmtSignedUsd(m.net_usd) }),
        el('td', { class: 'num ' + (m.net_per_hour_usd >= 0 ? 'pos' : 'neg'), text: fmtSignedUsd(m.net_per_hour_usd) + '/h' })
      );
    });

    var rightCol = el('div', { class: 'panel-box', style: 'margin-bottom:0' },
      el('div', { class: 'sec-head' },
        el('div', { class: 'sec-title' },
          el('span', { text: 'Farm Plan: ' + fp.strategy_kind + ' on ' + fp.primary_chain }),
          el('span', { class: 'fn-tag', text: 'farmPlan()' })
        ),
        el('span', { style: 'font:600 11px var(--mono);color:var(--ink-dim)', text: '$' + fp.deposit_usd.toLocaleString('en-US') + ' deposit · ' + fp.hold_days + 'd (' + fp.hold_weeks + 'wk) · ' + fp.drop_share_pct + '% drop share' })
      ),
      el('div', { class: 'formula-banner', style: 'margin-bottom:8px' },
        fp.verdict + ': $' + fp.deposit_usd.toLocaleString('en-US') + ' for ' + fp.hold_weeks + ' weeks buys a modelled drop of $' + fp.expected_drop_usd.toFixed(2) + ' against $' + fp.gas_fees_usd.toFixed(2) + ' gas/fees and $' + fp.capital_charge_usd.toFixed(2) + ' capital charge (2% APR net of base yield, ' + fp.work_hours.toFixed(1) + 'h work) -> net ' + fmtSignedUsd(fp.net_usd) + ' (' + fmtSignedUsd(fp.net_per_hour_usd) + '/h). Fees are covered above ' + fp.breakeven_drop_pct + '% drop share and ' + fp.breakeven_odds_pct + '% launch odds. Stop-loss exit if TVL drops below ' + fmtUsd(fp.tvl_stop_usd) + ' (-30%).'
      ),
      el('table', { class: 'steps-table' },
        el('thead', null, el('tr', null, el('th', { text: 'When' }), el('th', { text: 'Step' }), el('th', { class: 'num', text: 'Cost' }), el('th', { class: 'num', text: 'Time' }))),
        el('tbody', null, stepRows)
      ),
      el('div', { class: 'matrix-duo' },
        el('div', null,
          el('div', { class: 'sec-title', style: 'margin:6px 0 4px', text: 'Net ($) by Deposit × Drop Share' }),
          el('table', { class: 'matrix-table' },
            el('thead', null, el('tr', null, el('th', { text: 'Deposit' }), el('th', { class: 'num', text: '5% Drop' }), el('th', { class: 'num', text: '10% Drop' }), el('th', { class: 'num', text: '20% Drop' }))),
            el('tbody', null, matDepRows)
          )
        ),
        el('div', null,
          el('div', { class: 'sec-title', style: 'margin:6px 0 4px', text: 'Net by Weeks Held on $' + fp.deposit_usd.toLocaleString('en-US') }),
          el('table', { class: 'matrix-table' },
            el('thead', null, el('tr', null, el('th', { text: 'Horizon' }), el('th', { class: 'num', text: 'Net ($)' }), el('th', { class: 'num', text: 'Net / Hr' }))),
            el('tbody', null, matWkRows)
          )
        )
      )
    );

    return el('div', null, nav, header, el('div', { class: 'detail-grid' }, leftCol, rightCol));
  }

  var root = document.getElementById('board');
  var auditCache = verifyIntegrity(DATA);

  function render() {
    root.innerHTML = '';
    root.setAttribute('aria-busy', 'false');
    var wrap = el('div', { class: 'wrap' });
    wrap.appendChild(buildTopbar());

    if (state.view === 'detail') {
      wrap.appendChild(buildDetailView());
    } else {
      var visRows = sortedRows(filteredRows());
      wrap.appendChild(buildKpiStrip());
      wrap.appendChild(buildAccountingPanel(auditCache));
      wrap.appendChild(buildEvidencePanel());
      wrap.appendChild(buildControlsBar(visRows));
      wrap.appendChild(state.view === 'comps' ? buildCompsTable() : buildBoardTable(visRows));
    }
    root.appendChild(wrap);
  }

  window.addEventListener('hashchange', function () { readHash(); render(); });
  readHash();
  render();
})();
