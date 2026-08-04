'use strict';
// inspect-document.js
//
// A minimal, read-only "hello world" for the Affinity scripting SDK. Run it via the
// execute_script MCP tool with a document open. It prints app + document info and
// demonstrates the core module includes. Nothing is modified.
//
// This is a good first call after the preamble to confirm the connection is live end-to-end.

const { app } = require('/application');

console.log('=== Application ===');
console.log('Product : ' + app.productLongName + ' ' + app.version);
console.log('Platform: ' + app.platformName);
console.log('Desktop : ' + app.userDesktopPath);

const all = app.documents.all;
console.log('Open documents: ' + all.length);

const doc = app.documents.current;
if (!doc) {
  console.log('No current document — open an image and run again.');
} else {
  console.log('=== Current document ===');
  console.log('Session UUID: ' + doc.sessionUuid);
  console.log('Spreads     : ' + doc.spreads.length);
  console.log('Top layers  : ' + doc.layers.length);
  console.log('canUndo     : ' + doc.canUndo);

  // Iterate the top-level layers safely.
  const layers = doc.layers.toArray();
  layers.forEach((l, i) => {
    const name = l.userDescription || l.defaultDescription || '(unnamed)';
    console.log('  [' + i + '] ' + name);
  });
}
