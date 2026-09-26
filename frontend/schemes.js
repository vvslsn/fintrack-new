"use strict";

let schemes = [];
let managedScheme = null;
let schemeMembers = [];
let schemeTickets = [];
let goldInstallmentDraft = {};

const byId = id => document.getElementById(id);
const esc = value => escHtml(value);

async function loadSchemes() {
    try {
        const result = await fintrackApi("/schemes");
        const loaded = (result.schemes || []).map(scheme => ({
            ...scheme,
            id: scheme.id || scheme._id,
            type: scheme.chitType || scheme.type,
            tickets: []
        }));

        await Promise.all(loaded.map(async scheme => {
            try {
                const result = await fintrackApi(`/schemes/${encodeURIComponent(scheme.id)}/tickets`);
                scheme.tickets = result.tickets || [];
            } catch (error) {
                console.error(`Unable to load tickets for ${scheme.name}`, error);
            }
        }));

        schemes = loaded;
        renderSchemes();
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

function schemeTimeline(scheme) {
    const dateValue = String(scheme.startDate || "").slice(0, 10);
    const start = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(start.getTime())) return "—";
    const end = new Date(start);
    end.setMonth(end.getMonth() + Number(scheme.duration || 0));
    return `<span>Start: ${esc(dateText(start))}</span><span>End: ${esc(dateText(end))}</span>`;
}

function renderSchemes() {
    const body = byId("schemeTableBody");
    const search = (byId("schemeSearch")?.value || "").trim().toLowerCase();
    const status = byId("statusFilter")?.value || "all";
    const rows = schemes.filter(scheme =>
        (status === "all" || scheme.status === status) &&
        (!search || `${scheme.name} ${scheme.type} ${scheme.status}`.toLowerCase().includes(search))
    );

    if (byId("totalSchemeCount")) byId("totalSchemeCount").textContent = schemes.length;
    if (byId("schemeResultCount")) byId("schemeResultCount").textContent = `${rows.length} ${rows.length === 1 ? "scheme" : "schemes"}`;
    if (!body) return;

    body.innerHTML = rows.map(scheme => {
        const capacity = Number(scheme.capacity) || 0;
        const enrolled = scheme.tickets.length;
        const percent = capacity ? Math.min(100, Math.round(enrolled / capacity * 100)) : 0;
        const value = scheme.type === "gold" ? `${Number(scheme.goldGrams) || 0} grams` : money(scheme.totalAmount);
        return `<tr>
            <td><div class="scheme-name"><strong>${esc(scheme.name)}</strong><span>${esc(scheme.type)} · ${esc(value)}</span></div></td>
            <td>${scheme.type === "gold" ? '<span class="scheme-monthly-varies">Varies by month</span>' : `${money(scheme.baseAmount)}<span class="scheme-per-month">/mo</span>`}</td>
            <td>${esc(scheme.duration)} Months</td>
            <td><div class="scheme-timeline">${schemeTimeline(scheme)}</div></td>
            <td><div class="scheme-capacity"><div><span>${enrolled}/${capacity}</span><span>${percent}%</span></div><div class="scheme-capacity-track"><span style="width:${percent}%"></span></div></div></td>
            <td><span class="scheme-status ${esc(scheme.status)}">${esc(scheme.status)}</span></td>
            <td><div class="scheme-actions"><a class="scheme-manage-button" href="scheme-details.html?id=${encodeURIComponent(scheme.id)}">Manage <span aria-hidden="true">→</span></a><button type="button" class="scheme-edit-button" onclick="openEditSchemeModal('${esc(scheme.id)}')">Edit</button><button type="button" class="scheme-delete-button" onclick="deleteScheme('${esc(scheme.id)}')">Delete</button></div></td>
        </tr>`;
    }).join("") || `<tr><td colspan="7" class="scheme-empty-row">No schemes found.</td></tr>`;
}

function openCreateSchemeModal() {
    byId("schemeForm")?.reset();
    byId("editSchemeId").value = "";
    goldInstallmentDraft = {};
    byId("schemeModalTitle").textContent = "Create Scheme";
    byId("schemeStatus").value = "upcoming";
    toggleSchemeFields();
    byId("schemeModal").classList.add("active");
}

function openEditSchemeModal(id) {
    const scheme = schemes.find(item => String(item.id) === String(id));
    if (!scheme) return;
    openCreateSchemeModal();
    byId("schemeModalTitle").textContent = "Edit Scheme";
    byId("editSchemeId").value = scheme.id;
    byId("schemeName").value = scheme.name;
    byId("schemeType").value = scheme.type;
    byId("schemeAmount").value = scheme.totalAmount || "";
    byId("schemeDuration").value = scheme.duration;
    goldInstallmentDraft = { ...(scheme.goldMonthlyInstallments || {}) };
    byId("schemeBaseAmount").value = scheme.baseAmount || "";
    byId("schemeCapacity").value = scheme.capacity;
    byId("schemeStartDate").value = String(scheme.startDate).slice(0, 10);
    byId("schemeStatus").value = scheme.status;
    toggleSchemeFields();
}

function closeSchemeModal() {
    byId("schemeModal")?.classList.remove("active");
}

function readGoldInstallmentDraft() {
    document.querySelectorAll("[data-scheme-gold-month]").forEach(input => {
        goldInstallmentDraft[input.dataset.schemeGoldMonth] = input.value;
    });
}

function renderSchemeGoldInstallments() {
    const duration = Number(byId("schemeDuration").value);
    const grid = byId("schemeGoldInstallmentsGrid");
    if (!grid) return;
    readGoldInstallmentDraft();
    if (!Number.isInteger(duration) || duration < 1 || duration > 30) {
        grid.innerHTML = "";
        byId("schemeGoldInstallmentsMessage").textContent = duration > 30 ? "A scheme can have a maximum duration of 30 months." : "Enter the duration to create one installment field for each month.";
        return;
    }
    byId("schemeGoldInstallmentsMessage").textContent = "Enter Month 1 now. Each later month's amount becomes available on its monthly anniversary.";
    const value = goldInstallmentDraft["1"] ?? goldInstallmentDraft[1] ?? "";
    grid.innerHTML = `<label class="scheme-gold-month-field" for="schemeGoldMonth1"><span>Month 1 Installment</span><div class="scheme-gold-amount-input"><b>₹</b><input id="schemeGoldMonth1" data-scheme-gold-month="1" type="number" min="0.01" step="0.01" value="${esc(value)}" placeholder="Enter amount" required></div></label>`;
    const submit = byId("schemeSaveButton");
    if (submit) submit.disabled = Number(value) <= 0;
}

function toggleSchemeFields() {
    const isGold = byId("schemeType")?.value === "gold";
    byId("totalAmountGroup").style.display = isGold ? "none" : "";
    byId("schemeAmount").disabled = isGold;
    byId("schemeAmount").required = !isGold;
    byId("baseAmountGroup").style.display = isGold ? "none" : "";
    byId("schemeBaseAmount").readOnly = true;
    byId("schemeBaseAmount").required = !isGold;
    byId("schemeBaseAmount").disabled = isGold;
    byId("schemeGoldInstallmentsGroup").hidden = !isGold;
    if (isGold) renderSchemeGoldInstallments();
    if (!isGold && byId("schemeAmount").value) {
        byId("schemeBaseAmount").value = Math.round(Number(byId("schemeAmount").value) * 0.05);
    }
}

async function saveScheme(event) {
    event.preventDefault();
    const id = byId("editSchemeId").value;
    const type = byId("schemeType").value;
    const totalAmount = type === "gold" ? 0 : Number(byId("schemeAmount").value);
    const duration = Number(byId("schemeDuration").value);
    const capacity = Number(byId("schemeCapacity").value);
    if (!byId("schemeName").value.trim()) return alert("Enter a scheme name.");
    if (!Number.isInteger(duration) || duration < 1 || duration > 30) return alert("Scheme duration must be between 1 and 30 months.");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) return alert("Enter a member capacity between 1 and 1000.");
    if (!byId("schemeStartDate").value) return alert("Choose a scheme start date.");
    if (type === "cash" && (!Number.isFinite(totalAmount) || totalAmount <= 0)) return alert("Enter total amount.");

    let goldMonthlyInstallments;
    if (type === "gold") {
        readGoldInstallmentDraft();
        readGoldInstallmentDraft();
        const firstMonth = Number(byId("schemeGoldMonth1")?.value ?? goldInstallmentDraft["1"] ?? 0);
        if (!Number.isFinite(firstMonth) || firstMonth <= 0) return byId("schemeGoldMonth1")?.focus();
        goldMonthlyInstallments = Object.fromEntries(Object.entries(goldInstallmentDraft)
            .filter(([month, amount]) => Number(month) >= 1 && Number(month) <= duration && Number(amount) > 0));
        goldMonthlyInstallments["1"] = firstMonth;
    }
    const baseAmount = type === "gold" ? Number(goldMonthlyInstallments?.["1"] || 0) : Math.round(totalAmount * 0.05);

    const gramsMatch = byId("schemeName").value.match(/(\d+(?:\.\d+)?)\s*(?:grams?|g)\b/i);
    const payload = {
        name: byId("schemeName").value.trim(),
        chitType: type,
        totalAmount,
        baseAmount,
        ...(type === "gold" ? { goldMonthlyInstallments } : {}),
        goldGrams: type === "gold" ? Number(gramsMatch?.[1] || 0) : 0,
        duration,
        capacity,
        startDate: byId("schemeStartDate").value,
        status: byId("schemeStatus").value
    };

    try {
        const path = id ? `/schemes/${encodeURIComponent(id)}` : "/schemes";
        await fintrackApi(path, { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) });
        closeSchemeModal();
        await loadSchemes();
    } catch (error) {
        alert(error.message);
    }
}

