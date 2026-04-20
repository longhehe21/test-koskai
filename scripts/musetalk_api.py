import asyncio
import json
import os
import random
import subprocess
import uuid

import cv2
import torch
import numpy as np
import glob
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from musetalk.utils.utils import load_all_model
from musetalk.utils.audio_processor import AudioProcessor
from musetalk.utils.preprocessing import get_landmark_and_bbox
from musetalk.utils.utils import datagen
from transformers import WhisperModel

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=['*'],
                   allow_methods=['*'], allow_headers=['*'])

WHISPER_DIR = './models/whisper'
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# batch_size=4: GPU parallelism tot hon batch=2 (24fps vs 17fps tren L4)
# First batch of 4 frames arrives together at ~167ms => MIN_BUFFER_FRAMES=4 fires.
BATCH_SIZE = 4

# WebP streaming: nho hon ~30%, it artifact hon JPEG cung chat luong.
# Bat bang env var: ENABLE_WEBP=1
ENABLE_WEBP = os.environ.get('ENABLE_WEBP', '0') == '1'
JPEG_QUALITY = 80
WEBP_QUALITY = 88

print('Loading models...')
vae, unet, pe = load_all_model()
audio_processor = AudioProcessor(feature_extractor_path=WHISPER_DIR)
whisper_model = WhisperModel.from_pretrained(WHISPER_DIR)
whisper_model = whisper_model.to(device=device, dtype=torch.float16).eval()
whisper_model.requires_grad_(False)
timesteps = torch.tensor([0], device=device)

# FP16: UNet + VAE -> 2x faster on L4 Tensor Cores
print('Converting UNet + VAE to float16...')
unet.model = unet.model.half()
vae.vae = vae.vae.half()
weight_dtype = torch.float16
whisper_dtype = torch.float16
print(f'Models loaded! device={device}, unet/vae dtype=float16, webp={ENABLE_WEBP}')

avatar_cache = {}

# Danh sách idle avatar IDs — preprocess khi startup, random pick mỗi session.
# Thêm file vào data/video/ theo pattern idle_N.mp4 để tự động nhận diện.
IDLE_AVATAR_PATTERN = 'data/video/idle_*.mp4'
IDLE_AVATAR_IDS: list[str] = []  # populated at startup


