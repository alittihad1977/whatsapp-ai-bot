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

const app = express();

const PORT =
  process.env.PORT ||
  3000;

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true
  })
);

// ======================================================
// Gemini AI
// ======================================================

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;

let ai = null;

if (GEMINI_API_KEY) {

  ai =
    new GoogleGenAI({
      apiKey:
        GEMINI_API_KEY
    });

  console.log(
    "Gemini AI: enabled"
  );

} else {

  console.log(
    "Gemini AI: disabled - GEMINI_API_KEY not found"
  );
}

// ======================================================
// معلومات الشركة
// ======================================================

const COMPANY = {

  name:
    "شركة الاتحاد - مكتب الشعار للصرافة والحوالات",

  address:
    "حلب، الشعار، بعد مفرق سد اللوز، من طرف طريق الباب، مقابل فروج اسكندر أوغلو.",

  map:
    "https://maps.app.goo.gl/nNsgHW7h5ASgoRU9A",

  openHour:
    10,

  closeHour:
    18,

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
// العطل الخاصة
// ======================================================

const SPECIAL_HOLIDAYS = {

  "2026-08-25":
    "عطلة رسمية بمناسبة عيد المولد النبوي الشريف ﷺ، وسيُستأنف العمل يوم الأربعاء 26 آب 2026 ضمن ساعات الدوام المعتادة."

};

// ======================================================
// وقت سوريا
// ======================================================

const SYRIA_TIMEZONE =
  "Asia/Damascus";

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

// ======================================================
// استخراج الوقت والتاريخ من توقيت سوريا
// ======================================================

function getSyriaParts(
  date = new Date()
) {

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {

        timeZone:
          SYRIA_TIMEZONE,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hourCycle:
          "h23"

      }
    ).formatToParts(date);

  const out = {};

  for (
    const p of parts
  ) {

    out[p.type] =
      p.value;

  }

  const year =
    Number(out.year);

  const month =
    Number(out.month);

  const day =
    Number(out.day);

  const hour =
    Number(out.hour);

  const minute =
    Number(out.minute);

  const second =
    Number(out.second);

  const weekday =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
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

      `${String(year).padStart(4, "0")}-` +

      `${String(month).padStart(2, "0")}-` +

      `${String(day).padStart(2, "0")}`

  };

}

// ======================================================
// الوقت الحالي في سوريا
// ======================================================

function getSyriaNow() {

  const p =
    getSyriaParts();

  return {

    ...p,

    dayName:
      AR_DAYS[p.weekday],

    monthName:
      AR_MONTHS[p.month - 1],

    dateText:
      `${p.day} ${AR_MONTHS[p.month - 1]} ${p.year}`,

    timeText:
      `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`

  };

}

// ======================================================
// العطل
// ======================================================

function isSpecialHoliday(
  date =
    getSyriaNow().isoDate
) {

  return Object.prototype.hasOwnProperty.call(
    SPECIAL_HOLIDAYS,
    date
  );

}

function isFriday(
  info =
    getSyriaNow()
) {

  return (
    info.weekday === 5
  );

}

// ======================================================
// هل المكتب مفتوح حالياً؟
// ======================================================

function isOpenNow(
  info =
    getSyriaNow()
) {

  if (
    isFriday(info)
  ) {

    return false;

  }

  if (
    isSpecialHoliday(
      info.isoDate
    )
  ) {

    return false;

  }

  const minutes =
    info.hour * 60 +
    info.minute;

  return (

    minutes >=
      COMPANY.openHour * 60 &&

    minutes <
      COMPANY.closeHour * 60

  );

}

// ======================================================
// حالة المكتب الحالية
// ======================================================

