"use strict";

let detailSchemeId = "";
let detailScheme = null;
let detailTickets = [];
let detailMembers = [];
let detailWinners = [];

const detailById = id => document.getElementById(id);
const detailEsc = value => escHtml(value);

async function loadSchemeDetails() {
    detailSchemeId = new URLSearchParams(location.search).get("id") || "";
    if (!detailSchemeId) return;
    try {
        const [schemeResult, ticketResult, winnerResult, paymentResult] = await Promise.all([
            fintrackApi(`/schemes/${encodeURIComponent(detailSchemeId)}`),
            fintrackApi(`/schemes/${encodeURIComponent(detailSchemeId)}/tickets`),
            fintrackApi("/winners"),
            fintrackApi("/payments")
        ]);
        detailScheme = schemeResult.scheme;
        detailTickets = ticketResult.tickets || [];
        const winners = (winnerResult.winners || []).filter(winner => String(winner.scheme?._id || winner.scheme) === String(detailSchemeId));
        detailWinners = winners;
        const payments = (paymentResult.payments || []).filter(payment => String(payment.scheme?._id || payment.scheme) === String(detailSchemeId));
        renderSchemeDetails(detailScheme, winners, payments);
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

function renderSchemeDetails(scheme, winners, payments) {
    const capacity = Number(scheme.capacity) || 0;
    const membersCount = detailTickets.length;
    const type = scheme.chitType || scheme.type || "cash";
    const value = type === "gold" ? `${Number(scheme.goldGrams) || 0} grams` : money(scheme.totalAmount);
    detailById("schemeName").textContent = scheme.name;
    detailById("breadcrumbName").textContent = scheme.name;
    detailById("schemeStatus").textContent = scheme.status;
    detailById("schemeStatus").className = `status-badge status-${scheme.status}`;
    detailById("schemeSubtitle").textContent = `${type} chit · ${value}`;
    detailById("totalAmount").textContent = value;
    detailById("baseInstallment").textContent = type === "gold" ? "Varies by month" : money(scheme.baseAmount);
    detailById("duration").textContent = `${scheme.duration} Months`;
    detailById("memberCount").textContent = `${membersCount} / ${capacity}`;
    detailById("infoName").textContent = scheme.name;
    detailById("infoType").textContent = type;
    detailById("infoAmount").textContent = value;
    detailById("infoInstallment").textContent = type === "gold" ? "Varies by month" : money(scheme.baseAmount);
    detailById("infoDuration").textContent = `${scheme.duration} Months`;
    detailById("infoStartDate").textContent = dateText(scheme.startDate);
    const start = new Date(`${String(scheme.startDate || "").slice(0, 10)}T00:00:00`);
    const end = new Date(start);
    if (!Number.isNaN(start.getTime())) end.setMonth(end.getMonth() + Number(scheme.duration || 0));
    detailById("infoEndDate").textContent = Number.isNaN(start.getTime()) ? "—" : dateText(end);
    detailById("infoStatus").textContent = scheme.status;
    detailById("availableSlots").textContent = Math.max(0, capacity - membersCount);
    detailById("capacityNumber").textContent = `${membersCount} / ${capacity}`;
    detailById("capacityProgress").style.width = `${capacity ? Math.min(100, membersCount / capacity * 100) : 0}%`;
    detailById("goldInstallmentsCard").style.display = type === "gold" ? "block" : "none";
    if (type === "gold") {
        renderGoldInstallmentInputs(scheme);
    }

    detailById("membersTable").innerHTML = detailTickets.map(ticket =>
        `<tr><td>#${detailEsc(ticket.ticketNumber)}</td><td>${detailEsc(ticket.member?.name || "—")}</td><td>${detailEsc(ticket.member?.email || "—")}</td><td>${detailEsc(ticket.member?.phone || "—")}</td><td>${dateText(ticket.member?.joinedDate)}</td><td>${detailEsc(ticket.member?.status || "active")}</td></tr>`
    ).join("") || `<tr><td colspan="6">No members have joined this scheme yet.</td></tr>`;

    detailById("winnersTable").innerHTML = winners.map(winner =>
        `<tr><td>${winner.month}</td><td>#${detailEsc(winner.ticketNumber || "—")}</td><td>${detailEsc(winner.member?.name || "—")}</td><td>${type === "gold" ? `${Number(winner.goldGrams) || 0} grams` : money(winner.payout)}</td><td>${money(winner.winnerPayment)}</td><td>${detailEsc(winner.status)}</td></tr>`
    ).join("") || `<tr><td colspan="6">No winners recorded.</td></tr>`;

    detailById("paymentsTable").innerHTML = payments.map(payment =>
        `<tr><td>${detailEsc(payment.member?.name || "—")}</td><td>#${detailEsc(payment.ticketNumber)}</td><td>${payment.month}</td><td>${dateText(payment.dueDate)}</td><td>${money(payment.amount)}</td><td>${dateText(payment.paymentDate)}</td><td>${detailEsc(payment.status)}</td></tr>`
    ).join("") || `<tr><td colspan="7">No payments recorded.</td></tr>`;
}

function monthAnniversary(startValue, month) {
    const parts = String(startValue || "").slice(0, 10).split("-").map(Number);
    if (parts.length !== 3 || parts.some(value => !value)) return null;
    const [year, startMonth, startDay] = parts;
    const index = startMonth - 1 + Number(month) - 1;
    const targetYear = year + Math.floor(index / 12);
    const targetMonth = index % 12;
    return new Date(targetYear, targetMonth, Math.min(startDay, new Date(targetYear, targetMonth + 1, 0).getDate()));
}

function currentGoldMonth(scheme) {
    const start = monthAnniversary(scheme.startDate, 1);
    if (!start) return 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (today < start) return 0;
    let month = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth() + 1;
    if (today.getDate() < start.getDate()) month -= 1;
    return Math.max(0, Math.min(Number(scheme.duration || 0), month));
}

function renderGoldInstallmentInputs(scheme) {
    const installments = scheme.goldMonthlyInstallments || {};
    const dueThrough = currentGoldMonth(scheme);
    let firstMissing = 0;
    for (let month = 1; month <= Number(scheme.duration || 0); month += 1) {
        if (!(Number(installments[String(month)] ?? installments[month]) > 0)) { firstMissing = month; break; }
    }
    detailById("goldInstallmentsGrid").innerHTML = Array.from({ length: Number(scheme.duration || 0) }, (_, index) => {
        const month = index + 1;
        const amount = installments[String(month)] ?? installments[month] ?? "";
        const editable = month === firstMissing && month <= dueThrough;
        const available = monthAnniversary(scheme.startDate, month);
        const hint = Number(amount) > 0 ? "Saved" : editable ? "Enter this month's payable amount" : available ? `Available ${dateText(available)}` : "Not available yet";
        return `<label class="gold-installment-field" for="goldInstallmentMonth${month}"><span>Month ${month} Installment <small>${detailEsc(hint)}</small></span><div><b>₹</b><input id="goldInstallmentMonth${month}" data-gold-installment-month="${month}" type="number" min="0.01" step="0.01" value="${detailEsc(amount)}" placeholder="${editable ? "Enter amount" : "—"}" ${editable ? "" : "disabled"}></div></label>`;
    }).join("");
    const button = detailById("saveGoldInstallmentsButton");
    if (button) button.disabled = !(firstMissing && firstMissing <= dueThrough);
    detailById("goldInstallmentsMessage").textContent = firstMissing && firstMissing <= dueThrough ? `Month ${firstMissing} payable amount` : "The next monthly amount becomes available on its chit anniversary.";
}

function goBack() { location.href = "schemes.html"; }
function editScheme() { location.href = `schemes.html?editSchemeId=${encodeURIComponent(detailSchemeId)}`; }
function switchTab(name) {
    document.querySelectorAll(".tab-content").forEach(panel => panel.classList.remove("active"));
    document.getElementById(`${name}Tab`)?.classList.add("active");
    document.querySelectorAll(".tab-button").forEach(button => button.classList.toggle("active", button.dataset.tab === name));
}
function closeSidebar() { document.getElementById("sidebar")?.classList.remove("active"); }
function toggleSidebar() { document.getElementById("sidebar")?.classList.toggle("active"); }

function nextDetailTicketNumber() {
    const used = new Set(detailTickets.map(ticket => String(ticket.ticketNumber).trim()));
    let number = 1;
    while (used.has(String(number))) number += 1;
    return String(number);
}

function renderDetailMemberSuggestions(query = "") {
    const container = detailById("detailMemberSuggestions");
    const normalized = query.trim().toLowerCase();
    const matches = detailMembers.filter(member =>
        !normalized || `${member.name} ${member.phone} ${member.email}`.toLowerCase().includes(normalized)
    ).slice(0, 8);
    const full = detailTickets.length >= Number(detailScheme?.capacity || 0);
    container.innerHTML = matches.map(member =>
        `<button type="button" data-member-id="${detailEsc(member.id || member._id)}"><strong>${detailEsc(member.name)}</strong><small>${detailEsc(member.phone)}${member.email ? ` · ${detailEsc(member.email)}` : ""}</small></button>`
    ).join("") || `<p>${detailMembers.length ? "No matching members." : "No active members found."}</p>${full ? "" : `<button type="button" class="detail-create-option" data-action="create-member">+ Create a new member${normalized ? ` named “${detailEsc(query.trim())}”` : ""}</button>`}`;
    container.classList.add("visible");
}

async function addMember() {
    if (!detailScheme) return;
    detailById("detailAddMemberTitle").textContent = `Manage ${detailScheme.name} members`;
    detailById("detailMemberMessage").textContent = "";
    detailById("detailMemberSearch").value = "";
    detailById("detailSelectedMemberId").value = "";
    detailById("detailTicketNumber").value = "";
    detailById("detailQuickCreatePanel").hidden = true;
    detailById("detailAddMemberModal").classList.add("active");
    const addButton = detailById("detailAddMemberButton");
    addButton.disabled = true;
    addButton.textContent = "Loading…";
    try {
        const [ticketResult, memberResult] = await Promise.all([
            fintrackApi(`/schemes/${encodeURIComponent(detailSchemeId)}/tickets`),
            fintrackApi("/members")
        ]);
        detailTickets = ticketResult.tickets || [];
        detailMembers = (memberResult.members || []).filter(member => member.status !== "inactive");
        detailById("detailTicketNumber").value = nextDetailTicketNumber();
        const full = detailTickets.length >= Number(detailScheme.capacity || 0);
        addButton.disabled = full;
        addButton.textContent = full ? "Scheme is full" : "Add member";
        detailById("detailMemberCapacity").textContent = `${detailTickets.length} / ${detailScheme.capacity} members · ${Math.max(0, detailScheme.capacity - detailTickets.length)} slots available`;
        renderDetailMemberSuggestions();
    } catch (error) {
        addButton.disabled = true;
        addButton.textContent = "Add member";
        detailById("detailMemberMessage").textContent = error.message;
    }
}

function closeDetailMemberModal() {
    detailById("detailAddMemberModal")?.classList.remove("active");
    detailById("detailMemberSuggestions")?.classList.remove("visible");
}

function openDetailQuickCreate() {
    if (detailTickets.length >= Number(detailScheme?.capacity || 0)) {
        detailById("detailMemberMessage").textContent = "This scheme has reached its member capacity.";
        return;
    }
    detailById("detailMemberSuggestions").classList.remove("visible");
    detailById("detailQuickCreatePanel").hidden = false;
    detailById("detailNewMemberName").value = detailById("detailMemberSearch").value.trim();
    const today = new Date();
    detailById("detailNewMemberJoinedDate").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    detailById("detailNewMemberName").focus();
}

function closeDetailQuickCreate() { detailById("detailQuickCreatePanel").hidden = true; }

async function refreshMemberViews() {
    const result = await fintrackApi(`/schemes/${encodeURIComponent(detailSchemeId)}/tickets`);
    detailTickets = result.tickets || [];
    renderSchemeDetails(detailScheme, [], []);
}

async function saveExistingMemberToScheme(event) {
    event.preventDefault();
    const memberId = detailById("detailSelectedMemberId").value;
    const ticketNumber = detailById("detailTicketNumber").value.trim();
    if (!memberId) {
        detailById("detailMemberMessage").textContent = "Choose a member from the name suggestions first.";
        return;
    }
    try {
        await fintrackApi(`/members/${encodeURIComponent(memberId)}/tickets`, {
            method: "POST",
            body: JSON.stringify({ schemeId: detailSchemeId, ticketNumber })
        });
        closeDetailMemberModal();
        await loadSchemeDetails();
    } catch (error) {
        detailById("detailMemberMessage").textContent = error.message;
    }
}

async function createMemberInScheme(event) {
    event.preventDefault();
    const payload = {
        name: detailById("detailNewMemberName").value.trim(),
        email: detailById("detailNewMemberEmail").value.trim(),
        phone: detailById("detailNewMemberPhone").value.trim(),
        joinedDate: detailById("detailNewMemberJoinedDate").value,
        createLogin: false
    };
    if (!/^\d{10}$/.test(payload.phone)) {
        detailById("detailMemberMessage").textContent = "Enter a valid 10-digit phone number.";
        return;
    }
    if (detailTickets.length >= Number(detailScheme?.capacity || 0)) {
        detailById("detailMemberMessage").textContent = "This scheme has reached its member capacity.";
        return;
    }
    const button = detailById("detailCreateAndAddButton");
    button.disabled = true;
    button.textContent = "Creating member…";
    let createdMember = null;
    try {
        const created = await fintrackApi("/members", { method: "POST", body: JSON.stringify(payload) });
        createdMember = created.member;
        await fintrackApi(`/members/${encodeURIComponent(createdMember.id)}/tickets`, {
            method: "POST",
            body: JSON.stringify({ schemeId: detailSchemeId, ticketNumber: detailById("detailTicketNumber").value.trim() })
        });
        closeDetailMemberModal();
        await loadSchemeDetails();
    } catch (error) {
        detailById("detailMemberMessage").textContent = createdMember
            ? `Member created, but could not be added to the scheme: ${error.message}. The member remains in Members.`
            : error.message;
    } finally {
        button.disabled = false;
        button.textContent = "Create and add to scheme";
    }
}

async function deleteMemberFromScheme() {
    alert("Tickets with payment history are protected. Remove is not available from this screen.");
}

function winnerModal(id) { return detailById(id); }
function openWinnerModal(id) {
    const modal = winnerModal(id);
    if (!modal) return;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
}
function closeWinnerModal(id) {
    const modal = winnerModal(id);
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
}
function monthOptionMarkup(selected = null) {
    const allowed = selected === null ? null : new Set(selected.map(Number));
    const duration = Number(detailScheme?.duration || 0);
    return `<option value="">Select month…</option>${Array.from({length: duration}, (_, index) => index + 1).filter(month => !allowed || allowed.has(month)).map(month => `<option value="${month}">Month ${month}</option>`).join("")}`;
}
function eligibleTicketOptionMarkup() {
    const alreadyWon = new Set(detailWinners.filter(row => row.status === "winner").map(row => String(row.ticketNumber)));
    const eligible = detailTickets.filter(ticket => !ticket.winningMonth && !alreadyWon.has(String(ticket.ticketNumber)));
    return `<option value="">${eligible.length ? "Select ticket…" : "No eligible tickets"}</option>${eligible.map(ticket => `<option value="${detailEsc(ticket.ticketNumber)}">Ticket #${detailEsc(ticket.ticketNumber)} — ${detailEsc(ticket.member?.name || "Member")}</option>`).join("")}`;
}
async function refreshWinnerData() {
    const [winnerResult, ticketResult] = await Promise.all([
        fintrackApi("/winners"),
        fintrackApi(`/schemes/${encodeURIComponent(detailSchemeId)}/tickets`)
    ]);
    detailWinners = (winnerResult.winners || []).filter(item => String(item.scheme?._id || item.scheme) === String(detailSchemeId));
    detailTickets = ticketResult.tickets || [];
}
async function updateMonthlyWinner() {
    try {
        await refreshWinnerData();
        const openMonths = Array.from({ length: Number(detailScheme?.duration || 0) }, (_, index) => index + 1)
            .filter(month => !detailWinners.some(row => Number(row.month) === month && row.status === "stopped")
                && detailWinners.filter(row => Number(row.month) === month && row.status === "winner").length < 2);
        detailById("winnerActionMonth").innerHTML = monthOptionMarkup(openMonths);
        detailById("winnerActionTicket").innerHTML = eligibleTicketOptionMarkup();
        const canAdd = openMonths.length > 0 && detailTickets.some(ticket => !ticket.winningMonth && !detailWinners.some(row => row.status === "winner" && String(row.ticketNumber) === String(ticket.ticketNumber)));
        detailById("addWinnerMessage").textContent = canAdd ? "" : "No open month or eligible ticket is available for a winner.";
        detailById("addWinnerSubmit").disabled = !canAdd;
        openWinnerModal("addWinnerModal");
    } catch (error) { alert(error.message); }
}

async function removeWinnerFromToolbar() {
    try {
        await refreshWinnerData();
        const rows = detailWinners.filter(item => item.status === "winner");
        detailById("removeWinnerSelect").innerHTML = `<option value="">${rows.length ? "Select winner…" : "No winners recorded"}</option>${rows.map(item => `<option value="${detailEsc(item._id)}">Month ${item.month} · Ticket #${detailEsc(item.ticketNumber)} · ${detailEsc(item.member?.name || "Member")}</option>`).join("")}`;
        detailById("removeWinnerMessage").textContent = "";
        detailById("removeWinnerSubmit").disabled = rows.length === 0;
        openWinnerModal("removeWinnerModal");
    } catch (error) { alert(error.message); }
}

async function stopWinnerMonth() {
    try {
        await refreshWinnerData();
        const usedMonths = detailWinners.map(row => Number(row.month));
        detailById("stopMonthSelect").innerHTML = monthOptionMarkup(Array.from({length: Number(detailScheme?.duration || 0)}, (_, i) => i + 1).filter(month => !usedMonths.includes(month)));
        const available = detailById("stopMonthSelect").options.length > 1;
        detailById("stopMonthMessage").textContent = available ? "" : "Every month already has a winner or has been stopped.";
        detailById("stopMonthSubmit").disabled = !available;
        openWinnerModal("stopMonthModal");
    } catch (error) { alert(error.message); }
}

async function modifyStoppedMonth() {
    try {
        await refreshWinnerData();
        const stopped = detailWinners.filter(item => item.status === "stopped");
        detailById("modifyMonthSelect").innerHTML = `<option value="">${stopped.length ? "Select stopped month…" : "No stopped months"}</option>${stopped.map(item => `<option value="${detailEsc(item._id)}">Month ${item.month}</option>`).join("")}`;
        detailById("modifyMonthTicket").innerHTML = eligibleTicketOptionMarkup();
        detailById("modifyMonthMessage").textContent = stopped.length ? "" : "Stop a month first, then you can assign its winner here.";
        detailById("modifyMonthSubmit").disabled = stopped.length === 0 || !detailTickets.some(ticket => !ticket.winningMonth);
        openWinnerModal("modifyMonthModal");
    } catch (error) { alert(error.message); }
}

async function submitWinnerAction(form, buttonId, messageId, action) {
    const button = detailById(buttonId);
    const message = detailById(messageId);
    button.disabled = true;
    message.textContent = "Saving…";
    try {
        await action();
        const overlay = form.closest(".winner-action-modal-overlay");
        closeWinnerModal(overlay.id);
        await loadSchemeDetails();
    } catch (error) {
        message.textContent = error.message;
        button.disabled = false;
    }
}

async function addPayment() {
    const ticket = prompt("Ticket number:");
    const month = Number(prompt("Installment month:"));
    if (!ticket || !month) return;
    const result = await fintrackApi(`/schemes/${encodeURIComponent(detailSchemeId)}/tickets`);
    const selected = (result.tickets || []).find(item => String(item.ticketNumber) === String(ticket));
    if (!selected) return alert("Ticket not found.");
    try {
        await fintrackApi("/payments/manual", { method: "POST", body: JSON.stringify({ memberId: selected.member._id, schemeId: detailSchemeId, ticketNumber: ticket, month, method: "Manual", transactionId: "" }) });
        await loadSchemeDetails();
    } catch (error) { alert(error.message); }
}

async function saveGoldMonthlyInstallments() {
    if ((detailScheme?.chitType || detailScheme?.type) !== "gold") return;
    const installments = { ...(detailScheme.goldMonthlyInstallments || {}) };
    let month = 0;
    for (let candidate = 1; candidate <= Number(detailScheme.duration || 0); candidate += 1) {
        if (!(Number(installments[String(candidate)] ?? installments[candidate]) > 0)) { month = candidate; break; }
    }
    const input = month ? detailById(`goldInstallmentMonth${month}`) : null;
    const value = Number(input?.value);
    if (!month || !input || !Number.isFinite(value) || value <= 0) return;
    installments[String(month)] = value;
    try {
        detailById("goldInstallmentsMessage").textContent = "Saving…";
        await fintrackApi(`/schemes/${encodeURIComponent(detailSchemeId)}`, { method: "PATCH", body: JSON.stringify({ goldMonthlyInstallments: installments, ...(month === 1 ? { baseAmount: value } : {}) }) });
        await loadSchemeDetails();
    } catch (error) { detailById("goldInstallmentsMessage").textContent = error.message; }
}

function filterMembers() { location.reload(); }
function filterPayments() { location.reload(); }
function filterSchemes() { location.reload(); }
function refreshPayments() { location.reload(); }
function refreshSchemes() { location.reload(); }

document.addEventListener("DOMContentLoaded", () => {
    loadSchemeDetails();
    detailById("detailAddMemberForm")?.addEventListener("submit", saveExistingMemberToScheme);
    detailById("detailQuickCreateForm")?.addEventListener("submit", createMemberInScheme);
    detailById("goldInstallmentsGrid")?.addEventListener("input", event => {
        const button = detailById("saveGoldInstallmentsButton");
        if (button) button.disabled = !(Number(event.target.value) > 0);
    });
    detailById("detailMemberSearch")?.addEventListener("input", event => {
        detailById("detailSelectedMemberId").value = "";
        renderDetailMemberSuggestions(event.target.value);
    });
    detailById("detailMemberSearch")?.addEventListener("focus", event => renderDetailMemberSuggestions(event.target.value));
    detailById("detailMemberSuggestions")?.addEventListener("click", event => {
        if (event.target.closest("[data-action='create-member']")) return openDetailQuickCreate();
        const option = event.target.closest("[data-member-id]");
        if (!option) return;
        const member = detailMembers.find(item => String(item.id || item._id) === option.dataset.memberId);
        if (!member) return;
        detailById("detailMemberSearch").value = member.name;
        detailById("detailSelectedMemberId").value = member.id || member._id;
        detailById("detailMemberSuggestions").classList.remove("visible");
        detailById("detailTicketNumber").focus();
    });
    detailById("detailAddMemberModal")?.addEventListener("click", event => {
        if (event.target === detailById("detailAddMemberModal")) closeDetailMemberModal();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeDetailMemberModal();
            ["addWinnerModal", "removeWinnerModal", "stopMonthModal", "modifyMonthModal"].forEach(closeWinnerModal);
        }
    });
    document.querySelectorAll("[data-close-winner-modal]").forEach(button => button.addEventListener("click", () => closeWinnerModal(button.dataset.closeWinnerModal)));
    document.querySelectorAll(".winner-action-modal-overlay").forEach(modal => modal.addEventListener("click", event => {
        if (event.target === modal) closeWinnerModal(modal.id);
    }));
    detailById("addWinnerForm")?.addEventListener("submit", event => {
        event.preventDefault();
        submitWinnerAction(event.currentTarget, "addWinnerSubmit", "addWinnerMessage", () => fintrackApi("/winners", { method: "POST", body: JSON.stringify({ schemeId: detailSchemeId, month: Number(detailById("winnerActionMonth").value), ticketNumber: detailById("winnerActionTicket").value }) }));
    });
    detailById("removeWinnerForm")?.addEventListener("submit", event => {
        event.preventDefault();
        submitWinnerAction(event.currentTarget, "removeWinnerSubmit", "removeWinnerMessage", () => fintrackApi(`/winners/${encodeURIComponent(detailById("removeWinnerSelect").value)}`, { method: "DELETE" }));
    });
    detailById("stopMonthForm")?.addEventListener("submit", event => {
        event.preventDefault();
        submitWinnerAction(event.currentTarget, "stopMonthSubmit", "stopMonthMessage", () => fintrackApi("/winners/stopped", { method: "POST", body: JSON.stringify({ schemeId: detailSchemeId, month: Number(detailById("stopMonthSelect").value) }) }));
    });
    detailById("modifyMonthForm")?.addEventListener("submit", event => {
        event.preventDefault();
        submitWinnerAction(event.currentTarget, "modifyMonthSubmit", "modifyMonthMessage", () => fintrackApi(`/winners/stopped/${encodeURIComponent(detailById("modifyMonthSelect").value)}`, { method: "PATCH", body: JSON.stringify({ ticketNumber: detailById("modifyMonthTicket").value }) }));
    });
});
