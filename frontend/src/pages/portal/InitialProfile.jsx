import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TypeableSelect } from '@/components/ui/typeable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  User, RefreshCw, CheckCircle, MapPin, AlertCircle,
} from 'lucide-react';
import { scrollToAndFocus, ERROR_INPUT_CLASS } from '@/lib/formValidation';

const SEX_OPTIONS = ['Male', 'Female'];

export default function InitialProfile() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [form, setForm] = useState({
    first_name: user.first_name || '',
    middle_name: user.middle_name || '',
    last_name: user.last_name || '',
    email: user.email || '',
    contact_number: user.phone_number || '',
    sex: '',
    birth_date: '',
    barangay: '',
    barangay_id: null,
    city_municipality: '',
    province: '',
    region: '',
  });

  // Barangay list
  const [barangays, setBarangays] = useState([]);

  useEffect(() => {
    const init = async () => {
      try {
        // Check if initial profile is already complete
        try {
          const profileRes = await api.get('/profile');
          if (profileRes.data?.data) {
            if (profileRes.data.data.setup_completed || profileRes.data.data.is_profile_complete) {
              navigate('/portal/dashboard', { replace: true });
              return;
            }
          }
          const p = profileRes.data?.data || profileRes.data;
          if (p) {
            setForm(prev => ({
              ...prev,
              first_name: p.first_name || prev.first_name || '',
              middle_name: p.middle_name || prev.middle_name || '',
              last_name: p.last_name || prev.last_name || '',
              email: p.email || prev.email || '',
              contact_number: p.contact_number || p.phone_number || prev.contact_number || '',
              sex: p.sex || prev.sex || '',
              birth_date: p.birth_date || prev.birth_date || '',
              barangay: p.barangay || prev.barangay || '',
              barangay_id: p.barangay_id || prev.barangay_id || null,
              city_municipality: p.city_municipality || prev.city_municipality || '',
              province: p.province || prev.province || '',
              region: p.region || prev.region || '',
            }));
          }
        } catch {
          // No profile yet — that's fine
        }

        // Load barangay list
        try {
          const bRes = await api.get('/public/barangays');
          setBarangays((bRes.data || []).filter(b => b.is_active !== false));
        } catch { /* non-fatal */ }
      } catch (err) {
        toastError(err, 'Failed to check profile status.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const errs = {};
    if (!form.first_name?.trim()) errs.first_name = 'First name is required.';
    if (!form.last_name?.trim()) errs.last_name = 'Last name is required.';
    if (!form.contact_number?.trim()) errs.contact_number = 'Contact number is required.';
    if (!form.sex) errs.sex = 'Please select your sex.';
    if (!form.birth_date) errs.birth_date = 'Birth date is required.';
    if (!form.barangay?.trim()) errs.barangay = 'Barangay is required.';
    if (!form.city_municipality?.trim()) errs.city_municipality = 'City/Municipality is required.';
    if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    setErrors(errs);
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    const errorKeys = Object.keys(errs);
    if (errorKeys.length > 0) {
      toast.error('Please complete all required fields highlighted in red.');
      scrollToAndFocus(errorKeys[0]);
      return;
    }
    setSaving(true);
    try {
      await api.put('/profile', form);
      
      // Update localStorage user name and profile fields
      const updatedName = [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' ');
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      storedUser.full_name = updatedName;
      storedUser.first_name = form.first_name;
      storedUser.middle_name = form.middle_name;
      storedUser.last_name = form.last_name;
      if (form.email && !storedUser.email) {
        storedUser.email = form.email;
      }
      storedUser.is_profile_complete = true;
      storedUser.setup_completed = true;
      sessionStorage.setItem('initial_profile_complete', 'true');
      localStorage.setItem('user', JSON.stringify(storedUser));
      window.dispatchEvent(new Event('user-updated'));

      toast.success("Profile setup complete! Welcome to your dashboard.");
      setTimeout(() => navigate('/portal/dashboard', { replace: true }), 600);
    } catch (err) {
      toastError(err, 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 container max-w-xl mx-auto px-3 sm:px-6 py-6 sm:py-14 w-full max-w-full overflow-x-hidden min-w-0">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <User className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">Set Up Your Profile</h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
          Please provide your basic information to get started. This is <strong>not</strong> the Solo Parent ID application — 
          it's just a quick profile setup to identify you in the system.
        </p>
      </div>

      <Card className="border shadow-sm rounded-2xl">
        <CardHeader className="pb-4 border-b border-border/40">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <User className="h-5 w-5 text-primary" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          {/* Name row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="first_name" className={`text-sm font-semibold text-foreground ${errors.first_name ? 'text-destructive' : ''}`}>
                First Name <span className="text-destructive font-bold">*</span>
              </Label>
              <Input
                id="first_name"
                value={form.first_name}
                onChange={e => set('first_name', e.target.value)}
                placeholder="Enter first name"
                className={errors.first_name ? ERROR_INPUT_CLASS : ''}
              />
              {errors.first_name && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.first_name}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="middle_name" className="text-sm font-semibold text-foreground">Middle Name</Label>
              <Input
                id="middle_name"
                value={form.middle_name}
                onChange={e => set('middle_name', e.target.value)}
                placeholder="Enter middle name (optional)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name" className={`text-sm font-semibold text-foreground ${errors.last_name ? 'text-destructive' : ''}`}>
                Last Name <span className="text-destructive font-bold">*</span>
              </Label>
              <Input
                id="last_name"
                value={form.last_name}
                onChange={e => set('last_name', e.target.value)}
                placeholder="Enter last name"
                className={errors.last_name ? ERROR_INPUT_CLASS : ''}
              />
              {errors.last_name && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.last_name}
                </p>
              )}
            </div>
          </div>

          {/* Email Address */}
          {user.email ? (
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-foreground">Email Address</Label>
              <Input
                value={user.email}
                readOnly
                disabled
                className="bg-muted/30 text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">Linked to your authenticated account</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="email" className={`text-sm font-semibold text-foreground ${errors.email ? 'text-destructive' : ''}`}>
                  Email Address
                </Label>
                <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
              </div>
              <Input
                id="email"
                type="email"
                value={form.email || ''}
                onChange={e => set('email', e.target.value)}
                placeholder="Enter email address (optional)"
                className={errors.email ? ERROR_INPUT_CLASS : ''}
              />
              {errors.email ? (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.email}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Optional — you may provide an email address if you wish</p>
              )}
            </div>
          )}

          {/* Contact + Sex row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="contact_number" className={`text-sm font-semibold text-foreground ${errors.contact_number ? 'text-destructive' : ''}`}>
                Contact Number <span className="text-destructive font-bold">*</span>
              </Label>
              <Input
                id="contact_number"
                value={form.contact_number}
                onChange={e => set('contact_number', e.target.value)}
                placeholder="Enter contact number"
                className={errors.contact_number ? ERROR_INPUT_CLASS : ''}
              />
              {errors.contact_number && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.contact_number}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sex" className={`text-sm font-semibold text-foreground ${errors.sex ? 'text-destructive' : ''}`}>
                Sex <span className="text-destructive font-bold">*</span>
              </Label>
              <TypeableSelect
                id="sex"
                value={form.sex}
                onChange={v => set('sex', v)}
                options={SEX_OPTIONS}
                placeholder="Select or type sex"
                error={Boolean(errors.sex)}
              />
              {errors.sex && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.sex}
                </p>
              )}
            </div>
          </div>

          {/* Birth date */}
          <div className="space-y-1.5">
            <Label htmlFor="birth_date" className={`text-sm font-semibold text-foreground ${errors.birth_date ? 'text-destructive' : ''}`}>
              Date of Birth <span className="text-destructive font-bold">*</span>
            </Label>
            <Input
              id="birth_date"
              type="date"
              value={form.birth_date}
              onChange={e => set('birth_date', e.target.value)}
              className={errors.birth_date ? ERROR_INPUT_CLASS : ''}
            />
            {errors.birth_date && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.birth_date}
              </p>
            )}
          </div>

          {/* Barangay (typeable dropdown) */}
          <div className="space-y-1.5">
            <Label htmlFor="barangay" className={`text-sm font-semibold text-foreground flex items-center gap-1 ${errors.barangay ? 'text-destructive' : ''}`}>
              <MapPin className="h-3.5 w-3.5" /> Barangay <span className="text-destructive font-bold">*</span>
            </Label>
            <TypeableSelect
              id="barangay"
              value={form.barangay}
              onChange={(val, opt) => {
                set('barangay', val);
                if (opt?.id) {
                  set('barangay_id', opt.id);
                }
              }}
              options={barangays.map(b => ({ value: b.name, label: b.name, id: b.id }))}
              placeholder="Select or type barangay (e.g. Baan KM 3)"
              icon={MapPin}
              error={Boolean(errors.barangay)}
            />
            {errors.barangay && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.barangay}
              </p>
            )}
          </div>

          {/* City/Municipality */}
          <div className="space-y-1.5">
            <Label htmlFor="city_municipality" className={`text-sm font-semibold text-foreground ${errors.city_municipality ? 'text-destructive' : ''}`}>
              City / Municipality <span className="text-destructive font-bold">*</span>
            </Label>
            <Input
              id="city_municipality"
              value={form.city_municipality}
              onChange={e => set('city_municipality', e.target.value)}
              placeholder="Enter city / municipality (e.g. Butuan City)"
              className={errors.city_municipality ? ERROR_INPUT_CLASS : ''}
            />
            {errors.city_municipality && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.city_municipality}
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="pt-4">
            <Button onClick={handleSubmit} disabled={saving} className="w-full h-11 text-sm font-semibold gap-2">
              {saving ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><CheckCircle className="h-4 w-4" /> Complete Profile & Continue</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-3">
              You can update this information later from your application settings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
