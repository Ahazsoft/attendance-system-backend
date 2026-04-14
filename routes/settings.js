const express = require("express");
const router = express.Router();
const prisma = require("../prisma");
const {
  utcToEat,
  eatToUtc,
  getTodayEatRangeUTC,
} = require("../utils/date_converter");

router.put("/update", async (req, res) => {
  console.log("working")
  try {
    const { radius, gpsLatitude, gpsLongitude, bssid, lateThreshold , SecretCode} =
      req.body;

    const data = {};
    if (radius !== undefined) data.radius = parseInt(radius);
    if (gpsLatitude !== undefined) data.gpsLatitude = parseFloat(gpsLatitude);
    if (gpsLongitude !== undefined)
      data.gpsLongitude = parseFloat(gpsLongitude);
    if (bssid !== undefined) data.bssid = bssid;
    if (lateThreshold !== undefined)
      data.lateThreshold = lateThreshold;
    if (SecretCode !== undefined) data.SecretCode = SecretCode;


    const setting = await prisma.officeSettings.upsert({
      where: { id: 1 },
      update: data,
      create: {
        id: 1,
        radius: data.radius || 0,
        gpsLatitude: data.gpsLatitude || 0,
        gpsLongitude: data.gpsLongitude || 0,
        bssid: data.bssid || "",
        lateThreshold: data.lateThreshold || "09:00:00",
        SecretCode: data.SecretCode, 
      },
    });

    res.json(setting);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/read", async (req, res) => {
  try {
    const setting = await prisma.officeSettings.findUnique({
      where: { id: 1 },
    });

    if (!setting) {
      return res.status(404).json({ error: "Settings not found" });
    }

    // lateThreshold is already stored as HH:mm:ss string
    const formatted = {
      ...setting,
      lateThreshold: setting.lateThreshold,
    };

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/getServerTime", (req, res) => {
  try {
    const nowUTC = new Date();
    console.log(nowUTC);
    res.json({
      success: true,
      // ISO string is ALWAYS in UTC (ends with Z)
      utcTime: nowUTC.toISOString(),
      // Optional readable format (still UTC if you force it)
      formattedTime: nowUTC.toLocaleTimeString("en-GB", {
        timeZone: "UTC",
      }),
      timestamp: nowUTC.getTime(), // Unix ms (UTC-based)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
