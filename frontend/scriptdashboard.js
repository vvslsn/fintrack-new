"use strict";

/* =========================================================
   FINTRACK DASHBOARD JAVASCRIPT
========================================================= */


/* =========================================================
   GLOBAL DATA
========================================================= */

let currentUser = null;

let schemes = [];

let winners = [];

let payments = [];


/* =========================================================
   PAGE LOAD
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    loadUser();

    loadSchemes();

    loadWinners();

    loadPayments();

    setCurrentDate();

    renderDashboard();

    setupProfilePhoto();

});

// Keep the dashboard in sync when a winner/payment is changed in another page/tab.
window.addEventListener("storage", function (event) {
    if (["chitfund_winners", "chitfund_payments", "chitfund_members", "chitfund_schemes"].includes(event.key)) {
        loadSchemes();
        loadWinners();
        loadPayments();
        renderDashboard();
    }
});


/* =========================================================
   LOAD USER
========================================================= */

function loadUser() {

    const savedUser =
        localStorage.getItem("fintrackUser");

    if (!savedUser) {

        console.warn(
            "No FinTrack user found."
        );

        return;

    }

    try {

        currentUser =
            JSON.parse(savedUser);

        updateUserDetails();

        loadProfileDetails();

    }
    catch (error) {

        console.error(
            "Unable to load user:",
            error
        );

    }

}


/* =========================================================
   UPDATE HEADER USER DETAILS
========================================================= */

function updateUserDetails() {

    if (!currentUser) {
        return;
    }

    const name =
        currentUser.fullName ||
        currentUser.name ||
        currentUser.username ||
        "User";


    /* Header username */

    const headerUserName =
        document.getElementById(
            "headerUserName"
        );

    if (headerUserName) {

        headerUserName.textContent =
            name;

    }


    /* Header avatar */

    const headerAvatar =
        document.getElementById(
            "headerAvatar"
        );

    if (headerAvatar) {

        if (currentUser.profilePhoto) {

            headerAvatar.innerHTML = `
                <img
                    src="${escapeHTML(
                        currentUser.profilePhoto
                    )}"
                    alt="Profile"
                    style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                        border-radius:50%;
                    "
                >
            `;

        }
        else {

            headerAvatar.textContent =
                name
                    .charAt(0)
                    .toUpperCase();

        }

    }


    /* Welcome message */

    const welcomeName =
        document.getElementById(
            "welcomeName"
        );

    if (welcomeName) {

        welcomeName.textContent =
            "Welcome back, " +
            name +
            "!";

    }

}


/* =========================================================
   CURRENT DATE
========================================================= */

function setCurrentDate() {

    const element =
        document.getElementById(
            "currentDate"
        );

    if (!element) {
        return;
    }

    const today =
        new Date();

    element.textContent =
        today.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

}


/* =========================================================
   LOAD SCHEMES
========================================================= */

function loadSchemes() {

    const saved = localStorage.getItem("chitfund_schemes");

    if (!saved) {
        schemes = [];
        return;
    }

    try {

        const data =
            JSON.parse(saved);

        if (Array.isArray(data)) {

            schemes = data;

        }
        else {

            schemes = [];

        }

    }
    catch (error) {

        console.error(
            "Unable to load schemes:",
            error
        );

        schemes = [];

    }

}


/* =========================================================
   LOAD WINNERS
========================================================= */

function loadWinners() {
    /* Load the monthly winner ledger used by the dashboard. */
    try {
        const saved =
            localStorage.getItem("chitfund_winners");

        winners =
            saved ? JSON.parse(saved) : [];

        if (!Array.isArray(winners)) {
            winners = [];
        }
    } catch (error) {
        winners = [];
    }
}


/* =========================================================
   MONTHLY WINNER DASHBOARD
========================================================= */

