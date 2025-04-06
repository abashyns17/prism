const express = require("express");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

const cors = require("cors");

app.use(cors({
  origin: [
    "http://localhost:3000", // for local dev
    // "https://your-frontend-app.up.railway.app" // your deployed frontend
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"]
}));

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

// Create a new booking (with conflict check)
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

// Availability engine!

app.get("/availability", async (req, res) => {
  const { serviceId, date } = req.query;

  //  Validate inputs
  if (!serviceId || !date || isNaN(Date.parse(date))) {
    return res.status(400).json({ error: "Invalid or missing serviceId/date" });
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return res.status(404).json({ error: "Service not found" });

  const durationMinutes = service.duration;

  const startHour = 9;
  const endHour = 17;
  const dateStart = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00`);
  const dateEnd = new Date(`${date}T${endHour}:00:00`);

  const bookings = await prisma.booking.findMany({
    where: {
      startTime: {
        gte: dateStart,
        lt: dateEnd,
      },
    },
  });

  const slots = [];
  const stepMinutes = 15;
  const now = new Date(dateStart);

  while (now.getTime() + durationMinutes * 60000 <= dateEnd.getTime()) {
    const proposedStart = new Date(now);
    const proposedEnd = new Date(now.getTime() + durationMinutes * 60000);

    const conflict = bookings.some((b) => {
      const bookingStart = new Date(b.startTime);
      const bookingEnd = new Date(b.endTime);
      return proposedStart < bookingEnd && proposedEnd > bookingStart;
    });

    if (!conflict) {
      slots.push(proposedStart.toISOString());
    }

    now.setMinutes(now.getMinutes() + stepMinutes);
  }

  res.json(slots);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
