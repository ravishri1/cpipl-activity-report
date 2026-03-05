# CPIPL Predictive Maintenance ML Module

## Overview

This module trains a Random Forest classifier to predict asset failure risk based on historical repair data, vendor metrics, and asset characteristics.

## Components

### train_model.py (592 lines)

Main training script with 4 core classes:

**FailureLabelGenerator**
- Generates binary failure labels based on repair history
- Logic: Recent repairs, high frequency, long turnaround, age+usage
- Returns: 0 (healthy) or 1 (failure expected)

**DataExtractor**
- Connects to SQLite database
- Fetches assets, repair history, vendor metrics
- Normalizes data from multiple sources

**FeatureExtractor**
- Extracts 15 engineered features:
  1. asset_age_months
  2. purchase_price
  3. current_value_ratio
  4. repair_count
  5. repair_frequency_per_month
  6. avg_repair_cost
  7. total_repair_cost
  8. cost_overrun_ratio
  9. avg_turnaround_days
  10. overdue_repairs
  11. avg_days_overdue
  12. vendor_on_time_rate
  13. vendor_cost_variance
  14. vendor_total_repairs
  15. health_score

- Standardizes features using StandardScaler

**Training Pipeline**
- Train/test split: 80/20
- Model: Random Forest (100 trees, max_depth=12)
- Evaluation: Accuracy, Precision, Recall, F1, AUC-ROC
- Output: Trained model + performance metadata

## Installation

```bash
pip install -r requirements.txt
```

## Usage

### Basic Training
```bash
python train_model.py
```
Uses default database path: `../prisma/dev.db`

### Custom Database Path
```bash
python train_model.py --db /path/to/dev.db
```

### Adjust Test Split
```bash
python train_model.py --test-split 0.25
```

### Custom Output Directory
```bash
python train_model.py --output-dir ./models
```

## Output Files

### predictive_model.pkl
Binary file containing:
- Trained RandomForestClassifier
- Fitted StandardScaler

Load in Python:
```python
import pickle
with open('predictive_model.pkl', 'rb') as f:
    data = pickle.load(f)
    model = data['model']
    scaler = data['scaler']
```

### model_metadata.json
JSON file containing:
- Model type and training date
- Feature names and importances
- Performance metrics (train/test)
- Confusion matrix
- Hyperparameters
- Data split information

## Performance

Expected metrics on typical dataset:
- **Accuracy:** 75-85%
- **Precision:** 70-80% (false positive rate)
- **Recall:** 65-75% (false negative rate)
- **F1 Score:** 70-77%
- **AUC-ROC:** 75-85%

## Feature Importance

Top features typically:
1. repair_frequency_per_month (15-20%)
2. avg_turnaround_days (12-15%)
3. repair_count (10-12%)
4. asset_age_months (8-10%)
5. health_score (8-10%)

## Integration with Backend

The trained model is loaded by the predictions service:
- `server/src/services/predictiveModeling.js`

Functions:
- `predictUsingModel()` - Uses loaded model for predictions
- `loadModel()` - Loads model from `predictive_model.pkl`
- `preprocessFeatures()` - Applies scaler to new data

## Training Schedule

Recommended retraining:
- **Weekly:** Quick evaluation of current model accuracy
- **Monthly:** Full retraining with accumulated new data
- **Quarterly:** Model validation and threshold tuning

## Troubleshooting

**Insufficient data error:**
```
✗ Insufficient data (5 assets). Need at least 10.
```
Solution: Ensure database has at least 10 assets with repair history

**Database not found:**
```
✗ Database not found: ../prisma/dev.db
```
Solution: Verify database path or use `--db` flag

**Import errors:**
```
ModuleNotFoundError: No module named 'sklearn'
```
Solution: Run `pip install -r requirements.txt`

## Model Improvements (Future)

- [ ] Cross-validation for robust evaluation
- [ ] Hyperparameter tuning (GridSearchCV)
- [ ] Class weighting for imbalanced data
- [ ] Feature selection algorithms
- [ ] Ensemble methods (XGBoost, LightGBM)
- [ ] Time-series aware training
- [ ] Online learning for continuous updates
