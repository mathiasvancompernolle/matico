# 🟣 Kapitas — Persoonlijke Portfolio Tracker

Een volledig Nederlandse portfolio tracker met real-time koersen, AI-analyse en vergelijking met benchmarks.

---

## 🚀 Deployen op Vercel (stap voor stap)

### Stap 1: GitHub repository aanmaken

1. Ga naar [github.com](https://github.com) en log in
2. Klik op **"New repository"** (groene knop rechtsboven)
3. Geef het de naam `kapitas`
4. Klik op **"Create repository"**
5. Upload alle bestanden van deze map naar die repository (sleep ze in de interface of gebruik Git)

### Stap 2: Vercel koppelen

1. Ga naar [vercel.com](https://vercel.com) en log in
2. Klik op **"Add New Project"**
3. Kies je `kapitas` GitHub repository
4. Vercel detecteert automatisch dat het een React app is
5. Klik **"Deploy"** — de eerste deployment werkt nog niet perfect zonder API keys

### Stap 3: API Keys toevoegen in Vercel

1. Ga in Vercel naar je project → **Settings** → **Environment Variables**
2. Voeg toe:
   - `FINNHUB_API_KEY` → jouw Finnhub API key (van [finnhub.io](https://finnhub.io))
   - `ANTHROPIC_API_KEY` → jouw Anthropic API key (van [console.anthropic.com](https://console.anthropic.com))
3. Klik **"Save"**
4. Ga naar **Deployments** → klik op de laatste → **"Redeploy"**

### Stap 4: Klaar! 🎉

Je krijgt een link zoals `kapitas-xyz.vercel.app` — die kun je delen met vrienden!

---

## 📱 Op je gsm als app zetten (PWA)

### iPhone (Safari):
1. Open de Vercel link in Safari
2. Druk op het **Deel** icoontje (vierkant met pijltje)
3. Kies **"Zet op beginscherm"**
4. Naam: Kapitas → **Voeg toe**

### Android (Chrome):
1. Open de link in Chrome
2. Druk op de **drie puntjes** rechtsboven
3. Kies **"Toevoegen aan beginscherm"**

---

## ✨ Functies

- 📊 **Portfolio overzicht** met grafiek (1D, 1W, 1M, 1J, YTD, Laatste, Totaal)
- 📈 **Real-time koersen** via Finnhub.io (wereldwijd: NYSE, NASDAQ, Euronext, etc.)
- 🔍 **Aandelen/ETF/Crypto zoeken** en toevoegen met datum en kostprijs
- 📰 **Laatste nieuws** per aandeel
- 🤖 **AI-analyse** via Claude (Anthropic) met web search
- ⚖️ **Prestatievergelijking** met MSCI World, S&P 500, BEL 20, Bitcoin
- 🔎 **Filter** op type (aandelen/ETFs/crypto) of specifiek symbool
- 💰 **Dividend** overzicht
- 🧾 **Belastingen** berekening (indicatief)
- ⚙️ **Instellingen** om je naam te wijzigen

---

## 🔑 API Keys verkrijgen

### Finnhub (gratis):
1. Ga naar [finnhub.io/register](https://finnhub.io/register)
2. Maak een gratis account aan
3. Ga naar Dashboard → je API key staat er meteen

### Anthropic:
1. Ga naar [console.anthropic.com](https://console.anthropic.com)
2. Maak een account aan of log in
3. Ga naar **API Keys** → **Create Key**
4. Kopieer de key (je ziet hem maar 1x!)

---

## 🏗️ Technische stack

- **Frontend**: React 18 + Recharts
- **Backend**: Vercel Serverless Functions (Node.js)
- **Koersen**: Finnhub.io REST API
- **AI**: Anthropic Claude API met web search
- **Opslag**: localStorage (data blijft in je browser)
- **Deployment**: Vercel (gratis)
