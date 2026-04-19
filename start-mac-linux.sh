#!/bin/bash
echo ""
echo " ==================================="
echo "  StockThai - Thai Stock Analyzer"
echo " ==================================="
echo ""

open_browser() {
  if command -v open &>/dev/null; then
    open "http://localhost:3000"   # macOS
  elif command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:3000"  # Linux
  fi
}

# Try Docker first
if command -v docker &>/dev/null; then
  echo "[Docker พบแล้ว] กำลังเริ่มต้น..."
  sleep 1 && open_browser &
  docker compose up --build
  exit 0
fi

# Try Node.js
if command -v node &>/dev/null; then
  echo "[Node.js พบแล้ว] กำลังติดตั้ง dependencies..."
  npm install
  echo ""
  echo "กำลังเปิดแอพ... http://localhost:3000"
  sleep 1 && open_browser &
  node server.js
  exit 0
fi

echo ""
echo "[ข้อผิดพลาด] ไม่พบ Node.js หรือ Docker"
echo ""
echo "กรุณาติดตั้ง Node.js จาก: https://nodejs.org"
echo ""
read -p "กด Enter เพื่อออก..."
