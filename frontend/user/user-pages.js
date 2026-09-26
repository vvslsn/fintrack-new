"use strict";

function ticketNo(ticket) { return String(ticket?.ticketNumber ?? ticket?.ticket ?? "").trim(); }
function schemeOf(ticket) { return ticket?.scheme || {}; }
function dueDate(scheme, month) {
  if (typeof window.getFintrackDueDate === "function") return window.getFintrackDueDate(scheme, month);
  if (!scheme?.startDate) return null;
  const start = new Date(scheme.startDate);
  if (Number.isNaN(start.getTime())) return null;
  const day = start.getUTCDate();
  const base = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + Number(month) - 1, 1));
  if (day === 25) return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 5));
  const map = { 1: 10, 5: 15, 10: 20, 15: 25 };
  base.setUTCDate(map[day] || Math.min(day + 10, new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate()));
  return base;
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
    const due = installments.filter(row => !row.paid && row.amount > 0 && row.due && new Date(row.due) <= new Date());
    const upcoming = installments.filter(row => !row.paid && row.amount > 0 && row.due && new Date(row.due) > new Date()).sort((a, b) => new Date(a.due) - new Date(b.due))[0];
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
        const next = rows.find(row => !row.paid && row.amount > 0 && row.due && new Date(row.due) <= new Date()) || rows.find(row => !row.paid && row.amount > 0) || rows.find(row => !row.paid);
        const type = String(scheme.chitType || scheme.type || "cash").toLowerCase();
        const chitValue = type.includes("gold") ? `${esc(scheme.goldGrams || 0)} grams` : money(scheme.totalAmount || ticket.chitAmount);
        return `<article class="card scheme-dashboard-card"><div class="scheme-dashboard-top"><div><div class="scheme-type">${esc(scheme.chitType || scheme.type || "Chit Scheme")}</div><h3>${esc(scheme.name || "Chit Scheme")}</h3><p class="muted">Ticket #${esc(ticketNo(ticket) || "—")}</p></div>${statusBadge(scheme.status || "Active")}</div>
          <div class="scheme-dashboard-values"><div><span>Chit Value</span><b>${chitValue}</b></div><div><span>Monthly Payable</span><b>${Number(next?.amount) > 0 ? money(next.amount) : String(scheme.chitType || scheme.type).toLowerCase().includes("gold") ? "Waiting for manager" : money(0)}</b></div><div><span>Current Month</span><b>${next ? `Month ${next.month}` : "Completed"}</b></div><div><span>Due Date</span><b>${next?.due ? dateText(next.due) : "—"}</b></div></div>
          <div class="scheme-dashboard-status">${next ? `<span class="status-line ${Number(next.amount) > 0 && new Date(next.due) <= new Date() ? "warning" : "neutral"}">${Number(next.amount) > 0 ? (new Date(next.due) <= new Date() ? "● Payment is due" : "○ Upcoming installment") : "Waiting for manager to enter this month's installment"}</span>` : `<span class="status-line success">✓ Scheme completed</span>`}<a href="user-payments.html">Payment history →</a>${next && Number(next.amount) > 0 && new Date(next.due) <= new Date() ? `<a class="btn pay-now-btn" href="${payUrl(ticket, next.month)}">💳 Pay Now</a>` : ""}</div></article>`;
      }).join("") : `<div class="card empty-card"><div class="empty">No schemes are linked to your account.</div></div>`}</div>
      <div class="grid two dashboard-lower-grid"><div class="card next-payment-card"><div class="dashboard-card-header"><div><h2 class="section-title">Upcoming Payment</h2><p class="muted">Your next installment based on the chit schedule.</p></div>${due.length ? statusBadge("Due") : statusBadge("Upcoming")}</div>
        ${due.length ? `<div class="next-payment-amount">${money(due[0].amount)}</div><div class="next-payment-meta"><b>${esc(due[0].scheme.name)}</b><span>Ticket #${esc(ticketNo(due[0].ticket))} · Month ${due[0].month}</span></div><div class="next-payment-date"><span>Due date</span><b>${dateText(due[0].due)}</b></div><a class="btn" href="${payUrl(due[0].ticket, due[0].month)}">💳 Pay Now</a>` : upcoming ? `<div class="upcoming-empty"><div class="upcoming-icon">📅</div><div><b>Next due: ${dateText(upcoming.due)}</b><p>${esc(upcoming.scheme.name)} · Month ${upcoming.month}</p><strong>${money(upcoming.amount)}</strong></div></div>` : `<div class="empty">No upcoming payment is available right now.</div>`}</div>
        <div class="card account-card"><div class="dashboard-card-header"><div><h2 class="section-title">Account Overview</h2><p class="muted">Your member account at a glance.</p></div></div><div class="account-row"><span>Member Name</span><b>${esc(name)}</b></div><div class="account-row"><span>Member ID</span><b>${esc(data.member?._id || data.user.memberId || "—")}</b></div><div class="account-row"><span>Phone</span><b>${esc(data.member?.phone || data.user.phone || "—")}</b></div><div class="account-row"><span>Email</span><b>${esc(data.member?.email || data.user.email || "—")}</b></div><div class="account-row"><span>Account Status</span>${statusBadge(data.member?.status || "Active")}</div></div></div>
      <div class="card dashboard-recent-card"><div class="dashboard-card-header"><div><h2 class="section-title">Recent Payments</h2><p class="muted">Your latest completed installments.</p></div><div class="recent-total">Total paid <b>${money(paidTotal)}</b></div></div>${paid.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Scheme</th><th>Month</th><th>Amount</th><th>Payment Date</th><th>Status</th></tr></thead><tbody>${paid.slice().sort((a,b) => new Date(b.payment.paymentDate || 0) - new Date(a.payment.paymentDate || 0)).slice(0,6).map(row => `<tr><td><b>${esc(row.scheme.name || "—")}</b><small>Ticket #${esc(ticketNo(row.ticket))}</small></td><td>Month ${row.month}</td><td>${money(row.payment.amount)}</td><td>${dateText(row.payment.paymentDate)}</td><td>${statusBadge("Paid")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No payments have been recorded yet.</div>`}</div>`;
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
      return `<article class="card scheme-dashboard-card"><div class="scheme-dashboard-top"><div><div class="scheme-type">${esc(scheme.chitType || scheme.type || "Chit Scheme")}</div><h3>${esc(scheme.name || "Chit Scheme")}</h3><p class="muted">Ticket #${esc(ticketNo(ticket))}</p></div>${statusBadge(scheme.status || "Active")}</div>
        <div class="scheme-dashboard-values"><div><span>Chit Value</span><b>${type.includes("gold") ? `${esc(scheme.goldGrams || 0)} grams` : money(scheme.totalAmount || ticket.chitAmount)}</b></div><div><span>Monthly Payable</span><b>${money(monthly)}</b></div><div><span>Duration</span><b>${esc(scheme.duration || "—")} Months</b></div><div><span>Start Date</span><b>${dateText(scheme.startDate)}</b></div><div><span>Winning Month</span><b>${win ? `Month ${esc(win.month)}` : "Not selected"}</b></div><div><span>Winner Payout</span><b>${win ? (type.includes("gold") ? `${esc(win.goldGrams || scheme.goldGrams || 0)} grams` : money(win.payout || 0)) : "—"}</b></div></div>
        ${win ? `<div class="winner-payment-note"><b>Congratulations — selected in Month ${esc(win.month)}</b><span>${type.includes("gold") ? `Gold payout: ${esc(win.goldGrams || scheme.goldGrams || 0)} grams.` : `Recorded payout: ${money(win.payout || 0)}.`} Your installment may change from the winning month.</span></div>` : ""}</article>`;
    }).join("")}</div>`;
  });
}

