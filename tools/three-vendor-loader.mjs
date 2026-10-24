// three-vendor-loader.mjs — Node module resolution hook (Odin,
// Chief Engineer tooling). Maps the bare specifier 'three' — which
// the browser resolves via import map to the vendored build — to
// vendor/three.module.js, so headless tools can import the REAL
// game modules (js/world.js, js/bots.js, js/gunmodels.js,
// js/biomes.js) in plain Node with the REAL three.js, not a stub.
//
// Registered by tools/v4-metrics.mjs via node:module.register().
// Tooling only; never shipped to the browser, never imported by
// game code.

const VENDOR = new URL('../vendor/three.module.js', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') {
    return { url: VENDOR, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
