import express from "express";
import { Authorizer } from "@authorizerdev/authorizer-js";
import dotenv from "dotenv";
import prisma from "../lib/prisma.js";

dotenv.config();

console.log("Loaded ENV variables:");
console.log("AUTHORIZER_URL:", process.env.AUTHORIZER_URL);
console.log("AUTHORIZER_CLIENT_ID:", process.env.AUTHORIZER_CLIENT_ID);
console.log("REDIRECT_URL:", process.env.REDIRECT_URL);

const router = express.Router();

const { AUTHORIZER_URL, AUTHORIZER_CLIENT_ID } = process.env;

if (!AUTHORIZER_URL || !AUTHORIZER_CLIENT_ID) {
  console.error("Missing AUTHORIZER_URL or AUTHORIZER_CLIENT_ID in environment variables.");
  process.exit(1); // Stop the server immediately
}

const authorizerRef = new Authorizer({
  authorizerURL: AUTHORIZER_URL.trim(),
  clientID: AUTHORIZER_CLIENT_ID.trim(),
  redirectURL: process.env.REDIRECT_URL.trim()
});

// POST /bookings — create a booking
router.post("/bookings", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const session = await authorizerRef.getSession({ Authorization: `Bearer ${token}` });
    if (session.errors?.length) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const userId = session.data.user.id;
    const { serviceId, startTime } = req.body;

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const endTime = new Date(new Date(startTime).getTime() + service.duration * 60000);

    const booking = await prisma.booking.create({
      data: {
        userId,
        serviceId,
        startTime: new Date(startTime),
        endTime,
        status: "confirmed",
      },
    });

    res.json(booking);
  } catch (error) {
    console.error("Booking error:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// GET /my-bookings — fetch bookings for the authenticated user
router.get("/my-bookings", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const session = await authorizerRef.getSession({ Authorization: `Bearer ${token}` });
    if (session.errors?.length) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const userId = session.data.user.id;

    const bookings = await prisma.booking.findMany({
      where: { userId },
      include: {
        service: true,
      },
      orderBy: {
        startTime: "desc",
      },
    });

    res.json(bookings);
  } catch (error) {
    console.error("Fetch bookings error:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

export default router;
