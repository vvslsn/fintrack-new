FinTrack - Chit Business Rules Update

Implemented:
1. Any chit amount is supported: ₹1L, ₹2L, ₹3L, ₹4L, etc.
2. Normal monthly payment = 5% of chit amount.
3. From the winning month INCLUDING that month, the winning ticket pays 6% every month until the final month.
4. Winning payout:
   Month 1 = 95% of chit amount
   Each next month = +1% of chit amount
   Month 20 = 114% of chit amount
5. Winner is stored per ticket, so one member with multiple tickets can win different months on different tickets.
6. Same member can be added multiple times to the same scheme.
7. Ticket numbers are unique inside a scheme and auto-generated if left blank.
8. Monthly Winners are the only winner workflow; the old Auction workflow and storage key are removed.
10. Payment records now require a ticket and calculate the amount using that ticket's winning month.

Examples:
₹1,00,000:
 normal ₹5,000; winner-from-win-month ₹6,000
 Month 1 payout ₹95,000; Month 20 payout ₹1,14,000

₹2,00,000:
 normal ₹10,000; winner-from-win-month ₹12,000
 Month 1 payout ₹1,90,000; Month 20 payout ₹2,28,000

₹3,00,000:
 normal ₹15,000; winner-from-win-month ₹18,000
 Month 1 payout ₹2,85,000; Month 20 payout ₹3,42,000

NEW PAYOUT CONTROL RULES:
11. Admin can record any number of different winners in the same month; the same ticket cannot win more than once in a chit and is removed from future-month eligibility after winning.
12. The same ticket cannot be selected twice in the same month.
13. Admin can stop/skip a month. A stopped month has no winner payout and can later be resumed by adding a winner.

GOLD CHIT VARIABLE MONTHLY INSTALLMENTS
---------------------------------------
- Gold Chit is fixed at 10 grams and does not require a Total Amount.
- Gold Chit has no single fixed monthly installment at scheme creation.
- Admin can set a different rupee installment for every month from Scheme Details.
- Example: Month 1 = 5000, Month 2 = 5500, Month 3 = 4800.
- Payment recording uses the configured amount for the selected month.
- If a month's Gold installment has not been configured, the admin may enter the received amount manually while recording that payment.


PAYMENT DUE-DATE RULES (UPDATED)
--------------------------------
The project now supports automatic installment due dates for both Cash Chit and Gold Chit:

Start date day 1  -> payment day 10 of the same installment month
Start date day 5  -> payment day 15 of the same installment month
Start date day 10 -> payment day 20 of the same installment month
Start date day 15 -> payment day 25 of the same installment month
Start date day 25 -> payment day 5 of the following calendar month

For every member ticket in a scheme, installment records are automatically created as Pending.
A record changes to Paid only when the admin records a payment (or uses Mark Paid).

GOLD CHIT WINNER TABLE
----------------------
Gold Chit no longer displays the "Payment from Winning Month" column.
Cash Chit continues to display it.


ADMIN PAYOUT LEDGER
-------------------
18. Member installment payments and admin-to-member payouts are separate ledgers.
19. For Cash Chits, a monthly winner payout is calculated as 95% of chit value in Month 1, increasing by 1% of chit value for each following winning month.
20. Example ₹1,00,000 Cash Chit: Month 1 = ₹95,000, Month 2 = ₹96,000, ... Month 20 = ₹1,14,000.
21. Example ₹2,00,000 Cash Chit: Month 1 = ₹1,90,000, Month 2 = ₹1,92,000, ... Month 20 = ₹2,28,000.
22. For Gold Chits, the admin payout is the scheme's gold quantity (for example 10 grams or 20 grams), not a cash amount.
23. When a winner is recorded, an Admin Payout is created as Pending. The admin records the payout only after paying the winner or handing over the gold.
24. Cash payout requires a UTR/transaction reference. Gold payout requires a gold handover/receipt reference.

MONTH-BY-MONTH PAYMENT LEDGER DISPLAY
--------------------------------------
25. Member installment records are now generated/displayed only when their installment due date has arrived.
26. If the chit is currently at Month 1, the Payments page shows only Month 1 records.
27. If the chit is currently at Month 5, the Payments page shows Months 1 through 5.
28. If the chit is currently at Month 19, the Payments page shows Months 1 through 19.
29. Future pending installment records are not created or displayed in the Payments ledger. When the next installment becomes due, it is automatically added on refresh/page load.
30. Existing paid history is preserved and is never removed by the month-wise cleanup.
