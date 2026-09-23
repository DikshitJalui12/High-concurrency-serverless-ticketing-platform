/**
 * Gatehouse — High-Concurrency Serverless Event Platform MVP
 * Production UI Prototype aligned with PRD specifications
 */

// Authoritative State
const state = {
  selected: [],
  reserved: false,
  purchased: JSON.parse(localStorage.getItem('gatehouseTickets') || '[]'),
  reservationRemaining: 300,
  queuePosition: 12482,
  queuePercent: 31,
  admissionRate: 120,
  fairnessMode: 'arrival',
  activeQrTicket: null,
  events: [
    {
      id: 'afterlight',
      name: 'The Midnight Stations — Afterlight',
      tour: 'World Tour 2026',
      date: '18 SEP 2026 · OLYMPIA ARENA',
      venue: 'Olympia Arena, London',
      c: 'concert',
      status: 'LIVE SALE'
    },
    {
      id: 'nocturne',
      name: 'Nocturne Festival',
      tour: 'Autumn Series',
      date: '12 OCT 2026 · VICTORIA PARK',
      venue: 'Victoria Park, London',
      c: 'blue',
      status: 'PRE-SALE'
    },
    {
      id: 'anais',
      name: 'Anaïs Mitchell',
      tour: 'Acoustic Residency',
      date: '29 SEP 2026 · BARBICAN HALL',
      venue: 'Barbican Hall, London',
      c: 'red',
      status: 'WAITLIST'
    },
    {
      id: 'fieldday',
      name: 'Field Day',
      tour: 'Day & Night Edition',
      date: '04 OCT 2026 · WALTHAMSTOW',
      venue: 'Walthamstow Marshes',
      c: 'green',
      status: 'LIVE SALE'
    }
  ],
  traces: {
    'ORD-94D3F': {
      id: 'ORD-94D3F',
      correlationId: 'CORR-019842F-B21',
      actor: 'USR-71275-DK',
      status: 'COMMITTED',
      totalTime: '314 ms',
      spans: [
        { name: 'Edge API Gateway', duration: '3 ms', detail: 'Token verified, rate limits checked' },
        { name: 'Queue Controller', duration: '12 ms', detail: 'Valid admission token accepted (#8F9D)' },
        { name: 'Inventory Aggregate', duration: '46 ms', detail: 'Conditional write: 2 seats leased (L4C, L5C)' },
        { name: 'Payment PSP Adapter', duration: '210 ms', detail: 'Idempotent capture completed via tokenized PSP' },
        { name: 'Transactional Outbox', duration: '15 ms', detail: 'Event OrderPurchased emitted to Kafka broker' },
        { name: 'Credential Worker', duration: '28 ms', detail: 'Rotating QR token generated & signed' }
      ],
      eventPayload: {
        eventType: 'OrderPurchased',
        aggregateId: 'AGG-AFTERLIGHT-2026',
        aggregateVersion: 14382,
        orderId: 'ORD-94D3F',
        idempotencyKey: 'IDEM-94D3F-B82C',
        currency: 'GBP',
        amount: 130.0,
        tickets: ['L4C', 'L5C'],
        timestamp: '2026-09-09T11:45:12.821Z'
      }
    },
    'PAY-8AE2': {
      id: 'PAY-8AE2',
      correlationId: 'CORR-PAY-8AE2-X90',
      actor: 'USR-71275-DK',
      status: 'CAPTURED_IDEMPOTENT',
      totalTime: '242 ms',
      spans: [
        { name: 'Edge API Gateway', duration: '2 ms', detail: 'Signature verified' },
        { name: 'Payment Intent Saga', duration: '18 ms', detail: 'Durable saga created state=AUTHORIZING' },
        { name: 'PSP Gateway Adapter', duration: '198 ms', detail: 'Idempotency key matched existing intent; deduplicated capture' },
        { name: 'Outbox Event Logger', duration: '24 ms', detail: 'PaymentAuthorized event dispatched' }
      ],
      eventPayload: {
        eventType: 'PaymentAuthorized',
        paymentId: 'PAY-8AE2',
        providerRef: 'ch_3Nx982Kl81Fp',
        idempotentReplay: false,
        amount: 130.0,
        timestamp: '2026-09-09T11:46:02.102Z'
      }
    },
    'RSV-882A': {
      id: 'RSV-882A',
      correlationId: 'CORR-RSV-882A-AUTO',
      actor: 'SYS-EXPIRY-WORKER',
      status: 'EXPIRED_RELEASED',
      totalTime: '68 ms',
      spans: [
        { name: 'Lease Expiry Watchdog', duration: '5 ms', detail: 'TTL 300s expired without payment capture' },
        { name: 'Authoritative Inventory', duration: '41 ms', detail: 'Atomic release: seats L1A, L2A returned to Available' },
        { name: 'Read Projection Reconciler', duration: '22 ms', detail: 'CQRS cache updated with zero inventory drift' }
      ],
      eventPayload: {
        eventType: 'ReservationExpired',
        reservationId: 'RSV-882A',
        reason: 'TTL_TIMEOUT',
        seatsReleased: ['L1A', 'L2A'],
        reconciliationStatus: 'PERFECT_MATCH',
        timestamp: '2026-09-09T11:44:00.000Z'
      }
    }
  }
};

