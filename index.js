const express = require("express");
const config = require("./config.json");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// GEMINI AI
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
// عطلة 25 آب 2026
// ======================================================

const SPECIAL_HOLIDAY = {
  date: "2026-08-25",

  text:
    "اليوم الثلاثاء 25 آب 2026 عطلة رسمية بمناسبة عيد المولد النبوي الشريف ﷺ، وسيُستأنف العمل يوم الأربعاء 26 آب 2026 ضمن ساعات الدوام المعتادة."
};


// ======================================================
// تطبيع النص
// ======================================================

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[؟?!،,.]/g, " ")
    .replace(/\s+/g, " ");
}


function containsAny(text, words) {
  return words.some(word => text.includes(normalizeText(word)));
}


// ======================================================
// الصلاحيات
// مستقلة تماماً عن AI
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
//
// وظيفته تحديد نوع السؤال فقط.
// لا يسمح له باختراع جواب.
// ======================================================

async function aiRouter(message) {

  if (!ai) {
    return "unknown";
  }

  const prompt = `
أنت Router فقط لخدمة عملاء شركة الاتحاد للصرافة والحوالات.

مهمتك الوحيدة:
اقرأ رسالة العميل وحدد النية المناسبة من القائمة التالية.

أعد كلمة واحدة فقط من القائمة، بدون شرح وبدون علامات ترقيم.

النيات:

greeting
= تحية

thanks
= شكر

location
= سؤال عن موقع المكتب أو العنوان

branches
= سؤال عن الفروع أو وجود فرع آخر

working_hours
= سؤال عن الدوام أو هل المكتب مفتوح أو مغلق

rates
= سؤال عن سعر الصرف أو الدولار أو اليورو أو التركي

transfer_check
= سؤال عن وجود حوالة أو وصول حوالة أو استلام حوالة باسمه

transfer_notice
= رسالة تحتوي معلومات أو إشعار حوالة

documents
= سؤال عن الوثائق المطلوبة لاستلام الحوالة

sham_cash
= سؤال عن شام كاش

receiver_change
= سؤال عن شخص آخر يستلم الحوالة أو تغيير اسم المستفيد

later_collection
= سؤال عن استلام الحوالة في يوم آخر أو لاحقاً

complaint
= شكوى أو مشكلة أو طلب الإدارة

voice
= رسالة صوتية أو طلب متعلق برسالة صوتية

unknown
= إذا لم تستطع تحديد النية

أمثلة مهمة:

"عنكن فرع تاني؟"
branches

"في فرع غير هاد؟"
branches

"إلكن مكاتب غير الشعار؟"
branches

"وين فروعكن؟"
branches

"وين محلكن؟"
location

"وين موجودين؟"
location

"بدي عنوانكم"
location

"قديش الدولار اليوم؟"
rates

"الحوالة وصلت؟"
transfer_check

"في حوالة باسمي؟"
transfer_check

"شو لازم جيب معي؟"
documents

"فيني ابعت حدا يستلم عني؟"
receiver_change

"بقدر اجي استلمها بكرا؟"
later_collection

"عندكن شام كاش؟"
sham_cash

رسالة العميل:
${message}
`;

  try {

    const response = await ai.models.generateContent({

      model: AI_MODEL,

      contents: prompt,

      config: {
        temperature: 0,
        maxOutputTokens: 20
      }

    });

    const result = normalizeText(response.text || "");

    const allowedIntents = [
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

    if (allowedIntents.includes(result)) {
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
// الردود الثابتة
// ======================================================

function replyForIntent(intent, message) {

  const text = normalizeText(message);

  switch (intent) {

    // --------------------------------------------------
    // تحية
    // --------------------------------------------------

    case "greeting":

      return {
        reply:
          "أهلاً وسهلاً بك 🌹 كيف يمكنني مساعدتك؟",
        type: "greeting"
      };


    // --------------------------------------------------
    // شكر
    // --------------------------------------------------

    case "thanks":

      return {
        reply:
          "العفو 🌹 أهلاً وسهلاً بك دائماً.",
        type: "thanks"
      };


    // --------------------------------------------------
    // الموقع
    // --------------------------------------------------

    case "location":

      return {
        reply:
          "📍 موقع مكتب الشعار:\n" +
          COMPANY.address +
          "\n\n🗺️ الخريطة:\n" +
          COMPANY.map,
        type: "location"
      };


    // --------------------------------------------------
    // الفروع
    // --------------------------------------------------

    case "branches":

      return {
        reply:
          "🏢 أفرع شركة الاتحاد:\n\n" +
          "1- " + COMPANY.branches[0] + "\n" +
          "2- " + COMPANY.branches[1] + "\n\n" +
          COMPANY.mainBranch,
        type: "branches"
      };


    // --------------------------------------------------
    // الدوام
    // --------------------------------------------------

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


    // --------------------------------------------------
    // أسعار الصرف
    // --------------------------------------------------

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


    // --------------------------------------------------
    // استعلام حوالة
    // --------------------------------------------------

    case "transfer_check":

      return {
        reply:
          "📋 يرجى إرسال إشعار الحوالة، وسيقوم القسم المختص بالتحقق منه والرد عليك بأسرع وقت.",
        type: "transfer_check"
      };


    // --------------------------------------------------
    // إشعار حوالة
    // --------------------------------------------------

    case "transfer_notice":

      return {
        reply:
          "📋 تم استلام المعلومات، وسيقوم القسم المختص بالتحقق منها والرد عليك بأسرع وقت.",
        type: "transfer_notice"
      };


    // --------------------------------------------------
    // الوثائق
    // --------------------------------------------------

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


    // --------------------------------------------------
    // شام كاش
    // --------------------------------------------------

    case "sham_cash":

      return {
        reply:
          "نعتذر منك 🌹 لا يوجد لدينا تعامل أو تسليم حوالات عن طريق شام كاش.",
        type: "sham_cash"
      };


    // --------------------------------------------------
    // تغيير اسم المستفيد
    // --------------------------------------------------

    case "receiver_change":

      return {
        reply:
          "📋 تسليم الحوالة يكون باليد لصاحب العلاقة حصراً.\n\n" +
          "إذا كنت لا تستطيع الحضور، يمكنك الاستفسار عن إمكانية تعديل اسم الحوالة إلى شخص آخر يستطيع الحضور والاستلام، ويجب أن يكون التعديل على اسم الشخص الذي سيحضر ويستلم.",
        type: "receiver_change"
      };


    // --------------------------------------------------
    // الاستلام لاحقاً
    // --------------------------------------------------

    case "later_collection":

      return {
        reply:
          "📋 تبقى الحوالة موجودة حتى يأتي صاحب العلاقة ليستلمها، أو يمكن للمرسل استعادة المبلغ.",
        type: "later_collection"
      };


    // --------------------------------------------------
    // شكوى
    // --------------------------------------------------

    case "complaint":

      return {
        reply:
          "🌹 أكيد، اشرح لنا المشكلة بالتفصيل كتابةً، ليتم رفعها ومتابعتها مع المختص.",
        type: "complaint"
      };


    // --------------------------------------------------
    // رسالة صوتية
    // --------------------------------------------------

    case "voice":

      return {
        reply:
          "🌹 عذراً، يرجى كتابة استفسارك نصياً حتى أتمكن من مساعدتك.",
        type: "voice"
      };


    // --------------------------------------------------
    // غير معروف
    // --------------------------------------------------

    default:

      return {
        reply:
          "🌹 أهلاً بك.\nيرجى توضيح استفسارك أكثر حتى نتمكن من مساعدتك.",
        type: "unknown"
      };
  }
}


// ======================================================
// النظام القديم كـ FALLBACK
// إذا فشل Gemini نستخدم الكلمات القديمة
// ======================================================

function legacyRouter(message) {

  const text = normalizeText(message);

  if (!text) return "greeting";

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
  ) return "greeting";


  if (
    containsAny(text, [
      "شكرا",
      "شكراً",
      "يسلمو",
      "مشكور",
      "مشكورين"
    ])
  ) return "thanks";


  if (
    containsAny(text, [
      "فرع",
      "فروع",
      "افرع",
      "أفرع",
      "مكتب تاني",
      "مكتب ثاني"
    ])
  ) return "branches";


  if (
    containsAny(text, [
      "محلكن",
      "وين المحل",
      "وين المكتب",
      "عنوان",
      "العنوان",
      "العنون",
      "عنون",
      "موقعكن",
      "الموقع"
    ])
  ) return "location";


  if (
    containsAny(text, [
      "فاتحين",
      "تفتحو",
      "مسكرين",
      "تسكرو",
      "بتسكرو",
      "دوام"
    ])
  ) return "working_hours";


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
      "قديش التركي"
    ])
  ) return "rates";


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
  ) return "transfer_check";


  if (
    containsAny(text, [
      "اشعار حواله",
      "اشعار حوالة",
      "رقم الحواله",
      "رقم الحوالة",
      "#000",
      "شركة الاتحاد"
    ])
  ) return "transfer_notice";


  if (
    containsAny(text, [
      "شو بدي جيب",
      "شو لازم جيب",
      "شو لازم معي",
      "الاوراق",
      "وثيقه",
      "وثيقة",
      "هويه",
      "هوية",
      "جواز",
      "اخراج قيد",
      "صوره الهويه"
    ])
  ) return "documents";


  if (
    containsAny(text, [
      "شام كاش",
      "شامكاش",
      "sham cash"
    ])
  ) return "sham_cash";


  if (
    containsAny(text, [
      "حدا يستلم عني",
      "شخص يستلم عني",
      "اخي يستلم",
      "اخوي يستلم",
      "زوجتي تستلم",
      "زوجي يستلم",
      "ابي يستلم",
      "ابوي يستلم",
      "امي تستلم",
      "حدا غيري يستلم",
      "غيري يستلم"
    ])
  ) return "receiver_change";


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
  ) return "later_collection";


  if (
    containsAny(text, [
      "شكوى",
      "مشكله",
      "مشكلة",
      "الاداره",
      "الإدارة",
      "المدير",
      "بدي اشتكي"
    ])
  ) return "complaint";


  return "unknown";
}


