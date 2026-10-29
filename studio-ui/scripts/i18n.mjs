import fs from "node:fs";
import path from "node:path";
const base=path.resolve(import.meta.dirname,"..");
const dir=path.join(base,"locales");
const fileNames=fs.readdirSync(dir).filter(n=>n.endsWith(".json")).sort();
if(!fileNames.includes("zh-CN.json")||!fileNames.includes("en.json"))throw Error("Missing required languages");
const catalogs=Object.fromEntries(fileNames.map(file=>[file,JSON.parse(fs.readFileSync(path.join(dir,file),"utf8"))]));
const master=catalogs["zh-CN.json"];
const keys=Object.keys(master).sort();
const variables=s=>[...s.matchAll(/\{([a-zA-Z]\w*)\}/g)].map(m=>m[1]).sort().join(",");
for(const [locale,items] of Object.entries(catalogs)){
 const actual=Object.keys(items).sort();
 if(JSON.stringify(keys)!==JSON.stringify(actual))throw Error(locale+" key mismatch: missing "+keys.filter(x=>!actual.includes(x)).join(",")+" extra "+actual.filter(x=>!keys.includes(x)).join(","));
 for(const key of keys){
  if(typeof items[key]!=="string"||!items[key].trim())throw Error(locale+"/"+key+" empty or nonstring");
  if(variables(items[key])!==variables(master[key]))throw Error(locale+"/"+key+" placeholders differ");
 }
}
console.log("Validated "+fileNames.length+" languages, "+keys.length+" keys each");
if(process.argv.includes("--export")){
 const target=path.join(base,"translations-export");
 fs.mkdirSync(target,{recursive:true});
 for(const file of fileNames)fs.copyFileSync(path.join(dir,file),path.join(target,file));
 fs.writeFileSync(path.join(target,"README.txt"),"Rembg Studio translations\nEdit JSON values only, keep keys and {name} placeholders.\nRun npm run i18n:check before submitting a PR.\n","utf8");
 console.log("Exported editable JSON files to translations-export/");
}
