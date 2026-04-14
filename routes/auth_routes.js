const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma");

// Signup
router.post("/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password, position } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existing = await prisma.employee.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const saltRounds = 10;
    const hashed = await bcrypt.hash(password, saltRounds);

    const created = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashed,
        position: position || null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isAdmin: true,
      },
    });

    return res.status(201).json({ user: created });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Signin
router.post("/signin", async (req, res) => {
    try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const user = await prisma.employee.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const payload = { id: user.id, email: user.email, isAdmin: user.isAdmin };
    const secret = process.env.JWT_SECRET || "change_this_in_production";
    const token = jwt.sign(payload, secret, { expiresIn: "8h" });
   
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        isApproved:user.isApproved,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// logout
router.post("/logout", async (req, res) => {
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Could not log out" });
    }
    // Clear the session cookie (optional, but good practice)
    res.clearCookie("connect.sid"); // adjust cookie name if needed
    return res.status(200).json({ message: "Logged out successfully" });
  });
});

module.exports = router;
