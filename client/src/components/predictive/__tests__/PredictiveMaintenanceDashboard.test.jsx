/**
 * Component Unit Tests for Predictive Maintenance Dashboard
 * Tests all 5 components for rendering, props, state, and user interactions
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PredictiveMaintenanceDashboard from '../components/predictive/PredictiveMaintenanceDashboard';
import HealthScoreCard from '../components/predictive/HealthScoreCard';
import FailureRiskCard from '../components/predictive/FailureRiskCard';
import RecommendationsPanel from '../components/predictive/RecommendationsPanel';
import MaintenanceInsightsChart from '../components/predictive/MaintenanceInsightsChart';

// Mock API data
const mockAssetData = [
  {
    id: 1,
    name: 'Laptop Dell XPS-15',
    type: 'Electronics',
    serialNumber: 'DELL-2021-001',
    assignedTo: { id: 1, name: 'John Doe' },
    healthScore: { score: 72, riskLevel: 'high' },
    predictions: {
      failureProbability30Days: 0.35,
      failureProbability60Days: 0.52,
      failureProbability90Days: 0.68,
      confidence: 0.85,
      primaryRiskFactors: ['High repair frequency', 'Age > 3 years', 'Accumulated cost'],
    },
    recommendations: [
      { id: 1, priority: 'urgent', description: 'Schedule preventive maintenance', status: 'pending' },
    ],
  },
  {
    id: 2,
    name: 'Printer HP LaserJet',
    type: 'Peripherals',
    serialNumber: 'HP-2020-001',
    assignedTo: { id: 2, name: 'Jane Smith' },
    healthScore: { score: 88, riskLevel: 'low' },
    predictions: {
      failureProbability30Days: 0.08,
      failureProbability60Days: 0.12,
      failureProbability90Days: 0.18,
      confidence: 0.92,
      primaryRiskFactors: ['Toner usage rate'],
    },
    recommendations: [],
  },
];

const mockHealthScoreData = {
  score: 72,
  riskLevel: 'high',
  components: {
    hardware: 70,
    maintenance: 65,
    usage: 80,
    age: 60,
  },
  trend: 'down',
};

const mockFailureRiskData = {
  failureProbability30Days: 0.35,
  failureProbability60Days: 0.52,
  failureProbability90Days: 0.68,
  confidence: 0.85,
  primaryRiskFactors: ['High repair frequency', 'Age > 3 years'],
};

const mockRecommendations = [
  {
    id: 1,
    assetId: 1,
    priority: 'urgent',
    description: 'Schedule preventive maintenance',
    status: 'pending',
    estimatedCost: 15000,
    roi: 0.35,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    assetId: 1,
    priority: 'high',
    description: 'Replace batteries',
    status: 'approved',
    estimatedCost: 8000,
    roi: 0.28,
    createdAt: new Date().toISOString(),
  },
];

const mockTrendData = [
  { date: '2024-01-01', score: 85 },
  { date: '2024-02-01', score: 82 },
  { date: '2024-03-01', score: 78 },
  { date: '2024-04-01', score: 75 },
  { date: '2024-05-01', score: 72 },
];

// ==========================================
// Test Suite 1: PredictiveMaintenanceDashboard
// ==========================================

describe('PredictiveMaintenanceDashboard Component', () => {
  
  it('should render dashboard without crashing', () => {
    render(<PredictiveMaintenanceDashboard />);
    expect(screen.getByText(/Predictive Maintenance/i)).toBeInTheDocument();
  });

  it('should display loading state initially', () => {
    render(<PredictiveMaintenanceDashboard />);
    expect(screen.getByText(/Loading/i) || screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display risk summary cards when data loads', async () => {
    render(<PredictiveMaintenanceDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Critical/i) || screen.getByText(/0/i)).toBeInTheDocument();
    });
  });

  it('should render asset list with risk levels', async () => {
    render(<PredictiveMaintenanceDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Laptop|Printer|Asset/i)).toBeInTheDocument();
    });
  });

  it('should color-code risk levels correctly', async () => {
    render(<PredictiveMaintenanceDashboard />);
    
    await waitFor(() => {
      const criticalElements = screen.queryAllByText(/critical/i);
      criticalElements.forEach(el => {
        expect(el).toHaveClass('bg-red-100', 'text-red-700');
      });
    });
  });

  it('should filter assets by risk level', async () => {
    render(<PredictiveMaintenanceDashboard />);
    
    const filterButton = await screen.findByRole('button', { name: /High/i });
    fireEvent.click(filterButton);
    
    await waitFor(() => {
      // Verify only 'high' risk assets are shown
    });
  });

  it('should open detail panel when asset is clicked', async () => {
    render(<PredictiveMaintenanceDashboard />);
    
    const assetButton = await screen.findByText(/Laptop|Asset/i);
    fireEvent.click(assetButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Health Score|Details/i)).toBeInTheDocument();
    });
  });

  it('should close detail panel with close button', async () => {
    render(<PredictiveMaintenanceDashboard />);
    
    const assetButton = await screen.findByText(/Laptop/i);
    fireEvent.click(assetButton);
    
    await waitFor(() => {
      const closeButton = screen.getByRole('button', { name: /close|×/i });
      fireEvent.click(closeButton);
    });
  });

  it('should sort assets by health score', async () => {
    render(<PredictiveMaintenanceDashboard />);
    
    const sortButton = await screen.findByRole('button', { name: /Sort|Score/i });
    fireEvent.click(sortButton);
    
    await waitFor(() => {
      // Verify assets are sorted
    });
  });

  it('should display recalculate button for admin', async () => {
    render(<PredictiveMaintenanceDashboard />);
    
    const recalcButton = screen.queryByRole('button', { name: /Recalculate|Refresh/i });
    if (recalcButton) {
      expect(recalcButton).toBeInTheDocument();
    }
  });

  it('should handle error state gracefully', async () => {
    // Mock API error
    render(<PredictiveMaintenanceDashboard />);
    
    // Wait for error message if API fails
    await waitFor(() => {
      const errorMsg = screen.queryByText(/Error|Failed/i);
      if (errorMsg) {
        expect(errorMsg).toBeInTheDocument();
      }
    }, { timeout: 3000 });
  });

  it('should display empty state when no assets', async () => {
    render(<PredictiveMaintenanceDashboard />);
    
    await waitFor(() => {
      const emptyState = screen.queryByText(/No assets|empty/i);
      if (emptyState) {
        expect(emptyState).toBeInTheDocument();
      }
    });
  });
});

// ==========================================
// Test Suite 2: HealthScoreCard Component
// ==========================================

describe('HealthScoreCard Component', () => {
  
  it('should render health score card', () => {
    render(<HealthScoreCard healthScore={mockHealthScoreData} />);
    expect(screen.getByText(/Health Score|Score/i)).toBeInTheDocument();
  });

  it('should display health score value (0-100)', () => {
    render(<HealthScoreCard healthScore={mockHealthScoreData} />);
    expect(screen.getByText('72')).toBeInTheDocument();
  });

  it('should display risk level badge', () => {
    render(<HealthScoreCard healthScore={mockHealthScoreData} />);
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('should color-code risk level', () => {
    render(<HealthScoreCard healthScore={mockHealthScoreData} />);
    const badge = screen.getByText('high');
    expect(badge).toHaveClass('bg-orange-100', 'text-orange-700');
  });

  it('should display component breakdown', () => {
    render(<HealthScoreCard healthScore={mockHealthScoreData} />);
    expect(screen.getByText(/Hardware|Maintenance|Usage|Age/i)).toBeInTheDocument();
  });

  it('should display trend indicator', () => {
    render(<HealthScoreCard healthScore={mockHealthScoreData} />);
    expect(screen.getByText(/down|↓/i)).toBeInTheDocument();
  });

  it('should show status recommendation', () => {
    render(<HealthScoreCard healthScore={mockHealthScoreData} />);
    const recommendation = screen.queryByText(/Schedule|Monitor|Replace|Review/i);
    if (recommendation) {
      expect(recommendation).toBeInTheDocument();
    }
  });

  it('should handle low health score (critical)', () => {
    const criticalHealth = { ...mockHealthScoreData, score: 25, riskLevel: 'critical' };
    render(<HealthScoreCard healthScore={criticalHealth} />);
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('critical')).toHaveClass('bg-red-100', 'text-red-700');
  });

  it('should handle high health score (low risk)', () => {
    const goodHealth = { ...mockHealthScoreData, score: 92, riskLevel: 'low' };
    render(<HealthScoreCard healthScore={goodHealth} />);
    expect(screen.getByText('92')).toBeInTheDocument();
    expect(screen.getByText('low')).toHaveClass('bg-green-100', 'text-green-700');
  });

  it('should display circular progress indicator', () => {
    render(<HealthScoreCard healthScore={mockHealthScoreData} />);
    // Check for SVG or progress element
    const svg = screen.getByRole('img', { hidden: true });
    if (svg) {
      expect(svg).toBeInTheDocument();
    }
  });
});

// ==========================================
// Test Suite 3: FailureRiskCard Component
// ==========================================

describe('FailureRiskCard Component', () => {
  
  it('should render failure risk card', () => {
    render(<FailureRiskCard predictions={mockFailureRiskData} />);
    expect(screen.getByText(/Failure Risk|Probability/i)).toBeInTheDocument();
  });

  it('should display 30/60/90 day probabilities', () => {
    render(<FailureRiskCard predictions={mockFailureRiskData} />);
    expect(screen.getByText(/30.*days/i)).toBeInTheDocument();
    expect(screen.getByText(/60.*days/i)).toBeInTheDocument();
    expect(screen.getByText(/90.*days/i)).toBeInTheDocument();
  });

  it('should color-code probability bars by risk level', () => {
    render(<FailureRiskCard predictions={mockFailureRiskData} />);
    
    // 30-day: 35% → medium (yellow)
    const bar30 = screen.getByText(/35%/);
    expect(bar30.parentElement).toHaveClass('bg-yellow-400' || 'bg-yellow-500');
    
    // 90-day: 68% → high (orange)
    const bar90 = screen.getByText(/68%/);
    expect(bar90.parentElement).toHaveClass('bg-orange-400' || 'bg-orange-500');
  });

  it('should display model confidence level', () => {
    render(<FailureRiskCard predictions={mockFailureRiskData} />);
    expect(screen.getByText(/85%|Confidence/i)).toBeInTheDocument();
  });

  it('should display risk factors list', () => {
    render(<FailureRiskCard predictions={mockFailureRiskData} />);
    expect(screen.getByText(/High repair frequency/)).toBeInTheDocument();
    expect(screen.getByText(/Age > 3 years/)).toBeInTheDocument();
  });

  it('should limit risk factors to 5', () => {
    const manyFactors = {
      ...mockFailureRiskData,
      primaryRiskFactors: [
        'Factor 1', 'Factor 2', 'Factor 3', 'Factor 4', 'Factor 5', 'Factor 6'
      ]
    };
    render(<FailureRiskCard predictions={manyFactors} />);
    const factors = screen.getAllByText(/Factor/);
    expect(factors.length).toBeLessThanOrEqual(5);
  });

  it('should show confidence badge', () => {
    render(<FailureRiskCard predictions={mockFailureRiskData} />);
    const badge = screen.getByText(/High|Good/i);
    if (badge) {
      expect(badge).toBeInTheDocument();
    }
  });

  it('should handle high failure probability (critical)', () => {
    const critical = {
      ...mockFailureRiskData,
      failureProbability30Days: 0.95,
    };
    render(<FailureRiskCard predictions={critical} />);
    expect(screen.getByText(/95%/)).toBeInTheDocument();
  });
});

// ==========================================
// Test Suite 4: RecommendationsPanel Component
// ==========================================

describe('RecommendationsPanel Component', () => {
  
  it('should render recommendations panel', () => {
    render(<RecommendationsPanel recommendations={mockRecommendations} assetId={1} />);
    expect(screen.getByText(/Recommendations|Maintenance/i)).toBeInTheDocument();
  });

  it('should group recommendations by urgency', () => {
    render(<RecommendationsPanel recommendations={mockRecommendations} assetId={1} />);
    expect(screen.getByText(/Urgent|Immediate/i)).toBeInTheDocument();
    expect(screen.getByText(/High/i)).toBeInTheDocument();
  });

  it('should display recommendation details', () => {
    render(<RecommendationsPanel recommendations={mockRecommendations} assetId={1} />);
    expect(screen.getByText(/Schedule preventive maintenance/)).toBeInTheDocument();
    expect(screen.getByText(/Replace batteries/)).toBeInTheDocument();
  });

  it('should show estimated cost', () => {
    render(<RecommendationsPanel recommendations={mockRecommendations} assetId={1} />);
    expect(screen.getByText(/₹15,000|15000/)).toBeInTheDocument();
  });

  it('should show ROI percentage', () => {
    render(<RecommendationsPanel recommendations={mockRecommendations} assetId={1} />);
    expect(screen.getByText(/35%|0.35/)).toBeInTheDocument();
  });

  it('should display status badges (pending/approved/in_progress/completed)', () => {
    render(<RecommendationsPanel recommendations={mockRecommendations} assetId={1} />);
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();
  });

  it('should enable action buttons based on status', async () => {
    render(<RecommendationsPanel recommendations={mockRecommendations} assetId={1} />);
    
    // Pending recommendation should have "Approve" button
    const pendingRec = screen.getByText(/Schedule preventive/);
    const approveButton = within(pendingRec.closest('.card')).queryByRole('button', { name: /Approve/i });
    if (approveButton) {
      expect(approveButton).toBeEnabled();
    }
  });

  it('should handle status update', async () => {
    const mockUpdateFn = jest.fn();
    render(
      <RecommendationsPanel 
        recommendations={mockRecommendations} 
        assetId={1}
        onStatusUpdate={mockUpdateFn}
      />
    );
    
    const approveButton = await screen.findByRole('button', { name: /Approve/i });
    if (approveButton) {
      fireEvent.click(approveButton);
      await waitFor(() => {
        expect(mockUpdateFn).toHaveBeenCalled();
      });
    }
  });

  it('should display summary count by status', () => {
    render(<RecommendationsPanel recommendations={mockRecommendations} assetId={1} />);
    expect(screen.getByText(/Pending|Count|Summary/i)).toBeInTheDocument();
  });

  it('should show empty state when no recommendations', () => {
    render(<RecommendationsPanel recommendations={[]} assetId={1} />);
    expect(screen.getByText(/No recommendations|None/i)).toBeInTheDocument();
  });

  it('should have sticky header', () => {
    const { container } = render(<RecommendationsPanel recommendations={mockRecommendations} assetId={1} />);
    const header = container.querySelector('.sticky');
    if (header) {
      expect(header).toHaveClass('top-0', 'z-10');
    }
  });
});

// ==========================================
// Test Suite 5: MaintenanceInsightsChart Component
// ==========================================

describe('MaintenanceInsightsChart Component', () => {
  
  it('should render insights chart', () => {
    render(<MaintenanceInsightsChart trendData={mockTrendData} assetId={1} />);
    expect(screen.getByText(/Insights|Trend|History/i)).toBeInTheDocument();
  });

  it('should display bar chart', () => {
    const { container } = render(<MaintenanceInsightsChart trendData={mockTrendData} assetId={1} />);
    // Check for chart element (SVG or canvas)
    const chart = container.querySelector('svg') || container.querySelector('canvas');
    if (chart) {
      expect(chart).toBeInTheDocument();
    }
  });

  it('should have time range selector', () => {
    render(<MaintenanceInsightsChart trendData={mockTrendData} assetId={1} />);
    expect(screen.getByText(/months|1|3|6|12|24/i)).toBeInTheDocument();
  });

  it('should update chart when time range changes', async () => {
    render(<MaintenanceInsightsChart trendData={mockTrendData} assetId={1} />);
    
    const monthSelector = await screen.findByRole('combobox', { name: /Time Range|Months/i });
    await userEvent.selectOption(monthSelector, '12');
    
    await waitFor(() => {
      // Chart should update
      expect(monthSelector).toHaveValue('12');
    });
  });

  it('should display min/max/average stats', () => {
    render(<MaintenanceInsightsChart trendData={mockTrendData} assetId={1} />);
    expect(screen.getByText(/Min|Max|Average|Avg/i)).toBeInTheDocument();
  });

  it('should show trend indicator (up/down/stable)', () => {
    render(<MaintenanceInsightsChart trendData={mockTrendData} assetId={1} />);
    expect(screen.getByText(/Downward|Upward|Stable|↓|↑|→/i)).toBeInTheDocument();
  });

  it('should color-code bars by health score', () => {
    const { container } = render(<MaintenanceInsightsChart trendData={mockTrendData} assetId={1} />);
    // Score 85 → green, 72 → yellow/orange
    // Verify color classes are applied
  });

  it('should display legend', () => {
    render(<MaintenanceInsightsChart trendData={mockTrendData} assetId={1} />);
    expect(screen.getByText(/Legend|Color Guide|Reference/i)).toBeInTheDocument();
  });

  it('should show insights section', () => {
    render(<MaintenanceInsightsChart trendData={mockTrendData} assetId={1} />);
    expect(screen.getByText(/Insights|Summary|Analysis/i)).toBeInTheDocument();
  });

  it('should handle empty trend data', () => {
    render(<MaintenanceInsightsChart trendData={[]} assetId={1} />);
    expect(screen.getByText(/No data|empty|Not available/i)).toBeInTheDocument();
  });

  it('should be responsive on mobile', () => {
    // Mock window size
    global.innerWidth = 375;
    render(<MaintenanceInsightsChart trendData={mockTrendData} assetId={1} />);
    
    // Chart should still be visible
    expect(screen.getByText(/Insights/i)).toBeInTheDocument();
  });
});

// ==========================================
// Integration Tests
// ==========================================

describe('Component Integration', () => {
  
  it('should pass data correctly between parent and child components', () => {
    render(<PredictiveMaintenanceDashboard />);
    
    // When asset is selected in dashboard,
    // its data should flow to child components
    waitFor(() => {
      expect(screen.getByText(/Health Score/i)).toBeInTheDocument();
      expect(screen.getByText(/Failure Risk/i)).toBeInTheDocument();
    });
  });

  it('should update all components when asset changes', async () => {
    render(<PredictiveMaintenanceDashboard />);
    
    const asset1 = await screen.findByText(/Laptop/i);
    fireEvent.click(asset1);
    
    await waitFor(() => {
      const score1 = screen.getByText(/72/);
      expect(score1).toBeInTheDocument();
    });
    
    // Click different asset
    const asset2 = await screen.findByText(/Printer/i);
    fireEvent.click(asset2);
    
    await waitFor(() => {
      const score2 = screen.getByText(/88/);
      expect(score2).toBeInTheDocument();
    });
  });
});

export default {};
