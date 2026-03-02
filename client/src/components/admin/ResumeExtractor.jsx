import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import {
  Brain, Sparkles, Loader2, User, Mail, Phone, Building2, Briefcase,
  GraduationCap, Users as UsersIcon, CreditCard, MapPin, CheckCircle, AlertCircle,
} from 'lucide-react';

export default function ResumeExtractor() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [error, setError] = useState('');
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState('');

  useEffect(() => {
    api.get('/companies').then((r) => {
      setCompanies(r.data);
      if (r.data.length > 0) setSelectedCompany(String(r.data[0].id));
    }).catch(() => {});
  }, []);

  const handleExtract = async () => {
    if (!text.trim()) return;
    setExtracting(true);
    setError('');
    setExtracted(null);
    try {
      const res = await api.post('/extraction/resume', { text });
      setExtracted(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Extraction failed. Please try again.');
    } finally {
      setExtracting(false);
    }
  };

  const updateField = (field, value) => {
    setExtracted((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateEmployee = async () => {
    if (!extracted?.name || !extracted?.email) {
      setError('Name and email are required to create an employee.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      // 1. Create user
      const userRes = await api.post('/users', {
        name: extracted.name,
        email: extracted.email,
        password: 'Welcome@123',
        department: extracted.department || 'General',
        companyId: selectedCompany || null,
      });
      const userId = userRes.data.id;

      // 2. Update profile with all extracted fields
      const profileData = {};
      const profileFields = [
        'phone', 'personalEmail', 'designation', 'department', 'gender', 'bloodGroup',
        'dateOfBirth', 'dateOfJoining', 'maritalStatus', 'nationality', 'fatherName',
        'spouseName', 'religion', 'placeOfBirth', 'address', 'permanentAddress',
        'aadhaarNumber', 'panNumber', 'passportNumber', 'drivingLicense',
        'bankName', 'bankAccountNumber', 'bankIfscCode',
        'previousExperience',
      ];
      profileFields.forEach((f) => {
        if (extracted[f]) profileData[f] = extracted[f];
      });
      if (Object.keys(profileData).length > 0) {
        await api.put(`/users/${userId}/profile`, profileData);
      }

      // 3. Add education records
      if (extracted.education?.length) {
        for (const edu of extracted.education) {
          try {
            await api.post(`/users/${userId}/education`, {
              degree: edu.degree,
              institution: edu.institution,
              university: edu.university || null,
              specialization: edu.specialization || null,
              yearOfPassing: edu.yearOfPassing || null,
              percentage: edu.percentage || null,
            });
          } catch { /* skip invalid */ }
        }
      }

      // 4. Add previous employment
      if (extracted.previousEmployment?.length) {
        for (const emp of extracted.previousEmployment) {
          try {
            await api.post(`/users/${userId}/employment-history`, {
              company: emp.company,
              designation: emp.designation || null,
              fromDate: emp.fromDate || null,
              toDate: emp.toDate || null,
              ctc: emp.ctc || null,
              reasonForLeaving: emp.reasonForLeaving || null,
            });
          } catch { /* skip invalid */ }
        }
      }

      // 5. Add family members
      if (extracted.familyMembers?.length) {
        for (const fm of extracted.familyMembers) {
          try {
            await api.post(`/users/${userId}/family`, {
              name: fm.name,
              relationship: fm.relationship,
              dateOfBirth: fm.dateOfBirth || null,
              occupation: fm.occupation || null,
              phone: fm.phone || null,
            });
          } catch { /* skip invalid */ }
        }
      }

      setCreateSuccess(`Employee "${extracted.name}" created successfully!`);
      setTimeout(() => navigate(`/employee/${userId}`), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create employee.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <Brain className="w-6 h-6 text-purple-600" />
        AI Resume Extractor
      </h1>

      {createSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {createSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Input */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Paste Resume / Biodata Text</h2>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={18}
              placeholder="Copy-paste the employee's resume or biodata content here. The AI will extract all relevant fields like name, phone, email, education, experience, etc."
              className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-400">{text.length} characters</p>
              <button
                onClick={handleExtract}
                disabled={extracting || !text.trim()}
                className="bg-purple-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {extracting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Extracting...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Extract with AI</>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* RIGHT — Preview */}
        <div className="space-y-4">
          {!extracted ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
              <Brain className="w-16 h-16 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Paste resume text and click "Extract with AI" to see results here.</p>
            </div>
          ) : (
            <>
              {/* Basic Info */}
              <Section icon={User} title="Basic Info" color="blue">
                <Field label="Name" value={extracted.name} onChange={(v) => updateField('name', v)} />
                <Field label="Email" value={extracted.email} onChange={(v) => updateField('email', v)} />
                <Field label="Personal Email" value={extracted.personalEmail} onChange={(v) => updateField('personalEmail', v)} />
                <Field label="Phone" value={extracted.phone} onChange={(v) => updateField('phone', v)} />
                <Field label="Date of Birth" value={extracted.dateOfBirth} onChange={(v) => updateField('dateOfBirth', v)} />
                <Field label="Gender" value={extracted.gender} onChange={(v) => updateField('gender', v)} />
                <Field label="Blood Group" value={extracted.bloodGroup} onChange={(v) => updateField('bloodGroup', v)} />
                <Field label="Marital Status" value={extracted.maritalStatus} onChange={(v) => updateField('maritalStatus', v)} />
                <Field label="Nationality" value={extracted.nationality} onChange={(v) => updateField('nationality', v)} />
                <Field label="Religion" value={extracted.religion} onChange={(v) => updateField('religion', v)} />
              </Section>

              {/* Family */}
              <Section icon={UsersIcon} title="Family" color="green">
                <Field label="Father's Name" value={extracted.fatherName} onChange={(v) => updateField('fatherName', v)} />
                <Field label="Spouse Name" value={extracted.spouseName} onChange={(v) => updateField('spouseName', v)} />
                {extracted.familyMembers?.length > 0 && (
                  <div className="col-span-2 mt-1">
                    <p className="text-xs font-medium text-slate-500 mb-1">Family Members ({extracted.familyMembers.length})</p>
                    {extracted.familyMembers.map((fm, i) => (
                      <p key={i} className="text-xs text-slate-600">• {fm.name} ({fm.relationship}){fm.occupation ? ` — ${fm.occupation}` : ''}</p>
                    ))}
                  </div>
                )}
              </Section>

              {/* Address */}
              <Section icon={MapPin} title="Address" color="amber">
                <Field label="Current Address" value={extracted.address} onChange={(v) => updateField('address', v)} full />
                <Field label="Permanent Address" value={extracted.permanentAddress} onChange={(v) => updateField('permanentAddress', v)} full />
                <Field label="Place of Birth" value={extracted.placeOfBirth} onChange={(v) => updateField('placeOfBirth', v)} />
              </Section>

              {/* Employment */}
              <Section icon={Briefcase} title="Employment" color="indigo">
                <Field label="Designation" value={extracted.designation} onChange={(v) => updateField('designation', v)} />
                <Field label="Department" value={extracted.department} onChange={(v) => updateField('department', v)} />
                <Field label="Total Experience (yrs)" value={extracted.previousExperience} onChange={(v) => updateField('previousExperience', v)} />
                {extracted.previousEmployment?.length > 0 && (
                  <div className="col-span-2 mt-1">
                    <p className="text-xs font-medium text-slate-500 mb-1">Previous Employment ({extracted.previousEmployment.length})</p>
                    {extracted.previousEmployment.map((emp, i) => (
                      <p key={i} className="text-xs text-slate-600">• {emp.company}{emp.designation ? ` — ${emp.designation}` : ''}{emp.fromDate ? ` (${emp.fromDate} to ${emp.toDate || 'present'})` : ''}</p>
                    ))}
                  </div>
                )}
              </Section>

              {/* Education */}
              <Section icon={GraduationCap} title="Education" color="teal">
                {extracted.education?.length > 0 ? (
                  <div className="col-span-2">
                    {extracted.education.map((edu, i) => (
                      <p key={i} className="text-xs text-slate-600 mb-0.5">• {edu.degree}{edu.specialization ? ` (${edu.specialization})` : ''} — {edu.institution}{edu.yearOfPassing ? `, ${edu.yearOfPassing}` : ''}{edu.percentage ? ` [${edu.percentage}]` : ''}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 col-span-2">No education data extracted.</p>
                )}
              </Section>

              {/* Identity Documents */}
              <Section icon={CreditCard} title="Identity & Bank" color="rose">
                <Field label="Aadhaar" value={extracted.aadhaarNumber} onChange={(v) => updateField('aadhaarNumber', v)} />
                <Field label="PAN" value={extracted.panNumber} onChange={(v) => updateField('panNumber', v)} />
                <Field label="Passport" value={extracted.passportNumber} onChange={(v) => updateField('passportNumber', v)} />
                <Field label="Driving License" value={extracted.drivingLicense} onChange={(v) => updateField('drivingLicense', v)} />
                <Field label="Bank Name" value={extracted.bankName} onChange={(v) => updateField('bankName', v)} />
                <Field label="Account No." value={extracted.bankAccountNumber} onChange={(v) => updateField('bankAccountNumber', v)} />
                <Field label="IFSC" value={extracted.bankIfscCode} onChange={(v) => updateField('bankIfscCode', v)} />
              </Section>

              {/* Create Employee */}
              <div className="bg-white rounded-xl border-2 border-purple-200 p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-purple-800 mb-3">Create Employee</h3>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Company</label>
                    <select
                      value={selectedCompany}
                      onChange={(e) => setSelectedCompany(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">No Company</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}{c.shortName ? ` (${c.shortName})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleCreateEmployee}
                    disabled={creating || !extracted.name || !extracted.email}
                    className="bg-purple-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                  >
                    {creating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4" /> Create Employee</>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">Default password: Welcome@123. Employee can change it on first login.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Section wrapper */
function Section({ icon: Icon, title, color, children }) {
  const colors = {
    blue: 'border-blue-200 bg-blue-50/50',
    green: 'border-green-200 bg-green-50/50',
    amber: 'border-amber-200 bg-amber-50/50',
    indigo: 'border-indigo-200 bg-indigo-50/50',
    teal: 'border-teal-200 bg-teal-50/50',
    rose: 'border-rose-200 bg-rose-50/50',
  };
  const iconColors = {
    blue: 'text-blue-600', green: 'text-green-600', amber: 'text-amber-600',
    indigo: 'text-indigo-600', teal: 'text-teal-600', rose: 'text-rose-600',
  };
  return (
    <div className={`bg-white rounded-xl border ${colors[color]} p-4 shadow-sm`}>
      <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 ${iconColors[color]}`} />
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">{children}</div>
    </div>
  );
}

/* Editable field */
function Field({ label, value, onChange, full }) {
  if (value === null || value === undefined) return null;
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs text-slate-700 border border-slate-200 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-purple-400 outline-none"
      />
    </div>
  );
}
