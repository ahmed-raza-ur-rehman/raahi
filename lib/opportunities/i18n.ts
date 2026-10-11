import type { Language } from "@/lib/types";
import type { Funding, Level, OpportunityKind, ResourceCategory, OpportunityStatus } from "./types";

/**
 * UI strings for the Opportunities hub. English and Urdu are complete; Pashto covers the main interface and
 * falls back to Urdu (widely read by Pashto speakers) and then English for the long tail.
 */

type Entry = { en: string; ur: string; ps?: string };

const S = {
  brandSub: { en: "Opportunities, learning & guidance", ur: "مواقع، تعلیم اور رہنمائی", ps: "فرصتونه، زده کړه او لارښوونه" },
  navHome: { en: "Home", ur: "ہوم", ps: "کور" },
  navOpportunities: { en: "Opportunities", ur: "مواقع", ps: "فرصتونه" },
  navResources: { en: "Resources", ur: "وسائل", ps: "سرچینې" },
  navTools: { en: "Tools", ur: "ٹولز", ps: "وسیلې" },
  navStatus: { en: "Data status", ur: "ڈیٹا کی حالت", ps: "د ډیټا حالت" },
  navChat: { en: "Ask RAAHI", ur: "راہی سے پوچھیں", ps: "له راهي وپوښتئ" },

  heroTitle: { en: "Scholarships, jobs, courses & more", ur: "وظائف، نوکریاں، کورسز اور بہت کچھ", ps: "سکالرشپونه، دندې، کورسونه او نور" },
  heroSub: { en: "Fresh listings from official portals and trusted sites, with deadlines — for Pakistan and abroad.", ur: "سرکاری پورٹلز اور معتبر سائٹس سے تازہ فہرست، آخری تاریخوں کے ساتھ — پاکستان اور بیرون ملک کے لیے۔", ps: "له رسمي پورتالونو او باوري سایټونو څخه تازه لیست، د وروستۍ نیټې سره — د پاکستان او بهر لپاره." },
  searchPlaceholder: { en: "Try: fully funded masters in Germany · سرکاری نوکری · free python course", ur: "مثلاً: جرمنی میں ماسٹرز اسکالرشپ · سرکاری نوکری · مفت پائتھن کورس", ps: "بیلګه: په جرمني کې ماسټرز سکالرشپ · دولتي دنده · وړیا کورس" },
  search: { en: "Search", ur: "تلاش کریں", ps: "لټون" },
  chipScholarships: { en: "Scholarships", ur: "اسکالرشپس", ps: "سکالرشپونه" },
  chipGovtJobs: { en: "Government jobs", ur: "سرکاری نوکریاں", ps: "دولتي دندې" },
  chipOverseas: { en: "Jobs abroad", ur: "بیرون ملک نوکریاں", ps: "بهر دندې" },
  chipInternships: { en: "Internships", ur: "انٹرن شپس", ps: "انټرنشپونه" },
  chipFree: { en: "Free courses", ur: "مفت کورسز", ps: "وړیا کورسونه" },
  chipCompetitions: { en: "Competitions", ur: "مقابلے", ps: "سیالۍ" },
  chipSoon: { en: "Closing soon", ur: "جلد بند ہونے والے", ps: "ژر تړل کیدونکي" },
  chipNew: { en: "New this week", ur: "اس ہفتے نئے", ps: "دا اونۍ نوي" },

  scopeAll: { en: "Everywhere", ur: "ہر جگہ", ps: "هرچیرې" },
  scopePakistan: { en: "In Pakistan", ur: "پاکستان میں", ps: "په پاکستان کې" },
  scopeAbroad: { en: "Abroad & remote", ur: "بیرون ملک اور ریموٹ", ps: "بهر او ریموټ" },
  filterKind: { en: "Type", ur: "قسم", ps: "ډول" },
  filterCountry: { en: "Country", ur: "ملک", ps: "هیواد" },
  filterLevel: { en: "Level", ur: "سطح", ps: "کچه" },
  filterFunding: { en: "Funding", ur: "فنڈنگ", ps: "مالي ملاتړ" },
  filterAny: { en: "Any", ur: "کوئی بھی", ps: "هر یو" },
  filterPk: { en: "Open to applicants from Pakistan", ur: "پاکستان کے امیدواروں کے لیے کھلا", ps: "د پاکستان لپاره پرانیستل" },
  filterRemote: { en: "Remote / online only", ur: "صرف ریموٹ / آن لائن", ps: "یوازې ریموټ / آنلاین" },
  filterWithin: { en: "Deadline within", ur: "آخری تاریخ اندر", ps: "وروستۍ نیټه په" },
  days: { en: "days", ur: "دن", ps: "ورځو" },
  sortBy: { en: "Sort", ur: "ترتیب", ps: "ترتیب" },
  sortRelevance: { en: "Best match", ur: "بہترین مطابقت", ps: "غوره سمون" },
  sortNewest: { en: "Newest", ur: "تازہ ترین", ps: "تر ټولو نوي" },
  sortDeadline: { en: "Deadline soonest", ur: "قریب ترین آخری تاریخ", ps: "نږدې نیټه" },
  reset: { en: "Reset", ur: "ری سیٹ", ps: "بیا تنظیم" },
  moreFilters: { en: "More filters", ur: "مزید فلٹرز", ps: "نور فلټرونه" },
  results: { en: "results", ur: "نتائج", ps: "پایلې" },
  noResults: { en: "Nothing matches yet. Try fewer words, another language, or remove a filter.", ur: "ابھی کچھ نہیں ملا۔ کم الفاظ آزمائیں، دوسری زبان میں لکھیں یا کوئی فلٹر ہٹائیں۔", ps: "تر اوسه څه ونه موندل شول. لږ کلمې وکاروئ یا فلټر لرې کړئ." },
  loadMore: { en: "Show more", ur: "مزید دکھائیں", ps: "نور وښایاست" },
  loading: { en: "Loading…", ur: "لوڈ ہو رہا ہے…", ps: "بارېږي…" },
  loadError: { en: "Could not load listings. Check your connection and try again.", ur: "فہرست لوڈ نہیں ہو سکی۔ انٹرنیٹ چیک کر کے دوبارہ کوشش کریں۔", ps: "لیست ونه بارېده. انټرنیټ وګورئ او بیا هڅه وکړئ." },
  retry: { en: "Try again", ur: "دوبارہ کوشش کریں", ps: "بیا هڅه" },
  understood: { en: "We understood", ur: "ہم نے سمجھا", ps: "موږ پوه شو" },
  closingSoonTitle: { en: "Closing soon", ur: "جلد بند ہونے والے", ps: "ژر تړل کیدونکي" },
  newestTitle: { en: "Newest listings", ur: "تازہ ترین فہرست", ps: "تازه لیست" },
  allListings: { en: "All listings", ur: "تمام فہرست", ps: "ټولې لیستونه" },
  savedTitle: { en: "Saved", ur: "محفوظ کردہ", ps: "خوندي شوي" },
  savedEmpty: { en: "Nothing saved yet. Tap ☆ on a listing to keep it here.", ur: "ابھی کچھ محفوظ نہیں۔ کسی فہرست پر ☆ دبائیں۔", ps: "تر اوسه څه نه دي خوندي. په ☆ کېکاږئ." },
  updated: { en: "Updated", ur: "تازہ کاری", ps: "تازه شوی" },
  sources: { en: "sources", ur: "ذرائع", ps: "سرچینې" },

  viaSource: { en: "via", ur: "بذریعہ", ps: "له لارې" },
  applyAtSource: { en: "Apply on official page", ur: "سرکاری صفحے پر درخواست دیں", ps: "په رسمي پاڼه غوښتنه وکړئ" },
  openSource: { en: "Open listing", ur: "فہرست کھولیں", ps: "لیست پرانیزئ" },
  details: { en: "Details", ur: "تفصیل", ps: "تفصیل" },
  save: { en: "Save", ur: "محفوظ کریں", ps: "خوندي کړئ" },
  saved: { en: "Saved", ur: "محفوظ", ps: "خوندي" },
  addToCalendar: { en: "Add deadline to calendar", ur: "آخری تاریخ کیلنڈر میں شامل کریں", ps: "نیټه کیلنډر ته زیاته کړئ" },
  addPlanToCalendar: { en: "Add deadline + plan to calendar", ur: "آخری تاریخ اور منصوبہ کیلنڈر میں شامل کریں", ps: "نیټه او پلان کیلنډر ته زیات کړئ" },
  badgeNew: { en: "New", ur: "نیا", ps: "نوی" },
  closesIn: { en: "Closes in", ur: "بند ہونے میں", ps: "تړل کیږي په" },
  closesToday: { en: "Closes today", ur: "آج بند ہو رہا ہے", ps: "نن تړل کیږي" },
  closedAgo: { en: "Closed", ur: "بند ہو چکا", ps: "تړل شوی" },
  daysAgo: { en: "days ago", ur: "دن پہلے", ps: "ورځې مخکې" },
  rolling: { en: "Rolling / open", ur: "مسلسل / کھلا", ps: "دوامدار / پرانیستی" },
  noDeadline: { en: "No deadline listed", ur: "آخری تاریخ درج نہیں", ps: "وروستۍ نیټه نشته" },
  openToPk: { en: "Open to Pakistan", ur: "پاکستان کے لیے کھلا", ps: "د پاکستان لپاره پرانیستل" },
  notOpenToPk: { en: "Probably not open to Pakistan", ur: "غالباً پاکستان کے لیے نہیں", ps: "شاید د پاکستان لپاره نه" },
  checkEligibility: { en: "Check eligibility on the official page", ur: "اہلیت سرکاری صفحے پر دیکھیں", ps: "وړتیا په رسمي پاڼه وګورئ" },
  alsoListedOn: { en: "Also listed on", ur: "یہاں بھی درج ہے", ps: "دلته هم لیست شوی" },
  remote: { en: "Remote", ur: "ریموٹ", ps: "ریموټ" },
  couponWarn: { en: "Free coupons are limited and can stop working any minute.", ur: "مفت کوپن محدود ہوتے ہیں اور کسی بھی لمحے ختم ہو سکتے ہیں۔", ps: "وړیا کوپنونه محدود دي او هر وخت ختم کیدی شي." },
  listPrice: { en: "Normally", ur: "عام قیمت", ps: "عادي بیه" },
  vacancies: { en: "Vacancies", ur: "آسامیاں", ps: "خالي ځایونه" },
  grade: { en: "Grade", ur: "گریڈ", ps: "ګریډ" },
  salary: { en: "Salary", ur: "تنخواہ", ps: "معاش" },
  prize: { en: "Prize pool", ur: "انعامی رقم", ps: "جایزه" },

  detailBack: { en: "← All opportunities", ur: "← تمام مواقع", ps: "← ټولې فرصتونه" },
  posted: { en: "Posted", ur: "شائع", ps: "خپور شوی" },
  deadline: { en: "Deadline", ur: "آخری تاریخ", ps: "وروستۍ نیټه" },
  firstSeen: { en: "First seen by RAAHI", ur: "راہی نے پہلی بار دیکھا", ps: "راهي لومړی ځل ولیدل" },
  yourPlan: { en: "Your plan", ur: "آپ کا منصوبہ", ps: "ستاسو پلان" },
  planNote: { en: "Steps are counted back from the deadline. Always follow the official call if it differs.", ur: "اقدامات آخری تاریخ سے پیچھے گنے گئے ہیں۔ سرکاری اعلان مختلف ہو تو اسی پر عمل کریں۔", ps: "ګامونه د وروستۍ نیټې څخه شمېرل شوي. رسمي اعلان تر مخه ګټه واخلئ." },
  doNow: { en: "Do now", ur: "ابھی کریں", ps: "همدا اوس" },
  checklist: { en: "Documents checklist", ur: "دستاویزات کی فہرست", ps: "د اسنادو لیست" },
  prepWith: { en: "Prepare with the RAAHI family", ur: "راہی خاندان کے ساتھ تیاری کریں", ps: "د راهي کورنۍ سره چمتووالی" },
  similar: { en: "Similar listings", ur: "ملتی جلتی فہرست", ps: "ورته لیستونه" },
  askRaahi: { en: "Ask RAAHI about this", ur: "راہی سے اس بارے میں پوچھیں", ps: "له راهي دا وپوښتئ" },
  safetyTitle: { en: "Before you apply", ur: "درخواست سے پہلے", ps: "مخکې له غوښتنې" },
  safetyGeneric: { en: "Apply only on the official page above. Real employers and scholarships never ask you to pay to be selected.", ur: "صرف اوپر دیے گئے سرکاری صفحے پر درخواست دیں۔ اصل آجر اور وظائف منتخب کرنے کے لیے رقم نہیں مانگتے۔", ps: "یوازې پورته رسمي پاڼه کې غوښتنه وکړئ. اصلي کارګمارونکي او سکالرشپونه د ټاکلو لپاره پیسې نه غواړي." },
  safetyOverseas: { en: "Working abroad? Verify the recruiter's licence on the BE&OE list, read the contract, and never travel on a visit visa for work.", ur: "بیرون ملک کام؟ بھرتی کرنے والے کا لائسنس بی ای او ای کی فہرست میں دیکھیں، معاہدہ پڑھیں، اور کام کے لیے وزٹ ویزے پر کبھی نہ جائیں۔", ps: "بهر کار؟ د استخدام کوونکي جواز د BE&OE په لیست کې وګورئ، تړون ولولئ او د کار لپاره د لیدنې ویزې سره مه ځئ." },
  checkOffer: { en: "Check an offer for red flags", ur: "پیشکش میں خطرے کی علامات جانچیں", ps: "د خطر نښې وڅېړئ" },
  notFoundTitle: { en: "This listing has expired or does not exist", ur: "یہ فہرست ختم ہو چکی ہے یا موجود نہیں", ps: "دا لیست پای ته رسېدلی یا نشته" },

  dirTitle: { en: "Resource directory", ur: "وسائل کی ڈائریکٹری", ps: "د سرچینو لارښود" },
  dirSub: { en: "Official portals and trusted sites for scholarships, jobs, courses and safe routes abroad — each with a note on how much to trust it.", ur: "وظائف، نوکریوں، کورسز اور محفوظ بیرون ملک راستوں کے لیے سرکاری پورٹلز اور معتبر سائٹس — ہر ایک کے ساتھ اعتماد کی وضاحت۔", ps: "د سکالرشپونو، دندو، کورسونو او خوندي بهرنیو لارو لپاره رسمي پورتالونه او باوري سایټونه." },
  dirSearch: { en: "Search resources (e.g. DigiSkills, BEOE, Chevening)", ur: "وسائل تلاش کریں (مثلاً ڈیجی اسکلز، بی ای او ای)", ps: "سرچینې ولټوئ" },
  onlyFree: { en: "Free", ur: "مفت", ps: "وړیا" },
  onlyOfficial: { en: "Official / institutional", ur: "سرکاری / ادارہ جاتی", ps: "رسمي / ادارې" },
  onlyVerified: { en: "Link checked", ur: "لنک جانچا گیا", ps: "لینک وڅېړل شو" },
  goToSite: { en: "Go to site", ur: "سائٹ پر جائیں", ps: "سایټ ته ورشئ" },
  relatedServices: { en: "Related RAAHI services", ur: "متعلقہ راہی خدمات", ps: "اړوند راهي خدمتونه" },
  linkChecked: { en: "Link confirmed", ur: "لنک کی تصدیق", ps: "لینک تایید شو" },
  linkUnchecked: { en: "Not yet confirmed", ur: "ابھی تصدیق نہیں", ps: "تر اوسه نه دی تایید" },
  linkBlocked: { en: "Site blocks bots", ur: "سائٹ بوٹس کو روکتی ہے", ps: "سایټ بوټونه بندوي" },
  linkBroken: { en: "Link may be broken", ur: "لنک خراب ہو سکتا ہے", ps: "لینک ممکن خراب وي" },
  authority1: { en: "Government / regulator", ur: "حکومت / ریگولیٹر", ps: "حکومت / تنظیم کوونکی" },
  authority2: { en: "University / institution", ur: "یونیورسٹی / ادارہ", ps: "پوهنتون / ادارې" },
  authority3: { en: "Nonprofit / platform", ur: "غیر منافع بخش / پلیٹ فارم", ps: "غیر ګټه / پلیټفارم" },
  authority4: { en: "Community site — verify before acting", ur: "کمیونٹی سائٹ — عمل سے پہلے تصدیق کریں", ps: "ټولنیز سایټ — مخکې تایید کړئ" },
  liveFeed: { en: "Live feed in RAAHI", ur: "راہی میں براہ راست فیڈ", ps: "په راهي کې ژوندی فید" },
  all: { en: "All", ur: "سب", ps: "ټول" },

  toolsTitle: { en: "Tools", ur: "ٹولز", ps: "وسیلې" },
  toolsSub: { en: "Practical helpers that run in your browser. Nothing you type is stored.", ur: "عملی مددگار جو آپ کے براؤزر میں چلتے ہیں۔ جو آپ لکھتے ہیں وہ محفوظ نہیں ہوتا۔", ps: "عملي مرسته چې ستاسو په براوزر کې چلیږي. هرڅه چې لیکئ خوندي نه کیږي." },
  toolScam: { en: "Scam check", ur: "فراڈ کی جانچ", ps: "د درغلۍ کتنه" },
  toolMatch: { en: "Find for me", ur: "میرے لیے تلاش", ps: "زما لپاره" },
  toolPlan: { en: "Deadline planner", ur: "آخری تاریخ کا منصوبہ", ps: "د نیټې پلان" },
  toolAgent: { en: "Abroad safely", ur: "محفوظ بیرون ملک", ps: "خوندي بهر" },
  scamIntro: { en: "Paste the message, advert or offer. We look for common warning signs and tell you how to verify it officially. We never say an offer is 'safe' — only what to check.", ur: "پیغام، اشتہار یا پیشکش یہاں چسپاں کریں۔ ہم عام انتباہی علامات دیکھتے ہیں اور سرکاری تصدیق کا طریقہ بتاتے ہیں۔ ہم کبھی نہیں کہتے کہ پیشکش 'محفوظ' ہے — صرف یہ کہ کیا چیک کریں۔", ps: "پیغام یا اعلان دلته کېږدئ. موږ د خطر نښې لټوو او رسمي تایید لاره وایو." },
  scamPlaceholder: { en: "Paste the WhatsApp message, Facebook post or agent's offer here…", ur: "واٹس ایپ پیغام، فیس بک پوسٹ یا ایجنٹ کی پیشکش یہاں چسپاں کریں…", ps: "پیغام دلته کېږدئ…" },
  scamTick: { en: "Also tick anything that applies", ur: "جو بھی لاگو ہو اس پر نشان لگائیں", ps: "هر څه چې پلي کیږي نښه کړئ" },
  scamRun: { en: "Check for red flags", ur: "خطرے کی علامات جانچیں", ps: "د خطر نښې وګورئ" },
  scamFound: { en: "What we found", ur: "ہمیں کیا ملا", ps: "موږ څه وموندل" },
  scamDoNext: { en: "What to do next", ur: "آگے کیا کریں", ps: "بیا څه وکړئ" },
  scamLicences: { en: "Licence numbers in the text", ur: "متن میں لائسنس نمبر", ps: "په متن کې د جواز شمېرې" },
  riskHigh: { en: "High risk", ur: "زیادہ خطرہ", ps: "لوړ خطر" },
  riskMedium: { en: "Medium risk", ur: "درمیانہ خطرہ", ps: "منځنی خطر" },
  riskLow: { en: "Some caution", ur: "کچھ احتیاط", ps: "یو څه احتیاط" },
  riskNone: { en: "No obvious red flags", ur: "کوئی واضح علامت نہیں", ps: "څرګندې نښې نشته" },
  matchIntro: { en: "Tell us a little; we rank current listings and explain each pick. Listings clearly closed to Pakistan or already closed are left out.", ur: "تھوڑا بتائیں؛ ہم موجودہ فہرست کو ترتیب دیتے ہیں اور ہر انتخاب کی وجہ بتاتے ہیں۔ جو پاکستان کے لیے بند یا ختم ہیں وہ شامل نہیں۔", ps: "لږ ووایاست؛ موږ اوسنۍ لیست ترتیبوو." },
  matchLevel: { en: "I am looking at", ur: "میں تلاش کر رہا/رہی ہوں", ps: "زه لټوم" },
  matchInterests: { en: "I want", ur: "مجھے چاہیے", ps: "زه غواړم" },
  matchFields: { en: "My field", ur: "میرا شعبہ", ps: "زما برخه" },
  matchCountry: { en: "Preferred country (optional)", ur: "پسندیدہ ملک (اختیاری)", ps: "غوره هیواد (اختیاري)" },
  matchKeywords: { en: "Anything else (e.g. robotics, nursing)", ur: "کچھ اور (مثلاً روبوٹکس، نرسنگ)", ps: "نور څه" },
  matchGender: { en: "I am", ur: "میں ہوں", ps: "زه یم" },
  female: { en: "Female", ur: "خاتون", ps: "ښځه" },
  male: { en: "Male", ur: "مرد", ps: "سړی" },
  needsFunding: { en: "I need funding", ur: "مجھے فنڈنگ چاہیے", ps: "زه مالي ملاتړ غواړم" },
  remoteOk: { en: "Remote is fine", ur: "ریموٹ بھی ٹھیک ہے", ps: "ریموټ هم سمه ده" },
  matchRun: { en: "Find opportunities", ur: "مواقع تلاش کریں", ps: "فرصتونه ومومئ" },
  whyPicked: { en: "Why it was picked", ur: "یہ کیوں منتخب ہوا", ps: "ولې غوره شو" },
  checkFirst: { en: "Check first", ur: "پہلے دیکھیں", ps: "لومړی وګورئ" },
  planPick: { en: "Choose a listing", ur: "کوئی فہرست منتخب کریں", ps: "یو لیست وټاکئ" },
  planOrDate: { en: "…or enter your own deadline and type", ur: "…یا اپنی آخری تاریخ اور قسم لکھیں", ps: "…یا خپله نیټه او ډول ورکړئ" },
  planDate: { en: "Deadline", ur: "آخری تاریخ", ps: "وروستۍ نیټه" },
  planBuild: { en: "Build my plan", ur: "میرا منصوبہ بنائیں", ps: "زما پلان جوړ کړئ" },
  planDownload: { en: "Download calendar file (.ics)", ur: "کیلنڈر فائل ڈاؤن لوڈ کریں (.ics)", ps: "کیلنډر فایل ډاونلوډ (.ics)" },
  agentTitle: { en: "Going abroad for work or study — do this first", ur: "کام یا تعلیم کے لیے بیرون ملک — پہلے یہ کریں", ps: "د کار یا زده کړې لپاره بهر — لومړی دا وکړئ" },

  statusTitle: { en: "How fresh is this data?", ur: "یہ ڈیٹا کتنا تازہ ہے؟", ps: "دا ډیټا څومره تازه ده؟" },
  statusSub: { en: "RAAHI refreshes listings from public sources several times a day and shows exactly what worked on the last run.", ur: "راہی عوامی ذرائع سے دن میں کئی بار فہرست تازہ کرتا ہے اور آخری رن میں جو کام کیا وہ دکھاتا ہے۔", ps: "راهي له عامو سرچینو لیست تازه کوي." },
  statusStale: { en: "The data is older than 36 hours — the scheduled refresh may have failed.", ur: "ڈیٹا 36 گھنٹے سے پرانا ہے — شیڈول کی گئی تازہ کاری ناکام ہو سکتی ہے۔", ps: "ډیټا د 36 ساعتونو څخه زړه ده." },
  statusLast: { en: "Last refresh", ur: "آخری تازہ کاری", ps: "وروستۍ تازه کول" },
  statusTotal: { en: "Live listings", ur: "موجودہ فہرست", ps: "اوسنۍ لیست" },
  statusSource: { en: "Source", ur: "ذریعہ", ps: "سرچینه" },
  statusItems: { en: "Items", ur: "تعداد", ps: "شمېر" },
  statusResult: { en: "Last run", ur: "آخری رن", ps: "وروستی ځل" },
  statusTerms: { en: "How we use it", ur: "ہم کیسے استعمال کرتے ہیں", ps: "څنګه یې کاروو" },
  statusExperimental: { en: "Page-based (verified by the scheduled run)", ur: "صفحے پر مبنی (شیڈول رن سے تصدیق)", ps: "پاڼې پر بنسټ" },
  statusHow: { en: "How it works", ur: "یہ کیسے کام کرتا ہے", ps: "دا څنګه کار کوي" },
  statusHowBody: { en: "Scrapers read official APIs, RSS feeds and public pages politely (honest user-agent, robots.txt respected, rate-limited). Results are merged, de-duplicated across sites, and expired items are removed. If a source breaks, its last good data is kept instead of emptying the site. Every listing links back to the original page.", ur: "اسکریپرز سرکاری API، آر ایس ایس اور عوامی صفحات شائستگی سے پڑھتے ہیں (ایماندار یوزر ایجنٹ، robots.txt کا احترام، محدود رفتار)۔ نتائج ملا کر مختلف سائٹس کے ڈپلیکیٹ ہٹائے جاتے ہیں اور میعاد ختم آئٹمز نکال دیے جاتے ہیں۔ اگر کوئی ذریعہ خراب ہو تو اس کا آخری درست ڈیٹا رکھا جاتا ہے۔ ہر فہرست اصل صفحے کا لنک دیتی ہے۔", ps: "سکریپرونه رسمي API، RSS او عامې پاڼې په ادب لولي. هره لیست اصلي پاڼې ته لینک لري." },
  ok: { en: "OK", ur: "درست", ps: "سم" },
  empty: { en: "Empty", ur: "خالی", ps: "خالي" },
  error: { en: "Error", ur: "خرابی", ps: "تېروتنه" },
  skipped: { en: "Skipped", ur: "چھوڑا گیا", ps: "پریښودل شو" },

  ecoTitle: { en: "From the RAAHI family", ur: "راہی خاندان سے", ps: "د راهي کورنۍ څخه" },
  ecoSub: { en: "Companion apps for exam preparation and better study habits.", ur: "امتحانی تیاری اور بہتر مطالعاتی عادات کے ساتھی ایپس۔", ps: "د ازموینو چمتووالي او ښه مطالعې عادتونو ملګري اپلیکیشنونه." },
  openApp: { en: "Open", ur: "کھولیں", ps: "پرانیزئ" },
  homeTitle: { en: "Beyond services: scholarships, jobs, courses & safe routes abroad", ur: "خدمات سے آگے: وظائف، نوکریاں، کورسز اور بیرون ملک محفوظ راستے", ps: "له خدمتونو هاخوا: سکالرشپونه، دندې، کورسونه او بهر ته خوندي لارې" },
  homeSub: { en: "Fresh listings from NJP, BE&OE, scholarship sites and more — with deadlines, a scam checker and tools to plan your application.", ur: "این جے پی، بی ای او ای، اسکالرشپ سائٹس اور مزید سے تازہ فہرست — آخری تاریخوں، فراڈ جانچ اور درخواست کے منصوبے کے ٹولز کے ساتھ۔", ps: "له NJP، BE&OE او نورو سایټونو تازه لیست — د وروستۍ نیټې، د درغلۍ کتنې او پلان وسیلو سره." },
  homeScam: { en: "Check an offer before you pay anyone", ur: "کسی کو پیسے دینے سے پہلے پیشکش جانچیں", ps: "مخکې له پیسو ورکولو وړاندیز وګورئ" },
  homeAll: { en: "See all opportunities", ur: "تمام مواقع دیکھیں", ps: "ټولې فرصتونه وګورئ" },
  footerNote: { en: "RAAHI lists opportunities from other websites and always links back to them. Confirm details on the official page and never pay to apply.", ur: "راہی دوسری ویب سائٹس کے مواقع دکھاتا ہے اور ہمیشہ ان کا لنک دیتا ہے۔ تفصیلات سرکاری صفحے پر تصدیق کریں اور درخواست کے لیے کبھی رقم نہ دیں۔", ps: "راهي نورو سایټونو فرصتونه ښيي او تل لینک ورکوي. جزئیات په رسمي پاڼه تایید کړئ." },
} satisfies Record<string, Entry>;

