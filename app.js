// =========================================================
// STATE
// =========================================================
const state = {
  mode: 'ds',
  problems: [],
  selectedProblemId: null,
  dsEntries: [],
  selectedDsId: null,
  selectedDsEntryId: null,
  selectedDsSectionIdx: null,
  selectedFilter: 'all',
  searchQuery: '',
  solved: new Set(),  // stores IDs of successfully submitted problems
};

// =========================================================
// MODE CONFIG
// =========================================================
const MODE_CONFIG = {
  blind75: {
    filterLabel: 'Difficulty',
    filterOptions: [
      { value: 'all', label: 'All' },
      { value: 'easy', label: 'Easy' },
      { value: 'medium', label: 'Medium' },
      { value: 'hard', label: 'Hard' },
    ],
    searchPlaceholder: '🔍 Search problems…',
    defaultFilter: 'all',
  },
  ds: {
    filterLabel: 'Category',
    filterOptions: [
      { value: 'all', label: 'All Categories' },
      { value: 'array-string', label: 'Array / String' },
      { value: 'hash-map', label: 'Hash Map / Object / Set' },
      { value: 'stack-queue', label: 'Stack / Queue' },
      { value: 'tree-bst', label: 'Tree / BST' },
      { value: 'graph', label: 'Graph' },
      { value: 'heap-trie', label: 'Heap / Trie' },
      { value: 'dp', label: 'Dynamic Programming' },
    ],
    searchPlaceholder: '🔍 Search patterns…',
    defaultFilter: 'all',
  },
};

// =========================================================
// DS CATEGORY LIST
// =========================================================
const DS_CATEGORIES = [
  { id: 'array-string', name: 'Array / String', file: 'array-string.json' },
  { id: 'hash-map', name: 'Hash Map / Object / Set', file: 'hash-map.json' },
  { id: 'stack-queue', name: 'Stack / Queue', file: 'stack-queue.json' },
  { id: 'tree-bst', name: 'Tree / BST', file: 'tree-bst.json' },
  { id: 'graph', name: 'Graph', file: 'graph.json' },
  { id: 'heap-trie', name: 'Heap / Trie', file: 'heap-trie.json' },
  { id: 'dp', name: 'Dynamic Programming', file: 'dp.json' },
];

// =========================================================
// TEST RUNNERS — for multi-function / class problems
// The runner runs as a Function with the sandbox as `this`,
// and users' arg values spread as regular parameters.
// =========================================================
const TEST_RUNNERS = {
  60: `const encoded = this.encode(strs);
      const decoded = this.decode(encoded);
      return JSON.stringify(decoded) === JSON.stringify(strs);`,
  62: `const data = this.serialize(root);
      const decoded = this.deserialize(data);
      return JSON.stringify(this.serialize(root)) === JSON.stringify(this.serialize(decoded));`,
  75: `const fs = new this.FreqStack();
      const ops = [undefined,5,7,5,7,4,undefined,undefined,undefined,undefined];
      const results = [];
      for (const op of ops) {
        if (op === undefined) results.push(fs.pop());
        else fs.push(op);
      }
      return JSON.stringify(results) === JSON.stringify([null,null,null,null,null,null,5,7,5,4]);`,
  23: `function ListNode(val, next) {
        this.val = val || 0;
        this.next = next || null;
      }
      function buildList(arr) {
        if (!arr || !arr.length) return null;
        const dummy = new ListNode();
        let curr = dummy;
        for (const v of arr) {
          curr.next = new ListNode(v);
          curr = curr.next;
        }
        return dummy.next;
      }
      function toArray(head) {
        const res = [];
        while (head) { res.push(head.val); head = head.next; }
        return res;
      }
      const lists = arguments[0];
      const builtLists = lists.map(arr => buildList(arr));
      const result = this.mergeKLists(builtLists);
      return JSON.stringify(toArray(result)) === JSON.stringify([1,1,2,3,4,4,5,6]);`,
};

