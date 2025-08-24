import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { put } from '@vercel/blob';
import formidable from 'formidable';
import fs from 'fs/promises';

// Desabilita o body parser padrão da Vercel para permitir que o formidable processe o stream.
export const config = {
  api: {
    bodyParser: false,
  },
};

const prisma = new PrismaClient();

// Função auxiliar para parsear o formulário com formidable
const parseForm = (req: VercelRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  return new Promise((resolve, reject) => {
    const form = formidable({});
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
};

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
        const { fields, files } = await parseForm(req);

        const bookingDataString = fields.bookingData?.[0];
        if (!bookingDataString) {
          return res.status(400).json({ error: 'bookingData field is missing' });
        }
        const bookingData = JSON.parse(bookingDataString);
       
        const {
            userInfo, selectedDate, selectedTime, totalDuration, 
            serviceNames, totalCost
        } = bookingData;
        
        if (!userInfo || !selectedDate || !selectedTime || !totalDuration || !serviceNames || totalCost === undefined) {
             return res.status(400).json({ error: 'Missing required booking data' });
        }

        let inspirationUrl = null;
        const inspirationFile = files.inspirationFile?.[0];
        if (inspirationFile && inspirationFile.size > 0) {
          const fileContent = await fs.readFile(inspirationFile.filepath);
          const uniqueFilename = `${Date.now()}-${inspirationFile.originalFilename}`;
          const blob = await put(uniqueFilename, fileContent, {
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

      } catch (error: any) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Failed to create booking', details: error.message });
      }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