export type StringKey = keyof typeof S;

export function t(language: Language, key: StringKey): string {
  const entry: Entry = S[key];
  if (language === "ps") return entry.ps ?? entry.ur ?? entry.en;
  if (language === "ur") return entry.ur ?? entry.en;
  return entry.en;
}

/** Pick the right language from a `{en, ur, ps?}` object returned by the libraries. */
export function pick(language: Language, value: { en: string; ur: string; ps?: string }): string {
  if (language === "ps") return value.ps ?? value.ur ?? value.en;
  return language === "ur" ? value.ur : value.en;
}

export const KIND_LABELS: Record<OpportunityKind, Entry & { emoji: string }> = {
  scholarship: { emoji: "🎓", en: "Scholarship", ur: "اسکالرشپ", ps: "سکالرشپ" },
  fellowship: { emoji: "🏅", en: "Fellowship", ur: "فیلوشپ", ps: "فیلوشپ" },
  internship: { emoji: "🧑‍💻", en: "Internship", ur: "انٹرن شپ", ps: "انټرنشپ" },
  job: { emoji: "💼", en: "Job", ur: "نوکری", ps: "دنده" },
  competition: { emoji: "🏆", en: "Competition", ur: "مقابلہ", ps: "سیالي" },
  course: { emoji: "📚", en: "Course", ur: "کورس", ps: "کورس" },
  coupon: { emoji: "🎟️", en: "Free course (coupon)", ur: "مفت کورس (کوپن)", ps: "وړیا کورس (کوپن)" },
  training: { emoji: "🛠️", en: "Training", ur: "تربیت", ps: "روزنه" },
  grant: { emoji: "💰", en: "Grant", ur: "گرانٹ", ps: "ګرانټ" },
  notice: { emoji: "📢", en: "Official notice", ur: "سرکاری نوٹس", ps: "رسمي خبرتیا" },
};

