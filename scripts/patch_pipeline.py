"""
Apply CPU/GPU pipeline to /avatar websocket handler.
While GPU processes batch N+1, CPU thread composites+encodes batch N.
"""
import ast

PATH = '/home/quylhnh_fev35/MuseTalk/musetalk_api.py'

with open(PATH) as f:
    src = f.read()

# ── Add ThreadPoolExecutor import ──────────────────────────────────────────
if 'ThreadPoolExecutor' not in src:
    src = src.replace(
        'import asyncio\n',
        'import asyncio\nfrom concurrent.futures import ThreadPoolExecutor\n',
    )
    print('[a] ThreadPoolExecutor import added')
else:
    print('[a] ThreadPoolExecutor already present')

# ── Add executor instance after whisper_dtype ──────────────────────────────
if '_cpu_executor' not in src:
    src = src.replace(
        'whisper_dtype = torch.float16\n',
        'whisper_dtype = torch.float16\n'
        '# 1 worker = serialized CPU composite, no race on frame_list_cycle reads\n'
        '_cpu_executor = ThreadPoolExecutor(max_workers=1)\n',
    )
    print('[b] _cpu_executor added')
else:
    print('[b] _cpu_executor already present')

# ── Replace the inference loop in /avatar handler ──────────────────────────
OLD_LOOP = '''            frame_idx = 0
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

NEW_LOOP = '''            frame_idx = 0
            batch_idx = 0
            t_inf_start = time.perf_counter()
            total_unet_ms = 0.0
            total_composite_ms = 0.0
            ev_loop = asyncio.get_event_loop()

            # Pipeline: GPU inference(N+1) overlaps CPU composite(N) in thread.
            # While torch.cuda.synchronize() releases GIL, thread runs freely.
            prev_future = None  # future for previous batch composite

            def _do_composite(recon_frames, start_idx):
                """CPU thread: composite + encode a full batch, return list of bytes."""
                out = []
                for i, pf in enumerate(recon_frames):
                    ii = (start_idx + i) % len(coord_list_cycle)
                    composited = composite_frame(
                        frame_list_cycle[ii], pf,
                        coord_list_cycle[ii], mask_list_cycle[ii],
                        mask_coords_list_cycle[ii],
                    )
                    out.append(encode_frame(composited))
                return out

            with torch.no_grad():
                for whisper_batch, latent_batch in gen:
                    # ── GPU inference ──────────────────────────────────────
                    t_b = time.perf_counter()
                    audio_feat   = pe(whisper_batch.to(device=device, dtype=torch.float32))
                    audio_feat   = audio_feat.to(dtype=weight_dtype)
                    latent_batch = latent_batch.to(dtype=weight_dtype)
                    pred  = unet.model(latent_batch, timesteps,
                                       encoder_hidden_states=audio_feat).sample
                    recon = vae.decode_latents(pred)
                    # synchronize: releases GIL → composite thread runs here
                    if device.type == 'cuda':
                        torch.cuda.synchronize()
                    total_unet_ms += (time.perf_counter() - t_b) * 1000

                    # ── Submit composite for current batch to thread ───────
                    curr_future = ev_loop.run_in_executor(
                        _cpu_executor, _do_composite, list(recon), frame_idx
                    )
                    frame_idx += len(recon)

                    # ── Drain PREVIOUS batch (should be done by now) ───────
                    if prev_future is not None:
                        t_c = time.perf_counter()
                        encoded_frames = await prev_future
                        total_composite_ms += (time.perf_counter() - t_c) * 1000
                        for enc in encoded_frames:
                            await ws.send_bytes(enc)
                            await asyncio.sleep(0)

                    prev_future = curr_future
                    batch_idx += 1

            # ── Drain last batch ───────────────────────────────────────────
            if prev_future is not None:
                t_c = time.perf_counter()
                encoded_frames = await prev_future
                total_composite_ms += (time.perf_counter() - t_c) * 1000
                for enc in encoded_frames:
                    await ws.send_bytes(enc)
                    await asyncio.sleep(0)

            await ws.send_text('CHUNK_DONE')'''

if OLD_LOOP in src:
    src = src.replace(OLD_LOOP, NEW_LOOP)
    print('[c] pipeline loop replaced OK')
else:
    print('[c] ERROR: OLD_LOOP not found verbatim')
    # Find approximate location
    idx = src.find('total_composite_ms = 0.0')
    if idx >= 0:
        print('  Hint: total_composite_ms found at char', idx)
        print(repr(src[idx:idx+300]))

# ── Syntax check ──────────────────────────────────────────────────────────
try:
    ast.parse(src)
    print('Syntax OK')
    with open(PATH, 'w') as f:
        f.write(src)
    print('Written.')
except SyntaxError as e:
    print(f'SyntaxError: {e}')
    print('NOT written — original unchanged.')
