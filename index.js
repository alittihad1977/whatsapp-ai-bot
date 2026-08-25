const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const config = require("./config.json");

const app = express();
const PORT = process.env.PORT || 3000;

// ======================================================
// إعداد Express
// ======================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// Gemini
// ======================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let ai = null;

if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY
  });

  console.log("Gemini AI: enabled");
} else {
  console.log("Gemini AI: disabled - GEMINI_API_KEY not found");
}

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
// تطبيع النص
// ======================================================

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

// ======================================================
// الصلاحيات
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
// ردود الشركة الثابتة
// ======================================================

function getTodayDate() {
  // تاريخ الخادم في Render
  return new Date().toISOString().slice(0, 10);
}

function buildReply(type) {

  switch (type) {

    // --------------------------------------------------
    // تحية
    // --------------------------------------------------

    case "greeting":

      return {
        reply:
          "أهلاً وسهلاً بك 🌹 كيف يمكنني مساعدتك؟",
        type
      };


    // --------------------------------------------------
    // شكر
    // --------------------------------------------------

    case "thanks":

      return {
        reply:
          "العفو 🌹 أهلاً وسهلاً بك دائماً.",
        type
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
        type
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
        type
      };


    // --------------------------------------------------
    // الدوام
    // --------------------------------------------------

    case "working_hours":

      if (getTodayDate() === SPECIAL_HOLIDAY.date) {

        return {
          reply:
            "⏱️ " + SPECIAL_HOLIDAY.text,
          type: "special_holiday"
        };

      }

      return {
        reply:
          "⏱️ الدوام من 10 صباحاً حتى 6 مساءً.\n" +
          "والجمعة عطلة رسمية.",
        type
      };


    // --------------------------------------------------
    // الأسعار
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
        type
      };


    // --------------------------------------------------
    // استعلام حوالة
    // --------------------------------------------------

    case "transfer_check":

      return {
        reply:
          "📋 يرجى إرسال إشعار الحوالة، وسيقوم القسم المختص بالتحقق منه والرد عليك بأسرع وقت.",
        type
      };


    // --------------------------------------------------
    // إشعار حوالة
    // --------------------------------------------------

    case "transfer_notice":

      return {
        reply:
          "📋 تم استلام المعلومات، وسيقوم القسم المختص بالتحقق منها والرد عليك بأسرع وقت.",
        type
      };


    // --------------------------------------------------
    // وثائق
    // --------------------------------------------------

    case "documents":

      return {
        reply:
          "🪪 لاستلام الحوالة يجب إبراز إحدى الوثائق الأصلية التالية حصراً:\n\n" +
          "• الهوية الشخصية الأصلية.\n" +
          "• جواز السفر الأصلي.\n" +
          "• إخراج القيد الأصلي.\n\n" +
          "⚠️ صور الوثائق على الهاتف غير مقبولة نهائياً.",
        type
      };


    // --------------------------------------------------
    // شام كاش
    // --------------------------------------------------

    case "sham_cash":

      return {
        reply:
          "نعتذر منك 🌹 لا يوجد لدينا تعامل أو تسليم حوالات عن طريق شام كاش.",
        type
      };


    // --------------------------------------------------
    // تغيير اسم المستفيد
    // --------------------------------------------------

    case "receiver_change":

      return {
        reply:
          "📋 تسليم الحوالة يكون باليد لصاحب العلاقة حصراً.\n\n" +
          "إذا كنت لا تستطيع الحضور، يمكنك الاستفسار عن إمكانية تعديل اسم الحوالة إلى شخص آخر يستطيع الحضور والاستلام، ويجب أن يكون التعديل على اسم الشخص الذي سيحضر ويستلم.",
        type
      };


    // --------------------------------------------------
    // الاستلام لاحقاً
    // --------------------------------------------------

    case "later_collection":

      return {
        reply:
          "📋 تبقى الحوالة موجودة حتى يأتي صاحب العلاقة ليستلمها، أو يمكن للمرسل استعادة المبلغ.",
        type
      };


    // --------------------------------------------------
    // شكوى
    // --------------------------------------------------

    case "complaint":

      return {
        reply:
          "🌹 أكيد، اشرح لنا المشكلة بالتفصيل كتابةً، ليتم رفعها ومتابعتها مع المختص.",
        type
      };


    // --------------------------------------------------
    // رسالة صوتية
    // --------------------------------------------------

    case "voice":

      return {
        reply:
          "🌹 عذراً، يرجى كتابة استفسارك نصياً حتى أتمكن من مساعدتك.",
        type
      };


    // --------------------------------------------------
    // غير معروف
    // --------------------------------------------------

    default:

      return {
        reply:
          "🌹 أهلاً بك. يرجى توضيح استفسارك أكثر حتى نتمكن من مساعدتك.",
        type: "unknown"
      };
  }
}

