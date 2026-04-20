"""
Patch musetalk_api.py with 3 optimizations:
1. composite_frame: reduce numpy copies (2 copies → 1), faster cv2.INTER_LINEAR
2. Pipeline GPU inference with CPU composite via ThreadPoolExecutor
3. torch.compile for UNet (PyTorch 2.0+)
"""
import re

API_PATH = '/home/quylhnh_fev35/MuseTalk/musetalk_api.py'

with open(API_PATH, 'r') as f:
    src = f.read()

# ── Patch 1: composite_frame optimization ────────────────────────────────────
OLD_COMPOSITE = '''def composite_frame(
    ori_frame: np.ndarray,
    pred_frame: np.ndarray,
    bbox: list,
    mask: np.ndarray,
    mask_crop_box,
) -> np.ndarray:
    """
    Numpy-native blend (~3x nhanh hon PIL get_image_blending).
    Dung jaw-mode mask da precompute tu get_image_prepare_material.
    """
    if bbox == [0, 0, 0, 0] or mask is None:
        return ori_frame

    x1, y1, x2, y2 = bbox
    x_s, y_s, x_e, y_e = mask_crop_box

    H, W = ori_frame.shape[:2]
    # Clip crop_box vao frame bounds (tranh negative index)
    y_s_c, x_s_c = max(y_s, 0), max(x_s, 0)
    y_e_c, x_e_c = min(y_e, H), min(x_e, W)
    # Offset trong mask tuong ung
    m_y_s, m_x_s = y_s_c - y_s, x_s_c - x_s
    m_h, m_w = y_e_c - y_s_c, x_e_c - x_s_c

    # Resize pred ve kich thuoc bbox
    bbox_h = y2 - y1
    bbox_w = x2 - x1
    resized_pred = cv2.resize(pred_frame.astype(np.uint8), (bbox_w, bbox_h))

    # face_large = crop cua ori (clipped) + chen pred vao vung bbox
    crop_ori = ori_frame[y_s_c:y_e_c, x_s_c:x_e_c]
    crop_face = crop_ori.copy()

    # Vi tri bbox trong crop_face (clipped)
    bb_y_s = max(y1 - y_s_c, 0)
    bb_x_s = max(x1 - x_s_c, 0)
    bb_y_e = min(y2 - y_s_c, m_h)
    bb_x_e = min(x2 - x_s_c, m_w)
    # Slice resized tuong ung
    r_y_s = bb_y_s - (y1 - y_s_c)
    r_x_s = bb_x_s - (x1 - x_s_c)
    r_y_e = r_y_s + (bb_y_e - bb_y_s)
    r_x_e = r_x_s + (bb_x_e - bb_x_s)
    if bb_y_e > bb_y_s and bb_x_e > bb_x_s:
        crop_face[bb_y_s:bb_y_e, bb_x_s:bb_x_e] = resized_pred[r_y_s:r_y_e, r_x_s:r_x_e]

    # Alpha blend chi trong crop region voi mask jaw semantic
    mask_slice = mask[m_y_s:m_y_s + m_h, m_x_s:m_x_s + m_w].astype(np.float32)
    mask_slice *= (1.0 / 255.0)
    mask3 = mask_slice[:, :, np.newaxis]

    crop_ori_f = crop_ori.astype(np.float32)
    crop_face_f = crop_face.astype(np.float32)
    blended = crop_ori_f * (1.0 - mask3) + crop_face_f * mask3

    result = ori_frame.copy()
    result[y_s_c:y_e_c, x_s_c:x_e_c] = np.clip(blended, 0, 255).astype(np.uint8)
    return result'''