async function paymentsPage() {
  await setupPage("payments", "My Payments", "Track due installments and review your month-wise payment history.", data => {
    const installments = buildInstallments(data);
    const due = installments.filter(row => !row.paid && row.amount > 0 && row.due && new Date(row.due) <= new Date());
    const totalDue = due.reduce((sum, row) => sum + row.amount, 0);
    const history = data.payments.slice().sort((a,b) => Number(b.month || 0) - Number(a.month || 0) || new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0));
    return `<div class="payments-page-intro"><div><div class="scheme-type">MY PAYMENTS</div><h2>Payment Center</h2><p class="muted">View your installments and pay the amount currently due.</p></div><a class="btn btn-small" href="user-dashboard.html">Back to Dashboard</a></div>
      ${due.length ? `<div class="card payments-due-panel"><div class="payments-due-header"><div><div class="scheme-type">PAYMENT DUE</div><h2>Pay your installment</h2><p class="muted">Unpaid installments whose due dates have arrived.</p></div><div class="payments-due-total"><span>Total Due</span><b>${money(totalDue)}</b></div></div><div class="payments-due-list">${due.map(row => `<div class="payments-due-row"><div class="due-main"><div class="due-title">${esc(row.scheme.name || "Chit Scheme")}</div><div class="due-sub">Ticket #${esc(ticketNo(row.ticket))} · Month ${row.month} · Due ${dateText(row.due)}</div></div><div class="due-amount">${money(row.amount)}</div><div class="due-action"><a class="btn pay-now-btn" href="${payUrl(row.ticket, row.month)}">Pay Now</a></div></div>`).join("")}</div></div>` : `<div class="card payments-clear-panel"><div class="payments-clear-icon">✓</div><div><h2>No payment due right now</h2><p class="muted">Your payment schedule is up to date. Future installments will appear here when due.</p></div></div>`}
      <div class="card payments-history-card"><div class="payments-history-header"><div><div class="section-title">Month-wise Payment History</div><p class="muted">Your completed and pending payment records.</p></div></div>${history.length ? `<div class="table-wrap"><table class="table payments-table"><thead><tr><th>Scheme</th><th>Ticket</th><th>Month</th><th>Due Date</th><th>Amount</th><th>Payment Date</th><th>Status</th></tr></thead><tbody>${history.map(payment => `<tr><td><b>${esc(payment.scheme?.name || "—")}</b></td><td>#${esc(payment.ticketNumber || "—")}</td><td>Month ${esc(payment.month)}</td><td>${dateText(payment.dueDate)}</td><td>${money(payment.amount)}</td><td>${dateText(payment.paymentDate)}</td><td>${statusBadge(payment.status)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No payment records yet.</div>`}</div>`;
  });
}

async function notificationsPage() {
  await setupPage("notifications", "Notifications", "Updates about your payments and chit schemes.", data => data.notifications.length ? `<div class="grid notice-list">${data.notifications.map(notification => `<article class="card notice-item"><span class="notice-symbol">${String(notification.type).includes("winner") ? "🏆" : "✓"}</span><div><b>${esc(notification.type || "Notification")}</b><p>${esc(notification.message || "")}</p><small class="muted">${dateText(notification.createdAt || notification.date)}</small></div></article>`).join("")}</div>` : `<div class="card"><div class="empty">No notifications right now.</div></div>`);
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
