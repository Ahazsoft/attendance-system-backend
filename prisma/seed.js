//@ts-nocheck

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require ("@prisma/adapter-pg");
require("dotenv/config");


const adapter = new PrismaPg({
  connectionString: process.env["DATABASE_URL"],
});

const prisma = new PrismaClient({ adapter });
// Ethiopian holidays (adjust dates as needed)
const HOLIDAYS = [
  '2025-01-07', // Ethiopian Christmas
  '2025-01-19', // Epiphany
  '2025-03-02', // Adwa Victory Day
  '2025-04-18', // Good Friday
  '2025-04-20', // Easter Sunday
  '2025-05-01', // Labour Day
  '2025-05-05', // Patriots' Day
  '2025-05-28', // Derg Downfall
  '2025-09-11', // New Year
  '2025-09-27', // Meskel
];

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

function isHoliday(date) {
  const dateStr = date.toISOString().split('T')[0];
  return HOLIDAYS.includes(dateStr);
}

function isWorkingDay(date) {
  return !isWeekend(date) && !isHoliday(date);
}

// Generate a check‑in time around 8:30 AM (±30 minutes)
function getCheckInTime(date) {
  const base = new Date(date);
  base.setHours(8, 30, 0, 0);
  // Optional small random offset: up to ±30 minutes
  const offset = Math.floor(Math.random() * 60) - 30; // -30 to +29 minutes
  base.setMinutes(base.getMinutes() + offset);
  return base;
}

// Generate check‑out time based on check‑in to achieve 8–9 hours
function getCheckOutTime(checkInTime) {
  const hoursNeeded = 8 + Math.random(); // 8.0 to 9.0 hours
  return new Date(checkInTime.getTime() + hoursNeeded * 60 * 60 * 1000);
}

async function seedAttendance() {
  const EMPLOYEE_ID = 3;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 2);

  console.log(`Seeding from ${startDate.toDateString()} to ${endDate.toDateString()}`);

  // Clear existing data for this employee in the range (optional)
  await prisma.attendance.deleteMany({
    where: {
      employeeId: EMPLOYEE_ID,
      checkInTime: { gte: startDate, lte: endDate },
    },
  });

  let count = 0;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (!isWorkingDay(d)) continue;

    const checkIn = getCheckInTime(d);
    const checkOut = getCheckOutTime(checkIn);

    // Calculate working hours precisely
    const workingHours = (checkOut - checkIn) / (1000 * 60 * 60);

    // Late if after 9:00 AM (adjust threshold as needed)
    const lateThreshold = new Date(d);
    lateThreshold.setHours(9, 0, 0, 0);
    const isLate = checkIn > lateThreshold;

    await prisma.attendance.create({
      data: {
        employeeId: EMPLOYEE_ID,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        workingHours: Math.round(workingHours * 100) / 100, // 2 decimals
        isBssidAvailable: Math.random() > 0.2, // 80% true
        isCheckedIn: true,
        isLate,
      },
    });

    count++;
  }

  console.log(`✅ Created ${count} attendance records.`);
}

seedAttendance()
  .catch(console.error)
  .finally(() => prisma.$disconnect());