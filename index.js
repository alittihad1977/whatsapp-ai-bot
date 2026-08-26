"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const P = require("pino");
const QRCode = require("qrcode");

const { GoogleGenAI } = require("@google/genai");

const config = require("./config.json");

// ============================================================
// الإعدادات العامة
// ============================================================

const app = express();

const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const AUTH_DIR = path.join(__dirname, "auth_info_baileys");

let sock = null;
let currentQR = null;
let whatsappConnected = false;
let reconnectTimer = null;
let startingWhatsApp = false;

let lastMessage = null;
let lastAIResponse = null;
let lastError = null;

// ============================================================
// GEMINI
// ============================================================

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  "";

let gemini = null;

if (GEMINI_API_KEY) {
  try {
    gemini = new GoogleGenAI({
      apiKey: GEMINI_API_KEY
    });

    console.log("Gemini AI: enabled");
  } catch (error) {
    console.log("Gemini AI initialization error:", error.message);
    gemini = null;
  }
} else {
  console.log("Gemini AI: disabled - GEMINI_API_KEY not found");
}

// ============================================================
// معلومات الشركة
// ============================================================

const COMPANY_NAME =
  config?.company?.name ||
  "شركة الاتحاد للصرافة والحوالات";

const BRANCH_NAME =
  config?.company?.branch ||
  "مكتب الشعار";

const WORKING_HOURS =
  config?.company?.workingHours ||
  "10:00 - 18:00";

const HOLIDAY =
  config?.company?.holiday ||
  "الجمعة";

const BOT_NAME =
  config?.bot?.name ||
  "مساعد شركة الاتحاد";

const BOT_ENABLED =
  config?.bot?.enabled !== false;

// ============================================================
// الصلاحيات
// ============================================================

function getAllowedUsers() {
  if (
    !config ||
    !config.permissions ||
    !Array.isArray(config.permissions.allowedUsers)
  ) {
    return [];
  }

  return config.permissions.allowedUsers
    .map(x => String(x).trim())
    .filter(Boolean);
}

function getAllowedGroups() {
  if (
    !config ||
    !config.permissions ||
    !Array.isArray(config.permissions.allowedGroups)
  ) {
    return [];
  }

  return config.permissions.allowedGroups
    .map(x => String(x).trim())
    .filter(Boolean);
}

function normalizePhone(value) {
  if (!value) return "";

  return String(value)
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@lid$/i, "")
    .replace(/[^0-9]/g, "");
}

function isGroupJid(jid) {
  return String(jid || "").endsWith("@g.us");
}

function isAllowedUser(jid) {
  const allowedUsers = getAllowedUsers();

  // ========================================================
  // أهم تعديل:
  // allowedUsers فارغة = السماح للجميع
  // ========================================================

  if (allowedUsers.length === 0) {
    return true;
  }

  const jidText = String(jid || "");

  const jidNumber = normalizePhone(jidText);

  return allowedUsers.some(user => {
    const normalized = normalizePhone(user);

    if (!normalized) return false;

    return (
      jidText === user ||
      jidNumber === normalized ||
      jidText.includes(normalized) ||
      jidNumber.includes(normalized)
    );
  });
}

function isAllowedGroup(jid) {
  const allowedGroups = getAllowedGroups();

  // إذا لم يتم تحديد مجموعات، نسمح للمجموعات حسب الإعداد العام.
  if (allowedGroups.length === 0) {
    return true;
  }

  const jidText = String(jid || "");

  return allowedGroups.some(group => {
    return jidText === group || jidText.includes(group);
  });
}

function isMessageAllowed(jid, isGroup) {
  if (!isGroup) {
    return isAllowedUser(jid);
  }

  return isAllowedGroup(jid);
}

// ============================================================
// الوقت والتاريخ
// ============================================================

function getSyriaDateTime() {
  const now = new Date();

  const date = new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);

  const time = new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(now);

  const weekday = new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    weekday: "long"
  }).format(now);

  return {
    date,
    time,
    weekday
  };
}

