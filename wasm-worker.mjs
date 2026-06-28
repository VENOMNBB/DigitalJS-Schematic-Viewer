/**
 * wasm-worker.mjs  –  ESM Worker thread for local Yosys/WASM synthesis.
 *
 * Must be .mjs so Node.js treats it as an ES module, which allows:
 *   • import '@yowasp/yosys'       (ESM-only package, uses import.meta.url internally)
 *
 * Spawned by extension.js (CJS) via worker_threads.Worker.
 * Input  : workerData = { fileName, source, settings }
 * Output : parentPort.postMessage({ ok: true,  result: circuitJson })
 *        | parentPort.postMessage({ ok: false, error:  message     })
 *
 * API notes (verified against @yowasp/yosys@0.66 + yosys2digitaljs@0.10):
 *   runYosys(args, files)
 *     args  = string[]            CLI flags passed after argv0, e.g. ['-p', '<script>']
 *     files = { [name]: string }  virtual input filesystem
 *     returns Promise<{ [name]: string }>  mutated virtual filesystem
 *
 *   synth_simlib does NOT exist in this Yosys build.
 *   Correct simulation-friendly script: hierarchy -auto-top; proc; opt; write_json
 *
 *   yosys2digitaljs is exported from 'yosys2digitaljs/core', NOT '/node'.
 *   '/node' exports the CLI runner (process, process_files, etc.), not the converter.
 */

import { workerData, parentPort } from 'worker_threads';
import { runYosys }               from '@yowasp/yosys';
import corePkg                     from 'yosys2digitaljs/core';

const { yosys2digitaljs } = corePkg;
const { fileName, source, settings } = workerData;

async function run() {
  const outFile = 'out.json';

  // Build the Yosys synthesis script.
  // hierarchy -auto-top  → resolve top module
  // proc                 → convert always blocks / processes to netlists
  // opt                  → optimise (respects settings.optimize flag via script choice)
  // write_json           → emit the JSON netlist yosys2digitaljs expects
  const passes = settings.optimize
    ? 'hierarchy -auto-top; proc; opt; write_json ' + outFile
    : 'hierarchy -auto-top; proc; write_json '      + outFile;

  let vfs;
  try {
    vfs = await runYosys(
      ['-p', `read_verilog ${fileName}; ${passes}`],
      { [fileName]: source }
    );
  } catch (e) {
    // e.files contains the partial vfs on error; e.message has the Yosys log tail
    throw new Error('Yosys (WASM) failed: ' + e.message);
  }

  if (!vfs[outFile]) {
    throw new Error('Yosys (WASM) produced no output. Check the Verilog syntax.');
  }

  const yosysJson = JSON.parse(vfs[outFile]);

  const circuitJson = await yosys2digitaljs(yosysJson, {
    optimize:      settings.optimize,
    simplify:      settings.simplify,
    fsm:           settings.fsm,
    logicGates:    settings.logicGates,
    logicGateType: settings.logicGateType
  });

  return circuitJson;
}

run()
  .then(result => parentPort.postMessage({ ok: true,  result }))
  .catch(err   => parentPort.postMessage({ ok: false, error: err.message }));
