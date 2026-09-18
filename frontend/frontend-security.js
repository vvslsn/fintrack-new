/* FinTrack Frontend-Only Safeguards
 * Uses localStorage only. This is a UX/data-integrity layer, not server security.
 */
(function (w) {
  'use strict';
  const AUDIT_KEY = 'fintrack_audit_logs';
  const PAYMENT_KEY = 'fintrack_payments';
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  w.FinTrackFrontend = w.FinTrackFrontend || {};
  w.FinTrackFrontend.audit = function (action, details) {
    const logs = read(AUDIT_KEY, []);
    logs.unshift({ id: 'AUD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), action, details: details || {}, at: new Date().toISOString() });
    write(AUDIT_KEY, logs.slice(0, 500));
  };
  w.FinTrackFrontend.isDuplicatePayment = function (candidate, records) {
    const list = Array.isArray(records) ? records : read(PAYMENT_KEY, []);
    return list.some(p => String(p.memberId) === String(candidate.memberId) && String(p.schemeId) === String(candidate.schemeId) && String(p.ticketId) === String(candidate.ticketId) && String(p.month) === String(candidate.month));
  };
  w.FinTrackFrontend.isDuplicateUtr = function (utr, records) {
    if (!utr) return false;
    const list = Array.isArray(records) ? records : read(PAYMENT_KEY, []);
    return list.some(p => String(p.utr || '').trim().toLowerCase() === String(utr).trim().toLowerCase());
  };
  w.FinTrackFrontend.calculateMonthlyAmount = function (scheme, ticket, month, winnerMonth) {
    const type = String(scheme && scheme.type || 'cash').toLowerCase();
    if (type.includes('gold')) return Number(ticket && ticket.monthlyInstallment || scheme && scheme.monthlyInstallment || 0);
    const total = Number(scheme && scheme.totalAmount || 0);
    const normal = Number(scheme && scheme.normalInstallment || total * 0.05);
    const winner = Number(scheme && scheme.winnerInstallment || total * 0.06);
    return Number(month) >= Number(winnerMonth || Infinity) ? winner : normal;
  };
  w.FinTrackFrontend.getAuditLogs = () => read(AUDIT_KEY, []);
})(window);