// ======================================================
// AI + FALLBACK
// ======================================================

async function generateReply(message) {

  let intent = await aiRouter(message);

  console.log(
    "AI Router:",
    message,
    "=>",
    intent
  );

  // إذا AI لم يفهم، نستخدم النظام القديم
  if (intent === "unknown") {

    const oldIntent =
      legacyRouter(message);

    if (oldIntent !== "unknown") {
      intent = oldIntent;
    }
  }

  return replyForIntent(
    intent,
    message
  );
}


// ======================================================
// الصفحة الرئيسية - صفحة الاختبار
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

<label>
رسالة العميل
</label>

<textarea
id="message"
placeholder="مثال: عنكن فرع تاني؟"
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
    "⏳ جاري تحليل الرسالة...";

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

  } catch (error) {

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
// اختبار AI
//
// لا يحتاج معرف.
// لا علاقة له بالصلاحيات.
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

  } catch (error) {

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
// اختبار الصلاحيات - منفصل عن AI
// ======================================================

app.post("/test-permission", (req, res) => {

  const chatType =
    req.body.chatType;

  const chatId =
    String(req.body.chatId || "");

  if (!chatId) {

    return res.json({
      allowed: false,
      reason: "المعرّف فارغ"
    });

  }

  if (chatType === "user") {

    const allowed =
      isAllowedUser(chatId);

    return res.json({

      allowed,

      reason: allowed
        ? "الشخص موجود ضمن قائمة المسموح لهم"
        : "الشخص غير موجود ضمن قائمة المسموح لهم"

    });

  }

  if (chatType === "group") {

    const allowed =
      isAllowedGroup(chatId);

    return res.json({

      allowed,

      reason: allowed
        ? "المجموعة موجودة ضمن قائمة المسموح بها"
        : "المجموعة غير موجودة ضمن قائمة المسموح بها"

    });

  }

  return res.json({

    allowed: false,

    reason: "نوع المحادثة غير معروف"

  });

});


// ======================================================
// الحالة
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
      ai ? "enabled" : "disabled",

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
    ai ? "ENABLED" : "DISABLED"
  );

});
