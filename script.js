const TRACKED_QUERY_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
  "msclkid",
  "ref",
];
const ATTRIBUTION_STORAGE_KEYS = {
  firstTouch: "sanctify:first-touch",
  lastTouch: "sanctify:last-touch",
};
const CONSENT_STORAGE_KEYS = {
  local: "sanctify:tracking-consent:v1",
  cookie: "sanctify_tracking_consent_v1",
};
const APP_SIGNUP_HOST = "app.sanctify.faith";
const POSTHOG_PROJECT_KEY = "phc_wrdQPfbQNZBPemwgKJmripmKxvKRAMRXYkNNsyvC3jNk";
const POSTHOG_API_HOST = "https://us.i.posthog.com";
const KLAVIYO_COMPANY_ID = "TWQUrK";
const KLAVIYO_SCRIPT_URL = `https://static.klaviyo.com/onsite/js/${KLAVIYO_COMPANY_ID}/klaviyo.js?company_id=${KLAVIYO_COMPANY_ID}`;
const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector(".menu-toggle");
const heroStage = document.querySelector("[data-tilt] .hero-stage");
const profileTabs = document.querySelectorAll(".profile-tab");
const currentPagePath = window.location.pathname || "/";
const currentPage = currentPagePath.split("/").pop() || "index.html";
const currentPageName = currentPage === "index.html" ? "home" : currentPage.replace(".html", "");
const dataLayer = (window.dataLayer = window.dataLayer || []);
let posthog = null;
let posthogInitialized = false;
let klaviyo = null;
let klaviyoInitialized = false;
let pageViewTracked = false;
let consentBannerMounted = false;
let consentBannerOpen = false;
let consentBanner = null;
let consentBannerStatus = null;
let consentManageButton = null;
let attributionState = {
  firstTouch: null,
  lastTouch: null,
  current: null,
};

const profileContent = {
  evangelical: {
    title: "Boundaries for discipleship at home.",
    copy:
      "A quieter layer of protection around explicit content, addictive patterns, and media that works against the standards your family is keeping.",
    chips: ["Adult content", "Predatory media", "High-risk searches"],
  },
  mainline: {
    title: "A thoughtful rhythm for shared screens.",
    copy:
      "A steady filter for explicit content, manipulative media, and digital spaces that pull attention away from peace, service, and worship.",
    chips: ["Explicit media", "Gambling", "Exploitative content"],
  },
  catholic: {
    title: "Care shaped around formation.",
    copy:
      "Support chastity, dignity, family life, and spiritual discipline with a calm path to guidance when someone needs help.",
    chips: ["Adult content", "Occult content", "Addictive platforms"],
  },
  lds: {
    title: "A quieter internet for covenant homes.",
    copy:
      "A home setting for explicit media, addictive behavior loops, and content that weakens the digital environment at home.",
    chips: ["Explicit media", "Substance content", "Predatory content"],
  },
  jewish: {
    title: "A home setting with higher boundaries.",
    copy:
      "Support modesty, family standards, and community accountability across the devices your household shares.",
    chips: ["Immodest media", "Adult content", "Unreviewed video"],
  },
  muslim: {
    title: "A digital layer for a home guided by faith.",
    copy:
      "Help protect attention, modesty, and family values from online patterns that work against a peaceful home.",
    chips: ["Adult content", "Gambling", "Harmful entertainment"],
  },
};

const safeReadStorage = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
};

const safeWriteStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    // Ignore storage failures in private browsing or restricted contexts.
  }
};

const safeRemoveStorage = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    // Ignore storage failures in private browsing or restricted contexts.
  }
};

const shouldLoadPostHog = () => {
  const hostname = window.location.hostname;
  if (!hostname) return false;
  return hostname !== "localhost" && !hostname.startsWith("127.") && !hostname.endsWith(".local");
};

const shouldLoadKlaviyo = () => shouldLoadPostHog();