// Seat Inventory (72 seats across 6 rows A–F, 12 seats each)
// Rows A–B (0–23): VIP Balcony (£95)
// Rows C–F (24–71): Lower Bowl (£65)
const seats = Array.from({ length: 72 }, (_, i) => {
  const rowChar = String.fromCharCode(65 + Math.floor(i / 12));
  const seatNum = (i % 12) + 1;
  const isVip = i < 24;
  return {
    id: `L${rowChar}${seatNum}`,
    tier: isVip ? 'VIP Balcony' : 'Lower Bowl',
    price: isVip ? 95 : 65,
    unavailable: [3, 7, 14, 19, 31, 43, 46, 57, 64, 70].includes(i)
  };
});

// Mark already purchased seats as unavailable
state.purchased.forEach(ticket => {
  if (ticket.status === 'valid' && Array.isArray(ticket.seats)) {
    ticket.seats.forEach(seatId => {
      const s = seats.find(x => x.id === seatId);
      if (s) s.unavailable = true;
    });
  }
});

// Currency Formatter
const fmt = amount => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

// SPA Router
function route(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById(id);
  if (targetView) {
    targetView.classList.add('active');
  }
  document.querySelectorAll('.nav-link').forEach(n => {
    n.classList.toggle('active', n.dataset.route === id);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (id === 'tickets') renderTickets();
  if (id === 'organizer') updateOrganizerMetrics();
  if (id === 'operations') renderOperationsTimeline();
}

// Toast Notification
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// Render Trending Events in Discover View
function renderEvents() {
  const container = document.getElementById('eventGrid');
  if (!container) return;
  const trending = state.events.slice(1, 4);
  container.innerHTML = trending
    .map(
      e => `
    <article class="event-tile" data-action="open-event" data-event-id="${e.id}">
      <div class="tile-image ${e.c}"></div>
      <div class="tile-info">
        <p>${e.date}</p>
        <h3>${e.name}</h3>
      </div>
    </article>
  `
    )
    .join('');
}

// Render Full Event Catalog Modal
function renderFullCatalog() {
  const grid = document.getElementById('fullCatalogGrid');
  if (!grid) return;
  grid.innerHTML = state.events
    .map(
      e => `
    <div class="catalog-card" data-action="open-event" data-event-id="${e.id}">
      <span class="live-pill">${e.status}</span>
      <h3>${e.name}</h3>
      <p>${e.tour}</p>
      <p style="margin-top:4px;color:var(--lime);">${e.date}</p>
    </div>
  `
    )
    .join('');
}

// Render Interactive Seat Map
function renderSeats() {
  const seatMap = document.getElementById('seatMap');
  if (!seatMap) return;
  seatMap.innerHTML = seats
    .map(s => {
      const isSelected = state.selected.includes(s.id);
      return `<button 
        class="seat ${s.unavailable ? 'unavailable' : ''} ${isSelected ? 'selected' : ''}" 
        ${s.unavailable ? 'disabled' : ''} 
        data-seat="${s.id}" 
        aria-label="${s.id}, ${s.tier}, ${fmt(s.price)}" 
        title="${s.id} (${s.tier}) — ${fmt(s.price)}">
      </button>`;
    })
    .join('');

  document.querySelectorAll('[data-seat]').forEach(b => {
    b.addEventListener('click', () => toggleSeat(b.dataset.seat));
  });
}

// Seat Selection Logic (2-ticket limit per verified fan)
function toggleSeat(id) {
  if (state.selected.includes(id)) {
    state.selected = state.selected.filter(s => s !== id);
  } else if (state.selected.length < 2) {
    state.selected.push(id);
  } else {
    toast('A maximum of two tickets applies to this verified fan allocation.');
    return;
  }
  renderSeats();
  renderCart();
}

// Render Cart Panel with Tier-Aware Details
function renderCart() {
  const items = document.getElementById('cartItems');
  const empty = document.getElementById('cartEmpty');
  const reserveBtn = document.getElementById('reserveButton');
  if (!items || !empty || !reserveBtn) return;

  const total = state.selected.reduce((sum, id) => {
    const s = seats.find(x => x.id === id);
    return sum + (s ? s.price : 0);
  }, 0);

  empty.style.display = state.selected.length ? 'none' : 'block';

  items.innerHTML = state.selected
    .map(id => {
      const s = seats.find(x => x.id === id);
      const tierName = s ? s.tier : 'Lower Bowl';
      const priceVal = s ? s.price : 65;
      return `
      <div class="cart-item">
        <div>
          <b>${tierName} · ${id}</b>
          <span>Strongly consistent lease hold</span>
        </div>
        <b>${fmt(priceVal)}</b>
      </div>
    `;
    })
    .join('');

  document.getElementById('cartTotal').textContent = fmt(total);
  reserveBtn.disabled = state.selected.length === 0;
}

// Reservation Timer (5-minute TTL with clean expiration lockdown)
function startTimer() {
  state.reservationRemaining = 300;
  const timerSelect = document.getElementById('reservationTimer');
  const timerCheckout = document.getElementById('checkoutTimer');
  const expiredNotice = document.getElementById('checkoutExpiredNotice');
  const payBtn = document.getElementById('payButton');

  if (expiredNotice) expiredNotice.style.display = 'none';
  if (payBtn) payBtn.disabled = false;

  clearInterval(window.reserveTimer);
  window.reserveTimer = setInterval(() => {
    state.reservationRemaining--;
    const mins = String(Math.floor(state.reservationRemaining / 60)).padStart(2, '0');
    const secs = String(state.reservationRemaining % 60).padStart(2, '0');
    const timeStr = `${mins}:${secs}`;

    if (timerSelect) timerSelect.textContent = timeStr;
    if (timerCheckout) timerCheckout.textContent = timeStr;

    if (state.reservationRemaining <= 0) {
      clearInterval(window.reserveTimer);
      state.reserved = false;
      if (payBtn) payBtn.disabled = true;
      if (expiredNotice) expiredNotice.style.display = 'block';

      toast('Your temporary 5-minute reservation expired.');
      // Auto-reconcile after 2.5s if still on checkout
      setTimeout(() => {
        state.selected = [];
        route('select');
        renderSeats();
        renderCart();
      }, 2500);
    }
  }, 1000);
}

// Reserve Action (Transition: Requested -> Reserved)
function reserve() {
  if (state.selected.length === 0) return;
  state.reserved = true;
  startTimer();

  // Generate unique idempotency key for this reservation
  const randHex = Math.random().toString(16).slice(2, 6).toUpperCase();
  const idemKey = `IDEM-${randHex}-${Date.now().toString().slice(-4)}`;
  const idemDisplay = document.getElementById('idempotencyKeyDisplay');
  if (idemDisplay) idemDisplay.textContent = idemKey;

  const total = state.selected.reduce((a, id) => {
    const s = seats.find(s => s.id === id);
    return a + (s ? s.price : 0);
  }, 0);

  const checkoutSeats = document.getElementById('checkoutSeats');
  if (checkoutSeats) {
    checkoutSeats.innerHTML = state.selected
      .map(id => {
        const s = seats.find(s => s.id === id);
        const tierName = s ? s.tier : 'Lower Bowl';
        const priceVal = s ? s.price : 65;
        return `
        <div class="checkout-seat">
          <span><b>${tierName}</b> · Seat ${id}</span>
          <b>${fmt(priceVal)}</b>
        </div>
      `;
      })
      .join('');
  }

  document.getElementById('checkoutTotal').textContent = fmt(total);
  route('checkout');
}

// Purchase Action (Transition: Reserved -> Purchased -> Issued)
function purchase(e) {
  e.preventDefault();
  if (!state.reserved || state.reservationRemaining <= 0) {
    toast('Your reservation lease is no longer active.');
    route('select');
    return;
  }

  const total = state.selected.reduce((a, id) => {
    const s = seats.find(s => s.id === id);
    return a + (s ? s.price : 0);
  }, 0);

  const orderHex = Math.random().toString(16).slice(2, 8).toUpperCase();
  const orderRef = `ORD-${orderHex}`;
  const corrRef = `CORR-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;

  const ticket = {
    id: `TKT-${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
    order: orderRef,
    correlationId: corrRef,
    event: 'The Midnight Stations — Afterlight',
    date: '18 September 2026 · Olympia Arena London',
    seats: [...state.selected],
    total,
    status: 'valid',
    issuedAt: new Date().toISOString()
  };

  // Append to state and persist
  state.purchased.unshift(ticket);
  localStorage.setItem('gatehouseTickets', JSON.stringify(state.purchased));

  // Mark authoritative seats unavailable
  state.selected.forEach(id => {
    const s = seats.find(s => s.id === id);
    if (s) s.unavailable = true;
  });

  // Record dynamic trace in operations timeline
  state.traces[orderRef] = {
    id: orderRef,
    correlationId: corrRef,
    actor: 'USR-71275-DK',
    status: 'COMMITTED',
    totalTime: '298 ms',
    spans: [
      { name: 'Edge API Gateway', duration: '2 ms', detail: 'Idempotency key checked & locked' },
      { name: 'Admission Token Validator', duration: '9 ms', detail: 'Token signed with RS256 validated' },
      { name: 'Authoritative Inventory', duration: '44 ms', detail: `Atomic commit: ${ticket.seats.join(', ')} assigned` },
      { name: 'PSP Adapter (Idempotent)', duration: '205 ms', detail: 'Payment captured via demo PSP' },
      { name: 'Transactional Outbox', duration: '14 ms', detail: 'Domain event OrderPurchased published' },
      { name: 'Credential Worker', duration: '24 ms', detail: 'Rotating QR token issued and verified' }
    ],
    eventPayload: {
      eventType: 'OrderPurchased',
      orderId: orderRef,
      correlationId: corrRef,
      seats: ticket.seats,
      total,
      currency: 'GBP',
      timestamp: ticket.issuedAt
    }
  };

  // Update Confirmation Screen
  const confirmOrder = document.getElementById('confirmOrderRef');
  if (confirmOrder) confirmOrder.textContent = `Order: ${orderRef} · ${ticket.seats.join(' · ')}`;
  state.activeQrTicket = ticket;

  // Cleanup state
  state.selected = [];
  state.reserved = false;
  clearInterval(window.reserveTimer);

  route('confirmation');
  toast('Payment captured idempotently. Tickets issued!');
}

// Render Owned Tickets Dashboard with Actions
function renderTickets() {
  const el = document.getElementById('ticketList');
  if (!el) return;

  if (!state.purchased.length) {
    el.innerHTML = '<div class="cart-empty">No tickets yet. Discover an event to get started.</div>';
    return;
  }

  el.innerHTML = state.purchased
    .map(t => {
      const statusBadge =
        t.status === 'valid'
          ? '<span class="badge-tag valid">● Active credential</span>'
          : t.status === 'transferred'
            ? '<span class="badge-tag transferred">○ Transferred to recipient</span>'
            : '<span class="badge-tag refunded">✕ Refunded & Released</span>';

      const showQrBtn =
        t.status === 'valid'
          ? `<button class="button primary" data-action="open-qr" data-ticket-id="${t.id}">Show Dynamic QR</button>`
          : '';

      return `
      <article class="owned-ticket ${t.status}">
        <div>
          ${statusBadge}
          <p>${t.date}</p>
          <h2>${t.event}</h2>
          <p><b>Seats:</b> ${t.seats.join(' · ')} &nbsp;|&nbsp; <b>Order:</b> <a class="corr-link" data-trace="${t.order}">${t.order}</a></p>
        </div>
        <div class="ticket-item-actions">
          ${showQrBtn}
        </div>
      </article>
    `;
    })
    .join('');

  // Update profile quota
  const validCount = state.purchased.filter(t => t.status === 'valid').length;
  const quotaElem = document.getElementById('profileQuotaRemaining');
  if (quotaElem) {
    const rem = Math.max(0, 2 - validCount * 2);
    quotaElem.textContent = `${rem} / 2 tickets remaining this period`;
  }
}

// Dynamic Rotating QR Code Generator (Rotates every 15s to prevent scalper screenshots)
function openQrModal(ticket) {
  if (!ticket) return;
  state.activeQrTicket = ticket;
  const modal = document.getElementById('qrModal');
  const eventHeading = document.getElementById('qrTicketEvent');
  const meta = document.getElementById('qrTicketMeta');

  if (eventHeading) eventHeading.textContent = ticket.event;
  if (meta) meta.textContent = `${ticket.date} · Seats: ${ticket.seats.join(', ')} · ${ticket.order}`;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  startQrRotator();
}

function startQrRotator() {
  state.qrRotationSeconds = 15;
  updateQrVisuals();

  clearInterval(window.qrInterval);
  window.qrInterval = setInterval(() => {
    state.qrRotationSeconds--;
    const fill = document.getElementById('qrBarFill');
    const secDisplay = document.getElementById('qrTimerSeconds');

    if (secDisplay) secDisplay.textContent = `${state.qrRotationSeconds}s`;
    if (fill) fill.style.width = `${(state.qrRotationSeconds / 15) * 100}%`;

    if (state.qrRotationSeconds <= 0) {
      state.qrRotationSeconds = 15;
      updateQrVisuals();
    }
  }, 1000);
}

function updateQrVisuals() {
  const tokenString = document.getElementById('qrTokenString');
  const qrCanvas = document.getElementById('qrCanvas');
  const fill = document.getElementById('qrBarFill');

  const randHex = Math.random().toString(16).slice(2, 8).toUpperCase();
  const token = `GATEHOUSE-V2-SIG-${randHex}-${Date.now().toString().slice(-4)}`;
  state.qrToken = token;

  if (tokenString) tokenString.textContent = token;
  if (fill) fill.style.width = '100%';

  // Alternate visual patterns to simulate rotation
  const patterns = ['▦', '▧', '▥', '▩'];
  if (qrCanvas) {
    qrCanvas.textContent = patterns[Math.floor(Math.random() * patterns.length)];
  }
}

function closeQrModal() {
  const modal = document.getElementById('qrModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
  clearInterval(window.qrInterval);
}

// Ticket Transfer Action (US-09, FR-TX-05)
function transferCurrentTicket() {
  if (!state.activeQrTicket) return;
  const recipient = prompt('Enter recipient fan email address for verified transfer:');
  if (!recipient || !recipient.includes('@')) {
    toast('Transfer cancelled: Valid email required.');
    return;
  }

  state.activeQrTicket.status = 'transferred';
  localStorage.setItem('gatehouseTickets', JSON.stringify(state.purchased));

  // Add transfer trace
  const transferRef = `XFER-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
  state.traces[transferRef] = {
    id: transferRef,
    correlationId: `CORR-${transferRef}`,
    actor: 'USR-71275-DK',
    status: 'TRANSFERRED',
    totalTime: '185 ms',
    spans: [
      { name: 'Transfer Eligibility Check', duration: '12 ms', detail: 'Original order verified, transfer permitted' },
      { name: 'Recipient Entitlement Check', duration: '28 ms', detail: `Recipient ${recipient} validated (Level 2)` },
      { name: 'Authoritative Reissue', duration: '64 ms', detail: 'Old cryptographic token revoked; new token minted' },
      { name: 'Outbox Event Logger', duration: '18 ms', detail: 'TransferCompleted dispatched' }
    ],
    eventPayload: {
      eventType: 'TransferCompleted',
      orderId: state.activeQrTicket.order,
      seats: state.activeQrTicket.seats,
      recipient,
      timestamp: new Date().toISOString()
    }
  };

  closeQrModal();
  renderTickets();
  toast(`Ticket transferred to ${recipient}. Original barcode revoked.`);
}

// Ticket Refund Action (Releases authoritative inventory lease)
function refundCurrentTicket() {
  if (!state.activeQrTicket) return;
  const confirmed = confirm('Are you sure you want to refund this ticket? The seats will be immediately released back to the general pool.');
  if (!confirmed) return;

  state.activeQrTicket.status = 'refunded';
  localStorage.setItem('gatehouseTickets', JSON.stringify(state.purchased));

  // Release authoritative seats back to available!
  state.activeQrTicket.seats.forEach(seatId => {
    const s = seats.find(x => x.id === seatId);
    if (s) s.unavailable = false;
  });

  // Record refund trace
  const refundRef = `RFND-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
  state.traces[refundRef] = {
    id: refundRef,
    correlationId: `CORR-${refundRef}`,
    actor: 'USR-71275-DK',
    status: 'REFUNDED_COMPENSATED',
    totalTime: '194 ms',
    spans: [
      { name: 'Policy Validation', duration: '8 ms', detail: 'Event cancellation window > 48 hrs: Full refund eligible' },
      { name: 'Authoritative Inventory Release', duration: '42 ms', detail: `Seats ${state.activeQrTicket.seats.join(', ')} marked Available` },
      { name: 'PSP Refund Gateway', duration: '120 ms', detail: `Credit of ${fmt(state.activeQrTicket.total)} issued` },
      { name: 'Outbox Dispatch', duration: '24 ms', detail: 'RefundCompleted emitted; projections notified' }
    ],
    eventPayload: {
      eventType: 'RefundCompleted',
      orderId: state.activeQrTicket.order,
      seatsReleased: state.activeQrTicket.seats,
      amountRefunded: state.activeQrTicket.total,
      timestamp: new Date().toISOString()
    }
  };

  closeQrModal();
  renderTickets();
  renderSeats();
  toast('Refund processed. Inventory released back to sale.');
}

// Waiting Room Simulator (With reset and proper string escaping)
function simulateQueue() {
  state.queuePosition = 12482;
  state.queuePercent = 31;

  const position = document.getElementById('queuePosition');
  const percent = document.getElementById('queuePercent');
  const fill = document.getElementById('queueFill');
  const status = document.getElementById('queueStatus');

  // Clean visual reset immediately
  if (position) position.textContent = state.queuePosition.toLocaleString('en-GB');
  if (percent) percent.textContent = `${state.queuePercent}%`;
  if (fill) fill.style.width = `${state.queuePercent}%`;
  if (status) status.textContent = 'We’re moving you through securely. Estimated wait: about 8 minutes.';

  clearInterval(window.queueTimer);
  window.queueTimer = setInterval(() => {
    state.queuePosition = Math.max(1, state.queuePosition - Math.ceil(Math.random() * 160));
    state.queuePercent = Math.min(99, state.queuePercent + Math.ceil(Math.random() * 2));

    if (position) position.textContent = state.queuePosition.toLocaleString('en-GB');
    if (percent) percent.textContent = `${state.queuePercent}%`;
    if (fill) fill.style.width = `${state.queuePercent}%`;

    if (state.queuePercent >= 99) {
      if (status) status.textContent = "You're next! We're securely admitting you now...";
    }
  }, 1800);
}

// Distributed Trace Explorer (FR-OP-02, US-07)
function openTraceModal(targetId) {
  const modal = document.getElementById('traceModal');
  const input = document.getElementById('traceSearchInput');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  if (targetId) {
    if (input) input.value = targetId;
    renderTraceDetails(targetId);
  } else {
    renderTraceDetails('ORD-94D3F');
  }
}

function renderTraceDetails(traceId) {
  const results = document.getElementById('traceResults');
  if (!results) return;

  const data = state.traces[traceId] || {
    id: traceId,
    correlationId: `CORR-${traceId}`,
    actor: 'USR-71275-DK',
    status: 'COMMITTED',
    totalTime: '280 ms',
    spans: [
      { name: 'Edge API Gateway', duration: '3 ms', detail: 'Token verified, rate limits checked' },
      { name: 'Queue Controller', duration: '14 ms', detail: 'Signed admission token accepted' },
      { name: 'Authoritative Inventory', duration: '52 ms', detail: 'Atomic conditional write verified' },
      { name: 'Payment Intent Saga', duration: '195 ms', detail: 'PSP idempotency token matched and captured' },
      { name: 'Transactional Outbox', duration: '16 ms', detail: 'Domain event dispatched' }
    ],
    eventPayload: {
      eventType: 'OrderPurchased',
      queryId: traceId,
      timestamp: new Date().toISOString()
    }
  };

  results.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <div>
        <h3 style="margin:0;font-size:18px;">${data.id}</h3>
        <span style="color:var(--muted);font-size:11px;font-family:var(--mono);">Correlation: ${data.correlationId}</span>
      </div>
      <div style="text-align:right;">
        <span class="badge-tag valid">${data.status}</span>
        <div style="color:var(--lime);font-family:var(--mono);font-size:12px;margin-top:2px;">Duration: ${data.totalTime}</div>
      </div>
    </div>
    <div class="trace-span-tree">
      ${data.spans
        .map(
          s => `
        <div class="trace-span">
          <div class="trace-span-header">
            <b>${s.name}</b>
            <span>${s.duration}</span>
          </div>
          <p>${s.detail}</p>
        </div>
      `
        )
        .join('')}
    </div>
    <div class="trace-json-box">
      <strong>Immutable Domain Event Payload (Transactional Outbox):</strong>
      <pre style="margin:6px 0 0;">${JSON.stringify(data.eventPayload, null, 2)}</pre>
    </div>
  `;
}

// Render Operations Timeline
function renderOperationsTimeline() {
  const timeline = document.getElementById('operationsTimeline');
  if (!timeline) return;

  const entries = [
    { title: 'Order committed', tag: 'ORD-94D3F', desc: 'two Lower Bowl seats', time: 'now' },
    { title: 'Payment captured idempotently', tag: 'PAY-8AE2', desc: 'correlation 1f2c…', time: '1 min ago' },
    { title: 'Reservation expired and released', tag: 'RSV-882A', desc: 'no payment initiated, lease returned', time: '2 min ago' },
    { title: 'Risk challenge escalated', tag: 'CHLG-38A', desc: 'device velocity threshold crossed (CAPTCHA passed)', time: '4 min ago', warning: true }
  ];

  // Add any user orders to the top of the timeline
  state.purchased.forEach((ticket, idx) => {
    if (idx < 2) {
      entries.unshift({
        title: `Order ${ticket.status === 'valid' ? 'committed' : ticket.status}`,
        tag: ticket.order,
        desc: `${ticket.seats.join(', ')} · ${fmt(ticket.total)}`,
        time: 'just now'
      });
    }
  });

  timeline.innerHTML = entries
    .map(
      e => `
    <div>
      <span class="timeline-dot ${e.warning ? 'warning' : ''}"></span>
      <p>
        <b>${e.title}</b> · <a class="corr-link" data-trace="${e.tag}">${e.tag}</a> · ${e.desc}
        <small>${e.time}</small>
      </p>
    </div>
  `
    )
    .join('');

  document.querySelectorAll('[data-trace]').forEach(el => {
    el.addEventListener('click', () => openTraceModal(el.dataset.trace));
  });
}

// Update Organizer Metrics
function updateOrganizerMetrics() {
  const soldElem = document.getElementById('orgTicketsSold');
  const availElem = document.getElementById('orgAvailInv');
  const vipElem = document.getElementById('countVip');
  const lowerElem = document.getElementById('countLower');
  const rateElem = document.getElementById('orgAdmissionRate');
  const modeElem = document.getElementById('orgPolicyBadge');

  if (rateElem) rateElem.textContent = `${state.admissionRate} / min`;
  if (modeElem) {
    modeElem.textContent =
      state.fairnessMode === 'arrival'
        ? 'Verified Arrival'
        : state.fairnessMode === 'lottery'
          ? 'Randomized Lottery'
          : 'Verified Fan Entitlement';
  }

  // Calculate live counts from seats array
  const totalAvail = seats.filter(s => !s.unavailable).length;
  const vipAvail = seats.filter(s => !s.unavailable && s.tier === 'VIP Balcony').length;
  const lowerAvail = seats.filter(s => !s.unavailable && s.tier === 'Lower Bowl').length;

  if (availElem) availElem.textContent = (1800 + totalAvail).toLocaleString('en-GB');
  if (vipElem) vipElem.textContent = `${48 + vipAvail} left`;
  if (lowerElem) lowerElem.textContent = `${1150 + lowerAvail} left`;
}

// Admission Policy Controller Form
function applyAdmissionPolicy() {
  const algSelect = document.getElementById('policyAlgorithmSelect');
  const rateSlider = document.getElementById('admissionRateSlider');
  const starvationCheck = document.getElementById('starvationToggle');

  if (algSelect) state.fairnessMode = algSelect.value;
  if (rateSlider) state.admissionRate = parseInt(rateSlider.value, 10);

  const modeDisplay = document.getElementById('activeFairnessModeDisplay');
  const noteDisplay = document.getElementById('activeFairnessNote');

  if (state.fairnessMode === 'arrival') {
    if (modeDisplay) modeDisplay.innerHTML = 'Verified<br>arrival';
    if (noteDisplay) noteDisplay.textContent = 'One place per verified fan (FCFS)';
  } else if (state.fairnessMode === 'lottery') {
    if (modeDisplay) modeDisplay.innerHTML = 'Waiting<br>lottery';
    if (noteDisplay) noteDisplay.textContent = 'Equalized arrival pool';
  } else {
    if (modeDisplay) modeDisplay.innerHTML = 'Fan tier<br>priority';
    if (noteDisplay) noteDisplay.textContent = 'High-loyalty human priority';
  }

  updateOrganizerMetrics();
  const opsRate = document.getElementById('opsAdmissionRate');
  if (opsRate) opsRate.textContent = `Admission rate: ${state.admissionRate}/min`;

  document.getElementById('policyModal').classList.remove('open');
  toast(`Policy updated: ${state.admissionRate} fans/min with ${state.fairnessMode} fairness mode.`);
}

// Create Event Action (FR-EM-01, FR-EM-02)
function createEvent(e) {
  e.preventDefault();
  const name = document.getElementById('newEventName').value;
  const date = document.getElementById('newEventDate').value;
  const venue = document.getElementById('newEventVenue').value;

  const newEvt = {
    id: `evt-${Date.now()}`,
    name,
    tour: 'Official Tour 2026',
    date: `${date} · ${venue.toUpperCase()}`,
    venue,
    c: 'concert',
    status: 'LIVE SALE'
  };

  state.events.unshift(newEvt);
  renderEvents();
  renderFullCatalog();

  document.getElementById('createEventModal').classList.remove('open');
  toast(`Event "${name}" published with authoritative tier allocations.`);
}

// Global Event Listeners & Router Wiring
document.addEventListener('click', e => {
  // Navigation routing
  const r = e.target.closest('[data-route]');
  if (r) {
    e.preventDefault();
    route(r.dataset.route);
    return;
  }

  // Interactive Action Dispatcher
  const a = e.target.closest('[data-action]');
  if (!a) return;
  const action = a.dataset.action;

  if (action === 'open-event') {
    route('event');
  } else if (action === 'join-queue') {
    route('queue');
    simulateQueue();
  } else if (action === 'skip-queue') {
    clearInterval(window.queueTimer);
    route('select');
    renderSeats();
    renderCart();
  } else if (action === 'show-how') {
    document.getElementById('modal').classList.add('open');
  } else if (action === 'close-modal') {
    document.getElementById('modal').classList.remove('open');
  } else if (action === 'open-qr') {
    const tId = a.dataset.ticketId;
    const ticket = state.purchased.find(t => t.id === tId);
    if (ticket) openQrModal(ticket);
  } else if (action === 'show-latest-qr') {
    if (state.activeQrTicket) openQrModal(state.activeQrTicket);
    else if (state.purchased.length) openQrModal(state.purchased[0]);
  } else if (action === 'close-qr-modal') {
    closeQrModal();
  } else if (action === 'open-trace') {
    openTraceModal();
  } else if (action === 'close-trace-modal') {
    document.getElementById('traceModal').classList.remove('open');
  } else if (action === 'adjust-policy') {
    document.getElementById('policyModal').classList.add('open');
  } else if (action === 'close-policy-modal') {
    document.getElementById('policyModal').classList.remove('open');
  } else if (action === 'create-event') {
    document.getElementById('createEventModal').classList.add('open');
  } else if (action === 'close-create-event-modal') {
    document.getElementById('createEventModal').classList.remove('open');
  } else if (action === 'open-profile') {
    document.getElementById('profileModal').classList.add('open');
  } else if (action === 'close-profile-modal') {
    document.getElementById('profileModal').classList.remove('open');
  } else if (action === 'view-all-events') {
    renderFullCatalog();
    document.getElementById('catalogModal').classList.add('open');
  } else if (action === 'close-catalog-modal') {
    document.getElementById('catalogModal').classList.remove('open');
  }
});

// Setup Form Handlers & DOM Listeners
document.addEventListener('DOMContentLoaded', () => {
  renderEvents();
  renderSeats();
  renderCart();
  renderOperationsTimeline();

  // Reservation & Payment form
  const reserveBtn = document.getElementById('reserveButton');
  if (reserveBtn) reserveBtn.addEventListener('click', reserve);

  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) paymentForm.addEventListener('submit', purchase);

  // Ticket Modal actions
  const transferBtn = document.getElementById('transferTicketBtn');
  if (transferBtn) transferBtn.addEventListener('click', transferCurrentTicket);

  const refundBtn = document.getElementById('refundTicketBtn');
  if (refundBtn) refundBtn.addEventListener('click', refundCurrentTicket);

  // Trace Explorer Search
  const traceSearchBtn = document.getElementById('traceSearchBtn');
  const traceInput = document.getElementById('traceSearchInput');
  if (traceSearchBtn && traceInput) {
    traceSearchBtn.addEventListener('click', () => {
      const q = traceInput.value.trim();
      if (q) renderTraceDetails(q);
    });
    traceInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = traceInput.value.trim();
        if (q) renderTraceDetails(q);
      }
    });
  }

  // Policy Modal Slider
  const rateSlider = document.getElementById('admissionRateSlider');
  const rateVal = document.getElementById('admissionRateVal');
  if (rateSlider && rateVal) {
    rateSlider.addEventListener('input', e => {
      rateVal.textContent = e.target.value;
    });
  }
  const savePolicyBtn = document.getElementById('savePolicyBtn');
  if (savePolicyBtn) savePolicyBtn.addEventListener('click', applyAdmissionPolicy);

  // Create Event Form
  const createEventForm = document.getElementById('createEventForm');
  if (createEventForm) createEventForm.addEventListener('submit', createEvent);
});

// Run initial renders immediately for inline scripts
renderEvents();
renderSeats();
renderCart();
