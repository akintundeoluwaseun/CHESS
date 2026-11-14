import React, { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView as RNWebView, WebViewMessageEvent } from 'react-native-webview';

// Class-component typings of react-native-webview lag behind React 19 types.
const WebView = RNWebView as unknown as React.ComponentType<any>;
import { Engine, WorkerId } from './EngineService';
import { buildHostScript } from './hostScript';
import { SF_JS, SF_WASM_B64 } from './generated/stockfishBundle';

let htmlCache: string | null = null;
function hostHtml(): string {
  if (htmlCache) return htmlCache;
  const safe = (s: string) => JSON.stringify(s).replace(/<\//g, '<\\/');
  htmlCache = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>var SF_JS=${safe(SF_JS)};var SF_WASM_B64=${safe(SF_WASM_B64)};${buildHostScript('window.ReactNativeWebView.postMessage(JSON.stringify(msg))')}</script></body></html>`;
  return htmlCache;
}

/**
 * Hidden WebView hosting two Stockfish WASM workers. Runs fully offline.
 * If the WebView process dies (low memory), it is remounted and the engine
 * re-initialised transparently.
 */
export function EngineHost() {
  const ref = useRef<any>(null);
  const [key, setKey] = useState(0);
  const html = useMemo(hostHtml, []);

  const attach = () => {
    Engine.attach({
      send: (w: WorkerId, cmd: string) => {
        ref.current?.injectJavaScript(`self.__sfSend(${JSON.stringify(w)}, ${JSON.stringify(cmd)}); true;`);
      },
    });
  };

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: any;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.t === 'boot') { attach(); Engine.handshake(); }
    else if (msg.t === 'lines') for (const [w, l] of msg.b) Engine.onLine(w, l);
    else if (msg.t === 'crash') Engine.onCrash(msg.w);
    else if (msg.t === 'error') Engine.fail(msg.m);
  };

  const restart = () => { Engine.detach(); setKey((k) => k + 1); };

  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 }}>
      <WebView
        key={key}
        ref={ref}
        source={{ html, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={onMessage}
        onRenderProcessGone={restart}
        onContentProcessDidTerminate={restart}
        onError={(ev: any) => Engine.fail(ev.nativeEvent.description || 'Engine failed to load')}
        setSupportMultipleWindows={false}
        cacheEnabled={false}
        androidLayerType="none"
      />
    </View>
  );
}
