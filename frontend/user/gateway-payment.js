"use strict";

function loadRazorpayCheckout() {
    if (window.Razorpay) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = resolve;
        script.onerror = () => reject(new Error("Could not load the secure payment checkout. Check your internet connection and try again."));
        document.head.appendChild(script);
    });
}

async function initPayNowPage() {
    const user = requireUser();
    if (!user) return;
    const query = new URLSearchParams(location.search);
    const schemeId = query.get("schemeId");
    const ticketNumber = query.get("ticket");
    const month = Number(query.get("month"));

    try {
        const data = await userData();
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
        const paid = paidFor(data, ticket, month);
        if (paid) {
            location.href = "user-payments.html";
            return;
        }

        document.body.innerHTML = `
            <main class="pay-page">
                <div class="pay-wrap">
                    <a href="user-payments.html">← Back to payments</a>
                    <section class="card pay-card gateway-pay-card">
                        <p class="gateway-eyebrow">SECURE PAYMENT</p>
                        <h1>Pay ${money(installmentAmount)}</h1>
                        <p>${esc(scheme.name)} · Ticket #${esc(ticketNo(ticket))} · Month ${month}</p>
                        <p>Due date: ${dateText(due)}</p>
                        <div class="gateway-methods" aria-label="Available payment methods">
                            <span>UPI</span><span>Net banking</span><span>Credit card</span><span>Debit card</span>
                        </div>
                        <p class="gateway-secure-note">Your card and bank details are entered securely on Razorpay Checkout. FinTrack does not store card details.</p>
                        <button class="btn gateway-pay-button" id="gatewayPayButton" type="button" disabled>Loading secure checkout…</button>
                        <p id="gatewayPaymentMessage" class="gateway-payment-message" role="status"></p>
                    </section>
                </div>
            </main>`;

        const payButton = document.getElementById("gatewayPayButton");
        const message = document.getElementById("gatewayPaymentMessage");
        loadRazorpayCheckout().then(() => {
            payButton.disabled = false;
            payButton.textContent = `Continue to pay ${money(installmentAmount)}`;
        }).catch(error => {
            payButton.textContent = "Checkout unavailable";
            message.textContent = error.message;
        });

        payButton.addEventListener("click", async () => {
            payButton.disabled = true;
            payButton.textContent = "Preparing payment…";
            message.textContent = "";
            try {
                const order = await fintrackApi("/payments/gateway/order", {
                    method: "POST",
                    body: JSON.stringify({ schemeId, ticketNumber, month })
                });
                const checkout = new Razorpay({
                    key: order.keyId,
                    amount: order.amount,
                    currency: order.currency,
                    name: "FinTrack",
                    description: order.description,
                    order_id: order.orderId,
                    prefill: {
                        name: order.customer.name || data.member.name,
                        email: order.customer.email || data.member.email,
                        contact: order.customer.phone || data.member.phone
                    },
                    config: {
                        display: {
                            blocks: {
                                fintrack_methods: {
                                    name: "UPI, Net banking and Cards",
                                    instruments: [{ method: "upi" }, { method: "netbanking" }, { method: "card" }]
                                }
                            },
                            sequence: ["block.fintrack_methods"],
                            preferences: { show_default_blocks: false }
                        }
                    },
                    theme: { color: "#2563eb" },
                    handler: async response => {
                        message.textContent = "Confirming your payment…";
                        try {
                            await fintrackApi("/payments/gateway/verify", {
                                method: "POST",
                                body: JSON.stringify(response)
                            });
                            message.textContent = "Payment received and recorded.";
                            location.href = "user-payments.html";
                        } catch (error) {
                            message.textContent = `${error.message} If your bank shows a debit, wait a moment and refresh payment history before paying again.`;
                            payButton.disabled = false;
                            payButton.textContent = `Retry payment verification`;
                        }
                    },
                    modal: {
                        ondismiss: () => {
                            payButton.disabled = false;
                            payButton.textContent = `Continue to pay ${money(installmentAmount)}`;
                        }
                    }
                });
                checkout.on("payment.failed", event => {
                    message.textContent = event.error?.description || "Payment was not completed. You can try again.";
                    payButton.disabled = false;
                    payButton.textContent = `Try again · ${money(installmentAmount)}`;
                });
                checkout.open();
            } catch (error) {
                message.textContent = error.message;
                payButton.disabled = false;
                payButton.textContent = `Try again · ${money(installmentAmount)}`;
            }
        });
    } catch (error) {
        alert(error.message);
        location.href = "user-payments.html";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (location.pathname.split("/").pop() === "user-pay.html") initPayNowPage();
});
