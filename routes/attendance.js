const express = require("express");
const router = express.Router();
const prisma = require("../prisma");
const {
  utcToEat,
  eatToUtc,
  getTodayEatRangeUTC,
} = require("../utils/date_converter");

router.post("/check-in", async (req, res) => {
  try {
    let { employeeId, secret, isBssid } = req.body;
    console.log("Received check-in request:", req.body);

    // Validation
    if (employeeId == null || secret == null || isBssid == null) {
      return res.status(400).json({
        error: "employeeId, secret, and isBssid are required",
        received: { employeeId, secret, isBssid },
      });
    }

    // If secret looks like JSON, try to parse it and extract the actual secret code
    let actualSecret = secret;
    if (typeof secret === "string" && secret.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(secret);
        if (parsed.secret) {
          actualSecret = parsed.secret;
          console.log("Extracted secret from QR JSON:", actualSecret);
        }
      } catch (e) {
        console.warn("Secret is not valid JSON, using as-is");
      }
    }

    // 1. Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // 2. Retrieve office settings
    const settings = await prisma.officeSettings.findUnique({
      where: { id: 1 },
    });
    if (!settings) {
      return res.status(500).json({ error: "Office settings not configured" });
    }

    // 3. Validate secret code
    if (
      settings.SecretCode.trim().toLowerCase() !==
      actualSecret.trim().toLowerCase()
    ) {
      // console.log (`Settings code :${settings.SecretCode.toLowerCase()}`)
      // console.log (`Secret code :${secret.toLowerCase()}`)
      return res.status(401).json({ error: "Invalid secret code" });
    }

    // 4. Prevent multiple check‑ins for today (using EAT day boundaries)
    const { startUTC, endUTC } = getTodayEatRangeUTC();

    const existing = await prisma.attendance.findFirst({
      where: {
        employeeId,        
        checkInTime: {
          gte: startUTC,
          lte: endUTC,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: "Already checked in today" });
    }

    // 5. Determine if late based on lateThreshold (EAT time)
    const nowUTC = new Date();
    const nowEAT = utcToEat(nowUTC);

    // Parse lateThreshold string (HH:mm:ss) into a Date for today in EAT
    const [hours, minutes, seconds] = settings.lateThreshold
      .split(":")
      .map(Number);
    const thresholdEAT = new Date(nowEAT);
    thresholdEAT.setHours(hours, minutes, seconds, 0);

    // Employee is late if current EAT time is after the threshold
    const isLate = nowEAT > thresholdEAT;

    // 6. Create attendance record
    const attendance = await prisma.attendance.create({
      data: {
        employeeId,
        checkInTime: nowUTC,
        isBssidAvailable: isBssid,
        isCheckedIn: true,
        isLate: isLate,
      },
    });

    console.log("successful");
    res.status(201).json({
      message: "Check‑in successful",
      attendanceId: attendance.id,
    });
  } catch (err) {
    console.error("Error creating attendance:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/check-out", async (req, res) => {
  try {
    const { attendanceId } = req.body;

    if (!attendanceId) {
      return res.status(400).json({ error: "attendanceId is required" });
    }

    // 1. Fetch record
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
    });

    if (!attendance) {
      return res.status(404).json({ error: "Attendance not found" });
    }

    // 2. Validate state
    if (!attendance.isCheckedIn) {
      return res.status(400).json({ error: "User is not checked in" });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({ error: "Already checked out" });
    }

    // 3. Use server UTC time
    const checkOutUtc = new Date();

    // 4. Compute working hours
    const diffMs = checkOutUtc - attendance.checkInTime;

    if (diffMs < 0) {
      return res.status(400).json({ error: "Invalid time difference" });
    }

    const workingHours = diffMs / (1000 * 60 * 60); // ms → hours

    // 5. Update record
    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        checkOutTime: checkOutUtc,
        workingHours: parseFloat(workingHours.toFixed(2)), // round to 2 decimals
        isCheckedIn: false,
      },
    });

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/today/:id", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const nowEAT = utcToEat(new Date());
    const dayOfWeek = nowEAT.getDay(); // 0 = Sun, 6 = Sat

    // Check if it's a weekend
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const { startUTC, endUTC } = getTodayEatRangeUTC();

    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        checkInTime: { gte: startUTC, lte: endUTC },
      },
    });

    // console.log(attendance);

    if (!attendance) {
      return res.json({
        status: "not_checked_in",
        isWeekend,
        message: isWeekend
          ? "It's the weekend!"
          : "You haven't checked in yet.",
      });
    }

    // If no record found and it's a weekday, they are "Not Checked In" (potentially absent)
    return res.json({ status: "checked_in", data: attendance, isWeekend });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/all/:id", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);

    const history = await prisma.attendance.findMany({
      where: { employeeId },
      orderBy: { checkInTime: "desc" },
    });

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/getAll", async (req, res) => {
  try {

    const history = await prisma.attendance.findMany({
      orderBy: { employeeId: "asc"},
    });

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