// ======================================================
// AI ROUTER
// ======================================================

async function aiRouter(message) {

  const text = String(message || "").trim();

  if (!text) {
    return {
      type: "greeting",
      confidence: 1
    };
  }

  // ----------------------------------------------------
  // إذا Gemini غير موجود
  // نستخدم Router احتياطي بسيط
  // ----------------------------------------------------

  if (!ai) {
    return fallbackRouter(text);
  }

  const prompt = `
أنت Router ذكي لخدمة عملاء شركة صرافة وحوالات سورية.

مهمتك الوحيدة هي فهم رسالة العميل وتحديد نوع الطلب.

لا تجب على العميل.
لا تخترع معلومات.
لا تعطِ أسعاراً.
لا تشرح.
أعد JSON فقط.

أنواع الطلبات المسموحة:

greeting
= تحية أو سلام.

thanks
= شكر أو مديح.

location
= سؤال عن موقع المكتب أو العنوان أو "وين مكتبكن" أو "وين محلكن" أو "وين مكانكن" أو "عنونكم وين" أو أي صيغة عامية تسأل عن مكان المكتب.

branches
= سؤال عن وجود فروع أخرى، مثل:
"في فرع تاني؟"
"عندكن فرع غير هاد؟"
"وين فروعكن؟"
"في مكاتب تانية؟"

working_hours
= سؤال عن الدوام أو فتح وإغلاق المكتب.

rates
= سؤال عن سعر الدولار أو اليورو أو التركي أو أسعار الصرف.

transfer_check
= سؤال عن حوالة باسمه أو هل وصلت الحوالة أو يريد التأكد من حوالة.

transfer_notice
= رسالة تحتوي بوضوح على إشعار حوالة أو بيانات حوالة أو رقم حوالة.

documents
= سؤال عن الهوية أو الجواز أو إخراج القيد أو الأوراق المطلوبة لاستلام الحوالة.

sham_cash
= سؤال عن شام كاش.

receiver_change
= يريد شخص آخر استلام الحوالة عنه أو يريد تغيير اسم المستفيد.

later_collection
= سؤال عن استلام الحوالة في يوم آخر أو لاحقاً.

complaint
= شكوى أو مشكلة أو يريد الإدارة.

voice
= رسالة صوتية أو طلب يتعلق برسالة صوتية.

unknown
= لا ينتمي لأي نوع واضح.

قواعد مهمة:

- افهم اللهجة السورية.
- افهم الأخطاء الإملائية.
- افهم الاختصارات.
- "وين مكتبكن" = location.
- "وين محلكن" = location.
- "وين محلكم" = location.
- "وين عنوانكن" = location.
- "في عندكن محل تاني" = branches.
- "عندكن فرع غير الشعار" = branches.
- إذا احتوت الرسالة على أكثر من طلب، اختر النوع الأهم والأوضح.
- إذا سأل عن السعر، اختر rates.
- إذا سأل عن حوالة، اختر transfer_check.
- لا تعتبر كلمة "شركة الاتحاد" وحدها إشعار حوالة.
- لا تعتبر أي رقم عادي إشعار حوالة.

أعد الشكل التالي فقط:

{
  "type": "location",
  "confidence": 0.98
}

رسالة العميل:
${text}
`;

  try {

    const response = await ai.models.generateContent({

      model: "gemini-2.5-flash",

      contents: prompt,

      config: {
        temperature: 0,
        responseMimeType: "application/json"
      }

    });

    const raw =
      response.text || "";

    const clean =
      raw
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    const result =
      JSON.parse(clean);

    const allowedTypes = [
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

    if (!allowedTypes.includes(result.type)) {

      return {
        type: "unknown",
        confidence: 0
      };

    }

    return {
      type: result.type,
      confidence:
        Number(result.confidence) || 0
    };

  } catch (error) {

    console.log(
      "Gemini Router error:",
      error.message
    );

    return fallbackRouter(text);
  }
}

// ======================================================
// Router احتياطي
// يستخدم فقط إذا Gemini غير متاح
// ======================================================

function fallbackRouter(message) {

  const text = normalizeText(message);

  if (
    /مرحبا|اهلا|اهلين|السلام عليكم|سلام عليكم|هلا|هاي|صباح الخير|مسا الخير|مساء الخير/
      .test(text)
  ) {
    return {
      type: "greeting",
      confidence: 0.8
    };
  }

  if (
    /شكرا|مشكور|يسلمو|يعطيكم العافيه|يعطيكم العافية/
      .test(text)
  ) {
    return {
      type: "thanks",
      confidence: 0.8
    };
  }

  if (
    /وين.*(مكتب|محل|عنوان|مكان)|مكتب.*وين|محل.*وين|عنوان.*وين|وينكن|موقعكن|العنوان|العنون|عنون/
      .test(text)
  ) {
    return {
      type: "location",
      confidence: 0.9
    };
  }

  if (
    /فرع|فروع|افرع|أفرع|مكتب تاني|محل تاني|غير الشعار/
      .test(text)
  ) {
    return {
      type: "branches",
      confidence: 0.9
    };
  }

  if (
    /دوام|فاتحين|فاتح|تفتحو|تفتحوا|متى تفتح|امتا تفتحو|مسكر|مسكرين|تسكرو|تسكروا|بتسكرو/
      .test(text)
  ) {
    return {
      type: "working_hours",
      confidence: 0.9
    };
  }

  if (
    /سعر|اسعار|أسعار|صرف|دولار|يورو|تركي|الليرة|قديش|كم/
      .test(text)
  ) {
    return {
      type: "rates",
      confidence: 0.8
    };
  }

  if (
    /حواله|حوالة|حوالتي|وصلت.*حوال|حوال.*وصلت|استلم حوال|استلام حوال/
      .test(text)
  ) {
    return {
      type: "transfer_check",
      confidence: 0.85
    };
  }

  if (
    /هوية|هويه|جواز|اخراج قيد|إخراج قيد|اوراق|أوراق|وثيقه|وثيقة/
      .test(text)
  ) {
    return {
      type: "documents",
      confidence: 0.85
    };
  }

  if (/شام كاش|شامكاش|sham cash/.test(text)) {
    return {
      type: "sham_cash",
      confidence: 0.95
    };
  }

  if (
    /حدا يستلم عني|شخص يستلم عني|غيري يستلم|اخي يستلم|زوجتي تستلم|زوجي يستلم/
      .test(text)
  ) {
    return {
      type: "receiver_change",
      confidence: 0.85
    };
  }

  if (
    /شكوى|شكايه|شكاية|مشكله|مشكلة|الاداره|الإدارة|المدير/
      .test(text)
  ) {
    return {
      type: "complaint",
      confidence: 0.9
    };
  }

  return {
    type: "unknown",
    confidence: 0.2
  };
}

// ======================================================
// الوظيفة الرئيسية للـAI
// ======================================================

async function generateAIReply(message) {

  const route =
    await aiRouter(message);

  const result =
    buildReply(route.type);

  return {
    ...result,
    confidence: route.confidence
  };
}

// ======================================================
// الصفحة الرئيسية
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

* {
  box-sizing: border-box;
}

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

.status {
  padding: 10px;
  border-radius: 8px;
  background: #e8f5e9;
  color: #176b2c;
  margin-bottom: 15px;
}

label {
  display: block;
  margin-top: 15px;
  font-weight: bold;
}

textarea,
button {
  width: 100%;
  padding: 13px;
  margin-top: 8px;
  border-radius: 8px;
  border: 1px solid #ccc;
  font-size: 16px;
}

textarea {
  min-height: 120px;
  resize: vertical;
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
  line-height: 1.8;
  white-space: pre-wrap;
}

.reply {
  background: #eef4ff;
  color: #173b72;
}

.error {
  background: #ffe0e0;
  color: #9b1c1c;
}

.type {
  margin-top: 12px;
  font-size: 14px;
  color: #555;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<h1>🤖 مساعد شركة الاتحاد</h1>

<div class="status">
🟢 اختبار AI Router — الصلاحيات غير مطلوبة هنا
</div>

<label>
رسالة العميل
</label>

<textarea
id="message"
placeholder="مثال: وين مكتبكن؟"
></textarea>

<button onclick="testAI()">
🤖 اختبار فهم الذكاء الاصطناعي
</button>

<div id="result"></div>

</div>

</div>

<script>

async function testAI() {

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
    "⏳ جاري فهم رسالة العميل...";

  try {

    const response =
      await fetch("/test-ai", {

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

    if (!response.ok) {

      result.className = "error";

      result.innerText =
        "❌ " +
        (data.error || "حدث خطأ.");

      return;
    }

    result.className = "reply";

    result.innerText =
      "🤖 الرد المقترح:\\n\\n" +
      data.reply +
      "\\n\\n" +
      "📌 التصنيف: " +
      data.type +
      "\\n" +
      "🎯 نسبة الثقة: " +
      Math.round((data.confidence || 0) * 100) +
      "%";

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
// اختبار AI فقط
// لا يحتاج معرف ولا صلاحيات
// ======================================================

app.post("/test-ai", async (req, res) => {

  try {

    const message =
      String(req.body.message || "").trim();

    if (!message) {

      return res.status(400).json({
        error: "الرسالة فارغة"
      });

    }

    const result =
      await generateAIReply(message);

    res.json(result);

  } catch (error) {

    console.log(
      "Test AI error:",
      error.message
    );

    res.status(500).json({
      error: "حدث خطأ أثناء معالجة الرسالة."
    });

  }

});

// ======================================================
// اختبار رسالة مع الصلاحيات
// هذا منفصل عن AI
// ======================================================

app.post("/test-message", async (req, res) => {

  const chatType =
    req.body.chatType;

  const chatId =
    String(req.body.chatId || "");

  const message =
    String(req.body.message || "");

  let allowed = false;

  if (chatType === "user") {
    allowed = isAllowedUser(chatId);
  }

  if (chatType === "group") {
    allowed = isAllowedGroup(chatId);
  }

  if (!allowed) {

    return res.json({

      allowed: false,

      reason:
        "هذا الشخص أو المجموعة غير موجود ضمن قائمة المسموح لهم."

    });

  }

  const result =
    await generateAIReply(message);

  res.json({

    allowed: true,

    reply: result.reply,

    type: result.type,

    confidence: result.confidence

  });

});

// ======================================================
// اختبار الصلاحية
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
// حالة البوت
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
      groups,

    ai:
      ai
        ? "Gemini enabled"
        : "Gemini disabled"

  });

});

// ======================================================
// تشغيل السيرفر
// ======================================================

app.listen(PORT, () => {

  console.log(
    "Server running on port " + PORT
  );

});
