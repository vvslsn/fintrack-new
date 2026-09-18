
/* =========================================================
   FINTRACK - SCHEME DETAILS
   scheme-details.js
   ========================================================= */

"use strict";

let currentScheme = null;


/* =========================================================
   PAGE LOAD
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    loadScheme();
});


/* =========================================================
   GET SCHEME ID FROM URL
   ========================================================= */

function getSchemeId() {

    const params =
        new URLSearchParams(window.location.search);

    return (
        params.get("id") ||
        params.get("schemeId")
    );
}


/* =========================================================
   LOAD SCHEME
   ========================================================= */

function loadScheme() {

    const schemeId = getSchemeId();

    if (!schemeId) {

        console.error(
            "No scheme ID found in URL."
        );

        showNoSchemeMessage();

        return;
    }


    let schemes = [];


    /* -----------------------------------------------------
       LOAD SCHEMES FROM LOCAL STORAGE
       ----------------------------------------------------- */

    try {

        const storedSchemes =
            localStorage.getItem(
                "chitfund_schemes"
            );

        if (storedSchemes) {

            schemes =
                JSON.parse(storedSchemes);

        }

    } catch (error) {

        console.error(
            "Error loading schemes:",
            error
        );

        schemes = [];
    }


    /* -----------------------------------------------------
       MAKE SURE SCHEMES IS AN ARRAY
       ----------------------------------------------------- */

    if (!Array.isArray(schemes)) {
        schemes = [];
    }


    /* -----------------------------------------------------
       FIND SELECTED SCHEME
       ----------------------------------------------------- */

    const scheme =
        schemes.find(function (item) {

            return (
                String(item.id) ===
                String(schemeId)
            );

        });


    if (!scheme) {

        console.error(
            "Scheme not found:",
            schemeId
        );

        showNoSchemeMessage();

        return;
    }


    /* -----------------------------------------------------
       KEEP SCHEME MEMBERS AS NUMERIC COUNT
       
       schemes.js stores:
       
       members: 0
       members: 1
       members: 5
       
       Actual member records are stored separately
       inside chitfund_members.
       ----------------------------------------------------- */

    currentScheme = scheme;


    /* -----------------------------------------------------
       RENDER DATA
       ----------------------------------------------------- */

    renderScheme(scheme);

    setStatus(scheme);

    updateMemberProgress(scheme);

    renderMembers(scheme);
}


/* =========================================================
   GET ALL MEMBERS
   ========================================================= */

function getAllMembers() {

    const saved =
        localStorage.getItem(
            "chitfund_members"
        );


    if (!saved) {
        return [];
    }


    try {

        const data =
            JSON.parse(saved);


        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {

        console.error(
            "Error loading members:",
            error
        );

        return [];
    }
}


/* =========================================================
   GET MEMBERS BELONGING TO THIS SCHEME
   ========================================================= */

function getSchemeMembers(scheme) {

    if (!scheme) {
        return [];
    }

    const members = getAllMembers();

    if (!Array.isArray(members)) {
        return [];
    }

    /*
     * Return one entry per CHIT/TICKET.
     * A person can therefore appear more than once.
     */
    const chitEntries = [];

    members.forEach(function (member) {

        if (
            !member ||
            !Array.isArray(member.schemes)
        ) {
            return;
        }

        member.schemes.forEach(function (memberScheme) {

            if (!memberScheme) {
                return;
            }

            const idMatch =
                memberScheme.id !== undefined &&
                memberScheme.id !== null &&
                scheme.id !== undefined &&
                scheme.id !== null &&
                String(memberScheme.id) ===
                String(scheme.id);

            const nameMatch =
                String(memberScheme.name || "")
                    .trim()
                    .toLowerCase() ===
                String(scheme.name || "")
                    .trim()
                    .toLowerCase();

            if (idMatch || nameMatch) {

                chitEntries.push({
                    member: member,
                    scheme: memberScheme
                });
            }
        });
    });

    return chitEntries;
}


/* =========================================================
   GET MEMBER'S SCHEME INFORMATION
   ========================================================= */

function getMemberSchemeInfo(
    member,
    scheme
) {

    if (
        !member ||
        !Array.isArray(member.schemes)
    ) {
        return null;
    }


    return (
        member.schemes.find(
            function (memberScheme) {

                if (!memberScheme) {
                    return false;
                }


                const idMatch =
                    memberScheme.id !== undefined &&
                    memberScheme.id !== null &&
                    scheme.id !== undefined &&
                    scheme.id !== null &&
                    Number(memberScheme.id) ===
                    Number(scheme.id);


                const nameMatch =
                    String(
                        memberScheme.name || ""
                    )
                        .trim()
                        .toLowerCase() ===
                    String(
                        scheme.name || ""
                    )
                        .trim()
                        .toLowerCase();


                return (
                    idMatch ||
                    nameMatch
                );
            }
        ) || null
    );
}


/* =========================================================
   RENDER SCHEME
   ========================================================= */

function renderScheme(scheme) {

    renderGoldMonthlyInstallments(scheme);

    /* -----------------------------------------------------
       SCHEME NAME
       ----------------------------------------------------- */

    setText(
        "schemeName",
        scheme.name || "-"
    );


    setText(
        "infoName",
        scheme.name || "-"
    );


    /* -----------------------------------------------------
       CHIT TYPE
       ----------------------------------------------------- */

    setText(
        "infoType",
        scheme.type || "-"
    );


    /* -----------------------------------------------------
       TOTAL AMOUNT
       
       IMPORTANT:
       schemes.js uses totalAmount.
       ----------------------------------------------------- */

    const isGoldChit = String(scheme.type || "").toLowerCase() === "gold";
    const goldGrams = getGoldChitGrams(scheme);

    setText("totalAmountLabel", isGoldChit ? "GOLD VALUE" : "TOTAL VALUE");
    setText("infoAmountLabel", isGoldChit ? "Gold Value" : "Total Amount");
    setText("infoInstallmentLabel", isGoldChit ? "Monthly Installment" : "Base Installment");

    setText(
        "infoAmount",
        isGoldChit ? formatGoldPayout(scheme, goldGrams) : formatCurrency(scheme.totalAmount)
    );

    setText(
        "totalAmount",
        isGoldChit ? formatGoldPayout(scheme, goldGrams) : formatCurrency(scheme.totalAmount)
    );


    /* -----------------------------------------------------
       BASE INSTALLMENT
       
       IMPORTANT:
       schemes.js uses baseAmount.
       ----------------------------------------------------- */

    const isGoldScheme = String(scheme.type || "").toLowerCase() === "gold";
    const installmentText = isGoldScheme
        ? "Varies by month"
        : formatCurrency(scheme.baseAmount);

    setText(
        "infoInstallment",
        installmentText
    );

    setText(
        "baseInstallment",
        installmentText
    );


    /* -----------------------------------------------------
       DURATION
       ----------------------------------------------------- */

    const duration =
        scheme.duration
            ? `${scheme.duration} Months`
            : "-";


    setText(
        "infoDuration",
        duration
    );


    setText(
        "duration",
        duration
    );


    /* -----------------------------------------------------
       START DATE
       ----------------------------------------------------- */

    setText(
        "infoStartDate",
        formatDate(
            scheme.startDate
        )
    );


    /* -----------------------------------------------------
       END DATE
       
       If endDate does not exist, calculate it from
       startDate + duration.
       ----------------------------------------------------- */

    let endDate =
        scheme.endDate;


    if (
        !endDate &&
        scheme.startDate &&
        Number(scheme.duration) > 0
    ) {

        endDate =
            calculateEndDate(
                scheme.startDate,
                scheme.duration
            );
    }


    setText(
        "infoEndDate",
        formatDate(endDate)
    );


    /* -----------------------------------------------------
       SCHEME ID
       ----------------------------------------------------- */

    setText(
        "schemeId",
        scheme.id || "-"
    );

    renderMonthlyWinners(scheme);
    renderSchemePayments(scheme);

}


/* =========================================================
   CALCULATE END DATE
   ========================================================= */

function calculateEndDate(
    startDate,
    duration
) {

    const date =
        new Date(startDate);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }


    date.setMonth(
        date.getMonth() +
        Number(duration)
    );


    return date;
}


