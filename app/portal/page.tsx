"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ModuleLink } from "@/components/shell/ModuleLink";
import type { Domain } from "@/lib/types";

interface Org {
  id: string;
  name: string;
  nameUr: string;
  type: "government" | "ngo" | "hospital";
  sourceUrl: string;
  authorityTier: number;
}

export default function OrganizationPortalPage() {
  const [activeTab, setActiveTab] = useState<"onboard" | "directory">("onboard");
  const [language, setLanguage] = useState<"en" | "ur">("ur");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  // Form State
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [serviceNameUr, setServiceNameUr] = useState("");
  const [domain, setDomain] = useState<Domain>("welfare");
  const [description, setDescription] = useState("");
  const [descriptionUr, setDescriptionUr] = useState("");
  const [coverage, setCoverage] = useState<string>("Pakistan");
  type ApplicationMethod = "online" | "in_person" | "phone" | "sms" | "mixed";
  const [applicationMethod, setApplicationMethod] = useState<ApplicationMethod>("online");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [authorityTier, setAuthorityTier] = useState(1);

  // Dynamic Rule & Procedure Builder
  const [ruleField, setRuleField] = useState("householdIncome");
  const [ruleOperator, setRuleOperator] = useState("lte");
  const [ruleValue, setRuleValue] = useState("35000");
  const [ruleDescription, setRuleDescription] = useState("Monthly income must not exceed Rs 35,000");
  const [eligibilityRules, setEligibilityRules] = useState<Array<{ field: string; operator: string; value: unknown; description: string; mandatory: boolean }>>([]);

  const [reqType, setReqType] = useState("cnic");
  const [reqLabel, setReqLabel] = useState("CNIC Copy");
  const [reqLabelUr, setReqLabelUr] = useState("شناختی کارڈ کی کاپی");
  const [requiredDocs, setRequiredDocs] = useState<Array<{ type: string; label: string; labelUr: string; mandatory: boolean }>>([]);

  const [stepTitle, setStepTitle] = useState("");
  const [stepTitleUr, setStepTitleUr] = useState("");
  const [stepDesc, setStepDesc] = useState("");
  type StepChannel = "online" | "in_person" | "phone" | "sms";
  const [stepChannel, setStepChannel] = useState<StepChannel>("online");
  const [procedureSteps, setProcedureSteps] = useState<Array<{ order: number; title: string; titleUr: string; description: string; descriptionUr: string; channel: "online" | "in_person" | "phone" | "sms" }>>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/organizations")
      .then((r) => r.json())
      .then((data) => {
        setOrgs(data.results || []);
        if (data.results?.length > 0) {
          setSelectedOrgId(data.results[0].id);
        }
        setLoadingOrgs(false);
      })
      .catch(() => setLoadingOrgs(false));
  }, []);

  const addRule = () => {
    if (!ruleDescription) return;
    setEligibilityRules([
      ...eligibilityRules,
      {
        field: ruleField,
        operator: ruleOperator,
        value: isNaN(Number(ruleValue)) ? ruleValue : Number(ruleValue),
        description: ruleDescription,
        mandatory: true,
      },
    ]);
    setRuleDescription("");
  };

  const addDoc = () => {
    if (!reqLabel) return;
    setRequiredDocs([
      ...requiredDocs,
      { type: reqType, label: reqLabel, labelUr: reqLabelUr || reqLabel, mandatory: true },
    ]);
    setReqLabel("");
    setReqLabelUr("");
  };

  const addStep = () => {
    if (!stepTitle) return;
    setProcedureSteps([
      ...procedureSteps,
      {
        order: procedureSteps.length + 1,
        title: stepTitle,
        titleUr: stepTitleUr || stepTitle,
        description: stepDesc || stepTitle,
        descriptionUr: stepDesc || stepTitleUr || stepTitle,
        channel: stepChannel,
      },
    ]);
    setStepTitle("");
    setStepTitleUr("");
    setStepDesc("");
  };

  const handleSubmitService = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    const generatedId = serviceId.trim() || `${selectedOrgId}-${Date.now().toString(36)}`;
    const finalSourceTitle = sourceTitle || orgs.find((o) => o.id === selectedOrgId)?.name || "Official Portal";

    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: generatedId,
          organizationId: selectedOrgId,
          domain,
          name: serviceName,
          nameUr: serviceNameUr || serviceName,
          description,
          descriptionUr: descriptionUr || description,
          coverage: [coverage],
          applicationMethod,
          sourceUrl: sourceUrl || "https://pakistan.gov.pk",
          sourceTitle: finalSourceTitle,
          sourceAuthorityTier: Number(authorityTier),
          active: true,
          eligibilityRules,
          requiredDocuments: requiredDocs,
          procedure: procedureSteps,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to onboard service");
      }

      setStatusMessage({
        type: "success",
        text: language === "en"
          ? "✓ Service successfully onboarded into RAAHI Knowledge Graph!"
          : "✓ سروس کامیابی سے راہی نالج گراف میں شامل کر دی گئی ہے!",
      });

      // Reset Form
      setServiceName("");
      setServiceNameUr("");
      setDescription("");
      setDescriptionUr("");
      setServiceId("");
      setEligibilityRules([]);
      setRequiredDocs([]);
      setProcedureSteps([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error onboarding service";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="app-shell min-h-screen px-4 sm:px-6 py-5 flex flex-col justify-between"
      dir={language === "en" ? "ltr" : "rtl"}
    >
      <div>
        {/* Navigation Bar */}
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--forest)] text-base font-black text-white shadow-xs"
            >
              ر
            </Link>
            <div>
              <h1 className="text-sm font-black text-[var(--ink)]">
                {language === "en" ? "RAAHI Partner Portal" : "راہی تنظیمی پورٹل"}
              </h1>
              <p className="text-[10px] text-[var(--muted)]">
                {language === "en" ? "Service Onboarding & Institutional Directory" : "سرکاری و فلاحی اداروں کی سروس رجسٹریشن"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ModuleLink id="programs"
              href="/programs"
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--forest)] hover:bg-[var(--forest-light)] transition"
            >
              📋 {language === "en" ? "Catalog (85)" : "سروس کیٹلاگ"}
            </ModuleLink>

            <button
              type="button"
              onClick={() => setLanguage(language === "en" ? "ur" : "en")}
              className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs font-bold text-[var(--forest)]"
            >
              {language === "en" ? "اردو" : "English"}
            </button>
          </div>
        </header>

        {/* Hero Banner */}
        <section className="py-6">
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-[#f0f9f2] to-white p-6 shadow-xs">
            <span className="rounded-full bg-[var(--forest-light)] px-3 py-1 text-[11px] font-bold text-[var(--forest)] uppercase tracking-wide">
              🏛️ {language === "en" ? "Universal Navigation Layer" : "عوامی رہنمائی نیٹ ورک"}
            </span>
            <h2 className="mt-3 text-2xl font-black text-[var(--ink)]">
              {language === "en"
                ? "Onboard Government & NGO Programs into RAAHI"
                : "اپنے ادارے کی خدمات اور فلاحی اسکیمیں راہی میں شامل کریں"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] max-w-3xl">
              {language === "en"
                ? "Pakistan has hundreds of vital services. By publishing your program here, citizens across all provinces can immediately discover eligibility, required paperwork, and step-by-step guidance in Urdu and Pashto."
                : "پاکستان بھر کے کروڑوں شہریوں کو براہ راست اپنے فلاحی اور حکومتی پروگراموں سے جوڑیں۔ شفاف اہلیت، مطلوبہ کاغذات اور طریقہ کار خودکار طور پر راہی اے آئی کے ذریعے رہنمائی پائیں گے۔"}
            </p>

            {/* Tab Buttons */}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("onboard")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                  activeTab === "onboard"
                    ? "bg-[var(--forest)] text-white shadow-xs"
                    : "bg-white border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                ➕ {language === "en" ? "Onboard New Service" : "نئی سروس شامل کریں"}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("directory")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                  activeTab === "directory"
                    ? "bg-[var(--forest)] text-white shadow-xs"
                    : "bg-white border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                🏛️ {language === "en" ? `Registered Institutions (${orgs.length})` : `منسلک ادارے (${orgs.length})`}
              </button>
            </div>
          </div>
        </section>

        {/* ─── TAB 1: Onboard Service Form ────────────────────────────── */}
        {activeTab === "onboard" && (
          <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm mb-10">
            {statusMessage && (
              <div
                className={`mb-6 rounded-xl p-4 text-xs font-bold ${
                  statusMessage.type === "success"
                    ? "border border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border border-rose-300 bg-rose-50 text-rose-900"
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            <form onSubmit={handleSubmitService} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Organization Selection */}
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                    {language === "en" ? "Partner Organization *" : "ادارے کا نام *"}
                  </label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5 text-xs font-bold text-[var(--ink)] focus:border-[var(--forest)] focus:outline-hidden"
                    required
                  >
                    {loadingOrgs ? (
                      <option>Loading organizations...</option>
                    ) : (
                      orgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {language === "en" ? o.name : o.nameUr || o.name} ({o.type.toUpperCase()})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Domain Selector */}
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                    {language === "en" ? "Service Domain *" : "شعبہ / کیٹیگری *"}
                  </label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value as Domain)}
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5 text-xs font-bold text-[var(--ink)] focus:border-[var(--forest)] focus:outline-hidden"
                  >
                    <option value="welfare">💰 Social Welfare & Financial Aid (سماجی بہبود)</option>
                    <option value="health">🏥 Healthcare & Medical (صحت و علاج)</option>
                    <option value="education">🎓 Education & Scholarships (تعلیم اور وظائف)</option>
                    <option value="documentation">📄 Identity & NADRA (شناختی دستاویزات)</option>
                    <option value="legal">⚖️ Legal Aid & Protection (قانونی مدد)</option>
                    <option value="employment">💼 Skills & Employment (ہنر و روزگار)</option>
                    <option value="disaster">🚨 Disaster & Emergency (ہنگامی امداد)</option>
                  </select>
                </div>
              </div>

              {/* Service Titles */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                    {language === "en" ? "Program Name (English) *" : "پروگرام کا انگریزی نام *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="e.g. Alkhidmat Free Dialysis Support"
                    className="w-full rounded-xl border border-[var(--line)] p-2.5 text-xs font-medium focus:border-[var(--forest)] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                    {language === "en" ? "Program Name (Urdu) *" : "پروگرام کا اردو نام *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={serviceNameUr}
                    onChange={(e) => setServiceNameUr(e.target.value)}
                    placeholder="مثال: الخدمت مفت ڈائیلاسز ریلیف پروگرام"
                    className="w-full rounded-xl border border-[var(--line)] p-2.5 text-xs font-medium focus:border-[var(--forest)] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Descriptions */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                    {language === "en" ? "Description (English) *" : "تفصیل (انگریزی) *"}
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed explanation of what the citizen receives and who can benefit..."
                    className="w-full rounded-xl border border-[var(--line)] p-2.5 text-xs font-medium focus:border-[var(--forest)] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                    {language === "en" ? "Description (Urdu) *" : "تفصیل (اردو) *"}
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={descriptionUr}
                    onChange={(e) => setDescriptionUr(e.target.value)}
                    placeholder="مکمل تفصیل کہ شہریوں کو کیا فائدہ ملے گا..."
                    className="w-full rounded-xl border border-[var(--line)] p-2.5 text-xs font-medium focus:border-[var(--forest)] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Scope & Delivery */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                    {language === "en" ? "Geographic Scope" : "علاقائی دائرہ کار"}
                  </label>
                  <select
                    value={coverage}
                    onChange={(e) => setCoverage(e.target.value)}
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5 text-xs font-semibold"
                  >
                    <option value="Pakistan">All Pakistan (پورے پاکستان)</option>
                    <option value="Punjab">Punjab (پنجاب)</option>
                    <option value="Khyber Pakhtunkhwa">Khyber Pakhtunkhwa (خیبر پختونخوا)</option>
                    <option value="Sindh">Sindh (سندھ)</option>
                    <option value="Balochistan">Balochistan (بلوچستان)</option>
                    <option value="Islamabad">Islamabad Capital (وفاقی دارالحکومت)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                    {language === "en" ? "Application Channel" : "درخواست کا طریقہ"}
                  </label>
                  <select
                    value={applicationMethod}
                    onChange={(e) => setApplicationMethod(e.target.value as ApplicationMethod)}
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5 text-xs font-semibold"
                  >
                    <option value="online">🌐 Online Portal</option>
                    <option value="in_person">🏢 In-Person Visit (دفتر تشریف لائیں)</option>
                    <option value="sms">📱 SMS Code (مثلاً 8171)</option>
                    <option value="phone">📞 Helpline Call</option>
                    <option value="mixed">🔄 Mixed / Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                    {language === "en" ? "Source Authority Tier" : "اتھارٹی کا درجہ"}
                  </label>
                  <select
                    value={authorityTier}
                    onChange={(e) => setAuthorityTier(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5 text-xs font-semibold"
                  >
                    <option value={1}>Tier 1: Federal/Provincial Govt</option>
                    <option value={2}>Tier 2: Statutory Institution / Major NGO</option>
                    <option value={3}>Tier 3: Certified Community Partner</option>
                  </select>
                </div>
              </div>

              {/* Official Source URL */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                    {language === "en" ? "Official Source URL *" : "سرکاری ویب سائٹ لنک *"}
                  </label>
                  <input
                    type="url"
                    required
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://alkhidmat.org or https://bisp.gov.pk"
                    className="w-full rounded-xl border border-[var(--line)] p-2.5 text-xs font-medium focus:border-[var(--forest)] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                    {language === "en" ? "Source Title" : "حوالہ جاتی عنوان"}
                  </label>
                  <input
                    type="text"
                    value={sourceTitle}
                    onChange={(e) => setSourceTitle(e.target.value)}
                    placeholder="Official Program Notification / Portal"
                    className="w-full rounded-xl border border-[var(--line)] p-2.5 text-xs font-medium focus:border-[var(--forest)] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* ─── Builder 1: Eligibility Rules ──────────────────────── */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
                <h3 className="text-xs font-black text-[var(--ink)] flex items-center gap-1.5">
                  <span>⚖️</span>
                  <span>{language === "en" ? "Eligibility Criteria Rules" : "اہلیت کے اصول و ضوابط"}</span>
                </h3>

                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    value={ruleField}
                    onChange={(e) => setRuleField(e.target.value)}
                    className="rounded-lg border border-[var(--line)] bg-white p-2 text-xs font-medium"
                  >
                    <option value="householdIncome">Household Income (آمدن)</option>
                    <option value="hasCnic">Has CNIC (شناختی کارڈ)</option>
                    <option value="isEnrolled">School Enrolled (اسکول میں داخلہ)</option>
                    <option value="province">Province (صوبہ)</option>
                  </select>

                  <select
                    value={ruleOperator}
                    onChange={(e) => setRuleOperator(e.target.value)}
                    className="rounded-lg border border-[var(--line)] bg-white p-2 text-xs font-medium"
                  >
                    <option value="lte">{"<="} Less Than / Equal</option>
                    <option value="gte">{">="} Greater Than / Equal</option>
                    <option value="eq">{"="} Equals</option>
                  </select>

                  <input
                    type="text"
                    value={ruleValue}
                    onChange={(e) => setRuleValue(e.target.value)}
                    placeholder="Value (e.g. 35000)"
                    className="rounded-lg border border-[var(--line)] bg-white p-2 text-xs font-medium w-28"
                  />

                  <input
                    type="text"
                    value={ruleDescription}
                    onChange={(e) => setRuleDescription(e.target.value)}
                    placeholder="Rule Description (e.g. Income < 35k)"
                    className="flex-1 rounded-lg border border-[var(--line)] bg-white p-2 text-xs font-medium min-w-[200px]"
                  />

                  <button
                    type="button"
                    onClick={addRule}
                    className="rounded-lg bg-[var(--forest)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--forest-dark)] transition cursor-pointer"
                  >
                    + Add Rule
                  </button>
                </div>

                {eligibilityRules.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {eligibilityRules.map((r, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800"
                      >
                        <span>✓ {r.description}</span>
                        <button
                          type="button"
                          onClick={() => setEligibilityRules(eligibilityRules.filter((_, idx) => idx !== i))}
                          className="hover:text-red-700"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ─── Builder 2: Required Documents ────────────────────── */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
                <h3 className="text-xs font-black text-[var(--ink)] flex items-center gap-1.5">
                  <span>📄</span>
                  <span>{language === "en" ? "Required Documents" : "ضروری کاغذات کی فہرست"}</span>
                </h3>

                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    value={reqType}
                    onChange={(e) => setReqType(e.target.value)}
                    className="rounded-lg border border-[var(--line)] bg-white p-2 text-xs font-medium"
                  >
                    <option value="cnic">CNIC</option>
                    <option value="b_form">B-Form / CRC</option>
                    <option value="domicile">Domicile</option>
                    <option value="salary_slip">Salary Slip / Income</option>
                    <option value="school_certificate">School Certificate</option>
                    <option value="medical_report">Medical Report</option>
                  </select>

                  <input
                    type="text"
                    value={reqLabel}
                    onChange={(e) => setReqLabel(e.target.value)}
                    placeholder="English Label (e.g. Father CNIC)"
                    className="rounded-lg border border-[var(--line)] bg-white p-2 text-xs font-medium"
                  />

                  <input
                    type="text"
                    value={reqLabelUr}
                    onChange={(e) => setReqLabelUr(e.target.value)}
                    placeholder="اردو نام (مثلاً والد کا شناختی کارڈ)"
                    className="rounded-lg border border-[var(--line)] bg-white p-2 text-xs font-medium"
                  />

                  <button
                    type="button"
                    onClick={addDoc}
                    className="rounded-lg bg-[var(--forest)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--forest-dark)] transition cursor-pointer"
                  >
                    + Add Document
                  </button>
                </div>

                {requiredDocs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {requiredDocs.map((d, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800"
                      >
                        <span>📄 {d.label}</span>
                        <button
                          type="button"
                          onClick={() => setRequiredDocs(requiredDocs.filter((_, idx) => idx !== i))}
                          className="hover:text-red-700"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ─── Builder 3: Procedure Steps ───────────────────────── */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
                <h3 className="text-xs font-black text-[var(--ink)] flex items-center gap-1.5">
                  <span>👣</span>
                  <span>{language === "en" ? "Step-by-Step Procedure" : "طریقہ کار کے مراحل"}</span>
                </h3>

                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={stepTitle}
                    onChange={(e) => setStepTitle(e.target.value)}
                    placeholder="Step Title (e.g. Submit Application Online)"
                    className="flex-1 rounded-lg border border-[var(--line)] bg-white p-2 text-xs font-medium min-w-[200px]"
                  />

                  <input
                    type="text"
                    value={stepTitleUr}
                    onChange={(e) => setStepTitleUr(e.target.value)}
                    placeholder="عنوان اردو (مثلاً آن لائن درخواست جمع کریں)"
                    className="flex-1 rounded-lg border border-[var(--line)] bg-white p-2 text-xs font-medium min-w-[200px]"
                  />

                  <select
                    value={stepChannel}
                    onChange={(e) => setStepChannel(e.target.value as StepChannel)}
                    className="rounded-lg border border-[var(--line)] bg-white p-2 text-xs font-medium"
                  >
                    <option value="online">Online</option>
                    <option value="in_person">In Person</option>
                    <option value="sms">SMS</option>
                    <option value="phone">Helpline</option>
                  </select>

                  <button
                    type="button"
                    onClick={addStep}
                    className="rounded-lg bg-[var(--forest)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--forest-dark)] transition cursor-pointer"
                  >
                    + Add Step
                  </button>
                </div>

                {procedureSteps.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {procedureSteps.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs font-medium border border-[var(--line-soft)]"
                      >
                        <span>
                          <strong className="me-2 font-mono">#{s.order}</strong>
                          {s.title} ({s.channel})
                        </span>
                        <button
                          type="button"
                          onClick={() => setProcedureSteps(procedureSteps.filter((_, idx) => idx !== i))}
                          className="text-rose-600 hover:underline"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit CTA */}
              <div className="border-t border-[var(--line-soft)] pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-2xl bg-[var(--forest)] px-8 py-3.5 text-sm font-bold text-white hover:bg-[var(--forest-dark)] active:scale-[0.98] transition cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>{language === "en" ? "Publishing to RAAHI..." : "شائع ہو رہا ہے..."}</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>
                        {language === "en"
                          ? "Publish & Onboard to RAAHI"
                          : "راہی میں شائع اور فعال کریں"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ─── TAB 2: Institutional Directory ─────────────────────────── */}
        {activeTab === "directory" && (
          <section className="mb-10">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {orgs.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs transition hover:border-[var(--forest)] hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-[var(--forest-light)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--forest)] uppercase">
                        Tier {o.authorityTier} · {o.type}
                      </span>
                      <span className="text-lg">🏛️</span>
                    </div>

                    <h3 className="mt-3 text-base font-black text-[var(--ink)]">
                      {language === "en" ? o.name : o.nameUr || o.name}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--muted)] font-mono">
                      ID: {o.id}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--line-soft)] flex items-center justify-between">
                    <a
                      href={o.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-[var(--forest)] hover:underline inline-flex items-center gap-1"
                    >
                      <span>{language === "en" ? "Official Site" : "سرکاری پورٹل"}</span>
                      <span>↗</span>
                    </a>

                    <Link
                      href={`/programs?domain=`}
                      className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      {language === "en" ? "View Services →" : "← خدمات دیکھیں"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-8 border-t border-[var(--line)] pt-4 text-center text-xs text-[var(--muted)]">
        <p>RAAHI Universal Service Gateway · Open to all verified public welfare entities in Pakistan.</p>
      </footer>
    </main>
  );
}
