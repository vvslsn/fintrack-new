"use strict";

/* =========================================================
   PAYMENT DATA
========================================================= */

let payments = [];
let adminPayouts = [];


/* =========================================================
   PAYMENT AMOUNT CALCULATION
========================================================= */

function getMemberPaymentAmount(scheme, chitTaken) {
    if (!scheme) return 0;
    const type = typeof window.normalizeChitType === "function"
        ? window.normalizeChitType(scheme.type)
        : String(scheme.type || "cash").toLowerCase();
    if (type === "gold") return Number(scheme.baseAmount || 0);
    const amount = Number(scheme.totalAmount || 0);
    const normal = Math.round(amount * 0.05);
    const winner = Math.round(amount * 0.06);
    return chitTaken ? winner : normal;
}



/* =========================================================
   CHIT PAYMENT BUSINESS RULES
========================================================= */

function getStoredMembersForPayments() {
    try {
        const data = JSON.parse(localStorage.getItem("chitfund_members") || "[]");
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Unable to load members for payment calculation:", error);
        return [];
    }
}

function getStoredSchemesForPayments() {
    try {
        const data = JSON.parse(localStorage.getItem("chitfund_schemes") || "[]");
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Unable to load schemes for payment calculation:", error);
        return [];
    }
}

/* =========================================================
   INSTALLMENT DUE-DATE RULES

   Start day -> payment day
   1  -> 10th
   5  -> 15th
   10 -> 20th
   15 -> 25th
   25 -> 5th of the following month
========================================================= */

function getPaymentDueDateForScheme(scheme, installmentMonth) {
    if (typeof window.getFintrackDueDate === "function") {
        return window.getFintrackDueDate(scheme, installmentMonth);
    }
    if (!scheme || !scheme.startDate) return "";
    const month = Number(installmentMonth || 0);
    if (!Number.isInteger(month) || month < 1) return "";
    const [y,m,d] = String(scheme.startDate).split("-").map(Number);
    if (![y,m,d].every(Number.isFinite)) return "";
    const map = {1:10,5:15,10:20,15:25,25:5};
    const date = new Date(y, m - 1, 1);
    date.setMonth(date.getMonth() + month - 1);
    if (d === 25) { date.setMonth(date.getMonth() + 1); date.setDate(5); }
    else if (map[d]) date.setDate(map[d]);
    else { date.setDate(Math.min(d + 10, new Date(date.getFullYear(), date.getMonth()+1, 0).getDate())); }
    return toISODate(date);
}

