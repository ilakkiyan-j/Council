import os
import sys
import time

def main():
    sample_path = "d:/Projects/0-OS/sofi_voice_sample.wav"
    output_dir = "d:/Projects/0-OS/Council/voice/output"
    os.makedirs(output_dir, exist_ok=True)

    if not os.path.exists(sample_path):
        print(f"Error: Reference sample not found at {sample_path}")
        sys.exit(1)

    print("==================================================")
    print("  SOFI LOCAL VOICE CLONING (XTTS-v2 Zero-Shot)")
    print("==================================================")
    print(f"Reference Audio: {sample_path}")
    print(f"Output Directory: {output_dir}\n")

    # Import TTS
    try:
        from TTS.api import TTS
    except ImportError:
        print("Error: TTS package not found. Please install with: pip install TTS")
        sys.exit(1)

    print("Loading XTTS-v2 model (Zero-shot Voice Cloner)...")
    start_time = time.time()
    
    # Initialize XTTS v2 model (runs locally, downloads weights once if first run)
    tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=True, gpu=False)
    print(f"Model loaded in {time.time() - start_time:.2f}s\n")

    test_sentences = [
        {
            "filename": "sofi_greeting.wav",
            "text": "Hi Ilakkiyan, I'm Sofi. I'm connected to your NOX second self, and I'm ready whenever you want to talk."
        },
        {
            "filename": "sofi_briefing.wav",
            "text": "Good morning! You have three priority tasks scheduled for today. Would you like me to read them for you?"
        },
        {
            "filename": "sofi_conversational.wav",
            "text": "I've noted down your thoughts on system design and saved them directly to your permanent notes in NOX."
        }
    ]

    for idx, item in enumerate(test_sentences, 1):
        target_path = os.path.join(output_dir, item["filename"])
        print(f"[{idx}/{len(test_sentences)}] Synthesizing: {item['filename']}...")
        print(f"Text: \"{item['text']}\"")
        
        t0 = time.time()
        tts.tts_to_file(
            text=item["text"],
            speaker_wav=sample_path,
            language="en",
            file_path=target_path
        )
        print(f"Generated {item['filename']} in {time.time() - t0:.2f}s -> {target_path}\n")

    print("==================================================")
    print("  ALL TEST VOICE SAMPLES GENERATED SUCCESSFULLY! ")
    print("==================================================")
    print(f"You can now play the audio files in: {output_dir}")

if __name__ == "__main__":
    main()
