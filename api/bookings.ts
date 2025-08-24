import { Buffer } from 'node:buffer';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { put } from '@vercel/blob';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // --- Rota GET: Buscar agendamentos existentes para uma data ---
  if (req.method === 'GET') {
    const { date } = req.query;
    if (typeof date !== 'string') {
      return res.status(400).json({ error: 'Date parameter is required' });
    }
    try {
      const bookings = await prisma.booking.findMany({
        where: { bookingDate: new Date(date) },
        select: { startTime: true, durationMinutes: true }
      });
      // Formata a resposta para manter a compatibilidade com o frontend (snake_case)
      const formattedBookings = bookings.map(b => ({
        start_time: b.startTime,
        duration_minutes: b.durationMinutes
      }));
      return res.status(200).json(formattedBookings);
    } catch (error) {
      console.error('Prisma Error:', error);
      return res.status(500).json({ error: 'Failed to fetch bookings' });
    }
  }

  // --- Rota POST: Criar um novo agendamento ---
  if (req.method === 'POST') {
     try {
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('multipart/form-data')) {
            return res.status(400).json({ error: 'Invalid content type' });
        }

        const boundary = contentType.split('boundary=')[1];
        const parts = (req.body.toString()).split(`--${boundary}`);
        
        let bookingData: any = {};
        let fileBuffer: Buffer | null = null;
        let filename: string | null = null;

        for (const part of parts) {
            if (part.includes('name="bookingData"')) {
                const jsonPart = part.split('\r\n\r\n')[1].trim();
                bookingData = JSON.parse(jsonPart);
            } else if (part.includes('name="inspirationFile"')) {
                 const content = part.split('\r\n\r\n')[1];
                 const filenameMatch = part.match(/filename="([^"]+)"/);
                 filename = filenameMatch ? filenameMatch[1] : 'inspiration.jpg';
                 const trimmedContent = content.substring(0, content.lastIndexOf('\r\n'));
                 fileBuffer = Buffer.from(trimmedContent, 'binary');
            }
        }
       
        const {
            userInfo, selectedDate, selectedTime, totalDuration, 
            serviceNames, totalCost
        } = bookingData;
        
        if (!userInfo || !selectedDate || !selectedTime || !totalDuration || !serviceNames || totalCost === undefined) {
             return res.status(400).json({ error: 'Missing required booking data' });
        }

        let inspirationUrl = null;
        if (fileBuffer && filename) {
          const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${filename}`;
          const blob = await put(uniqueFilename, fileBuffer, {
            access: 'public',
          });
          inspirationUrl = blob.url;
        }
        
        await prisma.booking.create({
            data: {
                clientName: userInfo.name,
                clientPhone: userInfo.phone,
                bookingDate: new Date(selectedDate),
                startTime: selectedTime,
                durationMinutes: totalDuration,
                services: serviceNames.join(', '),
                totalCost: totalCost,
                inspirationUrl: inspirationUrl,
            }
        });
      
        return res.status(201).json({ message: 'Booking created successfully', inspirationUrl });

      } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Failed to create booking' });
      }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