/* =========================================================
   SET STATUS
   ========================================================= */

function setStatus(scheme) {

    const status =
        scheme.status ||
        "Active";


    const statusElements = [

        document.getElementById(
            "status"
        ),

        document.getElementById(
            "schemeStatus"
        ),

        document.getElementById(
            "infoStatus"
        )

    ];


    statusElements.forEach(
        function (element) {

            if (!element) {
                return;
            }


            element.textContent =
                status;


            element.classList.remove(
                "active",
                "inactive",
                "completed",
                "pending",
                "upcoming",
                "status-active",
                "status-inactive",
                "status-completed",
                "status-pending",
                "status-upcoming"
            );


            const normalizedStatus =
                String(status)
                    .toLowerCase()
                    .replace(/\s+/g, "-");


            element.classList.add(
                normalizedStatus
            );


            element.classList.add(
                `status-${normalizedStatus}`
            );

        }
    );
}


/* =========================================================
   UPDATE MEMBER PROGRESS
   ========================================================= */

function updateMemberProgress(
    scheme
) {

    const chitEntries =
        getSchemeMembers(scheme);

    const chitCount =
        chitEntries.length;

    const capacity =
        Number(scheme.capacity) || 0;

    let percentage = 0;

    if (capacity > 0) {
        percentage =
            Math.round(
                (chitCount / capacity) * 100
            );
    }

    percentage =
        Math.min(
            Math.max(percentage, 0),
            100
        );

    setText(
        "memberCount",
        `${chitCount} / ${capacity}`
    );

    setText(
        "capacityNumber",
        `${chitCount} / ${capacity}`
    );

    const capacityText =
        document.getElementById("capacityText");

    if (capacityText) {
        capacityText.textContent =
            `${chitCount} / ${capacity} Chits Joined`;
    }

    const capacityLabel =
        document.querySelector(
            ".capacity-number span"
        );

    if (capacityLabel) {
        capacityLabel.textContent =
            "Chits Joined";
    }

    const progressBar =
        document.getElementById("capacityProgress");

    if (progressBar) {

        progressBar.style.width =
            `${percentage}%`;

        progressBar.setAttribute(
            "aria-valuenow",
            percentage
        );

        progressBar.setAttribute(
            "aria-valuemin",
            "0"
        );

        progressBar.setAttribute(
            "aria-valuemax",
            "100"
        );
    }

    setText(
        "availableSlots",
        Math.max(
            capacity - chitCount,
            0
        )
    );

    setText(
        "capacityPercentage",
        `${percentage}%`
    );
}


/* =========================================================
   RENDER MEMBERS
   ========================================================= */

function renderMembers(
    scheme
) {

    const chitEntries =
        getSchemeMembers(scheme);

    const tableBody =
        document.getElementById("membersTable") ||
        document.getElementById("membersTableBody") ||
        document.getElementById("memberTableBody") ||
        document.getElementById("membersList");

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = "";

    if (chitEntries.length === 0) {

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td
                colspan="6"
                class="no-members"
            >
                No members joined yet.
            </td>
        `;

        tableBody.appendChild(row);
        return;
    }

    chitEntries.forEach(function (entry) {

        const member =
            entry.member;

        const memberScheme =
            entry.scheme;

        const ticket =
            memberScheme.ticket ??
            memberScheme.ticketNumber ??
            memberScheme.ticketNo ??
            "-";

        const memberStatus =
            memberScheme.status ||
            member.status ||
            "Active";

        const joinedDate =
            memberScheme.joinedDate ||
            member.joinedDate ||
            "-";

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>
                ${escapeHTML(String(ticket))}
            </td>

            <td>
                ${escapeHTML(
                    member.name ||
                    member.fullName ||
                    "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    member.email ||
                    "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    member.phone ||
                    "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    joinedDate
                )}
            </td>

            <td>
                ${escapeHTML(
                    memberStatus
                )}
            </td>
        `;

        tableBody.appendChild(row);
    });
}


/* =========================================================
   ADD MEMBER
   ========================================================= */

function addMember() {

    if (!currentScheme) {

        alert(
            "Unable to identify the scheme."
        );

        return;
    }


    const schemeId =
        encodeURIComponent(
            currentScheme.id
        );


    /*
       Pass selected scheme to
       members page.
    */

    window.location.href =
        `members.html?schemeId=${schemeId}&returnToScheme=1`;
}


/* =========================================================
   DELETE ONE CHIT/TICKET FROM CURRENT SCHEME
   ========================================================= */

