# Browser App

React + Tailwind app jisme ek mini search bar hai — koi bhi URL search karo,
uska content dikhega, aur "Download PDF" se pura page PDF ban ke download ho jayega.

## Kyun do folders hain (client + server)?

Browser security (CORS / Same-Origin Policy) ke wajah se React app khud
kisi doosri website (jaise wikipedia.com) ka content read nahi kar sakti —
ye Chrome ka jaan-bujh ke banaya gaya security rule hai. Isliye ek chhota
Node server (`server/`) chahiye jo URL fetch kare aur PDF banaye.
`server/server.js` sirf 2 routes ka hai — koi database, koi extra cheez nahi.

## Chalane ka tarika

Do terminal khol:

**Terminal 1 — backend:**
```bash
cd server
npm install
npm start
```
Ye `http://localhost:4000` pe chalega.

**Terminal 2 — frontend:**
```bash
cd client
npm install
npm run dev
```
Ye `http://localhost:5173` pe chalega — yahi browser mein khol.

Dev mode mein `client/vite.config.js` ke andar proxy already set hai
(`/api` -> `localhost:4000`), isliye CORS setup manually nahi karna padega.

## Kaam kaise karta hai

1. Search bar mein URL daalo, Enter dabao ya Open click karo — dayein side "Capture"
   panel mein title, word count, preview aata hai (ye jaldi ke liye lightweight extraction hai)
2. "Download PDF" dabao — ab **Puppeteer** (asli headless Chrome) background mein us URL ko
   khud kholta hai, poora page load hone deta hai, neeche tak scroll karke lazy-loaded images
   bhi trigger karta hai, aur phir Chrome ke apne "Print to PDF" engine se PDF banata hai.
   Isliye ye text-reflow wala PDF nahi hai — **asli page ka visual printout hai**, images aur
   formatting ke saath, poore page ke end tak (jitna bhi scroll hota ho).

**Pehli baar `npm install` chalane pe thoda time lagega** (~100-200MB) kyunki Puppeteer apna
khud ka Chromium download karta hai — isse alag se Chrome install karne ki zaroorat nahi.
Agar company/office network pe firewall hai jo downloads block karta hai, to install fail ho
sakta hai — normal home/personal internet pe koi dikkat nahi aati.

## Production build (deploy karne ke liye)

```bash
cd client
npm run build
```
`client/dist` folder ban jayega — usse kahin bhi (Vercel, Netlify) host kar sakte ho.
Server ko Railway/Render jaisi jagah deploy karna hoga, aur `client/vite.config.js`
ke proxy ki jagah `.env` me backend ka real URL daalna hoga.