async function deleteScheme(id) {
    if (!confirm("Delete this scheme?")) return;
    try {
        await fintrackApi(`/schemes/${encodeURIComponent(id)}`, { method: "DELETE" });
        await loadSchemes();
    } catch (error) {
        alert(error.message);
    }
}

function nextTicketNumber() {
    const used = new Set(schemeTickets.map(ticket => String(ticket.ticketNumber).trim()));
    let number = 1;
    while (used.has(String(number))) number += 1;
    return String(number);
}

function renderMemberSearchResults(query = "") {
    const results = byId("memberSearchResults");
    const normalized = query.trim().toLowerCase();
    const matches = schemeMembers.filter(member =>
        !normalized || `${member.name} ${member.phone} ${member.email}`.toLowerCase().includes(normalized)
    ).slice(0, 8);
    const atCapacity = Number(managedScheme?.capacity || 0) <= schemeTickets.length;
    results.innerHTML = matches.map(member =>
        `<button type="button" class="member-search-option" role="option" data-member-id="${esc(member.id || member._id)}"><strong>${esc(member.name)}</strong><span>${esc(member.phone)}${member.email ? ` · ${esc(member.email)}` : ""}</span></button>`
    ).join("") || `<p class="member-search-empty">${schemeMembers.length ? "No matching members." : "No active members found."}</p>${atCapacity ? "" : `<button type="button" class="create-member-option" data-action="create-member">+ Create a new member${normalized ? ` named “${esc(query.trim())}”` : ""}</button>`}`;
    results.classList.add("visible");
}