function getDashboardSchemeForWinner(winner) {
    const schemeId = winner?.schemeId;
    let scheme = null;

    if (typeof window.fintrackGetScheme === "function" && schemeId != null) {
        scheme = window.fintrackGetScheme(schemeId);
    }

    if (!scheme && Array.isArray(schemes)) {
        scheme = schemes.find(function (item) {
            return String(item?.id ?? item?.schemeId ?? "") === String(schemeId ?? "");
        }) || null;
    }

    // Backward compatibility for older winner records that only stored the scheme name.
    if (!scheme && winner?.scheme && Array.isArray(schemes)) {
        const name = String(winner.scheme).trim().toLowerCase();
        scheme = schemes.find(function (item) {
            return String(item?.name || "").trim().toLowerCase() === name;
        }) || null;
    }

    return scheme;
}

function getDashboardWinnerDisplay(winner) {
    const scheme = getDashboardSchemeForWinner(winner);
    const type = typeof window.normalizeChitType === "function"
        ? window.normalizeChitType(scheme?.type || winner?.type || "cash")
        : String(scheme?.type || winner?.type || "cash").toLowerCase();
    const month = Number(winner?.month || 0);

    let value = 0;
    if (typeof window.fintrackWinnerPayout === "function") {
        value = Number(window.fintrackWinnerPayout(scheme, month, winner) || 0);
    } else if (type === "gold") {
        value = Number(winner?.goldGrams || scheme?.goldGrams || 0);
    } else {
        value = Number(winner?.payout || 0);
    }

    if (type === "gold") {
        return {
            type: "gold",
            label: "Gold Chit",
            icon: "🪙",
            detail: `Winning: ${value > 0 ? value + " gram" + (value === 1 ? "" : "s") : "-"}`,
            value: value > 0 ? `${value} gram${value === 1 ? "" : "s"}` : "-"
        };
    }

    return {
        type: "cash",
        label: "Cash Chit",
        icon: "💵",
        detail: `Winning Amount: ${currency(value)}`,
        value: currency(value)
    };
}

function renderUpcomingWinners() {
    const container = document.getElementById("winnerList");
    const empty = document.getElementById("noWinners");
    if (!container) return;

    container.innerHTML = "";

    const recentWinners = Array.isArray(winners)
        ? [...winners]
            .filter(function (winner) {
                return String(winner?.status || "winner").toLowerCase() === "winner";
            })
            .sort(function (a, b) {
                return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
            })
            .slice(0, 8)
        : [];

    if (!recentWinners.length) {
        if (empty) empty.style.display = "flex";
        return;
    }

    if (empty) empty.style.display = "none";

    recentWinners.forEach(function (winner) {
        const display = getDashboardWinnerDisplay(winner);
        const item = document.createElement("div");
        item.className = "winner-item";
        item.innerHTML = `
            <div class="winner-icon ${display.type}">${display.icon}</div>
            <div class="winner-info">
                <span class="winner-type ${display.type}">${display.label}</span>
                <strong>Month ${escapeHTML(String(winner.month || "-"))} · Ticket ${escapeHTML(String(winner.ticket || winner.ticketNumber || "-"))}</strong>
                <small>${escapeHTML(display.detail)}</small>
            </div>
            <div class="winner-date">
                <strong>${escapeHTML(winner.memberName || "Winner")}</strong>
                <small class="winner-prize ${display.type}">${escapeHTML(display.value)}</small>
            </div>
        `;
        container.appendChild(item);
    });
}


/* =========================================================
   LOAD PAYMENTS
========================================================= */


