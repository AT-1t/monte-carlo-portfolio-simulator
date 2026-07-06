// ============================================================
// Constants / theme (mirrors CSS custom properties in style.css)
// ============================================================
const THEME = {
  bg: "#0B1120",
  surface: "#121A2E",
  grid: "#202B48",
  text: "#E9EDF6",
  textDim: "#8D97B3",
  gold: "#E3B341",
  teal: "#4FD1C5",
  rose: "#E2607A",
  violet: "#8B90FF",
};

const fontFamily = "Inter, sans-serif";
const monoFamily = "'IBM Plex Mono', monospace";

// ============================================================
// Formatting helpers
// ============================================================
const currencyFmt = (value, compact = false) => {
  if (compact) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

const pct = (value, digits = 1) => `${value.toFixed(digits)}%`;

// ============================================================
// Live slider readouts
// ============================================================
const sliderConfigs = [
  { id: "expected_return", format: (v) => `${parseFloat(v).toFixed(1)}%` },
  { id: "volatility", format: (v) => `${parseFloat(v).toFixed(1)}%` },
  { id: "horizon_years", format: (v) => `${parseInt(v, 10)} yrs` },
  { id: "num_simulations", format: (v) => parseInt(v, 10).toLocaleString() },
];

sliderConfigs.forEach(({ id, format }) => {
  const input = document.getElementById(id);
  const readout = document.getElementById(`${id}_readout`);
  input.addEventListener("input", () => {
    readout.textContent = format(input.value);
  });
});

// ============================================================
// Form submit -> call API -> render
// ============================================================
const form = document.getElementById("sim-form");
const runBtn = document.getElementById("run-btn");
const emptyState = document.getElementById("empty-state");
const resultsEl = document.getElementById("results");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    initial_investment: parseFloat(document.getElementById("initial_investment").value),
    expected_return: parseFloat(document.getElementById("expected_return").value),
    volatility: parseFloat(document.getElementById("volatility").value),
    horizon_years: parseFloat(document.getElementById("horizon_years").value),
    num_simulations: parseInt(document.getElementById("num_simulations").value, 10),
  };

  setLoading(true);

  try {
    const res = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Something went wrong running the simulation.");
      return;
    }

    emptyState.classList.add("hidden");
    resultsEl.classList.remove("hidden");

    renderHeroStats(data.stats);
    renderStatsGrid(data.stats);
    renderPathsChart(data);
    renderHistogram(data);
  } catch (err) {
    console.error(err);
    alert("Could not reach the simulation server. Is the Flask app running?");
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  runBtn.classList.toggle("loading", isLoading);
  runBtn.disabled = isLoading;
}

// ============================================================
// Hero stats
// ============================================================
function renderHeroStats(stats) {
  document.getElementById("stat-median").textContent = currencyFmt(stats.median);
  document.getElementById("stat-median-multiple").textContent =
    `${(stats.median / stats.initial_investment).toFixed(2)}x initial investment`;
  document.getElementById("stat-p5").textContent = currencyFmt(stats.p5, true);
  document.getElementById("stat-p95").textContent = currencyFmt(stats.p95, true);
  document.getElementById("stat-prob-loss").textContent = pct(stats.prob_loss);
}

// ============================================================
// Stats grid
// ============================================================
function renderStatsGrid(stats) {
  const items = [
    ["Starting value", currencyFmt(stats.initial_investment)],
    ["Mean ending value", currencyFmt(stats.mean)],
    ["Median ending value", currencyFmt(stats.median)],
    ["Std. deviation", currencyFmt(stats.std_dev)],
    ["25th percentile", currencyFmt(stats.p25)],
    ["75th percentile", currencyFmt(stats.p75)],
    ["5th percentile", currencyFmt(stats.p5)],
    ["95th percentile", currencyFmt(stats.p95)],
    ["Best case", currencyFmt(stats.best_case)],
    ["Worst case", currencyFmt(stats.worst_case)],
    ["Probability of loss", pct(stats.prob_loss)],
    ["Simulations run", stats.num_simulations.toLocaleString()],
  ];

  const grid = document.getElementById("stats-grid");
  grid.innerHTML = items
    .map(
      ([label, value]) => `
      <div class="stat-item">
        <dt>${label}</dt>
        <dd>${value}</dd>
      </div>`
    )
    .join("");
}

