import { useEffect } from 'react';
import { Engine, WorkerId } from './EngineService';
import { buildHostScript } from './hostScript';
import { SF_JS, SF_WASM_B64 } from './generated/stockfishBundle';

let started = false;

/** Web: run the same host script directly in the page. */
export function EngineHost() {
  useEffect(() => {
    if (started) return;
    started = true;
    const post = (msg: any) => {
      if (msg.t === 'boot') {
        Engine.attach({ send: (w: WorkerId, cmd: string) => (self as any).__sfSend(w, cmd) });
        Engine.handshake();
      } else if (msg.t === 'lines') for (const [w, l] of msg.b) Engine.onLine(w, l);
      else if (msg.t === 'crash') Engine.onCrash(msg.w);
      else if (msg.t === 'error') Engine.fail(msg.m);
    };
    // eslint-disable-next-line no-new-func
    new Function('SF_JS', 'SF_WASM_B64', '__post', buildHostScript('__post(msg)'))(SF_JS, SF_WASM_B64, post);
  }, []);
  return null;
}
