const QRCode = require("qrcode");
const sharp = require("sharp");

const PRICING_SERVER = process.env.PRICING_SERVER_URL || "https://pricing-server-yjam.onrender.com";
const LOGO_URL = process.env.UNION_LOGO_URL || "https://raw.githubusercontent.com/alittihad1977/pricing-server/main/union_logo.png";
const TELEGRAM_URL = process.env.TELEGRAM_CHANNEL_URL || "https://t.me/ALITEHAD_ALEPPO";
const WHATSAPP_QR_SOURCE = process.env.WHATSAPP_QR_SOURCE_URL || "https://raw.githubusercontent.com/alittihad1977/pricing-server/main/company-news.js";

const PAIRS = [
  ["USD/SYP", "الدولار / الليرة السورية", "us", "sy"],
  ["TRY/SYP", "الليرة التركية / الليرة السورية", "tr", "sy"],
  ["EUR/SYP", "اليورو / الليرة السورية", "eu", "sy"],
  ["USD/TRY", "الدولار / الليرة التركية", "us", "tr"],
  ["EUR/USD", "اليورو / الدولار", "eu", "us"]
];

let logo;
let whatsappQr;

const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

async function bufferFromUrl(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function getLogo() {
  if (!logo) logo = "data:image/png;base64," + (await bufferFromUrl(LOGO_URL)).toString("base64");
  return logo;
}

async function getWhatsAppQr() {
  if (whatsappQr) return whatsappQr;
  if (process.env.WHATSAPP_QR_DATA_URL) {
    whatsappQr = process.env.WHATSAPP_QR_DATA_URL;
    return whatsappQr;
  }
  try {
    const source = await (await fetch(WHATSAPP_QR_SOURCE, { cache: "no-store" })).text();
    const m = source.match(/const\s+WHATSAPP_QR_IMAGE\s*=\s*['"](data:image\/png;base64,[^'"]+)['"]/);
    if (m) whatsappQr = m[1];
  } catch (e) {
    console.log("WhatsApp QR load:", e.message);
  }
  return whatsappQr || null;
}

async function qr(url) {
  return QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 1, width: 260 });
}

async function flag(code) {
  return "data:image/png;base64," + (await bufferFromUrl("https://flagcdn.com/w160/" + code + ".png")).toString("base64");
}

async function getLatestPrices() {
  const r = await fetch(PRICING_SERVER + "/msg", { cache: "no-store" });
  if (!r.ok) throw new Error("خادم الأسعار غير متاح.");
  const raw = await r.text();
  const buys = [...raw.matchAll(/الشراء\s*[:：]?\s*([0-9]+(?:\.[0-9]+)?)/g)].map(x => x[1]);
  const sells = [...raw.matchAll(/المبيع\s*[:：]?\s*([0-9]+(?:\.[0-9]+)?)/g)].map(x => x[1]);
  if (buys.length < 5 || sells.length < 5) throw new Error("لم تصل أسعار كاملة من لوحة التسعير.");
  return PAIRS.map((p,i) => ({ code:p[0], name:p[1], a:p[2], b:p[3], buy:buys[i], sell:sells[i] }));
}

function card(p, fa, fb, x, y) {
  return [
    '<g>',
    '<rect x="' + x + '" y="' + y + '" width="720" height="220" rx="28" fill="#101f42" stroke="#f4c430" stroke-width="3"/>',
    '<rect x="' + x + '" y="' + y + '" width="720" height="72" rx="28" fill="#f4c430"/>',
    '<rect x="' + x + '" y="' + (y+45) + '" width="720" height="27" fill="#f4c430"/>',
    '<image href="' + fa + '" x="' + (x+28) + '" y="' + (y+18) + '" width="55" height="35"/>',
    '<image href="' + fb + '" x="' + (x+637) + '" y="' + (y+18) + '" width="55" height="35"/>',
    '<text x="' + (x+360) + '" y="' + (y+46) + '" text-anchor="middle" direction="rtl" font-family="Noto Sans Arabic,Noto Sans,Arial" font-size="27" font-weight="700" fill="#0b1b3d">' + esc(p.name) + '</text>',
    '<line x1="' + (x+360) + '" y1="' + (y+88) + '" x2="' + (x+360) + '" y2="' + (y+205) + '" stroke="#f4c430" stroke-width="2" opacity=".55"/>',
    '<text x="' + (x+180) + '" y="' + (y+115) + '" text-anchor="middle" direction="rtl" font-family="Noto Sans Arabic,Noto Sans,Arial" font-size="23" font-weight="700" fill="#f4c430">شراء</text>',
    '<text x="' + (x+540) + '" y="' + (y+115) + '" text-anchor="middle" direction="rtl" font-family="Noto Sans Arabic,Noto Sans,Arial" font-size="23" font-weight="700" fill="#f4c430">مبيع</text>',
    '<text x="' + (x+180) + '" y="' + (y+177) + '" text-anchor="middle" font-family="Arial" font-size="48" font-weight="800" fill="#fff">' + esc(p.buy) + '</text>',
    '<text x="' + (x+540) + '" y="' + (y+177) + '" text-anchor="middle" font-family="Arial" font-size="48" font-weight="800" fill="#fff">' + esc(p.sell) + '</text>',
    '<text x="' + (x+360) + '" y="' + (y+207) + '" text-anchor="middle" font-family="Arial" font-size="15" fill="#aeb8cf">' + p.code + '</text>',
    '</g>'
  ].join("");
}

