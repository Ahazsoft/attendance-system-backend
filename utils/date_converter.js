/**
 * Convert UTC Date to East Africa Time (UTC+3)
 * Returns a new Date object adjusted by +3 hours.
 */
function utcToEat(utcDate) {
  const eatTime = new Date(utcDate.getTime() + 3 * 60 * 60 * 1000);
  return eatTime;
}

/**
 * Convert East Africa Time Date to UTC (UTC-3)
 * Returns a new Date object adjusted by -3 hours.
 */
function eatToUtc(eatDate) {
  const utcTime = new Date(eatDate.getTime() - 3 * 60 * 60 * 1000);
  return utcTime;
}

/**
 * Get start and end of current day in EAT, returned as UTC Date objects
 * for database queries.
 */
function getTodayEatRangeUTC() {
  // Current time in EAT
  const now = new Date();
  const eatNow = utcToEat(now);

  // Start of day in EAT (00:00:00.000)
  const eatStart = new Date(eatNow);
  eatStart.setHours(0, 0, 0, 0);

  // End of day in EAT (23:59:59.999)
  const eatEnd = new Date(eatNow);
  eatEnd.setHours(23, 59, 59, 999);

  // Convert back to UTC for Prisma queries
  return {
    startUTC: eatToUtc(eatStart),
    endUTC: eatToUtc(eatEnd),
  };
}

module.exports = {
  utcToEat,
  eatToUtc,
  getTodayEatRangeUTC,
};