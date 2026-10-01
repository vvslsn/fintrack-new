document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [r, p, w, s, payoutResponse] = await Promise.all([
      fintrackApi("/reports/summary"), fintrackApi("/payments"), fintrackApi("/winners"),
      fintrackApi("/schemes"), fintrackApi("/payouts")
    ]);
    const u = JSON.parse(sessionStorage.getItem("currentUser") || "{}");
    const sum = r.summary;
    document.getElementById("welcomeName")?.replaceChildren(document.createTextNode(u.fullName || "Manager"));
    document.getElementById("headerUserName")?.replaceChildren(document.createTextNode(u.fullName || "Manager"));
    document.getElementById("totalInvested") && (totalInvested.textContent = money(sum.totalPaid));
    document.getElementById("activeChits") && (activeChits.textContent = sum.schemes);
    document.getElementById("pendingPayments") && (pendingPayments.textContent = sum.pendingPayments);
    document.getElementById("onlinePaymentPendingCount") && (onlinePaymentPendingCount.textContent = sum.onlinePending);
    const list = document.getElementById("paymentTableBody");
    if (list) list.innerHTML = (p.payments || []).slice(0, 8).map(x => `<tr><td>${escHtml(x.member?.name || "—")}</td><td>${escHtml(x.scheme?.name || "—")}</td><td>Month ${x.month}</td><td>${money(x.amount)}</td><td>${escHtml(x.status)}</td></tr>`).join("") || "<tr><td colspan=5>No payments yet.</td></tr>";
    const wl = document.getElementById("winnerList");
    if (wl) wl.innerHTML = (w.winners || []).slice(0, 6).map(x => `<div>${escHtml(x.member?.name || "—")} — ${escHtml(x.scheme?.name || "—")} — Month ${x.month}</div>`).join("") || "No winners yet.";
    renderPayouts(payoutResponse.payouts || []);
    document.getElementById("currentDate") && (currentDate.textContent = new Date().toLocaleDateString("en-IN", { dateStyle: "full" }));
  } catch (e) { console.error(e); }
});

function renderPayouts(payouts) {
  const body = document.getElementById("payoutTableBody");
  if (!body) return;
  body.innerHTML = payouts.map(p => {
    const m = p.member || {}, bank = m.bankDetails || {};
    const amount = p.type === "gold" ? `${escHtml(p.goldGrams || 0)} g gold` : money(p.amount || 0);
    const bankInfo = bank.accountNumber
      ? `<b>${escHtml(bank.accountHolderName)}</b><br>${escHtml(bank.bankName)}${bank.branch ? `, ${escHtml(bank.branch)}` : ""}<br>A/C ${escHtml(bank.accountNumber)}<br>IFSC ${escHtml(bank.ifscCode)}`
      : "<span class=\"muted\">Bank details not added</span>";
    const status = p.status === "paid" ? `<span class="badge success">Paid</span><small>${p.paidDate ? new Date(p.paidDate).toLocaleDateString("en-IN") : ""}</small>` : `<span class="badge warning">Pending</span>`;
    const action = p.status === "paid" ? "—" : `<button class="btn payout-mark-paid" type="button" data-payout-id="${escHtml(p._id)}">Mark paid</button>`;
    return `<tr><td>${escHtml(m.name || "—")}</td><td>${escHtml(p.scheme?.name || "—")}<small>Month ${escHtml(p.month)} · Ticket #${escHtml(p.ticketNumber)}</small></td><td>${amount}</td><td>${bankInfo}</td><td>${status}</td><td>${action}</td></tr>`;
  }).join("") || "<tr><td colspan=\"6\">No winner payouts have been recorded.</td></tr>";
}

document.getElementById("payoutTableBody")?.addEventListener("click", async event => {
  const button = event.target.closest(".payout-mark-paid");
  if (!button) return;
  const method = prompt("Payout method (for example, NEFT or IMPS):", "NEFT");
  if (method === null) return;
  const transactionId = prompt("Transaction/reference ID (optional):", "");
  if (transactionId === null) return;
  button.disabled = true;
  try {
    await fintrackApi(`/payouts/${encodeURIComponent(button.dataset.payoutId)}/pay`, { method: "PATCH", body: JSON.stringify({ method, transactionId }) });
    const response = await fintrackApi("/payouts");
    renderPayouts(response.payouts || []);
  } catch (error) { alert(error.message); button.disabled = false; }
});

function toggleSidebar() { document.getElementById("sidebar")?.classList.toggle("active"); }
function closeSidebar() { document.getElementById("sidebar")?.classList.remove("active"); }
function openProfileModal() { openUserEditProfile(); }
function closeModal() { document.querySelectorAll(".modal.active").forEach(x => x.classList.remove("active")); }
async function changePassword() { openChangePassword(); }
async function saveProfile() { openUserEditProfile(); }
