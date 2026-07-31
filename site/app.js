(() => {
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const mobileButton = qs(".mobile-menu-button");
  const mobileNav = qs(".mobile-nav");

  mobileButton?.addEventListener("click", () => {
    const expanded = mobileButton.getAttribute("aria-expanded") === "true";
    mobileButton.setAttribute("aria-expanded", String(!expanded));
    mobileNav.hidden = expanded;
  });

  qsa(".mobile-nav a").forEach((link) => link.addEventListener("click", () => {
    mobileButton?.setAttribute("aria-expanded", "false");
    mobileNav.hidden = true;
  }));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  qsa(".reveal").forEach((element) => revealObserver.observe(element));

  const downloadCopies = qsa(".download-copy");

  downloadCopies.forEach((copy, index) => {
    copy.textContent = index === 0 ? "Télécharger" : "Voir les téléchargements";
  });

  const modal = qs(".demo-modal");
  const openModal = () => {
    modal?.classList.add("open");
    modal?.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };
  const closeModal = () => {
    modal?.classList.remove("open");
    modal?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  qsa(".js-open-demo").forEach((button) => button.addEventListener("click", openModal));
  qs(".demo-modal-close")?.addEventListener("click", closeModal);
  qs(".demo-modal-backdrop")?.addEventListener("click", closeModal);
  qs(".demo-modal-start")?.addEventListener("click", () => {
    closeModal();
    qs("#demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal?.classList.contains("open")) closeModal();
  });

  const demoNavButtons = qsa(".demo-nav");
  const demoPages = qsa(".demo-page");

  function selectDemoPage(pageName) {
    demoNavButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.demoPage === pageName);
    });
    demoPages.forEach((page) => {
      page.classList.toggle("active", page.dataset.page === pageName);
    });
  }

  demoNavButtons.forEach((button) => {
    button.addEventListener("click", () => selectDemoPage(button.dataset.demoPage));
  });

  qsa("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => selectDemoPage(button.dataset.jump));
  });

  const privacyButton = qs(".demo-privacy");
  privacyButton?.addEventListener("click", () => {
    const hidden = document.body.classList.toggle("money-hidden");
    privacyButton.setAttribute("aria-pressed", String(hidden));
    privacyButton.textContent = hidden ? "Afficher les montants" : "Masquer les montants";
  });

  qs(".demo-reset")?.addEventListener("click", () => {
    document.body.classList.remove("money-hidden");
    privacyButton?.setAttribute("aria-pressed", "false");
    if (privacyButton) privacyButton.textContent = "Masquer les montants";
    selectDemoPage("dashboard");
    const monthly = qs("#monthly-input");
    const years = qs("#years-input");
    const rate = qs("#return-input");
    if (monthly) monthly.value = "300";
    if (years) years.value = "10";
    if (rate) rate.value = "6";
    updateForecast();
  });

  const money = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  });

  function forecastSeries(current, monthly, years, annualRate) {
    const points = [];
    let value = current;
    const months = years * 12;
    const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;

    for (let month = 0; month <= months; month++) {
      if (month > 0) value = value * (1 + monthlyRate) + monthly;
      if (month % Math.max(1, Math.floor(months / 24)) === 0 || month === months) {
        points.push(value);
      }
    }
    return points;
  }

  function chartPath(values, width = 724, height = 210, offsetX = 18, offsetY = 26) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);
    const points = values.map((value, index) => ({
      x: offsetX + (index / Math.max(values.length - 1, 1)) * width,
      y: offsetY + ((max - value) / range) * height
    }));

    if (points.length <= 1) return points.length ? `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}` : "";
    if (points.length === 2) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;

    const tension = 0.18;
    let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] ?? points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] ?? p2;

      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    return path;
  }

  function updateForecast() {
    const monthlyInput = qs("#monthly-input");
    const yearsInput = qs("#years-input");
    const returnInput = qs("#return-input");
    if (!monthlyInput || !yearsInput || !returnInput) return;

    const monthly = Number(monthlyInput.value);
    const years = Number(yearsInput.value);
    const annualReturn = Number(returnInput.value);
    const values = forecastSeries(42680, monthly, years, annualReturn);
    const linePath = chartPath(values);
    const last = values.at(-1) ?? 42680;

    qs("#monthly-output").textContent = money.format(monthly);
    qs("#years-output").textContent = `${years} an${years > 1 ? "s" : ""}`;
    qs("#return-output").textContent = `${annualReturn.toFixed(1).replace(".", ",")} %`;
    qs("#forecast-total").textContent = money.format(last);
    qs("#forecast-detail").textContent = `Dans ${years} an${years > 1 ? "s" : ""}`;

    const line = qs("#forecast-line");
    const area = qs("#forecast-area");
    if (line) line.setAttribute("d", linePath);
    if (area) area.setAttribute("d", `${linePath} L742 252 L18 252 Z`);
  }

  ["#monthly-input", "#years-input", "#return-input"].forEach((selector) => {
    qs(selector)?.addEventListener("input", updateForecast);
  });
  updateForecast();


  const tourPages = {
    portfolio: {
      title: "Portefeuille et aperçu",
      subtitle: "La valeur totale, le cash, les comptes et les principales positions.",
      image: "assets/portfolio-light.png",
      alt: "Page Portefeuille réelle dans Atlas Portfolio"
    },
    allocation: {
      title: "Répartition sectorielle",
      subtitle: "Une lecture immédiate des classes, comptes et poches investies.",
      image: "assets/repartition-secteurs.png",
      alt: "Répartition sectorielle réelle dans Atlas Portfolio"
    },
    performance: {
      title: "Performance expliquée",
      subtitle: "Apports, plus-values, dividendes et frais restent distingués.",
      image: "assets/performance-main.png",
      alt: "Page Performance réelle dans Atlas Portfolio"
    },
    recommendations: {
      title: "Recommandations",
      subtitle: "Les écarts d’allocation deviennent un plan d’action clair pour le prochain apport.",
      image: "assets/recommandations.png",
      alt: "Page Recommandations réelle dans Atlas Portfolio"
    },
    forecast: {
      title: "Prévisionnel",
      subtitle: "Les hypothèses d’apport et de rendement dessinent une trajectoire chiffrée.",
      image: "assets/previsionnel.png",
      alt: "Page Prévisionnel réelle dans Atlas Portfolio"
    }
  };

  function updateProductTour(pageKey) {
    const page = tourPages[pageKey] ?? tourPages.portfolio;
    const title = qs("#tour-title");
    const subtitle = qs("#tour-subtitle");
    const image = qs("#tour-image");

    if (title) title.textContent = page.title;
    if (subtitle) subtitle.textContent = page.subtitle;

    if (image && image.getAttribute("src") !== page.image) {
      image.classList.add("changing");
      window.setTimeout(() => {
        image.setAttribute("src", page.image);
        image.setAttribute("alt", page.alt);
        image.classList.remove("changing");
      }, 145);
    }
  }

  qsa(".tour-tab").forEach((button) => {
    button.addEventListener("click", () => {
      qsa(".tour-tab").forEach((item) => item.classList.toggle("active", item === button));
      updateProductTour(button.dataset.tour);
    });
  });

  qsa("details").forEach((detail) => {
    detail.addEventListener("toggle", () => {
      if (!detail.open) return;
      qsa("details").forEach((other) => {
        if (other !== detail) other.open = false;
      });
    });
  });
})();
