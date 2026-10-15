import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, Shield, Scale, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsAndConditions() {
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
          <Scale className="h-3.5 w-3.5" />
          Official Policy Document
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground font-display">
          Terms and Conditions
        </h1>
        <p className="text-sm text-muted-foreground">
          City Social Welfare and Development Department (CSWDD) — Butuan City, Agusan del Norte
          <br />
          Effective Date: October 2026 | Governing Law: Republic Act No. 11861 & RA 8972
        </p>
      </div>

      {/* Content */}
      <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
            Acceptance of Terms
          </h2>
          <p>
            By accessing or using the Butuan City Solo Parent Portal (&quot;the Portal&quot;), you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions, as well as the accompanying Privacy Notice and Cookie Policy. If you do not agree to these terms, you must not access or use this Portal.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
            Eligibility and Statutory Basis
          </h2>
          <p>
            The Solo Parent Portal is an official digital service of the City Government of Butuan operated by the City Social Welfare and Development Department (CSWDD). This service is exclusively available to residents of Butuan City who qualify as solo parents pursuant to Republic Act No. 11861 (the Expanded Solo Parents Welfare Act) and its implementing rules and regulations.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>Applicants must be bonafide residents of any recognized barangay within Butuan City.</li>
            <li>Applicants must have sole parental care and support of their qualified child or children as defined by law.</li>
            <li>All applications, renewals, and replacements are subject to official verification, documentary review, and social worker assessment.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
            Applicant Obligations and Truthfulness
          </h2>
          <p>
            You certify under penalty of law that all information provided during registration, profile completion, and application filing is true, accurate, current, and complete. You further agree to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>Submit genuine, unadulterated, and legally issued documentary requirements.</li>
            <li>Promptly update your portal profile and inform CSWDD of any changes in your civil status, cohabitation, employment, or custody arrangements that may affect your eligibility.</li>
            <li>Safeguard your portal credentials (password and authentication codes) and maintain account confidentiality.</li>
            <li>Never allow third parties to misrepresent themselves using your credentials or your Solo Parent Identification Card (SPIC).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">4</span>
            Penalties for Falsification and Fraud
          </h2>
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-xs sm:text-sm text-destructive-foreground">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <strong className="text-destructive font-semibold">Legal Warning:</strong> Misrepresentation of facts, submission of forged or fraudulent documents, or unauthorized use of a Solo Parent Identification Card constitutes an offense punishable under the Revised Penal Code of the Philippines and Section 19 of Republic Act No. 11861. Violators will face immediate card revocation, permanent disqualification, and potential criminal prosecution.
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">5</span>
            Issuance, Validity, and Card Replacement
          </h2>
          <p>
            The Solo Parent Identification Card (SPIC) issued by CSWDD Butuan City is valid for one (1) year from date of issuance and must be renewed annually by submitting the required renewal documents. The physical card remains the property of the City Government of Butuan and must be presented alongside valid government identification when availing of statutory discounts and benefits.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">6</span>
            Contact and Inquiries
          </h2>
          <p>
            For questions or clarifications regarding these terms, please contact:
          </p>
          <div className="rounded-2xl border border-border bg-card p-4 text-xs sm:text-sm text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">City Social Welfare and Development Department (CSWDD)</p>
            <p>City Hall Complex, J.P. Rosales Avenue, Butuan City, Agusan del Norte, 8600</p>
            <p>Email: cswdd@butuan.gov.ph | Phone: (085) 342-8000</p>
          </div>
        </section>
      </div>
    </div>
  );
}
