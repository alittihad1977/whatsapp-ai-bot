"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} = require("@whiskeysockets/baileys");

const P = require("pino");
const QRCode = require("qrcode");
const { GoogleGenAI } = require("@google/genai");

const config = require("./config.json");

// ============================================================
// SERVER
// ============================================================

const app = express();

const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({
  extended: true,
  limit: "20mb"
}));

// ============================================================
// WHATSAPP
// ============================================================

const AUTH_DIR = path.join(
  __dirname,
  "auth_info_baileys"
);

let sock = null;

let currentQR = null;

let whatsappConnected = false;

let reconnectTimer = null;

let startingWhatsApp = false;

let lastMessage = null;

let lastAIResponse = null;

let lastError = null;

// لمنع معالجة نفس الرسالة مرتين
const processedMessages = new Set();

const MAX_PROCESSED_MESSAGES = 500;

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

    console.log(
      "Gemini AI initialization error:",
      error.message
    );

    gemini = null;
  }

} else {

  console.log(
    "Gemini AI: disabled - GEMINI_API_KEY not found"
  );
}

// ============================================================
// COMPANY
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
// PERMISSIONS
// ============================================================

function getAllowedUsers() {

  if (
    !config ||
    !config.permissions ||
    !Array.isArray(
      config.permissions.allowedUsers
    )
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
    !Array.isArray(
      config.permissions.allowedGroups
    )
  ) {
    return [];
  }

  return config.permissions.allowedGroups
    .map(x => String(x).trim())
    .filter(Boolean);
}

// ============================================================
// NORMALIZE JID / PHONE
// ============================================================

function normalizePhone(value) {

  if (!value) {
    return "";
  }

  return String(value)
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@lid$/i, "")
    .replace(/:[0-9]+@/g, "@")
    .replace(/[^0-9]/g, "");
}

// ============================================================
// GROUP
// ============================================================

function isGroupJid(jid) {

  return String(jid || "")
    .endsWith("@g.us");
}

// ============================================================
// USER PERMISSION
// ============================================================

function isAllowedUser(jid) {

  const allowedUsers =
    getAllowedUsers();

  // ========================================================
  // إذا القائمة فارغة = الجميع مسموح
  // ========================================================

  if (allowedUsers.length === 0) {
    return true;
  }

  const jidText =
    String(jid || "");

  const jidNumber =
    normalizePhone(jidText);

  return allowedUsers.some(user => {

    const normalized =
      normalizePhone(user);

    if (!normalized) {
      return false;
    }

    return (
      jidText === user ||
      jidNumber === normalized ||
      jidText.includes(normalized) ||
      jidNumber.includes(normalized)
    );
  });
}

// ============================================================
// GROUP PERMISSION
// ============================================================

function isAllowedGroup(jid) {

  const allowedGroups =
    getAllowedGroups();

  if (allowedGroups.length === 0) {
    return true;
  }

  const jidText =
    String(jid || "");

  return allowedGroups.some(group => {

    return (
      jidText === group ||
      jidText.includes(group)
    );
  });
}

// ============================================================
// MESSAGE PERMISSION
// ============================================================

function isMessageAllowed(jid, isGroup) {

  if (isGroup) {
    return isAllowedGroup(jid);
  }

  return isAllowedUser(jid);
}

// ============================================================
// SYRIA TIME
// ============================================================