function toISODate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getTodayDateOnly() {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function getDateOnlyFromISO(value) {
    if (!value) return null;
    const parts = String(value).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

/*
 * Only installments whose due month has arrived are exposed in the
 * payment ledger. Future installments are created automatically when
 * their due date/month arrives. This keeps the ledger month-on-month
 * instead of showing the complete chit duration on day one.
 */
function isInstallmentDueByToday(scheme, installmentMonth) {
    const dueDate = getPaymentDueDateForScheme(scheme, installmentMonth);
    const due = getDateOnlyFromISO(dueDate);
    if (!due) return false;
    return due.getTime() <= getTodayDateOnly().getTime();
}

function syncInstallmentPaymentRecords() {
    const members = getStoredMembersForPayments();
    const schemes = getStoredSchemesForPayments();
    let changed = false;

    schemes.forEach(function (scheme) {
        const duration = Math.max(0, Number(scheme.duration || 0));
        if (!duration) return;

        members.forEach(function (member) {
            if (!Array.isArray(member.schemes)) return;

            member.schemes.forEach(function (memberScheme) {
                if (!memberScheme) return;

                const sameScheme =
                    String(memberScheme.id ?? "") === String(scheme.id ?? "") ||
                    String(memberScheme.name || "").trim().toLowerCase() ===
                        String(scheme.name || "").trim().toLowerCase();

                if (!sameScheme) return;

                const ticket =
                    memberScheme.ticket ??
                    memberScheme.ticketNumber ??
                    memberScheme.ticketNo;

                if (ticket === undefined || ticket === null || String(ticket).trim() === "") {
                    return;
                }

                for (let month = 1; month <= duration; month++) {
                    // Do not create future installment records. The ledger
                    // should contain only months whose payment due date has arrived.
                    if (!isInstallmentDueByToday(scheme, month)) {
                        continue;
                    }

                    const dueDate = getPaymentDueDateForScheme(scheme, month);
                    const amount = getCalculatedPaymentAmount(scheme, member, month, ticket);

                    let existing = payments.find(function (payment) {
                        const sameMember =
                            (payment.memberId != null && member.id != null && String(payment.memberId) === String(member.id)) ||
                            String(payment.member || "").trim().toLowerCase() === String(member.name || "").trim().toLowerCase();

                        const sameSchemeRecord =
                            (payment.schemeId != null && scheme.id != null && String(payment.schemeId) === String(scheme.id)) ||
                            String(payment.scheme || "").trim().toLowerCase() === String(scheme.name || "").trim().toLowerCase();

                        return sameMember &&
                            sameSchemeRecord &&
                            String(payment.ticket ?? "").trim() === String(ticket).trim() &&
                            Number(payment.month) === month;
                    });

                    if (!existing) {
                        existing = {
                            id: generatePaymentId(),
                            memberId: member.id ?? null,
                            member: member.name || "",
                            email: member.email || "",
                            schemeId: scheme.id ?? null,
                            scheme: scheme.name || "",
                            ticket: ticket,
                            month: month,
                            dueDate: dueDate,
                            amount: amount,
                            paymentDate: "",
                            method: "",
                            transactionId: "",
                            status: "pending",
                            receivedByAdmin: false,
                            receivedAt: "",
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            autoGenerated: true
                        };

                        if (String(scheme.type || "").toLowerCase() === "gold") {
                            existing.goldGrams = Number(scheme.goldGrams || 0);
                            existing.goldMonthlyAmount = amount;
                        }

                        payments.push(existing);
                        changed = true;
                        continue;
                    }

                    // Existing paid records are preserved as the official receipt.
                    if (String(existing.status || "").toLowerCase() !== "paid") {
                        const newValues = {
                            dueDate: dueDate,
                            amount: amount,
                            status: "pending",
                            paymentDate: "",
                            method: "",
                            transactionId: "",
                            receivedByAdmin: false,
                            receivedAt: "",
                            memberId: member.id ?? existing.memberId ?? null,
                            email: member.email || existing.email || "",
                            schemeId: scheme.id ?? existing.schemeId ?? null,
                            member: member.name || existing.member || "",
                            scheme: scheme.name || existing.scheme || "",
                            ticket: ticket,
                            month: month,
                            updatedAt: new Date().toISOString()
                        };

                        Object.keys(newValues).forEach(function (key) {
                            if (existing[key] !== newValues[key]) {
                                existing[key] = newValues[key];
                                changed = true;
                            }
                        });

                        if (String(scheme.type || "").toLowerCase() === "gold") {
                            if (existing.goldGrams !== Number(scheme.goldGrams || 0)) {
                                existing.goldGrams = Number(scheme.goldGrams || 0);
                                changed = true;
                            }
                            if (existing.goldMonthlyAmount !== amount) {
                                existing.goldMonthlyAmount = amount;
                                changed = true;
                            }
                        }
                    } else if (existing.dueDate !== dueDate) {
                        existing.dueDate = dueDate;
                        existing.updatedAt = new Date().toISOString();
                        changed = true;
                    }
                }
            });
        });
    });

    /*
     * Older versions generated the complete chit duration immediately.
     * Remove only those old, auto-generated FUTURE pending records so the
     * ledger and totals follow the month-by-month rule. Paid history is
     * never removed.
     */
    const beforeCleanup = payments.length;
    payments = payments.filter(function (payment) {
        if (!payment || payment.autoGenerated !== true) return true;
        if (String(payment.status || "").toLowerCase() === "paid") return true;

        const scheme = schemes.find(function (item) {
            return (payment.schemeId != null && item.id != null && String(payment.schemeId) === String(item.id)) ||
                String(payment.scheme || "").trim().toLowerCase() === String(item.name || "").trim().toLowerCase();
        });

        if (!scheme) return true;
        return isInstallmentDueByToday(scheme, Number(payment.month || 0));
    });

    if (payments.length !== beforeCleanup) changed = true;

    if (changed) savePayments();
}

function updatePaymentDueDateFromBusinessRules() {
    const schemeName = getValue("paymentScheme");
    const month = Number(getValue("paymentMonth"));
    const dueDateInput = document.getElementById("paymentDueDate");
    if (!dueDateInput) return;

    const scheme = findPaymentSchemeByName(schemeName);
    const dueDate = getPaymentDueDateForScheme(scheme, month);
    dueDateInput.value = dueDate;
    dueDateInput.readOnly = Boolean(dueDate);
    if (dueDate) {
        dueDateInput.title = "Automatically calculated from the chit start date and installment month.";
    }
}

function findPaymentSchemeByName(name) {
    const wanted = String(name || "").trim().toLowerCase();
    return getStoredSchemesForPayments().find(function (scheme) {
        return String(scheme.name || "").trim().toLowerCase() === wanted;
    }) || null;
}

function findPaymentMemberByName(name) {
    const wanted = String(name || "").trim().toLowerCase();
    return getStoredMembersForPayments().find(function (member) {
        return String(member.name || "").trim().toLowerCase() === wanted;
    }) || null;
}

function getMemberSchemeEntriesForPayments(member, scheme) {

    if (!member || !scheme || !Array.isArray(member.schemes)) {
        return [];
    }

    return member.schemes.filter(function (item) {

        if (!item) return false;

        return (
            String(item.id) === String(scheme.id) ||
            String(item.name || "").trim().toLowerCase() ===
            String(scheme.name || "").trim().toLowerCase()
        );

    });
}

function getWinnerForTicket(scheme, ticket) {

    let winners = [];

    try {
        winners = JSON.parse(
            localStorage.getItem("chitfund_winners") || "[]"
        );
    } catch (error) {
        winners = [];
    }

    if (!Array.isArray(winners)) return null;

    return winners.find(function (winner) {

        return (
            (String(winner.schemeId) === String(scheme?.id) ||
                String(winner.scheme || "").trim().toLowerCase() ===
                String(scheme?.name || "").trim().toLowerCase()) &&
            String(winner.ticket ?? winner.ticketNumber ?? "").trim() ===
            String(ticket).trim()
        );

    }) || null;
}

function getCalculatedPaymentAmount(
    scheme,
    member,
    paymentMonth,
    ticket
) {

    if (!scheme) return 0;

    if (typeof window.fintrackPaymentAmount === "function") {
        return window.fintrackPaymentAmount(scheme, paymentMonth, member, ticket);
    }

    const total =
        Number(scheme.totalAmount || 0);

    const month =
        Number(paymentMonth || 0);

    const schemeType = String(scheme.type || "cash").toLowerCase();

    // Gold Chit: each month's installment is set independently by the admin.
    if (schemeType === "gold") {
        const monthly = scheme.goldMonthlyInstallments || {};
        return Number(monthly[String(month)] ?? monthly[month] ?? 0) || 0;
    }

    if (total <= 0 || month < 1) {
        return 0;
    }

    const normalPayment =
        Math.round(total * 0.05);

    const winnerPayment =
        Math.round(total * 0.06);

    const winner =
        getWinnerForTicket(
            scheme,
            ticket
        );

    const winningMonth =
        winner
            ? Number(winner.month)
            : (
                getMemberSchemeEntriesForPayments(
                    member,
                    scheme
                ).find(function (item) {

                    const itemTicket =
                        item.ticket ??
                        item.ticketNumber ??
                        item.ticketNo;

                    return (
                        String(itemTicket).trim() ===
                        String(ticket).trim()
                    );

                })?.winningMonth
            );

    if (
        Number.isInteger(winningMonth) &&
        month >= winningMonth
    ) {
        return winnerPayment;
    }

    return normalPayment;
}

/* =========================================================
   PAYMENT MEMBER SELECTION BY CHIT SCHEME

   Only members who are actually enrolled in the selected
   chit scheme are available when the admin records a payment.
========================================================= */

function getMemberSchemeMatch(member, scheme) {
    if (!member || !scheme || !Array.isArray(member.schemes)) {
        return [];
    }

    return member.schemes.filter(function (item) {
        if (!item) return false;

        const itemId = item.id ?? item.schemeId;
        const schemeId = scheme.id ?? scheme._id ?? scheme.schemeId;

        return (
            (itemId != null && schemeId != null && String(itemId) === String(schemeId)) ||
            String(item.name || item.schemeName || "").trim().toLowerCase() ===
                String(scheme.name || "").trim().toLowerCase()
        );
    });
}

function populatePaymentMembers(selectedMemberName) {
    const select = document.getElementById("paymentMember");
    if (!select) return;

    const schemeName = getValue("paymentScheme").trim();
    const scheme = findPaymentSchemeByName(schemeName);
    const members = getStoredMembersForPayments();
    const previousValue = selectedMemberName ?? select.value;

    select.innerHTML = `<option value="">Select Member</option>`;
    select.disabled = true;

    if (!scheme) {
        select.innerHTML = `<option value="">Select Chit Scheme First</option>`;
        populatePaymentTickets();
        return;
    }

    const enrolledMembers = [];
    const seen = new Set();

    members.forEach(function (member) {
        const entries = getMemberSchemeMatch(member, scheme);
        if (!entries.length) return;

        const memberKey = String(member.id ?? member._id ?? member.name ?? "").trim().toLowerCase();
        if (seen.has(memberKey)) return;
        seen.add(memberKey);

        enrolledMembers.push({ member, entries });
    });

    enrolledMembers.sort(function (a, b) {
        return String(a.member.name || "").localeCompare(String(b.member.name || ""));
    });

    if (!enrolledMembers.length) {
        select.innerHTML = `<option value="">No members in this chit scheme</option>`;
        select.disabled = true;
        document.getElementById("paymentEmail")?.setAttribute("value", "");
        populatePaymentTickets();
        return;
    }

    enrolledMembers.forEach(function ({ member, entries }) {
        const option = document.createElement("option");
        option.value = member.name || "";

        const tickets = entries.map(function (entry) {
            return entry.ticket ?? entry.ticketNumber ?? entry.ticketNo;
        }).filter(function (ticket) {
            return ticket !== undefined && ticket !== null && String(ticket).trim() !== "";
        });

        option.textContent = tickets.length
            ? `${member.name} • Ticket ${tickets.join(", ")}`
            : member.name;

        select.appendChild(option);
    });

    select.disabled = false;

    if (previousValue && Array.from(select.options).some(function (option) {
        return String(option.value).trim().toLowerCase() === String(previousValue).trim().toLowerCase();
    })) {
        select.value = previousValue;
    }

    updatePaymentMemberEmail();
    populatePaymentTickets();
}

function updatePaymentMemberEmail() {
    const emailInput = document.getElementById("paymentEmail");
    if (!emailInput) return;

    const memberName = getValue("paymentMember").trim();
    const member = findPaymentMemberByName(memberName);

    emailInput.value = member?.email || "";
}

function populatePaymentTickets() {

    const select =
        document.getElementById(
            "paymentTicket"
        );

    if (!select) return;

    const memberName =
        getValue("paymentMember").trim();

    const schemeName =
        getValue("paymentScheme");

    const currentTicket =
        select.value;

    select.innerHTML =
        `<option value="">Select Ticket</option>`;

    if (!memberName || !schemeName) {
        return;
    }

    const member =
        findPaymentMemberByName(
            memberName
        );

    const scheme =
        findPaymentSchemeByName(
            schemeName
        );

    if (!member || !scheme) {
        return;
    }

    const entries =
        getMemberSchemeEntriesForPayments(
            member,
            scheme
        );

    entries.forEach(function (entry) {

        const ticket =
            entry.ticket ??
            entry.ticketNumber ??
            entry.ticketNo;

        const option =
            document.createElement("option");

        option.value =
            ticket;

        const winner =
            getWinnerForTicket(
                scheme,
                ticket
            );

        option.textContent =
            winner
                ? `Ticket ${ticket} - Winner Month ${winner.month}`
                : `Ticket ${ticket}`;

        select.appendChild(option);

    });

    if (
        currentTicket &&
        Array.from(select.options).some(function (option) {
            return String(option.value) === String(currentTicket);
        })
    ) {
        select.value = currentTicket;
    }
}

function updatePaymentAmountFromBusinessRules() {

    const memberName =
        getValue("paymentMember").trim();

    const schemeName =
        getValue("paymentScheme");

    const month =
        Number(getValue("paymentMonth"));

    const ticket =
        getValue("paymentTicket");

    const amountInput =
        document.getElementById(
            "paymentAmount"
        );

    if (!amountInput) return;

    populatePaymentTickets();

    if (
        !memberName ||
        !schemeName ||
        !ticket ||
        month < 1
    ) {
        amountInput.value = "";
        return;
    }

    const scheme =
        findPaymentSchemeByName(
            schemeName
        );

    const member =
        findPaymentMemberByName(
            memberName
        );

    const amount =
        getCalculatedPaymentAmount(
            scheme,
            member,
            month,
            ticket
        );

    if (amount > 0) {

        amountInput.value =
            amount;

        amountInput.readOnly =
            true;

        amountInput.title =
            "Calculated from chit value and this ticket's winning month.";

    }
}

/* =========================================================
   PAGE LOAD
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadPayments();
        syncInstallmentPaymentRecords();
        loadAdminPayouts();
        syncAdminPayoutRecords();

        populateSchemeFilters();
        populatePaymentMembers();

        /* FINTRACK_SCHEME_QUERY_PREFILL */
        (function () {
            const schemeId = new URLSearchParams(window.location.search).get("schemeId");
            if (!schemeId) return;
            const select = document.getElementById("paymentScheme");
            if (!select) return;
            const schemes = JSON.parse(localStorage.getItem("chitfund_schemes") || "[]");
            const scheme = Array.isArray(schemes)
                ? schemes.find(s => String(s.id) === String(schemeId))
                : null;
            if (!scheme) return;
            const option = Array.from(select.options).find(
                opt => String(opt.value).trim().toLowerCase() === String(scheme.name || "").trim().toLowerCase()
            );
            if (option) {
                select.value = option.value;
                select.dispatchEvent(new Event("change"));
            }
        })();


        refreshPaymentViews();

        loadProfile();

        setDefaultPaymentDate();

        const paymentForm =
            document.getElementById(
                "paymentForm"
            );

        if (paymentForm) {

            paymentForm.addEventListener(
                "submit",
                savePayment
            );

        }

        const paymentSchemeElement = document.getElementById("paymentScheme");
        if (paymentSchemeElement) {
            paymentSchemeElement.addEventListener("input", function () {
                populatePaymentMembers();
                updatePaymentAmountFromBusinessRules();
                updatePaymentDueDateFromBusinessRules();
            });
            paymentSchemeElement.addEventListener("change", function () {
                populatePaymentMembers();
                updatePaymentAmountFromBusinessRules();
                updatePaymentDueDateFromBusinessRules();
            });
        }

        const paymentMemberElement = document.getElementById("paymentMember");
        if (paymentMemberElement) {
            paymentMemberElement.addEventListener("input", function () {
                updatePaymentMemberEmail();
                populatePaymentTickets();
                updatePaymentAmountFromBusinessRules();
                updatePaymentDueDateFromBusinessRules();
            });
            paymentMemberElement.addEventListener("change", function () {
                updatePaymentMemberEmail();
                populatePaymentTickets();
                updatePaymentAmountFromBusinessRules();
                updatePaymentDueDateFromBusinessRules();
            });
        }

        ["paymentTicket", "paymentMonth"].forEach(function (id) {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener("input", function () {
                    updatePaymentAmountFromBusinessRules();
                    updatePaymentDueDateFromBusinessRules();
                });
                element.addEventListener("change", function () {
                    updatePaymentAmountFromBusinessRules();
                    updatePaymentDueDateFromBusinessRules();
                });
            }
        });

    }
);


