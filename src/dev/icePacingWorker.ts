/** Diagnostic scheduling probe only; never drives Game time or simulation. */
let previous=performance.now();
setInterval(()=>{const now=performance.now();self.postMessage({sent:performance.timeOrigin+now,wake:now-previous});previous=now;},20);
export {};
