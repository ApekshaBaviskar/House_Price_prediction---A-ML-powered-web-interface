"""
app.py
------
Flask API that serves the trained house-price model to the frontend.

Endpoints:
    GET  /api/health    -> quick check that the API and model are up
    POST /api/predict   -> { area, bedrooms, bathrooms, stories, parking,
                              mainroad, guestroom, basement, hotwaterheating,
                              airconditioning, prefarea, furnishingstatus }
                            returns { price, formatted_price }

Run:
    python app.py
Then open frontend/index.html in your browser (it calls http://localhost:5000).
"""

import os
import joblib
import pandas as pd
from flask import Flask, jsonify, request

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    # Allow the static frontend (opened from file:// or another port) to call this API.
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/api/predict", methods=["OPTIONS"])
def predict_options():
    return ("", 204)

_model = None


def get_model():
    global _model
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                "model.pkl not found. Run `python train_model.py` first."
            )
        _model = joblib.load(MODEL_PATH)
    return _model


REQUIRED_FIELDS = [
    "area",
    "bedrooms",
    "bathrooms",
    "stories",
    "parking",
    "mainroad",
    "guestroom",
    "basement",
    "hotwaterheating",
    "airconditioning",
    "prefarea",
    "furnishingstatus",
]

YES_NO_FIELDS = [
    "mainroad",
    "guestroom",
    "basement",
    "hotwaterheating",
    "airconditioning",
    "prefarea",
]

VALID_FURNISHING = {"furnished", "semi-furnished", "unfurnished"}


def format_inr(amount):
    """Formats a number using Indian digit grouping, e.g. 1,22,50,000."""
    amount = int(round(amount))
    s = str(amount)
    if len(s) <= 3:
        return s
    last3 = s[-3:]
    rest = s[:-3]
    parts = []
    while len(rest) > 2:
        parts.insert(0, rest[-2:])
        rest = rest[:-2]
    if rest:
        parts.insert(0, rest)
    return ",".join(parts) + "," + last3


@app.route("/api/health", methods=["GET"])
def health():
    model_ready = os.path.exists(MODEL_PATH)
    return jsonify({"status": "ok", "model_ready": model_ready})


@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or {}

    missing = [f for f in REQUIRED_FIELDS if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    try:
        area = float(data["area"])
        bedrooms = int(data["bedrooms"])
        bathrooms = int(data["bathrooms"])
        stories = int(data["stories"])
        parking = int(data["parking"])
    except (ValueError, TypeError):
        return jsonify({"error": "area/bedrooms/bathrooms/stories/parking must be numbers"}), 400

    if area <= 0:
        return jsonify({"error": "area must be greater than 0"}), 400
    for name, val in [("bedrooms", bedrooms), ("bathrooms", bathrooms), ("stories", stories), ("parking", parking)]:
        if val < 0:
            return jsonify({"error": f"{name} cannot be negative"}), 400

    for field in YES_NO_FIELDS:
        val = str(data[field]).strip().lower()
        if val not in ("yes", "no"):
            return jsonify({"error": f"{field} must be 'yes' or 'no'"}), 400
        data[field] = val

    furnishing = str(data["furnishingstatus"]).strip().lower()
    if furnishing not in VALID_FURNISHING:
        return jsonify({"error": f"furnishingstatus must be one of {sorted(VALID_FURNISHING)}"}), 400

    row = pd.DataFrame(
        [
            {
                "area": area,
                "bedrooms": bedrooms,
                "bathrooms": bathrooms,
                "stories": stories,
                "parking": parking,
                "mainroad": data["mainroad"],
                "guestroom": data["guestroom"],
                "basement": data["basement"],
                "hotwaterheating": data["hotwaterheating"],
                "airconditioning": data["airconditioning"],
                "prefarea": data["prefarea"],
                "furnishingstatus": furnishing,
            }
        ]
    )

    model = get_model()
    prediction = float(model.predict(row)[0])
    prediction = max(prediction, 0)

    return jsonify(
        {
            "price": round(prediction, 2),
            "formatted_price": f"Rs. {format_inr(prediction)}",
        }
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
