import { db, ref, set, get, update, push, onValue, serverTimestamp, onDisconnect } from './firebase-config.js';

export let serverOffset = 0;
export let isOnline = false;

export function initRealtimeSync(callbacks) {
    const offsetRef = ref(db, ".info/serverTimeOffset");
    onValue(offsetRef, (snap) => {
        serverOffset = snap.val() || 0;
    });

    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, (snap) => {
        isOnline = snap.val() === true;
        if (callbacks.onConnectionChange) {
            callbacks.onConnectionChange(isOnline);
        }
        if (isOnline) {
            const myPresenceRef = push(ref(db, "presence"));
            onDisconnect(myPresenceRef).remove();
            set(myPresenceRef, true);
        }
    });

    onValue(ref(db, "presence"), (snap) => {
        if (callbacks.onUsersCountChange) {
            callbacks.onUsersCountChange(snap.size);
        }
    });

    onValue(ref(db, "products"), (snap) => {
        if (callbacks.onProductsChange) {
            callbacks.onProductsChange(snap.val() || {});
        }
    });

    onValue(ref(db, "bids"), (snap) => {
        if (callbacks.onBidsChange) {
            callbacks.onBidsChange(snap.val() || {});
        }
    });
}

export async function processBid(productId, amount, alias) {
    const productRef = ref(db, `products/${productId}`);
    const snapshot = await get(productRef);
    
    if (!snapshot.exists()) return { success: false, error: "Producto no encontrado" };
    
    const product = snapshot.val();
    
    if (product.state !== 'active') return { success: false, error: "La subasta no está activa" };
    
    const minRequired = product.currentPrice + product.minIncrement;
    if (amount < minRequired) return { success: false, error: `Monto inferior al mínimo requerido` };
    
    const now = Date.now() + serverOffset;
    const timeRemaining = product.endTime - now;
    
    if (timeRemaining <= 0) return { success: false, error: "La subasta ha finalizado" };
    
    let newEndTime = product.endTime;
    if (timeRemaining < 30000) {
        newEndTime = now + 60000;
    }
    
    const bidData = {
        productId,
        amount,
        alias,
        timestamp: serverTimestamp()
    };
    
    const newBidRef = push(ref(db, 'bids'));
    await set(newBidRef, bidData);
    
    await update(productRef, {
        currentPrice: amount,
        lastBidder: alias,
        endTime: newEndTime,
        totalBids: (product.totalBids || 0) + 1
    });
    
    return { success: true, extended: timeRemaining < 30000 };
}