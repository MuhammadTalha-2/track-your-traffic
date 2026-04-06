/**
 * Track Your Traffic — Storefront Attribution Tracker (Shopify Edition)
 * ======================================================================
 * Ported from AddOnePlugins aop-traffic-tracker for WordPress.
 * Adapted for Shopify Theme App Extension.
 *
 * FIXES applied vs original minified build:
 *   - Bug: inner function shadowed outer `o` (TYT_CONFIG) with local variable
 *     `o = "tyt_logged_" + pathname`, causing shop:"" in every POST.
 *     Fix: capture shopDomain as top-level `q` variable before any shadowing.
 *   - Bug: admin bar detection used old `admin-bar-iframe` ID only.
 *     Fix: detect all modern Shopify admin / preview bar elements.
 *   - Bug: excludeAdmins was read from theme block setting, not app DB.
 *     Fix: tracker always sends is_admin flag; server decides based on DB.
 */
(function (win, doc) {
  "use strict";

  var cfg = win.TYT_CONFIG || {};

  // ── Top-level config (captured BEFORE any inner shadowing) ──────────────
  var FIRST_TOUCH_KEY  = "tyt_first_touch";
  var LAST_TOUCH_KEY   = "tyt_last_touch";
  var SESSION_KEY      = "tyt_session";
  var cookieDuration   = parseInt(cfg.cookieDuration, 10) || 180;
  var cookieDomain     = (cfg.cookieDomain && cfg.cookieDomain !== "auto") ? cfg.cookieDomain : "";
  var logEndpoint      = cfg.logEndpoint || "";
  var debugMode        = !!cfg.debugMode;
  var shopDomain       = cfg.shopDomain || "";   // captured here — never shadowed

  // ── Lookup tables ────────────────────────────────────────────────────────
  var SEARCH_ENGINES = {
    google: "google", bing: "bing", yahoo: "yahoo", duckduckgo: "duckduckgo",
    baidu: "baidu", yandex: "yandex", ecosia: "ecosia", "ask.com": "ask",
    aol: "aol", naver: "naver"
  };
  var SOCIAL_DOMAINS = {
    "facebook.com": "facebook", "fb.com": "facebook", "l.facebook": "facebook",
    "lm.facebook": "facebook", "t.co": "twitter", "twitter.com": "twitter",
    "x.com": "twitter", "linkedin.com": "linkedin", "lnkd.in": "linkedin",
    "instagram.com": "instagram", "l.instagram": "instagram",
    "pinterest.com": "pinterest", "pin.it": "pinterest",
    "youtube.com": "youtube", "youtu.be": "youtube",
    "reddit.com": "reddit", "tiktok.com": "tiktok", "threads.net": "threads",
    "mastodon": "mastodon", "bsky.app": "bluesky", "tumblr.com": "tumblr",
    "snapchat.com": "snapchat", "whatsapp.com": "whatsapp",
    "wa.me": "whatsapp", "t.me": "telegram", "telegram": "telegram"
  };
  var EMAIL_PROVIDERS = {
    "mail.google": "gmail", "mail.yahoo": "yahoo_mail",
    "outlook.live": "outlook", "outlook.office": "outlook",
    "mail.zoho": "zoho_mail", "mailchimp.com": "mailchimp",
    "campaign-archive.com": "mailchimp", "list-manage.com": "mailchimp",
    "sendgrid.net": "sendgrid", "constantcontact": "constantcontact",
    "klaviyo.com": "klaviyo", "hubspot": "hubspot", "convertkit": "convertkit"
  };
  var CLICK_ID_MAP = {
    gclid:     { source: "google",   medium: "cpc" },
    gbraid:    { source: "google",   medium: "cpc" },
    wbraid:    { source: "google",   medium: "cpc" },
    msclkid:   { source: "bing",     medium: "cpc" },
    fbclid:    { source: "facebook", medium: "paid_social" },
    ttclid:    { source: "tiktok",   medium: "paid_social" },
    twclid:    { source: "twitter",  medium: "paid_social" },
    li_fat_id: { source: "linkedin", medium: "paid_social" },
    srsltid:   { source: "google",   medium: "merchant_center" }
  };
  var CLICK_IDS = Object.keys(CLICK_ID_MAP);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function dbg() {
    if (debugMode) {
      var args = ["[TYT]"].concat(Array.prototype.slice.call(arguments));
      console.log.apply(console, args);
    }
  }

  function matchDomain(hostname, map) {
    if (!hostname) return null;
    for (var key in map) {
      if (map.hasOwnProperty(key) && hostname.indexOf(key) !== -1) return map[key];
    }
    return null;
  }

  function currentPage() {
    return win.location.pathname + win.location.search;
  }

  function setCookie(name, value, days) {
    var expires = "";
    if (days) {
      var d = new Date();
      d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
      expires = "; expires=" + d.toUTCString();
    }
    var cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax";
    if (cookieDomain) cookie += "; domain=" + cookieDomain;
    if (win.location.protocol === "https:") cookie += "; Secure";
    doc.cookie = cookie;
  }

  function getCookie(name) {
    var prefix = name + "=";
    var parts = doc.cookie.split(";");
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (part.indexOf(prefix) === 0) {
        return decodeURIComponent(part.substring(prefix.length));
      }
    }
    return null;
  }

  function deleteCookie(name) { setCookie(name, "", -1); }

  function getCookieJSON(name) {
    var raw = getCookie(name);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function parseReferrerHostname(ref) {
    try {
      if (!ref) return "";
      if (ref.indexOf("//") === -1) ref = "//" + ref;
      var a = doc.createElement("a");
      a.href = ref;
      return (a.hostname || "").toLowerCase();
    } catch (e) { return ""; }
  }

  function getUrlParams() {
    var params = {};
    var search = win.location.search.split("?")[1];
    if (!search) return params;
    search = search.split("#")[0];
    var pairs = search.split("&");
    for (var i = 0; i < pairs.length; i++) {
      var kv = pairs[i].split("=");
      var k = decodeURIComponent((kv[0] || "").replace(/\+/g, " "));
      var v = decodeURIComponent((kv[1] || "").replace(/\+/g, " "));
      if (k) params[k.toLowerCase()] = v;
    }
    return params;
  }

  function classifyUtmMedium(source, medium) {
    var s = (source || "").toLowerCase();
    var m = (medium || "").toLowerCase();
    if (m === "cpc" || m === "ppc" || m === "paid_search" || m === "paidsearch" || m === "sem") return "paid_search";
    if (m === "paid_social" || m === "paidsocial" || m === "social_paid" || m === "cpm") return "paid_social";
    if (m === "display" || m === "banner") return "display";
    if (m === "email" || m === "e-mail" || m === "newsletter") return "email";
    if (m === "affiliate" || m === "partner") return "affiliate";
    if (m === "social" || m === "organic_social") return "organic_social";
    if (m === "organic") return "organic_search";
    if (m === "referral") return "referral";
    if (s === "(direct)" || m === "(none)") return "direct";
    return "other";
  }

  function getActiveClickId() {
    var params = new URLSearchParams(win.location.search);
    for (var i = 0; i < CLICK_IDS.length; i++) {
      if (params.get(CLICK_IDS[i])) return CLICK_IDS[i];
    }
    return "";
  }

  // ── Detect Shopify admin / preview bar ───────────────────────────────────
  // Handles: old admin-bar-iframe, new shopify-preview-bar custom element,
  // and the Shopify theme editor design mode.

  function isAdminBrowsing() {
    // Old Shopify admin bar
    if (doc.getElementById("admin-bar-iframe")) return true;
    // Modern Shopify preview bar (custom element)
    if (doc.querySelector("shopify-preview-bar")) return true;
    // Theme editor / design mode
    if (doc.querySelector("[id*='preview-bar']")) return true;
    if (doc.querySelector("[class*='shopify-preview-bar']")) return true;
    // Shopify admin top-bar frame
    if (doc.querySelector("iframe[name='admin-bar-iframe']")) return true;
    if (doc.querySelector("iframe[src*='admin.shopify.com']")) return true;
    // window.__st is set by Shopify on admin/staff sessions in some themes
    if (win.Shopify && win.Shopify.designMode) return true;
    return false;
  }

  // ── Attribution detection ────────────────────────────────────────────────

  function getAttribution() {
    var params = getUrlParams();
    var referrer = doc.referrer || "";
    var refHostname = parseReferrerHostname(referrer);

    // UTM params present
    if (params.utm_source) {
      return {
        source: params.utm_source,
        medium: params.utm_medium || "(not set)",
        campaign: params.utm_campaign || "(not set)",
        term: params.utm_term || "",
        content: params.utm_content || "",
        channel: classifyUtmMedium(params.utm_source, params.utm_medium),
        landing_page: currentPage(),
        referrer: refHostname
      };
    }

    // Click ID parameters
    for (var i = 0; i < CLICK_IDS.length; i++) {
      var id = CLICK_IDS[i];
      if (params[id]) {
        var meta = CLICK_ID_MAP[id];
        var channel = meta.medium === "cpc" ? "paid_search"
                    : meta.medium === "paid_social" ? "paid_social"
                    : meta.medium === "merchant_center" ? "google_shopping"
                    : "paid";
        return {
          source: meta.source,
          medium: meta.medium,
          campaign: params.utm_campaign || "(auto-tagged)",
          term: params.utm_term || "",
          content: params.utm_content || "",
          click_id: id + "=" + params[id].substring(0, 20) + "...",
          channel: channel,
          landing_page: currentPage(),
          referrer: refHostname
        };
      }
    }

    // Self-referral (navigation within the same store) — no new attribution
    if (refHostname) {
      var ownHost = win.location.hostname.toLowerCase();
      if (refHostname === ownHost || refHostname.indexOf(ownHost) !== -1 || ownHost.indexOf(refHostname) !== -1) {
        return null;
      }
    }

    // Direct (no referrer)
    if (!referrer || !refHostname) {
      return {
        source: "(direct)", medium: "(none)", campaign: "(not set)",
        term: "", content: "", channel: "direct",
        landing_page: currentPage(), referrer: ""
      };
    }

    // Organic search
    var searchEngine = matchDomain(refHostname, SEARCH_ENGINES);
    if (searchEngine) {
      return {
        source: searchEngine, medium: "organic", campaign: "(not set)",
        term: "", content: "", channel: "organic_search",
        landing_page: currentPage(), referrer: refHostname
      };
    }

    // Social
    var socialNetwork = matchDomain(refHostname, SOCIAL_DOMAINS);
    if (socialNetwork) {
      return {
        source: socialNetwork, medium: "social", campaign: "(not set)",
        term: "", content: "", channel: "organic_social",
        landing_page: currentPage(), referrer: refHostname
      };
    }

    // Email
    var emailProvider = matchDomain(refHostname, EMAIL_PROVIDERS);
    if (emailProvider) {
      return {
        source: emailProvider, medium: "email", campaign: "(not set)",
        term: "", content: "", channel: "email",
        landing_page: currentPage(), referrer: refHostname
      };
    }

    // Generic referral
    return {
      source: refHostname, medium: "referral", campaign: "(not set)",
      term: "", content: "", channel: "referral",
      landing_page: currentPage(), referrer: refHostname
    };
  }

  // ── Log visit / event to server ─────────────────────────────────────────

  function sendToServer(payload) {
    if (!logEndpoint) {
      dbg("No logEndpoint configured — skipping server log.");
      return;
    }
    dbg("Sending to server:", payload);
    fetch(logEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).then(function (res) {
      return res.json();
    }).then(function (json) {
      dbg("Server response:", json);
    }).catch(function (err) {
      dbg("Log request failed:", err);
    });
  }

  function buildPayload(data, eventType) {
    return {
      shop: shopDomain,
      source: data.source || "",
      medium: data.medium || "",
      campaign: data.campaign || "",
      channel: data.channel || "",
      landing_page: win.location.pathname + win.location.search,
      referrer: data.referrer || "",
      click_id_type: getActiveClickId(),
      is_admin: isAdminBrowsing(),
      event_type: eventType || "pageview"
    };
  }

  function logVisit(data) {
    // Deduplicate: only log pageview once per page per browser session
    var sessionKey = "tyt_logged_" + win.location.pathname;
    try {
      if (win.sessionStorage.getItem(sessionKey)) {
        dbg("Already logged this page in this session — skipping.");
        return;
      }
      win.sessionStorage.setItem(sessionKey, "1");
    } catch (e) { /* sessionStorage blocked */ }

    sendToServer(buildPayload(data, "pageview"));
  }

  // ── Conversion event detection ───────────────────────────────────────────

  function getPageEventType() {
    var path = win.location.pathname.toLowerCase();
    // Shopify thank-you / order confirmation
    if (path.indexOf("/thank_you") !== -1 || path.indexOf("/orders/") !== -1) return "purchase";
    // Shopify checkout pages
    if (path.indexOf("/checkouts/") !== -1 || path.indexOf("/checkout") !== -1) return "checkout";
    return "pageview";
  }

  function logConversionEvent(eventType, data) {
    // Deduplicate: fire each conversion event type once per page session
    var sessionKey = "tyt_event_" + eventType + "_" + win.location.pathname;
    try {
      if (win.sessionStorage.getItem(sessionKey)) {
        dbg("Already fired " + eventType + " on this page — skipping.");
        return;
      }
      win.sessionStorage.setItem(sessionKey, "1");
    } catch (e) { /* sessionStorage blocked */ }

    dbg("Conversion event:", eventType);
    sendToServer(buildPayload(data || {}, eventType));
  }

  function setupConversionTracking(attribution) {
    var data = attribution || { source: "(direct)", medium: "(none)", campaign: "(not set)",
                                channel: "direct", referrer: "" };

    // 1. URL-based checkout / purchase detection (fires on page load)
    var pageEvent = getPageEventType();
    if (pageEvent !== "pageview") {
      logConversionEvent(pageEvent, data);
    }

    // 2. Add-to-cart — listen for Shopify's native cart event (Dawn + many themes)
    doc.addEventListener("cart:item_added", function () {
      logConversionEvent("add_to_cart", data);
    });

    // 3. Add-to-cart via fetch interception (works with AJAX cart themes)
    if (win.fetch) {
      var origFetch = win.fetch.bind(win);
      win.fetch = function (input, init) {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        var promise = origFetch(input, init);
        if (url.indexOf("/cart/add") !== -1) {
          promise.then(function (res) {
            if (res.ok) {
              // Clone so the original response is still consumable
              logConversionEvent("add_to_cart", data);
            }
            return res;
          }).catch(function () {});
        }
        return promise;
      };
    }

    // 4. Add-to-cart via XMLHttpRequest interception (older themes)
    var OrigXHR = win.XMLHttpRequest;
    win.XMLHttpRequest = function () {
      var xhr = new OrigXHR();
      var origOpen = xhr.open.bind(xhr);
      xhr.open = function (method, url) {
        if (typeof url === "string" && url.indexOf("/cart/add") !== -1) {
          xhr.addEventListener("load", function () {
            if (xhr.status >= 200 && xhr.status < 300) {
              logConversionEvent("add_to_cart", data);
            }
          });
        }
        return origOpen.apply(xhr, arguments);
      };
      return xhr;
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────

  win.TYTTracker = {
    getFirstTouch:  function () { return getCookieJSON(FIRST_TOUCH_KEY); },
    getLastTouch:   function () { return getCookieJSON(LAST_TOUCH_KEY); },
    getSession:     function () { return getCookieJSON(SESSION_KEY); },
    getAll: function () {
      return {
        first_touch: this.getFirstTouch(),
        last_touch:  this.getLastTouch(),
        session:     this.getSession()
      };
    },
    reset: function () {
      deleteCookie(FIRST_TOUCH_KEY);
      deleteCookie(LAST_TOUCH_KEY);
      deleteCookie(SESSION_KEY);
      dbg("All attribution cookies cleared.");
    }
  };

  // ── Bootstrap ────────────────────────────────────────────────────────────

  (function () {
    var attribution = getAttribution();

    if (!attribution) {
      dbg("Self-referral detected — logging pageview with existing attribution.");
      var existingTouch = getCookieJSON(LAST_TOUCH_KEY);
      // Log pageview with existing attribution so internal navigation is counted
      if (existingTouch) {
        logVisit(existingTouch);
      }
      setupConversionTracking(existingTouch);
      return;
    }

    var serialised = JSON.stringify(attribution);

    // First touch — set once, never overwritten
    if (!getCookie(FIRST_TOUCH_KEY)) {
      setCookie(FIRST_TOUCH_KEY, serialised, cookieDuration);
      dbg("First touch set:", attribution);
    }

    // Last touch — update whenever there is a new non-direct source
    var existingLastTouch = getCookie(LAST_TOUCH_KEY);
    if (attribution.channel !== "direct" || !existingLastTouch) {
      setCookie(LAST_TOUCH_KEY, serialised, cookieDuration);
      dbg("Last touch updated:", attribution);
    }

    // Session touch — always refresh (expires with browser session)
    setCookie(SESSION_KEY, serialised, 0);

    // Log pageview + set up conversion event listeners
    logVisit(attribution);
    setupConversionTracking(attribution);
  })();

}(window, document));
