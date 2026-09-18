"use strict";

/* =========================================================
   FINTRACK - MEMBERS
   ========================================================= */

let members = [];

/* =========================================================
   PAGE LOAD
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    loadMembers();

    populateSchemeFilters();

    renderMembers();

    loadProfile();

    setDefaultDate();

    toggleSchemeFields();

    /*
     * If Add Member was clicked from
     * Scheme Details page, automatically
     * select that scheme and open the modal.
     */
    openMemberForScheme();

});

/* =========================================================
   MEMBERS STORAGE
   ========================================================= */

function loadMembers() {
    const saved = localStorage.getItem("chitfund_members");

    if (!saved) {
        members = [];
        saveMembers();
        return;
    }

    try {
        const data = JSON.parse(saved);
        members = Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Unable to load members:", error);
        members = [];
    }
}
/* =========================================================
   OPEN MEMBER FORM FOR SELECTED SCHEME
========================================================= */

function openMemberForScheme() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const schemeId =
        params.get("schemeId");

    if (!schemeId) {
        return;
    }

    const schemes =
        getSchemes();

    const selectedScheme =
        schemes.find(function (scheme) {

            return (
                Number(
                    scheme.id ??
                    scheme._id ??
                    scheme.schemeId
                ) ===
                Number(schemeId)
            );

        });

    if (!selectedScheme) {

        console.error(
            "Scheme not found:",
            schemeId
        );

        return;
    }

    /*
     * Make sure the dropdown is populated
     */
    populateSchemeFilters();

    const schemeSelect =
        document.getElementById(
            "memberScheme"
        );

    if (schemeSelect) {

        schemeSelect.value =
            selectedScheme.name;
    }

    /*
     * Open the Add Member modal
     */
    setTimeout(function () {

        openAddMemberModal();

        /*
         * openAddMemberModal() resets
         * the form, so select the scheme
         * again after opening.
         */
        setTimeout(function () {

            const select =
                document.getElementById(
                    "memberScheme"
                );

            if (select) {

                select.value =
                    selectedScheme.name;

            }

        }, 50);

    }, 100);

}

function syncMemberLoginAccount(member) {
    if (!member || member.id == null) return;
    try {
        const raw = localStorage.getItem("fintrackAccounts") || "[]";
        const accounts = JSON.parse(raw);
        if (!Array.isArray(accounts)) return;
        let changed = false;
        const updated = accounts.map(account => {
            // Never convert an administrator identity into a member identity.
            if (String(account.role || "").toLowerCase() === "admin") return account;
            if (String(account.memberId) !== String(member.id)) return account;
            changed = true;
            return {
                ...account,
                fullName: member.name || account.fullName || "Member",
                email: member.email || "",
                phone: member.phone || "",
                memberId: member.id,
                role: "user",
                profilePhoto: member.profilePhoto || account.profilePhoto || ""
            };
        });
        if (changed) localStorage.setItem("fintrackAccounts", JSON.stringify(updated));
    } catch (error) {
        console.error("Unable to synchronize member login account:", error);
    }
}

function saveMembers() {
    localStorage.setItem(
        "chitfund_members",
        JSON.stringify(members)
    );
    // Keep an existing member login synchronized with the authoritative
    // member record whenever Admin edits member details.
    members.forEach(syncMemberLoginAccount);
    if (typeof window.fintrackAudit === "function") window.fintrackAudit("member.data_saved", "Member directory saved", { count: members.length });
}

/* =========================================================
   SCHEME STORAGE
   ========================================================= */

function getSchemes() {
    const saved = localStorage.getItem("chitfund_schemes");

    if (!saved) {
        return [];
    }

    try {
        const data = JSON.parse(saved);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Unable to load schemes:", error);
        return [];
    }
}

function saveSchemes(schemes) {
    localStorage.setItem(
        "chitfund_schemes",
        JSON.stringify(schemes)
    );
}

/* =========================================================
   SYNC SCHEME MEMBER COUNTS
   ========================================================= */

function syncSchemeMemberCounts() {
    const schemes = getSchemes();

    if (!schemes.length) {
        return;
    }

    /*
     * IMPORTANT:
     * members = people, but scheme.members = number of CHITS.
     * One person can therefore contribute more than one chit.
     */
    schemes.forEach(function (scheme) {

        let chitCount = 0;

        members.forEach(function (member) {

            if (!Array.isArray(member.schemes)) {
                return;
            }

            member.schemes.forEach(function (item) {

                if (!item) {
                    return;
                }

                const sameScheme =
                    Number(item.id) === Number(scheme.id) ||
                    String(item.name || "").trim() ===
                    String(scheme.name || "").trim();

                if (sameScheme) {
                    chitCount++;
                }
            });
        });

        scheme.members = chitCount;
    });

    saveSchemes(schemes);
}

/* =========================================================
   FIND SCHEME
   ========================================================= */

function findSchemeByName(name) {
    const schemes = getSchemes();

    return schemes.find(function (scheme) {
        return (
            String(scheme.name || "").trim() ===
            String(name || "").trim()
        );
    }) || null;
}

/* =========================================================
   SCHEME ID
   ========================================================= */

function getSchemeId(scheme) {
    if (!scheme) {
        return null;
    }

    return (
        scheme.id ??
        scheme._id ??
        scheme.schemeId ??
        null
    );
}

/* =========================================================
   CHIT AMOUNT
   ========================================================= */

function getChitAmount(scheme) {
    if (!scheme) {
        return 0;
    }

    return Number(
        scheme.chitAmount ??
        scheme.totalAmount ??
        scheme.amount ??
        scheme.value ??
        scheme.chitValue ??
        0
    ) || 0;
}

/* =========================================================
   NORMAL PAYMENT
   ========================================================= */