// ============================================================
// تنظيف النص
// ============================================================

function cleanText(text) {
  if (!text) return "";

  return String(text)
    .replace(/\u200e/g, "")
    .replace(/\u200f/g, "")
    .replace(/\u202a/g, "")
    .replace(/\u202b/g, "")
    .replace(/\u202c/g, "")
    .trim();
}

// ============================================================
// استخراج الرسالة
// ============================================================

function extractMessageText(message) {
  if (!message) return "";

  const m = message.message;

  if (!m) return "";

  if (m.conversation) {
    return cleanText(m.conversation);
  }

  if (m.extendedTextMessage?.text) {
    return cleanText(m.extendedTextMessage.text);
  }

  if (m.imageMessage?.caption) {
    return cleanText(m.imageMessage.caption);
  }

  if (m.videoMessage?.caption) {
    return cleanText(m.videoMessage.caption);
  }

  if (m.documentMessage?.caption) {
    return cleanText(m.documentMessage.caption);
  }

  return "";
}

// ============================================================
// نوع الرسالة
// ============================================================

function getMessageType(message) {
  if (!message?.message) {
    return "unknown";
  }

  const m = message.message;

  if (m.conversation) return "text";
  if (m.extendedTextMessage) return "text";
  if (m.imageMessage) return "image";
  if (m.videoMessage) return "video";
  if (m.audioMessage) return "audio";
  if (m.documentMessage) return "document";
  if (m.stickerMessage) return "sticker";
  if (m.contactMessage) return "contact";
  if (m.locationMessage) return "location";

  return "unknown";
}

// ============================================================
// تعليمات Gemini
// ============================================================

function buildSystemPrompt() {
  const dt = getSyriaDateTime();

  return `
أنت ${BOT_NAME}، المساعد الذكي الرسمي الخاص بـ ${COMPANY_NAME}.

معلومات الشركة:
- اسم الشركة: ${COMPANY_NAME}
- الفرع: ${BRANCH_NAME}
- الدوام: ${WORKING_HOURS}
- العطلة الرسمية الأسبوعية: ${HOLIDAY}

الوقت الحالي في سوريا:
- التاريخ: ${dt.date}
- اليوم: ${dt.weekday}
- الساعة: ${dt.time}

قواعد مهمة جداً:

1. أجب باللغة العربية.
2. استخدم اللهجة السورية بشكل طبيعي عند الحاجة، لكن حافظ على أسلوب محترم واحترافي.
3. أنت مساعد لشركة صرافة وحوالات مالية.
4. إذا سأل المستخدم عن الشركة أو الفرع أو الدوام، استخدم المعلومات الموجودة أعلاه.
5. إذا سأل المستخدم عن الوقت أو التاريخ، استخدم الوقت الحالي الموجود في التعليمات.
6. لا تخترع أسعار صرف غير موجودة في المعلومات التي أعطيت لك.
7. لا تخترع أرقام هواتف أو عناوين أو فروعاً غير معروفة.
8. إذا لم تكن تعرف معلومة مؤكدة، قل للمستخدم إن هذه المعلومة غير متوفرة لديك بدلاً من اختراعها.
9. لا تقل للمستخدم أنك نموذج ذكاء اصطناعي إلا إذا سأل بشكل مباشر.
10. لا تطيل الإجابة دون داعٍ.
11. إذا كان السؤال بسيطاً، أجب بإجابة قصيرة وواضحة.
12. إذا سأل المستخدم "وين مكتبكن" أو "وين الفرع" أو "وينكن"، افهم أنه يسأل عن موقع الفرع، وأعطه المعلومات المتوفرة فقط.
13. إذا قال المستخدم "مرحبا"، رحب به بطريقة لطيفة.
14. إذا قال "شكراً"، رد بشكل مختصر ولطيف.
15. إذا قال "مين انت"، قل إنك ${BOT_NAME}.
16. لا تطلب من المستخدم كتابة السؤال بطريقة معينة. حاول فهم كلامه حتى لو كان باللهجة السورية أو فيه أخطاء إملائية.
17. افهم الكلمات المختصرة والأخطاء الشائعة قدر الإمكان.
18. لا تضف معلومات مالية حساسة أو غير مؤكدة.
19. لا تدّعي أنك نفذت حوالة أو عملية مالية فعلية.
20. إذا طلب المستخدم تنفيذ عملية مالية فعلية، وضح له أن تنفيذ العملية يتم عن طريق موظفي الشركة.
`;
}

