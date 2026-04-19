---
title: StockThai
emoji: 📈
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
short_description: Thai Stock Market Analyzer - SET data, TA, DW Warrants
---

# StockThai

Web app สำหรับวิเคราะห์หุ้นไทย ดึงข้อมูลจาก SET.or.th แบบ real-time

**Features:**
- Top 10 ranking (มูลค่า / ปริมาณ / ราคาขึ้น / ราคาลง)
- กราฟราคาพร้อม MA5/MA25/MA60
- Technical Analysis: RSI, MACD, Bollinger Bands, ADX
- แนวรับ-แนวต้าน, Short/Long term strategy
- ตาราง DW Warrants ทุกตัวของหุ้น (OTM/ITM, EG, Delta, IV)

**Run locally:**
```bash
git clone https://github.com/tonsup/stockthai
cd stockthai
npm install
node server.js
# เปิด http://localhost:3000
```
