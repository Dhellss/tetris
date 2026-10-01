(function (root) {
  'use strict';

  const suites = [];
  let current = null;

  function describe(name, fn) {
    current = { name: name, tests: [] };
    suites.push(current);
    fn();
    current = null;
  }

  function it(name, fn) {
    if (!current) throw new Error('it() outside describe(): ' + name);
    current.tests.push({ name: name, fn: fn });
  }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'assertion failed');
  }

  function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error((msg || 'not equal') + ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
    }
  }

  function assertDeepEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error((msg || 'not deep equal') + ' — expected ' + e + ', got ' + a);
  }

  // Reports to console (node) and, when present, to #results (browser).
  function run() {
    let passed = 0;
    const failures = [];
    const out = (typeof document !== 'undefined') ? document.getElementById('results') : null;

    function line(text, cls) {
      if (out) {
        const el = document.createElement('div');
        el.className = cls;
        el.textContent = text;
        out.appendChild(el);
      }
      console.log(text);
    }

    for (const suite of suites) {
      line(suite.name, 'suite');
      for (const test of suite.tests) {
        try {
          test.fn();
          passed++;
          line('  PASS  ' + test.name, 'pass');
        } catch (err) {
          failures.push({ suite: suite.name, test: test.name, err: err });
          line('  FAIL  ' + test.name + '\n        ' + err.message, 'fail');
        }
      }
    }

    line('\n' + passed + ' passed, ' + failures.length + ' failed', failures.length ? 'fail' : 'pass');
    return { passed: passed, failed: failures.length };
  }

  root.Harness = {
    describe: describe,
    it: it,
    assert: assert,
    assertEqual: assertEqual,
    assertDeepEqual: assertDeepEqual,
    run: run
  };
})(typeof window !== 'undefined' ? window : globalThis);
