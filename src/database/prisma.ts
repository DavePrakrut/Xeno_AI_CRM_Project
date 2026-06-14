import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

let databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';

if (process.env.VERCEL) {
  const targetDbPath = '/tmp/dev.db';
  const srcDbPath = path.join(process.cwd(), 'prisma/dev.db');
  let needsSchemaPush = false;
  
  if (!fs.existsSync(targetDbPath) || fs.statSync(targetDbPath).size === 0) {
    try {
      if (fs.existsSync(srcDbPath)) {
        fs.copyFileSync(srcDbPath, targetDbPath);
        console.log('Copied database to /tmp/dev.db');
      } else {
        // Create an empty database file, Prisma will push tables via schema
        console.log('Source database not found, preparing database file at /tmp/dev.db');
        fs.writeFileSync(targetDbPath, '');
        needsSchemaPush = true;
      }
    } catch (err) {
      console.error('Failed to prepare SQLite db in /tmp:', err);
    }
  }
  
  if (needsSchemaPush) {
    try {
      console.log('Running Prisma schema push on serverless DB...');
      execSync('npx prisma db push --accept-data-loss', {
        env: {
          ...process.env,
          DATABASE_URL: `file:${targetDbPath}`
        }
      });
      console.log('Database schema pushed successfully.');
    } catch (err: any) {
      console.error('Failed to push schema via Prisma:', err.message);
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