function deleteMemberFromScheme() {

    if (!currentScheme) {
        alert("Unable to identify the current scheme.");
        return;
    }

    const members = getAllMembers();

    if (!members.length) {
        alert("No members are available.");
        return;
    }

    const chitEntries =
        getSchemeMembers(currentScheme);

    if (!chitEntries.length) {
        alert(
            "There are no chits in this scheme to delete."
        );
        return;
    }

    const memberList =
        chitEntries.map(function (entry) {

            const member =
                entry.member;

            const memberScheme =
                entry.scheme;

            const ticket =
                memberScheme.ticket ??
                memberScheme.ticketNumber ??
                memberScheme.ticketNo ??
                "-";

            const name =
                member.name ||
                member.fullName ||
                "Unknown Member";

            return (
                `Ticket ${ticket} - ${name}`
            );

        }).join("\n");

    const ticketInput =
        prompt(
            "Enter the ticket number to delete:\n\n" +
            memberList
        );

    if (
        ticketInput === null ||
        ticketInput.trim() === ""
    ) {
        return;
    }

    const enteredTicket =
        ticketInput.trim();

    let foundMember = null;
    let foundSchemeIndex = -1;

    members.some(function (member) {

        if (
            !member ||
            !Array.isArray(member.schemes)
        ) {
            return false;
        }

        const schemeIndex =
            member.schemes.findIndex(
                function (memberScheme) {

                    if (!memberScheme) {
                        return false;
                    }

                    const sameScheme =
                        (
                            memberScheme.id !== undefined &&
                            currentScheme.id !== undefined &&
                            String(memberScheme.id) ===
                            String(currentScheme.id)
                        ) ||
                        (
                            String(memberScheme.name || "")
                                .trim()
                                .toLowerCase() ===
                            String(currentScheme.name || "")
                                .trim()
                                .toLowerCase()
                        );

                    const ticket =
                        memberScheme.ticket ??
                        memberScheme.ticketNumber ??
                        memberScheme.ticketNo;

                    return (
                        sameScheme &&
                        String(ticket ?? "").trim() ===
                        enteredTicket
                    );
                }
            );

        if (schemeIndex === -1) {
            return false;
        }

        foundMember = member;
        foundSchemeIndex = schemeIndex;

        return true;
    });

    if (
        !foundMember ||
        foundSchemeIndex === -1
    ) {
        alert(
            `Ticket ${enteredTicket} was not found in "${currentScheme.name}".`
        );
        return;
    }

    const memberName =
        foundMember.name ||
        foundMember.fullName ||
        "Member";

    const confirmed =
        confirm(
            `Remove "${memberName}" (Ticket ${enteredTicket}) ` +
            `from "${currentScheme.name}"?`
        );

    if (!confirmed) {
        return;
    }

    /*
     * Remove ONLY this ticket.
     * If the same person owns Ticket 1 and Ticket 2,
     * deleting Ticket 2 leaves Ticket 1 untouched.
     */
    foundMember.schemes.splice(
        foundSchemeIndex,
        1
    );

    localStorage.setItem(
        "chitfund_members",
        JSON.stringify(members)
    );

    /*
     * Recalculate scheme member count as number of chits.
     */
    let schemes = [];

    try {
        schemes =
            JSON.parse(
                localStorage.getItem(
                    "chitfund_schemes"
                ) || "[]"
            );
    } catch (error) {
        console.error(
            "Unable to load schemes:",
            error
        );
        schemes = [];
    }

    const schemeIndex =
        schemes.findIndex(function (scheme) {

            return (
                String(scheme.id) ===
                String(currentScheme.id)
            );

        });

    if (schemeIndex !== -1) {

        let newCount = 0;

        members.forEach(function (member) {

            if (
                !member ||
                !Array.isArray(member.schemes)
            ) {
                return;
            }

            member.schemes.forEach(
                function (memberScheme) {

                    if (!memberScheme) {
                        return;
                    }

                    const sameScheme =
                        String(memberScheme.id) ===
                        String(currentScheme.id) ||
                        String(memberScheme.name || "")
                            .trim()
                            .toLowerCase() ===
                        String(currentScheme.name || "")
                            .trim()
                            .toLowerCase();

                    if (sameScheme) {
                        newCount++;
                    }
                }
            );
        });

        schemes[schemeIndex].members =
            newCount;

        localStorage.setItem(
            "chitfund_schemes",
            JSON.stringify(schemes)
        );
    }

    loadScheme();

    alert(
        `Ticket ${enteredTicket} was deleted successfully.`
    );
}


/* =========================================================
   BACK BUTTON
   ========================================================= */

function goBack() {

    if (document.referrer) {

        history.back();

        return;
    }


    window.location.href =
        "schemes.html";
}


/* =========================================================
   NO SCHEME MESSAGE
   ========================================================= */

function showNoSchemeMessage() {

    const container =
        document.getElementById(
            "schemeDetails"
        ) ||
        document.querySelector(
            ".scheme-details"
        );


    if (container) {

        container.innerHTML = `
            <div class="no-scheme-message">

                <h3>
                    No Scheme Data Found
                </h3>

                <p>
                    The selected scheme could not
                    be found.
                </p>

                <button
                    type="button"
                    onclick="window.location.href='schemes.html'"
                >
                    Back to Schemes
                </button>

            </div>
        `;
    }
}


/* =========================================================
   HELPER - SET TEXT
   ========================================================= */

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (!element) {
        return;
    }


    element.textContent =
        value ?? "-";
}


/* =========================================================
   HELPER - FORMAT CURRENCY
   ========================================================= */

function formatCurrency(
    value
) {

    const amount =
        Number(value);


    if (
        Number.isNaN(amount) ||
        !Number.isFinite(amount)
    ) {
        return "₹ 0";
    }


    return (
        "₹ " +
        amount.toLocaleString(
            "en-IN"
        )
    );
}


/* =========================================================
   HELPER - FORMAT DATE
   ========================================================= */

