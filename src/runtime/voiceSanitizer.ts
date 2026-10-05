/**
 * Voice Text Sanitizer
 * Prepares raw LLM outputs for natural, seamless text-to-speech synthesis:
 * 1. Strips markdown asterisks, hashes, backticks, bullet characters
 * 2. Replaces or strips emojis so TTS engines don't read symbol names aloud
 * 3. Expands common technical terms & abbreviations into spoken phonetic English
 * 4. Normalizes whitespace and natural sentence punctuation
 */

export function sanitizeTextForSpeech(text: string): string {
  if (!text) return '';

  let spoken = text;

  // 1. Remove code blocks entirely or replace with brief speech marker
  spoken = spoken.replace(/```[\s\S]*?```/g, ' [code snippet omitted] ');
  spoken = spoken.replace(/`([^`]+)`/g, '$1');

  // 2. Remove markdown formatting (*, **, _, __, ~, #, >, -, •)
  spoken = spoken.replace(/[*_~#]/g, '');
  spoken = spoken.replace(/^>\s+/gm, '');
  spoken = spoken.replace(/^\s*[-*+•]\s*/gm, '');
  spoken = spoken.replace(/^\s*\d+\.\s*/gm, '');
  spoken = spoken.replace(/[-–—•]/g, ' ');

  // 3. Remove URLs
  spoken = spoken.replace(/https?:\/\/\S+/gi, '');

  // 4. Strip emojis (Unicode emoji range)
  spoken = spoken.replace(
    /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
    ''
  );

  // 5. Expand abbreviations & acronyms for natural spoken cadence
  const expansions: Record<string, string> = {
    'e.g.': 'for example',
    'i.e.': 'that is',
    'etc.': 'etcetera',
    'vs.': 'versus',
    'w/': 'with',
    'w/o': 'without',
    'SQL': 'sequel',
    'API': 'A-P-I',
    'SDK': 'S-D-K',
    'UI': 'U-I',
    'UX': 'U-X',
    'OS': 'O-S',
    'ID': 'I-D',
    'LLM': 'L-L-M',
    'STT': 'speech to text',
    'TTS': 'text to speech',
  };

  for (const [abbr, full] of Object.entries(expansions)) {
    const regex = new RegExp(`\\b${abbr.replace('.', '\\.')}\\b`, 'gi');
    spoken = spoken.replace(regex, full);
  }

  // 6. Clean whitespace and duplicate punctuation
  spoken = spoken.replace(/\s+/g, ' ');
  spoken = spoken.replace(/([.?!])\s*([.?!])+/g, '$1');
  spoken = spoken.trim();

  return spoken;
}
