"""랜딩페이지 첫 화면 모션그래픽(motion.html)용 사운드트랙 합성기.

외부 음원 없이 numpy로 직접 합성합니다(저작권 걱정 없음).
장면 타이밍(35초)은 motion.html의 data-start/애니메이션 지연값과 맞춰 두었습니다.

사용법: python3 scripts/landing-video/sound.py <출력.wav>
"""
import sys
import wave

import numpy as np

SR = 48000
DUR = 35.0
N = int(SR * DUR)
rng = np.random.default_rng(7)


def t_arr(sec):
    return np.arange(int(sec * SR)) / SR


def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    sig = sig[: len(buf) - i]
    buf[i : i + len(sig)] += sig * gain


def fft_filter(x, lo=None, hi=None, slope=0.15):
    """주파수 영역 대역 필터(부드러운 경계)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + np.exp(-(np.log(f + 1e-9) - np.log(lo)) / slope))
    if hi:
        m *= 1 / (1 + np.exp((np.log(f + 1e-9) - np.log(hi)) / slope))
    return np.fft.irfft(X * m, len(x))


def env_ad(n, a, d):
    """선형 어택 후 지수 감쇠."""
    t = np.arange(n) / SR
    e = np.exp(-np.maximum(t - a, 0) / d)
    if a > 0:
        e *= np.minimum(t / a, 1)
    return e


def note_hz(name):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[n] + 12 * (o + 1) - 69) / 12)


def saw(freq, sec, detune=0.0, harmonics=24):
    t = t_arr(sec)
    out = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        if freq * k > SR / 2.2:
            break
        out += np.sin(2 * np.pi * freq * (1 + detune) * k * t + k) / k
    return out


# ---------- 악기 ----------
def kick(sec=0.45, f0=140, f1=42, punch=1.0):
    t = t_arr(sec)
    f = f1 + (f0 - f1) * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env_ad(len(t), 0.001, sec / 3.2)
    click = fft_filter(rng.standard_normal(len(t)), lo=1500, hi=7000) * env_ad(len(t), 0, 0.004) * 0.5 * punch
    return np.tanh(1.6 * (body + click))


def clap():
    n = int(0.35 * SR)
    noise = fft_filter(rng.standard_normal(n), lo=900, hi=6000)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022, 0.034]):
        o = int(off * SR)
        e[o:] += env_ad(n - o, 0, 0.008 if k < 3 else 0.12) * 0.8
    return noise * e * 0.6


def hat(open_=False):
    n = int((0.22 if open_ else 0.06) * SR)
    return fft_filter(rng.standard_normal(n), lo=7000) * env_ad(n, 0, 0.07 if open_ else 0.014) * 0.35


def impact(big=1.0):
    sec = 2.4
    t = t_arr(sec)
    f = 30 + 90 * np.exp(-t / 0.08)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(t), 0.002, 0.55)
    crash = fft_filter(rng.standard_normal(len(t)), lo=300, hi=9000) * env_ad(len(t), 0.001, 0.35) * 0.45
    snap = fft_filter(rng.standard_normal(len(t)), lo=2000) * env_ad(len(t), 0, 0.02) * 0.6
    return np.tanh(1.8 * big * (boom + crash + snap)) * 0.9


def slam():
    """키네틱 단어용 짧고 단단한 타격음."""
    sec = 0.5
    t = t_arr(sec)
    f = 48 + 160 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(t), 0.001, 0.12)
    snap = fft_filter(rng.standard_normal(len(t)), lo=1200, hi=8000) * env_ad(len(t), 0, 0.03) * 0.7
    return np.tanh(2.0 * (body + snap)) * 0.8


def riser(sec, f0=150, f1=2400):
    t = t_arr(sec)
    k = t / sec
    noise = rng.standard_normal(len(t))
    # 구간별로 밝아지는 노이즈
    seg = int(0.05 * SR)
    out = np.zeros_like(noise)
    for i in range(0, len(t), seg):
        c = f0 + (f1 * 3 - f0) * (i / len(t)) ** 2
        chunk = noise[i : i + seg]
        out[i : i + len(chunk)] = fft_filter(chunk, lo=c * 0.5, hi=c * 2)
    ph = 2 * np.pi * np.cumsum(f0 * (f1 / f0) ** k) / SR
    tone = (np.sin(ph) + 0.5 * np.sin(2 * ph)) * 0.25
    return (out * 0.5 + tone) * k ** 2.2


def whoosh(sec=0.45, lo=500, hi=6000):
    n = int(sec * SR)
    x = fft_filter(rng.standard_normal(n), lo=lo, hi=hi)
    t = np.arange(n) / n
    e = np.sin(np.pi * t) ** 2 * (0.4 + 0.6 * t)
    return x * e * 0.55


def ui_click():
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    tick = np.sin(2 * np.pi * 3200 * t) * env_ad(n, 0, 0.004)
    body = np.sin(2 * np.pi * 1100 * t) * env_ad(n, 0, 0.012) * 0.6
    return (tick + body) * 0.7


def tick(f=4200):
    n = int(0.025 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t) * env_ad(n, 0, 0.003) * 0.35


def bell(freq, sec=1.6):
    t = t_arr(sec)
    out = np.zeros_like(t)
    for r, a, d in [(1, 1, 1.0), (2.0, 0.35, 0.5), (2.76, 0.25, 0.35), (5.4, 0.12, 0.18)]:
        out += a * np.sin(2 * np.pi * freq * r * t) * env_ad(len(t), 0.002, d * sec / 2)
    return out * 0.35


def chime(base='E6'):
    out = np.zeros(int(1.8 * SR))
    for i, nm in enumerate([base, 'A6' if base == 'E6' else 'C7', 'E7']):
        place(out, bell(note_hz(nm)), i * 0.07, 0.8 - i * 0.15)
    return out


def scan_sweep(sec):
    n = int(sec * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    seg = int(0.04 * SR)
    for i in range(0, n, seg):
        c = 600 + 5000 * (i / n)
        chunk = noise[i : i + seg]
        out[i : i + len(chunk)] = fft_filter(chunk, lo=c * 0.7, hi=c * 1.4)
    e = np.minimum(1, np.arange(n) / (0.1 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.25 * SR))
    t = np.arange(n) / SR
    shimmer = np.sin(2 * np.pi * (1800 + 1600 * t / sec) * t) * 0.08 * (0.5 + 0.5 * np.sin(2 * np.pi * 18 * t))
    return (out * 0.35 + shimmer) * e


def pad_chord(notes, sec, att=0.6, rel=1.2):
    out = np.zeros(int(sec * SR))
    for nm in notes:
        f = note_hz(nm)
        for d in (-0.004, 0.0, 0.0045):
            out += saw(f, sec, detune=d, harmonics=10)
    out = fft_filter(out, hi=2200)
    t = np.arange(len(out)) / SR
    e = np.minimum(1, t / att) * np.minimum(1, (sec - t) / rel)
    return out * np.clip(e, 0, 1) * 0.045


def bass_note(name, sec):
    f = note_hz(name)
    x = saw(f, sec, harmonics=12) * 0.6 + np.sin(2 * np.pi * f * t_arr(sec)) * 0.8
    x = fft_filter(x, hi=900)
    n = len(x)
    e = env_ad(n, 0.004, 0.35) * 0.6 + 0.4
    e *= np.minimum(1, (n - np.arange(n)) / (0.02 * SR))
    return x * e * 0.32


def pluck(name, sec=0.22):
    f = note_hz(name)
    x = saw(f, sec, harmonics=16)
    x = fft_filter(x, hi=3500)
    return x * env_ad(len(x), 0.002, 0.07) * 0.12


# ---------- 편곡 ----------
music = np.zeros(N)
drums = np.zeros(N)
sfx = np.zeros(N)
duck = np.ones(N)

BEAT = 0.5  # 120 BPM
T0 = 3.4    # 브랜드 등장과 함께 음악 시작
PROG = [  # (베이스, 패드)
    ('A1', ['A3', 'C4', 'E4', 'B4']),
    ('F1', ['F3', 'A3', 'C4', 'E4']),
    ('C2', ['G3', 'C4', 'E4', 'D5']),
    ('G1', ['G3', 'B3', 'D4', 'A4']),
]
ARP = {0: ['A4', 'C5', 'E5', 'B5'], 1: ['F4', 'A4', 'C5', 'E5'], 2: ['C5', 'E5', 'G5', 'D6'], 3: ['G4', 'B4', 'D5', 'A5']}

# A. 키네틱 단어 타격 + 브랜드 직전 상승음
for at in [0.05, 0.5, 0.95, 1.4, 1.85]:
    place(sfx, slam(), at, 0.65)
place(sfx, riser(1.1), 2.3, 1.3)
place(sfx, whoosh(0.5, 300, 9000)[::-1], 2.9, 0.6)  # 역방향 스윕

# B. 브랜드 임팩트 + 반짝임
place(sfx, impact(1.2), 3.4, 1.0)
place(sfx, chime('E6'), 3.55, 0.6)
place(sfx, chime('A6'), 4.1, 0.35)

# 음악: 3.4초부터 마디 단위
bar = 0
t = T0
while t < 27.0 - 1e-6:
    b, chord = PROG[bar % 4]
    bar_len = min(4 * BEAT, 27.0 - t)
    place(music, pad_chord(chord, bar_len + 0.8, att=0.5 if bar else 1.2), t, 1.0)
    for k in range(4):
        bt = t + k * BEAT
        if bt >= 27.0:
            break
        place(music, bass_note(b, BEAT * 0.9), bt, 1.0)
        place(music, bass_note(b, BEAT * 0.4), bt + BEAT * 0.75, 0.55)
        groove_on = bt >= 6.6 - 1e-6
        if groove_on and not (22.7 <= bt < 23.2):
            place(drums, kick(), bt, 0.9)
            i = int(bt * SR)
            dd = np.ones(int(0.25 * SR))
            dd -= 0.55 * np.exp(-np.arange(len(dd)) / (0.08 * SR))
            duck[i : i + len(dd)] = np.minimum(duck[i : i + len(dd)], dd[: len(duck[i : i + len(dd)])])
            if k in (1, 3):
                place(drums, clap(), bt, 0.7)
        if bt >= 5.4:
            place(drums, hat(open_=groove_on), bt + BEAT / 2, 0.8 if groove_on else 0.5)
            if groove_on:
                place(drums, hat(), bt + BEAT / 4, 0.35)
                place(drums, hat(), bt + 3 * BEAT / 4, 0.35)
        if bt >= 11.6:  # 아르페지오(16분음표)
            notes = ARP[bar % 4]
            for s in range(4):
                place(music, pluck(notes[(k * 4 + s) % 4]), bt + s * BEAT / 4, 0.9)
    t += 4 * BEAT
    bar += 1

# 장면 전환 휙 소리
for at in [6.6, 11.6, 16.0, 19.8]:
    place(sfx, whoosh(0.45), at - 0.2, 0.75)

# C. 공문서: 클릭 → 스캔 → 완성
place(sfx, ui_click(), 6.6 + 1.75, 1.0)
place(sfx, scan_sweep(1.5), 6.6 + 2.05, 0.8)
place(sfx, chime('E6'), 6.6 + 3.6, 0.8)

# D. 생기부: 칩 3번 클릭 → 관찰 입력 타이핑 → 결과 카드
for at in [1.0, 1.35, 1.7]:
    place(sfx, ui_click(), 11.6 + at, 0.9)
for k in range(30):
    place(sfx, tick(3000 + rng.integers(0, 1500)), 11.6 + 2.0 + k * 0.032 + rng.uniform(0, 0.01), 0.55)
place(sfx, whoosh(0.4, 800, 7000), 11.6 + 2.9, 0.5)
for k in range(26):
    place(sfx, tick(3400 + rng.integers(0, 1200)), 11.6 + 3.35 + k * 0.032, 0.45)
place(sfx, chime('E6'), 11.6 + 4.15, 0.45)

# E. 예산: 클릭 → 숫자 카운트(틱) → 완성
place(sfx, ui_click(), 16.0 + 1.05, 1.0)
for k in range(28):
    tt = 1.15 + 1.15 * (k / 28) ** 1.6
    place(sfx, tick(2600 + k * 60), 16.0 + tt, 0.5)
place(sfx, chime('E6'), 16.0 + 2.4, 0.8)

# F. 활동지: 클릭 → 스캔 → 완성
place(sfx, ui_click(), 19.8 + 0.95, 1.0)
place(sfx, scan_sweep(1.2), 19.8 + 1.2, 0.75)
place(sfx, chime('E6'), 19.8 + 2.4, 0.8)

# 화면 월로 넘어가기 전 스네어 롤 + 상승음
for k in range(16):
    at = 22.2 + k * (1.0 / 16)
    place(drums, clap(), at, 0.15 + 0.5 * k / 16)
place(sfx, riser(1.0, 200, 3000), 22.2, 1.0)

# G. 화면 월: 큰 임팩트, 단어마다 타격, 더블 타임 킥
place(sfx, impact(1.0), 23.2, 0.9)
for at in [0.2, 0.6, 1.0]:
    place(sfx, slam(), 23.2 + at + 0.05, 0.7)
for k in range(int(3.8 / 0.25)):
    at = 23.2 + 1.5 + k * 0.25
    if at >= 26.0:
        break
    place(drums, kick(0.3, 120, 50, 0.6), at, 0.5)
place(sfx, riser(1.0, 180, 3200), 26.0, 1.2)

# H. 엔드: 임팩트 + 밝은 마무리 화음 + 종소리, 32초 전에 완전히 사라짐
place(sfx, impact(1.3), 27.0, 1.0)
place(music, pad_chord(['C3', 'G3', 'C4', 'E4', 'G4', 'D5'], 4.4, att=0.05, rel=1.4), 27.0, 1.6)
# I. 만든 사람: 잔잔한 화음과 종소리로 마무리
place(music, pad_chord(['F3', 'A3', 'C4', 'E4', 'G4'], 4.2, att=0.6, rel=2.6), 30.9, 1.4)
place(music, bass_note('F1', 2.5) * np.exp(-t_arr(2.5) / 1.0), 31.0, 0.8)
for i, nm in enumerate(['A5', 'C6', 'E6', 'G6']):
    place(sfx, bell(note_hz(nm), 2.6), 31.3 + i * 0.16, 0.38 - i * 0.05)
place(sfx, whoosh(0.5, 600, 7000), 30.8, 0.4)
place(music, bass_note('C1', 3.0) * np.exp(-t_arr(3.0) / 1.2), 27.0, 1.2)
for i, nm in enumerate(['C6', 'E6', 'G6', 'C7', 'D7']):
    place(sfx, bell(note_hz(nm), 2.4), 27.35 + i * 0.12, 0.55 - i * 0.06)


# ---------- 믹스 ----------
def reverb(x, sec=2.2, decay=0.55, mix=0.22):
    n = int(sec * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (decay * SR))
    ir = fft_filter(ir, lo=200, hi=7000)
    ir /= np.sqrt(np.sum(ir ** 2))
    L = 1 << int(np.ceil(np.log2(len(x) + n)))
    wet = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[: len(x)]
    return x + wet * mix


music *= duck
mix = music * 0.9 + drums * 0.75 + sfx * 0.85
mono = reverb(mix)

# 간단한 스테레오 폭: 잔향을 좌우로 살짝 다르게
side = reverb(sfx * 0.5 + music * 0.4, sec=1.6, decay=0.4, mix=1.0) - (sfx * 0.5 + music * 0.4)
left = mono + 0.18 * side
right = mono - 0.18 * side

# 루프 경계 정리 + 마스터
fade_out = np.ones(N)
fo = int(0.6 * SR)
fade_out[N - fo :] = np.linspace(1, 0, fo)
st = np.stack([left, right], axis=1) * fade_out[:, None]
st = np.tanh(st / np.max(np.abs(st)) * 1.15)
st = st / np.max(np.abs(st)) * 0.89  # 약 -1 dBFS

out = sys.argv[1] if len(sys.argv) > 1 else 'motion-sound.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print('wrote', out)
