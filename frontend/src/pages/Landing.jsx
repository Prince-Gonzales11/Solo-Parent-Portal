import React, { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ArrowRight, Shield, FileText, Bell, Users, CheckCircle,
  Heart, Lock, UserMinus, UserX, Briefcase, FileSignature,
  Baby, Info, UploadCloud, Download, UserPlus, CheckCircle2,
  MapPin, Phone, Mail, Clock, Globe, Search, Sparkles,
  AlertCircle, HelpCircle, FileCheck, ShieldAlert, Award,
  ExternalLink, Calendar, RefreshCw, AlertTriangle
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Link, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Fallback comprehensive category data strictly based on the official "Solo Parent Categories and Requirements" PDF
const OFFICIAL_CATEGORIES_DATA = [
  {
    code: 'a1',
    name: 'Birth of a child as a consequence of rape',
    description: 'Solo parent due to the birth of a child as a consequence of rape, even without final conviction of the offender.',
    group: 'A',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s of dependent child/children.' },
      { name: 'Complaint affidavit', description: 'Copy of the sworn complaint affidavit.' },
      { name: 'Medical record on the incident of rape', description: 'Official medical records regarding the incident.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Sworn affidavit declaring that the solo parent has sole parental care and support of the child/children at the time of execution. (Note: For subsequent SPIC and booklet renewal, only this sworn affidavit shall be submitted every year).' },
      { name: 'Affidavit of a barangay official', description: 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay and the child/children is/are under their parental care and support.' },
      { name: 'Solo Parents Orientation Seminar Certificate of Attendance', description: 'Official certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return', description: 'Latest Income Tax Return (ITR) or verifiable proof of income.' }
    ]
  },
  {
    code: 'a2',
    name: 'Widow or Widower',
    description: 'Solo parent due to death of spouse.',
    group: 'A',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s of dependent child/children.' },
      { name: 'Marriage certificate', description: 'PSA-issued Marriage Certificate.' },
      { name: 'Death certificate of the spouse', description: 'PSA-issued Death Certificate of the deceased spouse.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Sworn affidavit declaring that the solo parent is not cohabiting with a partner or co-parent, and has sole parental care and support. (Note: For subsequent SPIC and booklet renewal, only this sworn affidavit shall be submitted every year).' },
      { name: 'Affidavit of a barangay official', description: 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay and child/children are under their care and support.' },
      { name: 'Solo Parents Orientation Seminar Certificate of Attendance', description: 'Official certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return', description: 'Latest Income Tax Return (ITR) or verifiable proof of income.' }
    ]
  },
  {
    code: 'a3',
    name: 'Spouse of person deprived of liberty',
    description: 'Solo parent due to detention or criminal conviction of spouse.',
    group: 'A',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s of dependent child/children.' },
      { name: 'Marriage certificate', description: 'PSA-issued Marriage Certificate.' },
      { name: 'Certificate of detention or certification', description: 'Certificate of detention or certification that spouse is serving sentence for at least three (3) months issued by law-enforcement agency having custody or court commitment order.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Sworn affidavit that the solo parent is not cohabiting with a partner/co-parent, and has sole parental care. (Note: For subsequent SPIC and booklet renewal, detention cert & sworn affidavit shall be submitted every year).' },
      { name: 'Affidavit of a barangay official', description: 'Affidavit of a barangay official attesting residency and parental care/support of child/children.' },
      { name: 'Solo Parents Orientation Seminar Certificate of Attendance', description: 'Official certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return', description: 'Latest Income Tax Return (ITR) or verifiable proof of income.' }
    ]
  },
  {
    code: 'a4',
    name: 'Spouse of person with physical or mental incapacity',
    description: 'Solo parent due to physical or mental incapacity of spouse as certified by a public medical practitioner.',
    group: 'A',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s of dependent child/children.' },
      { name: 'Marriage certificate or affidavit of cohabitation', description: 'PSA-issued Marriage Certificate or Affidavit of Cohabitation.' },
      { name: 'Medical records, abstract, or certificate of confinement', description: 'Medical records/abstract/certificate of confinement in NCMH or hospital issued within 3 months, or valid PWD ID issued pursuant to RA 10754 / RA 7277.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Sworn affidavit that the solo parent is not cohabiting and has sole parental care. (Note: Medical records & sworn affidavit must be submitted annually for renewal).' },
      { name: 'Affidavit of a barangay official', description: 'Affidavit of a barangay official attesting to residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate of Attendance', description: 'Official certificate of attendance for the Solo Parents Orientation Seminar.' }
    ]
  },
  {
    code: 'a5',
    name: 'Due to legal separation or de facto separation',
    description: 'Solo parent due to legal separation or de facto separation from spouse for at least six (6) months.',
    group: 'A',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s of dependent child/children.' },
      { name: 'Marriage certificate', description: 'PSA-issued Marriage Certificate.' },
      { name: 'Judicial decree of legal separation or affidavit of 2 disinterested persons', description: 'Judicial decree of legal separation, or in case of de facto separation, an affidavit of two (2) disinterested persons attesting to the fact of separation.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Sworn affidavit declaring that the solo parent is not cohabiting and has sole parental care. (Note: Separation proof & sworn affidavit must be submitted annually for renewal).' },
      { name: 'Affidavit of a barangay official', description: 'Affidavit of a barangay official attesting to residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate of Attendance', description: 'Official certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return', description: 'Latest Income Tax Return (ITR) or verifiable proof of income.' }
    ]
  },
  {
    code: 'a6',
    name: 'Due to nullity or annulment of marriage',
    description: 'Solo parent due to declaration of nullity or annulment of marriage, or foreign divorce recognition.',
    group: 'A',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s of dependent child/children.' },
      { name: 'Marriage certificate annotated with nullity/annulment', description: 'Marriage certificate annotated with the fact of declaration of nullity or annulment.' },
      { name: 'Judicial decree of nullity or annulment', description: 'Judicial decree of nullity or annulment of marriage, or judicial recognition of foreign divorce.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Sworn affidavit declaring no cohabitation and sole parental care. (Note: Only this sworn affidavit shall be submitted every year for renewal).' },
      { name: 'Affidavit of a barangay official', description: 'Affidavit of a barangay official attesting to residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate of Attendance', description: 'Official certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return', description: 'Latest Income Tax Return (ITR) or verifiable proof of income.' }
    ]
  },
  {
    code: 'a7',
    name: 'Abandonment by the spouse',
    description: 'Solo parent due to abandonment by the spouse for at least six (6) months.',
    group: 'A',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s of dependent child/children.' },
      { name: 'Marriage certificate or affidavit of the applicant', description: 'Marriage certificate or affidavit of the applicant solo parent.' },
      { name: 'Affidavit of two (2) disinterested persons', description: 'Affidavit of two (2) disinterested persons attesting to the fact of abandonment of the spouse.' },
      { name: 'Police or barangay record of abandonment', description: 'Official police or barangay blotter/record of the fact of abandonment.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Sworn affidavit declaring no cohabitation and sole parental care. (Note: Only this sworn affidavit must be submitted annually for renewal).' },
      { name: 'Affidavit of a barangay official', description: 'Affidavit of a barangay official attesting to residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate of Attendance', description: 'Official certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return', description: 'Latest Income Tax Return (ITR) or verifiable proof of income.' }
    ]
  },
  {
    code: 'b1',
    name: 'Spouse of OFW',
    description: 'Spouse of an Overseas Filipino Worker (OFW) who is assuming sole parental care.',
    group: 'B',
    requirements: [
      { name: 'Birth certificate/s of dependents', description: 'PSA-issued birth certificate/s of dependent child/children.' },
      { name: 'Marriage certificate', description: 'Marriage certificate if applicant is spouse, or proof of relationship if family member.' },
      { name: 'POEA-SEC or equivalent document', description: 'POEA Standard Employment Contract or its equivalent official document.' },
      { name: 'Photocopy of OFW passport', description: 'Photocopy of OFW passport showing continuous 12 months overseas work, or Bureau of Immigration certification.' },
      { name: 'Proof of income', description: 'Proof of income of the OFW spouse or family member.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Sworn affidavit declaring no cohabitation and sole parental care. (Note: Requirements 3, 4, 5, and 6 shall be submitted annually for renewal).' },
      { name: 'Affidavit of a barangay official', description: 'Affidavit of a barangay official attesting to residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate of Attendance', description: 'Official certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return', description: 'Latest Income Tax Return (ITR) or verifiable proof of income.' }
    ]
  },
  {
    code: 'b2',
    name: 'Relative of OFW',
    description: 'Any family member of an Overseas Filipino Worker (OFW) assuming sole parental care and custody.',
    group: 'B',
    requirements: [
      { name: 'Birth certificate/s of dependents', description: 'PSA-issued birth certificate/s of dependent child/children.' },
      { name: 'Birth certificate or proof of relationship', description: 'Birth certificate or other competent proof of relationship between applicant and OFW.' },
      { name: 'POEA-SEC or equivalent document', description: 'POEA Standard Employment Contract or its equivalent official document.' },
      { name: 'Photocopy of OFW passport', description: 'Photocopy of OFW passport showing continuous 12 months overseas work, or Bureau of Immigration certification.' },
      { name: 'Proof of income of the family member', description: 'Verifiable proof of income of the family member.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Sworn affidavit declaring no cohabitation and sole parental care. (Note: Requirements 3, 4, 5, and 6 shall be submitted annually for renewal).' },
      { name: 'Affidavit of a barangay official', description: 'Affidavit of a barangay official attesting to residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate of Attendance', description: 'Official certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return', description: 'Latest Income Tax Return (ITR) or verifiable proof of income.' }
    ]
  },
  {
    code: 'c',
    name: 'Unmarried person',
    description: 'Unmarried mother or father who has kept and reared the child or children.',
    group: 'C-E',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s of dependent child/children.' },
      { name: 'Certificate of No Marriage (CENOMAR)', description: 'PSA-issued Certificate of No Marriage Record (CENOMAR).' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Sworn affidavit declaring no cohabitation and sole parental care. (Note: CENOMAR, Sworn Affidavit, and Barangay Affidavit shall be submitted annually for renewal).' },
      { name: 'Affidavit of a barangay official', description: 'Affidavit of a barangay official attesting to residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate of Attendance', description: 'Official certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return', description: 'Latest Income Tax Return (ITR) or verifiable proof of income.' }
    ]
  },
  {
    code: 'd',
    name: 'Legal guardian / Adoptive parent / Foster parent',
    description: 'Any legal guardian, adoptive parent, or licensed foster parent who solely provides parental care and support.',
    group: 'C-E',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s of dependent child/children.' },
      { name: 'Proof of guardianship, adoption, or foster care', description: 'Court decree of legal guardianship; DSWD/NACC Adoption decree or order; or DSWD/NACC Foster Parent License.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Sworn affidavit declaring no cohabitation and sole parental care. (Note: Sworn affidavit and barangay affidavit shall be submitted annually for renewal).' },
      { name: 'Affidavit of a barangay official', description: 'Affidavit of a barangay official attesting to residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate of Attendance', description: 'Official certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return', description: 'Latest Income Tax Return (ITR) or verifiable proof of income.' }
    ]
  },
  {
    code: 'e',
    name: 'Relative within the fourth civil degree',
    description: 'Any relative within the 4th civil degree of consanguinity or affinity assuming sole parental care due to death, incapacity, or disappearance of parents/guardian for at least 6 months.',
    group: 'C-E',
    requirements: [
      { name: 'Birth certificate/s of the child or children', description: 'PSA-issued birth certificate/s of dependent child/children.' },
      { name: 'Death cert, incapacity cert, or judicial absence declaration', description: 'Death certificate, certificate of incapacity, or judicial declaration of absence/presumptive death, or police/barangay records of disappearance for at least 6 months.' },
      { name: 'Proof of relationship', description: 'Birth certificate, marriage certificate, family records, or analogous proof showing relationship within 4th civil degree.' },
      { name: 'Sworn affidavit declaring sole parental care', description: 'Sworn affidavit declaring sole parental care and support. (Note: Sworn affidavit and barangay affidavit shall be submitted annually for renewal).' },
      { name: 'Affidavit of a barangay official', description: 'Affidavit of a barangay official attesting to residency and parental care.' },
      { name: 'Solo Parents Orientation Seminar Certificate of Attendance', description: 'Official certificate of attendance for the Solo Parents Orientation Seminar.' },
      { name: 'Income Tax Return', description: 'Latest Income Tax Return (ITR) or verifiable proof of income.' }
    ]
  },
  {
    code: 'f',
    name: 'Pregnant woman',
    description: 'A pregnant woman who provides sole parental care and support to her unborn child or children without cohabitation or partner support.',
    group: 'F',
    requirements: [
      { name: 'Medical record of her pregnancy', description: 'Official medical record or certificate of pregnancy from an authorized healthcare facility.' },
      { name: 'Affidavit of a barangay official', description: 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay.' },
      { name: 'Sworn affidavit', description: 'Sworn affidavit declaring that the solo parent is not cohabiting with a partner or co-parent who is providing support.' },
      { name: 'Solo Parents Orientation Seminar Certificate of Attendance', description: 'Official certificate of attendance for the Solo Parents Orientation Seminar.' }
    ]
  }
];

