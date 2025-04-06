// routes/bookings.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import Authorizer from "@authorizerdev/authorizer-js";

const router = express.Router();
const prisma = new PrismaClient();

const authorizerRef = new Authorizer({
  authorizerURL: process.env.AUTHORIZER_URL,
  clientID: process.env.AUTHORIZER_CLIENT_ID,
});

// POST /bookings — create a booking with token-authenticated user
router.post("/bookings", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const { user } = await authorizerRef.getSession(token);
    const userId = user.sub;
    const { serviceId, startTime } = req.body;

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return res.status(404).json({ error: "Service not found" });

    const endTime = new Date(new Date(startTime).getTime() + service.duration * 60000);

    const booking = await prisma.booking.create({
      data: {
        userId,
        serviceId,
        startTime,
        endTime,
        status: "confirmed",
      },
    });

    res.json(booking);
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

// GET /my-bookings — get bookings for the authenticated user
router.get("/my-bookings", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const { user } = await authorizerRef.getSession(token);
    const userId = user.sub;

    const bookings = await prisma.booking.findMany({
      where: { userId },
      include: { service: true },
      orderBy: { startTime: "desc" },
    });

    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

export default router;
