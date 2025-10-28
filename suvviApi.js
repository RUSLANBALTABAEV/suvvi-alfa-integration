import axios from "axios";
import dotenv from "dotenv";
import {
  findOrCreateClient,
  updateStudentStatus,
  updatePayment,
} from "./alfaApi.js";
import { assignToGroup } from "./groupManager.js";

dotenv.config();

const suvvi = axios.create({
  baseURL: process.env.SUVVI_API_URL,
  headers: { Authorization: `Bearer ${process.env.SUVVI_TOKEN}` },
});

export async function handleSuvviWebhook(req, res) {
  try {
    const { event, data } = req.body;
    console.log(`📩 Webhook от Suvvi: ${event}`);

    switch (event) {
      case "new_lead":
        await handleNewLead(data);
        break;

      case "payment_confirmed":
        await handlePayment(data);
        break;

      case "feedback_received":
        await handleFeedback(data);
        break;

      case "cancellation":
        await handleCancellation(data);
        break;

      default:
        console.log(`⚠️ Неизвестное событие: ${event}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Ошибка обработки Suvvi webhook:", error.message);
    res.status(500).json({ error: error.message });
  }
}

async function handleNewLead(data) {
  try {
    const client = await findOrCreateClient({
      phone: data.phone,
      name: data.name,
      email: data.email,
    });

    const group = await assignToGroup(client.id, data.course_id);
    await updateStudentStatus(client.id, "registered");

    await sendMessage(data.lead_id, {
      text: `✅ Вы записаны в группу №${group.id}!\n\n📅 Занятия начнутся ${group.start_date}\n⏰ Время: ${group.schedule}\n👥 Мест в группе: ${group.members_count}/8`,
    });

    console.log(`✅ Заявка обработана: ${data.name} → группа ${group.id}`);
  } catch (error) {
    console.error("❌ Ошибка обработки заявки:", error.message);
    await sendMessage(data.lead_id, {
      text: "❌ Произошла ошибка при записи. Пожалуйста, свяжитесь с администратором.",
    });
  }
}

async function handlePayment(data) {
  try {
    const { student_id, amount, suvvi_id } = data;

    await updatePayment(student_id, amount, true);
    await updateStudentStatus(student_id, "paid");

    await sendMessage(suvvi_id, {
      text: `✅ Оплата ${amount} успешно получена!\n\nТеперь вы можете посещать занятия. До встречи! 👋`,
    });

    console.log(`✅ Оплата обработана: студент ${student_id}, сумма ${amount}`);
  } catch (error) {
    console.error("❌ Ошибка обработки оплаты:", error.message);
  }
}

async function handleFeedback(data) {
  try {
    const { student_id, lesson_id, rating, comment, suvvi_id } = data;

    await axios.post(`${process.env.ALFA_API_URL}/feedback`, {
      student_id,
      lesson_id,
      rating,
      comment,
    });

    await sendMessage(suvvi_id, {
      text: "Спасибо за отзыв! Ваше мнение очень важно для нас. 💙",
    });

    console.log(`✅ Отзыв получен от студента ${student_id}`);
  } catch (error) {
    console.error("❌ Ошибка обработки отзыва:", error.message);
  }
}

async function handleCancellation(data) {
  try {
    const { student_id, reason, suvvi_id } = data;

    await updateStudentStatus(student_id, "cancelled");

    await sendMessage(suvvi_id, {
      text: "Жаль, что вы решили отменить запись. Надеемся увидеть вас снова! 👋",
    });

    console.log(`✅ Отмена обработана для студента ${student_id}`);
  } catch (error) {
    console.error("❌ Ошибка обработки отмены:", error.message);
  }
}

export async function syncToSuvvi(data) {
  try {
    const { suvvi_id, status, payment, type, lesson_id } = data;

    if (!suvvi_id) {
      console.warn("⚠️ Нет suvvi_id для синхронизации");
      return;
    }

    if (status) {
      const messages = {
        registered: "✅ Вы успешно записаны на курс!",
        paid: "💰 Оплата получена. Спасибо!",
        completed: "🎓 Поздравляем с завершением курса!",
        cancelled: "❌ Ваша запись отменена.",
      };

      await sendMessage(suvvi_id, { text: messages[status] || "Статус обновлен" });
    }

    if (payment) {
      await sendMessage(suvvi_id, {
        text: `💰 Получена оплата: ${payment} сум.\n\nСпасибо!`,
      });
    }

    if (type === "feedback_request") {
      await sendMessage(suvvi_id, {
        text: "Занятие завершено! 🎉\n\nПожалуйста, оцените урок от 1 до 5 и оставьте комментарий.",
        buttons: [
          { text: "⭐ 1", callback_data: `rate_1_${lesson_id}` },
          { text: "⭐⭐ 2", callback_data: `rate_2_${lesson_id}` },
          { text: "⭐⭐⭐ 3", callback_data: `rate_3_${lesson_id}` },
          { text: "⭐⭐⭐⭐ 4", callback_data: `rate_4_${lesson_id}` },
          { text: "⭐⭐⭐⭐⭐ 5", callback_data: `rate_5_${lesson_id}` },
        ],
      });
    }

    console.log(`✅ Синхронизация в Suvvi выполнена для ${suvvi_id}`);
  } catch (error) {
    console.error("❌ Ошибка синхронизации в Suvvi:", error.message);
  }
}

export async function sendMessage(recipientId, message) {
  try {
    await suvvi.post("/messages", {
      recipient_id: recipientId,
      type: message.buttons ? "interactive" : "text",
      ...message,
    });
  } catch (error) {
    console.error("❌ Ошибка отправки сообщения:", error.message);
    throw error;
  }
}
