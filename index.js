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
// العطلة الرسمية الحالية
// ======================================================

const SPECIAL_HOLIDAY = {
  date: "2026-08-25",

  text:
    "اليوم الثلاثاء 25 آب 2026 عطلة رسمية بمناسبة عيد المولد النبوي الشريف ﷺ، وسيُستأنف العمل يوم الأربعاء 26 آب 2026 ضمن ساعات الدوام المعتادة."
};


// ======================================================
// أدوات النص
// ======================================================

function normalizeText(text) {

  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ًٌٍَُِّْ]/g, "")
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
// AI ROUTER
// ======================================================

function routeMessage(message) {

  const text = normalizeText(message);

  if (!text) {
    return {
      intent: "greeting",
      confidence: "high"
    };
  }


  // ====================================================
  // تحية
  // ====================================================

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
      "مساء الخير",
      "صباح الخير"
    ])
  ) {
    return {
      intent: "greeting",
      confidence: "high"
    };
  }


  // ====================================================
  // شكر
  // ====================================================

  if (
    containsAny(text, [
      "شكرا",
      "يسلمو",
      "مشكور",
      "مشكورين",
      "يعطيكم العافيه",
      "يعطيكم العافية",
      "تسلم",
      "تسلمو"
    ])
  ) {
    return {
      intent: "thanks",
      confidence: "high"
    };
  }


  // ====================================================
  // الفروع
  // ====================================================

  if (
    containsAny(text, [
      "فروعكن",
      "فروعكم",
      "فروع الشركة",
      "فروع",
      "فرعكن",
      "فرعكم",
      "افرع",
      "أفرع",

      "فرع تاني",
      "فرع ثاني",
      "فروع تانيه",
      "فروع ثانية",
      "في فرع تاني",
      "في فرع ثاني",

      "عنكن فرع",
      "عندكن فرع",
      "عندكم فرع",
      "في عندكن فرع",
      "في عندكم فرع",

      "مكاتب تانيه",
      "مكاتب ثانية",
      "مكتب تاني",
      "مكتب ثاني",

      "وين فروعكن",
      "وين فروعكم",
      "وين افرعكن",
      "وين فروع الشركة"
    ])
  ) {
    return {
      intent: "branches",
      confidence: "high"
    };
  }


  // ====================================================
  // الموقع
  // ====================================================

  if (
    containsAny(text, [
      "محلكن",
      "محلكم",
      "محل الشركة",
      "وين محلكن",
      "وين محلكم",
      "وين المحل",
      "وين محلك",
      "وين المكتب",
      "عنوان",
      "العنوان",
      "العنون",
      "عنون",
      "عنوانكن",
      "عنوانكم",
      "وينكن",
      "وينكم",
      "موقعكن",
      "موقعكم",
      "الموقع",
      "مكانكن",
      "مكانكم",
      "وين موجودين"
    ])
  ) {
    return {
      intent: "location",
      confidence: "high"
    };
  }


  // ====================================================
  // الدوام
  // ====================================================

  if (
    containsAny(text, [
      "فاتحين",
      "فاتح",
      "مفتوح",
      "مفتوحين",
      "تفتحو",
      "تفتحوا",
      "المكتب فاتح",
      "مكتب فاتح",
      "مسكرين",
      "مسكر",
      "تسكرو",
      "تسكروا",
      "بتسكرو",
      "دوام",
      "اوقات الدوام",
      "وقت الدوام",
      "متى تفتحون",
      "امتا بتفتحو",
      "ايمت بتفتحو",
      "شو وقت الدوام",
      "اي ساعة بتفتحو",
      "اي ساعه بتفتحو",
      "اي ساعة بتسكرو",
      "اي ساعه بتسكرو"
    ])
  ) {
    return {
      intent: "working_hours",
      confidence: "high"
    };
  }


  // ====================================================
  // أسعار الصرف
  // ====================================================

  if (
    containsAny(text, [
      "سعر الدولار",
      "سعر اليورو",
      "سعر التركي",
      "سعر الليرة",
      "اسعار الصرف",
      "أسعار الصرف",
      "سعر الصرف",
      "صرف الدولار",
      "صرف اليورو",
      "سعر العمله",
      "سعر العملة",
      "الدولار اليوم",
      "اليورو اليوم",
      "التركي اليوم",
      "قديش الدولار",
      "قديش اليورو",
      "قديش التركي",
      "كم الدولار",
      "كم اليورو",
      "كم التركي",
      "بكم الدولار",
      "بكم اليورو",
      "بكم التركي",
      "سعر usd",
      "سعر eur",
      "سعر try"
    ])
  ) {
    return {
      intent: "rates",
      confidence: "high"
    };
  }


  // ====================================================
  // حوالة / استعلام
  // ====================================================

  if (
    containsAny(text, [
      "حواله باسمي",
      "حوالة باسمي",
      "في حواله",
      "في حوالة",
      "في حوالة باسمي",
      "وصلت الحواله",
      "وصلت الحوالة",
      "وصلتني حواله",
      "وصلتني حوالة",
      "وين الحواله",
      "وين الحوالة",
      "استلم حواله",
      "استلم حوالة",
      "استلام حواله",
      "استلام حوالة",
      "بدي استلم حواله",
      "بدي استلم حوالة",
      "عندي حواله",
      "عندي حوالة",
      "الي حواله",
      "الي حوالة",
      "في شي حواله",
      "في شي حوالة"
    ])
  ) {
    return {
      intent: "transfer_check",
      confidence: "high"
    };
  }


  // ====================================================
  // إشعار حوالة / رقم حوالة
  // ====================================================

  if (
    containsAny(text, [
      "اشعار حواله",
      "اشعار حوالة",
      "إشعار حوالة",
      "إشعار الحوالة",
      "رقم الحواله",
      "رقم الحوالة",
      "#000",
      "#31",
      "شركة الاتحاد"
    ])
  ) {
    return {
      intent: "transfer_notice",
      confidence: "medium"
    };
  }


  // ====================================================
  // الوثائق
  // ====================================================

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
      "إخراج قيد",
      "صوره الهويه",
      "صورة الهوية",
      "شو بدي لاستلم",
      "شو لازم لاستلم",
      "شو بدي معي للحواله",
      "شو بدي معي للحوالة"
    ])
  ) {
    return {
      intent: "documents",
      confidence: "high"
    };
  }


  // ====================================================
  // شام كاش
  // ====================================================

  if (
    containsAny(text, [
      "شام كاش",
      "شامكاش",
      "sham cash"
    ])
  ) {
    return {
      intent: "sham_cash",
      confidence: "high"
    };
  }


  // ====================================================
  // شخص آخر يستلم
  // ====================================================

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
      "غيري يستلم",
      "بدي حدا يستلم",
      "في حدا يستلم عني",
      "ممكن حدا يستلم",
      "ينفع حدا يستلم"
    ])
  ) {
    return {
      intent: "receiver_change",
      confidence: "high"
    };
  }


  // ====================================================
  // استلام يوم آخر
  // ====================================================

  if (
    containsAny(text, [
      "بكرا استلم",
      "باجر استلم",
      "يوم تاني",
      "يوم ثاني",
      "بقدر استلم بعدين",
      "استلمها بعدين",
      "استلمها يوم اخر",
      "استلمها يوم آخر",
      "بدي اجي بعدين",
      "بقدر اجي بكرا",
      "بقدر اجي بعدين",
      "اذا ما جيت اليوم"
    ])
  ) {
    return {
      intent: "later_collection",
      confidence: "high"
    };
  }


  // ====================================================
  // شكوى / إدارة
  // ====================================================

  if (
    containsAny(text, [
      "شكوى",
      "شكايه",
      "شكاية",
      "مشكله",
      "مشكلة",
      "الاداره",
      "الإدارة",
      "المدير",
      "بدي اشتكي",
      "بدي احكي مع الاداره",
      "بدي احكي مع الإدارة",
      "وين المدير",
      "بدي مسؤول"
    ])
  ) {
    return {
      intent: "complaint",
      confidence: "high"
    };
  }


  // ====================================================
  // رسالة صوتية
  // ====================================================

  if (
    containsAny(text, [
      "[voice]",
      "[audio]",
      "رساله صوتيه",
      "رسالة صوتية"
    ])
  ) {
    return {
      intent: "voice",
      confidence: "high"
    };
  }


  // ====================================================
  // غير معروف
  // ====================================================

  return {
    intent: "unknown",
    confidence: "low"
  };
}


