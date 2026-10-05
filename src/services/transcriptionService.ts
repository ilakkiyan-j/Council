import 'dotenv/config';

export interface TranscribeOptions {
  audioBase64: string;
  mimeType?: string;
  apiKey?: string;
}

/**
 * High-accuracy audio transcription service using Gemini 2.0 / 1.5 Flash multimodal audio
 * with fallback to OpenAI / Groq Whisper.
 */
export class TranscriptionService {
  /**
   * Transcribe raw audio base64 into text
   */
  public async transcribe(options: TranscribeOptions): Promise<string> {
    const { audioBase64, mimeType = 'audio/ogg', apiKey } = options;

    if (!audioBase64 || audioBase64.trim().length === 0) {
      return '';
    }

    // 1. Try Gemini Multimodal Audio (Primary Engine - Sub-second, multilingual, zero-dependency)
    const geminiKey = apiKey || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const transcript = await this.transcribeWithGemini(audioBase64, mimeType, geminiKey);
        if (transcript && transcript.trim().length > 0) {
          return transcript.trim();
        }
      } catch (err: any) {
        console.warn('[TranscriptionService] Gemini audio transcription warning:', err?.message || err);
      }
    }

    // 2. Try Groq Whisper (Fallback)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const transcript = await this.transcribeWithWhisper(
          audioBase64,
          mimeType,
          groqKey,
          'https://api.groq.com/openai/v1/audio/transcriptions',
          'whisper-large-v3'
        );
        if (transcript && transcript.trim().length > 0) {
          return transcript.trim();
        }
      } catch (err: any) {
        console.warn('[TranscriptionService] Groq Whisper fallback warning:', err?.message || err);
      }
    }

    // 3. Try OpenAI Whisper (Fallback)
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        const transcript = await this.transcribeWithWhisper(
          audioBase64,
          mimeType,
          openaiKey,
          'https://api.openai.com/v1/audio/transcriptions',
          'whisper-1'
        );
        if (transcript && transcript.trim().length > 0) {
          return transcript.trim();
        }
      } catch (err: any) {
        console.warn('[TranscriptionService] OpenAI Whisper fallback warning:', err?.message || err);
      }
    }

    throw new Error('Audio transcription failed: No active AI provider key configured for transcription.');
  }

  /**
   * Transcribe via Gemini multimodal audio
   */
  private async transcribeWithGemini(audioBase64: string, mimeType: string, apiKey: string): Promise<string> {
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];

    let normalizedMime = mimeType;
    if (normalizedMime.includes('oga') || normalizedMime.includes('opus')) {
      normalizedMime = 'audio/ogg';
    } else if (normalizedMime.includes('webm')) {
      normalizedMime = 'audio/webm';
    } else if (normalizedMime.includes('wav')) {
      normalizedMime = 'audio/wav';
    } else if (normalizedMime.includes('mp3') || normalizedMime.includes('mpeg')) {
      normalizedMime = 'audio/mp3';
    }

    for (const model of models) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: normalizedMime,
                      data: audioBase64,
                    },
                  },
                  {
                    text: 'Transcribe this spoken audio message accurately word-for-word in its original language (e.g. English, Tamil, or mixed speech). Return ONLY the transcription text. Do not add quotes, commentary, markdown headings, or timestamps.',
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048,
            },
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.warn(`[Gemini STT] Model ${model} returned ${res.status}:`, errBody.slice(0, 200));
          continue;
        }

        const json = (await res.json()) as any;
        const candidateText =
          json?.candidates?.[0]?.content?.parts?.[0]?.text ||
          json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ||
          '';

        if (candidateText && candidateText.trim().length > 0) {
          return candidateText.trim();
        }
      } catch (err: any) {
        console.warn(`[Gemini STT] Model ${model} fetch failed:`, err?.message);
      }
    }

    throw new Error('Gemini multimodal audio processing could not transcribe audio.');
  }

  /**
   * Transcribe via OpenAI/Groq Whisper API using FormData
   */
  private async transcribeWithWhisper(
    audioBase64: string,
    mimeType: string,
    apiKey: string,
    endpoint: string,
    modelName: string
  ): Promise<string> {
    const buffer = Buffer.from(audioBase64, 'base64');
    let extension = 'ogg';
    if (mimeType.includes('webm')) extension = 'webm';
    else if (mimeType.includes('wav')) extension = 'wav';
    else if (mimeType.includes('mp3')) extension = 'mp3';

    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, `voice_note.${extension}`);
    formData.append('model', modelName);
    formData.append('response_format', 'text');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Whisper API error ${res.status}: ${err.slice(0, 200)}`);
    }

    const text = await res.text();
    return text.trim();
  }
}

export const transcriptionService = new TranscriptionService();
