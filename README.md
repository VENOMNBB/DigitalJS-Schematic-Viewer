# DigitalJS Schematic Viewer for VSCode

A VSCode extension that synthesises your Verilog / SystemVerilog files using the [DigitalJS](https://digitaljs.tilk.eu) server and renders the full interactive circuit simulator **directly inside a VSCode panel**.

## Why this exists

The published [DigitalJS VSCode extension](https://marketplace.visualstudio.com/items?itemName=yuyichao.digitaljs) bundles an old, frozen version of `yosys2digitaljs` that fails on many modern constructs. The online version at [digitaljs.tilk.eu](https://digitaljs.tilk.eu) is actively maintained and handles these correctly.

This extension uses the **live server-side synthesis API** from digitaljs.tilk.eu — so it stays up to date automatically — while rendering the circuit using the DigitalJS JavaScript library locally inside a VSCode webview. You get the full simulator experience without ever leaving your editor.

## Features

- **One-command workflow** — Click the **DigitalJS** icon in the top right corner of the editor window or right-click any `.v` / `.sv` file → **Open in DigitalJS**.
- **Full circuit simulation** inside VSCode with Start / Pause / Fast-forward / Step controls.
- **Live tick counter** updates in real time while simulation runs.
- **Waveform monitor panel** with per-signal traces, zoom (+/−), scroll (◀ ▶), Live mode, and a live range display.
- **Mouse-wheel zoom** on the circuit diagram, centered on cursor.
- **Auto-fit** on load — circuit scales to fill the available panel space (*still a bit buggy*).
- **Draggable resize handle** between the circuit and waveform panels.
- **Singleton panel** — re-running the command on a new file reloads the same panel, no duplicates.
- **No bundled binaries** — synthesis runs on the DigitalJS server, rendering uses CDN-loaded libraries

## Requirements

- VSCode 1.60 or later
- Internet connection (synthesis API + CDN libraries)

## Installation

### From the `.vsix` file (Recommended)

1. Download `.vsix` file from the [Releases](https://github.com/VENOMNBB/DigitalJS-Schematic-Viewer/releases) page
2. In VSCode: `Ctrl+Shift+P` → **Extensions: Install from VSIX…** → select the file

### Build from source

```bash
git clone https://github.com/VENOMNBB/DigitalJS-Schematic-Viewer.git
cd DigitalJS-Schematic-Viewer
npm install -g @vscode/vsce
vsce package
code --install-extension digitaljs-schematic-viewer-x.x.x
```

*For the `npm install -g @vscode/vsce` command to work you need to install Node.js.*

## Usage

1. Open a `.v` or `.sv` file in the editor
2. Click the **DigitalJS** icon in the top right corner of the editor window. (Alternatively: Right-click in the **editor** or **Explorer** → **Open in DigitalJS**
   — or `Ctrl+Shift+P` → **DigitalJS: Open in DigitalJS**).
3. Open the DigitalJS Activity Bar (circuit board icon on the far left) to tweak Synthesis parameters.
4. The extension POSTs your file to the DigitalJS synthesis API
5. The synthesised circuit appears in a panel beside your editor
6. Use the toolbar to **Start**, **Pause**, **Step**, or **Fast-forward** the simulation
7. Hover over wires in the circuit to add signals to the waveform monitor

## Work in Progress (UI Stubs)

There are a few options visible in the sidebar parameters panel that are currently placeholders mapped out for future updates:

- **WebAssembly Synthesis Mode:** Selecting "WebAssembly (faster and local)" will currently still default to the Server Side API. Local WASM integration (via YoWASP) is planned but not yet implemented.

- **Simulation Engine / Delay:** The options for "Zero combinational propagation delay" and switching "Simulation engines" are visible in the UI but are not currently passed into the active JointJS/DigitalJS rendering engine.

## Toolbar reference

| Button | Action |
|--------|--------|
| ▶ | Start simulation |
| ⏸ | Pause simulation |
| ⏩ | Fast-forward (100 gate updates, no re-render) |
| → | Single step |
| `N` (tick counter) | Current simulation tick |
| − / + | Zoom circuit out / in |
| ⊡ | Fit circuit to panel |

**Waveform toolbar:**

| Control | Action |
|---------|--------|
| + / − | Zoom waveform in / out |
| `scale N` | Current pixels-per-tick |
| ◀ / ▶ | Scroll waveform left / right |
| Live | Jump to live (latest tick) |
| `range X – Y` | Currently visible tick range |

## How it works

```
VSCode extension host (Node.js)
  └─ HTTPS POST → digitaljs.tilk.eu/api/yosys2digitaljs
       └─ receives circuit JSON
            └─ postMessage → Webview
                 └─ new digitaljs.Circuit(json)   ← CDN library, runs locally
                 └─ circuit.displayOn($('#paper')) ← JointJS diagram
                 └─ new digitaljs.MonitorView(…)  ← waveform panel
```

Synthesis runs server-side (Yosys + yosys2digitaljs on the DigitalJS server). Everything else — rendering, simulation, interaction — runs locally in the VSCode webview using the DigitalJS npm package loaded from jsDelivr CDN. No binaries are bundled.

## Known limitations

- Requires an internet connection for both synthesis and CDN libraries
- Synthesis is subject to the DigitalJS server's availability and supported constructs
- Very large designs may be slow to render (JointJS lays out all gates in the browser)

## Credits

- [DigitalJS](https://github.com/tilk/digitaljs) by Marek Materzok (tilk) — the circuit simulator
- [yosys2digitaljs](https://github.com/tilk/yosys2digitaljs) — the synthesis backend
- [Yosys](https://github.com/YosysHQ/yosys) — the open-source synthesis framework powering it all

## License

MIT — see [LICENSE](LICENSE)
