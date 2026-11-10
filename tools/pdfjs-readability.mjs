// A documented local modification to pdfjs-dist's bundled core-js Object.create
// fallback. Keep the JavaScript URL literal readable; do not assemble its scheme.
import fs from 'node:fs';
import path from 'node:path';

export const pdfjsReadabilityPatch = {
  id: 'core-js-explicit-javascript-protocol',
  files: ['legacy/build/pdf.mjs', 'legacy/build/pdf.worker.mjs'],
  description: 'Use an explicit javascript: literal and descriptive variable in the bundled core-js legacy iframe fallback; runtime behavior is unchanged.'
};

const upstreamDeclaration = "  var JS = 'java' + SCRIPT + ':';";
const upstreamAssignment = '  iframe.src = String(JS);';
const readableDeclaration = "  var javascriptProtocol = 'javascript:';";
const readableAssignment = '  iframe.src = javascriptProtocol;';
const occurrences = (source, text) => source.split(text).length - 1;

export function assertPdfjsReadabilitySource(source, label) {
  if (/['"]java['"]\s*\+\s*SCRIPT\s*\+/.test(source) ||
      source.includes(upstreamAssignment) ||
      occurrences(source, readableDeclaration) !== 1 ||
      occurrences(source, readableAssignment) !== 1) {
    throw new Error(`${label}: PDF.js readability patch is missing or has drifted`);
  }
}

export function applyPdfjsReadabilityPatch(source, label = 'PDF.js module') {
  // Accept our exact result for idempotence, but stop on a changed upstream
  // implementation so a future dependency update requires an explicit review.
  if (source.includes(readableDeclaration)) {
    assertPdfjsReadabilitySource(source, label);
    return source;
  }
  if (occurrences(source, upstreamDeclaration) !== 1 ||
      occurrences(source, upstreamAssignment) !== 1) {
    throw new Error(`${label}: unexpected upstream core-js fallback; review the readability patch`);
  }
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const declaration = [
    '  // QudadFlow local modification: spell out the protocol in this core-js',
    '  // legacy IE fallback. See THIRD_PARTY_NOTICES.md for patch provenance.',
    readableDeclaration
  ].join(newline);
  const patched = source.replace(upstreamDeclaration, declaration)
    .replace(upstreamAssignment, readableAssignment);
  assertPdfjsReadabilitySource(patched, label);
  return patched;
}

export function patchVendoredPdfjs(root) {
  for (const relative of pdfjsReadabilityPatch.files) {
    const file = path.join(root, 'vendor/pdfjs', relative);
    const source = fs.readFileSync(file, 'utf8');
    const patched = applyPdfjsReadabilityPatch(source, relative);
    if (patched !== source) fs.writeFileSync(file, patched);
  }
}

export function assertVendoredPdfjsReadability(root) {
  for (const relative of pdfjsReadabilityPatch.files) {
    assertPdfjsReadabilitySource(fs.readFileSync(path.join(root, 'vendor/pdfjs', relative), 'utf8'), relative);
  }
}
