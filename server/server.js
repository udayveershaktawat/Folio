/*
 * /api/page  -> fast preview (title, word count) using axios + Readability
 *               (jaldi ke liye, ye pura Chrome nahi khud kholta)
 *
 * /api/pdf   -> REAL visual print. Puppeteer background me ek asli
 *               headless Chrome kholta hai, poora page load hone deta hai
 *               (scroll karke lazy-loaded images/content bhi trigger karta
 *               hai), aur phir Chrome ke apne "Print to PDF" engine se PDF
 *               banata hai — matlab images, layout, formatting sab
 *               original jaisa hi aata hai, pure page ke end tak.
 */

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { JSDOM, VirtualConsole } = require("jsdom");
const { Readability } = require("@mozilla/readability");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());
const PORT = 4000;

function normalizeUrl(raw) {
  if (!raw) return null;
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    return new URL(u).href;
  } catch {
    return null;
  }
}

// ---------- fast preview ----------
async function quickExtract(url) {
  const res = await axios.get(url, {
    timeout: 20000,
    responseType: "text",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    },
  });
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(res.data, { url, virtualConsole });
  const doc = dom.window.document;

  let title = doc.title || url;
  let text = "";
  try {
    const article = new Readability(doc.cloneNode(true)).parse();
    if (article?.textContent?.trim().length > 200) {
      title = article.title || title;
      text = article.textContent;
    }
  } catch {}
  if (!text) {
    doc.querySelectorAll("script,style,noscript,nav,footer,iframe").forEach((n) => n.remove());
    text = doc.body ? doc.body.textContent : "";
  }
  return { title, url, text: text.replace(/\n{3,}/g, "\n\n").trim() };
}

app.get("/api/page", async (req, res) => {
  const url = normalizeUrl(req.query.url);
  if (!url) return res.status(400).json({ error: "URL sahi nahi hai" });
  try {
    const page = await quickExtract(url);
    res.json({
      title: page.title,
      url: page.url,
      words: page.text.split(/\s+/).filter(Boolean).length,
      preview: page.text.slice(0, 300),
    });
  } catch (err) {
    res.status(502).json({ error: "Page load nahi hua: " + err.message });
  }
});

// ---------- real visual PDF (Puppeteer) ----------

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserPromise;
}

// Page ko neeche tak scroll karta hai taaki lazy-load images/content bhi
// load ho jayen, warna print me khali jagah ya broken-image box reh jati.
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = 600;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 120);
    });
  });
}

app.get("/api/pdf", async (req, res) => {
  const url = normalizeUrl(req.query.url);
  if (!url) return res.status(400).send("URL sahi nahi hai");

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

    // Screen CSS use karo (print CSS aksar backgrounds/content chhupa deti hai)
    await page.emulateMediaType("screen");
    await autoScroll(page);

    // Scroll se naye images/resources trigger hote hain (lazy-load) — unhe
    // load hone ka thoda time do, warna wo broken-image box jaisi dikhti hain.
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});

    // Icon fonts (chhote UI icons jaise expand/collapse arrows) agar load
    // hone se pehle hi print ho jayen, to unki jagah ek khaali black box
    // dikhta hai ("tofu" glyph). Fonts ka poora load hone ka wait karo.
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 400));

    const title = await page.title();
    const safeName = (title.replace(/[^a-z0-9]+/gi, "-").slice(0, 50) || "page") + ".pdf";

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16px", bottom: "16px", left: "16px", right: "16px" },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(502).send("PDF nahi bana: " + err.message);
  } finally {
    if (page) await page.close();
  }
});

process.on("exit", async () => {
  if (browserPromise) (await browserPromise).close();
});

app.listen(PORT, () => console.log(`Server chal raha hai -> http://localhost:${PORT}`));