function getSyriaDateTime() {

  const now = new Date();

  const date =
    new Intl.DateTimeFormat(
      "ar-SY",
      {
        timeZone: "Asia/Damascus",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).format(now);

  const time =
    new Intl.DateTimeFormat(
      "ar-SY",
      {
        timeZone: "Asia/Damascus",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }
    ).format(now);

  const weekday =
    new Intl.DateTimeFormat(
      "ar-SY",
      {
        timeZone: "Asia/Damascus",
        weekday: "long"
      }
    ).format(now);

  return {
    date,
    time,
    weekday
  };
}

// ============================================================
// CLEAN TEXT
// ============================================================

function cleanText(text) {

  if (!text) {
    return "";
  }

  return String(text)
    .replace(/\u200e/g, "")
    .replace(/\u200f/g, "")
    .replace(/\u202a/g, "")
    .replace(/\u202b/g, "")
    .replace(/\u202c/g, "")
    .replace(/\u2066/g, "")
    .replace(/\u2067/g, "")
    .replace(/\u2069/g, "")
    .trim();
}

// ============================================================
// MESSAGE TYPE
// ============================================================

function getMessageType(message) {

  if (!message?.message) {
    return "unknown";
  }

  const m =
    message.message;

  if (m.conversation) {
    return "text";
  }

  if (m.extendedTextMessage) {
    return "text";
  }

  if (m.imageMessage) {
    return "image";
  }

  if (m.videoMessage) {
    return "video";
  }

  if (m.audioMessage) {
    return "audio";
  }

  if (m.documentMessage) {
    return "document";
  }

  if (m.stickerMessage) {
    return "sticker";
  }

  if (m.contactMessage) {
    return "contact";
  }

  if (m.locationMessage) {
    return "location";
  }

  return "unknown";
}

// ============================================================
// EXTRACT TEXT
// ============================================================

function extractMessageText(message) {

  if (!message) {
    return "";
  }

  const m =
    message.message;

  if (!m) {
    return "";
  }

  if (m.conversation) {
    return cleanText(
      m.conversation
    );
  }

  if (
    m.extendedTextMessage?.text
  ) {
    return cleanText(
      m.extendedTextMessage.text
    );
  }

  if (
    m.imageMessage?.caption
  ) {
    return cleanText(
      m.imageMessage.caption
    );
  }

  if (
    m.videoMessage?.caption
  ) {
    return cleanText(
      m.videoMessage.caption
    );
  }

  if (
    m.documentMessage?.caption
  ) {
    return cleanText(
      m.documentMessage.caption
    );
  }

  return "";
}

// ============================================================
// IMAGE / AUDIO INFORMATION
// ============================================================

function getMediaInfo(message) {

  const m =
    message?.message;

  if (!m) {
    return null;
  }

  if (m.imageMessage) {

    return {
      type: "image",
      mimeType:
        m.imageMessage.mimetype ||
        "image/jpeg",
      caption:
        cleanText(
          m.imageMessage.caption || ""
        )
    };
  }

  if (m.audioMessage) {

    return {
      type: "audio",
      mimeType:
        m.audioMessage.mimetype ||
        "audio/ogg; codecs=opus",
      seconds:
        m.audioMessage.seconds || 0,
      ptt:
        !!m.audioMessage.ptt
    };
  }

  return null;
}

// ============================================================
// SYSTEM PROMPT
// ============================================================

function buildSystemPrompt() {

  const dt =
    getSyriaDateTime();

  return `
أنت ${BOT_NAME}، المساعد الذكي الرسمي الخاص بـ ${COMPANY_NAME}.

معلومات الشركة:

اسم الشركة:
${COMPANY_NAME}

الفرع:
${BRANCH_NAME}

الدوام:
${WORKING_HOURS}

العطلة الأسبوعية:
${HOLIDAY}

الوقت الحالي في سوريا:

التاريخ:
${dt.date}

اليوم:
${dt.weekday}

الساعة:
${dt.time}


قواعد أساسية:

1. أجب دائماً باللغة العربية.

2. افهم اللهجة السورية والكلمات العامية والأخطاء الإملائية.

3. كن محترماً وودوداً ومختصراً.

4. إذا كان السؤال بسيطاً، أجب بإجابة بسيطة.

5. إذا سأل المستخدم عن الشركة أو الفرع أو الدوام، استخدم المعلومات الموجودة أعلاه.

6. إذا سأل عن الوقت أو التاريخ، استخدم الوقت الحالي الموجود أعلاه.

7. لا تخترع أسعار صرف.

8. لا تخترع أرقام هواتف.

9. لا تخترع عناوين أو فروعاً.

10. إذا لم تكن لديك معلومة مؤكدة، قل إنها غير متوفرة لديك.

11. لا تدّعي أنك نفذت حوالة أو عملية مالية.

12. إذا طلب المستخدم تنفيذ عملية مالية فعلية، أخبره أن العملية تتم عن طريق موظفي الشركة.

13. إذا قال المستخدم مرحبا أو أهلا، رحب به.

14. إذا قال شكراً، رد باختصار.

15. إذا سأل مين أنت، قل إنك ${BOT_NAME}.

16. إذا أرسل المستخدم صورة، حاول فهم الصورة وتحليل محتواها والإجابة عن المطلوب منها.

17. إذا أرسل المستخدم رسالة صوتية، حاول فهم محتوى التسجيل والإجابة على الكلام الموجود فيه.

18. لا تقل للمستخدم إنك لا تفهم اللهجة السورية لمجرد وجود أخطاء إملائية.

19. لا تطلب من المستخدم صياغة السؤال بطريقة معينة.

20. حاول فهم المقصود من الرسالة حتى لو كانت قصيرة جداً.

21. لا تقدم معلومات مالية غير مؤكدة على أنها حقيقة.
`;
}

// ============================================================
// GEMINI TEXT
// ============================================================

async function askGeminiText(
  userText,
  context = {}
) {

  if (!gemini) {

    return "عذراً، خدمة الذكاء الاصطناعي غير مفعلة حالياً.";
  }

  const dt =
    getSyriaDateTime();

  const prompt = `
${buildSystemPrompt()}

معلومات المحادثة:

معرف المستخدم:
${context.sender || "غير معروف"}

هل المحادثة مجموعة:
${context.isGroup ? "نعم" : "لا"}

الوقت الحالي:
${dt.date} ${dt.time}

رسالة المستخدم:

${userText}

أجب مباشرة على المستخدم.
`;

  try {

    const response =
      await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });

    let answer = "";

    if (
      typeof response?.text ===
      "string"
    ) {

      answer =
        response.text;

    } else if (
      response?.response?.text
    ) {

      answer =
        response.response.text();

    } else if (
      response?.candidates?.[0]
        ?.content?.parts
    ) {

      answer =
        response
          .candidates[0]
          .content
          .parts
          .map(
            part =>
              part.text || ""
          )
          .join("");
    }

    answer =
      cleanText(answer);

    if (!answer) {

      return "عذراً، لم أتمكن من توليد إجابة حالياً.";
    }

    return answer;

  } catch (error) {

    lastError =
      error.message ||
      String(error);

    console.log(
      "❌ Gemini text error:",
      lastError
    );

    return "عذراً، حدث خطأ مؤقت أثناء معالجة رسالتك. حاول مرة أخرى بعد قليل.";
  }
}

