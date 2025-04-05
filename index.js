const express = require("express");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("API is working!");
});

// Fetch all services
app.get("/services", async (req, res) => {
  const services = await prisma.service.findMany();
  res.json(services);
});

app.post("/services", async (req, res) => {
  const { name, price, duration } = req.body;

  if (!name || !price || !duration) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const service = await prisma.service.create({
    data: { name, price, duration },
  });

  res.status(201).json(service);
});

// 🔥 Create a new booking (with conflict check)
app.post("/bookings", async (req, res) => {
  const { userId, serviceId, startTime } = req.body;

  // Validate service
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return res.status(404).json({ error: "Service not found" });

  const duration = service.duration;
  const endTime = new Date(new Date(startTime).getTime() + duration * 60000);

  // Check for overlapping bookings for the same service
  const overlapping = await prisma.booking.findFirst({
    where: {
      serviceId,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });

  if (overlapping) {
    return res.status(409).json({ error: "Time slot unavailable for this service" });
  }

  // Create booking
  const booking = await prisma.booking.create({
    data: {
      userId,
      serviceId,
      startTime: new Date(startTime),
      endTime,
    },
  });

  res.json(booking);
});

app.get("/bookings", async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        service: true, // include service info (name, duration, price, etc.)
      },
      orderBy: {
        startTime: "asc",
      },
    });

    res.json(bookings);
  } catch (err) {
    console.error("Failed to fetch bookings:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
