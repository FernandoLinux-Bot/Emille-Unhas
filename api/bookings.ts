import { Buffer } from 'node:buffer';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // --- Rota GET: Buscar agendamentos existentes para uma data ---
  if (req.method === 'GET') {
    const { date } = req.query;
    if (typeof date !== 'string') {
      return res.status(400).json({ error: 'Date parameter is required' });
    }
    try {
      const { rows } = await sql`
        SELECT start_time, duration_minutes 
        FROM Bookings 
        WHERE booking_date = ${date};
      `;
      return res.status(200).json(rows);
    } catch (error) {
      console.error('Database Error:', error);
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

        // Simples parser para multipart/form-data (adequado para este caso)
        // Bibliotecas como 'formidable' seriam mais robustas para casos complexos
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
                 // Extrai o nome do arquivo
                 const filenameMatch = part.match(/filename="([^"]+)"/);
                 filename = filenameMatch ? filenameMatch[1] : 'inspiration.jpg';

                 // Remove a linha final de boundary
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
        // Se um arquivo foi enviado, faz o upload para o Vercel Blob
        if (fileBuffer && filename) {
          const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${filename}`;
          const blob = await put(uniqueFilename, fileBuffer, {
            access: 'public',
          });
          inspirationUrl = blob.url;
        }
        
        // Insere o agendamento no banco de dados Neon
        await sql`
          INSERT INTO Bookings (client_name, client_phone, booking_date, start_time, duration_minutes, services, total_cost, inspiration_url)
          VALUES (${userInfo.name}, ${userInfo.phone}, ${selectedDate}, ${selectedTime}, ${totalDuration}, ${serviceNames.join(', ')}, ${totalCost}, ${inspirationUrl});
        `;
      
        return res.status(201).json({ message: 'Booking created successfully', inspirationUrl });

      } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Failed to create booking' });
      }
  }

  // Se o método não for GET ou POST
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
