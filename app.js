import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfyAeiuw65_Pi3P0TDntFkqb7lgbPT7tM",
  authDomain: "universal-3d40a.firebaseapp.com",
  projectId: "universal-3d40a",
  storageBucket: "universal-3d40a.firebasestorage.app",
  messagingSenderId: "828271151150",
  appId: "1:828271151150:web:d729fb8dcae3556d1077bf",
  measurementId: "G-J8QZZHNSP7"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let allReservations = {};
let selectedTime = null;
const timeSlotsConfig = [
  "09:00", "09:30", "10:00", "10:30", 
  "11:00", "11:30", "12:00", "12:30", 
  "13:00", "13:30", "14:00", "14:30", 
  "15:00", "15:30", "16:00", "16:30", 
  "17:00", "17:30", "18:00"
];

const elBtnNavClient = document.getElementById('btn-nav-client');
const elBtnNavAdmin = document.getElementById('btn-nav-admin');
const elViewClient = document.getElementById('view-client');
const elViewAdmin = document.getElementById('view-admin');
const elFecha = document.getElementById('fecha');
const elTimeSlots = document.getElementById('time-slots');
const elBookingForm = document.getElementById('booking-form');
const elBtnSubmit = document.getElementById('btn-submit');
const elBtnText = elBtnSubmit.querySelector('.btn-text');
const elSpinner = elBtnSubmit.querySelector('.spinner');
const elAdminLogin = document.getElementById('admin-login');
const elAdminDashboard = document.getElementById('admin-dashboard');
const elAdminPin = document.getElementById('admin-pin');
const elBtnLogin = document.getElementById('btn-login');
const elFilterDate = document.getElementById('filter-date');
const elFilterStatus = document.getElementById('filter-status');
const elMetricTotal = document.getElementById('metric-total');
const elMetricPending = document.getElementById('metric-pending');
const elMetricRevenue = document.getElementById('metric-revenue');
const elReservationsBody = document.getElementById('reservations-body');

const todayDate = new Date().toISOString().split('T')[0];
elFecha.min = todayDate;
elFilterDate.value = todayDate;

elBtnNavClient.addEventListener('click', () => switchView('client'));
elBtnNavAdmin.addEventListener('click', () => switchView('admin'));

function switchView(view) {
  if (view === 'client') {
    elViewClient.classList.add('active');
    elViewAdmin.classList.remove('active');
    elViewAdmin.classList.add('hide');
    elViewClient.classList.remove('hide');
    elBtnNavClient.classList.add('active');
    elBtnNavAdmin.classList.remove('active');
  } else {
    elViewAdmin.classList.add('active');
    elViewClient.classList.remove('active');
    elViewClient.classList.add('hide');
    elViewAdmin.classList.remove('hide');
    elBtnNavAdmin.classList.add('active');
    elBtnNavClient.classList.remove('active');
  }
}

onValue(ref(db, 'reservas'), (snapshot) => {
  allReservations = snapshot.val() || {};
  if (elFecha.value) {
    renderTimeSlots(elFecha.value);
  }
  renderAdminDashboard();
});

elFecha.addEventListener('change', (e) => {
  selectedTime = null;
  renderTimeSlots(e.target.value);
});

function renderTimeSlots(dateSelected) {
  elTimeSlots.innerHTML = '';
  const bookedTimes = Object.values(allReservations)
    .filter(r => r.fecha === dateSelected && r.estado !== 'cancelado')
    .map(r => r.hora);

  timeSlotsConfig.forEach(slot => {
    const div = document.createElement('div');
    div.className = 'time-slot';
    div.textContent = slot;
    
    if (bookedTimes.includes(slot)) {
      div.classList.add('disabled');
    } else {
      div.addEventListener('click', () => {
        document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        selectedTime = slot;
      });
    }
    
    if (selectedTime === slot && !bookedTimes.includes(slot)) {
      div.classList.add('selected');
    }
    
    elTimeSlots.appendChild(div);
  });
}

elBookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!selectedTime) {
    showToast('Por favor, selecciona una hora para la cita.', 'error');
    return;
  }
  
  const servicioEl = document.getElementById('servicio');
  const precio = parseFloat(servicioEl.options[servicioEl.selectedIndex].dataset.price);
  
  const bookingData = {
    cliente: document.getElementById('nombre').value,
    telefono: document.getElementById('telefono').value,
    servicio: servicioEl.value,
    precio: precio,
    fecha: elFecha.value,
    hora: selectedTime,
    estado: "pendiente",
    notas: document.getElementById('notas').value,
    creadoEl: new Date().toISOString()
  };

  const isBooked = Object.values(allReservations).some(
    r => r.fecha === bookingData.fecha && r.hora === bookingData.hora && r.estado !== 'cancelado'
  );
  
  if (isBooked) {
    showToast('El horario seleccionado acaba de ser reservado. Por favor elige otro.', 'error');
    renderTimeSlots(elFecha.value);
    return;
  }

  setLoading(true);
  try {
    const newResRef = push(ref(db, 'reservas'));
    await set(newResRef, bookingData);
    showToast('¡Reserva confirmada exitosamente!', 'success');
    elBookingForm.reset();
    selectedTime = null;
    elTimeSlots.innerHTML = '';
  } catch (error) {
    showToast('Ocurrió un error al procesar tu reserva. Intenta de nuevo.', 'error');
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  if (isLoading) {
    elBtnSubmit.disabled = true;
    elBtnText.classList.add('hide');
    elSpinner.classList.remove('hide');
  } else {
    elBtnSubmit.disabled = false;
    elBtnText.classList.remove('hide');
    elSpinner.classList.add('hide');
  }
}

function showToast(message, type) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

elBtnLogin.addEventListener('click', () => {
  if (elAdminPin.value === "1234") {
    elAdminLogin.classList.add('hide');
    elAdminDashboard.classList.remove('hide');
    renderAdminDashboard();
    elAdminPin.value = '';
  } else {
    showToast('PIN de acceso incorrecto', 'error');
  }
});

elFilterDate.addEventListener('change', renderAdminDashboard);
elFilterStatus.addEventListener('change', renderAdminDashboard);

function renderAdminDashboard() {
  if (elAdminDashboard.classList.contains('hide')) return;

  const dateFilter = elFilterDate.value;
  const statusFilter = elFilterStatus.value;
  
  let filteredList = Object.entries(allReservations).map(([id, data]) => ({ id, ...data }));

  if (dateFilter) {
    filteredList = filteredList.filter(r => r.fecha === dateFilter);
  }
  
  if (statusFilter !== 'todas') {
    filteredList = filteredList.filter(r => r.estado === statusFilter);
  }

  filteredList.sort((a, b) => a.hora.localeCompare(b.hora));

  elReservationsBody.innerHTML = '';
  let totalCitas = 0;
  let pendientes = 0;
  let ganancia = 0;

  filteredList.forEach(r => {
    if (r.estado !== 'cancelado') {
      totalCitas++;
      if (r.estado === 'pendiente') pendientes++;
      ganancia += parseFloat(r.precio || 0);
    }

    const tr = document.createElement('tr');
    
    let btnsHTML = '';
    if (r.estado === 'pendiente') {
      btnsHTML = `
        <button class="btn-action btn-atender" data-id="${r.id}">Atender</button>
        <button class="btn-action btn-cancelar" data-id="${r.id}">Cancelar</button>
      `;
    }
    btnsHTML += `<button class="btn-action btn-eliminar" data-id="${r.id}">Eliminar</button>`;

    tr.innerHTML = `
      <td><strong>${r.cliente}</strong><br><small>${r.notas || 'Sin notas'}</small></td>
      <td>${r.telefono}</td>
      <td>${r.servicio} ($${r.precio})</td>
      <td>${r.fecha}<br>${r.hora}</td>
      <td><span class="status-badge status-${r.estado}">${r.estado}</span></td>
      <td class="action-btns">${btnsHTML}</td>
    `;
    
    elReservationsBody.appendChild(tr);
  });

  elMetricTotal.textContent = totalCitas;
  elMetricPending.textContent = pendientes;
  elMetricRevenue.textContent = `$${ganancia.toFixed(2)}`;

  document.querySelectorAll('.btn-atender').forEach(btn => {
    btn.addEventListener('click', (e) => updateReservationStatus(e.target.dataset.id, 'atendido'));
  });
  
  document.querySelectorAll('.btn-cancelar').forEach(btn => {
    btn.addEventListener('click', (e) => updateReservationStatus(e.target.dataset.id, 'cancelado'));
  });
  
  document.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', (e) => deleteReservation(e.target.dataset.id));
  });
}

async function updateReservationStatus(id, newStatus) {
  try {
    await update(ref(db, `reservas/${id}`), { estado: newStatus });
    showToast(`La reserva ha sido marcada como ${newStatus}.`, 'success');
  } catch (error) {
    showToast('Error de conexión al actualizar el estado.', 'error');
  }
}

async function deleteReservation(id) {
  if (confirm('¿Estás absolutamente seguro de que deseas eliminar este registro de la base de datos? Esta acción es irreversible.')) {
    try {
      await remove(ref(db, `reservas/${id}`));
      showToast('Registro de reserva eliminado correctamente.', 'success');
    } catch (error) {
      showToast('Error de conexión al intentar eliminar el registro.', 'error');
    }
  }
}