// =========================================================
// INIT
// =========================================================
async function init() {
  try {
    state.problems = [];
    for (let i = 1; i <= 5; i++) {
      const res = await fetch(`./data/leet75/leet75-${i}.json`);
      if (!res.ok) throw new Error(`Failed to load leet75-${i}.json: ${res.status}`);
      state.problems.push(...await res.json());
    }
  } catch (e) {
    console.error('Failed to load leet75 problems:', e);
  }

  state.dsEntries = await Promise.all(
    DS_CATEGORIES.map(async (cat) => {
      try {
        const res = await fetch(`./data/ds/${cat.file}`);
        const data = await res.json();
        return { ...cat, data };
      } catch (e) {
        console.error(`Failed to load ${cat.file}:`, e);
        return { ...cat, data: [] };
      }
    })
  );

  document.querySelectorAll('.set-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.set-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.set;
      state.selectedDsId = null;
      state.selectedProblemId = null;
      updateFilterUI();
      render();
    });
  });

  document.getElementById('filter-select').addEventListener('change', (e) => {
    state.selectedFilter = e.target.value;
    renderCurrentList();
  });

  document.getElementById('search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    renderCurrentList();
  });

  updateFilterUI();

  try {
    const saved = JSON.parse(localStorage.getItem('blind75_solved') || '[]');
    saved.forEach(id => state.solved.add(id));
  } catch (e) {
    console.warn('Could not restore progress:', e);
  }

  updateProgressUI();
  render();
}

// =========================================================
// DYNAMIC FILTER UI
// =========================================================
function updateFilterUI() {
  const config = MODE_CONFIG[state.mode];
  const label = document.getElementById('filter-label');
  const select = document.getElementById('filter-select');
  const search = document.getElementById('search-input');

  label.textContent = config.filterLabel;

  select.innerHTML = config.filterOptions
    .map(opt => `<option value="${opt.value}">${opt.label}</option>`)
    .join('');

  state.selectedFilter = config.defaultFilter;
  search.placeholder = config.searchPlaceholder;
  search.value = '';
  state.searchQuery = '';
}

// =========================================================
// RENDER
// =========================================================
function render() {
  const main = document.getElementById('main');

  if (state.mode === 'ds') {
    renderDsList();
    if (state.selectedDsId) {
      renderDsDetail();
    } else {
      main.innerHTML = '<div class="empty">← Select a data structure from the list to begin.</div>';
    }
  } else if (state.mode === 'blind75') {
    renderProblemList();
    if (state.selectedProblemId) {
      renderProblemDetail();
    } else {
      main.innerHTML = '<div class="empty">← Select a problem from the list to begin.</div>';
    }
  }
}

function renderCurrentList() {
  if (state.mode === 'ds') {
    renderDsList();
  } else if (state.mode === 'blind75') {
    applyProblemFilterSort();
    renderProblemList();
  }
}

// =========================================================
// PROBLEM FILTER / SORT
// =========================================================
function applyProblemFilterSort() {
  let list = [...state.problems];

  if (state.searchQuery) {
    list = list.filter(p =>
      p.title.toLowerCase().includes(state.searchQuery) ||
      (p.topics && p.topics.some(t => t.toLowerCase().includes(state.searchQuery)))
    );
  }

  if (state.selectedFilter !== 'all') {
    list = list.filter(p => p.difficulty === state.selectedFilter);
  }

  if (state.selectedFilter === 'diff-asc' || (state.selectedFilter !== 'diff-desc' && state.selectedFilter !== 'all')) {
    // keep original order (by id)
  } else if (state.selectedFilter === 'diff-desc') {
    const order = { easy: 1, medium: 2, hard: 3 };
    list.sort((a, b) => order[b.difficulty] - order[a.difficulty]);
  } else {
    list.sort((a, b) => a.id - b.id);
  }

  state.filteredProblems = list;
}

// =========================================================
// PROBLEM LIST
// =========================================================
function renderProblemList() {
  const container = document.getElementById('problem-list');
  const list = state.filteredProblems || state.problems;

  if (list.length === 0) {
    container.innerHTML = '<div class="empty" style="padding:12px;">No problems found.</div>';
    return;
  }

  container.innerHTML = list.map(p => `
    <div class="problem-item solved-${state.solved.has(p.id) ? 'yes' : 'no'} ${p.id === state.selectedProblemId ? 'active' : ''}"
         data-id="${p.id}">
      <span class="p-num">${p.id}.</span>
      <span class="p-dot ${p.difficulty}${state.solved.has(p.id) ? ' solved' : ''}"></span>
      <span class="p-title">${p.title}</span>
    </div>
  `).join('');

  container.querySelectorAll('.problem-item').forEach(el => {
    el.addEventListener('click', () => {
      state.selectedProblemId = parseInt(el.dataset.id, 10);
      state.selectedDsId = null;
      render();
    });
  });
}

