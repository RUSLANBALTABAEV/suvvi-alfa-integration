import express from "express";
import bodyParser from "body-parser";
import { handleSuvviWebhook } from "./suvviApi.js";
import { handleAlfaWebhook } from "./alfaApi.js";
import { scheduleReminders } from "./reminder.js";

const app = express();
app.use(bodyParser.json());

// Webhook от Suvvi
app.post("/webhook/suvvi", handleSuvviWebhook);

// Webhook от Alfa CRM (если настроен)
app.post("/webhook/alfa", handleAlfaWebhook);

// Запуск планировщика напоминаний
scheduleReminders();

app.listen(process.env.PORT, () =>
  console.log(`🚀 Server started on port ${process.env.PORT}`)
);