/* =========================================================
   LOCAL STORAGE
========================================================= */

function loadPayments() {

    const saved =
        localStorage.getItem(
            "chitfund_payments"
        );

    if (!saved) {

        payments = [];

        savePayments();

        return;
    }

    try {

        const parsed =
            JSON.parse(saved);

        if (
            Array.isArray(parsed)
        ) {

            payments = parsed;

        }

    }
    catch (error) {

        console.error(
            "Unable to load payments:",
            error
        );

        payments = [];

    }

}


function savePayments() {

    localStorage.setItem(
        "chitfund_payments",
        JSON.stringify(
            payments
        )
    );

}


/* =========================================================
   REFRESH PAYMENT LEDGER / PENDING FILTER

   Always reload the saved ledger and re-apply the current
   status filter after a payment is recorded. This prevents a
   payment that was changed from Pending -> Paid from remaining
   visible in the Pending list until a manual page refresh.
========================================================= */
function refreshPaymentViews() {

    loadPayments();

    syncInstallmentPaymentRecords();

    const statusFilter = document.getElementById("statusFilter");

    if (statusFilter) {
        filterPayments();
    } else {
        renderPayments();
    }

    renderSummary();
    renderNextDue();
    renderAdminPayouts();
    renderAdminPayoutSummary();
}


/* =========================================================
   RENDER PAYMENTS
========================================================= */

