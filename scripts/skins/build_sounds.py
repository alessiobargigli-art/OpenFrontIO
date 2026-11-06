"""Render original skin SFX. Requires Python/numpy and ffmpeg, only at authoring time.

No samples, voices or melodies from franchise media are used. Every sound is
synthesized from deterministic oscillators/noise. Runtime needs only the MP3s.
Run from any directory: python scripts/skins/build_sounds.py
"""

from pathlib import Path
import hashlib
import json
import subprocess

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
RATE = 44100
THEMES = ('flower-power', 'warcraft', 'ff7-mako', 'dragonball')
# Duration, base frequency, synthesis gesture. Different cues within each pack
# retain related timbres without using one identical sound for every action.
CUES = {
    'atom-launch': (0.72, 220, 'launch'),
    'hydrogen-launch': (1.12, 140, 'launch'),
    'mirv-launch': (0.90, 280, 'volley'),
    'atom-hit': (0.78, 110, 'impact'),
    'hydrogen-hit': (1.35, 65, 'impact'),
    'build-city': (0.70, 392, 'build'),
    'build-port': (0.65, 294, 'build'),
    'build-defense-post': (0.55, 330, 'build'),
    'build-warship': (0.78, 196, 'build'),
    'sam-built': (0.62, 440, 'build'),
    'silo-built': (0.70, 247, 'build'),
    'build-factory': (0.68, 262, 'build'),
    'build-train-station': (0.72, 349, 'train'),
    'transport-ship': (0.68, 175, 'travel'),
}


def oscillator(theme, frequency, t, glide=0):
    phase = 2 * np.pi * frequency * (t + glide * t * t)
    if theme == 'flower-power':
        return (np.sin(phase) + 0.34 * np.sin(2.76 * phase)
                + 0.12 * np.sin(4.1 * phase))
    if theme == 'warcraft':
        return sum(np.sin(k * phase) / k ** 1.4 for k in (1, 2, 3, 5, 7))
    if theme == 'ff7-mako':
        return (np.sin(phase + 1.8 * np.sin(1.53 * phase))
                + 0.27 * np.sin(3.02 * phase))
    return (np.sin(phase + 1.1 * np.sin(0.5 * phase))
            + 0.32 * np.sin(2 * phase) + 0.17 * np.sin(3 * phase))


def render(theme, name):
    duration, frequency, gesture = CUES[name]
    count = round(duration * RATE)
    t = np.arange(count) / RATE
    seed = int.from_bytes(hashlib.sha256(f'{theme}/{name}'.encode()).digest()[:8])
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal(count)
    # Smooth noise prevents a brittle all-treble hiss on phone speakers.
    soft_noise = np.convolve(noise, np.ones(9) / 9, mode='same')
    signal = np.zeros(count)
    if gesture in ('build', 'train'):
        intervals = {
            'flower-power': (1, 1.25, 1.5, 2),
            'warcraft': (1, 1.5, 2),
            'ff7-mako': (1, 1.1892, 1.4983, 2),
            'dragonball': (1, 1.3348, 2),
        }[theme]
        for i, ratio in enumerate(intervals):
            start = round(i * duration * 0.15 * RATE)
            local = t[:count-start]
            env = (1 - np.exp(-local * 180)) * np.exp(-local * 10)
            signal[start:] += oscillator(theme, frequency * ratio, local) * env
        if theme == 'warcraft':
            signal += 0.55 * soft_noise * np.exp(-t * 20)
        if gesture == 'train':
            signal += 0.16 * np.sin(2*np.pi*55*t) * (np.sin(2*np.pi*12*t)>0)
    elif gesture == 'impact':
        low = np.sin(2*np.pi*(frequency*t + 13*(1-np.exp(-t*18))))
        signal = (low * np.exp(-t*7) + soft_noise * np.exp(-t*5))
        if theme == 'flower-power':
            signal = 0.25*signal + oscillator(theme, frequency*4, t, -0.18)*np.exp(-t*6)
        elif theme == 'warcraft':
            signal += 0.45*oscillator(theme, frequency*1.5, t)*np.exp(-t*9)
        elif theme == 'ff7-mako':
            signal += oscillator(theme, frequency*3, t, -0.22)*np.exp(-t*6)
        else:
            signal += oscillator(theme, frequency*5, t, -0.28)*np.exp(-t*7)
    else:
        glide = {'flower-power': 0.9, 'warcraft': -0.22,
                 'ff7-mako': 1.4, 'dragonball': 2.8}[theme]
        env = (1-np.exp(-t*30))*np.exp(-t*2.5)
        signal = oscillator(theme, frequency, t, glide)*env
        if theme in ('dragonball', 'ff7-mako'):
            signal += soft_noise*(0.6 if theme == 'dragonball' else 0.3)*env
        if theme == 'flower-power':
            signal += 0.5*np.sin(2*np.pi*frequency*2*t)*np.exp(-t*7)
        if gesture == 'volley':
            signal *= 0.3 + 0.7*np.sin(np.pi*t*7)**8
        elif gesture == 'travel':
            signal *= 0.7 + 0.3*np.sin(2*np.pi*t*9)
    # Fade both ends; conservative RMS and peak keep the mixer headroom intact.
    signal *= np.minimum(t/0.012, 1)*np.minimum((duration-t)/0.08, 1)
    rms = np.sqrt(np.mean(signal**2))
    signal *= min(0.13/max(rms, 1e-9), 0.65/max(abs(signal).max(), 1e-9))
    return signal.astype('<f4')


def encode(path, samples):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', 'pipe:0',
        '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '96k', str(path),
    ], input=samples.tobytes(), check=True)


def main():
    preview = []
    timeline = []
    offset = 0
    for theme in THEMES:
        sounds = {name: render(theme, name) for name in CUES}
        for name, samples in sounds.items():
            encode(ROOT/f'resources/sounds/skins/{theme}/{name}.mp3', samples)
        timeline.append({'skin': theme, 'startSeconds': round(offset, 2)})
        for name in ('build-city', 'atom-launch', 'hydrogen-hit'):
            preview.extend((sounds[name], np.zeros(round(0.35*RATE), dtype='<f4')))
            offset += len(sounds[name])/RATE + 0.35
        preview.append(np.zeros(round(0.7*RATE), dtype='<f4'))
        offset += 0.7
    encode(ROOT/'docs/skin-sounds-preview.mp3', np.concatenate(preview))
    manifest = {'authoring': 'Original procedural synthesis; no sampled franchise audio.',
                'sampleRate': RATE, 'encoding': 'MP3 mono 96 kbps',
                'themes': list(THEMES), 'cues': list(CUES), 'previewTimeline': timeline}
    (ROOT/'resources/sounds/skins/manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(f'Rendered {len(THEMES)*len(CUES)} effects and {offset:.2f}s preview')


if __name__ == '__main__':
    main()
