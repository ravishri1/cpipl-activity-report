import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import {
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  Briefcase,
  MapPin,
  Heart,
  Shield,
  ArrowLeft,
  Edit3,
  Save,
  X,
} from 'lucide-react';

export default function EmployeeProfile() {
  const { id } = useParams();
  const { user: currentUser, isAdmin } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const isSelf = currentUser?.id === parseInt(id);
  const canEdit = isAdmin && currentUser?.role === 'admin';

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get(`/users/${id}/profile`);
        setProfile(res.data);
        setForm(res.data);
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
    <div className="space-y-6">
      {/* Back link */}
      <Link to="/directory" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600">
        <ArrowLeft className="w-4 h-4" /> Back to Directory
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-700" />
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row items-start gap-4 -mt-10">
            <div className="w-20 h-20 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center">
              {profile.profilePhotoUrl ? (
                <img src={profile.profilePhotoUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
                  {profile.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-800">{profile.name}</h1>
                {profile.employeeId && (
                  <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                    {profile.employeeId}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">{profile.designation || 'Employee'} · {profile.department}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                <span className="capitalize px-2 py-0.5 bg-blue-50 text-blue-600 rounded">{profile.role?.replace('_', ' ')}</span>
                <span className="capitalize px-2 py-0.5 bg-slate-100 rounded">{profile.employmentType?.replace('_', ' ')}</span>
              </div>
            </div>
            {(canEdit || isSelf) && (
              <div className="sm:ml-auto">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditing(false); setForm(profile); }}
                      className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" />
            Personal Information
          </h3>
          <div className="space-y-3">
            <InfoRow icon={Mail} label="Email" value={profile.email} />
            <InfoRow icon={Phone} label="Phone" value={profile.phone}
              editing={editing} onChange={(v) => setForm({ ...form, phone: v })} editValue={form.phone} />
            <InfoRow icon={Mail} label="Personal Email" value={profile.personalEmail}
              editing={editing && (canEdit || isSelf)} onChange={(v) => setForm({ ...form, personalEmail: v })} editValue={form.personalEmail} />
            <InfoRow icon={Calendar} label="Date of Birth" value={profile.dateOfBirth}
              editing={editing && canEdit} onChange={(v) => setForm({ ...form, dateOfBirth: v })} editValue={form.dateOfBirth} type="date" />
            <InfoRow icon={User} label="Gender" value={profile.gender}
              editing={editing && canEdit} onChange={(v) => setForm({ ...form, gender: v })} editValue={form.gender} />
            <InfoRow icon={Heart} label="Blood Group" value={profile.bloodGroup}
              editing={editing && canEdit} onChange={(v) => setForm({ ...form, bloodGroup: v })} editValue={form.bloodGroup} />
            <InfoRow icon={MapPin} label="Address" value={profile.address}
              editing={editing && (canEdit || isSelf)} onChange={(v) => setForm({ ...form, address: v })} editValue={form.address} />
          </div>
        </div>

        {/* Employment Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-500" />
            Employment Information
          </h3>
          <div className="space-y-3">
            <InfoRow icon={Shield} label="Employee ID" value={profile.employeeId} />
            <InfoRow icon={Briefcase} label="Designation" value={profile.designation}
              editing={editing && canEdit} onChange={(v) => setForm({ ...form, designation: v })} editValue={form.designation} />
            <InfoRow icon={Building2} label="Department" value={profile.department}
              editing={editing && canEdit} onChange={(v) => setForm({ ...form, department: v })} editValue={form.department} />
            <InfoRow icon={Calendar} label="Date of Joining" value={profile.dateOfJoining}
              editing={editing && canEdit} onChange={(v) => setForm({ ...form, dateOfJoining: v })} editValue={form.dateOfJoining} type="date" />
            <InfoRow icon={Briefcase} label="Employment Type" value={profile.employmentType?.replace('_', ' ')} />
            {profile.reportingManager && (
              <InfoRow icon={User} label="Reporting Manager" value={
                <Link to={`/employee/${profile.reportingManager.id}`} className="text-blue-600 hover:underline">
                  {profile.reportingManager.name} ({profile.reportingManager.employeeId})
                </Link>
              } />
            )}
          </div>
        </div>
      </div>

      {/* Emergency contact */}
      {profile.emergencyContact && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Phone className="w-4 h-4 text-red-500" />
            Emergency Contact
          </h3>
          {(() => {
            try {
              const ec = JSON.parse(profile.emergencyContact);
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div><span className="text-slate-400">Name:</span> <span className="text-slate-700 font-medium">{ec.name}</span></div>
                  <div><span className="text-slate-400">Phone:</span> <span className="text-slate-700 font-medium">{ec.phone}</span></div>
                  <div><span className="text-slate-400">Relation:</span> <span className="text-slate-700 font-medium">{ec.relation}</span></div>
                </div>
              );
            } catch {
              return <p className="text-sm text-slate-500">{profile.emergencyContact}</p>;
            }
          })()}
        </div>
      )}

      {/* Subordinates */}
      {profile.subordinates?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Direct Reports ({profile.subordinates.length})</h3>
          <div className="flex flex-wrap gap-2">
            {profile.subordinates.map((s) => (
              <Link
                key={s.id}
                to={`/employee/${s.id}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                {s.name}
                {s.employeeId && <span className="text-[10px] font-mono text-slate-400">{s.employeeId}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, editing, onChange, editValue, type = 'text' }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase text-slate-400 font-medium">{label}</p>
        {editing && onChange ? (
          <input
            type={type}
            value={editValue || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-slate-200 rounded px-2 py-1 text-sm mt-0.5"
          />
        ) : (
          <p className="text-sm text-slate-700">{value || '—'}</p>
        )}
      </div>
    </div>
  );
}
