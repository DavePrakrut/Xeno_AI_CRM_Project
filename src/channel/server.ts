import dotenv from 'dotenv';
dotenv.config();

import app from './app';

const PORT = process.env.PORT_CHANNEL || 3001;

app.listen(PORT, () => {
  console.log(`[Channel Service] Listening on port ${PORT}`);
});
