"use client";

import Link from "next/link";
import React from "react";

import { useLanguage } from "@/components/shell/LanguageProvider";
import { Card, Section } from "@/components/shell/Ui";
import type { Localized } from "@/lib/types";

/**
 * What we do with what you tell us.
 *
 * Written to be read by someone who has never read a privacy policy before, in
 * the plainest words we could manage, because the people who most need this
 * are the least likely to be able to enforce it. Every sentence here is meant
 * to be true of the code, not aspirational.
 */

interface Promise {
  icon: string;
  title: Localized;
  body: Localized;
}

const PROMISES: Promise[] = [
  {
    icon: "🔒",
    title: {
      en: "No account, no login",
      ur: "کوئی اکاؤنٹ نہیں، لاگ ان نہیں",
      ps: "اکاؤنټ نشته، ننوتل نشته",
      hkp: "کوئی اکاؤنٹ نئیں، لاگ ان نئیں",
    },
    body: {
      en: "Raahi does not ask your name, email or password. Your saved applications are kept under a random number stored in your own browser. Clear your browser data and that number is gone.",
      ur: "راہی آپ کا نام، ای میل یا پاسورڈ نہیں مانگتا۔ آپ کی محفوظ درخواستیں ایک بے ترتیب نمبر کے ساتھ رکھی جاتی ہیں جو آپ کے براؤزر میں ہوتا ہے۔ براؤزر کی معلومات صاف کریں تو وہ نمبر بھی ختم ہو جاتا ہے۔",
      ps: "راہی ستاسو نوم، برېښنالیک یا پټنوم نه غواړي. ستاسو خوندي شوې غوښتنې د یوه ناڅاپي نمبر لاندې ساتل کېږي چې ستاسو په براوزر کې وي. د براوزر معلومات پاک کړئ نو هغه نمبر هم ختمېږي.",
      hkp: "راہی تہاڈا ناں، ای میل یا پاسورڈ نئیں منگدا۔ تہاڈیاں محفوظ درخواستاں اک بے ترتیب نمبر نال رکھیاں جاندیاں نیں جیہڑا تہاڈے براؤزر وچ ہوندا اے۔ براؤزر دی معلومات صاف کرو تاں اوہ نمبر وی ختم ہو جاندا اے۔",
    },
  },
  {
    icon: "📄",
    title: {
      en: "Photos of your documents",
      ur: "دستاویز کی تصویر",
      ps: "ستاسو د اسنادو عکس",
      hkp: "دستاویز دی تصویر",
    },
    body: {
      en: "When you photograph a document, we try to read it and show you what we found. If we cannot read it, we say so plainly — you type the details yourself. We do not keep the photo, and we never guess an identity number to fill a gap.",
      ur: "جب آپ دستاویز کی تصویر لیتے ہیں تو ہم اسے پڑھنے کی کوشش کرتے ہیں اور جو پڑھا وہ دکھاتے ہیں۔ اگر نہ پڑھ سکیں تو صاف بتاتے ہیں — تفصیلات آپ خود لکھیں۔ ہم تصویر محفوظ نہیں کرتے، اور خالی جگہ بھرنے کے لیے شناختی نمبر کا اندازہ نہیں لگاتے۔",
      ps: "کله چې تاسو د سند عکس اخلئ، موږ یې د لوستلو هڅه کوو او څه چې ولوستل شول هغه درښیو. که یې ونه لوستلی شو، په ښکاره وایو — توضیحات تاسو په خپله ولیکئ. موږ عکس نه ساتو، او د تشې ډکولو لپاره د پېژندنې نمبر اټکل نه کوو.",
      hkp: "جدوں تساں دستاویز دی تصویر لیندے او تاں اسیں ایہنوں پڑھن دی کوشش کردے آں تے جیہڑا پڑھیا اوہ دسدے آں۔ جے نہ پڑھ سکئیے تاں صاف دسدے آں — تفصیلاں تساں آپ لکھو۔ اسیں تصویر محفوظ نئیں کردے، تے خالی جگہ بھرن لئی شناختی نمبر دا اندازہ نئیں لاندے۔",
    },
  },
  {
    icon: "🕶️",
    title: {
      en: "Your number is hidden before it travels",
      ur: "آپ کا نمبر بھیجنے سے پہلے چھپا دیا جاتا ہے",
      ps: "ستاسو نمبر د لېږد مخکې پټېږي",
      hkp: "تہاڈا نمبر بھیجن توں پہلے چھپا دتا جاندا اے",
    },
    body: {
      en: "Before anything you type is sent to an AI service, we hide CNIC and phone numbers in the text, so they look like 12345-*******-7. Nobody receives your full identity number from us.",
      ur: "آپ کی لکھی ہوئی بات AI سروس کو بھیجنے سے پہلے ہم شناختی کارڈ اور فون نمبر چھپا دیتے ہیں، مثلاً 12345-*******-7۔ ہم کسی کو آپ کا مکمل شناختی نمبر نہیں دیتے۔",
      ps: "ستاسو لیکل شوې خبره AI خدمت ته د لېږلو مخکې موږ د پېژندنې کارت او ټیلیفون نمبر پټوو، لکه 12345-*******-7. موږ چا ته ستاسو بشپړ پېژند نمبر نه ورکوو.",
      hkp: "تہاڈی لکھی ہوئی گل AI سروس نوں بھیجن توں پہلاں اسیں شناختی کارڈ تے فون نمبر چھپا دیندے آں، مثلاً 12345-*******-7۔ اسیں کسے نوں تہاڈا مکمل شناختی نمبر نئیں دیندے۔",
    },
  },
  {
    icon: "🩸",
    title: {
      en: "Requests we pass on",
      ur: "وہ درخواستیں جو ہم آگے بھیجتے ہیں",
      ps: "هغه غوښتنې چې موږ وړاندې لېږو",
      hkp: "اوہ درخواستاں جیہڑیاں اسیں اگے بھیجدے آں",
    },
    body: {
      en: "If you ask for blood, disaster relief or legal help, we pass what you gave us — name, area and phone number — to the organisation or volunteers who can act. That is the only way they can reach you. Never send us someone else's details without their permission.",
      ur: "اگر آپ خون، امداد یا قانونی مدد مانگیں تو جو کچھ آپ نے دیا — نام، علاقہ اور فون نمبر — ہم اس ادارے یا رضاکاروں تک پہنچاتے ہیں جو مدد کر سکتے ہیں۔ یہی واحد طریقہ ہے کہ وہ آپ تک پہنچ سکیں۔ کسی اور کی تفصیلات اس کی اجازت کے بغیر نہ بھیجیں۔",
      ps: "که تاسو وینه، د ناورین مرسته یا حقوقي مرسته وغواړئ، هغه څه چې تاسو راکړي — نوم، سیمه او ټیلیفون — هغه ادارې یا رضاکارانو ته رسوو چې مرسته کولای شي. دا یوازینۍ لار ده چې هغوی تاسو ته در ورسي. د بل چا توضیحات د هغه له اجازې پرته مه لېږئ.",
      hkp: "جے تساں خون، امداد یا قانونی مدد منگو تاں جیہڑا کجھ تساں دتا — ناں، علاقہ تے فون نمبر — اسیں اوہس ادارے یا رضاکاراں تک پہنچاندے آں جیہڑے مدد کر سکدے نیں۔ ایہو اکو طریقہ اے کہ اوہ تہاڈے تک پہنچ سکن۔ کسے ہور دیاں تفصیلاں اوہدی اجازت توں بغیر نہ بھیجو۔",
    },
  },
  {
    icon: "🍪",
    title: {
      en: "The only two things stored on your phone",
      ur: "آپ کے فون پر محفوظ صرف دو چیزیں",
      ps: "ستاسو په ټیلیفون کې یوازې دوه شیان خوندي کېږي",
      hkp: "تہاڈے فون تے محفوظ صرف دو چیزاں",
    },
    body: {
      en: "One number remembers your saved applications. A second random number stops one person from using up the allowance that everyone on your mobile network shares. Neither one knows who you are. There is no advertising and no analytics here.",
      ur: "ایک نمبر آپ کی محفوظ درخواستیں یاد رکھتا ہے۔ دوسرا بے ترتیب نمبر اس بات سے روکتا ہے کہ کوئی ایک شخص آپ کے موبائل نیٹ ورک کی مشترکہ حد خرچ کر دے۔ دونوں میں سے کوئی نہیں جانتا کہ آپ کون ہیں۔ یہاں کوئی اشتہار اور کوئی ٹریکنگ نہیں۔",
      ps: "یو نمبر ستاسو خوندي غوښتنې یاد ساتي. بل ناڅاپي نمبر د دې مخه نیسي چې یو کس ستاسو د ګرځنده شبکې ګډه برخه مصرف کړي. هېڅ یو نه پوهېږي چې تاسو څوک یئ. دلته هېڅ اعلان او هېڅ څارنه نشته.",
      hkp: "اک نمبر تہاڈیاں محفوظ درخواستاں یاد رکھدا اے۔ دوجا بے ترتیب نمبر ایس گل توں روکدا اے کہ کوئی اک بندہ تہاڈے موبائل نیٹ ورک دی مشترکہ حد خرچ کر دوے۔ دوہاں وچوں کوئی نئیں جاندا کہ تساں کون او۔ ایتھے کوئی اشتہار تے کوئی ٹریکنگ نئیں۔",
    },
  },
  {
    icon: "🤖",
    title: {
      en: "When a computer writes the answer",
      ur: "جب جواب کمپیوٹر لکھے",
      ps: "کله چې کمپیوټر ځواب لیکي",
      hkp: "جدوں جواب کمپیوٹر لکھے",
    },
    body: {
      en: "Some answers are written by an AI, using only our own checked records — it is told not to invent a fee, date or number. If that service is unavailable, Raahi answers from its records instead. Either way, please confirm on the official source before you act.",
      ur: "کچھ جوابات AI لکھتا ہے، اور صرف ہمارے تصدیق شدہ ریکارڈ استعمال کرتا ہے — اُسے ہدایت ہے کہ کوئی فیس، تاریخ یا نمبر خود نہ گھڑے۔ اگر یہ سروس دستیاب نہ ہو تو راہی اپنے ریکارڈ سے جواب دیتا ہے۔ ہر صورت میں عمل کرنے سے پہلے سرکاری ذریعے سے تصدیق کر لیں۔",
      ps: "ځینې ځوابونه AI لیکي، یوازې زموږ تایید شوي ریکارډونه کاروي — دې ته لارښوونه شوې چې هېڅ فیس، نېټه یا نمبر په خپله جوړ نه کړي. که دا خدمت شتون ونلري، راہي د خپلو ریکارډونو ځواب ورکوي. په هر حال، د عمل کولو مخکې له رسمي سرچینې تایید کړئ.",
      hkp: "کجھ جواب AI لکھدا اے، تے صرف ساڈے تصدیق شدہ ریکارڈ ورتدا اے — اوہنوں ہدایت اے کہ کوئی فیس، تاریخ یا نمبر آپ نہ گھڑے۔ جے ایہ سروس دستیاب نہ ہووے تاں راہی اپنے ریکارڈ توں جواب دیندا اے۔ ہر صورت وچ عمل کرن توں پہلاں سرکاری ذریعے توں تصدیق کر لو۔",
    },
  },
  {
    icon: "🚨",
    title: {
      en: "If you are in danger",
      ur: "اگر آپ خطرے میں ہیں",
      ps: "که تاسو په خطر کې یئ",
      hkp: "جے تساں خطرے وچ او",
    },
    body: {
      en: "If your words tell us you are in danger, we show the emergency numbers straight away. We do not ask you anything else and we do not wait for the AI. Please call 1122, 15 or 115.",
      ur: "اگر آپ کی باتوں سے لگے کہ آپ خطرے میں ہیں تو ہم فوراً ایمرجنسی نمبر دکھاتے ہیں۔ ہم آپ سے کچھ اور نہیں پوچھتے اور AI کا انتظار نہیں کرتے۔ براہ کرم 1122، 15 یا 115 پر کال کریں۔",
      ps: "که ستاسو له خبرو څرګنده شي چې تاسو په خطر کې یئ، موږ سمدستي د بېړني حالت نمبرونه ښیو. موږ نور څه نه پوښتو او د AI انتظار نه کوو. مهرباني وکړئ 1122، 15 یا 115 ته زنګ ووهئ.",
      hkp: "جے تہاڈیاں گلاں توں لگے کہ تساں خطرے وچ او تاں اسیں فوراً ایمرجنسی نمبر دسدے آں۔ اسیں تہاڈے توں ہور کجھ نئیں پچھدے تے AI دا انتظار نئیں کردے۔ براہ کرم 1122، 15 یا 115 تے کال کرو۔",
    },
  },
  {
    icon: "🗑️",
    title: {
      en: "Deleting what you gave us",
      ur: "دی گئی معلومات مٹانا",
      ps: "هغه معلومات ړنګول چې تاسو راکړي",
      hkp: "دتیاں گئیاں معلومات مٹانا",
    },
    body: {
      en: "You can delete a saved application at any time from My applications. Clearing your browser data removes the number that remembers you, so your saved progress can no longer be found. A request already passed to an organisation is in their hands — ask them directly.",
      ur: "محفوظ درخواست کو آپ کسی بھی وقت \"میری درخواستیں\" سے حذف کر سکتے ہیں۔ براؤزر کی معلومات صاف کرنے سے وہ نمبر ختم ہو جاتا ہے جو آپ کو یاد رکھتا ہے، اس لیے آپ کی محفوظ پیش رفت دوبارہ نہیں ملے گی۔ جو درخواست کسی ادارے کو بھیج دی گئی وہ اب ان کے پاس ہے — براہ راست انہی سے رابطہ کریں۔",
      ps: "خوندي شوې غوښتنه تاسو هر وخت له \"زما غوښتنې\" ړنګولای شئ. د براوزر معلومات پاکول هغه نمبر ختموي چې تاسو یاد ساتي، نو ستاسو خوندي پرمختګ بیا نه موندل کېږي. هغه غوښتنه چې ادارې ته لېږل شوې اوس د هغوی په واک کې ده — له هغوی سره مستقیم اړیکه ونیسئ.",
      hkp: "محفوظ درخواست نوں تساں کسے وی وقت \"میریاں درخواستاں\" توں حذف کر سکدے او۔ براؤزر دی معلومات صاف کرن نال اوہ نمبر ختم ہو جاندا اے جیہڑا تہانوں یاد رکھدا اے، ایس لئی تہاڈی محفوظ پیش رفت دوبارہ نئیں ملے گی۔ جیہڑی درخواست کسے ادارے نوں بھیج دتی گئی اوہ ہن اوہناں کول اے — براہ راست اوہناں نال رابطہ کرو۔",
    },
  },
  {
    icon: "⚠️",
    title: {
      en: "What Raahi is not",
      ur: "راہی کیا نہیں ہے",
      ps: "راہي څه نه دي",
      hkp: "راہی کیہ نئیں اے",
    },
    body: {
      en: "Raahi is not a government office. It does not issue a CNIC, domicile, degree or scholarship, and it never charges a fee or asks for a bribe. If a stranger messages you asking for your CNIC photo or money, it is not us — report them.",
      ur: "راہی کوئی سرکاری دفتر نہیں۔ یہ شناختی کارڈ، ڈومیسائل، ڈگری یا سکالرشپ جاری نہیں کرتا، اور کبھی فیس یا رشوت نہیں مانگتا۔ اگر کوئی اجنبی آپ سے شناختی کارڈ کی تصویر یا پیسے مانگے تو وہ ہم نہیں — اس کی اطلاع دیں۔",
      ps: "راہي کوم دولتي دفتر نه دی. دا د پېژندنې کارت، ډومیسایل، ډیپلوم یا بورس نه صادروي، او هېڅکله فیس یا بډې نه غواړي. که یو نااشنا کس ستاسو د پېژندنې کارت عکس یا پیسې وغواړي، هغه موږ نه یو — د هغه خبر ورکړئ.",
      hkp: "راہی کوئی سرکاری دفتر نئیں۔ ایہ شناختی کارڈ، ڈومیسائل، ڈگری یا سکالرشپ جاری نئیں کردا، تے کدے فیس یا رشوت نئیں منگدا۔ جے کوئی اجنبی تہاڈے توں شناختی کارڈ دی تصویر یا پیسے منگے تاں اوہ اسیں نئیں — اوہدی اطلاع دو۔",
    },
  },
];

