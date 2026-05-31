#!/bin/bash
echo "=== NullVault v2.0 ==="
echo ""
echo "Step 1: Installing backend dependencies..."
cd backend && npm install
echo ""
echo "Step 2: Installing frontend dependencies..."
cd ../frontend && npm install
echo ""
echo "Step 3: Starting backend on :4000..."
cd ../backend && npm run dev &
BACKEND_PID=$!
echo ""
echo "Step 4: Starting frontend on :5173..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!
echo ""
echo "NullVault running!"
echo "  Backend:  http://localhost:4000"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."
wait $BACKEND_PID $FRONTEND_PID