// ============================================================
// GEMINI IMAGE
// ============================================================

async function askGeminiImage(
  imageBuffer,
  mimeType,
  userQuestion,
  context = {}
) {

  if (!gemini) {

    return "عذراً، خدمة الذكاء الاصطناعي غير مفعلة حالياً.";
  }

  try {

    const base64 =
      imageBuffer.toString(
        "base64"
      );

    const question =
      userQuestion ||
      "حلل هذه الصورة وافهم ما الذي يريد المستخدم معرفته عنها، ثم أجب باللغة العربية.";

    const prompt = `
${buildSystemPrompt()}

المستخدم أرسل صورة إلى المساعد.

السؤال أو التعليق المرافق للصورة:
${question}

حلل الصورة بعناية.

إذا كانت الصورة تحتوي على نص، اقرأ النص وحاول فهمه.

إذا كانت تحتوي على أسعار أو أرقام، لا تفترض أنها صحيحة إلا إذا كانت واضحة في الصورة.

أجب باللغة العربية وبشكل مباشر.
`;

    const response =
      await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              },
              {
                inlineData: {
                  mimeType:
                    mimeType ||
                    "image/jpeg",
                  data: base64
                }
              }
            ]
          }
        ]
      });

    let answer = "";

    if (
      typeof response?.text ===
      "string"
    ) {

      answer =
        response.text;

    } else if (
      response?.response?.text
    ) {

      answer =
        response.response.text();

    } else if (
      response?.candidates?.[0]
        ?.content?.parts
    ) {

      answer =
        response
          .candidates[0]
          .content
          .parts
          .map(
            part =>
              part.text || ""
          )
          .join("");
    }

    answer =
      cleanText(answer);

    if (!answer) {

      return "تم استلام الصورة، لكن لم أتمكن من تحليلها حالياً.";
    }

    return answer;

  } catch (error) {

    lastError =
      error.message ||
      String(error);

    console.log(
      "❌ Gemini image error:",
      lastError
    );

    return "وصلتني الصورة، لكن حدث خطأ أثناء تحليلها. حاول إرسالها مرة أخرى.";
  }
}

// ============================================================
// GEMINI AUDIO
// ============================================================

async function askGeminiAudio(
  audioBuffer,
  mimeType,
  userText,
  context = {}
) {

  if (!gemini) {

    return "عذراً، خدمة الذكاء الاصطناعي غير مفعلة حالياً.";
  }

  try {

    const base64 =
      audioBuffer.toString(
        "base64"
      );

    const question =
      userText ||
      "استمع إلى التسجيل الصوتي، افهم الكلام الموجود فيه، ثم أجب المستخدم باللغة العربية.";

    const prompt = `
${buildSystemPrompt()}

المستخدم أرسل رسالة صوتية.

المطلوب:
استمع إلى التسجيل الصوتي وفهم الكلام الموجود فيه.

إذا كان التسجيل باللهجة السورية أو العربية العامية، حاول فهمه بشكل طبيعي.

بعد فهم التسجيل، أجب عن طلب المستخدم مباشرة باللغة العربية.

لا تكتفِ بقول إن التسجيل وصل.
`;

    const response =
      await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  prompt +
                  "\n\nتعليق المستخدم:\n" +
                  question
              },
              {
                inlineData: {
                  mimeType:
                    mimeType ||
                    "audio/ogg",
                  data: base64
                }
              }
            ]
          }
        ]
      });

    let answer = "";

    if (
      typeof response?.text ===
      "string"
    ) {

      answer =
        response.text;

    } else if (
      response?.response?.text
    ) {

      answer =
        response.response.text();

    } else if (
      response?.candidates?.[0]
        ?.content?.parts
    ) {

      answer =
        response
          .candidates[0]
          .content
          .parts
          .map(
            part =>
              part.text || ""
          )
          .join("");
    }

    answer =
      cleanText(answer);

    if (!answer) {

      return "وصلني التسجيل الصوتي، لكن لم أتمكن من فهمه حالياً.";
    }

    return answer;

  } catch (error) {

    lastError =
      error.message ||
      String(error);

    console.log(
      "❌ Gemini audio error:",
      lastError
    );

    return "وصلني التسجيل الصوتي، لكن حدث خطأ أثناء تحليله. حاول إرسال التسجيل مرة أخرى.";
  }
}

