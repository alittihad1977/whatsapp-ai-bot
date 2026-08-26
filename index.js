const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const config = require("./config.json");

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  Browsers
} = require("@whiskeysockets/baileys");

const P = require("pino");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

// ======================================================
// SERVER
// ======================================================

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// GEMINI
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
// COMPANY
// ======================================================

const COMPANY = {
  name: "شركة الاتحاد - مكتب الشعار للصرافة والحوالات",

  address:
    "حلب، الشعار، بعد مفرق سد اللوز، من طرف طريق الباب، مقابل فروج اسكندر أوغلو.",

  map:
    "https://maps.app.goo.gl/nNsgHW7h5ASgoRU9A",

  openHour: 10,

  closeHour: 18,

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
// SPECIAL HOLIDAYS
// ======================================================

const SPECIAL_HOLIDAYS = {
  "2026-08-25":
    "عطلة رسمية بمناسبة عيد المولد النبوي الشريف ﷺ، وسيُستأنف العمل يوم الأربعاء 26 آب 2026 ضمن ساعات الدوام المعتادة."
};

// ======================================================
// SYRIA TIME
// ======================================================

const SYRIA_TIMEZONE = "Asia/Damascus";

const AR_DAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت"
];

const AR_MONTHS = [
  "كانون الثاني",
  "شباط",
  "آذار",
  "نيسان",
  "أيار",
  "حزيران",
  "تموز",
  "آب",
  "أيلول",
  "تشرين الأول",
  "تشرين الثاني",
  "كانون الأول"
];

function getSyriaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYRIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const out = {};

  for (const p of parts) {
    out[p.type] = p.value;
  }

  const year = Number(out.year);
  const month = Number(out.month);
  const day = Number(out.day);
  const hour = Number(out.hour);
  const minute = Number(out.minute);
  const second = Number(out.second);

  const weekday = new Date(
    Date.UTC(year, month - 1, day)
  ).getUTCDay();

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday,
    isoDate:
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  };
}

function getSyriaNow() {
  const p = getSyriaParts();

  return {
    ...p,

    dayName: AR_DAYS[p.weekday],

    monthName: AR_MONTHS[p.month - 1],

    dateText:
      `${p.day} ${AR_MONTHS[p.month - 1]} ${p.year}`,

    timeText:
      `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`
  };
}

// ======================================================
// OFFICE STATUS
// ======================================================

function isFriday(info = getSyriaNow()) {
  return info.weekday === 5;
}

function isSpecialHoliday(date = getSyriaNow().isoDate) {
  return Object.prototype.hasOwnProperty.call(
    SPECIAL_HOLIDAYS,
    date
  );
}

function isOpenNow(info = getSyriaNow()) {
  if (isFriday(info)) {
    return false;
  }

  if (isSpecialHoliday(info.isoDate)) {
    return false;
  }

  const minutes =
    info.hour * 60 + info.minute;

  return (
    minutes >= COMPANY.openHour * 60 &&
    minutes < COMPANY.closeHour * 60
  );
}

function getCurrentStatusText() {
  const now = getSyriaNow();

  if (isSpecialHoliday(now.isoDate)) {
    return (
      `اليوم ${now.dayName} ${now.dateText} عطلة رسمية 🌹.\n` +
      SPECIAL_HOLIDAYS[now.isoDate]
    );
  }

  if (isFriday(now)) {
    return (
      `اليوم ${now.dayName} ${now.dateText} عطلة رسمية 🌹.\n` +
      `الدوام المعتاد من 10 صباحاً حتى 6 مساءً.`
    );
  }

  if (isOpenNow(now)) {
    const remaining =
      COMPANY.closeHour * 60 -
      (now.hour * 60 + now.minute);

    const hours = Math.floor(remaining / 60);
    const minutes = remaining % 60;

    let remainingText = "";

    if (hours > 0) {
      remainingText = `${hours} ساعة`;

      if (minutes > 0) {
        remainingText += ` و${minutes} دقيقة`;
      }
    } else {
      remainingText = `${minutes} دقيقة`;
    }

    return (
      `نعم 🌹 المكتب مفتوح حالياً.\n` +
      `الساعة الآن في سوريا ${now.timeText}.\n` +
      `الدوام من 10 صباحاً حتى 6 مساءً.\n` +
      `متبقي تقريباً ${remainingText} على الإغلاق.`
    );
  }

  if (now.hour < COMPANY.openHour) {
    return (
      `حالياً المكتب مغلق 🌹.\n` +
      `الساعة الآن في سوريا ${now.timeText}.\n` +
      `يفتح المكتب الساعة 10 صباحاً.`
    );
  }

  return (
    `حالياً المكتب مغلق 🌹.\n` +
    `الساعة الآن في سوريا ${now.timeText}.\n` +
    `انتهى الدوام اليوم الساعة 6 مساءً.`
  );
}

