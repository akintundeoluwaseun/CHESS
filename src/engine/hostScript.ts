/**
 * Script that runs inside the engine host (a hidden WebView on Android/iOS,
 * or the page itself on web). It creates two Stockfish Web Workers from the
 * embedded sources and relays UCI text in both directions. Output lines are
 * filtered (only lines we use) and batched to keep bridge traffic low.
 */
export function buildHostScript(postExpr: string): string {
  return `
(function(){
  function post(msg){ try { ${postExpr} } catch(e){} }
  try {
    var bin = atob(SF_WASM_B64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var wasmUrl = URL.createObjectURL(new Blob([bytes], {type: 'application/wasm'}));
    var jsUrl = URL.createObjectURL(new Blob([SF_JS], {type: 'application/javascript'}));
    var workers = {};
    var buf = [];
    var timer = null;
    function flush(){ timer = null; if (buf.length) { var b = buf; buf = []; post({t:'lines', b:b}); } }
    function keep(l){
      if (l.indexOf('info') === 0) return l.indexOf(' pv ') > 0 && l.indexOf('bound') < 0;
      return l === 'uciok' || l === 'readyok' || l.indexOf('bestmove') === 0;
    }
    function spawn(id){
      var w = new Worker(jsUrl + '#' + encodeURIComponent(wasmUrl));
      w.onmessage = function(e){
        var l = typeof e.data === 'string' ? e.data : '';
        if (!keep(l)) return;
        buf.push([id, l]);
        if (l === 'uciok' || l === 'readyok' || l.indexOf('bestmove') === 0) flush();
        else if (!timer) timer = setTimeout(flush, 40);
      };
      w.onerror = function(e){
        // The engine aborted: replace the worker and tell the app so it can retry.
        try { w.terminate(); } catch (x) {}
        spawn(id);
        post({t:'crash', w:id, m: String((e && e.message) || 'worker error')});
      };
      workers[id] = w;
    }
    spawn('play'); spawn('analysis');
    self.__sfSend = function(id, cmd){ var w = workers[id]; if (w) w.postMessage(cmd); };
    post({t:'boot'});
  } catch (e) {
    post({t:'error', m: String(e && e.message || e)});
  }
})();
true;`;
}
