# DigitalJS Schematic Viewer for VSCode

A VSCode extension that synthesises your Verilog / SystemVerilog files and renders the full interactive circuit simulator **directly inside a VSCode panel**.

Synthesis can run either via the **DigitalJS online API** or fully **offline using local WebAssembly** (YoWASP + Yosys bundled in the extension).

## Why this exists

The published [DigitalJS VSCode extension](https://marketplace.visualstudio.com/items?itemName=yuyichao.digitaljs) bundles an old, frozen version of `yosys2digitaljs` that fails on many modern constructs. The online version at [digitaljs.tilk.eu](https://digitaljs.tilk.eu) is actively maintained and handles these correctly.

This extension supports two synthesis backends:
- **Server-side API** — POSTs to digitaljs.tilk.eu; stays up to date automatically.
- **Local WebAssembly** — runs Yosys entirely inside a Node.js Worker thread via [@yowasp/yosys](https://github.com/YoWASP/yosys); no internet required for synthesis.

In both cases, rendering and simulation run locally in the VSCode webview using the DigitalJS library loaded from jsDelivr CDN.

## Features

- **Two-button workflow** — Click the **DigitalJS** icon in the top right corner of the editor window to synthesise the active `.v` / `.sv` file immediately using default settings. Use the **DigitalJS** icon in the Activity Bar (or right-click → **Open in DigitalJS**) to open the **Parameters** sidebar first and tweak synthesis/simulation options before running.
- **Two synthesis modes** — choose between Server Side (online) and WebAssembly (local, offline) in the Parameters sidebar.
- **Input Controls panel** — a dedicated bar above the schematic for driving circuit inputs live during simulation:
  - Single-bit inputs (`rst`, `en`, …) get compact toggle switches.
  - Multi-bit inputs get an editable value box.
  - Outputs get a status lamp.
  - Clock signals get a `[value][▲▼]` stepper to adjust their period in ticks, plus the standard step buttons below for precise manual ticking.
  - A synthesis status indicator (circular lamp + label) sits at the start of the bar, separated from the **Input Controls** label by a divider.
  - The whole panel can be hidden/shown with the arrow next to the **Input Controls** label.
- **Full circuit simulation** inside VSCode with Start / Pause / Step (1 / 10 / 100 / 1000 ticks) controls.
- **Live tick counter** updates in real time while simulation runs.
- **Waveform monitor panel** with per-signal traces, zoom (+/−), scroll (◀ ▶), Live mode, and a live range display.
- **Mouse-wheel zoom** on the circuit diagram, centered on cursor.
- **Auto-fit** on load — circuit scales to fill the available panel space (*still a bit buggy*).
- **Draggable resize handle** between the circuit and waveform panels.
- **Singleton panel** — re-running synthesis on a new file reloads the same panel, no duplicates.

## Requirements

- VSCode 1.60 or later
- Internet connection required for **Server Side synthesis** mode
- No internet required for **WebAssembly synthesis** mode (Yosys WASM is bundled in the extension)

## Installation

### From the `.vsix` file (Recommended)

1. Download `.vsix` file from the [Releases](https://github.com/VENOMNBB/DigitalJS-Schematic-Viewer/releases) page
2. In VSCode: `Ctrl+Shift+P` → **Extensions: Install from VSIX…** → select the file

### Build from source

```bash
git clone https://github.com/VENOMNBB/DigitalJS-Schematic-Viewer.git
cd DigitalJS-Schematic-Viewer
npm install
npm install -g @vscode/vsce
vsce package
code --install-extension digitaljs-schematic-viewer-x.x.x.vsix
```

## Usage

There are two ways to run synthesis:

**Quick synthesis (defaults)**
1. Open a `.v` or `.sv` file in the editor.
2. Click the **DigitalJS** icon in the top right corner of the editor window.
3. The file is synthesised immediately with default settings — no extra panel opens, your focus stays in the editor.

**Synthesis with custom parameters**
1. Open a `.v` or `.sv` file in the editor.
2. Click the **DigitalJS** icon in the Activity Bar (left-hand side), or right-click in the **editor** or **Explorer** → **Open in DigitalJS**, or `Ctrl+Shift+P` → **DigitalJS: Open in DigitalJS**.
3. This opens the **Parameters** sidebar without synthesising yet. Adjust synthesis/simulation options as needed.
4. Click **Synthesize Circuit** in the sidebar to run.

In both cases:

5. The synthesised circuit appears in a panel beside your editor, with the **Input Controls** bar populated for any top-level inputs/clocks in the design.
6. Use the toolbar to **Start**, **Pause**, or **Step** the simulation (1 / 10 / 100 / 1000 ticks at a time).
7. Drive inputs directly from the **Input Controls** bar — switch toggles, edit multi-bit values, or adjust a clock's period — while the simulation runs.
8. Hover over wires in the circuit to add signals to the waveform monitor.

## Synthesis modes

| Mode | Internet required | Speed | Notes |
|------|------------------|-------|-------|
| Server Side | Yes (synthesis + CDN) | Fast | Uses digitaljs.tilk.eu API; supports the widest range of constructs |
| WebAssembly | CDN only | Slower on first use (WASM init) | Runs Yosys locally via [@yowasp/yosys](https://github.com/YoWASP/yosys); fully offline synthesis |

The default quick-synthesis button always uses **Server Side** mode. To use WebAssembly mode, open the Parameters sidebar and select **WebAssembly (local)** from the Synthesis mode dropdown before clicking **Synthesize Circuit**.

On first use, WebAssembly mode downloads and caches the Yosys WASM binary (~50 MB). Subsequent runs are faster.

## Work in Progress

- **Simulation Engine / Delay:** The options for "Zero combinational propagation delay" and switching "Simulation engines" are visible in the UI but are not currently passed into the active JointJS/DigitalJS rendering engine.

## Toolbar reference

| Button | Action |
|--------|--------|
| ▶ / ⏸ | Start simulation / Pause simulation (single toggle button) |
| ▶ 1 | Step 1 tick |
| ▶ 10 | Step 10 ticks |
| ▶ 100 | Step 100 ticks |
| ▶ 1000 | Step 1000 ticks |
| `N` (tick counter) | Current simulation tick |
| − / + | Zoom circuit out / in |
| ⊡ | Fit circuit to panel |

**Input Controls panel:**

| Control | Action |
|---------|--------|
| Circular lamp + label (start of bar) | Synthesis status: grey/yellow = synthesising, green = ready, red = error |
| ◀ / ▶ (next to panel title) | Collapse / expand the Input Controls bar |
| Toggle switch | Drive a single-bit input high/low |
| Value box | Edit a multi-bit input's value (decimal by default) |
| Lamp | Read-only indicator for an output signal |
| `[value][▲▼]` (clock rows) | Set the clock's period in ticks |

**Waveform toolbar:**

| Control | Action |
|---------|--------|
| + / − | Zoom waveform in / out |
| `scale N` | Current pixels-per-tick |
| ◀ / ▶ | Scroll waveform left / right |
| Live | Jump to live (latest tick) |
| `range X – Y` | Currently visible tick range |

## How it works

**Server Side mode:**
```
VSCode extension host (Node.js)
  └─ HTTPS POST → digitaljs.tilk.eu/api/yosys2digitaljs
       └─ receives circuit JSON
            └─ postMessage → Webview
                 └─ new digitaljs.Circuit(json)   ← CDN library, runs locally
                 └─ circuit.displayOn($('#paper')) ← JointJS diagram
                 └─ new digitaljs.MonitorView(…)  ← waveform panel
```

**WebAssembly mode:**
```
VSCode extension host (Node.js)
  └─ spawns Worker thread (wasm-worker.mjs, ESM)
       └─ @yowasp/yosys → runs Yosys WASM locally
       └─ yosys2digitaljs/core → converts netlist to circuit JSON
            └─ postMessage → extension host
                 └─ postMessage → Webview
                      └─ new digitaljs.Circuit(json)   ← CDN library, runs locally
                      └─ circuit.displayOn($('#paper')) ← JointJS diagram
                      └─ new digitaljs.MonitorView(…)  ← waveform panel
```

The Worker thread is necessary because `@yowasp/yosys` is an ESM-only package that uses `import.meta.url` internally to locate its `.wasm` binaries — this only works in an ESM context, not in the CJS extension host.

## Known limitations

- CDN libraries (rendering/simulation) always require an internet connection
- Very large designs may be slow to render (JointJS lays out all gates in the browser)
- WebAssembly mode has a ~50 MB one-time WASM download on first use
- WebAssembly mode uses `hierarchy -auto-top; proc; opt` internally, which may produce slightly different results than the server-side synthesis pipeline for complex designs

## Credits

- [DigitalJS](https://github.com/tilk/digitaljs) by Marek Materzok (tilk) — the circuit simulator
- [yosys2digitaljs](https://github.com/tilk/yosys2digitaljs) — the synthesis backend
- [Yosys](https://github.com/YosysHQ/yosys) — the open-source synthesis framework powering it all
- [YoWASP](https://yowasp.org/) — WebAssembly port of Yosys enabling local synthesis

## License

MIT — see [LICENSE](LICENSE)