function openQuickCreateMember() {
    if (!managedScheme || schemeTickets.length >= Number(managedScheme.capacity || 0)) {
        byId("manageSchemeMessage").textContent = "This scheme has reached its member capacity.";
        return;
    }
    byId("memberSearchResults").classList.remove("visible");
    byId("quickCreateMemberPanel").hidden = false;
    const searchText = byId("memberNameSearch").value.trim();
    byId("newMemberName").value = searchText;
    const today = new Date();
    byId("newMemberJoinedDate").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    byId("newMemberName").focus();
}

function closeQuickCreateMember() {
    byId("quickCreateMemberPanel").hidden = true;
}

async function createAndAddMember(event) {
    event.preventDefault();
    if (!managedScheme) return;
    const payload = {
        name: byId("newMemberName").value.trim(),
        email: byId("newMemberEmail").value.trim(),
        phone: byId("newMemberPhone").value.trim(),
        joinedDate: byId("newMemberJoinedDate").value,
        createLogin: false
    };
    if (!/^\d{10}$/.test(payload.phone)) {
        byId("manageSchemeMessage").textContent = "Enter a valid 10-digit phone number.";
        return;
    }
    if (schemeTickets.length >= Number(managedScheme.capacity || 0)) {
        byId("manageSchemeMessage").textContent = "This scheme has reached its member capacity.";
        return;
    }

    const submit = byId("createAndAddMemberButton");
    submit.disabled = true;
    submit.textContent = "Creating member…";
    byId("manageSchemeMessage").textContent = "";
    let createdMember = null;
    try {
        const created = await fintrackApi("/members", {
            method: "POST",
            body: JSON.stringify(payload)
        });
        createdMember = created.member;
        await fintrackApi(`/members/${encodeURIComponent(createdMember.id)}/tickets`, {
            method: "POST",
            body: JSON.stringify({ schemeId: managedScheme.id, ticketNumber: byId("newTicketNumber").value.trim() })
        });

        const [ticketResult, memberResult] = await Promise.all([
            fintrackApi(`/schemes/${encodeURIComponent(managedScheme.id)}/tickets`),
            fintrackApi("/members")
        ]);
        schemeTickets = ticketResult.tickets || [];
        schemeMembers = (memberResult.members || []).filter(member => member.status !== "inactive");
        managedScheme.tickets = schemeTickets;
        byId("quickCreateMemberForm").reset();
        closeQuickCreateMember();
        byId("memberNameSearch").value = "";
        byId("selectedMemberId").value = "";
        byId("newTicketNumber").value = nextTicketNumber();
        byId("manageSchemeMessage").textContent = `${createdMember.name} was created and added to this scheme.`;
        renderManagedTickets();
        renderSchemes();
    } catch (error) {
        byId("manageSchemeMessage").textContent = createdMember
            ? `Member created, but could not be added to the scheme: ${error.message}. The member remains in Members.`
            : error.message;
        if (createdMember) {
            try {
                const memberResult = await fintrackApi("/members");
                schemeMembers = (memberResult.members || []).filter(member => member.status !== "inactive");
            } catch (refreshError) {
                console.error(refreshError);
            }
        }
    } finally {
        submit.disabled = false;
        submit.textContent = "Create and add to scheme";
    }
}

