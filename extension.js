const vscode = require('vscode');
const https  = require('https');

let currentPanel = undefined;

function synthesise(fileName, source, settings) {
  const body = JSON.stringify({
    files:   { [fileName]: source },
    options: { 
      optimize: settings.optimize,
      simplify: settings.simplify,
      fsm: settings.fsm,
      logicGates: settings.logicGates,
      logicGateType: settings.logicGateType
    }
  });
  return new Promise((resolve, reject) => {
    const req = https.request('https://digitaljs.tilk.eu/api/yosys2digitaljs', {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Origin':  'https://digitaljs.tilk.eu',
        'Referer': 'https://digitaljs.tilk.eu/'
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Bad JSON from synthesis API')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getWebviewHtml() {
  const CDN = 'https://cdn.jsdelivr.net/npm';

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src  'unsafe-inline' https://cdn.jsdelivr.net;
                 script-src 'unsafe-inline' https://cdn.jsdelivr.net;
                 img-src    'self' data: blob:;
                 font-src   https://cdn.jsdelivr.net;
                 connect-src 'none';">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="${CDN}/digitaljs@0.14.2/dist/main.css">
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    html, body {
      margin: 0; padding: 0;
      width: 100%; height: 100vh;
      overflow: hidden;
      background: #fff;
      color: #222;
      font-family: sans-serif;
      font-size: 13px;
      display: flex;
      flex-direction: column;
    }

    /* ── toolbar ── */
    #toolbar {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: #2c2c2c;
      border-bottom: 1px solid #444;
      user-select: none;
    }

    .tbtn {
      display: flex; align-items: center; justify-content: center;
      min-width: 32px; height: 28px; padding: 0 8px;
      background: #3a3a3a; color: #eee;
      border: 1px solid #555; border-radius: 4px;
      font-size: 13px; line-height: 1; cursor: pointer;
      transition: background 0.1s;
    }
    .tbtn .btn-label {
      display: inline-flex; align-items: center; gap: 5px;
    }

    /* Pure-CSS shapes: font glyphs render with inconsistent internal
       padding across platforms, which makes them look off-center inside
       a button box no matter how much text-nudging is applied. Drawing
       the icon as geometry sidesteps that entirely. */
    .icon-play {
      display: inline-block;
      width: 0; height: 0;
      border-top: 6px solid transparent;
      border-bottom: 6px solid transparent;
      border-left: 9px solid currentColor;
    }
    .icon-pause {
      display: inline-flex; align-items: center; gap: 3px;
    }
    .icon-pause::before, .icon-pause::after {
      content: '';
      display: inline-block;
      width: 4px; height: 12px;
      background: currentColor;
    }
    .icon-collapse-left {
      display: inline-block;
      width: 0; height: 0;
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
      border-right: 7px solid currentColor;
    }
    .icon-collapse-right {
      display: inline-block;
      width: 0; height: 0;
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
      border-left: 7px solid currentColor;
    }
    .tbtn:hover:not(:disabled) { background: #ffffff; }
    .tbtn:disabled { opacity: 0.35; cursor: default; }
    .tbtn.active { background: #34afff; border-color: #34afff; }
    .tbtn.step1 { border-color: #34afff; color: #34afff; }
    .tbtn.step1:hover:not(:disabled) { background: #34afff; color: #1e1e1e; }
    .tbtn.step10 { border-color: #34afff; color: #34afff; }
    .tbtn.step10:hover:not(:disabled) { background: #34afff; color: #1e1e1e; }
    .tbtn.step100 { border-color: #34afff; color: #34afff; }
    .tbtn.step100:hover:not(:disabled) { background: #34afff; color: #1e1e1e; }
    .tbtn.step1000 { border-color: #34afff; color: #34afff; }
    .tbtn.step1000:hover:not(:disabled) { background: #34afff; color: #1e1e1e; }

    #tick-counter {
      background: #1e1e1e; color: #9cdcfe;
      border: 1px solid #555; border-radius: 4px;
      padding: 2px 8px; font-family: monospace; font-size: 12px;
      min-width: 60px; text-align: center;
    }

    #toolbar-status {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: #fff;
      white-space: nowrap;
      padding-right: 12px;
      margin-right: 4px;
      border-right: 1px solid #555;
    }
    #status-text { overflow: hidden; text-overflow: ellipsis; }
    #status-dot {
      flex: 0 0 auto;
      width: 10px; height: 10px;
      border-radius: 50%;
      background: #555;
      box-shadow: none;
      transition: background-color 0.2s, box-shadow 0.2s;
    }
    #status-dot.ok      { background: #209d05; box-shadow: 0 0 5px 1px #209d05; }
    #status-dot.loading { background: #f2d349; box-shadow: 0 0 5px 1px #f2d349; }
    #status-dot.error   { background: #fe0a0a; box-shadow: 0 0 5px 1px #fe0a0a; }

    #file-label {
      margin-left: 8px; color: #aaa; font-size: 11px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 200px;
    }

    /* ── input control panel (single row) ── */
    #io-panel-wrap {
      flex: 0 0 auto;
      display: flex;
      flex-direction: row;
      align-items: center;
      background: #2c2c2c;
      border-bottom: 1px solid #444;
      padding: 4px 8px;
      gap: 8px;
      height: 42px;
      box-sizing: border-box;
      overflow-x: auto;
      overflow-y: hidden;
    }
    #io-panel-header {
      flex: 0 0 auto;
      display: flex; align-items: center; gap: 6px;
    }
    #io-panel-title { color: #ccc; font-size: 12px; font-weight: 400; white-space: nowrap; }
    #btnIoCollapse {
      display: flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; padding: 0;
      background: #3a3a3a; color: #34afff;
      border: 1px solid #34afff; border-radius: 4px;
      cursor: pointer;
      transition: background 0.1s;
    }
    #btnIoCollapse:hover { background: #34afff; color: #1e1e1e; }
    #io-panel-body {
      display: flex; flex-wrap: nowrap; align-items: center;
      justify-content: flex-start;
      gap: 4px;
      overflow: visible;
    }
    #io-panel-body.collapsed { display: none; }
    #io-panel-empty { color: #888; font-size: 12px; white-space: nowrap; }
    #io-panel-empty.hidden { display: none; }
    #io-panel, #io-clock-panel {
      display: contents;
    }
    #io-panel form, #io-panel form > [data-iopanel] {
      display: contents;
    }
    .io-row {
      display: flex; align-items: center; gap: 8px;
      background: #2d2d2d; border: 1px solid #444; border-radius: 4px;
      padding: 3px 6px;
      box-sizing: border-box;
    }
    .io-row > * {
      display: flex; align-items: center;
    }
    .io-row > span:empty { display: none; }
    .io-row label {
      color: #ddd; font-size: 11px; font-family: monospace;
      line-height: 1; min-width: 0; white-space: nowrap;
    }
    .io-row select {
      background: #1e1e1e; color: #eee;
      border: 1px solid #555; border-radius: 3px;
      font-size: 10px; padding: 1px 2px;
    }
    .io-row input[type="text"] {
      background: #1e1e1e; color: #9cdcfe;
      border: 1px solid #555; border-radius: 3px;
      font-family: monospace; font-size: 11px;
      padding: 2px 4px; width: 58px;
    }
    .io-row input[type="number"] {
      background: #1e1e1e; color: #eee;
      border: 1px solid #555; border-radius: 3px 0 0 3px;
      border-right: none;
      font-size: 11px; padding: 2px 4px; width: 36px;
      text-align: center;
      -moz-appearance: textfield;
    }
    .io-row input[type="number"]::-webkit-outer-spin-button,
    .io-row input[type="number"]::-webkit-inner-spin-button {
      -webkit-appearance: none; margin: 0;
    }
    .io-stepper {
      display: flex; align-items: stretch;
    }
    .io-stepper-arrows {
      display: flex; flex-direction: column;
      border: 1px solid #555; border-radius: 0 3px 3px 0;
      overflow: hidden;
    }
    .io-stepper-btn {
      display: flex; align-items: center; justify-content: center;
      width: 16px; height: 11px; padding: 0;
      background: #3a3a3a; color: #eee;
      border: none; line-height: 1; cursor: pointer;
      font-size: 7px;
      transition: background 0.1s;
    }
    .io-stepper-btn + .io-stepper-btn { border-top: 1px solid #555; }
    .io-stepper-btn:hover:not(:disabled) { background: #ffffff; }
    .io-stepper-btn:disabled { opacity: 0.35; cursor: default; }
    .io-toggle { display: inline-flex; align-items: center; cursor: pointer; }
    .io-toggle input { display: none; }
    .io-toggle-track {
      display: block;
      width: 28px; height: 16px; background: #555;
      border: 1px solid #777; border-radius: 8px;
      position: relative; transition: background 0.15s;
    }
    .io-toggle-thumb {
      position: absolute; top: 1px; left: 1px;
      width: 12px; height: 12px; background: #ccc;
      border-radius: 50%; transition: left 0.15s;
    }
    .io-toggle input:checked + .io-toggle-track { background: #005a9e; border-color: #007acc; }
    .io-toggle input:checked + .io-toggle-track .io-toggle-thumb { left: 14px; background: #fff; }

    .io-lamp { display: inline-flex; align-items: center; cursor: pointer; }
    .io-lamp input { display: none; }
    .io-lamp-dot {
      display: block;
      width: 22px; height: 12px; border-radius: 999px;
      background: #ff8c00; box-shadow: 0 0 4px 1px rgba(255,140,0,0.5);
      transition: background-color 0.2s, box-shadow 0.2s;
    }
    .io-lamp input:checked + .io-lamp-dot { background: #209d05; box-shadow: 0 0 6px 1px #209d05; }

    /* ── main area: circuit on top, monitor on bottom ── */
    #main {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }

    /* circuit paper takes remaining space above monitor */
    #paper-wrap {
      flex: 1 1 auto;
      overflow: auto;
      min-height: 0;
      background: #fff;
      position: relative;
    }

    #paper {
      min-width: 100%;
      min-height: 100%;
    }

    /* ── waveform / monitor panel ── */
    #monitor-wrap {
      flex: 0 0 auto;
      border-top: 2px solid #444;
      background: #ffffff;
      display: none;
      flex-direction: column;
      max-height: 220px;
      overflow: hidden;
    }
    #monitor-wrap.visible { display: flex; }

    #monitor-toolbar {
      flex: 0 0 auto;
      display: flex; align-items: center; gap: 4px;
      padding: 3px 8px;
      background: #2c2c2c;
      border-bottom: 1px solid #444;
    }
    #monitor-toolbar span { color: #aaa; font-size: 11px; margin-right: 4px; }

    #monitor {
      flex: 1 1 auto;
      overflow: auto;
      background: #ffffff;
    }
    #monitor svg text { fill: #ffffff !important; }
    #monitor svg line, #monitor svg path { stroke: #777; }
    #monitor, #monitor * { color: #ffffff; }

    #monitor .name,
    #monitor th,
    #monitor td,
    #monitor label,
    #monitor input,
    #monitor select,
    #monitor option {
      color: #222222 !important;
      background: transparent;
    }

    #monitor table button,
    #monitor button.delete,
    #monitor td > button {
      background-color: #f0ad4e !important;
      color: #000 !important;
      border: 1px solid #d48a1a !important;
      border-radius: 3px;
      padding: 1px 6px;
      font-size: 11px;
      cursor: pointer;
      line-height: 1.4;
    }
    #monitor table button:hover,
    #monitor td > button:hover {
      background-color: #ec971f !important;
    }

    /* ── resize handle between paper and monitor ── */
    #resize-handle {
      flex: 0 0 6px;
      background: #444;
      cursor: ns-resize;
      border-top: 1px solid #555;
      border-bottom: 1px solid #555;
      display: none;
    }
    #resize-handle.visible { display: block; }
  </style>
