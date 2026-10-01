(function (root) {
  'use strict';

  const POPUP_MS = 1100;

  const SPIN_NAMES = {
    'tspin': 'T-SPIN',
    'tspin-single': 'T-SPIN SINGLE',
    'tspin-double': 'T-SPIN DOUBLE',
    'tspin-triple': 'T-SPIN TRIPLE',
    'mini': 'MINI T-SPIN',
    'mini-single': 'MINI T-SPIN SINGLE',
    'mini-double': 'MINI T-SPIN DOUBLE'
  };

  function safeNumber(value) {
    const n = Number(value);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatTime(ms) {
    const total = safeNumber(ms);
    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    const hundredths = Math.floor((total % 1000) / 10);
    return minutes + ':' + pad2(seconds) + '.' + pad2(hundredths);
  }

  function formatPps(pieces, ms) {
    const elapsed = safeNumber(ms);
    if (elapsed === 0) return '0.0';
    return (safeNumber(pieces) / (elapsed / 1000)).toFixed(1);
  }

  // Only the things worth shouting about. A plain single is not one.
  function popupsFor(event) {
    const out = [];
    if (!event) return out;

    if (SPIN_NAMES[event.kind]) out.push(SPIN_NAMES[event.kind]);
    else if (event.kind === 'tetris') out.push('TETRIS');

    if (event.b2b) out.push('BACK-TO-BACK');
    if (safeNumber(event.chain) >= 2) out.push('COMBO ' + (event.chain - 1));
    if (event.perfectClear) out.push('PERFECT CLEAR');

    return out;
  }

  function create(rootEl) {
    const fields = {
      score: rootEl.querySelector('#stat-score'),
      level: rootEl.querySelector('#stat-level'),
      lines: rootEl.querySelector('#stat-lines'),
      time: rootEl.querySelector('#stat-time'),
      pps: rootEl.querySelector('#stat-pps')
    };
    const popupHost = rootEl.querySelector('#popups');

    function set(field, text) {
      if (fields[field] && fields[field].textContent !== text) {
        fields[field].textContent = text;
      }
    }

    function update(game) {
      set('score', String(game.scoring.score));
      set('level', String(game.scoring.level));
      set('lines', String(game.scoring.lines));
      set('time', formatTime(game.timeMs));
      set('pps', formatPps(game.piecesPlaced, game.timeMs));
    }

    function showPopup(text) {
      if (!popupHost) return;
      const el = document.createElement('div');
      el.className = 'popup';
      el.textContent = text;
      popupHost.appendChild(el);
      root.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, POPUP_MS);
    }

    function apply(events) {
      for (let i = 0; i < events.length; i++) {
        if (events[i].type !== 'lock') continue;
        const popups = popupsFor(events[i]);
        for (let p = 0; p < popups.length; p++) showPopup(popups[p]);
      }
    }

    return { update: update, apply: apply };
  }

  root.Hud = {
    POPUP_MS: POPUP_MS,
    formatTime: formatTime,
    formatPps: formatPps,
    popupsFor: popupsFor,
    create: create
  };
})(typeof window !== 'undefined' ? window : globalThis);
