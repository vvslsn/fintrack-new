"use strict";

function ticketNo(ticket) { return String(ticket?.ticketNumber ?? ticket?.ticket ?? "").trim(); }
function schemeOf(ticket) { return ticket?.scheme || {}; }
function managerName(scheme) { return scheme?.manager?.fullName || scheme?.manager?.username || ""; }
function dueDate(scheme, month) { return window.getFintrackDueDate(scheme, month); }
function isPastGrace(row) {
  if (typeof window.isFintrackOverdue === "function") return window.isFintrackOverdue(row.scheme, row.month);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Boolean(row.due && new Date(row.due) < today);
}
function isInGrace(row) {
  return typeof window.isFintrackInGracePeriod === "function" && window.isFintrackInGracePeriod(row.scheme, row.month);
}
function amount(scheme, ticket, month) { return fintrackPaymentAmount(scheme, month, ticket); }
function sameId(a, b) { return String(a?._id || a?.id || a || "") === String(b?._id || b?.id || b || ""); }
function paidFor(data, ticket, month) {
  return data.payments.find(payment => sameId(payment.scheme, schemeOf(ticket)) && String(payment.ticketNumber) === ticketNo(ticket) && Number(payment.month) === Number(month) && String(payment.status).toLowerCase() === "paid");
}
function statusBadge(status) {
  const value = String(status || "active").toLowerCase();
  const kind = value === "paid" || value === "active" || value === "completed" ? "success" : value === "due" || value === "pending" ? "warning" : "neutral";
  return `<span class="badge ${kind}">${esc(value)}</span>`;
}
function payUrl(ticket, month) {
  return `user-pay.html?schemeId=${encodeURIComponent(schemeOf(ticket)._id || schemeOf(ticket).id || "")}&ticket=${encodeURIComponent(ticketNo(ticket))}&month=${encodeURIComponent(month)}`;
}
function buildInstallments(data) {
  const rows = [];
  data.tickets.forEach(ticket => {
    const scheme = schemeOf(ticket);
    for (let month = 1; month <= Number(scheme.duration || 0); month++) {
      const due = dueDate(scheme, month);
      const payment = paidFor(data, ticket, month);
      rows.push({ ticket, scheme, month, due, amount: amount(scheme, ticket, month), payment, paid: Boolean(payment) });
    }
  });
  return rows;
}
function renderError(error) {
  const target = document.getElementById("pageContent");
  if (target) target.innerHTML = `<div class="card"><div class="empty">${esc(error?.message || "Could not load your account. Please refresh and try again.")}</div></div>`;
}
async function setupPage(active, title, subtitle, render) {
  if (!requireUser()) return null;
  renderShell(active, title, subtitle);
  const target = document.getElementById("pageContent");
  target.innerHTML = `<div class="card"><div class="empty">Loading your account…</div></div>`;
  try {
    const data = await userData();
    if (data) target.innerHTML = render(data);
    return data;
  } catch (error) { renderError(error); return null; }
}