// ======================================================
// TEXT NORMALIZATION
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
    .replace(/\s+/g, " ");
}

// ======================================================
// PERMISSIONS
// ======================================================

function getAllowedUsers() {
  return Array.isArray(
    config?.permissions?.allowedUsers
  )
    ? config.permissions.allowedUsers.map(String)
    : [];
}

function getAllowedGroups() {
  return Array.isArray(
    config?.permissions?.allowedGroups
  )
    ? config.permissions.allowedGroups.map(String)
    : [];
}

function isAllowedUser(chatId) {
  const users = getAllowedUsers();

  // إذا القائمة فارغة = السماح للجميع
  if (users.length === 0) {
    return true;
  }

  return users.includes(String(chatId));
}

function isAllowedGroup(chatId) {
  const groups = getAllowedGroups();

  // المجموعات لا نسمح بها افتراضياً
  if (groups.length === 0) {
    return false;
  }

  return groups.includes(String(chatId));
}

function groupOnlyWhenMentioned() {
  return !!(
    config?.permissions?.groupOnlyWhenMentioned
  );
}

// ======================================================
// WHATSAPP HELPERS
// ======================================================

function getChatType(message) {
  const jid =
    String(message?.key?.remoteJid || "");

  if (jid.endsWith("@g.us")) {
    return "group";
  }

  if (jid.endsWith("@s.whatsapp.net")) {
    return "user";
  }

  return "unknown";
}

function isMentioned(message, botJid) {
  const context =
    message?.message?.extendedTextMessage
      ?.contextInfo;

  const mentioned =
    context?.mentionedJid || [];

  if (!botJid) {
    return mentioned.length > 0;
  }

  const cleanBot =
    String(botJid).split(":")[0];

  return mentioned.some(jid => {
    const clean =
      String(jid).split(":")[0];

    return clean === cleanBot;
  });
}

function extractMessageText(message) {
  if (!message?.message) {
    return "";
  }

  const msg = message.message;

  if (msg.conversation) {
    return String(msg.conversation).trim();
  }

  if (msg.extendedTextMessage?.text) {
    return String(
      msg.extendedTextMessage.text
    ).trim();
  }

  if (msg.imageMessage?.caption) {
    return String(
      msg.imageMessage.caption
    ).trim();
  }

  if (msg.videoMessage?.caption) {
    return String(
      msg.videoMessage.caption
    ).trim();
  }

  if (msg.documentMessage?.caption) {
    return String(
      msg.documentMessage.caption
    ).trim();
  }

  return "";
}

function isVoiceMessage(message) {
  return !!message?.message?.audioMessage;
}

// ======================================================
// MESSAGE PERMISSION
// ======================================================

function checkWhatsAppPermission(message) {
  const chatType = getChatType(message);

  const chatId =
    String(message?.key?.remoteJid || "");

  if (chatType === "user") {
    return isAllowedUser(chatId);
  }

  if (chatType === "group") {
    if (!isAllowedGroup(chatId)) {
      return false;
    }

    if (groupOnlyWhenMentioned()) {
      return isMentioned(
        message,
        whatsappJid
      );
    }

    return true;
  }

  return false;
}

// ======================================================
// FALLBACK ROUTER
// ======================================================