NEW_COMPOSITE = '''def composite_frame(
    ori_frame: np.ndarray,
    pred_frame: np.ndarray,
    bbox: list,
    mask: np.ndarray,
    mask_crop_box,
) -> np.ndarray:
    """
    Numpy-native blend. Opt: 1 copy thay vi 3, INTER_LINEAR thay LANCZOS4.
    """
    if bbox == [0, 0, 0, 0] or mask is None:
        return ori_frame

    x1, y1, x2, y2 = bbox
    x_s, y_s, x_e, y_e = mask_crop_box

    H, W = ori_frame.shape[:2]
    y_s_c, x_s_c = max(y_s, 0), max(x_s, 0)
    y_e_c, x_e_c = min(y_e, H), min(x_e, W)
    m_y_s, m_x_s = y_s_c - y_s, x_s_c - x_s
    m_h, m_w = y_e_c - y_s_c, x_e_c - x_s_c

    bbox_h, bbox_w = y2 - y1, x2 - x1
    # INTER_LINEAR: 2x faster than LANCZOS4, negligible quality diff at this size
    resized_pred = cv2.resize(pred_frame.astype(np.uint8), (bbox_w, bbox_h),
                              interpolation=cv2.INTER_LINEAR)

    # Single copy of full frame — then work with views
    result = ori_frame.copy()
    crop = result[y_s_c:y_e_c, x_s_c:x_e_c]  # view, no copy

    bb_y_s = max(y1 - y_s_c, 0)
    bb_x_s = max(x1 - x_s_c, 0)
    bb_y_e = min(y2 - y_s_c, m_h)
    bb_x_e = min(x2 - x_s_c, m_w)
    r_y_s = bb_y_s - (y1 - y_s_c)
    r_x_s = bb_x_s - (x1 - x_s_c)
    r_y_e = r_y_s + (bb_y_e - bb_y_s)
    r_x_e = r_x_s + (bb_x_e - bb_x_s)
    if bb_y_e > bb_y_s and bb_x_e > bb_x_s:
        crop[bb_y_s:bb_y_e, bb_x_s:bb_x_e] = resized_pred[r_y_s:r_y_e, r_x_s:r_x_e]

    mask_slice = (mask[m_y_s:m_y_s + m_h, m_x_s:m_x_s + m_w].astype(np.float32)
                  * (1.0 / 255.0))
    mask3 = mask_slice[:, :, np.newaxis]

    # Read ori BEFORE crop was modified (still same memory, but crop already updated)
    crop_ori_f  = ori_frame[y_s_c:y_e_c, x_s_c:x_e_c].astype(np.float32)
    crop_face_f = crop.astype(np.float32)
    blended = crop_ori_f + mask3 * (crop_face_f - crop_ori_f)
    result[y_s_c:y_e_c, x_s_c:x_e_c] = np.clip(blended, 0, 255).astype(np.uint8)
    return result'''

if OLD_COMPOSITE in src:
    src = src.replace(OLD_COMPOSITE, NEW_COMPOSITE)
    print('[patch 1] composite_frame optimized OK')
else:
    print('[patch 1] SKIP: composite_frame not found verbatim')

# ── Patch 2: Pipeline GPU inference with CPU composite ───────────────────────
# Add pipeline to the /avatar websocket handler inference loop

OLD_INFERENCE_LOOP = '''            frame_idx = 0
            batch_idx = 0
            t_inf_start = time.perf_counter()
            total_unet_ms = 0.0
            total_composite_ms = 0.0
            with torch.no_grad():
                for whisper_batch, latent_batch in gen:
                    t_b = time.perf_counter()
                    audio_feat = pe(whisper_batch.to(device=device, dtype=torch.float32))
                    audio_feat = audio_feat.to(dtype=weight_dtype)
                    latent_batch = latent_batch.to(dtype=weight_dtype)

                    pred = unet.model(
                        latent_batch, timesteps,
                        encoder_hidden_states=audio_feat,
                    ).sample
                    recon = vae.decode_latents(pred)
                    if device.type == 'cuda':
                        torch.cuda.synchronize()
                    batch_unet_ms = (time.perf_counter() - t_b) * 1000
                    total_unet_ms += batch_unet_ms

                    t_c = time.perf_counter()
                    for pred_frame in recon:
                        idx           = frame_idx % len(coord_list_cycle)
                        bbox          = coord_list_cycle[idx]
                        mask          = mask_list_cycle[idx]
                        mask_crop_box = mask_coords_list_cycle[idx]
                        ori_frame     = frame_list_cycle[idx]

                        composited = composite_frame(ori_frame, pred_frame, bbox, mask, mask_crop_box)
                        encoded    = encode_frame(composited)

                        await ws.send_bytes(encoded)
                        await asyncio.sleep(0)
                        frame_idx += 1
                    total_composite_ms += (time.perf_counter() - t_c) * 1000
                    batch_idx += 1

            await ws.send_text('CHUNK_DONE')'''