</head>
<body>

  <div id="toolbar">
    <button class="tbtn" id="btnPlayPause" title="Start simulation" disabled><span class="icon-play"></span></button>
    <button class="tbtn step1" id="btnStep"     title="Step 1"    disabled><span class="btn-label"><span class="icon-play"></span>1</span></button>
    <button class="tbtn step10" id="btnStep10"   title="Step 10"   disabled><span class="btn-label"><span class="icon-play"></span>10</span></button>
    <button class="tbtn step100" id="btnFast"     title="Step 100 (no render)" disabled><span class="btn-label"><span class="icon-play"></span>100</span></button>
    <button class="tbtn step1000" id="btnStep1000" title="Step 1000" disabled><span class="btn-label"><span class="icon-play"></span>1000</span></button>
    <div id="tick-counter">0</div>
    <span style="flex:1"></span>
    <button class="tbtn" id="btnZoomOut" title="Zoom out" disabled>−</button>
    <button class="tbtn" id="btnZoomIn"  title="Zoom in"  disabled>+</button>
    <button class="tbtn" id="btnFit"   title="Fit circuit to view" disabled>⊡</button>
    <span id="file-label">No file loaded</span>
  </div>

  <div id="io-panel-wrap">
    <div id="io-panel-header">
      <div id="toolbar-status">
        <span id="status-text">Waiting for synthesis…</span>
        <span id="status-dot" class="loading"></span>
      </div>
      <span id="io-panel-title">Input Controls</span>
      <button id="btnIoCollapse" title="Collapse/expand"><span class="icon-collapse-left"></span></button>
    </div>
    <div id="io-panel-body">
      <div id="io-panel-empty">No file loaded.</div>
      <div id="io-panel"></div>
      <div id="io-clock-panel"></div>
    </div>
  </div>

  <div id="main">
    <div id="paper-wrap">
      <div id="paper"></div>
    </div>

    <div id="resize-handle"></div>

    <div id="monitor-wrap">
      <div id="monitor-toolbar">
        <span>Waveform</span>
        <button class="tbtn" id="btnPptUp"    title="Zoom in">+</button>
        <button class="tbtn" id="btnPptDown"  title="Zoom out">−</button>
        <span id="scale-label" style="color:#aaa;font-size:11px;padding:0 4px;">scale <span id="scale-val">1</span></span>
        <button class="tbtn" id="btnWLeft"    title="Scroll left">◀</button>
        <button class="tbtn" id="btnWRight"   title="Scroll right">▶</button>
        <button class="tbtn" id="btnWLive"    title="Pause/resume live waveform">Live</button>
        <span id="range-label" style="color:#aaa;font-size:11px;padding:0 6px;">range <span id="range-start">0</span> – <span id="range-end">0</span></span>
      </div>
      <div id="monitor"></div>
    </div>
  </div>

  <script src="${CDN}/jquery@3.7.1/dist/jquery.min.js"></script>
  <script src="${CDN}/jointjs@3.7.7/dist/joint.min.js"></script>
  <script src="${CDN}/digitaljs@0.14.2/dist/main.js"></script>

  <script>
    const vscodeApi = acquireVsCodeApi();

    let circuit = null, monitor = null, monitorview = null, paper = null;
    let tickInterval = null;
    let ioPanelView = null;
    let currentFileName = null;

    const statusText = document.getElementById('status-text');
    const statusDot  = document.getElementById('status-dot');
    const tickEl     = document.getElementById('tick-counter');
    const fileLabel  = document.getElementById('file-label');
    const monWrap    = document.getElementById('monitor-wrap');
    const resizeH    = document.getElementById('resize-handle');

    const ioPanelBody   = document.getElementById('io-panel-body');
    const ioPanelEmpty  = document.getElementById('io-panel-empty');
    const ioClockPanel  = document.getElementById('io-clock-panel');
    const btnIoCollapse = document.getElementById('btnIoCollapse');

    btnIoCollapse.addEventListener('click', () => {
      const collapsed = ioPanelBody.classList.toggle('collapsed');
      btnIoCollapse.innerHTML = collapsed ? '<span class="icon-collapse-right"></span>' : '<span class="icon-collapse-left"></span>';
      btnIoCollapse.title = collapsed ? 'Expand input controls' : 'Collapse input controls';
    });

    const btnPlayPause = document.getElementById('btnPlayPause');
    const btnFast    = document.getElementById('btnFast');
    const btnStep    = document.getElementById('btnStep');
    const btnStep10  = document.getElementById('btnStep10');
    const btnStep1000 = document.getElementById('btnStep1000');
    const btnFit     = document.getElementById('btnFit');
    const btnZoomIn  = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnPptUp   = document.getElementById('btnPptUp');
    const btnPptDown = document.getElementById('btnPptDown');
    const btnWLeft   = document.getElementById('btnWLeft');
    const btnWRight  = document.getElementById('btnWRight');
    const btnWLive   = document.getElementById('btnWLive');

    function setStatus(msg, cls) {
      statusText.textContent = msg;
      statusDot.className    = cls || '';
    }

    function updateTick() {
      if (circuit) tickEl.textContent = circuit.tick ?? 0;
      updateRangeDisplay();
    }

    function startTickTimer() {
      if (tickInterval) clearInterval(tickInterval);
      tickInterval = setInterval(updateTick, 100);
    }
    function stopTickTimer() {
      if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
      updateTick();
    }

    function syncButtons() {
      if (!circuit) return;
      const running = circuit.running;
      btnPlayPause.disabled = false;
      btnPlayPause.innerHTML = running ? '<span class="icon-pause"></span>' : '<span class="icon-play"></span>';
      btnPlayPause.title = running ? 'Pause simulation' : 'Start simulation';
      btnFast .disabled = running;
      btnStep .disabled = running;
      btnStep10.disabled = running;
      btnStep1000.disabled = running;
      btnPlayPause.classList.toggle('active', running);
    }

    btnPlayPause.addEventListener('click', () => {
      if (!circuit) return;
      if (circuit.running) { circuit.stop(); stopTickTimer(); }
      else { circuit.start(); startTickTimer(); }
      syncButtons();
    });
    btnFast.addEventListener('click', () => {
      if (!circuit) return;
      for (let i = 0; i < 100; i++) circuit.updateGates();
      updateTick();
    });
    btnStep.addEventListener('click', () => { if (!circuit) return; circuit.updateGates(); updateTick(); });
    btnStep10.addEventListener('click', () => {
      if (!circuit) return;
      for (let i = 0; i < 10; i++) circuit.updateGates();
      updateTick();
    });
    btnStep1000.addEventListener('click', () => {
      if (!circuit) return;
      for (let i = 0; i < 1000; i++) circuit.updateGates();
      updateTick();
    });

    let currentScale = 1;
    const ZOOM_MIN = 0.1, ZOOM_MAX = 4, ZOOM_STEP = 1.2;

    function applyZoom(newScale, clientX, clientY) {
      if (!paper) return;
      newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newScale));
      const wrap = document.getElementById('paper-wrap');
      const rect = wrap.getBoundingClientRect();
      if (clientX === undefined) clientX = rect.left + rect.width / 2;
      if (clientY === undefined) clientY = rect.top + rect.height / 2;

      let localPoint;
      try { localPoint = paper.clientToLocalPoint({ x: clientX, y: clientY }); } catch (e) { localPoint = null; }

      currentScale = newScale;
      try { paper.scale(currentScale, currentScale); } catch(e) {}

      if (localPoint) {
        try {
          const newClientPoint = paper.localToClientPoint(localPoint);
          wrap.scrollLeft += (newClientPoint.x - clientX);
          wrap.scrollTop  += (newClientPoint.y - clientY);
        } catch (e) {}
      }
    }

    btnZoomIn.addEventListener('click', () => applyZoom(currentScale * ZOOM_STEP));
    btnZoomOut.addEventListener('click', () => applyZoom(currentScale / ZOOM_STEP));

    btnFit.addEventListener('click', () => {
      if (!paper) return;
      try {
        paper.scale(1, 1);
        paper.translate(0, 0);
        paper.scaleContentToFit({ padding: 20, minScale: ZOOM_MIN, maxScale: ZOOM_MAX });
        currentScale = paper.scale().sx;
      } catch(e) {}
    });

    document.getElementById('paper-wrap').addEventListener('wheel', (e) => {
      if (!paper) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      applyZoom(currentScale * factor, e.clientX, e.clientY);
    }, { passive: false });

    const scaleVal   = document.getElementById('scale-val');
    const rangeStart = document.getElementById('range-start');
    const rangeEnd   = document.getElementById('range-end');

    function updateRangeDisplay() {
      if (!monitorview) return;
      const ppt   = monitorview.pixelsPerTick || 1;
      const start = Math.round(monitorview.start || 0);
      const width = monitorview._width || 0;
      const end   = Math.round(start + width / ppt);
      scaleVal.textContent   = ppt >= 1 ? Math.round(ppt) : ('1/' + Math.round(1/ppt));
      rangeStart.textContent = start;
      rangeEnd.textContent   = end;
      btnWLive.textContent   = monitorview.live ? 'Live' : 'Paused';
      btnWLive.title         = monitorview.live ? 'Pause live waveform' : 'Resume live waveform';
      btnWLive.classList.toggle('active', monitorview.live);
    }

    btnPptUp  .addEventListener('click', () => { if (monitorview) { monitorview.pixelsPerTick *= 2; updateRangeDisplay(); } });
    btnPptDown.addEventListener('click', () => { if (monitorview) { monitorview.pixelsPerTick /= 2; updateRangeDisplay(); } });
    btnWLeft  .addEventListener('click', () => { if (monitorview) { monitorview.live = false; monitorview.start -= monitorview._width / monitorview.pixelsPerTick / 4; updateRangeDisplay(); } });
    btnWRight .addEventListener('click', () => { if (monitorview) { monitorview.live = false; monitorview.start += monitorview._width / monitorview.pixelsPerTick / 4; updateRangeDisplay(); } });
    btnWLive  .addEventListener('click', () => { if (monitorview) { monitorview.live = !monitorview.live; updateRangeDisplay(); } });

    // Ensure settings are respected during load
    let currentSettings = {};

    function isClockCell(cell) {
      return cell.get('type') === 'Clock';
    }

    function makeIoRow(labelText) {
      const row = document.createElement('div');
      row.className = 'io-row';
      const label = document.createElement('label');
      label.textContent = labelText;
      row.appendChild(label);
      return row;
    }

    function renderClockPanel() {
      ioClockPanel.innerHTML = '';
      if (!circuit) return;
      const clocks = circuit._graph.getElements().filter(isClockCell);
      for (const cell of clocks) {
        const name = cell.get('net') || cell.get('label') || cell.id;
        const row = makeIoRow(name + ' (clk)');

        const periodWrap = document.createElement('div');
        periodWrap.className = 'io-stepper';

        const period = document.createElement('input');
        period.type = 'number';
        period.min = 1;
        period.title = 'Clock period (ticks)';
        period.value = cell.get('propagation') || 100;
        period.addEventListener('change', () => {
          const v = Math.max(1, parseInt(period.value, 10) || 100);
          period.value = v;
          cell.set('propagation', v);
        });

        const periodArrows = document.createElement('div');
        periodArrows.className = 'io-stepper-arrows';

        const periodUp = document.createElement('button');
        periodUp.type = 'button';
        periodUp.className = 'io-stepper-btn';
        periodUp.textContent = '▲';
        periodUp.title = 'Increase period';

        const periodDown = document.createElement('button');
        periodDown.type = 'button';
        periodDown.className = 'io-stepper-btn';
        periodDown.textContent = '▼';
        periodDown.title = 'Decrease period';

        function stepPeriod(delta) {
          const v = Math.max(1, (parseInt(period.value, 10) || 100) + delta);
          period.value = v;
          cell.set('propagation', v);
        }
        periodUp.addEventListener('click', () => stepPeriod(1));
        periodDown.addEventListener('click', () => stepPeriod(-1));

        periodArrows.appendChild(periodUp);
        periodArrows.appendChild(periodDown);

        periodWrap.appendChild(period);
        periodWrap.appendChild(periodArrows);
        row.appendChild(periodWrap);

        ioClockPanel.appendChild(row);
      }
    }

    function refreshIoEmptyState() {
      const hasContent = ioPanelBody.querySelector('.io-row') !== null;
      ioPanelEmpty.classList.toggle('hidden', hasContent);
    }

    function buildIoPanel(fileName) {
      currentFileName = fileName;
      document.getElementById('io-panel').innerHTML = '';
      ioClockPanel.innerHTML = '';

      ioPanelView = new digitaljs.IOPanelView({
        model: circuit,
        el: $('#io-panel'),
        rowMarkup: '<div class="io-row"></div>',
        colMarkup: '<span></span>',
        labelMarkup: '<label></label>',
        buttonMarkup: '<label class="io-toggle"><input type="checkbox"><span class="io-toggle-track"><span class="io-toggle-thumb"></span></span></label>',
        lampMarkup: '<label class="io-lamp"><input type="checkbox" disabled><span class="io-lamp-dot"></span></label>',
        inputMarkup: '<input type="text">'
      });
      // Default multi-bit value boxes to unsigned decimal
      $('#io-panel select[name="base"]').each(function () {
        $(this).val('dec').trigger('input');
      });

      renderClockPanel();

      refreshIoEmptyState();
    }

    function loadCircuit(json, fileName, settings) {
      if (tickInterval) clearInterval(tickInterval);
      if (monitorview)  { try { monitorview.shutdown(); } catch(e){} monitorview = null; }
      if (circuit)      { try { circuit.stop(); } catch(e){} circuit = null; }
      document.getElementById('paper').innerHTML   = '';
      document.getElementById('monitor').innerHTML = '';
      monWrap.classList.remove('visible');
      resizeH.classList.remove('visible');
      tickEl.textContent = '0';
      currentSettings = settings;

      try {
        circuit = new digitaljs.Circuit(json);
        monitor     = new digitaljs.Monitor(circuit);
        monitorview = new digitaljs.MonitorView({ model: monitor, el: $('#monitor') });
        buildIoPanel(fileName);

        circuit.on('changeRunning', () => {
          if (circuit.running) { startTickTimer(); } else { stopTickTimer(); }
          syncButtons();
        });

        paper = circuit.displayOn($('#paper'));
        monWrap.classList.add('visible');
        resizeH.classList.add('visible');

        btnFast .disabled = false;
        btnStep .disabled = false;
        btnStep10.disabled = false;
        btnStep1000.disabled = false;
        btnFit  .disabled = false;
        btnZoomIn.disabled = false;
        btnZoomOut.disabled = false;

        setStatus('Ready', 'ok');
        fileLabel.textContent = fileName;

        currentScale = 1;
        setTimeout(() => {
          try {
            paper.scale(1, 1);
            paper.scaleContentToFit({ padding: 20, minScale: ZOOM_MIN, maxScale: ZOOM_MAX });
            currentScale = paper.scale().sx;
          } catch(e) {}
        }, 300);

        circuit.start();
        startTickTimer();
        syncButtons();

      } catch(e) {
        setStatus('Render error: ' + e.message, 'error');
      }
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;

      if (msg.type === 'loading') {
        setStatus('Synthesising ' + msg.fileName, 'loading');
        fileLabel.textContent = msg.fileName;
        [btnPlayPause,btnFast,btnStep,btnStep10,btnStep1000,btnFit,btnZoomIn,btnZoomOut].forEach(b => b.disabled = true);
      }

      if (msg.type === 'circuit') {
        loadCircuit(msg.data, msg.fileName, msg.settings);
      }

      if (msg.type === 'error') {
        setStatus('Error: ' + msg.message, 'error');
      }
    });

    (function() {
      const handle = document.getElementById('resize-handle');
      let dragging = false, startY = 0, startH = 0;

      handle.addEventListener('mousedown', (e) => {
        dragging = true;
        startY   = e.clientY;
        startH   = monWrap.getBoundingClientRect().height;
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const delta = startY - e.clientY;           
        const newH  = Math.max(60, Math.min(400, startH + delta));
        monWrap.style.maxHeight = newH + 'px';
      });

      document.addEventListener('mouseup', () => {
        dragging = false;
        document.body.style.cursor = '';
      });
    })();
  </script>