// ============================================================
// SEND TEXT
// ============================================================

async function sendText(
  jid,
  text
) {

  if (!sock) {
    throw new Error(
      "WhatsApp socket is not ready"
    );
  }

  if (!whatsappConnected) {
    throw new Error(
      "WhatsApp is not connected"
    );
  }

  if (!jid) {
    throw new Error(
      "Missing JID"
    );
  }

  if (!text) {
    throw new Error(
      "Missing message text"
    );
  }

  return await sock.sendMessage(
    jid,
    {
      text: String(text)
    }
  );
}

// ============================================================
// DOWNLOAD MEDIA
// ============================================================

async function downloadMedia(
  message
) {

  try {

    const buffer =
      await downloadMediaMessage(
        message,
        "buffer",
        {},
        {
          logger: P({
            level: "silent"
          }),

          reuploadRequest:
            sock?.updateMediaMessage
        }
      );

    return buffer;

  } catch (error) {

    console.log(
      "❌ Media download error:",
      error.message
    );

    throw error;
  }
}

// ============================================================
// GROUP MENTION CHECK
// ============================================================

function isBotMentioned(
  message
) {

  if (!sock) {
    return false;
  }

  const botJid =
    sock?.user?.id || "";

  const botNumber =
    normalizePhone(
      botJid
    );

  const contextInfo =
    message
      ?.message
      ?.extendedTextMessage
      ?.contextInfo;

  const mentionedJid =
    contextInfo
      ?.mentionedJid || [];

  if (
    mentionedJid.length === 0
  ) {

    // أحياناً يكون المنشن موجوداً داخل
    // contextInfo من رسالة صورة أو صوت
    const imageContext =
      message
        ?.message
        ?.imageMessage
        ?.contextInfo;

    const audioContext =
      message
        ?.message
        ?.audioMessage
        ?.contextInfo;

    const mentions =
      imageContext
        ?.mentionedJid ||
      audioContext
        ?.mentionedJid ||
      [];

    return mentions.some(
      jid =>
        normalizePhone(jid) ===
        botNumber
    );
  }

  return mentionedJid.some(
    jid =>
      normalizePhone(jid) ===
      botNumber
  );
}

// ============================================================
// HANDLE MESSAGE
// ============================================================

