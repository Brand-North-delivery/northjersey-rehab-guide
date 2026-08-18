/* Northern New Jersey rehab comparison guide — interactions.
   No forms, no data collection, no network requests. */
(function () {
  "use strict";

  /* ---------- mobile nav ---------- */
  var menuBtn = document.querySelector(".menu-btn");
  var nav = document.querySelector(".nav");
  if (menuBtn && nav) {
    nav.id = nav.id || "nav";
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("is-open");
        menuBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- shortlist filters ---------- */
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var centers = Array.prototype.slice.call(document.querySelectorAll(".center"));

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var filter = chip.getAttribute("data-filter");
      chips.forEach(function (c) { c.classList.toggle("is-on", c === chip); });
      centers.forEach(function (center) {
        var tags = (center.getAttribute("data-tags") || "").split(/\s+/);
        var show = filter === "all" || tags.indexOf(filter) !== -1;
        center.classList.toggle("is-hidden", !show);
      });
    });
  });

  /* ---------- "where to start" guidance ---------- */
  var NEED = {
    withdrawal: {
      title: "Start with a medical assessment, not a program tour.",
      body: "Alcohol and benzodiazepine withdrawal can be life-threatening. Look first at centers that provide detox on site rather than by referral, so clinical responsibility never changes hands mid-withdrawal.",
      points: [
        "<a href=\"bluecrest-recovery-center/\">BlueCrest Recovery Center</a> runs detox and residential in house, then steps down through its own outpatient levels.",
        "<a href=\"boca-recovery-center-englewood/\">Boca Recovery Center in Englewood</a> lists medical detox at the location.",
        "Ask any outpatient-only center exactly which partner handles withdrawal and who is clinically responsible during it."
      ]
    },
    mentalhealth: {
      title: "Ask which license the center actually holds.",
      body: "New Jersey licenses substance use and mental health separately. A center without a standalone mental health license generally cannot admit someone whose primary problem is a psychiatric condition.",
      points: [
        "<a href=\"valley-spring-recovery-center/\">Valley Spring Recovery Center</a> publishes both license numbers, so a mental health admission does not require a substance use diagnosis.",
        "<a href=\"north-jersey-recovery-center/\">North Jersey Recovery Center</a> publishes a separate mental health track.",
        "Ask for the license number and expiration date, not just the words &ldquo;dual diagnosis.&rdquo;"
      ]
    },
    structure: {
      title: "Partial care or intensive outpatient is likely the right level.",
      body: "If home is stable and withdrawal is not dangerous, a structured day program usually gives enough support without residential cost or disruption.",
      points: [
        "Compare the actual weekly hours, not the program name &mdash; partial care and IOP differ by a factor of two or three.",
        "Ask how the step-down works and whether you keep the same therapist.",
        "Ask what happens if the level of care turns out to be wrong in week one."
      ]
    },
    work: {
      title: "You need an evening schedule, in writing.",
      body: "Most programs run during business hours. A genuine evening intensive outpatient track is the difference between finishing treatment and dropping out to keep a job.",
      points: [
        "<a href=\"valley-spring-recovery-center/\">Valley Spring Recovery Center</a> runs an evening IOP, Monday to Friday.",
        "<a href=\"north-jersey-recovery-center/\">North Jersey Recovery Center</a> also lists an evening IOP option.",
        "Confirm the exact start and end times, and what happens if you miss a session for work."
      ]
    }
  };

  var PAY = {
    commercial: "Ask whether the center is in network for your specific plan or billing as out of network &mdash; the difference is often thousands of dollars. Get the expected out-of-pocket figure in writing before intake.",
    public: "Most centers in this group take commercial insurance only. <a href=\"choicepoint/\">ChoicePoint</a> states it accepts Medicare and Medicaid, which makes it the practical starting point. <a href=\"bluecrest-recovery-center/\">BlueCrest</a> states it does not accept either.",
    self: "Ask for the full self-pay rate per level of care, whether it is billed weekly or per episode, and whether there is a sliding scale. Ask before the clinical conversation, not after."
  };

  var picked = { need: null, pay: null };
  var out = document.getElementById("shortlistOut");

  function render() {
    if (!out) return;
    if (!picked.need && !picked.pay) { out.hidden = true; return; }

    var html = "";
    if (picked.need && NEED[picked.need]) {
      var n = NEED[picked.need];
      html += "<h4>" + n.title + "</h4><p>" + n.body + "</p><ul>";
      n.points.forEach(function (p) { html += "<li>" + p + "</li>"; });
      html += "</ul>";
    }
    if (picked.pay && PAY[picked.pay]) {
      html += "<h4" + (html ? ' class="spaced"' : "") + ">On paying for it</h4><p>" + PAY[picked.pay] + "</p>";
    }
    html += "<p class=\"tool-note\">General guidance, not a clinical recommendation. Confirm everything directly with the center.</p>";

    out.hidden = false;
    out.innerHTML = html;
  }

  Array.prototype.forEach.call(document.querySelectorAll(".opts"), function (group) {
    var name = group.getAttribute("data-group");
    var opts = Array.prototype.slice.call(group.querySelectorAll(".opt"));
    opts.forEach(function (opt) {
      opt.setAttribute("aria-pressed", "false");
      opt.addEventListener("click", function () {
        var value = opt.getAttribute("data-value");
        var already = picked[name] === value;
        picked[name] = already ? null : value;
        opts.forEach(function (o) {
          var on = !already && o === opt;
          o.classList.toggle("is-on", on);
          o.setAttribute("aria-pressed", String(on));
        });
        render();
      });
    });
  });

})();
