import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

let databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';

if (process.env.VERCEL) {
  const targetDbPath = '/tmp/dev.db';
  const srcDbPath = path.join(process.cwd(), 'prisma/dev.db');
  
  if (!fs.existsSync(targetDbPath)) {
    try {
      if (fs.existsSync(srcDbPath)) {
        fs.copyFileSync(srcDbPath, targetDbPath);
        console.log('Copied database to /tmp/dev.db');
      } else {
        // Fallback: Create blank file
        console.log('Source database not found, preparing database file at /tmp/dev.db');
        fs.writeFileSync(targetDbPath, '');
      }
    } catch (err) {
      console.error('Failed to prepare SQLite db in /tmp:', err);
    }
  }
  
  databaseUrl = `file:${targetDbPath}`;
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});
