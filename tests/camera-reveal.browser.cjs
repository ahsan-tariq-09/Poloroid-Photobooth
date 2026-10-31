// Run: node tests/camera-reveal.browser.cjs <playwright module path> <cdp|webkit> <artifact directory>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pw = require(process.argv[2]);
const engine = process.argv[3] || 'cdp';
const output = path.resolve(process.argv[4] || 'camera-browser-results');
const baseURL = process.env.CAMERA_TEST_URL || 'http://127.0.0.1:5174';
fs.mkdirSync(output, {recursive:true});
async function prepareCamera(page, mobile) {
  await page.getByRole('button',{name:'Timer off',exact:true}).click();
  if(!mobile)await page.getByRole('button',{name:'Roll film',exact:true}).click();
}
(async()=>{
  const launched = engine === 'cdp'
    ? await pw.chromium.launch({channel:'chrome',headless:true,args:['--remote-debugging-port=9334','--disable-background-timer-throttling','--disable-renderer-backgrounding']})
    : await pw.webkit.launch({headless:true,executablePath:process.env.WEBKIT_EXECUTABLE_PATH});
  let browser = launched;
  try {
    if(engine === 'cdp')browser=await pw.chromium.connectOverCDP('http://127.0.0.1:9334');
    for (const width of (process.argv[5]==='small'?[568]:process.argv[5]==='extra'?[390]:process.argv[5]==='landscape'?[844,568]:[1280,390,320,844,568])) {
      const mobile=width!==1280;
      const context = await browser.newContext({viewport:{width,height:width===320?568:width===390?844:width===844?390:width===568?320:900},hasTouch:mobile,reducedMotion:'no-preference'});
      await context.addInitScript((engine)=>{
        const addListener=window.addEventListener.bind(window),removeListener=window.removeEventListener.bind(window);
        window.addEventListener=(type,...args)=>{if(type==='devicemotion')window.motionListenerReady=true;return addListener(type,...args);};
        window.removeEventListener=(type,...args)=>{if(type==='devicemotion')window.motionListenerReady=false;return removeListener(type,...args);};
        if(!navigator.mediaDevices)Object.defineProperty(navigator,'mediaDevices',{value:{}});
        window.cameraRequests=0;window.cameraStops=0;
        Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
          window.cameraRequests++;
          const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
          const ctx=canvas.getContext('2d');
          const photo=new Image();photo.src='/sample-flash.webp';await photo.decode();
          const paint=()=>ctx.drawImage(photo,0,0,640,480);
          paint();
          if(engine==='webkit'){
            // Windows WebKit has no camera API; replace only the media boundary.
            const draw=CanvasRenderingContext2D.prototype.drawImage;
            CanvasRenderingContext2D.prototype.drawImage=function(source,...args){return draw.call(this,source instanceof HTMLVideoElement?canvas:source,...args);};
            Object.defineProperties(HTMLVideoElement.prototype,{videoWidth:{configurable:true,get:()=>640},videoHeight:{configurable:true,get:()=>480},readyState:{configurable:true,get:()=>4},paused:{configurable:true,get:()=>false},srcObject:{configurable:true,writable:true,value:null}});
            HTMLVideoElement.prototype.play=async()=>{};
            return {getTracks:()=>[{stop(){window.cameraStops++;},readyState:'live'}]};
          }
          const stream=canvas.captureStream(15);const timer=setInterval(paint,60);
          const track=stream.getTracks()[0],stop=track.stop.bind(track);track.stop=()=>{window.cameraStops++;clearInterval(timer);stop();};return stream;
        }});
      },engine);
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(baseURL+'/');
      if(mobile)await page.waitForURL('**/camera');
      if(mobile)await page.waitForFunction(()=>{const shutter=document.querySelector('[aria-label="Capture"]');return shutter&&!shutter.disabled;});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Live camera overflows horizontally');
      if(mobile&&process.argv[5]!=='inspect')assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'Live camera exceeds the viewport height');
      await page.screenshot({path:path.join(output,`${engine}-${width}-home.png`),fullPage:true});
      if(process.argv[5]==='inspect'){console.log(JSON.stringify({engine,width,layout:await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}))}));await context.close();continue;}
      await prepareCamera(page,mobile);
      if(!mobile){
        await page.waitForFunction(()=>{const shutter=document.querySelector('[aria-label="Capture"]');return shutter&&!shutter.disabled;});
        await page.screenshot({path:path.join(output,`${engine}-${width}-camera.png`)});
      }
      if(mobile){
        const requests=await page.evaluate(()=>window.cameraRequests);
        await page.evaluate(()=>{window.cameraVideo=document.querySelector('video');});
        assert.equal(await page.getByRole('button',{name:'Camera settings',exact:true}).count(),0);
        await page.getByRole('button',{name:'B&W',exact:true}).click();
        await page.waitForTimeout(300);
        await page.screenshot({path:path.join(output,`${engine}-${width}-settings.png`)});
        await page.getByRole('slider',{name:'ISO effect',exact:true}).focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.getByRole('slider',{name:'ISO effect',exact:true}).getAttribute('aria-valuenow'),'1600');
        const size=page.viewportSize();await page.setViewportSize({width:size.height,height:size.width});
        assert.equal(await page.evaluate(()=>document.querySelector('video')===window.cameraVideo),true);
        assert.equal(await page.evaluate(()=>window.cameraRequests),requests);
        assert.match(await page.locator('.viewfinder-readout').innerText(),/B&W/);
        await page.setViewportSize(size);
      }
      assert.equal(await page.getByRole('button',{name:'4-shot strip',exact:true}).count(),0);
      await page.getByRole('button',{name:'Capture',exact:true}).click();
      const reveal=page.getByRole('button',{name:'Shake to reveal',exact:true});
      await page.waitForFunction(()=>{const button=document.querySelector('.shake-reveal');return button&&!button.disabled;});
      const outlet=await page.evaluate(()=>{const surface=document.querySelector('.mobile-camera')||document.querySelector('.camera-modal');const slot=surface.querySelector('.ejection-slot').getBoundingClientRect(),paper=surface.querySelector('.instant-paper').getBoundingClientRect();return {slot:{x:slot.x,width:slot.width,bottom:slot.bottom},paper:{x:paper.x,width:paper.width,top:paper.top}};});
      assert(Math.abs(outlet.slot.x-outlet.paper.x)<3&&Math.abs(outlet.slot.width-outlet.paper.width)<3&&Math.abs(outlet.slot.bottom-outlet.paper.top)<12,JSON.stringify(outlet));
      await page.screenshot({path:path.join(output,`${engine}-${width}-blank.png`)});
      await reveal.scrollIntoViewIfNeeded();
      await page.evaluate(()=>{
        window.shakeSamples=[];window.shakeSampling=setInterval(()=>window.shakeSamples.push(getComputedStyle(document.querySelector('.print-drag')).transform),16);
      });
      await reveal.click();
      await page.waitForTimeout(850);
      const transforms=await page.evaluate(()=>{clearInterval(window.shakeSampling);return [...new Set(window.shakeSamples)];});
      assert(transforms.some(t=>t!=='none'&&t!=='matrix(1, 0, 0, 1, 0, 0)'),`button did not shake: ${transforms}`);
      assert.equal(await page.getByRole('button',{name:'4-shot strip',exact:true}).count(),0);
      await page.getByRole('button',{name:'Photo revealed',exact:true}).waitFor({timeout:15000});
      assert.equal(await page.locator('.instant-photo-window').count(),1);
      assert.equal(await page.locator('.print-drag').evaluate(e=>getComputedStyle(e).transform),'none');
      const layout=await page.evaluate(()=>{const surface=document.querySelector('main.mobile-camera')||document.querySelector('[role="dialog"]');return {viewport:innerWidth,page:document.documentElement.scrollWidth,dialog:surface.scrollWidth,dialogWidth:surface.clientWidth};});
      assert(layout.page<=layout.viewport&&layout.dialog<=layout.dialogWidth,JSON.stringify(layout));
      if(mobile)assert(await page.evaluate(()=>{const button=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Done');return button.getBoundingClientRect().bottom<=innerHeight;}),'Finish actions exceed the viewport');
      await page.screenshot({path:path.join(output,`${engine}-${width}-revealed.png`)});
      const contrast=await page.getByRole('button',{name:'Done',exact:true}).evaluate(e=>({color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor}));
      if(mobile)assert.deepEqual(contrast,{color:'rgb(41, 44, 38)',background:'rgb(250, 246, 236)'});
      await page.getByRole('button',{name:'Done',exact:true}).click();await page.waitForURL('**/finish');
      const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();
      const download=await downloadPromise;assert.equal(await download.failure(),null);await download.saveAs(path.join(output,`${engine}-${width}.png`));
      await page.getByRole('link',{name:'Back to editing'}).click();await page.waitForURL('**/edit');
      assert.deepEqual(errors,[]);
      if(width===390){
        for(const method of ['pointer','sensor']){
          await page.goto(baseURL+'/');
          await page.evaluate(()=>{if(!window.DeviceMotionEvent)window.DeviceMotionEvent=Event;});
          await prepareCamera(page,true);
          await page.getByRole('button',{name:'Capture',exact:true}).click();
          await page.waitForFunction(()=>{const button=document.querySelector('.shake-reveal');return button&&!button.disabled;});
          if(method==='pointer'){
            const box=await page.locator('.print-drag').boundingBox();
            const x=box.x+box.width/2,y=box.y+box.height/2;
            await page.mouse.move(x,y);await page.mouse.down();
            for(const delta of [55,-55,55])await page.mouse.move(x+delta,y,{steps:5});
            await page.mouse.up();
          }else{
            await page.waitForFunction(()=>window.motionListenerReady&&!document.hidden);
            await page.evaluate(()=>{
              for(let i=0;i<5;i++){
                const event=new Event('devicemotion');
                Object.defineProperties(event,{acceleration:{value:{x:i%2?-25:25,y:0,z:0}},timeStamp:{value:100+i*220}});
                window.dispatchEvent(event);
              }
            });
          }
          await page.locator('.instant-photo-window img').waitFor();
          const rotations=await page.evaluate(async()=>{
            const samples=[];
            for(let i=0;i<45;i++){
              await new Promise(resolve=>requestAnimationFrame(resolve));
              const m=new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.print-drag')).transform);
              samples.push(Math.atan2(m.b,m.a));
            }
            return samples;
          });
          assert(rotations.every(angle=>Math.abs(angle)<0.001),`${method} added a shake`);
          await page.evaluate(()=>{
            Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
            document.dispatchEvent(new Event('visibilitychange'));
          });
          await page.getByRole('button',{name:'Photo revealed',exact:true}).waitFor();
          assert.equal(await page.locator('.print-drag').evaluate(e=>getComputedStyle(e).transform),'none');
          await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
          console.log(JSON.stringify({engine,method,noExtraShake:true,hiddenPageSettles:true}));
        }
        await page.emulateMedia({reducedMotion:'reduce'});await page.goto(baseURL+'/');
        await prepareCamera(page,true);await page.getByRole('button',{name:'Capture',exact:true}).click();
        await page.getByRole('button',{name:'Retake photo',exact:true}).click();
        await page.getByRole('button',{name:'Capture',exact:true}).click();
        await page.getByRole('button',{name:'Shake to reveal',exact:true}).focus();await page.keyboard.press('Enter');
        await page.getByRole('button',{name:'Photo revealed',exact:true}).waitFor();
        assert.equal(await page.locator('.print-drag').evaluate(e=>getComputedStyle(e).transform),'none');
        await page.getByRole('button',{name:'Develop',exact:true}).click();await page.waitForURL('**/edit');
        console.log(JSON.stringify({engine,reducedMotion:true,keyboardReveal:true,develop:true}));
      }
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({engine,width,shakeSamples:transforms.length,layout,finish:true,edit:true,errors}));
      await context.close();
    }
    if(process.argv[5]==='inspect')return;
    for(const permission of ['pending','denied']){
      const context=await browser.newContext({viewport:{width:320,height:568},hasTouch:true,reducedMotion:'reduce'});
      await context.addInitScript(permission=>{
        window.cameraRequests=0;window.cameraStops=0;window.pendingCameras=[];
        if(!navigator.mediaDevices)Object.defineProperty(navigator,'mediaDevices',{value:{}});
        Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>{
          window.cameraRequests++;
          return permission==='denied'?Promise.reject(new DOMException('Denied','NotAllowedError')):new Promise(resolve=>window.pendingCameras.push(resolve));
        }});
      },permission);
      const page=await context.newPage();await page.goto(baseURL+'/');await page.waitForURL('**/camera');
      await page.getByText(permission==='pending'?'Waiting for camera permission…':/Camera permission was declined/).waitFor();
      assert(await page.getByRole('button',{name:'Capture',exact:true}).isDisabled());
      assert(await page.getByRole('button',{name:'Upload photos',exact:true}).isEnabled());
      if(permission==='denied'){
        const requests=await page.evaluate(()=>window.cameraRequests);
        await page.getByRole('button',{name:'Retry camera',exact:true}).click();
        await page.waitForFunction(expected=>window.cameraRequests===expected,requests+1);
      }
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
      await page.screenshot({path:path.join(output,`${engine}-${permission}.png`),fullPage:true});
      if(permission==='pending'){
        await page.getByRole('link',{name:'Scrapbook',exact:true}).click();await page.waitForURL('**/scrapbook');
        await page.locator('.mobile-camera').waitFor({state:'detached'});
        await page.evaluate(()=>window.pendingCameras.forEach(resolve=>resolve({getTracks:()=>[{stop(){window.cameraStops++;}}]})));
        await page.waitForFunction(()=>window.cameraStops===window.cameraRequests);
      }else{
        const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload photos',exact:true}).click();
        await (await chooserPromise).setFiles(path.resolve('public/sample-coast.png'));
        await page.waitForURL('**/edit');
        await page.getByRole('button',{name:/^(1 )?Start$/}).click();await page.waitForURL('**/camera');
        await page.locator('input[type="file"]').setInputFiles(path.resolve('public/sample-coast.png'));
        await page.getByRole('dialog',{name:'Start a new Polaroid?'}).waitFor();
        assert.equal(await page.getByRole('dialog').evaluate(e=>getComputedStyle(e).color),'rgb(41, 44, 38)');
        await page.getByRole('button',{name:'Keep editing',exact:true}).click();
        await page.getByRole('link',{name:'Continue your Polaroid',exact:true}).click();await page.waitForURL('**/edit');
      }
      console.log(JSON.stringify({engine,permission,retry:permission==='denied',uploadAndResume:permission==='denied',lateStreamCleanup:permission==='pending',overflow}));
      await context.close();
    }
  } finally {await browser.close();if(browser!==launched)await launched.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
