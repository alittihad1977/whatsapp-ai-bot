const express = require("express");
const config = require("./config.json");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
// عطلة المولد النبوي - مؤقتة
// ======================================================

const SPECIAL_HOLIDAY = {
  date: "2026-08-25",

  text:
    "اليوم الثلاثاء 25 آب 2026 عطلة رسمية بمناسبة عيد المولد النبوي الشريف ﷺ، وسيُستأنف العمل يوم الأربعاء 26 آب 2026 ضمن ساعات الدوام المعتادة."
};


// ======================================================
// أدوات مساعدة
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


function containsAny(text, words) {
  return words.some(word => text.includes(normalizeText(word)));
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
// الردود الثابتة
// ======================================================

function getReplyByIntent(intent) {

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
          "1- " +
          COMPANY.branches[0] +
          "\n" +
          "2- " +
          COMPANY.branches[1] +
          "\n\n" +
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
          SPECIAL_HOLIDAY.text,
        type: "special_holiday"
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
        type: "rates"
      };


    // --------------------------------------------------
    // استعلام عن حوالة
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
    // شخص آخر يستلم
    // --------------------------------------------------

    case "receiver_change":

      return {
        reply:
          "📋 تسليم الحوالة يكون باليد لصاحب العلاقة حصراً.\n\n" +
          "إذا كنت لا تستطيع الحضور، يمكنك الاستفسار عن إمكانية تعديل اسم الحوالة إلى شخص آخر يستطيع الحضور والاستلام، ويجب أن يكون التعديل على اسم الشخص الذي سيحضر ويستلم.",
        type: "receiver_change"
      };


    // --------------------------------------------------
    // استلام في يوم آخر
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
          "🌹 أهلاً بك.\n" +
          "يرجى توضيح استفسارك كتابةً حتى نتمكن من مساعدتك.",
        type: "unknown"
      };

  }
}


// ======================================================
// AI ROUTER - Gemini
// ======================================================

async function aiRouter(message) {

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {

    console.log("GEMINI_API_KEY غير موجود");

    return {
      intent: null,
      confidence: 0,
      source: "fallback"
    };

  }


  const prompt = `
أنت AI Router لخدمة عملاء شركة صرافة وحوالات.

مهمتك الوحيدة هي فهم رسالة العميل وتصنيفها.

ممنوع عليك الإجابة عن العميل.
ممنوع اختراع معلومات.
ممنوع إعطاء أسعار.
ممنوع إعطاء معلومات غير موجودة.

أعد JSON فقط بهذا الشكل:

{
  "intent": "اسم التصنيف",
  "confidence": 0.0
}

التصنيفات المسموحة فقط:

greeting
thanks
location
branches
working_hours
rates
transfer_check
transfer_notice
documents
sham_cash
receiver_change
later_collection
complaint
voice
unknown

أمثلة:

"مرحبا"
=> greeting

"عنكن فرع تاني؟"
=> branches

"في غير فرع الشعار؟"
=> branches

"وين فروعكم"
=> branches

"وين محلكن"
=> location

"وين مكتبكن"
=> location

"فاتحين اليوم؟"
=> working_hours

"امتى بتفتحو"
=> working_hours

"قديش الدولار"
=> rates

"شو سعر اليورو"
=> rates

"في حوالة باسمي؟"
=> transfer_check

"وصلتني الحوالة؟"
=> transfer_check

"شو لازم جيب معي لاستلم"
=> documents

"معي صورة هوية بتمشي؟"
=> documents

"بتتعاملوا بشام كاش؟"
=> sham_cash

"اخوي يستلم عني"
=> receiver_change

"بدي خلي شخص تاني يستلم"
=> receiver_change

"بقدر استلم الحوالة بكرا؟"
=> later_collection

"بدي اشتكي"
=> complaint

"عندي مشكلة مع الفرع"
=> complaint

رسالة العميل:

${message}
`;


  try {

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" +
        encodeURIComponent(apiKey),
      {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],

          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json"
          }

        })

      }
    );


    if (!response.ok) {

      const errorText =
        await response.text();

      console.log(
        "Gemini error:",
        response.status,
        errorText
      );

      return {
        intent: null,
        confidence: 0,
        source: "fallback"
      };

    }


    const data =
      await response.json();


    const text =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;


    if (!text) {

      return {
        intent: null,
        confidence: 0,
        source: "fallback"
      };

    }


    const parsed =
      JSON.parse(text);


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


    if (
      !allowedIntents.includes(
        parsed.intent
      )
    ) {

      return {
        intent: null,
        confidence: 0,
        source: "fallback"
      };

    }


    return {
      intent: parsed.intent,
      confidence:
        Number(parsed.confidence) || 0,
      source: "gemini"
    };

  }

  catch (error) {

    console.log(
      "Gemini Router Error:",
      error.message
    );

    return {
      intent: null,
      confidence: 0,
      source: "fallback"
    };

  }

}


