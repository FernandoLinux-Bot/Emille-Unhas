import { PrismaClient } from '@prisma/client';
import process from 'node:process';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  const imageUrls = [
    'https://images.unsplash.com/photo-1604948895053-4449e3863846?q=80&w=2940&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=2940&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1604948895163-c28f80a342a3?q=80&w=2940&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1522338242285-15a4d60152c4?q=80&w=2940&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1615875382847-53c5524675b8?q=80&w=2940&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1515699146029-b7b51e5ee50b?q=80&w=2940&auto=format&fit=crop',
  ];

  for (const url of imageUrls) {
    // Use upsert para evitar adicionar duplicatas se o seed for executado novamente
    await prisma.portfolioImage.upsert({
      where: { url },
      update: {},
      create: { url },
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });