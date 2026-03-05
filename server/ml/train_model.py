"""
CPIPL HR System - Predictive Maintenance ML Training Script
Trains Random Forest classifier to predict asset failure risk

Usage:
  python train_model.py                    # Train with default DB path
  python train_model.py --db /path/to/dev.db --test-split 0.2

Output:
  - predictive_model.pkl (trained model)
  - model_metadata.json (performance metrics + feature importance)
"""

import sqlite3
import json
import pickle
import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, 
    roc_auc_score, confusion_matrix, classification_report
)


class FailureLabelGenerator:
    """Generate binary failure labels for assets based on repair history."""
    
    @staticmethod
    def generate_labels(asset_id, repairs, prediction_window_days=30):
        """
        Generate binary label: will this asset fail in the next N days?
        
        Logic:
        - If asset has repair in last 30 days: likely failed recently
        - If asset has 3+ repairs in last 90 days: likely to fail soon
        - If repair turnaround > 10 days: indicates serious issues
        - If asset age > 60 months + high repair frequency: will fail
        
        Args:
            asset_id: Asset ID
            repairs: List of repair records with date and turnaround
            prediction_window_days: Days ahead to predict (default 30)
        
        Returns:
            Binary label (0=no failure, 1=failure expected)
        """
        if not repairs:
            return 0  # No history = assume healthy
        
        # Recent repair (last 30 days) = likely to fail again
        recent_repair = any(
            (datetime.now() - datetime.fromisoformat(r['repairDate'])).days <= 30
            for r in repairs
        )
        if recent_repair:
            return 1
        
        # High repair frequency (3+ repairs in 90 days)
        three_months_ago = datetime.now() - timedelta(days=90)
        repairs_in_90_days = sum(
            1 for r in repairs 
            if datetime.fromisoformat(r['repairDate']) > three_months_ago
        )
        if repairs_in_90_days >= 3:
            return 1
        
        # Long turnaround times indicate serious issues
        avg_turnaround = np.mean([
            r.get('turnaroundDays', 0) for r in repairs[-5:]  # Last 5 repairs
        ]) if repairs else 0
        if avg_turnaround > 10:
            return 1
        
        # Default: healthy
        return 0


class DataExtractor:
    """Extract features and labels from SQLite database."""
    
    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
    
    def get_all_assets(self):
        """Fetch all assets from database."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT 
                a.id, a.name, a.assetTag, a.type, a.status,
                a.purchaseDate, a.purchasePrice, a.currentValue,
                a.vendorId, a.location, a.serialNumber,
                h.overallHealthScore, h.riskLevel
            FROM Asset a
            LEFT JOIN AssetHealthScore h ON a.id = h.assetId
            ORDER BY a.id
        """)
        return cursor.fetchall()
    
    def get_asset_repairs(self, asset_id):
        """Fetch repair history for asset."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT 
                id, repairType, sentOutDate, expectedReturnDate, 
                actualReturnDate, daysOverdue, vendor, estimatedCost, 
                actualCost
            FROM AssetRepair
            WHERE assetId = ?
            ORDER BY sentOutDate DESC
        """, (asset_id,))
        repairs = []
        for row in cursor.fetchall():
            repairs.append({
                'repairDate': row['sentOutDate'],
                'repairType': row['repairType'],
                'turnaroundDays': (
                    (datetime.fromisoformat(row['actualReturnDate']) - 
                     datetime.fromisoformat(row['sentOutDate'])).days
                    if row['actualReturnDate'] else 0
                ),
                'daysOverdue': row['daysOverdue'] or 0,
                'estimatedCost': row['estimatedCost'] or 0,
                'actualCost': row['actualCost'] or 0,
                'vendor': row['vendor']
            })
        return repairs
    
    def get_vendor_metrics(self, vendor_name):
        """Calculate vendor performance metrics."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT 
                COUNT(*) as total_repairs,
                COUNT(CASE WHEN daysOverdue <= 0 THEN 1 END) as on_time_count,
                AVG(daysOverdue) as avg_overdue,
                AVG(CASE 
                    WHEN actualCost IS NOT NULL AND estimatedCost IS NOT NULL
                    THEN (actualCost - estimatedCost) / estimatedCost * 100
                    ELSE 0
                END) as cost_variance
            FROM AssetRepair
            WHERE vendor = ?
        """, (vendor_name,))
        result = cursor.fetchone()
        if not result or result['total_repairs'] == 0:
            return {
                'on_time_rate': 1.0,
                'avg_overdue': 0,
                'cost_variance': 0,
                'total_repairs': 0
            }
        return {
            'on_time_rate': result['on_time_count'] / result['total_repairs'],
            'avg_overdue': result['avg_overdue'] or 0,
            'cost_variance': result['cost_variance'] or 0,
            'total_repairs': result['total_repairs']
        }
    
    def close(self):
        """Close database connection."""
        self.conn.close()


class FeatureExtractor:
    """Extract and engineer features from raw asset data."""
    
    @staticmethod
    def extract_features(asset, repairs, vendor_metrics):
        """
        Extract 15 features for ML model:
        
        1. asset_age_months - Months since purchase
        2. purchase_price - Original asset cost
        3. current_value_ratio - Current value / purchase price
        4. repair_count - Total number of repairs
        5. repair_frequency_per_month - Repairs / age in months
        6. avg_repair_cost - Average cost per repair
        7. total_repair_cost - Sum of all repair costs
        8. cost_overrun_ratio - Actual vs estimated repair costs
        9. avg_turnaround_days - Average days for repair
        10. overdue_repairs - Number of overdue repairs
        11. avg_days_overdue - Average overdue days
        12. vendor_on_time_rate - Vendor on-time performance %
        13. vendor_cost_variance - Vendor cost variance %
        14. vendor_total_repairs - Vendor historical repairs
        15. health_score - Current health score (0-100)
        
        Args:
            asset: Asset record from database
            repairs: List of repair records
            vendor_metrics: Vendor performance metrics
        
        Returns:
            features (list): 15 feature values
            feature_names (list): Names of features
        """
        # Calculate age in months
        purchase_date = datetime.fromisoformat(asset['purchaseDate'])
        asset_age_months = (datetime.now() - purchase_date).days / 30.44
        
        # Financial metrics
        purchase_price = asset['purchasePrice'] or 1000
        current_value = asset['currentValue'] or (purchase_price * 0.5)
        current_value_ratio = current_value / purchase_price
        
        # Repair history metrics
        repair_count = len(repairs)
        repair_frequency = repair_count / max(asset_age_months, 1)
        
        repair_costs = [r['actualCost'] for r in repairs if r['actualCost']]
        avg_repair_cost = np.mean(repair_costs) if repair_costs else 0
        total_repair_cost = sum(repair_costs)
        
        # Cost overrun analysis
        cost_estimates = [r['estimatedCost'] for r in repairs if r['estimatedCost']]
        cost_actuals = [r['actualCost'] for r in repairs if r['actualCost']]
        cost_overrun_ratio = (
            np.mean(np.array(cost_actuals) / np.array(cost_estimates)) - 1
            if cost_estimates and cost_actuals else 0
        )
        
        # Turnaround metrics
        turnaround_days = [r['turnaroundDays'] for r in repairs]
        avg_turnaround_days = np.mean(turnaround_days) if turnaround_days else 0
        
        overdue_repairs = sum(1 for r in repairs if r['daysOverdue'] > 0)
        avg_days_overdue = np.mean([
            r['daysOverdue'] for r in repairs if r['daysOverdue'] > 0
        ]) if overdue_repairs > 0 else 0
        
        # Vendor metrics
        vendor_on_time_rate = vendor_metrics['on_time_rate']
        vendor_cost_variance = vendor_metrics['cost_variance']
        vendor_total_repairs = vendor_metrics['total_repairs']
        
        # Health score (use existing score or estimate)
        health_score = asset['overallHealthScore'] or 75
        
        features = [
            asset_age_months,
            purchase_price,
            current_value_ratio,
            repair_count,
            repair_frequency,
            avg_repair_cost,
            total_repair_cost,
            cost_overrun_ratio,
            avg_turnaround_days,
            overdue_repairs,
            avg_days_overdue,
            vendor_on_time_rate,
            vendor_cost_variance,
            vendor_total_repairs,
            health_score
        ]
        
        feature_names = [
            'asset_age_months',
            'purchase_price',
            'current_value_ratio',
            'repair_count',
            'repair_frequency_per_month',
            'avg_repair_cost',
            'total_repair_cost',
            'cost_overrun_ratio',
            'avg_turnaround_days',
            'overdue_repairs',
            'avg_days_overdue',
            'vendor_on_time_rate',
            'vendor_cost_variance',
            'vendor_total_repairs',
            'health_score'
        ]
        
        return features, feature_names
    
    @staticmethod
    def normalize_features(X):
        """
        Normalize features using StandardScaler.
        
        Args:
            X: Feature matrix (n_samples, n_features)
        
        Returns:
            X_scaled: Normalized features
            scaler: Fitted StandardScaler object (for saving)
        """
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        return X_scaled, scaler