function loadPayments() {

    const saved =
        localStorage.getItem(
            "chitfund_payments"
        );

    if (!saved) {

        payments = [];

        return;

    }

    try {

        const data =
            JSON.parse(saved);

        if (Array.isArray(data)) {

            payments = data;

        }
        else {

            payments = [];

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


/* =========================================================
   RENDER DASHBOARD
========================================================= */

function renderDashboard() {

    renderStatistics();

    renderActiveSchemes();

    renderPayments();

    renderUpcomingWinners();

}


/* =========================================================
   DASHBOARD PAYMENT RULES
========================================================= */

function getDashboardPaymentScheme(payment) {
    if (!payment) return null;

    if (typeof window.fintrackGetScheme === "function" && payment.schemeId != null) {
        const byId = window.fintrackGetScheme(payment.schemeId);
        if (byId) return byId;
    }

    return schemes.find(function (scheme) {
        return (
            (payment.schemeId != null && scheme.id != null &&
                String(payment.schemeId) === String(scheme.id)) ||
            String(payment.scheme || "").trim().toLowerCase() ===
                String(scheme.name || "").trim().toLowerCase()
        );
    }) || null;
}

function isDashboardPaymentPaid(payment) {
    const status = String(payment?.status || "pending").toLowerCase();
    return status === "paid" || status === "completed";
}

function isDashboardPaymentDue(payment) {
    if (!payment || isDashboardPaymentPaid(payment)) return false;

    const scheme = getDashboardPaymentScheme(payment);
    let dueDate = payment.dueDate || "";

    if (scheme && typeof window.getFintrackDueDate === "function") {
        dueDate = window.getFintrackDueDate(scheme, Number(payment.month || 0)) || dueDate;
    }

    if (!dueDate) return false;

    if (typeof window.fintrackDateReached === "function") {
        return window.fintrackDateReached(dueDate);
    }

    const parts = String(dueDate).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return false;
    const due = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return due.getTime() <= todayOnly.getTime();
}

function getDashboardPaymentAmount(payment) {
    if (!payment) return 0;

    // Paid receipts are historical records. Never recalculate them.
    if (isDashboardPaymentPaid(payment)) {
        return Number(payment.amount || 0);
    }

    const scheme = getDashboardPaymentScheme(payment);
    if (!scheme || typeof window.fintrackPaymentAmount !== "function") {
        return Number(payment.amount || 0);
    }

    const member =
        typeof window.fintrackGetMember === "function" && payment.memberId != null
            ? window.fintrackGetMember(payment.memberId)
            : null;

    const ticket = payment.ticket ?? payment.ticketNumber ?? payment.ticketNo ?? "";
    const calculated = Number(
        window.fintrackPaymentAmount(
            scheme,
            Number(payment.month || 0),
            member,
            ticket
        ) || 0
    );

    return calculated > 0 ? calculated : Number(payment.amount || 0);
}

function getDashboardVisiblePayments() {
    return (Array.isArray(payments) ? payments : []).filter(function (payment) {
        // Payment History: show completed/paid history.
        if (isDashboardPaymentPaid(payment)) return true;

        // Upcoming Dues: do NOT show future installments.
        // Show an unpaid installment only after its due date is reached.
        return isDashboardPaymentDue(payment);
    });
}

/* =========================================================
   STATISTICS
========================================================= */

function renderStatistics() {

    /* -----------------------------------------
       ACTIVE SCHEMES
    ----------------------------------------- */

    const activeSchemes =
        schemes.filter(function (scheme) {

            return (
                String(
                    scheme.status || ""
                ).toLowerCase() === "active"
            );

        });


    /* -----------------------------------------
       TOTAL INVESTED
    ----------------------------------------- */

    let totalInvested = 0;


    payments.forEach(function (payment) {

        const status =
            String(
                payment.status || ""
            ).toLowerCase();


        if (
            status === "paid" ||
            status === "completed"
        ) {

            totalInvested +=
                Number(
                    payment.amount || 0
                );

        }

    });


    /* -----------------------------------------
       WINNER PAYOUTS / GOLD DISBURSEMENTS
       Status-aware: paid and pending disbursements are tracked separately.
    ----------------------------------------- */
    let cashPayouts = 0, cashPending = 0, goldPaidGrams = 0, goldPendingGrams = 0;
    const adminPayoutRows = typeof window.fintrackRead === "function"
        ? window.fintrackRead("chitfund_admin_payouts", []) : [];
    if (Array.isArray(adminPayoutRows) && adminPayoutRows.length) {
        adminPayoutRows.forEach(function (item) {
            const isGold = String(item.type || "").toLowerCase() === "gold";
            const status = String(item.status || "pending").toLowerCase();
            if (isGold) {
                const grams = Number(item.goldGrams || 0) || 0;
                if (status === "paid" || status === "completed") goldPaidGrams += grams;
                else if (status === "pending") goldPendingGrams += grams;
            } else {
                const amount = Number(item.amount || 0) || 0;
                if (status === "paid" || status === "completed") cashPayouts += amount;
                else if (status === "pending") cashPending += amount;
            }
        });
    } else {
        winners.forEach(function (winner) {
            if (String(winner.status || "winner").toLowerCase() !== "winner") return;
            const scheme = schemes.find(s => String(s.id) === String(winner.schemeId)) || {};
            const type = typeof window.normalizeChitType === "function" ? window.normalizeChitType(scheme.type) : "cash";
            if (type === "gold") goldPendingGrams += Number(typeof window.fintrackGoldGrams === "function" ? window.fintrackGoldGrams(scheme,winner) : (winner.goldGrams||scheme.goldGrams||0)) || 0;
            else cashPending += Number(winner.payout || (typeof window.fintrackWinnerPayout === "function" ? window.fintrackWinnerPayout(scheme,winner.month,winner) : 0)) || 0;
        });
    }

    /* -----------------------------------------
       PENDING PAYMENTS
    ----------------------------------------- */

    let pendingPayments = 0;


    // Pending Payments means money that is actually unpaid AND already due.
    // Future installments must not inflate this card.
    getDashboardVisiblePayments().forEach(function (payment) {
        if (!isDashboardPaymentPaid(payment)) {
            pendingPayments += getDashboardPaymentAmount(payment);
        }
    });


    /* -----------------------------------------
       DISPLAY
    ----------------------------------------- */

    setText(
        "totalInvested",
        currency(totalInvested)
    );


    setText(
        "activeChits",
        activeSchemes.length
    );


    const cashLabel = cashPayouts > 0
        ? currency(cashPayouts) + " paid" + (cashPending > 0 ? " + " + currency(cashPending) + " pending" : "")
        : cashPending > 0 ? currency(cashPending) + " pending" : "";
    const goldLabel = goldPaidGrams > 0
        ? goldPaidGrams + "g Gold paid" + (goldPendingGrams > 0 ? " + " + goldPendingGrams + "g pending" : "")
        : goldPendingGrams > 0 ? goldPendingGrams + "g Gold pending" : "";
    setText("totalDividends", [cashLabel,goldLabel].filter(Boolean).join(" + ") || "₹0");


    setText(
        "pendingPayments",
        currency(pendingPayments)
    );

}


/* =========================================================
   ACTIVE CHIT SCHEMES
========================================================= */

function renderActiveSchemes() {

    const container =
        document.getElementById(
            "activeChitsList"
        );

    const empty =
        document.getElementById(
            "noActiveChits"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    const activeSchemes =
        schemes.filter(function (scheme) {

            return (
                String(
                    scheme.status || ""
                ).toLowerCase() === "active"
            );

        });


    if (activeSchemes.length === 0) {

        if (empty) {

            empty.style.display =
                "flex";

        }

        return;

    }


    if (empty) {

        empty.style.display =
            "none";

    }


    activeSchemes.forEach(
        function (scheme) {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "active-chit-item";


            const totalAmount =
                Number(
                    scheme.totalAmount || 0
                );


            const baseAmount =
                Number(
                    scheme.baseAmount || 0
                );


            const members =
                Number(
                    scheme.members || 0
                );


            const capacity =
                Number(
                    scheme.capacity || 0
                );


            item.innerHTML = `

                <div class="chit-info">

                    <strong>
                        ${escapeHTML(
                            scheme.name ||
                            "Unnamed Scheme"
                        )}
                    </strong>

                    <small>
                        ${escapeHTML(
                            scheme.type ||
                            "Chit Scheme"
                        )}
                    </small>

                </div>


                <div class="chit-details">

                    <span>
                        Total:
                        ${currency(totalAmount)}
                    </span>

                    <span>
                        Installment:
                        ${currency(baseAmount)}
                    </span>

                    <span>
                        Members:
                        ${members}/${capacity}
                    </span>

                </div>

            `;


            container.appendChild(
                item
            );

        }
    );

}


/* =========================================================
   UPCOMING WINNERS
========================================================= */

/* =========================================================
   PAYMENT TABLE
========================================================= */

function renderPayments() {

    const tableBody =
        document.getElementById(
            "paymentTableBody"
        );

    const empty =
        document.getElementById(
            "noPayments"
        );


    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = "";


    const visiblePayments = getDashboardVisiblePayments();

    if (visiblePayments.length === 0) {

        if (empty) {
            empty.style.display = "block";
        }

        return;
    }

    if (empty) {
        empty.style.display = "none";
    }

    const sortedPayments =
        [...visiblePayments]
            .sort(function (a, b) {
                const aDate = isDashboardPaymentPaid(a)
                    ? (a.paymentDate || a.updatedAt || a.dueDate || "")
                    : (a.dueDate || "");
                const bDate = isDashboardPaymentPaid(b)
                    ? (b.paymentDate || b.updatedAt || b.dueDate || "")
                    : (b.dueDate || "");
                return new Date(bDate) - new Date(aDate);
            })
            .slice(0, 10);


    sortedPayments.forEach(
        function (payment) {

            const row =
                document.createElement(
                    "tr"
                );


            const status =
                String(
                    payment.status ||
                    "pending"
                ).toLowerCase();


            let statusText =
                "Pending";


            if (
                status === "paid"
            ) {

                statusText =
                    "Paid";

            }
            else if (
                status === "completed"
            ) {

                statusText =
                    "Completed";

            }
            else if (
                status === "unpaid"
            ) {

                statusText =
                    "Unpaid";

            }


            row.innerHTML = `

                <td>
                    ${escapeHTML(
                        payment.scheme ||
                        "-"
                    )}
                </td>


                <td>
                    Month
                    ${escapeHTML(
                        payment.month ||
                        "-"
                    )}
                </td>


                <td>
                    ${formatDate(
                        payment.dueDate
                    )}
                </td>


                <td>
                    ${currency(
                        payment.amount
                    )}
                </td>


                <td>

                    <span
                        class="status-badge
                        ${escapeHTML(
                            status
                        )}"
                    >
                        ${statusText}
                    </span>

                </td>


                <td>

                    <button
                        type="button"
                        class="action-btn"
                        onclick="viewPayment(${Number(
                            payment.id || 0
                        )})"
                    >
                        View
                    </button>

                </td>

            `;


            tableBody.appendChild(
                row
            );

        }
    );

}


/* =========================================================
   VIEW PAYMENT
========================================================= */

function viewPayment(id) {

    const payment =
        payments.find(function (item) {

            return Number(item.id) ===
                Number(id);

        });


    if (!payment) {

        alert(
            "Payment record not found."
        );

        return;

    }


    alert(
        "Payment Details\n\n" +
        "Scheme: " +
        (payment.scheme || "-") +
        "\nInstallment: Month " +
        (payment.month || "-") +
        "\nAmount: " +
        currency(payment.amount) +
        "\nDue Date: " +
        formatDate(payment.dueDate) +
        "\nStatus: " +
        (payment.status || "Pending")
    );

}


/* =========================================================
   PROFILE MODAL
========================================================= */

function openProfileModal() {

    loadProfileDetails();

    const modal =
        document.getElementById(
            "profileModal"
        );


    if (modal) {

        modal.classList.add(
            "active"
        );

        modal.style.display =
            "flex";

    }

}


/* =========================================================
   LOAD PROFILE DETAILS
========================================================= */

function loadProfileDetails() {

    if (!currentUser) {
        return;
    }


    const name =
        currentUser.fullName ||
        currentUser.name ||
        currentUser.username ||
        "";


    const username =
        currentUser.username ||
        "";


    const email =
        currentUser.email ||
        "";


    const phone =
        currentUser.phone ||
        "";


    setInputValue(
        "profileName",
        name
    );


    setInputValue(
        "profileUsername",
        username
    );


    setInputValue(
        "profileEmail",
        email
    );


    setInputValue(
        "profilePhone",
        phone
    );


    const accountCreated =
        document.getElementById(
            "accountCreated"
        );


    if (accountCreated) {

        accountCreated.textContent =
            formatDateTime(
                currentUser.accountCreated
            );

    }


    const lastLogin =
        document.getElementById(
            "lastLogin"
        );


    if (lastLogin) {

        lastLogin.textContent =
            currentUser.lastLogin
                ? formatDateTime(
                    currentUser.lastLogin
                )
                : "-";

    }


    loadProfilePhoto();

}


/* =========================================================
   SAVE PROFILE
========================================================= */

function saveProfile() {

    if (!currentUser) {

        alert(
            "User account not found."
        );

        return;

    }


    const name =
        getInputValue(
            "profileName"
        ).trim();


    const email =
        getInputValue(
            "profileEmail"
        ).trim();


    const phone =
        getInputValue(
            "profilePhone"
        ).trim();


    if (!name) {

        alert(
            "Please enter your name."
        );

        return;

    }


    if (
        email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(email)
    ) {

        alert(
            "Please enter a valid email address."
        );

        return;

    }


    currentUser.fullName =
        name;


    currentUser.email =
        email;


    currentUser.phone =
        phone;


    localStorage.setItem(
        "fintrackUser",
        JSON.stringify(
            currentUser
        )
    );

    try {
        const accounts = JSON.parse(
            localStorage.getItem("fintrackAccounts") || "[]"
        );
        if (Array.isArray(accounts)) {
            localStorage.setItem(
                "fintrackAccounts",
                JSON.stringify(accounts.map(account =>
                    String(account.username || "").toLowerCase() ===
                    String(currentUser.username || "").toLowerCase()
                        ? currentUser
                        : account
                ))
            );
        }
    } catch (error) {
        console.warn("Could not update account list:", error);
    }


    updateUserDetails();

    alert(
        "Profile updated successfully."
    );


    closeModal(
        "profileModal"
    );

}


/* =========================================================
   PROFILE PHOTO
========================================================= */

function setupProfilePhoto() {

    const input =
        document.getElementById(
            "profilePhotoInput"
        );


    if (!input) {
        return;
    }


    input.addEventListener(
        "change",
        function (event) {

            const file =
                event.target.files[0];


            if (!file) {
                return;
            }


            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {

                alert(
                    "Please select an image file."
                );

                return;

            }


            const reader =
                new FileReader();


            reader.onload =
                function () {

                    const imageData =
                        reader.result;


                    currentUser.profilePhoto =
                        imageData;


                    localStorage.setItem(
                        "fintrackUser",
                        JSON.stringify(
                            currentUser
                        )
                    );

                    // Keep the master account record synchronized,
                    // including the newly selected profile photo.
                    try {
                        const accounts = JSON.parse(
                            localStorage.getItem("fintrackAccounts") || "[]"
                        );

                        if (Array.isArray(accounts)) {
                            localStorage.setItem(
                                "fintrackAccounts",
                                JSON.stringify(
                                    accounts.map(account =>
                                        String(account.username || "").toLowerCase() ===
                                        String(currentUser.username || "").toLowerCase()
                                            ? { ...account, ...currentUser }
                                            : account
                                    )
                                )
                            );
                        }
                    } catch (error) {
                        console.warn("Could not sync profile photo:", error);
                    }

                    sessionStorage.setItem(
                        "currentUser",
                        JSON.stringify(currentUser)
                    );

                    window.dispatchEvent(
                        new CustomEvent("fintrack:profile-updated", {
                            detail: currentUser
                        })
                    );

                    loadProfilePhoto();

                    updateUserDetails();

                };


            reader.readAsDataURL(
                file
            );

        }
    );

}


/* =========================================================
   LOAD PROFILE PHOTO
========================================================= */

function loadProfilePhoto() {

    if (!currentUser) {
        return;
    }


    const photo =
        document.getElementById(
            "profilePhoto"
        );


    const placeholder =
        document.getElementById(
            "profilePhotoPlaceholder"
        );


    if (!photo || !placeholder) {
        return;
    }


    if (currentUser.profilePhoto) {

        photo.src =
            currentUser.profilePhoto;

        photo.style.display =
            "block";

        placeholder.style.display =
            "none";

    }
    else {

        photo.removeAttribute(
            "src"
        );

        photo.style.display =
            "none";

        placeholder.style.display =
            "flex";

    }

}


/* =========================================================
   CHANGE PASSWORD MODAL
========================================================= */

function openChangePasswordModal() {

    closeModal(
        "profileModal"
    );


    const modal =
        document.getElementById(
            "changePasswordModal"
        );


    if (modal) {

        modal.classList.add(
            "active"
        );

        modal.style.display =
            "flex";

    }

}


/* =========================================================
   CHANGE PASSWORD
========================================================= */

function changePassword() {

    if (!currentUser) {

        alert(
            "User account not found."
        );

        return;

    }


    const currentPassword =
        getInputValue(
            "currentPassword"
        );


    const newPassword =
        getInputValue(
            "newProfilePassword"
        );


    const confirmPassword =
        getInputValue(
            "confirmProfilePassword"
        );


    if (!currentPassword) {

        alert(
            "Please enter your current password."
        );

        return;

    }


    if (
        currentPassword !==
        currentUser.password
    ) {

        alert(
            "Current password is incorrect."
        );

        return;

    }


    if (newPassword.length < 6) {

        alert(
            "New password must contain at least 6 characters."
        );

        return;

    }


    if (
        newPassword !==
        confirmPassword
    ) {

        alert(
            "New password and confirm password do not match."
        );

        return;

    }


    currentUser.password =
        newPassword;


    localStorage.setItem(
        "fintrackUser",
        JSON.stringify(
            currentUser
        )
    );

    try {
        const accounts = JSON.parse(
            localStorage.getItem("fintrackAccounts") || "[]"
        );
        if (Array.isArray(accounts)) {
            localStorage.setItem(
                "fintrackAccounts",
                JSON.stringify(accounts.map(account =>
                    String(account.username || "").toLowerCase() ===
                    String(currentUser.username || "").toLowerCase()
                        ? currentUser
                        : account
                ))
            );
        }
    } catch (error) {
        console.warn("Could not update account list:", error);
    }


    setInputValue(
        "currentPassword",
        ""
    );


    setInputValue(
        "newProfilePassword",
        ""
    );


    setInputValue(
        "confirmProfilePassword",
        ""
    );


    alert(
        "Password changed successfully."
    );


    closeModal(
        "changePasswordModal"
    );

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeModal(
    modalId
) {

    const modal =
        document.getElementById(
            modalId
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "active"
    );


    modal.style.display =
        "none";

}



/* =========================================================
   SIDEBAR
========================================================= */

function toggleSidebar() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );


    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );


    if (sidebar) {

        sidebar.classList.toggle(
            "active"
        );

    }


    if (overlay) {

        overlay.classList.toggle(
            "active"
        );

    }

}


function closeSidebar() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );


    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );


    if (sidebar) {

        sidebar.classList.remove(
            "active"
        );

    }


    if (overlay) {

        overlay.classList.remove(
            "active"
        );

    }

}


/* =========================================================
   HELPERS
========================================================= */

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
            value;

    }

}


function setInputValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.value =
            value || "";

    }

}


function getInputValue(
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


function currency(
    value
) {

    return new Intl.NumberFormat(
        "en-IN",
        {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    ).format(
        Number(value || 0)
    );

}


function formatDate(
    value
) {

    if (!value) {
        return "-";
    }


    const date =
        new Date(value);


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


function formatDateTime(
    value
) {

    if (!value) {
        return "-";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;

    }


    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/* =========================================================
   HTML SECURITY
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