import { initRealtimeSync, processBid, serverOffset, isOnline } from './realtime.js';
import { formatCurrency, calculateTimeLeft, sanitize, initAudio, playTone, toggleAudioState, triggerConfetti } from './helpers.js';

let localProducts = {};
let localBids = {};
let currentAlias = localStorage.getItem('auction_alias') || '';
let previousPrices = {};
let timerInterval = null;

const DOM = {
    productsContainer: document.getElementById('products-container'),
    bidsFeed: document.getElementById('bids-feed-container'),
    usersCount: document.getElementById('users-count'),
    globalClock: document.getElementById('global-clock'),
    connectionStatus: document.getElementById('connection-status'),
    offlineBanner: document.getElementById('offline-banner'),
    toggleAudio: document.getElementById('toggle-audio'),
    toggleTheme: document.getElementById('toggle-theme'),
    searchInput: document.getElementById('search-input'),
    categoryFilter: document.getElementById('category-filter'),
    statusFilter: document.getElementById('status-filter'),
    modal: document.getElementById('bid-modal'),
    closeModalBtn: document.querySelector('.close-modal'),
    bidForm: document.getElementById('bid-form'),
    toastContainer: document.getElementById('toast-container')
};

function initApp() {
    initTheme();
    setupEventListeners();
    initRealtimeSync({
        onConnectionChange: updateConnectionState,
        onUsersCountChange: count => DOM.usersCount.textContent = count,
        onProductsChange: handleProductsUpdate,
        onBidsChange: handleBidsUpdate
    });
    startGlobalClock();
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function setupEventListeners() {
    DOM.toggleTheme.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    DOM.toggleAudio.addEventListener('click', () => {
        const isEnabled = toggleAudioState();
        DOM.toggleAudio.textContent = isEnabled ? '🔊' : '🔇';
    });

    document.addEventListener('click', () => initAudio(), { once: true });

    DOM.searchInput.addEventListener('input', renderProducts);
    DOM.categoryFilter.addEventListener('change', renderProducts);
    DOM.statusFilter.addEventListener('change', renderProducts);

    DOM.closeModalBtn.addEventListener('click', closeModal);
    DOM.modal.addEventListener('click', e => {
        if (e.target === DOM.modal) closeModal();
    });

    DOM.bidForm.addEventListener('submit', handleBidSubmit);
}

function updateConnectionState(connected) {
    if (connected) {
        DOM.connectionStatus.classList.remove('disconnected');
        DOM.connectionStatus.classList.add('connected');
        DOM.offlineBanner.classList.add('hidden');
    } else {
        DOM.connectionStatus.classList.remove('connected');
        DOM.connectionStatus.classList.add('disconnected');
        DOM.offlineBanner.classList.remove('hidden');
    }
}

function handleProductsUpdate(productsData) {
    const changes = detectPriceChanges(productsData);
    localProducts = productsData;
    renderProducts();
    
    changes.forEach(change => {
        if (change.newWinner === currentAlias && currentAlias !== '') {
            playTone('win');
            triggerConfetti();
            showToast(`¡Vas ganando ${change.title}!`, 'success');
        } else if (change.oldWinner === currentAlias && currentAlias !== '') {
            playTone('outbid');
            showToast(`Te han superado en ${change.title}`, 'warning');
        } else {
            playTone('bid');
        }
    });
}

function detectPriceChanges(newProducts) {
    const changes = [];
    for (const id in newProducts) {
        const prod = newProducts[id];
        if (previousPrices[id]) {
            if (prod.currentPrice > previousPrices[id].price) {
                changes.push({
                    id,
                    title: prod.title,
                    oldWinner: previousPrices[id].bidder,
                    newWinner: prod.lastBidder
                });
            }
        }
        previousPrices[id] = { price: prod.currentPrice, bidder: prod.lastBidder };
    }
    return changes;
}

function handleBidsUpdate(bidsData) {
    localBids = bidsData;
    renderBidsFeed();
}

function renderProducts() {
    const search = DOM.searchInput.value.toLowerCase();
    const cat = DOM.categoryFilter.value;
    const stat = DOM.statusFilter.value;

    DOM.productsContainer.innerHTML = '';

    const productsArray = Object.entries(localProducts).map(([id, data]) => ({ id, ...data }));
    
    productsArray.filter(p => {
        const matchSearch = p.title.toLowerCase().includes(search) || p.description.toLowerCase().includes(search);
        const matchCat = cat === 'all' || p.category === cat;
        const matchStat = stat === 'all' || p.state === stat;
        return matchSearch && matchCat && matchStat;
    }).forEach(p => {
        DOM.productsContainer.appendChild(createProductCard(p));
    });

    updateTimers();
    if (!timerInterval) {
        timerInterval = setInterval(updateTimers, 1000);
    }
}

function createProductCard(product) {
    const el = document.createElement('article');
    el.className = 'card';
    
    let badgeClass = 'badge-live';
    let badgeText = 'EN VIVO';
    if (product.state === 'paused') { badgeClass = 'badge-paused'; badgeText = 'PAUSADA'; }
    if (product.state === 'closed') { badgeClass = 'badge-closed'; badgeText = 'FINALIZADA'; }

    const timeInfo = calculateTimeLeft(product.endTime, serverOffset);
    if (timeInfo.expired && product.state === 'active') {
        badgeClass = 'badge-closed';
        badgeText = 'FINALIZANDO...';
    }

    el.innerHTML = `
        <img src="${sanitize(product.imageUrl)}" alt="${sanitize(product.title)}" class="card-img" loading="lazy">
        <div class="card-body">
            <div class="card-header">
                <h3 class="card-title">${sanitize(product.title)}</h3>
                <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">${sanitize(product.description)}</p>
            <div style="margin-bottom: 1rem;">
                <p style="font-size: 0.85rem;">Última puja: <strong>${sanitize(product.lastBidder || 'Nadie')}</strong></p>
                <p style="font-size: 0.85rem;">Tiempo: <span class="timer" data-endtime="${product.endTime}">${timeInfo.text}</span></p>
            </div>
            <div class="price-container">
                <div class="price-value" id="price-${product.id}">${formatCurrency(product.currentPrice)}</div>
                <button class="btn btn-primary" onclick="window.openBidModal('${product.id}')" ${product.state !== 'active' || timeInfo.expired ? 'disabled' : ''}>Pujar</button>
            </div>
        </div>
    `;
    return el;
}

function updateTimers() {
    document.querySelectorAll('.timer').forEach(el => {
        const endTime = parseInt(el.getAttribute('data-endtime'));
        const info = calculateTimeLeft(endTime, serverOffset);
        el.textContent = info.text;
        if (info.ms < 60000 && info.ms > 0) {
            el.classList.add('danger');
        } else {
            el.classList.remove('danger');
        }
    });
}

function renderBidsFeed() {
    DOM.bidsFeed.innerHTML = '';
    const sortedBids = Object.values(localBids).sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
    
    sortedBids.forEach(bid => {
        const prod = localProducts[bid.productId];
        const title = prod ? prod.title : 'Producto';
        const el = document.createElement('div');
        el.className = `feed-item ${bid.alias === currentAlias && currentAlias !== '' ? 'highlight' : ''}`;
        el.innerHTML = `<strong>${sanitize(bid.alias)}</strong> pujó ${formatCurrency(bid.amount)} en <em>${sanitize(title)}</em>`;
        DOM.bidsFeed.appendChild(el);
    });
}

window.openBidModal = function(productId) {
    const product = localProducts[productId];
    if (!product) return;
    
    document.getElementById('modal-product-title').textContent = product.title;
    document.getElementById('modal-current-price').textContent = formatCurrency(product.currentPrice);
    document.getElementById('modal-product-id').value = productId;
    
    const minBid = product.currentPrice + product.minIncrement;
    const bidInput = document.getElementById('bid-amount');
    bidInput.min = minBid;
    bidInput.value = minBid;
    
    if (currentAlias) {
        document.getElementById('bidder-alias').value = currentAlias;
    }
    
    DOM.modal.classList.add('open');
};

function closeModal() {
    DOM.modal.classList.remove('open');
}

async function handleBidSubmit(e) {
    e.preventDefault();
    const btn = DOM.bidForm.querySelector('button');
    btn.disabled = true;
    
    const productId = document.getElementById('modal-product-id').value;
    const amount = parseFloat(document.getElementById('bid-amount').value);
    const alias = document.getElementById('bidder-alias').value.trim();
    
    if (alias) {
        currentAlias = alias;
        localStorage.setItem('auction_alias', alias);
    }
    
    const res = await processBid(productId, amount, alias);
    
    if (res.success) {
        showToast('Puja realizada con éxito', 'success');
        if (res.extended) showToast('¡Prórroga anti-sniping activada!', 'warning');
        closeModal();
    } else {
        showToast(res.error, 'error');
    }
    
    btn.disabled = false;
}

function showToast(message, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    DOM.toastContainer.appendChild(el);
    
    requestAnimationFrame(() => {
        el.classList.add('show');
    });
    
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

function startGlobalClock() {
    setInterval(() => {
        const d = new Date(Date.now() + serverOffset);
        DOM.globalClock.textContent = d.toLocaleTimeString('es-ES', { hour12: false });
    }, 1000);
}

initApp();