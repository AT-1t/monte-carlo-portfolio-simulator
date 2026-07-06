"""
Monte Carlo Portfolio Simulator
--------------------------------
Flask backend that runs a vectorized Geometric Brownian Motion (GBM)
Monte Carlo simulation of a portfolio's future value, and returns
percentile bands, sample paths, an ending-value histogram, and
summary statistics for the frontend to chart with Plotly.
"""

from flask import Flask, jsonify, render_template, request
import numpy as np

app = Flask(__name__)

STEPS_PER_YEAR = 12          # monthly resolution
MAX_SIMULATIONS = 50_000
MAX_HORIZON_YEARS = 50
MAX_SAMPLE_PATHS = 60        # individual paths drawn on the chart for texture


def run_simulation(initial_investment, annual_return, annual_volatility,
                    horizon_years, num_simulations, seed=None):
    """
    Simulates `num_simulations` portfolio paths over `horizon_years` using
    Geometric Brownian Motion:

        S(t+dt) = S(t) * exp( (mu - 0.5*sigma^2)*dt + sigma*sqrt(dt)*Z )

    Returns a dict of everything the frontend needs to render charts.
    """
    rng = np.random.default_rng(seed)

    n_steps = int(round(horizon_years * STEPS_PER_YEAR))
    dt = 1.0 / STEPS_PER_YEAR

    mu = annual_return
    sigma = annual_volatility

    # Random shocks: shape (num_simulations, n_steps)
    z = rng.standard_normal(size=(num_simulations, n_steps))

    drift = (mu - 0.5 * sigma ** 2) * dt
    diffusion = sigma * np.sqrt(dt) * z

    log_returns = drift + diffusion
    cum_log_returns = np.cumsum(log_returns, axis=1)

    # Prepend t=0 (all paths start at the initial investment)
    paths = initial_investment * np.exp(cum_log_returns)
    paths = np.hstack([np.full((num_simulations, 1), initial_investment), paths])

    time_points = (np.arange(n_steps + 1) / STEPS_PER_YEAR).tolist()

    # Percentile bands across all simulations at every time step
    pct = {
        "p5": np.percentile(paths, 5, axis=0).tolist(),
        "p25": np.percentile(paths, 25, axis=0).tolist(),
        "p50": np.percentile(paths, 50, axis=0).tolist(),
        "p75": np.percentile(paths, 75, axis=0).tolist(),
        "p95": np.percentile(paths, 95, axis=0).tolist(),
    }

    # A handful of individual sample paths, drawn thin/translucent for texture
    n_sample = min(MAX_SAMPLE_PATHS, num_simulations)
    sample_idx = rng.choice(num_simulations, size=n_sample, replace=False)
    sample_paths = paths[sample_idx].tolist()

    ending_values = paths[:, -1]

    counts, bin_edges = np.histogram(ending_values, bins=60)
    histogram = {
        "counts": counts.tolist(),
        "bin_edges": bin_edges.tolist(),
    }

    prob_loss = float(np.mean(ending_values < initial_investment) * 100)

    stats = {
        "initial_investment": float(initial_investment),
        "mean": float(np.mean(ending_values)),
        "median": float(np.median(ending_values)),
        "std_dev": float(np.std(ending_values)),
        "p5": float(np.percentile(ending_values, 5)),
        "p25": float(np.percentile(ending_values, 25)),
        "p75": float(np.percentile(ending_values, 75)),
        "p95": float(np.percentile(ending_values, 95)),
        "best_case": float(np.max(ending_values)),
        "worst_case": float(np.min(ending_values)),
        "prob_loss": prob_loss,
        "num_simulations": int(num_simulations),
        "horizon_years": float(horizon_years),
    }

    return {
        "time_points": time_points,
        "percentile_paths": pct,
        "sample_paths": sample_paths,
        "histogram": histogram,
        "stats": stats,
    }


def _validated_inputs(payload):
    errors = []

    def to_float(key, default=None):
        try:
            return float(payload.get(key, default))
        except (TypeError, ValueError):
            errors.append(f"'{key}' must be a number.")
            return default

    initial_investment = to_float("initial_investment", 10000)
    expected_return = to_float("expected_return", 7) / 100.0
    volatility = to_float("volatility", 15) / 100.0
    horizon_years = to_float("horizon_years", 10)
    num_simulations = int(to_float("num_simulations", 2000))

    if initial_investment is not None and initial_investment <= 0:
        errors.append("Investment amount must be greater than 0.")
    if volatility is not None and volatility < 0:
        errors.append("Volatility cannot be negative.")
    if horizon_years is not None and not (0 < horizon_years <= MAX_HORIZON_YEARS):
        errors.append(f"Horizon must be between 0 and {MAX_HORIZON_YEARS} years.")
    if num_simulations is not None and not (1 <= num_simulations <= MAX_SIMULATIONS):
        errors.append(f"Number of simulations must be between 1 and {MAX_SIMULATIONS}.")

    return {
        "initial_investment": initial_investment,
        "expected_return": expected_return,
        "volatility": volatility,
        "horizon_years": horizon_years,
        "num_simulations": num_simulations,
    }, errors


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/simulate", methods=["POST"])
def simulate():
    payload = request.get_json(silent=True) or {}
    inputs, errors = _validated_inputs(payload)

    if errors:
        return jsonify({"error": " ".join(errors)}), 400

    result = run_simulation(
        initial_investment=inputs["initial_investment"],
        annual_return=inputs["expected_return"],
        annual_volatility=inputs["volatility"],
        horizon_years=inputs["horizon_years"],
        num_simulations=inputs["num_simulations"],
    )
    return jsonify(result)


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(debug=debug, host="0.0.0.0", port=port)