</body>
</html>`;
}

// Side Bar Settings Provider
class DigitalJSSettingsProvider {
  constructor(context) {
    this.context = context;
    this._view = undefined;
    this.currentFile = null;
    this.currentSource = null;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    if (this.currentFile) {
      webviewView.webview.postMessage({ type: 'fileLoaded', fileName: this.currentFile });
    }

    webviewView.webview.onDidReceiveMessage(data => {
      if (data.type === 'synthesize') {
        if (!this.currentFile) {
          vscode.window.showWarningMessage('DigitalJS: No active file loaded. Right-click a Verilog file and "Open in DigitalJS".');
          return;
        }
        this.executeSynthesis(data.settings);
      }
    });
  }

  setFile(fileName, source, document) {
    this.currentFile = fileName;
    this.currentSource = source;
    this.currentDocument = document;
    if (this._view) {
      this._view.webview.postMessage({ type: 'fileLoaded', fileName });
    }
  }

  async executeSynthesis(settings) {
    if (!this.currentFile || !this.currentSource) return;

    // Always pull the live editor text instead of relying on a stale cached string
    if (this.currentDocument) {
      this.currentSource = this.currentDocument.getText();
    }

    if (currentPanel) {
      currentPanel.reveal(vscode.ViewColumn.Beside);
    } else {
      currentPanel = vscode.window.createWebviewPanel(
        'digitaljsOnline', 'DigitalJS',
        vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [] }
      );
      currentPanel.webview.html = getWebviewHtml();
      currentPanel.onDidDispose(() => { currentPanel = undefined; }, null, this.context.subscriptions);
    }

    currentPanel.webview.postMessage({ type: 'loading', fileName: this.currentFile });

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `DigitalJS: synthesising ${this.currentFile}…`,
      cancellable: false
    }, async () => {
      try {
        const result = await synthesise(this.currentFile, this.currentSource, settings);
        const circuitData = result.output ?? result;
        currentPanel.webview.postMessage({ type: 'circuit', data: circuitData, fileName: this.currentFile, settings });
      } catch (err) {
        currentPanel.webview.postMessage({ type: 'error', message: err.message });
        vscode.window.showErrorMessage('DigitalJS synthesis failed: ' + err.message);
      }
    });
  }

  getHtml() {
    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DigitalJS Parameters</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 15px; }
    h2 { font-size: 1.1em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 5px; margin-bottom: 10px; margin-top: 20px;}
    h2:first-child { margin-top: 0; }
    .setting-group { margin-bottom: 12px; }
    .setting-row { display: flex; gap: 16px; margin-bottom: 12px; }
    .setting-row .setting-group { margin-bottom: 0; }
    label { display: block; margin-bottom: 4px; font-size: 0.9em; }
    input[type="checkbox"] { margin-right: 6px; cursor: pointer; }
    input[type="radio"] { margin-right: 6px; cursor: pointer; }
    select { width: 100%; background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border); padding: 4px; border-radius: 2px;}
    button { width: 100%; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px; cursor: pointer; font-size: 1em; font-weight: bold; border-radius: 2px; margin-top: 15px;}
    button:hover { background: var(--vscode-button-hoverBackground); }
    #active-file-alert { color: var(--vscode-editorInfo-foreground); font-size: 0.85em; margin-bottom: 15px; word-break: break-all; }
    
    .radio-group { margin-left: 24px; margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
    .radio-group.hidden { display: none; }
    .radio-group label { color: var(--vscode-foreground); }
    .radio-group input:disabled + span { opacity: 0.5; }
  </style>
</head>
<body>
  <div id="active-file-alert">No file loaded.</div>
  
  <h2>Circuit synthesis</h2>
  <div class="setting-row">
    <div class="setting-group">
      <label><input type="checkbox" id="opt-optimize" checked> Optimize in Yosys</label>
    </div>
    <div class="setting-group">
      <label><input type="checkbox" id="opt-simplify" checked> Simplify diagram</label>
    </div>
  </div>
  <div class="setting-group">
    <label>FSM transform (experimental)</label>
    <select id="opt-fsm">
      <option value="nomap" selected>No FSM transform</option>
      <option value="yes">FSM transform</option>
      <option value="nomacro">FSM as circuit element</option>
    </select>
  </div>
  
  <div class="setting-group">
    <label><input type="checkbox" id="opt-logicGates"> Convert to logic gates</label>
    <div class="radio-group" id="logic-gate-radios">
      <label><input type="radio" name="logicGateType" value="unprocessed" checked> <span>Keep gates unprocessed</span></label>
      <label><input type="radio" name="logicGateType" value="subset"> <span>Map into subset of gates</span></label>
      <label><input type="radio" name="logicGateType" value="luts"> <span>Map into LUTs</span></label>
    </div>
  </div>

  <div class="setting-group">
    <label>Synthesis mode</label>
    <select id="opt-synthMode">
      <option value="server" selected>Server Side (legacy)</option>
      <option value="wasm">WebAssembly (faster and local)</option>
    </select>
  </div>

  <h2>Simulation</h2>
  <div class="setting-group">
    <label><input type="checkbox" id="opt-delay"> Zero combinational propagation delay</label>
  </div>
  <div class="setting-group">
    <label>Simulation engine</label>
    <select id="opt-simEngine">
      <option value="webworker">WebWorker (faster and responsive)</option>
    </select>
  </div>

  <button id="btn-synthesize">Synthesize Circuit</button>

  <script>
    const vscode = acquireVsCodeApi();

    const lgCheckbox = document.getElementById('opt-logicGates');
    const lgRadios = document.querySelectorAll('input[name="logicGateType"]');
    const lgRadioGroup = document.getElementById('logic-gate-radios');

    function updateRadioState() {
      lgRadioGroup.classList.toggle('hidden', !lgCheckbox.checked);
      lgRadios.forEach(r => { r.disabled = !lgCheckbox.checked; });
    }

    // Toggle radio enabled state on checkbox change
    lgCheckbox.addEventListener('change', updateRadioState);
    updateRadioState(); // Initial run

    function getSettings() {
      const selectedRadio = document.querySelector('input[name="logicGateType"]:checked');
      return {
        optimize: document.getElementById('opt-optimize').checked,
        simplify: document.getElementById('opt-simplify').checked,
        fsm: document.getElementById('opt-fsm').value,
        logicGates: document.getElementById('opt-logicGates').checked,
        logicGateType: selectedRadio ? selectedRadio.value : 'unprocessed',
        synthMode: document.getElementById('opt-synthMode').value,
        delay: document.getElementById('opt-delay').checked,
        simEngine: document.getElementById('opt-simEngine').value
      };
    }

    function triggerSynthesis() {
      vscode.postMessage({
        type: 'synthesize',
        settings: getSettings()
      });
    }

    document.getElementById('btn-synthesize').addEventListener('click', triggerSynthesis);

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'fileLoaded') {
        document.getElementById('active-file-alert').innerText = "Active: " + msg.fileName;
      }
    });
  </script>
</body>
</html>`;
  }
}

