import { workerData, parentPort } from 'worker_threads';
import { runYosys }               from '@yowasp/yosys';
import corePkg                    from 'yosys2digitaljs/core';

const { yosys2digitaljs } = corePkg;
const { fileName, source, settings } = workerData;

// Maps our sidebar checkbox ids to the gate-kind names Yosys's
// `abc -g` command expects.
const GATE_KIND_MAP = {
  and:  'AND',
  nand: 'NAND',
  or:   'OR',
  nor:  'NOR',
  xor:  'XOR',
  xnor: 'XNOR',
  mux:  'MUX'
};

async function run() {
  const outFile = 'out.json';

  // This pass sequence mirrors yosys2digitaljs's own `prepare_yosys_script`
  // (the exact script the online digitaljs.tilk.eu server runs), so that
  // "Optimize in Yosys" produces the same circuit locally as it does
  // server-side. Previously this only ran a single bare `opt` after `fsm`,
  // which under-optimized designs by ~60% compared to the online tool and
  // never ran `memory -nomap` / `wreduce -memx` at all.
  let script = ['setattr -mod -unset top', 'hierarchy -auto-top', 'proc'];

  // Cheap cleanup (or full opt) BEFORE the fsm pass, same as the server.
  script.push(settings.optimize ? 'opt' : 'opt_clean');

  // 1. Corrected FSM Syntax for Yosys:
  // fsm_expand is a flag (-expand), not a separate command to be run after fsm.
  if (settings.fsm !== 'nomap') {
    let fsmCmd = 'fsm';
    if (settings.fsmExpand) fsmCmd += ' -expand';
    if (settings.fsm === 'nomacro') fsmCmd += ' -nomap';
    script.push(fsmCmd);
  }

  script.push('memory -nomap');
  script.push('wreduce -memx');

  // Two more optimize slots sandwich techmap in the canonical script. We
  // don't currently expose a techmap toggle in the sidebar, so that slot is
  // simply omitted here too (matches the online path, which also leaves
  // options.techmap unset).
  script.push(settings.optimize ? 'opt -full' : 'opt_clean');
  script.push(settings.optimize ? 'opt -full' : 'opt_clean');

  // 2. Logic Gates processing
  if (settings.logicGates) {
    if (settings.logicGateType === 'subset') {
      const subset = settings.logicGateSubset || {};
      const kinds = Object.keys(GATE_KIND_MAP)
        .filter(key => subset[key])
        .map(key => GATE_KIND_MAP[key]);
      const gates = kinds.length ? kinds.join(',') : 'AND,NAND,OR,NOR,XOR,XNOR,MUX';
      script.push(`abc -g ${gates}`);
      script.push('clean');
    } else if (settings.logicGateType === 'luts') {
      const lutWidth = settings.lutWidth || 4;
      script.push(`abc -lut ${lutWidth}`);
      script.push('clean');
    }
  }

  script.push(`write_json ${outFile}`);
  const passes = script.join('; ') + ';';

  let vfs;
  try {
    vfs = await runYosys(
      ['-p', `read_verilog ${fileName}; ${passes}`],
      { [fileName]: source }
    );
  } catch (e) {
    throw new Error('Yosys (WASM) failed: ' + e.message);
  }

  if (!vfs[outFile]) {
    throw new Error('Yosys (WASM) produced no output. Check the Verilog syntax.');
  }

  const yosysJson = JSON.parse(vfs[outFile]);

  // NOTE: yosys2digitaljs's JS-side conversion step only reads a
  // `propagation` option — `optimize`/`simplify`/`fsm`/`fsmexpand` here are
  // no-ops as far as it's concerned (verified against yosys2digitaljs
  // 0.10.3's ConvertOptions type). Left in as harmless documentation of
  // intent / forward-compat; the actual optimize work happens in the yosys
  // script above, and "Simplify diagram" is applied separately client-side
  // in loadCircuit() via digitaljs.transform.transformCircuit.
  const coreOptions = {
    optimize: settings.optimize,
    simplify: settings.simplify,
    fsm: settings.fsm,
    fsmexpand: settings.fsmExpand
  };

  const circuitJson = await yosys2digitaljs(yosysJson, coreOptions);

  // Topologically detect clocks
  if (circuitJson && circuitJson.devices && circuitJson.connectors) {
    const clockDrivers = new Set();
    for (const conn of circuitJson.connectors) {
      if (conn.to && conn.to.port && conn.to.port.toLowerCase().includes('clk')) {
        clockDrivers.add(conn.from.id); 
      }
    }
    for (const [id, dev] of Object.entries(circuitJson.devices)) {
      if (dev.type === 'Input' && dev.bits === 1 && clockDrivers.has(id)) {
        dev.type = 'Clock';
      }
    }
  }

  return circuitJson;
}

run()
  .then(result => parentPort.postMessage({ ok: true,  result }))
  .catch(err   => parentPort.postMessage({ ok: false, error: err.message }));