const parseStoredValue = (key) => {
  const value = safeReadStorage(key);
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const readCookie = (name) => {
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  const prefix = `${name}=`;
  const match = cookies.find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : "";
};

const canUseSharedConsentCookie = () => /(^|\.)sanctify\.faith$/i.test(window.location.hostname || "");

const writeConsentCookie = (value) => {
  const parts = [
    `${CONSENT_STORAGE_KEYS.cookie}=${encodeURIComponent(value)}`,
    "Path=/",
    "Max-Age=31536000",
    "SameSite=Lax",
  ];

  if (canUseSharedConsentCookie()) {
    parts.push("Domain=.sanctify.faith");
  }

  if (window.location.protocol === "https:") {
    parts.push("Secure");
  }

  document.cookie = parts.join("; ");
};

const expireCookie = (name, domain) => {
  const parts = [`${name}=`, "Path=/", "Max-Age=0", "SameSite=Lax"];

  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  if (window.location.protocol === "https:") {
    parts.push("Secure");
  }

  document.cookie = parts.join("; ");
};

const readTrackingConsent = () => {
  const stored = safeReadStorage(CONSENT_STORAGE_KEYS.local) || readCookie(CONSENT_STORAGE_KEYS.cookie);
  if (stored === "granted" || stored === "denied") return stored;
  return "unknown";
};

const writeTrackingConsent = (value) => {
  safeWriteStorage(CONSENT_STORAGE_KEYS.local, value);
  writeConsentCookie(value);
};

const hasTrackingConsent = () => readTrackingConsent() === "granted";

const clearStoredAttribution = () => {
  safeRemoveStorage(ATTRIBUTION_STORAGE_KEYS.firstTouch);
  safeRemoveStorage(ATTRIBUTION_STORAGE_KEYS.lastTouch);
};

const isExternalReferrer = (referrer) => {
  if (!referrer) return false;

  try {
    return new URL(referrer).origin !== window.location.origin;
  } catch (error) {
    return false;
  }
};

const getTrackedParams = (searchParams = new URLSearchParams(window.location.search)) => {
  const params = {};

  TRACKED_QUERY_PARAMS.forEach((key) => {
    const value = searchParams.get(key);
    if (value) {
      params[key] = value;
    }
  });

  return params;
};

const buildAttributionSnapshot = () => ({
  page: `${window.location.pathname}${window.location.search}`,
  title: document.title,
  referrer: document.referrer || "",
  timestamp: new Date().toISOString(),
  params: getTrackedParams(),
});

const computeAttributionState = (persist) => {
  const snapshot = buildAttributionSnapshot();

  if (!hasTrackingConsent()) {
    return {
      firstTouch: null,
      lastTouch: null,
      current: snapshot,
    };
  }

  const storedFirstTouch = parseStoredValue(ATTRIBUTION_STORAGE_KEYS.firstTouch);
  const storedLastTouch = parseStoredValue(ATTRIBUTION_STORAGE_KEYS.lastTouch);
  const hasTrackedParams = Object.keys(snapshot.params).length > 0;
  const shouldReplaceLastTouch = hasTrackedParams || isExternalReferrer(snapshot.referrer);
  const firstTouch = storedFirstTouch || snapshot;
  const lastTouch = shouldReplaceLastTouch || !storedLastTouch ? snapshot : storedLastTouch;

  if (persist) {
    safeWriteStorage(ATTRIBUTION_STORAGE_KEYS.firstTouch, JSON.stringify(firstTouch));
    safeWriteStorage(ATTRIBUTION_STORAGE_KEYS.lastTouch, JSON.stringify(lastTouch));
  }

  return {
    firstTouch,
    lastTouch,
    current: snapshot,
  };
};

const refreshAttributionState = (persist = hasTrackingConsent()) => {
  attributionState = computeAttributionState(persist);
  return attributionState;
};

const mergedAttributionParams = () => {
  if (!hasTrackingConsent()) return {};

  return {
    ...(attributionState.firstTouch?.params || {}),
    ...(attributionState.lastTouch?.params || {}),
    ...(attributionState.current?.params || {}),
  };
};

const serializeSnapshot = (snapshot) => {
  if (!snapshot) return "";

  const paramSummary = Object.entries(snapshot.params || {})
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");

  return [
    snapshot.page ? `page=${snapshot.page}` : "",
    snapshot.referrer ? `referrer=${snapshot.referrer}` : "",
    paramSummary ? `params=${paramSummary}` : "",
    snapshot.timestamp ? `captured=${snapshot.timestamp}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
};

const buildAttributionProperties = (prefix, snapshot) => {
  if (!snapshot) return {};

  const properties = {
    [`${prefix}_page`]: snapshot.page || "",
    [`${prefix}_referrer`]: snapshot.referrer || "",
    [`${prefix}_captured_at`]: snapshot.timestamp || "",
  };

  Object.entries(snapshot.params || {}).forEach(([key, value]) => {
    properties[`${prefix}_${key}`] = value;
  });

  return properties;
};

const splitFullName = (fullName) => {
  const normalized = String(fullName || "").trim();
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const parts = normalized.split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
};

const installPostHogStub = () => {
  if (window.posthog?.init || window.posthog?.__SV) return;

  !(function (t, e) {
    let o;
    let p;
    let r;
    if (e.__SV) return;
    window.posthog = e;
    e._i = [];
    e.init = function (projectKey, config, name) {
      const stub = name !== undefined ? (e[name] = []) : e;
      const attach = function (target, methodName) {
        const parts = methodName.split(".");
        if (parts.length === 2) {
          target = target[parts[0]];
          methodName = parts[1];
        }
        target[methodName] = function () {
          target.push([methodName].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      p = t.createElement("script");
      p.type = "text/javascript";
      p.crossOrigin = "anonymous";
      p.async = true;
      p.src = `${config.api_host.replace(".i.posthog.com", "-assets.i.posthog.com")}/static/array.js`;
      r = t.getElementsByTagName("script")[0];
      r.parentNode.insertBefore(p, r);
      if (name === undefined) name = "posthog";
      stub.people = stub.people || [];
      stub.toString = function (withStub) {
        let label = "posthog";
        if (name !== "posthog") label += `.${name}`;
        if (!withStub) label += " (stub)";
        return label;
      };
      stub.people.toString = function () {
        return `${stub.toString(1)}.people (stub)`;
      };
      const methods =
        "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(
          " "
        );
      for (o = 0; o < methods.length; o += 1) {
        attach(stub, methods[o]);
      }
      e._i.push([projectKey, config, name]);
    };
    e.__SV = 1;
  })(document, window.posthog || []);
};

const installKlaviyoStub = () => {
  if (window.klaviyo?.identify || window.klaviyo?.track) return;

  window._klOnsite = window._klOnsite || [];

  try {
    window.klaviyo = new Proxy(
      {},
      {
        get(_target, methodName) {
          if (methodName === "push") {
            return function () {
              window._klOnsite.push.apply(window._klOnsite, arguments);
            };
          }

          return function () {
            const args = Array.from(arguments);
            const callback = typeof args[args.length - 1] === "function" ? args.pop() : undefined;

            return new Promise((resolve) => {
              window._klOnsite.push([
                methodName,
                ...args,
                function (result) {
                  callback?.(result);
                  resolve(result);
                },
              ]);
            });
          };
        },
      }
    );
  } catch (error) {
    window.klaviyo = window.klaviyo || [];
    window.klaviyo.push = function () {
      window._klOnsite.push.apply(window._klOnsite, arguments);
    };
  }
};

const initPostHog = () => {
  if (!hasTrackingConsent() || !shouldLoadPostHog()) {
    return null;
  }

  if (!posthogInitialized) {
    installPostHogStub();
    window.posthog.init(POSTHOG_PROJECT_KEY, {
      api_host: POSTHOG_API_HOST,
      defaults: "2026-01-30",
      autocapture: false,
      capture_dead_clicks: false,
      disable_session_recording: true,
      enable_heatmaps: false,
      persistence: "localStorage+cookie",
    });
    posthog = window.posthog;
    posthogInitialized = true;
  } else {
    posthog = window.posthog || posthog;
    posthog?.clear_opt_in_out_capturing?.();
    posthog?.opt_in_capturing?.();
  }

  return posthog;
};

const initKlaviyo = () => {
  if (!hasTrackingConsent() || !shouldLoadKlaviyo()) {
    return null;
  }

  if (!klaviyoInitialized) {
    installKlaviyoStub();

    if (!document.getElementById("sanctify-klaviyo-js")) {
      const script = document.createElement("script");
      script.id = "sanctify-klaviyo-js";
      script.async = true;
      script.type = "text/javascript";
      script.src = KLAVIYO_SCRIPT_URL;
      document.head.appendChild(script);
    }

    klaviyo = window.klaviyo;
    klaviyoInitialized = true;
  } else {
    klaviyo = window.klaviyo || klaviyo;
  }

  return klaviyo;
};

const syncPostHogAttribution = () => {
  if (!hasTrackingConsent()) return;

  const activePosthog = initPostHog();
  if (!activePosthog) return;

  activePosthog.register_once({
    ...buildAttributionProperties("initial_touch", attributionState.firstTouch),
    initial_touch_page_name: currentPageName,
  });

  activePosthog.register({
    ...buildAttributionProperties("latest_touch", attributionState.lastTouch),
    latest_touch_page_name: currentPageName,
  });
};

const clearKlaviyoCookies = () => {
  expireCookie("__kla_id");

  if (canUseSharedConsentCookie()) {
    expireCookie("__kla_id", ".sanctify.faith");
  }
};

const identifyKlaviyoProfile = ({ email, fullName = "", interestTag = "", sourcePage = currentPageName } = {}) => {
  if (!email) return;

  const activeKlaviyo = initKlaviyo();
  if (!activeKlaviyo) return;

  const { firstName, lastName } = splitFullName(fullName);

  activeKlaviyo.identify({
    email,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    interest_tag: interestTag,
    source_page: sourcePage,
  });
};

const trackKlaviyoEvent = (eventName, properties = {}) => {
  const activeKlaviyo = initKlaviyo();
  if (!activeKlaviyo) return;

  activeKlaviyo.track(eventName, properties);
};

const clearAttributionFields = () => {
  document.querySelectorAll("[data-attribution-field]").forEach((input) => {
    input.value = "";
  });
};

const enrichSignupLinks = () => {
  const trackingEnabled = hasTrackingConsent();
  const attributionParams = trackingEnabled ? mergedAttributionParams() : {};

  document.querySelectorAll("a[href]").forEach((link) => {
    const href = link.dataset.baseHref || link.getAttribute("href");
    if (!href) return;
    if (!link.dataset.baseHref) {
      link.dataset.baseHref = href;
    }

    let url;

    try {
      url = new URL(link.dataset.baseHref, window.location.href);
    } catch (error) {
      return;
    }

    if (url.hostname !== APP_SIGNUP_HOST || !url.pathname.startsWith("/signup")) {
      return;
    }

    if (!trackingEnabled) {
      link.href = url.toString();
      return;
    }

    Object.entries(attributionParams).forEach(([key, value]) => {
      if (value && !url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    });

    if (!url.searchParams.has("origin_page")) {
      url.searchParams.set("origin_page", currentPageName);
    }

    if (link.dataset.track && !url.searchParams.has("cta")) {
      url.searchParams.set("cta", link.dataset.track);
    }

    link.href = url.toString();
  });
};

const populateAttributionFields = () => {
  if (!hasTrackingConsent()) {
    clearAttributionFields();
    return;
  }

  const attributionParams = mergedAttributionParams();

  document.querySelectorAll("[data-attribution-field]").forEach((input) => {
    const field = input.dataset.attributionField;
    if (!field) return;

    if (field === "first_touch") {
      input.value = serializeSnapshot(attributionState.firstTouch);
      return;
    }

    if (field === "last_touch") {
      input.value = serializeSnapshot(attributionState.lastTouch);
      return;
    }

    if (field === "origin_page") {
      input.value = currentPageName;
      return;
    }

    input.value = attributionParams[field] || "";
  });
};

const trackEvent = (eventName, detail = {}) => {
  const properties = {
    page_name: currentPageName,
    page_path: currentPagePath,
    page_title: document.title,
    ...detail,
  };
  const payload = {
    event: eventName,
    ...properties,
  };

  if (!hasTrackingConsent()) {
    return payload;
  }

  dataLayer.push(payload);
  window.dispatchEvent(new CustomEvent("sanctify:track", { detail: payload }));

  const activePostHog = initPostHog();
  if (activePostHog) {
    activePostHog.capture(eventName, properties);
  }

  if (eventName === "page_view") {
    pageViewTracked = true;
  }

  return payload;
};

const trackPageView = () => {
  if (pageViewTracked || !hasTrackingConsent()) return;

  refreshAttributionState(true);
  syncPostHogAttribution();
  trackEvent("page_view", {
    landing_page: attributionState.firstTouch?.page || currentPagePath,
    last_touch_page: attributionState.lastTouch?.page || currentPagePath,
  });
};

const updateConsentUi = () => {
  if (!consentBannerMounted) return;

  const consentStatus = readTrackingConsent();
  const shouldShowBanner = consentBannerOpen || consentStatus === "unknown";
  consentBanner.hidden = !shouldShowBanner;
  consentManageButton.hidden = false;

  if (consentBannerStatus) {
      if (consentStatus === "granted") {
        consentBannerStatus.textContent = "Optional analytics and marketing cookies are on. You can change that any time.";
      } else if (consentStatus === "denied") {
        consentBannerStatus.textContent = "Optional analytics and marketing cookies are off. Necessary site storage still stays on.";
      } else {
        consentBannerStatus.textContent = "Choose whether Sanctify can use optional analytics and marketing cookies on this device.";
      }
  }
};

const injectConsentStyles = () => {
  if (document.getElementById("sanctify-consent-style")) return;

  const style = document.createElement("style");
  style.id = "sanctify-consent-style";
  style.textContent = `
    .sanctify-consent-manage {
      position: fixed;
      left: 18px;
      bottom: 18px;
      z-index: 40;
      border: 1px solid rgba(23, 32, 31, 0.12);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.94);
      color: #17201f;
      padding: 10px 14px;
      font: 600 0.92rem -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 18px 48px rgba(23, 32, 31, 0.14);
      backdrop-filter: blur(18px);
      cursor: pointer;
    }
    .sanctify-consent-banner {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 41;
      width: min(420px, calc(100vw - 36px));
    }
    .sanctify-consent-card {
      border: 1px solid rgba(23, 32, 31, 0.1);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.96);
      padding: 20px;
      box-shadow: 0 24px 70px rgba(23, 32, 31, 0.18);
      backdrop-filter: blur(22px);
    }
    .sanctify-consent-eyebrow {
      display: inline-block;
      margin-bottom: 8px;
      color: #126c66;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .sanctify-consent-card h3 {
      margin: 0;
      color: #17201f;
      font-size: 1.35rem;
      line-height: 1.1;
    }
    .sanctify-consent-card p {
      margin: 10px 0 0;
      color: #47514f;
      font-size: 0.96rem;
      line-height: 1.5;
    }
    .sanctify-consent-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }
    .sanctify-consent-btn,
    .sanctify-consent-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      border-radius: 8px;
      padding: 10px 14px;
      font: 650 0.94rem -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-decoration: none;
      cursor: pointer;
    }
    .sanctify-consent-btn {
      border: 0;
    }
    .sanctify-consent-btn.primary {
      background: #126c66;
      color: #ffffff;
    }
    .sanctify-consent-btn.secondary,
    .sanctify-consent-link {
      border: 1px solid rgba(23, 32, 31, 0.12);
      background: rgba(255, 255, 255, 0.88);
      color: #17201f;
    }
    .sanctify-consent-status {
      min-height: 22px;
    }
    @media (max-width: 640px) {
      .sanctify-consent-manage {
        left: 12px;
        right: 12px;
        bottom: 12px;
        width: calc(100vw - 24px);
      }
      .sanctify-consent-banner {
        left: 12px;
        right: 12px;
        width: auto;
        bottom: 66px;
      }
      .sanctify-consent-actions {
        flex-direction: column;
      }
      .sanctify-consent-btn,
      .sanctify-consent-link {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(style);
};

const openPrivacyChoices = () => {
  consentBannerOpen = true;
  updateConsentUi();
};

const setTrackingConsent = (status) => {
  const normalized = status === "granted" ? "granted" : "denied";
  writeTrackingConsent(normalized);
  consentBannerOpen = false;

  if (normalized === "denied") {
    clearStoredAttribution();
    clearAttributionFields();
    clearKlaviyoCookies();
    pageViewTracked = false;
    if (posthogInitialized && window.posthog) {
      window.posthog.opt_out_capturing?.();
      window.posthog.reset?.();
    }
  } else if (posthogInitialized && window.posthog) {
    window.posthog.clear_opt_in_out_capturing?.();
    window.posthog.opt_in_capturing?.();
  }

  applyConsentState({ trackPage: true });
};

const ensureConsentUi = () => {
  if (consentBannerMounted || !document.body) return;

  injectConsentStyles();

  consentManageButton = document.createElement("button");
  consentManageButton.type = "button";
  consentManageButton.className = "sanctify-consent-manage";
  consentManageButton.textContent = "Cookie settings";
  consentManageButton.hidden = true;
  consentManageButton.addEventListener("click", openPrivacyChoices);
  document.body.appendChild(consentManageButton);

  consentBanner = document.createElement("aside");
  consentBanner.className = "sanctify-consent-banner";
  consentBanner.hidden = true;
  consentBanner.innerHTML = `
    <div class="sanctify-consent-card" role="dialog" aria-live="polite" aria-label="Cookie and privacy settings">
      <span class="sanctify-consent-eyebrow">Cookies and privacy</span>
      <h3>Choose your cookie settings</h3>
      <p>
        Sanctify uses necessary storage to keep the site working. With your permission, we also use optional analytics and marketing cookies to understand which pages, plans, signup paths, and follow-up forms are working.
      </p>
      <p>Filtering, billing, and account access still work if you decline optional analytics and marketing cookies.</p>
      <div class="sanctify-consent-actions">
        <button type="button" class="sanctify-consent-btn primary" data-consent-action="granted">Accept optional cookies</button>
        <button type="button" class="sanctify-consent-btn secondary" data-consent-action="denied">Reject optional cookies</button>
        <a class="sanctify-consent-link" href="/privacy-policy.html">Read privacy policy</a>
      </div>
      <p class="sanctify-consent-status" data-consent-status></p>
    </div>
  `;

  consentBannerStatus = consentBanner.querySelector("[data-consent-status]");
  consentBanner.querySelectorAll("[data-consent-action]").forEach((button) => {
    button.addEventListener("click", () => {
      setTrackingConsent(button.dataset.consentAction);
    });
  });

  document.body.appendChild(consentBanner);
  consentBannerMounted = true;
  updateConsentUi();
};

const applyConsentState = ({ trackPage = true } = {}) => {
  if (hasTrackingConsent()) {
    refreshAttributionState(true);
    syncPostHogAttribution();
    initKlaviyo();
    enrichSignupLinks();
    populateAttributionFields();
    if (trackPage) {
      trackPageView();
    }
  } else {
    refreshAttributionState(false);
    enrichSignupLinks();
    populateAttributionFields();
  }

  updateConsentUi();
};

refreshAttributionState(false);
ensureConsentUi();
applyConsentState({ trackPage: true });

const setHeaderState = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 12);
};

