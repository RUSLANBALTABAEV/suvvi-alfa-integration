import cron from "node-cron";
import { getAllOpenGroups } from "./alfaApi.js";
import { sendMessage } from "./suvviApi.js";
import { sendDailySummary } from "./notifications.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Настройка всех запланированных задач
 */
export function scheduleReminders() {
  console.log("⏰ Планировщик напоминаний запущен");

  // Напоминания о занятиях - каждый день в 18:00
  cron.schedule("0 18 * * *", async () => {
    console.log("🔔 Отправка напоминаний о завтрашних занятиях...");
    await sendLessonReminders();
  });

  // Сводка за день - каждый день в 20:00
  cron.schedule("0 20 * * *", async () => {
    console.log("📊 Отправка дневной сводки...");
    await sendDailySummaryReport();
  });

  // Проверка неоплаченных записей - каждый день в 10:00
  cron.schedule("0 10 * * *", async () => {
    console.log("💰 Проверка неоплаченных записей...");
    await checkUnpaidStudents();
  });

  console.log("✅ Все задачи запланированы");
}

/**
 * Отправляет напоминания о занятиях
 */
async function sendLessonReminders() {
  try {
    const groups = await getAllOpenGroups();
    let sentCount = 0;

    for (const group of groups) {
      if (!group.lessons || group.lessons.length === 0) continue;

      // Найти занятия на завтра
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const nextDay = new Date(tomorrow);
      nextDay.setDate(nextDay.getDate() + 1);

      const tomorrowLessons = group.lessons.filter((lesson) => {
        const lessonDate = new Date(lesson.date);
        return lessonDate >= tomorrow && lessonDate < nextDay;
      });

      // Отправить напоминания
      for (const lesson of tomorrowLessons) {
        for (const student of group.students || []) {
          if (!student.suvvi_id) continue;

          try {
            await sendMessage(student.suvvi_id, {
              text: `📚 Напоминание о занятии!\n\n🏫 Группа: ${group.name || group.id}\n📅 Завтра: ${formatDate(lesson.date)}\n⏰ Время: ${lesson.time}\n📍 Место: ${lesson.location || "см. в расписании"}\n\nДо встречи! 👋`,
            });
            sentCount++;
          } catch (error) {
            console.error(`❌ Ошибка отправки напоминания студенту ${student.id}:`, error.message);
          }
        }
      }
    }

    console.log(`✅ Отправлено напоминаний: ${sentCount}`);
  } catch (error) {
    console.error("❌ Ошибка отправки напоминаний:", error.message);
  }
}

/**
 * Проверяет неоплаченных студентов
 */
async function checkUnpaidStudents() {
  try {
    // Здесь должен быть запрос к Alfa CRM для получения студентов со статусом "registered" но без оплаты
    // const unpaidStudents = await getUnpaidStudents();

    // Пример логики
    console.log("💰 Проверка неоплаченных студентов...");
    
    // Отправить напоминание об оплате
    // for (const student of unpaidStudents) {
    //   await sendPaymentReminder(student);
    // }
  } catch (error) {
    console.error("❌ Ошибка проверки неоплаченных студентов:", error.message);
  }
}

/**
 * Отправляет напоминание об оплате
 */
async function sendPaymentReminder(student) {
  try {
    if (!student.suvvi_id) return;

    await sendMessage(student.suvvi_id, {
      text: `💰 Напоминание об оплате\n\nЗдравствуйте, ${student.name}!\n\nВы записаны на курс, но оплата еще не получена.\n\n💳 Сумма: ${student.amount} сум\n📅 Старт курса: ${student.group_start_date}\n\nПожалуйста, завершите оплату для подтверждения участия.`,
    });

    console.log(`✅ Напоминание об оплате отправлено студенту ${student.id}`);
  } catch (error) {
    console.error(`❌ Ошибка отправки напоминания об оплате:`, error.message);
  }
}

/**
 * Отправляет дневную сводку
 */
async function sendDailySummaryReport() {
  try {
    // Здесь должна быть логика сбора статистики за день из Alfa CRM
    const summary = {
      new_leads: 0, // получить из базы
      payments: 0,
      total_amount: 0,
      active_students: 0,
      open_groups: 0,
      full_groups: 0,
    };

    await sendDailySummary(summary);
    console.log("✅ Дневная сводка отправлена");
  } catch (error) {
    console.error("❌ Ошибка отправки дневной сводки:", error.message);
  }
}

/**
 * Форматирует дату для отображения
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
