import { getContext } from '../../../extensions.js';

let currentFilter = 'all';
let currentSearch = '';
let liveInterval = null;
let selectedIds = new Set();

function getLoreEntriesFromDOM() {
    const domEntries = [];
    document.querySelectorAll('.world_entry').forEach(el => {
        const uid = el.getAttribute('uid');
        if (uid === null) return;
        const id = parseInt(uid);
        if (isNaN(id)) return;
        const name = el.querySelector('[name="comment"]')?.value
                  || el.querySelector('[name="title"]')?.value
                  || '(unnamed)';
        const keys = el.querySelector('[name="key"]')?.value || '';
        const enabled = !el.classList.contains('disabledWIEntry');
        const order = el.querySelector('[name="insertion_order"]')?.value ?? '—';
        domEntries.push({ id, name, keys, enabled, order, el });
    });
    return domEntries;
}

function updateCopyBar() {
    const bar = document.getElementById('lb-copy-bar');
    const label = document.getElementById('lb-copy-label');
    if (!bar || !label) return;
    if (selectedIds.size === 0) {
        bar.style.display = 'none';
    } else {
        bar.style.display = 'flex';
        label.textContent = `${selectedIds.size} selected: ${[...selectedIds].sort((a,b) => a-b).join(', ')}`;
    }
}

function toggleSelection(id) {
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
    } else {
        selectedIds.add(id);
    }
    updateCopyBar();
    const cb = document.querySelector(`.lb-checkbox[data-id="${id}"]`);
    if (cb) cb.checked = selectedIds.has(id);
    const row = document.querySelector(`.lb-row[data-id="${id}"]`);
    if (row) row.classList.toggle('lb-selected', selectedIds.has(id));
}

function renderRows(entries) {
    const tbody = document.querySelector('#lb-inspector-table tbody');
    if (!tbody) return;

    const filtered = entries.filter(e => {
        const name = e.name.toLowerCase();
        const keys = e.keys.toLowerCase();
        const matchesSearch = !currentSearch || name.includes(currentSearch) || keys.includes(currentSearch);
        const matchesFilter =
            currentFilter === 'all' ||
            (currentFilter === 'on' && e.enabled) ||
            (currentFilter === 'off' && !e.enabled);
        return matchesSearch && matchesFilter;
    });

    const sorted = [...filtered].sort((a, b) => a.id - b.id);

    tbody.innerHTML = sorted.map((e, i) => {
        const keyDisplay = e.keys || '—';
        const checked = selectedIds.has(e.id) ? 'checked' : '';
        const selectedClass = selectedIds.has(e.id) ? 'lb-selected' : '';
        return `
            <tr class="lb-row ${i % 2 === 0 ? 'lb-row-even' : 'lb-row-odd'} ${selectedClass}" data-id="${e.id}">
                <td class="lb-check">
                    <input type="checkbox" class="lb-checkbox" data-id="${e.id}" ${checked}/>
                </td>
                <td class="lb-id" title="Click to copy ID" data-id="${e.id}">${e.id}</td>
                <td class="lb-name" title="${e.name}">${e.name}</td>
                <td class="lb-keys" title="${keyDisplay}">${keyDisplay}</td>
                <td class="lb-state">
                    <span class="lb-badge lb-toggle ${e.enabled ? 'lb-on' : 'lb-off'}" data-id="${e.id}" title="Click to toggle">${e.enabled ? 'on' : 'off'}</span>
                </td>
                <td class="lb-order">${e.order}</td>
            </tr>`;
    }).join('');

    const count = document.getElementById('lb-inspector-count');
    if (count) {
        count.textContent = filtered.length === entries.length
            ? `${entries.length} entries`
            : `${filtered.length} / ${entries.length} entries`;
    }

    document.querySelectorAll('td.lb-id').forEach(cell => {
        cell.addEventListener('click', () => {
            navigator.clipboard.writeText(cell.textContent.trim()).then(() => {
                toastr.success(`ID ${cell.textContent.trim()} copied`);
            });
        });
    });

    document.querySelectorAll('.lb-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            toggleSelection(parseInt(cb.dataset.id));
        });
    });

    document.querySelectorAll('.lb-toggle').forEach(badge => {
        badge.addEventListener('click', e => {
            e.stopPropagation();
            const id = parseInt(badge.dataset.id);
            const all = getLoreEntriesFromDOM();
            const entry = all.find(en => en.id === id);
            if (!entry) return;
            const killSwitch = entry.el.querySelector('[name="entryKillSwitch"]');
            if (killSwitch) {
                killSwitch.click();
                toastr.success(`Entry ${id} ${entry.enabled ? 'disabled' : 'enabled'}`);
            }
        });
    });

    document.querySelectorAll('.lb-row').forEach(row => {
        row.addEventListener('click', e => {
            if (e.target.classList.contains('lb-checkbox') ||
                e.target.classList.contains('lb-id') ||
                e.target.closest('td.lb-id') ||
                e.target.closest('td.lb-check') ||
                e.target.closest('td.lb-state')) return;
            toggleSelection(parseInt(row.dataset.id));
        });
    });
}

