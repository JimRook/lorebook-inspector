function getLoreEntries() {
    const ctx = SillyTavern.getContext();
    return ctx.characters?.[ctx.characterId]?.data?.character_book?.entries ?? null;
}

function saveEntries() {
    const ctx = SillyTavern.getContext();
    const character = ctx.characters[ctx.characterId];
    if (character?.data?.character_book) {
        ctx.saveCharacterDebounced?.();
    }
}

let currentFilter = 'all';
let currentSearch = '';

function renderRows(entries) {
    const tbody = document.querySelector('#lb-inspector-table tbody');
    if (!tbody) return;

    const filtered = entries.filter(e => {
        const name = (e.comment || e.title || '').toLowerCase();
        const keys = (e.keys || []).join(' ').toLowerCase();
        const matchesSearch = !currentSearch || name.includes(currentSearch) || keys.includes(currentSearch);
        const enabled = e.enabled !== false;
        const matchesFilter =
            currentFilter === 'all' ||
            (currentFilter === 'on' && enabled) ||
            (currentFilter === 'off' && !enabled);
        return matchesSearch && matchesFilter;
    });

    const sorted = [...filtered].sort((a, b) => a.id - b.id);

    tbody.innerHTML = sorted.map((e, i) => {
        const enabled = e.enabled !== false;
        const name = e.comment || e.title || '(unnamed)';
        const keys = (e.keys || []).join(', ') || '—';
        const order = e.insertion_order ?? e.order ?? '—';
        const position = e.position ?? '—';
        return `
            <tr class="lb-row ${i % 2 === 0 ? 'lb-row-even' : 'lb-row-odd'}" data-id="${e.id}">
                <td class="lb-id" title="Click to copy ID">${e.id}</td>
                <td class="lb-name" title="${name}">${name}</td>
                <td class="lb-keys" title="${keys}">${keys}</td>
                <td class="lb-state">
                    <span class="lb-badge lb-toggle ${enabled ? 'lb-on' : 'lb-off'}"
                          data-id="${e.id}"
                          title="Click to toggle">
                        ${enabled ? 'on' : 'off'}
                    </span>
                </td>
                <td class="lb-order">${order}</td>
                <td class="lb-pos">${position}</td>
            </tr>`;
    }).join('');

    const count = document.getElementById('lb-inspector-count');
    if (count) {
        const total = getLoreEntries()?.length ?? 0;
        count.textContent = filtered.length === total
            ? `${total} entries`
            : `${filtered.length} / ${total} entries`;
    }

    attachRowListeners();
}

function attachRowListeners() {
    document.querySelectorAll('td.lb-id').forEach(cell => {
        cell.addEventListener('click', () => {
            navigator.clipboard.writeText(cell.textContent.trim()).then(() => {
                toastr.success(`ID ${cell.textContent.trim()} copied`);
            });
        });
    });

    document.querySelectorAll('.lb-toggle').forEach(badge => {
        badge.addEventListener('click', () => {
            const id = parseInt(badge.dataset.id);
            const entries = getLoreEntries();
            if (!entries) return;

            const entry = entries.find(e => e.id === id);
            if (!entry) return;

            entry.enabled = entry.enabled === false ? true : false;
            saveEntries();

            const enabled = entry.enabled !== false;
            badge.textContent = enabled ? 'on' : 'off';
            badge.className = `lb-badge lb-toggle ${enabled ? 'lb-on' : 'lb-off'}`;

            toastr.success(`Entry ${id} ${enabled ? 'enabled' : 'disabled'}`);

            const entries2 = getLoreEntries();
            if (entries2) renderRows(entries2);
        });
    });
}

function showInspector() {
    const existing = document.getElementById('lb-inspector-overlay');
    if (existing) {
        existing.remove();
        document.getElementById('lb-inspector-btn')?.classList.remove('active');
        currentFilter = 'all';
        currentSearch = '';
        return;
    }

    const entries = getLoreEntries();

    if (!entries || entries.length === 0) {
        toastr.warning('No lorebook found for this character.');
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
                </div>
            </div>
            <div id="lb-inspector-body">
                <table id="lb-inspector-table">
                    <thead>
                        <tr>
                            <th class="lb-id">ID</th>
                            <th class="lb-name">Name / Comment</th>
                            <th class="lb-keys">Keys</th>
                            <th class="lb-state">State</th>
                            <th class="lb-order">Order</th>
                            <th class="lb-pos">Position</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
            <div id="lb-inspector-footer">
                <span>Click ID to copy &nbsp;·&nbsp; Click state badge to toggle</span>
            </div>
        </div>`;

    document.body.appendChild(overlay);
    document.getElementById('lb-inspector-btn')?.classList.add('active');

    renderRows(entries);

    document.getElementById('lb-inspector-close').addEventListener('click', () => {
        overlay.remove();
        document.getElementById('lb-inspector-btn')?.classList.remove('active');
        currentFilter = 'all';
        currentSearch = '';
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
            document.getElementById('lb-inspector-btn')?.classList.remove('active');
            currentFilter = 'all';
            currentSearch = '';
        }
    });

    document.getElementById('lb-search').addEventListener('input', (e) => {
        currentSearch = e.target.value.toLowerCase();
        const entries = getLoreEntries();
        if (entries) renderRows(entries);
    });

    document.querySelectorAll('.lb-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;
            document.querySelectorAll('.lb-filter').forEach(b => b.classList.remove('lb-filter-active'));
            btn.classList.add('lb-filter-active');
            const entries = getLoreEntries();
            if (entries) renderRows(entries);
        });
    });
}

function addToolbarButton() {
    if (document.getElementById('lb-inspector-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'lb-inspector-btn';
    btn.title = 'Lorebook Inspector';
    btn.classList.add('fa-solid', 'fa-book-open', 'interactable');
    btn.addEventListener('click', showInspector);

    const toolbar = document.getElementById('leftSendForm') ?? document.getElementById('send_form');
    if (toolbar) {
        toolbar.prepend(btn);
    }
}

jQuery(document).ready(function () {
    addToolbarButton();
});
