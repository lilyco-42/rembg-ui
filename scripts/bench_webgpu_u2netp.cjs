#!/usr/bin/env node
// GPU inference smoke/benchmark. npm install playwright-core (dev-only).
// No fallback to CPU and no arbitrary paths exposed over the loopback server.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
const modelPath=process.env.REMBG_WEBGPU_MODEL||path.join(process.env.HOME||'', '.u2net','u2netp-webgpu.onnx');
const allowed={
 '/u2netp.onnx':modelPath,
 '/vendor/ort/ort.webgpu.min.mjs':path.join(root,'frontend/vendor/ort/ort.webgpu.min.mjs'),
 '/vendor/ort/ort-wasm-simd-threaded.jsep.mjs':path.join(root,'frontend/vendor/ort/ort-wasm-simd-threaded.jsep.mjs'),
 '/vendor/ort/ort-wasm-simd-threaded.jsep.wasm':path.join(root,'frontend/vendor/ort/ort-wasm-simd-threaded.jsep.wasm')
};
const server=http.createServer((req,res)=>{
 const filepath=allowed[req.url];
 if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<html><body>WebGPU smoke test</body></html>')}
 if(!filepath||!fs.existsSync(filepath)){res.writeHead(404);return res.end()}
 res.writeHead(200,{'Content-Type':filepath.endsWith('.wasm')?'application/wasm':filepath.endsWith('.mjs')?'text/javascript':'application/octet-stream'});
 fs.createReadStream(filepath).pipe(res);
});
async function main(){
 let browser;
 try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_BINARY||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-webgpu','--enable-features=Vulkan,WebGPU','--use-angle=vulkan']});
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 const result=await page.evaluate(async()=>{
  const a=await navigator.gpu?.requestAdapter();
  if(!a)throw Error('No WebGPU adapter');
  const d=await a.requestDevice();
  if(!d)throw Error('No WebGPU device');
  const ort=await import('/vendor/ort/ort.webgpu.min.mjs');
  ort.env.wasm.wasmPaths='/vendor/ort/';
  const model=await(await fetch('/u2netp.onnx')).arrayBuffer();
  const start=performance.now();
  const session=await ort.InferenceSession.create(model,{executionProviders:['webgpu']});
  const init=performance.now()-start;
  const input=new Float32Array(3*320*320);
  for(let i=0;i<input.length;i++)input[i]=Math.sin(i*.007);
  const tensor=new ort.Tensor('float32',input,[1,3,320,320]);
  const timings=[];let stats;
  for(let i=0;i<8;i++){
   const t=performance.now();
   const outputs=await session.run({[session.inputNames[0]]:tensor});
   timings.push(Number((performance.now()-t).toFixed(2)));
   const values=outputs[session.outputNames[0]].data;
   if(values.length!==320*320||!Number.isFinite(values[0]))throw Error('Invalid GPU output');
   stats={length:values.length,first8:Array.from(values.slice(0,8))};
   Object.values(outputs).forEach(value=>value.dispose());
  }
  tensor.dispose();
  const sorted=timings.slice(3).sort((x,y)=>x-y);
  return {provider:'webgpu',adapter:{vendor:a.info.vendor,architecture:a.info.architecture},sessionCreateMs:Number(init.toFixed(2)),runsMs:timings,warmMedianMs:sorted[2],output:stats};
 });
 console.log(JSON.stringify(result,null,2));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(error);process.exitCode=1;server.close()});
