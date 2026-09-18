"use strict";

/* =========================================================
   FINTRACK - SCHEMES
   ========================================================= */

let schemes = [];

/* =========================================================
   DEFAULT SCHEMES
   ========================================================= */

/* =========================================================
   PAGE LOAD
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {
        loadSchemes();

        syncSchemeMemberCounts();

        renderSchemes();

        const editFromQuery = new URLSearchParams(window.location.search).get("editSchemeId");
        if (editFromQuery) {
            setTimeout(function () { openEditSchemeModal(editFromQuery); }, 0);
        }

        setDefaultSchemeDate();

        loadProfile();

        const amountInput =
            document.getElementById("schemeAmount");

        const baseInput =
            document.getElementById("schemeBaseAmount");

        const typeInput =
            document.getElementById("schemeType");

        if (amountInput && baseInput && typeInput) {
            function updateAmountFields() {
                const isGold =
                    String(typeInput.value || "").toLowerCase() === "gold";

                const amountGroup =
                    document.getElementById("totalAmountGroup");
                const amountLabel =
                    document.getElementById("totalAmountLabel");

                if (isGold) {
                    // Gold chit: total chit value is not required.
                    // Admin enters only the monthly rupee amount.
                    if (amountGroup) amountGroup.style.display = "none";
                    amountInput.required = false;
                    amountInput.disabled = true;
                    amountInput.value = "";

                    baseInput.readOnly = false;
                    baseInput.required = false;
                    baseInput.placeholder = "Set monthly amount in Scheme Details";
                } else {
                    amountGroup.style.display = "";
                    amountLabel.textContent = "Total Amount";
                    amountInput.disabled = false;
                    amountInput.required = true;
                    baseInput.readOnly = true;
                    baseInput.required = false;
                    baseInput.placeholder = "5000";

                    const amount = Number(amountInput.value || 0);
                    baseInput.value =
                        amount > 0
                            ? calculateNormalPayment(amount)
                            : "";
                }
            }

            typeInput.addEventListener("change", updateAmountFields);
            amountInput.addEventListener("input", updateAmountFields);
            updateAmountFields();
        }
    }
);

/* =========================================================
   LOAD SCHEMES
   ========================================================= */

function loadSchemes() {
    const saved =
        localStorage.getItem("chitfund_schemes");

    if (!saved) {
        schemes = [];
        saveSchemes();
        return;
    }

    try {
        const data = JSON.parse(saved);

        if (Array.isArray(data)) {
            schemes = data;
        } else {
            schemes = [];
        }
    } catch (error) {
        console.error(
            "Error loading schemes:",
            error
        );

        schemes = [];
    }
}

/* =========================================================
   SAVE SCHEMES
   ========================================================= */

function saveSchemes() {
    localStorage.setItem(
        "chitfund_schemes",
        JSON.stringify(schemes)
    );
}

/* =========================================================
   GET MEMBERS
   ========================================================= */

