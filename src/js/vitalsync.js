// thc-contact-lookup — VitalSync SDK Wrapper
// Vanilla JS wrapper for the VitalSync SDK (loaded via CDN).
// Exposes window.VitalSync with connect/getPlugin/getStatus/onStatusChange.
(function () {
  'use strict';

  var plugin = null;
  var status = 'loading'; // loading | connected | error
  var listeners = [];

  function setStatus(newStatus) {
    status = newStatus;
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](status); } catch (e) { console.error('VitalSync listener error:', e); }
    }
  }

  function onStatusChange(callback) {
    listeners.push(callback);
    return function () {
      listeners = listeners.filter(function (fn) { return fn !== callback; });
    };
  }

  // Wait for the VitalSync SDK script to load
  function waitForSDK(maxWait) {
    maxWait = maxWait || 10000;
    return new Promise(function (resolve, reject) {
      var elapsed = 0;
      var interval = 100;
      var timer = setInterval(function () {
        elapsed += interval;
        if (typeof window.initVitalStatsSDK === 'function') {
          clearInterval(timer);
          resolve();
        } else if (elapsed >= maxWait) {
          clearInterval(timer);
          reject(new Error('VitalSync SDK failed to load after ' + maxWait + 'ms'));
        }
      }, interval);
    });
  }

  // Race a promise against a timeout
  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error((label || 'Operation') + ' timed out after ' + (ms / 1000) + 's'));
      }, ms);
      promise.then(
        function (val) { clearTimeout(timer); resolve(val); },
        function (err) { clearTimeout(timer); reject(err); }
      );
    });
  }

  // Connect to VitalSync
  function connect() {
    var config = window.AppConfig || {};
    if (!config.SLUG) {
      setStatus('error');
      return Promise.reject(new Error('AppConfig.SLUG is not set'));
    }

    setStatus('loading');
    console.log('[VitalSync] Waiting for SDK script to load...');

    return waitForSDK()
      .then(function () {
        console.log('[VitalSync] SDK loaded. Initializing with slug:', config.SLUG);
        var initObservable = window.initVitalStatsSDK({
          slug: config.SLUG,
          apiKey: config.API_KEY || '',
          isDefault: true,
        });
        return withTimeout(initObservable.toPromise(), 30000, 'SDK init');
      })
      .then(function (initResult) {
        console.log('[VitalSync] Init complete:', initResult);
        plugin = (initResult && initResult.plugin) || (window.getVitalStatsPlugin && window.getVitalStatsPlugin());

        if (!plugin) {
          throw new Error('Plugin not available after initialization');
        }

        setStatus('connected');
        console.log('[VitalSync] Connected successfully');
        return plugin;
      })
      .catch(function (err) {
        setStatus('error');
        console.error('[VitalSync] Connection failed:', err);
        throw err;
      });
  }

  function getPlugin() {
    return plugin;
  }

  function getStatus() {
    return status;
  }

  // Expose on window
  window.VitalSync = {
    connect: connect,
    getPlugin: getPlugin,
    getStatus: getStatus,
    onStatusChange: onStatusChange,
  };
})();