// ======================================================
// توليد الرد بناءً على Intent
// ======================================================

function generateReply(message) {

  const route = routeMessage(message);

  switch (route.intent) {

    case "greeting":

      return {
        reply:
          "أهلاً وسهلاً بك 🌹 كيف يمكنني مساعدتك؟",
        type: "greeting",
        intent: route.intent,
        confidence: route.confidence
      };


    case "thanks":

      return {
        reply:
          "العفو 🌹 أهلاً وسهلاً بك دائماً.",
        type: "thanks",
        intent: route.intent,
        confidence: route.confidence
      };


    case "branches":

      return {
        reply:
          "🏢 أفرع شركة الاتحاد:\n\n" +
          "1- " + COMPANY.branches[0] + "\n" +
          "2- " + COMPANY.branches[1] + "\n\n" +
          COMPANY.mainBranch,
        type: "branches",
        intent: route.intent,
        confidence: route.confidence
      };


    case "location":

      return {
        reply:
          "📍 موقع مكتب الشعار:\n" +
          COMPANY.address +
          "\n\n🗺️ الخريطة:\n" +
          COMPANY.map,
        type: "location",
        intent: route.intent,
        confidence: route.confidence
      };


    case "working_hours": {

      const today =
        new Date()
          .toISOString()
          .slice(0, 10);

      if (today === SPECIAL_HOLIDAY.date) {

        return {
          reply:
            "⏱️ " + SPECIAL_HOLIDAY.text,
          type: "special_holiday",
          intent: route.intent,
          confidence: route.confidence
        };
      }

      return {
        reply:
          "⏱️ الدوام من 10 صباحاً حتى 6 مساءً.\n" +
          "والجمعة عطلة رسمية.",
        type: "working_hours",
        intent: route.intent,
        confidence: route.confidence
      };
    }


    case "rates":

      return {
        reply:
          "💰 لمعرفة أسعار الصرف الحالية، يمكنك متابعة قنوات الأسعار الرسمية لشركة الاتحاد:\n\n" +
          "Telegram:\n" +
          COMPANY.telegram +
          "\n\n" +
          "WhatsApp:\n" +
          COMPANY.whatsapp,
        type: "rates",
        intent: route.intent,
        confidence: route.confidence
      };


    case "transfer_check":

      return {
        reply:
          "📋 يرجى إرسال إشعار الحوالة، وسيقوم القسم المختص بالتحقق منه والرد عليك بأسرع وقت.",
        type: "transfer_check",
        intent: route.intent,
        confidence: route.confidence
      };


    case "transfer_notice":

      return {
        reply:
          "📋 تم استلام المعلومات، وسيقوم القسم المختص بالتحقق منها والرد عليك بأسرع وقت.",
        type: "transfer_notice",
        intent: route.intent,
        confidence: route.confidence
      };


    case "documents":

      return {
        reply:
          "🪪 لاستلام الحوالة يجب إبراز إحدى الوثائق الأصلية التالية حصراً:\n\n" +
          "• الهوية الشخصية الأصلية.\n" +
          "• جواز السفر الأصلي.\n" +
          "• إخراج القيد الأصلي.\n\n" +
          "⚠️ صور الوثائق على الهاتف غير مقبولة نهائياً.",
        type: "documents",
        intent: route.intent,
        confidence: route.confidence
      };


    case "sham_cash":

      return {
        reply:
          "نعتذر منك 🌹 لا يوجد لدينا تعامل أو تسليم حوالات عن طريق شام كاش.",
        type: "sham_cash",
        intent: route.intent,
        confidence: route.confidence
      };


    case "receiver_change":

      return {
        reply:
          "📋 تسليم الحوالة يكون باليد لصاحب العلاقة حصراً.\n\n" +
          "إذا كنت لا تستطيع الحضور، يمكنك الاستفسار عن إمكانية تعديل اسم الحوالة إلى شخص آخر يستطيع الحضور والاستلام، ويجب أن يكون التعديل على اسم الشخص الذي سيحضر ويستلم.",
        type: "receiver_change",
        intent: route.intent,
        confidence: route.confidence
      };


    case "later_collection":

      return {
        reply:
          "📋 تبقى الحوالة موجودة حتى يأتي صاحب العلاقة ليستلمها، أو يمكن للمرسل استعادة المبلغ.",
        type: "later_collection",
        intent: route.intent,
        confidence: route.confidence
      };


    case "complaint":

      return {
        reply:
          "🌹 أكيد، اشرح لنا المشكلة بالتفصيل كتابةً، ليتم رفعها ومتابعتها مع المختص.",
        type: "complaint",
        intent: route.intent,
        confidence: route.confidence
      };


    case "voice":

      return {
        reply:
          "🌹 عذراً، يرجى كتابة استفسارك نصياً حتى أتمكن من مساعدتك.",
        type: "voice",
        intent: route.intent,
        confidence: route.confidence
      };


    default:

      return {
        reply:
          "🌹 أهلاً بك.\nلم أتمكن من فهم استفسارك بشكل واضح.\nيرجى توضيح طلبك كتابةً، وسيتم مساعدتك بأسرع وقت.",
        type: "unknown",
        intent: "unknown",
        confidence: "low"
      };
  }
}


