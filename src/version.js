// Read the running installation so copied UI text cannot report a stale version.
(() => {
  const footer=document.createElement('footer');footer.className='product-version';
  footer.textContent='QudadFlow Translator · v'+chrome.runtime.getManifest().version;
  footer.setAttribute('aria-label',footer.textContent);document.body.append(footer);
})();
