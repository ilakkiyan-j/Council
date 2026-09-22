import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`\n=================================================`);
  console.log(`🏛️  COUNCIL — Multi-Persona AI Hub`);
  console.log(`⚡  Running on http://localhost:${config.port}`);
  console.log(`💖  Active Personas: Sofi (PA/GF), Riven, Lucifer`);
  console.log(`🎯  Nox API Target: ${config.noxApiUrl}`);
  console.log(`=================================================\n`);
});
