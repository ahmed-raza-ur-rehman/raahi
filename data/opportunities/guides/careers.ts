import type { Guide, LText } from "@/lib/opportunities/guides";

const L = (en: string, ur: string): LText => ({ en, ur });
const REVIEWED = "2026-10-11";

export const careerGuides: Guide[] = [
  // ─── Government jobs ───────────────────────────────────────────────────────
  {
    id: "apply-government-job",
    category: "careers",
    emoji: "🏛️",
    title: L("Apply for a government job in Pakistan", "پاکستان میں سرکاری نوکری کے لیے درخواست"),
    summary: L(
      "Where federal, provincial and testing-agency jobs are announced, what to prepare, and how to avoid fake ‘job’ sites.",
      "وفاقی، صوبائی اور ٹیسٹنگ ایجنسی کی نوکریوں کا اعلان کہاں ہوتا ہے، کیا تیار رکھنا ہے، اور جعلی ‘جاب’ سائٹس سے کیسے بچنا ہے۔",
    ),
    audience: L("Graduates and job seekers who want public-sector work.", "گریجویٹس اور وہ لوگ جو سرکاری ملازمت چاہتے ہیں۔"),
    steps: [
      {
        title: L("Know where jobs are announced", "جانیں کہ نوکریوں کا اعلان کہاں ہوتا ہے"),
        body: L(
          "Federal departments list vacancies on the National Job Portal (NJP), and higher-grade federal posts are filled through FPSC. Each province has its own Public Service Commission (PPSC, SPSC, KPPSC, BPSC, AJKPSC) for provincial posts, and many departments hire through testing agencies such as NTS, PTS, ETEA and OTS. Punjab also runs its own job portal.",
          "وفاقی محکمے خالی آسامیاں نیشنل جاب پورٹل (این جے پی) پر دیتے ہیں اور اعلیٰ گریڈ کی وفاقی آسامیاں ایف پی ایس سی کے ذریعے پُر ہوتی ہیں۔ ہر صوبے کا اپنا پبلک سروس کمیشن (پی پی ایس سی، ایس پی ایس سی، کے پی پی ایس سی، بی پی ایس سی، اے جے کے پی ایس سی) صوبائی آسامیوں کے لیے ہے، اور بہت سے محکمے این ٹی ایس، پی ٹی ایس، ای ٹی ای اے اور او ٹی ایس جیسی ٹیسٹنگ ایجنسیوں سے بھرتی کرتے ہیں۔ پنجاب کا اپنا جاب پورٹل بھی ہے۔",
        ),
        resourceIds: ["njp", "fpsc", "ppsc", "spsc", "kppsc", "bpsc", "ajkpsc", "jobs-punjab", "nts", "pts", "etea", "ots"],
      },
      {
        title: L("Create your accounts and scan your documents once", "اکاؤنٹ بنائیں اور دستاویزات ایک بار اسکین کر لیں"),
        body: L(
          "NJP, and most commission portals, need an account before you can apply. Keep clear scans of your CNIC, domicile, degrees, mark sheets, experience letters and a recent photograph in one folder with clear file names.",
          "این جے پی اور اکثر کمیشنوں کے پورٹلز پر درخواست سے پہلے اکاؤنٹ بنانا پڑتا ہے۔ شناختی کارڈ، ڈومیسائل، ڈگریوں، نمبروں کی فہرست، تجربے کے خطوط اور حالیہ تصویر کے صاف اسکین ایک فولڈر میں واضح ناموں کے ساتھ رکھیں۔",
        ),
        resourceIds: ["njp"],
      },
      {
        title: L("Read the advertisement line by line", "اشتہار لفظ بہ لفظ پڑھیں"),
        body: L(
          "Check the post's grade, qualification, age limit and relaxations, domicile or quota rules, experience required, last date, and the fee (if any) and how it must be paid. If you do not meet a requirement, the application and the fee are wasted.",
          "عہدے کا گریڈ، تعلیمی قابلیت، عمر کی حد اور رعایتیں، ڈومیسائل یا کوٹے کے اصول، مطلوبہ تجربہ، آخری تاریخ اور فیس (اگر ہو) اور اس کی ادائیگی کا طریقہ دیکھیں۔ شرط پوری نہ ہو تو درخواست اور فیس دونوں ضائع ہوتے ہیں۔",
        ),
      },
      {
        title: L("Pay only through the channel named in the advertisement", "صرف اشتہار میں بتائے گئے ذریعے سے ادائیگی کریں"),
        body: L(
          "Fees, where they exist, are paid through the bank challan, PSID or online method written in the official advertisement. No one can ‘arrange’ a job for money, and no genuine department asks you to send cash to a person's account or wallet.",
          "فیس، جہاں ہو، اشتہار میں لکھے بینک چالان، پی ایس آئی ڈی یا آن لائن طریقے سے جمع ہوتی ہے۔ پیسوں کے بدلے نوکری ‘لگوانے’ والا کوئی نہیں ہوتا، اور کوئی اصل محکمہ آپ سے کسی فرد کے اکاؤنٹ یا والٹ میں رقم نہیں مانگتا۔",
        ),
      },
      {
        title: L("Apply before the last day and keep proof", "آخری دن سے پہلے درخواست دیں اور ثبوت رکھیں"),
        body: L(
          "Submit at least two days early and save the confirmation, the fee receipt and any roll-number slip. Portals jam on the last day.",
          "کم از کم دو دن پہلے جمع کرائیں اور تصدیقی پیغام، فیس کی رسید اور رول نمبر سلپ محفوظ رکھیں۔ آخری دن پورٹل سست ہو جاتے ہیں۔",
        ),
      },
      {
        title: L("Prepare for the screening test and interview", "اسکریننگ ٹیسٹ اور انٹرویو کی تیاری کریں"),
        body: L(
          "Many commission and agency recruitments start with an MCQ screening or ability test, followed by written papers or an interview. Practise with past papers from the official site and timed MCQs.",
          "بہت سی کمیشن اور ایجنسی بھرتیاں ایم سی کیو اسکریننگ یا ایبلٹی ٹیسٹ سے شروع ہوتی ہیں، پھر تحریری پرچے یا انٹرویو۔ سرکاری سائٹ کے پرانے پرچوں اور وقت کے ساتھ ایم سی کیوز کی مشق کریں۔",
        ),
      },
      {
        title: L("Follow results only on the official site", "نتائج صرف سرکاری سائٹ پر دیکھیں"),
        body: L(
          "Roll-number slips, results and interview calls appear on the official portal. WhatsApp groups and look-alike sites are not official — compare the web address with the one in RAAHI's directory.",
          "رول نمبر سلپ، نتائج اور انٹرویو کالز سرکاری پورٹل پر آتی ہیں۔ واٹس ایپ گروپ اور ملتی جلتی سائٹس سرکاری نہیں — ویب ایڈریس کا راہی کی ڈائریکٹری والے ایڈریس سے موازنہ کریں۔",
        ),
      },
    ],
    checklist: [
      L("CNIC (and B-Form if under 18)", "شناختی کارڈ (اور 18 سال سے کم ہوں تو ب فارم)"),
      L("Domicile certificate", "ڈومیسائل سرٹیفکیٹ"),
      L("Educational certificates and degrees", "تعلیمی سرٹیفکیٹ اور ڈگریاں"),
      L("Experience letters", "تجربے کے خطوط"),
      L("No-objection certificate if you are already in government service", "اگر پہلے سے سرکاری ملازم ہوں تو عدم اعتراض سرٹیفکیٹ"),
      L("Quota certificates, if you apply under a quota", "کوٹے پر درخواست ہو تو کوٹے کے سرٹیفکیٹ"),
      L("Recent photograph", "حالیہ تصویر"),
      L("Fee challan or payment proof", "فیس چالان یا ادائیگی کا ثبوت"),
      L("A working email and mobile number", "کام کرتا ای میل اور موبائل نمبر"),
    ],
    pitfalls: [
      L("Fake ‘government job’ ads on social media that ask for a fee to a personal account.", "سوشل میڈیا پر جعلی ‘سرکاری نوکری’ کے اشتہار جو ذاتی اکاؤنٹ میں فیس مانگتے ہیں۔"),
      L("Applying without reading the age limit and domicile rule.", "عمر کی حد اور ڈومیسائل کا اصول پڑھے بغیر درخواست دینا۔"),
      L("Trusting copy-paste websites for last dates — compare with the official advertisement.", "آخری تاریخوں کے لیے نقل شدہ ویب سائٹس پر بھروسا — سرکاری اشتہار سے موازنہ کریں۔"),
      L("Sharing your CNIC photo, selfie or an OTP with an ‘agent’.", "کسی ‘ایجنٹ’ کو شناختی کارڈ کی تصویر، سیلفی یا او ٹی پی دینا۔"),
    ],
    resourceIds: ["njp", "fpsc", "ppsc", "spsc", "kppsc", "bpsc", "ajkpsc", "jobs-punjab", "nts", "etea", "neuroprep", "pts", "ots"],
    related: ["css-pms-prep", "spot-fake-offers", "cv-cover-sop"],
    opportunityQuery: { kinds: ["job"], scope: "pakistan" },
    appIds: ["neuroprep"],
    tools: ["scam", "plan", "age", "cv"],
    keywords: ["government job", "sarkari naukri", "sarkari job", "njp", "fpsc", "ppsc", "spsc", "kppsc", "ajkpsc", "nts", "bps", "bharti", "apply online", "naukri", "سرکاری نوکری", "سرکاری ملازمت", "بھرتی", "درخواست"],
    reviewed: REVIEWED,
  },

  // ─── CSS / PMS / PSC prep ──────────────────────────────────────────────────
  {
    id: "css-pms-prep",
    category: "careers",
    emoji: "📚",
    title: L("Prepare for CSS, PMS and Public Service Commission exams", "سی ایس ایس، پی ایم ایس اور پبلک سروس کمیشن امتحانات کی تیاری"),
    summary: L("A steady, honest plan for competitive exams — from the official syllabus to interview practice.", "مقابلے کے امتحانات کا مستقل اور دیانت دارانہ منصوبہ — سرکاری نصاب سے انٹرویو کی مشق تک۔"),
    audience: L("Graduates preparing for CSS, provincial service exams or commission recruitments.", "گریجویٹس جو سی ایس ایس، صوبائی سروس امتحانات یا کمیشن بھرتیوں کی تیاری کر رہے ہیں۔"),
    duration: L("Many months — consistency matters more than speed", "کئی مہینے — رفتار سے زیادہ تسلسل اہم ہے"),
    steps: [
      {
        title: L("Confirm eligibility from the current advertisement", "موجودہ اشتہار سے اہلیت کی تصدیق کریں"),
        body: L(
          "Education, age limits and the number of attempts are set by each year's rules and advertisement. Read them on the commission's site before starting a long preparation.",
          "تعلیم، عمر کی حد اور مواقع کی تعداد ہر سال کے قواعد اور اشتہار میں طے ہوتی ہے۔ طویل تیاری شروع کرنے سے پہلے کمیشن کی سائٹ پر انہیں پڑھ لیں۔",
        ),
        resourceIds: ["fpsc", "ppsc", "ajkpsc", "kppsc", "spsc", "bpsc"],
      },
      {
        title: L("Get the official syllabus and past papers", "سرکاری نصاب اور پرانے پرچے حاصل کریں"),
        body: L(
          "Use the commission's own syllabus for compulsory and optional subjects, and past papers to learn the pattern. Ignore anyone selling ‘leaked’ papers — that is a scam.",
          "لازمی اور اختیاری مضامین کے لیے کمیشن کا اپنا نصاب اور انداز سمجھنے کے لیے پرانے پرچے استعمال کریں۔ ‘لیک’ پرچے بیچنے والے کو نظر انداز کریں — یہ فراڈ ہے۔",
        ),
      },
      {
        title: L("Plan backwards from the exam date", "امتحان کی تاریخ سے الٹا منصوبہ بنائیں"),
        body: L(
          "Split the months you have between compulsory subjects, your optional subjects and revision, with a weekly mock. A realistic plan you follow beats a heroic one you abandon.",
          "جتنے مہینے ہیں انہیں لازمی مضامین، اختیاری مضامین اور دہرائی میں تقسیم کریں، ہر ہفتے ایک مشقی ٹیسٹ کے ساتھ۔ حقیقت پسندانہ منصوبہ جس پر عمل ہو، بہادرانہ منصوبے سے بہتر ہے جو چھوٹ جائے۔",
        ),
      },
      {
        title: L("Practise screening-test MCQs daily", "اسکریننگ ٹیسٹ کے ایم سی کیوز روزانہ حل کریں"),
        body: L(
          "Many commissions screen candidates with an MCQ test first. Short daily practice with spaced repetition works better than weekend marathons. NeuroPrep is built for exactly this.",
          "بہت سے کمیشن پہلے ایم سی کیو ٹیسٹ سے چھانٹی کرتے ہیں۔ وقفے وقفے سے دہرائی کے ساتھ روزانہ مختصر مشق ہفتہ وار طویل سیشنوں سے بہتر ہے۔ نیوروپریپ بالکل اسی کے لیے بنا ہے۔",
        ),
        resourceIds: ["neuroprep"],
      },
      {
        title: L("Write every day", "روزانہ لکھیں"),
        body: L(
          "Essay, précis and composition improve only by writing and getting feedback — from a teacher, a study partner, or a clear marking checklist.",
          "مضمون، خلاصہ اور تحریر صرف لکھنے اور رائے لینے سے بہتر ہوتے ہیں — استاد، ساتھی یا واضح مارکنگ چیک لسٹ سے۔",
        ),
      },
      {
        title: L("Follow current affairs steadily; rehearse the interview", "حالات حاضرہ پر مستقل نظر رکھیں؛ انٹرویو کی مشق کریں"),
        body: L(
          "Keep a short diary of national and international events and practise answering aloud: why this service, what you know about your province and about public administration.",
          "قومی اور بین الاقوامی واقعات کی مختصر ڈائری رکھیں اور بلند آواز میں جواب دینے کی مشق کریں: یہی سروس کیوں، اپنے صوبے اور عوامی انتظامیہ کے بارے میں آپ کیا جانتے ہیں۔",
        ),
      },
      {
        title: L("Protect your sleep, health and routine", "نیند، صحت اور معمول کی حفاظت کریں"),
        body: L(
          "Sleep, movement and breaks are part of preparation. Cognitive Fitness has study-habit and focus practices (it is not medical care — if stress is overwhelming, talk to someone you trust or a professional).",
          "نیند، حرکت اور وقفے تیاری کا حصہ ہیں۔ کوگنیٹو فٹنس میں مطالعے کی عادات اور توجہ کی مشقیں ہیں (یہ طبی علاج نہیں — دباؤ بہت زیادہ ہو تو کسی قابل اعتماد شخص یا ماہر سے بات کریں)۔",
        ),
        resourceIds: ["cognitive-fitness"],
      },
    ],
    checklist: [
      L("Official syllabus for every subject", "ہر مضمون کا سرکاری نصاب"),
      L("Calendar with the exam date and mock dates", "امتحان اور مشقی ٹیسٹ کی تاریخوں کے ساتھ کیلنڈر"),
      L("Three to five years of past papers", "تین سے پانچ سال کے پرانے پرچے"),
      L("A notebook for current affairs", "حالات حاضرہ کے لیے کاپی"),
      L("A study partner or mentor", "مطالعے کا ساتھی یا رہنما"),
    ],
    pitfalls: [
      L("Paying for ‘guaranteed’ coaching or leaked papers.", "‘یقینی’ کوچنگ یا لیک پرچوں کے لیے ادائیگی۔"),
      L("Choosing optional subjects without checking how they score.", "نمبر لینے کا رجحان دیکھے بغیر اختیاری مضامین چننا۔"),
      L("Studying theory and never timing yourself.", "صرف نظری مطالعہ اور کبھی وقت کے ساتھ مشق نہ کرنا۔"),
      L("Burning out in the second month.", "دوسرے مہینے میں تھک کر بیٹھ جانا۔"),
    ],
    resourceIds: ["fpsc", "ppsc", "ajkpsc", "kppsc", "spsc", "bpsc", "neuroprep", "cognitive-fitness"],
    related: ["apply-government-job"],
    opportunityQuery: { kinds: ["job"], scope: "pakistan", q: "public service commission" },
    appIds: ["neuroprep", "cognitive-fitness"],
    tools: ["plan", "age"],
    keywords: ["css", "pms", "fpsc", "ppsc", "ajkpsc", "kppsc", "spsc", "bpsc", "competitive exam", "psc exam", "css ki tayari", "syllabus", "mcq", "past papers", "سی ایس ایس", "پی ایم ایس", "کمیشن", "امتحان کی تیاری"],
    reviewed: REVIEWED,
  },

  // ─── Internships ───────────────────────────────────────────────────────────
  {
    id: "internship-playbook",
    category: "careers",
    emoji: "🧑‍💻",
    title: L("Land an internship in Pakistan or abroad", "پاکستان یا بیرون ملک انٹرن شپ حاصل کریں"),
    summary: L("When to apply, where to look, what to send — and how to spot an ‘internship’ that is really a fee.", "کب درخواست دیں، کہاں دیکھیں، کیا بھیجیں — اور ایسی ‘انٹرن شپ’ کیسے پہچانیں جو دراصل فیس ہو۔"),
    audience: L("Students and fresh graduates looking for their first work experience.", "طلبہ اور نئے گریجویٹس جو پہلا کام کا تجربہ چاہتے ہیں۔"),
    steps: [
      {
        title: L("Decide the field and the season", "شعبہ اور موسم طے کریں"),
        body: L(
          "Pick two or three fields you want to try. Many Pakistani institutions announce summer internships in spring and close within weeks — for example, NASTP's 2026 summer round closed on 22 June — so look a few months early. International programmes often open many months ahead.",
          "دو تین شعبے چنیں جنہیں آزمانا چاہتے ہیں۔ بہت سے پاکستانی ادارے موسم گرما کی انٹرن شپ بہار میں اعلان کرتے ہیں اور چند ہفتوں میں بند کر دیتے ہیں — مثلاً ناسٹپ کا 2026 کا گرمیوں کا راؤنڈ 22 جون کو بند ہوا — اس لیے چند ماہ پہلے دیکھنا شروع کریں۔ بین الاقوامی پروگرام اکثر کئی ماہ پہلے کھلتے ہیں۔",
        ),
      },
      {
        title: L("Build a one-page CV and one small project", "ایک صفحے کا سی وی اور ایک چھوٹا پراجیکٹ بنائیں"),
        body: L(
          "A class project, a volunteer drive or a small app is enough if you can explain what you did and what happened. Put a link on your CV.",
          "کلاس پراجیکٹ، رضاکارانہ مہم یا چھوٹی ایپ کافی ہے اگر آپ بتا سکیں کہ کیا کیا اور کیا نتیجہ نکلا۔ اپنے سی وی میں لنک دیں۔",
        ),
      },
      {
        title: L("Look in the right places", "صحیح جگہوں پر دیکھیں"),
        body: L(
          "Official programme pages (PITB, NASTP and other public bodies), your university's career office, RAAHI's internship feed, and for open-source or global programmes: Google Summer of Code, Outreachy and the MLH Fellowship. Prefer the organisation's own page over reposts.",
          "سرکاری پروگرام کے صفحات (پی آئی ٹی بی، ناسٹپ اور دیگر عوامی ادارے)، آپ کی جامعہ کا کیریئر آفس، راہی کی انٹرن شپ فیڈ، اور اوپن سورس یا عالمی پروگراموں کے لیے: گوگل سمر آف کوڈ، آؤٹ ریچی اور ایم ایل ایچ فیلوشپ۔ دوبارہ شائع شدہ پوسٹوں کے بجائے ادارے کا اپنا صفحہ ترجیح دیں۔",
        ),
        resourceIds: ["pitb", "nastp", "nastp-hr", "gsoc", "outreachy", "mlh-fellowship", "simplify-internships"],
      },
      {
        title: L("Apply with a short, specific message", "مختصر اور مخصوص پیغام کے ساتھ درخواست دیں"),
        body: L(
          "Say which role, what you can already do and when you are available. Follow the application instructions exactly; follow up once, politely, after a week or two.",
          "بتائیں کون سا کردار، آپ پہلے سے کیا کر سکتے ہیں اور کب دستیاب ہیں۔ درخواست کی ہدایات ٹھیک ٹھیک مانیں؛ ایک دو ہفتے بعد ایک بار شائستگی سے یاد دہانی کریں۔",
        ),
      },
      {
        title: L("Check the offer in writing", "آفر تحریری طور پر دیکھیں"),
        body: L(
          "Ask for the duration, supervisor, stipend (or that it is unpaid), working hours and the certificate you will receive. A genuine internship does not charge you a fee to join.",
          "مدت، نگران، وظیفہ (یا یہ کہ بلا معاوضہ ہے)، اوقات کار اور ملنے والے سرٹیفکیٹ کے بارے میں پوچھیں۔ اصل انٹرن شپ شامل ہونے کی فیس نہیں مانگتی۔",
        ),
      },
      {
        title: L("Make the internship count", "انٹرن شپ کو کارآمد بنائیں"),
        body: L(
          "Set two goals in week one, ask for feedback every fortnight, keep a record of what you delivered, and ask for a reference letter before you leave.",
          "پہلے ہفتے دو اہداف طے کریں، ہر پندرہ دن بعد رائے مانگیں، اپنی کارکردگی کا ریکارڈ رکھیں، اور جانے سے پہلے سفارشی خط مانگیں۔",
        ),
      },
    ],
    checklist: [
      L("CV (one page) as PDF", "سی وی (ایک صفحہ) پی ڈی ایف میں"),
      L("Link to a project, GitHub, portfolio or report", "پراجیکٹ، گٹ ہب، پورٹ فولیو یا رپورٹ کا لنک"),
      L("University letter or enrolment proof, if asked", "جامعہ کا خط یا داخلے کا ثبوت، اگر مانگا جائے"),
      L("CNIC and recent photograph", "شناختی کارڈ اور حالیہ تصویر"),
      L("A list of two people who can speak for your work", "دو ایسے افراد کی فہرست جو آپ کے کام کی گواہی دے سکیں"),
    ],
    pitfalls: [
      L("Paying a ‘registration fee’ for an internship.", "انٹرن شپ کے لیے ‘رجسٹریشن فیس’ دینا۔"),
      L("Applying through reposts that point to a different site than the organisation's own.", "ایسی دوبارہ شائع شدہ پوسٹوں سے درخواست جو ادارے کی اپنی سائٹ کے بجائے کسی اور سائٹ پر لے جائیں۔"),
      L("Sending the same generic message to fifty places.", "پچاس جگہوں پر ایک ہی عمومی پیغام بھیجنا۔"),
    ],
    resourceIds: ["pitb", "nastp", "nastp-hr", "gsoc", "outreachy", "mlh-fellowship", "simplify-internships", "ignite"],
    related: ["cv-cover-sop", "spot-fake-offers"],
    opportunityQuery: { kinds: ["internship"] },
    tools: ["scam", "plan", "cv"],
    keywords: ["internship", "intern", "summer internship", "trainee", "stipend", "gsoc", "outreachy", "internship kaise", "انٹرن شپ", "انٹرن", "تربیت"],
    reviewed: REVIEWED,
  },

  // ─── Freelancing ───────────────────────────────────────────────────────────
  {
    id: "freelancing-start",
    category: "skills",
    emoji: "💻",
    title: L("Start freelancing from Pakistan", "پاکستان سے فری لانسنگ شروع کریں"),
    summary: L("Pick a skill, learn it for free, build proof of work and find clients safely.", "ایک ہنر چنیں، مفت سیکھیں، کام کا ثبوت بنائیں اور محفوظ طریقے سے کلائنٹ تلاش کریں۔"),
    audience: L("Students and job seekers who want to earn online.", "طلبہ اور روزگار کے متلاشی جو آن لائن کمانا چاہتے ہیں۔"),
    steps: [
      {
        title: L("Choose one marketable skill", "ایک قابل فروخت ہنر چنیں"),
        body: L(
          "Writing, design, video editing, web development, data work, translation or virtual assistance are common starting points. Choose one that matches your interest and test it with small gigs.",
          "تحریر، ڈیزائن، ویڈیو ایڈیٹنگ، ویب ڈویلپمنٹ، ڈیٹا کا کام، ترجمہ یا ورچوئل اسسٹنس عام آغاز ہیں۔ اپنی دلچسپی کے مطابق ایک چنیں اور چھوٹے کاموں سے آزمائیں۔",
        ),
      },
      {
        title: L("Learn it with free, structured courses", "اسے مفت اور منظم کورسز سے سیکھیں"),
        body: L(
          "DigiSkills and NAVTTC programmes offer skills training, and global courses such as freeCodeCamp, CS50 and Khan Academy are free to learn from. Finish one path rather than sampling ten.",
          "ڈیجی اسکلز اور نیوٹیک کے پروگرام ہنر کی تربیت دیتے ہیں، اور فری کوڈ کیمپ، سی ایس 50 اور خان اکیڈمی جیسے عالمی کورسز سیکھنے کے لیے مفت ہیں۔ دس میں سے تھوڑا تھوڑا آزمانے کے بجائے ایک راستہ مکمل کریں۔",
        ),
        resourceIds: ["digiskills", "navttc", "freecodecamp", "harvard-cs50", "khan-academy"],
      },
      {
        title: L("Build three samples that show your work", "تین نمونے بنائیں جو آپ کا کام دکھائیں"),
        body: L(
          "Make portfolio pieces for imaginary or volunteer clients and host them somewhere a stranger can open in one click.",
          "فرضی یا رضاکارانہ کلائنٹس کے لیے پورٹ فولیو کے نمونے بنائیں اور کہیں ایسی جگہ رکھیں جہاں اجنبی ایک کلک میں کھول سکے۔",
        ),
      },
      {
        title: L("Open one or two marketplace profiles — honestly", "ایک یا دو مارکیٹ پلیس پروفائل ایمانداری سے بنائیں"),
        body: L(
          "Use your real identity, one account per platform and the platform's own rules. Write proposals for the job in front of you rather than copying one message everywhere.",
          "اپنی اصل شناخت، ہر پلیٹ فارم پر ایک اکاؤنٹ اور پلیٹ فارم کے اپنے قواعد استعمال کریں۔ ہر جگہ ایک ہی پیغام نقل کرنے کے بجائے سامنے والے کام کے مطابق پروپوزل لکھیں۔",
        ),
        resourceIds: ["upwork", "fiverr", "freelancer"],
      },
      {
        title: L("Get paid safely", "ادائیگی محفوظ طریقے سے لیں"),
        body: L(
          "Keep payments and communication on the platform, use its escrow, and withdraw through the methods the platform currently supports for Pakistan. Keep invoices and bank records.",
          "ادائیگی اور رابطہ پلیٹ فارم ہی پر رکھیں، اس کا ایسکرو استعمال کریں، اور پاکستان کے لیے پلیٹ فارم کے موجودہ طریقوں سے رقم نکالیں۔ انوائس اور بینک ریکارڈ رکھیں۔",
        ),
      },
      {
        title: L("Learn the tax and registration basics", "ٹیکس اور رجسٹریشن کی بنیادی باتیں سیکھیں"),
        body: L(
          "Freelance income can be taxable and IT exporters may have registration options. Ask a tax professional or check the official FBR and PSEB pages for your situation; do not rely on forum advice.",
          "فری لانس آمدنی پر ٹیکس لگ سکتا ہے اور آئی ٹی برآمد کنندگان کے لیے رجسٹریشن کے اختیارات ہو سکتے ہیں۔ اپنی صورت حال کے لیے ٹیکس ماہر سے پوچھیں یا ایف بی آر اور پی ایس ای بی کے سرکاری صفحات دیکھیں؛ فورم کے مشوروں پر بھروسا نہ کریں۔",
        ),
        resourceIds: ["pseb"],
      },
    ],
    checklist: [
      L("One skill and a learning plan", "ایک ہنر اور سیکھنے کا منصوبہ"),
      L("Three portfolio samples", "پورٹ فولیو کے تین نمونے"),
      L("A professional email and a clear photo", "پیشہ ورانہ ای میل اور صاف تصویر"),
      L("A bank account that can receive platform withdrawals", "ایسا بینک اکاؤنٹ جو پلیٹ فارم کی رقم وصول کر سکے"),
      L("A folder for invoices and records", "انوائس اور ریکارڈ کا فولڈر"),
    ],
    pitfalls: [
      L("Paying for ‘verified accounts’, fake reviews or ‘gig unlock’ fees.", "‘ویریفائیڈ اکاؤنٹ’، جعلی ریویو یا ‘گِگ اَن لاک’ فیس کے لیے ادائیگی۔"),
      L("‘Task’ or ‘like-and-earn’ jobs that ask you to pay first.", "‘ٹاسک’ یا ‘لائک کریں اور کمائیں’ والے کام جو پہلے پیسے مانگیں۔"),
      L("Moving to WhatsApp or email with a new client before any payment is secured.", "ادائیگی محفوظ ہونے سے پہلے نئے کلائنٹ کے ساتھ واٹس ایپ یا ای میل پر چلے جانا۔"),
      L("Sharing OTPs, passwords or card details with a ‘client’.", "کسی ‘کلائنٹ’ کے ساتھ او ٹی پی، پاس ورڈ یا کارڈ کی تفصیل شیئر کرنا۔"),
    ],
    resourceIds: ["digiskills", "navttc", "pseb", "upwork", "fiverr", "freelancer", "weworkremotely", "himalayas", "remoteok", "freecodecamp", "harvard-cs50", "khan-academy"],
    related: ["learn-free-90-days", "spot-fake-offers"],
    opportunityQuery: { kinds: ["job"], remote: true, openToPakistan: true },
    appIds: ["cognitive-fitness"],
    tools: ["scam"],
    keywords: ["freelancing", "freelance", "upwork", "fiverr", "online earning", "work from home", "remote jobs", "digiskills", "online kamai", "ghar se kaam", "فری لانسنگ", "آن لائن کمائی", "گھر بیٹھے کام"],
    reviewed: REVIEWED,
  },

  // ─── Learn free ────────────────────────────────────────────────────────────
  {
    id: "learn-free-90-days",
    category: "skills",
    emoji: "🌱",
    title: L("Learn a skill for free in 90 days", "90 دن میں مفت کوئی ہنر سیکھیں"),
    summary: L("A simple 12-week structure using free courses, plus how to use Udemy coupons without risk.", "مفت کورسز کے ساتھ 12 ہفتوں کا سادہ ڈھانچا، اور یوڈیمی کوپن بغیر خطرے کے استعمال کرنے کا طریقہ۔"),
    audience: L("Anyone who wants a practical skill without paying course fees.", "کوئی بھی جو کورس کی فیس دیے بغیر عملی ہنر سیکھنا چاہے۔"),
    duration: L("12 weeks, about an hour a day", "12 ہفتے، روزانہ تقریباً ایک گھنٹہ"),
    steps: [
      {
        when: L("Week 1", "ہفتہ 1"),
        title: L("Pick one path and one main course", "ایک راستہ اور ایک بنیادی کورس چنیں"),
        body: L(
          "Choose a direction (for example web development, data analysis, digital marketing or English) and one structured course as your spine: Harvard's CS50, freeCodeCamp, Khan Academy, a Coursera or edX course you can audit, or a DigiSkills course.",
          "سمت چنیں (مثلاً ویب ڈویلپمنٹ، ڈیٹا اینالسس، ڈیجیٹل مارکیٹنگ یا انگریزی) اور ریڑھ کی ہڈی کے طور پر ایک منظم کورس: ہارورڈ کا سی ایس 50، فری کوڈ کیمپ، خان اکیڈمی، کورسیرا یا ایڈ ایکس کا کوئی آڈٹ کے قابل کورس، یا ڈیجی اسکلز کا کورس۔",
        ),
        resourceIds: ["harvard-cs50", "freecodecamp", "khan-academy", "coursera", "edx", "digiskills", "kaggle-learn", "odin-project"],
      },
      {
        when: L("Weeks 2–6", "ہفتے 2 تا 6"),
        title: L("Study daily, then build something every week", "روزانہ پڑھیں، پھر ہر ہفتے کچھ بنائیں"),
        body: L(
          "An hour a day beats a weekend binge. At the end of each week, make something small with what you learned — a page, a notebook, a poster, a spreadsheet.",
          "روزانہ ایک گھنٹہ ہفتہ وار مسلسل مطالعے سے بہتر ہے۔ ہر ہفتے کے آخر میں سیکھے ہوئے سے کچھ چھوٹا بنائیں — ایک صفحہ، نوٹ بک، پوسٹر یا اسپریڈ شیٹ۔",
        ),
      },
      {
        when: L("Weeks 7–10", "ہفتے 7 تا 10"),
        title: L("One real project", "ایک حقیقی پراجیکٹ"),
        body: L(
          "Solve a real problem for someone — a shop, a school, a neighbour or a friend's business — and write down what changed. This is what you will show people.",
          "کسی کے لیے حقیقی مسئلہ حل کریں — دکان، اسکول، ہمسایہ یا دوست کا کاروبار — اور لکھیں کہ کیا بدلا۔ یہی آپ لوگوں کو دکھائیں گے۔",
        ),
      },
      {
        when: L("Weeks 11–12", "ہفتے 11 اور 12"),
        title: L("Show your work and start applying", "اپنا کام دکھائیں اور درخواستیں شروع کریں"),
        body: L(
          "Put the project, a short write-up and your CV online, then apply to internships, freelance jobs or entry-level roles. Certificates from free courses are a bonus, not the proof — your project is.",
          "پراجیکٹ، مختصر تحریر اور اپنا سی وی آن لائن رکھیں، پھر انٹرن شپ، فری لانس کام یا ابتدائی ملازمتوں کے لیے درخواست دیں۔ مفت کورسز کے سرٹیفکیٹ اضافی ہیں، اصل ثبوت آپ کا پراجیکٹ ہے۔",
        ),
      },
      {
        title: L("Using Udemy coupons safely", "یوڈیمی کوپن محفوظ طریقے سے استعمال کریں"),
        body: L(
          "RAAHI lists 100%-off coupon links that aggregators publish. Coupons are limited and can end at any moment. Only ever enrol on udemy.com itself, and never give your Udemy password, card details or cookies to a ‘coupon enroller’ tool or site.",
          "راہی وہ 100 فیصد رعایت والے کوپن لنک دکھاتا ہے جو ایگریگیٹر شائع کرتے ہیں۔ کوپن محدود ہوتے ہیں اور کسی بھی لمحے ختم ہو سکتے ہیں۔ داخلہ صرف udemy.com ہی پر لیں، اور کسی ‘کوپن اینرولر’ ٹول یا سائٹ کو اپنا یوڈیمی پاس ورڈ، کارڈ کی تفصیل یا کوکیز کبھی نہ دیں۔",
        ),
        resourceIds: ["real-discount", "udemy-free"],
      },
    ],
    checklist: [
      L("One path and one main course", "ایک راستہ اور ایک بنیادی کورس"),
      L("A daily one-hour slot in your calendar", "کیلنڈر میں روزانہ ایک گھنٹے کا وقت"),
      L("A notebook or folder for weekly outputs", "ہفتہ وار نتائج کے لیے کاپی یا فولڈر"),
      L("A place to publish your project (a free page, a shared folder)", "پراجیکٹ شائع کرنے کی جگہ (مفت صفحہ، مشترک فولڈر)"),
    ],
    pitfalls: [
      L("Collecting courses and certificates instead of finishing one.", "ایک مکمل کرنے کے بجائے کورس اور سرٹیفکیٹ جمع کرتے رہنا۔"),
      L("Tutorial loops: watching without building.", "ٹیوٹوریل کا چکر: دیکھتے رہنا، بناتے نہ رہنا۔"),
      L("‘Free course’ links that ask for card details or your Udemy password.", "‘مفت کورس’ کے لنک جو کارڈ کی تفصیل یا یوڈیمی پاس ورڈ مانگیں۔"),
    ],
    resourceIds: ["harvard-cs50", "freecodecamp", "khan-academy", "coursera", "edx", "mit-ocw", "kaggle-learn", "google-career-certs", "digiskills", "real-discount", "odin-project", "udemy-free"],
    related: ["freelancing-start", "internship-playbook"],
    opportunityQuery: { kinds: ["course", "coupon"] },
    appIds: ["cognitive-fitness"],
    keywords: ["free courses", "learn", "skill", "udemy", "coupon", "course", "coursera", "edx", "cs50", "programming", "mufat course", "seekhna", "مفت کورس", "کورسز", "ہنر سیکھیں", "یوڈیمی"],
    reviewed: REVIEWED,
  },
];
