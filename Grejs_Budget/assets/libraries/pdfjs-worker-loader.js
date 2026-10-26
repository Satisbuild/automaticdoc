// Worker til PDF-læseren (js/pdf-import.js). Tilføjer Promise.withResolvers, som pdf.js kræver,
// men som ældre browsere (fx Safari før 17.4) mangler – og indlæser derefter pdf.js' egen worker.
// pdf.js venter på workerens "ready"-besked, så det er sikkert at indlæse den asynkront.
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new this((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
  };
}
import('./pdfjs-6.4.299/pdf.worker.min.js');
