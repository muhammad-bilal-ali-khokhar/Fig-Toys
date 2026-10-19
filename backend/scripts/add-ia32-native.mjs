// Adds the 32-bit (ia32) better-sqlite3 binary to the production bundle so the
// universal Windows installer also runs on 32-bit PCs.
//
// better-sqlite3 ships prebuilt binaries for x64 and arm64 only. 64-bit Windows
// loads prebuilds/win32-x64.node, 32-bit Windows falls through to
// prebuilds/win32-ia32.node - so we copy the freshly compiled ia32 build there
// and register "ia32" in the bundled lib/binding.js (only the production copy
// is touched, never node_modules).
//
// Run `npm run rebuild:ia32` (in desktop/) first. Windows only: node-gyp cannot
// cross-compile ia32 on macOS/Linux.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(dir, "..");
const root = path.resolve(backend, "..");

const source = path.join(backend, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");
const nativeDir = process.env.FIG_IA32_NATIVE_DIR
  ? path.resolve(process.env.FIG_IA32_NATIVE_DIR)
  : path.join(root, "production", "backend", "native", "better-sqlite3");
const x64Prebuild = path.join(nativeDir, "prebuilds", "win32-x64.node");
const ia32Prebuild = path.join(nativeDir, "prebuilds", "win32-ia32.node");
const bindingFile = path.join(nativeDir, "lib", "binding.js");

const PE_I386 = 0x014c;
const PE_AMD64 = 0x8664;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function peMachine(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 0x40 || buf.toString("ascii", 0, 2) !== "MZ") return null;
  const peOffset = buf.readUInt32LE(0x3c);
  if (peOffset + 6 > buf.length || buf.toString("ascii", peOffset, peOffset + 2) !== "PE") return null;
  return buf.readUInt16LE(peOffset + 4);
}

function machineName(machine) {
  if (machine === PE_I386) return "32-bit (ia32)";
  if (machine === PE_AMD64) return "64-bit (x64)";
  return `unknown (0x${(machine || 0).toString(16)})`;
}

if (!fs.existsSync(bindingFile)) fail(`No production better-sqlite3 bundle at ${nativeDir} - run the backend build:production first.`);
if (!fs.existsSync(x64Prebuild)) fail(`Missing ${x64Prebuild} - the 64-bit Windows prebuild is required.`);
if (!fs.existsSync(source)) fail(`Missing ${source} - run \`npm run rebuild:ia32\` in desktop/ first.`);

const x64Machine = peMachine(x64Prebuild);
if (x64Machine !== PE_AMD64) fail(`The bundled 64-bit prebuild is ${machineName(x64Machine)} - expected 64-bit (x64).`);

const ia32Machine = peMachine(source);
if (ia32Machine !== PE_I386) {
  fail(`The compiled module is ${machineName(ia32Machine)} - expected 32-bit (ia32). Run \`npm run rebuild:ia32\` in desktop/ after \`npm run rebuild\`.`);
}

fs.copyFileSync(source, ia32Prebuild);

const binding = fs.readFileSync(bindingFile, "utf8");
if (!/const PREBUILD_ARCHS = \[[^\]]*\];/.test(binding)) {
  fail(`Could not find PREBUILD_ARCHS in ${bindingFile} - better-sqlite3 changed its loader, update this script.`);
}
fs.writeFileSync(
  bindingFile,
  binding.replace(/const PREBUILD_ARCHS = \[[^\]]*\];/, "const PREBUILD_ARCHS = ['x64', 'arm64', 'ia32'];"),
);

console.log(`32-bit native module ready: ${ia32Prebuild}`);