// ============================================================
// Probability cone / paths chart
// ============================================================
function renderPathsChart(data) {
  const t = data.time_points;
  const p = data.percentile_paths;

  const traces = [];

  // Faint individual sample paths (drawn first, underneath the bands)
  data.sample_paths.forEach((path, i) => {
    traces.push({
      x: t,
      y: path,
      type: "scatter",
      mode: "lines",
      line: { width: 1, color: "rgba(141, 151, 179, 0.18)" },
      hoverinfo: "skip",
      showlegend: false,
    });
  });

  // 5-95 band
  traces.push({
    x: t.concat([...t].reverse()),
    y: p.p95.concat([...p.p5].reverse()),
    type: "scatter",
    fill: "toself",
    fillcolor: "rgba(79, 209, 197, 0.10)",
    line: { color: "rgba(0,0,0,0)" },
    name: "5th–95th percentile",
    hoverinfo: "skip",
  });

  // 25-75 band
  traces.push({
    x: t.concat([...t].reverse()),
    y: p.p75.concat([...p.p25].reverse()),
    type: "scatter",
    fill: "toself",
    fillcolor: "rgba(79, 209, 197, 0.22)",
    line: { color: "rgba(0,0,0,0)" },
    name: "25th–75th percentile",
    hoverinfo: "skip",
  });

  // 5th / 95th boundary lines (thin, teal)
  traces.push({
    x: t, y: p.p95, type: "scatter", mode: "lines",
    line: { width: 1.4, color: THEME.teal, dash: "dot" },
    name: "95th percentile",
    hovertemplate: "Year %{x:.1f}<br>%{y:$,.0f}<extra>95th pct</extra>",
  });
  traces.push({
    x: t, y: p.p5, type: "scatter", mode: "lines",
    line: { width: 1.4, color: THEME.rose, dash: "dot" },
    name: "5th percentile",
    hovertemplate: "Year %{x:.1f}<br>%{y:$,.0f}<extra>5th pct</extra>",
  });

  // Median path (signature line)
  traces.push({
    x: t, y: p.p50, type: "scatter", mode: "lines",
    line: { width: 3, color: THEME.gold },
    name: "Median path",
    hovertemplate: "Year %{x:.1f}<br>%{y:$,.0f}<extra>Median</extra>",
  });

  const layout = baseLayout({
    xaxis: { title: "Years", gridcolor: THEME.grid, zerolinecolor: THEME.grid, tickfont: { color: THEME.textDim } },
    yaxis: {
      title: "Portfolio value ($)",
      gridcolor: THEME.grid,
      zerolinecolor: THEME.grid,
      tickfont: { color: THEME.textDim },
      tickprefix: "$",
      separatethousands: true,
    },
    legend: {
      orientation: "h",
      y: -0.18,
      font: { color: THEME.textDim, size: 11 },
    },
    margin: { l: 70, r: 20, t: 10, b: 50 },
  });

  Plotly.newPlot("paths-chart", traces, layout, plotConfig());
}

// ============================================================
// Histogram
// ============================================================
function renderHistogram(data) {
  const edges = data.histogram.bin_edges;
  const counts = data.histogram.counts;
  const centers = edges.slice(0, -1).map((e, i) => (e + edges[i + 1]) / 2);
  const widths = edges.slice(0, -1).map((e, i) => edges[i + 1] - e);

  const initial = data.stats.initial_investment;

  const colors = centers.map((c) => (c < initial ? THEME.rose : THEME.teal));

  const trace = {
    x: centers,
    y: counts,
    width: widths,
    type: "bar",
    marker: { color: colors, opacity: 0.85, line: { width: 0 } },
    hovertemplate: "%{x:$,.0f}<br>%{y} runs<extra></extra>",
  };

  const shapes = [
    {
      type: "line",
      x0: initial, x1: initial, y0: 0, y1: 1, yref: "paper",
      line: { color: THEME.text, width: 1.5, dash: "dash" },
    },
    {
      type: "line",
      x0: data.stats.median, x1: data.stats.median, y0: 0, y1: 1, yref: "paper",
      line: { color: THEME.gold, width: 2 },
    },
  ];

  const layout = baseLayout({
    xaxis: {
      title: "Ending portfolio value ($)",
      gridcolor: THEME.grid,
      zerolinecolor: THEME.grid,
      tickfont: { color: THEME.textDim },
      tickprefix: "$",
      separatethousands: true,
    },
    yaxis: { title: "Number of simulations", gridcolor: THEME.grid, tickfont: { color: THEME.textDim } },
    shapes,
    margin: { l: 60, r: 20, t: 10, b: 50 },
    bargap: 0.02,
    annotations: [
      {
        x: initial, y: 1, yref: "paper", yanchor: "bottom",
        text: "Start", showarrow: false,
        font: { color: THEME.textDim, size: 11, family: monoFamily },
      },
      {
        x: data.stats.median, y: 1, yref: "paper", yanchor: "bottom",
        text: "Median", showarrow: false,
        font: { color: THEME.gold, size: 11, family: monoFamily },
      },
    ],
  });

  Plotly.newPlot("hist-chart", [trace], layout, plotConfig());
}

// ============================================================
// Shared Plotly layout / config
// ============================================================
function baseLayout(overrides) {
  return Object.assign(
    {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: fontFamily, color: THEME.text, size: 12 },
      hoverlabel: {
        bgcolor: THEME.surface,
        bordercolor: THEME.grid,
        font: { family: monoFamily, color: THEME.text, size: 12 },
      },
      xaxis: { gridcolor: THEME.grid },
      yaxis: { gridcolor: THEME.grid },
    },
    overrides
  );
}

function plotConfig() {
  return { responsive: true, displayModeBar: false };
}

// Trigger an initial run so the page never feels broken/empty on load.
// (Comment out if you prefer the user to click "Run simulation" first.)
// form.requestSubmit();
