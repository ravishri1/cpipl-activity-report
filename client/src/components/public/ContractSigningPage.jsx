import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Download, Upload, CheckCircle2, AlertTriangle, Clock, Shield } from 'lucide-react';

export default function ContractSigningPage() {
  const { token } = useParams();
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const fetchContract = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/contract-signing/${token}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'This signing link is invalid or has expired.');
      }
      setContract(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchContract(); }, [fetchContract]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/contract-signing/${token}/upload`, { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed. Please try again.');
      }
      setUploadDone(true);
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type === 'application/pdf') setFile(f);
    else setUploadError('Only PDF files are accepted.');
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="text-center py-20">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading contract details...</p>
        </div>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper>
        <div className="text-center py-16">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Link Invalid or Expired</h2>
          <p className="text-slate-500 max-w-md mx-auto">{error}</p>
          <p className="text-sm text-slate-400 mt-4">If you believe this is an error, please contact Color Papers India Pvt. Ltd.</p>
        </div>
      </PageWrapper>
    );
  }

  if (uploadDone) {
    return (
      <PageWrapper>
        <div className="text-center py-16">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Document Signed Successfully</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Thank you, <strong>{contract.externalSignerName}</strong>. Your signed document has been received.
            The internal team will review and counter-sign to complete the contract.
          </p>
          <p className="text-sm text-slate-400 mt-4">You will receive an email once the contract is fully executed.</p>
        </div>
      </PageWrapper>
    );
  }

  const alreadySigned = contract.signingStatus !== 'sent';

  return (
    <PageWrapper>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileSignatureIcon className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">Contract Signing</h1>
        <p className="text-sm text-slate-500">{contract.companyName}</p>
      </div>

      {/* Contract Info */}
      <div className="bg-slate-50 rounded-xl p-5 mb-6 border border-slate-200">
        <h2 className="font-semibold text-slate-800 mb-2">{contract.contractName}</h2>
        {contract.description && <p className="text-sm text-slate-600 mb-3">{contract.description}</p>}
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span>Recipient: <strong className="text-slate-700">{contract.externalSignerName}</strong></span>
          {contract.expiresAt && <span>Expires: <strong className="text-slate-700">{contract.expiresAt}</strong></span>}
        </div>
      </div>

      {alreadySigned ? (
        <div className="text-center py-8 bg-green-50 rounded-xl border border-green-200">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <h3 className="font-semibold text-green-800 mb-1">Already Signed</h3>
          <p className="text-sm text-green-600">This contract was signed on {contract.externalSignedAt?.slice(0, 10)}.</p>
        </div>
      ) : (
        <>
          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StepCard num={1} title="Download" desc="Download and review the contract document">
              {contract.hasContractFile ? (
                <a href={`/api/contract-signing/${token}/download`} download
                  className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 mt-3">
                  <Download className="w-4 h-4" /> Download Contract
                </a>
              ) : contract.hasTemplateContent ? (
                <a href={`/api/contract-signing/${token}/download`} download
                  className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 mt-3">
                  <Download className="w-4 h-4" /> Download Contract
                </a>
              ) : (
                <p className="text-xs text-slate-400 mt-2">Contract document not yet available.</p>
              )}
            </StepCard>

            <StepCard num={2} title="Sign" desc="Sign the document digitally or physically" />

            <StepCard num={3} title="Upload" desc="Upload the signed copy back" />
          </div>

          {/* Upload Area */}
          <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-8 text-center"
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={dragOver ? { borderColor: '#3b82f6', backgroundColor: '#eff6ff' } : {}}>

            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700 mb-1">
              {file ? file.name : 'Drag & drop your signed PDF here'}
            </p>
            <p className="text-xs text-slate-400 mb-4">or click to browse (PDF only, max 15MB)</p>

            <input type="file" accept=".pdf" id="signed-file"
              className="hidden" onChange={e => { setFile(e.target.files[0] || null); setUploadError(null); }} />

            <div className="flex items-center justify-center gap-3">
              <label htmlFor="signed-file"
                className="cursor-pointer bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200">
                Browse Files
              </label>
              {file && (
                <button onClick={handleUpload} disabled={uploading}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                  {uploading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> Submit Signed Document</>
                  )}
                </button>
              )}
            </div>

            {uploadError && <p className="text-sm text-red-600 mt-3">{uploadError}</p>}
          </div>

          {/* Security note */}
          <div className="flex items-start gap-2 mt-4 text-xs text-slate-400">
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>Your document is securely uploaded and stored. This signing link is unique to you and will expire on {contract.expiresAt}.</p>
          </div>
        </>
      )}
    </PageWrapper>
  );
}

function PageWrapper({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-start justify-center p-4 pt-12">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 max-w-2xl w-full p-6 md:p-8">
        {children}
        <div className="text-center mt-8 pt-4 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">Color Papers India Pvt. Ltd. &middot; Contract Management Portal</p>
        </div>
      </div>
    </div>
  );
}

function StepCard({ num, title, desc, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{num}</div>
        <span className="text-sm font-semibold text-slate-800">{title}</span>
      </div>
      <p className="text-xs text-slate-500">{desc}</p>
      {children}
    </div>
  );
}

function FileSignatureIcon({ className }) {
  return <FileText className={className} />;
}