def train_model(db_path, test_split=0.2, random_state=42):
    """
    Main training pipeline.
    
    Steps:
    1. Extract data from SQLite
    2. Generate failure labels
    3. Engineer 15 features
    4. Split into train/test sets
    5. Train Random Forest (100 trees, max_depth=12)
    6. Evaluate performance
    7. Save model and metadata
    
    Args:
        db_path: Path to SQLite database
        test_split: Train/test ratio (default 0.2)
        random_state: Random seed for reproducibility
    
    Returns:
        model: Trained RandomForestClassifier
        scaler: Fitted StandardScaler
        metadata: Model performance metrics
    """
    print("=" * 70)
    print("CPIPL Predictive Maintenance - ML Model Training")
    print("=" * 70)
    print()
    
    # Step 1: Extract data
    print("[1/6] Extracting data from database...")
    extractor = DataExtractor(db_path)
    assets = extractor.get_all_assets()
    print(f"  ✓ Found {len(assets)} assets")
    
    # Step 2: Generate features and labels
    print("[2/6] Generating features and labels...")
    X_data = []
    y_data = []
    feature_names = None
    asset_ids = []
    
    for asset in assets:
        try:
            # Get repair history
            repairs = extractor.get_asset_repairs(asset['id'])
            
            # Get vendor metrics
            vendor_name = asset['name']  # Use asset name as vendor proxy
            vendor_metrics = extractor.get_vendor_metrics(vendor_name)
            
            # Extract features
            features, feature_names = FeatureExtractor.extract_features(
                asset, repairs, vendor_metrics
            )
            
            # Generate label
            label = FailureLabelGenerator.generate_labels(
                asset['id'], repairs
            )
            
            X_data.append(features)
            y_data.append(label)
            asset_ids.append(asset['id'])
        except Exception as e:
            print(f"  ⚠ Error processing asset {asset['id']}: {e}")
            continue
    
    extractor.close()
    
    if len(X_data) < 10:
        print(f"  ✗ Insufficient data ({len(X_data)} assets). Need at least 10.")
        return None, None, None
    
    X = np.array(X_data)
    y = np.array(y_data)
    
    print(f"  ✓ Extracted {len(X)} samples, {X.shape[1]} features")
    print(f"  ✓ Label distribution: {sum(y==0)} negative, {sum(y==1)} positive")
    print()
    
    # Step 3: Normalize features
    print("[3/6] Normalizing features...")
    X_scaled, scaler = FeatureExtractor.normalize_features(X)
    print(f"  ✓ Features normalized (mean=0, std=1)")
    print()
    
    # Step 4: Train/test split
    print("[4/6] Splitting data...")
    X_train, X_test, y_train, y_test, ids_train, ids_test = train_test_split(
        X_scaled, y, asset_ids, test_size=test_split, random_state=random_state,
        stratify=y  # Maintain label distribution
    )
    print(f"  ✓ Train: {len(X_train)} samples | Test: {len(X_test)} samples")
    print()
    
    # Step 5: Train Random Forest
    print("[5/6] Training Random Forest classifier...")
    print("  - Estimators: 100")
    print("  - Max depth: 12")
    print("  - Random state: 42")
    
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=12,
        random_state=random_state,
        n_jobs=-1,  # Use all processors
        verbose=0
    )
    model.fit(X_train, y_train)
    print("  ✓ Training complete")
    print()
    
    # Step 6: Evaluate performance
    print("[6/6] Evaluating model performance...")
    
    # Predictions
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)
    y_proba_test = model.predict_proba(X_test)[:, 1]
    
    # Metrics
    metrics = {
        'train': {
            'accuracy': accuracy_score(y_train, y_pred_train),
            'precision': precision_score(y_train, y_pred_train, zero_division=0),
            'recall': recall_score(y_train, y_pred_train, zero_division=0),
            'f1': f1_score(y_train, y_pred_train, zero_division=0),
        },
        'test': {
            'accuracy': accuracy_score(y_test, y_pred_test),
            'precision': precision_score(y_test, y_pred_test, zero_division=0),
            'recall': recall_score(y_test, y_pred_test, zero_division=0),
            'f1': f1_score(y_test, y_pred_test, zero_division=0),
            'auc_roc': roc_auc_score(y_test, y_proba_test) if len(np.unique(y_test)) > 1 else 0,
        }
    }
    
    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred_test)
    
    print("  Train Metrics:")
    print(f"    - Accuracy:  {metrics['train']['accuracy']:.3f}")
    print(f"    - Precision: {metrics['train']['precision']:.3f}")
    print(f"    - Recall:    {metrics['train']['recall']:.3f}")
    print(f"    - F1 Score:  {metrics['train']['f1']:.3f}")
    print()
    print("  Test Metrics:")
    print(f"    - Accuracy:  {metrics['test']['accuracy']:.3f}")
    print(f"    - Precision: {metrics['test']['precision']:.3f}")
    print(f"    - Recall:    {metrics['test']['recall']:.3f}")
    print(f"    - F1 Score:  {metrics['test']['f1']:.3f}")
    print(f"    - AUC-ROC:   {metrics['test']['auc_roc']:.3f}")
    print()
    print("  Confusion Matrix (Test Set):")
    print(f"    - True Negatives:  {cm[0,0]}")
    print(f"    - False Positives: {cm[0,1]}")
    print(f"    - False Negatives: {cm[1,0]}")
    print(f"    - True Positives:  {cm[1,1]}")
    print()
    
    # Feature importance
    feature_importance = sorted(
        zip(feature_names, model.feature_importances_),
        key=lambda x: x[1],
        reverse=True
    )
    print("  Top 5 Important Features:")
    for i, (fname, importance) in enumerate(feature_importance[:5], 1):
        print(f"    {i}. {fname}: {importance:.4f}")
    print()
    
    # Metadata for saving
    metadata = {
        'model_type': 'RandomForestClassifier',
        'training_date': datetime.now().isoformat(),
        'n_samples': len(X),
        'n_features': X.shape[1],
        'feature_names': feature_names,
        'scaler_type': 'StandardScaler',
        'metrics': metrics,
        'confusion_matrix': cm.tolist(),
        'feature_importance': [
            {'feature': fname, 'importance': float(imp)}
            for fname, imp in feature_importance
        ],
        'hyperparameters': {
            'n_estimators': 100,
            'max_depth': 12,
            'random_state': 42
        },
        'data_split': {
            'test_size': test_split,
            'stratified': True,
            'train_samples': len(X_train),
            'test_samples': len(X_test)
        }
    }
    
    return model, scaler, metadata


