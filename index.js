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
// الثلاثاء 25 آب 2026
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

  return words.some(word => text.includes(word));
}


// ======================================================
// التحقق من الصلاحية
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
// قواعد الرد
// ======================================================

function generateReply(message) {

  const text = normalizeText(message);

  if (!text) {

    return {
      reply:
        "🌹 أهلاً وسهلاً بك، كيف يمكنني مساعدتك؟",
      type: "greeting"
    };

  }


  // ----------------------------------------------------
  // التحيات
  // ----------------------------------------------------

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

    return {
      reply:
        "أهلاً وسهلاً بك 🌹 كيف يمكنني مساعدتك؟",
      type: "greeting"
    };

  }


  // ----------------------------------------------------
  // الشكر
  // ----------------------------------------------------

  if (
    containsAny(text, [
      "شكرا",
      "شكراً",
      "يسلمو",
      "مشكور",
      "مشكورين",
      "يعطيكم العافيه",
      "يعطيكم العافية"
    ])
  ) {

    return {
      reply:
        "العفو 🌹 أهلاً وسهلاً بك دائماً.",
      type: "thanks"
    };

  }


  // ----------------------------------------------------
  // الموقع
  // ----------------------------------------------------

  if (
    containsAny(text, [
      "محلكن",
      "محلكم",
      "وين محلكن",
      "وين المحل",
      "وين محلك",
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

    return {
      reply:
        "📍 موقع مكتب الشعار:\n" +
        COMPANY.address +
        "\n\n🗺️ الخريطة:\n" +
        COMPANY.map,
      type: "location"
    };

  }


  // ----------------------------------------------------
  // الفروع
  // ----------------------------------------------------

  if (
    containsAny(text, [
      "فروعكن",
      "فروعكم",
      "فروع",
      "فرعكن",
      "فرعكم",
      "أفرع",
      "افرع"
    ])
  ) {

    return {
      reply:
        "🏢 أفرع شركة الاتحاد:\n\n" +
        "1- " + COMPANY.branches[0] + "\n" +
        "2- " + COMPANY.branches[1] + "\n\n" +
        COMPANY.mainBranch,
      type: "branches"
    };

  }


  // ----------------------------------------------------
  // الدوام
  // ----------------------------------------------------

  if (
    containsAny(text, [
      "فاتحين",
      "فاتح",
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
      "امتا بتفتحو",
      "متى تفتحون"
    ])
  ) {

    const today = new Date()
      .toISOString()
      .slice(0, 10);

    if (today === SPECIAL_HOLIDAY.date) {

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
      type: "working_hours"
    };

  }


  // ----------------------------------------------------
  // أسعار الصرف
  // ----------------------------------------------------

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
      "كم التركي"
    ])
  ) {

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

  }


  // ----------------------------------------------------
  // حوالة - استعلام عن وصولها
  // ----------------------------------------------------

  if (
    containsAny(text, [
      "حواله باسمي",
      "حوالة باسمي",
      "في حواله",
      "في حوالة",
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
      "بدي استلم حوالة"
    ])
  ) {

    return {
      reply:
        "📋 يرجى إرسال إشعار الحوالة، وسيقوم القسم المختص بالتحقق منه والرد عليك بأسرع وقت.",
      type: "transfer_check"
    };

  }


  // ----------------------------------------------------
  // صورة أو إشعار حوالة
  // ملاحظة: الاختبار النصي لا يستطيع رؤية الصورة فعلياً.
  // ----------------------------------------------------

  if (
    containsAny(text, [
      "اشعار حواله",
      "اشعار حوالة",
      "إشعار حوالة",
      "إشعار الحوالة",
      "رقم الحواله",
      "رقم الحوالة",
      "#000",
      "شركة الاتحاد"
    ])
  ) {

    return {
      reply:
        "📋 تم استلام المعلومات، وسيقوم القسم المختص بالتحقق منها والرد عليك بأسرع وقت.",
      type: "transfer_notice"
    };

  }


  // ----------------------------------------------------
  // الوثائق
  // ----------------------------------------------------

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
      "صورة الهوية"
    ])
  ) {

    return {
      reply:
        "🪪 لاستلام الحوالة يجب إبراز إحدى الوثائق الأصلية التالية حصراً:\n\n" +
        "• الهوية الشخصية الأصلية.\n" +
        "• جواز السفر الأصلي.\n" +
        "• إخراج القيد الأصلي.\n\n" +
        "⚠️ صور الوثائق على الهاتف غير مقبولة نهائياً.",
      type: "documents"
    };

  }


  // ----------------------------------------------------
  // شام كاش
  // ----------------------------------------------------

  if (
    containsAny(text, [
      "شام كاش",
      "شامكاش",
      "sham cash"
    ])
  ) {

    return {
      reply:
        "نعتذر منك 🌹 لا يوجد لدينا تعامل أو تسليم حوالات عن طريق شام كاش.",
      type: "sham_cash"
    };

  }


  // ----------------------------------------------------
  // استلام الحوالة
  // ----------------------------------------------------

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
  ) {

    return {
      reply:
        "📋 تسليم الحوالة يكون باليد لصاحب العلاقة حصراً.\n\n" +
        "إذا كنت لا تستطيع الحضور، يمكنك الاستفسار عن إمكانية تعديل اسم الحوالة إلى شخص آخر يستطيع الحضور والاستلام، ويجب أن يكون التعديل على اسم الشخص الذي سيحضر ويستلم.",
      type: "receiver_change"
    };

  }


  // ----------------------------------------------------
  // استلام الحوالة في يوم آخر
  // ----------------------------------------------------

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
      "بدي اجي بعدين"
    ])
  ) {

    return {
      reply:
        "📋 تبقى الحوالة موجودة حتى يأتي صاحب العلاقة ليستلمها، أو يمكن للمرسل استعادة المبلغ.",
      type: "later_collection"
    };

  }


  // ----------------------------------------------------
  // شكوى / إدارة
  // ----------------------------------------------------

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
      "بدي احكي مع الإدارة"
    ])
  ) {

    return {
      reply:
        "🌹 أكيد، اشرح لنا المشكلة بالتفصيل كتابةً، ليتم رفعها ومتابعتها مع المختص.",
      type: "complaint"
    };

  }


  // ----------------------------------------------------
  // رسالة صوتية
  // ----------------------------------------------------

  if (
    containsAny(text, [
      "[voice]",
      "[audio]",
      "رساله صوتيه",
      "رسالة صوتية",
      "رساله صوتيه"
    ])
  ) {

    return {
      reply:
        "🌹 عذراً، يرجى كتابة استفسارك نصياً حتى أتمكن من مساعدتك.",
      type: "voice"
    };

  }


  // ----------------------------------------------------
  // غير معروف
  // ----------------------------------------------------

  return {
    reply:
      "🌹 أهلاً بك. لم أتمكن من فهم استفسارك بشكل واضح.\n" +
      "يرجى توضيح طلبك كتابةً، وسيتم مساعدتك بأسرع وقت.",
    type: "unknown"
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
واجهة اختبار خدمة العملاء
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
placeholder="مثال: وين محلكن؟"
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


    result.style.display = "block";


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
      "🤖 الرد المقترح:\\n\\n" +
      data.reply +
      "\\n\\n" +
      "📌 نوع الرد: " +
      data.type;

  }

  catch (error) {

    result.style.display = "block";

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
// اختبار رسالة كاملة
// ======================================================

app.post("/test-message", (req, res) => {

  const chatType =
    req.body.chatType;

  const chatId =
    String(req.body.chatId || "");

  const message =
    String(req.body.message || "");


  // -----------------------------
  // التحقق من الصلاحية
  // -----------------------------

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


  // -----------------------------
  // توليد الرد
  // -----------------------------

  const result =
    generateReply(message);


  res.json({

    allowed: true,

    reply: result.reply,

    type: result.type

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

});
