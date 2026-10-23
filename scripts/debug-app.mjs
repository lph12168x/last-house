import puppeteer from "puppeteer";
const browser = await puppeteer.launch({headless:false,executablePath:"/home/latte/.cache/puppeteer/chrome/linux-152.0.7977.75/chrome-linux64/chrome",args:["--no-sandbox","--disable-setuid-sandbox","--enable-unsafe-webgpu","--enable-features=Vulkan,UseSkiaRenderer","--use-angle=vulkan","--enable-gpu","--ignore-gpu-blocklist","--window-size=1600,1000"]});
const page = await browser.newPage();
await page.setViewport({width:1600,height:1000});
const logs=[];
page.on("console",m=>{ if(m.type()!=="debug") logs.push(m.type()+": "+m.text().slice(0,240)); });
page.on("pageerror",e=>logs.push("pageerror: "+String(e).slice(0,240)));
page.on("response",r=>{ if(r.status()>=400) logs.push("HTTP "+r.status()+" "+r.url()); });
page.on("requestfailed",r=>logs.push("FAIL "+r.url()+" "+r.failure()?.errorText));
await page.goto("http://127.0.0.1:4173/?scene=your-house",{waitUntil:"domcontentloaded",timeout:60000});
await page.waitForFunction("window.__sceneReady === true",{timeout:120000}).catch(()=>{});
await new Promise(r=>setTimeout(r,5000));
const info=await page.evaluate(async()=>{
  const c=document.querySelector("canvas");
  let gpu={};
  try{ const a=await navigator.gpu?.requestAdapter(); gpu={has:!!navigator.gpu,adapter:!!a,info:a?.info?{vendor:a.info.vendor,arch:a.info.architecture}:null}; }catch(e){ gpu={err:String(e)}; }
  return {canvas:c?{w:c.width,h:c.height,clientW:c.clientWidth,clientH:c.clientHeight}:null,gpu};
});
console.log(JSON.stringify(info,null,2));
console.log(logs.slice(-25).join("\n"));
await page.screenshot({path:"/tmp/app-debug.png"});
await browser.close();
