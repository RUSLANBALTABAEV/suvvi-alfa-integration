import express from "express";
import bodyParser from "body-parser";
import { handleSuvviWebhook } from "./suvviApi.js";
import { handleAlfaWebhook } from "./alfaApi.js";
import { scheduleReminders } from "./reminder.js";
import { getAvailableSlots } from "./groupManager.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.post("/webhook/suvvi", handleSuvviWebhook);
app.post("/webhook/alfa", handleAlfaWebhook);

app.get("/api/slots/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    const slots = await getAvailableSlots(courseId);
    res.json(slots);
  } catch (error) {
    console.error("❌ Ошибка получения слотов:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error("💥 Необработанная ошибка:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

scheduleReminders();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║  🚀 Suvvi ↔️ Alfa CRM Integration Server     ║
║  📡 Port: ${PORT.toString().padEnd(35)}║
║  🌍 Environment: ${(process.env.NODE_ENV || "development").padEnd(27)}║
║  ⏰ Reminders: Active                        ║
╚═══════════════════════════════════════════════╝
  `);
});

process.on("SIGTERM", () => {
  console.log("⏹️  SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("⏹️  SIGINT received, shutting down gracefully...");
  process.exit(0);
});