function renderPayments(
    filteredPayments = payments
) {

    /*
     * Show only installments whose due month has arrived. Paid records
     * remain visible even if they were recorded early, preserving history.
     */
    filteredPayments = filteredPayments.filter(function (payment) {
        if (String(payment.status || "").toLowerCase() === "paid") return true;

        const scheme = getStoredSchemesForPayments().find(function (item) {
            return (payment.schemeId != null && item.id != null && String(payment.schemeId) === String(item.id)) ||
                String(payment.scheme || "").trim().toLowerCase() === String(item.name || "").trim().toLowerCase();
        });

        if (!scheme) return true;
        return isInstallmentDueByToday(scheme, Number(payment.month || 0));
    });

    const tbody =
        document.getElementById(
            "paymentTableBody"
        );

    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";

    const count =
        document.getElementById(
            "paymentCount"
        );

    if (count) {

        count.textContent =
            filteredPayments.length;

    }

    if (
        filteredPayments.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td colspan="11">

                    <div class="empty-state">

                        <div class="empty-icon">
                            ₹
                        </div>

                        No payment records found.

                    </div>

                </td>

            </tr>

        `;

        return;
    }

    const sorted =
        [...filteredPayments]
            .sort(
                function (a, b) {

                    return (
                        new Date(
                            a.dueDate
                        ) -
                        new Date(
                            b.dueDate
                        )
                    );

                }
            );

    sorted.forEach(
        function (payment) {

            const row =
                document.createElement(
                    "tr"
                );

            let actionHTML = "";

            /*
             * Pending / overdue payments are dues owed by the member.
             * The admin does NOT pay from this screen; after receiving
             * the member's payment, the admin uses Mark Paid to record it.
             */

            if (
                payment.status ===
                    "pending" ||

                payment.status ===
                    "overdue"
            ) {

                actionHTML += `

                    <button
                        type="button"
                        class="pay-button"
                        onclick="payPayment(${payment.id})">

                        Mark Paid

                    </button>

                `;

            }

            if (String(payment.status || "").toLowerCase() === "paid") {
                actionHTML += `<button type="button" class="edit-button" onclick="printAdminPaymentReceipt(${payment.id})">Print Receipt</button>
`;
            }
            actionHTML += `

                <button
                    type="button"
                    class="edit-button"
                    onclick="editPayment(${payment.id})">

                    Edit

                </button>

                <button
                    type="button"
                    class="delete-button"
                    onclick="deletePayment(${payment.id})">

                    Delete

                </button>

            `;

            row.innerHTML = `

                <!-- MEMBER -->

                <td>

                    <div class="member-name">

                        <strong>

                            ${escapeHTML(
                                payment.member
                            )}

                        </strong>

                        <span>

                            ${escapeHTML(
                                payment.email
                            )}

                        </span>

                    </div>

                </td>


                <!-- TICKET -->

                <td>
                    ${escapeHTML(
                        payment.ticket ?? "-"
                    )}
                </td>


                <!-- SCHEME -->

                <td>

                    <span class="scheme-name">

                        ${escapeHTML(
                            payment.scheme
                        )}

                    </span>

                </td>


                <!-- INSTALLMENT -->

                <td>

                    <span
                        class="installment-badge">

                        M${payment.month}

                    </span>

                </td>


                <!-- DUE DATE -->

                <td>

                    ${formatDate(
                        payment.dueDate
                    )}

                </td>


                <!-- PAYMENT DATE -->

                <td>

                    ${
                        payment.paymentDate
                        ?
                        formatDate(
                            payment.paymentDate
                        )
                        :
                        '<span class="not-available">—</span>'
                    }

                </td>


                <!-- AMOUNT -->

                <td>

                    <span
                        class="
                            payment-amount
                            payment-${escapeHTML(
                                payment.status
                            )}
                        ">

                        ${formatCurrency(
                            payment.amount
                        )}

                    </span>

                </td>


                <!-- METHOD -->

                <td>

                    ${
                        payment.method
                        ?
                        `<span class="payment-method">

                            ${escapeHTML(
                                payment.method
                            )}

                        </span>`
                        :
                        '<span class="not-available">—</span>'
                    }

                </td>


                <!-- TRANSACTION -->

                <td>

                    ${
                        payment.transactionId
                        ?
                        `<span class="transaction-id">

                            ${escapeHTML(
                                payment.transactionId
                            )}

                        </span>`
                        :
                        '<span class="not-available">—</span>'
                    }

                </td>


                <!-- STATUS -->

                <td>

                    <span
                        class="
                            payment-status
                            status-${escapeHTML(
                                payment.status
                            )}
                        ">

                        ${capitalize(
                            payment.status
                        )}

                    </span>

                </td>


                <!-- ACTIONS -->

                <td>

                    ${actionHTML}

                </td>

            `;

            tbody.appendChild(
                row
            );

        }
    );

}


/* =========================================================
   ADMIN PAYOUT LEDGER

   Member installments and admin-to-member winner payouts are
   intentionally stored separately. The admin receives member
   installments through the payment ledger, while this ledger
   records money/gold paid by the admin to monthly winners.
========================================================= */

function loadAdminPayouts() {
    try {
        const saved = JSON.parse(localStorage.getItem("chitfund_admin_payouts") || "[]");
        adminPayouts = Array.isArray(saved) ? saved : [];
    } catch (error) {
        console.error("Unable to load admin payout ledger:", error);
        adminPayouts = [];
    }
}

function saveAdminPayouts() {
    localStorage.setItem("chitfund_admin_payouts", JSON.stringify(adminPayouts));
}

function getStoredWinnerRecordsForPayments() {
    try {
        const data = JSON.parse(localStorage.getItem("chitfund_winners") || "[]");
        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}


function getAdminPayoutScheme(record) {
    const schemes = getStoredSchemesForPayments();
    return schemes.find(function (scheme) {
        return String(scheme.id) === String(record.schemeId) ||
            String(scheme.name || "").trim().toLowerCase() === String(record.scheme || "").trim().toLowerCase();
    }) || null;
}

function calculateAdminWinnerPayout(scheme, winner) {
    if (!scheme || !winner) return { amount: 0, goldGrams: 0 };

    const type = String(scheme.type || "cash").toLowerCase();
    const month = Number(winner.month || 0);

    if (type === "gold") {
        const nameMatch = String(scheme.name || "").match(/(\d+(?:\.\d+)?)\s*(?:grams?|g)\b/i);
        const grams = Number(winner.goldGrams || scheme.goldGrams || (nameMatch ? nameMatch[1] : 0) || 0);
        return { amount: 0, goldGrams: grams };
    }

    const total = Number(scheme.totalAmount || 0);
    if (total <= 0 || month < 1) return { amount: 0, goldGrams: 0 };

    return {
        amount: Math.round(total * (0.95 + ((month - 1) * 0.01))),
        goldGrams: 0
    };
}

function adminPayoutKey(type, record) {
    return `${type}:${record.schemeId ?? record.scheme ?? ""}:${record.id ?? `${record.month ?? ""}:${record.ticket ?? ""}`}`;
}

function syncAdminPayoutRecords() {
    const winners = getStoredWinnerRecordsForPayments().filter(function (record) {
        return String(record.status || "winner").toLowerCase() === "winner";
    });
    const settlements = [];
    let changed = false;
    const activeKeys = new Set();

    winners.forEach(function (winner) {
        const scheme = getAdminPayoutScheme(winner);
        if (!scheme) return;

        const key = adminPayoutKey("winner", winner);
        activeKeys.add(key);
        const calculated = calculateAdminWinnerPayout(scheme, winner);
        let existing = adminPayouts.find(function (item) { return item.key === key; });

        if (!existing) {
            existing = {
                id: `WP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                key: key,
                source: "winner",
                winnerId: winner.id,
                schemeId: scheme.id,
                scheme: scheme.name,
                month: Number(winner.month || 0),
                ticket: String(winner.ticket ?? winner.ticketNumber ?? ""),
                memberId: winner.memberId ?? null,
                memberName: winner.memberName || "Member",
                type: String(scheme.type || "cash").toLowerCase() === "gold" ? "gold" : "cash",
                amount: calculated.amount,
                goldGrams: calculated.goldGrams,
                status: String(winner.payoutStatus || "pending").toLowerCase() === "paid" ? "paid" : "pending",
                paidDate: winner.payoutPaidDate || "",
                method: winner.payoutMethod || "",
                transactionId: winner.payoutTransactionId || "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            adminPayouts.push(existing);
            changed = true;
        } else if (existing.status !== "paid") {
            const updates = {
                schemeId: scheme.id,
                scheme: scheme.name,
                month: Number(winner.month || 0),
                ticket: String(winner.ticket ?? winner.ticketNumber ?? ""),
                memberId: winner.memberId ?? existing.memberId ?? null,
                memberName: winner.memberName || existing.memberName || "Member",
                type: String(scheme.type || "cash").toLowerCase() === "gold" ? "gold" : "cash",
                amount: calculated.amount,
                goldGrams: calculated.goldGrams,
                updatedAt: new Date().toISOString()
            };
            Object.keys(updates).forEach(function (field) {
                if (existing[field] !== updates[field]) { existing[field] = updates[field]; changed = true; }
            });
        }
    });

    // Remove only pending orphaned winner payouts. Paid history is retained.
    const before = adminPayouts.length;
    adminPayouts = adminPayouts.filter(function (item) {
        return item.status === "paid" || item.source !== "winner" || activeKeys.has(item.key);
    });
    if (adminPayouts.length !== before) changed = true;

    if (changed) saveAdminPayouts();
}

function renderAdminPayoutSummary() {
    const pending = adminPayouts.filter(function (item) { return item.status === "pending"; });
    const paid = adminPayouts.filter(function (item) { return item.status === "paid"; });
    const cashPending = pending.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0);
    const cashPaid = paid.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0);

    setText("adminPayoutPending", formatCurrency(cashPending));
    setText("adminPayoutPaid", formatCurrency(cashPaid));
    setText("adminPayoutCount", adminPayouts.length);
}