export const LEVEL_LABELS: Record<Level, Entry> = {
  school: { en: "School / college", ur: "اسکول / کالج", ps: "ښوونځی / کالج" },
  undergraduate: { en: "Bachelor's", ur: "بیچلرز", ps: "بیچلر" },
  masters: { en: "Master's", ur: "ماسٹرز", ps: "ماسټرز" },
  phd: { en: "PhD", ur: "پی ایچ ڈی", ps: "PhD" },
  postdoc: { en: "Post-doc", ur: "پوسٹ ڈاک", ps: "پوسټ ډاک" },
  professional: { en: "Professional", ur: "پیشہ ور", ps: "مسلکي" },
  any: { en: "Any level", ur: "کوئی بھی سطح", ps: "هره کچه" },
};

export const FUNDING_LABELS: Record<Funding, Entry> = {
  full: { en: "Fully funded", ur: "مکمل فنڈڈ", ps: "بشپړ مالي ملاتړ" },
  partial: { en: "Partly funded", ur: "جزوی فنڈڈ", ps: "جزوي مالي ملاتړ" },
  stipend: { en: "Stipend", ur: "وظیفہ", ps: "مرسته" },
  paid: { en: "Paid", ur: "تنخواہ دار", ps: "معاش لرونکی" },
  free: { en: "Free", ur: "مفت", ps: "وړیا" },
  unknown: { en: "Funding not stated", ur: "فنڈنگ درج نہیں", ps: "مالي ملاتړ نه دی ښودل شوی" },
};

