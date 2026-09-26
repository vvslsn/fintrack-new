"use strict";

async function initPayNowPage() {
    const user = requireUser();
    if (!user) return;
    const query = new URLSearchParams(location.search);
    const schemeId = query.get("schemeId");
    const ticketNumber = query.get("ticket");
    const month = Number(query.get("month"));

    try {
        const [data, paymentData] = await Promise.all([
            userData(),
            fintrackApi("/settings/payment")
        ]);
        const ticket = data.tickets.find(row =>
            String(row.scheme?._id || row.scheme?.id) === String(schemeId) && ticketNo(row) === String(ticketNumber)
        );
        if (!ticket || !Number.isInteger(month) || month < 1 || month > Number(schemeOf(ticket).duration)) {
            location.href = "user-payments.html";
            return;
        }
        const scheme = schemeOf(ticket);
        const installmentAmount = amount(scheme, ticket, month);
        const due = dueDate(scheme, month);
        if (paidFor(data, ticket, month) || !(installmentAmount > 0)) {
            location.href = "user-payments.html";
            return;
        }

        const settings = paymentData.settings || {};
        const upi = settings.upi || {};
        const account = settings.activeAccount && typeof settings.activeAccount === "object" ? settings.activeAccount : null;
        const qr = upi.qrCode || "";
        const hasPaymentDetails = Boolean(upi.upiId || upi.phonePeNumber || qr || account || settings.instructions);
        const upiDetails = [
            upi.upiId ? `<p><span>UPI ID</span><b>${esc(upi.upiId)}</b></p>` : "",
            upi.phonePeNumber ? `<p><span>PhonePe number</span><b>${esc(upi.phonePeNumber)}</b></p>` : ""
        ].join("");
        const bankDetails = account ? `<div class="bank-detail"><p><span>Account holder</span><b>${esc(account.holderName)}</b></p><p><span>Bank</span><b>${esc(account.bankName)}${account.branch ? ` · ${esc(account.branch)}` : ""}</b></p><p><span>Account number</span><b>${esc(account.accountNumber)}</b></p><p><span>IFSC</span><b>${esc(account.ifsc)}</b></p>${account.accountType ? `<p><span>Account type</span><b>${esc(account.accountType)}</b></p>` : ""}</div>` : "";

        document.body.innerHTML = `
            <main class="pay-page">
                <div class="pay-wrap">
                    <a class="pay-back" href="user-payments.html">← Back to payments</a>
                    <section class="card pay-card gateway-pay-card">
                        <p class="gateway-eyebrow">PAY YOUR MANAGER</p>
                        <h1>Pay ${money(installmentAmount)}</h1>
                        <p>${esc(scheme.name)} · Ticket #${esc(ticketNo(ticket))} · Month ${month}</p>
                        <p>Due date: ${dateText(due)}</p>
                        ${hasPaymentDetails ? `<section class="manager-payment-details"><h2>Payment details</h2>
                            ${upiDetails || qr ? `<div class="manager-payment-method"><h3>${esc(upi.label || "UPI / PhonePe")}</h3>${upiDetails}${qr ? `<img class="payment-qr" src="${esc(qr)}" alt="Manager's payment QR code">` : ""}</div>` : ""}
                            ${bankDetails ? `<div class="manager-payment-method"><h3>Bank transfer</h3>${bankDetails}</div>` : ""}
                            ${settings.instructions ? `<div class="manager-payment-instructions"><h3>Instructions</h3><p>${esc(settings.instructions).replace(/\n/g, "<br>")}</p></div>` : ""}
                        </section>` : `<p class="manager-payment-unavailable">Your manager has not added payment details yet. Please contact your manager before making a transfer.</p>`}
                        <form id="managerPaymentForm" class="online-payment-form">
                            <h2>Submit payment for verification</h2>
                            <p class="form-help">After transferring the amount above to your manager, enter the UTR or transaction reference from your payment app or bank receipt.</p>
                            <label for="managerPaymentMethod">Payment method</label>
                            <select id="managerPaymentMethod" required><option value="UPI">UPI</option><option value="PhonePe">PhonePe</option><option value="Bank transfer">Bank transfer</option></select>
                            <label for="managerPaymentUtr">UTR / transaction reference</label>
                            <input id="managerPaymentUtr" name="utr" type="text" maxlength="120" autocomplete="off" placeholder="Enter your transaction reference" required>
                            <button class="btn pay-submit" id="managerPaymentSubmit" type="submit" ${hasPaymentDetails ? "" : "disabled"}>I have paid · Submit for verification</button>
                            <p id="managerPaymentMessage" class="gateway-payment-message" role="status" aria-live="polite"></p>
                        </form>
                    </section>
                </div>
            </main>`;

        const form = document.getElementById("managerPaymentForm");
        const submit = document.getElementById("managerPaymentSubmit");
        const message = document.getElementById("managerPaymentMessage");
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const utr = document.getElementById("managerPaymentUtr").value.trim();
            if (!utr) return;
            submit.disabled = true;
            submit.textContent = "Submitting…";
            message.textContent = "";
            try {
                await fintrackApi("/payments/online", {
                    method: "POST",
                    body: JSON.stringify({ schemeId, ticketNumber, month, utr, paymentMethod: document.getElementById("managerPaymentMethod").value })
                });
                form.innerHTML = `<p class="manager-payment-success">Payment submitted. Your manager will verify it and update your payment history.</p><a class="btn" href="user-payments.html">View payment history</a>`;
            } catch (error) {
                message.textContent = error.message;
                submit.disabled = false;
                submit.textContent = "I have paid · Submit for verification";
            }
        });
    } catch (error) {
        document.body.innerHTML = `<main class="pay-page"><div class="pay-wrap"><a class="pay-back" href="user-payments.html">← Back to payments</a><div class="card payment-error">${esc(error.message)}</div></div></main>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (location.pathname.split("/").pop() === "user-pay.html") initPayNowPage();
});
