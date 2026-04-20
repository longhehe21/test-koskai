"""
Add Whisper warm-up vào startup để feat=14ms ngay từ request đầu tiên.
"""
path = '/home/quylhnh_fev35/MuseTalk/musetalk_api.py'
with open(path, 'r') as f:
    src = f.read()

# Thêm Whisper warm-up vào cuối block startup, trước dòng print Application startup
OLD = "    print('[startup] CUDA kernels warmed up OK')"
NEW = """    print('[startup] CUDA kernels warmed up OK')

    # Whisper warm-up: chạy 1 lần với audio ngắn để cache AudioProcessor pipeline.
    # Không có bước này, feat=3500ms trên request đầu; sau warm-up feat=14ms.
    print('[startup] Warming up Whisper pipeline...')
    try:
        import numpy as np, tempfile, wave
        # Tạo 1s dummy WAV 16kHz mono silent
        _sr = 16000
        _pcm = np.zeros(_sr, dtype=np.int16)
        _tmp_wav = '/tmp/_warmup_audio.wav'
        with wave.open(_tmp_wav, 'w') as _wf:
            _wf.setnchannels(1); _wf.setsampwidth(2); _wf.setframerate(_sr)
            _wf.writeframes(_pcm.tobytes())
        _wi, _ll = audio_processor.get_audio_feature(_tmp_wav)
        _ = audio_processor.get_whisper_chunk(_wi, device, whisper_dtype, whisper_model, _ll)
        import os; os.remove(_tmp_wav)
        print('[startup] Whisper pipeline warmed up OK')
    except Exception as _we:
        print(f'[startup] Whisper warm-up failed (non-fatal): {_we}')"""

if OLD in src:
    src = src.replace(OLD, NEW)
    print('Whisper warm-up patch OK')
else:
    print('ERROR: target line not found')
    idx = src.find('CUDA kernels warmed up')
    print(repr(src[max(0,idx-20):idx+100]))

with open(path, 'w') as f:
    f.write(src)