function closeInspector() {
    const overlay = document.getElementById('lb-inspector-overlay');
    if (overlay) overlay.remove();
    document.getElementById('lb-inspector-btn')?.classList.remove('active');
    if (liveInterval) { clearInterval(liveInterval); liveInterval = null; }
    currentFilter = 'all';
    currentSearch = '';
}

function showInspector() {
    if (document.getElementById('lb-inspector-overlay')) {
        closeInspector();
        return;
    }

    const entries = getLoreEntriesFromDOM();

    if (entries.length === 0) {
        toastr.warning('No lorebook entries found. Is the lorebook editor open with a lorebook selected?');
        return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'lb-inspector-overlay';
    overlay.innerHTML = `
        <div id="lb-inspector-panel">
            <div id="lb-inspector-header">
                <span id="lb-inspector-title">
                    <i class="fa-solid fa-book-open"></i>
                    Lorebook Inspector
                    <span id="lb-inspector-count">${entries.length} entries</span>
                </span>
                <button id="lb-inspector-close" title="Close">✕</button>
            </div>
            <div id="lb-inspector-controls">
                <input id="lb-search" type="text" placeholder="Search name or key…" value="${currentSearch}" />
                <div id="lb-filter-btns">
                    <button class="lb-filter ${currentFilter === 'all' ? 'lb-filter-active' : ''}" data-filter="all">All</button>
                    <button class="lb-filter ${currentFilter === 'on'  ? 'lb-filter-active' : ''}" data-filter="on">On</button>
                    <button class="lb-filter ${currentFilter === 'off' ? 'lb-filter-active' : ''}" data-filter="off">Off</button>
                    <button id="lb-clear-selection" title="Clear selection">✕ clear</button>
                </div>
            </div>
            <div id="lb-inspector-body">
                <table id="lb-inspector-table">
                    <thead>
                        <tr>
                            <th class="lb-check"></th>
                            <th class="lb-id">ID</th>
                            <th class="lb-name">Name / Comment</th>
                            <th class="lb-keys">Keys</th>
                            <th class="lb-state">State</th>
                            <th class="lb-order">Order</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
            <div id="lb-copy-bar" style="display:none">
                <span id="lb-copy-label"></span>
                <button id="lb-copy-btn"><i class="fa-solid fa-copy"></i> Copy IDs</button>
            </div>
            <div id="lb-inspector-footer">
                <span>Click ID to copy single &nbsp;·&nbsp; Tick rows to multi-select &nbsp;·&nbsp; Live</span>
            </div>
        </div>`;

    document.body.appendChild(overlay);
    document.getElementById('lb-inspector-btn')?.classList.add('active');

    renderRows(entries);
    updateCopyBar();

    document.getElementById('lb-inspector-close').addEventListener('click', closeInspector);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeInspector(); });

    document.getElementById('lb-search').addEventListener('input', e => {
        currentSearch = e.target.value.toLowerCase();
        renderRows(getLoreEntriesFromDOM());
    });

    document.querySelectorAll('.lb-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;
            document.querySelectorAll('.lb-filter').forEach(b => b.classList.remove('lb-filter-active'));
            btn.classList.add('lb-filter-active');
            renderRows(getLoreEntriesFromDOM());
        });
    });

    document.getElementById('lb-clear-selection').addEventListener('click', () => {
        selectedIds.clear();
        renderRows(getLoreEntriesFromDOM());
        updateCopyBar();
    });

    document.getElementById('lb-copy-btn').addEventListener('click', () => {
        const sorted = [...selectedIds].sort((a, b) => a - b).join(', ');
        navigator.clipboard.writeText(sorted).then(() => {
            toastr.success(`Copied: ${sorted}`);
        });
    });

    liveInterval = setInterval(() => {
        if (!document.getElementById('lb-inspector-overlay')) {
            clearInterval(liveInterval);
            liveInterval = null;
            return;
        }
        renderRows(getLoreEntriesFromDOM());
        updateCopyBar();
    }, 1000);
}

function addToolbarButton() {
    if (document.getElementById('lb-inspector-btn')) return;
    const btn = document.createElement('div');
    btn.id = 'lb-inspector-btn';
    btn.title = 'Lorebook Inspector';
    btn.classList.add('fa-solid', 'fa-book-open', 'interactable');
    btn.addEventListener('click', showInspector);
    const toolbar = document.getElementById('leftSendForm') ?? document.getElementById('send_form');
    if (toolbar) toolbar.appendChild(btn);
}

jQuery(async () => {
    addToolbarButton();
});