function renderManagedTickets() {
    byId("managedMembersBody").innerHTML = schemeTickets.map(ticket =>
        `<tr><td>#${esc(ticket.ticketNumber)}</td><td>${esc(ticket.member?.name || "Member")}</td><td>${esc(ticket.member?.phone || "—")}</td></tr>`
    ).join("") || `<tr><td colspan="3" class="managed-members-empty">No members have joined this scheme yet.</td></tr>`;
    const capacity = Number(managedScheme?.capacity) || 0;
    const enrolled = schemeTickets.length;
    byId("manageCapacitySummary").innerHTML = `<div><strong>${enrolled} <span>/ ${capacity}</span></strong><small>members enrolled</small></div><div class="scheme-capacity-track"><span style="width:${capacity ? Math.min(100, enrolled / capacity * 100) : 0}%"></span></div><small>${Math.max(0, capacity - enrolled)} slots available</small>`;
    const full = capacity > 0 && enrolled >= capacity;
    byId("schemeMemberForm").querySelector("button[type=submit]").disabled = full;
    byId("schemeMemberForm").querySelector("button[type=submit]").textContent = full ? "Scheme is full" : "Add member";
}

async function openManageSchemeModal(id) {
    managedScheme = schemes.find(item => String(item.id) === String(id));
    if (!managedScheme) return;
    schemeTickets = [];
    schemeMembers = [];
    byId("manageSchemeTitle").textContent = `Manage ${managedScheme.name}`;
    byId("manageSchemeSubtitle").textContent = "Search by member name, choose the right person, and assign a ticket number.";
    byId("manageSchemeMessage").textContent = "";
    byId("memberNameSearch").value = "";
    byId("selectedMemberId").value = "";
    byId("newTicketNumber").value = "";
    byId("quickCreateMemberPanel").hidden = true;
    byId("schemeMemberForm").reset();
    byId("schemeManageModal").classList.add("active");

    try {
        const [ticketResult, memberResult] = await Promise.all([
            fintrackApi(`/schemes/${encodeURIComponent(id)}/tickets`),
            fintrackApi("/members")
        ]);
        schemeTickets = ticketResult.tickets || [];
        schemeMembers = (memberResult.members || []).filter(member => member.status !== "inactive");
        byId("newTicketNumber").value = nextTicketNumber();
        renderManagedTickets();
        renderMemberSearchResults();
    } catch (error) {
        byId("manageSchemeMessage").textContent = error.message;
    }
}

function closeManageSchemeModal() {
    byId("schemeManageModal")?.classList.remove("active");
    byId("memberSearchResults")?.classList.remove("visible");
    managedScheme = null;
}

