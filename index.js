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

<title>مساعد شركة الاتحاد</title>

<style>
body {
  font-family: Arial, sans-serif;
  background: #f3f4f6;
  margin: 0;
  padding: 20px;
}

.container {
  max-width: 600px;
  margin: auto;
}

.card {
  background: white;
  padding: 20px;
  border-radius: 15px;
  box-shadow: 0 4px 15px rgba(0,0,0,.08);
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
button {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  margin-top: 7px;
  border-radius: 8px;
  border: 1px solid #ccc;
  font-size: 16px;
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
}

.allowed {
  background: #d9f7df;
  color: #176b2c;
}

.denied {
  background: #ffe0e0;
  color: #9b1c1c;
}
</style>
</head>

<body>

<div class="container">

<div class="card">

<h1>🤖 مساعد شركة الاتحاد</h1>

<p>
اختبار صلاحيات الرد
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
placeholder="اكتب المعرّف هنا"
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

</div>

<script>

async function testPermission() {

const chatType =
document.getElementById("chatType").value;

const chatId =
document.getElementById("chatId").value.trim();

const message =
document.getElementById("message").value.trim();

const result =
document.getElementById("result");

if (!chatId) {

result.style.display = "block";
result.className = "denied";
result.innerText = "❌ اكتب المعرّف أولاً";

return;
}

try {

const response = await fetch(
"/test-permission",
{
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({
chatType: chatType,
chatId: chatId,
message: message
})
}
);

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

} catch (error) {

result.style.display = "block";
result.className = "denied";

result.innerText =
"❌ حدث خطأ في الاتصال بالسيرفر";

}

}

</script>

</body>
</html>
  `);
}


// اختبار الصلاحيات
app.post("/test-permission", (req, res) => {

  const chatType = req.body.chatType;
  const chatId = req.body.chatId;
  const message = req.body.message || "";

  if (!chatId) {

    return res.json({
      allowed: false,
      reason: "المعرّف فارغ"
    });

  }


  // فحص الأشخاص
  if (chatType === "user") {

    if (config.permissions.allowedUsers.includes(chatId)) {

      return res.json({
        allowed: true,
        reason: "الشخص موجود ضمن قائمة المسموح لهم"
      });

    }

    return res.json({
      allowed: false,
      reason: "الشخص غير موجود ضمن قائمة المسموح لهم"
    });

  }


  // فحص المجموعات
  if (chatType === "group") {

    if (config.permissions.allowedGroups.includes(chatId)) {

      return res.json({
        allowed: true,
        reason: "المجموعة موجودة ضمن قائمة المجموعات المسموح بها"
      });

    }

    return res.json({
      allowed: false,
      reason: "المجموعة غير موجودة ضمن قائمة المجموعات المسموح بها"
    });

  }


  return res.json({
    allowed: false,
    reason: "نوع المحادثة غير معروف"
  });

});


// حالة البوت
app.get("/status", (req, res) => {

  res.json({

    status: "online",

    bot: config.bot.name,

    enabled: config.bot.enabled,

    company: config.company.name,

    branch: config.company.branch,

    workingHours: config.company.workingHours,

    holiday: config.company.holiday,

    allowedUsers:
      config.permissions.allowedUsers.length,

    allowedGroups:
      config.permissions.allowedGroups.length

  });

});


// تشغيل السيرفر
app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );

});