let settingsProvider;

const DEFAULT_SYNTH_SETTINGS = {
  optimize: true,
  simplify: true,
  fsm: 'nomap',
  logicGates: false,
  logicGateType: 'unprocessed',
  synthMode: 'server',
  delay: false,
  simEngine: 'webworker'
};

function resolveActiveVerilogFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('DigitalJS: No active file. Open a .v or .sv file first.');
    return null;
  }

  const filePath = editor.document.fileName;
  const ext = filePath.split('.').pop().toLowerCase();
  if (!['v', 'sv'].includes(ext)) {
    vscode.window.showErrorMessage('DigitalJS: Active file is not a .v or .sv file.');
    return null;
  }

  const fileText = editor.document.getText();
  if (!fileText.trim()) {
    vscode.window.showWarningMessage('DigitalJS: File is empty.');
    return null;
  }

  const fileName = filePath.split(/[\\/]/).pop();
  return { fileName, fileText, document: editor.document };
}

function activate(context) {
  settingsProvider = new DigitalJSSettingsProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('digitaljs-settings', settingsProvider)
  );

  // Sidebar icon: only reveals the parameters panel, no auto-synthesis.
  context.subscriptions.push(
    vscode.commands.registerCommand('digitaljsOnline.open', () => {
      const file = resolveActiveVerilogFile();
      if (!file) return;

      // Pass the file context to the Sidebar provider
      settingsProvider.setFile(file.fileName, file.fileText, file.document);

      // Focus the new sidebar panel
      vscode.commands.executeCommand('digitaljs-settings.focus');
    })
  );

  // Editor-title icon: synthesizes immediately with default settings,
  // without opening/focusing the parameters sidebar.
  context.subscriptions.push(
    vscode.commands.registerCommand('digitaljsOnline.synthesizeDefault', () => {
      const file = resolveActiveVerilogFile();
      if (!file) return;

      settingsProvider.setFile(file.fileName, file.fileText, file.document);
      settingsProvider.executeSynthesis(DEFAULT_SYNTH_SETTINGS);
    })
  );
}

function deactivate() {}
module.exports = { activate, deactivate };