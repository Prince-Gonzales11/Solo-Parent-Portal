import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Lock, FileCheck, Eye, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-4xl space-y-8">
      {/* Breadcrumb / Back button */}
      <div>
        <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="border-b border-border pb-6 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
          <Shield className="h-3.5 w-3.5" />
          Data Privacy Compliance
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground font-display">
          Privacy Notice
        </h1>
        <p className="text-sm text-muted-foreground">
          Compliant with Republic Act No. 10173 (Data Privacy Act of 2012) and National Privacy Commission (NPC) Circulars
          <br />
          City Social Welfare and Development Department (CSWDD) — Butuan City
        </p>
      </div>

      {/* Content */}
      <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
            Our Privacy Commitment
          </h2>
          <p>
            The City Social Welfare and Development Department (CSWDD) of Butuan City respects your privacy and is committed to protecting the confidentiality and integrity of your personal and sensitive personal data. This Privacy Notice outlines how we collect, process, store, protect, and dispose of the information you provide when using the Solo Parent Portal.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
            What Information We Collect
          </h2>
          <p>
            In accordance with Republic Act No. 11861, we collect only information necessary for assessing your eligibility, processing your Solo Parent Identification Card (SPIC), and extending mandated social assistance:
          </p>
          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            <div className="rounded-2xl border border-border p-4 bg-card space-y-1.5">
              <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider">Personal Information</h3>
              <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                <li>Full legal name, sex, and date of birth</li>
                <li>Barangay address and contact numbers</li>
                <li>Email address and educational attainment</li>
                <li>Occupation and monthly household income</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border p-4 bg-card space-y-1.5">
              <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider">Sensitive & Documentary Data</h3>
              <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                <li>Civil status and solo parent category classification</li>
                <li>Birth certificates of dependent children</li>
                <li>Affidavits of solo parenthood and barangay residency</li>
                <li>Death certificates, medical abstracts, or court decrees where applicable</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
            Purpose of Processing
          </h2>
          <p>
            Your information is processed strictly for official government purposes, including:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>Evaluating qualification for a Solo Parent ID under Republic Act No. 11861.</li>
            <li>Printing, issuing, and maintaining the registry of Solo Parent IDs in Butuan City.</li>
            <li>Disseminating official announcements, benefit distributions, and renewal notifications.</li>
            <li>Generating anonymized statistical and demographic reports for municipal social policy planning.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">4</span>
            Data Security and Access Controls
          </h2>
          <p>
            We implement comprehensive organizational, physical, and technical measures to prevent unauthorized access, disclosure, or destruction of your data:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>Database encryption at rest and TLS/HTTPS encryption in transit.</li>
            <li>PostgreSQL Row Level Security (RLS) restricting applicant document access exclusively to the document owner and authorized CSWDD evaluators.</li>
            <li>Automated audit logging capturing administrative reviews, status updates, and document verification events.</li>
            <li>Role-based access controls limiting staff access strictly to official duties.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">5</span>
            Your Rights under the Data Privacy Act (RA 10173)
          </h2>
          <p>
            As a data subject, you are entitled to statutory rights under Section 16 of the Data Privacy Act, including:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li><strong>Right to be Informed:</strong> To understand how and why your data is collected.</li>
            <li><strong>Right to Access:</strong> To view the personal information and uploaded files held in your portal account.</li>
            <li><strong>Right to Rectification:</strong> To correct inaccurate, outdated, or incomplete details via your Profile form.</li>
            <li><strong>Right to Erasure or Blocking:</strong> To request account cancellation and record deletion subject to statutory retention obligations.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">6</span>
            Data Protection Officer
          </h2>
          <p>
            If you have questions, feedback, or concerns regarding your personal data, you may reach our Data Protection Officer:
          </p>
          <div className="rounded-2xl border border-border bg-card p-4 text-xs sm:text-sm text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Data Protection Officer — City Government of Butuan</p>
            <p>CSWDD Building, City Hall Complex, Butuan City</p>
            <p>Email: dpo@butuan.gov.ph | Telephone: (085) 342-8000 local 105</p>
          </div>
        </section>
      </div>
    </div>
  );
}