function getCurrentStatusText() {

  const now =
    getSyriaNow();

  if (
    isSpecialHoliday(
      now.isoDate
    )
  ) {

    return (

      `اليوم ${now.dayName} ${now.dateText} عطلة رسمية 🌹.\n` +

      SPECIAL_HOLIDAYS[
        now.isoDate
      ]

    );

  }

  if (
    isFriday(now)
  ) {

    return (

      `اليوم ${now.dayName} ${now.dateText} عطلة رسمية 🌹.\n` +

      `الدوام المعتاد من 10 صباحاً حتى 6 مساءً.`

    );

  }

  if (
    isOpenNow(now)
  ) {

    const remaining =
      COMPANY.closeHour * 60 -

      (
        now.hour * 60 +
        now.minute
      );

    const hours =
      Math.floor(
        remaining / 60
      );

    const minutes =
      remaining % 60;

    let remainingText =
      "";

    if (
      hours > 0
    ) {

      remainingText =
        `${hours} ساعة`;

      if (
        minutes > 0
      ) {

        remainingText +=
          ` و${minutes} دقيقة`;

      }

    } else {

      remainingText =
        `${minutes} دقيقة`;

    }

    return (

      `نعم 🌹 المكتب مفتوح حالياً.\n` +

      `الساعة الآن في سوريا ${now.timeText}.\n` +

      `الدوام من 10 صباحاً حتى 6 مساءً.\n` +

      `متبقي تقريباً ${remainingText} على الإغلاق.`

    );

  }

  if (
    now.hour <
    COMPANY.openHour
  ) {

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
// تطبيع النص
// ======================================================

function normalizeText(
  text
) {

  return String(
    text || ""
  )

    .toLowerCase()

    .trim()

    .replace(
      /[إأآ]/g,
      "ا"
    )

    .replace(
      /ة/g,
      "ه"
    )

    .replace(
      /ى/g,
      "ي"
    )

    .replace(
      /ؤ/g,
      "و"
    )

    .replace(
      /ئ/g,
      "ي"
    )

    .replace(
      /\s+/g,
      " "
    );

}

// ======================================================
// صلاحيات المستخدم
// ======================================================

function getAllowedUsers() {

  const users =
    config?.permissions
      ?.allowedUsers;

  if (
    !Array.isArray(users)
  ) {

    return [];

  }

  return users
    .map(
      value =>
        String(value)
          .trim()
    )
    .filter(Boolean);

}

// ======================================================
// صلاحيات المجموعات
// ======================================================

function getAllowedGroups() {

  const groups =
    config?.permissions
      ?.allowedGroups;

  if (
    !Array.isArray(groups)
  ) {

    return [];

  }

  return groups
    .map(
      value =>
        String(value)
          .trim()
    )
    .filter(Boolean);

}

// ======================================================
// هل المستخدم مسموح؟
//
// إذا allowedUsers فارغة:
// يسمح بكل الرسائل الخاصة.
//
// إذا فيها أرقام:
// يسمح فقط للأرقام الموجودة.
//
// ======================================================

function isAllowedUser(
  chatId
) {

  const users =
    getAllowedUsers();

  if (
    users.length === 0
  ) {

    return true;

  }

  const cleanChatId =
    String(chatId)
      .replace(
        /:\d+@/,
        "@"
      );

  return users.some(
    allowed => {

      const cleanAllowed =
        String(allowed)
          .trim()
          .replace(
            /:\d+@/,
            "@"
          );

      return (

        cleanAllowed ===
        cleanChatId

      );

    }
  );

}

// ======================================================
// هل المجموعة مسموحة؟
//
// المجموعة لا تعمل إلا إذا أضفت JID المجموعة
// إلى allowedGroups.
// ======================================================

function isAllowedGroup(
  chatId
) {

  const groups =
    getAllowedGroups();

  if (
    groups.length === 0
  ) {

    return false;

  }

  return groups.includes(
    String(chatId)
  );

}

// ======================================================
// هل المجموعة تحتاج Mention؟
// ======================================================

function groupOnlyWhenMentioned() {

  return !!(
    config?.permissions
      ?.groupOnlyWhenMentioned
  );

}

// ======================================================
// WhatsApp Helpers
// ======================================================

function getSenderId(
  message
) {

  if (
    !message ||
    !message.key
  ) {

    return "";

  }

  return String(

    message.key.participant ||

    message.key.remoteJid ||

    ""

  );

}

// ======================================================
// نوع المحادثة
// ======================================================

function getChatType(
  message
) {

  const jid =
    String(
      message?.key
        ?.remoteJid ||
      ""
    );

  if (
    jid.endsWith(
      "@g.us"
    )
  ) {

    return "group";

  }

  if (
    jid.endsWith(
      "@s.whatsapp.net"
    )
  ) {

    return "user";

  }

  return "unknown";

}

// ======================================================
// استخراج JID للبوت
// ======================================================

function normalizeJid(
  jid
) {

  if (!jid) {

    return "";

  }

  return String(jid)
    .replace(
      /:\d+(?=@)/,
      ""
    );

}

// ======================================================
// هل تم ذكر البوت؟
// ======================================================

function isMentioned(
  message,
  botJid
) {

  const mentionedJid =
    message
      ?.message
      ?.extendedTextMessage
      ?.contextInfo
      ?.mentionedJid ||
    [];

  if (
    mentionedJid.length === 0
  ) {

    return false;

  }

  const normalizedBot =
    normalizeJid(
      botJid
    );

  return mentionedJid.some(
    jid =>
      normalizeJid(
        jid
      ) ===
      normalizedBot
  );

}

// ======================================================
// استخراج النص
// ======================================================

function extractMessageText(
  message
) {

  if (
    !message ||
    !message.message
  ) {

    return "";

  }

  const msg =
    message.message;

  if (
    msg.conversation
  ) {

    return String(
      msg.conversation
    ).trim();

  }

  if (
    msg.extendedTextMessage
      ?.text
  ) {

    return String(
      msg.extendedTextMessage.text
    ).trim();

  }

  if (
    msg.imageMessage
      ?.caption
  ) {

    return String(
      msg.imageMessage.caption
    ).trim();

  }

  if (
    msg.videoMessage
      ?.caption
  ) {

    return String(
      msg.videoMessage.caption
    ).trim();

  }

  if (
    msg.documentMessage
      ?.caption
  ) {

    return String(
      msg.documentMessage.caption
    ).trim();

  }

  return "";

}

// ======================================================
// رسالة صوتية
// ======================================================

function isVoiceMessage(
  message
) {

  return !!(
    message
      ?.message
      ?.audioMessage
  );

}

// ======================================================
// ردود الشركة
// ======================================================

function buildReply(
  type,
  originalMessage = ""
) {

  switch (type) {

    case "greeting":

      return {

        reply:
          "أهلاً وسهلاً بك 🌹 كيف يمكنني مساعدتك؟",

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

          "1- " +
          COMPANY.branches[0] +

          "\n" +

          "2- " +
          COMPANY.branches[1] +

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

          `الدوام المعتاد: ${COMPANY.workingHours}\n` +

          COMPANY.holiday,

        type:
          "working_hours"

      };

    case "current_time": {

      const now =
        getSyriaNow();

      return {

        reply:

          `🕐 الساعة الآن في سوريا: ${now.timeText}.\n` +

          `📅 اليوم: ${now.dayName} ${now.dateText}.`,

        type

      };

    }

    case "current_date": {

      const now =
        getSyriaNow();

      let holidayText =
        "اليوم ليس عطلة الجمعة.";

      if (
        isFriday(now)
      ) {

        holidayText =
          "اليوم الجمعة عطلة رسمية.";

      } else if (
        isSpecialHoliday(
          now.isoDate
        )
      ) {

        holidayText =
          SPECIAL_HOLIDAYS[
            now.isoDate
          ];

      }

      return {

        reply:

          `📅 تاريخ اليوم في سوريا: ${now.dayName} ${now.dateText}.\n` +

          holidayText,

        type

      };

    }

    case "schedule": {

      const now =
        getSyriaNow();

      const text =
        normalizeText(
          originalMessage
        );

      if (
        /بكرا|غدا|غداً/
          .test(text)
      ) {

        const nextDate =
          new Date(
            Date.UTC(
              now.year,
              now.month - 1,
              now.day + 1
            )
          );

        const y =
          nextDate
            .getUTCFullYear();

        const m =
          nextDate
            .getUTCMonth() + 1;

        const d =
          nextDate
            .getUTCDate();

        const w =
          nextDate
            .getUTCDay();

        const iso =

          `${y}-` +

          `${String(m).padStart(2, "0")}-` +

          `${String(d).padStart(2, "0")}`;

        if (
          w === 5
        ) {

          return {

            reply:

              `📅 بكرا ${AR_DAYS[w]} ${d} ${AR_MONTHS[m - 1]} ${y}، والجمعة عطلة رسمية.`,

            type

          };

        }

        if (
          isSpecialHoliday(
            iso
          )
        ) {

          return {

            reply:

              `📅 بكرا ${AR_DAYS[w]} ${d} ${AR_MONTHS[m - 1]} ${y} عطلة رسمية.\n` +

              SPECIAL_HOLIDAYS[
                iso
              ],

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

        reply:
          getCurrentStatusText(),

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

          "📋 يرجى إرسال إشعار الحوالة، وسيقوم القسم المختص بالتحقق منه والرد عليك بأسرع وقت.",

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

          "🪪 لاستلام الحوالة يجب إبراز إحدى الوثائق الأصلية التالية حصراً:\n\n" +

          "• الهوية الشخصية الأصلية.\n" +

          "• جواز السفر الأصلي.\n" +

          "• إخراج القيد الأصلي.\n\n" +

          "⚠️ صور الوثائق على الهاتف غير مقبولة نهائياً.",

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

          "إذا كنت لا تستطيع الحضور، يمكنك الاستفسار عن إمكانية تعديل اسم الحوالة إلى شخص آخر يستطيع الحضور والاستلام، ويجب أن يكون التعديل على اسم الشخص الذي سيحضر ويستلم.",

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

          "🌹 أكيد، اشرح لنا المشكلة بالتفصيل كتابةً، ليتم رفعها ومتابعتها مع المختص.",

        type

      };

    case "voice":

      return {

        reply:

          "🌹 عذراً، يرجى كتابة استفسارك نصياً حتى أتمكن من مساعدتك.",

        type

      };

    default:

      return {

        reply:

          "🌹 أهلاً بك. يرجى توضيح استفسارك أكثر حتى نتمكن من مساعدتك.",

        type:
          "unknown"

      };

  }

}

// ======================================================
// Gemini Router
// ======================================================

async function aiRouter(
  message
) {

  const text =
    String(
      message || ""
    ).trim();

  if (!text) {

    return {

      type:
        "greeting",

      confidence:
        1

    };

  }

  if (!ai) {

    return fallbackRouter(
      text
    );

  }

  const now =
    getSyriaNow();

  const prompt = `

أنت Router ذكي لخدمة عملاء شركة صرافة وحوالات سورية.

مهمتك الوحيدة فهم رسالة العميل وتحديد نوع الطلب.

لا تجب على العميل.
لا تخترع معلومات.
لا تعط أسعاراً.
أعد JSON فقط.

الوقت والتاريخ الحاليان في سوريا:

اليوم: ${now.dayName}
التاريخ: ${now.dateText}
التاريخ الرقمي: ${now.isoDate}
الساعة: ${now.timeText}
المنطقة الزمنية: Asia/Damascus

أنواع الطلبات:

greeting
= تحية أو سلام.

identity
= مين أنت؟ مين حضرتك؟ شو هاد الرقم؟ شو اسمك؟ سؤال عن هوية البوت أو الشركة.

thanks
= شكر أو مديح.

location
= سؤال عن موقع المكتب أو العنوان أو وين مكتبكن أو وين محلكن أو بعتلي لوكيشن.

branches
= سؤال عن الفروع أو وجود فرع آخر.

working_hours
= سؤال عن الدوام بشكل عام.

open_now
= هلأ فاتحين؟ هلق مسكرين؟ هل المكتب مفتوح حالياً؟

current_time
= سؤال مباشر عن الساعة أو الوقت الآن.

current_date
= سؤال مباشر عن تاريخ اليوم أو اسم اليوم.

schedule
= سؤال عن بكرا أو غداً أو يوم آخر لمعرفة إذا المكتب فاتح أو دوام ذلك اليوم.

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
= رسالة صوتية.

unknown
= لا ينتمي لأي نوع واضح.

قواعد مهمة:

- افهم اللهجة السورية والحلبية.
- افهم الأخطاء الإملائية.
- افهم الاختصارات.
- "وين مكتبكن" = location.
- "وين محلكن" = location.
- "عطيني اللوكيشن" = location.
- "مين انت" = identity.
- "شو هالرقم" = identity.
- "هلأ فاتحين" = open_now.
- "هلق فاتحين" = open_now.
- "هلق مسكرين" = open_now.
- "امتى بتسكرو" = working_hours.
- "قديش الساعة" = current_time.
- "شو تاريخ اليوم" = current_date.
- "بكرا فاتحين" = schedule.
- إذا سأل عن السعر، اختر rates.
- إذا سأل عن حوالة، اختر transfer_check.
- لا تعتبر كلمة شركة الاتحاد وحدها إشعار حوالة.
- لا تعتبر أي رقم عادي إشعار حوالة.
- إذا احتوت الرسالة على أكثر من طلب، اختر النوع الأهم والأوضح.
- لا تحاول الإجابة، فقط صنّف.

أعد JSON فقط:

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

        model:
          "gemini-2.5-flash",

        contents:
          prompt,

        config: {

          temperature:
            0,

          responseMimeType:
            "application/json"

        }

      });

    const raw =
      response.text ||
      "";

    const clean =
      raw

        .replace(
          /```json/g,
          ""
        )

        .replace(
          /```/g,
          ""
        )

        .trim();

    const result =
      JSON.parse(
        clean
      );

    const allowedTypes = [

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

    if (
      !allowedTypes.includes(
        result.type
      )
    ) {

      return {

        type:
          "unknown",

        confidence:
          0

      };

    }

    return {

      type:
        result.type,

      confidence:
        Number(
          result.confidence
        ) || 0

    };

  } catch (
    error
  ) {

    console.log(
      "Gemini Router error:",
      error.message
    );

    return fallbackRouter(
      text
    );

  }

}

// ======================================================
// Router احتياطي
// ======================================================

function fallbackRouter(
  message
) {

  const text =
    normalizeText(
      message
    );

  if (
    /مين انت|مين انتو|مين حضرتك|شو هاد الرقم|شو هالرقم|شو اسمك|مين المساعد|من انت/
      .test(text)
  ) {

    return {

      type:
        "identity",

      confidence:
        0.95

    };

  }

  if (
    /مرحبا|اهلا|اهلين|السلام عليكم|سلام عليكم|هلا|هاي|صباح الخير|مسا الخير|مساء الخير/
      .test(text)
  ) {

    return {

      type:
        "greeting",

      confidence:
        0.8

    };

  }

  if (
    /شكرا|مشكور|يسلمو|يعطيكم العافيه|يعطيكم العافية/
      .test(text)
  ) {

    return {

      type:
        "thanks",

      confidence:
        0.8

    };

  }

  if (
    /قديش.*الساعة|كم.*الساعة|شو.*الساعة|الساعة كم|الوقت كم|قديش الوقت/
      .test(text)
  ) {

    return {

      type:
        "current_time",

      confidence:
        0.95

    };

  }

  if (
    /تاريخ اليوم|تاريخ هاليوم|اليوم شو|شو اليوم|اي يوم اليوم|اي نهار اليوم/
      .test(text)
  ) {

    return {

      type:
        "current_date",

      confidence:
        0.95

    };

  }

  if (
    /بكرا|غدا|غداً/
      .test(text) &&

    /فاتحين|دوام|مفتوح|مسكر|عطلة/
      .test(text)
  ) {

    return {

      type:
        "schedule",

      confidence:
        0.95

    };

  }

  if (
    /هلأ|هلق|الان|الآن|هلا/
      .test(text) &&

    /فاتحين|فاتح|مفتوح|مسكر|مسكرين|سكر/
      .test(text)
  ) {

    return {

      type:
        "open_now",

      confidence:
        0.95

    };

  }

  if (
    /وين.*(مكتب|محل|عنوان|مكان|لوكيشن)|مكتب.*وين|محل.*وين|عنوان.*وين|وينكن|موقعكن|العنوان|العنون|عنون|لوكيشن/
      .test(text)
  ) {

    return {

      type:
        "location",

      confidence:
        0.9

    };

  }

  if (
    /فرع|فروع|افرع|أفرع|مكتب تاني|محل تاني|غير الشعار/
      .test(text)
  ) {

    return {

      type:
        "branches",

      confidence:
        0.9

    };

  }

  if (
    /دوام|متى تفتح|امتا تفتحو|امتى تفتحو|امتى بتفتحو|امتى بتسكرو|متى تسكر|متى تسكرو/
      .test(text)
  ) {

    return {

      type:
        "working_hours",

      confidence:
        0.9

    };

  }

  if (
    /سعر|اسعار|أسعار|صرف|دولار|يورو|تركي|الليرة|قديش|كم/
      .test(text)
  ) {

    return {

      type:
        "rates",

      confidence:
        0.8

    };

  }

  if (
    /حواله|حوالة|حوالتي|وصلت.*حوال|حوال.*وصلت|استلم حوال|استلام حوال/
      .test(text)
  ) {

    return {

      type:
        "transfer_check",

      confidence:
        0.85

    };

  }

  if (
    /هوية|هويه|جواز|اخراج قيد|إخراج قيد|اوراق|أوراق|وثيقه|وثيقة/
      .test(text)
  ) {

    return {

      type:
        "documents",

      confidence:
        0.85

    };

  }

  if (
    /شام كاش|شامكاش|sham cash/
      .test(text)
  ) {

    return {

      type:
        "sham_cash",

      confidence:
        0.95

    };

  }

  if (
    /حدا يستلم عني|شخص يستلم عني|غيري يستلم|اخي يستلم|زوجتي تستلم|زوجي يستلم/
      .test(text)
  ) {

    return {

      type:
        "receiver_change",

      confidence:
        0.85

    };

  }

  if (
    /شكوى|شكايه|شكاية|مشكله|مشكلة|الاداره|الإدارة|المدير/
      .test(text)
  ) {

    return {

      type:
        "complaint",

      confidence:
        0.9

    };

  }

  return {

    type:
      "unknown",

    confidence:
      0.2

  };

}

// ======================================================
// الوظيفة الرئيسية للـAI
// ======================================================

async function generateAIReply(
  message
) {

  const route =
    await aiRouter(
      message
    );

  const result =
    buildReply(
      route.type,
      message
    );

  return {

    ...result,

    confidence:
      route.confidence

  };

}

// ======================================================
// WhatsApp
// ======================================================

let sock =
  null;

let whatsappQR =
  null;

let whatsappStatus =
  "disconnected";

let whatsappJid =
  null;

let lastWhatsAppMessage =
  null;

let messagesReceived =
  0;

let messagesReplied =
  0;

let messagesBlocked =
  0;

let lastMessageTime =
  null;

const AUTH_DIR =
  path.join(
    __dirname,
    "auth_info_baileys"
  );

// ======================================================
// بدء اتصال واتساب
// ======================================================

async function startWhatsApp() {

  try {

    console.log(
      "======================================"
    );

    console.log(
      "📱 Starting WhatsApp connection..."
    );

    console.log(
      "======================================"
    );

    const {

      state,

      saveCreds

    } =
      await useMultiFileAuthState(
        AUTH_DIR
      );

    sock =
      makeWASocket({

        auth:
          state,

        logger:
          P({
            level:
              "silent"
          }),

        browser:
          Browsers.macOS(
            "Chrome"
          ),

        printQRInTerminal:
          false,

        generateHighQualityLinkPreview:
          false

      });

    console.log(
      "✅ WhatsApp event listeners installed."
    );

    // ==================================================
    // حفظ بيانات الدخول
    // ==================================================

    sock.ev.on(
      "creds.update",
      saveCreds
    );

    // ==================================================
    // حالة الاتصال
    // ==================================================

    sock.ev.on(
      "connection.update",
      async (
        update
      ) => {

        const {

          connection,

          lastDisconnect,

          qr

        } = update;

        // ----------------------------------------------
        // QR
        // ----------------------------------------------

        if (qr) {

          whatsappQR =
            qr;

          whatsappStatus =
            "qr_ready";

          console.log(
            "======================================"
          );

          console.log(
            "📱 WhatsApp QR is ready."
          );

          console.log(
            "Open /qr to scan the QR code."
          );

          console.log(
            "======================================"
          );

        }

        // ----------------------------------------------
        // متصل
        // ----------------------------------------------

        if (
          connection ===
          "open"
        ) {

          whatsappStatus =
            "connected";

          whatsappQR =
            null;

          whatsappJid =
            sock?.user?.id ||
            null;

          console.log(
            "======================================"
          );

          console.log(
            "🟢 WhatsApp connected!"
          );

          console.log(
            "WhatsApp JID:",
            whatsappJid
          );

          console.log(
            "======================================"
          );

        }

        // ----------------------------------------------
        // انقطع
        // ----------------------------------------------

        if (
          connection ===
          "close"
        ) {

          whatsappStatus =
            "disconnected";

          whatsappJid =
            null;

          const statusCode =
            lastDisconnect
              ?.error
              ?.output
              ?.statusCode;

          const shouldReconnect =
            statusCode !==
            DisconnectReason.loggedOut;

          console.log(
            "======================================"
          );

          console.log(
            "🔴 WhatsApp disconnected."
          );

          console.log(
            "Status code:",
            statusCode
          );

          console.log(
            "Should reconnect:",
            shouldReconnect
          );

          console.log(
            "======================================"
          );

          if (
            shouldReconnect
          ) {

            setTimeout(
              () => {

                startWhatsApp();

              },
              5000
            );

          } else {

            console.log(
              "⚠️ WhatsApp logged out."
            );

            console.log(
              "Delete auth_info_baileys and scan QR again."
            );

          }

        }

      }
    );

    // ==================================================
    // استقبال الرسائل
    // ==================================================

    sock.ev.on(
      "messages.upsert",
      async ({
        messages,
        type
      }) => {

        if (
          type !==
          "notify"
        ) {

          return;

        }

        console.log(
          `📩 messages.upsert received: ${messages.length} message(s)`
        );

        for (
          const message
          of messages
        ) {

          try {

            await handleWhatsAppMessage(
              message
            );

          } catch (
            error
          ) {

            console.error(
              "❌ WhatsApp message error:",
              error
            );

          }

        }

      }
    );

  } catch (
    error
  ) {

    console.error(
      "❌ WhatsApp startup error:",
      error
    );

    whatsappStatus =
      "error";

    setTimeout(
      () => {

        startWhatsApp();

      },
      10000
    );

  }

}

// ======================================================
// معالجة رسالة واتساب
// ======================================================

async function handleWhatsAppMessage(
  message
) {

  if (
    !message ||
    !message.key
  ) {

    console.log(
      "⚠️ Invalid WhatsApp message."
    );

    return;

  }

  // ====================================================
  // تجاهل رسائل البوت
  // ====================================================

  if (
    message.key.fromMe
  ) {

    console.log(
      "↩️ Ignored own message."
    );

    return;

  }

  const chatType =
    getChatType(
      message
    );

  const chatId =
    String(
      message.key.remoteJid ||
      ""
    );

  const senderId =
    getSenderId(
      message
    );

  if (!chatId) {

    console.log(
      "⚠️ Message without chatId."
    );

    return;

  }

  messagesReceived++;

  lastMessageTime =
    new Date().toISOString();

  lastWhatsAppMessage = {

    chatId,

    senderId,

    chatType,

    receivedAt:
      lastMessageTime

  };

  console.log(
    "======================================"
  );

  console.log(
    "📩 NEW WHATSAPP MESSAGE"
  );

  console.log(
    "Chat ID:",
    chatId
  );

  console.log(
    "Sender ID:",
    senderId
  );

  console.log(
    "Chat Type:",
    chatType
  );

  console.log(
    "======================================"
  );

  // ====================================================
  // رسالة صوتية
  // ====================================================

  if (
    isVoiceMessage(
      message
    )
  ) {

    console.log(
      "🎤 Voice message received."
    );

    if (
      !checkWhatsAppPermission(
        message
      )
    ) {

      messagesBlocked++;

      console.log(
        "⛔ Voice message blocked by permissions."
      );

      return;

    }

    await sock.sendMessage(
      chatId,
      {

        text:
          buildReply(
            "voice"
          ).reply

      }
    );

    messagesReplied++;

    console.log(
      "✅ Voice reply sent."
    );

    return;

  }

  // ====================================================
  // استخراج النص
  // ====================================================

  const text =
    extractMessageText(
      message
    );

  if (!text) {

    console.log(
      "ℹ️ Message has no text."
    );

    return;

  }

  console.log(
    "📝 Text:",
    text
  );

  // ====================================================
  // الصلاحيات
  // ====================================================

  const allowed =
    checkWhatsAppPermission(
      message
    );

  if (!allowed) {

    messagesBlocked++;

    console.log(
      "======================================"
    );

    console.log(
      "⛔ MESSAGE BLOCKED BY PERMISSIONS"
    );

    console.log(
      "Sender:",
      senderId
    );

    console.log(
      "Chat:",
      chatId
    );

    console.log(
      "To allow this number, add its JID to config.json"
    );

    console.log(
      "======================================"
    );

    return;

  }

  console.log(
    "✅ Permission accepted."
  );

  // ====================================================
  // تحليل الرسالة
  // ====================================================

  const result =
    await generateAIReply(
      text
    );

  console.log(
    "🤖 AI type:",
    result.type
  );

  console.log(
    "🤖 Confidence:",
    result.confidence
  );

  console.log(
    "📝 Reply:",
    result.reply
  );

  // ====================================================
  // إرسال الرد
  // ====================================================

  if (
    !sock
  ) {

    console.log(
      "❌ WhatsApp socket unavailable."
    );

    return;

  }

  if (
    whatsappStatus !==
    "connected"
  ) {

    console.log(
      "❌ WhatsApp is not connected."
    );

    return;

  }

  await sock.sendMessage(
    chatId,
    {

      text:
        result.reply

    }
  );

  messagesReplied++;

  console.log(
    "✅ Reply sent successfully."
  );

  console.log(
    "======================================"
  );

}

// ======================================================
// فحص صلاحية رسالة واتساب
// ======================================================

function checkWhatsAppPermission(
  message
) {

  const chatType =
    getChatType(
      message
    );

  const chatId =
    String(
      message?.key?.remoteJid ||
      ""
    );

  // ====================================================
  // مستخدم خاص
  // ====================================================

  if (
    chatType ===
    "user"
  ) {

    return isAllowedUser(
      chatId
    );

  }

  // ====================================================
  // مجموعة
  // ====================================================

  if (
    chatType ===
    "group"
  ) {

    const allowed =
      isAllowedGroup(
        chatId
      );

    if (!allowed) {

      return false;

    }

    if (
      groupOnlyWhenMentioned()
    ) {

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
// صفحة QR
// ======================================================

app.get(
  "/qr",
  async (
    req,
    res
  ) => {

    if (
      whatsappStatus ===
      "connected"
    ) {

      return res.send(`

<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>WhatsApp Connected</title>

<style>

body {
  font-family: Arial, sans-serif;
  background: #f3f4f6;
  margin: 0;
  padding: 30px;
  text-align: center;
}

.card {
  max-width: 500px;
  margin: auto;
  background: white;
  padding: 30px;
  border-radius: 18px;
  box-shadow: 0 5px 20px rgba(0,0,0,.08);
}

.ok {
  font-size: 60px;
}

h1 {
  color: #176b2c;
}

.info {
  background: #eef8f0;
  padding: 15px;
  border-radius: 10px;
  margin-top: 15px;
  line-height: 1.8;
  word-break: break-word;
}

a {
  display: block;
  margin-top: 15px;
  padding: 12px;
  background: #222;
  color: white;
  text-decoration: none;
  border-radius: 10px;
}

</style>

</head>

<body>

<div class="card">

<div class="ok">
🟢
</div>

<h1>
واتساب متصل
</h1>

<div class="info">

البوت متصل بحساب واتساب بنجاح.

<br><br>

JID:
<br>

${whatsappJid || "-"}

</div>

<a href="/status">
📊 حالة البوت
</a>

</div>

</body>

</html>

      `);

    }

    if (
      !whatsappQR
    ) {

      return res.send(`

<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<meta http-equiv="refresh"
content="5">

<title>WhatsApp QR</title>

<style>

body {
  font-family: Arial;
  background: #f3f4f6;
  text-align: center;
  padding: 30px;
}

.card {
  max-width: 500px;
  margin: auto;
  background: white;
  padding: 25px;
  border-radius: 18px;
}

</style>

</head>

<body>

<div class="card">

<h1>
📱 ربط واتساب
</h1>

<p>
⏳ جاري تجهيز رمز QR...
</p>

<p>
سيتم تحديث الصفحة تلقائياً.
</p>

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

            width:
              320,

            margin:
              2

          }
        );

      res.send(`

<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<meta http-equiv="refresh"
content="15">

<title>ربط واتساب</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 20px;
  background: #f3f4f6;
  font-family: Arial, sans-serif;
  text-align: center;
}

.card {
  max-width: 500px;
  margin: auto;
  background: white;
  padding: 25px;
  border-radius: 20px;
  box-shadow: 0 5px 25px rgba(0,0,0,.08);
}

h1 {
  margin-top: 0;
}

.qr {
  width: 320px;
  max-width: 90%;
  margin: 20px auto;
  display: block;
}

.steps {
  text-align: right;
  line-height: 2;
  background: #f8f8f8;
  padding: 15px;
  border-radius: 12px;
}

.status {
  margin-top: 15px;
  padding: 12px;
  border-radius: 10px;
  background: #fff3cd;
}

</style>

</head>

<body>

<div class="card">

<h1>
📱 ربط واتساب
</h1>

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

5️⃣ امسح رمز QR الظاهر فوق.

</div>

<div class="status">

🟡 بانتظار مسح رمز QR...

</div>

</div>

</body>

</html>

      `);

    } catch (
      error
    ) {

      console.error(
        "QR ERROR:",
        error.message
      );

      res
        .status(500)
        .send(
          "تعذر إنشاء QR"
        );

    }

  }
);

// ======================================================
// اختبار Gemini
// ======================================================

app.get(
  "/ai-test",
  async (
    req,
    res
  ) => {

    try {

      const question =
        req.query.q ||
        "مرحبا، عرفني بنفسك باختصار";

      if (!ai) {

        return res
          .status(500)
          .send(`

<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<title>اختبار AI</title>

</head>

<body style="
font-family:Arial;
padding:30px;
background:#f5f5f5;
">

<h2>
❌ Gemini AI غير مفعل
</h2>

<p>
تأكد من إضافة GEMINI_API_KEY في Environment Variables في Render.
</p>

</body>

</html>

        `);

      }

      const response =
        await ai.models.generateContent({

          model:
            "gemini-2.5-flash",

          contents:
            question,

          config: {

            temperature:
              0.2

          }

        });

      const answer =
        response.text ||
        "لم يتم الحصول على رد.";

      const safeQuestion =
        String(question)

          .replace(
            /&/g,
            "&amp;"
          )

          .replace(
            /</g,
            "&lt;"
          )

          .replace(
            />/g,
            "&gt;"
          );

      const safeAnswer =
        String(answer)

          .replace(
            /&/g,
            "&amp;"
          )

          .replace(
            /</g,
            "&lt;"
          )

          .replace(
            />/g,
            "&gt;"
          )

          .replace(
            /\n/g,
            "<br>"
          );

      res.send(`

<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>اختبار Gemini AI</title>

<style>

body {
  font-family: Arial, sans-serif;
  background: #f3f4f6;
  padding: 25px;
}

.box {
  max-width: 700px;
  margin: auto;
  background: white;
  padding: 25px;
  border-radius: 18px;
  box-shadow: 0 5px 25px rgba(0,0,0,.08);
}

.question {
  background: #eee;
  padding: 15px;
  border-radius: 10px;
}

.answer {
  background: #e9f7ef;
  padding: 15px;
  border-radius: 10px;
  line-height: 1.8;
}

a {
  display: inline-block;
  margin-top: 20px;
  padding: 12px 18px;
  background: #222;
  color: white;
  text-decoration: none;
  border-radius: 10px;
}

input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 10px;
  margin-top: 10px;
}

button {
  width: 100%;
  padding: 12px;
  margin-top: 10px;
  background: #222;
  color: white;
  border: 0;
  border-radius: 10px;
}

</style>

</head>

<body>

<div class="box">

<h1>
🤖 اختبار Gemini AI
</h1>

<form
method="GET"
action="/ai-test"
>

<input
type="text"
name="q"
value="${safeQuestion}"
placeholder="اكتب سؤالك هنا..."
>

<button type="submit">
اختبار AI
</button>

</form>

<h3>
السؤال:
</h3>

<div class="question">
${safeQuestion}
</div>

<h3>
رد الذكاء الاصطناعي:
</h3>

<div class="answer">
${safeAnswer}
</div>

<a href="/status">
📊 حالة السيرفر
</a>

<a href="/">
🏠 الصفحة الرئيسية
</a>

</div>

</body>

</html>

      `);

    } catch (
      error
    ) {

      console.error(
        "AI TEST ERROR:",
        error
      );

      res
        .status(500)
        .send(`

<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<title>AI Error</title>

</head>

<body style="
font-family:Arial;
padding:30px;
">

<h2>
❌ خطأ في Gemini AI
</h2>

<pre>
${String(error.message)

  .replace(
    /&/g,
    "&amp;"
  )

  .replace(
    /</g,
    "&lt;"
  )

  .replace(
    />/g,
    "&gt;"
  )}
</pre>

</body>

</html>

      `);

    }

  }
);

// ======================================================
// STATUS
// ======================================================

app.get(
  "/status",
  (
    req,
    res
  ) => {

    const uptime =
      process.uptime();

    const hours =
      Math.floor(
        uptime / 3600
      );

    const minutes =
      Math.floor(
        (uptime % 3600) / 60
      );

    const seconds =
      Math.floor(
        uptime % 60
      );

    const syriaNow =
      getSyriaNow();

    res.json({

      status:
        "online",

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

      officialHoliday:
        "الجمعة",

      officeOpenNow:
        isOpenNow(
          syriaNow
        ),

      ai:
        !!ai,

      aiProvider:
        "Google Gemini",

      whatsapp:
        whatsappStatus,

      whatsappConnected:
        whatsappStatus ===
        "connected",

      whatsappJid:
        whatsappJid,

      qrReady:
        !!whatsappQR,

      messagesReceived:
        messagesReceived,

      messagesReplied:
        messagesReplied,

      messagesBlocked:
        messagesBlocked,

      lastMessageTime:
        lastMessageTime,

      lastWhatsAppMessage:
        lastWhatsAppMessage,

      allowedUsers:
        getAllowedUsers(),

      allowedGroups:
        getAllowedGroups(),

      groupOnlyWhenMentioned:
        groupOnlyWhenMentioned(),

      uptime:
        `${hours}h ${minutes}m ${seconds}s`,

      syriaTime:
        syriaNow,

      serverTime:
        new Date().toISOString(),

      timestamp:
        Date.now()

    });

  }
);

// ======================================================
// اختبار استقبال الرسائل
// ======================================================

app.get(
  "/messages",
  (
    req,
    res
  ) => {

    res.json({

      listener:
        "enabled",

      whatsapp:
        whatsappStatus,

      connected:
        whatsappStatus ===
        "connected",

      messagesReceived:
        messagesReceived,

      messagesReplied:
        messagesReplied,

      messagesBlocked:
        messagesBlocked,

      lastMessageTime:
        lastMessageTime,

      lastWhatsAppMessage:
        lastWhatsAppMessage

    });

  }
);

// ======================================================
// الصفحة الرئيسية
// ======================================================

app.get(
  "/",
  (
    req,
    res
  ) => {

    const now =
      getSyriaNow();

    res.send(`

<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>
مساعد شركة الاتحاد
</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 25px;
  font-family: Arial, sans-serif;
  background: #f3f4f6;
}

.container {
  max-width: 650px;
  margin: auto;
}

.card {
  background: white;
  padding: 25px;
  border-radius: 18px;
  box-shadow: 0 5px 25px rgba(0,0,0,.08);
}

h1 {
  margin-top: 0;
}

.status {
  padding: 14px;
  border-radius: 10px;
  margin: 12px 0;
  background: #f5f5f5;
}

.time {
  background: #eef8ff;
  padding: 15px;
  border-radius: 10px;
  line-height: 1.8;
}

.stats {
  background: #fafafa;
  padding: 15px;
  border-radius: 10px;
  line-height: 2;
  margin-top: 15px;
}

a {
  display: block;
  padding: 14px;
  margin-top: 12px;
  border-radius: 10px;
  background: #222;
  color: white;
  text-decoration: none;
  text-align: center;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<h1>
🤖 مساعد شركة الاتحاد
</h1>

<div class="status">

${
  whatsappStatus ===
  "connected"

    ? "🟢 واتساب متصل"

    : whatsappStatus ===
      "qr_ready"

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
<b>
${now.timeText}
</b>

<br>

📅 التاريخ:
<b>
${now.dayName}
${now.dateText}
</b>

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

<div class="stats">

📩 الرسائل المستلمة:
<b>
${messagesReceived}
</b>

<br>

📤 الردود المرسلة:
<b>
${messagesReplied}
</b>

<br>

⛔ الرسائل المحجوبة:
<b>
${messagesBlocked}
</b>

</div>

<p>
شركة الاتحاد - مكتب الشعار للصرافة والحوالات
</p>

<a href="/qr">
📱 ربط واتساب / QR
</a>

<a href="/ai-test">
🤖 اختبار الذكاء الاصطناعي
</a>

<a href="/status">
📊 حالة السيرفر
</a>

<a href="/messages">
📩 فحص استقبال الرسائل
</a>

</div>

</div>

</body>

</html>

  `);

  }

);

// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    console.error(
      "SERVER ERROR:",
      err
    );

    res
      .status(500)
      .json({

        error:
          true,

        message:
          "حدث خطأ في السيرفر"

      });

  }
);

// ======================================================
// تشغيل السيرفر
// ======================================================

app.listen(
  PORT,
  async () => {

    console.log(
      "======================================"
    );

    console.log(
      "🚀 SERVER STARTED"
    );

    console.log(
      "======================================"
    );

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

    console.log(
      "======================================"
    );

    console.log(
      "👥 Allowed users:",
      getAllowedUsers()
    );

    console.log(
      "👥 Allowed groups:",
      getAllowedGroups()
    );

    console.log(
      "======================================"
    );

    try {

      console.log(
        "📱 Starting WhatsApp..."
      );

      await startWhatsApp();

      console.log(
        "✅ WhatsApp startup completed"
      );

    } catch (
      error
    ) {

      console.error(
        "❌ WhatsApp startup error:",
        error.message
      );

    }

  }
);
