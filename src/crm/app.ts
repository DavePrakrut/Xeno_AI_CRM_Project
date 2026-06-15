import express from 'express';
import cors from 'cors';
import path from 'path';
import router from './routes';
import channelApp from '../channel/app';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Attach CRM routes
app.use('/api', router);

// Mount Channel Service routes (handles /api/channel/logs and /api/channel/send)
app.use(channelApp);

// Serve frontend static assets from public folder
app.use(express.static(path.join(process.cwd(), 'public')));

export default app;

