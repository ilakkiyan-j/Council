import os
import sys
import time
import functools
import numpy as np
import torch
import soundfile as sf
import torchaudio

# 1. In PyTorch 2.6+, weights_only defaults to True which breaks legacy pickled checkpoints
_orig_torch_load = torch.load
@functools.wraps(_orig_torch_load)
def _safe_torch_load(*args, **kwargs):
    if "weights_only" not in kwargs:
        kwargs["weights_only"] = False
    return _orig_torch_load(*args, **kwargs)
torch.load = _safe_torch_load

# 2. Patch torchaudio.load to use soundfile directly without requiring torchcodec C++ extension
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
    print("  SOFI EXACT ZERO-SHOT VOICE CLONING (XTTS-v2 24kHz)")
    print("=" * 65)

    ref_wav_path = "d:/Projects/0-OS/Council/voice/sofi_clean_reference.wav"
    output_dir = "d:/Projects/0-OS/Council/voice/output"
    os.makedirs(output_dir, exist_ok=True)

    if not os.path.exists(ref_wav_path):
        print(f"[-] Reference clean audio not found at: {ref_wav_path}")
        sys.exit(1)

    print(f"[*] Reference Clean Audio: {ref_wav_path}")
    print(f"[*] Output Target Directory: {output_dir}\n")

    from TTS.api import TTS

    print("[1/2] Initializing XTTS-v2 Zero-Shot Model...")
    t0 = time.time()
    tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=True, gpu=False)
    print(f"    [OK] XTTS-v2 Loaded in {time.time() - t0:.2f}s\n")

    test_cases = [
        {
            "id": "1_greeting",
            "filename": "sofi_xtts_v2_1_greeting.wav",
            "text": "Hi Ilakkiyan, I'm Sofi. I'm connected to your NOX second self, and I'm ready whenever you want to talk."
        },
        {
            "id": "2_briefing",
            "filename": "sofi_xtts_v2_2_briefing.wav",
            "text": "Good morning! You have three priority tasks scheduled for today. Would you like me to read them for you?"
        },
        {
            "id": "3_conversational",
            "filename": "sofi_xtts_v2_3_conversational.wav",
            "text": "I've noted down your thoughts on system design and saved them directly to your permanent notes in NOX."
        }
    ]

    print("[2/2] Synthesizing exact voice samples with XTTS-v2...")
    for idx, tc in enumerate(test_cases, 1):
        target_path = os.path.join(output_dir, tc["filename"])
        print(f"\n    [{idx}/{len(test_cases)}] Generating: {tc['filename']}...")
        print(f"           Text: \"{tc['text']}\"")
        
        t_gen = time.time()
        tts.tts_to_file(
            text=tc["text"],
            speaker_wav=ref_wav_path,
            language="en",
            file_path=target_path
        )
        print(f"           [OK] Generated {tc['filename']} in {time.time() - t_gen:.2f}s")

    print("\n" + "=" * 65)
    print("  XTTS-v2 VOICE SAMPLES GENERATED SUCCESSFULLY!")
    print(f"  All audio files stored in: {output_dir}")
    print("=" * 65)

if __name__ == "__main__":
    main()
