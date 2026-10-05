import os
import sys
import time
import torch
import soundfile as sf
import numpy as np
import librosa
from transformers import SpeechT5Processor, SpeechT5ForTextToSpeech, SpeechT5HifiGan
from speechbrain.inference.speaker import EncoderClassifier

def main():
    print("=" * 65)
    print("  SOFI EXACT ZERO-SHOT VOICE CLONING PIPELINE")
    print("=" * 65)

    ref_wav_path = "d:/Projects/0-OS/Council/voice/sofi_clean_reference.wav"
    output_dir = "d:/Projects/0-OS/Council/voice/output"
    os.makedirs(output_dir, exist_ok=True)

    if not os.path.exists(ref_wav_path):
        print(f"[-] Reference clean audio not found at: {ref_wav_path}")
        sys.exit(1)

    print(f"[*] Reference Clean Audio: {ref_wav_path}")
    print(f"[*] Output Directory: {output_dir}\n")

    # Step 1: Extract Speaker Embedding (x-vector) from the clean reference audio
    print("[1/3] Extracting Speaker Embedding from Sofi's audio...")
    t0 = time.time()
    
    # Load speaker encoder model
    spk_model = EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-xvect-voxceleb", 
        savedir="d:/Projects/0-OS/Council/voice/models/spkrec-xvect"
    )
    
    # Load 16kHz audio for speaker encoder
    signal, fs = torchaudio_load_safe(ref_wav_path, target_sr=16000)
    with torch.no_grad():
        embeddings = spk_model.encode_batch(signal)
        # Squeeze to (512,) shape
        speaker_embedding = torch.nn.functional.normalize(embeddings.squeeze(), dim=-1)
        # Ensure shape is (1, 512) for SpeechT5
        if speaker_embedding.dim() == 1:
            speaker_embedding = speaker_embedding.unsqueeze(0)

    print(f"    [OK] Speaker embedding extracted (shape: {speaker_embedding.shape}) in {time.time() - t0:.2f}s\n")

    # Step 2: Load SpeechT5 Neural TTS + HiFi-GAN Vocoder
    print("[2/3] Loading SpeechT5 Neural TTS & Vocoder...")
    t1 = time.time()
    processor = SpeechT5Processor.from_pretrained("microsoft/speecht5_tts")
    model = SpeechT5ForTextToSpeech.from_pretrained("microsoft/speecht5_tts")
    vocoder = SpeechT5HifiGan.from_pretrained("microsoft/speecht5_hifigan")
    print(f"    [OK] Models loaded in {time.time() - t1:.2f}s\n")

    # Step 3: Synthesize exact cloned sentences
    test_cases = [
        {
            "id": "1_greeting",
            "filename": "sofi_exact_clone_1_greeting.wav",
            "text": "Hi Ilakkiyan, I'm Sofi. I'm connected to your NOX second self, and I'm ready whenever you want to talk."
        },
        {
            "id": "2_briefing",
            "filename": "sofi_exact_clone_2_briefing.wav",
            "text": "Good morning! You have three priority tasks scheduled for today. Would you like me to read them for you?"
        },
        {
            "id": "3_conversational",
            "filename": "sofi_exact_clone_3_conversational.wav",
            "text": "I've noted down your thoughts on system design and saved them directly to your permanent notes in NOX."
        }
    ]

    print("[3/3] Synthesizing exact cloned voice samples...")
    for idx, tc in enumerate(test_cases, 1):
        out_path = os.path.join(output_dir, tc["filename"])
        print(f"    [{idx}/{len(test_cases)}] Generating: {tc['filename']}...")
        print(f"           Text: \"{tc['text']}\"")
        
        t_gen = time.time()
        inputs = processor(text=tc["text"], return_tensors="pt")
        
        with torch.no_grad():
            speech = model.generate_speech(
                inputs["input_ids"],
                speaker_embeddings=speaker_embedding,
                vocoder=vocoder
            )
            
        speech_np = speech.cpu().numpy()
        # Save at 16kHz
        sf.write(out_path, speech_np, samplerate=16000)
        
        # Also save mp3 version for easy browser playback
        mp3_path = os.path.join(output_dir, tc["filename"].replace(".wav", ".mp3"))
        sf.write(mp3_path, speech_np, samplerate=16000)
        
        print(f"           [OK] Saved to {out_path} ({time.time() - t_gen:.2f}s)")

    print("\n" + "=" * 65)
    print("  EXACT VOICE CLONING COMPLETE!")
    print(f"  Audio outputs ready at: {output_dir}")
    print("=" * 65)

def torchaudio_load_safe(wav_path, target_sr=16000):
    y, sr = librosa.load(wav_path, sr=target_sr, mono=True)
    tensor = torch.tensor(y, dtype=torch.float32).unsqueeze(0)
    return tensor, target_sr

if __name__ == "__main__":
    main()
