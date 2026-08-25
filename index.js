const express = require("express");
const config = require("./config.json");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// GEMINI
// ======================================================

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    })
  : null;

const AI_MODEL = "gemini-3-flash-preview";


// ======================================================
// معلومات شركة الاتحاد
// ======================================================

const COMPANY = {
  name: "شركة الاتحاد - مكتب الشعار للصرافة والحوالات",

  address:
    "حلب، الشعار، بعد مفرق سد اللوز، من طرف طريق الباب، مقابل فروج اسكندر أوغلو.",

  map:
    "https://maps.app.goo.gl/nNsgHW7h5ASgoRU9A",

  workingHours:
    "من 10 صباحاً حتى 6 مساءً.",

  holiday:
    "الجمعة عطلة رسمية.",

  branches: [
    "حلب / شارع النيل / عند دوار النحاس",
    "حلب / الجميلية / عند البريد جانب القدموس"
  ],

  mainBranch:
    "الفرع الرئيسي هو فرع شارع النيل.",

  telegram:
    "https://t.me/alitehad_aleppo",

  whatsapp:
    "https://whatsapp.com/channel/0029VbAdvbBInlqNI6x8dc1S"
};


// ======================================================
// العطلة الخاصة
// ======================================================

const SPECIAL_HOLIDAY = {
  date: "2026-08-25",

  text:
    "اليوم الثلاثاء 25 آب 2026 عطلة رسمية بمناسبة عيد المولد النبوي الشريف ﷺ، وسيُستأنف العمل يوم الأربعاء 26 آب 2026 ضمن ساعات الدوام المعتادة."
};


// ======================================================
// النوايا المسموحة
// ======================================================

const INTENTS = [
  "greeting",
  "thanks",
  "location",
  "branches",
  "working_hours",
  "rates",
  "transfer_check",
  "transfer_notice",
  "documents",
  "sham_cash",
  "receiver_change",
  "later_collection",
  "complaint",
  "voice",
  "unknown"
];


// ======================================================
// تنظيف النص
// ======================================================

function normalizeText(text) {

  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[؟?!،,:;.]/g, " ")
    .replace(/\s+/g, " ");
}


function containsAny(text, words) {

  return words.some(word =>
    text.includes(normalizeText(word))
  );

}


// ======================================================
// الصلاحيات
// مستقلة عن AI
// ======================================================

function isAllowedUser(chatId) {

  const users =
    config.permissions &&
    Array.isArray(config.permissions.allowedUsers)
      ? config.permissions.allowedUsers
      : [];

  return users.includes(String(chatId));
}


function isAllowedGroup(chatId) {

  const groups =
    config.permissions &&
    Array.isArray(config.permissions.allowedGroups)
      ? config.permissions.allowedGroups
      : [];

  return groups.includes(String(chatId));
}


// ======================================================
// AI ROUTER
// ======================================================

