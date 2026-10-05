import os
import sys
import time
import functools
import numpy as np
import torch
import soundfile as sf
import torchaudio

_orig_torch_load = torch.load
@functools.wraps(_orig_torch_load)
def _safe_torch_load(*args, **kwargs):
    if "weights_only" not in kwargs:
        kwargs["weights_only"] = False
    return _orig_torch_load(*args, **kwargs)
torch.load = _safe_torch_load

def _soundfile_torchaudio_load(filepath, *args, **kwargs):
    data, sr = sf.read(filepath)
    if data.ndim == 1:
        data = data[np.newaxis, :]
    else:
        data = data.T
    return torch.from_numpy(data.astype(np.float32)), sr
torchaudio.load = _soundfile_torchaudio_load

os.environ["COQUI_TOS_AGREED"] = "1"

def main():
    print("=" * 65)
    print("  SOFI MULTI-CLIP CURATED XTTS-v2 CLONING")
    print("=" * 65)

    clips_dir = "d:/Projects/0-OS/Council/voice/clips"
    ref_clips = [
        os.path.join(clips_dir, "sofi_curated_seg_1.wav"),
        os.path.join(clips_dir, "sofi_curated_seg_2.wav"),
        os.path.join(clips_dir, "sofi_curated_seg_3.wav")
    ]
    output_dir = "d:/Projects/0-OS/Council/voice/output"

    from TTS.api import TTS
    print("[*] Initializing XTTS-v2...")
    tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=True, gpu=False)

    test_cases = [
        {
            "id": "1_greeting",
            "filename": "sofi_xtts_curated_1_greeting.wav",
            "text": "Hi Ilakkiyan, I'm Sofi. I'm connected to your NOX second self, and I'm ready whenever you want to talk."
        },
        {
            "id": "2_briefing",
            "filename": "sofi_xtts_curated_2_briefing.wav",
            "text": "Good morning! You have three priority tasks scheduled for today. Would you like me to read them for you?"
        },
        {
            "id": "3_conversational",
            "filename": "sofi_xtts_curated_3_conversational.wav",
            "text": "I've noted down your thoughts on system design and saved them directly to your permanent notes in NOX."
        }
    ]

    print(f"[*] Conditioning on {len(ref_clips)} curated segments...")
    for idx, tc in enumerate(test_cases, 1):
        target_path = os.path.join(output_dir, tc["filename"])
        print(f"\n    [{idx}/{len(test_cases)}] Generating: {tc['filename']}...")
        print(f"           Text: \"{tc['text']}\"")
        
        t0 = time.time()
        tts.tts_to_file(
            text=tc["text"],
            speaker_wav=ref_clips,
            language="en",
            temperature=0.68,
            top_p=0.85,
            top_k=50,
            repetition_penalty=2.5,
            file_path=target_path
        )
        print(f"           [OK] Generated in {time.time() - t0:.2f}s")
        
        # Convert to mp3
        data, sr = sf.read(target_path)
        sf.write(target_path.replace(".wav", ".mp3"), data, sr)

    print("\n[+] All curated multi-clip samples generated successfully!")

if __name__ == "__main__":
    main()
