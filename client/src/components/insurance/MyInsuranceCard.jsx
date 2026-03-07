import { useState, useEffect } from 'react';
import { Download, Eye, AlertCircle, FileText, Calendar } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';

export default function MyInsuranceCard() {
  const { data: card, loading, error, refetch } = useFetch('/insurance/my', null);
  const [markingViewed, setMarkingViewed] = useState(false);

  // Mark as viewed when first loaded
  useEffect(() => {
    if (card && !card.isViewed && !markingViewed) {
      setMarkingViewed(true);
      api.post('/insurance/mark-viewed')
        .catch(err => console.error('Failed to mark card as viewed:', err))
        .finally(() => setMarkingViewed(false));
    }
  }, [card, markingViewed]);

  if (loading) return <LoadingSpinner />;
  
  if (error && error.includes('No insurance card')) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <EmptyState 
          icon="🎫" 
          title="No Insurance Card Yet" 
          subtitle="Your HR team hasn't uploaded your insurance card. It will appear here once it's ready."
        />
      </div>
    );
  }

  if (error) {
    return <AlertMessage type="error" message={error} />;
  }

  if (!card) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <EmptyState 
          icon="🎫" 
          title="No Insurance Card" 
          subtitle="Please check back later"
        />
      </div>
    );
  }

  // Determine expiry status
  const isExpired = card.effectiveTo && new Date(card.effectiveTo) < new Date();
  const isExpiringSoon = card.effectiveTo && 
    new Date(card.effectiveTo) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
    !isExpired;

  const handleDownload = () => {
    window.open(card.fileUrl, '_blank');
  };

  const cardTypeColors = {
    health: 'bg-green-50 border-green-200 text-green-700',
    life: 'bg-blue-50 border-blue-200 text-blue-700',
    accidental: 'bg-orange-50 border-orange-200 text-orange-700',
    other: 'bg-gray-50 border-gray-200 text-gray-700'
  };

  const statusBadge = isExpired 
    ? { text: 'Expired', bg: 'bg-red-100', text_color: 'text-red-700' }
    : isExpiringSoon
    ? { text: 'Expiring Soon', bg: 'bg-amber-100', text_color: 'text-amber-700' }
    : { text: 'Active', bg: 'bg-green-100', text_color: 'text-green-700' };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Insurance Card</h1>
        <p className="text-slate-600 mt-1">View and download your company insurance information</p>
      </div>

      {/* Status Alerts */}
      {isExpired && (
        <AlertMessage 
          type="error" 
          message="Your insurance card has expired. Please contact HR to get an updated card."
          icon={<AlertCircle className="w-5 h-5" />}
        />
      )}
      {isExpiringSoon && !isExpired && (
        <AlertMessage 
          type="warning" 
          message={`Your insurance card will expire on ${formatDate(card.effectiveTo)}. Please contact HR for renewal.`}
          icon={<AlertCircle className="w-5 h-5" />}
        />
      )}

      {/* Main Card */}
      <div className={`border-2 rounded-lg p-6 mt-6 ${cardTypeColors[card.cardType] || cardTypeColors.other}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-6 h-6" />
              <h2 className="text-2xl font-bold">
                {(card.cardType || 'other').charAt(0).toUpperCase() + (card.cardType || 'other').slice(1)} Insurance Card
              </h2>
            </div>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusBadge.bg} ${statusBadge.text_color}`}>
              {statusBadge.text}
            </span>
          </div>
        </div>

        {/* Card Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {card.providerName && (
            <div>
              <p className="text-sm font-semibold opacity-75">Insurance Provider</p>
              <p className="text-lg font-medium">{card.providerName}</p>
            </div>
          )}

          {card.policyNumber && (
            <div>
              <p className="text-sm font-semibold opacity-75">Policy Number</p>
              <p className="text-lg font-medium font-mono">{card.policyNumber}</p>
            </div>
          )}

          {card.coverageAmount && (
            <div>
              <p className="text-sm font-semibold opacity-75">Coverage Amount</p>
              <p className="text-lg font-medium">₹{card.coverageAmount.toLocaleString()}</p>
            </div>
          )}

          {card.effectiveFrom && (
            <div>
              <p className="text-sm font-semibold opacity-75">Effective From</p>
              <p className="text-lg font-medium">{formatDate(card.effectiveFrom)}</p>
            </div>
          )}

          {card.effectiveTo && (
            <div>
              <p className="text-sm font-semibold opacity-75">Expires On</p>
              <p className="text-lg font-medium">{formatDate(card.effectiveTo)}</p>
            </div>
          )}
        </div>

        {/* Notes */}
        {card.notes && (
          <div className="mt-6 p-4 bg-white bg-opacity-50 rounded border border-current border-opacity-20">
            <p className="text-sm font-semibold opacity-75 mb-1">Notes</p>
            <p className="text-sm">{card.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition border border-current border-opacity-30"
          >
            <Download className="w-5 h-5" />
            Download Card
          </button>
          {!card.isViewed && (
            <div className="flex items-center gap-2 text-sm px-3 py-2 bg-white bg-opacity-50 rounded">
              <Eye className="w-4 h-4" />
              <span>Just uploaded - mark as read</span>
            </div>
          )}
        </div>
      </div>

      {/* Upload Info */}
      <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-sm text-slate-600">
          <span className="font-semibold">Last Updated:</span> {formatDate(card.uploadedAt)}
        </p>
        {card.uploader && (
          <p className="text-sm text-slate-600 mt-1">
            <span className="font-semibold">Uploaded by:</span> {card.uploader.name}
          </p>
        )}
        {card.viewedAt && (
          <p className="text-sm text-slate-600 mt-1">
            <span className="font-semibold">Viewed:</span> {formatDate(card.viewedAt)}
          </p>
        )}
      </div>

      {/* Questions Section */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Questions about your insurance?</h3>
        <p className="text-sm text-blue-800">
          Please contact your HR team or check the company policies section for more information about your insurance coverage and benefits.
        </p>
      </div>
    </div>
  );
}
