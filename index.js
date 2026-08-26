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

// ======================================================
// Express
// ======================================================

const app = express();
const PORT = process.env.PORT || 3000;

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
  console.log(
    "Gemini AI: disabled - GEMINI_API_KEY not found"
  );
}

// ======================================================
// معلومات الشركة
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
// هل المجموعة تحتاج منشن؟
// ======================================================

function groupOnlyWhenMentioned() {

  return !!(
    config.permissions &&
    config.permissions.groupOnlyWhenMentioned
  );
}

// ======================================================
// استخراج رقم المرسل
// ======================================================

function getSenderId(message) {

  if (!message || !message.key) {
    return "";
  }

  return String(
    message.key.participant ||
    message.key.remoteJid ||
    ""
  );
}

// ======================================================
// معرفة نوع المحادثة
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

// ======================================================
// التحقق من المنشن
// ======================================================

function isMentioned(message, botJid) {

  if (!message) {
    return false;
  }

  const messageContent =
    message.message?.extendedTextMessage;

  const mentionedJid =
    messageContent?.contextInfo?.mentionedJid || [];

  if (!botJid) {
    return mentionedJid.length > 0;
  }

  return mentionedJid.some(
    jid => String(jid) === String(botJid)
  );
}

// ======================================================
// استخراج النص من رسالة واتساب
// ======================================================