// ============================================================
// استدعاء Gemini
// ============================================================

async function askGemini(userText, context = {}) {
  if (!gemini) {
    return "عذراً، خدمة الذكاء الاصطناعي غير مفعلة حالياً.";
  }

  const dt = getSyriaDateTime();

  const prompt = `
${buildSystemPrompt()}

معلومات إضافية عن المحادثة:
- رقم/معرف المستخدم: ${context.sender || "غير معروف"}
- المجموعة: ${context.isGroup ? "نعم" : "لا"}
- الوقت الحالي في سوريا: ${dt.date} ${dt.time} - ${dt.weekday}

رسالة المستخدم:
${userText}

أجب مباشرة على المستخدم.
`;

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    let answer = "";

    if (typeof response?.text === "string") {
      answer = response.text;
    } else if (response?.response?.text) {
      answer = response.response.text();
    } else if (response?.candidates?.[0]?.content?.parts) {
      answer = response.candidates[0].content.parts
        .map(part => part.text || "")
        .join("");
    }

    answer = cleanText(answer);

    if (!answer) {
      return "عذراً، لم أتمكن من توليد إجابة حالياً.";
    }

    return answer;
  } catch (error) {
    lastError = error.message || String(error);

    console.log("❌ Gemini error:", lastError);

    return "عذراً، حدث خطأ مؤقت أثناء معالجة رسالتك. حاول مرة أخرى بعد قليل.";
  }
}

// ============================================================
// إرسال الرسالة
// ============================================================

async function sendText(jid, text) {
  if (!sock || !whatsappConnected) {
    throw new Error("WhatsApp is not connected");
  }

  if (!jid || !text) {
    throw new Error("Missing jid or text");
  }

  return await sock.sendMessage(jid, {
    text: String(text)
  });
}

// ============================================================
// التعامل مع الرسائل
// ============================================================

