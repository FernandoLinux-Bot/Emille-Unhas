import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { put, del } from '@vercel/blob';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // --- GET: Listar todas as imagens do portfólio ---
  if (req.method === 'GET') {
    try {
      const images = await prisma.portfolioImage.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(images.map(img => img.url));
    } catch (error) {
      console.error('Prisma Error:', error);
      return res.status(500).json({ error: 'Failed to fetch portfolio images' });
    }
  }

  // --- POST: Fazer upload de uma nova imagem ---
  if (req.method === 'POST') {
    const filename = req.headers['x-vercel-filename'] as string | undefined;
    const body = req.body;

    if (!filename || !body) {
      return res.status(400).json({ error: 'Filename and image body are required.' });
    }
    
    try {
        const blob = await put(filename, body, {
            access: 'public',
        });

        // Salva a URL da imagem no banco de dados com Prisma
        await prisma.portfolioImage.create({
            data: {
                url: blob.url,
            }
        });

        return res.status(200).json(blob);
    } catch (error) {
        console.error("Upload/DB error:", error);
        return res.status(500).json({ error: "Failed to upload image."});
    }
  }

  // --- DELETE: Deletar uma imagem ---
  if (req.method === 'DELETE') {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Image URL is required.' });
    }

    try {
        // Deleta do Vercel Blob
        await del(url);
        // Deleta do banco de dados com Prisma
        await prisma.portfolioImage.delete({
            where: {
                url: url
            }
        });

        return res.status(200).json({ message: 'Image deleted successfully.' });
    } catch (error) {
        console.error("Delete error:", error);
        return res.status(500).json({ error: 'Failed to delete image.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