function getNormalPayment(scheme) {
    if (!scheme) {
        return 0;
    }

    let payment = Number(
        scheme.monthlyPayment ??
        scheme.payment ??
        scheme.installment ??
        scheme.baseAmount ??
        scheme.monthlyAmount ??
        scheme.installmentAmount ??
        0
    ) || 0;

    if (
        getChitAmount(scheme) === 100000 &&
        payment === 0
    ) {
        payment = 5000;
    }

    return payment;
}

/* =========================================================
   PAYMENT AFTER CHIT
   ========================================================= */

function getTakenPayment(scheme) {
    if (!scheme) {
        return 0;
    }

    let payment = Number(
        scheme.takenPayment ??
        scheme.afterTakenPayment ??
        scheme.winnerPayment ??
        0
    ) || 0;

    if (
        getChitAmount(scheme) === 100000 &&
        payment === 0
    ) {
        payment = 6000;
    }

    if (
        getChitAmount(scheme) === 200000 &&
        payment === 0
    ) {
        payment = 12000;
    }

    if (
        payment === 0 &&
        getNormalPayment(scheme) > 0
    ) {
        payment = getNormalPayment(scheme) + 1000;
    }

    return payment;
}

/* =========================================================
   POPULATE SCHEME DROPDOWN
   ========================================================= */

function populateSchemeFilters() {
    const filter =
        document.getElementById("schemeFilter");

    const formSelect =
        document.getElementById("memberScheme");

    const schemes = getSchemes();

    if (filter) {
        filter.innerHTML =
            `<option value="all">All Schemes</option>`;
    }

    if (formSelect) {
        formSelect.innerHTML =
            `<option value="">No Scheme - Add to Directory Only</option>`;
    }

    schemes.forEach(function (scheme) {
        if (!scheme || !scheme.name) {
            return;
        }

        const option1 =
            document.createElement("option");

        option1.value = scheme.name;
        option1.textContent = scheme.name;

        if (filter) {
            filter.appendChild(option1);
        }

        const option2 =
            document.createElement("option");

        option2.value = scheme.name;
        option2.textContent = scheme.name;

        if (formSelect) {
            formSelect.appendChild(option2);
        }
    });
}


/* =========================================================
   MEMBER LOGIN ACCOUNTS
   ========================================================= */

