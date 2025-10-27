import cron from "node-cron";
import { getOpenGroups } from "./alfaApi.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const suvvi = axios.create({
  baseURL: process.env.SUVVI_API_URL,
  headers: { Authorization: `Bearer ${process.env.SUVVI_TOKEN}` },
});

export function scheduleReminders() {
  // Каждый день в 9:00
  cron.schedule("0 9 * * *", async () => {
    const groups = await getOpenGroups();

    for (const g of groups) {
      const tomorrowLessons = g.lessons.filter(
        (l) => new Date(l.date).getTime() - Date.now() < 86400000
      );

      for (const lesson of tomorrowLessons) {
        for (const student of g.students) {
          await suvvi.post("/messages", {
            recipient_id: student.suvvi_id,
            type: "text",
            text: `Напоминаем! Завтра занятие "${g.name}" в ${lesson.time}.`,
          });
        }
      }
    }
  });
}
