/*!
 * <raahi-opportunities> — live scholarships, jobs, admissions, internships and courses from RAAHI, for any web page.
 * Dependency-free, Shadow DOM, no cookies, no tracking, no innerHTML. https://github.com/ahmed-raza-ur-rehman/raahi
 *
 *   <script src="https://raahi-phi.vercel.app/embed/raahi-opportunities.js" defer></script>
 *   <raahi-opportunities kind="job" scope="pakistan" limit="5" lang="ur" theme="dark"></raahi-opportunities>
 *
 * Attributes (all optional): kind (comma list: scholarship, admission, job, internship, competition, course, coupon,
 * grant, fellowship, training), q, scope (pakistan|international), country, level, funding, remote, within (days),
 * sort (relevance|newest|deadline), limit (1–12, default 5), lang (en|ur), theme (light|dark|auto), host (API origin,
 * default = where this script was loaded from), heading, pk (0 to also show listings that look restricted).
 * Every item links to RAAHI's own page, which names the source and links to the official page.
 */
(function (root) {
  "use strict";

  var DEFAULT_HOST = "https://raahi-phi.vercel.app";
  var CACHE_MS = 5 * 60 * 1000;
  var TIMEOUT_MS = 10000;

  var STRINGS = {
    en: {
      heading: "Opportunities from RAAHI",
      loading: "Loading…",
      error: "Could not load listings right now.",
      retry: "Try again",
      empty: "Nothing matches right now.",
      more: "See all on RAAHI",
      closesToday: "Closes today",
      closesIn: "Closes in",
      day: "day",
      days: "days",
      closed: "Closed",
      rolling: "Rolling applications",
      noDeadline: "No deadline listed",
      isNew: "New",
      via: "via",
      note: "Confirm details on the official page."
    },
    ur: {
      heading: "راہی پر مواقع",
      loading: "لوڈ ہو رہا ہے…",
      error: "ابھی فہرست لوڈ نہیں ہو سکی۔",
      retry: "دوبارہ کوشش کریں",
      empty: "ابھی کچھ نہیں ملا۔",
      more: "راہی پر سب دیکھیں",
      closesToday: "آج بند ہو رہا ہے",
      closesIn: "بند ہونے میں",
      day: "دن",
      days: "دن",
      closed: "بند",
      rolling: "مسلسل درخواستیں",
      noDeadline: "آخری تاریخ درج نہیں",
      isNew: "نیا",
      via: "بذریعہ",
      note: "تفصیلات سرکاری صفحے پر دیکھیں۔"
    }
  };

  var KINDS = {
    scholarship: { en: "Scholarship", ur: "اسکالرشپ" },
    fellowship: { en: "Fellowship", ur: "فیلوشپ" },
    admission: { en: "Admission", ur: "داخلہ" },
    internship: { en: "Internship", ur: "انٹرن شپ" },
    job: { en: "Job", ur: "نوکری" },
    competition: { en: "Competition", ur: "مقابلہ" },
    course: { en: "Course", ur: "کورس" },
    coupon: { en: "Free course", ur: "مفت کورس" },
    training: { en: "Training", ur: "تربیت" },
    grant: { en: "Grant", ur: "گرانٹ" },
    notice: { en: "Notice", ur: "نوٹس" }
  };

  var THEMES = {
    light: "--bg:#ffffff;--ink:#12251d;--muted:#5b6b64;--line:#dfe8e3;--accent:#146c43;--accent-soft:#e6f3ec;--soon:#9a5a00;--soon-bg:#fff3d6;--urgent:#b42318;--urgent-bg:#fde8e6;",
    dark: "--bg:#0f1a15;--ink:#e7f2ec;--muted:#9db3a8;--line:#24372e;--accent:#4cc38a;--accent-soft:#16291f;--soon:#f0b34a;--soon-bg:#3a2b0a;--urgent:#ff8f85;--urgent-bg:#3d1613;"
  };

  // ── pure helpers (also exported for tests) ─────────────────────────────────────────────────────

  function clampInt(value, min, max, fallback) {
    var n = parseInt(value, 10);
    if (isNaN(n)) return fallback;
    return Math.min(Math.max(n, min), max);
  }

  function pickLanguage(attribute, documentLanguage) {
    var value = String(attribute || documentLanguage || "en").toLowerCase();
    return value.indexOf("ur") === 0 || value.indexOf("ps") === 0 || value.indexOf("fa") === 0 ? "ur" : "en";
  }

  /** The query string for /api/opportunities, from the element's attributes. Unknown values are dropped, never forwarded. */
  function buildQuery(attrs) {
    var params = new URLSearchParams();
    var kinds = String(attrs.kind || "").split(",").map(function (k) { return k.trim(); }).filter(function (k) { return Object.prototype.hasOwnProperty.call(KINDS, k); });
    if (kinds.length) params.set("kind", kinds.join(","));
    if (attrs.q) params.set("q", String(attrs.q).slice(0, 120));
    if (attrs.scope === "pakistan" || attrs.scope === "international") params.set("scope", attrs.scope);
    if (attrs.country) params.set("country", String(attrs.country).slice(0, 60));
    if (attrs.level) params.set("level", String(attrs.level).slice(0, 20));
    if (attrs.funding) params.set("funding", String(attrs.funding).slice(0, 20));
    if (attrs.remote === "" || attrs.remote === "1" || attrs.remote === "true") params.set("remote", "1");
    if (attrs.within) params.set("within", String(clampInt(attrs.within, 1, 365, 14)));
    if (attrs.sort === "newest" || attrs.sort === "deadline") params.set("sort", attrs.sort);
    if (attrs.pk === "0" || attrs.pk === "false") params.set("pk", "0"); else params.set("pk", "1");
    return params.toString();
  }

  function originOf(hostAttribute, scriptSrc) {
    var candidate = hostAttribute || scriptSrc || DEFAULT_HOST;
    try {
      var url = new URL(candidate, DEFAULT_HOST);
      if (url.protocol !== "https:" && url.protocol !== "http:") return DEFAULT_HOST;
      return url.origin;
    } catch (error) {
      return DEFAULT_HOST;
    }
  }

  function apiUrl(origin, query, limit) {
    return origin + "/api/opportunities?" + query + (query ? "&" : "") + "limit=" + limit;
  }

  function pageUrl(origin, query, referrerHost) {
    var utm = "utm_source=" + encodeURIComponent(referrerHost || "embed") + "&utm_medium=embed";
    return origin + "/opportunities?" + query + (query ? "&" : "") + utm;
  }

  function itemUrl(origin, id, referrerHost) {
    return origin + "/opportunities/" + encodeURIComponent(String(id)) + "?utm_source=" + encodeURIComponent(referrerHost || "embed") + "&utm_medium=embed";
  }

  /** { text, tone } for the deadline chip; tone is one of urgent, soon, ok, none. */
  function deadlineLabel(item, language) {
    var s = STRINGS[language] || STRINGS.en;
    if (typeof item.daysLeft === "number" && item.deadline) {
      if (item.daysLeft < 0) return { text: s.closed, tone: "none" };
      if (item.daysLeft === 0) return { text: s.closesToday, tone: "urgent" };
      var unit = item.daysLeft === 1 ? s.day : s.days;
      return { text: s.closesIn + " " + item.daysLeft + " " + unit, tone: item.daysLeft <= 3 ? "urgent" : item.daysLeft <= 7 ? "soon" : "ok" };
    }
    if (item.status === "rolling") return { text: s.rolling, tone: "ok" };
    return { text: s.noDeadline, tone: "none" };
  }

  function kindLabel(kind, language) {
    var entry = KINDS[kind];
    return entry ? entry[language] || entry.en : String(kind || "");
  }

  // ── rendering (browser only) ───────────────────────────────────────────────────────────────────

  var STYLE =
    ":host{display:block;max-width:100%;font:14px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans','Noto Sans Arabic',sans-serif;color:var(--ink)}" +
    "*{box-sizing:border-box}" +
    ".box{background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:16px;overflow:hidden}" +
    ".head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line)}" +
    ".mark{flex:none;width:28px;height:28px;border-radius:9px;background:var(--accent);color:var(--bg);display:grid;place-items:center;font-weight:800}" +
    ".head h2{margin:0;font-size:15px;font-weight:800;flex:1;min-width:0}" +
    "ul{list-style:none;margin:0;padding:0}" +
    "li{padding:11px 14px;border-bottom:1px solid var(--line)}" +
    "li:last-child{border-bottom:0}" +
    ".row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:3px}" +
    ".chip{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:700;background:var(--accent-soft);color:var(--accent);white-space:nowrap}" +
    ".chip.soon{background:var(--soon-bg);color:var(--soon)}.chip.urgent{background:var(--urgent-bg);color:var(--urgent)}.chip.none{background:transparent;color:var(--muted);border:1px solid var(--line)}" +
    "a{color:var(--ink);text-decoration:none}a:hover,a:focus-visible{text-decoration:underline}" +
    ".title{font-weight:700;display:block;overflow-wrap:anywhere}" +
    ".meta{color:var(--muted);font-size:12px;margin-top:2px}" +
    ".foot{display:flex;flex-wrap:wrap;gap:8px 14px;justify-content:space-between;align-items:center;padding:10px 14px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}" +
    ".foot a{color:var(--accent);font-weight:700}" +
    ".state{padding:18px 14px;color:var(--muted)}" +
    "button{font:inherit;font-weight:700;color:var(--accent);background:none;border:1px solid var(--line);border-radius:10px;padding:4px 10px;cursor:pointer;margin-inline-start:8px}" +
    ".sk{height:12px;border-radius:6px;background:var(--line);margin:8px 0;opacity:.7}";

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function cacheGet(key) {
    try {
      var raw = root.sessionStorage.getItem(key);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      return entry && Date.now() - entry.at < CACHE_MS ? entry.data : null;
    } catch (error) {
      return null;
    }
  }

  function cacheSet(key, data) {
    try {
      root.sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data: data }));
    } catch (error) {
      /* storage may be blocked — the widget just refetches */
    }
  }

  function scriptOrigin() {
    var current = document.currentScript;
    return current && current.src ? current.src : "";
  }
  var LOADED_FROM = typeof document !== "undefined" ? scriptOrigin() : "";

  function defineOpportunities() {
    if (root.customElements.get("raahi-opportunities")) return;

    class RaahiOpportunities extends HTMLElement {
      static get observedAttributes() {
        return ["kind", "q", "scope", "country", "level", "funding", "remote", "within", "sort", "limit", "lang", "theme", "host", "heading", "pk"];
      }

      connectedCallback() {
        if (!this.shadowRoot) this.attachShadow({ mode: "open" });
        this._connected = true;
        this.refresh();
      }

      disconnectedCallback() {
        this._connected = false;
        if (this._abort) this._abort.abort();
      }

      attributeChangedCallback() {
        if (this._connected) this.refresh();
      }

      attrs() {
        var out = {};
        for (var i = 0; i < RaahiOpportunities.observedAttributes.length; i += 1) {
          var name = RaahiOpportunities.observedAttributes[i];
          if (this.hasAttribute(name)) out[name] = this.getAttribute(name);
        }
        return out;
      }

      theme() {
        var wanted = this.getAttribute("theme") || "auto";
        if (wanted === "dark" || wanted === "light") return wanted;
        return root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }

      refresh() {
        var attrs = this.attrs();
        var language = pickLanguage(attrs.lang, document.documentElement.lang);
        var s = STRINGS[language];
        var origin = originOf(attrs.host, LOADED_FROM);
        var limit = clampInt(attrs.limit, 1, 12, 5);
        var query = buildQuery(attrs);
        var referrer = root.location && root.location.hostname;

        var shadow = this.shadowRoot;
        shadow.replaceChildren();
        var style = el("style");
        style.textContent = ":host{" + THEMES[this.theme()] + "}" + STYLE;
        var box = el("section", "box");
        box.setAttribute("dir", language === "ur" ? "rtl" : "ltr");
        box.setAttribute("lang", language);
        box.setAttribute("aria-label", attrs.heading || s.heading);
        var head = el("div", "head");
        head.appendChild(el("span", "mark", "ر"));
        head.appendChild(el("h2", "", attrs.heading || s.heading));
        box.appendChild(head);
        var body = el("div");
        body.setAttribute("aria-live", "polite");
        box.appendChild(body);
        var foot = el("div", "foot");
        var more = el("a", "", s.more + " ↗");
        more.href = pageUrl(origin, query, referrer);
        more.target = "_blank";
        more.rel = "noopener";
        foot.appendChild(more);
        foot.appendChild(el("span", "", s.note));
        box.appendChild(foot);
        shadow.appendChild(style);
        shadow.appendChild(box);

        var skeleton = el("div", "state");
        for (var n = 0; n < 3; n += 1) skeleton.appendChild(el("div", "sk"));
        skeleton.setAttribute("aria-label", s.loading);
        body.appendChild(skeleton);

        var url = apiUrl(origin, query, limit);
        var render = function (data) {
          body.replaceChildren();
          var items = data && Array.isArray(data.items) ? data.items.slice(0, limit) : [];
          if (items.length === 0) {
            body.appendChild(el("p", "state", s.empty));
            return;
          }
          var list = el("ul");
          items.forEach(function (item) {
            var li = el("li");
            var row = el("div", "row");
            row.appendChild(el("span", "chip", kindLabel(item.kind, language)));
            var deadline = deadlineLabel(item, language);
            row.appendChild(el("span", "chip " + deadline.tone, deadline.text));
            if (item.isNew) row.appendChild(el("span", "chip", s.isNew));
            li.appendChild(row);
            var link = el("a", "title", String(item.title || ""));
            link.href = itemUrl(origin, item.id, referrer);
            link.target = "_blank";
            link.rel = "noopener";
            li.appendChild(link);
            var meta = [item.organization, item.country].filter(Boolean).join(" · ");
            li.appendChild(el("div", "meta", (meta ? meta + " — " : "") + s.via + " " + String(item.sourceName || "")));
            list.appendChild(li);
          });
          body.appendChild(list);
        };

        var fail = function () {
          body.replaceChildren();
          var state = el("p", "state", s.error);
          var retry = el("button", "", s.retry);
          retry.type = "button";
          retry.addEventListener("click", this.refresh.bind(this));
          state.appendChild(retry);
          body.appendChild(state);
        }.bind(this);

        var cached = cacheGet("raahi-embed:" + url);
        if (cached) {
          render(cached);
          return;
        }
        if (this._abort) this._abort.abort();
        var controller = new AbortController();
        this._abort = controller;
        var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
        fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } })
          .then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
          .then(function (data) { cacheSet("raahi-embed:" + url, data); render(data); })
          .catch(function (error) { if (!(error && error.name === "AbortError" && controller.signal.aborted && this._abort !== controller)) fail(); }.bind(this))
          .then(function () { clearTimeout(timer); });
      }
    }

    root.customElements.define("raahi-opportunities", RaahiOpportunities);
  }

  var api = { buildQuery: buildQuery, pickLanguage: pickLanguage, originOf: originOf, apiUrl: apiUrl, pageUrl: pageUrl, itemUrl: itemUrl, deadlineLabel: deadlineLabel, kindLabel: kindLabel, clampInt: clampInt, STRINGS: STRINGS, KINDS: KINDS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root.customElements !== "undefined" && typeof HTMLElement !== "undefined") defineOpportunities();
})(typeof self !== "undefined" ? self : this);