// ======================================================
// النظام القديم كـ Fallback
// ======================================================

function fallbackRouter(message) {

  const text =
    normalizeText(message);


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


  if (
    containsAny(text, [
      "شكرا",
      "شكراً",
      "يسلمو",
      "مشكور",
      "مشكورين"
    ])
  ) {
    return "thanks";
  }


  if (
    containsAny(text, [
      "محلكن",
      "محلكم",
      "وين محلكن",
      "وين المكتب",
      "عنوان",
      "العنوان",
      "العنون",
      "عنون",
      "عنوانكن",
      "وينكن",
      "موقعكن",
      "الموقع"
    ])
  ) {
    return "location";
  }


  if (
    containsAny(text, [
      "فرع",
      "فروع",
      "فرعكن",
      "فروعكن",
      "فروعكم",
      "افرع",
      "أفرع"
    ])
  ) {
    return "branches";
  }


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


  if (
    containsAny(text, [
      "سعر",
      "اسعار",
      "أسعار",
      "صرف",
      "دولار",
      "يورو",
      "تركي"
    ])
  ) {
    return "rates";
  }


  if (
    containsAny(text, [
      "حواله",
      "حوالة",
      "وصلتني",
      "وصلت الحواله",
      "وصلت الحوالة"
    ])
  ) {
    return "transfer_check";
  }


  if (
    containsAny(text, [
      "هويه",
      "هوية",
      "جواز",
      "وثيقه",
      "وثيقة",
      "اخراج قيد",
      "إخراج قيد"
    ])
  ) {
    return "documents";
  }


  if (
    containsAny(text, [
      "شام كاش",
      "شامكاش",
      "sham cash"
    ])
  ) {
    return "sham_cash";
  }


  if (
    containsAny(text, [
      "يستلم عني",
      "غيري يستلم",
      "شخص يستلم"
    ])
  ) {
    return "receiver_change";
  }


  if (
    containsAny(text, [
      "بكرا استلم",
      "بعدین استلم",
      "بعدين استلم",
      "يوم تاني",
      "يوم ثاني"
    ])
  ) {
    return "later_collection";
  }


  if (
    containsAny(text, [
      "شكوى",
      "شكايه",
      "مشكله",
      "مشكلة",
      "اشتكي",
      "الاداره",
      "الإدارة"
    ])
  ) {
    return "complaint";
  }


  return "unknown";
}


// ======================================================
// توليد الرد النهائي
// ======================================================

async function generateReply(message) {

  // أولاً نجرب AI
  const ai =
    await aiRouter(message);


  if (
    ai.intent &&
    ai.confidence >= 0.55
  ) {

    const result =
      getReplyByIntent(ai.intent);


    return {
      ...result,
      router: "gemini",
      confidence: ai.confidence
    };

  }


  // إذا فشل AI نستخدم النظام القديم
  const fallbackIntent =
    fallbackRouter(message);


  const result =
    getReplyByIntent(fallbackIntent);


  return {
    ...result,
    router: "fallback",
    confidence: 0
  };

}


