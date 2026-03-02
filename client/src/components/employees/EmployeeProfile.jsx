import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import {
  User, Mail, Phone, Building2, Calendar, Briefcase, MapPin,
  Heart, Shield, ArrowLeft, Edit3, Save, X, CreditCard,
  GraduationCap, Users, FileText, ChevronRight, Plus, Trash2,
  Globe, UserCheck, Clock, BadgeCheck, Landmark, Hash, BookOpen,
  Camera, Loader2,
} from 'lucide-react';

const TABS = [
  { key: 'personal', label: 'Personal', icon: User },
  { key: 'employment', label: 'Employment & Job', icon: Briefcase },
  { key: 'identity', label: 'Identity & Bank', icon: CreditCard },
  { key: 'family', label: 'Family', icon: Users },
  { key: 'education', label: 'Education', icon: GraduationCap },
  { key: 'documents', label: 'Documents', icon: FileText },
];

export default function EmployeeProfile() {
  const { id } = useParams();
  const { user: currentUser, isAdmin } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);

  const isSelf = currentUser?.id === parseInt(id);
  const canEdit = isAdmin && currentUser?.role === 'admin';

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate on client side
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      alert('Please select a JPEG, PNG, WebP or GIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5 MB.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await api.post(`/users/${id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile({ ...profile, profilePhotoUrl: res.data.profilePhotoUrl });
      setForm({ ...form, profilePhotoUrl: res.data.profilePhotoUrl });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to upload photo.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [profileRes, docRes] = await Promise.all([
          api.get(`/users/${id}/profile`),
          api.get(`/users/${id}/documents`).catch(() => ({ data: [] })),
        ]);
        setProfile(profileRes.data);
        setForm(profileRes.data);
        setDocuments(docRes.data);
      } catch (err) {
        console.error('Profile error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/users/${id}/profile`, form);
      setProfile({ ...profile, ...res.data });
      setEditing(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => setForm({ ...form, [field]: value });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Profile not found.</p>
        <Link to="/directory" className="text-blue-600 text-sm hover:underline mt-2 block">Back to directory</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link to="/directory" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600">
        <ArrowLeft className="w-4 h-4" /> Back to Directory
      </Link>

      {/* ─── Header Card ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-700" />
        <div className="px-6 pb-5">
          <div className="flex flex-col sm:flex-row items-start gap-4 -mt-10">
            {/* Avatar with upload */}
            <div className="relative w-20 h-20 flex-shrink-0 group">
              <div className="w-20 h-20 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center">
                {profile.profilePhotoUrl ? (
                  <img src={profile.profilePhotoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
                    {profile.name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
              </div>
              {/* Camera overlay — self or admin can upload */}
              {(isSelf || canEdit) && (
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {uploading ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-slate-800">{profile.name}</h1>
                {profile.employeeId && (
                  <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{profile.employeeId}</span>
                )}
                {profile.isActive === false && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Inactive</span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{profile.designation || 'Employee'} · {profile.department}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="capitalize text-[11px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">{profile.role?.replace('_', ' ')}</span>
                <span className="capitalize text-[11px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded">{profile.employmentType?.replace('_', ' ')}</span>
                {profile.location && <span className="text-[11px] px-2 py-0.5 bg-green-50 text-green-600 rounded flex items-center gap-0.5"><MapPin className="w-3 h-3" />{profile.location}</span>}
              </div>
              {/* Quick contact */}
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{profile.email}</span>
                {profile.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{profile.phone}</span>}
              </div>
            </div>
            {/* Edit button */}
            {(canEdit || isSelf) && (
              <div className="sm:ml-auto flex-shrink-0">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <button onClick={handleSave} disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                      <Save className="w-3.5 h-3.5" />{saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => { setEditing(false); setForm(profile); }}
                      className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50">
                      <X className="w-3.5 h-3.5" />Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setEditing(true)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50">
                    <Edit3 className="w-3.5 h-3.5" />Edit
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Reporting Hierarchy ─── */}
      {(profile.reportingManager || profile.subordinates?.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Reporting Hierarchy</h3>
          <div className="flex flex-col items-center gap-2">
            {/* Manager */}
            {profile.reportingManager && (
              <>
                <Link to={`/employee/${profile.reportingManager.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors w-full sm:w-auto sm:min-w-[280px]">
                  <div className="w-9 h-9 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 text-sm font-bold flex-shrink-0">
                    {profile.reportingManager.profilePhotoUrl
                      ? <img src={profile.reportingManager.profilePhotoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                      : profile.reportingManager.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-blue-800 truncate">{profile.reportingManager.name}</p>
                    <p className="text-[10px] text-blue-500">
                      {profile.reportingManager.designation || 'Manager'} · {profile.reportingManager.department}
                    </p>
                  </div>
                  <span className="text-[9px] uppercase font-semibold text-blue-400 ml-auto">Reports To</span>
                </Link>
                <div className="w-px h-4 bg-slate-300" />
              </>
            )}

            {/* Current user */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border-2 border-indigo-200 rounded-lg w-full sm:w-auto sm:min-w-[280px]">
              <div className="w-9 h-9 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 text-sm font-bold flex-shrink-0">
                {profile.profilePhotoUrl
                  ? <img src={profile.profilePhotoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                  : profile.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-800">{profile.name}</p>
                <p className="text-[10px] text-indigo-500">{profile.designation || 'Employee'} · {profile.department}</p>
              </div>
            </div>

            {/* Subordinates */}
            {profile.subordinates?.length > 0 && (
              <>
                <div className="w-px h-4 bg-slate-300" />
                <div className="flex flex-wrap justify-center gap-2 w-full">
                  {profile.subordinates.map((s) => (
                    <Link key={s.id} to={`/employee/${s.id}`}
                      className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg hover:bg-green-100 transition-colors">
                      <div className="w-7 h-7 rounded-full bg-green-200 flex items-center justify-center text-green-700 text-xs font-bold flex-shrink-0">
                        {s.profilePhotoUrl
                          ? <img src={s.profilePhotoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                          : s.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-green-800 truncate">{s.name}</p>
                        <p className="text-[9px] text-green-500">{s.designation || 'Employee'}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">
                  {profile.subordinates.length} Direct Report{profile.subordinates.length > 1 ? 's' : ''}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Tabs ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tab header */}
        <div className="border-b border-slate-200 overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap
                  ${activeTab === key ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-5">
          {activeTab === 'personal' && (
            <PersonalTab profile={profile} form={form} editing={editing} canEdit={canEdit} isSelf={isSelf} updateField={updateField} />
          )}
          {activeTab === 'employment' && (
            <EmploymentTab profile={profile} form={form} editing={editing} canEdit={canEdit} updateField={updateField} />
          )}
          {activeTab === 'identity' && (
            <IdentityBankTab profile={profile} form={form} editing={editing} canEdit={canEdit} updateField={updateField} />
          )}
          {activeTab === 'family' && (
            <FamilyTab profile={profile} setProfile={setProfile} canEdit={canEdit} isSelf={isSelf} userId={id} />
          )}
          {activeTab === 'education' && (
            <EducationTab profile={profile} setProfile={setProfile} canEdit={canEdit} isSelf={isSelf} userId={id} />
          )}
          {activeTab === 'documents' && (
            <DocumentsTab documents={documents} canEdit={canEdit} userId={id} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PERSONAL TAB
   ═══════════════════════════════════════════════════════════ */
function PersonalTab({ profile, form, editing, canEdit, isSelf, updateField }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Contact Information */}
      <Section title="Contact Information" icon={Phone}>
        <Field icon={User} label="Full Name" value={profile.name}
          editing={editing && (canEdit || isSelf)} onChange={(v) => updateField('name', v)} editValue={form.name} />
        <Field icon={Mail} label="Work Email" value={profile.email} />
        <Field icon={Mail} label="Personal Email" value={profile.personalEmail}
          editing={editing && (canEdit || isSelf)} onChange={(v) => updateField('personalEmail', v)} editValue={form.personalEmail} />
        <Field icon={Phone} label="Phone" value={profile.phone}
          editing={editing && (canEdit || isSelf)} onChange={(v) => updateField('phone', v)} editValue={form.phone} />
      </Section>

      {/* Personal Details */}
      <Section title="Personal Details" icon={User}>
        <Field icon={Calendar} label="Date of Birth" value={profile.dateOfBirth}
          editing={editing && canEdit} onChange={(v) => updateField('dateOfBirth', v)} editValue={form.dateOfBirth} type="date" />
        <Field icon={User} label="Gender" value={profile.gender}
          editing={editing && canEdit} onChange={(v) => updateField('gender', v)} editValue={form.gender}
          type="select" options={['male', 'female', 'other']} />
        <Field icon={Heart} label="Blood Group" value={profile.bloodGroup}
          editing={editing && canEdit} onChange={(v) => updateField('bloodGroup', v)} editValue={form.bloodGroup}
          type="select" options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} />
        <Field icon={Heart} label="Marital Status" value={profile.maritalStatus}
          editing={editing && canEdit} onChange={(v) => updateField('maritalStatus', v)} editValue={form.maritalStatus}
          type="select" options={['single', 'married', 'divorced', 'widowed']} />
        <Field icon={Globe} label="Nationality" value={profile.nationality}
          editing={editing && canEdit} onChange={(v) => updateField('nationality', v)} editValue={form.nationality} />
        <Field icon={User} label="Father's Name" value={profile.fatherName}
          editing={editing && canEdit} onChange={(v) => updateField('fatherName', v)} editValue={form.fatherName} />
        {profile.maritalStatus === 'married' && (
          <Field icon={User} label="Spouse Name" value={profile.spouseName}
            editing={editing && canEdit} onChange={(v) => updateField('spouseName', v)} editValue={form.spouseName} />
        )}
        <Field icon={BookOpen} label="Religion" value={profile.religion}
          editing={editing && canEdit} onChange={(v) => updateField('religion', v)} editValue={form.religion} />
        <Field icon={MapPin} label="Place of Birth" value={profile.placeOfBirth}
          editing={editing && canEdit} onChange={(v) => updateField('placeOfBirth', v)} editValue={form.placeOfBirth} />
      </Section>

      {/* Current Address */}
      <Section title="Current Address" icon={MapPin}>
        <Field icon={MapPin} label="Address" value={profile.address}
          editing={editing && (canEdit || isSelf)} onChange={(v) => updateField('address', v)} editValue={form.address} type="textarea" />
      </Section>

      {/* Permanent Address */}
      <Section title="Permanent Address" icon={MapPin}>
        <Field icon={MapPin} label="Address" value={profile.permanentAddress}
          editing={editing && (canEdit || isSelf)} onChange={(v) => updateField('permanentAddress', v)} editValue={form.permanentAddress} type="textarea" />
      </Section>

      {/* Emergency Contact */}
      <Section title="Emergency Contact" icon={Phone} className="lg:col-span-2">
        <EmergencyContactSection profile={profile} form={form} editing={editing} canEdit={canEdit} isSelf={isSelf} updateField={updateField} />
      </Section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EMPLOYMENT TAB
   ═══════════════════════════════════════════════════════════ */
function EmploymentTab({ profile, form, editing, canEdit, updateField }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Current Position */}
      <Section title="Current Position" icon={Briefcase}>
        <Field icon={Shield} label="Employee ID" value={profile.employeeId} />
        <Field icon={Briefcase} label="Designation" value={profile.designation}
          editing={editing && canEdit} onChange={(v) => updateField('designation', v)} editValue={form.designation} />
        <Field icon={Building2} label="Department" value={profile.department}
          editing={editing && canEdit} onChange={(v) => updateField('department', v)} editValue={form.department} />
        <Field icon={BadgeCheck} label="Grade / Level" value={profile.grade}
          editing={editing && canEdit} onChange={(v) => updateField('grade', v)} editValue={form.grade} />
        <Field icon={MapPin} label="Location" value={profile.location}
          editing={editing && canEdit} onChange={(v) => updateField('location', v)} editValue={form.location} />
        <Field icon={Clock} label="Shift" value={profile.shift}
          editing={editing && canEdit} onChange={(v) => updateField('shift', v)} editValue={form.shift} />
        <Field icon={Briefcase} label="Employment Type" value={profile.employmentType?.replace('_', ' ')}
          editing={editing && canEdit} onChange={(v) => updateField('employmentType', v)} editValue={form.employmentType}
          type="select" options={['full_time', 'part_time', 'contract', 'intern']} />
        {profile.reportingManager && (
          <div className="flex items-start gap-3">
            <UserCheck className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] uppercase text-slate-400 font-medium">Reporting Manager</p>
              <Link to={`/employee/${profile.reportingManager.id}`} className="text-sm text-blue-600 hover:underline font-medium">
                {profile.reportingManager.name}
                <span className="text-slate-400 font-normal ml-1">({profile.reportingManager.designation || profile.reportingManager.department})</span>
              </Link>
            </div>
          </div>
        )}
      </Section>

      {/* Joining Details */}
      <Section title="Joining Details" icon={Calendar}>
        <Field icon={Calendar} label="Date of Joining" value={profile.dateOfJoining}
          editing={editing && canEdit} onChange={(v) => updateField('dateOfJoining', v)} editValue={form.dateOfJoining} type="date" />
        <Field icon={Calendar} label="Confirmation Date" value={profile.confirmationDate}
          editing={editing && canEdit} onChange={(v) => updateField('confirmationDate', v)} editValue={form.confirmationDate} type="date" />
        <Field icon={Calendar} label="Probation End Date" value={profile.probationEndDate}
          editing={editing && canEdit} onChange={(v) => updateField('probationEndDate', v)} editValue={form.probationEndDate} type="date" />
        <Field icon={Clock} label="Notice Period (Days)" value={profile.noticePeriodDays}
          editing={editing && canEdit} onChange={(v) => updateField('noticePeriodDays', parseInt(v) || 0)} editValue={form.noticePeriodDays} type="number" />
        <Field icon={Briefcase} label="Previous Experience (Yrs)" value={profile.previousExperience}
          editing={editing && canEdit} onChange={(v) => updateField('previousExperience', parseFloat(v) || 0)} editValue={form.previousExperience} type="number" />
        {profile.dateOfJoining && (
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] uppercase text-slate-400 font-medium">Total Experience at CPIPL</p>
              <p className="text-sm text-slate-700">{calcYears(profile.dateOfJoining)}</p>
            </div>
          </div>
        )}
      </Section>

      {/* Previous Employment */}
      {profile.previousEmployments?.length > 0 && (
        <Section title="Previous Employment" icon={Briefcase} className="lg:col-span-2">
          <div className="space-y-3">
            {profile.previousEmployments.map((emp) => (
              <div key={emp.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <Briefcase className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700">{emp.company}</p>
                  <p className="text-xs text-slate-500">{emp.designation}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {emp.fromDate} → {emp.toDate || 'Present'}
                    {emp.reasonForLeaving && <span className="ml-2">· {emp.reasonForLeaving}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   IDENTITY & BANK TAB
   ═══════════════════════════════════════════════════════════ */
function IdentityBankTab({ profile, form, editing, canEdit, updateField }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Identity Documents */}
      <Section title="Identity Documents" icon={CreditCard}>
        <Field icon={Hash} label="Aadhaar Number" value={profile.aadhaarNumber ? maskNumber(profile.aadhaarNumber) : null}
          editing={editing && canEdit} onChange={(v) => updateField('aadhaarNumber', v)} editValue={form.aadhaarNumber} />
        <Field icon={Hash} label="PAN Number" value={profile.panNumber}
          editing={editing && canEdit} onChange={(v) => updateField('panNumber', v)} editValue={form.panNumber} />
        <Field icon={Hash} label="UAN Number" value={profile.uanNumber}
          editing={editing && canEdit} onChange={(v) => updateField('uanNumber', v)} editValue={form.uanNumber} />
        <Field icon={Globe} label="Passport Number" value={profile.passportNumber}
          editing={editing && canEdit} onChange={(v) => updateField('passportNumber', v)} editValue={form.passportNumber} />
        <Field icon={Calendar} label="Passport Expiry" value={profile.passportExpiry}
          editing={editing && canEdit} onChange={(v) => updateField('passportExpiry', v)} editValue={form.passportExpiry} type="date" />
        <Field icon={CreditCard} label="Driving License" value={profile.drivingLicense}
          editing={editing && canEdit} onChange={(v) => updateField('drivingLicense', v)} editValue={form.drivingLicense} />
      </Section>

      {/* Bank Details */}
      <Section title="Bank Account" icon={Landmark}>
        <Field icon={Landmark} label="Bank Name" value={profile.bankName}
          editing={editing && canEdit} onChange={(v) => updateField('bankName', v)} editValue={form.bankName} />
        <Field icon={Hash} label="Account Number" value={profile.bankAccountNumber ? maskNumber(profile.bankAccountNumber) : null}
          editing={editing && canEdit} onChange={(v) => updateField('bankAccountNumber', v)} editValue={form.bankAccountNumber} />
        <Field icon={Building2} label="Branch" value={profile.bankBranch}
          editing={editing && canEdit} onChange={(v) => updateField('bankBranch', v)} editValue={form.bankBranch} />
        <Field icon={Hash} label="IFSC Code" value={profile.bankIfscCode}
          editing={editing && canEdit} onChange={(v) => updateField('bankIfscCode', v)} editValue={form.bankIfscCode} />
      </Section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FAMILY TAB
   ═══════════════════════════════════════════════════════════ */
function FamilyTab({ profile, setProfile, canEdit, isSelf, userId }) {
  const [adding, setAdding] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', relationship: '', dateOfBirth: '', occupation: '', phone: '', isDependent: false, isNominee: false, nomineeShare: 0 });

  const handleAdd = async () => {
    try {
      const res = await api.post(`/users/${userId}/family`, newMember);
      setProfile({ ...profile, familyMembers: [...(profile.familyMembers || []), res.data] });
      setAdding(false);
      setNewMember({ name: '', relationship: '', dateOfBirth: '', occupation: '', phone: '', isDependent: false, isNominee: false, nomineeShare: 0 });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add family member.');
    }
  };

  const handleDelete = async (fmId) => {
    if (!confirm('Remove this family member?')) return;
    try {
      await api.delete(`/users/${userId}/family/${fmId}`);
      setProfile({ ...profile, familyMembers: profile.familyMembers.filter((f) => f.id !== fmId) });
    } catch (err) {
      alert('Failed to delete.');
    }
  };

  const members = profile.familyMembers || [];

  return (
    <div className="space-y-4">
      {(canEdit || isSelf) && (
        <div className="flex justify-end">
          <button onClick={() => setAdding(!adding)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-3.5 h-3.5" />Add Family Member
          </button>
        </div>
      )}

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <MiniInput label="Name *" value={newMember.name} onChange={(v) => setNewMember({ ...newMember, name: v })} />
            <MiniSelect label="Relationship *" value={newMember.relationship} onChange={(v) => setNewMember({ ...newMember, relationship: v })}
              options={['father', 'mother', 'spouse', 'child', 'sibling', 'other']} />
            <MiniInput label="Date of Birth" value={newMember.dateOfBirth} onChange={(v) => setNewMember({ ...newMember, dateOfBirth: v })} type="date" />
            <MiniInput label="Occupation" value={newMember.occupation} onChange={(v) => setNewMember({ ...newMember, occupation: v })} />
            <MiniInput label="Phone" value={newMember.phone} onChange={(v) => setNewMember({ ...newMember, phone: v })} />
            <div className="flex items-center gap-4 pt-5">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={newMember.isDependent} onChange={(e) => setNewMember({ ...newMember, isDependent: e.target.checked })} className="rounded" />
                Dependent
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={newMember.isNominee} onChange={(e) => setNewMember({ ...newMember, isNominee: e.target.checked })} className="rounded" />
                Nominee
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">No family members added yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-3 py-2 font-medium text-slate-600">Name</th>
                <th className="px-3 py-2 font-medium text-slate-600">Relationship</th>
                <th className="px-3 py-2 font-medium text-slate-600">DOB</th>
                <th className="px-3 py-2 font-medium text-slate-600">Occupation</th>
                <th className="px-3 py-2 font-medium text-slate-600">Dependent</th>
                <th className="px-3 py-2 font-medium text-slate-600">Nominee</th>
                {(canEdit || isSelf) && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">{m.name}</td>
                  <td className="px-3 py-2 capitalize text-slate-600">{m.relationship}</td>
                  <td className="px-3 py-2 text-slate-500">{m.dateOfBirth || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{m.occupation || '—'}</td>
                  <td className="px-3 py-2">{m.isDependent ? <span className="text-green-600">Yes</span> : '—'}</td>
                  <td className="px-3 py-2">{m.isNominee ? <span className="text-blue-600">Yes ({m.nomineeShare}%)</span> : '—'}</td>
                  {(canEdit || isSelf) && (
                    <td className="px-3 py-2">
                      <button onClick={() => handleDelete(m.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EDUCATION TAB
   ═══════════════════════════════════════════════════════════ */
function EducationTab({ profile, setProfile, canEdit, isSelf, userId }) {
  const [adding, setAdding] = useState(false);
  const [newEdu, setNewEdu] = useState({ degree: '', institution: '', university: '', specialization: '', yearOfPassing: '', percentage: '' });

  const handleAdd = async () => {
    try {
      const res = await api.post(`/users/${userId}/education`, newEdu);
      setProfile({ ...profile, educations: [res.data, ...(profile.educations || [])] });
      setAdding(false);
      setNewEdu({ degree: '', institution: '', university: '', specialization: '', yearOfPassing: '', percentage: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add education.');
    }
  };

  const handleDelete = async (eduId) => {
    if (!confirm('Remove this education record?')) return;
    try {
      await api.delete(`/users/${userId}/education/${eduId}`);
      setProfile({ ...profile, educations: profile.educations.filter((e) => e.id !== eduId) });
    } catch (err) {
      alert('Failed to delete.');
    }
  };

  const records = profile.educations || [];

  return (
    <div className="space-y-4">
      {(canEdit || isSelf) && (
        <div className="flex justify-end">
          <button onClick={() => setAdding(!adding)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-3.5 h-3.5" />Add Education
          </button>
        </div>
      )}

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <MiniInput label="Degree *" value={newEdu.degree} onChange={(v) => setNewEdu({ ...newEdu, degree: v })} placeholder="B.Tech, MBA..." />
            <MiniInput label="Institution *" value={newEdu.institution} onChange={(v) => setNewEdu({ ...newEdu, institution: v })} />
            <MiniInput label="University" value={newEdu.university} onChange={(v) => setNewEdu({ ...newEdu, university: v })} />
            <MiniInput label="Specialization" value={newEdu.specialization} onChange={(v) => setNewEdu({ ...newEdu, specialization: v })} />
            <MiniInput label="Year of Passing" value={newEdu.yearOfPassing} onChange={(v) => setNewEdu({ ...newEdu, yearOfPassing: v })} placeholder="2020" />
            <MiniInput label="Percentage / CGPA" value={newEdu.percentage} onChange={(v) => setNewEdu({ ...newEdu, percentage: v })} placeholder="85% or 8.5" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">No education records added yet.</div>
      ) : (
        <div className="space-y-3">
          {records.map((edu) => (
            <div key={edu.id} className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg group">
              <GraduationCap className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">{edu.degree}{edu.specialization ? ` — ${edu.specialization}` : ''}</p>
                <p className="text-xs text-slate-500">{edu.institution}{edu.university ? `, ${edu.university}` : ''}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-[10px] text-slate-400">
                  {edu.yearOfPassing && <span>Passed: {edu.yearOfPassing}</span>}
                  {edu.percentage && <span>Score: {edu.percentage}</span>}
                </div>
              </div>
              {(canEdit || isSelf) && (
                <button onClick={() => handleDelete(edu.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DOCUMENTS TAB
   ═══════════════════════════════════════════════════════════ */
function DocumentsTab({ documents, canEdit, userId }) {
  return (
    <div>
      {documents.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">No documents uploaded yet.</div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">{doc.name}</p>
                <p className="text-[10px] text-slate-400 capitalize">{doc.type?.replace('_', ' ')} · Uploaded {new Date(doc.uploadedAt).toLocaleDateString('en-IN')}</p>
              </div>
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline">View</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════ */
function Section({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={className}>
      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-500" />{title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ icon: Icon, label, value, editing, onChange, editValue, type = 'text', options = [] }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase text-slate-400 font-medium">{label}</p>
        {editing && onChange ? (
          type === 'select' ? (
            <select value={editValue || ''} onChange={(e) => onChange(e.target.value)}
              className="w-full border border-slate-200 rounded px-2 py-1 text-sm mt-0.5 bg-white capitalize">
              <option value="">Select...</option>
              {options.map((o) => <option key={o} value={o} className="capitalize">{o.replace('_', ' ')}</option>)}
            </select>
          ) : type === 'textarea' ? (
            <textarea value={editValue || ''} onChange={(e) => onChange(e.target.value)}
              className="w-full border border-slate-200 rounded px-2 py-1 text-sm mt-0.5" rows={2} />
          ) : (
            <input type={type} value={editValue ?? ''} onChange={(e) => onChange(e.target.value)}
              className="w-full border border-slate-200 rounded px-2 py-1 text-sm mt-0.5" />
          )
        ) : (
          <p className="text-sm text-slate-700 capitalize">{typeof value === 'object' ? value : (value || '—')}</p>
        )}
      </div>
    </div>
  );
}

function EmergencyContactSection({ profile, form, editing, canEdit, isSelf, updateField }) {
  let ec = { name: '', phone: '', relation: '' };
  try { ec = JSON.parse(profile.emergencyContact || '{}'); } catch { /* ignore */ }
  let formEc = { name: '', phone: '', relation: '' };
  try { formEc = JSON.parse(form.emergencyContact || '{}'); } catch { /* ignore */ }

  const updateEc = (field, value) => {
    const updated = { ...formEc, [field]: value };
    updateField('emergencyContact', JSON.stringify(updated));
  };

  if (editing && (canEdit || isSelf)) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniInput label="Name" value={formEc.name} onChange={(v) => updateEc('name', v)} />
        <MiniInput label="Phone" value={formEc.phone} onChange={(v) => updateEc('phone', v)} />
        <MiniInput label="Relation" value={formEc.relation} onChange={(v) => updateEc('relation', v)} />
      </div>
    );
  }

  if (!ec.name && !ec.phone) return <p className="text-sm text-slate-400">No emergency contact added.</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
      <div><span className="text-[10px] uppercase text-slate-400 block">Name</span><span className="text-slate-700 font-medium">{ec.name || '—'}</span></div>
      <div><span className="text-[10px] uppercase text-slate-400 block">Phone</span><span className="text-slate-700 font-medium">{ec.phone || '—'}</span></div>
      <div><span className="text-[10px] uppercase text-slate-400 block">Relation</span><span className="text-slate-700 font-medium">{ec.relation || '—'}</span></div>
    </div>
  );
}

function MiniInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label className="text-[10px] uppercase text-slate-500 font-medium">{label}</label>
      <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm mt-0.5 bg-white" />
    </div>
  );
}

function MiniSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-[10px] uppercase text-slate-500 font-medium">{label}</label>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm mt-0.5 bg-white capitalize">
        <option value="">Select...</option>
        {options.map((o) => <option key={o} value={o} className="capitalize">{o}</option>)}
      </select>
    </div>
  );
}

function maskNumber(num) {
  if (!num || num.length < 4) return num;
  return '●'.repeat(num.length - 4) + num.slice(-4);
}

function calcYears(dateStr) {
  if (!dateStr) return '—';
  const from = new Date(dateStr);
  const now = new Date();
  const years = Math.floor((now - from) / (365.25 * 24 * 60 * 60 * 1000));
  const months = Math.floor(((now - from) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
  return `${years} yr${years !== 1 ? 's' : ''} ${months} mo${months !== 1 ? 's' : ''}`;
}
