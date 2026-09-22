import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '4100', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  noxApiUrl: process.env.NOX_API_URL || 'http://localhost:4000',
  xionApiUrl: process.env.XION_API_URL || 'http://localhost:5000',
};
