const express = require("express");
const config = require("./config.json");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>اختبار صلاحيات البوت</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 40px auto;
          padding: 20px;
          background: #f5f5f5;
        }

        .box {
          background: white;
          padding: 20px;
          border-radius: 15px;
          box-shadow: 0 3px 15px rgba(0,0,0,.1);
        }

        h1 {
          margin-top: 0;
        }

        input, select, button {
          width: 100%;
          padding: 12px;
          margin-top: 8px;
          margin-bottom: 15px;
          box-sizing: border-box;
          border-radius: 8px;
          border: 1px solid #ccc;
          font-size: 16px;
        }

        button {
          background: #222;
          color: white;
          cursor: pointer;
          border: none;
        }

        button:hover {
          opacity: .9;
        }

        #result {
          padding: 15px;
          border-radius: 10px;
          margin-top: 15px;
          display: none;
        }

        .allowed {
          background: #dff6e4;
          color: #176b2c;
        }

        .denied {
          background: #ffe1e1;
          color: #9b1c1c;
        }
      </style>
    </head>

    <body>

      <div class="box">

        <h1>🤖 اختبار صلاحيات البوت</h1>

        <p>
          شركة الاتحاد للصرافة والحوالات
        </p>

        <label>نوع المحادثة</label>

        <select id="chatType">
          <option value="user">👤 شخص</option>
          <option value="group">👥 مجموعة</option>
        </select>

        <label>المعرّف</label>

        <input
          id="chatId"
          type="text"
          placeholder="مثال: 9639XXXXXXXX"
        >

        <label>نص الرسالة</label>

        <input
          id="message"
          type="text"
          placeholder="مثال: قديش سعر الدولار؟"
        >

        <button onclick="testPermission()">
          🔍 اختبار الصلاحية
        </button>

        <div id="result"></div>

      </div>

      <script>
        async function testPermission() {

          const chatType = document.getElementById("chatType").value;
          const chatId = document.getElementById("chatId").value.trim();
          const message = document.getElementById("message").value.trim();

          const result = document.getElementById("result");

          if (!chatId) {
            result.style.display = "block";
            result.className = "denied";
            result.innerText = "❌ اكتب المعرّف أولاً";
            return;
          }

          const response = await fetch("/test-permission", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              chatType,
              chatId,
              message
            })
          });

          const data = await response.json();

          result.style.display = "block";

          if (data.allowed) {
            result.className = "allowed";
            result.innerHTML =
              "✅ مسموح للبوت بالرد<br><br>" +
              "السبب: " + data.reason;
          } else {
            result.className = "denied";
            result.innerHTML =
              "🚫 غير مسموح للبوت بالرد<br><br>" +
              "السبب: " + data.reason;
          }
        }
      </script>

    </body>
    </html>
  `);
}


// اختبار الصلاحيات
app.post("/test-permission", (req, res) => {

  const {
    chatType,
    chatId,
    message
  } = req.body;

  let allowed = false;
  let reason = "";

  if (!chatId) {
    return res.json({
      allowed: false,
      reason: "المعرّف فارغ"
    });
  }

  // شخص
  if (chatType === "user") {

    if (config.permissions.allowedUsers.includes(chatId)) {

      allowed = true;
      reason = "المستخدم موجود ضمن قائمة الأشخاص المسموح لهم";

    } else {

      reason = "المستخدم غير موجود ضمن قائمة الأشخاص المسموح لهم";
    }
  }


  // مجموعة
  if (chatType === "group") {

    if (config.permissions.allowedGroups.includes(chatId)) {

      allowed = true;
      reason = "المجموعة موجودة ضمن قائمة المجموعات المسموح بها";

    } else {

      reason = "المجموعة غير موجودة ضمن قائمة المجموعات المسموح بها";
    }
  }


  console.log({
    chatType,
    chatId,
    message,
    allowed
  });


  res.json({
    allowed,
    reason
  });

});


// معلومات الحالة
app.get("/status", (req, res) => {

  res.json({
    status: "online",
    bot: config.bot.name,
    enabled: config.bot.enabled,

    company: config.company.name,
    branch: config.company.branch,

    workingHours: config.company.workingHours,
    holiday: config.company.holiday,

    allowedUsers: config.permissions.allowedUsers.length,
    allowedGroups: config.permissions.allowedGroups.length

  });

});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