async function handleIncomingMessage(message) {
  try {
    if (!message) return;

    if (message.key?.fromMe) {
      return;
    }

    const jid = message.key?.remoteJid;

    if (!jid) {
      return;
    }

    if (
      jid === "status@broadcast" ||
      jid.endsWith("@broadcast")
    ) {
      return;
    }

    const isGroup = isGroupJid(jid);

    const type = getMessageType(message);

    const text = extractMessageText(message);

    console.log("--------------------------------------");
    console.log("📩 NEW WHATSAPP MESSAGE");
    console.log("Chat:", jid);
    console.log("Type:", type);
    console.log("Text:", text || "(no text)");

    // ========================================================
    // الصلاحيات
    // ========================================================

    if (!isMessageAllowed(jid, isGroup)) {
      console.log("⛔ Message blocked by permissions");
      console.log("--------------------------------------");
      return;
    }

    // ========================================================
    // المجموعات
    // ========================================================

    if (isGroup) {
      const mentionOnly =
        config?.permissions?.groupOnlyWhenMentioned !== false;

      if (mentionOnly) {
        const botJid = sock?.user?.id || "";

        const mentioned =
          message.message?.extendedTextMessage?.contextInfo
            ?.mentionedJid || [];

        const botNumber = normalizePhone(botJid);

        const isMentioned = mentioned.some(x => {
          return normalizePhone(x) === botNumber;
        });

        if (!isMentioned) {
          console.log("👥 Group message ignored - bot not mentioned");
          return;
        }
      }
    }

    // ========================================================
    // إذا ما في نص
    // ========================================================

    if (!text) {
      console.log("ℹ️ Message has no readable text.");

      if (type === "image") {
        await sendText(
          jid,
          "وصلتني الصورة 👍 لكن حالياً أستطيع التعامل مع الرسائل النصية. اكتب لي ماذا تريد وسأساعدك."
        );
      }

      return;
    }

    // ========================================================
    // إذا البوت معطل
    // ========================================================

    if (!BOT_ENABLED) {
      console.log("🔴 Bot disabled");
      return;
    }

    // ========================================================
    // حفظ آخر رسالة
    // ========================================================

    lastMessage = {
      jid,
      text,
      type,
      isGroup,
      receivedAt: new Date().toISOString()
    };

    // ========================================================
    // أوامر خاصة
    // ========================================================

    const normalizedText = text
      .toLowerCase()
      .replace(/[؟?!.,،]/g, "")
      .trim();

    if (
      normalizedText === "ping" ||
      normalizedText === "بنغ"
    ) {
      await sendText(jid, "🟢 البوت يعمل بشكل طبيعي.");
      return;
    }

    if (
      normalizedText === "وقت" ||
      normalizedText === "الوقت" ||
      normalizedText === "كم الساعة" ||
      normalizedText === "شو الساعة"
    ) {
      const dt = getSyriaDateTime();

      await sendText(
        jid,
        `🕐 الوقت الآن في سوريا: ${dt.time}\n📅 ${dt.weekday} ${dt.date}`
      );

      return;
    }

    if (
      normalizedText === "التاريخ" ||
      normalizedText === "شو التاريخ" ||
      normalizedText === "تاريخ اليوم"
    ) {
      const dt = getSyriaDateTime();

      await sendText(
        jid,
        `📅 اليوم: ${dt.weekday}\n🗓️ التاريخ: ${dt.date}`
      );

      return;
    }

    // ========================================================
    // إرسال إلى Gemini
    // ========================================================

    console.log("🤖 Sending message to Gemini...");

    const answer = await askGemini(text, {
      sender: jid,
      isGroup
    });

    console.log("🤖 Gemini response:", answer);

    lastAIResponse = {
      question: text,
      answer,
      sentAt: new Date().toISOString()
    };

    await sendText(jid, answer);

    console.log("✅ Reply sent");
    console.log("--------------------------------------");

  } catch (error) {
    lastError = error.message || String(error);

    console.log("❌ Message handling error:", lastError);

    try {
      if (message?.key?.remoteJid) {
        await sendText(
          message.key.remoteJid,
          "عذراً، حدث خطأ مؤقت. حاول إرسال رسالتك مرة أخرى."
        );
      }
    } catch (sendError) {
      console.log(
        "❌ Error sending error message:",
        sendError.message
      );
    }
  }
}

// ============================================================
// تشغيل واتساب
// ============================================================