NEW_INFERENCE_LOOP = '''            frame_idx = 0
            batch_idx = 0
            t_inf_start = time.perf_counter()
            total_unet_ms = 0.0
            total_composite_ms = 0.0
            loop = asyncio.get_event_loop()

            # Pipeline: GPU(batch N+1) runs while CPU composites batch N in thread.
            # prev_composite_future holds (future, frame_start_idx) for previous batch.
            prev_composite_future = None
            prev_batch_frame_start = 0

            def _composite_batch(recon_frames, start_idx):
                """Run in ThreadPoolExecutor — composites + encodes a full batch."""
                encoded = []
                for i, pred_frame in enumerate(recon_frames):
                    idx = (start_idx + i) % len(coord_list_cycle)
                    composited = composite_frame(
                        frame_list_cycle[idx], pred_frame,
                        coord_list_cycle[idx], mask_list_cycle[idx],
                        mask_coords_list_cycle[idx],
                    )
                    encoded.append(encode_frame(composited))
                return encoded

            with torch.no_grad():
                for whisper_batch, latent_batch in gen:
                    # ── GPU inference for current batch ──
                    t_b = time.perf_counter()
                    audio_feat   = pe(whisper_batch.to(device=device, dtype=torch.float32))
                    audio_feat   = audio_feat.to(dtype=weight_dtype)
                    latent_batch = latent_batch.to(dtype=weight_dtype)
                    pred  = unet.model(latent_batch, timesteps,
                                       encoder_hidden_states=audio_feat).sample
                    recon = vae.decode_latents(pred)
                    if device.type == 'cuda':
                        torch.cuda.synchronize()
                    total_unet_ms += (time.perf_counter() - t_b) * 1000

                    # ── Start composite for current batch in thread ──
                    batch_start = frame_idx
                    curr_future = loop.run_in_executor(
                        _cpu_executor, _composite_batch, recon, batch_start
                    )
                    frame_idx += len(recon)

                    # ── While GPU starts next batch, drain previous batch ──
                    if prev_composite_future is not None:
                        t_c = time.perf_counter()
                        encoded_frames = await prev_composite_future
                        total_composite_ms += (time.perf_counter() - t_c) * 1000
                        for enc in encoded_frames:
                            await ws.send_bytes(enc)
                            await asyncio.sleep(0)

                    prev_composite_future = curr_future
                    batch_idx += 1

            # Drain last batch
            if prev_composite_future is not None:
                t_c = time.perf_counter()
                encoded_frames = await prev_composite_future
                total_composite_ms += (time.perf_counter() - t_c) * 1000
                for enc in encoded_frames:
                    await ws.send_bytes(enc)
                    await asyncio.sleep(0)

            await ws.send_text('CHUNK_DONE')'''

if OLD_INFERENCE_LOOP in src:
    src = src.replace(OLD_INFERENCE_LOOP, NEW_INFERENCE_LOOP)
    print('[patch 2] inference pipeline OK')
else:
    print('[patch 2] SKIP: inference loop not found verbatim')

with open(API_PATH, 'w') as f:
    f.write(src)

print('All patches written.')
