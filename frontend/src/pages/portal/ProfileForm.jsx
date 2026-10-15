import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TypeableSelect } from '@/components/ui/typeable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  User, Users, FileText, Heart, Phone,
  Save, RefreshCw, Plus, Trash2, Check, Info,
  CheckCircle, AlertCircle, ChevronRight, MapPin, Send, ArrowLeft,
} from 'lucide-react';
import { scrollToAndFocus, ERROR_INPUT_CLASS, ERROR_SELECT_CLASS } from '@/lib/formValidation';

/* ─────────── Constants ─────────────────────────────────────── */
const REGIONS = [
  'Region I', 'Region II', 'Region III', 'Region IV-A', 'Region IV-B', 'Region V',
  'Region VI', 'Region VII', 'Region VIII', 'Region IX', 'Region X', 'Region XI',
  'Region XII', 'Region XIII', 'NCR', 'CAR', 'BARMM',
];
const CIVIL_STATUSES       = ['Single','Married','Widowed','Legally Separated','Annulled','Divorced','Common-law'];
const EMPLOYMENT_STATUSES  = ['Employed','Self-employed','Not employed'];
const SEX_OPTIONS          = ['Male','Female'];
const EDUCATIONAL_ATTAINMENTS = [
  'No formal education','Elementary level','Elementary graduate',
  'High school level','High school graduate','Vocational/Technical',
  'College level','College graduate','Post-graduate',
];

/* ─────────── Sections definition ───────────────────────────── */
const SECTIONS = [
  { key: 'personal',    label: 'Personal Information', shortLabel: 'Personal',   icon: User },
  { key: 'household',   label: 'Household Composition', shortLabel: 'Household',  icon: Users },
  { key: 'solo_parent', label: 'Solo Parent Category',  shortLabel: 'Category',   icon: FileText },
  { key: 'needs',       label: 'Needs & Problems',      shortLabel: 'Needs',      icon: Heart },
  { key: 'emergency',   label: 'Emergency Contact',     shortLabel: 'Emergency',  icon: Phone },
];

/* ─────────── Per-section required field validators ─────────── */
function getSectionFieldErrors(key, profile) {
  const errors = {};
  switch (key) {
    case 'personal':
      if (!profile.first_name?.trim())        errors.first_name = 'First name is required.';
      if (!profile.last_name?.trim())         errors.last_name = 'Last name is required.';
      if (!profile.birth_date)                errors.birth_date = 'Date of birth is required.';
      if (!profile.sex)                       errors.sex = 'Please select your sex.';
      if (!profile.civil_status)              errors.civil_status = 'Please select your civil status.';
      if (!profile.barangay?.trim())          errors.barangay = 'Barangay is required.';
      if (!profile.city_municipality?.trim()) errors.city_municipality = 'City/Municipality is required.';
      if (!profile.contact_number?.trim())    errors.contact_number = 'Contact number is required.';
      break;
    case 'household':
      if (Array.isArray(profile.household_members) && profile.household_members.length > 0) {
        profile.household_members.forEach((m, idx) => {
          if (!m.name?.trim()) {
            errors[`member_name_${idx}`] = 'Full name is required for this household member.';
          }
        });
      }
      break;
    case 'solo_parent':
      if (!profile.solo_parent_category) errors.solo_parent_category = 'Please select your Solo Parent category.';
      if (!profile.solo_parent_since)    errors.solo_parent_since = 'Please indicate when you became a solo parent.';
      break;
    case 'needs':
      if (!profile.needs_problems?.trim()) errors.needs_problems = 'Please describe your needs and problems as a solo parent.';
      break;
    case 'emergency':
      if (!profile.emergency_contact_name?.trim())   errors.emergency_contact_name = 'Emergency contact name is required.';
      if (!profile.emergency_contact_number?.trim()) errors.emergency_contact_number = 'Emergency contact number is required.';
      break;
  }
  return errors;
}

function validateSection(key, profile) {
  const errs = getSectionFieldErrors(key, profile);
  return Object.keys(errs).length === 0;
}

function getSectionValidationErrors(key, profile) {
  return Object.values(getSectionFieldErrors(key, profile));
}

/* ─────────── Helpers ────────────────────────────────────────── */
function calcAge(birthDate) {
  if (!birthDate) return '';
  const today = new Date();
  const dob   = new Date(birthDate);
  if (isNaN(dob)) return '';
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? String(age) : '';
}

