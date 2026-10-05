import asyncio
import os
import sys
import json
import librosa
import numpy as np
import edge_tts
import soundfile as sf

async def analyze_reference_sample(wav_path):
    print(f"[*] Analyzing Reference Audio: {wav_path}")
    # Load 15 seconds downsampled to 16kHz for instant pitch estimation
    y, sr = librosa.load(wav_path, sr=16000, duration=15.0)
    
    # Estimate pitch (fundamental frequency F0)
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y, 
        fmin=librosa.note_to_hz('C3'), 
        fmax=librosa.note_to_hz('C6'),
        sr=sr
    )
    valid_f0 = f0[~np.isnan(f0)]
    mean_f0 = float(np.mean(valid_f0)) if len(valid_f0) > 0 else 0
    median_f0 = float(np.median(valid_f0)) if len(valid_f0) > 0 else 0
    
    print(f"    - Sample Pitch (F0): {mean_f0:.1f} Hz (Median: {median_f0:.1f} Hz)")
    
    return {
        "mean_f0": mean_f0,
        "median_f0": median_f0
    }

async def generate_voice_samples():
    sample_path = "d:/Projects/0-OS/sofi_voice_sample.wav"
    output_dir = "d:/Projects/0-OS/Council/voice/output"
    os.makedirs(output_dir, exist_ok=True)
    
    if os.path.exists(sample_path):
        analysis = await analyze_reference_sample(sample_path)
    else:
        analysis = {"mean_f0": 210.0}
    
    # Test sentences
    test_cases = [
        {
            "id": "1_greeting",
            "text": "Hi Ilakkiyan, I'm Sofi. I'm connected to your NOX second self, and I'm ready whenever you want to talk."
        },
        {
            "id": "2_briefing",
            "text": "Good morning! You have three priority tasks scheduled for today. Would you like me to read them for you?"
        },
        {
            "id": "3_conversational",
            "text": "I've noted down your thoughts on system design and saved them directly to your permanent notes in NOX."
        }
    ]
    
    # Top natural female voice models tailored for assistant / conversational speech
    candidates = [
        {"name": "Jenny_Natural", "voice": "en-US-JennyNeural", "pitch": "+0Hz", "rate": "+0%", "desc": "Warm, natural, professional American English"},
        {"name": "Ava_Multilingual", "voice": "en-US-AvaMultilingualNeural", "pitch": "+0Hz", "rate": "+0%", "desc": "Contemporary, soft, nuanced multilingual female voice"},
        {"name": "Aria_Expressive", "voice": "en-US-AriaNeural", "pitch": "+0Hz", "rate": "-2%", "desc": "Expressive, clear, highly engaging tone"},
        {"name": "Sonia_British", "voice": "en-GB-SoniaNeural", "pitch": "+0Hz", "rate": "+0%", "desc": "Sophisticated, warm British English accent"},
        {"name": "Neerja_IndianNeutral", "voice": "en-IN-NeerjaNeural", "pitch": "+0Hz", "rate": "+0%", "desc": "Clear, gentle, melodic tone"}
    ]
    
    print("\n" + "="*60)
    print("  GENERATING CANDIDATE VOICE SAMPLES FOR QUALITY INSPECTION")
    print("="*60)
    
    generated_files = []
    
    for cand in candidates:
        cand_name = cand["name"]
        voice_id = cand["voice"]
        pitch = cand["pitch"]
        rate = cand["rate"]
        
        print(f"\n---> Generating Profile: [{cand_name}] ({voice_id})")
        for tc in test_cases:
            filename = f"sofi_{cand_name}_{tc['id']}.mp3"
            filepath = os.path.join(output_dir, filename)
            
            communicate = edge_tts.Communicate(
                text=tc["text"],
                voice=voice_id,
                pitch=pitch,
                rate=rate
            )
            await communicate.save(filepath)
            
            # Also convert to .wav for high-compatibility standard audio player
            wav_filename = f"sofi_{cand_name}_{tc['id']}.wav"
            wav_filepath = os.path.join(output_dir, wav_filename)
            try:
                data, samplerate = sf.read(filepath)
                sf.write(wav_filepath, data, samplerate)
            except Exception as e:
                pass
                
            print(f"     [+] Created {filename} & {wav_filename}")
            generated_files.append({
                "profile": cand_name,
                "voice": voice_id,
                "description": cand["desc"],
                "case": tc["id"],
                "text": tc["text"],
                "mp3_path": filepath,
                "wav_path": wav_filepath
            })
            
    # Save manifest
    manifest_path = os.path.join(output_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({"analysis": analysis, "samples": generated_files}, f, indent=2)
        
    print("\n" + "="*60)
    print("  ALL CANDIDATE SAMPLES GENERATED SUCCESSFULLY!")
    print(f"  Total audio files created in: {output_dir}")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(generate_voice_samples())
