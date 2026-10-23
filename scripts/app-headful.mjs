import puppeteer from "puppeteer";
const out = process.argv[2] || "/tmp/app-headful.png";
const browser = await puppeteer.launch({
  headless: false,
  executablePath: "/home/latte/.cache/puppeteer/chrome/linux-152.0.7977.75/chrome-linux64/chrome",
  args: ["--no-sandbox","--disable-setuid-sandbox","--enable-unsafe-webgpu","--enable-features=Vulkan,UseSkiaRenderer","--use-angle=vulkan","--enable-gpu","--ignore-gpu-blocklist","--window-size=1600,1000"],
});
const page = await browser.newPage();
await page.setViewport({width:1600,height:1000,deviceScaleFactor:1});
const errors=[];
page.on("pageerror",e=>errors.push(String(e).slice(0,200)));
page.on("console",m=>{if(m.type()==="error")errors.push(m.text().slice(0,200));});
await page.goto("http://127.0.0.1:4173/?scene=your-house",{waitUntil:"domcontentloaded",timeout:60000});
let ready=false;
try{await page.waitForFunction("window.__sceneReady === true",{timeout:120000});ready=true;}catch{}
await new Promise(r=>setTimeout(r,4000));
await page.screenshot({path:out});
console.log("ready",ready,"errors",errors.length?errors.slice(0,4):"none");
await browser.close();
