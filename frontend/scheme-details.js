"use strict";

let detailSchemeId = "";
let detailScheme = null;
let detailTickets = [];
let detailMembers = [];

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
    detailById("baseInstallment").textContent = money(scheme.baseAmount);
    detailById("duration").textContent = `${scheme.duration} Months`;
    detailById("memberCount").textContent = `${membersCount} / ${capacity}`;
    detailById("infoName").textContent = scheme.name;
    detailById("infoType").textContent = type;
    detailById("infoAmount").textContent = value;
    detailById("infoInstallment").textContent = money(scheme.baseAmount);
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

async function updateMonthlyWinner() {
    const month = Number(prompt("Winner month:"));
    const ticket = prompt("Winner ticket number:");
    if (!month || !ticket) return;
    try {
        await fintrackApi("/winners", { method: "POST", body: JSON.stringify({ schemeId: detailSchemeId, month, ticketNumber: ticket }) });
        await loadSchemeDetails();
    } catch (error) { alert(error.message); }
}

async function removeWinnerFromToolbar() {
    const result = await fintrackApi("/winners");
    const winners = (result.winners || []).filter(item => String(item.scheme?._id || item.scheme) === String(detailSchemeId));
    const ticket = prompt("Enter winning ticket number to remove:");
    const winner = winners.find(item => String(item.ticketNumber) === String(ticket));
    if (!winner) return alert("Winner not found.");
    if (!confirm("Remove this winner?")) return;
    try {
        await fintrackApi(`/winners/${winner._id}`, { method: "DELETE" });
        await loadSchemeDetails();
    } catch (error) { alert(error.message); }
}

async function stopWinnerMonth() {
    const month = Number(prompt("Month to mark stopped:"));
    if (!month) return;
    try {
        await fintrackApi("/winners/stopped", { method: "POST", body: JSON.stringify({ schemeId: detailSchemeId, month }) });
        await loadSchemeDetails();
    } catch (error) { alert(error.message); }
}

async function modifyStoppedMonth() { alert("Modify a stopped month by adding a winner from the Winners tab."); }

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
    const result = await fintrackApi(`/schemes/${encodeURIComponent(detailSchemeId)}`);
    const scheme = result.scheme;
    if (scheme.type !== "gold") return;
    const installments = { ...(scheme.goldMonthlyInstallments || {}) };
    for (let month = 1; month <= Number(scheme.duration || 0); month += 1) {
        const value = prompt(`Gold monthly installment for Month ${month}:`, installments[String(month)] || scheme.baseAmount || "");
        if (value === null) return;
        installments[String(month)] = Number(value) || 0;
    }
    try {
        await fintrackApi(`/schemes/${encodeURIComponent(detailSchemeId)}`, { method: "PATCH", body: JSON.stringify({ goldMonthlyInstallments: installments }) });
        await loadSchemeDetails();
    } catch (error) { alert(error.message); }
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
        if (event.key === "Escape") closeDetailMemberModal();
    });
});