function fallbackRouter(message) {
  const text = normalizeText(message);

  if (
    /مين انت|مين انتو|مين حضرتك|شو هاد الرقم|شو هالرقم|شو اسمك|مين المساعد|من انت/
      .test(text)
  ) {
    return {
      type: "identity",
      confidence: 0.95
    };
  }

  if (
    /مرحبا|اهلا|اهلين|السلام عليكم|سلام عليكم|هلا|هاي|صباح الخير|مسا الخير|مساء الخير/
      .test(text)
  ) {
    return {
      type: "greeting",
      confidence: 0.9
    };
  }

  if (
    /شكرا|مشكور|يسلمو|يعطيكم العافيه|يعطيكم العافية|يعطيك العافية/
      .test(text)
  ) {
    return {
      type: "thanks",
      confidence: 0.9
    };
  }

  if (
    /قديش.*الساعة|كم.*الساعة|شو.*الساعة|الساعة كم|الوقت كم|قديش الوقت/
      .test(text)
  ) {
    return {
      type: "current_time",
      confidence: 0.95
    };
  }

  if (
    /تاريخ اليوم|تاريخ هاليوم|اليوم شو|شو اليوم|اي يوم اليوم|اي نهار اليوم/
      .test(text)
  ) {
    return {
      type: "current_date",
      confidence: 0.95
    };
  }

  if (
    /بكرا|غدا|غداً/.test(text) &&
    /فاتحين|دوام|مفتوح|مسكر|عطلة/.test(text)
  ) {
    return {
      type: "schedule",
      confidence: 0.95
    };
  }

  if (
    /(هلأ|هلق|الان|الآن|هلا)/.test(text) &&
    /(فاتحين|فاتح|مفتوح|مسكر|مسكرين|سكر)/.test(text)
  ) {
    return {
      type: "open_now",
      confidence: 0.95
    };
  }

  if (
    /وين.*(مكتب|محل|عنوان|مكان|لوكيشن)|مكتب.*وين|محل.*وين|عنوان.*وين|وينكن|موقعكن|العنوان|العنون|عنون|لوكيشن/
      .test(text)
  ) {
    return {
      type: "location",
      confidence: 0.95
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
    /دوام|متى تفتح|امتا تفتحو|امتى تفتحو|امتى بتفتحو|امتى بتسكرو|متى تسكر|متى تسكرو/
      .test(text)
  ) {
    return {
      type: "working_hours",
      confidence: 0.9
    };
  }

  if (
    /شام كاش|شامكاش|sham cash/
      .test(text)
  ) {
    return {
      type: "sham_cash",
      confidence: 0.95
    };
  }

  if (
    /هوية|هويه|جواز|اخراج قيد|إخراج قيد|اوراق|أوراق|وثيقه|وثيقة/
      .test(text)
  ) {
    return {
      type: "documents",
      confidence: 0.9
    };
  }

  if (
    /حدا يستلم عني|شخص يستلم عني|غيري يستلم|اخي يستلم|زوجتي تستلم|زوجي يستلم/
      .test(text)
  ) {
    return {
      type: "receiver_change",
      confidence: 0.9
    };
  }

  if (
    /حواله|حوالة|حوالتي|وصلت.*حوال|حوال.*وصلت|استلم حوال|استلام حوال/
      .test(text)
  ) {
    return {
      type: "transfer_check",
      confidence: 0.9
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

  if (
    /سعر|اسعار|أسعار|صرف|دولار|يورو|تركي|الليرة/
      .test(text)
  ) {
    return {
      type: "rates",
      confidence: 0.85
    };
  }

  return {
    type: "unknown",
    confidence: 0.2
  };
}

// ======================================================
// GEMINI ROUTER
// ======================================================

async function aiRouter(message) {
  const text =
    String(message || "").trim();

  if (!text) {
    return {
      type: "greeting",
      confidence: 1
    };
  }

  if (!ai) {
    return fallbackRouter(text);
  }

  const now = getSyriaNow();

  const prompt = `
أنت نظام تصنيف ذكي لخدمة عملاء شركة الاتحاد للصرافة والحوالات في سوريا.

مهمتك تصنيف رسالة العميل فقط.
لا تجب على العميل.
لا تخترع معلومات.
أعد JSON فقط.

الوقت الحالي في سوريا:
اليوم: ${now.dayName}
التاريخ: ${now.dateText}
الساعة: ${now.timeText}

أنواع الطلبات:

greeting
تحية أو سلام.

identity
يسأل من أنت أو ما هذا الرقم أو عن هوية المساعد.

thanks
شكر أو مديح.

location
يسأل عن موقع المكتب أو العنوان أو اللوكيشن.

branches
يسأل عن الفروع.

working_hours
يسأل عن الدوام بشكل عام.

open_now
يسأل هل المكتب مفتوح الآن.

current_time
يسأل عن الساعة الآن.

current_date
يسأل عن تاريخ اليوم.

schedule
يسأل عن بكرا أو غداً أو يوم معين لمعرفة الدوام.

rates
يسأل عن أسعار الصرف أو الدولار أو اليورو أو التركي.

transfer_check
يسأل عن وصول حوالة أو حوالته.

transfer_notice
إشعار حوالة واضح.

documents
يسأل عن الهوية أو الجواز أو الأوراق المطلوبة.

sham_cash
يسأل عن شام كاش.

receiver_change
يريد شخص آخر استلام الحوالة أو تغيير المستفيد.

later_collection
يسأل عن استلام الحوالة لاحقاً.

complaint
شكوى أو مشكلة أو طلب الإدارة.

voice
رسالة صوتية.

unknown
أي شيء غير واضح.

قواعد:

"وين مكتبكن" = location
"وين محلكن" = location
"عطيني اللوكيشن" = location
"مين انت" = identity
"شو هالرقم" = identity
"هلق فاتحين" = open_now
"هلأ فاتحين" = open_now
"امتى بتسكرو" = working_hours
"قديش الساعة" = current_time
"شو تاريخ اليوم" = current_date
"بكرا فاتحين" = schedule
"قديش الدولار" = rates
"وصلت حوالتي؟" = transfer_check
"شو لازم جيب معي" = documents
"بتتعاملوا شام كاش" = sham_cash

افهم اللهجة السورية والأخطاء الإملائية.

أعد JSON فقط بهذا الشكل:

{
  "type": "location",
  "confidence": 0.98
}

رسالة العميل:
${text}
`;

  try {
    const response =
      await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: "application/json"
        }
      });

    let raw =
      response.text || "";

    raw = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const result =
      JSON.parse(raw);

    const allowed = [
      "greeting",
      "identity",
      "thanks",
      "location",
      "branches",
      "working_hours",
      "open_now",
      "current_time",
      "current_date",
      "schedule",
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

    if (!allowed.includes(result.type)) {
      return fallbackRouter(text);
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
// BUILD REPLY
// ======================================================

function buildReply(type, originalMessage = "") {
  switch (type) {

    case "greeting":
      return {
        reply:
          "أهلاً وسهلاً بك 🌹\nكيف يمكنني مساعدتك؟",
        type
      };

    case "identity":
      return {
        reply:
          "أهلاً وسهلاً بك 🌹\nأنا المساعد الذكي لشركة الاتحاد للصرافة والحوالات، وجاهز لمساعدتك باستفساراتك.",
        type
      };

    case "thanks":
      return {
        reply:
          "العفو 🌹 أهلاً وسهلاً بك دائماً.",
        type
      };

    case "location":
      return {
        reply:
          "📍 موقع مكتب الشعار:\n" +
          COMPANY.address +
          "\n\n🗺️ الخريطة:\n" +
          COMPANY.map,
        type
      };

    case "branches":
      return {
        reply:
          "🏢 أفرع شركة الاتحاد:\n\n" +
          "1- " + COMPANY.branches[0] +
          "\n" +
          "2- " + COMPANY.branches[1] +
          "\n\n" +
          COMPANY.mainBranch,
        type
      };

    case "working_hours":
    case "open_now":
      return {
        reply:
          "⏱️ " +
          getCurrentStatusText() +
          "\n\n" +
          "الدوام المعتاد: " +
          COMPANY.workingHours +
          "\n" +
          COMPANY.holiday,
        type: "working_hours"
      };

    case "current_time": {
      const now = getSyriaNow();

      return {
        reply:
          `🕐 الساعة الآن في سوريا: ${now.timeText}.\n` +
          `📅 اليوم: ${now.dayName} ${now.dateText}.`,
        type
      };
    }

    case "current_date": {
      const now = getSyriaNow();

      let status = "";

      if (isFriday(now)) {
        status =
          "اليوم الجمعة عطلة رسمية.";
      } else if (isSpecialHoliday(now.isoDate)) {
        status =
          SPECIAL_HOLIDAYS[now.isoDate];
      } else {
        status =
          "اليوم ليس عطلة الجمعة.";
      }

      return {
        reply:
          `📅 تاريخ اليوم في سوريا: ${now.dayName} ${now.dateText}.\n` +
          status,
        type
      };
    }

    case "schedule": {
      const now = getSyriaNow();
      const text = normalizeText(originalMessage);

      if (/بكرا|غدا/.test(text)) {

        const nextDate =
          new Date(
            Date.UTC(
              now.year,
              now.month - 1,
              now.day + 1
            )
          );

        const y =
          nextDate.getUTCFullYear();

        const m =
          nextDate.getUTCMonth() + 1;

        const d =
          nextDate.getUTCDate();

        const w =
          nextDate.getUTCDay();

        const iso =
          `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

        if (w === 5) {
          return {
            reply:
              `📅 بكرا ${AR_DAYS[w]} ${d} ${AR_MONTHS[m - 1]} ${y}، والجمعة عطلة رسمية.`,
            type
          };
        }

        if (isSpecialHoliday(iso)) {
          return {
            reply:
              `📅 بكرا ${AR_DAYS[w]} ${d} ${AR_MONTHS[m - 1]} ${y} عطلة رسمية.\n` +
              SPECIAL_HOLIDAYS[iso],
            type
          };
        }

        return {
          reply:
            `📅 بكرا ${AR_DAYS[w]} ${d} ${AR_MONTHS[m - 1]} ${y}، والدوام المعتاد من 10 صباحاً حتى 6 مساءً.`,
          type
        };
      }

      return {
        reply: getCurrentStatusText(),
        type
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
        type
      };

    case "transfer_check":
      return {
        reply:
          "📋 يرجى إرسال اسم صاحب الحوالة أو رقم الحوالة أو إشعار الحوالة، وسيقوم القسم المختص بالتحقق والرد عليك.",
        type
      };

    case "transfer_notice":
      return {
        reply:
          "📋 تم استلام المعلومات، وسيقوم القسم المختص بالتحقق منها والرد عليك بأسرع وقت.",
        type
      };

    case "documents":
      return {
        reply:
          "🪪 لاستلام الحوالة يجب إبراز إحدى الوثائق الأصلية التالية:\n\n" +
          "• الهوية الشخصية الأصلية.\n" +
          "• جواز السفر الأصلي.\n" +
          "• إخراج القيد الأصلي.\n\n" +
          "⚠️ صور الوثائق على الهاتف غير مقبولة.",
        type
      };

    case "sham_cash":
      return {
        reply:
          "نعتذر منك 🌹 لا يوجد لدينا تعامل أو تسليم حوالات عن طريق شام كاش.",
        type
      };

    case "receiver_change":
      return {
        reply:
          "📋 تسليم الحوالة يكون باليد لصاحب العلاقة حصراً.\n\n" +
          "إذا كنت لا تستطيع الحضور، يمكنك الاستفسار عن إمكانية تعديل اسم الحوالة إلى شخص آخر يستطيع الحضور والاستلام.",
        type
      };

    case "later_collection":
      return {
        reply:
          "📋 تبقى الحوالة موجودة حتى يأتي صاحب العلاقة ليستلمها، أو يمكن للمرسل استعادة المبلغ.",
        type
      };

    case "complaint":
      return {
        reply:
          "🌹 أكيد، اشرح لنا المشكلة بالتفصيل كتابةً ليتم رفعها ومتابعتها مع المختص.",
        type
      };

    case "voice":
      return {
        reply:
          "🌹 عذراً، حالياً يرجى كتابة استفسارك نصياً حتى أتمكن من مساعدتك.",
        type
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
// AI REPLY
// ======================================================

async function generateAIReply(message) {
  const route =
    await aiRouter(message);

  const result =
    buildReply(
      route.type,
      message
    );

  return {
    ...result,
    confidence: route.confidence
  };
}

// ======================================================
// WHATSAPP STATE
// ======================================================

let sock = null;
let whatsappQR = null;
let whatsappStatus = "disconnected";
let whatsappJid = null;

const AUTH_DIR =
  path.join(
    __dirname,
    "auth_info_baileys"
  );

// ======================================================
// WHATSAPP START
// ======================================================

let startingWhatsApp = false;

async function startWhatsApp() {

  if (startingWhatsApp) {
    return;
  }

  startingWhatsApp = true;

  try {

    console.log("======================================");
    console.log("📱 Starting WhatsApp connection...");
    console.log("======================================");

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, {
        recursive: true
      });
    }

    const {
      state,
      saveCreds
    } =
      await useMultiFileAuthState(
        AUTH_DIR
      );

    sock =
      makeWASocket({
        auth: state,

        logger:
          P({
            level: "silent"
          }),

        browser:
          Browsers.macOS("Chrome"),

        printQRInTerminal: false,

        generateHighQualityLinkPreview:
          false
      });

    sock.ev.on(
      "creds.update",
      saveCreds
    );

    console.log(
      "✅ WhatsApp event listeners installed."
    );

    sock.ev.on(
      "connection.update",
      async update => {

        const {
          connection,
          lastDisconnect,
          qr
        } = update;

        if (qr) {

          whatsappQR = qr;
          whatsappStatus = "qr_ready";

          console.log("======================================");
          console.log("📱 WhatsApp QR is ready.");
          console.log("Open /qr to scan the QR code.");
          console.log("======================================");
        }

        if (connection === "open") {

          whatsappStatus = "connected";
          whatsappQR = null;

          whatsappJid =
            sock?.user?.id || null;

          console.log("======================================");
          console.log("🟢 WhatsApp connected!");
          console.log("WhatsApp JID:", whatsappJid);
          console.log("======================================");
        }

        if (connection === "close") {

          whatsappStatus = "disconnected";
          whatsappJid = null;

          const statusCode =
            lastDisconnect?.error?.output?.statusCode;

          console.log(
            "🔴 WhatsApp disconnected."
          );

          console.log(
            "Status code:",
            statusCode
          );

          const shouldReconnect =
            statusCode !==
            DisconnectReason.loggedOut;

          if (shouldReconnect) {

            console.log(
              "🟡 Reconnecting in 5 seconds..."
            );

            setTimeout(() => {
              startWhatsApp();
            }, 5000);

          } else {

            console.log(
              "⚠️ WhatsApp logged out."
            );

            whatsappStatus = "logged_out";
          }
        }
      }
    );

    sock.ev.on(
      "messages.upsert",
      async ({ messages, type }) => {

        if (type !== "notify") {
          return;
        }

        for (const message of messages) {

          try {

            await handleWhatsAppMessage(
              message
            );

          } catch (error) {

            console.error(
              "❌ Message handler error:",
              error
            );

          }
        }
      }
    );

    console.log(
      "📩 Message listener: ENABLED"
    );

  } catch (error) {

    console.error(
      "❌ WhatsApp startup error:",
      error
    );

    whatsappStatus = "error";

    setTimeout(() => {
      startWhatsApp();
    }, 10000);

  } finally {

    startingWhatsApp = false;
  }
}

// ======================================================
// HANDLE WHATSAPP MESSAGE
// ======================================================

async function handleWhatsAppMessage(message) {

  if (!message?.key) {
    return;
  }

  if (message.key.fromMe) {
    return;
  }

  const chatId =
    String(
      message.key.remoteJid || ""
    );

  if (!chatId) {
    return;
  }

  const chatType =
    getChatType(message);

  console.log("--------------------------------------");
  console.log("📩 NEW WHATSAPP MESSAGE");
  console.log("Chat:", chatId);
  console.log("Type:", chatType);

  // ====================================================
  // PERMISSION
  // ====================================================

  if (!checkWhatsAppPermission(message)) {

    console.log(
      "⛔ Message blocked by permissions"
    );

    return;
  }

  // ====================================================
  // VOICE
  // ====================================================

  if (isVoiceMessage(message)) {

    console.log(
      "🎤 Voice message received"
    );

    await sock.sendMessage(
      chatId,
      {
        text:
          buildReply("voice").reply
      }
    );

    return;
  }

  // ====================================================
  // TEXT
  // ====================================================

  const text =
    extractMessageText(message);

  if (!text) {

    console.log(
      "⚠️ Message has no readable text"
    );

    return;
  }

  console.log(
    "Text:",
    text
  );

  // ====================================================
  // AI
  // ====================================================

  const result =
    await generateAIReply(text);

  console.log(
    "AI type:",
    result.type
  );

  console.log(
    "Confidence:",
    result.confidence
  );

  console.log(
    "Reply:",
    result.reply
  );

  // ====================================================
  // SEND
  // ====================================================

  if (
    !sock ||
    whatsappStatus !== "connected"
  ) {

    console.log(
      "❌ WhatsApp is not connected"
    );

    return;
  }

  await sock.sendMessage(
    chatId,
    {
      text: result.reply
    }
  );

  console.log(
    "✅ Reply sent successfully"
  );
}

// ======================================================
// QR PAGE
// ======================================================

app.get("/qr", async (req, res) => {

  if (whatsappStatus === "connected") {

    return res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WhatsApp Connected</title>
<style>
body{
font-family:Arial;
background:#f3f4f6;
padding:30px;
text-align:center;
}
.card{
max-width:500px;
margin:auto;
background:white;
padding:30px;
border-radius:20px;
box-shadow:0 5px 20px rgba(0,0,0,.08);
}
.ok{font-size:70px}
h1{color:#176b2c}
.info{
background:#eef8f0;
padding:15px;
border-radius:12px;
line-height:2;
}
</style>
</head>
<body>
<div class="card">
<div class="ok">🟢</div>
<h1>واتساب متصل</h1>
<div class="info">
البوت متصل بحساب واتساب بنجاح.
<br>
${whatsappJid || "-"}
</div>
</div>
</body>
</html>
`);

  }

  if (!whatsappQR) {

    return res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="5">
<title>ربط واتساب</title>
<style>
body{
font-family:Arial;
background:#f3f4f6;
text-align:center;
padding:30px;
}
.card{
max-width:500px;
margin:auto;
background:white;
padding:30px;
border-radius:20px;
}
</style>
</head>
<body>
<div class="card">
<h1>📱 ربط واتساب</h1>
<p>⏳ جاري تجهيز رمز QR...</p>
<p>سيتم تحديث الصفحة تلقائياً.</p>
</div>
</body>
</html>
`);

  }

  try {

    const qrDataUrl =
      await QRCode.toDataURL(
        whatsappQR,
        {
          width: 320,
          margin: 2
        }
      );

    return res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="10">
<title>ربط واتساب</title>
<style>
*{
box-sizing:border-box;
}
body{
margin:0;
padding:20px;
background:#f3f4f6;
font-family:Arial;
text-align:center;
}
.card{
max-width:500px;
margin:auto;
background:white;
padding:25px;
border-radius:20px;
box-shadow:0 5px 25px rgba(0,0,0,.08);
}
.qr{
width:320px;
max-width:90%;
margin:20px auto;
display:block;
}
.steps{
text-align:right;
line-height:2;
background:#f8f8f8;
padding:15px;
border-radius:12px;
}
.status{
margin-top:15px;
padding:12px;
background:#fff3cd;
border-radius:10px;
}
</style>
</head>
<body>
<div class="card">

<h1>📱 ربط واتساب</h1>

<p>
امسح رمز QR من تطبيق واتساب
</p>

<img
class="qr"
src="${qrDataUrl}"
alt="WhatsApp QR"
/>

<div class="steps">

<b>طريقة الربط:</b>

<br>
1️⃣ افتح واتساب بالموبايل.
<br>
2️⃣ اضغط على ⋮
<br>
3️⃣ الأجهزة المرتبطة.
<br>
4️⃣ ربط جهاز.
<br>
5️⃣ امسح رمز QR.

</div>

<div class="status">
🟡 بانتظار مسح رمز QR...
</div>

</div>
</body>
</html>
`);

  } catch (error) {

    console.error(
      "QR ERROR:",
      error
    );

    return res.status(500).send(
      "تعذر إنشاء QR"
    );
  }
});

// ======================================================
// AI TEST
// ======================================================

app.get("/ai-test", async (req, res) => {

  try {

    if (!ai) {

      return res.status(500).send(
        "❌ GEMINI_API_KEY غير موجود في Render Environment."
      );
    }

    const question =
      String(
        req.query.q ||
        "مرحبا، مين انت؟"
      );

    const response =
      await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: question,
        config: {
          temperature: 0.2
        }
      });

    const answer =
      response.text ||
      "لم يتم الحصول على رد.";

    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Test</title>
<style>
body{
font-family:Arial;
background:#f3f4f6;
padding:25px;
}
.box{
max-width:700px;
margin:auto;
background:white;
padding:25px;
border-radius:18px;
}
.q,.a{
padding:15px;
border-radius:10px;
margin-top:10px;
line-height:1.8;
}
.q{
background:#eee;
}
.a{
background:#e9f7ef;
}
</style>
</head>
<body>

<div class="box">

<h1>🤖 اختبار Gemini AI</h1>

<h3>السؤال:</h3>

<div class="q">
${escapeHtml(question)}
</div>

<h3>الرد:</h3>

<div class="a">
${escapeHtml(answer).replace(/\n/g,"<br>")}
</div>

</div>

</body>
</html>
`);

  } catch (error) {

    console.error(
      "AI TEST ERROR:",
      error
    );

    res.status(500).send(
      "AI ERROR: " +
      escapeHtml(error.message)
    );
  }
});

// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ======================================================
// STATUS
// ======================================================

app.get("/status", (req, res) => {

  const now =
    getSyriaNow();

  const uptime =
    process.uptime();

  const hours =
    Math.floor(uptime / 3600);

  const minutes =
    Math.floor(
      (uptime % 3600) / 60
    );

  const seconds =
    Math.floor(
      uptime % 60
    );

  res.json({

    status: "online",

    bot:
      config?.bot?.name ||
      "مساعد شركة الاتحاد",

    enabled:
      config?.bot?.enabled !== false,

    company:
      COMPANY.name,

    branch:
      "مكتب الشعار",

    workingHours:
      COMPANY.workingHours,

    holiday:
      COMPANY.holiday,

    officeOpenNow:
      isOpenNow(now),

    ai:
      !!ai,

    aiProvider:
      "Google Gemini",

    whatsapp:
      whatsappStatus,

    whatsappConnected:
      whatsappStatus === "connected",

    whatsappJid:
      whatsappJid,

    permissions: {

      allowedUsers:
        getAllowedUsers(),

      allowedGroups:
        getAllowedGroups(),

      emptyUsersMeansAll:
        getAllowedUsers().length === 0

    },

    syriaTime:
      now,

    uptime:
      `${hours}h ${minutes}m ${seconds}s`,

    timestamp:
      Date.now()
  });
});

// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {

  const now =
    getSyriaNow();

  res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>مساعد شركة الاتحاد</title>

<style>

*{
box-sizing:border-box;
}

body{
margin:0;
padding:25px;
font-family:Arial;
background:#f3f4f6;
}

.container{
max-width:650px;
margin:auto;
}

.card{
background:white;
padding:25px;
border-radius:20px;
box-shadow:0 5px 25px rgba(0,0,0,.08);
}

.status{
padding:14px;
border-radius:10px;
margin:12px 0;
background:#f5f5f5;
}

.time{
background:#eef8ff;
padding:15px;
border-radius:12px;
line-height:2;
}

a{
display:block;
padding:14px;
margin-top:12px;
border-radius:10px;
background:#222;
color:white;
text-decoration:none;
text-align:center;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<h1>🤖 مساعد شركة الاتحاد</h1>

<div class="status">

${
  whatsappStatus === "connected"
    ? "🟢 واتساب متصل"
    : whatsappStatus === "qr_ready"
      ? "🟡 بانتظار مسح QR"
      : "🔴 واتساب غير متصل"
}

</div>

<div class="status">

${
  ai
    ? "🟢 Gemini AI يعمل"
    : "🔴 Gemini AI غير مفعل"
}

</div>

<div class="time">

🕐 الساعة في سوريا:
<b>${now.timeText}</b>

<br>

📅 التاريخ:
<b>${now.dayName} ${now.dateText}</b>

<br>

🏢 حالة المكتب:
<b>
${
  isOpenNow(now)
    ? "مفتوح حالياً 🟢"
    : "مغلق حالياً 🔴"
}
</b>

</div>

<p>
شركة الاتحاد للصرافة والحوالات - مكتب الشعار
</p>

<a href="/qr">
📱 ربط واتساب / QR
</a>

<a href="/ai-test">
🤖 اختبار Gemini AI
</a>

<a href="/status">
📊 حالة السيرفر
</a>

</div>

</div>

</body>

</html>
`);
});

// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
  (err, req, res, next) => {

    console.error(
      "SERVER ERROR:",
      err
    );

    res.status(500).json({
      error: true,
      message: "حدث خطأ في السيرفر"
    });
  }
);

// ======================================================
// START SERVER
// ======================================================

app.listen(
  PORT,
  async () => {

    console.log("======================================");
    console.log("🚀 SERVER STARTED");
    console.log("======================================");

    console.log(
      "📡 Port:",
      PORT
    );

    console.log(
      "📊 Status: /status"
    );

    console.log(
      "📱 WhatsApp: /qr"
    );

    console.log(
      "🤖 AI Test: /ai-test"
    );

    console.log(
      "📩 Message listener: ENABLED"
    );

    console.log("======================================");

    console.log(
      "👥 Allowed users:",
      getAllowedUsers()
    );

    console.log(
      "👥 Allowed groups:",
      getAllowedGroups()
    );

    if (getAllowedUsers().length === 0) {
      console.log(
        "🟢 Empty allowedUsers = ALL USERS ARE ALLOWED"
      );
    }

    console.log("======================================");

    try {

      console.log(
        "📱 Starting WhatsApp..."
      );

      await startWhatsApp();

      console.log(
        "✅ WhatsApp startup completed"
      );

    } catch (error) {

      console.error(
        "❌ WhatsApp startup error:",
        error
      );
    }
  }
);
