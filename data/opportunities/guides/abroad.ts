import type { Guide, LText } from "@/lib/opportunities/guides";

const L = (en: string, ur: string): LText => ({ en, ur });
const REVIEWED = "2026-10-11";

export const abroadGuides: Guide[] = [
  // ─── Working abroad legally ────────────────────────────────────────────────
  {
    id: "work-abroad-safely",
    category: "abroad",
    emoji: "🛂",
    title: L("Work abroad legally: the BE&OE / OEP / OEC checklist", "بیرون ملک قانونی طور پر کام: بی ای او ای / او ای پی / او ای سی چیک لسٹ"),
    summary: L(
      "The legal routes, how to verify an agent, what to pay and where, and the registration every emigrant needs — based on the Bureau of Emigration & Overseas Employment's own process pages.",
      "قانونی راستے، ایجنٹ کی تصدیق کیسے کریں، کیا اور کہاں ادا کرنا ہے، اور ہر تارکِ وطن کے لیے ضروری رجسٹریشن — بیورو آف امیگریشن اینڈ اوورسیز ایمپلائمنٹ کے اپنے طریقہ کار کے صفحات کی بنیاد پر۔",
    ),
    audience: L("People offered a job abroad, or looking for one through an agent, OEC or an employer.", "وہ لوگ جنہیں بیرون ملک نوکری کی پیشکش ہوئی ہو یا جو ایجنٹ، او ای سی یا آجر کے ذریعے تلاش کر رہے ہوں۔"),
    steps: [
      {
        title: L("Know the legal routes", "قانونی راستے جانیں"),
        body: L(
          "There are three: (1) a licensed Overseas Employment Promoter (OEP); (2) the Overseas Employment Corporation (OEC), the state-owned recruiter; (3) direct employment, where you find the employer yourself and register directly with the Bureau of Emigration & Overseas Employment (BE&OE). BE&OE itself describes two ways of registering for protection: direct, or through an OEP.",
          "تین ہیں: (1) لائسنس یافتہ اوورسیز ایمپلائمنٹ پروموٹر (او ای پی)؛ (2) اوورسیز ایمپلائمنٹ کارپوریشن (او ای سی)، سرکاری ملکیت کا ریکروٹر؛ (3) براہ راست ملازمت، جہاں آپ خود آجر تلاش کر کے بیورو آف امیگریشن اینڈ اوورسیز ایمپلائمنٹ (بی ای او ای) میں براہ راست رجسٹر ہوتے ہیں۔ بی ای او ای خود تحفظ کے لیے رجسٹریشن کے دو طریقے بتاتا ہے: براہ راست، یا او ای پی کے ذریعے۔",
        ),
        resourceIds: ["beoe", "oec", "beoe-eprotector"],
      },
      {
        title: L("If an agent is involved, verify the licence yourself", "ایجنٹ شامل ہو تو لائسنس خود چیک کریں"),
        body: L(
          "Ask for the agency's licence number — it looks like ‘OEPL No. 1234/LHR’ — and check it on BE&OE's list of active promoters. Also read BE&OE's public complaint, show-cause and blacklisting notices, which name licence numbers.",
          "ایجنسی کا لائسنس نمبر پوچھیں — یہ ‘OEPL No. 1234/LHR’ کی طرح ہوتا ہے — اور بی ای او ای کی فعال پروموٹرز کی فہرست میں دیکھیں۔ بی ای او ای کے عوامی شکایات، شوکاز اور بلیک لسٹنگ کے نوٹس بھی پڑھیں جن میں لائسنس نمبر درج ہوتے ہیں۔",
        ),
        resourceIds: ["beoe-oep-list", "beoe-complaints", "beoe-blacklist"],
      },
      {
        title: L("Ask for the permission number for your job", "اپنی نوکری کا پرمٹ نمبر پوچھیں"),
        body: L(
          "An OEP needs BE&OE's permission to process a foreign employer's demand. The permission number is the first document BE&OE asks for when you register through an OEP, so ask for it before you pay anything.",
          "او ای پی کو غیر ملکی آجر کی ڈیمانڈ پر عمل کے لیے بی ای او ای کی اجازت چاہیے۔ او ای پی کے ذریعے رجسٹریشن پر بی ای او ای سب سے پہلے پرمٹ نمبر مانگتا ہے، اس لیے کچھ ادا کرنے سے پہلے اسے طلب کریں۔",
        ),
        resourceIds: ["beoe-foreign-jobs", "beoe-guidelines"],
      },
      {
        title: L("Get the contract (Foreign Service Agreement) in writing and read it", "معاہدہ (فارن سروس ایگریمنٹ) تحریری لیں اور پڑھیں"),
        body: L(
          "It should state salary, duties, working hours, accommodation, duration and who pays for the ticket. Keep a copy; BE&OE lists the agreement among the documents for registration.",
          "اس میں تنخواہ، فرائض، اوقات کار، رہائش، مدت اور ٹکٹ کا خرچ کون اٹھائے گا لکھا ہونا چاہیے۔ نقل رکھیں؛ بی ای او ای رجسٹریشن کی دستاویزات میں اس معاہدے کو شامل کرتا ہے۔",
        ),
      },
      {
        title: L("Pay only official fees, through official channels, against receipts", "صرف سرکاری فیس، سرکاری ذرائع سے، رسید کے بدلے ادا کریں"),
        body: L(
          "BE&OE publishes the emigrant fee structure; registration, welfare-fund and protector fees are paid through official channels — in July 2026 BE&OE and National Bank of Pakistan launched a QR-based cashless fee payment. Never pay ‘visa money’ in cash or into a personal account, and always get a receipt.",
          "بی ای او ای تارکینِ وطن کی فیس کا ڈھانچا شائع کرتا ہے؛ رجسٹریشن، ویلفیئر فنڈ اور پروٹیکٹر کی فیس سرکاری ذرائع سے ادا ہوتی ہے — جولائی 2026 میں بی ای او ای اور نیشنل بینک آف پاکستان نے کیو آر پر مبنی کیش لیس فیس ادائیگی شروع کی۔ ‘ویزے کے پیسے’ کبھی نقد یا ذاتی اکاؤنٹ میں نہ دیں، اور ہمیشہ رسید لیں۔",
        ),
        resourceIds: ["beoe-fees"],
      },
      {
        title: L("Use only approved medical, trade-test and training centres", "صرف منظور شدہ میڈیکل، ٹریڈ ٹیسٹ اور تربیتی مراکز استعمال کریں"),
        body: L(
          "BE&OE blacklists trade-test centres from time to time — check its blacklist before paying one. A soft-skills certificate (OEC's soft-skills programme) and a medical report from approved centres are among the registration documents.",
          "بی ای او ای وقتاً فوقتاً ٹریڈ ٹیسٹ مراکز کو بلیک لسٹ کرتا ہے — ادائیگی سے پہلے اس کی فہرست دیکھیں۔ سافٹ اسکلز سرٹیفکیٹ (او ای سی کا سافٹ اسکلز پروگرام) اور منظور شدہ مراکز کی میڈیکل رپورٹ رجسٹریشن کی دستاویزات میں شامل ہیں۔",
        ),
        resourceIds: ["beoe-blacklist", "oec-softskills"],
      },
      {
        title: L("Register for emigrant protection before you travel", "سفر سے پہلے تارکِ وطن کے تحفظ کی رجسٹریشن کروائیں"),
        body: L(
          "Register with a Protector of Emigrants — online through e-Protector, or at a Protector's office. BE&OE lists the documents: passport, CNIC, visa, the contract, a State Life insurance certificate, receipts for the registration fee, welfare fund and emigration promotion fee, plus a medical report and police verification for certain countries. After a briefing, the Protector's stamp or sticker goes on your passport.",
          "پروٹیکٹر آف ایمیگرینٹس کے پاس رجسٹر کریں — آن لائن ای پروٹیکٹر کے ذریعے، یا پروٹیکٹر کے دفتر میں۔ بی ای او ای کی فہرست: پاسپورٹ، شناختی کارڈ، ویزا، معاہدہ، اسٹیٹ لائف انشورنس سرٹیفکیٹ، رجسٹریشن فیس، ویلفیئر فنڈ اور ایمیگریشن پروموشن فیس کی رسیدیں، اور بعض ممالک کے لیے میڈیکل رپورٹ اور پولیس تصدیق۔ بریفنگ کے بعد پروٹیکٹر کی مہر یا اسٹکر آپ کے پاسپورٹ پر لگتا ہے۔",
        ),
        resourceIds: ["beoe-eprotector", "beoe-pe-offices"],
      },
      {
        title: L("Know where to complain and whom to call", "جانیں کہ شکایت کہاں کرنی ہے اور کسے بلانا ہے"),
        body: L(
          "BE&OE takes complaints against promoters; a Community Welfare Attaché in the destination country can help workers abroad; FIA handles fraud and human trafficking, and its cybercrime centre takes online fraud complaints.",
          "بی ای او ای پروموٹرز کے خلاف شکایات لیتا ہے؛ منزل کے ملک میں کمیونٹی ویلفیئر اتاشی بیرون ملک کارکنوں کی مدد کر سکتا ہے؛ ایف آئی اے فراڈ اور انسانی اسمگلنگ دیکھتا ہے، اور اس کا سائبر کرائم سینٹر آن لائن فراڈ کی شکایات لیتا ہے۔",
        ),
        resourceIds: ["beoe-complaints", "fia", "nr3c"],
      },
    ],
    checklist: [
      L("Valid passport and CNIC", "درست پاسپورٹ اور شناختی کارڈ"),
      L("Visa — verified on the destination's official portal where one exists", "ویزا — جہاں موجود ہو منزل کے سرکاری پورٹل پر تصدیق شدہ"),
      L("Written contract / Foreign Service Agreement", "تحریری معاہدہ / فارن سروس ایگریمنٹ"),
      L("Permission number, if you go through an OEP", "او ای پی کے ذریعے جائیں تو پرمٹ نمبر"),
      L("Receipts for every fee, the welfare fund and insurance", "ہر فیس، ویلفیئر فنڈ اور انشورنس کی رسیدیں"),
      L("Medical report from an approved centre, and police verification if required", "منظور شدہ مرکز کی میڈیکل رپورٹ، اور ضرورت ہو تو پولیس تصدیق"),
      L("Soft-skills certificate", "سافٹ اسکلز سرٹیفکیٹ"),
      L("Copies left at home and a scan in your own email", "نقول گھر پر اور ایک اسکین اپنی ای میل میں"),
    ],
    pitfalls: [
      L("‘Visa for sale’ offers on WhatsApp or Facebook.", "واٹس ایپ یا فیس بک پر ‘ویزا برائے فروخت’ کی پیشکشیں۔"),
      L("An agent with no licence number, or one that belongs to someone else.", "ایسا ایجنٹ جس کا لائسنس نمبر نہ ہو یا کسی اور کا نمبر استعمال کرے۔"),
      L("Paying cash with no receipt.", "رسید کے بغیر نقد ادائیگی۔"),
      L("Travelling on a visit visa to ‘convert it to a job visa’ later.", "وزٹ ویزے پر جانا کہ بعد میں ‘ورک ویزے میں بدل لیں گے’۔"),
      L("Skipping emigrant registration because someone said it is not needed.", "کسی کے کہنے پر کہ ضرورت نہیں، تارکِ وطن رجسٹریشن چھوڑ دینا۔"),
      L("Promised salaries that are not written in any contract.", "ایسی تنخواہوں کے وعدے جو کسی معاہدے میں لکھے نہ ہوں۔"),
    ],
    resourceIds: ["beoe", "beoe-oep-list", "beoe-complaints", "beoe-blacklist", "beoe-eprotector", "beoe-guidelines", "beoe-fees", "beoe-pe-offices", "oec", "oec-eps", "fia", "nr3c", "beoe-foreign-jobs", "oec-softskills"],
    related: ["spot-fake-offers", "documents-attestation"],
    opportunityQuery: { kinds: ["notice"] },
    tools: ["abroad", "scam"],
    keywords: ["overseas employment", "work abroad", "visa", "oep", "beoe", "oec", "protector", "emigrant", "eprotector", "saudi", "dubai", "uae", "qatar", "kuwait", "gulf", "eps korea", "agent", "bahar naukri", "visa agent", "بیرون ملک ملازمت", "ویزا", "ایجنٹ", "پروٹیکٹر", "بی ای او ای", "او ای سی"],
    reviewed: REVIEWED,
    sources: ["https://beoe.gov.pk/how-to-get-emigrants-protection", "https://beoe.gov.pk/general-guidlines-for-emigrants"],
  },

  // ─── Spot fake offers ──────────────────────────────────────────────────────
  {
    id: "spot-fake-offers",
    category: "safety",
    emoji: "🛡️",
    title: L("Spot a fake job, visa or scholarship offer", "جعلی نوکری، ویزا یا اسکالرشپ کی پیشکش کیسے پہچانیں"),
    summary: L("The red flags, how to verify an offer with the real organisation, and exactly what to do if you have already paid.", "خطرے کی نشانیاں، اصل ادارے سے پیشکش کی تصدیق کا طریقہ، اور اگر پیسے دے چکے ہوں تو بالکل کیا کرنا ہے۔"),
    audience: L("Anyone who received an offer by message, call, email or social media.", "کوئی بھی جسے پیغام، کال، ای میل یا سوشل میڈیا پر پیشکش ملی ہو۔"),
    steps: [
      {
        title: L("Pause — pressure is the tactic", "رکیں — دباؤ ہی ان کا طریقہ ہے"),
        body: L(
          "‘Only today’, ‘seats are finishing’, ‘do not tell anyone’ are designed to stop you from checking. A real organisation can wait while you verify.",
          "‘صرف آج’، ‘نشستیں ختم ہو رہی ہیں’، ‘کسی کو نہ بتائیں’ آپ کو تصدیق سے روکنے کے لیے ہوتے ہیں۔ اصل ادارہ آپ کی تصدیق تک انتظار کر سکتا ہے۔",
        ),
      },
      {
        title: L("Look at how they reached you and what they ask for", "دیکھیں کہ انہوں نے کیسے رابطہ کیا اور کیا مانگ رہے ہیں"),
        body: L(
          "Genuine employers, universities and scholarship bodies do not ask you to pay to release an award, ‘confirm’ a seat or ‘unlock’ a job. Official government fees (for example in a commission advertisement) go through the bank challan or portal named there — never to a person's account or wallet.",
          "اصل آجر، جامعات اور وظیفہ دینے والے ادارے وظیفہ جاری کرنے، نشست ‘کنفرم’ کرنے یا نوکری ‘اَن لاک’ کرنے کے لیے رقم نہیں مانگتے۔ سرکاری فیس (مثلاً کمیشن کے اشتہار میں) وہیں بتائے گئے بینک چالان یا پورٹل سے جاتی ہے — کسی فرد کے اکاؤنٹ یا والٹ میں کبھی نہیں۔",
        ),
      },
      {
        title: L("Verify the organisation on its own website", "ادارے کی اپنی ویب سائٹ پر تصدیق کریں"),
        body: L(
          "Type the organisation's address yourself or take it from RAAHI's directory — do not click the link in the message. Compare spelling carefully; fake sites copy logos and layouts. Call the number on the official site, not the one in the message.",
          "ادارے کا پتہ خود ٹائپ کریں یا راہی کی ڈائریکٹری سے لیں — پیغام میں دیے لنک پر کلک نہ کریں۔ ہجے غور سے ملائیں؛ جعلی سائٹس لوگو اور ڈیزائن نقل کرتی ہیں۔ سرکاری سائٹ پر دیا نمبر ملائیں، پیغام والا نہیں۔",
        ),
        resourceIds: ["njp", "hec", "beoe"],
      },
      {
        title: L("Verify the licence or the award at the official body", "لائسنس یا وظیفے کی تصدیق متعلقہ سرکاری ادارے سے کریں"),
        body: L(
          "Overseas jobs: check the agency's licence number and permission on BE&OE. Scholarships: confirm on the awarding body's own site. Government jobs: find the advertisement on the commission's portal. If you cannot find it, treat the offer as unverified.",
          "بیرون ملک نوکری: ایجنسی کا لائسنس نمبر اور پرمٹ بی ای او ای پر دیکھیں۔ اسکالرشپ: وظیفہ دینے والے ادارے کی اپنی سائٹ پر تصدیق کریں۔ سرکاری نوکری: کمیشن کے پورٹل پر اشتہار تلاش کریں۔ نہ ملے تو پیشکش کو غیر تصدیق شدہ سمجھیں۔",
        ),
        resourceIds: ["beoe-oep-list", "beoe-complaints", "beoe-blacklist"],
      },
      {
        title: L("Never share OTPs, card details, passwords or ID selfies", "او ٹی پی، کارڈ کی تفصیل، پاس ورڈ یا شناختی سیلفی کبھی شیئر نہ کریں"),
        body: L(
          "These let someone take over your accounts or open ones in your name. No genuine recruiter needs them to ‘process’ an application.",
          "ان سے کوئی آپ کے اکاؤنٹ پر قبضہ کر سکتا ہے یا آپ کے نام سے اکاؤنٹ کھول سکتا ہے۔ کسی اصل بھرتی کنندہ کو درخواست ‘پراسیس’ کرنے کے لیے ان کی ضرورت نہیں ہوتی۔",
        ),
      },
      {
        title: L("Run the text through RAAHI's offer checker", "پیغام راہی کے آفر چیکر میں ڈالیں"),
        body: L(
          "Paste the message into the checker. It lists warning signs and how to verify officially. It never says an offer is ‘safe’ — only you, by verifying with the real organisation, can do that — and it stores nothing.",
          "پیغام چیکر میں پیسٹ کریں۔ وہ خطرے کی نشانیاں اور سرکاری تصدیق کا طریقہ بتاتا ہے۔ وہ کبھی نہیں کہتا کہ پیشکش ‘محفوظ’ ہے — یہ صرف آپ اصل ادارے سے تصدیق کر کے کہہ سکتے ہیں — اور کچھ محفوظ نہیں کرتا۔",
        ),
      },
      {
        title: L("If you have already paid or shared data — act fast", "اگر پیسے دے چکے یا ڈیٹا شیئر کر چکے ہوں — فوراً کارروائی کریں"),
        body: L(
          "Stop all contact, keep every screenshot, number and receipt, tell your bank or wallet provider at once, and report: FIA's cybercrime centre (NR3C) for online fraud, BE&OE for overseas-job agents. Do not pay a ‘recovery agent’ — they are often the same people.",
          "ہر رابطہ بند کریں، تمام اسکرین شاٹ، نمبر اور رسیدیں محفوظ رکھیں، فوراً اپنے بینک یا والٹ فراہم کنندہ کو بتائیں، اور رپورٹ کریں: آن لائن فراڈ کے لیے ایف آئی اے کا سائبر کرائم سینٹر (این آر تھری سی)، بیرون ملک نوکری کے ایجنٹوں کے لیے بی ای او ای۔ کسی ‘ریکوری ایجنٹ’ کو پیسے نہ دیں — اکثر وہ وہی لوگ ہوتے ہیں۔",
        ),
        resourceIds: ["nr3c", "fia", "beoe-complaints"],
      },
    ],
    checklist: [
      L("Screenshots of the whole conversation, with phone numbers and dates", "پوری گفتگو کے اسکرین شاٹ، فون نمبروں اور تاریخوں کے ساتھ"),
      L("Payment receipts and transaction IDs", "ادائیگی کی رسیدیں اور ٹرانزیکشن آئی ڈی"),
      L("The web addresses they sent", "جو ویب ایڈریس انہوں نے بھیجے"),
      L("The official website and phone number of the real organisation, from its own site", "اصل ادارے کی سرکاری ویب سائٹ اور فون نمبر، اس کی اپنی سائٹ سے"),
    ],
    pitfalls: [
      L("Trusting logos, stamps and official-looking PDFs.", "لوگو، مہروں اور سرکاری نظر آنے والی پی ڈی ایف پر بھروسا۔"),
      L("Paying a ‘small’ fee that keeps growing — each payment makes the next one easier to ask for.", "‘چھوٹی’ فیس دینا جو بڑھتی جاتی ہے — ہر ادائیگی اگلی مانگنا آسان بنا دیتی ہے۔"),
      L("Staying silent out of embarrassment — reports help stop the fraud.", "شرمندگی سے خاموش رہنا — رپورٹ فراڈ روکنے میں مدد دیتی ہے۔"),
      L("Believing someone who promises to ‘recover’ your money for a fee.", "اس شخص کی بات ماننا جو فیس لے کر آپ کی رقم ‘واپس دلوانے’ کا وعدہ کرے۔"),
    ],
    resourceIds: ["beoe-oep-list", "beoe-complaints", "beoe-blacklist", "nr3c", "fia", "njp", "hec", "beoe"],
    related: ["work-abroad-safely", "apply-government-job"],
    tools: ["scam"],
    keywords: ["fake job", "scam", "fraud", "fake offer", "whatsapp job", "advance fee", "fake visa", "fake scholarship", "cheating", "dhoka", "jaali", "fraud report", "جعلی نوکری", "فراڈ", "دھوکہ", "جعلی ویزا", "جعلی اسکالرشپ"],
    reviewed: REVIEWED,
    sources: ["https://beoe.gov.pk/complaints"],
  },

  // ─── Documents ─────────────────────────────────────────────────────────────
  {
    id: "documents-attestation",
    category: "documents",
    emoji: "📄",
    title: L("Documents for study or work abroad: HEC, IBCC and MOFA apostille", "بیرون ملک تعلیم یا کام کے لیے دستاویزات: ایچ ای سی، آئی بی سی سی اور وزارت خارجہ اپوسٹل"),
    summary: L("The correct order for attesting certificates and degrees, and the online registration MOFA now requires.", "سرٹیفکیٹ اور ڈگریوں کی تصدیق کی درست ترتیب، اور وزارت خارجہ کی اب لازمی آن لائن رجسٹریشن۔"),
    audience: L("Students and workers who must submit Pakistani documents to a foreign university, employer or embassy.", "طلبہ اور کارکن جنہیں پاکستانی دستاویزات کسی غیر ملکی جامعہ، آجر یا سفارت خانے میں دینی ہیں۔"),
    duration: L("Allow several weeks", "کئی ہفتے رکھیں"),
    steps: [
      {
        title: L("Gather your originals and basic identity documents", "اصل دستاویزات اور بنیادی شناختی کاغذات جمع کریں"),
        body: L(
          "Degrees, transcripts, school certificates, CNIC (both sides scanned) and passport. If your CNIC, B-Form or passport needs renewal, start that first.",
          "ڈگریاں، ٹرانسکرپٹس، اسکول سرٹیفکیٹ، شناختی کارڈ (دونوں طرف کا اسکین) اور پاسپورٹ۔ اگر شناختی کارڈ، ب فارم یا پاسپورٹ تجدید طلب ہو تو پہلے وہ کریں۔",
        ),
        resourceIds: ["nadra-docs", "dgip"],
      },
      {
        title: L("School-board certificates go to IBCC", "اسکول بورڈ کے سرٹیفکیٹ آئی بی سی سی کے پاس جاتے ہیں"),
        body: L(
          "Certificates issued by a Board of Intermediate & Secondary Education (Matric, Intermediate) are countersigned by IBCC; MOFA's published procedure asks for this before its own attestation. Madrasa certificates must be attested by IBCC or HEC first, and Hifz certificates by IBCC.",
          "بورڈ آف انٹرمیڈیٹ اینڈ سیکنڈری ایجوکیشن کے جاری کردہ سرٹیفکیٹ (میٹرک، انٹرمیڈیٹ) آئی بی سی سی سے تصدیق ہوتے ہیں؛ وزارت خارجہ کا شائع شدہ طریقہ کار اپنی تصدیق سے پہلے یہ مانگتا ہے۔ مدارس کے سرٹیفکیٹ پہلے آئی بی سی سی یا ایچ ای سی، اور حفظ کے سرٹیفکیٹ آئی بی سی سی سے تصدیق ہونے چاہئیں۔",
        ),
        resourceIds: ["ibcc"],
      },
      {
        title: L("University degrees go to HEC; technical certificates to the technical board and NAVTTC", "جامعہ کی ڈگریاں ایچ ای سی؛ تکنیکی سرٹیفکیٹ تکنیکی بورڈ اور نیوٹیک کے پاس"),
        body: L(
          "Degrees issued by universities are attested by the Higher Education Commission. Certificates of technical skills are attested by the local technical board and NAVTTC, according to MOFA's procedure.",
          "جامعات کی ڈگریاں ہائر ایجوکیشن کمیشن سے تصدیق ہوتی ہیں۔ وزارت خارجہ کے طریقہ کار کے مطابق تکنیکی مہارت کے سرٹیفکیٹ مقامی تکنیکی بورڈ اور نیوٹیک سے تصدیق ہوتے ہیں۔",
        ),
        resourceIds: ["hec-attestation", "navttc"],
      },
      {
        title: L("Register online with MOFA for the apostille", "اپوسٹل کے لیے وزارت خارجہ میں آن لائن رجسٹر کریں"),
        body: L(
          "MOFA's published procedure says that from 27 July 2026 apostille attestation is not entertained without prior online registration. Create an account at apostille.mofa.gov.pk, attach both sides of your CNIC, create the application, upload the documents, review and submit; you are notified by email, receive a challan, and pay it online, through Easypaisa or at a bank. Then visit the Ministry or a liaison office (Lahore, Karachi, Quetta, Peshawar, Gujrat).",
          "وزارت خارجہ کے شائع شدہ طریقہ کار کے مطابق 27 جولائی 2026 سے آن لائن رجسٹریشن کے بغیر اپوسٹل تصدیق قبول نہیں۔ apostille.mofa.gov.pk پر اکاؤنٹ بنائیں، شناختی کارڈ کے دونوں رخ منسلک کریں، درخواست بنائیں، دستاویزات اپ لوڈ کریں، جائزہ لے کر جمع کریں؛ ای میل سے اطلاع ملے گی، چالان آئے گا جو آن لائن، ایزی پیسہ یا بینک میں ادا ہوتا ہے۔ پھر وزارت یا رابطہ دفتر (لاہور، کراچی، کوئٹہ، پشاور، گجرات) جائیں۔",
        ),
        resourceIds: ["apostille-mofa", "mofa-attestation"],
      },
      {
        title: L("Check what the destination actually requires", "پوچھیں کہ منزل کو اصل میں کیا درکار ہے"),
        body: L(
          "Some countries accept an apostille; others still need legalisation by their embassy. Ask the university, employer or embassy which they require before you pay for the wrong one.",
          "کچھ ممالک اپوسٹل قبول کرتے ہیں؛ دیگر کو اب بھی اپنے سفارت خانے کی لیگلائزیشن چاہیے۔ غلط کی فیس دینے سے پہلے جامعہ، آجر یا سفارت خانے سے پوچھیں کہ انہیں کون سی درکار ہے۔",
        ),
      },
      {
        title: L("Scan, label and keep spare copies", "اسکین کریں، نام لکھیں اور اضافی نقول رکھیں"),
        body: L(
          "Keep certified photocopies and one labelled scan folder. Do not hand original degrees to an agent unless you have no alternative, and keep every receipt and application number.",
          "تصدیق شدہ فوٹو کاپیاں اور ایک نام زد اسکین فولڈر رکھیں۔ جب تک مجبوری نہ ہو اصل ڈگریاں کسی ایجنٹ کو نہ دیں، اور ہر رسید اور درخواست نمبر محفوظ رکھیں۔",
        ),
      },
      {
        title: L("Documents issued abroad, for use in Pakistan", "بیرون ملک جاری دستاویزات، پاکستان میں استعمال کے لیے"),
        body: L(
          "According to MOFA's procedure, educational, experience, birth, marriage and similar documents issued abroad are attested by the Pakistani embassy or consulate there; for educational documents the equivalence issued by IBCC or HEC is also attested.",
          "وزارت خارجہ کے طریقہ کار کے مطابق بیرون ملک جاری تعلیمی، تجربے، پیدائش، نکاح اور ایسی دستاویزات وہاں کے پاکستانی سفارت خانے یا قونصلیٹ سے تصدیق ہوتی ہیں؛ تعلیمی دستاویزات کی صورت میں آئی بی سی سی یا ایچ ای سی کی معادلت بھی تصدیق کی جاتی ہے۔",
        ),
      },
    ],
    checklist: [
      L("Original certificates, degrees and transcripts", "اصل سرٹیفکیٹ، ڈگریاں اور ٹرانسکرپٹس"),
      L("CNIC (both sides scanned) and passport", "شناختی کارڈ (دونوں رخ کا اسکین) اور پاسپورٹ"),
      L("HEC or IBCC attestation receipts and application numbers", "ایچ ای سی یا آئی بی سی سی تصدیق کی رسیدیں اور درخواست نمبر"),
      L("MOFA online account and the emailed challan", "وزارت خارجہ کا آن لائن اکاؤنٹ اور ای میل پر آیا چالان"),
      L("Several certified copies and a labelled scan folder", "کئی تصدیق شدہ نقول اور نام زد اسکین فولڈر"),
    ],
    pitfalls: [
      L("Going to MOFA without the HEC or IBCC step — verification comes first.", "ایچ ای سی یا آئی بی سی سی کا مرحلہ چھوڑ کر وزارت خارجہ جانا — پہلے تصدیق ہوتی ہے۔"),
      L("Following old advice that walk-ins are fine for apostille: online registration is required since 27 July 2026.", "پرانے مشورے پر چلنا کہ اپوسٹل کے لیے براہ راست جانا ٹھیک ہے: 27 جولائی 2026 سے آن لائن رجسٹریشن لازمی ہے۔"),
      L("Paying ‘fixers’ extra for a process that has official fees and a public procedure.", "‘فکسرز’ کو اضافی ادائیگی ایسے عمل کے لیے جس کی سرکاری فیس اور عوامی طریقہ کار موجود ہے۔"),
      L("Accepting stamps you cannot verify.", "ایسی مہریں قبول کرنا جن کی تصدیق نہ ہو سکے۔"),
    ],
    resourceIds: ["hec-attestation", "ibcc", "apostille-mofa", "mofa-attestation", "nadra-docs", "dgip", "navttc", "wes"],
    related: ["study-abroad-roadmap", "work-abroad-safely"],
    tools: ["plan"],
    keywords: ["attestation", "apostille", "hec attestation", "ibcc", "mofa", "degree verification", "equivalence", "legalisation", "documents abroad", "degree attest", "tasdeeq", "تصدیق", "اپوسٹل", "ڈگری کی تصدیق", "وزارت خارجہ", "آئی بی سی سی"],
    reviewed: REVIEWED,
    sources: ["https://www.mofa.gov.pk/tabs/consular-service-attestation-of-documents"],
  },
];
