import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db/client.js';
import { ensureSystemApplications } from './services/seedService.js';

const app = createApp();

app.listen(config.port, async () => {
  try {
    await ensureSystemApplications(prisma);
  } catch (err: any) {
    console.warn('[Council V2] Application registry initialization notice:', err?.message);
  }

  console.log(`\n=================================================`);
  console.log(`🏛️  COUNCIL V2 — Custom AI Bot Platform`);
  console.log(`⚡  Running on http://localhost:${config.port}`);
  console.log(`🤖  Universal Dynamic Bot Engine Active`);
  console.log(`🔒  BYOK Credential Vault (AES-256-GCM) Active`);
  console.log(`🎯  Connected Workspace Target: ${config.noxApiUrl}`);
  console.log(`=================================================\n`);
});
