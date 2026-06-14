import dotenv from 'dotenv';
dotenv.config();

import app from './app';

const PORT = process.env.PORT_CRM || 3000;

app.listen(PORT, () => {
  console.log(`[CRM Service] Listening on port ${PORT}`);
});
