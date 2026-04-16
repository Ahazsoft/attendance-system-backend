const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv/config");

const adapter = new PrismaPg({
  connectionString: process.env["DATABASE_URL"],
});

const prisma = new PrismaClient({ adapter });

// ================= CONFIG =================
const EMPLOYEE_ID = 2;
const LATE_COUNT = 4;
const ABSENT_COUNT = 3;

// Ethiopian holidays (adjust yearly if needed)
const HOLIDAYS = [
  "2025-01-07",
  "2025-01-19",
  "2025-03-02",
  "2025-04-18",
  "2025-04-20",
  "2025-05-01",
  "2025-05-05",
  "2025-05-28",
  "2025-09-11",
  "2025-09-27",
];

// ================= HELPERS =================
function formatDateLocal(date) {
  return date.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(date) {
  return HOLIDAYS.includes(formatDateLocal(date));
}

function isWorkingDay(date) {
  return !isWeekend(date) && !isHoliday(date);
}

// Generate check-in time
function getCheckInTime(date, { forceLate = false } = {}) {
  const base = new Date(date);

  if (forceLate) {
    // Late: between 9:00–9:59
    const minutes = Math.floor(Math.random() * 60);
    base.setHours(9, minutes, 0, 0);
    return base;
  }

  // Normal: around 8:30 ±30 mins
  base.setHours(8, 30, 0, 0);
  const offset = Math.floor(Math.random() * 60) - 30;
  base.setMinutes(base.getMinutes() + offset);

  return base;
}

// Generate check-out time (8–9 hrs later)
function getCheckOutTime(checkInTime) {
  const hours = 8 + Math.random();
  return new Date(checkInTime.getTime() + hours * 60 * 60 * 1000);
}

function getLateThreshold(date) {
  const t = new Date(date);
  t.setHours(9, 0, 0, 0);
  return t;
}

// ================= SEED LOGIC =================
async function seedAttendance() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 2);

  console.log(
    `Seeding employeeId=${EMPLOYEE_ID} from ${startDate.toDateString()} to ${endDate.toDateString()}`
  );

  // Delete old records in range
  await prisma.attendance.deleteMany({
    where: {
      employeeId: EMPLOYEE_ID,
      checkInTime: { gte: startDate, lte: endDate },
    },
  });

  // Collect working days
  const workingDays = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (isWorkingDay(d)) {
      workingDays.push(new Date(d));
    }
  }

  if (workingDays.length < LATE_COUNT + ABSENT_COUNT) {
    throw new Error("Not enough working days to assign late & absent.");
  }

  // Shuffle days randomly
  const shuffled = [...workingDays].sort(() => 0.5 - Math.random());

  const lateDays = shuffled.slice(0, LATE_COUNT);
  const absentDays = shuffled.slice(LATE_COUNT, LATE_COUNT + ABSENT_COUNT);

  const lateSet = new Set(lateDays.map(formatDateLocal));
  const absentSet = new Set(absentDays.map(formatDateLocal));

  let created = 0;

  for (const day of workingDays) {
    const dateKey = formatDateLocal(day);

    // Skip absences → NO ROW CREATED
    if (absentSet.has(dateKey)) continue;

    const forceLate = lateSet.has(dateKey);

    const checkIn = getCheckInTime(day, { forceLate });
    const checkOut = getCheckOutTime(checkIn);

    const workingHours = (checkOut - checkIn) / (1000 * 60 * 60);
    const isLate = checkIn > getLateThreshold(day);

    await prisma.attendance.create({
      data: {
        employeeId: EMPLOYEE_ID,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        workingHours: Math.round(workingHours * 100) / 100,
        isBssidAvailable: Math.random() > 0.2,
        isCheckedIn: true,
        isLate,
      },
    });

    created++;
  }

  console.log(`✅ Created ${created} attendance records`);
  console.log(`⏰ Late days: ${lateDays.length}`);
  console.log(`🚫 Absences (no row): ${absentDays.length}`);
}

// ================= RUN =================
seedAttendance()
  .catch(console.error)
  .finally(() => prisma.$disconnect());