function formatDate(
    dateValue
) {

    if (!dateValue) {
        return "-";
    }


    const date =
        new Date(dateValue);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return dateValue;
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
   HELPER - ESCAPE HTML
   ========================================================= */

function escapeHTML(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)
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
   SCHEME DETAIL TABS + HISTORY
   ========================================================= */

function switchTab(tabName) {
    const validTabs = ["members", "winners", "payments"];
    if (!validTabs.includes(tabName)) tabName = "members";

    document.querySelectorAll(".tab-button").forEach(function (button) {
        button.classList.toggle(
            "active",
            button.getAttribute("data-tab") === tabName
        );
    });

    document.querySelectorAll(".tab-content").forEach(function (content) {
        content.classList.toggle(
            "active",
            content.id === tabName + "Tab"
        );
    });

    if (currentScheme && tabName === "winners") {
        renderMonthlyWinners(currentScheme);
    }
    if (currentScheme && tabName === "payments") {
        renderSchemePayments(currentScheme);
    }
}

function getSchemeHistoryRecords(storageKey, scheme) {
    let records = [];
    try {
        records = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch (error) {
        records = [];
    }

    if (!Array.isArray(records) || !scheme) return [];

    const id = String(scheme.id);
    const name = String(scheme.name || "").trim().toLowerCase();

    return records.filter(function (record) {
        const recordId = String(
            record.schemeId ?? record.schemeID ?? ""
        );
        const recordName = String(
            record.scheme || record.schemeName || ""
        ).trim().toLowerCase();

        return (
            (recordId && recordId === id) ||
            (recordName && recordName === name)
        );
    });
}

function getWinnerRecords(scheme) {

    if (!scheme) return [];

    let records = [];

    try {
        records = JSON.parse(
            localStorage.getItem("chitfund_winners") || "[]"
        );
    } catch (error) {
        records = [];
    }

    if (!Array.isArray(records)) return [];

    return records.filter(function (record) {
        return (
            String(record.schemeId) === String(scheme.id) ||
            String(record.scheme || "").trim().toLowerCase() ===
            String(scheme.name || "").trim().toLowerCase()
        );
    });
}


function saveWinnerRecords(records) {
    localStorage.setItem(
        "chitfund_winners",
        JSON.stringify(Array.isArray(records) ? records : [])
    );
}

function replaceSchemeWinnerRecords(scheme, schemeRecords) {
    let allRecords = [];
    try {
        allRecords = JSON.parse(localStorage.getItem("chitfund_winners") || "[]");
    } catch (error) {
        allRecords = [];
    }
    if (!Array.isArray(allRecords)) allRecords = [];

    const id = String(scheme?.id ?? "");
    const name = String(scheme?.name || "").trim().toLowerCase();

    allRecords = allRecords.filter(function (record) {
        const sameScheme =
            String(record.schemeId) === id ||
            String(record.scheme || "").trim().toLowerCase() === name;
        return !sameScheme;
    });

    allRecords = allRecords.concat(Array.isArray(schemeRecords) ? schemeRecords : []);
    saveWinnerRecords(allRecords);
    if (typeof window.fintrackAudit === "function") window.fintrackAudit("winner.records_replaced", "Winner records updated", { schemeId: scheme.id, count: Array.isArray(schemeRecords) ? schemeRecords.length : 0 });
}


function getGoldChitGrams(scheme) {
    if (!scheme) return 0;
    const stored = Number(scheme.goldGrams || 0);
    if (stored > 0) return stored;
    const match = String(scheme.name || "").match(/(\d+(?:\.\d+)?)\s*(?:grams?|g)\b/i);
    return match ? Number(match[1]) : 0;
}

function formatGoldPayout(scheme, grams) {
    const value = Number(grams || getGoldChitGrams(scheme) || 0);
    return value > 0 ? `${value} gram${value === 1 ? "" : "s"}` : "-";
}

function calculateWinningPayout(totalAmount, month) {

    const amount = Number(totalAmount || 0);
    const m = Number(month || 0);

    if (amount <= 0 || m < 1) return 0;

    return Math.round(
        amount * (0.95 + ((m - 1) * 0.01))
    );
}

function calculateNormalPayment(totalAmount) {
    return Math.round(Number(totalAmount || 0) * 0.05);
}

function calculateWinnerPayment(totalAmount) {
    return Math.round(Number(totalAmount || 0) * 0.06);
}

function getMonthWinnerRecords(scheme, month) {
    return getWinnerRecords(scheme).filter(function (record) {
        return (
            Number(record.month) === Number(month) &&
            String(record.status || "winner").toLowerCase() !== "stopped"
        );
    });
}


function renderMonthlyWinners(scheme) {

    const tbody = document.getElementById("winnersTable");
    if (!tbody) return;

    const isGoldChit = String(scheme?.type || "").toLowerCase() === "gold";

    document.querySelectorAll(".winning-month-payment-col").forEach(function (element) {
        element.style.display = isGoldChit ? "none" : "";
    });

    const records = getWinnerRecords(scheme).sort(function (a, b) {
        const monthDifference = Number(a.month || 0) - Number(b.month || 0);
        if (monthDifference !== 0) return monthDifference;
        return String(a.ticket || "").localeCompare(String(b.ticket || ""));
    });

    tbody.innerHTML = "";

    if (!records.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="no-members">
                    No monthly winners or stopped months recorded yet.
                </td>
            </tr>`;
    } else {
        records.forEach(function (winner) {
            const row = document.createElement("tr");
            const stopped = String(winner.status || "winner").toLowerCase() === "stopped";
            const cashWinningMonthPayment = stopped
                ? "No payout"
                : formatCurrency(calculateWinnerPayment(scheme.totalAmount));

            row.innerHTML = `
                <td>${escapeHTML(String(winner.month))}</td>
                <td>${escapeHTML(stopped ? "-" : String(winner.ticket || "-"))}</td>
                <td>${escapeHTML(stopped ? "-" : (winner.memberName || "-"))}</td>
                <td>${stopped ? "-" : (isGoldChit ? formatGoldPayout(scheme, winner.goldGrams) : formatCurrency(Number(winner.payout || 0)))}</td>
                <td class="winning-month-payment-col" style="${isGoldChit ? "display:none;" : ""}">${cashWinningMonthPayment}</td>
                <td>${stopped ? "Stopped" : "Winner recorded"}</td>
            `;

            tbody.appendChild(row);
        });
    }

}

function removeWinnerFromToolbar() {
    if (!currentScheme) {
        alert("Unable to identify the current scheme.");
        return;
    }

    const winnerRecords = getWinnerRecords(currentScheme).filter(function (record) {
        return String(record.status || "winner").toLowerCase() === "winner";
    });

    if (!winnerRecords.length) {
        alert("There are no recorded winners to remove.");
        return;
    }

    const monthInput = prompt("Enter the month of the wrongly recorded winner:");
    if (monthInput === null) return;

    const month = Number(monthInput.trim());
    if (!Number.isInteger(month) || month < 1) {
        alert("Please enter a valid month number.");
        return;
    }

    const monthWinners = winnerRecords.filter(function (record) {
        return Number(record.month) === month;
    });

    if (!monthWinners.length) {
        alert(`No winner records were found for month ${month}.`);
        return;
    }

    let message = `Winners recorded for Month ${month}:\n\n`;
    monthWinners.forEach(function (record, index) {
        message += `${index + 1}. Ticket ${record.ticket || record.ticketNumber || "-"} - ${record.memberName || "Member"}\n`;
    });
    message += "\nEnter the ticket number to remove:";

    const ticketInput = prompt(message);
    if (ticketInput === null) return;

    const ticket = String(ticketInput).trim();
    const record = monthWinners.find(function (item) {
        return String(item.ticket ?? item.ticketNumber ?? "").trim() === ticket;
    });

    if (!record) {
        alert(`Ticket ${ticket} is not a winner in month ${month}.`);
        return;
    }

    removeMonthlyWinner(record.id);
}

function removeMonthlyWinner(recordId) {
    if (!currentScheme) {
        alert("Unable to identify the current scheme.");
        return;
    }

    const allRecords = getWinnerRecords(currentScheme);
    const recordIndex = allRecords.findIndex(function (record) {
        return String(record.id) === String(recordId) &&
            String(record.status || "winner").toLowerCase() === "winner";
    });

    if (recordIndex === -1) {
        alert("The selected winner record was not found.");
        return;
    }

    const winner = allRecords[recordIndex];
    const month = Number(winner.month);
    const ticket = String(winner.ticket ?? winner.ticketNumber ?? "").trim();
    const memberName = winner.memberName || "Member";

    const confirmed = confirm(
        `Remove winner?\n\n` +
        `Month: ${month}\n` +
        `Ticket: ${ticket}\n` +
        `Winner: ${memberName}\n\n` +
        `This will undo the winner status for this ticket and make the ticket eligible again for future months in this chit.`
    );

    if (!confirmed) return;

    // Remove only the selected winner record.
    allRecords.splice(recordIndex, 1);
    replaceSchemeWinnerRecords(currentScheme, allRecords);

    // Restore eligibility on the exact ticket/chit membership.
    // If another winner record for the same ticket somehow remains, keep
    // the ticket marked as won. Under the normal rules there will be none.
    const stillWinner = allRecords.some(function (record) {
        return String(record.status || "winner").toLowerCase() === "winner" &&
            String(record.ticket ?? record.ticketNumber ?? "").trim() === ticket;
    });

    const members = getAllMembers();

    members.forEach(function (member) {
        if (!Array.isArray(member.schemes)) return;

        member.schemes.forEach(function (item) {
            const sameScheme =
                String(item.id) === String(currentScheme.id) ||
                String(item.name || "").trim().toLowerCase() === String(currentScheme.name || "").trim().toLowerCase();

            const sameTicket = String(
                item.ticket ?? item.ticketNumber ?? item.ticketNo
            ).trim() === ticket;

            if (sameScheme && sameTicket && !stillWinner) {
                delete item.winningMonth;
                delete item.chitTaken;
                delete item.takenPayment;
                delete item.winnerPayout;
            }
        });
    });

    localStorage.setItem("chitfund_members", JSON.stringify(members));

    // Recalculate every unpaid ledger installment from the winning month
    // onward. Paid installments remain historical and are never changed.
    if (typeof window.refreshPendingPaymentAmountsForWinner === "function") {
        window.refreshPendingPaymentAmountsForWinner(currentScheme, record);
    }
    if (typeof window.fintrackAudit === "function") window.fintrackAudit("winner.added", "Winner recorded", {schemeId: currentScheme.id, ticket, memberId: winnerEntry.member.id, month, payout, winnerPayment});

    renderMonthlyWinners(currentScheme);
    renderMembers(currentScheme);
    updateMemberProgress(currentScheme);

    alert(
        `Winner removed successfully.\n\n` +
        `Ticket ${ticket} is eligible again for future winner selection in this chit.`
    );
}

function updateMonthlyWinner() {

    if (typeof window.fintrackIsSchemeFinalized === "function" && window.fintrackIsSchemeFinalized(currentScheme)) { alert("This scheme is finalized. Winner changes are locked."); return; }

    if (!currentScheme) {
        alert("Unable to identify the current scheme.");
        return;
    }

    const duration = Number(currentScheme.duration) || 20;
    const chitEntries = getSchemeMembers(currentScheme);

    if (!chitEntries.length) {
        alert("Add at least one chit to this scheme before recording a winner.");
        return;
    }

    const monthInput = prompt(`Enter the winning month (1-${duration}):`);
    if (monthInput === null) return;

    const month = Number(monthInput.trim());

    if (!Number.isInteger(month) || month < 1 || month > duration) {
        alert(`Please enter a month between 1 and ${duration}.`);
        return;
    }

    const allRecords = getWinnerRecords(currentScheme);
    const monthRecords = getMonthWinnerRecords(currentScheme, month);
    const stoppedRecord = allRecords.find(function (record) {
        return Number(record.month) === month &&
            String(record.status || "").toLowerCase() === "stopped";
    });

    // A month may have any number of different winners.
    // A ticket may win only once in this chit/scheme.
    // Other tickets owned by the same member remain eligible.
    const schemeWinnerRecords = allRecords.filter(function (record) {
        return String(record.status || "winner").toLowerCase() === "winner";
    });

    const previouslyWonTickets = new Set(
        schemeWinnerRecords.map(function (record) {
            return String(record.ticket ?? record.ticketNumber ?? "").trim();
        }).filter(Boolean)
    );

    let message = "Available chits:\n\n";
    const availableEntries = [];

    chitEntries.forEach(function (entry) {
        const ticket = entry.scheme.ticket ?? entry.scheme.ticketNumber ?? entry.scheme.ticketNo ?? "-";
        const name = entry.member.name || entry.member.fullName || "Unknown";
        const ticketKey = String(ticket).trim();
        const alreadyWonThisScheme = previouslyWonTickets.has(ticketKey);
        if (!alreadyWonThisScheme) {
            availableEntries.push(entry);
            message += `Ticket ${ticket} - ${name}\n`;
        }
    });

    if (!availableEntries.length) {
        alert(`There are no eligible tickets available for Month ${month}.\n\nA ticket that has already won in this chit cannot participate again.`);
        return;
    }

    const ticketInput = prompt(
        message +
        `\nMonth ${month} currently has ${monthRecords.length} winner(s).\n` +
        `There is no limit on the number of different winners in a month.\n` +
        `Enter the ticket number that won:`
    );

    if (ticketInput === null) return;

    const ticket = String(ticketInput).trim();

    const winnerEntry = chitEntries.find(function (entry) {
        const entryTicket = entry.scheme.ticket ?? entry.scheme.ticketNumber ?? entry.scheme.ticketNo;
        return String(entryTicket).trim() === ticket;
    });

    if (!winnerEntry) {
        alert(`Ticket ${ticket} was not found in this scheme.`);
        return;
    }

    const duplicateTicketThisScheme = schemeWinnerRecords.some(function (record) {
        return String(record.ticket ?? record.ticketNumber ?? "").trim() === ticket;
    });

    if (duplicateTicketThisScheme) {
        alert(`Ticket ${ticket} has already won in this chit and is no longer eligible for any future month.`);
        return;
    }

    const duplicateTicketThisMonth = monthRecords.some(function (record) {
        return String(record.ticket ?? record.ticketNumber ?? "").trim() === ticket;
    });

    if (duplicateTicketThisMonth) {
        alert(`Ticket ${ticket} is already a winner for month ${month}. Select another ticket.`);
        return;
    }

    const memberName = winnerEntry.member.name || winnerEntry.member.fullName || "Member";
    const isGoldChit = String(currentScheme.type || "").toLowerCase() === "gold";
    const goldGrams = getGoldChitGrams(currentScheme);
    const payout = isGoldChit ? goldGrams : calculateWinningPayout(currentScheme.totalAmount, month);
    const winnerPayment = isGoldChit
        ? Number((currentScheme.goldMonthlyInstallments || {})[String(month)] ?? (currentScheme.goldMonthlyInstallments || {})[month] ?? 0)
        : calculateWinnerPayment(currentScheme.totalAmount);

    const confirmation =
        `Month ${month}\n\n` +
        `Winner ${monthRecords.length + 1}: ${memberName}\n` +
        `Ticket: ${ticket}\n` +
        `Winning payout: ${isGoldChit ? formatGoldPayout(currentScheme, goldGrams) : formatCurrency(payout)}\n` +
        `Payment for month ${month}: ${formatCurrency(winnerPayment)}\n\n` +
        (stoppedRecord
            ? "This month was previously stopped. Add this winner and resume the month?"
            : "Save this winner?");

    if (!confirm(confirmation)) return;

    const records = allRecords.filter(function (record) {
        return !(Number(record.month) === month &&
            String(record.status || "").toLowerCase() === "stopped");
    });

    const record = {
        id: Date.now(),
        schemeId: currentScheme.id,
        scheme: currentScheme.name,
        month: month,
        ticket: ticket,
        memberId: winnerEntry.member.id,
        memberName: memberName,
        payout: payout,
        goldGrams: isGoldChit ? goldGrams : 0,
        winnerPayment: winnerPayment,
        status: "winner",
        updatedAt: new Date().toISOString()
    };

    records.push(record);
    replaceSchemeWinnerRecords(currentScheme, records);

    /* Store winning month on the exact ticket/chit. */
    const members = getAllMembers();

    members.forEach(function (member) {
        if (!Array.isArray(member.schemes)) return;

        member.schemes.forEach(function (item) {
            const sameScheme =
                String(item.id) === String(currentScheme.id) ||
                String(item.name || "").trim().toLowerCase() === String(currentScheme.name || "").trim().toLowerCase();

            const sameTicket = String(
                item.ticket ?? item.ticketNumber ?? item.ticketNo
            ).trim() === ticket;

            if (sameScheme && sameTicket) {
                item.winningMonth = month;
                item.chitTaken = true;
                item.takenPayment = winnerPayment;
                item.winnerPayout = payout;
            }
        });
    });

    localStorage.setItem("chitfund_members", JSON.stringify(members));
    if (typeof window.fintrackAudit === "function") window.fintrackAudit("winner.removed", "Winner removed", {schemeId: currentScheme.id, ticket, memberId: winner.memberId, month});

    renderMonthlyWinners(currentScheme);
    renderMembers(currentScheme);
    updateMemberProgress(currentScheme);

    alert(
        `Month ${month} winner ${monthRecords.length + 1} recorded successfully.\n\n` +
        `Ticket ${ticket} is now permanently ineligible for future winner selection in this chit.`
    );
}

function stopWinnerMonth() {

    if (typeof window.fintrackIsSchemeFinalized === "function" && window.fintrackIsSchemeFinalized(currentScheme)) { alert("This scheme is finalized. Winner changes are locked."); return; }

    if (!currentScheme) return;

    const duration = Number(currentScheme.duration) || 20;
    const input = prompt(`Enter the month to stop/skip (1-${duration}):`);
    if (input === null) return;

    const month = Number(input.trim());
    if (!Number.isInteger(month) || month < 1 || month > duration) {
        alert(`Please enter a month between 1 and ${duration}.`);
        return;
    }

    const existing = getWinnerRecords(currentScheme);
    const monthWinners = getMonthWinnerRecords(currentScheme, month);

    if (monthWinners.length && !confirm(`Month ${month} already has ${monthWinners.length} winner(s). Stopping this month will remove those winner records. Continue?`)) {
        return;
    }

    const reason = prompt("Optional reason for stopping this month:") || "Admin stopped payout for this month";
    const removedTickets = monthWinners.map(function (winner) { return String(winner.ticket || "").trim(); });

    const schemeRecords = existing.filter(function (record) {
        return Number(record.month) !== month;
    });

    schemeRecords.push({
        id: Date.now(),
        schemeId: currentScheme.id,
        scheme: currentScheme.name,
        month: month,
        status: "stopped",
        reason: reason,
        updatedAt: new Date().toISOString()
    });

    replaceSchemeWinnerRecords(currentScheme, schemeRecords);

    if (removedTickets.length) {
        const members = getAllMembers();
        members.forEach(function (member) {
            if (!Array.isArray(member.schemes)) return;
            member.schemes.forEach(function (item) {
                const sameScheme =
                    String(item.id) === String(currentScheme.id) ||
                    String(item.name || "").trim().toLowerCase() === String(currentScheme.name || "").trim().toLowerCase();
                const ticket = String(item.ticket ?? item.ticketNumber ?? item.ticketNo ?? "").trim();
                if (sameScheme && removedTickets.includes(ticket) && Number(item.winningMonth) === month) {
                    delete item.winningMonth;
                    delete item.chitTaken;
                    delete item.takenPayment;
                    delete item.winnerPayout;
                }
            });
        });
        localStorage.setItem("chitfund_members", JSON.stringify(members));
    }

    renderMonthlyWinners(currentScheme);
    renderMembers(currentScheme);
    updateMemberProgress(currentScheme);

    alert(`Month ${month} is now stopped. No winner payout will be recorded for that month.`);
}

function modifyStoppedMonth(recordId) {
    if (!currentScheme) return;

    const allRecords = getWinnerRecords(currentScheme);
    let stoppedRecord = null;

    if (recordId !== undefined && recordId !== null) {
        stoppedRecord = allRecords.find(function (record) {
            return String(record.id) === String(recordId) &&
                String(record.status || "").toLowerCase() === "stopped";
        });
    } else {
        const duration = Number(currentScheme.duration) || 20;
        const input = prompt(`Enter the stopped/skipped month to modify (1-${duration}):`);
        if (input === null) return;

        const month = Number(input.trim());
        if (!Number.isInteger(month) || month < 1 || month > duration) {
            alert(`Please enter a month between 1 and ${duration}.`);
            return;
        }

        stoppedRecord = allRecords.find(function (record) {
            return Number(record.month) === month &&
                String(record.status || "").toLowerCase() === "stopped";
        });
    }

    if (!stoppedRecord) {
        alert("The selected month is not currently stopped/skipped.");
        return;
    }

    const month = Number(stoppedRecord.month);
    const currentReason = stoppedRecord.reason || "Admin stopped payout for this month";

    const resume = confirm(
        `Month ${month} is currently stopped/skipped.\n\n` +
        `Click OK to resume the month and make it available for winner entry.\n` +
        `Click Cancel to keep it stopped and edit its reason.`
    );

    if (resume) {
        const updatedRecords = allRecords.filter(function (record) {
            return String(record.id) !== String(stoppedRecord.id);
        });
        replaceSchemeWinnerRecords(currentScheme, updatedRecords);

        renderMonthlyWinners(currentScheme);
        renderMembers(currentScheme);
        updateMemberProgress(currentScheme);

        alert(`Month ${month} has been resumed. You can now add winner(s) for this month.`);
        return;
    }

    const newReason = prompt("Update the reason for this stopped/skipped month:", currentReason);
    if (newReason === null) return;

    stoppedRecord.reason = String(newReason).trim() || currentReason;
    stoppedRecord.updatedAt = new Date().toISOString();
    replaceSchemeWinnerRecords(currentScheme, allRecords);

    renderMonthlyWinners(currentScheme);
    alert(`Month ${month} stop/skip details updated successfully.`);
}

function getPaymentDueDateForSchemeDetails(scheme, installmentMonth) {
    if (typeof window.getFintrackDueDate === "function") {
        return window.getFintrackDueDate(scheme, installmentMonth);
    }
    if (!scheme || !scheme.startDate) return "";
    const month = Number(installmentMonth || 0);
    if (!Number.isInteger(month) || month < 1) return "";
    const [y,m,d] = String(scheme.startDate).split("-").map(Number);
    if (![y,m,d].every(Number.isFinite)) return "";
    const map={1:10,5:15,10:20,15:25,25:5};
    const date=new Date(y,m-1,1); date.setMonth(date.getMonth()+month-1);
    if(d===25){date.setMonth(date.getMonth()+1);date.setDate(5);} else if(map[d]) date.setDate(map[d]); else date.setDate(Math.min(d+10,new Date(date.getFullYear(),date.getMonth()+1,0).getDate()));
    return toISODateForSchemeDetails(date);
}

function toISODateForSchemeDetails(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function renderSchemePayments(scheme) {

    const tbody = document.getElementById("paymentsTable");
    if (!tbody) return;

    // Keep the Payments tab in sync with the global payment ledger.
    if (typeof window.syncInstallmentPaymentRecords === "function") {
        window.syncInstallmentPaymentRecords();
    }

    let records = getSchemeHistoryRecords("chitfund_payments", scheme);

    // If the payment page has not been opened yet, create the pending
    // installment records here as a fallback for this scheme.
    const allMembers = getAllMembers();
    const storedPayments = JSON.parse(localStorage.getItem("chitfund_payments") || "[]");
    let changed = false;

    allMembers.forEach(function (member) {
        if (!Array.isArray(member.schemes)) return;
        member.schemes.forEach(function (entry) {
            const sameScheme =
                String(entry?.id ?? "") === String(scheme?.id ?? "") ||
                String(entry?.name || "").trim().toLowerCase() === String(scheme?.name || "").trim().toLowerCase();
            if (!sameScheme) return;

            const ticket = entry.ticket ?? entry.ticketNumber ?? entry.ticketNo;
            if (ticket === undefined || ticket === null || String(ticket).trim() === "") return;

            const duration = Math.max(0, Number(scheme.duration || 0));
            for (let month = 1; month <= duration; month++) {
                const exists = storedPayments.some(function (payment) {
                    const sameMember =
                        (payment.memberId != null && member.id != null && String(payment.memberId) === String(member.id)) ||
                        String(payment.member || "").trim().toLowerCase() === String(member.name || "").trim().toLowerCase();
                    const sameScheme =
                        (payment.schemeId != null && scheme.id != null && String(payment.schemeId) === String(scheme.id)) ||
                        String(payment.scheme || "").trim().toLowerCase() === String(scheme.name || "").trim().toLowerCase();
                    return sameMember && sameScheme && String(payment.ticket ?? "") === String(ticket) && Number(payment.month) === month;
                });

                if (!exists) {
                    let amount = 0;
                    if (String(scheme.type || "").toLowerCase() === "gold") {
                        const amounts = scheme.goldMonthlyInstallments || {};
                        amount = Number(amounts[String(month)] ?? amounts[month] ?? 0) || 0;
                    } else {
                        const winner = getWinnerRecords(scheme).find(function (item) {
                            return String(item.ticket ?? "") === String(ticket) && Number(item.month) <= month && String(item.status || "winner").toLowerCase() === "winner";
                        });
                        amount = Number(scheme.totalAmount || 0) * (winner ? 0.06 : 0.05);
                        amount = Math.round(amount);
                    }

                    storedPayments.push({
                        id: Date.now() + Math.floor(Math.random() * 10000),
                        memberId: member.id ?? null,
                        member: member.name || "",
                        email: member.email || "",
                        schemeId: scheme.id ?? null,
                        scheme: scheme.name || "",
                        ticket: ticket,
                        month: month,
                        dueDate: getPaymentDueDateForSchemeDetails(scheme, month),
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
                    });
                    changed = true;
                }
            }
        });
    });

    if (changed) {
        localStorage.setItem("chitfund_payments", JSON.stringify(storedPayments));
        records = getSchemeHistoryRecords("chitfund_payments", scheme);
    }

    records.sort(function (a, b) {
        const monthDiff = Number(a.month || 0) - Number(b.month || 0);
        if (monthDiff !== 0) return monthDiff;
        return String(a.ticket || "").localeCompare(String(b.ticket || ""));
    });

    tbody.innerHTML = "";

    if (!records.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="no-members">
                    No installment records found for this scheme yet.
                </td>
            </tr>`;
        return;
    }

    records.forEach(function (payment) {
        const status = String(payment.status || "pending").toLowerCase() === "paid" ? "Paid" : "Pending";
        const dueDate = payment.dueDate || getPaymentDueDateForSchemeDetails(scheme, payment.month);

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeHTML(payment.member || payment.memberName || "-")}</td>
            <td>${escapeHTML(payment.ticket ?? "-")}</td>
            <td>${escapeHTML(payment.month ?? "-")}</td>
            <td>${escapeHTML(formatDate(dueDate))}</td>
            <td>${formatCurrency(Number(payment.amount || 0))}</td>
            <td>${escapeHTML(payment.paymentDate || payment.paidDate ? formatDate(payment.paymentDate || payment.paidDate) : "-")}</td>
            <td><span class="payment-status status-${status.toLowerCase()}">${status}</span></td>
        `;
        tbody.appendChild(row);
    });
}

function addPayment() {

    if (!currentScheme) return;

    window.location.href =
        "payments.html?schemeId=" +
        encodeURIComponent(currentScheme.id);
}

/* =========================================================
   REFRESH
   ========================================================= */

/* =========================================================
   GOLD CHIT - VARIABLE MONTHLY INSTALLMENTS
========================================================= */

function renderGoldMonthlyInstallments(scheme) {
    const card = document.getElementById("goldInstallmentsCard");
    const grid = document.getElementById("goldInstallmentsGrid");
    if (!card || !grid) return;

    const isGold = String(scheme?.type || "").toLowerCase() === "gold";
    card.style.display = isGold ? "block" : "none";

    if (!isGold) {
        grid.innerHTML = "";
        return;
    }

    const amounts = scheme.goldMonthlyInstallments || {};
    const duration = Math.max(0, Number(scheme.duration || 0));
    grid.innerHTML = "";

    for (let month = 1; month <= duration; month++) {
        const value = amounts[String(month)] ?? amounts[month] ?? "";
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#fff;";
        wrapper.innerHTML = `
            <label style="display:block;font-size:12px;font-weight:600;margin-bottom:7px;color:#374151;">
                Month ${month} Installment
            </label>
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-weight:600;">₹</span>
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    class="gold-monthly-installment"
                    data-month="${month}"
                    value="${String(value)}"
                    placeholder="Enter amount"
                    style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;">
            </div>`;
        grid.appendChild(wrapper);
    }
}

function saveGoldMonthlyInstallments() {
    if (!currentScheme) return;

    const isGold = String(currentScheme.type || "").toLowerCase() === "gold";
    if (!isGold) return;

    const inputs = document.querySelectorAll(".gold-monthly-installment");
    const amounts = {};
    let hasInvalid = false;

    inputs.forEach(function (input) {
        const month = Number(input.dataset.month);
        const raw = String(input.value || "").trim();

        if (!raw) return;

        const amount = Number(raw);
        if (!Number.isFinite(amount) || amount < 0) {
            hasInvalid = true;
            return;
        }

        amounts[String(month)] = amount;
    });

    if (hasInvalid) {
        alert("Please enter valid monthly installment amounts.");
        return;
    }

    currentScheme.goldMonthlyInstallments = amounts;
    // Keep baseAmount at zero for Gold Chit because there is no fixed monthly amount.
    currentScheme.baseAmount = 0;

    const schemes = JSON.parse(localStorage.getItem("chitfund_schemes") || "[]");
    const index = schemes.findIndex(function (scheme) {
        return String(scheme.id) === String(currentScheme.id);
    });

    if (index !== -1) {
        schemes[index] = currentScheme;
        localStorage.setItem("chitfund_schemes", JSON.stringify(schemes));
    }

    renderScheme(currentScheme);
    alert("Gold Chit monthly installments saved successfully.");
}

function refreshScheme() {

    loadScheme();
}


/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.loadScheme =
    loadScheme;

window.renderScheme =
    renderScheme;

window.setStatus =
    setStatus;

window.updateMemberProgress =
    updateMemberProgress;

window.renderMembers =
    renderMembers;

window.addMember =
    addMember;

window.deleteMemberFromScheme =
    deleteMemberFromScheme;

window.goBack =
    goBack;

window.refreshScheme =
    refreshScheme;

window.renderGoldMonthlyInstallments = renderGoldMonthlyInstallments;
window.saveGoldMonthlyInstallments = saveGoldMonthlyInstallments;

window.getSchemeMembers =
    getSchemeMembers;

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

window.switchTab = switchTab;
window.renderMonthlyWinners = renderMonthlyWinners;
window.updateMonthlyWinner = updateMonthlyWinner;
window.removeMonthlyWinner = removeMonthlyWinner;
window.stopWinnerMonth = stopWinnerMonth;
window.removeWinnerFromToolbar = removeWinnerFromToolbar;
window.modifyStoppedMonth = modifyStoppedMonth;
window.renderSchemePayments = renderSchemePayments;
window.addPayment = addPayment;

/* =========================================================
   EDIT SCHEME FROM DETAILS
========================================================= */
function editScheme() {
    const scheme = currentScheme || (typeof getCurrentScheme === "function" ? getCurrentScheme() : null);
    if (!scheme) { alert("Scheme not found."); return; }
    window.location.href = `schemes.html?editSchemeId=${encodeURIComponent(scheme.id)}`;
}