async function startWhatsApp() {
  if (startingWhatsApp) {
    console.log("🟡 WhatsApp startup already in progress.");
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
    } = await useMultiFileAuthState(AUTH_DIR);

    let version;

    try {
      const latest = await fetchLatestBaileysVersion();

      if (latest?.version) {
        version = latest.version;
        console.log(
          "📦 Baileys version:",
          version.join(".")
        );
      }
    } catch (versionError) {
      console.log(
        "⚠️ Could not fetch latest WhatsApp version:",
        versionError.message
      );
    }

    const socketOptions = {
      auth: state,

      logger: P({
        level: "silent"
      }),

      browser: Browsers.ubuntu("Chrome"),

      printQRInTerminal: false,

      generateHighQualityLinkPreview: false,

      syncFullHistory: false
    };

    if (version) {
      socketOptions.version = version;
    }

    sock = makeWASocket(socketOptions);

    // ========================================================
    // حفظ بيانات الدخول
    // ========================================================

    sock.ev.on("creds.update", saveCreds);

    console.log("✅ WhatsApp event listeners installed.");

    // ========================================================
    // الرسائل
    // ========================================================

    sock.ev.on(
      "messages.upsert",
      async ({ messages, type }) => {
        try {
          if (type !== "notify") {
            return;
          }

          for (const message of messages) {
            await handleIncomingMessage(message);
          }
        } catch (error) {
          console.log(
            "❌ messages.upsert error:",
            error.message
          );
        }
      }
    );

    console.log("📩 Message listener: ENABLED");

    // ========================================================
    // تحديث حالة الاتصال
    // ========================================================

    sock.ev.on(
      "connection.update",
      async update => {
        const {
          connection,
          lastDisconnect,
          qr
        } = update;

        // ----------------------------------------------------
        // QR
        // ----------------------------------------------------

        if (qr) {
          currentQR = qr;
          whatsappConnected = false;

          console.log("======================================");
          console.log("📱 WhatsApp QR is ready.");
          console.log("Open /qr to scan the QR code.");
          console.log("======================================");
        }

        // ----------------------------------------------------
        // متصل
        // ----------------------------------------------------

        if (connection === "open") {
          whatsappConnected = true;
          currentQR = null;
          lastError = null;

          console.log("======================================");
          console.log("🟢 WhatsApp connected!");
          console.log(
            "WhatsApp JID:",
            sock?.user?.id || "unknown"
          );
          console.log("======================================");
        }

        // ----------------------------------------------------
        // إغلاق الاتصال
        // ----------------------------------------------------

        if (connection === "close") {
          whatsappConnected = false;

          let statusCode = null;

          try {
            statusCode =
              lastDisconnect?.error?.output?.statusCode ||
              lastDisconnect?.error?.statusCode ||
              null;
          } catch (_) {}

          console.log("======================================");
          console.log("🔴 WhatsApp disconnected.");
          console.log("Status code:", statusCode);
          console.log("======================================");

          startingWhatsApp = false;

          // تسجيل خروج فعلي
          if (
            statusCode === DisconnectReason.loggedOut ||
            statusCode === 401
          ) {
            console.log(
              "🔴 WhatsApp logged out. Delete auth_info_baileys and scan QR again."
            );

            return;
          }

          // إعادة الاتصال
          if (!reconnectTimer) {
            console.log(
              "🟡 Reconnecting in 5 seconds..."
            );

            reconnectTimer = setTimeout(
              async () => {
                reconnectTimer = null;

                try {
                  await startWhatsApp();
                } catch (error) {
                  console.log(
                    "❌ Reconnection error:",
                    error.message
                  );
                }
              },
              5000
            );
          }
        }
      }
    );

    console.log("✅ WhatsApp startup completed");

  } catch (error) {
    startingWhatsApp = false;

    lastError = error.message || String(error);

    console.log(
      "❌ WhatsApp startup error:",
      lastError
    );

    if (!reconnectTimer) {
      reconnectTimer = setTimeout(
        async () => {
          reconnectTimer = null;

          try {
            await startWhatsApp();
          } catch (err) {
            console.log(
              "❌ Retry startup error:",
              err.message
            );
          }
        },
        10000
      );
    }
  }
}

// ============================================================
// الصفحة الرئيسية
// ============================================================

app.get("/", (req, res) => {
  const dt = getSyriaDateTime();

  res.json({
    status: "online",
    bot: BOT_NAME,
    enabled: BOT_ENABLED,
    company: COMPANY_NAME,
    branch: BRANCH_NAME,
    workingHours: WORKING_HOURS,
    holiday: HOLIDAY,
    whatsapp: whatsappConnected
      ? "connected"
      : "disconnected",
    gemini: gemini
      ? "enabled"
      : "disabled",
    date: dt.date,
    time: dt.time,
    weekday: dt.weekday
  });
});

