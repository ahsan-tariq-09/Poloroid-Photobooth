// Run: node tests/camera-reveal.browser.cjs <playwright module path> <cdp|webkit> <artifact directory>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pw = require(process.argv[2]);
const engine = process.argv[3] || 'cdp';
const output = path.resolve(process.argv[4] || 'camera-browser-results');
fs.mkdirSync(output, {recursive:true});
(async()=>{
  const launched = engine === 'cdp'
    ? await pw.chromium.launch({channel:'chrome',headless:true,args:['--remote-debugging-port=9333','--disable-background-timer-throttling','--disable-renderer-backgrounding']})
    : await pw.webkit.launch({headless:true,executablePath:process.env.WEBKIT_EXECUTABLE_PATH});
  const browser = engine === 'cdp' ? await pw.chromium.connectOverCDP('http://127.0.0.1:9333') : launched;
  try {
    for (const width of (process.argv[5]==='extra'?[390]:[1280,390,320])) {
      const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference'});
      await context.addInitScript((engine)=>{
        const addListener=window.addEventListener.bind(window),removeListener=window.removeEventListener.bind(window);
        window.addEventListener=(type,...args)=>{if(type==='devicemotion')window.motionListenerReady=true;return addListener(type,...args);};
        window.removeEventListener=(type,...args)=>{if(type==='devicemotion')window.motionListenerReady=false;return removeListener(type,...args);};
        if(!navigator.mediaDevices)Object.defineProperty(navigator,'mediaDevices',{value:{}});
        Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
          const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
          const ctx=canvas.getContext('2d');
          const paint=()=>{ctx.fillStyle='#638274';ctx.fillRect(0,0,640,480);ctx.fillStyle='#fff9e9';ctx.font='36px sans-serif';ctx.fillText('A moment to keep',125,240);};
          paint();
          if(engine==='webkit'){
            // Windows WebKit has no camera API; replace only the media boundary.
            const draw=CanvasRenderingContext2D.prototype.drawImage;
            CanvasRenderingContext2D.prototype.drawImage=function(source,...args){return draw.call(this,source instanceof HTMLVideoElement?canvas:source,...args);};
            Object.defineProperties(HTMLVideoElement.prototype,{videoWidth:{configurable:true,get:()=>640},videoHeight:{configurable:true,get:()=>480},readyState:{configurable:true,get:()=>4},paused:{configurable:true,get:()=>false},srcObject:{configurable:true,writable:true,value:null}});
            HTMLVideoElement.prototype.play=async()=>{};
            return {getTracks:()=>[{stop(){},readyState:'live'}]};
          }
          const stream=canvas.captureStream(15);const timer=setInterval(paint,60);
          const track=stream.getTracks()[0],stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};return stream;
        }});
      },engine);
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:5174/');
      await page.screenshot({path:path.join(output,`${engine}-${width}-home.png`),fullPage:true});
      await page.getByRole('button',{name:'Timer off',exact:true}).click();
      await page.getByRole('button',{name:'Roll film',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'4-shot strip',exact:true}).count(),0);
      await page.getByRole('button',{name:'Capture',exact:true}).click();
      const reveal=page.getByRole('button',{name:'Shake to reveal',exact:true});
      await page.waitForFunction(()=>{const button=document.querySelector('.shake-reveal');return button&&!button.disabled;});
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
      const layout=await page.evaluate(()=>({viewport:innerWidth,page:document.documentElement.scrollWidth,dialog:document.querySelector('[role="dialog"]').scrollWidth,dialogWidth:document.querySelector('[role="dialog"]').clientWidth}));
      assert(layout.page<=layout.viewport&&layout.dialog<=layout.dialogWidth,JSON.stringify(layout));
      await page.screenshot({path:path.join(output,`${engine}-${width}-revealed.png`)});
      await page.getByRole('button',{name:'Done',exact:true}).click();await page.waitForURL('**/finish');
      const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();
      const download=await downloadPromise;assert.equal(await download.failure(),null);await download.saveAs(path.join(output,`${engine}-${width}.png`));
      await page.getByRole('link',{name:'Back to editing'}).click();await page.waitForURL('**/edit');
      assert.deepEqual(errors,[]);
      if(width===390){
        for(const method of ['pointer','sensor']){
          await page.goto('http://127.0.0.1:5174/');
          await page.evaluate(()=>{if(!window.DeviceMotionEvent)window.DeviceMotionEvent=Event;});
          await page.getByRole('button',{name:'Timer off',exact:true}).click();
          await page.getByRole('button',{name:'Roll film',exact:true}).click();
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
        await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:5174/');
        await page.getByRole('button',{name:'Timer off',exact:true}).click();await page.getByRole('button',{name:'Roll film',exact:true}).click();await page.getByRole('button',{name:'Capture',exact:true}).click();
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
  } finally {await browser.close();if(browser!==launched)await launched.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