export default function PrivacyPage() {
  const { language, L } = useLanguage();
  const updated = "30 September 2026";

  return (
    <div>
      <Section
        title={language === "en" ? "Your information" : "آپ کی معلومات"}
        subtitle={
          language === "en"
            ? "What Raahi keeps, what it passes on, and what it will never do"
            : "راہی کیا محفوظ رکھتا ہے، کیا آگے بھیجتا ہے، اور کیا کبھی نہیں کرے گا"
        }
      >
        <Card className="bg-[var(--surface-2)]">
          <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]">
            {language === "en"
              ? "Short version: no account, no fees, no selling your data, no advertising. Read the rest in your own language below."
              : "مختصر یہ: کوئی اکاؤنٹ نہیں، کوئی فیس نہیں، آپ کا ڈیٹا فروخت نہیں، کوئی اشتہار نہیں۔ تفصیل نیچے اپنی زبان میں پڑھیں۔"}
          </p>
        </Card>
      </Section>

      <div className="mt-4 grid gap-2.5">
        {PROMISES.map((item) => (
          <Card key={item.icon}>
            <div className="flex items-start gap-2.5">
              <span aria-hidden="true" className="text-xl leading-none">
                {item.icon}
              </span>
              <div>
                <h3 className="text-[13.5px] font-extrabold leading-tight">{L(item.title)}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{L(item.body)}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Section title={language === "en" ? "Ask us" : "ہم سے پوچھیں"}>
        <Card>
          <p className="text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
            {language === "en"
              ? "Wrong fee, date or number? Tell us and a reviewer will check it against the official source. Raahi never changes verified content on its own."
              : "کوئی غلط فیس، تاریخ یا نمبر؟ بتائیں، جائزہ لینے والا سرکاری ذریعے سے تصدیق کرے گا۔ راہی خود بخود تصدیق شدہ معلومات نہیں بدلتا۔"}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Link
              href="/kb?tab=correct"
              className="inline-flex items-center rounded-xl bg-[var(--forest)] px-3.5 py-2 text-[12.5px] font-black text-white"
            >
              ✏️ {language === "en" ? "Report a mistake" : "غلظی کی اطلاع دیں"}
            </Link>
            <Link
              href="/contacts"
              className="inline-flex items-center rounded-xl border border-[var(--line)] bg-white px-3.5 py-2 text-[12.5px] font-black"
            >
              📞 {language === "en" ? "Official contacts" : "سرکاری رابطے"}
            </Link>
          </div>
        </Card>
      </Section>

      <p className="mt-5 text-center text-[10.5px] text-[var(--muted-light)]">
        {language === "en" ? "Last updated" : "آخری تازہ کاری"}: {updated}
      </p>
    </div>
  );
}