// =========================================================
// PROBLEM DETAIL
// =========================================================
function renderProblemDetail() {
  const main = document.getElementById('main');
  const problem = state.problems.find(p => p.id === state.selectedProblemId);
  if (!problem) return;

  main.innerHTML = `
    <div class="problem-header">
      <div>
        <h1>${problem.id}. ${problem.title}</h1>
        <div class="problem-meta">
          <span class="diff-badge ${problem.difficulty}">${problem.difficulty}</span>
          ${(problem.topics || []).map(t => `<span class="topic-badge">${t}</span>`).join('')}
        </div>
        ${problem.optimalTime ? `<div class="ds-category-header">Optimal: Time ${problem.optimalTime} · Space ${problem.optimalSpace || 'O(1)'} · Pattern: ${problem.pattern || 'N/A'}</div>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-heading">Problem</div>
      <p>${problem.description}</p>
      ${(problem.examples || []).map(ex => `
        <div class="example-block">
          <strong>Example</strong><br>
          Input: ${ex.input}<br>
          Output: ${ex.output}
        </div>
      `).join('')}
    </div>

    <div class="editor-wrap">
      <div class="editor-toolbar">
        <button class="btn" id="reset-btn">Reset</button>
        <button class="btn primary" id="run-btn">Run</button>
        <button class="btn primary" id="submit-btn">Submit</button>
      </div>
      <textarea class="code-editor" id="code-editor" spellcheck="false">${escapeHtml(problem.starter || '')}</textarea>
      <div class="console" id="console"></div>
    </div>

    <details class="optimal-solution">
      <summary>Show Optimal Solution</summary>
      <div class="optimal-code"><pre><code class="language-javascript">${escapeHtml(problem.optimalSolution || '// Optimal solution coming soon')}</code></pre></div>
    </details>

    <div class="actions-bar">
      <button class="btn" id="prev-btn">← Previous</button>
      <button class="btn" id="next-btn">Next →</button>
    </div>
  `;

  document.getElementById('reset-btn')?.addEventListener('click', () => {
    document.getElementById('code-editor').value = problem.starter || '';
    document.getElementById('console').innerHTML = '';
    document.getElementById('console').classList.remove('open');
  });

  document.getElementById('run-btn')?.addEventListener('click', () => runCode(problem));
  document.getElementById('submit-btn')?.addEventListener('click', () => submitCode(problem));

  document.getElementById('prev-btn')?.addEventListener('click', () => {
    const idx = (state.filteredProblems || state.problems).findIndex(p => p.id === state.selectedProblemId);
    if (idx > 0) {
      state.selectedProblemId = (state.filteredProblems || state.problems)[idx - 1].id;
      render();
    }
  });

  document.getElementById('next-btn')?.addEventListener('click', () => {
    const idx = (state.filteredProblems || state.problems).findIndex(p => p.id === state.selectedProblemId);
    const list = state.filteredProblems || state.problems;
    if (idx < list.length - 1) {
      state.selectedProblemId = list[idx + 1].id;
      render();
    }
  });

  if (window.Prism) Prism.highlightAll();
}

// =========================================================
// DS LIST
// =========================================================
function renderDsList() {
  const container = document.getElementById('problem-list');
  let entries = [...state.dsEntries];

  if (state.selectedFilter !== 'all') {
    entries = entries.filter(e => e.id === state.selectedFilter);
  }

  if (state.searchQuery) {
    entries = entries.filter(e => {
      if (e.name.toLowerCase().includes(state.searchQuery)) return true;
      return e.data.some(section =>
        section.name.toLowerCase().includes(state.searchQuery) ||
        section.examples.some(ex => ex.title.toLowerCase().includes(state.searchQuery))
      );
    });
  }

  const items = [];
  entries.forEach(entry => {
    entry.data.forEach((section, idx) => {
      items.push({
        uniqueId: `${entry.id}-${idx}`,
        sectionName: section.name,
        icon: '📄',
        entryId: entry.id,
        sectionIdx: idx,
      });
    });
  });

  if (items.length === 0) {
    container.innerHTML = '<div class="empty" style="padding:12px;">No data structures found.</div>';
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="problem-item ${item.uniqueId === state.selectedDsId ? 'active' : ''}"
         data-ds-id="${item.uniqueId}"
         data-entry-id="${item.entryId}"
         data-section-idx="${item.sectionIdx}">
      <span class="p-num">${item.icon}</span>
      <span class="p-title">${item.sectionName}</span>
    </div>
  `).join('');

  container.querySelectorAll('.problem-item').forEach(el => {
    el.addEventListener('click', () => {
    state.selectedDsId = el.dataset.dsId;
    state.selectedDsEntryId = el.dataset.entryId;
    state.selectedDsSectionIdx = parseInt(el.dataset.sectionIdx, 10);
    state.selectedProblemId = null;
    render();
  });
  });
}