// ======================================================
// الصفحة الرئيسية - اختبار AI فقط
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
  max-width: 700px;
  margin: auto;
}

.card {
  background: white;
  padding: 22px;
  border-radius: 18px;
  box-shadow: 0 4px 20px rgba(0,0,0,.08);
}

h1 {
  margin-top: 0;
}

.subtitle {
  color: #666;
  margin-bottom: 20px;
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
  border-radius: 10px;
  border: 1px solid #ccc;
  font-size: 16px;
}

textarea {
  min-height: 130px;
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
  padding: 18px;
  border-radius: 12px;
  line-height: 1.8;
}

.reply {
  background: #eef4ff;
  color: #173b72;
}

.error {
  background: #ffe0e0;
  color: #9b1c1c;
}

.intent {
  background: #f1f1f1;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 12px;
}

.examples {
  margin-top: 20px;
  color: #555;
  line-height: 2;
}

.example {
  display: inline-block;
  background: #f2f2f2;
  padding: 5px 10px;
  margin: 3px;
  border-radius: 8px;
  cursor: pointer;
}

.example:hover {
  background: #ddd;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<h1>🤖 مساعد شركة الاتحاد</h1>

<div class="subtitle">
اختبار AI Router — بدون معرف وبدون صلاحيات
</div>

<label>
رسالة العميل
</label>

<textarea
id="message"
placeholder="مثال: عنكن فرع تاني؟"
></textarea>

<button onclick="testAI()">
🤖 تحليل الرسالة
</button>

<div id="result"></div>

<div class="examples">

<strong>جرب أمثلة:</strong>

<br>

<span class="example"
onclick="setExample('عنكن فرع تاني؟')">
عنكن فرع تاني؟
</span>

<span class="example"
onclick="setExample('وين محلكن؟')">
وين محلكن؟
</span>

<span class="example"
onclick="setExample('قديش الدولار؟')">
قديش الدولار؟
</span>

<span class="example"
onclick="setExample('الحوالة وصلت؟')">
الحوالة وصلت؟
</span>

<span class="example"
onclick="setExample('شو لازم جيب لاستلم الحوالة؟')">
شو لازم جيب؟
</span>

</div>

</div>

</div>


<script>

function setExample(text) {

  document.getElementById("message").value = text;

}


async function testAI() {

  const message =
    document.getElementById("message")
      .value
      .trim();

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
      await fetch(
        "/ai-test",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            message
          })
        }
      );


    const data =
      await response.json();


    if (!data.success) {

      result.className = "error";

      result.innerText =
        "❌ " +
        (data.error || "حدث خطأ.");

      return;
    }


    result.className = "reply";

    result.innerHTML =
      '<div class="intent">' +
      '🧠 <strong>نوع الطلب:</strong> ' +
      escapeHtml(data.intent) +
      '<br>' +
      '🎯 <strong>الثقة:</strong> ' +
      escapeHtml(data.confidence) +
      '</div>' +

      '<strong>🤖 الرد المقترح:</strong>' +
      '<br><br>' +

      escapeHtml(data.reply)
        .replace(/\\n/g, "<br>");

  }

  catch (error) {

    result.className = "error";

    result.innerText =
      "❌ حدث خطأ في الاتصال بالسيرفر.";

  }

}


