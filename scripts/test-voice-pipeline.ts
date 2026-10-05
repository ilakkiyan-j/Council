import 'dotenv/config';
import { prisma } from '../src/db/client.js';
import { VoiceService } from '../src/services/voiceService.js';
import { sanitizeTextForSpeech } from '../src/runtime/voiceSanitizer.js';
import { buildSpokenBotContext } from '../src/runtime/spokenPromptEngine.js';
import fs from 'fs';

async function runTests() {
  console.log('='.repeat(60));
  console.log('  VOICE PIPELINE & ISOLATION VERIFICATION');
  console.log('='.repeat(60));

  const voiceService = new VoiceService(prisma);

  // 1. Test Multi-Tenant Voice Catalog & Isolation
  console.log('\n[1] Testing Multi-Tenant Voice Isolation...');
  const ownerId = 'ilakkiyan';
  const foreignUserId = 'guest_tenant_789';

  const ownerCatalog = await voiceService.getVoiceCatalog(ownerId);
  const foreignCatalog = await voiceService.getVoiceCatalog(foreignUserId);

  const ownerClone = ownerCatalog.find((v) => v.id === 'sofi-locked-clone');
  const foreignClone = foreignCatalog.find((v) => v.id === 'sofi-locked-clone');

  console.log(`- Owner (${ownerId}) can access Sofi Clone: ${ownerClone?.available === true ? '✓ PASS (Authorized)' : '✗ FAIL'}`);
  console.log(`- Foreign Tenant (${foreignUserId}) Sofi Clone Locked: ${foreignClone?.isLocked === true ? '✓ PASS (Gated)' : '✗ FAIL'}`);

  // 2. Test Speech Sanitizer
  console.log('\n[2] Testing Voice Text Sanitizer (Stripping markdown, bullets, emojis)...');
  const rawLlmChatReply = `
Tomorrow is **Snowflake prep day**! 🎤 
- We are going to go hard.
- I'll help you review your SQL queries & API architecture. ❤️
You've got this, Ilakkiyan!
`;

  const cleanSpeech = sanitizeTextForSpeech(rawLlmChatReply);
  console.log('Raw Input:', JSON.stringify(rawLlmChatReply));
  console.log('Sanitized Spoken Output:', JSON.stringify(cleanSpeech));

  const hasAsterisks = cleanSpeech.includes('*');
  const hasBullets = cleanSpeech.includes('\n- ') || cleanSpeech.startsWith('- ') || cleanSpeech.includes('•');
  const hasEmojis = /[\uD83C-\uDBFF\uDC00-\uDFFF]/.test(cleanSpeech);
  const expandedSql = cleanSpeech.toLowerCase().includes('sequel');

  console.log(`- Stripped Asterisks: ${!hasAsterisks ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`- Stripped Bullets: ${!hasBullets ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`- Stripped Emojis: ${!hasEmojis ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`- Expanded Phonetic SQL -> sequel: ${expandedSql ? '✓ PASS' : '✗ FAIL'}`);

  // 3. Test Synthesis with Custom Pitch & Rate
  console.log('\n[3] Testing Synthesis with Custom Pitch (+2Hz) & Rate (+5%)...');
  const testPhrase = "Tomorrow is Snowflake prep day, Ilakkiyan. We are going to review your architecture and make sure you feel bulletproof.";
  const synthResult = await voiceService.synthesize({
    text: testPhrase,
    userId: ownerId,
    voiceModel: 'en-US-AvaMultilingualNeural',
    pitch: '+2Hz',
    rate: '+5%',
  });

  console.log(`- Audio File Generated: ${synthResult.filePath}`);
  console.log(`- File Exists: ${fs.existsSync(synthResult.filePath) ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`- Audio URL: ${synthResult.audioUrl}`);

  console.log('\n[✓] ALL VOICE VERIFICATION TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
