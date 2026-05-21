"""
Business Classification ML Service
===================================
Uses HistGradientBoostingClassifier which natively handles NaN values —
no imputer needed. A "Not sure" answer becomes its own tree branch signal.

Feature vector (5 features):
  scale:      ordinal 0-3 | NaN   (business size / headcount)
  volume:     ordinal 0-3 | NaN   (daily customer volume)
  complexity: ordinal 0-3 | NaN   (product catalog size)
  locations:  ordinal 0-3         (number of stores — always answered)
  bizType:    ordinal 0-4         (business type — always answered)
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import LabelEncoder

logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
ML_DIR = Path(__file__).parent.parent / "ml_models"
MODEL_PATH = ML_DIR / "business_classifier.pkl"
ENCODER_PATH = ML_DIR / "label_encoder.pkl"
TRAINING_DATA_PATH = ML_DIR / "training_data.csv"
METADATA_PATH = ML_DIR / "model_metadata.json"

# ── Constants ─────────────────────────────────────────────────────────────────
FEATURE_COLS = ["scale", "volume", "complexity", "locations", "bizType"]
TARGET_COL = "label"
CLASSES = ["small", "medium", "large"]
RETRAIN_EVERY_N = 50   # auto-retrain after this many new real samples

BIZ_TYPE_MAP = {
    "retail": 0,
    "grocery": 1,
    "pharmacy": 2,
    "apparel": 3,
    "other": 4,
}

# Frontend-friendly schema describing expected inputs and ordinal breakpoints
FEATURE_SCHEMA = {
    "features": {
        "scale": {
            "type": "ordinal",
            "description": "Business headcount mapped to ordinal scale",
            "breaks": [10, 50, 100],
            "levels": 4
        },
        "volume": {
            "type": "ordinal",
            "description": "Transactions in last 30 days mapped to ordinal volume",
            "breaks": [100, 1000, 10000],
            "levels": 4
        },
        "complexity": {
            "type": "ordinal",
            "description": "Inventory size mapped to ordinal complexity",
            "breaks": [1000, 5000, 15000],
            "levels": 4
        },
        "locations": {
            "type": "integer",
            "description": "Number of store locations (0+)",
            "min": 0
        },
        "bizType": {
            "type": "categorical",
            "description": "Business category",
            "mapping": BIZ_TYPE_MAP
        }
    },
    "classes": CLASSES
}


def _encode_biz_type(biz_type: str) -> int:
    return BIZ_TYPE_MAP.get(str(biz_type).lower(), 4)


def _signal_quality(row: dict) -> float:
    """Fraction of features that are non-null (locations & bizType always present)."""
    nullable = ["scale", "volume", "complexity"]
    answered = sum(1 for k in nullable if row.get(k) is not None)
    return round((answered + 2) / 5, 2)   # +2 for locations + bizType always present


def _confidence_message(confidence: float, signal_quality: float) -> str:
    if signal_quality == 1.0:
        return "High confidence — all signals answered."
    if signal_quality >= 0.6:
        return f"Good confidence — {int(signal_quality * 5)}/5 signals used. Add more details to refine."
    return f"Estimated tier — only {int(signal_quality * 5)}/5 signals available. Answer more questions for accuracy."


def _rule_score_and_class(row: dict):
    """Simple deterministic weighted-score fallback.

    Uses available ordinal signals (0-3) and locations to compute a score in
    the same 0..3 range. Returns (score, classification, breakdown).
    """
    def _num(v):
        try:
            return float(v) if v is not None else 0.0
        except Exception:
            return 0.0

    s = _num(row.get("scale"))
    v = _num(row.get("volume"))
    c = _num(row.get("complexity"))
    l = int(row.get("locations", 0) or 0)
    # clamp locations to ordinal-like 0..3
    if l <= 0:
        l_ord = 0.0
    elif l == 1:
        l_ord = 1.0
    elif l <= 3:
        l_ord = 2.0
    else:
        l_ord = 3.0

    # weights chosen to reflect importance: headcount & volume > complexity > locations
    weights = {"scale": 0.30, "volume": 0.30, "complexity": 0.20, "locations": 0.20}

    score = (s * weights["scale"] + v * weights["volume"] + c * weights["complexity"] + l_ord * weights["locations"])

    # thresholds calibrated for 0..3 scale
    if score < 1.2:
        cls = "small"
    elif score < 2.2:
        cls = "medium"
    else:
        cls = "large"

    breakdown = {
        "scale": round(s, 3),
        "volume": round(v, 3),
        "complexity": round(c, 3),
        "locations": round(l_ord, 3),
        "weights": weights,
    }
    return round(score, 3), cls, breakdown


# ── Seed data generator ───────────────────────────────────────────────────────
def _generate_seed_data(n: int = 500) -> pd.DataFrame:
    """
    Generate synthetic but realistic training samples across 3 classes.
    ~15% of nullable features are randomly set to NaN to teach the model
    how to handle missing answers from day one.
    """
    rng = np.random.default_rng(42)
    rows = []

    def noisy(val, low=0, high=3):
        return int(np.clip(val + rng.integers(-1, 2), low, high))

    def maybe_null(val, null_prob=0.15):
        return None if rng.random() < null_prob else val

    configs = [
        # (label, scale_base, volume_base, complexity_base, loc_base, count)
        ("small",  0, 0, 0, 0, int(n * 0.40)),
        ("medium", 2, 1, 2, 1, int(n * 0.35)),
        ("large",  3, 3, 3, 2, int(n * 0.25)),
    ]

    for label, sb, vb, cb, lb, count in configs:
        for _ in range(count):
            rows.append({
                "scale":      maybe_null(noisy(sb)),
                "volume":     maybe_null(noisy(vb)),
                "complexity": maybe_null(noisy(cb)),
                "locations":  noisy(lb),
                "bizType":    rng.integers(0, 5),
                "label":      label,
                "synthetic":  True,
            })

    df = pd.DataFrame(rows)
    # Ensure float so NaN is representable
    for col in ["scale", "volume", "complexity"]:
        df[col] = df[col].astype("Float64")
    return df


# ── Classifier class ──────────────────────────────────────────────────────────
class BusinessClassifier:
    """Singleton-style ML classifier for business tier prediction."""

    def __init__(self):
        self._pipeline: Optional[HistGradientBoostingClassifier] = None
        self._metadata: dict = {}
        self._new_samples_since_retrain: int = 0

    # ── Public API ────────────────────────────────────────────────────────────

    def initialize(self):
        """Call once at server startup. Loads existing model or trains from seed."""
        ML_DIR.mkdir(parents=True, exist_ok=True)

        if MODEL_PATH.exists() and ENCODER_PATH.exists():
            self._pipeline = joblib.load(MODEL_PATH)
            self._metadata = self._load_metadata()
            logger.info(
                f"[ML] Loaded classifier — "
                f"{self._metadata.get('n_samples', '?')} training samples, "
                f"CV accuracy {self._metadata.get('cv_accuracy', '?')}"
            )
        else:
            logger.info("[ML] No saved model found — training from seed data …")
            df = _generate_seed_data(500)
            df.to_csv(TRAINING_DATA_PATH, index=False)
            self._fit(df)
            logger.info("[ML] Classifier ready (seed data).")

    def predict(self, request: dict) -> dict:
        """
        Classify a business from a request dict.

        Expected keys (all optional except locations & bizType):
            scale, volume, complexity, locations, bizType (string)
        """
        if self._pipeline is None:
            raise RuntimeError("BusinessClassifier not initialized. Call initialize() first.")

        # Build feature row
        row = {
            "scale":      request.get("scale"),        # None → NaN
            "volume":     request.get("volume"),
            "complexity": request.get("complexity"),
            "locations":  int(request.get("locations", 0)),
            "bizType":    _encode_biz_type(request.get("bizType", "other")),
        }

        X = self._row_to_array(row)
        label = self._pipeline.predict(X)[0]
        probas = self._pipeline.predict_proba(X)[0]

        confidence = float(probas.max())
        signal_quality = _signal_quality(row)
        # also compute a deterministic rule-based fallback score/class
        rule_score, rule_cls, rule_breakdown = _rule_score_and_class(row)

        return {
            "classification": label,
            "confidence": round(confidence, 4),
            "signalQuality": signal_quality,
            "probabilities": {
                cls: round(float(p), 4)
                for cls, p in zip(CLASSES, probas)
            },
            "message": _confidence_message(confidence, signal_quality),
            "ruleScore": rule_score,
            "ruleClassification": rule_cls,
            "ruleBreakdown": rule_breakdown,
        }

    def append_sample(self, request: dict, confirmed_label: str):
        """
        Append a real user's confirmed classification to the training CSV.
        Auto-retrains every RETRAIN_EVERY_N real samples.
        """
        row = {
            "scale":      request.get("scale"),
            "volume":     request.get("volume"),
            "complexity": request.get("complexity"),
            "locations":  int(request.get("locations", 0)),
            "bizType":    _encode_biz_type(request.get("bizType", "other")),
            "label":      confirmed_label,
            "synthetic":  False,
        }
        df_row = pd.DataFrame([row])
        write_header = not TRAINING_DATA_PATH.exists()
        df_row.to_csv(TRAINING_DATA_PATH, mode="a", header=write_header, index=False)

        self._new_samples_since_retrain += 1
        if self._new_samples_since_retrain >= RETRAIN_EVERY_N:
            logger.info(f"[ML] Auto-retrain triggered after {RETRAIN_EVERY_N} new samples.")
            self.retrain()

    def retrain(self):
        """Full retrain on all data in training_data.csv."""
        if not TRAINING_DATA_PATH.exists():
            logger.warning("[ML] No training data found — skipping retrain.")
            return
        df = pd.read_csv(TRAINING_DATA_PATH)
        self._fit(df)
        self._new_samples_since_retrain = 0
        logger.info(f"[ML] Retrain complete — {len(df)} samples, CV accuracy {self._metadata.get('cv_accuracy')}")

    def get_status(self) -> dict:
        return {
            **self._metadata,
            "model_path": str(MODEL_PATH),
            "pending_until_retrain": max(0, RETRAIN_EVERY_N - self._new_samples_since_retrain),
        }

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _fit(self, df: pd.DataFrame):
        """Train pipeline, cross-validate, save to disk."""
        # Prepare features — NaN stays as NaN (HistGBT handles it natively)
        X = df[FEATURE_COLS].copy()
        for col in ["scale", "volume", "complexity"]:
            X[col] = X[col].astype("Float64")
        y = df[TARGET_COL].values

        clf = HistGradientBoostingClassifier(
            max_iter=300,
            max_depth=4,
            min_samples_leaf=5,
            class_weight="balanced",
            random_state=42,
            categorical_features=[4],  # bizType column
        )
        clf.fit(X, y)

        # Cross-validate for metadata
        cv_scores = cross_val_score(clf, X, y, cv=5, scoring="accuracy")
        cv_acc = round(float(cv_scores.mean()), 4)

        joblib.dump(clf, MODEL_PATH)

        meta = {
            "trained_at": datetime.utcnow().isoformat(),
            "n_samples": len(df),
            "n_synthetic": int(df.get("synthetic", pd.Series([True] * len(df))).sum()),
            "n_real": int((~df.get("synthetic", pd.Series([True] * len(df)))).sum()),
            "cv_accuracy": cv_acc,
            "cv_std": round(float(cv_scores.std()), 4),
            "classes": CLASSES,
        }
        with open(METADATA_PATH, "w") as f:
            json.dump(meta, f, indent=2)

        self._pipeline = clf
        self._metadata = meta

    def _row_to_array(self, row: dict) -> pd.DataFrame:
        """Convert a single feature dict to a DataFrame row for prediction."""
        df = pd.DataFrame([row], columns=FEATURE_COLS)
        for col in ["scale", "volume", "complexity"]:
            df[col] = df[col].astype("Float64")
        df["locations"] = df["locations"].astype(int)
        df["bizType"] = df["bizType"].astype(int)
        return df

    def _load_metadata(self) -> dict:
        if METADATA_PATH.exists():
            with open(METADATA_PATH) as f:
                return json.load(f)
        return {}


# ── Global singleton ──────────────────────────────────────────────────────────
classifier = BusinessClassifier()
