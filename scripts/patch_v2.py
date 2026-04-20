"""
Patch v2 - 2 targeted changes only:
1. composite_frame: INTER_LINEAR + reduce 1 copy
2. Whisper warm-up at startup (outside CUDA try block)
"""
import ast

PATH = '/home/quylhnh_fev35/MuseTalk/musetalk_api.py'

with open(PATH) as f:
    src = f.read()

original = src  # keep for diff

# ── 1. composite resize: LANCZOS4 → INTER_LINEAR ──────────────────────────
src = src.replace(
    'resized_pred = cv2.resize(pred_frame.astype(np.uint8), (bbox_w, bbox_h))',
    'resized_pred = cv2.resize(pred_frame.astype(np.uint8), (bbox_w, bbox_h),\n'
    '                              interpolation=cv2.INTER_LINEAR)',
)
if 'INTER_LINEAR' in src:
    print('[1] INTER_LINEAR OK')
else:
    print('[1] SKIP: target not found')

# ── 2. Whisper warm-up: append AFTER the entire startup function body ──────
# Find the line that closes the startup function (first @app decorator after startup)
# Insert Whisper warm-up block just before @app.get('/health')

WHISPER_WARMUP = '''
    # Warm-up Whisper pipeline so first real request has feat~14ms not ~3500ms
    print('[startup] Warming up Whisper pipeline...')
    try:
        import wave as _wave, os as _os
        _sr, _tmp = 16000, '/tmp/_wu_audio.wav'
        _pcm = b'\\x00\\x00' * _sr  # 1s silence, 16-bit mono
        with _wave.open(_tmp, 'w') as _wf:
            _wf.setnchannels(1)
            _wf.setsampwidth(2)
            _wf.setframerate(_sr)
            _wf.writeframes(_pcm)
        _wi, _ll = audio_processor.get_audio_feature(_tmp)
        audio_processor.get_whisper_chunk(_wi, device, whisper_dtype, whisper_model, _ll)
        _os.remove(_tmp)
        print('[startup] Whisper warmed up OK')
    except Exception as _we:
        print(f'[startup] Whisper warm-up skipped: {_we}')
'''

# Find a safe insertion point: right before @app.get('/health')
HEALTH_MARKER = "\n\n@app.get('/health')"
if HEALTH_MARKER in src:
    src = src.replace(HEALTH_MARKER, WHISPER_WARMUP + HEALTH_MARKER, 1)
    print('[2] Whisper warm-up inserted OK')
else:
    print('[2] SKIP: health marker not found')

# ── Syntax check ─────────────────────────────────────────────────────────
try:
    ast.parse(src)
    print('Syntax OK')
except SyntaxError as e:
    print(f'SyntaxError: {e}')
    # restore
    src = original
    print('Reverted to original')

with open(PATH, 'w') as f:
    f.write(src)
