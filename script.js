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
const APP_SIGNUP_HOST = "app.sanctify.faith";
const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector(".menu-toggle");
const heroStage = document.querySelector("[data-tilt] .hero-stage");
const profileTabs = document.querySelectorAll(".profile-tab");
const currentPagePath = window.location.pathname || "/";
const currentPage = currentPagePath.split("/").pop() || "index.html";
const currentPageName = currentPage === "index.html" ? "home" : currentPage.replace(".html", "");
const dataLayer = (window.dataLayer = window.dataLayer || []);

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

const parseStoredValue = (key) => {
  const value = safeReadStorage(key);
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
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

const persistAttribution = () => {
  const snapshot = buildAttributionSnapshot();
  const hasTrackedParams = Object.keys(snapshot.params).length > 0;
  const hasExternalSource = hasTrackedParams || isExternalReferrer(snapshot.referrer);
  const firstTouch = parseStoredValue(ATTRIBUTION_STORAGE_KEYS.firstTouch) || snapshot;
  const lastTouch =
    hasExternalSource || !parseStoredValue(ATTRIBUTION_STORAGE_KEYS.lastTouch)
      ? snapshot
      : parseStoredValue(ATTRIBUTION_STORAGE_KEYS.lastTouch);

  safeWriteStorage(ATTRIBUTION_STORAGE_KEYS.firstTouch, JSON.stringify(firstTouch));
  safeWriteStorage(ATTRIBUTION_STORAGE_KEYS.lastTouch, JSON.stringify(lastTouch));

  return {
    firstTouch,
    lastTouch,
    current: snapshot,
  };
};

const attributionState = persistAttribution();

const mergedAttributionParams = () => ({
  ...(attributionState.firstTouch?.params || {}),
  ...(attributionState.lastTouch?.params || {}),
  ...(attributionState.current?.params || {}),
});

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

const trackEvent = (eventName, detail = {}) => {
  const payload = {
    event: eventName,
    page_name: currentPageName,
    page_path: currentPagePath,
    page_title: document.title,
    ...detail,
  };

  dataLayer.push(payload);
  window.dispatchEvent(new CustomEvent("sanctify:track", { detail: payload }));

  return payload;
};

const enrichSignupLinks = () => {
  const attributionParams = mergedAttributionParams();

  document.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    let url;

    try {
      url = new URL(href, window.location.href);
    } catch (error) {
      return;
    }

    if (url.hostname !== APP_SIGNUP_HOST || !url.pathname.startsWith("/signup")) {
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

enrichSignupLinks();
populateAttributionFields();
trackEvent("page_view", {
  landing_page: attributionState.firstTouch?.page || currentPagePath,
  last_touch_page: attributionState.lastTouch?.page || currentPagePath,
});

const setHeaderState = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 12);
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

const trackedForm = document.querySelector("form[data-track-submit]");

if (trackedForm) {
  trackedForm.addEventListener("submit", () => {
    const topicField = trackedForm.querySelector('[name="topic"]');

    trackEvent(trackedForm.dataset.trackSubmit, {
      surface: trackedForm.dataset.surface || currentPageName,
      topic: topicField?.value || "",
    });
  });
}

window.sanctifyTracking = {
  attribution: attributionState,
  trackEvent,
};
