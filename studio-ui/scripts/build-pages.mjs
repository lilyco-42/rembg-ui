import {execFileSync} from "node:child_process";
import {cpSync,existsSync,mkdirSync,rmSync,statSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
if ((process.env.REMBG_EDITION || "").toLowerCase() !== "community") {
  console.error("Browser demo is a free Community artifact; set REMBG_EDITION=community explicitly.");
  process.exit(2);
}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const repo=path.resolve(root,"..");
execFileSync("npm",["run","build"],{cwd:root,stdio:"inherit",env:{...process.env,VITE_BROWSER_DEMO:"true"}});
const source=path.join(repo,"web","dist");
const required=["worker.mjs","vendor/ort.wasm.min.mjs","vendor/ort-wasm-simd-threaded.wasm"];
for (const item of required) {
  const file=path.join(source,item);
  if (!existsSync(file) || !statSync(file).isFile() || statSync(file).size===0) {
    throw new Error("Missing required browser runtime asset: "+item+"; run web/npm ci and npm run build");
  }
}
const destination=path.join(repo,"frontend","studio-ui","browser");
mkdirSync(destination,{recursive:true});
cpSync(source,destination,{recursive:true});
rmSync(path.join(destination,"index.html"),{force:true});
console.log("Built standalone GitHub Pages app with real browser inference assets");
