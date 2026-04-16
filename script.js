const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector(".menu-toggle");
const heroStage = document.querySelector("[data-tilt] .hero-stage");
const profileTabs = document.querySelectorAll(".profile-tab");

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

const currentPage = window.location.pathname.split("/").pop() || "index.html";
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