function getMemberForAdminPayout(item) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem("chitfund_members") || "[]"); } catch (e) { list = []; }
    if (!Array.isArray(list)) list = [];
    return list.find(function (member) {
        return (item.memberId != null && String(member.id) === String(item.memberId)) ||
            (item.memberId != null && String(member.memberId || "") === String(item.memberId)) ||
            (item.memberName && String(member.name || "").trim().toLowerCase() === String(item.memberName || "").trim().toLowerCase());
    }) || null;
}

function adminPayoutDetailsHTML(item) {
    const member = getMemberForAdminPayout(item);
    const d = member && member.payoutDetails ? member.payoutDetails : {};
    const values = [d.holderName, d.bankName, d.accountNumber, d.ifsc, d.upiId, d.phonePeNumber, d.qrCode];
    const hasDetails = values.some(function (v) { return String(v || "").trim() !== ""; });
    if (!hasDetails) return '<span class="payout-details-missing">Not provided</span>';
    const safe = function (v) { return escapeHTML(String(v || "")); };
    return `<details class="admin-payout-details"><summary>View details</summary>
      <div class="payout-details-box">
        ${d.holderName ? `<div><b>Holder:</b> ${safe(d.holderName)}</div>` : ""}
        ${d.bankName ? `<div><b>Bank:</b> ${safe(d.bankName)}</div>` : ""}
        ${d.accountNumber ? `<div><b>Account:</b> ${safe(d.accountNumber)}</div>` : ""}
        ${d.ifsc ? `<div><b>IFSC:</b> ${safe(d.ifsc)}</div>` : ""}
        ${d.upiId ? `<div><b>UPI:</b> ${safe(d.upiId)}</div>` : ""}
        ${d.phonePeNumber ? `<div><b>PhonePe:</b> ${safe(d.phonePeNumber)}</div>` : ""}
        ${d.qrCode ? `<div><b>QR:</b><br><img src="${safe(d.qrCode)}" alt="Member payout QR" class="admin-payout-qr"></div>` : ""}
      </div></details>`;
}

function renderAdminPayouts() {
    const tbody = document.getElementById("adminPayoutTableBody");
    if (!tbody) return;

    const records = [...adminPayouts].sort(function (a, b) {
        if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
        return Number(a.month || 0) - Number(b.month || 0);
    });

    if (!records.length) {
        tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state">No admin payout records yet. Record a monthly winner in Scheme Details to create a payout due.</div></td></tr>`;
        return;
    }

    tbody.innerHTML = records.map(function (item) {
        const isGold = item.type === "gold";
        const payoutText = isGold
            ? `${Number(item.goldGrams || 0)} gram${Number(item.goldGrams || 0) === 1 ? "" : "s"}`
            : formatCurrency(item.amount);
        const sourceText = `Winner • Month ${item.month}`;
        const action = item.status === "pending"
            ? `<button type="button" class="payout-action-button" onclick="recordAdminPayout('${escapeHTML(String(item.id))}')">${isGold ? "Record Gold Payout" : "Pay Winner"}</button>`
            : `<span class="payout-paid-label">Paid${item.paidDate ? ` • ${escapeHTML(formatDate(item.paidDate))}` : ""}</span>`;

        return `<tr>
            <td><strong>${escapeHTML(item.memberName || "Member")}</strong></td>
            <td>${escapeHTML(String(item.ticket || "-"))}</td>
            <td>${escapeHTML(item.scheme || "-")}</td>
            <td>${escapeHTML(sourceText)}</td>
            <td><strong>${escapeHTML(payoutText)}</strong></td>
            <td>${escapeHTML(item.type === "gold" ? "Gold" : "Cash")}</td>
            <td>${adminPayoutDetailsHTML(item)}</td>
            <td><span class="payout-status payout-${escapeHTML(item.status)}">${capitalize(item.status)}</span></td>
            <td>${item.transactionId ? escapeHTML(item.transactionId) : "—"}</td>
            <td>${action}</td>
        </tr>`;
    }).join("");
}

function recordAdminPayout(id) {
    const payout = adminPayouts.find(function (item) { return String(item.id) === String(id); });
    if (!payout) { alert("Admin payout record not found."); return; }
    if (payout.status === "paid") { alert("This payout is already marked as paid."); return; }

    const isGold = payout.type === "gold";
    const amountText = isGold
        ? `${Number(payout.goldGrams || 0)} gram${Number(payout.goldGrams || 0) === 1 ? "" : "s"} of gold`
        : formatCurrency(payout.amount);

    const confirmed = confirm(
        `Admin payout\n\nMember: ${payout.memberName}\nTicket: ${payout.ticket}\n` +
        `Scheme: ${payout.scheme}\nMonth: ${payout.month}\nPayout: ${amountText}\n\n` +
        `Confirm that the admin has paid/handed over this payout to the member?`
    );
    if (!confirmed) return;

    let method = isGold ? "Gold Handover" : prompt("Enter payout method (UPI / Bank Transfer / Cash):", "Bank Transfer");
    if (method === null) return;
    method = String(method || "").trim();
    if (!method) { alert("Payout method is required."); return; }

    const referenceLabel = isGold ? "Enter gold handover / receipt reference (required):" : "Enter the real UTR / transaction reference (required):";
    const reference = prompt(referenceLabel);
    if (!reference || !reference.trim()) {
        alert("Payout was not recorded because a reference is required.");
        return;
    }

    const paidDate = new Date().toISOString().split("T")[0];
    payout.status = "paid";
    payout.paidDate = paidDate;
    payout.method = method;
    payout.transactionId = reference.trim();
    payout.updatedAt = new Date().toISOString();

    if (payout.source === "winner") {
        const winners = getStoredWinnerRecordsForPayments();
        const winner = winners.find(function (item) {
            return String(item.id) === String(payout.winnerId);
        });
        if (winner) {
            winner.payoutStatus = "paid";
            winner.payoutPaidDate = paidDate;
            winner.payoutMethod = method;
            winner.payoutTransactionId = reference.trim();
            winner.updatedAt = new Date().toISOString();
            localStorage.setItem("chitfund_winners", JSON.stringify(winners));
        }
    }

    saveAdminPayouts();
    renderAdminPayouts();
    renderAdminPayoutSummary();
    alert(isGold ? "Gold payout recorded successfully." : "Winner payout recorded successfully.");
}

/* =========================================================
   SUMMARY
========================================================= */

function renderSummary() {

    const totalPaid =
        payments
            .filter(
                function (payment) {

                    return (
                        payment.status ===
                        "paid"
                    );

                }
            )
            .reduce(
                function (
                    total,
                    payment
                ) {

                    return (
                        total +
                        Number(
                            payment.amount ||
                            0
                        )
                    );

                },
                0
            );


    const totalPending =
        payments
            .filter(
                function (payment) {

                    return (
                        payment.status ===
                        "pending"
                    );

                }
            )
            .reduce(
                function (
                    total,
                    payment
                ) {

                    return (
                        total +
                        Number(
                            payment.amount ||
                            0
                        )
                    );

                },
                0
            );


    const totalOverdue =
        payments
            .filter(
                function (payment) {

                    return (
                        payment.status ===
                        "overdue"
                    );

                }
            )
            .reduce(
                function (
                    total,
                    payment
                ) {

                    return (
                        total +
                        Number(
                            payment.amount ||
                            0
                        )
                    );

                },
                0
            );


    const totalPaidElement =
        document.getElementById(
            "totalPaid"
        );


    const totalPendingElement =
        document.getElementById(
            "totalPending"
        );


    const totalOverdueElement =
        document.getElementById(
            "totalOverdue"
        );


    const totalRecordsElement =
        document.getElementById(
            "totalRecords"
        );


    if (totalPaidElement) {

        totalPaidElement.textContent =
            formatCurrency(
                totalPaid
            );

    }


    if (totalPendingElement) {

        totalPendingElement.textContent =
            formatCurrency(
                totalPending
            );

    }


    if (totalOverdueElement) {

        totalOverdueElement.textContent =
            formatCurrency(
                totalOverdue
            );

    }


    if (totalRecordsElement) {

        totalRecordsElement.textContent =
            payments.length;

    }

}