export default function Landing() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState(OFFICIAL_CATEGORIES_DATA);
  const [stats, setStats] = useState({ registered_parents: 0, ids_issued: 0 });
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [faqs, setFaqs] = useState([]);
  const [benefits, setBenefits] = useState([]);
  const [resources, setResources] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState(false);

  // Search & Filter state for Categories
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState('all');

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoadingData(true);
        setDataError(false);
        const response = await api.get('/public/landing-data');
        const data = response.data;

        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
        } else {
          setCategories(OFFICIAL_CATEGORIES_DATA);
        }

        setStats(data.stats || { registered_parents: 0, ids_issued: 0 });
        setFaqs(data.faqs || []);
        setBenefits(data.benefits || []);
        setResources(data.resources || []);
        setAnnouncements(data.announcements || []);
      } catch (err) {
        console.error("Failed to load public data, using fallback", err);
        setDataError(true);
        setCategories(OFFICIAL_CATEGORIES_DATA);
      } finally {
        setIsLoadingData(false);
      }
    }
    fetchData();
  }, []);

  const getCategoryIcon = (code) => {
    const icons = {
      'a1': <ShieldAlert className="h-5 w-5" />,
      'a2': <Heart className="h-5 w-5" />,
      'a3': <Lock className="h-5 w-5" />,
      'a4': <UserX className="h-5 w-5" />,
      'a5': <UserMinus className="h-5 w-5" />,
      'a6': <FileSignature className="h-5 w-5" />,
      'a7': <Briefcase className="h-5 w-5" />,
      'b1': <Globe className="h-5 w-5" />,
      'b2': <Users className="h-5 w-5" />,
      'c': <Users className="h-5 w-5" />,
      'd': <Shield className="h-5 w-5" />,
      'e': <Users className="h-5 w-5" />,
      'f': <Baby className="h-5 w-5" />,
    };
    return icons[code?.toLowerCase()] || <FileText className="h-5 w-5" />;
  };

  // Filter categories based on search query and active group tab
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const codeStr = (c.code || '').toLowerCase();
      const nameStr = (c.name || '').toLowerCase();
      const descStr = (c.description || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      // Check group match
      let matchesGroup = true;
      if (activeGroup === 'A') {
        matchesGroup = codeStr.startsWith('a');
      } else if (activeGroup === 'B') {
        matchesGroup = codeStr.startsWith('b');
      } else if (activeGroup === 'C-E') {
        matchesGroup = ['c', 'd', 'e'].includes(codeStr);
      } else if (activeGroup === 'F') {
        matchesGroup = codeStr === 'f';
      }

      // Check search match
      let matchesSearch = true;
      if (q) {
        const reqMatch = c.requirements?.some(r =>
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.description && r.description.toLowerCase().includes(q))
        );
        matchesSearch = codeStr.includes(q) || nameStr.includes(q) || descStr.includes(q) || reqMatch;
      }

      return matchesGroup && matchesSearch;
    });
  }, [categories, searchQuery, activeGroup]);

  return (
    <div className="flex-1 font-sans">
      {/* Hero Section */}
      <section id="home" className="relative w-full flex flex-col" style={{ minHeight: '560px' }}>
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/hero_bg.png"
            alt="Mother and child"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d4f68]/95 via-[#0d4f68]/80 to-[#197b8a]/50" />
        </div>

        {/* Hero Content — 2 column grid */}
        <div className="relative z-10 flex-1 flex items-center">
          <div className="container px-4 sm:px-6 lg:px-8 max-w-7xl py-16 lg:py-20">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

              {/* Left: Text */}
              <div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-5 font-display tracking-tight">
                  Your Solo Parent ID,<br className="hidden sm:block" /> applied for entirely<br className="hidden sm:block" /> online.
                </h1>

                <p className="text-base lg:text-lg text-white/90 mb-8 leading-relaxed font-light max-w-lg">
                  A government digital platform to register, apply, submit requirements, and track your Solo Parent Identification Card — no more long queues or endless paperwork.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  <Button asChild size="lg" className="rounded-full bg-card text-[#0d4f68] hover:bg-card/90 min-h-[44px] px-6 font-semibold border-none shadow-lg w-full sm:w-auto justify-center">
                    <Link to="/register">
                      Start your application <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="rounded-full bg-transparent text-white border-white/60 hover:bg-card/10 hover:text-white min-h-[44px] px-6 font-semibold w-full sm:w-auto justify-center">
                    <a href="#categories">Explore Categories & Requirements</a>
                  </Button>
                </div>
              </div>

              {/* Right: Sample ID Card */}
              <div className="hidden lg:flex justify-end items-center">
                <div className="relative" style={{ width: '420px' }}>
                  <div className="relative p-2 rounded-2xl bg-card/15 backdrop-blur-sm border border-white/25 shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-500">
                    <img
                      src="/images/sample_id.png"
                      alt="Sample Solo Parent ID"
                      className="w-full h-auto rounded-xl object-cover"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="relative z-20 w-full bg-[#3e897a] py-6 sm:py-8">
          <div className="container px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center md:divide-x md:divide-white/20">
              <div className="px-2 sm:px-4">
                <p className="text-3xl sm:text-4xl font-bold text-white font-display mb-1">{stats.registered_parents || 23}</p>
                <p className="text-[11px] sm:text-sm font-bold text-white/90 uppercase tracking-widest">Registered Parents</p>
              </div>
              <div className="px-2 sm:px-4">
                <p className="text-3xl sm:text-4xl font-bold text-white font-display mb-1">{stats.ids_issued || 6}</p>
                <p className="text-[11px] sm:text-sm font-bold text-white/90 uppercase tracking-widest">Solo Parent IDs Issued</p>
              </div>
              <div className="px-2 sm:px-4">
                <p className="text-3xl sm:text-4xl font-bold text-white font-display mb-1">13</p>
                <p className="text-[11px] sm:text-sm font-bold text-white/90 uppercase tracking-widest">Recognized Categories</p>
              </div>
              <div className="px-2 sm:px-4 border-r-0">
                <p className="text-3xl sm:text-4xl font-bold text-white font-display mb-1">24/7</p>
                <p className="text-[11px] sm:text-sm font-bold text-white/90 uppercase tracking-widest">Online Access</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Announcements Section */}
      {announcements.length > 0 && (
        <section className="py-20 bg-card border-t border-border/50" id="announcements">
          <div className="container px-4 sm:px-6 lg:px-8 max-w-7xl">
            <div className="mb-12">
              <p className="text-[#3e897a] dark:text-[#64b5a6] text-xs font-bold tracking-[0.2em] uppercase mb-4">Office Announcements</p>
              <h2 className="text-4xl font-bold text-[#1a2b3b] dark:text-foreground font-display">Latest updates & notices</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {announcements.map((a) => (
                <Card key={a.id} className="border border-border/50 shadow-sm rounded-2xl bg-card">
                  <CardContent className="p-8 flex flex-col h-full">
                    <div className="mb-4">
                      <span className="text-xs font-bold tracking-wider uppercase bg-[#fff3ec] text-[#d97746] px-3 py-1 rounded-full">
                        {a.category || 'General'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-[#1a2b3b] dark:text-foreground mb-3 leading-tight">{a.title}</h3>
                    <p className="text-sm text-muted-foreground mb-6 flex-1 whitespace-pre-line line-clamp-4">{a.body}</p>
                    <p className="text-xs text-muted-foreground/80 font-medium">{new Date(a.published_at).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories & Requirements Section (Based directly on PDF) */}
      <section className="py-24 bg-muted/30" id="categories">
        <div className="container px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-[#3e897a] dark:text-[#64b5a6] text-xs font-bold tracking-[0.2em] uppercase mb-4">
                Solo Parent Categories & Requirements
              </p>
              <h2 className="text-4xl font-bold text-[#1a2b3b] dark:text-foreground mb-4 font-display">
                Which category do you belong to?
              </h2>
              <p className="text-[#4b5563] dark:text-muted-foreground text-lg max-w-3xl leading-relaxed">
                13 categories of solo parents are officially recognized. Click on any category card to view its specific documentary requirements, annual renewal conditions, and guidelines.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <a
                href="/downloads/Solo_Parent_Categories_and_Requirements.pdf"
                download
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#eef7f6] dark:bg-[#eef7f6]/10 text-[#0e4b65] dark:text-[#64b5a6] hover:bg-[#e0f0ee] transition-colors border border-[#3e897a]/20 shadow-sm"
              >
                <Download className="h-4 w-4" /> Download Official PDF Guide
              </a>
            </div>
          </div>

          {/* Search and Group Filter Tabs */}
          <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {[
                { id: 'all', label: 'All 13 Categories' },
                { id: 'A', label: 'Group A: Spouse Situations (A1–A7)' },
                { id: 'B', label: 'Group B: OFW Families (B1–B2)' },
                { id: 'C-E', label: 'Group C–E: Unmarried & Guardians' },
                { id: 'F', label: 'Group F: Pregnant Women' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveGroup(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${activeGroup === tab.id
                    ? 'bg-[#0e4b65] text-white shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search category or requirement..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 text-sm bg-muted/30 rounded-xl border-border/60 focus:bg-card"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Categories Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map((c) => {
              const reqCount = c.requirements ? c.requirements.length : 0;
              return (
                <div
                  key={c.code || c.id}
                  className="card-pop card-pop-hover rounded-3xl p-7 transition-all flex flex-col justify-between group border border-border/80"
                >
                  <div className="flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-5">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#eef7f6] to-[#d6efeb] dark:from-[#0e4b65]/40 dark:to-[#197b8a]/30 text-[#0e4b65] dark:text-[#64b5a6] flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xs border border-[#3e897a]/20">
                        {getCategoryIcon(c.code)}
                      </div>
                      <span className="text-[#0e4b65] dark:text-[#64b5a6] font-bold text-xs font-mono bg-[#eef7f6] dark:bg-[#eef7f6]/10 px-3 py-1 rounded-full uppercase tracking-wider border border-[#3e897a]/20 shadow-2xs">
                        Category {c.code?.toUpperCase()}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-[#1a2b3b] dark:text-foreground mb-2 leading-snug font-display">
                      {c.name}
                    </h3>

                    <p className="text-sm text-muted-foreground mb-6 line-clamp-3 leading-relaxed flex-1">
                      {c.description}
                    </p>

                    {/* Requirements Preview Summary */}
                    <div className="pt-4 border-t border-border/50 flex items-center justify-between mt-auto">
                      <span className="text-sm font-semibold text-[#0e4b65] dark:text-[#64b5a6] flex items-center gap-1.5">
                        <FileCheck className="h-4 w-4" />
                        {reqCount} Required Document{reqCount !== 1 ? 's' : ''}
                      </span>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-4 text-xs sm:text-sm font-semibold border-border/80 text-[#1a2b3b] dark:text-foreground hover:bg-[#0e4b65] hover:text-white dark:hover:bg-primary dark:hover:text-primary-foreground rounded-xl transition-all shadow-2xs"
                        onClick={() => setSelectedCategory(c)}
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" /> View Requirements
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredCategories.length === 0 && (
            <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border/70 p-8">
              <Search className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-[#1a2b3b] dark:text-foreground mb-1">No categories match your search</h3>
              <p className="text-sm text-muted-foreground mb-4">Try searching for keywords like "widow", "OFW", "rape", "CENOMAR", "separation", or clear filters.</p>
              <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setActiveGroup('all'); }}>
                Reset Filters
              </Button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SPECIAL GUIDELINES & REMINDERS (Directly from the PDF) */}
          {/* ========================================================================= */}
          <div className="mt-16 pt-12 border-t border-border/60">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <p className="text-[#3e897a] dark:text-[#64b5a6] text-xs font-bold tracking-[0.2em] uppercase mb-2">
                Essential Guidelines & Supplemental Provisions
              </p>
              <h3 className="text-3xl font-bold text-[#1a2b3b] dark:text-foreground font-display">
                Additional benefits, ID replacement, and reminders
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                Official rules and required documents from the City Social Welfare and Development Office (CSWDO).
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">

              {/* Card 1: Additional Benefits */}
              <div className="card-pop card-pop-hover rounded-3xl p-7 flex flex-col justify-between relative overflow-hidden border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 via-card to-card">
                <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center gap-3.5 mb-5">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 font-bold shadow-md shadow-emerald-600/20">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/70 px-2.5 py-1 rounded-md inline-block">RA 11861 Subsidies</span>
                      <h4 className="text-lg font-bold text-[#1a2b3b] dark:text-foreground leading-snug mt-1 font-display">
                        For Availing Additional Benefits
                      </h4>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    Qualified low-income solo parents earning minimum wage or below can avail of monthly cash subsidies and 10% discounts on baby essentials by submitting:
                  </p>

                  <div className="space-y-3 mb-6">
                    <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 rounded-2xl p-4 text-sm text-[#1a2b3b] dark:text-emerald-200 shadow-2xs">
                      <strong className="block font-bold mb-1.5 text-emerald-900 dark:text-emerald-300 text-sm">1. Proof of Income / Employment:</strong>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground dark:text-emerald-200/80">
                        <li>Affidavit of no employment; OR</li>
                        <li>Income Tax Return (ITR) or similar tax returns; OR</li>
                        <li>Any verifiable proof of income</li>
                      </ul>
                    </div>

                    <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 rounded-2xl p-4 text-sm text-[#1a2b3b] dark:text-emerald-200 shadow-2xs">
                      <strong className="block font-bold mb-1.5 text-emerald-900 dark:text-emerald-300 text-sm">2. Social Assessment / Indigency:</strong>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground dark:text-emerald-200/80">
                        <li>Social case study issued by the C/MSWDO; OR</li>
                        <li>Barangay Certificate of Indigency</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5 pt-3 border-t border-emerald-500/20">
                  <span>✓</span> Eligible for 10% VAT exemption on baby milk, diapers & medicines up to 6 yrs old.
                </p>
              </div>

              {/* Card 2: Lost SPIC */}
              <div className="card-pop card-pop-hover rounded-3xl p-7 flex flex-col justify-between relative overflow-hidden border-2 border-amber-500/30 bg-gradient-to-b from-amber-500/5 via-card to-card">
                <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center gap-3.5 mb-5">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 font-bold shadow-md shadow-amber-500/20">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/70 px-2.5 py-1 rounded-md inline-block">Card Replacement</span>
                      <h4 className="text-lg font-bold text-[#1a2b3b] dark:text-foreground leading-snug mt-1 font-display">
                        For Loss of Solo Parent ID (SPIC)
                      </h4>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    If your official Solo Parent Identification Card (SPIC) is lost, stolen, or damaged, you must present the following 4 requirements for replacement:
                  </p>

                  <ul className="space-y-2.5 mb-6">
                    <li className="flex items-start gap-3 text-sm text-foreground/90 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/50 dark:border-amber-800/30 shadow-2xs">
                      <span className="h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-2xs">1</span>
                      <span><strong>Affidavit of Loss</strong> declaring the circumstance of the lost card</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-foreground/90 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/50 dark:border-amber-800/30 shadow-2xs">
                      <span className="h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-2xs">2</span>
                      <span><strong>1 pc 1×1 ID Picture</strong> (recent, white background)</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-foreground/90 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/50 dark:border-amber-800/30 shadow-2xs">
                      <span className="h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-2xs">3</span>
                      <span><strong>Sworn Affidavit</strong> of continuous sole parental custody</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-foreground/90 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/50 dark:border-amber-800/30 shadow-2xs">
                      <span className="h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-2xs">4</span>
                      <span><strong>Affidavit of Barangay Official</strong> attesting to residency and custody</span>
                    </li>
                  </ul>
                </div>

                <p className="text-sm text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1.5 pt-3 border-t border-amber-500/20">
                  <span>⚠️</span> Request replacement via the portal or CSWDD office directly.
                </p>
              </div>

              {/* Card 3: Other Reminders */}
              <div className="card-pop card-pop-hover rounded-3xl p-7 flex flex-col justify-between relative overflow-hidden border-2 border-sky-500/30 bg-gradient-to-b from-sky-500/5 via-card to-card">
                <div className="absolute top-0 right-0 w-28 h-28 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center gap-3.5 mb-5">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center shrink-0 font-bold shadow-md shadow-sky-600/20">
                      <Info className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-100/70 dark:bg-sky-950/70 px-2.5 py-1 rounded-md inline-block">Office Policies</span>
                      <h4 className="text-lg font-bold text-[#1a2b3b] dark:text-foreground leading-snug mt-1 font-display">
                        Other Important Reminders
                      </h4>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    Please take note of the mandatory submission standards and assessment requirements set by the CSWDD:
                  </p>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-3 text-sm text-foreground/90 bg-sky-50/50 dark:bg-sky-950/20 p-3 rounded-xl border border-sky-200/50 dark:border-sky-800/30 shadow-2xs">
                      <span className="text-base leading-none shrink-0 mt-0.5">📸</span>
                      <span><strong>2 pcs 1×1 ID Pictures:</strong> Submit 2 pcs 1×1 ID Picture for every new application and annual renewal.</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-foreground/90 bg-sky-50/50 dark:bg-sky-950/20 p-3 rounded-xl border border-sky-200/50 dark:border-sky-800/30 shadow-2xs">
                      <span className="text-base leading-none shrink-0 mt-0.5">📑</span>
                      <span><strong>Original & Photocopy:</strong> Always bring the original and photocopy of PSA birth certificate/s of your children.</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-foreground/90 bg-sky-50/50 dark:bg-sky-950/20 p-3 rounded-xl border border-sky-200/50 dark:border-sky-800/30 shadow-2xs">
                      <span className="text-base leading-none shrink-0 mt-0.5">👤</span>
                      <span><strong>Personal Application:</strong> The applicant solo parent must personally apply for verification.</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-foreground/90 bg-sky-50/50 dark:bg-sky-950/20 p-3 rounded-xl border border-sky-200/50 dark:border-sky-800/30 shadow-2xs">
                      <span className="text-base leading-none shrink-0 mt-0.5">🏠</span>
                      <span><strong>Interview & Home Visit:</strong> All new and renewal applicants are subject to interview and home visit.</span>
                    </li>
                  </ul>
                </div>

                <p className="text-sm text-sky-700 dark:text-sky-400 font-semibold flex items-center gap-1.5 pt-3 border-t border-sky-500/20">
                  <span>ℹ️</span> Valid for 1 year; renew with the designated annual requirements.
                </p>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* The Process / How to Apply Section */}
      <section className="py-24 bg-[#f8fafc] dark:bg-background" id="process">
        <div id="how-to-apply" />
        <div className="container px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="mb-16">
            <p className="text-[#3e897a] dark:text-[#64b5a6] text-xs font-bold tracking-[0.2em] uppercase mb-4">The Process</p>
            <h2 className="text-4xl font-bold text-[#1a2b3b] dark:text-foreground font-display">Apply in four simple steps</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border border-border/50 shadow-sm rounded-2xl bg-card relative overflow-hidden group hover:border-primary/40 transition-colors">
              <CardContent className="p-8">
                <div className="absolute -right-4 -top-4 text-[120px] font-bold text-gray-50/80 dark:text-white/5 leading-none pointer-events-none group-hover:text-[#eef7f6]/50 dark:group-hover:text-primary/10 transition-colors">1</div>
                <div className="relative z-10">
                  <UserPlus className="h-8 w-8 text-[#0e4b65] dark:text-[#64b5a6] mb-6" />
                  <h3 className="text-lg font-bold text-[#1a2b3b] dark:text-foreground mb-3">Register Account</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">Create your free account with Google or email verification.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 shadow-sm rounded-2xl bg-card relative overflow-hidden group hover:border-primary/40 transition-colors">
              <CardContent className="p-8">
                <div className="absolute -right-4 -top-4 text-[120px] font-bold text-gray-50/80 dark:text-white/5 leading-none pointer-events-none group-hover:text-[#eef7f6]/50 dark:group-hover:text-primary/10 transition-colors">2</div>
                <div className="relative z-10">
                  <FileText className="h-8 w-8 text-[#0e4b65] dark:text-[#64b5a6] mb-6" />
                  <h3 className="text-lg font-bold text-[#1a2b3b] dark:text-foreground mb-3">Fill Profile & Form</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">Provide your personal details, family members, income, and classification.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 shadow-sm rounded-2xl bg-card relative overflow-hidden group hover:border-primary/40 transition-colors">
              <CardContent className="p-8">
                <div className="absolute -right-4 -top-4 text-[120px] font-bold text-gray-50/80 dark:text-white/5 leading-none pointer-events-none group-hover:text-[#eef7f6]/50 dark:group-hover:text-primary/10 transition-colors">3</div>
                <div className="relative z-10">
                  <UploadCloud className="h-8 w-8 text-[#0e4b65] dark:text-[#64b5a6] mb-6" />
                  <h3 className="text-lg font-bold text-[#1a2b3b] dark:text-foreground mb-3">Upload Documents</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">Upload clear photos or scans of your required category documents.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 shadow-sm rounded-2xl bg-card relative overflow-hidden group hover:border-primary/40 transition-colors">
              <CardContent className="p-8">
                <div className="absolute -right-4 -top-4 text-[120px] font-bold text-gray-50/80 dark:text-white/5 leading-none pointer-events-none group-hover:text-[#eef7f6]/50 dark:group-hover:text-primary/10 transition-colors">4</div>
                <div className="relative z-10">
                  <CheckCircle2 className="h-8 w-8 text-[#0e4b65] dark:text-[#64b5a6] mb-6" />
                  <h3 className="text-lg font-bold text-[#1a2b3b] dark:text-foreground mb-3">Review & Receive ID</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">Perform a complete final review, submit, and track approval in real time.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-card" id="benefits">
        <div className="container px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="mb-12">
            <p className="text-[#3e897a] dark:text-[#64b5a6] text-xs font-bold tracking-[0.2em] uppercase mb-4">Benefits & Privileges</p>
            <h2 className="text-4xl font-bold text-[#1a2b3b] dark:text-foreground mb-6 font-display">What qualified solo parents receive under RA 11861</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(benefits.length > 0 ? benefits : [
              { title: "Parental Leave", desc: "Seven (7) working days of parental leave with pay for solo parents who have rendered at least six months of service." },
              { title: "Educational Assistance", desc: "Scholarship programs and educational assistance for qualified solo parents and their dependent children." },
              { title: "Housing Benefits", desc: "Priority in government housing programs and liberal terms of payment from NHA and socialized housing." },
              { title: "Medical Assistance", desc: "Comprehensive health and medical care programs for solo parents and their children in public hospitals." },
              { title: "10% Discount & VAT Exemption", desc: "On baby needs such as milk, food supplements, medicines, and diapers for children up to 6 years old (for low-income solo parents)." },
              { title: "Flexible Work Schedule", desc: "Right to a flexible work schedule provided it does not affect employer productivity and operational requirements." }
            ]).map((b, i) => (
              <Card key={i} className="border border-border/50 shadow-sm rounded-2xl bg-card hover:shadow-md transition-all">
                <CardContent className="p-8">
                  <div className="h-12 w-12 rounded-xl bg-[#eef7f6] dark:bg-[#eef7f6]/10 text-[#3e897a] dark:text-primary flex items-center justify-center font-bold text-lg mb-6">
                    {i + 1}
                  </div>
                  <h3 className="text-lg font-bold text-[#1a2b3b] dark:text-foreground mb-3">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* The Law Section */}
      <section className="py-24 bg-[#0e4b65] text-white" id="the-law">
        <div className="container px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="max-w-3xl mb-16">
            <p className="text-[#64b5a6] text-xs font-bold tracking-[0.2em] uppercase mb-4">The Law</p>
            <h2 className="text-5xl font-bold mb-2 font-display">Republic Act No. 11861</h2>
            <p className="text-xl text-white/80 font-medium mb-6">The Expanded Solo Parents Welfare Act</p>
            <p className="text-white/70 leading-relaxed text-lg">
              Signed into law in 2022, RA 11861 strengthens and expands the benefits and privileges afforded to solo parents and their children. It broadens the definition of a solo parent across 13 categories, increases financial support programs, and provides additional discounts, leave benefits, and social protection, ensuring no solo parent is left behind.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-[#1a5b73] p-8 rounded-2xl border border-white/10">
              <h3 className="text-xl font-bold mb-3">13 Recognized Categories</h3>
              <p className="text-white/70 text-sm leading-relaxed">Recognizes spouses, unmarried parents, OFW guardians, adoptive/foster parents, relatives, and pregnant women.</p>
            </div>
            <div className="bg-[#1a5b73] p-8 rounded-2xl border border-white/10">
              <h3 className="text-xl font-bold mb-3">Expanded Benefits</h3>
              <p className="text-white/70 text-sm leading-relaxed">Parental leave, 10% VAT-exempt baby discounts, educational scholarships, and housing priority.</p>
            </div>
            <div className="bg-[#1a5b73] p-8 rounded-2xl border border-white/10">
              <h3 className="text-xl font-bold mb-3">Stronger Protection</h3>
              <p className="text-white/70 text-sm leading-relaxed">Anti-discrimination provisions, legal protection, and comprehensive social welfare support from CSWDD.</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-24 bg-card" id="how-it-works">
        <div className="container px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[#3e897a] dark:text-[#64b5a6] text-xs font-bold tracking-[0.2em] uppercase mb-4">About the Portal</p>
              <h2 className="text-4xl font-bold text-[#1a2b3b] dark:text-foreground mb-6 font-display leading-tight">
                Modernizing solo parent welfare services
              </h2>
              <p className="text-[#4b5563] dark:text-muted-foreground mb-10 leading-relaxed text-lg">
                The Solo Parent Portal digitizes the traditional paper-based process of applying for a Solo Parent Identification Card. Our goal is to make government services more accessible, transparent, and efficient for every Filipino solo parent.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                <Card className="border shadow-sm border-border/50 bg-card rounded-xl">
                  <CardContent className="p-6">
                    <Shield className="h-6 w-6 text-[#3e897a] dark:text-[#64b5a6] mb-4" />
                    <h3 className="font-bold text-[#1a2b3b] dark:text-foreground mb-2">Secure & Private</h3>
                    <p className="text-sm text-muted-foreground">Compliant with the Data Privacy Act (RA 10173).</p>
                  </CardContent>
                </Card>
                <Card className="border shadow-sm border-border/50 bg-card rounded-xl">
                  <CardContent className="p-6">
                    <FileText className="h-6 w-6 text-[#3e897a] dark:text-[#64b5a6] mb-4" />
                    <h3 className="font-bold text-[#1a2b3b] dark:text-foreground mb-2">Paperless Filing</h3>
                    <p className="text-sm text-muted-foreground">Upload and manage requirements digitally.</p>
                  </CardContent>
                </Card>
                <Card className="border shadow-sm border-border/50 bg-card rounded-xl">
                  <CardContent className="p-6">
                    <Bell className="h-6 w-6 text-[#3e897a] dark:text-[#64b5a6] mb-4" />
                    <h3 className="font-bold text-[#1a2b3b] dark:text-foreground mb-2">Real-time Updates</h3>
                    <p className="text-sm text-muted-foreground">Get notified at every stage of your application.</p>
                  </CardContent>
                </Card>
                <Card className="border shadow-sm border-border/50 bg-card rounded-xl">
                  <CardContent className="p-6">
                    <Users className="h-6 w-6 text-[#3e897a] dark:text-[#64b5a6] mb-4" />
                    <h3 className="font-bold text-[#1a2b3b] dark:text-foreground mb-2">For Every Solo Parent</h3>
                    <p className="text-sm text-muted-foreground">Inclusive of all 13 categories under RA 11861.</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="relative">
              <img
                src="/images/about_image.png"
                alt="Mother and baby"
                className="w-full h-auto rounded-3xl object-cover shadow-2xl aspect-[4/3]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ and Resources */}
      <section className="py-24 bg-[#f8fafc] dark:bg-background border-y border-border/50" id="faq">
        <div className="container px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* FAQ */}
            <div>
              <p className="text-[#3e897a] dark:text-[#64b5a6] text-xs font-bold tracking-[0.2em] uppercase mb-4">Questions</p>
              <h2 className="text-4xl font-bold text-[#1a2b3b] dark:text-foreground mb-10 font-display">Frequently asked questions</h2>

              <Accordion type="single" collapsible className="w-full">
                {(faqs.length > 0 ? faqs : [
                  {
                    q: "Who is considered a solo parent under RA 11861?",
                    a: "A solo parent is any individual who is left alone with the responsibility of parenthood due to death of spouse, detention of spouse, physical/mental incapacity of spouse, legal or de facto separation, annulment, abandonment, being an unmarried parent, an OFW relative/spouse, a legal guardian, adoptive/foster parent, relative within 4th civil degree, or a pregnant woman."
                  },
                  {
                    q: "What is the Solo Parent Identification Card (SPIC)?",
                    a: "The Solo Parent ID is an official government ID issued by the City/Municipal Social Welfare and Development Office that entitles qualified solo parents to leave benefits, educational subsidies, discounts, and protection under RA 11861."
                  },
                  {
                    q: "How long is the Solo Parent ID valid?",
                    a: "The Solo Parent ID is valid for one (1) year from issuance and is renewable annually upon submission of designated renewal requirements (e.g. Sworn Affidavit and Barangay Affidavit)."
                  },
                  {
                    q: "What if I lost my Solo Parent ID card?",
                    a: "If lost, submit an Affidavit of Loss, 1 pc 1x1 ID Picture, Sworn Affidavit, and an Affidavit of a Barangay Official to request a replacement."
                  },
                  {
                    q: "Is there any fee to apply?",
                    a: "No. The issuance of the Solo Parent ID is completely free of charge in accordance with the law."
                  }
                ]).map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-b border-border/50 py-2">
                    <AccordionTrigger className="text-left font-bold text-[#1a2b3b] dark:text-foreground hover:text-[#3e897a] hover:no-underline text-base">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Resources */}
            <div id="resources">
              <p className="text-[#3e897a] dark:text-[#64b5a6] text-xs font-bold tracking-[0.2em] uppercase mb-4">Downloads</p>
              <h2 className="text-4xl font-bold text-[#1a2b3b] dark:text-foreground mb-3 font-display">Official Documents & Resources</h2>
              <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                Download official forms, category requirement guidelines, and full legal references for your Solo Parent ID application.
              </p>

              <div className="space-y-4">
                {(resources.length > 0 ? resources : [
                  {
                    name: 'Solo Parent Categories and Requirements',
                    description: 'Official complete guide of recognized solo parent categories (A1 to F), specific documentary requirements, additional benefits requirements, and general reminders.',
                    type: 'PDF',
                    url: '/downloads/Solo_Parent_Categories_and_Requirements.pdf'
                  },
                  {
                    name: 'Solo Parent Application Form',
                    description: 'Official CSWDD application form for the Solo Parent Identification Card (SPIC).',
                    type: 'PDF',
                    url: '/downloads/Solo_Parent_Application_Form.pdf'
                  },
                  {
                    name: 'Republic Act No. 11861 – Expanded Solo Parents Welfare Act',
                    description: 'Full official text of Republic Act No. 11861 published by the Official Gazette.',
                    type: 'PDF',
                    url: 'https://www.officialgazette.gov.ph/downloads/2022/06jun/20220604-RA-11861-RRD.pdf'
                  },
                ]).map((res, idx) => (
                  <a
                    key={res.name || idx}
                    href={res.url !== '#' ? res.url : undefined}
                    download={res.url && res.url.startsWith('/downloads') ? true : undefined}
                    target={res.url && res.url.startsWith('http') ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className={`flex items-start gap-4 p-5 bg-card border border-border/60 rounded-2xl shadow-sm transition-all group ${res.url !== '#' ? 'hover:border-[#3e897a]/50 hover:shadow-md cursor-pointer' : 'cursor-default opacity-75'
                      }`}
                  >
                    <div className="h-11 w-11 shrink-0 rounded-xl bg-[#eef7f6] dark:bg-[#eef7f6]/10 flex items-center justify-center group-hover:scale-110 transition-transform text-[#0e4b65] dark:text-[#64b5a6]">
                      <Download className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-bold text-[#1a2b3b] dark:text-foreground text-sm group-hover:text-[#3e897a] transition-colors">{res.name}</h4>
                        <span className="text-xs font-semibold bg-[#eef7f6] dark:bg-[#eef7f6]/10 text-[#0e4b65] dark:text-[#64b5a6] px-2.5 py-1 rounded-full uppercase border border-[#3e897a]/20">{res.type || 'PDF'}</span>
                      </div>
                      {res.description && <p className="text-sm text-muted-foreground leading-relaxed">{res.description}</p>}
                    </div>
                    {res.url !== '#' && <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-[#3e897a] transition-all group-hover:translate-x-1 shrink-0 mt-1" />}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Office & Contact Section */}
      <section className="py-24 bg-card" id="contact">
        <div className="container px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-[#3e897a] dark:text-[#64b5a6] text-xs font-bold tracking-[0.2em] uppercase mb-4">Get in touch</p>
              <h2 className="text-4xl font-bold text-[#1a2b3b] dark:text-foreground mb-12 font-display">Office & contact information</h2>

              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-[#eef7f6] dark:bg-[#eef7f6]/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-[#3e897a] dark:text-[#64b5a6]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1a2b3b] dark:text-foreground text-sm mb-1">Office Address</h4>
                    <p className="text-muted-foreground text-sm">PS Arcade, 471 Jose Rosales Ave, Butuan City, 8600 Agusan del Norte</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-[#eef7f6] dark:bg-[#eef7f6]/10 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-[#3e897a] dark:text-[#64b5a6]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1a2b3b] dark:text-foreground text-sm mb-1">Hotline</h4>
                    <p className="text-muted-foreground text-sm">+63 956 224 1679</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-[#eef7f6] dark:bg-[#eef7f6]/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-[#3e897a] dark:text-[#64b5a6]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1a2b3b] dark:text-foreground text-sm mb-1">Email</h4>
                    <p className="text-muted-foreground text-sm">cswdd@butuan.gov.ph (or cswdobutuan@gmail.com)</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-[#eef7f6] dark:bg-[#eef7f6]/10 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-[#3e897a] dark:text-[#64b5a6]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1a2b3b] dark:text-foreground text-sm mb-1">Official Facebook Page</h4>
                    <p className="text-muted-foreground text-sm">CSWD Department Butuan</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-[#eef7f6] dark:bg-[#eef7f6]/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-[#3e897a] dark:text-[#64b5a6]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1a2b3b] dark:text-foreground text-sm mb-1">Office Hours</h4>
                    <p className="text-muted-foreground text-sm">Monday to Friday · 8:00 AM – 5:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-[400px] w-full rounded-3xl overflow-hidden shadow-lg border border-border/50">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3941.047806140656!2d125.5318378!3d8.9469963!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3301c05adcffba6b%3A0x99301ed34fb10fa9!2sCity%20Social%20Welfare%20and%20Development!5e0!3m2!1sen!2sph!4v1700000000000!5m2!1sen!2sph"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Google Maps CSWDD Office Butuan City"
              ></iframe>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-[#0e4b65] text-center">
        <div className="container px-4 max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 font-display leading-tight">Ready to apply for your Solo Parent ID?</h2>
          <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto">
            Join thousands of Filipino solo parents accessing their rightful benefits, the modern, hassle-free way.
          </p>
          <Button asChild size="lg" className="rounded-full bg-card text-[#0e4b65] hover:bg-card/90 h-14 px-8 font-semibold text-lg border-none shadow-xl">
            <Link to="/register">
              Create your free account <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Detailed Category Modal (Dialog) */}
      <Dialog open={!!selectedCategory} onOpenChange={(open) => !open && setSelectedCategory(null)}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden rounded-2xl border-none max-h-[92vh] flex flex-col bg-card">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedCategory?.name || 'Category Requirements'}</DialogTitle>
            <DialogDescription>{selectedCategory?.description || 'Details of requirements for this category'}</DialogDescription>
          </DialogHeader>

          {selectedCategory && (
            <div className="flex flex-col h-full overflow-hidden transition-all duration-200">
              {/* Modal Header */}
              <div className="bg-[#0e4b65] p-6 sm:p-8 text-white relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold font-mono tracking-widest uppercase bg-white/15 px-3 py-1 rounded-full text-white/90 border border-white/20">
                    Category {selectedCategory.code?.toUpperCase()}
                  </span>
                  <span className="text-xs text-white/80">
                    Republic Act No. 11861
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold font-display text-white mb-2 leading-tight">
                  {selectedCategory.name}
                </h2>

                <p className="text-sm text-white/80 leading-relaxed max-w-2xl">
                  {selectedCategory.description}
                </p>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">

                {/* Category Documentary Requirements */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[#0e4b65] dark:text-[#64b5a6] text-xs font-bold tracking-[0.15em] uppercase flex items-center gap-1.5">
                      <FileCheck className="h-4 w-4" />
                      Specific Documentary Requirements
                    </h4>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {selectedCategory.requirements?.length || 0} items
                    </span>
                  </div>

                  <ul className="space-y-3">
                    {selectedCategory.requirements?.map((req, idx) => (
                      <li key={idx} className="flex gap-3.5 p-3.5 rounded-xl bg-muted/40 border border-border/50">
                        <div className="h-6 w-6 rounded-full bg-[#0e4b65] text-white dark:bg-[#64b5a6] dark:text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-sm text-[#1a2b3b] dark:text-foreground block">
                            {req.name}
                          </span>
                          {req.description && (
                            <span className="block text-sm text-muted-foreground mt-1 leading-relaxed">
                              {req.description}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Supplemental Requirements Accordion/Cards */}
                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  {/* Availing Additional Benefits */}
                  <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4">
                    <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300 mb-1.5 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      For Availing Additional Benefits
                    </p>
                    <ul className="text-sm text-emerald-950/85 dark:text-emerald-200/90 space-y-1.5 list-disc list-inside leading-relaxed">
                      <li>Affidavit of no employment OR ITR OR verifiable proof of income</li>
                      <li>Social Case Study report issued by C/MSWDO OR Barangay Indigency</li>
                    </ul>
                  </div>

                  {/* Lost SPIC */}
                  <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-300 mb-1.5 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      For Loss of SPIC (Lost ID)
                    </p>
                    <ul className="text-sm text-amber-950/85 dark:text-amber-200/90 space-y-1.5 list-disc list-inside leading-relaxed">
                      <li>Affidavit of Loss</li>
                      <li>1 pc 1×1 ID Picture</li>
                      <li>Sworn Affidavit & Barangay Affidavit</li>
                    </ul>
                  </div>
                </div>

                {/* General Guidelines */}
                <div className="bg-muted/40 border border-border/50 rounded-xl p-4 flex gap-3 text-sm text-muted-foreground leading-relaxed">
                  <Info className="h-5 w-5 text-[#0e4b65] dark:text-[#64b5a6] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground block mb-0.5 font-semibold">Submission & Photo Guidelines:</strong>
                    Submit 2 pcs 1×1 ID pictures (white background). Bring original & photocopy of PSA birth certificate/s. Digital uploads accept PDF, JPG, and PNG up to 10MB.
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-6 bg-muted/20 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto h-11 px-5 rounded-xl text-sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  Close
                </Button>

                <Button
                  className="w-full sm:w-auto h-11 px-7 bg-[#0e4b65] hover:bg-[#0a3a4e] text-white font-semibold rounded-xl text-sm shadow-md"
                  onClick={() => {
                    setSelectedCategory(null);
                    navigate('/register');
                  }}
                >
                  Apply Under Category {selectedCategory.code?.toUpperCase()} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
