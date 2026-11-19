// Token Radar's dashboard (model radar-2). It reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the ranked board, a filterable table, a
// per-protocol detail view with the model's own waterfall and the protocol's
// farm plan, a live-token view and the model itself. No network: every byte it
// shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', scope: 'all', sort: 'implied', dir: -1, tab: 'board', selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtMoney(n) { return n === null || n === undefined ? 'n/a' : usd.format(n); }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function pctClass(n) { return n === null || n === undefined ? 'flat' : n > 0 ? 'up' : n < 0 ? 'down' : 'flat'; }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
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
      if (Array.isArray(child)) child.forEach(function (c) {
        if (c === null || c === undefined) return;
        if (typeof c === 'string') node.appendChild(document.createTextNode(c));
        else node.appendChild(c);
      });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q') !== null) state.q = params.get('q');
    if (params.get('category') !== null) state.category = params.get('category');
    if (params.get('chain') !== null) state.chain = params.get('chain');
    if (params.get('scope') !== null) state.scope = params.get('scope');
    if (params.get('sort') !== null) state.sort = params.get('sort');
    if (params.get('tab') !== null) state.tab = params.get('tab');
    if (params.get('p') !== null) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.scope !== 'all') params.set('scope', state.scope);
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.selected) params.set('p', state.selected);
    var h = params.toString();
    history.replaceState(null, '', h ? '#' + h : '#board');
  }

  var bySlug = {};
  DATA.rows.forEach(function (r) { bySlug[r.slug] = r; });

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.scope === 'watchlist' && !r.watchlist) return false;
      if (state.scope === 'early' && r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorized') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort;
    var dir = state.dir;
    rows.sort(function (a, b) {
      var av, bv;
      if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'change') { av = a.change_7d === null ? -9999 : a.change_7d; bv = b.change_7d === null ? -9999 : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? -1 : a.age_days; bv = b.age_days === null ? -1 : b.age_days; }
      else if (key === 'rank') { av = -a.rank; bv = -b.rank; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      return (av - bv) * dir || (a.slug < b.slug ? -1 : 1);
    });
    return rows;
  }

  function sortArrow(key) {
    if (state.sort !== key) return '';
    return state.dir === -1 ? ' ▼' : ' ▲';
  }
  function th(label, key, cls) {
    return el('th', { 'class': 'sortable' + (cls ? ' ' + cls : ''), onclick: function () {
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = key === 'rank' ? 1 : -1; }
      render();
    } }, label + sortArrow(key));
  }

  function rowHtml(r) {
    var tr = el('tr', { 'class': (r.rank <= 3 ? 'top3 ' : '') + (state.selected === r.slug ? 'sel' : ''), onclick: function () { state.selected = state.selected === r.slug ? null : r.slug; render(); } });
    tr.appendChild(el('td', {}, el('span', { 'class': 'rankbadge' }, String(r.rank))));
    var nameCell = el('td', {});
    nameCell.appendChild(el('span', { 'class': 'name' }, r.name));
    if (r.watchlist) nameCell.appendChild(el('span', { 'class': 'pill' }, 'WATCHLIST'));
    else nameCell.appendChild(el('span', { 'class': 'pill early' }, 'EARLY'));
    nameCell.appendChild(el('span', { 'class': 'sub2' }, (r.category || 'Uncategorized') + ' · ' + (r.chains.slice(0, 3).join(', ') || 'no chain listed')));
    tr.appendChild(nameCell);
    tr.appendChild(el('td', { 'class': 'num' }, fmtUsd(r.tvl_usd)));
    tr.appendChild(el('td', { 'class': 'num ' + pctClass(r.change_7d) }, fmtPct(r.change_7d)));
    tr.appendChild(el('td', { 'class': 'num' }, fmtAge(r.age_days)));
    tr.appendChild(el('td', { 'class': 'num implied' }, fmtUsd(r.implied_value_usd)));
    return tr;
  }

  function splitStep(s) {
    var cost = '', time = '', text = s;
    var ci = s.indexOf(' Cost: ');
    var ti = s.indexOf(' Time: ');
    if (ci >= 0) { text = s.slice(0, ci); cost = ti > ci ? s.slice(ci + 7, ti) : s.slice(ci + 7); }
    if (ti >= 0) { time = s.slice(ti + 7).replace(/\.$/, ''); }
    return { text: text, cost: cost.replace(/\.$/, ''), time: time };
  }

  function detailView(r) {
    var base = r.tvl_usd * r.category_multiple;
    var afterGrowth = base * r.growth_multiplier;
    var afterMaturity = afterGrowth * r.maturity_multiplier;
    var steps = [
      ['TVL', fmtMoney(r.tvl_usd), r.tvl_usd, ''],
      ['× category multiple (' + r.category_multiple.toFixed(2) + '×)', '', base, ''],
      ['× growth (' + r.growth_multiplier.toFixed(2) + '×)', '', afterGrowth, ''],
      ['× maturity (' + r.maturity_multiplier.toFixed(2) + '×)', '', afterMaturity, ''],
      ['× breadth (' + r.breadth_multiplier.toFixed(2) + '×)', '', r.implied_value_usd, ''],
    ];
    var logs = steps.map(function (s) { return Math.log10(Math.max(1, s[2])); });
    var lo = Math.min.apply(null, logs), hi = Math.max.apply(null, logs);
    var box = el('section', { 'class': 'detail', 'aria-label': 'Protocol detail' });
    box.appendChild(el('button', { 'class': 'close', onclick: function () { state.selected = null; render(); } }, 'Close ✕'));
    box.appendChild(el('h2', {}, '#' + r.rank + ' ' + r.name));
    box.appendChild(el('p', { 'class': 'meta' },
      (r.category || 'Uncategorized') + ' · ' + (r.chains.join(', ') || 'no chain listed') +
      ' · tracked since ' + (r.listed_at || 'unknown') + ' · ' + fmtAge(r.age_days) + ' with no token recorded'));
    box.appendChild(el('h3', {}, 'How the implied value is built'));
    var wf = el('div', { 'class': 'waterfall' });
    steps.forEach(function (s, i) {
      var w = hi === lo ? 100 : Math.round(((logs[i] - lo) / (hi - lo)) * 100);
      var row = el('div', { 'class': 'wf' + (i === steps.length - 1 ? ' total' : '') });
      row.appendChild(el('span', {}, s[0]));
      row.appendChild(el('span', {}, ''));
      var bar = el('span', { 'class': 'bar' });
      bar.appendChild(el('i', { style: 'width:' + Math.max(4, w) + '%' }));
      row.appendChild(bar);
      row.appendChild(el('span', { 'class': 'val' }, fmtMoney(s[2])));
      wf.appendChild(row);
    });
    box.appendChild(wf);
    box.appendChild(el('p', { 'class': 'note' },
      'Implied value ' + fmtMoney(r.implied_value_usd) + ' is this board\u2019s own claim, from the snapshot\u2019s figures alone. ' +
      'It is not a prediction that ' + r.name + ' will issue a token, or when.'));
    box.appendChild(el('h3', {}, 'Farm plan — 7 steps'));
    var ol = el('ol', { 'class': 'steps' });
    (r.farm_steps || []).forEach(function (s) {
      var p = splitStep(s);
      var li = el('li', {});
      li.appendChild(document.createTextNode(p.text));
      var chips = el('span', { 'class': 'chips' });
      if (p.cost) chips.appendChild(el('span', { 'class': 'chip' }, ['Cost: ', el('b', {}, p.cost)]));
      if (p.time) chips.appendChild(el('span', { 'class': 'chip' }, ['Time: ', el('b', {}, p.time)]));
      li.appendChild(chips);
      ol.appendChild(li);
    });
    box.appendChild(ol);
    return box;
  }

  function liveView() {
    var wrap = el('div', { 'class': 'tablewrap' });
    var table = el('table', {});
    var thead = el('thead', {});
    var hr = el('tr', {});
    hr.appendChild(el('th', {}, 'Protocol'));
    hr.appendChild(el('th', { 'class': 'num' }, 'Market cap'));
    hr.appendChild(el('th', { 'class': 'num' }, 'TVL'));
    hr.appendChild(el('th', { 'class': 'num' }, 'Mcap / TVL'));
    hr.appendChild(el('th', { 'class': 'num' }, '7d'));
    thead.appendChild(hr);
    table.appendChild(thead);
    var tb = el('tbody', {});
    DATA.live.forEach(function (p) {
      var tr = el('tr', {});
      var nameCell = el('td', {});
      nameCell.appendChild(el('span', { 'class': 'name' }, p.name));
      nameCell.appendChild(el('span', { 'class': 'sub2' }, (p.category || 'Uncategorized') + ' · ' + (p.chains.slice(0, 3).join(', ') || 'no chain listed')));
      tr.appendChild(nameCell);
      tr.appendChild(el('td', { 'class': 'num' }, fmtUsd(p.mcap_usd)));
      tr.appendChild(el('td', { 'class': 'num' }, fmtUsd(p.tvl_usd)));
      var ratio = p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) + '×' : 'n/a';
      tr.appendChild(el('td', { 'class': 'num' }, ratio));
      tr.appendChild(el('td', { 'class': 'num ' + pctClass(p.change_7d) }, fmtPct(p.change_7d)));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    wrap.appendChild(table);
    return el('div', {},
      el('p', { 'class': 'note' }, 'Already trading — the market\u2019s own values, kept apart from the ranked board. Their mcap / TVL ratios are what set the board\u2019s category multiples.'),
      wrap);
  }

  function modelView() {
    var grid = el('div', { 'class': 'modelgrid' });
    var left = el('div', { 'class': 'card' });
    left.appendChild(el('h3', {}, 'The model — radar-2'));
    left.appendChild(el('p', { html:
      'implied = TVL × <b>category multiple</b> × <b>growth</b> × <b>maturity</b> × <b>breadth</b>. ' +
      'Every input comes from the snapshot itself; no protocol name is special-cased.' }));
    left.appendChild(el('div', { 'class': 'formula' },
      'category multiple = median mcap / TVL of the\n' +
      '  snapshot\u2019s live-token protocols in the category\n' +
      '  (≥3 samples, else the global median), clamped 0.05–1.50\n' +
      'growth     = 1 + clamp(change_7d, -60, 120) / 100 × 0.5\n' +
      'maturity   = 0.6 + min(age_days, 1095) / 1095 × 0.4\n' +
      'breadth    = 1 + 0.03 × min(chains − 1, 5)'));
    left.appendChild(el('p', {}, 'Global multiple: ' + DATA.global_multiple.toFixed(2) + '×. ' +
      'A category with fewer than 3 live-token protocols falls back to it.'));
    left.appendChild(el('h3', {}, 'How to read this board'));
    var ul = el('ul', {});
    ul.appendChild(el('li', { html: '<b>Pre-token</b> means the protocol\u2019s record carries no token — not that it has none. A token may exist that the record does not carry.' }));
    ul.appendChild(el('li', { html: '<b>Watchlist</b> is the floor: the 40 protocols at or above $50M TVL with no token recorded. <b>Early</b> rows are the 160 pre-token protocols below the floor, by TVL.' }));
    ul.appendChild(el('li', { html: '<b>Implied value</b> is what a token would be worth if the protocol\u2019s record stayed as it is. It is the board\u2019s claim, never a promise.' }));
    left.appendChild(ul);
    grid.appendChild(left);
    var right = el('div', { 'class': 'card' });
    right.appendChild(el('h3', {}, 'Category multiples — learned from this snapshot'));
    var table = el('table', { 'class': 'multtable' });
    var thead = el('thead', {});
    var hr = el('tr', {});
    hr.appendChild(el('th', {}, 'Category'));
    hr.appendChild(el('th', { 'class': 'num' }, 'Multiple'));
    hr.appendChild(el('th', { 'class': 'num' }, 'Live samples'));
    thead.appendChild(hr);
    table.appendChild(thead);
    var tb = el('tbody', {});
    DATA.category_multiples.forEach(function (c) {
      var tr = el('tr', {});
      tr.appendChild(el('td', {}, c.category));
      tr.appendChild(el('td', { 'class': 'num' }, c.multiple.toFixed(2) + '×'));
      tr.appendChild(el('td', { 'class': 'num' }, String(c.samples)));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    right.appendChild(table);
    grid.appendChild(right);
    return grid;
  }

  function render() {
    writeHash();
    app.innerHTML = '';
    app.setAttribute('aria-busy', 'false');
    var wrap = el('div', { 'class': 'wrap' });

    var header = el('header', { 'class': 'top' });
    var hleft = el('div', {});
    hleft.appendChild(el('h1', { html: 'Token <span class="radar">Radar</span>' }));
    hleft.appendChild(el('p', { 'class': 'sub' },
      'Pre-token protocols ranked by what a launch would be worth — and what to do about each one. Snapshot ' + DATA.as_of + ', ' + DATA.source + '.'));
    header.appendChild(hleft);
    var stats = el('div', { 'class': 'stats' });
    stats.appendChild(el('div', { 'class': 'stat' }, [el('b', {}, String(DATA.board_size)), el('span', {}, 'Ranked')]));
    stats.appendChild(el('div', { 'class': 'stat' }, [el('b', {}, String(DATA.watchlist_size)), el('span', {}, 'Watchlist')]));
    stats.appendChild(el('div', { 'class': 'stat' }, [el('b', {}, String(DATA.early_size)), el('span', {}, 'Early')]));
    stats.appendChild(el('div', { 'class': 'stat' }, [el('b', {}, DATA.model_version), el('span', {}, 'Model')]));
    header.appendChild(stats);
    wrap.appendChild(header);

    var tabs = el('div', { 'class': 'tabs', role: 'tablist' });
    [['board', 'Pre-token board'], ['live', 'Already trading'], ['model', 'The model']].forEach(function (t) {
      tabs.appendChild(el('button', {
        'class': 'tab', role: 'tab', 'aria-selected': state.tab === t[0] ? 'true' : 'false',
        onclick: function () { state.tab = t[0]; state.selected = null; render(); }
      }, t[1]));
    });
    wrap.appendChild(tabs);

    if (state.tab === 'live') { wrap.appendChild(liveView()); }
    else if (state.tab === 'model') { wrap.appendChild(modelView()); }
    else {
      var cats = [];
      var chains = [];
      DATA.rows.forEach(function (r) {
        if (cats.indexOf(r.category || 'Uncategorized') < 0) cats.push(r.category || 'Uncategorized');
        r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
      });
      cats.sort(); chains.sort();
      var controls = el('div', { 'class': 'controls' });
      var search = el('input', { type: 'search', placeholder: 'Search a protocol…', value: state.q, 'aria-label': 'Search protocols' });
      search.addEventListener('input', function () { state.q = search.value; renderTable(); });
      controls.appendChild(search);
      var catSel = el('select', { 'aria-label': 'Filter by category' });
      catSel.appendChild(el('option', { value: 'all' }, 'All categories'));
      cats.forEach(function (c) { catSel.appendChild(el('option', { value: c }, c)); });
      catSel.value = state.category;
      catSel.addEventListener('change', function () { state.category = catSel.value; render(); });
      controls.appendChild(catSel);
      var chainSel = el('select', { 'aria-label': 'Filter by chain' });
      chainSel.appendChild(el('option', { value: 'all' }, 'All chains'));
      chains.forEach(function (c) { chainSel.appendChild(el('option', { value: c }, c)); });
      chainSel.value = state.chain;
      chainSel.addEventListener('change', function () { state.chain = chainSel.value; render(); });
      controls.appendChild(chainSel);
      var scopeSel = el('select', { 'aria-label': 'Watchlist or early' });
      [['all', 'Watchlist + early'], ['watchlist', 'Watchlist only'], ['early', 'Early only']].forEach(function (o) {
        scopeSel.appendChild(el('option', { value: o[0] }, o[1]));
      });
      scopeSel.value = state.scope;
      scopeSel.addEventListener('change', function () { state.scope = scopeSel.value; render(); });
      controls.appendChild(scopeSel);
      var count = el('span', { 'class': 'count', id: 'rowcount' }, '');
      controls.appendChild(count);
      wrap.appendChild(controls);
      wrap.appendChild(el('p', { 'class': 'note' },
        'Click a row for its model waterfall and farm plan. Click a column heading to sort. “Pre-token” means the record carries no token — never that it has none.'));
      var boardArea = el('div', { id: 'boardarea' });
      wrap.appendChild(boardArea);
    }

    if (state.tab === 'board' && state.selected && bySlug[state.selected]) {
      wrap.appendChild(detailView(bySlug[state.selected]));
    }
    var footer = el('footer', {});
    footer.appendChild(el('p', {}, 'Data: DefiLlama protocols, snapshot ' + DATA.as_of + '. Implied values are this entry\u2019s own claim, computed from the snapshot\u2019s TVL, 7-day change, age and chains. Nothing here is investment advice, and no farm step is a guarantee of any reward.'));
    footer.appendChild(el('p', {}, 'Model radar-2 · board.json carries ' + DATA.board_size + ' rows · the watchlist floor is $' + (DATA.floor_usd / 1e6) + 'M TVL.'));
    wrap.appendChild(footer);
    app.appendChild(wrap);
    if (state.tab === 'board') renderTable();
  }

  function renderTable() {
    var area = document.getElementById('boardarea');
    var count = document.getElementById('rowcount');
    if (!area) return;
    var rows = filteredRows();
    if (count) count.textContent = rows.length + ' of ' + DATA.board_size + ' protocols';
    area.innerHTML = '';
    if (rows.length === 0) {
      area.appendChild(el('div', { 'class': 'tablewrap' }, el('div', { 'class': 'empty' }, 'Nothing matches that filter. Clear the search or pick another category.')));
      return;
    }
    var wrap = el('div', { 'class': 'tablewrap' });
    var table = el('table', {});
    var thead = el('thead', {});
    var hr = el('tr', {});
    hr.appendChild(th('Rank', 'rank'));
    hr.appendChild(el('th', {}, 'Protocol'));
    hr.appendChild(th('TVL', 'tvl', 'num'));
    hr.appendChild(th('7d', 'change', 'num'));
    hr.appendChild(th('Age', 'age', 'num'));
    hr.appendChild(th('Implied value', 'implied', 'num'));
    thead.appendChild(hr);
    table.appendChild(thead);
    var tb = el('tbody', {});
    rows.forEach(function (r) { tb.appendChild(rowHtml(r)); });
    table.appendChild(tb);
    wrap.appendChild(table);
    area.appendChild(wrap);
  }

  readHash();
  render();
})();
