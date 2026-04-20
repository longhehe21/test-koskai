path = '/home/quylhnh_fev35/MuseTalk/musetalk_api.py'
with open(path, 'r') as f:
    src = f.read()

# Remove torch.compile block
old = (
    "\n# torch.compile (PyTorch 2.0+): reduce kernel launch overhead ~15-25%\n"
    "try:\n"
    "    unet.model = torch.compile(unet.model, mode='reduce-overhead', fullgraph=False)\n"
    "    print('UNet compiled with torch.compile OK')\n"
    "except Exception as _e:\n"
    "    print(f'torch.compile skipped: {_e}')\n"
)

if old in src:
    src = src.replace(old, '\n')
    print('torch.compile block removed OK')
else:
    # Try to find and report what's there
    idx = src.find('torch.compile')
    if idx >= 0:
        print('Found torch.compile at char', idx)
        print(repr(src[idx-50:idx+200]))
    else:
        print('torch.compile not found - already removed')

with open(path, 'w') as f:
    f.write(src)
