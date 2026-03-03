import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { driveImageUrl } from '../../utils/formatters';
import {
  User, Mail, Phone, Building2, Calendar, Briefcase, MapPin,
  Heart, Shield, ArrowLeft, Edit3, Save, X, CreditCard,
  GraduationCap, Users, FileText, ChevronRight, Plus, Pencil,
  Globe, UserCheck, Clock, BadgeCheck, Landmark, Hash, BookOpen,
  Camera, Loader2, History, ChevronLeft, FolderOpen, Upload,
  Trash2, ExternalLink, Image as ImageIcon, File,
} from 'lucide-react';

const TABS = [
  { key: 'personal', label: 'Personal', icon: User },
  { key: 'employment', label: 'Employment & Job', icon: Briefcase },
  { key: 'identity', label: 'Identity & Bank', icon: CreditCard },
  { key: 'family', label: 'Family', icon: Users },
  { key: 'education', label: 'Education', icon: GraduationCap },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'driveFiles', label: 'Drive Files', icon: FolderOpen },
  { key: 'history', label: 'Change History', icon: History },
];

export default function EmployeeProfile() {
  const { id } = useParams();
  const { user: currentUser, isAdmin, updateUserPhoto, refreshUserData } = useAuth();
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

  // Upload profile photo to Google Drive (no base64 in DB)
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      if (isAdmin && !isSelf) formData.append('userId', id);
      const res = await api.post('/files/upload-profile-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile({ ...profile, driveProfilePhotoUrl: res.data.driveProfilePhotoUrl });
      setForm({ ...form, driveProfilePhotoUrl: res.data.driveProfilePhotoUrl });
      // Update global user photo if uploading own photo (so Sidebar updates)
      if (isSelf) updateUserPhoto(res.data.driveProfilePhotoUrl);
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
      // Refresh global user data if updating own profile (so sidebar/header updates immediately)
      if (isSelf) {
        await refreshUserData();
      }
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
        {/* Gradient banner — edit button sits inside it */}
        <div className="h-28 bg-gradient-to-r from-blue-600 to-indigo-700 relative">
          {(canEdit || isSelf) && (
            <div className="absolute top-3 right-4">
              {editing ? (
                <div className="flex items-center gap-2">
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white/90 text-blue-700 rounded-lg text-xs font-semibold hover:bg-white disabled:opacity-50 shadow-sm">
                    <Save className="w-3.5 h-3.5" />{saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => { setEditing(false); setForm(profile); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white/20 text-white rounded-lg text-xs font-medium hover:bg-white/30 border border-white/30">
                    <X className="w-3.5 h-3.5" />Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/20 text-white rounded-lg text-xs font-medium hover:bg-white/30 border border-white/30">
                  <Edit3 className="w-3.5 h-3.5" />Edit
                </button>
              )}
            </div>
          )}
        </div>

        {/* White content — avatar overlaps upward into gradient */}
        <div className="relative px-6 pb-5 pt-14">
          {/* Avatar — positioned to straddle the gradient/white boundary */}
          <div className="absolute -top-10 left-6">
            <div className="relative w-20 h-20 group">
              <div className="w-20 h-20 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center">
                {(driveImageUrl(profile.driveProfilePhotoUrl) || profile.profilePhotoUrl) ? (
                  <img src={driveImageUrl(profile.driveProfilePhotoUrl) || profile.profilePhotoUrl} alt="" className="w-full h-full rounded-full object-cover" />
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
          </div>

          {/* Info — guaranteed in white area */}
          <div>
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
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{profile.email?.toLowerCase()}</span>
              {profile.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{profile.phone}</span>}
            </div>
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
                    {(driveImageUrl(profile.reportingManager.driveProfilePhotoUrl) || profile.reportingManager.profilePhotoUrl)
                      ? <img src={driveImageUrl(profile.reportingManager.driveProfilePhotoUrl) || profile.reportingManager.profilePhotoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
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
                {(driveImageUrl(profile.driveProfilePhotoUrl) || profile.profilePhotoUrl)
                  ? <img src={driveImageUrl(profile.driveProfilePhotoUrl) || profile.profilePhotoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
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
                        {(driveImageUrl(s.driveProfilePhotoUrl) || s.profilePhotoUrl)
                          ? <img src={driveImageUrl(s.driveProfilePhotoUrl) || s.profilePhotoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
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
            <EmploymentTab profile={profile} setProfile={setProfile} form={form} editing={editing} canEdit={canEdit} isSelf={isSelf} userId={id} updateField={updateField} />
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
          {activeTab === 'driveFiles' && (
            <DriveFilesTab userId={id} canEdit={canEdit} />
          )}
          {activeTab === 'history' && (
            <ChangeHistoryTab userId={id} />
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
        <Field icon={Mail} label="Work Email" value={profile.email?.toLowerCase()} noCapitalize />
        <Field icon={Mail} label="Personal Email" value={profile.personalEmail?.toLowerCase()}
          editing={editing && (canEdit || isSelf)} onChange={(v) => updateField('personalEmail', v)} editValue={form.personalEmail} noCapitalize />
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
function EmploymentTab({ profile, setProfile, form, editing, canEdit, isSelf, userId, updateField }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newEmp, setNewEmp] = useState({ company: '', designation: '', fromDate: '', toDate: '', ctc: '', reasonForLeaving: '' });

  const handleAdd = async () => {
    try {
      const res = await api.post(`/users/${userId}/employment-history`, newEmp);
      setProfile({ ...profile, previousEmployments: [res.data, ...(profile.previousEmployments || [])] });
      setAdding(false);
      setNewEmp({ company: '', designation: '', fromDate: '', toDate: '', ctc: '', reasonForLeaving: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add employment record.');
    }
  };

  const startEdit = (emp) => { setEditingId(emp.id); setEditForm({ ...emp }); };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };
  const handleEdit = async () => {
    try {
      const res = await api.put(`/users/${userId}/employment-history/${editingId}`, editForm);
      setProfile({ ...profile, previousEmployments: profile.previousEmployments.map((e) => e.id === editingId ? res.data : e) });
      cancelEdit();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update.');
    }
  };

  const empRecords = profile.previousEmployments || [];

  return (
    <div className="space-y-6">
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
      </div>

      {/* Previous Employment Section */}
      <Section title="Previous Employment" icon={Briefcase}>
        {(canEdit || isSelf) && (
          <div className="flex justify-end mb-3">
            <button onClick={() => setAdding(!adding)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-3.5 h-3.5" />Add Employment
            </button>
          </div>
        )}

        {adding && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3 mb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <MiniInput label="Company *" value={newEmp.company} onChange={(v) => setNewEmp({ ...newEmp, company: v })} />
              <MiniInput label="Designation" value={newEmp.designation} onChange={(v) => setNewEmp({ ...newEmp, designation: v })} />
              <MiniInput label="From Date" value={newEmp.fromDate} onChange={(v) => setNewEmp({ ...newEmp, fromDate: v })} type="date" />
              <MiniInput label="To Date" value={newEmp.toDate} onChange={(v) => setNewEmp({ ...newEmp, toDate: v })} type="date" />
              <MiniInput label="CTC" value={newEmp.ctc} onChange={(v) => setNewEmp({ ...newEmp, ctc: v })} placeholder="Last drawn CTC" />
              <MiniInput label="Reason for Leaving" value={newEmp.reasonForLeaving} onChange={(v) => setNewEmp({ ...newEmp, reasonForLeaving: v })} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        )}

        {/* Edit form */}
        {editingId && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3 mb-3">
            <p className="text-xs font-semibold text-amber-700">Editing employment record</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <MiniInput label="Company *" value={editForm.company} onChange={(v) => setEditForm({ ...editForm, company: v })} />
              <MiniInput label="Designation" value={editForm.designation} onChange={(v) => setEditForm({ ...editForm, designation: v })} />
              <MiniInput label="From Date" value={editForm.fromDate} onChange={(v) => setEditForm({ ...editForm, fromDate: v })} type="date" />
              <MiniInput label="To Date" value={editForm.toDate} onChange={(v) => setEditForm({ ...editForm, toDate: v })} type="date" />
              <MiniInput label="CTC" value={editForm.ctc} onChange={(v) => setEditForm({ ...editForm, ctc: v })} />
              <MiniInput label="Reason for Leaving" value={editForm.reasonForLeaving} onChange={(v) => setEditForm({ ...editForm, reasonForLeaving: v })} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleEdit} className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700">Update</button>
              <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        )}

        {empRecords.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">No previous employment records added yet.</div>
        ) : (
          <div className="space-y-3">
            {empRecords.map((emp) => (
              <div key={emp.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg group">
                <Briefcase className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700">{emp.company}</p>
                  <p className="text-xs text-slate-500">{emp.designation}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {emp.fromDate} → {emp.toDate || 'Present'}
                    {emp.ctc && <span className="ml-2">· CTC: {emp.ctc}</span>}
                    {emp.reasonForLeaving && <span className="ml-2">· {emp.reasonForLeaving}</span>}
                  </p>
                </div>
                {(canEdit || isSelf) && (
                  <button onClick={() => startEdit(emp)} className="text-amber-500 hover:text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
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
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
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

  const startEdit = (m) => { setEditingId(m.id); setEditForm({ ...m }); };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };
  const handleEdit = async () => {
    try {
      const res = await api.put(`/users/${userId}/family/${editingId}`, editForm);
      setProfile({ ...profile, familyMembers: profile.familyMembers.map((f) => f.id === editingId ? res.data : f) });
      cancelEdit();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update.');
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

      {/* Edit form */}
      {editingId && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-amber-700">Editing family member</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <MiniInput label="Name *" value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} />
            <MiniSelect label="Relationship *" value={editForm.relationship} onChange={(v) => setEditForm({ ...editForm, relationship: v })}
              options={['father', 'mother', 'spouse', 'child', 'sibling', 'other']} />
            <MiniInput label="Date of Birth" value={editForm.dateOfBirth} onChange={(v) => setEditForm({ ...editForm, dateOfBirth: v })} type="date" />
            <MiniInput label="Occupation" value={editForm.occupation} onChange={(v) => setEditForm({ ...editForm, occupation: v })} />
            <MiniInput label="Phone" value={editForm.phone} onChange={(v) => setEditForm({ ...editForm, phone: v })} />
            <div className="flex items-center gap-4 pt-5">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={editForm.isDependent || false} onChange={(e) => setEditForm({ ...editForm, isDependent: e.target.checked })} className="rounded" />
                Dependent
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={editForm.isNominee || false} onChange={(e) => setEditForm({ ...editForm, isNominee: e.target.checked })} className="rounded" />
                Nominee
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleEdit} className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700">Update</button>
            <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
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
                      <button onClick={() => startEdit(m)} className="text-amber-500 hover:text-amber-700"><Pencil className="w-3.5 h-3.5" /></button>
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
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
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

  const startEdit = (edu) => { setEditingId(edu.id); setEditForm({ ...edu }); };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };
  const handleEdit = async () => {
    try {
      const res = await api.put(`/users/${userId}/education/${editingId}`, editForm);
      setProfile({ ...profile, educations: profile.educations.map((e) => e.id === editingId ? res.data : e) });
      cancelEdit();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update.');
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

      {/* Edit form */}
      {editingId && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-amber-700">Editing education record</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <MiniInput label="Degree *" value={editForm.degree} onChange={(v) => setEditForm({ ...editForm, degree: v })} />
            <MiniInput label="Institution *" value={editForm.institution} onChange={(v) => setEditForm({ ...editForm, institution: v })} />
            <MiniInput label="University" value={editForm.university} onChange={(v) => setEditForm({ ...editForm, university: v })} />
            <MiniInput label="Specialization" value={editForm.specialization} onChange={(v) => setEditForm({ ...editForm, specialization: v })} />
            <MiniInput label="Year of Passing" value={editForm.yearOfPassing} onChange={(v) => setEditForm({ ...editForm, yearOfPassing: v })} />
            <MiniInput label="Percentage / CGPA" value={editForm.percentage} onChange={(v) => setEditForm({ ...editForm, percentage: v })} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleEdit} className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700">Update</button>
            <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
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
                <button onClick={() => startEdit(edu)} className="text-amber-500 hover:text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity" title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
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

function Field({ icon: Icon, label, value, editing, onChange, editValue, type = 'text', options = [], noCapitalize = false }) {
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
          <p className={`text-sm text-slate-700 ${noCapitalize ? '' : 'capitalize'}`}>{typeof value === 'object' ? value : (value || '—')}</p>
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

/* ═══════════════════════════════════════════════════════════
   CHANGE HISTORY TAB
   ═══════════════════════════════════════════════════════════ */
function ChangeHistoryTab({ userId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/users/${userId}/change-history?page=${page}&limit=30`);
        setLogs(res.data.logs);
        setTotalPages(res.data.pages);
      } catch (err) {
        console.error('Change history error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [userId, page]);

  const sectionColors = {
    profile: 'bg-blue-100 text-blue-700',
    photo: 'bg-purple-100 text-purple-700',
    education: 'bg-green-100 text-green-700',
    family: 'bg-orange-100 text-orange-700',
    employment: 'bg-indigo-100 text-indigo-700',
  };
  const actionLabels = { add: 'Added', update: 'Updated', delete: 'Removed' };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return <div className="text-center py-12 text-slate-400 text-sm">No change history yet.</div>;
  }

  // Group logs by date
  const grouped = {};
  logs.forEach((log) => {
    const date = new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(log);
  });

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, entries]) => (
        <div key={date}>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />{date}
          </h4>
          <div className="space-y-2">
            {entries.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex-shrink-0 mt-0.5">
                  <History className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sectionColors[log.section] || 'bg-slate-100 text-slate-600'}`}>
                      {log.section}
                    </span>
                    <span className="text-[10px] text-slate-400">{actionLabels[log.action] || log.action}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{log.field}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    {log.oldValue && (
                      <span className="text-red-500 line-through bg-red-50 px-1.5 py-0.5 rounded max-w-[200px] truncate">{log.oldValue}</span>
                    )}
                    {log.oldValue && log.newValue && <span className="text-slate-300">→</span>}
                    {log.newValue && (
                      <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded max-w-[200px] truncate">{log.newValue}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    by {log.changedByUser?.name || 'System'} · {new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">
            <ChevronLeft className="w-3.5 h-3.5" />Prev
          </button>
          <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">
            Next<ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DRIVE FILES TAB (admin views/uploads employee files from Google Drive)
   ═══════════════════════════════════════════════════════════ */
function DriveFilesTab({ userId, canEdit }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('all');
  const CATEGORIES = [
    { key: 'all', label: 'All' },
    { key: 'document', label: 'Documents' },
    { key: 'receipt', label: 'Receipts' },
    { key: 'id_proof', label: 'ID Proofs' },
    { key: 'education', label: 'Education' },
    { key: 'photo', label: 'Photos' },
    { key: 'other', label: 'Other' },
  ];

  const CATEGORY_COLORS = {
    photo: 'bg-emerald-100 text-emerald-700',
    document: 'bg-blue-100 text-blue-700',
    receipt: 'bg-amber-100 text-amber-700',
    id_proof: 'bg-purple-100 text-purple-700',
    education: 'bg-indigo-100 text-indigo-700',
    other: 'bg-gray-100 text-gray-600',
  };

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const url = `/files/user/${userId}${category !== 'all' ? `?category=${category}` : ''}`;
      const res = await api.get(url);
      setFiles(res.data);
    } catch (err) {
      console.error('Drive files error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFiles(); }, [userId, category]);

  const handleUpload = async (file) => {
    if (!file || file.size > 15 * 1024 * 1024) {
      alert('File too large. Maximum size is 15 MB.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', detectCategory(file.name));
      await api.post(`/files/upload/${userId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchFiles();
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId, fileName) => {
    if (!confirm(`Delete "${fileName}"? This will also remove it from Google Drive.`)) return;
    try {
      await api.delete(`/files/${fileId}`);
      fetchFiles();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed.');
    }
  };

  function detectCategory(filename) {
    const lower = filename.toLowerCase();
    if (/receipt|invoice|bill/i.test(lower)) return 'receipt';
    if (/aadhaar|pan|passport|license|id/i.test(lower)) return 'id_proof';
    if (/degree|marksheet|certificate|diploma/i.test(lower)) return 'education';
    if (/\.(jpg|jpeg|png|webp|gif)$/i.test(lower)) return 'photo';
    return 'document';
  }

  function getFileIcon(mimeType) {
    if (mimeType?.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-emerald-500" />;
    if (mimeType?.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    return <File className="w-4 h-4 text-blue-500" />;
  }

  function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter + upload */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full whitespace-nowrap transition-colors ${
                category === c.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {c.label}
            </button>
          ))}
        </div>

        {canEdit && (
          <div className="flex-shrink-0">
            <label className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
              uploading ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}>
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Uploading...' : 'Upload File'}
              <input type="file" className="hidden" disabled={uploading}
                onChange={(e) => { handleUpload(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
        )}
      </div>

      {/* File list */}
      {files.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          No files uploaded yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors">
              {/* Thumbnail or icon */}
              <div className="w-9 h-9 flex-shrink-0 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                {file.thumbnailUrl ? (
                  <img src={file.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  getFileIcon(file.mimeType)
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{file.fileName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
                    CATEGORY_COLORS[file.category] || CATEGORY_COLORS.other
                  }`}>
                    {file.category?.replace('_', ' ')}
                  </span>
                  <span className="text-[9px] text-slate-400">{formatSize(file.fileSize)}</span>
                  <span className="text-[9px] text-slate-400">
                    {new Date(file.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <a href={file.driveUrl} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Open in Drive">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {canEdit && (
                  <button onClick={() => handleDelete(file.id, file.fileName)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <p className="text-[10px] text-slate-400 text-right">{files.length} file{files.length !== 1 ? 's' : ''}</p>
      )}
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
