import express from 'express';
import { Authorizer } from '@authorizerdev/authorizer-js';
import prisma from '../lib/prisma.js';

const router = express.Router();

const authorizer = new Authorizer({
  authorizerURL: process.env.AUTHORIZER_URL?.trim() || '',
  clientID: process.env.AUTHORIZER_CLIENT_ID?.trim() || '',
  redirectURL: process.env.AUTHORIZER_REDIRECT_URL?.trim() || '',
});

router.post('/bookings', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const session = await authorizer.validateToken(token);
    const user = session?.user;

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { serviceId, date, time } = req.body;
    const startTime = new Date(`${date}T${time}`);
    const durationMs = 45 * 60 * 1000; // Example static duration
    const endTime = new Date(startTime.getTime() + durationMs);

    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        serviceId,
        startTime,
        endTime,
      },
    });

    res.status(201).json(booking);
  } catch (err) {
    console.error('Booking error:', err);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default router;