/* =========================================================
   NEXT PAYMENT DUE
========================================================= */

function renderNextDue() {

    const dues =
        payments
            .filter(
                function (payment) {

                    return (
                        payment.status ===
                            "pending" ||

                        payment.status ===
                            "overdue"
                    );

                }
            )
            .sort(
                function (a, b) {

                    return (
                        new Date(
                            a.dueDate
                        ) -
                        new Date(
                            b.dueDate
                        )
                    );

                }
            );


    const schemeElement =
        document.getElementById(
            "nextDueScheme"
        );


    const dateElement =
        document.getElementById(
            "nextDueDate"
        );


    const monthElement =
        document.getElementById(
            "nextDueMonth"
        );


    const amountElement =
        document.getElementById(
            "nextDueAmount"
        );



    if (
        dues.length === 0
    ) {

        if (schemeElement) {

            schemeElement.textContent =
                "No pending payments";

        }


        if (dateElement) {

            dateElement.textContent =
                "All payments are up to date.";

        }


        if (monthElement) {

            monthElement.textContent =
                "-";

        }


        if (amountElement) {

            amountElement.textContent =
                "₹0";

        }



        return;

    }


    const due =
        dues[0];


    if (schemeElement) {

        schemeElement.textContent =
            due.scheme;

    }


    if (dateElement) {

        dateElement.textContent =
            `${due.member} • Due ${formatDate(
                due.dueDate
            )}`;

    }


    if (monthElement) {

        monthElement.textContent =
            `Month ${due.month}`;

    }


    if (amountElement) {

        amountElement.textContent =
            formatCurrency(
                due.amount
            );

    }


}


/* =========================================================
   SCHEME LIST
========================================================= */

function getSchemes() {

    const schemes = [];


    /*
     * Get schemes from payment records.
     */

    payments.forEach(
        function (payment) {

            if (
                payment.scheme &&
                !schemes.includes(
                    payment.scheme
                )
            ) {

                schemes.push(
                    payment.scheme
                );

            }

        }
    );


    /*
     * Also read schemes
     * created by schemes.html.
     */

    const saved =
        localStorage.getItem(
            "chitfund_schemes"
        );


    if (saved) {

        try {

            const storedSchemes =
                JSON.parse(
                    saved
                );


            if (
                Array.isArray(
                    storedSchemes
                )
            ) {

                storedSchemes.forEach(
                    function (scheme) {

                        const name =
                            scheme.name ||
                            scheme.chit_name;


                        if (
                            name &&
                            !schemes.includes(
                                name
                            )
                        ) {

                            schemes.push(
                                name
                            );

                        }

                    }
                );

            }

        }
        catch (error) {

            console.error(
                "Unable to load schemes:",
                error
            );

        }

    }


    return schemes;

}


/* =========================================================
   POPULATE SCHEME FILTER
========================================================= */

function populateSchemeFilters() {

    const filter =
        document.getElementById(
            "schemeFilter"
        );


    const formSelect =
        document.getElementById(
            "paymentScheme"
        );


    const schemes =
        getSchemes();


    if (filter) {

        filter.innerHTML = `

            <option value="all">
                All Schemes
            </option>

        `;

    }


    if (formSelect) {

        formSelect.innerHTML = `

            <option value="">
                Select Chit Scheme
            </option>

        `;

    }


    schemes.forEach(
        function (scheme) {

            if (filter) {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    scheme;

                option.textContent =
                    scheme;

                filter.appendChild(
                    option
                );

            }


            if (formSelect) {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    scheme;

                option.textContent =
                    scheme;

                formSelect.appendChild(
                    option
                );

            }

        }
    );

}


/* =========================================================
   FILTER PAYMENTS
========================================================= */

function filterPayments() {

    const searchElement =
        document.getElementById(
            "paymentSearch"
        );


    const schemeElement =
        document.getElementById(
            "schemeFilter"
        );


    const statusElement =
        document.getElementById(
            "statusFilter"
        );


    const search =
        searchElement
            ?
            searchElement.value
                .trim()
                .toLowerCase()
            :
            "";


    const scheme =
        schemeElement
            ?
            schemeElement.value
            :
            "all";


    const status =
        statusElement
            ?
            statusElement.value
            :
            "all";


    const filtered =
        payments.filter(
            function (payment) {

                const searchableText = `

                    ${payment.member}

                    ${payment.email}

                    ${payment.scheme}

                    ${payment.transactionId}

                `
                    .toLowerCase();


                const matchesSearch =
                    searchableText.includes(
                        search
                    );


                const matchesScheme =
                    scheme === "all" ||
                    payment.scheme ===
                    scheme;


                const matchesStatus =
                    status === "all" ||
                    payment.status ===
                    status;


                return (
                    matchesSearch &&
                    matchesScheme &&
                    matchesStatus
                );

            }
        );


    renderPayments(
        filtered
    );

}


/* =========================================================
   ADD PAYMENT MODAL
========================================================= */

