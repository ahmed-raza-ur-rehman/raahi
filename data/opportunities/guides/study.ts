import type { Guide, LText } from "@/lib/opportunities/guides";

const L = (en: string, ur: string): LText => ({ en, ur });
const REVIEWED = "2026-10-11";

export const studyGuides: Guide[] = [
  // ─── After Matric / FSc / degree ───────────────────────────────────────────
  {
    id: "after-matric-intermediate",
    category: "study",
    emoji: "🧭",
    title: L("What to do after Matric, FSc or your degree", "میٹرک، ایف ایس سی یا ڈگری کے بعد کیا کریں"),
    summary: L(
      "A simple way to choose between university, a skill, a government job or studying abroad — without paying anyone to decide for you.",
      "یونیورسٹی، ہنر، سرکاری نوکری یا بیرون ملک تعلیم میں سے انتخاب کا آسان طریقہ — بغیر کسی کو پیسے دیے۔",
    ),
    audience: L("Students finishing Matric, Intermediate or a Bachelor's who are not sure what comes next.", "میٹرک، انٹرمیڈیٹ یا بیچلرز مکمل کرنے والے طلبہ جو آگے کا راستہ طے نہیں کر پا رہے۔"),
    duration: L("One evening to decide, a few weeks to prepare", "فیصلے کے لیے ایک شام، تیاری کے لیے چند ہفتے"),
    steps: [
      {
        title: L("Start from the goal, not the degree", "ڈگری نہیں، منزل سے آغاز کریں"),
        body: L(
          "Write down what you want in five years: a profession, a steady income soon, or to live and study abroad. Talk to two people who actually do that work and ask what they wish they had known.",
          "لکھیں کہ پانچ سال بعد آپ کیا چاہتے ہیں: کوئی پیشہ، جلد مستحکم آمدنی، یا بیرون ملک تعلیم۔ اس کام سے وابستہ دو لوگوں سے بات کریں اور پوچھیں کہ انہیں کیا پہلے معلوم ہونا چاہیے تھا۔",
        ),
      },
      {
        title: L("Match the goal to its entry route", "منزل کو اس کے داخلے کے راستے سے ملائیں"),
        body: L(
          "Medicine and dentistry go through MDCAT. Engineering, computer science and business usually go through university entry tests (many accept NTS tests, others run their own). The civil service starts with a Bachelor's degree and then FPSC or provincial commission exams. Skills-first routes include NAVTTC programmes, DigiSkills and diplomas. Studying abroad mostly runs through scholarships.",
          "میڈیکل اور ڈینٹل کے لیے ایم ڈی کیٹ؛ انجینئرنگ، کمپیوٹر سائنس اور بزنس عموماً یونیورسٹیوں کے داخلہ ٹیسٹ سے (کئی جامعات این ٹی ایس کے ٹیسٹ مانتی ہیں، کچھ اپنا ٹیسٹ لیتی ہیں)؛ سول سروس بیچلرز کے بعد ایف پی ایس سی یا صوبائی کمیشن کے امتحانات سے؛ ہنر پر مبنی راستے نیوٹیک کے پروگرام، ڈیجی اسکلز اور ڈپلومے؛ اور بیرون ملک تعلیم زیادہ تر اسکالرشپس کے ذریعے۔",
        ),
        resourceIds: ["pmdc", "nts", "fpsc", "navttc", "digiskills"],
      },
      {
        title: L("Check that the institution and programme are recognised", "ادارہ اور پروگرام تسلیم شدہ ہونے کی تصدیق کریں"),
        body: L(
          "Before you apply or pay a fee, confirm the university or college is recognised — HEC for universities, PMDC for medical and dental colleges. A glossy brochure is not recognition.",
          "درخواست یا فیس سے پہلے تصدیق کریں کہ جامعہ یا کالج تسلیم شدہ ہے — جامعات کے لیے ایچ ای سی، میڈیکل اور ڈینٹل کالجوں کے لیے پی ایم ڈی سی۔ خوبصورت بروشر منظوری کا ثبوت نہیں۔",
        ),
        resourceIds: ["hec", "pmdc"],
      },
      {
        title: L("Look for money before you look for admission", "داخلے سے پہلے مالی معاونت دیکھیں"),
        body: L(
          "Need-based and merit scholarships open on their own calendars: HEC need-based aid and the Ehsaas undergraduate scholarship, PEEF in Punjab, SEF in Sindh, the LUMS National Outreach Programme, and many universities' own aid. Note the windows now.",
          "ضرورت اور میرٹ پر مبنی وظائف کی اپنی تاریخیں ہوتی ہیں: ایچ ای سی کی نیڈ بیسڈ معاونت اور احساس انڈرگریجویٹ اسکالرشپ، پنجاب میں پیف، سندھ میں ایس ای ایف، لمز نیشنل آؤٹ ریچ پروگرام اور جامعات کی اپنی مالی معاونت۔ ابھی تاریخیں نوٹ کر لیں۔",
        ),
        resourceIds: ["hec-scholarship-portal", "ehsaas-hec", "peef", "sef-sindh", "lums-nop"],
      },
      {
        title: L("Build a calendar — and a plan B", "کیلنڈر بنائیں — اور متبادل منصوبہ بھی"),
        body: L(
          "List every test date and application deadline, add them to your phone's calendar (RAAHI can export deadlines as .ics files), and choose a plan B in the same field in case the first choice does not come through. Use the waiting time to learn a skill for free.",
          "ہر ٹیسٹ اور درخواست کی آخری تاریخ لکھیں، فون کے کیلنڈر میں شامل کریں (راہی آخری تاریخیں .ics فائل میں دے سکتا ہے) اور اسی شعبے میں متبادل منصوبہ رکھیں۔ انتظار کا وقت کوئی ہنر مفت سیکھنے میں لگائیں۔",
        ),
        resourceIds: ["digiskills", "harvard-cs50"],
      },
    ],
    checklist: [
      L("CNIC, or B-Form if you are under 18", "شناختی کارڈ، یا 18 سال سے کم عمر ہوں تو ب فارم"),
      L("Matric and Intermediate certificates and mark sheets", "میٹرک اور انٹرمیڈیٹ کے سرٹیفکیٹ اور نمبروں کی فہرست"),
      L("Domicile certificate", "ڈومیسائل سرٹیفکیٹ"),
      L("Passport-size photographs", "پاسپورٹ سائز تصاویر"),
      L("Income certificate or other proof if you apply for need-based aid", "ضرورت پر مبنی امداد کے لیے آمدنی کا سرٹیفکیٹ یا دیگر ثبوت"),
      L("A mobile number and email address you check every day", "موبائل نمبر اور ای میل جو آپ روزانہ دیکھتے ہوں"),
    ],
    pitfalls: [
      L("Paying an ‘admission consultant’ for a guaranteed seat — merit seats are not for sale.", "‘ایڈمیشن کنسلٹنٹ’ کو یقینی داخلے کے لیے پیسے دینا — میرٹ کی نشستیں بکتی نہیں۔"),
      L("Assuming every private university or college is recognised.", "یہ فرض کر لینا کہ ہر نجی جامعہ یا کالج تسلیم شدہ ہے۔"),
      L("Missing a registration window because you followed dates from social media instead of the official page.", "سرکاری صفحے کے بجائے سوشل میڈیا کی تاریخوں پر چلنے سے رجسٹریشن کی مدت چھوٹ جانا۔"),
      L("Choosing a field only because your friends did.", "کوئی شعبہ صرف اس لیے چننا کہ دوستوں نے چنا۔"),
    ],
    resourceIds: ["hec", "hec-scholarship-portal", "ehsaas-hec", "peef", "nts", "pmdc", "navttc", "digiskills", "ibcc", "fpsc", "sef-sindh", "lums-nop", "harvard-cs50"],
    related: ["study-abroad-roadmap", "mdcat-roadmap", "learn-free-90-days"],
    opportunityQuery: { kinds: ["scholarship"], scope: "pakistan" },
    tools: ["plan"],
    keywords: ["after matric", "after fsc", "after intermediate", "after bachelors", "career choice", "which degree", "admission", "entry test", "fsc ke baad", "matric ke baad", "intermediate ke baad", "degree ke baad", "kya karein", "kya karun", "میٹرک کے بعد", "ایف ایس سی کے بعد", "انٹر کے بعد", "داخلہ", "کیریئر"],
    reviewed: REVIEWED,
  },

  // ─── Study abroad ──────────────────────────────────────────────────────────
  {
    id: "study-abroad-roadmap",
    category: "study",
    emoji: "🌍",
    title: L("Study abroad on a scholarship: a 12-month roadmap", "وظیفے پر بیرون ملک تعلیم: بارہ ماہ کا نقشہ"),
    summary: L(
      "From shortlisting programmes to the visa — what to do, month by month, and what to ignore.",
      "پروگراموں کی فہرست سے ویزا تک — ہر مہینے کیا کرنا ہے اور کیا نظر انداز کرنا ہے۔",
    ),
    audience: L("Students and graduates planning a Master's or PhD abroad.", "طلبہ اور فارغ التحصیل جو بیرون ملک ماسٹرز یا پی ایچ ڈی کا ارادہ رکھتے ہیں۔"),
    duration: L("9–12 months", "9 سے 12 ماہ"),
    steps: [
      {
        when: L("12–9 months before", "12 سے 9 ماہ پہلے"),
        title: L("Choose country, level and field — then list the big programmes", "ملک، سطح اور شعبہ چنیں — پھر بڑے پروگراموں کی فہرست بنائیں"),
        body: L(
          "Government scholarships are the usual route: Chevening (UK), Fulbright through USEFP (USA), DAAD (Germany), Stipendium Hungaricum (Hungary), Türkiye Burslari, CSC (China), GKS (Korea), MEXT (Japan), Australia Awards and Erasmus Mundus (Europe). Each has its own calendar — note the deadline of every programme you shortlist; many close between autumn and spring.",
          "عموماً حکومتی وظائف کا راستہ ہوتا ہے: چیوننگ (برطانیہ)، یو ایس ای ایف پی کے ذریعے فل برائٹ (امریکا)، ڈی اے اے ڈی (جرمنی)، اسٹیپنڈیم ہنگیریکم (ہنگری)، ترکیہ برسلاری، سی ایس سی (چین)، جی کے ایس (کوریا)، ایم ای ایکس ٹی (جاپان)، آسٹریلیا ایوارڈز اور ایراسمس منڈس (یورپ)۔ ہر ایک کا اپنا کیلنڈر ہے — جو پروگرام منتخب کریں ان کی آخری تاریخ لکھ لیں؛ کئی خزاں سے بہار کے درمیان بند ہوتے ہیں۔",
        ),
        resourceIds: ["chevening", "usefp-fulbright", "daad", "stipendium-hungaricum", "turkiye-burslari", "campus-china", "gks-korea", "mext-japan", "australia-awards", "erasmus-plus"],
      },
      {
        when: L("9–8 months before", "9 سے 8 ماہ پہلے"),
        title: L("Read each programme's eligibility line by line", "ہر پروگرام کی اہلیت لفظ بہ لفظ پڑھیں"),
        body: L(
          "Check degree level, minimum grades, work experience, age, language score — and whether you must apply through a national body (some programmes take Pakistani applicants through HEC). Drop what you do not qualify for; do not hope the rules will bend.",
          "ڈگری کی سطح، کم از کم نمبر، تجربہ، عمر، زبان کا اسکور دیکھیں — اور یہ بھی کہ کیا درخواست کسی قومی ادارے کے ذریعے دینی ہے (بعض پروگراموں میں پاکستانی امیدوار ایچ ای سی کے ذریعے درخواست دیتے ہیں)۔ جو شرائط پوری نہ ہوں انہیں چھوڑ دیں؛ اس امید پر نہ رہیں کہ اصول نرم ہوں گے۔",
        ),
        resourceIds: ["hec-scholarship-portal"],
      },
      {
        when: L("8–6 months before", "8 سے 6 ماہ پہلے"),
        title: L("Book and take the language and aptitude tests", "زبان اور اہلیت کے ٹیسٹ بک کریں اور دیں"),
        body: L(
          "Check which test each programme accepts (IELTS, TOEFL, PTE or Duolingo; GRE or GMAT for some) and whether a medium-of-instruction letter or waiver is accepted. Scores are usually valid for two years, so time the test to your deadlines.",
          "دیکھیں ہر پروگرام کون سا ٹیسٹ مانتا ہے (آئیلٹس، ٹوئیفل، پی ٹی ای یا ڈولنگو؛ بعض کے لیے جی آر ای یا جی میٹ) اور کیا ذریعۂ تعلیم کا خط یا استثنیٰ قبول ہے۔ اسکور عموماً دو سال کے لیے درست رہتے ہیں، اس لیے ٹیسٹ کا وقت آخری تاریخوں کے مطابق رکھیں۔",
        ),
        resourceIds: ["ielts", "toefl", "gre", "duolingo-english-test"],
      },
      {
        when: L("6–4 months before", "6 سے 4 ماہ پہلے"),
        title: L("Get your documents attested", "دستاویزات کی تصدیق کروائیں"),
        body: L(
          "University degrees go through HEC attestation and school certificates through IBCC; then MOFA's apostille, or embassy legalisation, if your destination needs it. It can take weeks — see the documents guide.",
          "جامعہ کی ڈگریاں ایچ ای سی سے اور اسکول کے سرٹیفکیٹ آئی بی سی سی سے تصدیق ہوتے ہیں؛ پھر منزل کے ملک کی ضرورت کے مطابق وزارت خارجہ کا اپوسٹل یا سفارت خانے کی لیگلائزیشن۔ اس میں ہفتے لگ سکتے ہیں — دستاویزات والی گائیڈ دیکھیں۔",
        ),
        resourceIds: ["hec-attestation", "ibcc", "apostille-mofa"],
      },
      {
        when: L("4–2 months before", "4 سے 2 ماہ پہلے"),
        title: L("Write the statement of purpose, polish the CV, brief your referees", "ایس او پی لکھیں، سی وی بہتر کریں، سفارش کنندگان کو آگاہ کریں"),
        body: L(
          "Write for this programme, not for all of them. Give referees three to four weeks, your CV and your draft. The CV and SOP guide has a structure to follow.",
          "اس پروگرام کے لیے لکھیں، سب کے لیے ایک جیسا نہیں۔ سفارش کنندگان کو تین سے چار ہفتے، اپنا سی وی اور مسودہ دیں۔ سی وی اور ایس او پی والی گائیڈ میں پیروی کے لیے ایک ڈھانچا موجود ہے۔",
        ),
      },
      {
        when: L("2 months before the deadline", "آخری تاریخ سے 2 ماہ پہلے"),
        title: L("Apply early, on the official portal only", "جلد درخواست دیں، صرف سرکاری پورٹل پر"),
        body: L(
          "Portals slow down on the last day. Follow the instructions exactly, keep every confirmation email, and apply to five to eight programmes so a single decision does not decide your year.",
          "آخری دن پورٹل سست ہو جاتے ہیں۔ ہدایات پر ٹھیک ٹھیک عمل کریں، ہر تصدیقی ای میل محفوظ رکھیں، اور پانچ سے آٹھ پروگراموں میں درخواست دیں تاکہ ایک فیصلہ آپ کا پورا سال طے نہ کرے۔",
        ),
      },
      {
        when: L("After the offer", "آفر ملنے کے بعد"),
        title: L("Visa, insurance, housing — and beware ‘visa agents’", "ویزا، انشورنس، رہائش — اور ‘ویزا ایجنٹوں’ سے ہوشیار"),
        body: L(
          "Apply for the visa through the embassy or its official portal. A scholarship offer letter is not a visa, and nobody can guarantee one. Keep every original document with you.",
          "ویزا سفارت خانے یا اس کے سرکاری پورٹل سے لیں۔ اسکالرشپ کا آفر لیٹر ویزا نہیں ہوتا اور کوئی ویزا کی ضمانت نہیں دے سکتا۔ تمام اصل دستاویزات اپنے پاس رکھیں۔",
        ),
      },
    ],
    checklist: [
      L("Passport with enough validity (check the embassy's rule)", "کافی مدت والا پاسپورٹ (سفارت خانے کا اصول دیکھیں)"),
      L("CNIC", "شناختی کارڈ"),
      L("Degrees and transcripts, attested", "تصدیق شدہ ڈگریاں اور ٹرانسکرپٹس"),
      L("Language or aptitude test score reports", "زبان یا اہلیت کے ٹیسٹ کے اسکور"),
      L("CV and statement of purpose written for this programme", "اسی پروگرام کے لیے لکھا ہوا سی وی اور ایس او پی"),
      L("Two or three reference letters", "دو یا تین سفارشی خطوط"),
      L("Photographs to the programme's specification", "پروگرام کی ہدایت کے مطابق تصاویر"),
      L("Proof of funds, only if the programme asks for it", "مالی ثبوت، صرف اگر پروگرام مانگے"),
    ],
    pitfalls: [
      L("Paying to ‘guarantee’ a scholarship or admission — selection committees do not sell awards.", "اسکالرشپ یا داخلے کی ‘ضمانت’ کے لیے پیسے دینا — انتخابی کمیٹیاں وظائف بیچتی نہیں۔"),
      L("Using a copy-and-paste SOP: committees read hundreds and spot them.", "نقل شدہ ایس او پی استعمال کرنا: کمیٹیاں سینکڑوں پڑھتی ہیں اور پہچان لیتی ہیں۔"),
      L("Applying through an unofficial form or a portal that merely looks like the real one.", "غیر سرکاری فارم یا ایسے پورٹل سے درخواست دینا جو صرف اصل جیسا دکھتا ہو۔"),
      L("Leaving attestation to the last month.", "تصدیق کو آخری مہینے پر چھوڑ دینا۔"),
    ],
    resourceIds: ["chevening", "usefp-fulbright", "daad", "stipendium-hungaricum", "turkiye-burslari", "campus-china", "gks-korea", "mext-japan", "australia-awards", "erasmus-plus", "hec-scholarship-portal", "mastersportal", "ielts", "toefl", "gre", "duolingo-english-test", "hec-attestation", "ibcc", "apostille-mofa"],
    related: ["english-tests", "cv-cover-sop", "documents-attestation", "spot-fake-offers"],
    opportunityQuery: { kinds: ["scholarship", "fellowship"], openToPakistan: true },
    tools: ["match", "plan"],
    keywords: ["scholarship", "study abroad", "masters", "phd", "fully funded", "chevening", "fulbright", "daad", "visa", "bahar parhai", "bahir parhna", "scholarship kaise", "bahar ja kar parhna", "بیرون ملک تعلیم", "اسکالرشپ", "وظیفہ", "ماسٹرز", "پی ایچ ڈی"],
    reviewed: REVIEWED,
  },

  // ─── English tests ─────────────────────────────────────────────────────────
  {
    id: "english-tests",
    category: "study",
    emoji: "🗣️",
    title: L("IELTS, TOEFL, PTE or Duolingo: choose and prepare", "آئیلٹس، ٹوئیفل، پی ٹی ای یا ڈولنگو: انتخاب اور تیاری"),
    summary: L("Which test to take, how long to prepare, and how to avoid ‘guaranteed band’ sellers.", "کون سا ٹیسٹ دیں، تیاری کتنی کریں، اور ‘یقینی بینڈ’ بیچنے والوں سے کیسے بچیں۔"),
    audience: L("Anyone applying to study or work in an English-speaking setting.", "کوئی بھی جو انگریزی بولنے والے ماحول میں تعلیم یا کام کے لیے درخواست دے رہا ہو۔"),
    duration: L("6–10 weeks of practice for most people", "اکثر لوگوں کے لیے 6 سے 10 ہفتے کی مشق"),
    steps: [
      {
        title: L("Ask what is accepted — before you book anything", "کچھ بک کرنے سے پہلے پوچھیں کہ کیا قبول ہے"),
        body: L(
          "Programmes and embassies list the tests and minimum scores they accept, sometimes per section. Some universities accept a medium-of-instruction certificate instead; ask in writing. Visa categories can require a specific version of a test.",
          "پروگرام اور سفارت خانے قبول شدہ ٹیسٹ اور کم از کم اسکور بتاتے ہیں، بعض اوقات ہر حصے کے الگ۔ کچھ جامعات اس کے بجائے ذریعۂ تعلیم کا سرٹیفکیٹ مان لیتی ہیں؛ تحریری طور پر پوچھیں۔ ویزا کی بعض اقسام کے لیے ٹیسٹ کا مخصوص ورژن درکار ہو سکتا ہے۔",
        ),
      },
      {
        title: L("Pick the format that suits you", "اپنے مزاج کے مطابق فارمیٹ چنیں"),
        body: L(
          "IELTS has a face-to-face speaking test; TOEFL iBT and PTE Academic are computer-based; the Duolingo English Test is taken online and accepted by fewer institutions. Take one free official practice test of each you are considering.",
          "آئیلٹس میں بولنے کا ٹیسٹ روبرو ہوتا ہے؛ ٹوئیفل آئی بی ٹی اور پی ٹی ای اکیڈمک کمپیوٹر پر ہوتے ہیں؛ ڈولنگو انگلش ٹیسٹ آن لائن دیا جاتا ہے اور کم اداروں میں قبول ہے۔ جو ٹیسٹ زیر غور ہوں ان کا ایک مفت سرکاری مشقی ٹیسٹ دیں۔",
        ),
        resourceIds: ["ielts", "british-council-ielts", "toefl", "duolingo-english-test"],
      },
      {
        title: L("Practise all four skills, every day", "چاروں مہارتوں کی روزانہ مشق کریں"),
        body: L(
          "Listening and reading improve with timed practice; speaking improves by recording yourself and listening back; writing improves with feedback on every essay. Short daily sessions beat weekend marathons.",
          "سننے اور پڑھنے میں وقت کے ساتھ مشق سے بہتری آتی ہے؛ بولنے میں اپنی آواز ریکارڈ کر کے سننے سے؛ لکھنے میں ہر مضمون پر رائے لینے سے۔ روزانہ کے مختصر سیشن ہفتہ وار طویل سیشنوں سے بہتر ہیں۔",
        ),
      },
      {
        title: L("Book early and bring exactly the ID the centre asks for", "جلد بک کریں اور وہی شناختی دستاویز لائیں جو مرکز مانگے"),
        body: L(
          "Seats near deadlines fill up. The ID you register with must match the one you bring on the day, and results usually take days or weeks — plan for it.",
          "آخری تاریخوں کے قریب نشستیں بھر جاتی ہیں۔ رجسٹریشن کا شناختی ثبوت وہی ہو جو آپ امتحان کے دن لائیں، اور نتیجہ آنے میں عموماً دن یا ہفتے لگتے ہیں — اس کا حساب رکھیں۔",
        ),
      },
      {
        title: L("Send scores officially and keep the validity in mind", "اسکور سرکاری طریقے سے بھیجیں اور مدتِ درستی یاد رکھیں"),
        body: L(
          "Most institutions want scores sent electronically by the test provider. Scores are usually valid for two years; make sure they are still valid on the day you apply.",
          "اکثر ادارے چاہتے ہیں کہ اسکور ٹیسٹ فراہم کنندہ خود الیکٹرانک طور پر بھیجے۔ اسکور عموماً دو سال درست رہتے ہیں؛ یقینی بنائیں کہ درخواست کے دن بھی درست ہوں۔",
        ),
      },
    ],
    checklist: [
      L("The accepted tests and minimum scores, from the programme's own page", "پروگرام کے اپنے صفحے سے قبول شدہ ٹیسٹ اور کم از کم اسکور"),
      L("Valid ID that matches your registration", "رجسٹریشن سے مطابقت رکھنے والا درست شناختی ثبوت"),
      L("A weekly practice schedule", "ہفتہ وار مشق کا شیڈول"),
      L("Official practice materials", "سرکاری مشقی مواد"),
      L("Test dates that leave time for results before the deadline", "ایسی تاریخیں جن میں آخری تاریخ سے پہلے نتیجہ آ جائے"),
    ],
    pitfalls: [
      L("Anyone selling ‘guaranteed band 7’, leaked questions or a ‘certificate without the test’ — it is fraud and can get you banned.", "‘یقینی بینڈ 7’، لیک سوالات یا ‘ٹیسٹ کے بغیر سرٹیفکیٹ’ بیچنے والا — یہ فراڈ ہے اور آپ پر پابندی لگ سکتی ہے۔"),
      L("Booking too late to get results before the deadline.", "اتنی دیر سے بک کرنا کہ آخری تاریخ سے پہلے نتیجہ نہ آ سکے۔"),
      L("Ignoring minimum sub-scores (a high overall can still fail a section minimum).", "ہر حصے کے کم از کم اسکور کو نظر انداز کرنا (مجموعی اسکور اچھا ہو پھر بھی کسی حصے کی شرط پوری نہ ہو سکتی ہے)۔"),
    ],
    resourceIds: ["ielts", "british-council-ielts", "toefl", "gre", "duolingo-english-test", "khan-academy"],
    related: ["study-abroad-roadmap", "learn-free-90-days"],
    appIds: ["cognitive-fitness"],
    tools: ["plan"],
    keywords: ["ielts", "toefl", "pte", "duolingo", "english test", "band score", "english proficiency", "moi", "ielts ki tayari", "انگریزی ٹیسٹ", "آئیلٹس", "ٹوئیفل"],
    reviewed: REVIEWED,
  },

  // ─── CV, cover letter, SOP ─────────────────────────────────────────────────
  {
    id: "cv-cover-sop",
    category: "study",
    emoji: "📝",
    title: L("CV, cover letter and SOP: how to write them", "سی وی، کور لیٹر اور ایس او پی: کیسے لکھیں"),
    summary: L("A structure for each document, what reviewers look for, and how to ask for reference letters.", "ہر دستاویز کا ڈھانچا، جائزہ لینے والے کیا دیکھتے ہیں، اور سفارشی خط کیسے مانگیں۔"),
    audience: L("Applicants for jobs, internships, scholarships and admissions.", "نوکری، انٹرن شپ، اسکالرشپ اور داخلے کے امیدوار۔"),
    duration: L("A weekend for the first version, then revisions", "پہلے مسودے کے لیے ایک ویک اینڈ، پھر اصلاحات"),
    steps: [
      {
        title: L("Collect your material once", "اپنا مواد ایک بار جمع کریں"),
        body: L(
          "List your education, jobs, projects, awards, volunteering and skills with exact dates and, wherever possible, numbers (how many users, how much saved, what rank). You will reuse this for every application.",
          "اپنی تعلیم، ملازمتیں، پراجیکٹس، اعزازات، رضاکارانہ کام اور مہارتیں درست تاریخوں کے ساتھ لکھیں، اور جہاں ممکن ہو اعداد کے ساتھ (کتنے صارفین، کتنی بچت، کون سا رینک)۔ یہ ہر درخواست میں کام آئے گا۔",
        ),
      },
      {
        title: L("CV: one or two pages, same style throughout", "سی وی: ایک یا دو صفحے، شروع سے آخر تک یکساں انداز"),
        body: L(
          "Contact details and a professional email, education, experience or projects, skills, awards. Lead each bullet with what you did and the result. For applications to the UK, Europe or North America, leave out photo, age, marital status and religion unless the form asks; for Pakistani government forms, follow the advertisement's format exactly. Save as PDF.",
          "رابطے کی تفصیل اور پیشہ ورانہ ای میل، تعلیم، تجربہ یا پراجیکٹس، مہارتیں، اعزازات۔ ہر نکتہ اس سے شروع کریں کہ آپ نے کیا کیا اور نتیجہ کیا نکلا۔ برطانیہ، یورپ یا شمالی امریکا کی درخواستوں میں تصویر، عمر، ازدواجی حیثیت اور مذہب شامل نہ کریں جب تک فارم نہ مانگے؛ پاکستانی سرکاری فارموں میں اشتہار کا فارمیٹ ہو بہو اپنائیں۔ پی ڈی ایف میں محفوظ کریں۔",
        ),
      },
      {
        title: L("Cover letter: three short paragraphs", "کور لیٹر: تین مختصر پیراگراف"),
        body: L(
          "Why this role at this organisation; two pieces of evidence that you can do it; a polite close with your availability. Address a named person where you can, and rewrite it for every application.",
          "اس ادارے میں اس کردار کی خواہش کیوں؛ دو شواہد کہ آپ یہ کام کر سکتے ہیں؛ اپنی دستیابی کے ساتھ مہذب اختتام۔ جہاں ممکن ہو کسی نامزد شخص کو مخاطب کریں اور ہر درخواست کے لیے دوبارہ لکھیں۔",
        ),
      },
      {
        title: L("Statement of purpose: a story with a point", "ایس او پی: مقصد والی کہانی"),
        body: L(
          "Open with a specific moment that shows your interest, then your background, why this programme and this university, what you will do with it afterwards, and — if the scholarship requires it — how it connects to Pakistan. Stay within the word limit, write in your own voice, and never invent achievements: documents get verified.",
          "کسی مخصوص لمحے سے آغاز کریں جو آپ کی دلچسپی ظاہر کرے، پھر پس منظر، یہی پروگرام اور یہی جامعہ کیوں، بعد میں آپ اس سے کیا کریں گے، اور — اگر وظیفے کی شرط ہو — اس کا پاکستان سے تعلق۔ الفاظ کی حد میں رہیں، اپنی آواز میں لکھیں، اور کوئی کامیابی گھڑیں نہیں: دستاویزات کی تصدیق ہوتی ہے۔",
        ),
      },
      {
        title: L("References: ask early, make it easy", "سفارشی خطوط: جلد کہیں، کام آسان بنائیں"),
        body: L(
          "Choose people who have seen your work. Ask three to four weeks ahead, send your CV, your draft SOP, the programme description and each deadline, and thank them afterwards.",
          "ایسے لوگ چنیں جنہوں نے آپ کا کام دیکھا ہو۔ تین سے چار ہفتے پہلے کہیں، اپنا سی وی، ایس او پی کا مسودہ، پروگرام کی تفصیل اور ہر آخری تاریخ بھیجیں، اور بعد میں شکریہ ادا کریں۔",
        ),
      },
      {
        title: L("Proofread, get a second reader, and check the file", "پروف ریڈنگ کریں، دوسرے سے پڑھوائیں اور فائل جانچیں"),
        body: L(
          "Read it aloud, ask someone who does not know you to explain what you do, check names and dates, and open the PDF on a phone to see how it looks.",
          "بلند آواز میں پڑھیں، کسی انجان شخص سے کہیں کہ بتائے آپ کیا کرتے ہیں، نام اور تاریخیں جانچیں، اور پی ڈی ایف فون پر کھول کر دیکھیں۔",
        ),
      },
    ],
    checklist: [
      L("Master list of education, work, projects, awards", "تعلیم، کام، پراجیکٹس، اعزازات کی مکمل فہرست"),
      L("A professional email address", "پیشہ ورانہ ای میل ایڈریس"),
      L("CV as PDF with a clear file name (e.g. Firstname-Lastname-CV.pdf)", "واضح نام کے ساتھ پی ڈی ایف سی وی (مثلاً Firstname-Lastname-CV.pdf)"),
      L("SOP within the word limit", "الفاظ کی حد میں ایس او پی"),
      L("Names, positions and email addresses of your referees", "سفارش کنندگان کے نام، عہدے اور ای میل"),
    ],
    pitfalls: [
      L("Copying a template or an essay from the internet — and, increasingly, from AI tools without making it yours.", "انٹرنیٹ سے ٹیمپلیٹ یا مضمون نقل کرنا — اور اے آئی ٹولز کا متن اپنا بنائے بغیر استعمال کرنا۔"),
      L("Typos and inconsistent dates.", "املا کی غلطیاں اور غیر مطابق تاریخیں۔"),
      L("Listing duties instead of results.", "نتائج کے بجائے ذمہ داریاں لکھنا۔"),
      L("Claiming experience you cannot document.", "ایسا تجربہ بتانا جس کا ثبوت نہ ہو۔"),
    ],
    resourceIds: ["chevening", "daad", "usefp-fulbright", "khan-academy"],
    related: ["study-abroad-roadmap", "internship-playbook"],
    tools: ["plan"],
    keywords: ["cv", "resume", "cover letter", "sop", "statement of purpose", "motivation letter", "reference letter", "recommendation", "personal statement", "cv kaise banayen", "سی وی", "کور لیٹر", "ایس او پی", "سفارشی خط"],
    reviewed: REVIEWED,
  },

  // ─── MDCAT ─────────────────────────────────────────────────────────────────
  {
    id: "mdcat-roadmap",
    category: "study",
    emoji: "🩺",
    title: L("MDCAT: from preparation to admission", "ایم ڈی کیٹ: تیاری سے داخلے تک"),
    summary: L("A realistic plan for the medical entry test, with what to verify each year rather than rely on hearsay.", "میڈیکل داخلہ ٹیسٹ کا حقیقت پسندانہ منصوبہ، اور وہ باتیں جو ہر سال سنی سنائی کے بجائے تصدیق سے دیکھنی چاہئیں۔"),
    audience: L("FSc pre-medical students and repeaters aiming for medical or dental college.", "ایف ایس سی پری میڈیکل کے طلبہ اور دوبارہ دینے والے جو میڈیکل یا ڈینٹل کالج چاہتے ہیں۔"),
    duration: L("Usually months of steady work", "عموماً مہینوں کی مستقل محنت"),
    steps: [
      {
        title: L("Read the current official notification", "موجودہ سرکاری اعلان پڑھیں"),
        body: L(
          "The syllabus, eligibility, registration steps and exam schedule are announced each year by the medical regulator and provincial authorities, and they have changed between years. Start from PMDC's announcements, not from social media.",
          "نصاب، اہلیت، رجسٹریشن کے مراحل اور امتحان کا شیڈول ہر سال طبی ریگولیٹر اور صوبائی ادارے اعلان کرتے ہیں، اور یہ سالوں میں بدلتے رہے ہیں۔ پی ایم ڈی سی کے اعلانات سے آغاز کریں، سوشل میڈیا سے نہیں۔",
        ),
        resourceIds: ["pmdc"],
      },
      {
        title: L("Turn the syllabus into weekly targets", "نصاب کو ہفتہ وار اہداف میں بدلیں"),
        body: L(
          "Count the weeks you have, give heavier topics more time, and leave the last weeks for full-length revision. A plan you can follow on a bad week is better than a perfect plan you drop.",
          "جتنے ہفتے ہیں گنیں، بھاری موضوعات کو زیادہ وقت دیں، اور آخری ہفتے مکمل دہرائی کے لیے رکھیں۔ وہ منصوبہ بہتر ہے جس پر برے ہفتے میں بھی چلا جا سکے، نہ کہ مثالی منصوبہ جو چھوٹ جائے۔",
        ),
      },
      {
        title: L("Practise by topic, then in timed full-length tests", "پہلے موضوع وار، پھر وقت کے ساتھ مکمل ٹیسٹ"),
        body: L(
          "Use topic quizzes while you learn, then move to full-length timed tests so speed and stamina are not a surprise on exam day. MDCAT PrepMaster gives you timed quizzes and notes.",
          "سیکھتے وقت موضوع وار کوئز استعمال کریں، پھر وقت کے ساتھ مکمل ٹیسٹ تاکہ امتحان کے دن رفتار اور برداشت حیران نہ کریں۔ ایم ڈی کیٹ پریپ ماسٹر میں وقت کے ساتھ کوئز اور نوٹس ملتے ہیں۔",
        ),
      },
      {
        title: L("Keep an error log", "غلطیوں کی ڈائری رکھیں"),
        body: L(
          "For every wrong answer note whether it was a concept gap, a careless slip or a time problem, and re-test those topics a week later.",
          "ہر غلط جواب کے ساتھ لکھیں کہ وجہ تصور کی کمی تھی، لاپروائی یا وقت کا مسئلہ، اور ایک ہفتے بعد انہی موضوعات کا دوبارہ ٹیسٹ لیں۔",
        ),
      },
      {
        title: L("Register on time, through official channels only", "بروقت اور صرف سرکاری ذرائع سے رجسٹر کریں"),
        body: L(
          "Use only the registration portal and fee channel named in the official notification, and keep the receipt, roll number and test-centre details safe.",
          "صرف سرکاری اعلان میں بتائے گئے رجسٹریشن پورٹل اور فیس کے ذریعے استعمال کریں، اور رسید، رول نمبر اور ٹیسٹ سینٹر کی تفصیل محفوظ رکھیں۔",
        ),
        resourceIds: ["pmdc"],
      },
      {
        title: L("Understand merit and admissions before result day", "نتیجے کے دن سے پہلے میرٹ اور داخلے کا طریقہ سمجھ لیں"),
        body: L(
          "Merit usually combines the entry test with earlier marks according to that year's policy, and college choice is made through the provincial admission process. Check the formula and the document list for your year, and keep attested copies ready.",
          "میرٹ عموماً اس سال کی پالیسی کے مطابق داخلہ ٹیسٹ اور پچھلے نمبروں سے بنتا ہے، اور کالج کا انتخاب صوبائی داخلہ عمل کے ذریعے ہوتا ہے۔ اپنے سال کا فارمولا اور دستاویزات کی فہرست دیکھیں اور تصدیق شدہ نقول تیار رکھیں۔",
        ),
      },
      {
        title: L("Have a plan B", "متبادل منصوبہ رکھیں"),
        body: L(
          "Allied health sciences, nursing, pharmacy, physiotherapy and dentistry have their own routes and dates. List them now so result day is not a crisis.",
          "الائیڈ ہیلتھ سائنسز، نرسنگ، فارمیسی، فزیوتھراپی اور ڈینٹسٹری کے اپنے راستے اور تاریخیں ہیں۔ ابھی فہرست بنا لیں تاکہ نتیجے کا دن بحران نہ بنے۔",
        ),
      },
    ],
    checklist: [
      L("Official notification saved and re-read", "سرکاری اعلان محفوظ اور دوبارہ پڑھا ہوا"),
      L("Weekly study plan with revision weeks", "دہرائی کے ہفتوں کے ساتھ ہفتہ وار منصوبہ"),
      L("Timed full-length test every week in the last stretch", "آخری مرحلے میں ہر ہفتے وقت کے ساتھ مکمل ٹیسٹ"),
      L("CNIC or B-Form, Matric and FSc documents, domicile, photographs", "شناختی کارڈ یا ب فارم، میٹرک اور ایف ایس سی دستاویزات، ڈومیسائل، تصاویر"),
      L("Registration receipt and roll-number slip", "رجسٹریشن کی رسید اور رول نمبر سلپ"),
    ],
    pitfalls: [
      L("Agents or ‘academies’ selling guaranteed seats or leaked papers.", "یقینی نشست یا لیک پرچے بیچنے والے ایجنٹ یا ‘اکیڈمیاں’۔"),
      L("Relying on last year's rules for this year's test.", "اس سال کے ٹیسٹ کے لیے پچھلے سال کے اصولوں پر بھروسا۔"),
      L("Studying only by reading and never under exam timing.", "صرف پڑھ کر تیاری اور امتحانی وقت میں کبھی مشق نہ کرنا۔"),
      L("Applying to a medical college without checking that it is recognised.", "تسلیم شدہ ہونے کی تصدیق کیے بغیر میڈیکل کالج میں درخواست دینا۔"),
    ],
    resourceIds: ["pmdc", "mdcat-prepmaster", "cognitive-fitness", "khan-academy"],
    related: ["after-matric-intermediate"],
    appIds: ["mdcat-prepmaster", "cognitive-fitness"],
    tools: ["plan"],
    keywords: ["mdcat", "medical entry test", "pmdc", "mbbs", "bds", "medical college", "pre-medical", "mdcat ki tayari", "ایم ڈی کیٹ", "میڈیکل", "ایم بی بی ایس"],
    reviewed: REVIEWED,
  },
];