/* ─────────── Shared UI atoms ────────────────────────────────── */
function FieldWrapper({ label, required, span, children, hint, error, id }) {
  const isElement = React.isValidElement(children);
  const enhancedChild = isElement
    ? React.cloneElement(children, {
        id: children.props.id || id,
        className: error
          ? `${children.props.className || ''} ${ERROR_INPUT_CLASS}`.trim()
          : children.props.className,
        'aria-invalid': error ? 'true' : undefined,
      })
    : children;

  return (
    <div id={id ? `field-container-${id}` : undefined} className={`space-y-1.5 ${span === 'full' ? 'sm:col-span-2' : ''}`}>
      <Label htmlFor={id} className={`text-sm font-semibold text-foreground ${error ? 'text-destructive' : ''}`}>
        {label}{required && <span className="text-destructive ml-0.5 font-bold">*</span>}
      </Label>
      {enhancedChild}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-destructive font-medium flex items-center gap-1.5 mt-1 animate-in fade-in duration-200">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

function ToggleField({ label, value, onChange, hint }) {
  return (
    <div
      onClick={() => onChange(!value)}
      className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/30 cursor-pointer touch-manipulation hover:bg-muted/50 transition-colors"
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange(!value); }}
        className={`mt-0.5 h-6 w-11 shrink-0 rounded-full border-2 transition-colors relative cursor-pointer ${value ? 'bg-primary border-primary' : 'bg-muted border-border'}`}
        aria-checked={value}
        role="switch"
      >
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      <div className="flex-1 min-w-0 select-none">
        <p className="text-sm font-semibold leading-tight text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

/* ─────────── Section Tab Navigation ────────────────────────── */
function SectionTabs({ activeKey, profile, onNavigate }) {
  return (
    <div className="flex flex-col gap-1">
      {SECTIONS.map((sec, idx) => {
        const isComplete = validateSection(sec.key, profile);
        const isActive   = sec.key === activeKey;
        const Icon       = sec.icon;
        return (
          <button
            key={sec.key}
            onClick={() => onNavigate(sec.key)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group w-full ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                : 'hover:bg-muted/70 text-foreground'
            }`}
          >
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
              isActive ? 'bg-white/20' : 'bg-muted'
            }`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight truncate">
                {sec.label}
              </p>
              <p className={`text-xs mt-0.5 font-medium ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                {isComplete ? 'Completed' : 'Incomplete'}
              </p>
            </div>
            <div className="shrink-0">
              {isComplete
                ? <CheckCircle className={`h-4 w-4 ${isActive ? 'text-white' : 'text-success'}`} />
                : <div className={`h-4 w-4 rounded-full border-2 ${isActive ? 'border-white/50' : 'border-warning/30'}`} />
              }
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────── Mobile horizontal tab strip ────────────────────── */
function MobileTabs({ activeKey, profile, onNavigate }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const activeBtn = containerRef.current.querySelector('[data-active="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeKey]);

  return (
    <div className="w-full max-w-full overflow-hidden min-w-0">
      <div ref={containerRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory px-0.5 w-full max-w-full min-w-0">
        {SECTIONS.map((sec, idx) => {
          const isComplete = validateSection(sec.key, profile);
          const isActive   = sec.key === activeKey;
          const Icon       = sec.icon;
          return (
            <button
              key={sec.key}
              type="button"
              data-active={isActive ? "true" : undefined}
              onClick={() => onNavigate(sec.key)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border-2 shrink-0 snap-center transition-all touch-manipulation cursor-pointer ${
                isActive
                  ? 'border-primary bg-primary/10 text-primary shadow-xs font-bold'
                  : 'border-border/70 bg-card hover:border-border text-muted-foreground font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {isComplete && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                )}
              </div>
              <span className="text-xs whitespace-nowrap">
                {idx + 1}. {sec.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SECTION 1 — Personal Information
   (includes Address, Employment, Contact)
═══════════════════════════════════════════ */
function SectionPersonal({ profile, set, userEmail, errors, barangays = [] }) {
  const age = calcAge(profile.birth_date);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">I. Personal Information</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Basic identification, address, and contact details as they appear on your government-issued ID.
        </p>
      </div>

      {/* Full Name */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Full Name</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWrapper label="First Name" required error={errors?.first_name} id="first_name">
            <Input id="first_name" value={profile.first_name || ''} onChange={e => set('first_name', e.target.value)} placeholder="Enter first name" />
          </FieldWrapper>
          <FieldWrapper label="Middle Name" hint="Leave blank if none" id="middle_name">
            <Input id="middle_name" value={profile.middle_name || ''} onChange={e => set('middle_name', e.target.value)} placeholder="Enter middle name (optional)" />
          </FieldWrapper>
          <FieldWrapper label="Last Name" required error={errors?.last_name} id="last_name">
            <Input id="last_name" value={profile.last_name || ''} onChange={e => set('last_name', e.target.value)} placeholder="Enter last name" />
          </FieldWrapper>
          <FieldWrapper label="Suffix" hint="Jr., Sr., III, etc." id="suffix">
            <Input id="suffix" value={profile.suffix || ''} onChange={e => set('suffix', e.target.value)} placeholder="Jr., Sr., III (optional)" maxLength={10} />
          </FieldWrapper>
        </CardContent>
      </Card>

      {/* Identity Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identity Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWrapper label="PhilSys Card Number" id="philsys_card_number">
            <Input id="philsys_card_number" inputMode="numeric" value={profile.philsys_card_number || ''} onChange={e => set('philsys_card_number', e.target.value)} placeholder="XXXX-XXXX-XXXX" />
          </FieldWrapper>
          <FieldWrapper label="Date of Birth" required error={errors?.birth_date} id="birth_date">
            <div className="flex gap-2 items-center">
              <Input
                id="birth_date"
                type="date"
                value={profile.birth_date || ''}
                onChange={e => set('birth_date', e.target.value)}
                className={`flex-1 ${errors?.birth_date ? ERROR_INPUT_CLASS : ''}`}
              />
              {age && (
                <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted text-sm font-medium">
                  <span className="text-muted-foreground text-xs">Age</span>
                  <span>{age}</span>
                </div>
              )}
            </div>
          </FieldWrapper>
          <FieldWrapper label="Place of Birth" id="place_of_birth">
            <Input id="place_of_birth" value={profile.place_of_birth || ''} onChange={e => set('place_of_birth', e.target.value)} placeholder="City, Province" />
          </FieldWrapper>
          <FieldWrapper label="Sex" required error={errors?.sex} id="sex">
            <TypeableSelect
              id="sex"
              value={profile.sex || ''}
              onChange={v => set('sex', v)}
              options={SEX_OPTIONS}
              placeholder="Select or type sex"
              error={Boolean(errors?.sex)}
            />
          </FieldWrapper>
          <FieldWrapper label="Civil Status" required error={errors?.civil_status} id="civil_status">
            <TypeableSelect
              id="civil_status"
              value={profile.civil_status || ''}
              onChange={v => set('civil_status', v)}
              options={CIVIL_STATUSES}
              placeholder="Select or type civil status"
              error={Boolean(errors?.civil_status)}
            />
          </FieldWrapper>
          <FieldWrapper label="Religion" id="religion">
            <Input id="religion" value={profile.religion || ''} onChange={e => set('religion', e.target.value)} placeholder="e.g. Roman Catholic" />
          </FieldWrapper>
          <FieldWrapper label="Nationality" id="nationality">
            <Input id="nationality" value={profile.nationality || ''} onChange={e => set('nationality', e.target.value)} placeholder="Filipino" />
          </FieldWrapper>
          <FieldWrapper label="Educational Attainment" id="educational_attainment">
            <TypeableSelect
              id="educational_attainment"
              value={profile.educational_attainment || ''}
              onChange={v => set('educational_attainment', v)}
              options={EDUCATIONAL_ATTAINMENTS}
              placeholder="Select or type educational attainment"
            />
          </FieldWrapper>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Residential Address</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWrapper label="House No. / Building Name" id="house_no">
            <Input id="house_no" value={profile.house_no || ''} onChange={e => set('house_no', e.target.value)} placeholder="House / Building No." />
          </FieldWrapper>
          <FieldWrapper label="Street" id="street">
            <Input id="street" value={profile.street || ''} onChange={e => set('street', e.target.value)} placeholder="Street name" />
          </FieldWrapper>
          <FieldWrapper label="Barangay" required error={errors?.barangay} id="barangay">
            <TypeableSelect
              id="barangay"
              value={profile.barangay || ''}
              onChange={(val, opt) => {
                set('barangay', val);
                if (opt?.id) {
                  set('barangay_id', opt.id);
                }
              }}
              options={barangays.map(b => ({ value: b.name, label: b.name, id: b.id }))}
              placeholder="Select or type barangay (e.g. Baan KM 3)"
              icon={MapPin}
              error={Boolean(errors?.barangay)}
            />
          </FieldWrapper>
          <FieldWrapper label="City / Municipality" required error={errors?.city_municipality} id="city_municipality">
            <Input id="city_municipality" value={profile.city_municipality || ''} onChange={e => set('city_municipality', e.target.value)} placeholder="Enter city / municipality (e.g. Butuan City)" className={errors?.city_municipality ? ERROR_INPUT_CLASS : ''} />
          </FieldWrapper>
          <FieldWrapper label="Province" id="province">
            <Input id="province" value={profile.province || ''} onChange={e => set('province', e.target.value)} placeholder="Enter province (e.g. Agusan del Norte)" />
          </FieldWrapper>
          <FieldWrapper label="Region" id="region">
            <TypeableSelect
              id="region"
              value={profile.region || ''}
              onChange={v => set('region', v)}
              options={REGIONS}
              placeholder="Select or type region"
            />
          </FieldWrapper>
          <FieldWrapper label="ZIP Code" id="zip_code">
            <Input id="zip_code" value={profile.zip_code || ''} onChange={e => set('zip_code', e.target.value)} maxLength={4} placeholder="Enter ZIP code" />
          </FieldWrapper>
        </CardContent>
      </Card>

      {/* Employment & Contact */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Employment & Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWrapper label="Employment Status" id="employment_status">
            <TypeableSelect
              id="employment_status"
              value={profile.employment_status || ''}
              onChange={v => set('employment_status', v)}
              options={EMPLOYMENT_STATUSES}
              placeholder="Select or type employment status"
            />
          </FieldWrapper>
          <FieldWrapper label="Occupation" id="occupation">
            <Input id="occupation" value={profile.occupation || ''} onChange={e => set('occupation', e.target.value)} placeholder="Enter occupation" />
          </FieldWrapper>
          <FieldWrapper label="Company / Agency" id="company_agency">
            <Input id="company_agency" value={profile.company_agency || ''} onChange={e => set('company_agency', e.target.value)} placeholder="Enter company or agency" />
          </FieldWrapper>
          <FieldWrapper label="Monthly Income" hint="In Philippine Peso (₱)" id="monthly_income">
            <Input id="monthly_income" type="text" inputMode="numeric" pattern="[0-9]*" value={profile.monthly_income || ''} onChange={e => set('monthly_income', e.target.value)} placeholder="e.g. 15000" />
          </FieldWrapper>
          <FieldWrapper label="Contact Number" required error={errors?.contact_number} id="contact_number">
            <Input id="contact_number" type="tel" inputMode="tel" value={profile.contact_number || ''} onChange={e => set('contact_number', e.target.value)} placeholder="Enter contact number" className={errors?.contact_number ? ERROR_INPUT_CLASS : ''} />
          </FieldWrapper>
          <FieldWrapper label="Telephone Number" id="telephone">
            <Input id="telephone" type="tel" inputMode="tel" value={profile.telephone || ''} onChange={e => set('telephone', e.target.value)} placeholder="Enter telephone number (optional)" />
          </FieldWrapper>
          <FieldWrapper label="Email Address" span="full" id="email">
            <Input id="email" value={userEmail || ''} readOnly className="bg-muted/50 cursor-default" />
          </FieldWrapper>
        </CardContent>
      </Card>

      {/* Special Classifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Special Classifications</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ToggleField
            label="Pantawid Pamilyang Pilipino Program (4Ps) Beneficiary"
            value={!!profile.is_4ps_beneficiary}
            onChange={v => set('is_4ps_beneficiary', v)}
          />
          {profile.is_4ps_beneficiary && (
            <FieldWrapper label="4Ps Household ID #">
              <Input value={profile.household_id_4ps || ''} onChange={e => set('household_id_4ps', e.target.value)} />
            </FieldWrapper>
          )}
          <ToggleField label="Indigenous Person (IP)" value={!!profile.is_indigenous} onChange={v => set('is_indigenous', v)} />
          {profile.is_indigenous && (
            <FieldWrapper label="IP Affiliation / Tribe">
              <Input value={profile.indigenous_affiliation || ''} onChange={e => set('indigenous_affiliation', e.target.value)} />
            </FieldWrapper>
          )}
          <ToggleField label="LGBTQ+" value={!!profile.is_lgbtqia} onChange={v => set('is_lgbtqia', v)} />
          <ToggleField label="Person with Disability (PWD)" value={!!profile.is_pwd} onChange={v => set('is_pwd', v)} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SECTION 2 — Household Composition
═══════════════════════════════════════════ */
const BLANK_MEMBER = {
  name: '', sex: '', relationship: '', age: '', birthdate: '',
  civil_status: '', educational_attainment: '', occupation: '', monthly_income: '',
};

function SectionHousehold({ profile, set, errors }) {
  const members = Array.isArray(profile.household_members) ? profile.household_members : [];
  const addRow    = () => set('household_members', [...members, { ...BLANK_MEMBER }]);
  const removeRow = (i) => set('household_members', members.filter((_, idx) => idx !== i));
  const updateRow = (i, field, value) =>
    set('household_members', members.map((m, idx) => idx === i ? { ...m, [field]: value } : m));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">II. Household Composition</h2>
        <p className="text-sm text-muted-foreground mt-1">
          <strong>Optional:</strong> Add household members if applicable to your current household situation. You may leave this section empty and continue if you do not have household members to declare.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Household Members
          </CardTitle>
          <FieldWrapper label="">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">No. of minor children:</Label>
              <Input
                type="number" min="0"
                value={profile.num_children ?? ''}
                onChange={e => set('num_children', parseInt(e.target.value) || 0)}
                className="w-20 h-8 text-sm"
              />
            </div>
          </FieldWrapper>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors?.household && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning-soft border border-warning/30 text-sm text-warning">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errors.household}
            </div>
          )}

          {members.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No household members added yet.</p>
              <p className="text-xs mt-1">Click "Add Member" to add household members, or specify the number of children above.</p>
            </div>
          )}

          {members.map((member, i) => (
            <div key={i} className="p-4 border rounded-lg bg-muted/20 relative space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-muted-foreground">Member #{i + 1}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeRow(i)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <FieldWrapper label="Full Name" required error={errors?.[`member_name_${i}`]} id={`member_name_${i}`}>
                  <Input
                    id={`member_name_${i}`}
                    value={member.name || ''}
                    onChange={e => updateRow(i, 'name', e.target.value)}
                    placeholder="Name"
                    className={errors?.[`member_name_${i}`] ? ERROR_INPUT_CLASS : ''}
                  />
                </FieldWrapper>
                <FieldWrapper label="Sex">
                  <TypeableSelect
                    value={member.sex || ''}
                    onChange={v => updateRow(i, 'sex', v)}
                    options={SEX_OPTIONS}
                    placeholder="Select or type sex"
                  />
                </FieldWrapper>
                <FieldWrapper label="Relationship">
                  <Input value={member.relationship || ''} onChange={e => updateRow(i, 'relationship', e.target.value)} placeholder="e.g. Son, Daughter" />
                </FieldWrapper>
                <FieldWrapper label="Age">
                  <Input type="number" min="0" max="120" value={member.age || ''} onChange={e => updateRow(i, 'age', e.target.value)} placeholder="Age" />
                </FieldWrapper>
                <FieldWrapper label="Birthdate">
                  <Input type="date" value={member.birthdate || ''} onChange={e => updateRow(i, 'birthdate', e.target.value)} />
                </FieldWrapper>
                <FieldWrapper label="Civil Status">
                  <TypeableSelect
                    value={member.civil_status || ''}
                    onChange={v => updateRow(i, 'civil_status', v)}
                    options={CIVIL_STATUSES}
                    placeholder="Select or type civil status"
                  />
                </FieldWrapper>
                <FieldWrapper label="Educational Attainment">
                  <TypeableSelect
                    value={member.educational_attainment || ''}
                    onChange={v => updateRow(i, 'educational_attainment', v)}
                    options={EDUCATIONAL_ATTAINMENTS}
                    placeholder="Select or type education"
                  />
                </FieldWrapper>
                <FieldWrapper label="Occupation">
                  <Input value={member.occupation || ''} onChange={e => updateRow(i, 'occupation', e.target.value)} placeholder="e.g. Student" />
                </FieldWrapper>
                <FieldWrapper label="Monthly Income (₱)">
                  <Input value={member.monthly_income || ''} onChange={e => updateRow(i, 'monthly_income', e.target.value)} placeholder="0" />
                </FieldWrapper>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addRow} className="w-full gap-2 border-dashed">
            <Plus className="h-4 w-4" /> Add Household Member
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export const OFFICIAL_SOLO_PARENT_CATEGORIES = [
  // SECTION A: Circumstances Related to Parent or Spouse
  {
    code: 'a1',
    section: 'A',
    sectionLabel: 'A. Circumstances Related to Parent or Spouse',
    name: 'Birth of a child as a consequence of rape',
    description: 'Solo parent due to the birth of a child as a consequence of rape, even without final conviction of the offender.',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s of your dependent child/children.' },
      { name: 'Complaint affidavit', description: 'A copy of the sworn complaint affidavit.' },
      { name: 'Medical record on the incident of rape', description: 'Official medical records regarding the incident.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Sworn affidavit declaring sole parental care and support of the child/children.' },
      { name: 'Affidavit of a barangay official', description: 'Attesting residency and parental care of the child/children.' },
      { name: 'Solo Parents Orientation Seminar Certificate', description: 'Certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return / Proof of Income', description: 'Latest ITR or verifiable proof of income.' },
    ]
  },
  {
    code: 'a2',
    section: 'A',
    sectionLabel: 'A. Circumstances Related to Parent or Spouse',
    name: 'Widow or Widower',
    description: 'Solo parent due to death of spouse.',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s of your dependent child/children.' },
      { name: 'Marriage certificate', description: 'PSA-issued Marriage Certificate.' },
      { name: 'Death certificate of the spouse', description: 'PSA-issued Death Certificate of the deceased spouse.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Declaring not cohabiting with a partner and has sole parental care.' },
      { name: 'Affidavit of a barangay official', description: 'Attesting residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate', description: 'Certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return / Proof of Income', description: 'Latest ITR or verifiable proof of income.' },
    ]
  },
  {
    code: 'a3',
    section: 'A',
    sectionLabel: 'A. Circumstances Related to Parent or Spouse',
    name: 'Spouse of person deprived of liberty (PDL)',
    description: 'Solo parent due to detention or criminal conviction of spouse (for at least 3 months).',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s of dependent child/children.' },
      { name: 'Marriage certificate', description: 'PSA-issued Marriage Certificate.' },
      { name: 'Certificate of detention or certification', description: 'Showing spouse is detained or serving sentence for at least 3 months.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Declaring not cohabiting with a partner and has sole parental care.' },
      { name: 'Affidavit of a barangay official', description: 'Attesting residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate', description: 'Certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return / Proof of Income', description: 'Latest ITR or verifiable proof of income.' },
    ]
  },
  {
    code: 'a4',
    section: 'A',
    sectionLabel: 'A. Circumstances Related to Parent or Spouse',
    name: 'Spouse of person with physical or mental incapacity',
    description: 'Solo parent due to physical or mental incapacity of spouse as certified by a public medical practitioner.',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s.' },
      { name: 'Marriage certificate or affidavit of cohabitation', description: 'PSA-issued Marriage Certificate or Affidavit of Cohabitation.' },
      { name: 'Medical records or certificate of confinement / PWD ID', description: 'Issued not more than 3 months before submission, or valid PWD ID.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Declaring sole parental care and support.' },
      { name: 'Affidavit of a barangay official', description: 'Attesting residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate', description: 'Certificate of attendance for the Solo Parents Orientation Seminar.' },
    ]
  },
  {
    code: 'a5',
    section: 'A',
    sectionLabel: 'A. Circumstances Related to Parent or Spouse',
    name: 'Due to legal separation or de facto separation',
    description: 'Solo parent due to legal separation or de facto separation from spouse for at least six (6) months.',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s.' },
      { name: 'Marriage certificate', description: 'PSA-issued Marriage Certificate.' },
      { name: 'Judicial decree of legal separation or affidavit of 2 disinterested persons', description: 'Attesting to the fact of separation.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Declaring not cohabiting with a partner and has sole parental care.' },
      { name: 'Affidavit of a barangay official', description: 'Attesting residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate', description: 'Certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return / Proof of Income', description: 'Latest ITR or verifiable proof of income.' },
    ]
  },
  {
    code: 'a6',
    section: 'A',
    sectionLabel: 'A. Circumstances Related to Parent or Spouse',
    name: 'Due to nullity or annulment of marriage',
    description: 'Solo parent due to declaration of nullity or annulment of marriage or foreign divorce.',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s.' },
      { name: 'Marriage certificate annotated with nullity/annulment', description: 'Annotated with fact of declaration of nullity or annulment.' },
      { name: 'Judicial decree of nullity or annulment', description: 'Judicial decree or judicial recognition of foreign divorce.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Declaring not cohabiting with a partner and has sole parental care.' },
      { name: 'Affidavit of a barangay official', description: 'Attesting residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate', description: 'Certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return / Proof of Income', description: 'Latest ITR or verifiable proof of income.' },
    ]
  },
  {
    code: 'a7',
    section: 'A',
    sectionLabel: 'A. Circumstances Related to Parent or Spouse',
    name: 'Abandonment by the spouse',
    description: 'Solo parent due to abandonment by the spouse for at least six (6) months.',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s.' },
      { name: 'Marriage certificate or affidavit of applicant', description: 'PSA Marriage certificate or sworn affidavit.' },
      { name: 'Affidavit of two (2) disinterested persons', description: 'Attesting to the fact of abandonment for at least 6 months.' },
      { name: 'Police or barangay record of abandonment', description: 'Official blotter or barangay certificate.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Declaring not cohabiting with a partner and has sole parental care.' },
      { name: 'Affidavit of a barangay official', description: 'Attesting residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate', description: 'Certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return / Proof of Income', description: 'Latest ITR or verifiable proof of income.' },
    ]
  },
  // SECTION B: OFW-Related Categories
  {
    code: 'b1',
    section: 'B',
    sectionLabel: 'B. OFW-Related Categories',
    name: 'Spouse of OFW',
    description: 'Spouse or family member of an Overseas Filipino Worker (OFW) in low/semi-skilled category away for continuous 12 months.',
    requirements: [
      { name: 'Birth certificate/s of dependents', description: 'PSA-issued birth certificates.' },
      { name: 'Marriage certificate or proof of relationship', description: 'Marriage certificate or proof of relationship to the OFW.' },
      { name: 'POEA-SEC or equivalent employment contract', description: 'Standard Employment Contract or overseas job contract.' },
      { name: 'Photocopy of OFW passport / Immigration record', description: 'Showing continuous 12 months overseas work.' },
      { name: 'Proof of income of the OFW spouse/family member', description: 'Remittance slips or proof of income.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Declaring sole parental care.' },
      { name: 'Affidavit of a barangay official', description: 'Attesting residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate', description: 'Certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return / Proof of Income', description: 'Latest ITR or verifiable proof of income.' },
    ]
  },
  {
    code: 'b2',
    section: 'B',
    sectionLabel: 'B. OFW-Related Categories',
    name: 'Relative of OFW',
    description: 'Any family member of an Overseas Filipino Worker (OFW) assuming sole parental care.',
    requirements: [
      { name: 'Birth certificate/s of dependents', description: 'PSA-issued birth certificates.' },
      { name: 'Birth certificate / Proof of relationship to OFW', description: 'Competent proof of relationship.' },
      { name: 'POEA-SEC or equivalent employment contract', description: 'Standard Employment Contract of the OFW.' },
      { name: 'Photocopy of OFW passport / Immigration record', description: 'Showing continuous 12 months overseas work.' },
      { name: 'Proof of income of the family member', description: 'Proof of income of the guardian.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Declaring sole parental care.' },
      { name: 'Affidavit of a barangay official', description: 'Attesting residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate', description: 'Certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return / Proof of Income', description: 'Latest ITR or verifiable proof of income.' },
    ]
  },
  // SECTION C: Other Categories
  {
    code: 'c',
    section: 'C',
    sectionLabel: 'C. Other Categories',
    name: 'Unmarried person (Mother or Father)',
    description: 'Unmarried mother or father who has kept and reared the child/children.',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s.' },
      { name: 'Certificate of No Marriage (CENOMAR)', description: 'PSA-issued Certificate of No Marriage.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Declaring not cohabiting with a partner/co-parent.' },
      { name: 'Affidavit of a barangay official', description: 'Attesting residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate', description: 'Certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return / Proof of Income', description: 'Latest ITR or verifiable proof of income.' },
    ]
  },
  {
    code: 'd',
    section: 'D',
    sectionLabel: 'C. Other Categories',
    name: 'Legal guardian / Adoptive parent / Foster parent',
    description: 'Any legal guardian, adoptive or foster parent who solely provides parental care and support to a child.',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s.' },
      { name: 'Proof of guardianship, adoption, or foster care', description: 'Court order of guardianship, DSWD/NACC adoption decree, or Foster Parent License.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Declaring not cohabiting with a partner and has sole parental care.' },
      { name: 'Affidavit of a barangay official', description: 'Attesting residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate', description: 'Certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return / Proof of Income', description: 'Latest ITR or verifiable proof of income.' },
    ]
  },
  {
    code: 'e',
    section: 'E',
    sectionLabel: 'C. Other Categories',
    name: 'Relative within the fourth civil degree',
    description: 'Any relative within the fourth (4th) civil degree of consanguinity or affinity assuming sole parental care.',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s.' },
      { name: 'Death cert / Incapacity cert / Judicial declaration of absence', description: 'Or police/barangay records evidencing disappearance for at least 6 months.' },
      { name: 'Proof of relationship of relative to parents/guardian', description: 'Birth certificate, marriage certificate, or family records.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Declaring sole parental care and support.' },
      { name: 'Affidavit of a barangay official', description: 'Attesting residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate', description: 'Certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return / Proof of Income', description: 'Latest ITR or verifiable proof of income.' },
    ]
  },
  {
    code: 'f',
    section: 'F',
    sectionLabel: 'C. Other Categories',
    name: 'Pregnant woman',
    description: 'A pregnant woman who provides sole parental care and support to her unborn child or children.',
    requirements: [
      { name: 'Medical record of pregnancy', description: 'Official medical record or certificate of pregnancy.' },
      { name: 'Affidavit of a barangay official', description: 'Attesting residency in the barangay.' },
      { name: 'Sworn affidavit', description: 'Declaring not cohabiting with a partner providing support.' },
      { name: 'Solo Parents Orientation Seminar Certificate', description: 'Certificate of attendance for the Solo Parents Orientation Seminar.' },
    ]
  }
];

/* ═══════════════════════════════════════════
   SECTION 3 — Solo Parent Category
═══════════════════════════════════════════ */
function SectionSoloParent({ profile, set, categories = [], errors }) {
  const dynamicList = Array.isArray(categories) && categories.length > 0 ? categories : (categories?.data || []);
  
  // Combine official categories with dynamic ones to ensure complete requirements and description
  const catList = OFFICIAL_SOLO_PARENT_CATEGORIES.map(official => {
    const fromApi = dynamicList.find(d => d.code?.toLowerCase() === official.code?.toLowerCase());
    return {
      ...official,
      id: fromApi?.id || official.code,
      requirements: fromApi?.requirements?.length ? fromApi.requirements : official.requirements,
      name: fromApi?.name || official.name,
      description: fromApi?.description || official.description,
    };
  });

  const selected = catList.find(c => c.code.toLowerCase() === profile.solo_parent_category?.toLowerCase() || c.name === profile.solo_parent_category);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">III. Solo Parent Category</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select the category that applies to your situation under RA 11861 (Expanded Solo Parents Welfare Act).
        </p>
      </div>

      {/* Category Dropdown Selection */}
      <Card id="solo_parent_category" className="overflow-visible">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Select Your Category <span className="text-destructive font-bold">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-visible">
          <div className="space-y-2">
            <Label htmlFor="solo-parent-category-select" className={`text-sm font-medium ${errors?.solo_parent_category ? 'text-destructive font-semibold' : ''}`}>
              Solo Parent Category
            </Label>
            
            <TypeableSelect
              id="solo-parent-category-select"
              value={profile.solo_parent_category || ''}
              onChange={v => set('solo_parent_category', v)}
              options={catList.map(cat => ({
                value: cat.code,
                label: `${cat.code.toUpperCase()} — ${cat.name}`,
                description: cat.description,
                group: cat.sectionLabel,
                original: cat,
              }))}
              placeholder="Type to search or select category (e.g. A1, Rape, Spouse, OFW...)"
              maxDropdownHeight="max-h-[420px]"
              error={Boolean(errors?.solo_parent_category)}
            />

            {errors?.solo_parent_category && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1.5 mt-1 animate-in fade-in">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.solo_parent_category}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Selected Category Details & Requirements Card */}
      {selected && (
        <Card className="border-primary/30 bg-primary/5 transition-all animate-in fade-in slide-in-from-top-2 duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono bg-primary text-primary-foreground px-2.5 py-1 rounded uppercase font-bold text-xs">
                {selected.code.toUpperCase()}
              </span>
              <CardTitle className="text-base font-bold text-primary">
                {selected.name}
              </CardTitle>
            </div>
            {selected.description && (
              <p className="text-sm text-foreground/80 mt-2 font-medium">
                {selected.description}
              </p>
            )}
          </CardHeader>
          {(selected.requirements ?? []).length > 0 && (
            <CardContent className="pt-0 space-y-3">
              <div className="border-t border-primary/20 pt-3">
                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                  Documentary Requirements for this category:
                </p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {selected.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs p-2.5 rounded-lg bg-background/80 border border-primary/10">
                      <span className="font-bold text-primary shrink-0">{i + 1}.</span>
                      <div>
                        <span className="font-semibold text-foreground">{req.name}</span>
                        {req.description && <span className="block text-muted-foreground mt-0.5">{req.description}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Additional Fields */}
      <Card>
        <CardContent className="pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWrapper label="Solo Parent Since" required hint="When did you become a solo parent?" error={errors?.solo_parent_since} id="solo_parent_since">
            <Input
              id="solo_parent_since"
              type="date"
              value={profile.solo_parent_since || ''}
              onChange={e => set('solo_parent_since', e.target.value)}
              className={errors?.solo_parent_since ? ERROR_INPUT_CLASS : ''}
            />
          </FieldWrapper>
          <FieldWrapper label="Classification / Circumstances" span="full" hint="Briefly describe your circumstances as a solo parent.">
            <Textarea
              value={profile.solo_parent_classification || ''}
              onChange={e => set('solo_parent_classification', e.target.value)}
              rows={3}
              placeholder="Describe your circumstances as a solo parent..."
            />
          </FieldWrapper>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SECTION 4 — Needs & Problems
═══════════════════════════════════════════ */
function SectionNeeds({ profile, set, errors }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">IV. Needs & Problems</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Describe the needs and challenges you face as a solo parent (Kinakailangan/Problema ng isang solo parent).
        </p>
      </div>
      <Card>
        <CardContent className="pt-5 space-y-4">
          <FieldWrapper label="Needs / Problems as a Solo Parent" required span="full" error={errors?.needs_problems} id="needs_problems">
            <Textarea
              id="needs_problems"
              value={profile.needs_problems || ''}
              onChange={e => set('needs_problems', e.target.value)}
              rows={10}
              placeholder="e.g. Financial difficulties in providing for children's education and daily needs. Lack of childcare support while working. Limited access to healthcare services..."
              className={`resize-y ${errors?.needs_problems ? ERROR_INPUT_CLASS : ''}`}
            />
          </FieldWrapper>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            This information helps the CSWDD understand and address your specific concerns as a solo parent.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SECTION 5 — Emergency Contact
═══════════════════════════════════════════ */
function SectionEmergency({ profile, set, errors }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">V. Emergency Contact</h2>
        <p className="text-sm text-muted-foreground mt-1">Provide a person to contact in case of emergency.</p>
      </div>
      <Card>
        <CardContent className="pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWrapper label="Full Name" required error={errors?.emergency_contact_name} id="emergency_contact_name">
            <Input
              id="emergency_contact_name"
              value={profile.emergency_contact_name || ''}
              onChange={e => set('emergency_contact_name', e.target.value)}
              placeholder="Emergency contact's full name"
              className={errors?.emergency_contact_name ? ERROR_INPUT_CLASS : ''}
            />
          </FieldWrapper>
          <FieldWrapper label="Relationship" id="emergency_contact_relationship">
            <Input id="emergency_contact_relationship" value={profile.emergency_contact_relationship || ''} onChange={e => set('emergency_contact_relationship', e.target.value)} placeholder="e.g. Mother, Sibling, Friend" />
          </FieldWrapper>
          <FieldWrapper label="Contact Number" required error={errors?.emergency_contact_number} id="emergency_contact_number">
            <Input
              id="emergency_contact_number"
              type="tel"
              inputMode="tel"
              value={profile.emergency_contact_number || ''}
              onChange={e => set('emergency_contact_number', e.target.value)}
              placeholder="Enter contact number"
              className={errors?.emergency_contact_number ? ERROR_INPUT_CLASS : ''}
            />
          </FieldWrapper>
          <FieldWrapper label="Address" span="full" id="emergency_contact_address">
            <Input id="emergency_contact_address" value={profile.emergency_contact_address || ''} onChange={e => set('emergency_contact_address', e.target.value)} placeholder="Full address of emergency contact" />
          </FieldWrapper>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function ProfileForm({ 
  embedded = false, 
  onComplete,
  onBack,
  onSubmitFinal,
  application,
  profile: propProfile,
  categories: propCategories,
  barangays: propBarangays
}) {
  const location = useLocation();
  const navigate  = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Parse ?section= from URL to allow deep-linking
  const urlSection = new URLSearchParams(location.search).get('section');
  const initialSection = SECTIONS.find(s => s.key === urlSection)?.key ?? 'personal';

  const [activeSection, setActiveSection] = useState(initialSection);
  const [profile, setProfileState]         = useState(propProfile || {});
  const [categories, setCategories]        = useState(propCategories || []);
  const [barangays, setBarangays]          = useState(propBarangays || []);
  const [loading, setLoading]              = useState(true);
  const [saving, setSaving]               = useState(false);
  const [sectionErrors, setSectionErrors]  = useState({});
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // 'saving' | 'saved' | 'error'
  const autoSaveTimeout                    = useRef(null);

  // Final submission modal state
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submittingFinal, setSubmittingFinal] = useState(false);
  const [isCertified, setIsCertified]         = useState(false);

  // Load profile & categories
  useEffect(() => {
    const promises = [];
    
    const profileIdx = propProfile ? -1 : promises.push(api.get('/profile?with_form=true').catch(() => ({ data: null }))) - 1;
    const catIdx = propCategories ? -1 : promises.push(api.get('/public/categories').catch(() => ({ data: [] }))) - 1;
    const brgyIdx = propBarangays ? -1 : promises.push(api.get('/public/barangays').catch(() => ({ data: [] }))) - 1;

    if (promises.length === 0) {
      setLoading(false);
      return;
    }

    Promise.all(promises).then((results) => {
      if (profileIdx >= 0) {
        const profileRes = results[profileIdx];
        setProfileState(profileRes.data?.data ?? profileRes.data ?? {});
      }
      if (catIdx >= 0) {
        const catRes = results[catIdx];
        const catData = Array.isArray(catRes.data) ? catRes.data : (catRes.data?.data || []);
        setCategories(catData);
      }
      if (brgyIdx >= 0) {
        const brgyRes = results[brgyIdx];
        const brgyData = Array.isArray(brgyRes.data) ? brgyRes.data : (brgyRes.data?.data || []);
        setBarangays(brgyData);
      }
    }).catch(() => {
      toast.error('Failed to load profile data. Please refresh.');
    }).finally(() => setLoading(false));
  }, [propProfile, propCategories, propBarangays]);

  // Sync state if URL query param changes
  useEffect(() => {
    const s = new URLSearchParams(location.search).get('section');
    if (s && SECTIONS.some(sec => sec.key === s) && s !== activeSection) {
      setActiveSection(s);
    }
  }, [location.search]);

  // Auto-scroll and focus target field if ?focus= is provided in URL
  useEffect(() => {
    const focusField = new URLSearchParams(location.search).get('focus');
    if (!focusField || loading) return;

    const timer = setTimeout(() => {
      scrollToAndFocus(focusField, { delay: 200, block: 'center' });
    }, 350);

    return () => clearTimeout(timer);
  }, [loading, activeSection, location.search]);

  // Update URL when section changes (for bookmark/refresh)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('section') !== activeSection) {
      params.set('section', activeSection);
      navigate(`?${params.toString()}`, { replace: true });
    }
  }, [activeSection]);

  // Mutable ref to always hold the latest state, avoiding stale closures
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Direct and reliable profile saver
  const savePayload = useCallback(async (customPayload) => {
    const payload = customPayload || profileRef.current;
    if (!payload || Object.keys(payload).length === 0) return true;
    setAutoSaveStatus('saving');
    try {
      await api.put('/profile', payload);
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus(null), 2500);
      return true;
    } catch {
      setAutoSaveStatus('error');
      return false;
    }
  }, []);

  // Field setter — triggers auto-save debounce with FRESH state
  const set = useCallback((key, value) => {
    setProfileState(p => {
      const next = { ...p, [key]: value };
      profileRef.current = next;

      // Clear debounce and re-queue save with latest object
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
      autoSaveTimeout.current = setTimeout(() => {
        savePayload(next);
      }, 700);

      return next;
    });

    // Clear any previous error for this field
    setSectionErrors(e => {
      const copy = { ...e };
      delete copy[key];
      return copy;
    });
  }, [savePayload]);

  // Flush on unmount if component unmounts before debounce fires
  useEffect(() => {
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
      if (profileRef.current && Object.keys(profileRef.current).length > 0) {
        api.put('/profile', profileRef.current).catch(() => {});
      }
    };
  }, []);

  // Navigate to a section — saves current section first as draft
  const handleNavigate = async (sectionKey) => {
    if (sectionKey === activeSection) return;
    // Silently save current data
    setSaving(true);
    try {
      await api.put('/profile', profileRef.current);
    } catch {
      // Don't block navigation on auto-save failure
    } finally {
      setSaving(false);
    }
    setActiveSection(sectionKey);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Save & Continue → : validates current section, saves to DB, then advances to next
  const handleSaveAndContinue = async () => {
    const current = profileRef.current;
    const errorMap = getSectionFieldErrors(activeSection, current);
    const errorKeys = Object.keys(errorMap);
    if (errorKeys.length > 0) {
      setSectionErrors(errorMap);
      const firstField = errorKeys[0];
      toast.error('Please complete all required fields highlighted in red.');
      scrollToAndFocus(firstField);
      return;
    }
    setSectionErrors({});
    setSaving(true);
    try {
      await api.put('/profile', current);
      const idx = SECTIONS.findIndex(s => s.key === activeSection);
      const next = SECTIONS[idx + 1];
      if (next) {
        toast.success(`${SECTIONS[idx].label} saved!`);
        setActiveSection(next.key);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      toastError(err, 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Return to Step 1: Documentary Requirements without losing saved form info
  const handleBackToDocs = async () => {
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    setSaving(true);
    try {
      await api.put('/profile', profileRef.current);
    } catch {
      // Don't block navigation on save failure
    } finally {
      setSaving(false);
    }
    if (onBack) onBack();
  };

  // Validate all 5 sections and open the final submit confirmation modal
  const handleOpenSubmitModal = async () => {
    const current = profileRef.current;
    // Check every section in sequence: personal -> household -> solo_parent -> needs -> emergency
    for (const sec of SECTIONS) {
      const errorMap = getSectionFieldErrors(sec.key, current);
      const errorKeys = Object.keys(errorMap);
      if (errorKeys.length > 0) {
        if (activeSection !== sec.key) {
          setActiveSection(sec.key);
        }
        setSectionErrors(errorMap);
        toast.error(`Please complete the required fields in ${sec.label}.`);
        setTimeout(() => {
          scrollToAndFocus(errorKeys[0]);
        }, 200);
        return;
      }
    }

    setSectionErrors({});
    setSaving(true);
    try {
      await api.put('/profile', current);
    } catch (err) {
      toastError(err, 'Failed to save form data.');
      setSaving(false);
      return;
    } finally {
      setSaving(false);
    }

    setIsCertified(false);
    setSubmitModalOpen(true);
  };

  // Confirm final submission of BOTH documents and application form
  const handleConfirmFinalSubmit = async () => {
    if (!isCertified) {
      toast.error('Please certify that all information and uploaded documents are complete and true.');
      return;
    }

    setSubmittingFinal(true);
    try {
      await api.put('/profile', profileRef.current);

      let targetAppId = application?.id;
      if (!targetAppId) {
        const meRes = await api.get('/applications/me');
        targetAppId = meRes.data?.application?.id;
      }

      if (!targetAppId) {
        toast.error('Active application not found. Please refresh and try again.');
        setSubmittingFinal(false);
        return;
      }

      await api.post(`/applications/${targetAppId}/submit`);
      toast.success('Documents and Solo Parent Application Form submitted together successfully!');
      setSubmitModalOpen(false);

      if (onSubmitFinal) {
        onSubmitFinal();
      } else if (onComplete) {
        onComplete();
      } else {
        navigate('/portal/my-application?step=status');
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        toast.error('Submission incomplete: ' + detail);
      } else {
        toastError(err, 'Failed to submit application. Please verify all requirements are uploaded.');
      }
    } finally {
      setSubmittingFinal(false);
    }
  };

  // Complete Profile — validates ALL sections, saves, redirects
  const handleCompleteProfile = async () => {
    handleOpenSubmitModal();
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading your profile…</p>
      </div>
    </div>
  );

  const allSectionsComplete = SECTIONS.every(s => validateSection(s.key, profile));
  const completedCount      = SECTIONS.filter(s => validateSection(s.key, profile)).length;
  const completionPct       = Math.round((completedCount / SECTIONS.length) * 100);

  const activeSectionDef = SECTIONS.find(s => s.key === activeSection);
  const sectionComplete  = validateSection(activeSection, profile);

  return (
    <div className={embedded ? 'w-full max-w-full overflow-x-hidden min-w-0' : 'flex-1 bg-background min-h-screen w-full max-w-full overflow-x-hidden min-w-0'}>
      <div className={embedded ? 'w-full max-w-full overflow-x-hidden min-w-0' : 'container px-2.5 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl mx-auto w-full max-w-full overflow-x-hidden min-w-0'}>

        {/* ── Page Header ──────────────────────────────────── */}
        {!embedded && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Solo Parent Application Form</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Complete all 5 sections of your Solo Parent Application Form. You can navigate freely between sections.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Auto-save indicator */}
            {autoSaveStatus === 'saving' && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" /> Saving draft…
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="text-xs text-success flex items-center gap-1">
                <Check className="h-3 w-3" /> Draft saved
              </span>
            )}
            {/* Overall progress */}
            <div className="text-right">
              <p className="text-sm font-semibold">{completionPct}% Complete</p>
              <p className="text-xs text-muted-foreground">{completedCount} of {SECTIONS.length} sections</p>
            </div>
          </div>
        </div>
        )}

        {/* ── Progress Bar ─────────────────────────────────── */}
        <div className="mb-6">
          <Progress value={completionPct} className="h-2" />
        </div>

        {/* ── Mobile Tab Strip ─────────────────────────────── */}
        <div className="lg:hidden mb-6">
          <MobileTabs activeKey={activeSection} profile={profile} onNavigate={handleNavigate} />
        </div>

        {/* ── Main Layout: Sidebar + Content ───────────────── */}
        <div className="flex gap-8">

          {/* Sidebar (desktop only) */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 space-y-2">
              <SectionTabs activeKey={activeSection} profile={profile} onNavigate={handleNavigate} />

              {/* Summary completion badge */}
              <div className={`mt-4 p-3 rounded-xl border text-center ${
                allSectionsComplete ? 'border-success/30 bg-success-soft dark:border-success/30' : 'border-warning/30 bg-warning-soft dark:border-warning/30'
              }`}>
                {allSectionsComplete
                  ? <><CheckCircle className="h-6 w-6 text-success mx-auto mb-1" /><p className="text-xs font-semibold text-success">Profile Complete!</p></>
                  : <><AlertCircle className="h-6 w-6 text-warning mx-auto mb-1" /><p className="text-xs font-semibold text-warning">{SECTIONS.length - completedCount} section(s) remaining</p></>
                }
              </div>
            </div>
          </aside>

          {/* Content Area */}
          <main className="flex-1 min-w-0">
            {/* Top Back to Documentary Requirements */}
            {onBack && (
              <div className="mb-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBackToDocs}
                  className="rounded-xl border-2 border-border/80 bg-background hover:bg-muted font-bold text-foreground shadow-xs px-3.5 h-10 gap-2 cursor-pointer max-w-full touch-manipulation inline-flex items-center"
                >
                  <ArrowLeft className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate text-xs sm:text-sm">Back to Documentary Requirements</span>
                </Button>
              </div>
            )}

            {/* Section header breadcrumb */}
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
              <span>Profile</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground font-medium">{activeSectionDef?.label}</span>
              <div className="ml-auto">
                {sectionComplete
                  ? <Badge className="bg-success text-success-foreground text-white gap-1 text-xs font-semibold px-2.5 py-0.5"><CheckCircle className="h-3 w-3" />Complete</Badge>
                  : <Badge variant="outline" className="border-warning/30 text-warning gap-1 text-xs font-semibold px-2.5 py-0.5"><AlertCircle className="h-3 w-3" />Incomplete</Badge>
                }
              </div>
            </div>

            {/* Section Content */}
            <div className="min-h-[400px]">
              {activeSection === 'personal'    && <SectionPersonal    profile={profile} set={set} userEmail={user?.email} errors={sectionErrors} barangays={barangays} />}
              {activeSection === 'household'   && <SectionHousehold   profile={profile} set={set} errors={sectionErrors} />}
              {activeSection === 'solo_parent' && <SectionSoloParent  profile={profile} set={set} categories={categories} errors={sectionErrors} />}
              {activeSection === 'needs'       && <SectionNeeds       profile={profile} set={set} errors={sectionErrors} />}
              {activeSection === 'emergency'   && <SectionEmergency   profile={profile} set={set} errors={sectionErrors} />}
            </div>

            {/* ── Bottom Navigation ──────────────────────── */}
            <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">

              {/* ← Previous section */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {(() => {
                  const idx = SECTIONS.findIndex(s => s.key === activeSection);
                  const prev = SECTIONS[idx - 1];
                  if (prev) {
                    return (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleNavigate(prev.key)}
                        disabled={saving}
                        className="w-full sm:w-auto h-11 text-sm font-semibold rounded-2xl justify-center touch-manipulation cursor-pointer"
                      >
                        ← {prev.shortLabel}
                      </Button>
                    );
                  }
                  if (onBack) {
                    return (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleBackToDocs}
                        disabled={saving}
                        className="w-full sm:w-auto h-11 text-sm font-semibold rounded-2xl justify-center touch-manipulation cursor-pointer"
                      >
                        <span className="hidden sm:inline">← Documentary Requirements</span>
                        <span className="sm:hidden">← Requirements</span>
                      </Button>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Save & Continue / Submit Documents and Application Form */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {(() => {
                  const idx = SECTIONS.findIndex(s => s.key === activeSection);
                  const isLastSection = idx === SECTIONS.length - 1;

                  if (isLastSection) {
                    return (
                      <Button
                        type="button"
                        onClick={handleOpenSubmitModal}
                        disabled={saving || submittingFinal}
                        className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shadow-primary/20 px-4 sm:px-6 h-auto min-h-[44px] py-2.5 rounded-2xl cursor-pointer justify-center text-center touch-manipulation whitespace-normal break-words"
                        data-testid="submit-application-button"
                        id="submit-documents-and-form-btn"
                      >
                        {submittingFinal
                          ? <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                          : <Send className="h-4 w-4 shrink-0" />
                        }
                        <span className="hidden sm:inline">{submittingFinal ? 'Submitting…' : 'Submit Documents and Application Form'}</span>
                        <span className="sm:hidden">{submittingFinal ? 'Submitting…' : 'Submit Application Form'}</span>
                      </Button>
                    );
                  }

                  return (
                    <Button
                      type="button"
                      onClick={handleSaveAndContinue}
                      disabled={saving}
                      className="w-full sm:w-auto gap-2 h-11 rounded-2xl font-bold justify-center touch-manipulation cursor-pointer"
                    >
                      {saving
                        ? <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                        : <ChevronRight className="h-4 w-4 shrink-0" />
                      }
                      {saving ? 'Saving…' : 'Save & Continue →'}
                    </Button>
                  );
                })()}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* ── Final Submission Confirmation Modal ── */}
      <Dialog open={submitModalOpen} onOpenChange={setSubmitModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-3xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-lg">
              <Send className="h-5 w-5 text-primary" />
              Submit Documents and Application Form
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1 leading-relaxed">
              You are submitting both your <strong>uploaded documentary requirements</strong> and your completed <strong>Solo Parent Application Form</strong> together as one application to CSWDD for official review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground">What happens next?</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Your submission will be queued directly to the CSWDD Admin.</li>
                <li>The admin will review both your documentary requirements and your application form.</li>
                <li>Your status updates automatically on your portal in real time without refreshing the page.</li>
              </ul>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl border bg-muted/30">
              <input
                type="checkbox"
                id="certify-checkbox"
                checked={isCertified}
                onChange={(e) => setIsCertified(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <Label htmlFor="certify-checkbox" className="text-xs text-foreground leading-normal cursor-pointer">
                I hereby certify that all information provided in this Solo Parent Application Form and all uploaded documentary requirements are true, correct, and complete to the best of my knowledge.
              </Label>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubmitModalOpen(false)}
              disabled={submittingFinal}
              className="w-full sm:w-auto h-11 rounded-2xl touch-manipulation"
            >
              Review Again
            </Button>
            <Button
              type="button"
              onClick={handleConfirmFinalSubmit}
              disabled={submittingFinal || !isCertified}
              className="w-full sm:w-auto h-11 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shadow-primary/20 gap-2 cursor-pointer touch-manipulation"
              id="confirm-submit-dialog-btn"
            >
              {submittingFinal ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submittingFinal ? 'Submitting…' : 'Submit Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
