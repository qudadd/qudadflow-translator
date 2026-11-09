/* global chrome */
// Invoke request() directly from a click/submit, before unrelated async work.
globalThis.QFWebsiteAccess = Object.freeze({
  origins: Object.freeze(['https://*/*', 'http://*/*']),
  contains() { return chrome.permissions.contains({origins: [...this.origins]}); },
  request() { return chrome.permissions.request({origins: [...this.origins]}); }
});
