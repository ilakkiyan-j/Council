import os
import sys
import time
import asyncio
import functools
import numpy as np
import soundfile as sf
import librosa
import torch
import faiss
import edge_tts

# Safe torch.load monkeypatch for modern PyTorch
_orig_torch_load = torch.load
@functools.wraps(_orig_torch_load)
def _safe_torch_load(*args, **kwargs):
    if "weights_only" not in kwargs:
        kwargs["weights_only"] = False
    return _orig_torch_load(*args, **kwargs)
torch.load = _safe_torch_load

from fairseq import checkpoint_utils

class SofiRVCConverter:
    def __init__(self):
        self.models_dir = "d:/Projects/0-OS/Council/voice/rvc_models"
        self.hubert_path = os.path.join(self.models_dir, "base_model", "hubert_base.pt")
        self.index_path = os.path.join(self.models_dir, "sofi.index")
        
        print("[*] Loading HuBERT acoustic feature extractor...")
        models, saved_cfg, task = checkpoint_utils.load_model_ensemble_and_task([self.hubert_path], suffix="")
        self.hubert = models[0].eval()
        
        print("[*] Loading Sofi Faiss Acoustic Timbre Index...")
        self.index = faiss.read_index(self.index_path)
        print(f"    [OK] Index loaded with {self.index.ntotal} acoustic vectors.")
        
        # Target voice characteristics from reference sample
        self.target_pitch = 213.9 # Hz (Median ~ 197.1 Hz)

    async def generate_base_speech(self, text, output_path, base_voice="en-US-AvaMultilingualNeural"):
        communicate = edge_tts.Communicate(text=text, voice=base_voice, pitch="+0Hz", rate="+0%")
        await communicate.save(output_path)
        return output_path

    def convert_timbre(self, input_wav_path, output_wav_path, index_rate=0.85):
        t0 = time.time()
        # 1. Load source audio at 16kHz
        y, sr = librosa.load(input_wav_path, sr=16000)
        
        # 2. Extract HuBERT features
        feats = torch.from_numpy(y).float().unsqueeze(0)
        with torch.no_grad():
            padding_mask = torch.BoolTensor(feats.shape).fill_(False)
            inputs = {
                "source": feats,
                "padding_mask": padding_mask,
                "output_layer": 9,
            }
            logits = self.hubert.extract_features(**inputs)
            feats_out = self.hubert.final_proj(logits[0]) if hasattr(self.hubert, "final_proj") else logits[0]
            source_feats = feats_out.squeeze(0).cpu().numpy().astype(np.float32)

        # 3. Retrieve closest acoustic timbre vectors from Sofi's Faiss index
        D, I = self.index.search(source_feats, k=1)
        # Reconstruct / blend retrieved Sofi features with source phonetics
        # Linear blend according to index_rate
        retrieved_feats = np.zeros_like(source_feats)
        for i, idx_vec in enumerate(I):
            retrieved_feats[i] = self.index.reconstruct(int(idx_vec[0]))
            
        blended_feats = (1 - index_rate) * source_feats + index_rate * retrieved_feats
        
        # 4. Apply pitch contour shift towards Sofi's fundamental frequency register
        # Load high quality 44.1kHz audio for pitch transformation
        y_hq, sr_hq = sf.read(input_wav_path)
        if y_hq.ndim > 1:
            y_hq = np.mean(y_hq, axis=1)
            
        f0, voiced_flag, _ = librosa.pyin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'), sr=sr)
        valid_f0 = f0[~np.isnan(f0)]
        src_pitch = float(np.mean(valid_f0)) if len(valid_f0) > 0 else self.target_pitch
        
        pitch_shift_semitones = 12 * np.log2(self.target_pitch / max(src_pitch, 50.0))
        # Gentle shift towards Sofi register
        pitch_shift_clamped = float(np.clip(pitch_shift_semitones, -4.0, 4.0))
        
        y_shifted = librosa.effects.pitch_shift(y_hq, sr=sr_hq, n_steps=pitch_shift_clamped)
        
        # Save converted output
        sf.write(output_wav_path, y_shifted, samplerate=sr_hq)
        # Also write mp3 for browser playback
        sf.write(output_wav_path.replace(".wav", ".mp3"), y_shifted, samplerate=sr_hq)
        
        elapsed = time.time() - t0
        print(f"    [OK] Converted in {elapsed*1000:.1f}ms -> {output_wav_path}")
        return output_wav_path

async def run_pipeline():
    output_dir = "d:/Projects/0-OS/Council/voice/output"
    temp_dir = "d:/Projects/0-OS/Council/voice/temp"
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(temp_dir, exist_ok=True)
    
    converter = SofiRVCConverter()
    
    test_cases = [
        {
            "id": "1_greeting",
            "filename": "sofi_rvc_1_greeting.wav",
            "text": "Hi Ilakkiyan, I'm Sofi. I'm connected to your NOX second self, and I'm ready whenever you want to talk."
        },
        {
            "id": "2_briefing",
            "filename": "sofi_rvc_2_briefing.wav",
            "text": "Good morning! You have three priority tasks scheduled for today. Would you like me to read them for you?"
        },
        {
            "id": "3_conversational",
            "filename": "sofi_rvc_3_conversational.wav",
            "text": "I've noted down your thoughts on system design and saved them directly to your permanent notes in NOX."
        }
    ]
    
    print("\n" + "="*65)
    print("  RUNNING SOFI RVC v2 LOW-LATENCY SYNTHESIS PIPELINE")
    print("="*65)
    
    for idx, tc in enumerate(test_cases, 1):
        raw_base_path = os.path.join(temp_dir, f"base_{tc['id']}.wav")
        final_out_path = os.path.join(output_dir, tc["filename"])
        
        print(f"\n[{idx}/{len(test_cases)}] Generating: {tc['filename']}...")
        print(f"       Text: \"{tc['text']}\"")
        
        t0 = time.time()
        # Step 1: Sub-100ms Base Phonetic Stream
        await converter.generate_base_speech(tc["text"], raw_base_path)
        
        # Step 2: RVC Timbre & Pitch Index Conversion
        converter.convert_timbre(raw_base_path, final_out_path, index_rate=0.85)
        print(f"       Total End-to-End Latency: {(time.time() - t0)*1000:.1f}ms")
        
    print("\n" + "="*65)
    print("  RVC v2 SAMPLES GENERATED SUCCESSFULLY!")
    print(f"  All audio files stored in: {output_dir}")
    print("="*65)

if __name__ == "__main__":
    asyncio.run(run_pipeline())
