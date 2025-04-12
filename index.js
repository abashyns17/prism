// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import bookingsRoutes from "./routes/bookings.js";
import servicesRouter from "./routes/services.js";

dotenv.config();
const app = express();

app.use(cors({
  origin: [
    "http://localhost:3000",
    process.env.FRONTEND_URL || "https://your-frontend-app.up.railway.app",
  ],
  credentials: true,
}));

app.use(bodyParser.json());

// Mount your booking routes
app.use(bookingsRoutes);
// Mount your service routes
app.use(servicesRouter);

// Health check
app.get("/", (req, res) => {
  res.send("Booking API is running");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});