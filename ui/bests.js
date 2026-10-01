(function (root) {
  'use strict';

  const KEY = 'tetris.bests.v1';
  const MODES = ['marathon', 'sprint'];

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  // A record is only worth keeping if the field it is ranked on is a real
  // number, and — for a raced mode — if the run actually finished. Sprint
  // ranks on time ascending, so an unfinished run would beat every real
  // one and could never be bettered except by failing sooner.
  function isValidBest(mode, record) {
    if (!isRecord(record)) return false;
    if (mode === 'sprint') {
      if (record.completed !== true) return false;
      return isFinite(Number(record.timeMs)) && Number(record.timeMs) > 0;
    }
    if (mode === 'marathon') {
      return isFinite(Number(record.score)) && Number(record.score) >= 0;
    }
    return false;
  }

  function isBetter(mode, candidate, existing) {
    if (!isValidBest(mode, candidate)) return false;
    if (!isValidBest(mode, existing)) return true;
    if (mode === 'sprint') {
      return Number(candidate.timeMs) < Number(existing.timeMs);
    }
    return Number(candidate.score) > Number(existing.score);
  }

  function load(storage) {
    const empty = { marathon: null, sprint: null };
    if (!storage) return empty;

    let raw = null;
    try {
      raw = storage.getItem(KEY);
    } catch (err) {
      return empty;
    }
    if (!raw) return empty;

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return empty;
    }
    if (!isRecord(parsed)) return empty;

    const out = { marathon: null, sprint: null };
    for (const mode of MODES) {
      if (isValidBest(mode, parsed[mode])) out[mode] = parsed[mode];
    }
    return out;
  }

  function save(storage, bests) {
    if (!storage) return false;
    try {
      storage.setItem(KEY, JSON.stringify(bests));
      return true;
    } catch (err) {
      return false;
    }
  }

  function record(storage, mode, result) {
    const bests = load(storage);
    if (MODES.indexOf(mode) === -1) return { updated: false, best: null };

    if (isBetter(mode, result, bests[mode])) {
      bests[mode] = result;
      save(storage, bests);
      return { updated: true, best: result };
    }
    return { updated: false, best: bests[mode] };
  }

  root.Bests = {
    KEY: KEY,
    MODES: MODES,
    isValidBest: isValidBest,
    isBetter: isBetter,
    load: load,
    save: save,
    record: record
  };
})(typeof window !== 'undefined' ? window : globalThis);
