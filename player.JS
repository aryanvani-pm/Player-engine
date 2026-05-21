// Engine Version: 1.1.1 (Unified Lifecycle Build)
(function () {
  if (window.__adtech_engine_active__) return;
  window.__adtech_engine_active__ = true;

  var currentScript = document.currentScript || document.getElementById("adtech-player-core");
  if (!currentScript) return;

  var cfg = {
    publisherId: currentScript.getAttribute("data-pub-id") || "",
    adUnitId:    currentScript.getAttribute("data-adunit-id") || "",
    adTagUrl:    currentScript.getAttribute("data-tag") || "",
    timeout:     parseInt(currentScript.getAttribute("data-timeout"), 10) || 1200,
    floorBias:   parseFloat(currentScript.getAttribute("data-bias")) || 0.10,
    videoUrl:    currentScript.getAttribute("data-video") || "",
    autoplay:    currentScript.getAttribute("data-autoplay") === "true",
    muted:       currentScript.getAttribute("data-muted") === "true",
    fluid:       currentScript.getAttribute("data-fluid") !== "false",
    loop:        currentScript.getAttribute("data-loop") === "true",
    preload:     currentScript.getAttribute("data-preload") || "metadata",
    vpaidMode:   currentScript.getAttribute("data-vpaid") || "insecure",
    divId:       currentScript.getAttribute("data-div-id") || "comparos-video-placement",
    bidderHost:  currentScript.getAttribute("data-host") || "ads-jbi003.rtba.bidsxchange.com",
    cacheUrl:    currentScript.getAttribute("data-cache") || "https://prebid.adnxs.com/pbc/v1/cache",
    prebidUrl:   currentScript.getAttribute("data-prebid-url") || "prebid.js"
  };

  var DEBUG = /[?&]debug=true/i.test((window.location && window.location.search) || "");
  function step(n, m) { if (!DEBUG) return; console.log("%c STEP " + n + " %c " + m, "background:#7c4dff;color:#fff;font-weight:bold;padding:2px 8px;", "color:#4ade80;"); }

  function stitchTag(base, bidder, cpm) {
    try {
      var u = new URL(base);
      u.searchParams.set("correlator", Date.now().toString());
      var hb = "hb_pb=" + cpm.toFixed(2) + "&hb_bidder=" + (bidder || "none");
      u.searchParams.set("cust_params", (u.searchParams.get("cust_params") || "") ? u.searchParams.get("cust_params") + "&" + hb : hb);
      return u.toString();
    } catch (e) { return base; }
  }

  function loadCss(href) {
    if (!href || document.querySelector('link[data-atp="' + href + '"]')) return;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; l.setAttribute("data-atp", href);
    (document.head || document.documentElement).appendChild(l);
  }

  function loadScript(src) {
    return new Promise(function (resolve) {
      var existing = document.querySelector('script[data-atp="' + src + '"]');
      if (existing) { if (existing.getAttribute("data-loaded") === "1") resolve(); else existing.addEventListener("load", function () { resolve(); }); return; }
      var s = document.createElement("script"); s.src = src; s.async = false; s.setAttribute("data-atp", src);
      s.onload = function () { s.setAttribute("data-loaded", "1"); resolve(); };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  function ensureMount() {
    var container = document.getElementById(cfg.divId);
    if (container) return container;
    container = document.createElement("div");
    container.id = cfg.divId;
    container.style.cssText = cfg.fluid ? "max-width:960px;width:100%;margin:0 auto;position:relative;background:#000;aspect-ratio:16/9;" : "width:640px;height:480px;margin:0 auto;position:relative;background:#000;";
    var video = document.createElement("video");
    video.id = cfg.divId + "_video";
    video.className = "vjs-default-skin vjs-big-play-centered";
    video.setAttribute("playsinline", ""); video.setAttribute("controls", ""); video.setAttribute("preload", cfg.preload);
    if (cfg.loop) video.setAttribute("loop", "");
    video.style.cssText = "width:100%;height:100%;";
    if (cfg.muted) { video.muted = true; video.setAttribute("muted", ""); }
    if (cfg.autoplay) video.setAttribute("autoplay", "");
    container.appendChild(video);
    if (currentScript && currentScript.parentNode) currentScript.parentNode.insertBefore(container, currentScript.nextSibling);
    return container;
  }

  function setupPlayer(finalTagUrl) {
    if (typeof videojs === "undefined" || typeof google === "undefined" || !google.ima) return;
    var container = document.getElementById(cfg.divId);
    var videoEl   = document.getElementById(cfg.divId + "_video");
    if (!container || !videoEl) return;

    var isHLS = /\.m3u8/i.test(cfg.videoUrl);
    var player = videojs.getPlayer(videoEl.id) || videojs.getPlayer(videoEl);
    
    if (!player) {
      try {
        videoEl.className = "video-js vjs-default-skin vjs-big-play-centered";
        player = videojs(videoEl, { autoplay: cfg.autoplay, muted: cfg.muted, controls: true, fluid: cfg.fluid, loop: cfg.loop, preload: cfg.preload, sources: [{ src: cfg.videoUrl, type: isHLS ? "application/x-mpegURL" : "video/mp4" }] });
      } catch (e) { return; }
    }

    player.ready(function () {
      var playerWrapper = player.el();
      if (!playerWrapper) return;

      var adContainer = playerWrapper.querySelector(".adtech-ad-overlay");
      if (!adContainer) {
        adContainer = document.createElement("div");
        adContainer.className = "adtech-ad-overlay";
        playerWrapper.appendChild(adContainer);
      }
      
      // ⚡ LIFECYCLE CLASS MANAGER
      function activateAd() {
        container.classList.add("ad-active");
        player.pause();
      }
      
      function deactivateAd() {
        container.classList.remove("ad-active");
        player.play().catch(function(){});
      }
      
      try {
        var adc = new google.ima.AdDisplayContainer(adContainer, videoEl);
        var loader = new google.ima.AdsLoader(adc);
        
        loader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, function () { deactivateAd(); }, false);
        loader.addEventListener(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, function (e) {
          var mgr = e.getAdsManager(videoEl);
          mgr.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, function () { deactivateAd(); try { mgr.destroy(); } catch(_) {} });
          mgr.addEventListener(google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED, function () { activateAd(); });
          mgr.addEventListener(google.ima.AdEvent.Type.STARTED, function () { activateAd(); });
          mgr.addEventListener(google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, function () { deactivateAd(); });
          mgr.addEventListener(google.ima.AdEvent.Type.ALL_ADS_COMPLETED, function () { deactivateAd(); try { mgr.destroy(); } catch(_) {} });
          
          var w = container.offsetWidth || 640, h = container.offsetHeight || 360;
          mgr.init(w, h, google.ima.ViewMode.NORMAL); mgr.start();
        }, false);

        var req = new google.ima.AdsRequest();
        req.adTagUrl = finalTagUrl;
        req.linearAdSlotWidth = container.offsetWidth || 640;
        req.linearAdSlotHeight = container.offsetHeight || 360;
        adc.initialize();
        loader.requestAds(req);
        step(6, "VAST Dispatch.");
      } catch (e) {}
    });
  }

  function runAuction() {
    if (typeof pbjs === "undefined") { setupPlayer(stitchTag(cfg.adTagUrl, "none", 0)); return; }
    pbjs.que.push(function () {
      var buckets = [];
      for (var i = 0; i <= 30; i++) buckets.push({ min: (i * 0.10).toFixed(2), max: ((i + 1) * 0.10).toFixed(2), increment: 0.10 });
      pbjs.setConfig({ bidderTimeout: cfg.timeout, cache: { url: cfg.cacheUrl }, priceGranularity: { buckets: buckets } });
      var code = "atp-" + Date.now();
      pbjs.addAdUnits([{ code: code, mediaTypes: { video: { context: "instream", playerSize: [640, 360], mimes: ["video/mp4", "application/x-mpegURL"], protocols: [1,2,3,4,5,6], playbackmethod: [2], skip: 0 } }, bids: [{ bidder: "limelightDigital", params: { host: cfg.bidderHost, publisherId: cfg.publisherId, adUnitId: parseInt(cfg.adUnitId, 10), adUnitType: "video" } }] }]);
      
      pbjs.requestBids({
        timeout: cfg.timeout,
        bidsBackHandler: function () {
          var winner = (pbjs.getHighestCpmBids(code) || [])[0];
          var finalUrl = winner ? stitchTag(cfg.adTagUrl, winner.bidder, Math.floor((winner.cpm + cfg.floorBias) / 0.10) * 0.10) : stitchTag(cfg.adTagUrl, "none", 0);
          setupPlayer(finalUrl);
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadCss("https://cdn.jsdelivr.net/npm/video.js@8/dist/video-js.min.css");
    ensureMount();
    Promise.all([
      loadScript("https://cdn.jsdelivr.net/npm/video.js@8/dist/video.min.js"),
      loadScript("https://imasdk.googleapis.com/js/sdkloader/ima3.js"),
      loadScript(cfg.prebidUrl)
    ]).then(runAuction);
  });
})();