async function dashboard() {
  await setupPage("dashboard", "My Dashboard", "Your chit schemes, payments and account information in one place.", data => {
    const installments = buildInstallments(data);
    const paid = installments.filter(row => row.paid);
    const due = installments.filter(row => !row.paid && row.amount > 0 && row.due && isPastGrace(row));
    const upcoming = installments.filter(row => !row.paid && row.amount > 0 && row.due && !isPastGrace(row)).sort((a, b) => new Date(a.due) - new Date(b.due))[0];
    const wins = data.winners.filter(winner => String(winner.status || "winner").toLowerCase() === "winner");
    const paidTotal = paid.reduce((sum, row) => sum + Number(row.payment.amount || 0), 0);
    const dueTotal = due.reduce((sum, row) => sum + row.amount, 0);
    const active = data.tickets.filter(ticket => !["completed", "closed"].includes(String(schemeOf(ticket).status || "active").toLowerCase()));
    const name = data.member?.name || data.user.fullName || data.user.username || "Member";
    return `<div class="notice dashboard-welcome"><div><b>Welcome, ${esc(name)}</b><span>Here is your latest FinTrack account summary.</span></div><a class="btn btn-small" href="user-payments.html">View Payments</a></div>
      <div class="grid stats dashboard-stats">
        <div class="card stat-card"><div class="stat-icon">📋</div><div class="label">ACTIVE CHITS</div><div class="value">${active.length}</div><div class="hint">Schemes linked to you</div></div>
        <div class="card stat-card"><div class="stat-icon">✅</div><div class="label">PAID INSTALLMENTS</div><div class="value">${paid.length}</div><div class="hint">Total paid: ${money(paidTotal)}</div></div>
        <div class="card stat-card"><div class="stat-icon">💳</div><div class="label">CURRENT DUE</div><div class="value">${money(dueTotal)}</div><div class="hint">${due.length ? `${due.length} installment${due.length === 1 ? "" : "s"} due now` : "Nothing due today"}</div></div>
        <div class="card stat-card"><div class="stat-icon">🏆</div><div class="label">WINNINGS</div><div class="value">${wins.length}</div><div class="hint">${wins.length ? wins.map(w => `${esc(w.scheme?.name || "Chit")} · Month ${esc(w.month)}`).join("<br>") : "No winning records yet"}</div></div>
      </div>
      <div class="dashboard-section-heading"><div><h2>My Chit Schemes</h2><p>Current month and payment status for every linked scheme.</p></div><a href="user-schemes.html">View all</a></div>
      <div class="grid scheme-dashboard-grid">${active.length ? active.map(ticket => {
        const scheme = schemeOf(ticket);
        const rows = installments.filter(row => sameId(row.scheme, scheme) && ticketNo(row.ticket) === ticketNo(ticket));
        const next = rows.find(row => !row.paid && row.amount > 0 && isPastGrace(row)) || rows.find(row => !row.paid && row.amount > 0) || rows.find(row => !row.paid);
        const type = String(scheme.chitType || scheme.type || "cash").toLowerCase();
        const chitValue = type.includes("gold") ? `${esc(scheme.goldGrams || 0)} grams` : money(scheme.totalAmount || ticket.chitAmount);
        return `<article class="card scheme-dashboard-card"><div class="scheme-dashboard-top"><div><div class="scheme-type">${esc(scheme.chitType || scheme.type || "Chit Scheme")}</div><h3>${esc(scheme.name || "Chit Scheme")}</h3>${managerName(scheme) ? `<p class="muted">Manager: ${esc(managerName(scheme))}</p>` : ""}<p class="muted">Ticket #${esc(ticketNo(ticket) || "—")}</p></div>${statusBadge(scheme.status || "Active")}</div>
          <div class="scheme-dashboard-values"><div><span>Chit Value</span><b>${chitValue}</b></div><div><span>Monthly Payable</span><b>${Number(next?.amount) > 0 ? money(next.amount) : String(scheme.chitType || scheme.type).toLowerCase().includes("gold") ? "Waiting for manager" : money(0)}</b></div><div><span>Current Month</span><b>${next ? `Month ${next.month}` : "Completed"}</b></div><div><span>Due Date</span><b>${next?.due ? dateText(next.due) : "—"}</b></div></div>
          <div class="scheme-dashboard-status">${next ? `<span class="status-line ${Number(next.amount) > 0 && isPastGrace(next) ? "warning" : "neutral"}">${Number(next.amount) > 0 ? (isPastGrace(next) ? "● Payment is due" : isInGrace(next) ? `Grace period through ${dateText(window.getFintrackGraceEndDate(next.scheme, next.month))}` : "○ Upcoming installment") : "Waiting for manager to enter this month's installment"}</span>` : `<span class="status-line success">✓ Scheme completed</span>`}<a href="user-payments.html">Payment history →</a>${next && Number(next.amount) > 0 && isPastGrace(next) ? `<a class="btn pay-now-btn" href="${payUrl(ticket, next.month)}">💳 Pay Now</a>` : ""}</div></article>`;
      }).join("") : `<div class="card empty-card"><div class="empty">No schemes are linked to your account.</div></div>`}</div>
      <div class="grid two dashboard-lower-grid"><div class="card next-payment-card"><div class="dashboard-card-header"><div><h2 class="section-title">Upcoming Payment</h2><p class="muted">Your next installment based on the chit schedule.</p></div>${due.length ? statusBadge("Due") : upcoming && isInGrace(upcoming) ? statusBadge("Grace period") : statusBadge("Upcoming")}</div>
        ${due.length ? `<div class="next-payment-amount">${money(due[0].amount)}</div><div class="next-payment-meta"><b>${esc(due[0].scheme.name)}</b><span>${managerName(due[0].scheme) ? `Manager: ${esc(managerName(due[0].scheme))} · ` : ""}Ticket #${esc(ticketNo(due[0].ticket))} · Month ${due[0].month}</span></div><div class="next-payment-date"><span>Due date</span><b>${dateText(due[0].due)}</b></div><a class="btn pay-now-btn" href="${payUrl(due[0].ticket, due[0].month)}">💳 Pay Now</a>` : upcoming ? `<div class="upcoming-empty"><div class="upcoming-icon">📅</div><div><b>Next due: ${dateText(upcoming.due)}</b><p>${esc(upcoming.scheme.name)} · ${managerName(upcoming.scheme) ? `Manager: ${esc(managerName(upcoming.scheme))} · ` : ""}Ticket #${esc(ticketNo(upcoming.ticket))} · Month ${upcoming.month}</p><strong>${money(upcoming.amount)}</strong></div></div><a class="btn pay-now-btn" href="${payUrl(upcoming.ticket, upcoming.month)}">💳 Pay Now</a>` : `<div class="empty">No upcoming payment is available right now.</div>`}</div>
        <div class="card account-card"><div class="dashboard-card-header"><div><h2 class="section-title">Account Overview</h2><p class="muted">Your member account at a glance.</p></div></div><div class="account-row"><span>Member Name</span><b>${esc(name)}</b></div><div class="account-row"><span>Member ID</span><b>${esc(data.member?._id || data.user.memberId || "—")}</b></div><div class="account-row"><span>Phone</span><b>${esc(data.member?.phone || data.user.phone || "—")}</b></div><div class="account-row"><span>Email</span><b>${esc(data.member?.email || data.user.email || "—")}</b></div><div class="account-row"><span>Account Status</span>${statusBadge(data.member?.status || "Active")}</div></div></div>
      <div class="card dashboard-recent-card"><div class="dashboard-card-header"><div><h2 class="section-title">Recent Payments</h2><p class="muted">Your latest completed installments.</p></div><div class="recent-total">Total paid <b>${money(paidTotal)}</b></div></div>${paid.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Scheme</th><th>Month</th><th>Amount</th><th>Payment Date</th><th>Status</th></tr></thead><tbody>${paid.slice().sort((a,b) => new Date(b.payment.paymentDate || 0) - new Date(a.payment.paymentDate || 0)).slice(0,6).map(row => `<tr><td><b>${esc(row.scheme.name || "—")}</b>${managerName(row.scheme) ? `<small>Manager: ${esc(managerName(row.scheme))}</small>` : ""}<small>Ticket #${esc(ticketNo(row.ticket))}</small></td><td>Month ${row.month}</td><td>${money(row.payment.amount)}</td><td>${dateText(row.payment.paymentDate)}</td><td>${statusBadge("Paid")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No payments have been recorded yet.</div>`}</div>`;
  });
}

async function schemesPage() {
  await setupPage("schemes", "My Schemes", "View the details, tickets and winner information for your chit schemes.", data => {
    if (!data.tickets.length) return `<div class="card"><div class="empty">No schemes are linked to your account.</div></div>`;
    return `<div class="grid scheme-dashboard-grid">${data.tickets.map(ticket => {
      const scheme = schemeOf(ticket);
      const win = data.winners.find(w => sameId(w.scheme, scheme) && String(w.ticketNumber) === ticketNo(ticket) && String(w.status || "winner").toLowerCase() === "winner");
      const type = String(scheme.chitType || scheme.type || "cash").toLowerCase();
      const monthly = amount(scheme, ticket, win?.month || 1);
      return `<article class="card scheme-dashboard-card"><div class="scheme-dashboard-top"><div><div class="scheme-type">${esc(scheme.chitType || scheme.type || "Chit Scheme")}</div><h3>${esc(scheme.name || "Chit Scheme")}</h3>${managerName(scheme) ? `<p class="muted">Manager: ${esc(managerName(scheme))}</p>` : ""}<p class="muted">Ticket #${esc(ticketNo(ticket))}</p></div>${statusBadge(scheme.status || "Active")}</div>
        <div class="scheme-dashboard-values"><div><span>Chit Value</span><b>${type.includes("gold") ? `${esc(scheme.goldGrams || 0)} grams` : money(scheme.totalAmount || ticket.chitAmount)}</b></div><div><span>Monthly Payable</span><b>${money(monthly)}</b></div><div><span>Duration</span><b>${esc(scheme.duration || "—")} Months</b></div><div><span>Start Date</span><b>${dateText(scheme.startDate)}</b></div><div><span>Monthly Due Date</span><b>${Number(scheme.dueDate || 10)}${ordinalSuffix(scheme.dueDate || 10)}</b></div><div><span>Winning Month</span><b>${win ? `Month ${esc(win.month)}` : "Not selected"}</b></div><div><span>Winner Payout</span><b>${win ? (type.includes("gold") ? `${esc(win.goldGrams || scheme.goldGrams || 0)} grams` : money(win.payout || 0)) : "—"}</b></div></div>
        ${win ? `<div class="winner-payment-note"><b>Congratulations — selected in Month ${esc(win.month)}</b><span>${type.includes("gold") ? `Gold payout: ${esc(win.goldGrams || scheme.goldGrams || 0)} grams.` : `Recorded payout: ${money(win.payout || 0)}.`} Your installment may change from the winning month.</span></div>` : ""}</article>`;
    }).join("")}</div>`;
  });
}

async function paymentsPage() {
  document.body.classList.add("payments-user-view");
  await setupPage("payments", "My Payments", "Track due installments and review your month-wise payment history.", data => {
    const installments = buildInstallments(data);
    const unpaid = installments.filter(row => !row.paid && row.amount > 0 && row.due).sort((a,b) => new Date(a.due) - new Date(b.due));
    const overdue = unpaid.filter(isPastGrace);
    const next = unpaid[0];
    const paidTotal = data.payments.filter(payment => String(payment.status).toLowerCase() === "paid").reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const upcoming = [];
    const seenTickets = new Set();
    unpaid.forEach(row => {
      const key = `${sameId(row.scheme, schemeOf(row.ticket))}:${ticketNo(row.ticket)}`;
      if (!seenTickets.has(key)) { upcoming.push(row); seenTickets.add(key); }
    });
    const pendingTotal = upcoming.filter(row => !isPastGrace(row)).reduce((sum, row) => sum + row.amount, 0);
    const paidHistory = data.payments.filter(payment => String(payment.status).toLowerCase() === "paid").map(payment => ({
      schemeName: payment.scheme?.name || "Chit Scheme", schemeId: payment.scheme?._id || payment.scheme?.id || "",
      ticket: payment.ticketNumber || "", month: Number(payment.month || 0), due: payment.dueDate,
      amount: Number(payment.amount || 0), paidOn: payment.paymentDate, status: payment.status || "Pending",
      method: payment.method || payment.paymentMethod || "—", receipt: payment.receiptUrl || payment.receipt || "",
      transactionId: payment.transactionId || payment.gatewayOrderId || ""
    }));
    const history = paidHistory.sort((a,b) => new Date(b.paidOn || b.due || 0) - new Date(a.paidOn || a.due || 0));
    const schemeOptions = [...new Map(history.map(row => [row.schemeId || row.schemeName, row.schemeName])).entries()];
    const monthOptions = [...new Set(history.map(row => row.month).filter(Boolean))].sort((a,b) => a-b);
    const currentLabel = next ? `Month ${next.month}` : "All caught up";
    return `<div class="payments-toolbar"><div><h2>My Payments</h2><p>Track your installments and payment history.</p></div><a class="btn payments-back" href="user-dashboard.html"><span aria-hidden="true">←</span> Back to Dashboard</a></div>
      <div class="payments-summary grid stats">
        <article class="card payment-summary-card paid"><span class="payment-summary-icon">▤</span><div><span class="payment-summary-label">Total Paid</span><b>${money(paidTotal)}</b></div></article>
        <article class="card payment-summary-card pending"><span class="payment-summary-icon">◷</span><div><span class="payment-summary-label">Pending</span><b>${money(pendingTotal)}</b></div></article>
        <article class="card payment-summary-card overdue"><span class="payment-summary-icon">△</span><div><span class="payment-summary-label">Overdue</span><b>${money(overdue.reduce((sum,row) => sum + row.amount, 0))}</b></div></article>
        <article class="card payment-summary-card next-due"><span class="payment-summary-icon">▦</span><div><span class="payment-summary-label">Next Due</span><b>${next ? dateText(next.due) : "—"}</b></div></article>
      </div>
      <section class="card payment-section current-payment-section"><div class="payment-section-heading"><span class="payment-section-icon">▦</span><h3>Current Payment</h3></div>
        ${next ? `<div class="current-payment-row"><span class="payment-illustration">♟</span><div class="current-payment-scheme"><b>${esc(next.scheme.name || "Chit Scheme")}</b><span>Ticket #${esc(ticketNo(next.ticket))}</span></div><div class="current-payment-month"><b>${currentLabel}</b><span>▦ &nbsp; Due: ${dateText(next.due)}</span></div><div class="current-payment-amount"><span>Amount Due</span><b>${money(next.amount)}</b></div><a class="btn current-pay-action" href="${payUrl(next.ticket,next.month)}">▣ &nbsp; Pay Now</a></div>` : `<div class="payment-empty-inline">You have no upcoming installments.</div>`}
      </section>
      <section class="card payment-section upcoming-payment-section"><div class="payment-section-heading"><span class="payment-section-icon">▦</span><h3>Upcoming Payments</h3><a href="#paymentHistory">View Full Schedule <span aria-hidden="true">→</span></a></div>
        ${upcoming.length ? `<div class="table-wrap"><table class="table payments-modern-table"><thead><tr><th>Month</th><th>Due Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>${upcoming.map(row => `<tr><td><b>${esc(row.scheme.name || "Chit Scheme")}</b><small>Month ${row.month} · Ticket #${esc(ticketNo(row.ticket))}</small></td><td>${dateText(row.due)}</td><td><b>${money(row.amount)}</b></td><td><span class="payment-status ${isPastGrace(row) ? "pending" : "upcoming"}">${isPastGrace(row) ? "Pending" : "Upcoming"}</span></td></tr>`).join("")}</tbody></table></div><div class="schedule-note"><span>ℹ</span> Upcoming payments show only up to your current month. If any previous month is not paid, it will be shown as Pending.</div>` : `<div class="payment-empty-inline">No upcoming payments scheduled.</div>`}
      </section>
      <section class="card payment-section payment-history-section" id="paymentHistory"><div class="payment-section-heading history-heading"><div><span class="payment-section-icon">▦</span><h3>Payment History</h3></div><div class="payment-filters"><select aria-label="Filter by scheme" id="paymentSchemeFilter"><option value="">All Schemes</option>${schemeOptions.map(([id,name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join("")}</select><select aria-label="Filter by month" id="paymentMonthFilter"><option value="">All Months</option>${monthOptions.map(month => `<option value="${month}">Month ${month}</option>`).join("")}</select><select aria-label="Filter by status" id="paymentStatusFilter"><option value="">All Status</option><option value="paid">Paid</option></select></div></div>
        ${history.length ? `<div class="table-wrap"><table class="table payments-modern-table history-table"><thead><tr><th>Scheme</th><th>Month</th><th>Due Date</th><th>Amount</th><th>Paid On</th><th>Method</th><th>Status</th><th>Receipt</th></tr></thead><tbody>${history.map((row,index) => `<tr data-scheme="${esc(row.schemeId || row.schemeName)}" data-month="${row.month}" data-status="paid"><td><span class="payment-illustration small">♟</span><b>${esc(row.schemeName)}</b></td><td>Month ${row.month}</td><td>${dateText(row.due)}</td><td><b>${money(row.amount)}</b></td><td>${dateText(row.paidOn)}</td><td>${esc(row.method)}</td><td><span class="payment-status paid">Paid</span></td><td>${row.receipt ? `<a class="receipt-link" href="${esc(row.receipt)}" target="_blank" rel="noopener">◉ &nbsp; View</a>` : `<button class="receipt-link receipt-preview-button" type="button" data-receipt-index="${index}">◉ &nbsp; View</button>`}</td></tr>`).join("")}</tbody></table></div><div class="payment-filter-empty" hidden>No payments match these filters.</div>` : `<div class="empty">No completed payments yet.</div>`}
      </section>
      ${history.length ? `<div class="user-modal-overlay" id="paymentReceiptModal" role="dialog" aria-modal="true" aria-labelledby="paymentReceiptTitle"><section class="user-modal"><div class="user-modal-header"><h2 id="paymentReceiptTitle">Payment Receipt</h2><button class="user-modal-close" type="button" aria-label="Close receipt">×</button></div><div class="payment-receipt-content"></div></section></div>` : ""}`;
  });
  const schemeFilter = document.getElementById("paymentSchemeFilter");
  const monthFilter = document.getElementById("paymentMonthFilter");
  const statusFilter = document.getElementById("paymentStatusFilter");
  const filterRows = () => {
    const rows = [...document.querySelectorAll(".history-table tbody tr")];
    let visible = 0;
    rows.forEach(row => {
      const show = (!schemeFilter.value || row.dataset.scheme === schemeFilter.value) && (!monthFilter.value || row.dataset.month === monthFilter.value) && (!statusFilter.value || row.dataset.status === statusFilter.value);
      row.hidden = !show;
      if (show) visible++;
    });
    const empty = document.querySelector(".payment-filter-empty");
    if (empty) empty.hidden = visible > 0;
  };
  [schemeFilter, monthFilter, statusFilter].forEach(filter => filter?.addEventListener("change", filterRows));
  const receiptModal = document.getElementById("paymentReceiptModal");
  document.querySelectorAll(".receipt-preview-button").forEach(button => button.addEventListener("click", () => {
    const row = history[Number(button.dataset.receiptIndex)];
    if (!row || !receiptModal) return;
    receiptModal.querySelector(".payment-receipt-content").innerHTML = `<div class="payment-receipt-details"><div><span>Scheme</span><b>${esc(row.schemeName)}</b></div><div><span>Installment</span><b>Month ${row.month} · Ticket #${esc(row.ticket)}</b></div><div><span>Amount Paid</span><b>${money(row.amount)}</b></div><div><span>Payment Date</span><b>${dateText(row.paidOn)}</b></div><div><span>Payment Method</span><b>${esc(row.method || "—")}</b></div><div><span>Transaction ID</span><b>${esc(row.transactionId || "Not provided")}</b></div></div>`;
    receiptModal.classList.add("show");
  }));
  receiptModal?.querySelector(".user-modal-close")?.addEventListener("click", () => receiptModal.classList.remove("show"));
  receiptModal?.addEventListener("click", event => { if (event.target === receiptModal) receiptModal.classList.remove("show"); });
}

async function notificationsPage() {
  await setupPage("notifications", "Notifications", "Updates about your payments and chit schemes.", data => data.notifications.length ? `<div class="grid notice-list">${data.notifications.map(notification => { const dueAlert = notification.type === "payment_due"; return `<article class="card notice-item ${dueAlert ? "warning" : ""}"><span class="notice-symbol">${dueAlert ? "⚠" : String(notification.type).includes("winner") ? "🏆" : "✓"}</span><div><b>${dueAlert ? "Payment due" : esc(notification.type || "Notification")}</b><p>${esc(notification.message || "")}</p><small class="muted">${dateText(notification.createdAt || notification.date)}</small></div></article>`; }).join("")}</div>` : `<div class="card"><div class="empty">No notifications right now.</div></div>`);
}

async function initPayNowPage() {
  const user = requireUser();
  if (!user) return;
  const query = new URLSearchParams(location.search);
  try {
    const data = await userData();
    const ticket = data.tickets.find(row => sameId(schemeOf(row), query.get("schemeId")) && ticketNo(row) === query.get("ticket"));
    const month = Number(query.get("month"));
    if (!ticket || !Number.isInteger(month) || month < 1 || month > Number(schemeOf(ticket).duration)) return location.replace("user-payments.html");
    const scheme = schemeOf(ticket);
    const installmentAmount = amount(scheme, ticket, month);
    const due = dueDate(scheme, month);
    if (paidFor(data, ticket, month)) return location.replace("user-payments.html");
    if (!(installmentAmount > 0)) return location.replace("user-payments.html");
    document.body.innerHTML = `<main class="pay-page"><div class="pay-wrap"><a href="user-payments.html">← Back to payments</a><section class="card pay-card gateway-pay-card"><p class="gateway-eyebrow">SECURE PAYMENT</p><h1>Pay ${money(installmentAmount)}</h1><p>${esc(scheme.name)} · Ticket #${esc(ticketNo(ticket))} · Month ${month}</p><p>Due date: ${dateText(due)}</p><div class="gateway-methods" aria-label="Available payment methods"><span>UPI</span><span>Net banking</span><span>Credit card</span><span>Debit card</span></div><p class="gateway-secure-note">Your bank and card details are entered securely through the payment gateway.</p><button class="btn gateway-pay-button" id="gatewayPayButton" type="button" disabled>Loading secure checkout…</button><p id="gatewayPaymentMessage" class="gateway-payment-message" role="status"></p></section></div></main>`;
  } catch (error) { alert(error.message); location.replace("user-payments.html"); }
}

window.readNotification = async id => {
  try { await fintrackApi(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", body: "{}" }); await notificationsPage(); }
  catch (error) { alert(error.message); }
};

document.addEventListener("DOMContentLoaded", () => {
  const page = location.pathname.split("/").pop();
  if (page === "user-dashboard.html" || page === "index.html") dashboard();
  else if (page === "user-schemes.html") schemesPage();
  else if (page === "user-payments.html") paymentsPage();
  else if (page === "user-notifications.html") notificationsPage();
});
