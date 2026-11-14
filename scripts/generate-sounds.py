"""Synthesises every sound in the app (original, royalty-free).
   python3 scripts/generate-sounds.py  -> assets/sounds/*.wav, music.m4a"""
import numpy as np, wave, os, subprocess

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def write(name, x, sr=SR):
    x = np.clip(x, -1, 1)
    x = (x * 32000).astype(np.int16)
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(x.tobytes())

def env(n, attack=0.002, decay=0.08):
    t = np.arange(n) / SR
    a = np.minimum(1, t / max(attack, 1e-5))
    return a * np.exp(-t / decay)

def knock(freqs, dur=0.18, decay=0.035, noise=0.5, gain=0.9):
    n = int(SR * dur); t = np.arange(n) / SR
    body = sum(np.sin(2 * np.pi * f * t + rng.random() * 6) * w for f, w in freqs)
    click = rng.standard_normal(n) * np.exp(-t / 0.004) * noise
    # simple low-pass on the noise for a woody thud
    k = np.ones(6) / 6
    click = np.convolve(click, k, mode='same')
    x = (body * env(n, 0.0008, decay) + click)
    return x / np.max(np.abs(x)) * gain

def bell(freqs, dur=1.2, decay=0.5, gain=0.6):
    n = int(SR * dur); t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * t) * w * np.exp(-t / (decay * (1 + i * 0.3))) for i, (f, w) in enumerate(freqs))
    x *= np.minimum(1, t / 0.004)
    return x / np.max(np.abs(x)) * gain

def place(x, delay, total):
    out = np.zeros(int(SR * total)); s = int(SR * delay)
    seg = x[: max(0, len(out) - s)]; out[s: s + len(seg)] += seg
    return out

def seq(*parts, gap=0.0):
    out = []
    for p in parts:
        out.append(p); out.append(np.zeros(int(SR * gap)))
    return np.concatenate(out)

write('move.wav', knock([(320, 1), (710, 0.45), (1250, 0.18)], 0.16, 0.03, 0.45, 0.75))
cap1 = knock([(380, 1), (860, 0.5), (1500, 0.25)], 0.12, 0.025, 0.7, 0.85)
cap2 = knock([(300, 1), (640, 0.4)], 0.16, 0.03, 0.4, 0.6)
write('capture.wav', np.concatenate([cap1[: int(SR * 0.045)], cap2]))
c1 = knock([(330, 1), (700, 0.4)], 0.1, 0.025, 0.4, 0.7)
write('castle.wav', np.concatenate([c1[: int(SR * 0.09)], c1]))
write('check.wav', bell([(880, 1), (1320, 0.4), (2210, 0.15)], 0.7, 0.18, 0.45))
write('promote.wav', seq(bell([(660, 1), (990, 0.3)], 0.25, 0.08, 0.4)[: int(SR*0.12)], bell([(990, 1), (1485, 0.3)], 0.6, 0.2, 0.45)))
write('start.wav', bell([(523.25, 1), (784, 0.5), (1046.5, 0.25)], 1.0, 0.35, 0.4))
win = sum(place(bell([(f, 1), (f * 2, 0.25)], 1.6, 0.6, 0.35), d, 2.2) for f, d in [(523.25, 0), (659.25, 0.11), (783.99, 0.22), (1046.5, 0.33)])
write('win.wav', win / np.max(np.abs(win)) * 0.6)
lose = sum(place(bell([(f, 1), (f * 2, 0.2)], 1.6, 0.7, 0.35), d, 2.0) for f, d in [(392, 0), (311.13, 0.16), (261.63, 0.32)])
write('lose.wav', lose / np.max(np.abs(lose)) * 0.5)
draw = sum(place(bell([(f, 1)], 1.4, 0.6, 0.35), d, 1.8) for f, d in [(440, 0), (440 * 1.5, 0.14)])
write('draw.wav', draw / np.max(np.abs(draw)) * 0.5)
write('tap.wav', knock([(1800, 1), (3200, 0.3)], 0.05, 0.008, 0.2, 0.35))
write('correct.wav', seq(bell([(784, 1)], 0.15, 0.06, 0.4)[: int(SR*0.09)], bell([(1175, 1), (2350, 0.2)], 0.6, 0.2, 0.45)))
write('wrong.wav', bell([(220, 1), (233, 0.8)], 0.45, 0.12, 0.4))
lv = sum(place(bell([(f, 1), (f * 3, 0.1)], 1.5, 0.5, 0.3), d, 2.2) for f, d in [(523.25, 0), (659.25, 0.08), (783.99, 0.16), (1046.5, 0.24), (1318.5, 0.36)])
write('levelup.wav', lv / np.max(np.abs(lv)) * 0.6)
write('achievement.wav', bell([(987.77, 1), (1479.98, 0.5), (1975.5, 0.2)], 1.2, 0.4, 0.45))

# ---- Ambient music: slow, warm chord pads with soft piano-like notes (~64 s loop) ----
MSR = 32000
def pad(freq, dur, sr=MSR):
    n = int(sr * dur); t = np.arange(n) / sr
    x = np.zeros(n)
    for d in (-0.15, 0, 0.12):  # light chorus
        f = freq * (2 ** (d / 12))
        x += np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) + 0.08 * np.sin(2 * np.pi * 3 * f * t)
    a = np.minimum(1, t / 2.5) * np.minimum(1, (dur - t) / 2.5)
    return x * a * (1 + 0.15 * np.sin(2 * np.pi * 0.2 * t))

def note(freq, dur, sr=MSR):
    n = int(sr * dur); t = np.arange(n) / sr
    x = sum(np.sin(2 * np.pi * freq * k * t) / k ** 1.6 for k in range(1, 6))
    return x * np.minimum(1, t / 0.006) * np.exp(-t / 1.1)

chords = [[220.0, 261.63, 329.63, 392.0], [174.61, 220.0, 261.63, 329.63], [196.0, 246.94, 293.66, 392.0], [164.81, 207.65, 246.94, 329.63]]
bar = 8.0
total = int(MSR * bar * 8)
mix = np.zeros(total + MSR * 4)
mel_rng = np.random.default_rng(3)
for i in range(8):
    ch = chords[i % 4]
    start = int(MSR * bar * i)
    for f in ch:
        seg = pad(f / 2, bar + 2.5) * 0.05
        mix[start: start + len(seg)] += seg
    for j in range(4):
        if mel_rng.random() < 0.75:
            f = ch[mel_rng.integers(0, 4)] * 2
            s = start + int(MSR * (j * 2 + mel_rng.random() * 0.3))
            seg = note(f, 3.0) * 0.06
            mix[s: s + len(seg)] += seg
# cheap reverb: a few feedback delays
rev = mix.copy()
for d, g in [(0.113, 0.35), (0.197, 0.28), (0.271, 0.22), (0.431, 0.15)]:
    k = int(MSR * d)
    rev[k:] += mix[:-k] * g
mix = rev[:total]
# crossfade the tail into the head so it loops seamlessly
fade = int(MSR * 3)
tail = rev[total: total + fade]
mix[:fade] += tail * np.linspace(1, 0, fade)
mix = mix / np.max(np.abs(mix)) * 0.55
write('music.wav', mix, MSR)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(OUT, 'music.wav'), '-c:a', 'aac', '-b:a', '96k', os.path.join(OUT, 'music.m4a')], check=True)
os.remove(os.path.join(OUT, 'music.wav'))
print('sounds written to', os.path.abspath(OUT))