function getMemberLoginAccounts() {
    try {
        const data = JSON.parse(localStorage.getItem("fintrackAccounts") || "[]");
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function saveMemberLoginAccounts(accounts) {
    localStorage.setItem("fintrackAccounts", JSON.stringify(accounts));
}

async function hashMemberPassword(password) {
    const data = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

function getLoginForMember(memberId) {
    return getMemberLoginAccounts().find(
        account => String(account.memberId) === String(memberId) && String(account.role || "user").toLowerCase() === "user"
    ) || null;
}

function openMemberLogin(memberId) {
    const member = members.find(m => String(m.id) === String(memberId));
    if (!member) return alert("Member not found.");

    const existing = getLoginForMember(memberId);
    const existingUsername = existing?.username || "";

    let modal = document.getElementById("memberLoginModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "memberLoginModal";
        modal.className = "modal-overlay";
        modal.innerHTML = `
            <div class="modal member-login-modal">
                <div class="modal-header">
                    <div>
                        <h2 id="memberLoginModalTitle">Create Member Login</h2>
                        <p id="memberLoginMemberName"></p>
                    </div>
                    <button type="button" class="modal-close" onclick="closeMemberLogin()">×</button>
                </div>
                <form id="memberLoginForm" onsubmit="saveMemberLogin(event)">
                    <input type="hidden" id="loginMemberId">
                    <div class="form-group">
                        <label>Member</label>
                        <input id="loginMemberDisplay" type="text" readonly>
                    </div>
                    <div class="form-group">
                        <label>Username</label>
                        <input id="loginUsername" type="text" autocomplete="off" required placeholder="Create username">
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input id="loginPassword" type="password" autocomplete="new-password" placeholder="Enter password">
                        <small class="form-help">For a new login, password is required. Leave blank when editing to keep the current password.</small>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="cancel-button" onclick="closeMemberLogin()">Cancel</button>
                        <button type="submit" class="save-button">Save Login</button>
                    </div>
                </form>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener("click", e => {
            if (e.target === modal) closeMemberLogin();
        });
    }

    document.getElementById("loginMemberId").value = member.id;
    document.getElementById("loginMemberDisplay").value = `${member.name} (ID: ${member.id})`;
    document.getElementById("memberLoginMemberName").textContent = existing
        ? "Update the login credentials for this member."
        : "Create credentials that this member can use in Member Login.";
    document.getElementById("memberLoginModalTitle").textContent = existing ? "Edit Member Login" : "Create Member Login";
    document.getElementById("loginUsername").value = existingUsername;
    document.getElementById("loginPassword").value = "";
    modal.classList.add("active");
}

function closeMemberLogin() {
    document.getElementById("memberLoginModal")?.classList.remove("active");
}

async function saveMemberLogin(event) {
    event.preventDefault();
    const memberId = document.getElementById("loginMemberId").value;
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    const member = members.find(m => String(m.id) === String(memberId));
    if (!member) return alert("Member not found.");
    if (!username) return alert("Please enter a username.");

    const accounts = getMemberLoginAccounts();
    const index = accounts.findIndex(a => String(a.memberId) === String(memberId) && String(a.role || "user").toLowerCase() === "user");
    const normalizedUsername = username.toLowerCase();

    // An administrator identity is never allowed to become a member identity.
    // This prevents a person who already has an Admin login (for example,
    // Surya/admin) from also being assigned a Member login.
    const normalizePhone = value => String(value || "").replace(/\D/g, "");
    const normalizeEmail = value => String(value || "").trim().toLowerCase();
    const normalizeName = value => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    const adminIdentity = accounts.find(a => {
        if (String(a.role || "").toLowerCase() !== "admin") return false;
        if (String(a.memberId ?? "").trim() !== "") return false;
        const adminUsername = String(a.username || "").trim().toLowerCase();
        const adminEmail = normalizeEmail(a.email);
        const adminPhone = normalizePhone(a.phone);
        const adminName = normalizeName(a.fullName || a.name);
        const memberEmail = normalizeEmail(member.email);
        const memberPhone = normalizePhone(member.phone);
        const memberName = normalizeName(member.name);
        return adminUsername === normalizedUsername ||
               (adminEmail && memberEmail && adminEmail === memberEmail) ||
               (adminPhone && memberPhone && adminPhone === memberPhone) ||
               (adminName && memberName && adminName === memberName);
    });
    if (adminIdentity) {
        return alert("This person already has an Admin login and cannot be created as a Member. An Admin account cannot also be a Member account.");
    }

    const duplicate = accounts.findIndex(a => String(a.username || "").trim().toLowerCase() === normalizedUsername && String(a.memberId ?? "") !== String(memberId));
    if (duplicate !== -1) return alert("That username is already assigned.");

    const existing = index >= 0 ? accounts[index] : null;
    if (!existing && password.length < 6) return alert("Password must contain at least 6 characters.");
    if (existing && password && password.length < 6) return alert("Password must contain at least 6 characters.");

    const account = {
        ...(existing || {}),
        fullName: member.name || "Member",
        username,
        role: "user",
        phone: member.phone || "",
        email: member.email || "",
        memberId: member.id,
        accountCreated: existing?.accountCreated || new Date().toISOString(),
        lastLogin: existing?.lastLogin || null,
        profilePhoto: existing?.profilePhoto || ""
    };

    if (password) {
        account.passwordHash = await hashMemberPassword(password);
        delete account.password;
    } else if (!existing) {
        return alert("Please enter a password.");
    }

    if (index >= 0) accounts[index] = account;
    else accounts.push(account);
    saveMemberLoginAccounts(accounts);
    closeMemberLogin();
    renderMembers();
    alert(existing ? "Member login updated successfully." : "Member login created successfully.");
}

/* =========================================================
   RENDER MEMBERS
   ========================================================= */

function renderMembers(filteredMembers = members) {
    const tbody =
        document.getElementById("membersTableBody");

    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";

    const count =
        document.getElementById("memberCount");

    if (count) {
        count.textContent = filteredMembers.length;
    }

    if (filteredMembers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <div class="empty-icon">♟</div>
                        No members found.
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    filteredMembers.forEach(function (member) {
        const row = document.createElement("tr");

        const memberSchemes =
            Array.isArray(member.schemes)
                ? member.schemes
                : [];

        const tickets = memberSchemes
            .map(function (scheme) {
                return `
                    <span class="ticket-badge">
                        #${escapeHTML(scheme.ticket)}
                        -
                        ${escapeHTML(scheme.name)}
                    </span>
                `;
            })
            .join("");

        row.innerHTML = `
            <td>
                <div class="member-name">
                    <strong>
                        ${escapeHTML(member.name)}
                    </strong>

                    <span class="member-id">
                        User ID: ${member.id}
                    </span>
                </div>
            </td>

            <td>
                <div class="contact-details">
                    <span class="contact-email">
                        ${escapeHTML(member.email)}
                    </span>

                    <span class="contact-phone">
                        ${escapeHTML(member.phone)}
                    </span>
                </div>
            </td>

            <td>
                <span class="enrollment-count">
                    ${memberSchemes.length}
                </span>
            </td>

            <td>
                <div class="ticket-list">
                    ${tickets || "-"}
                </div>
            </td>

            <td>
                <span class="
                    member-status
                    status-${escapeHTML(member.status)}
                ">
                    ${capitalize(member.status)}
                </span>
            </td>

            <td>
                ${formatDate(member.joinedDate)}
            </td>

            <td>
                <button
                    type="button"
                    class="view-button"
                    onclick="viewMember(${member.id})">
                    View
                </button>

                <button
                    type="button"
                    class="edit-button"
                    onclick="editMember(${member.id})">
                    Edit
                </button>

                <button
                    type="button"
                    class="delete-button"
                    onclick="deleteMember(${member.id})">
                    Delete
                </button>

                <button
                    type="button"
                    class="login-button"
                    onclick="openMemberLogin(${member.id})">
                    ${getLoginForMember(member.id) ? "Edit Login" : "Create Login"}
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

/* =========================================================
   FILTER MEMBERS
   ========================================================= */

function filterMembers() {
    const searchInput =
        document.getElementById("memberSearch");

    const schemeInput =
        document.getElementById("schemeFilter");

    const statusInput =
        document.getElementById("statusFilter");

    const search =
        searchInput
            ? searchInput.value.trim().toLowerCase()
            : "";

    const scheme =
        schemeInput
            ? schemeInput.value
            : "all";

    const status =
        statusInput
            ? statusInput.value
            : "all";

    const filtered = members.filter(function (member) {
        const name =
            String(member.name || "").toLowerCase();

        const email =
            String(member.email || "").toLowerCase();

        const matchesSearch =
            name.includes(search) ||
            email.includes(search);

        const matchesScheme =
            scheme === "all" ||
            (
                Array.isArray(member.schemes) &&
                member.schemes.some(function (item) {
                    return item.name === scheme;
                })
            );

        const matchesStatus =
            status === "all" ||
            member.status === status;

        return (
            matchesSearch &&
            matchesScheme &&
            matchesStatus
        );
    });

    renderMembers(filtered);
}

/* =========================================================
   POPULATE EXISTING MEMBERS DROPDOWN
   ========================================================= */

function populateExistingMembersDropdown() {
    const select =
        document.getElementById("existingMemberSelect");

    if (!select) {
        return;
    }

    select.innerHTML =
        `<option value="">-- Select Member --</option>`;

    const sorted =
        [...members].sort(function (a, b) {
            return String(a.name || "").localeCompare(String(b.name || ""));
        });

    sorted.forEach(function (member) {
        const option =
            document.createElement("option");

        option.value = member.id;
        option.textContent = `${member.name} (${member.phone || member.email || "ID: " + member.id})`;

        select.appendChild(option);
    });
}

/* =========================================================
   TOGGLE MEMBER OPTION MODE
   ========================================================= */

function toggleMemberOption() {
    const optionSelect =
        document.getElementById("memberOption");

    const optionGroup =
        document.getElementById("memberOptionGroup");

    const existingGroup =
        document.getElementById("existingMemberGroup");

    const editId =
        document.getElementById("memberId").value;

    const nameInput =
        document.getElementById("memberName");

    const emailInput =
        document.getElementById("memberEmail");

    const phoneInput =
        document.getElementById("memberPhone");

    /* If editing an existing member via Edit button, hide mode selector */
    if (editId) {
        if (optionGroup) optionGroup.style.display = "none";
        if (existingGroup) existingGroup.style.display = "none";
        if (nameInput) nameInput.removeAttribute("readonly");
        if (emailInput) emailInput.removeAttribute("readonly");
        if (phoneInput) phoneInput.removeAttribute("readonly");
        return;
    }

    if (optionGroup) optionGroup.style.display = "block";

    const mode =
        optionSelect ? optionSelect.value : "existing";

    if (mode === "existing") {
        if (existingGroup) existingGroup.style.display = "block";
        populateExistingMembersDropdown();
        onSelectExistingMember();
    } else {
        if (existingGroup) existingGroup.style.display = "none";
        const existingSelect =
            document.getElementById("existingMemberSelect");

        if (existingSelect) existingSelect.value = "";
        if (nameInput) {
            nameInput.value = "";
            nameInput.removeAttribute("readonly");
        }
        if (emailInput) {
            emailInput.value = "";
            emailInput.removeAttribute("readonly");
        }
        if (phoneInput) {
            phoneInput.value = "";
            phoneInput.removeAttribute("readonly");
        }
    }
}

/* =========================================================
   ON SELECT EXISTING MEMBER
   ========================================================= */

function onSelectExistingMember() {
    const optionSelect =
        document.getElementById("memberOption");

    if (optionSelect && optionSelect.value !== "existing") {
        return;
    }

    const select =
        document.getElementById("existingMemberSelect");

    const memberId =
        select ? select.value : "";

    const nameInput =
        document.getElementById("memberName");

    const emailInput =
        document.getElementById("memberEmail");

    const phoneInput =
        document.getElementById("memberPhone");

    if (!memberId) {
        if (nameInput) { nameInput.value = ""; nameInput.removeAttribute("readonly"); }
        if (emailInput) { emailInput.value = ""; emailInput.removeAttribute("readonly"); }
        if (phoneInput) { phoneInput.value = ""; phoneInput.removeAttribute("readonly"); }
        return;
    }

    const member =
        members.find(function (m) {
            return Number(m.id) === Number(memberId);
        });

    if (member) {
        if (nameInput) {
            nameInput.value = member.name || "";
            nameInput.setAttribute("readonly", "readonly");
        }
        if (emailInput) {
            emailInput.value = member.email || "";
            emailInput.setAttribute("readonly", "readonly");
        }
        if (phoneInput) {
            phoneInput.value = member.phone || "";
            phoneInput.setAttribute("readonly", "readonly");
        }
    }
}

/* =========================================================
   OPEN ADD MEMBER
   ========================================================= */

function openAddMemberModal() {
    const modal =
        document.getElementById("memberModal");

    const form =
        document.getElementById("memberForm");

    if (form) {
        form.reset();
    }

    document.getElementById("modalTitle").textContent =
        "Add Member";

    document.getElementById("memberId").value = "";

    document.getElementById("memberStatus").value =
        "active";

    populateSchemeFilters();
    populateExistingMembersDropdown();

    const optionSelect =
        document.getElementById("memberOption");

    if (optionSelect) {
        if (members.length > 0) {
            optionSelect.value = "existing";
        } else {
            optionSelect.value = "new";
        }
    }

    toggleMemberOption();
    setDefaultDate();

    if (modal) {
        modal.classList.add("active");
    }
}

/* =========================================================
   CLOSE MODAL
   ========================================================= */

function closeMemberModal() {
    const modal =
        document.getElementById("memberModal");

    if (modal) {
        modal.classList.remove("active");
    }
}

/* =========================================================
   TOGGLE SCHEME / TICKET FIELDS
   ========================================================= */

function toggleSchemeFields() {

    const schemeSelect =
        document.getElementById("memberScheme");

    const ticketInput =
        document.getElementById("memberTicket");

    const ticketGroup =
        ticketInput
            ? ticketInput.closest(".form-group")
            : null;

    const help =
        document.getElementById("schemeOptionalHelp");

    const hasScheme =
        !!(schemeSelect && schemeSelect.value);

    if (ticketGroup) {
        ticketGroup.style.display =
            hasScheme ? "" : "none";
    }

    if (!hasScheme && ticketInput) {
        ticketInput.value = "";
    }

    if (help) {
        help.textContent = hasScheme
            ? "Leave blank to automatically assign the next available ticket number."
            : "This member will be saved in the Members Directory without joining a chit scheme.";
    }
}

/* =========================================================
   SAVE MEMBER
   ========================================================= */

function saveMember(event) {
    event.preventDefault();

    const id =
        document.getElementById("memberId").value.trim();

    const optionSelect =
        document.getElementById("memberOption");

    const optionMode =
        optionSelect ? optionSelect.value : "new";

    const existingSelect =
        document.getElementById("existingMemberSelect");

    const existingMemberId =
        existingSelect ? existingSelect.value : "";

    const name =
        document.getElementById("memberName")
            .value.trim();

    const email =
        document.getElementById("memberEmail")
            .value.trim();

    const phone =
        document.getElementById("memberPhone")
            .value.trim();

    const schemeName =
        document.getElementById("memberScheme").value;

    let ticket =
        Number(
            document.getElementById("memberTicket").value
        );

    const joinedDate =
        document.getElementById("memberJoinedDate").value;

    const status =
        document.getElementById("memberStatus").value;

    /* ---------------- VALIDATION ---------------- */

    if (optionMode === "existing" && !id) {
        if (!existingMemberId) {
            alert("Please select an existing member.");
            return;
        }
    } else {
        if (!name) {
            alert("Please enter member name.");
            return;
        }

        if (!email) {
            alert("Please enter email address.");
            return;
        }

        if (!/^\d{10}$/.test(phone)) {
            alert("Please enter a valid 10-digit phone number.");
            return;
        }
    }

    /* -----------------------------------------------------
       DIRECTORY-ONLY MEMBER
       A member does not have to join a scheme immediately.
       Blank scheme means: save the person only in the
       Members Directory.
       ----------------------------------------------------- */

    if (!joinedDate) {
        alert("Please select joined date.");
        return;
    }

    if (!schemeName) {

        /* Existing member: keep all existing scheme/chit
           entries exactly as they are. */
        if (optionMode === "existing" && existingMemberId) {

            const member =
                members.find(function (item) {
                    return Number(item.id) === Number(existingMemberId);
                });

            if (!member) {
                alert("Member not found.");
                return;
            }

            member.name = name;
            member.email = email;
            member.phone = phone;
            member.status = status;

            if (!member.joinedDate) {
                member.joinedDate = joinedDate;
            }

            saveMembers();
            syncSchemeMemberCounts();
            populateSchemeFilters();
            renderMembers();
            closeMemberModal();

            alert(
                `${member.name} is already in the Members Directory. No chit scheme was changed.`
            );
            return;
        }

        /* Create a new directory member with no scheme. */
        const duplicateEmail =
            members.some(function (member) {
                return (
                    String(member.email || "")
                        .toLowerCase()
                        .trim() ===
                    email.toLowerCase().trim()
                );
            });

        if (duplicateEmail) {
            alert("A member with this email already exists.");
            return;
        }

        const directoryMember = {
            id: generateMemberId(),
            name: name,
            email: email,
            phone: phone,
            schemes: [],
            status: status,
            joinedDate: joinedDate
        };

        members.push(directoryMember);

        saveMembers();
        syncSchemeMemberCounts();
        populateSchemeFilters();
        renderMembers();
        closeMemberModal();

        alert(
            `${name} was added to the Members Directory successfully.`
        );
        return;
    }

    /* -----------------------------------------------------
       FROM HERE ON, A CHIT SCHEME WAS SELECTED.
       ----------------------------------------------------- */

    /* Ticket is optional: blank means "assign next available ticket". */
    if (
        document.getElementById("memberTicket").value.trim() !== "" &&
        (!Number.isInteger(ticket) || ticket < 1)
    ) {
        alert("Please enter a valid ticket number.");
        return;
    }

    const selectedScheme =
        findSchemeByName(schemeName);

    if (!selectedScheme) {
        alert(
            "Selected chit scheme was not found."
        );
        return;
    }

    const schemeId =
        getSchemeId(selectedScheme);

    const capacity =
        Number(selectedScheme.capacity || 0);

    /* =====================================================
       CHECK SCHEME CAPACITY
       ===================================================== */

    /*
     * Capacity is the number of CHITS, not the number of
     * unique people. The same member may occupy multiple slots.
     */
    let currentSchemeChits = 0;

    members.forEach(function (member) {

        if (!Array.isArray(member.schemes)) {
            return;
        }

        member.schemes.forEach(function (item) {

            if (!item) {
                return;
            }

            const sameScheme =
                Number(item.id) === Number(schemeId) ||
                String(item.name || "").trim() ===
                String(schemeName || "").trim();

            if (sameScheme) {
                currentSchemeChits++;
            }
        });
    });

    if (
        capacity > 0 &&
        currentSchemeChits >= capacity
    ) {
        alert(
            `${schemeName} is full.\n\n` +
            `Capacity: ${capacity} chits\n` +
            `Current chits: ${currentSchemeChits}`
        );
        return;
    }

    /* =====================================================
       AUTO ASSIGN NEXT TICKET
       The same member may own multiple chits in one scheme.
       Ticket numbers are unique only within the scheme.
       ===================================================== */

    if (!ticket) {

        let highestTicket = 0;

        members.forEach(function (member) {

            if (!Array.isArray(member.schemes)) return;

            member.schemes.forEach(function (item) {

                if (!item) return;

                const sameScheme =
                    Number(item.id) === Number(schemeId) ||
                    String(item.name || "").trim().toLowerCase() ===
                    String(schemeName || "").trim().toLowerCase();

                if (!sameScheme) return;

                const existingTicket =
                    Number(item.ticket);

                if (Number.isInteger(existingTicket)) {
                    highestTicket =
                        Math.max(highestTicket, existingTicket);
                }
            });
        });

        ticket = highestTicket + 1;

        const ticketInput =
            document.getElementById("memberTicket");

        if (ticketInput) {
            ticketInput.value = ticket;
        }
    }

    /* =====================================================
       CHECK DUPLICATE TICKET
       ===================================================== */

    /*
     * A ticket number must be unique inside the scheme,
     * but the MEMBER is allowed to appear multiple times.
     */
    const duplicateTicket =
        members.some(function (member) {

            if (!Array.isArray(member.schemes)) {
                return false;
            }

            return member.schemes.some(function (item) {

                if (!item) {
                    return false;
                }

                const sameScheme =
                    Number(item.id) === Number(schemeId) ||
                    String(item.name || "").trim() ===
                    String(schemeName || "").trim();

                return (
                    sameScheme &&
                    Number(item.ticket) === ticket
                );
            });
        });

    if (duplicateTicket) {
        alert(
            `Ticket #${ticket} is already assigned in ${schemeName}.`
        );
        return;
    }

    /* =====================================================
       MEMBER SCHEME OBJECT
       ===================================================== */

    const memberScheme = {
        id: schemeId,
        schemeId: String(schemeId),
        name: schemeName,
        ticket: ticket,
        chitAmount: getChitAmount(selectedScheme),
        normalPayment: getNormalPayment(selectedScheme),
        takenPayment: getTakenPayment(selectedScheme),
        chitTaken: false,
        winningMonth: null
    };

    /* =====================================================
       EDIT MEMBER (via Edit button in table)
       ===================================================== */

    if (id) {
        const member =
            members.find(function (item) {
                return Number(item.id) === Number(id);
            });

        if (!member) {
            alert("Member not found.");
            return;
        }

        member.name = name;
        member.email = email;
        member.phone = phone;

        if (!Array.isArray(member.schemes)) {
            member.schemes = [];
        }

        const schemeIdx =
            member.schemes.findIndex(function (s) {
                return Number(s.id) === Number(schemeId) || s.name === schemeName;
            });

        if (schemeIdx >= 0) {
            member.schemes[schemeIdx] = memberScheme;
        } else {
            member.schemes.push(memberScheme);
        }

        member.status = status;
        member.joinedDate = joinedDate;

        saveMembers();
        syncSchemeMemberCounts();

        populateSchemeFilters();
        renderMembers();
        closeMemberModal();

        alert("Member updated successfully.");
        handleReturnToScheme(schemeId);
        return;
    }

    /* =====================================================
       ADD EXISTING MEMBER TO SCHEME
       ===================================================== */

    if (optionMode === "existing" && existingMemberId) {
        const member =
            members.find(function (item) {
                return Number(item.id) === Number(existingMemberId);
            });

        if (!member) {
            alert("Member not found.");
            return;
        }

        if (!Array.isArray(member.schemes)) {
            member.schemes = [];
        }

        /*
         * IMPORTANT:
         * Do NOT replace an existing scheme entry here.
         * The same person can own multiple chits in the
         * same scheme, so every Add Member action creates
         * another ticket entry.
         */
        member.schemes.push(memberScheme);

        member.status = status;

        saveMembers();
        syncSchemeMemberCounts();

        populateSchemeFilters();
        renderMembers();
        closeMemberModal();

        alert(
            `${member.name} added to ${schemeName} successfully.\n\n` +
            `Ticket #${ticket} has been assigned.`
        );

        handleReturnToScheme(schemeId);
        return;
    }

    /* =====================================================
       CREATE NEW MEMBER
       ===================================================== */

    const duplicateEmail =
        members.some(function (member) {
            return (
                String(member.email)
                    .toLowerCase()
                    .trim() ===
                email.toLowerCase().trim()
            );
        });

    if (duplicateEmail) {
        alert(
            "A member with this email already exists."
        );
        return;
    }

    const newMember = {
        id: generateMemberId(),
        name: name,
        email: email,
        phone: phone,
        schemes: [memberScheme],
        status: status,
        joinedDate: joinedDate
    };

    members.push(newMember);

    saveMembers();
    syncSchemeMemberCounts();

    populateSchemeFilters();
    renderMembers();
    closeMemberModal();

    alert(
        `Member added successfully to ${schemeName}.`
    );

    handleReturnToScheme(schemeId);
}

/* =========================================================
   HANDLE RETURN TO SCHEME DETAILS
   ========================================================= */

function handleReturnToScheme(schemeId) {
    const params =
        new URLSearchParams(window.location.search);

    const returnToScheme =
        params.get("returnToScheme");

    if (returnToScheme && schemeId) {
        window.location.href =
            `scheme-details.html?id=${encodeURIComponent(schemeId)}`;
    }
}

/* =========================================================
   EDIT MEMBER
   ========================================================= */

function editMember(id) {
    const member =
        members.find(function (item) {
            return Number(item.id) === Number(id);
        });

    if (!member) {
        alert("Member not found.");
        return;
    }

    document.getElementById("modalTitle").textContent =
        "Edit Member";

    document.getElementById("memberId").value =
        member.id;

    document.getElementById("memberName").value =
        member.name;

    document.getElementById("memberEmail").value =
        member.email;

    document.getElementById("memberPhone").value =
        member.phone;

    populateSchemeFilters();

    const scheme =
        Array.isArray(member.schemes) &&
        member.schemes.length
            ? member.schemes[0]
            : null;

    document.getElementById("memberScheme").value =
        scheme ? scheme.name : "";

    document.getElementById("memberTicket").value =
        scheme ? scheme.ticket : "";

    document.getElementById("memberJoinedDate").value =
        member.joinedDate || "";

    document.getElementById("memberStatus").value =
        member.status || "active";

    document.getElementById("memberModal")
        .classList.add("active");
}

/* =========================================================
   VIEW MEMBER
   ========================================================= */

function viewMember(id) {
    const member = members.find(function (item) {
        return Number(item.id) === Number(id);
    });

    if (!member) {
        return;
    }

    openMemberLedger(member);
}

/* =========================================================
   MEMBER LEDGER
   Shows the complete financial history for one member/chit.
========================================================= */

function readLedgerStorage(key) {
    try {
        const data = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Unable to read " + key + ":", error);
        return [];
    }
}

function getLedgerSchemes() {
    return getSchemes();
}

function getLedgerSchemeForEntry(entry) {
    if (!entry) return null;

    const schemes = getLedgerSchemes();
    return schemes.find(function (scheme) {
        return (
            String(scheme.id) === String(entry.id) ||
            String(scheme.name || "").trim().toLowerCase() ===
            String(entry.name || "").trim().toLowerCase()
        );
    }) || entry;
}

function getLedgerMemberEntries(member) {
    return Array.isArray(member.schemes) ? member.schemes.filter(Boolean) : [];
}

function getLedgerPayments(member, scheme, ticket) {
    const payments = readLedgerStorage("chitfund_payments");
    return payments.filter(function (payment) {
        return (
            (
                String(payment.memberId ?? "") === String(member.id) ||
                String(payment.member || "").trim().toLowerCase() ===
                String(member.name || "").trim().toLowerCase()
            ) &&
            (
                String(payment.schemeId ?? "") === String(scheme.id) ||
                String(payment.scheme || "").trim().toLowerCase() ===
                String(scheme.name || "").trim().toLowerCase()
            ) &&
            String(payment.ticket ?? "").trim() === String(ticket ?? "").trim()
        );
    });
}

function getLedgerWinner(member, scheme, ticket) {
    const winners = readLedgerStorage("chitfund_winners");

    return winners.find(function (winner) {
        return (
            String(winner.schemeId ?? "") === String(scheme.id) &&
            String(winner.ticket ?? winner.ticketNumber ?? "").trim() === String(ticket ?? "").trim() &&
            (
                String(winner.memberId ?? "") === String(member.id) ||
                String(winner.memberName || "").trim().toLowerCase() ===
                String(member.name || "").trim().toLowerCase()
            ) &&
            String(winner.status || "winner").toLowerCase() === "winner"
        );
    }) || null;
}


function ledgerCurrency(value) {
    const amount = Number(value || 0);
    return "₹" + amount.toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}

function ledgerEscape(value) {
    return escapeHTML(value);
}

function getLedgerInstallmentAmount(scheme, month, member, ticket) {
    const payments = getLedgerPayments(member, scheme, ticket);
    const existing = payments.find(function (payment) {
        return Number(payment.month) === Number(month);
    });

    // A paid receipt is historical and must not be changed. Pending/unpaid
    // records are recalculated so a winner decided in Month N changes the
    // payable amount from Month N onward.
    if (existing && String(existing.status || "paid").toLowerCase() === "paid" && Number(existing.amount || 0) > 0) {
        return Number(existing.amount);
    }

    const type = String(scheme.type || "").toLowerCase();

    if (type === "gold") {
        const monthly = scheme.goldMonthlyInstallments || {};
        return Number(monthly[String(month)] ?? monthly[month] ?? 0) || 0;
    }

    const total = Number(scheme.totalAmount || 0);
    const winner = getLedgerWinner(member, scheme, ticket);
    const winningMonth = winner ? Number(winner.month) : Number(
        (getLedgerMemberEntries(member).find(function (entry) {
            return (
                String(entry.id) === String(scheme.id) ||
                String(entry.name || "").trim().toLowerCase() ===
                String(scheme.name || "").trim().toLowerCase()
            );
        }) || {}).winningMonth || 0
    );

    if (total > 0) {
        return month >= winningMonth && winningMonth > 0
            ? Math.round(total * 0.06)
            : Math.round(total * 0.05);
    }

    return Number(scheme.baseAmount || 0);
}

function openMemberLedger(member) {
    const modal = document.getElementById("memberLedgerModal");
    const container = document.getElementById("memberLedgerContent");

    if (!modal || !container) {
        alert("Member Ledger is not available.");
        return;
    }

    const entries = getLedgerMemberEntries(member);

    if (!entries.length) {
        container.innerHTML = `
            <div class="ledger-header">
                <div>
                    <div class="ledger-title">MEMBER: ${ledgerEscape(member.name || "-")}</div>
                    <div class="ledger-subtitle">Mobile: ${ledgerEscape(member.phone || "-")}</div>
                </div>
            </div>
            <div class="ledger-empty">No chit scheme has been assigned to this member yet.</div>
        `;
        modal.classList.add("active");
        return;
    }

    let html = `
        <div class="ledger-member-head">
            <div>
                <div class="ledger-kicker">MEMBER LEDGER</div>
                <h2>${ledgerEscape(member.name || "-")}</h2>
                <p>Mobile: ${ledgerEscape(member.phone || "-")}</p>
            </div>
            <div class="ledger-member-status">${ledgerEscape(capitalize(member.status || "active"))}</div>
        </div>
    `;

    entries.forEach(function (entry) {
        const scheme = getLedgerSchemeForEntry(entry);
        const ticket = entry.ticket ?? entry.ticketNumber ?? entry.ticketNo ?? "-";
        const duration = Number(scheme.duration || entry.duration || 0);
        const payments = getLedgerPayments(member, scheme, ticket);
        const winner = getLedgerWinner(member, scheme, ticket);

        const paidPayments = payments.filter(function (payment) {
            return String(payment.status || "paid").toLowerCase() === "paid";
        });

        const paidMonths = new Set(
            paidPayments.map(function (payment) {
                return Number(payment.month);
            })
        );

        const paidCount = paidMonths.size;
        const totalInstallments = duration || Math.max(
            paidCount,
            ...payments.map(function (payment) { return Number(payment.month) || 0; }),
            0
        );
        const pendingCount = Math.max(totalInstallments - paidCount, 0);
        const totalPaid = paidPayments.reduce(function (sum, payment) {
            return sum + Number(payment.amount || 0);
        }, 0);

        let totalExpected = 0;
        for (let month = 1; month <= totalInstallments; month++) {
            totalExpected += getLedgerInstallmentAmount(scheme, month, member, ticket);
        }

        const totalPending = Math.max(totalExpected - totalPaid, 0);
        const winningMonth = winner ? Number(winner.month) : Number(entry.winningMonth || 0);

        let winningPayout = "-";
        if (winner) {
            if (String(scheme.type || "").toLowerCase() === "gold") {
                const grams = Number(winner.goldGrams || scheme.goldGrams || 0);
                winningPayout = grams > 0 ? `${grams} gram${grams === 1 ? "" : "s"}` : "-";
            } else {
                winningPayout = ledgerCurrency(winner.payout);
            }
        }

        const rows = [];
        for (let month = 1; month <= totalInstallments; month++) {
            const payment = payments.find(function (item) {
                return Number(item.month) === month;
            });
            const due = getLedgerInstallmentAmount(scheme, month, member, ticket);
            const paid = payment &&
                String(payment.status || "paid").toLowerCase() === "paid"
                ? Number(payment.amount || 0)
                : 0;
            const status = paid > 0 ? "PAID" : "PENDING";
            const statusClass = paid > 0 ? "paid" : "pending";
            const dueDate = payment && payment.dueDate ? formatDate(payment.dueDate) : "-";

            rows.push(`
                <tr>
                    <td>${month}</td>
                    <td>${due > 0 ? ledgerCurrency(due) : "-"}</td>
                    <td>${paid > 0 ? ledgerCurrency(paid) : "₹0"}</td>
                    <td>${dueDate}</td>
                    <td><span class="ledger-status ${statusClass}">${status}</span></td>
                </tr>
            `);
        }

        html += `
            <section class="ledger-scheme">
                <div class="ledger-scheme-head">
                    <div>
                        <h3>${ledgerEscape(scheme.name || entry.name || "-")}</h3>
                        <p>Ticket: <strong>${ledgerEscape(ticket)}</strong> &nbsp; • &nbsp; Type: ${ledgerEscape(scheme.type || "-")}</p>
                    </div>
                </div>

                <div class="ledger-summary-grid">
                    <div class="ledger-summary-card">
                        <span>Total Installments</span>
                        <strong>${totalInstallments}</strong>
                    </div>
                    <div class="ledger-summary-card">
                        <span>Paid</span>
                        <strong>${paidCount}</strong>
                    </div>
                    <div class="ledger-summary-card">
                        <span>Pending</span>
                        <strong>${pendingCount}</strong>
                    </div>
                    <div class="ledger-summary-card">
                        <span>Total Paid</span>
                        <strong>${ledgerCurrency(totalPaid)}</strong>
                    </div>
                    <div class="ledger-summary-card">
                        <span>Total Pending</span>
                        <strong>${ledgerCurrency(totalPending)}</strong>
                    </div>
                    <div class="ledger-summary-card">
                        <span>Winning Month</span>
                        <strong>${winningMonth > 0 ? winningMonth : "-"}</strong>
                    </div>
                    <div class="ledger-summary-card">
                        <span>Winning Payout</span>
                        <strong>${winningPayout}</strong>
                    </div>
                </div>

                <div class="ledger-table-wrap">
                    <table class="ledger-table">
                        <thead>
                            <tr>
                                <th>MONTH</th>
                                <th>DUE</th>
                                <th>PAID</th>
                                <th>DUE DATE</th>
                                <th>STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.length ? rows.join("") : `
                                <tr>
                                    <td colspan="5" class="ledger-empty-cell">No installment records found.</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </section>
        `;
    });

    container.innerHTML = html;
    modal.classList.add("active");
}

function closeMemberLedger() {
    const modal = document.getElementById("memberLedgerModal");
    if (modal) {
        modal.classList.remove("active");
    }
}

/* =========================================================
   DELETE MEMBER
   ========================================================= */

function deleteMember(id) {
    const member =
        members.find(function (item) {
            return Number(item.id) === Number(id);
        });

    if (!member) {
        alert("Member not found.");
        return;
    }

    if (
        !confirm(
            `Delete ${member.name}?`
        )
    ) {
        return;
    }

    members =
        members.filter(function (item) {
            return Number(item.id) !== Number(id);
        });

    saveMembers();

    /* IMPORTANT:
       Reduce scheme member count.
    */
    syncSchemeMemberCounts();

    populateSchemeFilters();
    renderMembers();

    alert("Member deleted successfully.");
}

/* =========================================================
   GENERATE MEMBER ID
   ========================================================= */

function generateMemberId() {
    if (!members.length) {
        return 1;
    }

    return (
        Math.max(
            ...members.map(function (member) {
                return Number(member.id) || 0;
            })
        ) + 1
    );
}

/* =========================================================
   DEFAULT DATE
   ========================================================= */

function setDefaultDate() {
    const input =
        document.getElementById("memberJoinedDate");

    if (!input || input.value) {
        return;
    }

    input.value =
        new Date()
            .toISOString()
            .split("T")[0];
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
            document.getElementById("profileName");

        const profileAvatar =
            document.getElementById("profileAvatar");

        if (profileName) {
            profileName.textContent = name;
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
        console.error("Profile error:", error);
    }
}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDate(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
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
   CLOSE MODAL
   ========================================================= */

document.addEventListener("click", function (event) {
    const modal =
        document.getElementById("memberModal");

    if (
        modal &&
        event.target === modal
    ) {
        closeMemberModal();
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeMemberModal();
    }
});