export const STATUS_LABELS: Record<OpportunityStatus, Entry> = {
  open: { en: "Open", ur: "کھلا", ps: "پرانیستی" },
  "closing-soon": { en: "Closing soon", ur: "جلد بند", ps: "ژر تړل کیږي" },
  closed: { en: "Closed", ur: "بند", ps: "تړل شوی" },
  rolling: { en: "Rolling", ur: "مسلسل", ps: "دوامدار" },
  unknown: { en: "—", ur: "—", ps: "—" },
};

export const CATEGORY_LABELS: Record<ResourceCategory, Entry & { emoji: string }> = {
  scholarships: { emoji: "🎓", en: "Scholarships abroad", ur: "بیرون ملک اسکالرشپس", ps: "بهرنۍ سکالرشپونه" },
  "scholarships-pk": { emoji: "🇵🇰", en: "Pakistan scholarships & aid", ur: "پاکستان کے وظائف اور امداد", ps: "د پاکستان سکالرشپونه" },
  "jobs-pk": { emoji: "💼", en: "Jobs in Pakistan", ur: "پاکستان میں نوکریاں", ps: "په پاکستان کې دندې" },
  "govt-recruitment": { emoji: "🏛️", en: "Public service commissions & tests", ur: "پبلک سروس کمیشن اور ٹیسٹنگ سروسز", ps: "د عامې خدمت کمیسیونونه" },
  "jobs-global": { emoji: "🌍", en: "Jobs worldwide & remote", ur: "دنیا بھر اور ریموٹ نوکریاں", ps: "نړیوالې او ریموټ دندې" },
  "overseas-employment": { emoji: "✈️", en: "Overseas employment (official)", ur: "بیرون ملک روزگار (سرکاری)", ps: "بهرنۍ دندې (رسمي)" },
  internships: { emoji: "🧑‍💻", en: "Internships", ur: "انٹرن شپس", ps: "انټرنشپونه" },
  competitions: { emoji: "🏆", en: "Competitions & hackathons", ur: "مقابلے اور ہیکاتھون", ps: "سیالۍ" },
  learning: { emoji: "📚", en: "Free learning platforms", ur: "مفت سیکھنے کے پلیٹ فارم", ps: "وړیا زده کړه" },
  "skills-pk": { emoji: "🛠️", en: "Skills training in Pakistan", ur: "پاکستان میں ہنر کی تربیت", ps: "په پاکستان کې مهارت" },
  coupons: { emoji: "🎟️", en: "Free course coupons", ur: "مفت کورس کوپن", ps: "وړیا کوپنونه" },
  "exam-prep": { emoji: "📝", en: "Exam & test preparation", ur: "امتحان اور ٹیسٹ کی تیاری", ps: "د ازموینې چمتووالی" },
  grants: { emoji: "💰", en: "Grants & startups", ur: "گرانٹس اور اسٹارٹ اپس", ps: "ګرانټونه" },
  research: { emoji: "🔬", en: "Research & PhD positions", ur: "تحقیق اور پی ایچ ڈی", ps: "څیړنه او PhD" },
  documents: { emoji: "📄", en: "Documents & attestation", ur: "دستاویزات اور تصدیق", ps: "اسناد او تصدیق" },
  safety: { emoji: "🛡️", en: "Safety & complaints", ur: "حفاظت اور شکایات", ps: "خوندیتوب او شکایتونه" },
};