async function addMemberToScheme(event) {
    event.preventDefault();
    const memberId = byId("selectedMemberId").value;
    const ticketNumber = byId("newTicketNumber").value.trim();
    if (!managedScheme) return;
    if (!memberId) {
        byId("manageSchemeMessage").textContent = "Choose a member from the name suggestions first.";
        byId("memberNameSearch").focus();
        return;
    }
    if (!ticketNumber) {
        byId("manageSchemeMessage").textContent = "Enter a ticket number.";
        return;
    }

    const submit = byId("schemeMemberForm").querySelector("button[type=submit]");
    submit.disabled = true;
    submit.textContent = "Adding…";
    byId("manageSchemeMessage").textContent = "";
    try {
        await fintrackApi(`/members/${encodeURIComponent(memberId)}/tickets`, {
            method: "POST",
            body: JSON.stringify({ schemeId: managedScheme.id, ticketNumber })
        });
        const [ticketResult, memberResult] = await Promise.all([
            fintrackApi(`/schemes/${encodeURIComponent(managedScheme.id)}/tickets`),
            fintrackApi("/members")
        ]);
        schemeTickets = ticketResult.tickets || [];
        schemeMembers = (memberResult.members || []).filter(member => member.status !== "inactive");
        managedScheme.tickets = schemeTickets;
        byId("memberNameSearch").value = "";
        byId("selectedMemberId").value = "";
        byId("newTicketNumber").value = nextTicketNumber();
        byId("manageSchemeMessage").textContent = "Member added to this scheme.";
        renderManagedTickets();
        renderMemberSearchResults();
        renderSchemes();
    } catch (error) {
        byId("manageSchemeMessage").textContent = error.message;
    } finally {
        if (byId("schemeManageModal").classList.contains("active")) {
            submit.disabled = schemeTickets.length >= Number(managedScheme?.capacity || 0);
            submit.textContent = submit.disabled ? "Scheme is full" : "Add member";
        }
    }
}

function filterSchemes() { renderSchemes(); }
function refreshSchemes() { loadSchemes(); }
function editScheme(id) { openEditSchemeModal(id); }

document.addEventListener("DOMContentLoaded", () => {
    loadSchemes().then(() => {
        const editId = new URLSearchParams(location.search).get("editSchemeId");
        if (editId) openEditSchemeModal(editId);
    });
    byId("schemeForm")?.addEventListener("submit", saveScheme);
    byId("schemeType")?.addEventListener("change", toggleSchemeFields);
    byId("schemeAmount")?.addEventListener("input", toggleSchemeFields);
    byId("schemeDuration")?.addEventListener("input", toggleSchemeFields);
    byId("schemeGoldInstallmentsGrid")?.addEventListener("input", event => {
        goldInstallmentDraft[event.target.dataset.schemeGoldMonth] = event.target.value;
        const button = byId("schemeSaveButton");
        if (button) button.disabled = !(Number(event.target.value) > 0);
    });
    byId("schemeSearch")?.addEventListener("input", renderSchemes);
    byId("statusFilter")?.addEventListener("change", renderSchemes);
    byId("schemeMemberForm")?.addEventListener("submit", addMemberToScheme);
    byId("quickCreateMemberForm")?.addEventListener("submit", createAndAddMember);
    byId("memberNameSearch")?.addEventListener("input", event => {
        byId("selectedMemberId").value = "";
        renderMemberSearchResults(event.target.value);
    });
    byId("memberSearchResults")?.addEventListener("click", event => {
        if (event.target.closest("[data-action='create-member']")) {
            openQuickCreateMember();
            return;
        }
        const option = event.target.closest("[data-member-id]");
        if (!option) return;
        const member = schemeMembers.find(item => String(item.id || item._id) === option.dataset.memberId);
        if (!member) return;
        byId("memberNameSearch").value = member.name;
        byId("selectedMemberId").value = member.id || member._id;
        byId("memberSearchResults").classList.remove("visible");
        byId("newTicketNumber").focus();
    });
    byId("memberNameSearch")?.addEventListener("focus", event => renderMemberSearchResults(event.target.value));
    byId("schemeManageModal")?.addEventListener("click", event => {
        if (event.target === byId("schemeManageModal")) closeManageSchemeModal();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeManageSchemeModal();
    });
    toggleSchemeFields();
});