async function aiRouter(message) {

  if (!ai) {
    return "unknown";
  }

  const prompt = `
أنت AI Router لخدمة عملاء شركة الاتحاد للصرافة والحوالات.

مهمتك الوحيدة هي فهم رسالة العميل وتحديد نوعها.

لا تكتب جواباً للعميل.
لا تضف معلومات.
لا تخترع أسعاراً.
لا تشرح.
أعد كلمة واحدة فقط من قائمة النوايا.

النوايا المتاحة:

greeting
تحية

thanks
شكر أو ثناء

location
سؤال عن موقع المكتب أو العنوان أو اللوكيشن

branches
سؤال عن فروع الشركة أو وجود فرع أو مكتب آخر

working_hours
سؤال عن الدوام أو وقت الفتح والإغلاق

rates
سؤال عن أسعار الصرف

transfer_check
استفسار عن حوالة أو وصول حوالة أو وجود حوالة باسمه

transfer_notice
رسالة تحتوي إشعار أو بيانات حوالة

documents
سؤال عن الوثائق المطلوبة لاستلام الحوالة

sham_cash
سؤال عن شام كاش

receiver_change
سؤال عن شخص آخر يستلم الحوالة أو تغيير اسم المستفيد

later_collection
سؤال عن استلام الحوالة في وقت أو يوم لاحق

complaint
شكوى أو مشكلة أو طلب الإدارة

voice
رسالة صوتية

unknown
إذا لم تفهم الرسالة

==================================================
قاعدة مهمة جداً
==================================================

افهم معنى الجملة وليس الكلمات حرفياً.

افهم اللهجة السورية والعامية.
افهم الأخطاء الإملائية.
افهم حذف بعض الكلمات.
افهم اختلاف ترتيب الكلمات.
افهم "كن" و"كم" و"كنن" و"كمون" حسب السياق.
لا تشترط وجود كلمة محددة حتى تختار النية.

==================================================
أمثلة الموقع
==================================================

"وين مكتبكن"
location

"وين مكتبكم"
location

"وين محلكن"
location

"وين محلكم"
location

"وين موجودين"
location

"وين موجود مكتبكن"
location

"وين صاير مكتبكن"
location

"وين بلاقيكن"
location

"وين بلاقي مكتبكن"
location

"شو عنوانكن"
location

"عطيني عنوانكن"
location

"وين عنوانكم"
location

"بدي عنوان المكتب"
location

"بدي لوكيشن"
location

"ابعتلي اللوكيشن"
location

"دزلي الموقع"
location

"بعتلي الموقع"
location

"كيف بوصل لعندكن"
location

"وين الفرع الموجود بالشعار"
location

==================================================
أمثلة الفروع
==================================================

"عنكن فرع تاني"
branches

"عندكن فرع تاني"
branches

"في فرع غير هاد"
branches

"إلكن فرع غير هاد"
branches

"في غير فرع"
branches

"إلكن فروع تانية"
branches

"عندكم فروع غير"
branches

"وين فروعكن"
branches

"شو الفروع الموجودة"
branches

"وين مكاتبكم"
branches

"إلكن مكاتب تانية"
branches

"في مكتب تاني"
branches

"في فرع قريب"
branches

"وين فروع الشركة"
branches

"شو الأفرع"
branches

"فرع النيل وين"
branches

==================================================
أمثلة الدوام
==================================================

"فاتحين"
working_hours

"هلق فاتحين"
working_hours

"هلأ فاتحين"
working_hours

"اليوم فاتحين"
working_hours

"المكتب فاتح"
working_hours

"المحل فاتح"
working_hours

"امتى بتفتحو"
working_hours

"متى بتفتحو"
working_hours

"شو وقت الدوام"
working_hours

"شو أوقات الدوام"
working_hours

"لوين الساعة فاتحين"
working_hours

"ايمت بتسكروا"
working_hours

"ايمت بتسكرو"
working_hours

"امتى بتسكروا"
working_hours

"الجمعة فاتحين"
working_hours

==================================================
أمثلة الأسعار
==================================================

"قديش الدولار"
rates

"بكم الدولار"
rates

"شو سعر الدولار"
rates

"سعر الدولار اليوم"
rates

"قديش اليورو"
rates

"بكم اليورو"
rates

"شو سعر اليورو"
rates

"قديش التركي"
rates

"بكم التركي"
rates

"شو سعر التركي"
rates

"قديش الصرف"
rates

"شو الصرف"
rates

"كم الصرف"
rates

"شو أسعاركم"
rates

"وين أسعاركم"
rates

"وين اسعار الصرف"
rates

==================================================
أمثلة الحوالات
==================================================

"في حوالة باسمي"
transfer_check

"في حواله الي"
transfer_check

"إلي حوالة"
transfer_check

"في شي حوالة الي"
transfer_check

"وصلت الحوالة"
transfer_check

"وصلت حوالتي"
transfer_check

"الحوالة وصلت"
transfer_check

"وين حوالتي"
transfer_check

"وين الحوالة"
transfer_check

"بدي اتأكد من الحوالة"
transfer_check

"بدي استلم حوالتي"
transfer_check

"بدي اقبض الحوالة"
transfer_check

"عندي حوالة"
transfer_check

==================================================
إشعار الحوالة
==================================================

"هذا إشعار الحوالة"
transfer_notice

"هاد اشعار الحوالة"
transfer_notice

"اشعار حوالة"
transfer_notice

"رقم الحوالة"
transfer_notice

"رقم حوالتي"
transfer_notice

"شركة الاتحاد"
transfer_notice

"#0005578013"
transfer_notice

إذا أرسل العميل نصاً يشبه إيصال أو إشعار حوالة ويحتوي اسم أو رقم أو مبلغ أو معلومات تحويل:
transfer_notice

==================================================
الوثائق
==================================================

"شو لازم جيب"
documents

"شو لازم معي"
documents

"شو بدي جيب"
documents

"شو بدي للقبض"
documents

"شو لازم للقبض"
documents

"شو الأوراق المطلوبة"
documents

"شو الوثائق المطلوبة"
documents

"شو لازم آخد معي"
documents

"بتمشي صورة الهوية"
documents

"فيني اقبض بالجواز"
documents

"الهوية بتكفي"
documents

"بقدر اقبض بدون هوية"
documents

==================================================
شام كاش
==================================================

"عندكن شام كاش"
sham_cash

"بتتعاملوا مع شام كاش"
sham_cash

"في استلام شام كاش"
sham_cash

"شام كاش موجود"
sham_cash

==================================================
شخص آخر يستلم
==================================================

"فيني خلي حدا يستلم عني"
receiver_change

"حدا بيقدر يستلم عني"
receiver_change

"فيني خلي اخي يقبض"
receiver_change

"اخوي يستلم عني"
receiver_change

"زوجتي تستلم عني"
receiver_change

"زوجي يستلم عني"
receiver_change

"حدا غيري بيقبض"
receiver_change

"مافيني اجي حدا يستلم بدالي"
receiver_change

"بدي غير اسم الحوالة"
receiver_change

==================================================
الاستلام في يوم آخر
==================================================

"بقدر استلم بكرا"
later_collection

"بدي اجي بكرا"
later_collection

"بقدر اقبض بعدين"
later_collection

"الحوالة بتضل لبكرا"
later_collection

"إذا ماجيت اليوم"
later_collection

"فيني استلمها يوم تاني"
later_collection

"بقدر استلمها الأسبوع الجاي"
later_collection

==================================================
الشكاوى
==================================================

"بدي اشتكي"
complaint

"عندي شكوى"
complaint

"عندي مشكلة"
complaint

"بدي احكي مع المدير"
complaint

"بدي احكي مع الإدارة"
complaint

"وين الإدارة"
complaint

==================================================
التحية
==================================================

"مرحبا"
greeting

"اهلا"
greeting

"السلام عليكم"
greeting

"مسا الخير"
greeting

"صباح الخير"
greeting

"هلا"
greeting

==================================================
الشكر
==================================================

"شكرا"
thanks

"يسلمو"
thanks

"مشكور"
thanks

"يعطيكم العافية"
thanks

==================================================
الرسائل الصوتية
==================================================

إذا كانت الرسالة عبارة عن رسالة صوتية أو وصف لرسالة صوتية:
voice

==================================================

رسالة العميل:

${message}

أعد كلمة واحدة فقط.
`;

  try {

    const response =
      await ai.models.generateContent({

        model: AI_MODEL,

        contents: prompt,

        config: {
          temperature: 0,
          maxOutputTokens: 20
        }

      });

    let result =
      normalizeText(response.text || "");

    result =
      result
        .replace(/[`"'*]/g, "")
        .trim();

    if (INTENTS.includes(result)) {
      return result;
    }

    return "unknown";

  } catch (error) {

    console.error(
      "AI Router error:",
      error.message
    );

    return "unknown";
  }
}


// ======================================================
// FALLBACK
// إذا تعذر الوصول إلى Gemini
// ======================================================

function legacyRouter(message) {

  const text =
    normalizeText(message);

  if (!text) {
    return "greeting";
  }


  // تحية

  if (
    containsAny(text, [
      "مرحبا",
      "اهلا",
      "اهلين",
      "السلام عليكم",
      "سلام عليكم",
      "هاي",
      "هلا",
      "مسا الخير",
      "صباح الخير",
      "مساء الخير"
    ])
  ) {
    return "greeting";
  }


  // شكر

  if (
    containsAny(text, [
      "شكرا",
      "يسلمو",
      "مشكور",
      "مشكورين",
      "يعطيكم العافيه"
    ])
  ) {
    return "thanks";
  }


  // فروع

  if (
    containsAny(text, [
      "فرع",
      "فروع",
      "افرع",
      "أفرع",
      "مكتب تاني",
      "مكتب ثاني",
      "فرع تاني",
      "فرع ثاني"
    ])
  ) {
    return "branches";
  }


  // موقع

  if (
    containsAny(text, [
      "محلكن",
      "محلكم",
      "مكتبكن",
      "مكتبكم",
      "وين المحل",
      "وين المكتب",
      "عنوان",
      "العنوان",
      "العنون",
      "عنون",
      "عنوانكن",
      "عنوانكم",
      "موقعكن",
      "موقعكم",
      "الموقع",
      "لوكيشن"
    ])
  ) {
    return "location";
  }


  // دوام

  if (
    containsAny(text, [
      "فاتحين",
      "فاتح",
      "تفتحو",
      "تفتحوا",
      "مسكرين",
      "مسكر",
      "تسكرو",
      "تسكروا",
      "بتسكرو",
      "دوام"
    ])
  ) {
    return "working_hours";
  }


  // أسعار

  if (
    containsAny(text, [
      "سعر الدولار",
      "سعر اليورو",
      "سعر التركي",
      "سعر الصرف",
      "اسعار الصرف",
      "الدولار اليوم",
      "اليورو اليوم",
      "التركي اليوم",
      "قديش الدولار",
      "قديش اليورو",
      "قديش التركي",
      "بكم الدولار",
      "بكم اليورو",
      "بكم التركي"
    ])
  ) {
    return "rates";
  }


  // حوالة

  if (
    containsAny(text, [
      "حواله باسمي",
      "حوالة باسمي",
      "وصلت الحواله",
      "وصلت الحوالة",
      "وين الحواله",
      "وين الحوالة",
      "استلام حواله",
      "استلام حوالة",
      "بدي استلم حواله",
      "بدي استلم حوالة"
    ])
  ) {
    return "transfer_check";
  }


  // وثائق

  if (
    containsAny(text, [
      "شو بدي جيب",
      "شو لازم جيب",
      "شو لازم معي",
      "الاوراق",
      "الأوراق",
      "وثيقه",
      "وثيقة",
      "هويه",
      "هوية",
      "جواز",
      "اخراج قيد",
      "إخراج قيد"
    ])
  ) {
    return "documents";
  }


  // شام كاش

  if (
    containsAny(text, [
      "شام كاش",
      "شامكاش",
      "sham cash"
    ])
  ) {
    return "sham_cash";
  }


  // شخص آخر

  if (
    containsAny(text, [
      "حدا يستلم عني",
      "شخص يستلم عني",
      "اخي يستلم",
      "اخوي يستلم",
      "زوجتي تستلم",
      "زوجي يستلم",
      "حدا غيري يستلم",
      "غيري يستلم"
    ])
  ) {
    return "receiver_change";
  }


  // لاحقاً

  if (
    containsAny(text, [
      "بكرا استلم",
      "باجر استلم",
      "يوم تاني",
      "يوم ثاني",
      "استلمها بعدين",
      "استلمها يوم اخر",
      "استلمها يوم آخر",
      "بدي اجي بعدين"
    ])
  ) {
    return "later_collection";
  }


  // شكوى

  if (
    containsAny(text, [
      "شكوى",
      "شكايه",
      "مشكله",
      "مشكلة",
      "الاداره",
      "الإدارة",
      "المدير",
      "بدي اشتكي"
    ])
  ) {
    return "complaint";
  }


  return "unknown";
}


// ======================================================
// الرد الرسمي حسب النية
// ======================================================

function replyForIntent(intent) {

  switch (intent) {

    case "greeting":

      return {
        reply:
          "أهلاً وسهلاً بك 🌹 كيف يمكنني مساعدتك؟",
        type: "greeting"
      };


    case "thanks":

      return {
        reply:
          "العفو 🌹 أهلاً وسهلاً بك دائماً.",
        type: "thanks"
      };


    case "location":

      return {
        reply:
          "📍 موقع مكتب الشعار:\n" +
          COMPANY.address +
          "\n\n🗺️ الخريطة:\n" +
          COMPANY.map,
        type: "location"
      };


    case "branches":

      return {
        reply:
          "🏢 أفرع شركة الاتحاد:\n\n" +
          "1- " +
          COMPANY.branches[0] +
          "\n" +
          "2- " +
          COMPANY.branches[1] +
          "\n\n" +
          COMPANY.mainBranch,
        type: "branches"
      };


    case "working_hours":

      return {
        reply:
          "⏱️ " +
          SPECIAL_HOLIDAY.text +
          "\n\n" +
          "الدوام المعتاد: " +
          COMPANY.workingHours +
          "\n" +
          COMPANY.holiday,
        type: "working_hours"
      };


    case "rates":

      return {
        reply:
          "💰 لمعرفة أسعار الصرف الحالية، يمكنك متابعة قنوات الأسعار الرسمية لشركة الاتحاد:\n\n" +
          "Telegram:\n" +
          COMPANY.telegram +
          "\n\n" +
          "WhatsApp:\n" +
          COMPANY.whatsapp,
        type: "rates"
      };


    case "transfer_check":

      return {
        reply:
          "📋 يرجى إرسال إشعار الحوالة، وسيقوم القسم المختص بالتحقق منه والرد عليك بأسرع وقت.",
        type: "transfer_check"
      };


    case "transfer_notice":

      return {
        reply:
          "📋 تم استلام المعلومات، وسيقوم القسم المختص بالتحقق منها والرد عليك بأسرع وقت.",
        type: "transfer_notice"
      };


    case "documents":

      return {
        reply:
          "🪪 لاستلام الحوالة يجب إبراز إحدى الوثائق الأصلية التالية حصراً:\n\n" +
          "• الهوية الشخصية الأصلية.\n" +
          "• جواز السفر الأصلي.\n" +
          "• إخراج القيد الأصلي.\n\n" +
          "⚠️ صور الوثائق على الهاتف غير مقبولة نهائياً.",
        type: "documents"
      };


    case "sham_cash":

      return {
        reply:
          "نعتذر منك 🌹 لا يوجد لدينا تعامل أو تسليم حوالات عن طريق شام كاش.",
        type: "sham_cash"
      };


    case "receiver_change":

      return {
        reply:
          "📋 تسليم الحوالة يكون باليد لصاحب العلاقة حصراً.\n\n" +
          "إذا كنت لا تستطيع الحضور، يمكنك الاستفسار عن إمكانية تعديل اسم الحوالة إلى شخص آخر يستطيع الحضور والاستلام، ويجب أن يكون التعديل على اسم الشخص الذي سيحضر ويستلم.",
        type: "receiver_change"
      };


    case "later_collection":

      return {
        reply:
          "📋 تبقى الحوالة موجودة حتى يأتي صاحب العلاقة ليستلمها، أو يمكن للمرسل استعادة المبلغ.",
        type: "later_collection"
      };


    case "complaint":

      return {
        reply:
          "🌹 أكيد، اشرح لنا المشكلة بالتفصيل كتابةً، ليتم رفعها ومتابعتها مع المختص.",
        type: "complaint"
      };


    case "voice":

      return {
        reply:
          "🌹 عذراً، يرجى كتابة استفسارك نصياً حتى أتمكن من مساعدتك.",
        type: "voice"
      };


    default:

      return {
        reply:
          "🌹 أهلاً بك.\nيرجى توضيح استفسارك أكثر حتى نتمكن من مساعدتك.",
        type: "unknown"
      };
  }
}


// ======================================================
// المحرك الرئيسي
// ======================================================

async function generateReply(message) {

  let intent =
    await aiRouter(message);

  console.log(
    "AI Router:",
    message,
    "=>",
    intent
  );


  // إذا فشل AI
  if (intent === "unknown") {

    const fallback =
      legacyRouter(message);

    if (fallback !== "unknown") {
      intent = fallback;
    }
  }


  return replyForIntent(intent);
}


// ======================================================
// صفحة اختبار AI
// الصلاحيات غير مرتبطة بها
// ======================================================

app.get("/", (req, res) => {

  res.send(`
<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1">

<title>مساعد شركة الاتحاد</title>

<style>

body {
  font-family: Arial, sans-serif;
  background: #f3f4f6;
  margin: 0;
  padding: 20px;
}

.container {
  max-width: 650px;
  margin: auto;
}

.card {
  background: white;
  padding: 22px;
  border-radius: 16px;
  box-shadow: 0 4px 18px rgba(0,0,0,.08);
}

h1 {
  margin-top: 0;
}

textarea,
button {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  margin-top: 10px;
  border-radius: 8px;
  border: 1px solid #ccc;
  font-size: 16px;
}

textarea {
  min-height: 120px;
}

button {
  background: #222;
  color: white;
  border: none;
  cursor: pointer;
}

button:hover {
  opacity: .9;
}

#result {
  display: none;
  margin-top: 20px;
  padding: 15px;
  border-radius: 10px;
  white-space: pre-wrap;
  line-height: 1.7;
}

.reply {
  background: #eef4ff;
}

.error {
  background: #ffe0e0;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<h1>🤖 مساعد شركة الاتحاد</h1>

<p>
اختبار فهم الذكاء الاصطناعي
</p>

<textarea
id="message"
placeholder="مثال: وين مكتبكن؟"
></textarea>

<button onclick="testBot()">
🤖 اختبار AI
</button>

<div id="result"></div>

</div>

</div>

<script>

async function testBot() {

  const message =
    document.getElementById("message").value.trim();

  const result =
    document.getElementById("result");


  if (!message) {

    result.style.display = "block";

    result.className = "error";

    result.innerText =
      "❌ اكتب رسالة العميل أولاً.";

    return;
  }


  result.style.display = "block";

  result.className = "reply";

  result.innerText =
    "⏳ جاري فهم الرسالة...";


  try {

    const response =
      await fetch("/test-message", {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          message
        })

      });


    const data =
      await response.json();


    if (!data.success) {

      result.className = "error";

      result.innerText =
        "❌ " +
        (data.error || "حدث خطأ");

      return;
    }


    result.className = "reply";

    result.innerText =
      "🤖 النية: " +
      data.type +
      "\\n\\n" +
      "💬 الرد:\\n\\n" +
      data.reply;

  }

  catch (error) {

    result.className = "error";

    result.innerText =
      "❌ تعذر الاتصال بالسيرفر.";

  }

}

</script>

</body>

</html>
  `);

});


// ======================================================
// API اختبار AI
// ======================================================

app.post("/test-message", async (req, res) => {

  try {

    const message =
      String(req.body.message || "").trim();


    if (!message) {

      return res.status(400).json({

        success: false,

        error: "الرسالة فارغة"

      });

    }


    const result =
      await generateReply(message);


    return res.json({

      success: true,

      reply: result.reply,

      type: result.type

    });

  }

  catch (error) {

    console.error(
      "Test message error:",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        "حدث خطأ أثناء معالجة الرسالة."

    });

  }

});


// ======================================================
// اختبار الصلاحيات
// مستقل عن AI
// ======================================================

app.post("/test-permission", (req, res) => {

  const chatType =
    req.body.chatType;

  const chatId =
    String(req.body.chatId || "");


  if (!chatId) {

    return res.json({

      allowed: false,

      reason:
        "المعرّف فارغ"

    });

  }


  if (chatType === "user") {

    const allowed =
      isAllowedUser(chatId);


    return res.json({

      allowed,

      reason:
        allowed
          ? "الشخص موجود ضمن قائمة المسموح لهم"
          : "الشخص غير موجود ضمن قائمة المسموح لهم"

    });

  }


  if (chatType === "group") {

    const allowed =
      isAllowedGroup(chatId);


    return res.json({

      allowed,

      reason:
        allowed
          ? "المجموعة موجودة ضمن قائمة المسموح بها"
          : "المجموعة غير موجودة ضمن قائمة المسموح بها"

    });

  }


  return res.json({

    allowed: false,

    reason:
      "نوع المحادثة غير معروف"

  });

});


// ======================================================
// STATUS
// ======================================================

app.get("/status", (req, res) => {

  const users =
    config.permissions &&
    Array.isArray(config.permissions.allowedUsers)
      ? config.permissions.allowedUsers.length
      : 0;


  const groups =
    config.permissions &&
    Array.isArray(config.permissions.allowedGroups)
      ? config.permissions.allowedGroups.length
      : 0;


  res.json({

    status: "online",

    bot:
      config.bot
        ? config.bot.name
        : "مساعد شركة الاتحاد",

    enabled:
      config.bot
        ? config.bot.enabled
        : true,

    aiRouter:
      ai
        ? "enabled"
        : "disabled",

    model:
      ai
        ? AI_MODEL
        : null,

    company:
      COMPANY.name,

    branch:
      "مكتب الشعار",

    workingHours:
      COMPANY.workingHours,

    holiday:
      COMPANY.holiday,

    allowedUsers:
      users,

    allowedGroups:
      groups

  });

});


// ======================================================
// تشغيل السيرفر
// ======================================================

app.listen(PORT, () => {

  console.log(
    "Server running on port " + PORT
  );

  console.log(
    "Gemini AI Router:",
    ai
      ? "ENABLED"
      : "DISABLED"
  );

});
