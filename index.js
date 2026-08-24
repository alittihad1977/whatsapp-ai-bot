const express = require("express");
const config = require("./config.json");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
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