async function buildPriceImage(prices, now = new Date()) {
  const logoData = await getLogo();
  const tgQr = await qr(TELEGRAM_URL);
  const waQr = await getWhatsAppQr();
  const codes = ["us","sy","tr","eu"];
  const f = {};
  for (const c of codes) f[c] = await flag(c);

  const pos = [[60,210],[820,210],[60,460],[820,460],[440,710]];
  const cards = prices.map((p,i) => card(p,f[p.a],f[p.b],pos[i][0],pos[i][1])).join("");
  const date = now.toLocaleString("ar-SY",{timeZone:"Asia/Damascus",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
  const wa = waQr
    ? '<image href="' + waQr + '" x="1360" y="825" width="125" height="125"/><text x="1422" y="970" text-anchor="middle" direction="rtl" font-family="Noto Sans Arabic,Noto Sans,Arial" font-size="20" font-weight="700" fill="#f4c430">واتساب</text>'
    : "";

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">',
    '<rect width="1600" height="1000" fill="#071226"/>',
    '<rect x="18" y="18" width="1564" height="964" rx="42" fill="none" stroke="#f4c430" stroke-width="4"/>',
    '<rect x="45" y="45" width="300" height="120" rx="24" fill="#0b1b3d" stroke="#f4c430" stroke-width="2"/>',
    '<image href="' + logoData + '" x="65" y="60" width="125" height="90" preserveAspectRatio="xMidYMid meet"/>',
    '<text x="225" y="98" text-anchor="middle" direction="rtl" font-family="Noto Sans Arabic,Noto Sans,Arial" font-size="25" font-weight="800" fill="#fff">شركة الاتحاد</text>',
    '<text x="225" y="132" text-anchor="middle" direction="rtl" font-family="Noto Sans Arabic,Noto Sans,Arial" font-size="16" fill="#f4c430">للصرافة والحوالات المالية</text>',
    '<text x="800" y="88" text-anchor="middle" direction="rtl" font-family="Noto Sans Arabic,Noto Sans,Arial" font-size="44" font-weight="900" fill="#f4c430">أسعار الصرف — شركة الاتحاد</text>',
    '<text x="800" y="130" text-anchor="middle" font-family="Arial" font-size="23" font-weight="700" fill="#fff">' + esc(date) + '</text>',
    '<text x="800" y="168" text-anchor="middle" direction="rtl" font-family="Noto Sans Arabic,Noto Sans,Arial" font-size="17" fill="#aeb8cf">تحديث مباشر من لوحة التسعير</text>',
    cards,
    '<text x="250" y="825" text-anchor="middle" direction="rtl" font-family="Noto Sans Arabic,Noto Sans,Arial" font-size="21" font-weight="700" fill="#f4c430">قنوات شركة الاتحاد</text>',
    '<image href="' + tgQr + '" x="80" y="845" width="125" height="125"/><text x="142" y="970" text-anchor="middle" direction="rtl" font-family="Noto Sans Arabic,Noto Sans,Arial" font-size="20" font-weight="700" fill="#f4c430">تلغرام</text>',
    wa,
    '<text x="800" y="970" text-anchor="middle" direction="rtl" font-family="Noto Sans Arabic,Noto Sans,Arial" font-size="16" fill="#7f8aa5">الأسعار قابلة للتغير حسب وقت التحديث.</text>',
    '</svg>'
  ].join("");
  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { getLatestPrices, buildPriceImage };