function extractMessageText(message) {

  if (!message || !message.message) {
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

// ======================================================
// معرفة الرسائل الصوتية
// ======================================================

function isVoiceMessage(message) {

  return !!(
    message?.message?.audioMessage
  );
}

// ======================================================
// ردود الشركة الثابتة
// ======================================================

function getTodayDate() {

  return new Date()
    .toISOString()
    .slice(0, 10);
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
          "1- " +
          COMPANY.branches[0] +
          "\n" +
          "2- " +
          COMPANY.branches[1] +
          "\n\n" +
          COMPANY.mainBranch,
        type
      };

    // --------------------------------------------------
    // الدوام
    // --------------------------------------------------

    case "working_hours":

      if (
        getTodayDate() ===
        SPECIAL_HOLIDAY.date
      ) {

        return {
          reply:
            "⏱️ " +
            SPECIAL_HOLIDAY.text,
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
- افهم اللهجة الحلبية.
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

    const response =
      await ai.models.generateContent({

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

    if (
      !allowedTypes.includes(
        result.type
      )
    ) {

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
// ======================================================

function fallbackRouter(message) {

  const text =
    normalizeText(message);

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
    confidence:
      route.confidence
  };
}

// ======================================================
// WhatsApp
// ======================================================

const AUTH_FOLDER =
  path.join(
    process.cwd(),
    "auth_info_baileys"
  );

let whatsappSocket = null;

let whatsappStatus =
  "starting";

let currentQRCode =
  null;

let currentQRDataURL =
  null;

let whatsappJid =
  null;

// ======================================================
// الاتصال بواتساب
// ======================================================

async function connectToWhatsApp() {

  try {

    console.log(
      "======================================"
    );

    console.log(
      "Starting WhatsApp connection..."
    );

    whatsappStatus =
      "connecting";

    const {
      state,
      saveCreds
    } =
      await useMultiFileAuthState(
        AUTH_FOLDER
      );

    const sock =
      makeWASocket({

        auth: state,

        browser:
          Browsers.ubuntu(
            "Al-Ittihad AI Bot"
          ),

        logger:
          P({
            level: "silent"
          }),

        markOnlineOnConnect: false,

        printQRInTerminal: false
      });

    whatsappSocket =
      sock;

    // ==================================================
    // حفظ بيانات الجلسة
    // ==================================================

    sock.ev.on(
      "creds.update",
      saveCreds
    );

    // ==================================================
    // تحديث حالة الاتصال و QR
    // ==================================================

    sock.ev.on(
      "connection.update",
      async update => {

        const {
          connection,
          lastDisconnect,
          qr
        } = update;

        // ----------------------------------------------
        // QR
        // ----------------------------------------------

        if (qr) {

          currentQRCode =
            qr;

          try {

            currentQRDataURL =
              await QRCode.toDataURL(
                qr,
                {
                  width: 400,
                  margin: 2
                }
              );

            console.log(
              "📱 WhatsApp QR is ready."
            );

            console.log(
              "Open /qr to scan the QR code."
            );

          } catch (error) {

            console.log(
              "QR generation error:",
              error.message
            );
          }
        }

        // ----------------------------------------------
        // اتصال
        // ----------------------------------------------

        if (connection === "connecting") {

          whatsappStatus =
            "connecting";

          console.log(
            "🟡 WhatsApp connecting..."
          );
        }

        // ----------------------------------------------
        // متصل
        // ----------------------------------------------

        if (connection === "open") {

          whatsappStatus =
            "connected";

          currentQRCode =
            null;

          currentQRDataURL =
            null;

          whatsappJid =
            sock.user?.id ||
            null;

          console.log(
            "======================================"
          );

          console.log(
            "✅ WhatsApp connected successfully!"
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
        // انقطع الاتصال
        // ----------------------------------------------

        if (connection === "close") {

          whatsappStatus =
            "disconnected";

          const statusCode =
            lastDisconnect
              ?.error
              ?.output
              ?.statusCode;

          const shouldReconnect =
            statusCode !==
            DisconnectReason.loggedOut;

          console.log(
            "❌ WhatsApp connection closed."
          );

          console.log(
            "Status code:",
            statusCode
          );

          console.log(
            "Reconnect:",
            shouldReconnect
          );

          if (shouldReconnect) {

            whatsappStatus =
              "reconnecting";

            currentQRCode =
              null;

            currentQRDataURL =
              null;

            setTimeout(
              () => {

                connectToWhatsApp()
                  .catch(error => {

                    console.log(
                      "Reconnect error:",
                      error.message
                    );

                  });

              },
              3000
            );

          } else {

            console.log(
              "⚠️ WhatsApp logged out."
            );

            whatsappStatus =
              "logged_out";

            currentQRCode =
              null;

            currentQRDataURL =
              null;

            whatsappSocket =
              null;
          }
        }
      }
    );

    // ==================================================
    // استقبال الرسائل
    // ==================================================

    sock.ev.on(
      "messages.upsert",
      async ({ messages, type }) => {

        try {

          if (
            !messages ||
            !Array.isArray(messages)
          ) {
            return;
          }

          for (
            const message of messages
          ) {

            await handleWhatsAppMessage(
              sock,
              message
            );
          }

        } catch (error) {

          console.log(
            "WhatsApp message handler error:",
            error.message
          );
        }
      }
    );

  } catch (error) {

    whatsappStatus =
      "error";

    console.log(
      "WhatsApp startup error:",
      error.message
    );

    setTimeout(
      () => {

        connectToWhatsApp()
          .catch(err => {

            console.log(
              "WhatsApp retry error:",
              err.message
            );

          });

      },
      5000
    );
  }
}

// ======================================================
// معالجة رسالة واتساب
// ======================================================

async function handleWhatsAppMessage(
  sock,
  message
) {

  if (!message) {
    return;
  }

  // ----------------------------------------------
  // تجاهل الرسائل الصادرة من البوت نفسه
  // ----------------------------------------------

  if (message.key?.fromMe) {
    return;
  }

  // ----------------------------------------------
  // تجاهل Status
  // ----------------------------------------------

  const remoteJid =
    String(
      message.key?.remoteJid || ""
    );

  if (
    !remoteJid ||
    remoteJid === "status@broadcast"
  ) {
    return;
  }

  // ----------------------------------------------
  // معرفة نوع المحادثة
  // ----------------------------------------------

  const chatType =
    getChatType(message);

  // ----------------------------------------------
  // استخراج المرسل
  // ----------------------------------------------

  const senderId =
    getSenderId(message);

  console.log(
    "--------------------------------------"
  );

  console.log(
    "WhatsApp message received"
  );

  console.log(
    "Chat:",
    remoteJid
  );

  console.log(
    "Type:",
    chatType
  );

  console.log(
    "Sender:",
    senderId
  );

  // ----------------------------------------------
  // صلاحيات المستخدم
  // ----------------------------------------------

  if (chatType === "user") {

    if (
      !isAllowedUser(senderId) &&
      !isAllowedUser(remoteJid)
    ) {

      console.log(
        "⛔ User not allowed:",
        senderId
      );

      return;
    }
  }

  // ----------------------------------------------
  // صلاحيات المجموعة
  // ----------------------------------------------

  if (chatType === "group") {

    if (
      !isAllowedGroup(remoteJid)
    ) {

      console.log(
        "⛔ Group not allowed:",
        remoteJid
      );

      return;
    }

    // --------------------------------------------
    // إذا المجموعة تتطلب منشن
    // --------------------------------------------

    if (
      groupOnlyWhenMentioned()
    ) {

      const mentioned =
        isMentioned(
          message,
          whatsappJid
        );

      if (!mentioned) {

        console.log(
          "⏭️ Group message ignored - bot not mentioned"
        );

        return;
      }
    }
  }

  // ----------------------------------------------
  // رسالة صوتية
  // ----------------------------------------------

  if (
    isVoiceMessage(message)
  ) {

    const result =
      buildReply("voice");

    await sock.sendMessage(
      remoteJid,
      {
        text: result.reply
      }
    );

    console.log(
      "🤖 Voice reply sent."
    );

    return;
  }

  // ----------------------------------------------
  // استخراج النص
  // ----------------------------------------------

  let text =
    extractMessageText(message);

  if (!text) {

    console.log(
      "⏭️ Message has no readable text."
    );

    return;
  }

  // ----------------------------------------------
  // إزالة منشن البوت من النص
  // ----------------------------------------------

  text =
    text
      .replace(
        /@\d{5,20}/g,
        ""
      )
      .trim();

  if (!text) {
    return;
  }

  console.log(
    "Message:",
    text
  );

  // ----------------------------------------------
  // معالجة Gemini
  // ----------------------------------------------

  try {

    console.log(
      "🤖 Sending message to AI..."
    );

    const result =
      await generateAIReply(text);

    console.log(
      "AI type:",
      result.type
    );

    console.log(
      "AI confidence:",
      result.confidence
    );

    console.log(
      "AI reply:",
      result.reply
    );

    // --------------------------------------------
    // إرسال الرد
    // --------------------------------------------

    await sock.sendMessage(
      remoteJid,
      {
        text: result.reply
      }
    );

    console.log(
      "✅ Reply sent successfully."
    );

  } catch (error) {

    console.log(
      "❌ Reply error:",
      error.message
    );

    try {

      await sock.sendMessage(
        remoteJid,
        {
          text:
            "🌹 عذراً، حدث خطأ مؤقت. يرجى المحاولة مرة أخرى."
        }
      );

    } catch (sendError) {

      console.log(
        "Fallback reply error:",
        sendError.message
      );
    }
  }
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
  padding: 12px;
  border-radius: 8px;
  background: #e8f5e9;
  color: #176b2c;
  margin-bottom: 15px;
}

a {
  color: #1565c0;
  text-decoration: none;
}

.menu {
  display: grid;
  gap: 10px;
  margin-top: 20px;
}

.menu a {
  display: block;
  background: #f5f5f5;
  padding: 14px;
  border-radius: 10px;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<h1>🤖 مساعد شركة الاتحاد</h1>

<div class="status">
🟢 نظام البوت يعمل
</div>

<p>
📱 حالة واتساب:
<a href="/qr">
فتح صفحة ربط واتساب
</a>
</p>

<div class="menu">

<a href="/qr">
📷 QR — ربط واتساب
</a>

<a href="/status">
📊 حالة البوت
</a>

<a href="/test">
🧪 اختبار الذكاء الاصطناعي
</a>

</div>

</div>

</div>

</body>

</html>
  `);

});

// ======================================================
// صفحة QR
// ======================================================

app.get("/qr", (req, res) => {

  const connected =
    whatsappStatus ===
    "connected";

  if (connected) {

    return res.send(`
<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1">

<title>WhatsApp Connected</title>

<style>

body {
  font-family: Arial;
  background: #f3f4f6;
  text-align: center;
  padding: 30px;
}

.card {
  background: white;
  max-width: 500px;
  margin: auto;
  padding: 30px;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,.08);
}

.ok {
  font-size: 60px;
}

</style>

</head>

<body>

<div class="card">

<div class="ok">✅</div>

<h2>واتساب متصل</h2>

<p>
البوت مربوط بواتساب بنجاح.
</p>

<p>
${whatsappJid || ""}
</p>

<a href="/status">
📊 عرض الحالة
</a>

</div>

</body>

</html>
    `);
  }

  if (!currentQRDataURL) {

    return res.send(`
<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1">

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
  background: white;
  max-width: 500px;
  margin: auto;
  padding: 30px;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,.08);
}

.loader {
  font-size: 50px;
}

</style>

</head>

<body>

<div class="card">

<div class="loader">⏳</div>

<h2>جاري تجهيز QR</h2>

<p>
حالة واتساب:
${whatsappStatus}
</p>

<p>
الصفحة رح تتحدث تلقائياً.
</p>

</div>

</body>

</html>
    `);
  }

  res.send(`
<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1">

<meta http-equiv="refresh"
content="20">

<title>ربط واتساب</title>

<style>

body {
  font-family: Arial;
  background: #f3f4f6;
  text-align: center;
  padding: 20px;
}

.card {
  background: white;
  max-width: 500px;
  margin: auto;
  padding: 25px;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,.08);
}

img {
  width: 100%;
  max-width: 400px;
  border-radius: 12px;
}

.step {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 10px;
  margin-top: 10px;
  text-align: right;
}

</style>

</head>

<body>

<div class="card">

<h2>📱 ربط واتساب</h2>

<p>
امسح رمز QR من تطبيق واتساب على الهاتف.
</p>

<img
src="${currentQRDataURL}"
alt="WhatsApp QR"
/>

<div class="step">
<b>1.</b>
افتح واتساب على الهاتف.
</div>

<div class="step">
<b>2.</b>
الإعدادات ← الأجهزة المرتبطة.
</div>

<div class="step">
<b>3.</b>
اضغط "ربط جهاز".
</div>

<div class="step">
<b>4.</b>
امسح رمز QR الظاهر بالأعلى.
</div>

<p>
🔄 سيتم تحديث الحالة تلقائياً.
</p>

</div>

</body>

</html>
  `);

});

// ======================================================
// اختبار AI
// ======================================================

app.get("/test", (req, res) => {

  res.send(`
<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1">

<title>اختبار AI</title>

<style>

body {
  font-family: Arial;
  background: #f3f4f6;
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

textarea,
button {
  width: 100%;
  padding: 13px;
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
  cursor: pointer;
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

</style>

</head>

<body>

<div class="container">

<div class="card">

<h2>🤖 اختبار فهم الذكاء الاصطناعي</h2>

<textarea
id="message"
placeholder="مثال: وين مكتبكن؟"
></textarea>

<button onclick="testAI()">
اختبار
</button>

<div id="result"></div>

</div>

</div>

<script>

async function testAI() {

  const message =
    document
      .getElementById("message")
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
    "⏳ جاري الفهم...";

  try {

    const response =
      await fetch("/test-ai", {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          message
        })

      });

    const data =
      await response.json();

    if (!response.ok) {

      result.className =
        "error";

      result.innerText =
        "❌ " +
        (data.error ||
        "حدث خطأ.");

      return;
    }

    result.className =
      "reply";

    result.innerText =
      "🤖 الرد المقترح:\\n\\n" +
      data.reply +
      "\\n\\n" +
      "📌 التصنيف: " +
      data.type +
      "\\n" +
      "🎯 الثقة: " +
      Math.round(
        (data.confidence || 0) *
        100
      ) +
      "%";

  } catch (error) {

    result.className =
      "error";

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

app.post("/test-ai", async (req, res) => {

  try {

    const message =
      String(
        req.body.message || ""
      ).trim();

    if (!message) {

      return res
        .status(400)
        .json({
          error:
            "الرسالة فارغة"
        });
    }

    const result =
      await generateAIReply(
        message
      );

    res.json(result);

  } catch (error) {

    console.log(
      "Test AI error:",
      error.message
    );

    res
      .status(500)
      .json({
        error:
          "حدث خطأ أثناء معالجة الرسالة."
      });
  }

});

// ======================================================
// اختبار رسالة مع الصلاحيات
// ======================================================

app.post(
  "/test-message",
  async (req, res) => {

    const chatType =
      req.body.chatType;

    const chatId =
      String(
        req.body.chatId || ""
      );

    const message =
      String(
        req.body.message || ""
      );

    let allowed = false;

    if (
      chatType === "user"
    ) {

      allowed =
        isAllowedUser(
          chatId
        );
    }

    if (
      chatType === "group"
    ) {

      allowed =
        isAllowedGroup(
          chatId
        );
    }

    if (!allowed) {

      return res.json({

        allowed: false,

        reason:
          "هذا الشخص أو المجموعة غير موجود ضمن قائمة المسموح لهم."

      });
    }

    const result =
      await generateAIReply(
        message
      );

    res.json({

      allowed: true,

      reply:
        result.reply,

      type:
        result.type,

      confidence:
        result.confidence

    });

  }
);

// ======================================================
// اختبار الصلاحية
// ======================================================

app.post(
  "/test-permission",
  (req, res) => {

    const chatType =
      req.body.chatType;

    const chatId =
      String(
        req.body.chatId || ""
      );

    if (!chatId) {

      return res.json({

        allowed: false,

        reason:
          "المعرّف فارغ"

      });
    }

    if (
      chatType === "user"
    ) {

      const allowed =
        isAllowedUser(
          chatId
        );

      return res.json({

        allowed,

        reason:
          allowed
            ? "الشخص موجود ضمن قائمة المسموح لهم"
            : "الشخص غير موجود ضمن قائمة المسموح لهم"

      });

    }

    if (
      chatType === "group"
    ) {

      const allowed =
        isAllowedGroup(
          chatId
        );

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

  }
);

// ======================================================
// حالة البوت
// ======================================================

app.get("/status", (req, res) => {

  const users =
    config.permissions &&
    Array.isArray(
      config.permissions.allowedUsers
    )
      ? config.permissions.allowedUsers.length
      : 0;

  const groups =
    config.permissions &&
    Array.isArray(
      config.permissions.allowedGroups
    )
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
        : "Gemini disabled",

    whatsapp:
      whatsappStatus,

    whatsappJid:
      whatsappJid || null,

    qrAvailable:
      !!currentQRDataURL

  });

});

// ======================================================
// API حالة WhatsApp
// ======================================================

app.get(
  "/whatsapp-status",
  (req, res) => {

    res.json({

      status:
        whatsappStatus,

      connected:
        whatsappStatus ===
        "connected",

      jid:
        whatsappJid || null,

      qrAvailable:
        !!currentQRDataURL

    });

  }
);

// ======================================================
// تشغيل السيرفر
// ======================================================

app.listen(
  PORT,
  () => {

    console.log(
      "======================================"
    );

    console.log(
      "Server running on port " +
      PORT
    );

    console.log(
      "WhatsApp QR page: /qr"
    );

    console.log(
      "AI test page: /test"
    );

    console.log(
      "Status: /status"
    );

    console.log(
      "======================================"
    );

  }
);

// ======================================================
// تشغيل WhatsApp
// ======================================================

connectToWhatsApp()
  .catch(error => {

    console.log(
      "Initial WhatsApp connection error:",
      error.message
    );

  });