// =========================================================
// DS DETAIL
// =========================================================
function renderDsDetail() {
  const main = document.getElementById('main');
  const entry = state.dsEntries.find(e => e.id === state.selectedDsEntryId);
  if (!entry) return;

  const section = entry.data[state.selectedDsSectionIdx];
  if (!section) return;

  main.innerHTML = `
    <div class="problem-header">
      <div>
        <h1>${section.name}</h1>
        <div class="problem-meta">
          <span class="topic-badge">${entry.name}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-heading">Overview</div>
      <p>${section.description}</p>
    </div>

    ${section.examples.map((ex, i) => `
      <div class="card">
        <div class="card-heading">${ex.title}</div>
        <div class="example-block">
          <pre><code class="language-javascript">${escapeHtml(ex.code)}</code></pre>
        </div>
        <p style="margin-top:10px;font-size:13px;color:var(--text-dim);line-height:1.6;">
          <strong style="color:var(--accent-2);">Explanation:</strong> ${ex.explanation}
        </p>
      </div>
    `).join('')}
  `;

  if (window.Prism) Prism.highlightAll();
}

// =========================================================
// UTILITIES
// =========================================================
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[m]));
}

function consoleClear() {
  const c = document.getElementById('console');
  if (!c) return;
  c.innerHTML = '';
  c.classList.remove('open');
}

function consoleLog(msg, type = 'info') {
  const c = document.getElementById('console');
  if (!c) return;
  c.classList.add('open');
  c.innerHTML += `<div class="c-${type}">› ${msg}</div>`;
  c.scrollTop = c.scrollHeight;
}

function updateProgressUI() {
  const el = document.getElementById('progress-count');
  if (el) el.textContent = state.solved.size;
}

function saveProgress() {
  try {
    localStorage.setItem(
      'blind75_solved',
      JSON.stringify([...state.solved])
    );
  } catch (e) {
    console.warn('Could not save progress:', e);
  }
}

// ---- Smart comparison --------------------------------------------------

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const norm = x => JSON.stringify(x);
    const sortedA = [...a].sort((x, y) => norm(x).localeCompare(norm(y)));
    const sortedB = [...b].sort((x, y) => norm(x).localeCompare(norm(y)));
    return sortedA.every((v, i) => deepEqual(v, sortedB[i]));
  }

  if (a && typeof a === 'object' && b && typeof b === 'object') {
    const kA = Object.keys(a);
    const kB = Object.keys(b);
    if (kA.length !== kB.length) return false;
    return kA.every(k => deepEqual(a[k], b[k]));
  }

  return false;
}

// ---- Code evaluation helpers -------------------------------------------

function getParamNames(code) {
  if (!code) return [];
  const match = code.match(/function\s+\w+\s*\(([^)]*)\)/);
  if (!match) return [];
  return match[1].split(',').map(s => s.trim()).filter(Boolean);
}

