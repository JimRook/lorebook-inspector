import { getContext } from '../../../script.js';

const MODULE_NAME = 'lorebook-inspector';

function getLoreEntries() {
    const ctx = getContext();
    return ctx.characters?.[ctx.characterId]?.data?.character_book?.entries ?? null;
}

function showInspector() {
    const existing = document.getElementById('lb-inspector-overlay');
    if (existing) {
        existing.remove();
        document.getElementById('lb-inspector-btn')?.classList.remove('active');
        return;
    }

    const entries = getLoreEntries();

    if (!entries || entries.length === 0) {
        toastr.warning('No lorebook found for this character.');
        return;
    }

    const sorted = [...entries].sort((a, b) => a.id - b.id);

    const rows = sorted.map((e, i) => {
        const enabled = e.enabled !== false;
        const name = e.comment || e.title || '(unnamed)';
        const keys = (e.keys || []).join(', ') || '—';
        const order = e.insertion_order ?? e.order ?? '—';
        const position = e.position ?? '—';
        return `
            <tr class="lb-row ${i % 2 === 0 ? 'lb-row-even' : 'lb-row-odd'}">
                <td class="lb-id" title="Click to copy">${e.id}</td>
                <td class="lb-name" title="${name}">${name}</td>
                <td class="lb-keys" title="${keys}">${keys}</td>
                <td class="lb-state">
                    <span class="lb-badge ${enabled ? 'lb-on' : 'lb-off'}">${enabled ? 'on' : 'off'}</span>
                </td>
                <td class="lb-order">${order}</td>
                <td class="lb-pos">${position}</td>
            </tr>`;
    }).join('');

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
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div id="lb-inspector-footer">
                <span>Click any ID to copy to clipboard</span>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    document.getElementById('lb-inspector-btn')?.classList.add('active');

    document.getElementById('lb-inspector-close').addEventListener('click', () => {
        overlay.remove();
        document.getElementById('lb-inspector-btn')?.classList.remove('active');
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
            document.getElementById('lb-inspector-btn')?.classList.remove('active');
        }
    });

    overlay.querySelectorAll('td.lb-id').forEach(cell => {
        cell.addEventListener('click', () => {
            navigator.clipboard.writeText(cell.textContent.trim()).then(() => {
                toastr.success(`ID ${cell.textContent.trim()} copied`);
            });
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

jQuery(async () => {
    addToolbarButton();
});