def save_model(model, scaler, metadata, output_dir='./'):
    """
    Save trained model and metadata.
    
    Args:
        model: Trained RandomForestClassifier
        scaler: Fitted StandardScaler
        metadata: Model metadata dictionary
        output_dir: Directory to save files (default current directory)
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Save model
    model_file = output_path / 'predictive_model.pkl'
    with open(model_file, 'wb') as f:
        pickle.dump({'model': model, 'scaler': scaler}, f)
    print(f"✓ Model saved: {model_file}")
    
    # Save metadata
    metadata_file = output_path / 'model_metadata.json'
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"✓ Metadata saved: {metadata_file}")
    
    print()
    print("=" * 70)
    print("Training Complete! Ready for production deployment.")
    print("=" * 70)


def main():
    """Command-line interface for model training."""
    parser = argparse.ArgumentParser(
        description='Train Random Forest model for predictive maintenance'
    )
    parser.add_argument(
        '--db',
        default='../prisma/dev.db',
        help='Path to SQLite database (default: ../prisma/dev.db)'
    )
    parser.add_argument(
        '--test-split',
        type=float,
        default=0.2,
        help='Test set ratio (default: 0.2)'
    )
    parser.add_argument(
        '--output-dir',
        default='./',
        help='Directory to save model and metadata (default: current dir)'
    )
    
    args = parser.parse_args()
    
    # Resolve database path
    db_path = Path(args.db)
    if not db_path.is_absolute():
        # Make path relative to this script
        db_path = Path(__file__).parent / db_path
    
    if not db_path.exists():
        print(f"✗ Database not found: {db_path}")
        sys.exit(1)
    
    print(f"Database: {db_path}")
    print(f"Test split: {args.test_split}")
    print(f"Output directory: {args.output_dir}")
    print()
    
    # Train model
    model, scaler, metadata = train_model(
        str(db_path),
        test_split=args.test_split
    )
    
    if model is None:
        print("✗ Training failed")
        sys.exit(1)
    
    # Save model
    save_model(model, scaler, metadata, args.output_dir)
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