// LeetCode-style level-order tree builder.
// Uses plain objects {val, left, right} so it works with
// starter code that accesses root.val / root.left / root.right.
function buildTree(arr) {
  if (!arr.length || arr[0] == null) return null;
  const nodes = arr.map(v => v == null ? null : { val: v, left: null, right: null });
  let i = 0, j = 1;
  while (j < nodes.length) {
    if (nodes[i]) {
      nodes[i].left = nodes[j++];
      if (j < nodes.length) nodes[i].right = nodes[j++];
    }
    i++;
  }
  return nodes[0];
}

// Wraps a raw problem input string into a self-contained JS
// snippet that executes the declarations and returns the
// variable values as an array in declaration order.
function buildTestHarness(input, paramNames) {
  return `${input}; return [${paramNames.join(', ')}];`;
}

// Converts array-typed `root` args to built tree objects for
// problems whose inputs use the LeetCode `root = [...]` notation.
function convertTreeArgs(args, paramNames, input) {
  if (!/root\s*=\s*\[/.test(input)) return args;
  const rootIdx = paramNames.indexOf('root');
  if (rootIdx < 0 || !Array.isArray(args[rootIdx])) return args;
  return [
    ...args.slice(0, rootIdx),
    buildTree(args[rootIdx]),
    ...args.slice(rootIdx + 1),
  ];
}

// Parses the JSON data's expected-output string back into a JS
// value. Tries JSON first; falls back to a JS expression eval
// for outputs stored as JS literals (e.g. single-quoted "'BANC'").
function parseExpected(str) {
  try { return JSON.parse(str); }
  catch {
    try { return new Function(`"use strict"; return (${str});`)(); }
    catch { return str; }
  }
}

// Evaluates user code and returns a callable (single function) or
// an object of all declared top-level functions/classes (marked
// with _isMulti: true).
function executeCode(code) {
  let direct;
  try {
    direct = new Function(`"use strict"; return (${code});`)();
  } catch (e) {
    return { error: e.message };
  }

  if (typeof direct !== 'function') return direct;

  const names = [];
  const declRegex = /(?:function\s+(\w+)\s*\(|class\s+(\w+))/g;
  let match;
  while ((match = declRegex.exec(code)) !== null) {
    names.push(match[1] || match[2]);
  }

  if (names.length > 1 || /class\s+\w+/.test(code)) {
    const props = names.map(n => `${n}: ${n}`).join(', ');
    const wrapped = `${code}; return { ${props} };`;   // <-- FIX: removed outer ()
    try {
      const obj = new Function(`"use strict"; ${wrapped}`)();
      return { ...obj, _isMulti: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  return direct;
}

// Runs one example against a single function. Returns { passed, result, expected, error? }.
function testSingleExample(fn, input, paramNames, expectedOutput) {
  const harness = buildTestHarness(input, paramNames);
  let harnessFn;
  try {
    harnessFn = new Function(`"use strict"; ${harness}`);
  } catch (e) {
    return { passed: false, error: 'Harness error: ' + e.message };
  }

  let args;
  try {
    args = harnessFn();
  } catch (e) {
    return { passed: false, error: 'Arg parse error: ' + e.message };
  }
  args = convertTreeArgs(args, paramNames, input);

  let result;
  try {
    result = fn(...args);
  } catch (e) {
    return { passed: false, error: e.message };
  }

  const expected = parseExpected(expectedOutput);
  return {
    passed: deepEqual(result, expected),
    result,
    expected,
  };
}

// ---- Deprecated old parser (kept as fallback) ----------------------------

function parseExampleArgs(input) {
  const args = [];
  const parts = input.split(',');
  for (const part of parts) {
    const [key, ...valParts] = part.split('=');
    const val = valParts.join('=').trim();
    if (!key || !val) continue;
    try { args.push(JSON.parse(val)); }
    catch { args.push(val); }
  }
  return args;
}

// =========================================================
// RUN CODE (preview, first example only)
// =========================================================
function runCode(problem) {
  consoleClear();
  const code = document.getElementById('code-editor').value;
  const ex = problem.examples[0];
  const paramNames = getParamNames(problem.starter);

  consoleLog(`Input:    ${ex.input}`, 'info');

  const fn = executeCode(code);
  if (!fn || (typeof fn === 'object' && fn.error)) {
    consoleLog((typeof fn === 'object' && fn.error) ? `⚠ ${fn.error}` : '⚠ No callable function found.', 'err');
    consoleLog(`Expected: ${ex.output}`, 'info');
    return;
  }

  if (typeof fn === 'object' && fn._isMulti) {
    consoleLog('⚠ Multi-function problems can\'t be previewed here — use Submit.', 'err');
    consoleLog(`Expected: ${ex.output}`, 'info');
    return;
  }

  const outcome = testSingleExample(fn, ex.input, paramNames, ex.output);
  consoleLog(`Expected: ${ex.output}`, 'info');
  consoleLog(`Got:      ${JSON.stringify(outcome.result)}`, outcome.passed ? 'ok' : 'err');

  if (outcome.error) {
    consoleLog(`Error: ${outcome.error}`, 'err');
  } else {
    consoleLog(outcome.passed ? '✅ Pass' : '❌ Fail', outcome.passed ? 'ok' : 'err');
  }
}

// =========================================================
// SUBMIT CODE
// =========================================================
function submitCode(problem) {
  consoleClear();
  const code = document.getElementById('code-editor').value;

  const fn = executeCode(code);
  if (!fn || (typeof fn === 'object' && fn.error)) {
    consoleLog((typeof fn === 'object' && fn.error) ? `⚠ ${fn.error}` : '⚠ No callable function found.', 'err');
    return;
  }

  let pass = false;

  if (typeof fn === 'object' && fn._isMulti) {
    // Multi-function / class problem — use custom testRunner
    const runner = TEST_RUNNERS[problem.id];
    if (!runner) {
      consoleLog('⚠ No test runner available for this problem.', 'err');
      return;
    }
    // Build args from the first example so the runner has them
    const paramNames = getParamNames(problem.starter);
    const harness = buildTestHarness(problem.examples[0].input, paramNames);
    let args;
    try {
      args = new Function(`"use strict"; ${harness}`)();
      args = convertTreeArgs(args, paramNames, problem.examples[0].input);
    } catch (e) {
      consoleLog('⚠ Arg parse error: ' + e.message, 'err');
      return;
    }
    try {
      const runnerFn = new Function(`"use strict"; ${runner}`);
      pass = runnerFn.call(fn, ...args) === true;
    } catch (e) {
      consoleLog(`⚠ Error: ${e.message}`, 'err');
    }
  } else {
    // Single-function problem — test ALL examples
    pass = problem.examples.every(ex => {
      const paramNames = getParamNames(problem.starter);
      const outcome = testSingleExample(fn, ex.input, paramNames, ex.output);
      if (!outcome.passed) {
        consoleLog(`Example: ${ex.input}`, 'info');
        consoleLog(`Expected: ${ex.output}`, 'info');
        consoleLog(`Got:      ${JSON.stringify(outcome.result)}`, 'err');
        if (outcome.error) consoleLog(`Error: ${outcome.error}`, 'err');
        consoleLog('❌ Fail', 'err');
        return false;
      }
      return true;
    });

    if (pass) {
      const ex = problem.examples[0];
      const outcome = testSingleExample(fn, ex.input, getParamNames(problem.starter), ex.output);
      consoleLog(`Input:    ${ex.input}`, 'info');
      consoleLog(`Expected: ${ex.output}`, 'info');
      consoleLog(`Got:      ${JSON.stringify(outcome.result)}`, 'ok');
      consoleLog('✅ Pass', 'ok');
    }
  }

  if (pass) {
    state.solved.add(problem.id);
    updateProgressUI();
    saveProgress();
    consoleLog('✅ Solution accepted!', 'ok');
  } else {
    consoleLog('❌ Solution does not match expected output.', 'err');
  }
}

// =========================================================
// START
// =========================================================
init();

const menuToggle = document.getElementById('menu-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const aside = document.querySelector('aside');

function openSidebar() {
  aside.classList.add('open');
  sidebarOverlay.classList.add('visible');
}
function closeSidebar() {
  aside.classList.remove('open');
  sidebarOverlay.classList.remove('visible');
}

menuToggle?.addEventListener('click', openSidebar);
sidebarOverlay?.addEventListener('click', closeSidebar);

document.getElementById('problem-list')?.addEventListener('click', () => {
  if (window.innerWidth < 640) setTimeout(closeSidebar, 80);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSidebar();
});