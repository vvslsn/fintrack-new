/* Shared by the browser and backend so every payment flow uses one due-date rule. */
(function (root, factory) {
  const schedule = factory();
  if (typeof module === "object" && module.exports) module.exports = schedule;
  if (root) {
    root.getFintrackMonthlyDueDate = schedule.getMonthlyDueDate;
    root.getFintrackCycleDueDate = schedule.getCycleDueDate;
    root.getFintrackDueDate = schedule.getCycleDueDate;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function schemeParts(scheme) {
    const value = String(scheme?.startDate || "").slice(0, 10);
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const [, year, month, day] = match.map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, month, day };
  }

  function validDueDay(scheme) {
    const day = Number(scheme?.dueDate ?? 10);
    return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
  }

  function getMonthlyDueDate(scheme, year, month) {
    const dueDay = validDueDay(scheme);
    const y = Number(year), m = Number(month);
    if (!dueDay || !Number.isInteger(y) || y < 1 || !Number.isInteger(m) || m < 1 || m > 12) return null;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return new Date(Date.UTC(y, m - 1, Math.min(dueDay, lastDay)));
  }

  // Cycle one is due in the start month unless its due day has already passed
  // by the scheme start date; later cycles advance one calendar month each.
  function getCycleDueDate(scheme, cycle) {
    const start = schemeParts(scheme);
    const dueDay = validDueDay(scheme);
    const index = Number(cycle);
    if (!start || !dueDay || !Number.isInteger(index) || index < 1) return null;
    const offset = index - 1 + (dueDay < start.day ? 1 : 0);
    const absoluteMonth = start.month - 1 + offset;
    const year = start.year + Math.floor(absoluteMonth / 12);
    const month = absoluteMonth % 12 + 1;
    return getMonthlyDueDate(scheme, year, month);
  }

  return { getMonthlyDueDate, getCycleDueDate };
});
