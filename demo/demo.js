"use strict";

(function () {
  // Empty apiBase means same-origin (/api/run) — correct on the Vercel
  // deployment. On ljr.dev (GitHub Pages) the meta tag must point at the
  // Vercel origin. Localhost defaults to `vercel dev` / the mock on :3000.
  var apiBase = (function () {
    var meta = document.querySelector('meta[name="demo-api-base"]');
    var configured = meta && meta.content ? meta.content.replace(/\/$/, "") : "";
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      return configured || "http://localhost:3000";
    }
    return configured;
  })();

  var form = document.getElementById("run-form");
  var input = document.getElementById("domain-input");
  var runBtn = document.getElementById("run-btn");
  var pipelineEl = document.getElementById("pipeline");
  var errorBox = document.getElementById("error-box");
  var resultEl = document.getElementById("result");
  var examplesWrap = document.getElementById("examples");
  var exampleButtons = document.getElementById("example-buttons");

  var running = false;

  // ---------- examples ----------
  fetch("examples.json")
    .then(function (r) { return r.ok ? r.json() : { examples: [] }; })
    .then(function (data) {
      var examples = (data && data.examples) || [];
      if (!examples.length) return;
      examples.forEach(function (ex) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = ex.domain;
        btn.addEventListener("click", function () {
          if (running) return;
          resetUi();
          input.value = ex.domain;
          renderResult(Object.assign({}, ex, { cached: true, cost_usd: 0, example: true }));
        });
        exampleButtons.appendChild(btn);
      });
      examplesWrap.hidden = false;
    })
    .catch(function () { /* examples are optional */ });

  // ---------- form ----------
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (running) return;
    var domain = clientNormalize(input.value);
    if (!domain) {
      showError("invalid_domain", "That doesn't look like a valid company domain (try something like acme.com).");
      return;
    }
    run(domain);
  });

  function clientNormalize(raw) {
    var s = (raw || "").trim().toLowerCase();
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.+$/, "");
    if (!s || s.length > 253) return null;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s)) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) return null;
    return s;
  }

  // ---------- run ----------
  function run(domain) {
    running = true;
    runBtn.disabled = true;
    resetUi();
    pipelineEl.hidden = false;
    setAllStages("pending");

    var gotResult = false;

    fetch(apiBase + "/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: domain }),
    })
      .then(function (res) {
        if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
        return readSse(res.body, function (event, data) {
          if (event === "stage_start") {
            setStage(data.stage, "running", "");
          } else if (event === "stage_update") {
            setStageDetail(data.stage, data.detail);
          } else if (event === "stage_done") {
            setStage(data.stage, data.failed ? "failed" : "done",
              data.usage ? "$" + data.usage.cost_usd.toFixed(3) : "");
          } else if (event === "result") {
            gotResult = true;
            if (data.cached) pipelineEl.hidden = true;
            renderResult(data);
          } else if (event === "error") {
            gotResult = true;
            showError(data.code, data.message);
          }
        });
      })
      .catch(function () {
        if (!gotResult) {
          showError("upstream", "Couldn't reach the demo API. Try again, or use a cached example.");
        }
      })
      .then(function () {
        if (!gotResult) {
          showError("upstream", "The run ended without a result. Try again.");
        }
        running = false;
        runBtn.disabled = false;
      });
  }

  function readSse(body, onEvent) {
    var reader = body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";

    function pump() {
      return reader.read().then(function (step) {
        if (step.done) return;
        buffer += decoder.decode(step.value, { stream: true });
        var parts = buffer.split("\n\n");
        buffer = parts.pop();
        parts.forEach(function (chunk) {
          var event = null;
          var dataLines = [];
          chunk.split("\n").forEach(function (line) {
            if (line.indexOf("event:") === 0) event = line.slice(6).trim();
            else if (line.indexOf("data:") === 0) dataLines.push(line.slice(5).trim());
          });
          if (!event) return; // heartbeat comment
          var data = {};
          try { data = JSON.parse(dataLines.join("\n") || "{}"); } catch (_) {}
          onEvent(event, data);
        });
        return pump();
      });
    }
    return pump();
  }

  // ---------- UI ----------
  function resetUi() {
    errorBox.hidden = true;
    errorBox.textContent = "";
    resultEl.hidden = true;
    pipelineEl.hidden = true;
  }

  function setAllStages(state) {
    ["fetch", "research", "score", "opener"].forEach(function (id) {
      setStage(id, state, "");
    });
  }

  function setStage(id, state, detail) {
    var el = pipelineEl.querySelector('[data-stage="' + id + '"]');
    if (!el) return;
    el.className = "stage " + state;
    if (detail !== undefined && detail !== "") {
      el.querySelector(".stage-detail").textContent = detail;
    }
  }

  function setStageDetail(id, detail) {
    var el = pipelineEl.querySelector('[data-stage="' + id + '"]');
    if (el) el.querySelector(".stage-detail").textContent = detail || "";
  }

  function showError(code, message) {
    pipelineEl.hidden = true;
    errorBox.hidden = false;
    var labels = {
      invalid_domain: "invalid domain",
      unreachable: "unreachable",
      rate_limited: "rate limited",
      demo_paused: "demo paused",
      over_budget: "over budget",
      timeout: "timeout",
      upstream: "error",
    };
    var strong = document.createElement("strong");
    strong.textContent = (labels[code] || "error") + " — ";
    errorBox.textContent = "";
    errorBox.appendChild(strong);
    errorBox.appendChild(document.createTextNode(message));
    if ((code === "rate_limited" || code === "demo_paused") && !examplesWrap.hidden) {
      errorBox.appendChild(document.createTextNode(" ↓"));
    }
  }

  function renderResult(r) {
    resultEl.hidden = false;

    document.getElementById("r-company").textContent =
      (r.company_name || r.domain) + "  ·  " + r.domain;

    var badges = document.getElementById("r-badges");
    badges.textContent = "";
    if (r.example) badges.appendChild(badge("cached example"));
    else if (r.cached) badges.appendChild(badge("cached result"));
    if (r.partial) badges.appendChild(badge("partial run"));

    var scoreNum = document.getElementById("r-score");
    var scoreWrap = document.getElementById("r-score-wrap");
    if (r.score === null || r.score === undefined) {
      scoreWrap.style.display = "none";
    } else {
      scoreWrap.style.display = "";
      scoreNum.textContent = r.score;
      scoreNum.className = "score-num " + (r.score >= 70 ? "" : r.score >= 40 ? "mid" : "low");
    }

    fillList("r-reasons", r.reasons || [], function (li, reason) {
      var claim = document.createElement("span");
      claim.textContent = reason.claim + " ";
      var ev = document.createElement("span");
      ev.className = "evidence";
      ev.textContent = reason.evidence + " ";
      li.appendChild(claim);
      li.appendChild(ev);
      if (reason.source_url) li.appendChild(sourceLink(reason.source_url));
    });
    document.getElementById("r-reasons-block").hidden = !(r.reasons && r.reasons.length);

    var openerBlock = document.getElementById("r-opener-block");
    if (r.opener) {
      openerBlock.hidden = false;
      document.getElementById("r-opener").textContent = r.opener;
      fillList("r-claims", r.claims || [], function (li, c) {
        li.appendChild(document.createTextNode('"' + c.text + '" '));
        if (c.source_url) li.appendChild(sourceLink(c.source_url));
      });
    } else {
      openerBlock.hidden = true;
    }

    fillList("r-sources", r.sources || [], function (li, s) {
      var a = document.createElement("a");
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = s.title && s.title !== s.url ? s.title : s.url;
      li.appendChild(a);
    });
    document.getElementById("r-sources-block").hidden = !(r.sources && r.sources.length);

    document.getElementById("r-notes").textContent = (r.notes || []).join(" ");

    var meta = document.getElementById("r-meta");
    meta.textContent = "";
    var cost = document.createElement("span");
    cost.className = "cost";
    cost.textContent = r.cached || r.example
      ? "cost of this lookup: $0.00 (cached)"
      : "cost of this run: $" + Number(r.cost_usd || 0).toFixed(3);
    meta.appendChild(cost);
    if (!r.cached && !r.example) {
      meta.appendChild(metaSpan(Number(r.tokens_in || 0).toLocaleString() + " tokens in"));
      meta.appendChild(metaSpan(Number(r.tokens_out || 0).toLocaleString() + " tokens out"));
      meta.appendChild(metaSpan((r.searches || 0) + " web searches"));
    }
  }

  function badge(text) {
    var s = document.createElement("span");
    s.textContent = text;
    return s;
  }

  function metaSpan(text) {
    var s = document.createElement("span");
    s.textContent = text;
    return s;
  }

  function sourceLink(url) {
    var a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    try { a.textContent = "[" + new URL(url).hostname.replace(/^www\./, "") + "]"; }
    catch (_) { a.textContent = "[source]"; }
    return a;
  }

  function fillList(id, items, build) {
    var ul = document.getElementById(id);
    ul.textContent = "";
    items.forEach(function (item) {
      var li = document.createElement("li");
      build(li, item);
      ul.appendChild(li);
    });
  }
})();
