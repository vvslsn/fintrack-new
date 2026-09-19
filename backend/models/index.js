module.exports = {
    Member: require("./Member"),
    User: require("./User"),
    Scheme: require("./Scheme"),
    MemberSchemeTicket: require("./MemberSchemeTicket"),
    Winner: require("./Winner"),
    Payment: require("./Payment"),
    AdminPayout: require("./AdminPayout"),
    OnlinePaymentRequest: require("./OnlinePaymentRequest"),
    ...require("./PaymentSettings"), // { BankAccount, PaymentSettings }
    Notification: require("./Notification"),
    AuditLog: require("./AuditLog")
};