if (header) {
  setHeaderState();
  window.addEventListener("scroll", setHeaderState, { passive: true });
}

if (header && menuToggle) {
  menuToggle.addEventListener("click", () => {
    const isOpen = header.classList.toggle("menu-active");
    document.body.classList.toggle("menu-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

document.querySelectorAll(".site-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    header?.classList.remove("menu-active");
    document.body.classList.remove("menu-open");
    menuToggle?.setAttribute("aria-expanded", "false");
  });
});

document.querySelectorAll(".site-nav a, .footer-links a").forEach((link) => {
  const linkPage = link.getAttribute("href")?.split("#")[0];
  if (linkPage === currentPage) {
    link.setAttribute("aria-current", "page");
  }
});

if (heroStage) {
  window.addEventListener(
    "pointermove",
    (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 18;
      const y = (event.clientY / window.innerHeight - 0.5) * 18;
      heroStage.style.setProperty("--mx", `${x}px`);
      heroStage.style.setProperty("--my", `${y}px`);
    },
    { passive: true }
  );
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16 }
);

document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

const updateProfile = (profile) => {
  const content = profileContent[profile];
  if (!content) return;

  const title = document.querySelector("[data-profile-title]");
  const copy = document.querySelector("[data-profile-copy]");
  const chipOne = document.querySelector("[data-chip-one]");
  const chipTwo = document.querySelector("[data-chip-two]");
  const chipThree = document.querySelector("[data-chip-three]");

  if (!title || !copy || !chipOne || !chipTwo || !chipThree) return;

  title.textContent = content.title;
  copy.textContent = content.copy;
  chipOne.textContent = content.chips[0];
  chipTwo.textContent = content.chips[1];
  chipThree.textContent = content.chips[2];
};

profileTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    profileTabs.forEach((button) => {
      button.classList.remove("active");
      button.setAttribute("aria-selected", "false");
    });

    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    updateProfile(tab.dataset.profile);
  });
});

document.querySelectorAll("[data-track]").forEach((element) => {
  element.addEventListener("click", () => {
    trackEvent(element.dataset.track, {
      surface: element.dataset.surface || "",
      plan: element.dataset.plan || "",
      destination: element.getAttribute("href") || "",
      label: element.dataset.label || element.textContent?.trim() || "",
    });
  });
});

document.querySelectorAll("form[data-track-submit]").forEach((trackedForm) => {
  trackedForm.addEventListener("submit", () => {
    const topicField = trackedForm.querySelector('[name="topic"]');
    const interestField = trackedForm.querySelector('[name="interestTag"]');

    trackEvent(trackedForm.dataset.trackSubmit, {
      surface: trackedForm.dataset.surface || currentPageName,
      topic: topicField?.value || "",
      interest_tag: interestField?.value || "",
    });
  });
});

document.querySelectorAll("form[data-lead-form]").forEach((leadForm) => {
  const statusEl = leadForm.querySelector("[data-lead-status]");

  const setLeadStatus = (message, state = "") => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove("success", "error");
    if (state) statusEl.classList.add(state);
  };

  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(leadForm);
    const email = String(formData.get("email") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const interestTag = String(formData.get("interestTag") || "family").trim();
    const marketingConsent = formData.get("marketingConsent") === "on";

    if (!email || !marketingConsent) {
      setLeadStatus("Consent and a valid email are required.", "error");
      return;
    }

    setLeadStatus("Saving your spot...");

    try {
      const response = await fetch("https://app.sanctify.faith/marketing/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          name,
          interestTag,
          sourcePage: currentPageName,
          marketingConsent: true,
          attribution: {
            firstTouch: attributionState.firstTouch,
            lastTouch: attributionState.lastTouch,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setLeadStatus(data.error || "Could not save your details right now.", "error");
        return;
      }

      setLeadStatus(
        data.alreadyCustomer
          ? "That email already has a Sanctify account."
          : "You are on the list. Sanctify will follow up with the right next step.",
        "success"
      );

      trackEvent("lead_capture_completed", {
        surface: leadForm.dataset.surface || currentPageName,
        interest_tag: interestTag,
        already_customer: Boolean(data.alreadyCustomer),
      });

      if (!data.alreadyCustomer) {
        identifyKlaviyoProfile({
          email,
          fullName: name,
          interestTag,
          sourcePage: leadForm.dataset.surface || currentPageName,
        });
        trackKlaviyoEvent("Lead Capture Completed", {
          surface: leadForm.dataset.surface || currentPageName,
          interest_tag: interestTag,
          source_page: currentPageName,
        });
      }

      if (!data.alreadyCustomer) {
        leadForm.reset();
      }
    } catch (error) {
      setLeadStatus("Could not save your details right now.", "error");
    }
  });
});

