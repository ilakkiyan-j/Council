import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { sanitizeTextForSpeech } from '../runtime/voiceSanitizer.js';

export interface VoicePreferenceDto {
  voiceModel: string;
  pitch: string;
  rate: string;
  isCloneEnabled?: boolean;
}

export interface VoiceCatalogItem {
  id: string;
  name: string;
  voiceModel: string;
  gender: 'female' | 'male';
  locale: string;
  description: string;
  isExclusive?: boolean;
  isOwnerOnly?: boolean;
}

const DEFAULT_VOICE_CATALOG: VoiceCatalogItem[] = [
  {
    id: 'sofi-locked-clone',
    name: 'Sofi Neural Persona (Exclusive Locked Voice)',
    voiceModel: 'en-US-AvaMultilingualNeural',
    gender: 'female',
    locale: 'en-US',
    description: 'Custom soft, empathetic, conversational tone matched to reference audio sample.',
    isExclusive: true,
    isOwnerOnly: true,
  },
  {
    id: 'en-ava',
    name: 'Ava Multilingual (Expressive & Conversational)',
    voiceModel: 'en-US-AvaMultilingualNeural',
    gender: 'female',
    locale: 'en-US',
    description: 'Natural, smooth conversational neural voice.',
  },
  {
    id: 'en-jenny',
    name: 'Jenny (Clear & Professional)',
    voiceModel: 'en-US-JennyNeural',
    gender: 'female',
    locale: 'en-US',
    description: 'Crisp, articulate US English standard voice.',
  },
  {
    id: 'en-aria',
    name: 'Aria (Dynamic & Confident)',
    voiceModel: 'en-US-AriaNeural',
    gender: 'female',
    locale: 'en-US',
    description: 'High dynamic range, energetic cadence.',
  },
  {
    id: 'en-guy',
    name: 'Guy (Warm & Grounded)',
    voiceModel: 'en-US-GuyNeural',
    gender: 'male',
    locale: 'en-US',
    description: 'Warm, conversational male voice.',
  },
  {
    id: 'en-christopher',
    name: 'Christopher (Technical & Authoritative)',
    voiceModel: 'en-US-ChristopherNeural',
    gender: 'male',
    locale: 'en-US',
    description: 'Authoritative, precise engineering style.',
  },
  {
    id: 'en-sonia',
    name: 'Sonia (British Accent)',
    voiceModel: 'en-GB-SoniaNeural',
    gender: 'female',
    locale: 'en-GB',
    description: 'Refined, polished British English voice.',
  },
  {
    id: 'ta-pallavi',
    name: 'Pallavi (Tamil & Indian English)',
    voiceModel: 'ta-IN-PallaviNeural',
    gender: 'female',
    locale: 'ta-IN',
    description: 'Natural Indian & Tamil cadence.',
  },
];

export class VoiceService {
  private outputDir: string;
  private voiceScriptPath: string;
  private sttScriptPath: string;

  constructor(private prisma: PrismaClient) {
    this.outputDir = path.resolve(process.cwd(), 'voice', 'output');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    this.voiceScriptPath = path.resolve(process.cwd(), 'voice', 'sofi_tts.py');
    this.sttScriptPath = path.resolve(process.cwd(), 'voice', 'sofi_stt.py');
  }

  /**
   * Check whether this userId is authorized to use the exclusive Sofi voice.
   */
  isOwnerOrExclusiveAuthorized(userId: string): boolean {
    const ownerUserId = process.env.OWNER_USER_ID?.trim();
    return Boolean(ownerUserId && userId === ownerUserId);
  }

  /**
   * Get user's voice preferences from DB (or create defaults)
   */
  async getUserPreferences(userId: string) {
    let pref = await this.prisma.userVoicePreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      const isOwner = this.isOwnerOrExclusiveAuthorized(userId);
      pref = await this.prisma.userVoicePreference.create({
        data: {
          userId,
          voiceModel: 'en-US-AvaMultilingualNeural',
          pitch: '+0Hz',
          rate: '+0%',
          isExclusive: isOwner,
          isCloneEnabled: isOwner,
          referenceAudioPath: isOwner ? 'voice/sofi_clean_reference.wav' : null,
        },
      });
    }