function openAddPaymentModal() {

    const modalTitle =
        document.getElementById(
            "modalTitle"
        );


    const form =
        document.getElementById(
            "paymentForm"
        );


    const paymentId =
        document.getElementById(
            "paymentId"
        );


    const paymentStatus =
        document.getElementById(
            "paymentStatus"
        );


    const modal =
        document.getElementById(
            "paymentModal"
        );


    if (modalTitle) {

        modalTitle.textContent =
            "Add Payment";

    }


    if (form) {

        form.reset();

    }

    // Member list is dependent on the selected chit scheme.
    populatePaymentMembers();


    if (paymentId) {

        paymentId.value =
            "";

    }


    if (paymentStatus) {

        paymentStatus.value =
            "paid";

    }


    /*
     * Do NOT set paymentMonth to a date.
     *
     * paymentMonth is a numeric installment
     * field: 1, 2, 3, etc.
     */

    setDefaultPaymentDate();


    if (modal) {

        modal.classList.add(
            "active"
        );

    }

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closePaymentModal() {

    const modal =
        document.getElementById(
            "paymentModal"
        );


    if (modal) {

        modal.classList.remove(
            "active"
        );

    }

}


/* =========================================================
   SAVE PAYMENT
========================================================= */

function savePayment(
    event
) {

    if (event) {

        event.preventDefault();

    }


    const id =
        getValue(
            "paymentId"
        );


    const member =
        getValue(
            "paymentMember"
        ).trim();


    const email =
        getValue(
            "paymentEmail"
        ).trim();


    const scheme =
        getValue(
            "paymentScheme"
        );

    const ticket =
        getValue(
            "paymentTicket"
        ).trim();


    /*
     * paymentMonth is a NUMBER.
     */

    const month =
        Number(
            getValue(
                "paymentMonth"
            )
        );


    const selectedPaymentScheme = findPaymentSchemeByName(scheme);
    const selectedPaymentMember = findPaymentMemberByName(member);

    const calculatedDueDate = getPaymentDueDateForScheme(
        selectedPaymentScheme,
        month
    );

    const dueDate = calculatedDueDate || getValue("paymentDueDate");


    const paymentDate =
        getValue(
            "paymentDate"
        );


    const amount =
        Number(
            getValue(
                "paymentAmount"
            )
        );

    const calculatedAmount = getCalculatedPaymentAmount(selectedPaymentScheme, selectedPaymentMember, month, ticket);
    const finalAmount = calculatedAmount > 0 ? calculatedAmount : amount;


    const method =
        getValue(
            "paymentMethod"
        );


    const transactionId =
        getValue(
            "transactionId"
        ).trim();


    const status =
        getValue(
            "paymentStatus"
        );


    /* =====================================================
       VALIDATION
    ====================================================== */

    if (!member) {

        alert(
            "Please enter member name."
        );

        return;

    }


    if (!scheme) {

        alert(
            "Please select a chit scheme."
        );

        return;

    }

    if (!ticket) {

        alert(
            "Please select a chit ticket."
        );

        return;

    }


    if (
        month < 1
    ) {

        alert(
            "Installment month must be greater than 0."
        );

        return;

    }


    if (!dueDate) {

        alert(
            "Please select due date."
        );

        return;

    }


    if (
        finalAmount <= 0
    ) {

        alert(
            "Payment amount must be greater than 0."
        );

        return;

    }


    /*
     * Paid payments should have
     * a payment date.
     */

    if (
        status === "paid" &&
        !paymentDate
    ) {

        alert(
            "Please enter payment date for a paid payment."
        );

        return;

    }


    /* =====================================================
       VALIDATE DUPLICATE INSTALLMENT
       One member + scheme + ticket + installment can have
       only one record. The current record is ignored while editing.
    ====================================================== */

    const paymentBusinessKey = typeof window.fintrackPaymentKey === "function"
        ? window.fintrackPaymentKey(selectedPaymentMember?.id, selectedPaymentScheme?.id, ticket, month)
        : [selectedPaymentMember?.id, selectedPaymentScheme?.id, ticket, month].join("|");
    const duplicatePayment = payments.find(function (item) {
        if (Number(item.id) === Number(id || 0)) return false;
        const itemKey = item.paymentKey || (typeof window.fintrackPaymentKey === "function"
            ? window.fintrackPaymentKey(item.memberId, item.schemeId, item.ticket, item.month)
            : [item.memberId, item.schemeId, item.ticket, item.month].join("|"));
        return String(itemKey) === String(paymentBusinessKey);
    });

    if (duplicatePayment) {
        alert(`A payment already exists for ${member}, ${scheme}, installment M${month}.`);
        return;
    }

    /* The admin must record an existing member and scheme. */
    if (!selectedPaymentScheme) {
        alert("Selected chit scheme was not found.");
        return;
    }

    if (!selectedPaymentMember) {
        alert("Member was not found in the Member Directory. Please select an existing member.");
        return;
    }

    const existingIndex = payments.findIndex(function (item) {
        return Number(item.id) === Number(id);
    });

    const existingPayment = existingIndex >= 0
        ? payments[existingIndex]
        : null;

    /* =====================================================
       BUILD COMPLETE ADMIN PAYMENT RECEIPT
       This is the record of money received by the admin from
       the member. It is stored in chitfund_payments.
    ====================================================== */

    const paymentRecord = {
        id: existingPayment
            ? existingPayment.id
            : generatePaymentId(),

        memberId: selectedPaymentMember.id ?? null,
        member: member,
        email: email || selectedPaymentMember.email || "",

        schemeId: selectedPaymentScheme.id ?? null,
        scheme: selectedPaymentScheme.name || scheme,

        ticket: ticket,
        month: month,
        paymentKey: paymentBusinessKey,
        dueDate: dueDate,

        amount: finalAmount,
        paymentDate: paymentDate || "",
        method: method,
        transactionId: transactionId,
        status: paymentDate ? "paid" : "pending",

        receivedByAdmin: Boolean(paymentDate),
        receivedAt: paymentDate
            ? (paymentDate || new Date().toISOString().split("T")[0])
            : "",

        createdAt: existingPayment?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    /* Gold Chit: quantity comes from the scheme (for example 10 or 20 grams);
       the rupee amount is the admin-entered monthly amount. */
    try {
        applyGoldChitMonthlyAmount(
            paymentRecord,
            selectedPaymentScheme,
            finalAmount
        );
    } catch (error) {
        alert(error.message);
        return;
    }

    if (existingIndex >= 0) {
        payments[existingIndex] = paymentRecord;
    } else {
        payments.push(paymentRecord);
    }

    if (typeof window.fintrackAudit === "function") window.fintrackAudit(existingIndex >= 0 ? "payment.updated" : "payment.created", existingIndex >= 0 ? "Payment receipt updated" : "Payment receipt created", {paymentId: paymentRecord.id, memberId: paymentRecord.memberId, schemeId: paymentRecord.schemeId, ticket: paymentRecord.ticket, month: paymentRecord.month, amount: paymentRecord.amount, status: paymentRecord.status});

    savePayments();

    populateSchemeFilters();
    refreshPaymentViews();
    closePaymentModal();

    alert(
        existingPayment
            ? "Payment record updated successfully."
            : "Payment received and recorded successfully."
    );

}


/* =========================================================
   PAY PAYMENT
========================================================= */

function payPayment(
    id
) {

    const payment =
        payments.find(
            function (item) {

                return (
                    Number(item.id) ===
                    Number(id)
                );

            }
        );


    if (!payment) {

        alert(
            "Payment record not found."
        );

        return;

    }


    /*
     * This frontend cannot verify a real bank/UPI transaction.
     * Record a payment only after the operator explicitly confirms it.
     */

    const confirmed = confirm(
        `Record ${formatCurrency(payment.amount)} as paid for ${payment.member}?\n\n` +
        `This is a manual record only; no bank/UPI transaction is performed by this demo.`
    );

    if (!confirmed) return;

    const transactionId = prompt(
        "Enter the real payment/UTR reference (required):"
    );

    if (!transactionId || !transactionId.trim()) {
        alert("Payment was not recorded because a transaction/UTR reference is required.");
        return;
    }

    payment.status = "paid";
    payment.paymentDate = new Date().toISOString().split("T")[0];
    payment.method = "Manual UPI / Bank";
    payment.transactionId = transactionId.trim();
    payment.receivedByAdmin = true;
    payment.receivedAt = payment.paymentDate;
    payment.updatedAt = new Date().toISOString();


    /* Keep the real UTR / transaction reference entered by the admin.
       Do not replace it with a generated value. */

    savePayments();
    if (typeof window.fintrackAudit === "function") {
        window.fintrackAudit("payment.paid", "Payment marked as paid", { paymentId: payment.id, memberId: payment.memberId, schemeId: payment.schemeId, ticket: payment.ticket, month: payment.month, amount: payment.amount, method: payment.method, transactionId: payment.transactionId });
    }

    refreshPaymentViews();

    alert(
        "Payment marked as paid successfully. It has been removed from Pending and moved to Paid."
    );

}


/* =========================================================
   EDIT PAYMENT
========================================================= */

function editPayment(
    id
) {

    const payment =
        payments.find(
            function (item) {

                return (
                    Number(item.id) ===
                    Number(id)
                );

            }
        );


    if (!payment) {

        alert(
            "Payment not found."
        );

        return;

    }


    setText(
        "modalTitle",
        "Edit Payment"
    );


    setValue(
        "paymentId",
        payment.id
    );


    setValue(
        "paymentMember",
        payment.member
    );


    setValue(
        "paymentEmail",
        payment.email
    );


    populateSchemeFilters();


    setValue(
        "paymentScheme",
        payment.scheme
    );

    populatePaymentTickets();

    setValue(
        "paymentTicket",
        payment.ticket || ""
    );


    /*
     * payment.month is numeric.
     */

    setValue(
        "paymentMonth",
        payment.month
    );


    setValue(
        "paymentDueDate",
        payment.dueDate
    );


    setValue(
        "paymentDate",
        payment.paymentDate
    );


    setValue(
        "paymentAmount",
        payment.amount
    );


    setValue(
        "paymentMethod",
        payment.method
    );


    setValue(
        "transactionId",
        payment.transactionId
    );


    setValue(
        "paymentStatus",
        payment.status
    );


    const modal =
        document.getElementById(
            "paymentModal"
        );


    if (modal) {

        modal.classList.add(
            "active"
        );

    }

}


/* =========================================================
   DELETE PAYMENT
========================================================= */

function deletePayment(
    id
) {

    const payment =
        payments.find(
            function (item) {

                return (
                    Number(item.id) ===
                    Number(id)
                );

            }
        );


    if (!payment) {

        return;

    }


    const confirmed =
        confirm(
            `Delete payment record for ${payment.member}?`
        );


    if (!confirmed) {

        return;

    }


    payments =
        payments.filter(
            function (item) {

                return (
                    Number(item.id) !==
                    Number(id)
                );

            }
        );


    savePayments();
    if (typeof window.fintrackAudit === "function") {
        window.fintrackAudit("payment.deleted", "Payment deleted", { paymentId: payment.id, memberId: payment.memberId, schemeId: payment.schemeId, ticket: payment.ticket, month: payment.month });
    }

    refreshPaymentViews();

    alert(
        "Payment deleted successfully."
    );

}


/* =========================================================
   REFRESH
========================================================= */

function paymentMemberPhone(payment){
    const rows=JSON.parse(localStorage.getItem("chitfund_members")||"[]");
    const m=rows.find(x=>String(x.id)===String(payment?.memberId));
    return String(payment?.phone||m?.phone||"").replace(/\D/g,"");
}
function printAdminPaymentReceipt(id){
    const p=payments.find(x=>String(x.id)===String(id)); if(!p||String(p.status||"").toLowerCase()!=="paid"){alert("Receipt is available only for paid installments.");return;}
    const e=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>FinTrack Payment Receipt</title><style>body{font-family:Arial;margin:0;padding:32px;background:#f4f6f8}.receipt{max-width:720px;margin:auto;background:#fff;padding:36px;border:1px solid #ddd;border-radius:12px}.brand{font-size:26px;font-weight:800}.sub{color:#667085}.title{text-align:center;margin:28px 0;font-size:22px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;border-block:1px solid #eee;padding:20px 0}.item span{display:block;color:#667085;font-size:12px;margin-bottom:5px}.amount{text-align:center;font-size:28px;font-weight:800;margin:24px 0}@media print{body{background:#fff;padding:0}.receipt{border:0;max-width:none}}</style></head><body><div class="receipt"><div class="brand">FinTrack</div><div class="sub">Chit Fund Payment Receipt</div><div class="title">PAYMENT RECEIPT</div><div class="grid"><div class="item"><span>Member</span><b>${e(p.member||"Member")}</b></div><div class="item"><span>Ticket</span><b>#${e(p.ticket||"—")}</b></div><div class="item"><span>Scheme</span><b>${e(p.scheme||"—")}</b></div><div class="item"><span>Installment</span><b>Month ${e(p.month||"—")}</b></div><div class="item"><span>Payment Date</span><b>${e(p.paymentDate||"—")}</b></div><div class="item"><span>UTR</span><b>${e(p.transactionId||"—")}</b></div></div><div class="amount">${formatCurrency(p.amount)}</div><div style="text-align:center"><b>PAID</b></div></div><script>window.onload=function(){window.print()}<\/script></body></html>`;
    const w=window.open("","_blank","width=820,height=900");if(!w){alert("Please allow pop-ups.");return;}w.document.write(html);w.document.close();
}

window.addEventListener("storage",function(e){
    if(e.key==="chitfund_payments"||e.key==="chitfund_online_payment_requests"){
        clearTimeout(window.__fintrackPaymentRefresh);
        window.__fintrackPaymentRefresh=setTimeout(()=>{if(typeof refreshPayments==="function")refreshPayments();},50);
    }
});

function refreshPayments() {

    populateSchemeFilters();

    refreshPaymentViews();

}


/* =========================================================
   GENERATE PAYMENT ID
========================================================= */

function generatePaymentId() {

    if (
        payments.length === 0
    ) {

        return 1;

    }


    return (
        Math.max(
            ...payments.map(
                function (payment) {

                    return Number(
                        payment.id
                    );

                }
            )
        ) + 1
    );

}


/* =========================================================
   TRANSACTION ID
========================================================= */

function generateTransactionId() {

    const random =
        Math.floor(
            100000 +
            Math.random() *
            900000
        );


    return `TXN${random}`;

}


/* =========================================================
   DEFAULT PAYMENT DATE
========================================================= */

function setDefaultPaymentDate() {

    const input =
        document.getElementById(
            "paymentDate"
        );


    if (
        input &&
        !input.value
    ) {

        input.value =
            new Date()
                .toISOString()
                .split("T")[0];

    }

}


/* =========================================================
   PROFILE
========================================================= */

function loadProfile() {

    const saved =
        localStorage.getItem(
            "fintrackUser"
        );


    if (!saved) {

        return;

    }


    try {

        const user =
            JSON.parse(
                saved
            );


        const name =
            user.fullName ||
            user.name ||
            user.username ||
            "User";


        const profileName =
            document.getElementById(
                "profileName"
            );


        const profileAvatar =
            document.getElementById(
                "profileAvatar"
            );


        if (profileName) {

            profileName.textContent =
                name;

        }


        if (profileAvatar) {
            if (user.profilePhoto) {
                profileAvatar.style.backgroundImage =
                    `url("${user.profilePhoto}")`;
                profileAvatar.style.backgroundSize = "cover";
                profileAvatar.style.backgroundPosition = "center";
                profileAvatar.style.backgroundRepeat = "no-repeat";
                profileAvatar.textContent = "";
            } else {
                profileAvatar.style.backgroundImage = "";
                profileAvatar.textContent =
                    name.charAt(0).toUpperCase();
            }
        }

    }
    catch (error) {

        console.error(
            "Profile error:",
            error
        );

    }

}



/* =========================================================
   FORMAT CURRENCY
========================================================= */

function formatCurrency(
    amount
) {

    return new Intl.NumberFormat(
        "en-IN",
        {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    ).format(
        Number(
            amount || 0
        )
    );

}


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(
    value
) {

    if (!value) {

        return "-";

    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;

    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


/* =========================================================
   CAPITALIZE
========================================================= */

function capitalize(
    value
) {

    if (!value) {

        return "";

    }


    return (
        value
            .charAt(0)
            .toUpperCase() +
        value
            .slice(1)
    );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   SIMPLE DOM HELPERS
========================================================= */

function getValue(
    id
) {

    const element =
        document.getElementById(
            id
        );


    return element
        ? element.value
        : "";

}


function setValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.value =
            value ?? "";

    }

}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value ?? "";

    }

}


/* =========================================================
   CLOSE MODAL ON OUTSIDE CLICK
========================================================= */

document.addEventListener(
    "click",
    function (event) {

        const modal =
            document.getElementById(
                "paymentModal"
            );


        if (
            modal &&
            event.target === modal
        ) {

            closePaymentModal();

        }

    }
);


/* =========================================================
   ESCAPE KEY
========================================================= */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key ===
            "Escape"
        ) {

            closePaymentModal();

        }

    }
);


// Gold chit quantity comes from the scheme; Admin enters the monthly rupee amount.
function applyGoldChitMonthlyAmount(payment, scheme, enteredAmount) {
    if (typeof window.isGoldChit === "function" && window.isGoldChit(scheme)) {
        const amount = Number(enteredAmount);
        if (!Number.isFinite(amount) || amount < 0) {
            throw new Error("Admin must enter a valid monthly gold chit amount.");
        }
        const storedGrams = Number(scheme.goldGrams || 0);
        const nameMatch = String(scheme.name || "").match(/(\d+(?:\.\d+)?)\s*(?:grams?|g)\b/i);
        payment.goldGrams = storedGrams > 0 ? storedGrams : (nameMatch ? Number(nameMatch[1]) : 0);
        payment.goldMonthlyAmount = amount;
        payment.amount = amount;
    }
    return payment;
}

window.getPaymentDueDateForScheme = getPaymentDueDateForScheme;
window.syncInstallmentPaymentRecords = syncInstallmentPaymentRecords;
window.syncAdminPayoutRecords = syncAdminPayoutRecords;
window.recordAdminPayout = recordAdminPayout;
