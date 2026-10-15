import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Cookie, Info, CheckCircle2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CookiePolicy() {
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
          <Cookie className="h-3.5 w-3.5" />
          Technical Transparency
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground font-display">
          Cookie & Local Storage Policy
        </h1>
        <p className="text-sm text-muted-foreground">
          City Social Welfare and Development Department (CSWDD) — Butuan City
          <br />
          Effective Date: October 2026
        </p>
      </div>

      {/* Content */}
      <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
            What are Cookies and Web Storage?
          </h2>
          <p>
            Cookies and web storage technologies (such as <code>localStorage</code> and <code>sessionStorage</code>) are small text files or data entries stored in your browser when you access websites. They enable web applications to remember your session, keep you logged in safely, and maintain your preferences between page navigations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
            How the Solo Parent Portal Uses Web Storage
          </h2>
          <p>
            The Butuan City Solo Parent Portal uses only strictly essential tokens and preferences required for portal security and functionality. We do not use third-party behavioral advertising or commercial tracking cookies.
          </p>
          <div className="space-y-3 pt-2">
            <div className="rounded-2xl border border-border p-4 bg-card space-y-2">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Strictly Necessary Session Storage
              </h3>
              <p className="text-xs text-muted-foreground">
                We store your Bearer authentication token and basic profile metadata in <code>localStorage</code> to maintain your authenticated session across portal tabs. This data is transmitted securely over encrypted HTTPS connections using Sanctum tokens.
              </p>
            </div>

            <div className="rounded-2xl border border-border p-4 bg-card space-y-2">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                UI & Theme Preferences
              </h3>
              <p className="text-xs text-muted-foreground">
                We use local storage keys to store your appearance preference (light/dark mode) and sidebar collapsed states for convenient navigation.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
            Managing Your Preferences
          </h2>
          <p>
            You can clear your local storage and cookies at any time via your browser settings. Please note that clearing authentication storage will immediately log you out of the portal.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">4</span>
            Contact Us
          </h2>
          <p>
            If you have questions about how our portal manages technical storage, please contact the CSWDD IT Support team at <code>it@butuan.gov.ph</code>.
          </p>
        </section>
      </div>
    </div>
  );
}