function getMembers() {
    const saved =
        localStorage.getItem("chitfund_members");

    if (!saved) {
        return [];
    }

    try {
        const data = JSON.parse(saved);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}

/* =========================================================
   SYNC MEMBER COUNTS
   ========================================================= */

function syncSchemeMemberCounts() {
    const members = getMembers();

    schemes.forEach(function (scheme) {

        let chitCount = 0;

        members.forEach(function (member) {

            if (!Array.isArray(member.schemes)) {
                return;
            }

            member.schemes.forEach(function (item) {

                if (!item) return;

                const sameScheme =
                    Number(item.id) === Number(scheme.id) ||
                    String(item.name || "").trim().toLowerCase() ===
                    String(scheme.name || "").trim().toLowerCase();

                if (sameScheme) {
                    chitCount++;
                }
            });
        });

        scheme.members = chitCount;
    });

    saveSchemes();
}

/* =========================================================
   CREATE SCHEME MODAL
   ========================================================= */

function openCreateSchemeModal() {
    const modal =
        document.getElementById("schemeModal");

    const form =
        document.getElementById("schemeForm");

    if (!modal || !form) {
        return;
    }

    document.getElementById(
        "schemeModalTitle"
    ).textContent = "Create Scheme";

    form.reset();

    document.getElementById(
        "editSchemeId"
    ).value = "";

    document.getElementById(
        "schemeStatus"
    ).value = "upcoming";

    setDefaultSchemeDate();

    // Reset Gold/Cash conditional fields after form.reset().
    if (typeof window.updateGoldChitForm === "function") {
        window.updateGoldChitForm();
    }

    modal.classList.add("active");
}

/* =========================================================
   CLOSE MODAL
   ========================================================= */

function closeSchemeModal() {
    const modal =
        document.getElementById("schemeModal");

    if (modal) {
        modal.classList.remove("active");
    }
}

/* =========================================================
   DEFAULT DATE
   ========================================================= */

function setDefaultSchemeDate() {
    const input =
        document.getElementById("schemeStartDate");

    if (!input || input.value) {
        return;
    }

    input.value =
        new Date()
            .toISOString()
            .split("T")[0];
}

/* =========================================================
   CHIT BUSINESS RULES
   Base ₹1,00,000 chit:
   Normal monthly payment = ₹5,000
   From winning month onward = ₹6,000
   Winning payout:
   Month 1 = 95% of chit value
   Each month adds 1% of chit value
========================================================= */

function calculateNormalPayment(totalAmount) {
    return Math.round(Number(totalAmount || 0) * 0.05);
}

function calculateWinnerPayment(totalAmount) {
    return Math.round(Number(totalAmount || 0) * 0.06);
}

function calculateWinningPayout(totalAmount, month) {
    const amount = Number(totalAmount || 0);
    const m = Number(month || 0);

    if (amount <= 0 || m < 1) {
        return 0;
    }

    return Math.round(
        amount * (0.95 + ((m - 1) * 0.01))
    );
}

function normalizeSchemeFinancials(totalAmount, baseAmount) {
    const calculatedBase =
        calculateNormalPayment(totalAmount);

    return calculatedBase > 0
        ? calculatedBase
        : Number(baseAmount || 0);
}

/* =========================================================
   SAVE SCHEME
   ========================================================= */


/* GOLD CHIT FORM RULE
 * Gold Chit does not require a Total Amount.
 * Admin enters the monthly rupee installment instead.
 */
window.updateGoldChitForm = function () {
    const typeInput = document.getElementById("schemeType");
    const amountGroup = document.getElementById("totalAmountGroup");
    const amountInput = document.getElementById("schemeAmount");
    const baseInput = document.getElementById("schemeBaseAmount");

    if (!typeInput || !amountGroup || !amountInput || !baseInput) return;

    const isGold = String(typeInput.value || "").toLowerCase() === "gold";
    amountGroup.style.display = isGold ? "none" : "";
    amountInput.disabled = isGold;
    amountInput.required = !isGold;

    if (isGold) {
        amountInput.value = "";
        baseInput.readOnly = false;
        baseInput.required = true;
        baseInput.placeholder = "Enter monthly amount";
    } else {
        baseInput.readOnly = true;
        baseInput.required = false;
        baseInput.placeholder = "5000";
        const amount = Number(amountInput.value || 0);
        baseInput.value = amount > 0 ? calculateNormalPayment(amount) : "";
    }
};

function getGoldChitGramsFromName(name) {
    const match = String(name || "").match(/(\d+(?:\.\d+)?)\s*(?:grams?|g)\b/i);
    return match ? Number(match[1]) : 0;
}

function saveScheme(event) {
    event.preventDefault();

    const editId =
        document.getElementById("editSchemeId").value;

    const name =
        document.getElementById("schemeName")
            .value.trim();

    const rawType =
        document.getElementById("schemeType").value;

    const type =
        typeof window.normalizeChitType === "function"
            ? window.normalizeChitType(rawType)
            : (String(rawType || "").toLowerCase() === "gold" ? "gold" : "cash");

    const isGoldChit =
        String(type || "").toLowerCase() === "gold";

    const goldGrams = isGoldChit
        ? getGoldChitGramsFromName(name)
        : 0;

    const amountField =
        document.getElementById("schemeAmount");

    const baseField =
        document.getElementById("schemeBaseAmount");

    const totalAmount = isGoldChit
        ? 0
        : Number(amountField.value || 0);

    const baseAmount = isGoldChit
        ? 0
        : calculateNormalPayment(totalAmount);

    const duration =
        Number(
            document.getElementById(
                "schemeDuration"
            ).value
        );

    const capacity =
        Number(
            document.getElementById(
                "schemeCapacity"
            ).value
        );

    const startDate =
        document.getElementById(
            "schemeStartDate"
        ).value;

    const status =
        document.getElementById(
            "schemeStatus"
        ).value;

    /* =====================================================
       VALIDATION
       ===================================================== */

    if (!name) {
        alert("Please enter scheme name.");
        return;
    }

    if (!type) {
        alert("Please select chit type.");
        return;
    }

    if (!isGoldChit && totalAmount <= 0) {
        alert(
            "Total amount must be greater than 0."
        );
        return;
    }

    // Gold Chit quantity comes from the scheme value/name (for example 10 grams or 20 grams).
    // Monthly rupee installments are entered separately in Scheme Details.
    if (isGoldChit && goldGrams <= 0) {
        alert("Please include the gold quantity in the scheme name, for example: Gold Chit 10 grams or Gold Chit 20 grams.");
        return;
    }


    if (duration < 1) {
        alert(
            "Duration must be at least 1 month."
        );
        return;
    }

    if (capacity < 1) {
        alert(
            "Members capacity must be at least 1."
        );
        return;
    }

    if (!startDate) {
        alert("Please select start date.");
        return;
    }

    /* =====================================================
       EDIT SCHEME
       ===================================================== */

    if (editId) {
        const scheme =
            schemes.find(function (item) {
                return (
                    Number(item.id) ===
                    Number(editId)
                );
            });

        if (!scheme) {
            alert("Scheme not found.");
            return;
        }

        syncSchemeMemberCounts();

        if (
            capacity <
            Number(scheme.members || 0)
        ) {
            alert(
                `Capacity cannot be less than current members.\n\n` +
                `Current members: ${scheme.members}\n` +
                `New capacity: ${capacity}`
            );
            return;
        }

        /* Prevent duplicate scheme name */
        const duplicateName =
            schemes.some(function (item) {
                return (
                    Number(item.id) !==
                        Number(editId) &&
                    String(item.name)
                        .trim()
                        .toLowerCase() ===
                        name.toLowerCase()
                );
            });

        if (duplicateName) {
            alert(
                "A scheme with this name already exists."
            );
            return;
        }

        scheme.name = name;
        scheme.type = type;
        scheme.schemeId = String(scheme.id);
        scheme.totalAmount = totalAmount;
        scheme.baseAmount = baseAmount;
        scheme.goldGrams = isGoldChit ? goldGrams : 0;
        scheme.goldMonthlyInstallments =
            isGoldChit
                ? (scheme.goldMonthlyInstallments || {})
                : {};
        scheme.takenPayment = calculateWinnerPayment(totalAmount);
        scheme.duration = duration;
        scheme.capacity = capacity;
        scheme.startDate = startDate;
        scheme.status = status;

        saveSchemes();
        if (typeof window.fintrackAudit === "function") window.fintrackAudit("scheme.updated", "Scheme updated", { schemeId: scheme.id, name: scheme.name, type: scheme.type });

        renderSchemes();

        closeSchemeModal();

        alert(
            "Scheme updated successfully."
        );

        return;
    }

    /* =====================================================
       CHECK DUPLICATE NAME
       ===================================================== */

    const duplicateName =
        schemes.some(function (scheme) {
            return (
                String(scheme.name)
                    .trim()
                    .toLowerCase() ===
                name.toLowerCase()
            );
        });

    if (duplicateName) {
        alert(
            "A scheme with this name already exists."
        );
        return;
    }

    /* =====================================================
       CREATE SCHEME
       ===================================================== */

    const newScheme = {
        id: typeof window.generateFintrackId === "function" ? window.generateFintrackId("scheme") : generateSchemeId(),
        schemeId: null,
        name: name,
        type: type,
        totalAmount: totalAmount,
        baseAmount: baseAmount,
        goldGrams: isGoldChit ? goldGrams : 0,
        goldMonthlyInstallments: isGoldChit ? {} : {},
        takenPayment: calculateWinnerPayment(totalAmount),
        duration: duration,
        capacity: capacity,
        members: 0,
        startDate: startDate,
        status: status
    };

    newScheme.schemeId = String(newScheme.id);
    schemes.push(newScheme);

    saveSchemes();
    if (typeof window.fintrackAudit === "function") window.fintrackAudit("scheme.created", "Scheme created", { schemeId: newScheme.id, name: newScheme.name, type: newScheme.type });

    renderSchemes();

    closeSchemeModal();

    alert(
        `${name} created successfully.`
    );
}

/* =========================================================
   GENERATE SCHEME ID
   ========================================================= */

function generateSchemeId() {
    if (!schemes.length) {
        return 1;
    }

    return (
        Math.max(
            ...schemes.map(function (scheme) {
                return Number(scheme.id) || 0;
            })
        ) + 1
    );
}

/* =========================================================
   RENDER SCHEMES
   ========================================================= */

function renderSchemes(data = schemes) {
    const tbody =
        document.getElementById(
            "schemeTableBody"
        );

    if (!tbody) {
        return;
    }

    syncSchemeMemberCounts();

    tbody.innerHTML = "";

    const totalCount =
        document.getElementById(
            "totalSchemeCount"
        );

    const resultCount =
        document.getElementById(
            "schemeResultCount"
        );

    if (totalCount) {
        totalCount.textContent =
            schemes.length;
    }

    if (resultCount) {
        resultCount.textContent =
            `${data.length} ${
                data.length === 1
                    ? "scheme"
                    : "schemes"
            }`;
    }

    if (!data.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            ▱
                        </div>

                        <strong>
                            No schemes found
                        </strong>

                        <p>
                            Create a new chit scheme to get started.
                        </p>
                    </div>
                </td>
            </tr>
        `;

        return;
    }

    data.forEach(function (scheme) {
        const memberCount =
            Number(scheme.members || 0);

        const capacity =
            Number(scheme.capacity || 0);

        let percentage = 0;

        if (capacity > 0) {
            percentage =
                (memberCount / capacity) * 100;
        }

        percentage =
            Math.min(
                100,
                Math.max(0, percentage)
            );

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>
                <div class="scheme-name">
                    <strong>
                        ${escapeHTML(scheme.name)}
                    </strong>

                    <span>
                        ID: ${scheme.id}
                    </span>
                </div>
            </td>

            <td>
                ${escapeHTML(scheme.type)}
            </td>

            <td>
                <span class="total-amount">
                    ${String(scheme.type || "").toLowerCase() === "gold"
                        ? `${Number(scheme.goldGrams || getGoldChitGramsFromName(scheme.name) || 0)} grams`
                        : formatCurrency(scheme.totalAmount)}
                </span>
            </td>

            <td>
                <span class="base-amount">
                    ${String(scheme.type || "").toLowerCase() === "gold"
                        ? "Varies by month"
                        : `${formatCurrency(scheme.baseAmount)}/mo`}
                </span>
            </td>

            <td>
                ${scheme.duration} Months
            </td>

            <td>
                <div class="timeline">
                    <span>
                        Start:
                        ${formatDate(
                            scheme.startDate
                        )}
                    </span>

                    <span>
                        End:
                        ${formatDate(
                            calculateEndDate(
                                scheme.startDate,
                                scheme.duration
                            )
                        )}
                    </span>
                </div>
            </td>

            <td>
                <div class="capacity-container">

                    <div class="capacity-text">
                        <span>
                            ${memberCount}/${capacity}
                        </span>

                        <span>
                            ${Math.round(
                                percentage
                            )}%
                        </span>
                    </div>

                    <div class="capacity-bar">
                        <div
                            class="capacity-progress"
                            style="width:${percentage}%">
                        </div>
                    </div>

                </div>
            </td>

            <td>
                <span class="
                    status-badge
                    status-${escapeHTML(
                        scheme.status
                    )}
                ">
                    ${capitalize(
                        scheme.status
                    )}
                </span>
            </td>

            <td>
                <button
                    type="button"
                    class="manage-button"
                    onclick="manageScheme(${scheme.id})">
                    Manage →
                </button>

                <button
                    type="button"
                    class="edit-button"
                    onclick="openEditSchemeModal(${scheme.id})">
                    Edit
                </button>

                <button
                    type="button"
                    class="delete-button"
                    onclick="deleteScheme(${scheme.id})">
                    Delete
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

/* =========================================================
   FILTER SCHEMES
   ========================================================= */

function filterSchemes() {
    const searchInput =
        document.getElementById(
            "schemeSearch"
        );

    const statusInput =
        document.getElementById(
            "statusFilter"
        );

    const search =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";

    const status =
        statusInput
            ? statusInput.value
            : "all";

    const filtered =
        schemes.filter(function (scheme) {
            const text =
                `${scheme.name}
                ${scheme.type}
                ${scheme.id}`
                    .toLowerCase();

            const matchesSearch =
                text.includes(search);

            const matchesStatus =
                status === "all" ||
                scheme.status === status;

            return (
                matchesSearch &&
                matchesStatus
            );
        });

    renderSchemes(filtered);
}

/* =========================================================
   EDIT SCHEME MODAL
   ========================================================= */

function openEditSchemeModal(id) {
    const scheme =
        schemes.find(function (item) {
            return (
                Number(item.id) ===
                Number(id)
            );
        });

    if (!scheme) {
        alert("Scheme not found.");
        return;
    }

    document.getElementById(
        "schemeModalTitle"
    ).textContent = "Edit Scheme";

    document.getElementById(
        "editSchemeId"
    ).value = scheme.id;

    document.getElementById(
        "schemeName"
    ).value = scheme.name;

    document.getElementById(
        "schemeType"
    ).value = scheme.type;

    document.getElementById(
        "schemeAmount"
    ).value = scheme.totalAmount || "";

    document.getElementById(
        "schemeBaseAmount"
    ).value = scheme.baseAmount || "";

    const editType =
        document.getElementById("schemeType");
    const editAmountGroup =
        document.getElementById("totalAmountGroup");
    const editAmount =
        document.getElementById("schemeAmount");
    const editBase =
        document.getElementById("schemeBaseAmount");

    if (String(editType.value || "").toLowerCase() === "gold") {
        editAmountGroup.style.display = "none";
        editAmount.disabled = true;
        editAmount.required = false;
        editBase.readOnly = false;
        editBase.required = false;
        editBase.placeholder = "Set monthly amount in Scheme Details";
    } else {
        editAmountGroup.style.display = "";
        editAmount.disabled = false;
        editAmount.required = true;
        editBase.readOnly = true;
        editBase.required = false;
    }

    document.getElementById(
        "schemeDuration"
    ).value = scheme.duration;

    document.getElementById(
        "schemeCapacity"
    ).value = scheme.capacity;

    document.getElementById(
        "schemeStartDate"
    ).value = scheme.startDate;

    document.getElementById(
        "schemeStatus"
    ).value = scheme.status;

    document.getElementById(
        "schemeModal"
    ).classList.add("active");
}

/* =========================================================
   DELETE SCHEME
   ========================================================= */

function deleteScheme(id) {
    const scheme =
        schemes.find(function (item) {
            return (
                Number(item.id) ===
                Number(id)
            );
        });

    if (!scheme) {
        return;
    }

    /* =====================================================
       DO NOT DELETE SCHEME WITH MEMBERS
       ===================================================== */

    const members = getMembers();

    const assignedMembers =
        members.filter(function (member) {
            return (
                Array.isArray(member.schemes) &&
                member.schemes.some(function (item) {
                    return (
                        Number(item.id) ===
                            Number(scheme.id) ||
                        item.name === scheme.name
                    );
                })
            );
        });

    if (assignedMembers.length > 0) {
        alert(
            `Cannot delete "${scheme.name}".\n\n` +
            `${assignedMembers.length} member(s) are currently assigned to this scheme.\n\n` +
            `Remove those members first.`
        );

        return;
    }

    const payments = JSON.parse(localStorage.getItem("chitfund_payments") || "[]");
    const winners = JSON.parse(localStorage.getItem("chitfund_winners") || "[]");
    const payouts = JSON.parse(localStorage.getItem("chitfund_admin_payouts") || "[]");
    const settlements = [];
    const sameSchemeRecord = record => String(record.schemeId ?? "") === String(scheme.id) || String(record.scheme || "").trim().toLowerCase() === String(scheme.name || "").trim().toLowerCase();
    const hasHistory = payments.some(sameSchemeRecord) || winners.some(sameSchemeRecord) || payouts.some(sameSchemeRecord) || settlements.some(sameSchemeRecord);

    if (hasHistory) {
        if (!confirm(`"${scheme.name}" has financial history. It will be closed instead of permanently deleted.`)) {
            return;
        }
        scheme.status = "closed";
        saveSchemes();
        renderSchemes();
        alert(`"${scheme.name}" was closed. Financial history was preserved.`);
        return;
    }

    if (!confirm(`Are you sure you want to delete "${scheme.name}"?`)) {
        return;
    }

    if (typeof window.fintrackAudit === "function") window.fintrackAudit("scheme.deleted", "Scheme deleted", { schemeId: scheme.id, name: scheme.name });

    schemes = schemes.filter(function (item) {
        return Number(item.id) !== Number(id);
    });

    saveSchemes();

    renderSchemes();

    alert(
        "Scheme deleted successfully."
    );
}

/* =========================================================
   MANAGE SCHEME
   ========================================================= */

function manageScheme(id) {
    const scheme =
        schemes.find(function (item) {
            return (
                Number(item.id) ===
                Number(id)
            );
        });

    if (!scheme) {
        return;
    }

    window.location.href =
        "scheme-details.html?id=" +
        encodeURIComponent(scheme.id);
}

/* =========================================================
   CALCULATE END DATE
   ========================================================= */

function calculateEndDate(
    startDate,
    duration
) {
    if (!startDate) {
        return "";
    }

    const date =
        new Date(startDate);

    date.setMonth(
        date.getMonth() +
        Number(duration)
    );

    return (
        date
            .toISOString()
            .split("T")[0]
    );
}

/* =========================================================
   REFRESH
   ========================================================= */

function refreshSchemes() {
    loadSchemes();

    syncSchemeMemberCounts();

    renderSchemes();

    const search =
        document.getElementById(
            "schemeSearch"
        );

    const status =
        document.getElementById(
            "statusFilter"
        );

    if (search) {
        search.value = "";
    }

    if (status) {
        status.value = "all";
    }
}

/* =========================================================
   PROFILE
   ========================================================= */

function loadProfile() {
    const saved =
        localStorage.getItem("fintrackUser");

    if (!saved) {
        return;
    }

    try {
        const user = JSON.parse(saved);

        const name =
            user.fullName ||
            user.name ||
            user.username ||
            "admin";

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
    } catch (error) {
        console.error(
            "Profile loading error:",
            error
        );
    }
}



/* =========================================================
   FORMAT CURRENCY
   ========================================================= */

function formatCurrency(amount) {
    return new Intl.NumberFormat(
        "en-IN",
        {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    ).format(
        Number(amount || 0)
    );
}

/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDate(value) {
    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
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

function capitalize(value) {
    if (!value) {
        return "";
    }

    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );
}

/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   CLOSE MODAL ON OUTSIDE CLICK
   ========================================================= */

document.addEventListener(
    "click",
    function (event) {
        const modal =
            document.getElementById(
                "schemeModal"
            );

        if (
            modal &&
            event.target === modal
        ) {
            closeSchemeModal();
        }
    }
);

/* =========================================================
   ESC KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    function (event) {
        if (event.key === "Escape") {
            closeSchemeModal();
        }
    }
);

/* =========================================================
   OPTIONAL PAYMENT HELPER
   ========================================================= */

const SCHEME_TYPES = {
    ONE_LAKH: {
        name: "₹1 Lakh Chit",
        pre: 5000,
        post: 6000,
        isVariable: false
    },

    TWO_LAKH: {
        name: "₹2 Lakh Chit",
        pre: 10000,
        post: 12000,
        isVariable: false
    },

    GOLD: {
        name: "Gold Chit",
        pre: 0,
        post: 0,
        isVariable: true
    }
};

function calculateMonthlyDue(
    schemeType,
    hasTakenChit,
    adminGoldAmount = 0
) {
    if (schemeType === "GOLD") {
        return parseFloat(
            adminGoldAmount
        ) || 0;
    }

    const scheme =
        SCHEME_TYPES[schemeType];

    if (!scheme) {
        return 0;
    }

    return hasTakenChit
        ? scheme.post
        : scheme.pre;
}

/* FINTRACK_TWO_CHIT_TYPES
 * Only two chit models are supported:
 * 1. Cash Chit
 * 2. Gold Chit (quantity is defined by the scheme; Admin enters monthly rupee amount)
 */
window.FINTRACK_CHIT_TYPES = Object.freeze({
    CASH: "cash",
    GOLD: "gold"
});

window.normalizeChitType = function (value) {
    const v = String(value || "").trim().toLowerCase();
    if (v === "gold" || v.includes("gold")) return "gold";
    return "cash";
};

window.getChitTypeLabel = function (value) {
    return window.normalizeChitType(value) === "gold"
        ? "Gold Chit"
        : "Cash Chit";
};

window.validateChitType = function (value) {
    const v = window.normalizeChitType(value);
    if (v !== "cash" && v !== "gold") {
        throw new Error("Chit type must be Cash Chit or Gold Chit.");
    }
    return v;
};
