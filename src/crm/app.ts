import express from 'express';
import cors from 'cors';
import path from 'path';
import router from './routes';

const app = express();

app.use(express.json());
app.use(cors());

// Attach CRM routes
app.use('/api', router);

// Serve frontend static assets from public folder
app.use(express.static(path.join(process.cwd(), 'public')));

export default app;