export const FIELD_LABELS: Record<string, Entry> = {
  "computer-science": { en: "Computer science & IT", ur: "کمپیوٹر سائنس و آئی ٹی", ps: "کمپیوټر ساینس" },
  engineering: { en: "Engineering", ur: "انجینئرنگ", ps: "انجینري" },
  "medicine-health": { en: "Medicine & health", ur: "طب و صحت", ps: "طب او روغتیا" },
  business: { en: "Business & economics", ur: "کاروبار و معاشیات", ps: "سوداګري" },
  "law-policy": { en: "Law & policy", ur: "قانون و پالیسی", ps: "قانون" },
  "natural-sciences": { en: "Natural sciences & maths", ur: "قدرتی علوم و ریاضی", ps: "طبیعي علوم" },
  "agriculture-environment": { en: "Agriculture & environment", ur: "زراعت و ماحول", ps: "کرنه او چاپیریال" },
  education: { en: "Education", ur: "تعلیم", ps: "زده کړه" },
  "arts-humanities": { en: "Arts & humanities", ur: "فنون و انسانیات", ps: "هنر" },
  "social-sciences": { en: "Social sciences", ur: "سماجی علوم", ps: "ټولنیز علوم" },
};

const COUNTRY_UR: Record<string, string> = {
  Pakistan: "پاکستان", "United Kingdom": "برطانیہ", "United States": "امریکہ", Canada: "کینیڈا", Australia: "آسٹریلیا", "New Zealand": "نیوزی لینڈ",
  Germany: "جرمنی", France: "فرانس", Netherlands: "ہالینڈ", Belgium: "بیلجیم", Switzerland: "سوئٹزرلینڈ", Austria: "آسٹریا", Sweden: "سویڈن",
  Norway: "ناروے", Denmark: "ڈنمارک", Finland: "فن لینڈ", Ireland: "آئرلینڈ", Italy: "اٹلی", Spain: "اسپین", Portugal: "پرتگال", Poland: "پولینڈ",
  Hungary: "ہنگری", "Czech Republic": "چیک جمہوریہ", Romania: "رومانیہ", Greece: "یونان", Russia: "روس", Turkey: "ترکی", Azerbaijan: "آذربائیجان",
  Kazakhstan: "قازقستان", China: "چین", "Hong Kong": "ہانگ کانگ", Taiwan: "تائیوان", Japan: "جاپان", "South Korea": "جنوبی کوریا", Singapore: "سنگاپور",
  Malaysia: "ملائیشیا", Indonesia: "انڈونیشیا", Thailand: "تھائی لینڈ", India: "بھارت", Bangladesh: "بنگلہ دیش", "Sri Lanka": "سری لنکا", Nepal: "نیپال",
  "United Arab Emirates": "متحدہ عرب امارات", "Saudi Arabia": "سعودی عرب", Qatar: "قطر", Kuwait: "کویت", Oman: "عمان", Bahrain: "بحرین", Egypt: "مصر",
  "South Africa": "جنوبی افریقہ", Kenya: "کینیا", Ghana: "گھانا", Nigeria: "نائیجیریا", Rwanda: "روانڈا", Uganda: "یوگنڈا", Ethiopia: "ایتھوپیا",
  Tanzania: "تنزانیہ", Brazil: "برازیل", Mexico: "میکسیکو", Europe: "یورپ", Online: "آن لائن", Remote: "ریموٹ",
};

/** Country names in Urdu/Pashto (Pashto readers use the Urdu forms); other names pass through unchanged. */
export function countryLabel(language: Language, name: string): string {
  return language === "en" ? name : COUNTRY_UR[name] ?? name;
}