async function handleIncomingMessage(
  message
) {

  try {

    if (!message) {
      return;
    }

    // رسائل البوت نفسه
    if (message.key?.fromMe) {
      return;
    }

    const messageId =
      message.key?.id;

    if (messageId) {

      if (
        processedMessages.has(
          messageId
        )
      ) {

        console.log(
          "🟡 Duplicate message ignored:",
          messageId
        );

        return;
      }

      processedMessages.add(
        messageId
      );

      if (
        processedMessages.size >
        MAX_PROCESSED_MESSAGES
      ) {

        const first =
          processedMessages
            .values()
            .next()
            .value;

        if (first) {
          processedMessages.delete(
            first
          );
        }
      }
    }

    const jid =
      message.key?.remoteJid;

    if (!jid) {
      return;
    }

    // تجاهل Status
    if (
      jid ===
        "status@broadcast" ||
      jid.endsWith(
        "@broadcast"
      )
    ) {
      return;
    }

    const isGroup =
      isGroupJid(jid);

    const type =
      getMessageType(message);

    const text =
      extractMessageText(
        message
      );

    const mediaInfo =
      getMediaInfo(
        message
      );

    console.log(
      "--------------------------------------"
    );

    console.log(
      "📩 NEW WHATSAPP MESSAGE"
    );

    console.log(
      "Chat:",
      jid
    );

    console.log(
      "Type:",
      type
    );

    console.log(
      "Text:",
      text || "(no text)"
    );

    // ========================================================
    // PERMISSIONS
    // ========================================================

    if (
      !isMessageAllowed(
        jid,
        isGroup
      )
    ) {

      console.log(
        "⛔ Message blocked by permissions"
      );

      console.log(
        "Allowed users:",
        getAllowedUsers()
      );

      console.log(
        "Allowed groups:",
        getAllowedGroups()
      );

      return;
    }

    // ========================================================
    // GROUPS
    // ========================================================

    if (isGroup) {

      const mentionOnly =
        config
          ?.permissions
          ?.groupOnlyWhenMentioned !== false;

      if (
        mentionOnly &&
        !isBotMentioned(message)
      ) {

        console.log(
          "👥 Group message ignored - bot not mentioned"
        );

        return;
      }
    }

    // ========================================================
    // BOT ENABLED
    // ========================================================

    if (!BOT_ENABLED) {

      console.log(
        "🔴 Bot disabled"
      );

      return;
    }

    // ========================================================
    // SAVE LAST MESSAGE
    // ========================================================

    lastMessage = {

      id:
        message.key?.id ||
        null,

      jid,

      type,

      text,

      isGroup,

      receivedAt:
        new Date().toISOString()
    };

    // ========================================================
    // TEXT
    // ========================================================

    if (
      type === "text"
    ) {

      const normalizedText =
        text
          .toLowerCase()
          .replace(
            /[؟?!.,،]/g,
            ""
          )
          .trim();

      // ------------------------------------------------------
      // PING
      // ------------------------------------------------------

      if (
        normalizedText ===
          "ping" ||
        normalizedText ===
          "بنغ"
      ) {

        await sendText(
          jid,
          "🟢 البوت يعمل بشكل طبيعي."
        );

        return;
      }

      // ------------------------------------------------------
      // TIME
      // ------------------------------------------------------

      if (
        normalizedText ===
          "وقت" ||
        normalizedText ===
          "الوقت" ||
        normalizedText ===
          "كم الساعة" ||
        normalizedText ===
          "شو الساعة" ||
        normalizedText ===
          "الساعة"
      ) {

        const dt =
          getSyriaDateTime();

        await sendText(
          jid,
          `🕐 الوقت الآن في سوريا: ${dt.time}\n📅 ${dt.weekday} ${dt.date}`
        );

        return;
      }

      // ------------------------------------------------------
      // DATE
      // ------------------------------------------------------

      if (
        normalizedText ===
          "التاريخ" ||
        normalizedText ===
          "شو التاريخ" ||
        normalizedText ===
          "تاريخ اليوم"
      ) {

        const dt =
          getSyriaDateTime();

        await sendText(
          jid,
          `📅 اليوم: ${dt.weekday}\n🗓️ التاريخ: ${dt.date}`
        );

        return;
      }

      // ------------------------------------------------------
      // GEMINI TEXT
      // ------------------------------------------------------

      console.log(
        "🤖 Sending text to Gemini..."
      );

      const answer =
        await askGeminiText(
          text,
          {
            sender: jid,
            isGroup
          }
        );

      console.log(
        "🤖 Gemini response:",
        answer
      );

      lastAIResponse = {

        type: "text",

        question: text,

        answer,

        sentAt:
          new Date().toISOString()
      };

      await sendText(
        jid,
        answer
      );

      console.log(
        "✅ Reply sent"
      );

      console.log(
        "--------------------------------------"
      );

      return;
    }

    // ========================================================
    // IMAGE
    // ========================================================

    if (
      type === "image"
    ) {

      console.log(
        "🖼️ Image received."
      );

      console.log(
        "🖼️ Downloading image..."
      );

      try {

        const imageBuffer =
          await downloadMedia(
            message
          );

        console.log(
          "🖼️ Image downloaded:",
          imageBuffer.length,
          "bytes"
        );

        const imageMime =
          mediaInfo?.mimeType ||
          "image/jpeg";

        const imageQuestion =
          text ||
          "ما الموجود في هذه الصورة؟ اشرح لي الصورة وأجبني عن محتواها.";

        console.log(
          "🤖 Sending image to Gemini..."
        );

        const answer =
          await askGeminiImage(
            imageBuffer,
            imageMime,
            imageQuestion,
            {
              sender: jid,
              isGroup
            }
          );

        lastAIResponse = {

          type: "image",

          question:
            imageQuestion,

          answer,

          sentAt:
            new Date().toISOString()
        };

        await sendText(
          jid,
          answer
        );

        console.log(
          "✅ Image reply sent"
        );

      } catch (error) {

        console.log(
          "❌ Image handling error:",
          error.message
        );

        await sendText(
          jid,
          "وصلتني الصورة 🖼️ لكن حدث خطأ أثناء قراءتها. حاول إرسالها مرة ثانية."
        );
      }

      return;
    }

    // ========================================================
    // AUDIO
    // ========================================================

    if (
      type === "audio"
    ) {

      console.log(
        "🎤 Audio message received."
      );

      try {

        console.log(
          "🎤 Downloading audio..."
        );

        const audioBuffer =
          await downloadMedia(
            message
          );

        console.log(
          "🎤 Audio downloaded:",
          audioBuffer.length,
          "bytes"
        );

        const audioMime =
          mediaInfo?.mimeType ||
          "audio/ogg";

        console.log(
          "🎤 Audio MIME:",
          audioMime
        );

        console.log(
          "🤖 Sending audio to Gemini..."
        );

        const answer =
          await askGeminiAudio(
            audioBuffer,
            audioMime,
            text,
            {
              sender: jid,
              isGroup
            }
          );

        lastAIResponse = {

          type: "audio",

          question:
            text ||
            "رسالة صوتية",

          answer,

          sentAt:
            new Date().toISOString()
        };

        await sendText(
          jid,
          answer
        );

        console.log(
          "✅ Audio reply sent"
        );

      } catch (error) {

        console.log(
          "❌ Audio handling error:",
          error.message
        );

        await sendText(
          jid,
          "وصلني التسجيل الصوتي 🎤 لكن حدث خطأ أثناء فهمه. حاول إرسال التسجيل مرة ثانية."
        );
      }

      return;
    }

    // ========================================================
    // OTHER MEDIA
    // ========================================================

    if (
      type === "video"
    ) {

      await sendText(
        jid,
        "وصلني الفيديو 🎥 لكن حالياً الدعم الأساسي عندي للنصوص والصور والتسجيلات الصوتية."
      );

      return;
    }

    if (
      type === "document"
    ) {

      await sendText(
        jid,
        "وصلني الملف 📄 لكن حالياً أحتاج أن ترسل لي محتواه كنص أو صورة حتى أتمكن من مساعدتك."
      );

      return;
    }

    if (
      type === "sticker"
    ) {

      await sendText(
        jid,
        "وصلتني الملصقة 😄"
      );

      return;
    }

    if (
      type === "location"
    ) {

      await sendText(
        jid,
        "وصلني الموقع 📍"
      );

      return;
    }

    console.log(
      "ℹ️ Unsupported message type:",
      type
    );

  } catch (error) {

    lastError =
      error.message ||
      String(error);

    console.log(
      "❌ Message handling error:",
      lastError
    );

    try {

      if (
        message?.key?.remoteJid
      ) {

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
// START WHATSAPP
// ============================================================

async function startWhatsApp() {

  if (startingWhatsApp) {

    console.log(
      "🟡 WhatsApp startup already in progress."
    );

    return;
  }

  startingWhatsApp = true;

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

    if (
      !fs.existsSync(
        AUTH_DIR
      )
    ) {

      fs.mkdirSync(
        AUTH_DIR,
        {
          recursive: true
        }
      );
    }

    const {
      state,
      saveCreds
    } =
      await useMultiFileAuthState(
        AUTH_DIR
      );

    let version = null;

    try {

      const latest =
        await fetchLatestBaileysVersion();

      if (
        latest?.version
      ) {

        version =
          latest.version;

        console.log(
          "📦 Baileys version:",
          version.join(".")
        );
      }

    } catch (error) {

      console.log(
        "⚠️ Could not fetch latest WhatsApp version:",
        error.message
      );
    }

    const socketOptions = {

      auth: state,

      logger:
        P({
          level: "silent"
        }),

      browser:
        Browsers.ubuntu(
          "Chrome"
        ),

      printQRInTerminal:
        false,

      generateHighQualityLinkPreview:
        false,

      syncFullHistory:
        false
    };

    if (version) {

      socketOptions.version =
        version;
    }

    sock =
      makeWASocket(
        socketOptions
      );

    // ========================================================
    // CREDENTIALS
    // ========================================================

    sock.ev.on(
      "creds.update",
      saveCreds
    );

    console.log(
      "✅ WhatsApp event listeners installed."
    );

    // ========================================================
    // MESSAGES
    // ========================================================

    sock.ev.on(
      "messages.upsert",
      async ({ messages, type }) => {

        try {

          if (
            type !== "notify"
          ) {
            return;
          }

          for (
            const message
            of messages
          ) {

            await handleIncomingMessage(
              message
            );
          }

        } catch (error) {

          console.log(
            "❌ messages.upsert error:",
            error.message
          );
        }
      }
    );

    console.log(
      "📩 Message listener: ENABLED"
    );

    // ========================================================
    // CONNECTION UPDATE
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

          currentQR =
            qr;

          whatsappConnected =
            false;

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

        // ----------------------------------------------------
        // OPEN
        // ----------------------------------------------------

        if (
          connection ===
          "open"
        ) {

          whatsappConnected =
            true;

          currentQR =
            null;

          lastError =
            null;

          startingWhatsApp =
            false;

          console.log(
            "======================================"
          );

          console.log(
            "🟢 WhatsApp connected!"
          );

          console.log(
            "WhatsApp JID:",
            sock?.user?.id ||
              "unknown"
          );

          console.log(
            "======================================"
          );
        }

        // ----------------------------------------------------
        // CLOSE
        // ----------------------------------------------------

        if (
          connection ===
          "close"
        ) {

          whatsappConnected =
            false;

          startingWhatsApp =
            false;

          let statusCode =
            null;

          try {

            statusCode =
              lastDisconnect
                ?.error
                ?.output
                ?.statusCode ||
              lastDisconnect
                ?.error
                ?.statusCode ||
              null;

          } catch (_) {}

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
            "======================================"
          );

          // ==================================================
          // LOGGED OUT
          // ==================================================

          if (
            statusCode ===
              DisconnectReason.loggedOut ||
            statusCode === 401
          ) {

            console.log(
              "🔴 WhatsApp logged out."
            );

            console.log(
              "Delete auth_info_baileys and scan QR again."
            );

            return;
          }

          // ==================================================
          // RECONNECT
          // ==================================================

          if (
            !reconnectTimer
          ) {

            console.log(
              "🟡 Reconnecting in 5 seconds..."
            );

            reconnectTimer =
              setTimeout(
                async () => {

                  reconnectTimer =
                    null;

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

    console.log(
      "✅ WhatsApp startup completed"
    );

  } catch (error) {

    startingWhatsApp =
      false;

    lastError =
      error.message ||
      String(error);

    console.log(
      "❌ WhatsApp startup error:",
      lastError
    );

    if (
      !reconnectTimer
    ) {

      reconnectTimer =
        setTimeout(
          async () => {

            reconnectTimer =
              null;

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
// HOME
// ============================================================

app.get(
  "/",
  (req, res) => {

    const dt =
      getSyriaDateTime();

    res.json({

      status:
        "online",

      bot:
        BOT_NAME,

      enabled:
        BOT_ENABLED,

      company:
        COMPANY_NAME,

      branch:
        BRANCH_NAME,

      workingHours:
        WORKING_HOURS,

      holiday:
        HOLIDAY,

      whatsapp:
        whatsappConnected
          ? "connected"
          : "disconnected",

      gemini:
        gemini
          ? "enabled"
          : "disabled",

      date:
        dt.date,

      time:
        dt.time,

      weekday:
        dt.weekday
    });
  }
);

// ============================================================
// STATUS
// ============================================================

app.get(
  "/status",
  (req, res) => {

    const allowedUsers =
      getAllowedUsers();

    const allowedGroups =
      getAllowedGroups();

    const dt =
      getSyriaDateTime();

    res.json({

      status:
        "online",

      bot:
        BOT_NAME,

      enabled:
        BOT_ENABLED,

      company:
        COMPANY_NAME,

      branch:
        BRANCH_NAME,

      workingHours:
        WORKING_HOURS,

      holiday:
        HOLIDAY,

      whatsapp: {

        connected:
          whatsappConnected,

        jid:
          sock?.user?.id ||
          null,

        qrReady:
          !!currentQR
      },

      gemini: {

        enabled:
          !!gemini
      },

      permissions: {

        allowedUsers,

        allowedGroups,

        emptyUsersMeansAllUsers:
          allowedUsers.length === 0
      },

      syriaTime:
        dt,

      lastMessage,

      lastAIResponse,

      lastError,

      serverTime:
        new Date().toISOString()
    });
  }
);

// ============================================================
// QR
// ============================================================

app.get(
  "/qr",
  async (req, res) => {

    try {

      if (
        whatsappConnected
      ) {

        return res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${BOT_NAME}</title>

<style>
body {
  font-family: Arial, sans-serif;
  background: #f4f4f4;
  text-align: center;
  padding: 40px;
}

.box {
  background: white;
  max-width: 500px;
  margin: auto;
  padding: 30px;
  border-radius: 20px;
  box-shadow: 0 5px 25px rgba(0,0,0,.12);
}

.ok {
  color: green;
  font-size: 26px;
  font-weight: bold;
}
</style>
</head>

<body>

<div class="box">

<div class="ok">
🟢 واتساب متصل
</div>

<p>
البوت متصل بحساب واتساب ويعمل بشكل طبيعي.
</p>

<p>
${BOT_NAME}
</p>

</div>

</body>
</html>
        `);
      }

      if (
        !currentQR
      ) {

        return res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="5">

<title>WhatsApp QR</title>

<style>
body {
  font-family: Arial, sans-serif;
  background: #f4f4f4;
  text-align: center;
  padding: 40px;
}

.box {
  background: white;
  max-width: 500px;
  margin: auto;
  padding: 30px;
  border-radius: 20px;
  box-shadow: 0 5px 25px rgba(0,0,0,.12);
}
</style>
</head>

<body>

<div class="box">

<h2>📱 واتساب</h2>

<p>
جاري تجهيز رمز QR...
</p>

<p>
سيتم تحديث الصفحة تلقائياً.
</p>

</div>

</body>
</html>
        `);
      }

      const qrDataUrl =
        await QRCode.toDataURL(
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

<meta name="viewport"
content="width=device-width,initial-scale=1">

<meta http-equiv="refresh"
content="10">

<title>ربط واتساب - ${BOT_NAME}</title>

<style>

* {
  box-sizing: border-box;
}

body {

  margin: 0;

  padding: 20px;

  font-family: Arial,
    sans-serif;

  background: #f1f3f5;

  text-align: center;
}

.box {

  max-width: 500px;

  margin: auto;

  background: white;

  padding: 25px;

  border-radius: 20px;

  box-shadow:
    0 8px 30px
    rgba(0,0,0,.12);
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

<h1>
📱 ربط واتساب
</h1>

<p>
افتح واتساب في الهاتف الرئيسي:
</p>

<div class="steps">

1️⃣ الإعدادات

<br>

2️⃣ الأجهزة المرتبطة

<br>

3️⃣ ربط جهاز

<br>

4️⃣ امسح رمز QR الموجود أسفل الصفحة

</div>

<img
src="${qrDataUrl}"
alt="WhatsApp QR">

<div class="note">

⚠️ رمز QR يتغير عند الحاجة.

<br>

سيتم تحديث الصفحة تلقائياً.

</div>

<p>
${BOT_NAME}
</p>

</div>

</body>

</html>
      `);

    } catch (error) {

      lastError =
        error.message ||
        String(error);

      res.status(500)
        .json({

          error:
            "QR unavailable",

          message:
            lastError
        });
    }
  }
);

// ============================================================
// AI TEST
// ============================================================

app.get(
  "/ai-test",
  async (req, res) => {

    try {

      const question =
        req.query.q ||
        "مرحبا، عرفني عن نفسك";

      const answer =
        await askGeminiText(
          question,
          {
            sender:
              "web-test",

            isGroup:
              false
          }
        );

      res.json({

        success:
          true,

        question,

        answer,

        gemini:
          !!gemini,

        time:
          getSyriaDateTime()
      });

    } catch (error) {

      lastError =
        error.message ||
        String(error);

      res.status(500)
        .json({

          success:
            false,

          error:
            lastError
        });
    }
  }
);

// ============================================================
// SEND
// ============================================================

app.post(
  "/send",
  async (req, res) => {

    try {

      const {
        jid,
        message
      } = req.body || {};

      if (
        !jid ||
        !message
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            error:
              "jid and message are required"
          });
      }

      if (
        !whatsappConnected
      ) {

        return res
          .status(503)
          .json({

            success:
              false,

            error:
              "WhatsApp is not connected"
          });
      }

      await sendText(
        jid,
        message
      );

      res.json({

        success:
          true,

        sentTo:
          jid,

        message
      });

    } catch (error) {

      lastError =
        error.message ||
        String(error);

      res.status(500)
        .json({

          success:
            false,

          error:
            lastError
        });
    }
  }
);

// ============================================================
// COMPANY
// ============================================================

app.get(
  "/company",
  (req, res) => {

    const dt =
      getSyriaDateTime();

    res.json({

      bot:
        BOT_NAME,

      company:
        COMPANY_NAME,

      branch:
        BRANCH_NAME,

      workingHours:
        WORKING_HOURS,

      holiday:
        HOLIDAY,

      date:
        dt.date,

      time:
        dt.time,

      weekday:
        dt.weekday
    });
  }
);

// ============================================================
// PING
// ============================================================

app.get(
  "/ping",
  (req, res) => {

    res.json({

      pong:
        true,

      whatsapp:
        whatsappConnected,

      gemini:
        !!gemini,

      time:
        new Date().toISOString()
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  () => {

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
      "🖼️ Image AI: ENABLED"
    );

    console.log(
      "🎤 Audio AI: ENABLED"
    );

    console.log(
      "======================================"
    );

    const allowedUsers =
      getAllowedUsers();

    const allowedGroups =
      getAllowedGroups();

    console.log(
      "👥 Allowed users:",
      allowedUsers
    );

    console.log(
      "👥 Allowed groups:",
      allowedGroups
    );

    if (
      allowedUsers.length === 0
    ) {

      console.log(
        "🟢 Empty allowedUsers = ALL USERS ARE ALLOWED"
      );

    } else {

      console.log(
        "🔒 Only configured users are allowed"
      );
    }

    console.log(
      "======================================"
    );

    console.log(
      "📱 Starting WhatsApp..."
    );

    console.log(
      "======================================"
    );

    startWhatsApp();
  }
);

// ============================================================
// NODE ERRORS
// ============================================================

process.on(
  "uncaughtException",
  error => {

    console.log(
      "❌ UNCAUGHT EXCEPTION:",
      error?.stack ||
      error?.message ||
      error
    );
  }
);

process.on(
  "unhandledRejection",
  error => {

    console.log(
      "❌ UNHANDLED REJECTION:",
      error?.stack ||
      error?.message ||
      error
    );
  }
);

// ============================================================
// SHUTDOWN
// ============================================================

async function shutdown(
  signal
) {

  console.log(
    `\n🛑 Received ${signal}`
  );

  try {

    if (sock) {

      sock.end(
        undefined
      );
    }

  } catch (error) {

    console.log(
      "Shutdown WhatsApp error:",
      error.message
    );
  }

  process.exit(0);
}

process.on(
  "SIGTERM",
  () => {
    shutdown("SIGTERM");
  }
);

process.on(
  "SIGINT",
  () => {
    shutdown("SIGINT");
  }
);