// ============================================================
// STATUS
// ============================================================

app.get("/status", (req, res) => {
  const allowedUsers = getAllowedUsers();
  const allowedGroups = getAllowedGroups();

  const dt = getSyriaDateTime();

  res.json({
    status: "online",

    bot: BOT_NAME,

    enabled: BOT_ENABLED,

    company: COMPANY_NAME,

    branch: BRANCH_NAME,

    workingHours: WORKING_HOURS,

    holiday: HOLIDAY,

    whatsapp: {
      connected: whatsappConnected,

      jid: sock?.user?.id || null,

      qrReady: !!currentQR
    },

    gemini: {
      enabled: !!gemini
    },

    permissions: {
      allowedUsers,
      allowedGroups,

      emptyUsersMeansAllUsers:
        allowedUsers.length === 0
    },

    syriaTime: dt,

    lastMessage,

    lastAIResponse,

    lastError,

    serverTime: new Date().toISOString()
  });
});

// ============================================================
// QR
// ============================================================

app.get("/qr", async (req, res) => {
  try {
    if (whatsappConnected) {
      return res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>WhatsApp Bot</title>
<style>
body {
  font-family: Arial, sans-serif;
  text-align: center;
  background: #f5f5f5;
  padding: 40px;
}
.box {
  background: white;
  max-width: 500px;
  margin: auto;
  padding: 30px;
  border-radius: 20px;
  box-shadow: 0 5px 25px rgba(0,0,0,.1);
}
.ok {
  color: green;
  font-size: 25px;
  font-weight: bold;
}
</style>
</head>
<body>
<div class="box">
<div class="ok">🟢 واتساب متصل</div>
<p>البوت متصل بحساب واتساب ويعمل بشكل طبيعي.</p>
<p>${BOT_NAME}</p>
</div>
</body>
</html>
      `);
    }

    if (!currentQR) {
      return res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="5">
<title>WhatsApp QR</title>
<style>
body {
  font-family: Arial, sans-serif;
  text-align: center;
  background: #f5f5f5;
  padding: 40px;
}
.box {
  background: white;
  max-width: 500px;
  margin: auto;
  padding: 30px;
  border-radius: 20px;
  box-shadow: 0 5px 25px rgba(0,0,0,.1);
}
</style>
</head>
<body>
<div class="box">
<h2>📱 WhatsApp</h2>
<p>جاري تجهيز رمز QR...</p>
<p>سيتم تحديث الصفحة تلقائياً.</p>
</div>
</body>
</html>
      `);
    }

    const qrDataUrl = await QRCode.toDataURL(
      currentQR,
      {
        width: 350,
        margin: 2
      }
    );

    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="10">

<title>ربط واتساب - ${BOT_NAME}</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 20px;
  font-family: Arial, sans-serif;
  background: #f1f3f5;
  text-align: center;
}

.box {
  max-width: 500px;
  margin: auto;
  background: white;
  padding: 25px;
  border-radius: 20px;
  box-shadow: 0 8px 30px rgba(0,0,0,.12);
}

h1 {
  margin-top: 0;
}

img {
  width: 350px;
  max-width: 100%;
  height: auto;
}

.steps {
  text-align: right;
  line-height: 2;
  margin-top: 20px;
}

.note {
  margin-top: 20px;
  padding: 15px;
  background: #fff3cd;
  border-radius: 10px;
}
</style>
</head>

<body>

<div class="box">

<h1>📱 ربط واتساب</h1>

<p>افتح واتساب في الهاتف الرئيسي:</p>

<div class="steps">

1️⃣ الإعدادات

<br>

2️⃣ الأجهزة المرتبطة

<br>

3️⃣ ربط جهاز

<br>

4️⃣ امسح رمز QR الموجود أسفل الصفحة

</div>

<img src="${qrDataUrl}" alt="WhatsApp QR">

<div class="note">
⚠️ رمز QR يتغير عند الحاجة.
<br>
سيتم تحديث الصفحة تلقائياً.
</div>

<p>${BOT_NAME}</p>

</div>

</body>
</html>
    `);

  } catch (error) {
    lastError = error.message || String(error);

    res.status(500).json({
      error: "QR unavailable",
      message: lastError
    });
  }
});

// ============================================================
// AI TEST
// ============================================================

app.get("/ai-test", async (req, res) => {
  try {
    const question =
      req.query.q ||
      "مرحبا، عرفني عن نفسك";

    const answer = await askGemini(question, {
      sender: "web-test",
      isGroup: false
    });

    res.json({
      success: true,
      question,
      answer,
      gemini: !!gemini,
      time: getSyriaDateTime()
    });

  } catch (error) {
    lastError = error.message || String(error);

    res.status(500).json({
      success: false,
      error: lastError
    });
  }
});

// ============================================================
// اختبار إرسال رسالة
// ============================================================

app.post("/send", async (req, res) => {
  try {
    const { jid, message } = req.body || {};

    if (!jid || !message) {
      return res.status(400).json({
        success: false,
        error: "jid and message are required"
      });
    }

    if (!whatsappConnected) {
      return res.status(503).json({
        success: false,
        error: "WhatsApp is not connected"
      });
    }

    await sendText(jid, message);

    res.json({
      success: true,
      sentTo: jid,
      message
    });

  } catch (error) {
    lastError = error.message || String(error);

    res.status(500).json({
      success: false,
      error: lastError
    });
  }
});

// ============================================================
// معلومات الشركة
// ============================================================

app.get("/company", (req, res) => {
  const dt = getSyriaDateTime();

  res.json({
    bot: BOT_NAME,

    company: COMPANY_NAME,

    branch: BRANCH_NAME,

    workingHours: WORKING_HOURS,

    holiday: HOLIDAY,

    date: dt.date,

    time: dt.time,

    weekday: dt.weekday
  });
});

// ============================================================
// Ping
// ============================================================

app.get("/ping", (req, res) => {
  res.json({
    pong: true,
    time: new Date().toISOString()
  });
});

// ============================================================
// تشغيل السيرفر
// ============================================================

app.listen(PORT, () => {
  console.log("======================================");
  console.log("🚀 SERVER STARTED");
  console.log("======================================");

  console.log("📡 Port:", PORT);
  console.log("📊 Status: /status");
  console.log("📱 WhatsApp: /qr");
  console.log("🤖 AI Test: /ai-test");
  console.log("📩 Message listener: ENABLED");

  console.log("======================================");

  const allowedUsers = getAllowedUsers();
  const allowedGroups = getAllowedGroups();

  console.log("👥 Allowed users:", allowedUsers);
  console.log("👥 Allowed groups:", allowedGroups);

  if (allowedUsers.length === 0) {
    console.log(
      "🟢 Empty allowedUsers = ALL USERS ARE ALLOWED"
    );
  } else {
    console.log(
      "🔒 Only configured users are allowed"
    );
  }

  console.log("======================================");
  console.log("📱 Starting WhatsApp...");
  console.log("======================================");

  startWhatsApp();
});

// ============================================================
// معالجة أخطاء Node
// ============================================================

process.on("uncaughtException", error => {
  console.log(
    "❌ UNCAUGHT EXCEPTION:",
    error?.stack || error?.message || error
  );
});

process.on("unhandledRejection", error => {
  console.log(
    "❌ UNHANDLED REJECTION:",
    error?.stack || error?.message || error
  );
});

// ============================================================
// إغلاق آمن
// ============================================================

async function shutdown(signal) {
  console.log(`\n🛑 Received ${signal}`);

  try {
    if (sock) {
      sock.end(undefined);
    }
  } catch (error) {
    console.log(
      "Shutdown WhatsApp error:",
      error.message
    );
  }

  process.exit(0);
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  shutdown("SIGINT");
});