def _build_feather_mask(h_box: int, w_box: int) -> np.ndarray:
    """
    Tao alpha mask (h_box, w_box, 1) float32 trong [0, 1].
    Canh duoc lam mo bang Gaussian blur thay vi linear ramp ->
    blend tu nhien hon, giam vien cung (box vuong).
    """
    feather = min(24, h_box // 5, w_box // 5)
    mask = np.ones((h_box, w_box), dtype=np.float32)
    for i in range(feather):
        v = (i + 1) / (feather + 1)
        mask[i, :] = np.minimum(mask[i, :], v)
        mask[-(i + 1), :] = np.minimum(mask[-(i + 1), :], v)
        mask[:, i] = np.minimum(mask[:, i], v)
        mask[:, -(i + 1)] = np.minimum(mask[:, -(i + 1)], v)
    # Gaussian blur de lam mo transition vung bien
    ksize = max(3, (feather // 2) * 2 + 1)  # phai le
    mask = cv2.GaussianBlur(mask, (ksize, ksize), 0)
    return mask[:, :, np.newaxis]


def preprocess_avatar(avatar_path: str, avatar_id: str):
    if avatar_id in avatar_cache:
        return avatar_cache[avatar_id]

    print(f'Pre-processing avatar: {avatar_id}')
    save_dir = f'/tmp/avatar_{avatar_id}'
    os.makedirs(save_dir, exist_ok=True)

    subprocess.run(
        ['ffmpeg', '-v', 'fatal', '-i', avatar_path,
         '-start_number', '0', f'{save_dir}/%08d.png'],
        check=True,
    )

    input_img_list = sorted(glob.glob(os.path.join(save_dir, '*.[jpJP][pnPN]*[gG]')))
    if not input_img_list:
        raise ValueError(f'Cannot extract frames from {avatar_path}')
    print(f'Extracted {len(input_img_list)} frames')

    coord_list, frame_list = get_landmark_and_bbox(input_img_list, 0)

    input_latent_list = []
    for bbox, frame in zip(coord_list, frame_list):
        if bbox == [0, 0, 0, 0]:
            continue
        x1, y1, x2, y2 = bbox
        crop = cv2.resize(frame[y1:y2, x1:x2], (256, 256),
                          interpolation=cv2.INTER_LANCZOS4)
        input_latent_list.append(vae.get_latents_for_unet(crop))

    frame_list_cycle  = frame_list + frame_list[::-1]
    coord_list_cycle  = coord_list + coord_list[::-1]
    latent_list_cycle = input_latent_list + input_latent_list[::-1]

    # Pre-compute feather mask tu bbox dau tien co mat
    feather_mask = None
    for bbox in coord_list:
        if bbox != [0, 0, 0, 0]:
            x1, y1, x2, y2 = bbox
            feather_mask = _build_feather_mask(y2 - y1, x2 - x1)
            break

    avatar_cache[avatar_id] = {
        'frame_list_cycle': frame_list_cycle,
        'coord_list_cycle': coord_list_cycle,
        'latent_list_cycle': latent_list_cycle,
        'feather_mask': feather_mask,
    }
    print(f'Avatar preprocessed: {len(frame_list)} frames '
          f'({len(frame_list_cycle)} with cycle), '
          f'feather_mask={feather_mask is not None}')
    return avatar_cache[avatar_id]


@app.on_event('startup')
async def startup():
    # 1. Preprocess avatar mặc định (backward compat)
    try:
        if os.path.exists('data/video/avatar_musetalk.mp4'):
            await asyncio.to_thread(preprocess_avatar, 'data/video/avatar_musetalk.mp4', 'default')
    except Exception as exc:
        import traceback
        print(f'[startup] preprocess default avatar failed: {exc}')
        traceback.print_exc()

    # 2. Preprocess tất cả idle_N.mp4 — LivePortrait-generated variants
    idle_files = sorted(glob.glob(IDLE_AVATAR_PATTERN))
    for path in idle_files:
        avatar_id = os.path.splitext(os.path.basename(path))[0]  # e.g. "idle_1"
        try:
            await asyncio.to_thread(preprocess_avatar, path, avatar_id)
            IDLE_AVATAR_IDS.append(avatar_id)
            print(f'[startup] Registered idle avatar: {avatar_id}')
        except Exception as exc:
            import traceback
            print(f'[startup] preprocess {avatar_id} failed: {exc}')
            traceback.print_exc()

    if IDLE_AVATAR_IDS:
        print(f'[startup] Idle avatars ready: {IDLE_AVATAR_IDS}')
    else:
        print('[startup] No idle_N.mp4 found — using default avatar only')

    print('[startup] Warming up CUDA kernels...')
    import sys; sys.stdout.flush()
    try:
        BATCH = BATCH_SIZE
        dummy_whisper = torch.zeros(BATCH, 50, 384, device=device, dtype=torch.float32)
        if 'default' in avatar_cache:
            latents = avatar_cache['default']['latent_list_cycle']
            dummy_latent = torch.cat([latents[i % len(latents)] for i in range(BATCH)], dim=0).to(dtype=weight_dtype)
        else:
            dummy_latent = torch.zeros(BATCH, 8, 32, 32, device=device, dtype=weight_dtype)
        with torch.no_grad():
            af = pe(dummy_whisper).to(dtype=weight_dtype)
            pred = unet.model(dummy_latent, timesteps, encoder_hidden_states=af).sample
            _ = vae.vae.decode(pred / vae.vae.config.scaling_factor).sample
        torch.cuda.synchronize()
        print('[startup] CUDA kernels warmed up OK')
        sys.stdout.flush()
    except Exception as exc:
        import traceback
        print(f'[startup] Warm-up failed (non-fatal): {exc}')
        traceback.print_exc()
        sys.stdout.flush()


@app.get('/health')
async def health():
    r = subprocess.run(
        ['nvidia-smi', '--query-gpu=name,memory.used,memory.total',
         '--format=csv,noheader'],
        capture_output=True, text=True,
    )
    return {'status': 'ok', 'gpu': r.stdout.strip(),
            'avatars': list(avatar_cache.keys()),
            'idle_avatars': IDLE_AVATAR_IDS,
            'webp': ENABLE_WEBP}


@app.get('/next_idle')
async def next_idle():
    """
    Trả về avatar_id ngẫu nhiên từ danh sách idle variants.
    Kiosk client gọi endpoint này khi bắt đầu session mới để chọn
    video idle khác nhau mỗi lần → tránh cảm giác lặp.
    Nếu chưa có idle variant nào, trả về 'default'.
    """
    if not IDLE_AVATAR_IDS:
        return {'avatar_id': 'default', 'avatar_path': 'data/video/avatar_musetalk.mp4'}

    avatar_id = random.choice(IDLE_AVATAR_IDS)
    avatar_path = f'data/video/{avatar_id}.mp4'
    return {'avatar_id': avatar_id, 'avatar_path': avatar_path}


def encode_frame(frame: np.ndarray) -> bytes:
    if ENABLE_WEBP:
        _, buf = cv2.imencode('.webp', frame, [cv2.IMWRITE_WEBP_QUALITY, WEBP_QUALITY])
    else:
        _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    return buf.tobytes()


def composite_frame(
    ori_frame: np.ndarray,
    pred_frame: np.ndarray,
    bbox: list,
    feather_mask,
) -> np.ndarray:
    if bbox == [0, 0, 0, 0]:
        return ori_frame

    x1, y1, x2, y2 = bbox
    h_box, w_box = y2 - y1, x2 - x1
    resized = cv2.resize(pred_frame.astype(np.uint8), (w_box, h_box))

    if feather_mask is not None and feather_mask.shape[:2] == (h_box, w_box):
        mask3 = feather_mask
    else:
        mask3 = _build_feather_mask(h_box, w_box)

    region = ori_frame[y1:y2, x1:x2].astype(np.float32)
    blended = region * (1.0 - mask3) + resized.astype(np.float32) * mask3
    result = ori_frame.copy()
    result[y1:y2, x1:x2] = np.clip(blended, 0, 255).astype(np.uint8)
    return result


@app.websocket('/avatar')
async def avatar_ws(ws: WebSocket):
    await ws.accept()
    sid = str(uuid.uuid4())[:8]
    print(f'Connected: {sid}')

    config = await ws.receive_json()
    avatar_id   = config.get('avatar_id', 'default')
    avatar_path = config.get('avatar_path', 'data/video/avatar_musetalk.mp4')

    data = await asyncio.to_thread(preprocess_avatar, avatar_path, avatar_id)
    frame_list_cycle  = data['frame_list_cycle']
    coord_list_cycle  = data['coord_list_cycle']
    latent_list_cycle = data['latent_list_cycle']
    feather_mask      = data['feather_mask']

    try:
        while True:
            msg = await ws.receive()

            if msg.get('type') != 'websocket.receive':
                continue

            # Text message: kiem tra ping keepalive
            text = msg.get('text')
            if text is not None:
                try:
                    parsed = json.loads(text)
                    if parsed.get('type') == 'ping':
                        continue
                except Exception:
                    pass
                continue

            audio_bytes = msg.get('bytes')
            if not audio_bytes:
                continue

            audio_path = f'/tmp/audio_{sid}.wav'
            with open(audio_path, 'wb') as f:
                f.write(audio_bytes)

            whisper_input, librosa_length = audio_processor.get_audio_feature(audio_path)
            whisper_chunks = audio_processor.get_whisper_chunk(
                whisper_input, device, whisper_dtype, whisper_model, librosa_length,
            )

            gen = datagen(
                whisper_chunks=whisper_chunks,
                vae_encode_latents=latent_list_cycle,
                batch_size=BATCH_SIZE,
                delay_frame=0,
                device=device,
            )

            frame_idx = 0
            with torch.no_grad():
                for whisper_batch, latent_batch in gen:
                    audio_feat = pe(whisper_batch.to(device=device, dtype=torch.float32))
                    audio_feat = audio_feat.to(dtype=weight_dtype)
                    latent_batch = latent_batch.to(dtype=weight_dtype)

                    pred = unet.model(
                        latent_batch, timesteps,
                        encoder_hidden_states=audio_feat,
                    ).sample
                    recon = vae.decode_latents(pred)

                    for pred_frame in recon:
                        idx        = frame_idx % len(coord_list_cycle)
                        bbox       = coord_list_cycle[idx]
                        ori_frame  = frame_list_cycle[idx].copy()

                        composited = composite_frame(ori_frame, pred_frame, bbox, feather_mask)
                        encoded    = encode_frame(composited)

                        await ws.send_bytes(encoded)
                        await asyncio.sleep(0)
                        frame_idx += 1

            await ws.send_text('CHUNK_DONE')
            try:
                os.remove(audio_path)
            except OSError:
                pass
            print(f'[{sid}] Sent {frame_idx} frames ({librosa_length} samples)')

    except WebSocketDisconnect:
        print(f'Disconnected: {sid}')
    except Exception as e:
        print(f'Error [{sid}]: {e}')
        import traceback; traceback.print_exc()
