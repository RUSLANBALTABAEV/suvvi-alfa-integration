import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const suvvi = axios.create({
  baseURL: process.env.SUVVI_API_URL,
  headers: { Authorization: `Bearer ${process.env.SUVVI_TOKEN}` },
});

export async function notifyAdmin(message) {
  try {
    const adminId = process.env.ADMIN_SUVVI_ID;

    if (!adminId) {
      console.warn("⚠️ ADMIN_SUVVI_ID не настроен в .env");
      return;
    }

    await suvvi.post("/messages", {
      recipient_id: adminId,
      type: "text",
      text: `🔔 Уведомление администратору:\n\n${message}`,
    });

    console.log(`📨 Уведомление отправлено администратору`);
  } catch (error) {
    console.error("❌ Ошибка отправки уведомления администратору:", error.message);
  }
}

export async function sendDailySummary(summaryData) {
  const message = `
📊 Сводка за день

📝 Новых заявок: ${summaryData.new_leads}
💰 Оплат: ${summaryData.payments} (${summaryData.total_amount} сум)
👥 Активных студентов: ${summaryData.active_students}
📚 Открытых групп: ${summaryData.open_groups}
✅ Заполненных групп: ${summaryData.full_groups}
  `.trim();

  await notifyAdmin(message);
}
