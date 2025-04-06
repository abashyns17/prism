// routes/bookings.js
import express from "express";
import dotenv from "dotenv";
import { Authorizer } from "@authorizerdev/authorizer-js";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const router = express.Router();
const prisma = new PrismaClient();

const authorizer = new Authorizer({
  authorizerURL: process.env.AUTHORIZER_URL.trim(),
  clientID: process.env.AUTHORIZER_CLIENT_ID.trim(),
  redirectURL: process.env.REDIRECT_URL.trim() // now using env variable
});

// POST /bookings
router.post("/bookings", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const { data: userInfo, errors } = await authorizer.getSession({ Authorization: `Bearer ${token}` });
    if (errors?.length || !userInfo?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const userId = userInfo.user.id;
    const { serviceId, startTime } = req.body;

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return res.status(404).json({ error: "Service not found" });

    const start = new Date(startTime);
    const end = new Date(start.getTime() + service.duration * 60000);

    const booking = await prisma.booking.create({
      data: {
        userId,
        serviceId,
        startTime: start,
        endTime: end,
        status: "confirmed",
      },
    });

    res.json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Booking failed" });
  }
});

// GET /my-bookings
router.get("/my-bookings", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const { data: userInfo, errors } = await authorizer.getSession({ Authorization: `Bearer ${token}` });
    if (errors?.length || !userInfo?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const userId = userInfo.user.id;

    const bookings = await prisma.booking.findMany({
      where: { userId },
      include: { service: true },
      orderBy: { startTime: "desc" },
    });

    res.json(bookings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// GET /services
router.get("/services", async (req, res) => {
  try {
    const services = await prisma.service.findMany();
    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load services" });
  }
});

export default router;
