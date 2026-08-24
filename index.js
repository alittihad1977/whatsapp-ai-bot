const express = require("express");
const config = require("./config.json");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send(`
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>مساعد شركة الاتحاد</title>
    </head>

    <body style="font-family:Arial;padding:30px">

      <h1>🤖 مساعد شركة الاتحاد</h1>

      <h3>اختبار صلاحيات الرد</h3>

      <label>نوع المحادثة:</label>
      <select id="type">
        <option value="user">👤 شخص</option>
        <option value="group">👥 مجموعة</option>
      </select>

      <br><br>

      <label>المعرّف:</label>
      <input id="id" placeholder="اكتب المعرّف">

      <br><br>

      <label>الرسالة:</label>
      <input id="message" placeholder="اكتب الرسالة">

      <br><br>

      <button onclick="testPermission()">
        🔍 اختبار الصلاحية
      </button>

      <h3 id="result"></h3>

      <script>
        async function testPermission() {

          const type = document.getElementById("type").value;
          const id = document.getElementById("id").value;
          const message = document.getElementById("message").value;

          const response = await fetch("/test-permission", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              chatType: type,
              chatId: id,
              message: message
            })
          });

          const data = await response.json();

          document.getElementById("result").innerText =
            data.allowed
              ? "✅ مسموح للبوت بالرد - " + data.reason
              : "🚫 غير مسموح للبوت بالرد - " + data.reason;
        }
      </script>

    </body>
    </html>
  `);
});

app.post("/test-permission", (req, res) => {

  const chatType = req.body.chatType;
  const chatId = req.body.chatId;

  if (!chatId) {
    return res.json({
      allowed: false,
      reason: "المعرّف فارغ"
    });
  }

  if (chatType === "user") {

    const allowed =
      config.permissions.allowedUsers.includes(chatId);

    return res.json({
      allowed: allowed,
      reason: allowed
        ? "الشخص موجود ضمن القائمة"
        : "الشخص غير موجود ضمن القائمة"
    });
  }

  if (chatType === "group") {

    const allowed =
      config.permissions.allowedGroups.includes(chatId);

    return res.json({
      allowed: allowed,
      reason: allowed
        ? "المجموعة موجودة ضمن القائمة"
        : "المجموعة غير موجودة ضمن القائمة"
    });
  }

  res.json({
    allowed: false,
    reason: "نوع المحادثة غير معروف"
  });
});

app.get("/status", (req, res) => {

  res.json({
    status: "online",
    bot: config.bot.name,
    enabled: config.bot.enabled,
    company: config.company.name,
    branch: config.company.branch,
    allowedUsers: config.permissions.allowedUsers.length,
    allowedGroups: config.permissions.allowedGroups.length
  });

});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