    return pref;
  }

  /**
   * Update user's voice preferences
   */
  async updatePreferences(userId: string, data: Partial<VoicePreferenceDto>) {
    const existing = await this.getUserPreferences(userId);

    const updated = await this.prisma.userVoicePreference.update({
      where: { userId },
      data: {
        voiceModel: data.voiceModel ?? existing.voiceModel,
        pitch: data.pitch ?? existing.pitch,
        rate: data.rate ?? existing.rate,
        isCloneEnabled: data.isCloneEnabled ?? existing.isCloneEnabled,
      },
    });

    return updated;
  }

  /**
   * Get voice catalog available to this user.
   * Isolates the exclusive clone so other tenants see only standard neural voices.
   */
  async getVoiceCatalog(userId: string) {
    const isOwner = this.isOwnerOrExclusiveAuthorized(userId);

    return DEFAULT_VOICE_CATALOG.map((voice) => {
      if (voice.isExclusive) {
        return {
          ...voice,
          available: isOwner,
          isLocked: !isOwner,
        };
      }
      return {
        ...voice,
        available: true,
        isLocked: false,
      };
    });
  }

  /**
   * Synthesize text to speech file using python edge-tts backend
   */
  async synthesize(options: {
    text: string;
    userId?: string;
    voiceModel?: string;
    pitch?: string;
    rate?: string;
    outputFilename?: string;
  }): Promise<{ filename: string; filePath: string; audioUrl: string; durationEstimateSec: number }> {
    const { text, userId } = options;

    // 1. Sanitize text for speech (strip markdown, emojis, expand abbreviations)
    const cleanSpokenText = sanitizeTextForSpeech(text);
    if (!cleanSpokenText) {
      throw new Error('Text to synthesize is empty after speech sanitization.');
    }

    // 2. Resolve Voice Config
    let voiceModel = options.voiceModel;
    let pitch = options.pitch;
    let rate = options.rate;

    if (userId && (!voiceModel || !pitch || !rate)) {
      const userPref = await this.getUserPreferences(userId);
      voiceModel = voiceModel || userPref.voiceModel;
      pitch = pitch || userPref.pitch;
      rate = rate || userPref.rate;
    }

    voiceModel = voiceModel || 'en-US-AvaMultilingualNeural';
    pitch = pitch || '+0Hz';
    rate = rate || '+0%';

    // 3. Prepare output file
    const filename = options.outputFilename || `speech_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp3`;
    const outputPath = path.resolve(this.outputDir, filename);

    // 4. Run Python Synthesizer Subprocess safely
    await new Promise<void>((resolve, reject) => {
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const proc = spawn(pythonCmd, [
        this.voiceScriptPath,
        '--text', cleanSpokenText,
        '--voice', voiceModel!,
        '--pitch', pitch!,
        '--rate', rate!,
        '--out', outputPath,
      ]);

      let stderr = '';
      proc.stderr?.on('data', (d) => (stderr += d.toString()));

      proc.on('error', (err) => {
        console.warn(`[TTS Subprocess Error]: ${err.message}`);
        reject(err);
      });

      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve();
        } else {
          reject(new Error(`TTS generation failed with code ${code}: ${stderr}`));
        }
      });
    });

    const words = cleanSpokenText.split(/\s+/).length;
    const durationEstimateSec = Math.max(1, Math.round((words / 140) * 60));

    return {
      filename,
      filePath: outputPath,
      audioUrl: `/audio/${filename}`,
      durationEstimateSec,
    };
  }

  /**
   * Transcribe user audio with Whisper
   */
  async transcribe(audioFilePath: string): Promise<string> {
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found at ${audioFilePath}`);
    }

    return new Promise((resolve, reject) => {
      const proc = spawn('python', [this.sttScriptPath, audioFilePath]);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));

      proc.on('close', (code) => {
        if (code === 0) {
          const match = stdout.match(/TRANSCRIBED_TEXT:(.*)/);
          if (match) {
            resolve(match[1].trim());
          } else {
            resolve(stdout.trim());
          }
        } else {
          reject(new Error(`Whisper STT failed with code ${code}: ${stderr}`));
        }
      });
    });
  }
}
