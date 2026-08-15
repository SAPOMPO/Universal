import { db, ref, set, update, push } from './firebase-config.js';
import { initRealtimeSync } from './realtime.js';
import { formatCurrency, sanitize } from './helpers.js';

let adminProducts = {};
let adminBids = {};

const DOM = {
    form: document.getElementById('create-product-form'),
    kpiBids: document.getElementById('kpi-total-bids'),
    kpiVolume: document.getElementById('kpi-volume'),
    kpiActive: document.getElementById('kpi-active'),
    kpiIncidents: document.getElementById('kpi-incidents'),
    usersCount: document.getElementById('admin-users-count'),
    tableBody: document.getElementById('audit-tbody'),
    btnPauseAll: document.getElementById('btn-pause-all'),
    btnResumeAll: document.getElementById('btn-resume-all'),
    btnCloseAll: document.getElementById('btn-close-all'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    toastContainer: document.getElementById('toast-container'),
    toggleTheme: document.getElementById('toggle-theme-admin')
};

function initAdmin() {
    initTheme();
    setupEvents();
    initRealtimeSync({
        onProductsChange: handleProductsUpdate,
        onBidsChange: handleBidsUpdate,
        onUsersCountChange: count => DOM.usersCount.textContent = count
    });
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function setupEvents() {
    DOM.form.addEventListener('submit', createProduct);
    DOM.btnPauseAll.addEventListener('click', () => setGlobalState('paused'));
    DOM.btnResumeAll.addEventListener('click', () => setGlobalState('active'));
    DOM.btnCloseAll.addEventListener('click', () => setGlobalState('closed'));
    DOM.btnExportCsv.addEventListener('click', exportToCsv);
    DOM.toggleTheme.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });
}

function handleProductsUpdate(products) {
    adminProducts = products;
    updateKPIs();
}

function handleBidsUpdate(bids) {
    adminBids = bids;
    updateKPIs();
    renderAuditTable();
}

function updateKPIs() {
    const bidsArray = Object.values(adminBids);
    DOM.kpiBids.textContent = bidsArray.length;
    
    const volume = bidsArray.reduce((acc, curr) => acc + curr.amount, 0);
    DOM.kpiVolume.textContent = formatCurrency(volume);
    
    const activeCount = Object.values(adminProducts).filter(p => p.state === 'active').length;
    DOM.kpiActive.textContent = activeCount;
    
    DOM.kpiIncidents.textContent = "0"; 
}

function renderAuditTable() {
    DOM.tableBody.innerHTML = '';
    const sorted = Object.entries(adminBids).sort((a, b) => b[1].timestamp - a[1].timestamp).slice(0, 100);
    
    sorted.forEach(([id, bid]) => {
        const d = new Date(bid.timestamp);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${d.toLocaleString()}</td>
            <td>${sanitize(bid.alias)}</td>
            <td>${sanitize(bid.productId)}</td>
            <td>${formatCurrency(bid.amount)}</td>
            <td>
                <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="window.invalidateBid('${id}')">Invalidar</button>
            </td>
        `;
        DOM.tableBody.appendChild(tr);
    });
}

async function createProduct(e) {
    e.preventDefault();
    const btn = DOM.form.querySelector('button');
    btn.disabled = true;

    const newProduct = {
        title: document.getElementById('prod-title').value.trim(),
        description: document.getElementById('prod-desc').value.trim(),
        category: document.getElementById('prod-category').value,
        imageUrl: document.getElementById('prod-image').value.trim(),
        currentPrice: parseFloat(document.getElementById('prod-price').value),
        minIncrement: parseFloat(document.getElementById('prod-increment').value),
        endTime: Date.now() + (parseInt(document.getElementById('prod-duration').value) * 60000),
        state: 'active',
        lastBidder: '',
        totalBids: 0,
        createdAt: Date.now()
    };

    try {
        const newRef = push(ref(db, 'products'));
        await set(newRef, newProduct);
        showToast('Subasta creada y activa', 'success');
        DOM.form.reset();
    } catch (err) {
        showToast('Error al crear subasta', 'error');
    }
    btn.disabled = false;
}

async function setGlobalState(newState) {
    const updates = {};
    for (const id in adminProducts) {
        updates[`products/${id}/state`] = newState;
    }
    try {
        await update(ref(db), updates);
        showToast(`Todas las subastas cambiaron a estado: ${newState}`, 'warning');
    } catch (err) {
        showToast('Error al cambiar estados', 'error');
    }
}

window.invalidateBid = async function(bidId) {
    if (!confirm('¿Seguro que deseas invalidar esta puja? Esto la eliminará del registro.')) return;
    try {
        await set(ref(db, `bids/${bidId}`), null);
        showToast('Puja invalidada y eliminada', 'success');
    } catch (err) {
        showToast('Error al invalidar puja', 'error');
    }
};

function exportToCsv() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID Puja,Fecha,Alias Usuario,ID Producto,Monto\n";
    
    Object.entries(adminBids).forEach(([id, b]) => {
        const dateStr = new Date(b.timestamp).toISOString();
        const row = `${id},${dateStr},${b.alias},${b.productId},${b.amount}`;
        csvContent += row + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `auditoria_subastas_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showToast(message, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    DOM.toastContainer.appendChild(el);
    
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

initAdmin();