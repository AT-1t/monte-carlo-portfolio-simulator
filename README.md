# Portfolio Outcome Simulator

A Monte Carlo simulator for investment portfolios. Enter an investment
amount, expected annual return, annual volatility, and a time horizon,
and the app runs thousands of randomized future price paths (Geometric
Brownian Motion) to show you the *range* of outcomes you might expect —
not just a single projected number.

**Stack:** Flask (Python) backend + vanilla HTML/CSS/JS frontend + Plotly.js
for charting. No build step, no frontend framework required.

![status](https://img.shields.io/badge/status-ready--to--run-brightgreen)

---

## What it shows

- **Simulated portfolio paths** — a probability cone with 5th–95th and
  25th–75th percentile bands plus the median trajectory, with a handful
  of individual sample paths overlaid for texture.
- **Histogram of ending values** — the full distribution of outcomes
  across every simulated run, with the starting value and median marked.
- **Probability of loss** — the percentage of simulations that ended
  below your starting investment.
- **Median, 5th percentile, and 95th percentile outcomes.**
- **Full summary statistics** — mean, median, standard deviation,
  quartiles, best/worst case, and more.

The math: each simulation advances monthly using
`S(t+dt) = S(t) · exp[(μ − ½σ²)dt + σ√dt·Z]`, where `μ` is your expected
annual return, `σ` is annual volatility, and `Z` is a random standard
normal draw. This is the standard lognormal (GBM) model used for
first-pass portfolio projections — it assumes constant drift and
volatility and normally distributed log-returns, which is a
simplification of real markets (no fat tails, regime changes, or
correlation effects).

---

## Project structure

```
portfolio-sim/
├── app.py               # Flask app + Monte Carlo simulation engine
├── requirements.txt
├── Procfile              # for Heroku/Render-style process managers
├── templates/
│   └── index.html        # page markup
└── static/
    ├── style.css          # design system / layout
    └── script.js          # form handling, API calls, Plotly rendering
```

---

## Run it locally

Requires **Python 3.9+**.

```bash
# 1. Clone / unzip the project, then move into it
cd portfolio-sim

# 2. Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the development server
python app.py
```

Then open **http://127.0.0.1:5000** in your browser. Set your
assumptions in the left-hand panel and click **Run simulation**.

---

## Running in production

The dev server (`python app.py`) is fine for local use but not for
serving real traffic. Use a WSGI server such as **gunicorn** (already
in `requirements.txt`):

```bash
gunicorn app:app --bind 0.0.0.0:8000 --workers 2 --timeout 60
```

Increase `--timeout` if you expect people to run very large simulation
counts (20,000+ simulations over long horizons).

---

## Deploying so it's reachable from any browser

Any host that runs a Python/WSGI app will work. Three straightforward
free/low-cost options:

### Option A — Render.com
1. Push this project to a GitHub repo.
2. In Render, create a **New Web Service** from that repo.
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn app:app`
5. Deploy — Render gives you a public `https://your-app.onrender.com` URL.

### Option B — Railway.app
1. Push to GitHub, then "New Project → Deploy from GitHub repo" in Railway.
2. Railway auto-detects Python and the `Procfile`; no extra config needed.
3. Generate a public domain from the service settings.

### Option C — Fly.io
```bash
fly launch      # follow prompts; it detects Flask automatically
fly deploy
```

### Option D — PythonAnywhere (simplest for beginners, no Docker/CLI needed)
1. Upload the project files via their web-based file manager.
2. Create a new Flask web app pointing at `app.py`.
3. Reload — your app is live at `https://yourusername.pythonanywhere.com`.

> **Note:** whichever host you choose, make sure `PORT` is read from the
> environment if the platform requires it (Render/Railway inject a `PORT`
> env var). You can adapt the bottom of `app.py`:
> ```python
> import os
> if __name__ == "__main__":
>     port = int(os.environ.get("PORT", 5000))
>     app.run(host="0.0.0.0", port=port)
> ```

---

## Customizing

- **Simulation resolution:** change `STEPS_PER_YEAR` in `app.py` (default
  `12`, i.e. monthly steps). Higher values are smoother but slower.
- **Limits:** `MAX_SIMULATIONS` and `MAX_HORIZON_YEARS` in `app.py` guard
  against pathological inputs — raise them if you have the CPU budget.
- **Look and feel:** all design tokens (colors, fonts, spacing) live at
  the top of `static/style.css` as CSS custom properties.

---

## Disclaimer

This tool is for educational purposes only and does not constitute
financial advice. Historical and assumed returns are not guarantees of
future performance.
