import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, toastError, clearAuthSession } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TypeableSelect } from '@/components/ui/typeable-select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  User,
  Camera,
  Trash2,
  Lock,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  MapPin,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  Upload,
} from 'lucide-react';
import { scrollToAndFocus, ERROR_INPUT_CLASS } from '@/lib/formValidation';

const SEX_OPTIONS = ['Male', 'Female'];

export default function AccountSettings() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Stored user object
  const [currentUser, setCurrentUser] = useState(() => {
    let u = JSON.parse(localStorage.getItem('user') || '{}');
    if (u && u.data && !u.role) u = u.data;
    return u;
  });

  // Profile Form state matching Setup Profile
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    contact_number: '',
    sex: '',
    birth_date: '',
    barangay: '',
    barangay_id: null,
    city_municipality: '',
    province: '',
    region: '',
  });

  const [profileErrors, setProfileErrors] = useState({});
  const [barangays, setBarangays] = useState([]);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});

  // Delete account modal state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Initial load
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, barangayRes] = await Promise.all([
          api.get('/profile').catch(() => ({ data: {} })),
          api.get('/public/barangays').catch(() => ({ data: [] })),
        ]);

        const p = profileRes.data?.data || profileRes.data || {};
        const bList = (barangayRes.data || []).filter(b => b.is_active !== false);
        setBarangays(bList);

        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const userObj = storedUser.data && !storedUser.role ? storedUser.data : storedUser;

        setProfileForm({
          first_name: p.first_name || userObj.first_name || '',
          middle_name: p.middle_name || userObj.middle_name || '',
          last_name: p.last_name || userObj.last_name || '',
          email: p.email || userObj.email || '',
          contact_number: p.contact_number || p.phone_number || userObj.phone_number || '',
          sex: p.sex || '',
          birth_date: p.birth_date ? p.birth_date.split('T')[0] : '',
          barangay: p.barangay || '',
          barangay_id: p.barangay_id || null,
          city_municipality: p.city_municipality || 'Butuan City',
          province: p.province || 'Agusan del Norte',
          region: p.region || 'Region XIII (Caraga)',
        });

        if (p.picture || userObj.picture) {
          setCurrentUser(prev => ({
            ...prev,
            picture: p.picture || userObj.picture,
            auth_provider: p.auth_provider || userObj.auth_provider,
          }));
        }
      } catch (err) {
        toastError(err, 'Failed to load profile data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const updateStoredUser = (updates) => {
    let stored = JSON.parse(localStorage.getItem('user') || '{}');
    if (stored.data && !stored.role) {
      stored.data = { ...stored.data, ...updates };
    } else {
      stored = { ...stored, ...updates };
    }
    localStorage.setItem('user', JSON.stringify(stored));
    setCurrentUser(prev => ({ ...prev, ...updates }));
    window.dispatchEvent(new Event('user-updated'));
  };

  // Avatar upload handler
  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting same file triggers onChange
    e.target.value = '';

    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast.error('Invalid file format. Please upload a JPG, PNG, or WEBP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size exceeds 5MB limit. Please choose a smaller image.');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setUploadingAvatar(true);
    try {
      const res = await api.post('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newPictureUrl = res.data?.picture || res.data?.user?.picture;
      updateStoredUser({ picture: newPictureUrl });
      toast.success('Profile picture updated successfully!');
    } catch (err) {
      toastError(err, 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Avatar delete handler
  const handleRemoveAvatar = async () => {
    if (!currentUser?.picture) return;

    setRemovingAvatar(true);
    try {
      await api.delete('/profile/avatar');
      updateStoredUser({ picture: null });
      toast.success('Profile picture removed.');
    } catch (err) {
      toastError(err, 'Failed to remove profile picture.');
    } finally {
      setRemovingAvatar(false);
    }
  };

  // Profile form input setter
  const setField = (key, value) => {
    setProfileForm(prev => ({ ...prev, [key]: value }));
    setProfileErrors(prev => ({ ...prev, [key]: undefined }));
  };

  // Validate profile information
  const validateProfile = () => {
    const errs = {};
    if (!profileForm.first_name?.trim()) errs.first_name = 'First name is required.';
    if (!profileForm.last_name?.trim()) errs.last_name = 'Last name is required.';
    if (!profileForm.contact_number?.trim()) errs.contact_number = 'Contact number is required.';
    if (!profileForm.sex) errs.sex = 'Please select your sex.';
    if (!profileForm.birth_date) errs.birth_date = 'Birth date is required.';
    if (!profileForm.barangay?.trim()) errs.barangay = 'Barangay is required.';
    if (!profileForm.city_municipality?.trim()) errs.city_municipality = 'City/Municipality is required.';
    if (profileForm.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    setProfileErrors(errs);
    return errs;
  };

  // Save profile information
  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    const errs = validateProfile();
    const errorKeys = Object.keys(errs);
    if (errorKeys.length > 0) {
      toast.error('Please complete all required fields highlighted in red.');
      scrollToAndFocus(errorKeys[0]);
      return;
    }

    setSavingProfile(true);
    try {
      await api.put('/profile', profileForm);

      const updatedFullName = [profileForm.first_name, profileForm.middle_name, profileForm.last_name]
        .filter(Boolean)
        .join(' ');

      updateStoredUser({
        full_name: updatedFullName,
        first_name: profileForm.first_name,
        middle_name: profileForm.middle_name,
        last_name: profileForm.last_name,
        email: profileForm.email || currentUser?.email,
        phone_number: profileForm.contact_number,
      });

      toast.success('Profile information saved successfully!');
    } catch (err) {
      toastError(err, 'Failed to save profile information.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Change password handler
  const handleChangePassword = async (e) => {
    e?.preventDefault();
    const errs = {};
    const isLocal = currentUser?.auth_provider === 'local';

    if (isLocal && !currentPassword) {
      errs.current_password = 'Current password is required.';
    }
    if (!newPassword) {
      errs.new_password = 'New password is required.';
    } else if (newPassword.length < 8) {
      errs.new_password = 'Password must be at least 8 characters.';
    }
    if (newPassword !== confirmPassword) {
      errs.confirm_password = 'Passwords do not match.';
    }

    setPasswordErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setChangingPassword(true);
    try {
      await api.put('/profile/password', {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });

      toast.success('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordErrors({});
    } catch (err) {
      toastError(err, 'Failed to update password.');
    } finally {
      setChangingPassword(false);
    }
  };

  // Delete account handler
  const handleDeleteAccount = async () => {
    const isLocal = currentUser?.auth_provider === 'local';

    if (isLocal && !deletePassword) {
      setDeleteError('Please enter your password to confirm deletion.');
      return;
    }

    if (!isLocal && deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm.');
      return;
    }

    setDeletingAccount(true);
    setDeleteError('');
    try {
      await api.delete('/account', {
        data: {
          password: deletePassword,
        },
      });

      clearAuthSession();
      toast.success('Your account has been deleted permanently.');
      window.location.href = '/';
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.password?.[0] || 'Failed to delete account.';
      setDeleteError(msg);
      toast.error(msg);
    } finally {
      setDeletingAccount(false);
    }
  };

  const initials = (currentUser?.full_name || profileForm.first_name || 'SP')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading account settings...</p>
      </div>
    );
  }

  const isOAuthUser = currentUser?.auth_provider === 'google';

  return (
    <div className="container max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-12 space-y-6 sm:space-y-8 w-full max-w-full overflow-x-hidden min-w-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Account Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm md:text-base">
          Manage your personal details, profile picture, security credentials, and account preferences.
        </p>
      </div>

      {/* 1. Profile Picture Card */}
      <Card className="border shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg font-bold">Profile Picture</CardTitle>
              <CardDescription>Upload a clear personal photo to customize your account avatar.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar Preview */}
            <div className="relative group shrink-0">
              <Avatar className="h-28 w-28 rounded-full border-4 border-primary/20 shadow-md">
                {currentUser?.picture && (
                  <AvatarImage
                    src={currentUser.picture}
                    alt={currentUser?.full_name || 'Profile Picture'}
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:pointer-events-none"
                title="Click to change photo"
              >
                <Camera className="h-6 w-6 mb-1" />
                <span className="text-[11px] font-medium">Change</span>
              </button>
            </div>

            {/* Actions & Instructions */}
            <div className="flex-1 text-center sm:text-left space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                className="hidden"
                onChange={handleAvatarFileSelect}
              />

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar || removingAvatar}
                  className="gap-2 rounded-xl"
                  size="sm"
                >
                  {uploadingAvatar ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" /> Upload New Photo
                    </>
                  )}
                </Button>

                {currentUser?.picture && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar || removingAvatar}
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                    size="sm"
                  >
                    {removingAvatar ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Removing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" /> Remove Photo
                      </>
                    )}
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Supported formats: <strong>JPG, PNG, or WEBP</strong> up to <strong>5MB</strong>.
                Square aspect ratio recommended for best display on mobile and navbar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Basic Information Card (matches setup profile) */}
      <Card className="border shadow-sm rounded-2xl">
        <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg font-bold">Personal Profile Information</CardTitle>
              <CardDescription>
                These details are synced with your initial setup profile and official solo parent application.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Name Row: First, Middle, Last */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="first_name" className={`text-sm font-semibold text-foreground ${profileErrors.first_name ? 'text-destructive' : ''}`}>
                First Name <span className="text-destructive font-bold">*</span>
              </Label>
              <Input
                id="first_name"
                value={profileForm.first_name}
                onChange={e => setField('first_name', e.target.value)}
                placeholder="Enter first name"
                className={profileErrors.first_name ? ERROR_INPUT_CLASS : ''}
              />
              {profileErrors.first_name && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{profileErrors.first_name}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="middle_name" className="text-sm font-semibold text-foreground">
                Middle Name
              </Label>
              <Input
                id="middle_name"
                value={profileForm.middle_name}
                onChange={e => setField('middle_name', e.target.value)}
                placeholder="Enter middle name (optional)"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="last_name" className={`text-sm font-semibold text-foreground ${profileErrors.last_name ? 'text-destructive' : ''}`}>
                Last Name <span className="text-destructive font-bold">*</span>
              </Label>
              <Input
                id="last_name"
                value={profileForm.last_name}
                onChange={e => setField('last_name', e.target.value)}
                placeholder="Enter last name"
                className={profileErrors.last_name ? ERROR_INPUT_CLASS : ''}
              />
              {profileErrors.last_name && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{profileErrors.last_name}
                </p>
              )}
            </div>
          </div>

          {/* Contact & Email Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="contact_number" className={`text-sm font-semibold text-foreground ${profileErrors.contact_number ? 'text-destructive' : ''}`}>
                Contact Number <span className="text-destructive font-bold">*</span>
              </Label>
              <Input
                id="contact_number"
                type="tel"
                inputMode="tel"
                value={profileForm.contact_number}
                onChange={e => setField('contact_number', e.target.value)}
                placeholder="09171234567 or +639171234567"
                className={profileErrors.contact_number ? ERROR_INPUT_CLASS : ''}
              />
              {profileErrors.contact_number ? (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{profileErrors.contact_number}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Mobile number for SMS alerts and account recovery.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="email" className={`text-sm font-semibold text-foreground ${profileErrors.email ? 'text-destructive' : ''}`}>
                  Email Address
                </Label>
                {isOAuthUser ? (
                  <span className="text-xs text-primary font-medium">Google Linked</span>
                ) : (
                  <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                )}
              </div>
              <Input
                id="email"
                type="email"
                value={profileForm.email || ''}
                onChange={e => setField('email', e.target.value)}
                placeholder="name@example.com"
                readOnly={isOAuthUser}
                disabled={isOAuthUser}
                className={isOAuthUser ? 'bg-muted/30 text-muted-foreground cursor-not-allowed' : profileErrors.email ? ERROR_INPUT_CLASS : ''}
              />
              {profileErrors.email ? (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{profileErrors.email}
                </p>
              ) : isOAuthUser ? (
                <p className="text-xs text-muted-foreground">Managed via Google Sign-In.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Used for official status notifications.</p>
              )}
            </div>
          </div>

          {/* Sex & Date of Birth Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sex" className={`text-sm font-semibold text-foreground ${profileErrors.sex ? 'text-destructive' : ''}`}>
                Sex <span className="text-destructive font-bold">*</span>
              </Label>
              <TypeableSelect
                id="sex"
                value={profileForm.sex}
                onChange={v => setField('sex', v)}
                options={SEX_OPTIONS}
                placeholder="Select or type sex"
                error={Boolean(profileErrors.sex)}
              />
              {profileErrors.sex && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{profileErrors.sex}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="birth_date" className={`text-sm font-semibold text-foreground ${profileErrors.birth_date ? 'text-destructive' : ''}`}>
                Date of Birth <span className="text-destructive font-bold">*</span>
              </Label>
              <Input
                id="birth_date"
                type="date"
                value={profileForm.birth_date}
                onChange={e => setField('birth_date', e.target.value)}
                className={profileErrors.birth_date ? ERROR_INPUT_CLASS : ''}
              />
              {profileErrors.birth_date && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{profileErrors.birth_date}
                </p>
              )}
            </div>
          </div>

          {/* Barangay & City/Municipality Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="barangay" className={`text-sm font-semibold text-foreground flex items-center gap-1 ${profileErrors.barangay ? 'text-destructive' : ''}`}>
                <MapPin className="h-3.5 w-3.5 text-primary" /> Barangay <span className="text-destructive font-bold">*</span>
              </Label>
              <TypeableSelect
                id="barangay"
                value={profileForm.barangay}
                onChange={(val, opt) => {
                  setField('barangay', val);
                  if (opt?.id) setField('barangay_id', opt.id);
                }}
                options={barangays.map(b => ({ value: b.name, label: b.name, id: b.id }))}
                placeholder="Select or type barangay (e.g. Baan KM 3)"
                icon={MapPin}
                error={Boolean(profileErrors.barangay)}
              />
              {profileErrors.barangay && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{profileErrors.barangay}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="city_municipality" className={`text-sm font-semibold text-foreground ${profileErrors.city_municipality ? 'text-destructive' : ''}`}>
                City / Municipality <span className="text-destructive font-bold">*</span>
              </Label>
              <Input
                id="city_municipality"
                value={profileForm.city_municipality}
                onChange={e => setField('city_municipality', e.target.value)}
                placeholder="City or Municipality"
                className={profileErrors.city_municipality ? ERROR_INPUT_CLASS : ''}
              />
              {profileErrors.city_municipality && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{profileErrors.city_municipality}
                </p>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="gap-2 px-6 rounded-xl font-semibold w-full sm:w-auto min-h-[44px] justify-center"
            >
              {savingProfile ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Saving Changes...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" /> Save Profile Details
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Security / Change Password Card */}
      <Card className="border shadow-sm rounded-2xl">
        <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg font-bold">Security & Password</CardTitle>
              <CardDescription>
                {isOAuthUser
                  ? 'Your account is authenticated via Google Single Sign-On.'
                  : 'Manage your password to ensure your account remains secure.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isOAuthUser ? (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/40 border text-sm text-muted-foreground">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Google Single Sign-On Active</p>
                <p className="mt-1">
                  You sign in with your Google account. Security credentials and two-factor authentication
                  are managed directly through your Google Account settings.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <Label htmlFor="current_password" className={passwordErrors.current_password ? 'text-destructive' : ''}>
                  Current Password <span className="text-destructive font-bold">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="current_password"
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => {
                      setCurrentPassword(e.target.value);
                      setPasswordErrors(prev => ({ ...prev, current_password: undefined }));
                    }}
                    placeholder="Enter current password"
                    className={`pr-10 ${passwordErrors.current_password ? ERROR_INPUT_CLASS : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 min-w-[40px] flex items-center justify-center text-muted-foreground hover:text-foreground touch-manipulation"
                    aria-label="Toggle current password visibility"
                  >
                    {showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.current_password && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />{passwordErrors.current_password}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new_password" className={passwordErrors.new_password ? 'text-destructive' : ''}>
                  New Password <span className="text-destructive font-bold">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => {
                      setNewPassword(e.target.value);
                      setPasswordErrors(prev => ({ ...prev, new_password: undefined }));
                    }}
                    placeholder="At least 8 characters"
                    className={`pr-10 ${passwordErrors.new_password ? ERROR_INPUT_CLASS : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 min-w-[40px] flex items-center justify-center text-muted-foreground hover:text-foreground touch-manipulation"
                    aria-label="Toggle new password visibility"
                  >
                    {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.new_password && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />{passwordErrors.new_password}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm_password" className={passwordErrors.confirm_password ? 'text-destructive' : ''}>
                  Confirm New Password <span className="text-destructive font-bold">*</span>
                </Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    setPasswordErrors(prev => ({ ...prev, confirm_password: undefined }));
                  }}
                  placeholder="Re-enter new password"
                  className={passwordErrors.confirm_password ? ERROR_INPUT_CLASS : ''}
                />
                {passwordErrors.confirm_password && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />{passwordErrors.confirm_password}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={changingPassword}
                  className="gap-2 rounded-xl w-full sm:w-auto min-h-[44px] justify-center"
                >
                  {changingPassword ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Updating...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> Update Password
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* 4. Danger Zone (Delete Account) */}
      <Card className="border border-destructive/40 bg-destructive/[0.02] shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-destructive/20 bg-destructive/10">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg font-bold text-destructive">Danger Zone</CardTitle>
              <CardDescription className="text-destructive/80">
                Permanently delete your account and associated records.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-foreground text-sm">Delete this Account</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                Once you delete your account, your profile data, uploaded documents, solo parent ID application,
                and notification history will be permanently deleted. This action cannot be reversed.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDeleteError('');
                setDeletePassword('');
                setDeleteConfirmText('');
                setDeleteDialogOpen(true);
              }}
              className="gap-2 rounded-xl shrink-0"
              size="sm"
            >
              <Trash2 className="h-4 w-4" /> Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Confirmation Modal */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-bold">Delete Account Permanently?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground">
                  This action is irreversible. All your submitted documents and records will be deleted.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="py-3 space-y-3">
            {!isOAuthUser ? (
              <div className="space-y-1.5">
                <Label htmlFor="delete_password" className="text-xs font-semibold text-foreground">
                  Please confirm your password to proceed:
                </Label>
                <Input
                  id="delete_password"
                  type="password"
                  value={deletePassword}
                  onChange={e => {
                    setDeletePassword(e.target.value);
                    setDeleteError('');
                  }}
                  placeholder="Enter your account password"
                  className={deleteError ? ERROR_INPUT_CLASS : ''}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="delete_confirm_text" className="text-xs font-semibold text-foreground">
                  Type <span className="font-bold text-destructive">DELETE</span> to confirm:
                </Label>
                <Input
                  id="delete_confirm_text"
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => {
                    setDeleteConfirmText(e.target.value);
                    setDeleteError('');
                  }}
                  placeholder="Type DELETE"
                  className={deleteError ? ERROR_INPUT_CLASS : ''}
                />
              </div>
            )}

            {deleteError && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{deleteError}
              </p>
            )}
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deletingAccount}
              className="rounded-xl"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="gap-2 rounded-xl"
            >
              {deletingAccount ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Deleting...
                </>
              ) : (
                'Permanently Delete'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