function escapeHtml(text) {

  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}

</script>

</body>

</html>
  `);

});


// ======================================================
// اختبار AI Router
// ======================================================

app.post("/ai-test", (req, res) => {

  const message =
    String(req.body.message || "");

  if (!message.trim()) {

    return res.status(400).json({

      success: false,

      error:
        "الرسالة فارغة."

    });

  }


  const result =
    generateReply(message);


  res.json({

    success: true,

    message,

    intent:
      result.intent,

    confidence:
      result.confidence,

    type:
      result.type,

    reply:
      result.reply

  });

});


// ======================================================
// اختبار الصلاحيات بشكل منفصل
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
        "المعرّف فارغ."

    });

  }


  if (chatType === "user") {

    const allowed =
      isAllowedUser(chatId);


    return res.json({

      allowed,

      reason:
        allowed
          ? "الشخص موجود ضمن قائمة المسموح لهم."
          : "الشخص غير موجود ضمن قائمة المسموح لهم."

    });

  }


  if (chatType === "group") {

    const allowed =
      isAllowedGroup(chatId);


    return res.json({

      allowed,

      reason:
        allowed
          ? "المجموعة موجودة ضمن قائمة المسموح بها."
          : "المجموعة غير موجودة ضمن قائمة المسموح بها."

    });

  }


  return res.json({

    allowed: false,

    reason:
      "نوع المحادثة غير معروف."

  });

});


// ======================================================
// حالة السيرفر
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
      true

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