// ======================================================
// الصفحة الرئيسية - واجهة الاختبار
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

label {
  display: block;
  margin-top: 15px;
  font-weight: bold;
}

input,
select,
button,
textarea {

  width: 100%;
  box-sizing: border-box;

  padding: 12px;

  margin-top: 7px;

  border-radius: 8px;

  border: 1px solid #ccc;

  font-size: 16px;
}

textarea {
  min-height: 100px;
  resize: vertical;
}

button {

  margin-top: 20px;

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

.allowed {
  background: #d9f7df;
  color: #176b2c;
}

.denied {
  background: #ffe0e0;
  color: #9b1c1c;
}

.reply {
  background: #eef4ff;
  color: #173b72;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<h1>🤖 مساعد شركة الاتحاد</h1>

<p>
واجهة اختبار خدمة العملاء + AI Router
</p>

<label>
نوع المحادثة
</label>

<select id="type">

<option value="user">
👤 شخص
</option>

<option value="group">
👥 مجموعة
</option>

</select>

<label>
المعرّف
</label>

<input
id="id"
type="text"
placeholder="اكتب المعرّف"
/>

<label>
رسالة العميل
</label>

<textarea
id="message"
placeholder="مثال: عنكن فرع تاني؟"
></textarea>

<button onclick="testBot()">
🔍 اختبار البوت
</button>

<div id="result"></div>

</div>

</div>

<script>

async function testBot() {

  const type =
    document.getElementById("type").value;

  const id =
    document.getElementById("id").value.trim();

  const message =
    document.getElementById("message").value.trim();

  const result =
    document.getElementById("result");


  if (!id) {

    result.style.display = "block";

    result.className = "denied";

    result.innerText =
      "❌ يرجى كتابة المعرّف أولاً.";

    return;

  }


  if (!message) {

    result.style.display = "block";

    result.className = "denied";

    result.innerText =
      "❌ يرجى كتابة رسالة العميل.";

    return;

  }


  result.style.display = "block";

  result.className = "reply";

  result.innerText =
    "⏳ جاري تحليل الرسالة بواسطة AI...";


  try {

    const response = await fetch(
      "/test-message",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          chatType: type,

          chatId: id,

          message: message

        })
      }
    );


    const data =
      await response.json();


    if (!data.allowed) {

      result.className = "denied";

      result.innerText =
        "🚫 البوت لن يرد\\n\\n" +
        data.reason;

      return;

    }


    result.className = "reply";

    result.innerText =
      "✅ البوت مسموح له بالرد\\n\\n" +

      "🧠 التصنيف:\\n" +
      data.type +

      "\\n\\n" +

      "📊 المصدر:\\n" +
      data.router +

      "\\n\\n" +

      "🎯 الثقة:\\n" +
      data.confidence +

      "\\n\\n" +

      "🤖 الرد المقترح:\\n\\n" +
      data.reply;

  }

  catch (error) {

    result.className = "denied";

    result.innerText =
      "❌ حدث خطأ في الاتصال بالسيرفر.";

  }

}

</script>

</body>

</html>
  `);

});


// ======================================================
// اختبار الرسالة
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

    allowed =
      isAllowedUser(chatId);

  }


  if (chatType === "group") {

    allowed =
      isAllowedGroup(chatId);

  }


  if (!allowed) {

    return res.json({

      allowed: false,

      reason:
        "هذا الشخص أو المجموعة غير موجود ضمن قائمة المسموح لهم."

    });

  }


  const result =
    await generateReply(message);


  res.json({

    allowed: true,

    reply: result.reply,

    type: result.type,

    router: result.router,

    confidence: result.confidence

  });

});


// ======================================================
// اختبار الصلاحية القديم
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

    aiRouter:
      Boolean(process.env.GEMINI_API_KEY)

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
