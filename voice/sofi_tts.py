import os
import sys
import time
import asyncio
import io
import edge_tts
from pathlib import Path

class SofiTTSEngine:
    """
    Sofi Locked High-Fidelity Voice Synthesizer for NOX & Telegram.
    Locked Voice: en-US-AvaMultilingualNeural (Soft, nuanced, conversational)
    """
    def __init__(
        self,
        voice_model: str = None,
        pitch: str = None,
        rate: str = None
    ):
        self.base_dir = Path(__file__).parent
        self.output_dir = self.base_dir / "output"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Locked voice parameters
        self.voice_model = voice_model or os.getenv("SOFI_VOICE_MODEL", "en-US-AvaMultilingualNeural")
        self.pitch = pitch or os.getenv("SOFI_VOICE_PITCH", "+0Hz")
        self.rate = rate or os.getenv("SOFI_VOICE_RATE", "+0%")

    async def synthesize(self, text: str, output_path: str = None) -> str:
        """
        Synthesize text into speech file (.mp3 / .ogg / .wav).
        Returns the absolute filepath to the generated audio.
        """
        if not output_path:
            filename = f"sofi_speech_{int(time.time() * 1000)}.mp3"
            output_path = str(self.output_dir / filename)

        t0 = time.time()
        communicate = edge_tts.Communicate(
            text=text,
            voice=self.voice_model,
            pitch=self.pitch,
            rate=self.rate
        )
        await communicate.save(output_path)
        
        elapsed = time.time() - t0
        print(f"[SofiTTS] Synthesized {len(text)} chars in {elapsed * 1000:.1f}ms -> {output_path}")
        return output_path

    async def synthesize_bytes(self, text: str) -> bytes:
        """
        Synthesize text directly into memory bytes (for instant Telegram sendVoice or WebSocket streaming).
        """
        communicate = edge_tts.Communicate(
            text=text,
            voice=self.voice_model,
            pitch=self.pitch,
            rate=self.rate
        )
        audio_stream = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_stream.write(chunk["data"])
        return audio_stream.getvalue()

# Global singleton instance for high-speed reuse
sofi_voice = SofiTTSEngine()

async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Sofi Neural Speech Synthesizer")
    parser.add_argument("--text", type=str, required=True, help="Text to synthesize")
    parser.add_argument("--voice", type=str, default="en-US-AvaMultilingualNeural", help="Voice model")
    parser.add_argument("--pitch", type=str, default="+0Hz", help="Voice pitch (e.g. +0Hz, +5Hz)")
    parser.add_argument("--rate", type=str, default="+0%", help="Voice rate (e.g. +0%, +5%)")
    parser.add_argument("--out", type=str, default=None, help="Output file path")
    args = parser.parse_args()

    engine = SofiTTSEngine(voice_model=args.voice, pitch=args.pitch, rate=args.rate)
    out_file = await engine.synthesize(args.text, args.out)
    print(f"OUTPUT_AUDIO_PATH:{out_file}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        asyncio.run(main())
    else:
        asyncio.run(_test())
