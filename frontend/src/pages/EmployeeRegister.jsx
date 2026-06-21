import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { 
  Search, Filter, Plus, Edit2, Trash2, Eye, 
  Download, Printer, Check, X, ShieldAlert, 
  MapPin, Lock, Unlock, FileText, ArrowLeft, ArrowRight,
  Users, CheckCircle
} from 'lucide-react';

export default function EmployeeRegister() {
  const { request, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // UI toggles
  const [viewMode, setViewMode] = useState('list'); // 'list', 'add', 'edit', 'profile'
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [profileData, setProfileData] = useState(null);
  
  // Filters state
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDesig, setFilterDesig] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Add / Edit wizard step state
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    employee_id: '', full_name: '', mobile: '', email: '',
    department_id: '', designation_id: '', current_address: '',
    permanent_address: '', pincode: '', country: 'India', state: '',
    district: '', post_office: '', interviewed_hrs: '',
    interviewed_date: '', appointed_date: '', contract_till_date: '',
    dob: '', gender: 'Male', blood_group: '', marital_status: 'Single',
    nationality: 'Indian', citizenship_status: 'Citizen',
    emergency_contact_name: '', emergency_contact_number: '',
    alt_mobile: '', alt_email: '', reporting_manager_id: '',
    work_location_id: '', employment_type: 'Full-time', joining_salary: '',
    probation_period_days: 180, confirmation_date: '', onboarding_status: 'Draft',
    login_password: '',
    // KYC
    aadhaar_number: '', pan_number: '', bank_account_number: '',
    bank_name: '', bank_ifsc: '', upi_id: ''
  });

  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingText, setSubmittingText] = useState('');

  // Files state
  const [photoFile, setPhotoFile] = useState(null);
  const [documentFiles, setDocumentFiles] = useState([]); // [{ type: '', file: null }]

  const [showKycReveal, setShowKycReveal] = useState(false);
  const [decryptedKyc, setDecryptedKyc] = useState(null);
  const [kycLoading, setKycLoading] = useState(false);

  const [submitDisabled, setSubmitDisabled] = useState(false);

  useEffect(() => {
    if (step === 5) {
      setSubmitDisabled(true);
      const timer = setTimeout(() => setSubmitDisabled(false), 800);
      return () => clearTimeout(timer);
    }
  }, [step]);

  useEffect(() => {
    fetchListData();
    fetchMetadata();
  }, []);

  const fetchListData = async () => {
    try {
      setLoading(true);
      const url = `/employees?search=${filterSearch}&departmentId=${filterDept}&designationId=${filterDesig}&employmentType=${filterType}&onboardingStatus=${filterStatus}`;
      const data = await request(url);
      setEmployees(data);
    } catch (err) {
      setError(err.message || 'Error loading employee list.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const depts = await request('/metadata/departments');
      const desigs = await request('/metadata/designations');
      const locs = await request('/metadata/work-locations');
      const mgrs = await request('/employees/dropdown');
      setDepartments(depts);
      setDesignations(desigs);
      setLocations(locs);
      setManagers(mgrs);
    } catch (err) {
      console.error(err);
    }
  };

  // Run filter searches
  const handleFilterSearch = (e) => {
    e.preventDefault();
    fetchListData();
  };

  // Resolve PIN code via proxy
  const handlePincodeResolve = async (pin) => {
    if (pin.length !== 6) return;
    try {
      const details = await request(`/metadata/pincode/${pin}`);
      if (details && details.success) {
        setFormData(prev => ({
          ...prev,
          state: details.state || prev.state,
          district: details.district || prev.district,
          post_office: details.postOffices ? details.postOffices[0] : prev.post_office,
          country: 'India'
        }));
      }
    } catch (err) {
      console.warn('PIN Code API autocomplete failed. Allowed manual override.', err.message);
    }
  };

  // File Upload Helper
  const uploadAllFiles = async (employeeId) => {
    // 1. Upload Photo if selected
    if (photoFile) {
      const form = new FormData();
      form.append('document', photoFile);
      form.append('documentType', 'Other'); // Will save path to photo_path manually in API or handle via edit
      // For simplicity, documentType 'Other' will save to employee documents, let's update photo_path via put
      try {
        const photoForm = new FormData();
        photoForm.append('document', photoFile);
        photoForm.append('documentType', 'Other');
        await fetch(`${API_BASE_URL}/employees/${employeeId}/documents`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: photoForm
        });
      } catch (err) {
        console.error('Photo upload failed:', err);
      }
    }

    // 2. Upload KYC Docs
    for (const doc of documentFiles) {
      if (doc.file) {
        const form = new FormData();
        form.append('document', doc.file);
        form.append('documentType', doc.type);
        try {
          await fetch(`${API_BASE_URL}/employees/${employeeId}/documents`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: form
          });
        } catch (err) {
          console.error(`Document upload failed for ${doc.type}:`, err);
        }
      }
    }
  };

  const onSubmitWizard = (e) => {
    if (e) e.preventDefault();
    if (step < 5) {
      setStep(step + 1);
    } else {
      if (viewMode === 'add') {
        handleCreateEmployee(e);
      } else {
        handleUpdateEmployee(e);
      }
    }
  };

  const handleCreateEmployee = async (e) => {
    if (e) e.preventDefault();
    try {
      setError('');
      setIsSubmitting(true);
      setSubmittingText('Creating employee profile in database...');
      
      const response = await request('/employees', {
        method: 'POST',
        body: formData
      });
      
      const newId = response.employeeId;
      setSubmittingText('Uploading employee photo and document attachments...');
      await uploadAllFiles(newId);
      
      setIsSubmitting(false);
      setSubmittingText('');
      
      setViewMode('list');
      resetForm();
      fetchListData();
      
      setSuccessMessage('Employee profile and documents created successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setIsSubmitting(false);
      setSubmittingText('');
      setError(err.message || 'Failed to create employee register.');
    }
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setIsSubmitting(true);
      setSubmittingText('Saving employee profile updates...');
      
      await request(`/employees/${selectedEmpId}`, {
        method: 'PUT',
        body: formData
      });
      
      setSubmittingText('Uploading employee photo and document attachments...');
      await uploadAllFiles(selectedEmpId);
      
      setIsSubmitting(false);
      setSubmittingText('');
      
      setViewMode('list');
      resetForm();
      fetchListData();
      
      setSuccessMessage('Employee profile and documents updated successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setIsSubmitting(false);
      setSubmittingText('');
      setError(err.message || 'Failed to update employee details.');
    }
  };

  const getContractValidity = (contractTillDate) => {
    if (!contractTillDate) return { text: 'Permanent', days: null, color: '#9e9e9e' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const contractDate = new Date(contractTillDate);
    contractDate.setHours(0, 0, 0, 0);
    const diffTime = contractDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: 'Expired', days: diffDays, color: '#e53935' }; // Red
    } else if (diffDays <= 30) {
      return { text: 'Expiring <30d', days: diffDays, color: '#ff9800' }; // Orange
    } else if (diffDays <= 90) {
      return { text: 'Expires <90d', days: diffDays, color: '#2196f3' }; // Blue
    } else {
      return { text: 'Valid', days: diffDays, color: '#4caf50' }; // Green
    }
  };

  const handleInstantStatusChange = async (id, newStatus) => {
    try {
      setError('');
      await request(`/employees/${id}`, {
        method: 'PUT',
        body: { onboarding_status: newStatus }
      });
      setSuccessMessage('Onboarding status updated instantly!');
      setTimeout(() => setSuccessMessage(''), 4000);
      fetchListData();
    } catch (err) {
      setError(err.message || 'Failed to update onboarding status.');
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('Are you sure you want to soft-delete this employee? Access credentials will also be suspended.')) return;
    try {
      await request(`/employees/${id}`, { method: 'DELETE' });
      alert('Employee has been soft-deleted.');
      fetchListData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLoadProfile = async (id) => {
    try {
      setLoading(true);
      const data = await request(`/employees/${id}`);
      setProfileData(data);
      setSelectedEmpId(id);
      setViewMode('profile');
      setDecryptedKyc(null);
    } catch (err) {
      alert(err.message || 'Failed to load employee profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevealKyc = async () => {
    setKycLoading(true);
    try {
      const data = await request(`/employees/${selectedEmpId}/kyc`);
      setDecryptedKyc(data);
      setShowKycReveal(false);
    } catch (err) {
      alert(err.message || 'Error decrypting KYC data.');
    } finally {
      setKycLoading(false);
    }
  };

  // Launch Edit Mode
  const handleStartEdit = (emp) => {
    // Populate form with current values
    setFormData({
      employee_id: emp.employee_id || '',
      full_name: emp.full_name || '',
      mobile: emp.mobile || '',
      email: emp.email || '',
      department_id: emp.department_id || '',
      designation_id: emp.designation_id || '',
      current_address: emp.current_address || '',
      permanent_address: emp.permanent_address || '',
      pincode: emp.pincode || '',
      country: emp.country || 'India',
      state: emp.state || '',
      district: emp.district || '',
      post_office: emp.post_office || '',
      interviewed_hrs: emp.interviewed_hrs || '',
      interviewed_date: emp.interviewed_date ? emp.interviewed_date.split('T')[0] : '',
      appointed_date: emp.appointed_date ? emp.appointed_date.split('T')[0] : '',
      contract_till_date: emp.contract_till_date ? emp.contract_till_date.split('T')[0] : '',
      dob: emp.dob ? emp.dob.split('T')[0] : '',
      gender: emp.gender || 'Male',
      blood_group: emp.blood_group || '',
      marital_status: emp.marital_status || 'Single',
      nationality: emp.nationality || 'Indian',
      citizenship_status: emp.citizenship_status || 'Citizen',
      emergency_contact_name: emp.emergency_contact_name || '',
      emergency_contact_number: emp.emergency_contact_number || '',
      alt_mobile: emp.alt_mobile || '',
      alt_email: emp.alt_email || '',
      reporting_manager_id: emp.reporting_manager_id || '',
      work_location_id: emp.work_location_id || '',
      employment_type: emp.employment_type || 'Full-time',
      joining_salary: emp.joining_salary || '',
      probation_period_days: emp.probation_period_days || 180,
      confirmation_date: emp.confirmation_date ? emp.confirmation_date.split('T')[0] : '',
      onboarding_status: emp.onboarding_status || 'Draft',
      login_password: '',
      // KYC fields will display as masked unless unmasked
      aadhaar_number: 'XXXX XXXX XXXX',
      pan_number: 'XXXXX1234X',
      bank_account_number: 'XXXXXXX',
      bank_name: '',
      bank_ifsc: '',
      upi_id: ''
    });
    setSelectedEmpId(emp.id);
    setStep(1);
    setViewMode('edit');
  };

  const resetForm = () => {
    setFormData({
      employee_id: '', full_name: '', mobile: '', email: '',
      department_id: '', designation_id: '', current_address: '',
      permanent_address: '', pincode: '', country: 'India', state: '',
      district: '', post_office: '', interviewed_hrs: '',
      interviewed_date: '', appointed_date: '', contract_till_date: '',
      dob: '', gender: 'Male', blood_group: '', marital_status: 'Single',
      nationality: 'Indian', citizenship_status: 'Citizen',
      emergency_contact_name: '', emergency_contact_number: '',
      alt_mobile: '', alt_email: '', reporting_manager_id: '',
      work_location_id: '', employment_type: 'Full-time', joining_salary: '',
      probation_period_days: 180, confirmation_date: '', onboarding_status: 'Draft',
      login_password: '',
      aadhaar_number: '', pan_number: '', bank_account_number: '',
      bank_name: '', bank_ifsc: '', upi_id: ''
    });
    setPhotoFile(null);
    setDocumentFiles([]);
    setStep(1);
  };

  // CSV Export for register
  const handleExportCSV = () => {
    if (employees.length === 0) return alert('No data to export.');
    
    // Header keys
    const headers = ['Employee ID', 'Full Name', 'Email', 'Mobile', 'Department', 'Designation', 'Employment Type', 'Onboarding Status', 'Status'];
    const rows = employees.map(emp => [
      emp.employee_id, emp.full_name, emp.email, emp.mobile, 
      emp.department_name || '', emp.designation_name || '', 
      emp.employment_type, emp.onboarding_status, emp.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "C-Hub_Employee_List.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Profile trigger
  const handlePrint = () => {
    window.print();
  };

  if (isSubmitting) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '60vh',
        color: 'var(--text-main)',
        fontFamily: 'Poppins, sans-serif'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid var(--chub-light-lavender)',
          borderTop: '5px solid var(--chub-pink)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px'
        }} />
        <h3 style={{ color: 'var(--chub-purple)', textTransform: 'uppercase', letterSpacing: '1px' }}>Processing Register Setup</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '14px' }}>{submittingText}</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      {/* 1. LIST VIEW */}
      {viewMode === 'list' && (
        <div>
          {successMessage && (
            <div className="alert alert-info" style={{ background: 'var(--success-gradient)', color: '#FFFFFF', borderLeft: 'none', marginBottom: '20px', boxShadow: 'var(--shadow-md)' }}>
              <CheckCircle size={18} />
              <span style={{ fontWeight: 600 }}>{successMessage}</span>
            </div>
          )}
          {/* Header */}
          <div className="flex-between m-b-20">
            <div>
              <h2 style={{ fontSize: '28px', color: 'var(--chub-purple)' }}>Employee Register</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Search and administer employee profiles and onboarding states.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { resetForm(); setViewMode('add'); }} className="btn btn-primary">
                <Plus size={16} /> New Onboarding Record
              </button>
              <button onClick={handleExportCSV} className="btn btn-secondary">
                <Download size={16} /> Export Register (CSV)
              </button>
            </div>
          </div>

          {/* Branded Security Notice in List */}
          <div className="security-notice">
            <Lock className="security-notice-icon" size={18} />
            <span className="security-notice-text">
              Sensitive employee information is access-controlled and securely protected. Aadhaar, PAN, bank, and document data are masked by default and visible only to authorized roles.
            </span>
          </div>

          {/* Search Filters Card */}
          <div className="card m-b-20">
            <form onSubmit={handleFilterSearch} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1.5, minWidth: '200px' }}>
                <label className="form-label">Search Register</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Name, ID, Mobile, Email..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                  />
                  <Search size={18} style={{ position: 'absolute', right: '16px', top: '14px', color: 'var(--chub-muted)' }} />
                </div>
              </div>

              <div style={{ flex: 1, minWidth: '140px' }}>
                <label className="form-label">Department</label>
                <select className="form-control" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '140px' }}>
                <label className="form-label">Designation</label>
                <select className="form-control" value={filterDesig} onChange={(e) => setFilterDesig(e.target.value)}>
                  <option value="">All Designations</option>
                  {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '120px' }}>
                <label className="form-label">Type</label>
                <select className="form-control" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">All Employment</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Intern">Intern</option>
                  <option value="Contract">Contract</option>
                  <option value="Probation">Probation</option>
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '120px' }}>
                <label className="form-label">Onboarding</label>
                <select className="form-control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="KYC Pending">KYC Pending</option>
                  <option value="HR Review">HR Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Onboarding Completed">Onboarding Completed</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px' }}>
                Filter Results
              </button>
            </form>
          </div>

          {/* Table list */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
              <p>Loading Employees Register...</p>
            </div>
          ) : (
            <div className="table-container">
              {employees.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '55px', color: 'var(--text-muted)' }}>
                  <Users size={48} style={{ margin: '0 auto 16px auto', display: 'block' }} />
                  <p style={{ fontWeight: 600 }}>No employee matching search parameters found.</p>
                </div>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Full Name</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Contract Validity</th>
                      <th>Onboarding Status</th>
                      <th>Active Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id}>
                        <td style={{ fontWeight: 'bold', color: 'var(--chub-purple)' }}>{emp.employee_id}</td>
                        <td>
                          <div>
                            <div style={{ fontWeight: 600 }}>{emp.full_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{emp.email} | {emp.mobile}</div>
                          </div>
                        </td>
                        <td>{emp.department_name || 'Unassigned'}</td>
                        <td>{emp.designation_name || 'Unassigned'}</td>
                        <td>
                          {(() => {
                            const { text, days, color } = getContractValidity(emp.contract_till_date);
                            if (days === null) {
                              return <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Permanent</span>;
                            }
                            return (
                              <div>
                                <span className="badge" style={{ backgroundColor: color + '15', color: color, border: `1px solid ${color}30`, fontWeight: 600 }}>
                                  {text}
                                </span>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                  {days < 0 ? `${Math.abs(days)} days ago` : `${days} days left`}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td>
                          <select
                            value={emp.onboarding_status}
                            onChange={(e) => handleInstantStatusChange(emp.id, e.target.value)}
                            className="form-control"
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              height: 'auto',
                              width: 'auto',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: emp.onboarding_status === 'Onboarding Completed' || emp.onboarding_status === 'Approved'
                                ? 'rgba(76, 175, 80, 0.1)'
                                : emp.onboarding_status === 'Draft'
                                ? 'rgba(158, 158, 158, 0.1)'
                                : 'rgba(255, 152, 0, 0.1)',
                              color: emp.onboarding_status === 'Onboarding Completed' || emp.onboarding_status === 'Approved'
                                ? '#4CAF50'
                                : emp.onboarding_status === 'Draft'
                                ? '#757575'
                                : '#FF9800',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="Draft">Draft</option>
                            <option value="KYC Pending">KYC Pending</option>
                            <option value="HR Review">HR Review</option>
                            <option value="Approved">Approved</option>
                            <option value="Onboarding Completed">Onboarding Completed</option>
                          </select>
                        </td>
                        <td>
                          <span className={`badge ${emp.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                            {emp.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => handleLoadProfile(emp.id)} className="btn btn-secondary" style={{ padding: '6px 12px', border: 'none' }} title="View Profile">
                              <Eye size={16} />
                            </button>
                            <button onClick={() => handleStartEdit(emp)} className="btn btn-secondary" style={{ padding: '6px 12px', border: 'none' }} title="Edit Profile">
                              <Edit2 size={16} style={{ color: 'var(--chub-pink)' }} />
                            </button>
                            <button onClick={() => handleDeleteEmployee(emp.id)} className="btn btn-secondary" style={{ padding: '6px 12px', border: 'none' }} title="Soft Delete">
                              <Trash2 size={16} style={{ color: 'var(--color-error)' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. ADD & EDIT WIZARD (Multi-Step Form) */}
      {(viewMode === 'add' || viewMode === 'edit') && (
        <div className="card">
          <div className="flex-between m-b-20" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '20px', color: 'var(--chub-purple)' }}>
              {viewMode === 'add' ? 'Onboarding & KYC Wizard' : 'Modify Employee Record'}
            </h3>
            <button onClick={() => setViewMode('list')} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
              <ArrowLeft size={16} /> Back to List
            </button>
          </div>

          {/* Wizard Steps indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '14px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--border-color)', zIndex: 1 }} />
            {[
              { num: 1, name: 'Basic details' },
              { num: 2, name: 'Addresses' },
              { num: 3, name: 'Employment' },
              { num: 4, name: 'KYC & Bank' },
              { num: 5, name: 'Documents' }
            ].map(s => (
              <div 
                key={s.num} 
                onClick={() => setStep(s.num)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, flex: 1, cursor: 'pointer' }}
                title={`Go to Step ${s.num}: ${s.name}`}
              >
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  backgroundColor: step === s.num ? 'var(--chub-pink)' : step > s.num ? 'var(--chub-purple)' : 'var(--bg-primary)',
                  color: step >= s.num ? '#FFFFFF' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px',
                  border: '2px solid var(--border-color)', marginBottom: '6px'
                }}>
                  {step > s.num ? <Check size={14} /> : s.num}
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: step === s.num ? 'var(--chub-pink)' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>

          {error && <div className="alert alert-error"><ShieldAlert /><span>{error}</span></div>}

          {/* Steps Contents */}
          <form onSubmit={onSubmitWizard}>
            
            {/* STEP 1: BASIC DETAILS */}
            {step === 1 && (
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Employee ID *</label>
                  <input type="text" className="form-control" placeholder="e.g. CHUB-EMP-012" value={formData.employee_id} onChange={(e) => setFormData({...formData, employee_id: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input type="text" className="form-control" placeholder="Official Legal Name" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email ID *</label>
                  <input type="email" className="form-control" placeholder="name@chubworld.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile Number *</label>
                  <input type="text" className="form-control" placeholder="10-digit mobile number" value={formData.mobile} onChange={(e) => setFormData({...formData, mobile: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input type="date" className="form-control" value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-control" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <input type="text" className="form-control" placeholder="e.g. O+ve" value={formData.blood_group} onChange={(e) => setFormData({...formData, blood_group: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Marital Status</label>
                  <select className="form-control" value={formData.marital_status} onChange={(e) => setFormData({...formData, marital_status: e.target.value})}>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Nationality</label>
                  <input type="text" className="form-control" placeholder="e.g. Indian" value={formData.nationality} onChange={(e) => setFormData({...formData, nationality: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Emergency Contact Name</label>
                  <input type="text" className="form-control" placeholder="Contact Name" value={formData.emergency_contact_name} onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Emergency Contact Number</label>
                  <input type="text" className="form-control" placeholder="Contact Number" value={formData.emergency_contact_number} onChange={(e) => setFormData({...formData, emergency_contact_number: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Login Password {viewMode === 'add' ? '*' : '(Leave blank to keep current)'}</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    placeholder={viewMode === 'add' ? "Temporary login password" : "New password if changing"}
                    value={formData.login_password} 
                    onChange={(e) => setFormData({...formData, login_password: e.target.value})} 
                    required={viewMode === 'add'}
                  />
                </div>
              </div>
            )}

            {/* STEP 2: ADDRESSES */}
            {step === 2 && (
              <div>
                <div className="form-grid" style={{ marginBottom: '20px' }}>
                  <div className="form-group">
                    <label className="form-label">Indian PIN Code *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="6-digit Indian pincode" 
                      maxLength="6"
                      value={formData.pincode} 
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setFormData({...formData, pincode: val});
                        if (val.length === 6) handlePincodeResolve(val);
                      }} 
                      required 
                    />
                    <small style={{ color: 'var(--chub-pink)', display: 'block', marginTop: '4px' }}>Auto-resolves district/state/post office</small>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Post Office / Locality</label>
                    <input type="text" className="form-control" placeholder="Locality" value={formData.post_office} onChange={(e) => setFormData({...formData, post_office: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">District</label>
                    <input type="text" className="form-control" placeholder="District" value={formData.district} onChange={(e) => setFormData({...formData, district: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input type="text" className="form-control" placeholder="State" value={formData.state} onChange={(e) => setFormData({...formData, state: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Current Address</label>
                  <textarea className="form-control" rows="3" placeholder="Full residential current address" value={formData.current_address} onChange={(e) => setFormData({...formData, current_address: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Permanent Address</label>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" onChange={(e) => {
                        if (e.target.checked) setFormData({...formData, permanent_address: formData.current_address});
                      }} /> Same as current address
                    </label>
                  </div>
                  <textarea className="form-control" rows="3" placeholder="Permanent address as in Aadhaar card" value={formData.permanent_address} onChange={(e) => setFormData({...formData, permanent_address: e.target.value})} />
                </div>
              </div>
            )}

            {/* STEP 3: EMPLOYMENT DETAILS */}
            {step === 3 && (
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-control" value={formData.department_id} onChange={(e) => setFormData({...formData, department_id: e.target.value})}>
                    <option value="">Choose Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Designation</label>
                  <select className="form-control" value={formData.designation_id} onChange={(e) => setFormData({...formData, designation_id: e.target.value})}>
                    <option value="">Choose Designation</option>
                    {designations
                      .filter(d => !formData.department_id || String(d.department_id) === String(formData.department_id))
                      .map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reporting Manager</label>
                  <select className="form-control" value={formData.reporting_manager_id} onChange={(e) => setFormData({...formData, reporting_manager_id: e.target.value})}>
                    <option value="">None / Self</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.full_name} ({m.employee_id})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Work Location & Geofence (Geofence Site)</label>
                  <select className="form-control" value={formData.work_location_id} onChange={(e) => setFormData({...formData, work_location_id: e.target.value})}>
                    <option value="">Assign Location</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Employment Type</label>
                  <select className="form-control" value={formData.employment_type} onChange={(e) => setFormData({...formData, employment_type: e.target.value})}>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Intern">Intern</option>
                    <option value="Contract">Contract</option>
                    <option value="Probation">Probation</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Joining Salary (Monthly ₹ INR)</label>
                  <input type="number" className="form-control" placeholder="Salary in INR" value={formData.joining_salary} onChange={(e) => setFormData({...formData, joining_salary: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Appointed Date</label>
                  <input type="date" className="form-control" value={formData.appointed_date} onChange={(e) => setFormData({...formData, appointed_date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contract Till Date</label>
                  <input type="date" className="form-control" value={formData.contract_till_date} onChange={(e) => setFormData({...formData, contract_till_date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Probation Days</label>
                  <input type="number" className="form-control" placeholder="e.g. 180" value={formData.probation_period_days} onChange={(e) => setFormData({...formData, probation_period_days: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Interview HRs</label>
                  <input type="text" className="form-control" placeholder="Interview HR names" value={formData.interviewed_hrs} onChange={(e) => setFormData({...formData, interviewed_hrs: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Onboarding Verification Status</label>
                  <select className="form-control" value={formData.onboarding_status} onChange={(e) => setFormData({...formData, onboarding_status: e.target.value})}>
                    <option value="Draft">Draft</option>
                    <option value="KYC Pending">KYC Pending</option>
                    <option value="HR Review">HR Review</option>
                    <option value="Approved">Approved / Auto Create Account</option>
                    <option value="Onboarding Completed">Onboarding Completed</option>
                  </select>
                </div>
              </div>
            )}

            {/* STEP 4: KYC DETAILS */}
            {step === 4 && (
              <div>
                <div className="alert alert-info">
                  <Lock size={18} />
                  <span>Sensitive records are encrypted on save. Never view details without strict role authorizations.</span>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Aadhaar Number</label>
                    <input type="text" className="form-control" placeholder="12-digit Aadhaar Card number" maxLength="12" value={formData.aadhaar_number} onChange={(e) => setFormData({...formData, aadhaar_number: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAN Number</label>
                    <input type="text" className="form-control" placeholder="10-digit PAN ID" maxLength="10" value={formData.pan_number} onChange={(e) => setFormData({...formData, pan_number: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bank Name</label>
                    <input type="text" className="form-control" placeholder="e.g. ICICI Bank" value={formData.bank_name} onChange={(e) => setFormData({...formData, bank_name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bank Account Number</label>
                    <input type="text" className="form-control" placeholder="Account Number" value={formData.bank_account_number} onChange={(e) => setFormData({...formData, bank_account_number: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">IFSC Code</label>
                    <input type="text" className="form-control" placeholder="IFSC Code" value={formData.bank_ifsc} onChange={(e) => setFormData({...formData, bank_ifsc: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">UPI ID</label>
                    <input type="text" className="form-control" placeholder="e.g. name@okhdfc" value={formData.upi_id} onChange={(e) => setFormData({...formData, upi_id: e.target.value})} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: DOCUMENTS UPLOADS */}
            {step === 5 && (
              <div>
                <div className="form-group">
                  <label className="form-label">Upload Employee Photo (JPG/PNG)</label>
                  <input type="file" className="form-control" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
                </div>

                <h4 style={{ fontSize: '15px', color: 'var(--chub-purple)', margin: '20px 0 10px 0' }}>KYC File attachments (PDF/JPG/PNG under 5MB)</h4>
                
                {[
                  { code: 'Resume', name: 'Curriculum Vitae / Resume' },
                  { code: 'Offer Letter', name: 'Signed Offer Letter' },
                  { code: 'ID Proof', name: 'Aadhaar / PAN Card Copy (ID Proof)' },
                  { code: 'Bank Proof', name: 'Cancelled Cheque / Passbook (Bank Proof)' }
                ].map((docType) => {
                  const idx = documentFiles.findIndex(df => df.type === docType.code);
                  return (
                    <div key={docType.code} className="form-group" style={{ display: 'flex', gap: '16px', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, width: '220px' }}>{docType.name}</span>
                      <input 
                        type="file" 
                        className="form-control" 
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          const newDocs = [...documentFiles];
                          if (idx >= 0) {
                            newDocs[idx] = { type: docType.code, file };
                          } else {
                            newDocs.push({ type: docType.code, file });
                          }
                          setDocumentFiles(newDocs);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Wizard Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={(e) => { e.preventDefault(); setStep(step - 1); }} 
                disabled={step === 1}
              >
                <ArrowLeft size={14} /> Back
              </button>

              {step < 5 ? (
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={(e) => { e.preventDefault(); setStep(step + 1); }}
                >
                  Continue <ArrowRight size={14} />
                </button>
              ) : (
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ background: 'var(--success-gradient)' }}
                  disabled={submitDisabled}
                >
                  {submitDisabled ? 'Preparing...' : 'Submit Profiles Setup'}
                </button>
              )}
            </div>

          </form>
        </div>
      )}

      {/* 3. PROFILE VIEW (Printable & access controlled) */}
      {viewMode === 'profile' && profileData && (
        <div className="printable-profile-container">
          <div className="flex-between m-b-20 no-print" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <button onClick={() => setViewMode('list')} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
              <ArrowLeft size={16} /> Return to Register
            </button>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handlePrint} className="btn btn-secondary">
                <Printer size={16} /> Print Sheet
              </button>
              <button onClick={() => handleStartEdit(profileData.employee)} className="btn btn-primary">
                <Edit2 size={16} /> Modify Profile
              </button>
            </div>
          </div>

          {/* Profile Header Sheet */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{
                width: '120px', height: '120px', borderRadius: '16px',
                background: 'var(--chub-light-lavender)', display: 'flex',
                alignItems: 'center', justifyCenter: 'center', justifyContent: 'center',
                overflow: 'hidden', border: '3px solid var(--chub-pink)', flexShrink: 0
              }}>
                {profileData.employee.photo_path ? (
                  <a 
                    href={`${API_BASE_URL}/documents/download/${profileData.employee.photo_path.split('/').pop()}?token=${localStorage.getItem('token')}`}
                    download={`photo-${profileData.employee.employee_id}.png`}
                    title="Click to download employee photo"
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
                    <img 
                      src={`${API_BASE_URL}/documents/download/${profileData.employee.photo_path.split('/').pop()}?token=${localStorage.getItem('token')}`} 
                      alt="Photo" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                    />
                  </a>
                ) : (
                  <Users size={48} style={{ color: 'var(--chub-purple)' }} />
                )}
              </div>
              <div>
                <h3 style={{ fontSize: '26px', color: 'var(--chub-purple)', marginBottom: '4px' }}>{profileData.employee.full_name}</h3>
                <p style={{ fontWeight: 600, color: 'var(--chub-pink)', fontSize: '14px', textTransform: 'uppercase', marginBottom: '8px' }}>
                  {profileData.employee.designation_name || 'Unassigned'} • {profileData.employee.department_name || 'Unassigned'}
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span className="badge badge-onboarding">{profileData.employee.employee_id}</span>
                  <span className="badge badge-active">{profileData.employee.employment_type}</span>
                  <span className="badge badge-pending">{profileData.employee.onboarding_status}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {/* Column 1: Personal & Addresses */}
            <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div className="card">
                <h4 style={{ fontSize: '15px', color: 'var(--chub-purple)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
                  Personal Information
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                  <div className="flex-between"><strong>Gender:</strong> <span>{profileData.employee.gender || 'Not specified'}</span></div>
                  <div className="flex-between"><strong>DOB:</strong> <span>{profileData.employee.dob ? new Date(profileData.employee.dob).toLocaleDateString() : 'Not specified'}</span></div>
                  <div className="flex-between"><strong>Blood Group:</strong> <span>{profileData.employee.blood_group || 'Not specified'}</span></div>
                  <div className="flex-between"><strong>Marital Status:</strong> <span>{profileData.employee.marital_status || 'Not specified'}</span></div>
                  <div className="flex-between"><strong>Nationality:</strong> <span>{profileData.employee.nationality}</span></div>
                  <div className="flex-between"><strong>Emergency Contact:</strong> <span>{profileData.employee.emergency_contact_name} ({profileData.employee.emergency_contact_number})</span></div>
                </div>
              </div>

              <div className="card">
                <h4 style={{ fontSize: '15px', color: 'var(--chub-purple)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
                  Address Details
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                  <div><strong>Current Residence:</strong> <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{profileData.employee.current_address || 'Not specified'}</p></div>
                  <div><strong>Permanent Address:</strong> <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{profileData.employee.permanent_address || 'Not specified'}</p></div>
                  <div className="flex-between"><strong>PIN Code:</strong> <span>{profileData.employee.pincode}</span></div>
                  <div className="flex-between"><strong>District / State:</strong> <span>{profileData.employee.district}, {profileData.employee.state}</span></div>
                </div>
              </div>

            </div>

            {/* Column 2: Employment, KYC & Documents */}
            <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div className="card">
                <h4 style={{ fontSize: '15px', color: 'var(--chub-purple)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
                  Employment Details
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                  <div className="flex-between"><strong>Geofence Site:</strong> <span>{profileData.employee.work_location_name || 'Not configured'}</span></div>
                  <div className="flex-between"><strong>Reporting Manager:</strong> <span>{profileData.employee.manager_name || 'Self/None'}</span></div>
                  <div className="flex-between"><strong>Appointed Date:</strong> <span>{profileData.employee.appointed_date ? new Date(profileData.employee.appointed_date).toLocaleDateString() : 'Not specified'}</span></div>
                  <div className="flex-between"><strong>Monthly joining Salary:</strong> <span>₹ {profileData.employee.joining_salary} INR</span></div>
                  <div className="flex-between"><strong>Probation Days:</strong> <span>{profileData.employee.probation_period_days} Days</span></div>
                  <div className="flex-between"><strong>Interview HRs:</strong> <span>{profileData.employee.interviewed_hrs || 'Not logged'}</span></div>
                </div>
              </div>

              {/* Secure KYC Details Card */}
              <div className="card" style={{ border: '1px solid var(--chub-purple)' }}>
                <h4 style={{ fontSize: '15px', color: 'var(--chub-purple)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
                  Sensitive KYC Records
                </h4>
                
                {decryptedKyc ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                    <div className="flex-between"><strong>Aadhaar Number:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{decryptedKyc.aadhaar_number}</span></div>
                    <div className="flex-between"><strong>PAN Number:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{decryptedKyc.pan_number}</span></div>
                    <div className="flex-between"><strong>Bank Account:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{decryptedKyc.bank_account_number}</span></div>
                    <div className="flex-between"><strong>IFSC & Name:</strong> <span>{decryptedKyc.bank_name} ({decryptedKyc.bank_ifsc})</span></div>
                    <div className="flex-between"><strong>UPI ID:</strong> <span>{decryptedKyc.upi_id || 'Not specified'}</span></div>
                    <button onClick={() => setDecryptedKyc(null)} className="btn btn-secondary" style={{ width: '100%', marginTop: '10px' }}>
                      <Lock size={14} /> Re-Mask Details
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                    <div className="flex-between"><strong>Aadhaar Number:</strong> <span>{profileData.kyc.aadhaar}</span></div>
                    <div className="flex-between"><strong>PAN Number:</strong> <span>{profileData.kyc.pan}</span></div>
                    <div className="flex-between"><strong>Bank Account:</strong> <span>{profileData.kyc.bank_account}</span></div>
                    <button 
                      onClick={() => setShowKycReveal(true)} 
                      className="btn btn-primary" 
                      style={{ width: '100%', marginTop: '10px', background: 'var(--chub-gradient)' }}
                    >
                      <Unlock size={14} /> Reveal KYC Records
                    </button>
                  </div>
                )}
              </div>

              {/* Attachments Card */}
              <div className="card">
                <h4 style={{ fontSize: '15px', color: 'var(--chub-purple)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
                  Uploaded Documents
                </h4>
                {profileData.documents.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>No documents uploaded yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {profileData.documents.map((doc) => (
                      <div key={doc.id} className="flex-between" style={{ padding: '8px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', fontSize: '13px' }}>
                        <span style={{ fontWeight: 600 }}>{doc.document_type}</span>
                        <a 
                          href={`${API_BASE_URL}/documents/download/id-${doc.id}?token=${localStorage.getItem('token')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--chub-pink)', textDecoration: 'none' }}
                          title={`Click to view/download ${doc.document_name}`}
                        >
                          <FileText size={14} /> {doc.document_name}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* KYC REVEAL AUDIT CHECK CONFIRMATION MODAL */}
      {showKycReveal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px', textAlign: 'center' }}>
            <ShieldAlert size={48} style={{ color: 'var(--color-warning)', margin: '0 auto 16px auto', display: 'block' }} />
            <h3 style={{ marginBottom: '12px' }}>Sensitive Data Decryption</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to decrypt and view the Aadhaar, PAN, and Bank details? 
              This action will access sensitive records and is permanently recorded in the **immutable security audit logs** for compliance review.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setShowKycReveal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button 
                onClick={handleRevealKyc} 
                className="btn btn-primary" 
                style={{ background: 'var(--chub-gradient)' }}
                disabled={kycLoading}
              >
                {kycLoading ? 'Decrypting...' : 'Yes, Confirm View'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-profile-container, .printable-profile-container * {
            visibility: visible;
          }
          .printable-profile-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
