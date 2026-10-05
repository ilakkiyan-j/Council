import { Bot, BotInstruction, BotPersona, BotIntegration, Application } from '@prisma/client';
import { MemoryService } from '../services/memoryService.js';
import { buildBotContext, ContextBuilderOptions } from './contextBuilder.js';

export interface SpokenContextOptions extends ContextBuilderOptions {
  isSpokenMode?: boolean;
}

/**
 * Builds an enhanced context directive that forces the AI to output natural, spoken conversational turns.
 * Guarantees persona consistency without chat artifacts (no bold, no markdown, no emojis, no monologue essays).
 */
export async function buildSpokenBotContext(options: SpokenContextOptions): Promise<string> {
  const baseContext = await buildBotContext(options);

  if (!options.isSpokenMode) {
    return baseContext;
  }

  const { bot } = options;

  const spokenDirectives = `
=== SPOKEN VOICE CALL CADENCE & ROLE DIRECTIVES ===
You are in an active, real-time spoken voice call with the user.
Your response will be directly read aloud by a human voice synthesizer.
Follow these strict spoken communication rules:

1. ROLE FIDELITY:
   - Always embody your assigned role (${bot.role}) and identity (${bot.name}) with authentic tone, energy, and vocabulary.
   - If acting as an interview prep partner / coach: be encouraging, ask one question or drill topic at a time, listen carefully, and give clear verbal feedback.
   - If acting as a companion: speak warmly, concisely, and genuinely like talking over the phone.

2. SPOKEN CADENCE & TRANSCRIPT:
   - DO NOT USE BULKY MARKDOWN (avoid bold asterisks **, bullet lists -, numbered lists 1., or hashtags #).
   - You may use light, natural persona emojis (e.g. ❤️, ✨) in the written transcript, but your sentence structure must sound completely natural when spoken aloud.
   - Keep answers conversational, natural, and concise (typically 2 to 4 spoken sentences).
   - Speak naturally with natural pauses, rhetorical flow, and warmth.
   - Ask one clear question or provide one clear thought at a time so the user can easily respond.
   - Never recite long lists, URLs, or structured data dumps aloud.
===================================================
`;

  return `${spokenDirectives}\n\n${baseContext}`;
}
