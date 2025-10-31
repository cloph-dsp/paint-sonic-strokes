# Paint Sonic Strokes

Paint Sonic Strokes is an interactive granular-synthesis playground where drawing gestures transform into evolving audio textures. Sketch on the canvas, sculpt grains with color-coded effects, and capture the results as studio-friendly WAV files.

The app icon now reflects this idea with a pulsing gradient waveform tucked inside a dark tile. You can find the source at `public/favicon.svg` if you want to tweak the palette or geometry.

## Features

- Granular engine powered by Web Audio API, including reverse-grain playback and tempo-synced delay.
- Pressure-sensitive style controls that map stroke motion to density, pitch, and spatial effects.
- Keyboard shortcuts for fast color switching, brush sizing, undo, clear, and recording toggles.
- AudioWorklet-based recorder that exports high-quality WAV captures of your performance.
- Live analyser visualizer plus grid overlay to help line up musical gestures.

## Getting Started

```sh
git clone <repo-url>
cd paint-sonic-strokes
npm install
npm run dev
```

The development server runs on Vite. Once it boots, open the printed URL (typically http://localhost:5173) and load an audio file or drag one directly onto the canvas.

## Available Scripts

- `npm run dev` – start the local dev server with hot reload.
- `npm run build` – produce the optimized production bundle.
- `npm run preview` – serve the production build locally for smoke tests.
- `npm run lint` – lint the project with the shared ESLint configuration.

## Audio & Browser Notes

- AudioWorklets are required for low-latency recording. Safari 16.4+ and all modern Chromium/Firefox builds are supported.
- Some mobile browsers suspend audio contexts until the user taps; the app prompts you to interact if initialization fails.
- If you need a fallback for worklet-free environments, start in free-play mode and skip the record feature.

## Project Structure

```
src/
	components/     # UI building blocks and audio visualizers
	pages/          # Top-level routed views
	hooks/          # Shared React hooks
	lib/            # Utility helpers
public/
	favicon.svg     # Gradient waveform app icon
	recorder-worklet.js
```

## Contributing

Issues and pull requests are welcome! If you add new audio capabilities, consider updating the README and the icon so visual cues stay in sync with the sonic experience.