document.querySelectorAll("form[data-contact-form]").forEach((contactForm) => {
  const statusEl = contactForm.querySelector("[data-contact-status]");

  const setContactStatus = (message, state = "") => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove("success", "error");
    if (state) statusEl.classList.add(state);
  };

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(contactForm);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const topic = String(formData.get("topic") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const marketingConsent = formData.get("marketingConsent") === "on";

    if (!name || !email || !topic || !message) {
      setContactStatus("Please complete the required fields.", "error");
      return;
    }

    setContactStatus("Sending your message...");

    try {
      const response = await fetch("https://app.sanctify.faith/marketing/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          topic,
          message,
          sourcePage: currentPageName,
          interestTag: topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
          marketingConsent,
          attribution: {
            firstTouch: attributionState.firstTouch,
            lastTouch: attributionState.lastTouch,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setContactStatus(data.error || "Could not send your message right now.", "error");
        return;
      }

      setContactStatus("Message sent. Sanctify will follow up shortly.", "success");
      trackEvent("contact_submit_completed", {
        surface: contactForm.dataset.surface || currentPageName,
        topic,
        marketing_consent: marketingConsent,
        created_lead: Boolean(data.leadId),
      });

      if (marketingConsent) {
        identifyKlaviyoProfile({
          email,
          fullName: name,
          interestTag: topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
          sourcePage: contactForm.dataset.surface || currentPageName,
        });
        trackKlaviyoEvent("Contact Request Submitted", {
          surface: contactForm.dataset.surface || currentPageName,
          topic,
          source_page: currentPageName,
        });
      }

      contactForm.reset();
    } catch (error) {
      setContactStatus("Could not send your message right now.", "error");
    }
  });
});

document.querySelectorAll("[data-open-privacy-choices]").forEach((element) => {
  element.addEventListener("click", (event) => {
    event.preventDefault();
    openPrivacyChoices();
  });
});

window.sanctifyTracking = {
  get attribution() {
    return attributionState;
  },
  trackEvent,
  openPrivacyChoices,
  getConsentStatus: readTrackingConsent,
};
