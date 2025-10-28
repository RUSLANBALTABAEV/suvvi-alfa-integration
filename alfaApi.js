import axios from "axios";
import dotenv from "dotenv";
import { notifyAdmin } from "./notifications.js";
import { syncToSuvvi } from "./suvviApi.js";

dotenv.config();

const alfa = axios.create({
  baseURL: process.env.ALFA_API_URL,
  headers: { Authorization: `Bearer ${process.env.ALFA_API_KEY}` },
});

// Поиск или создание клиента
export async function findOrCreateClient(data) {
  try {
    const { phone, name, email } = data;
    const search = await alfa.get(`/students?phone=${phone}`);
    
    if (search.data.length) {
      console.log(`✅ Клиент найден: ${name} (${phone})`);
      return search.data[0];
    }

    const res = await alfa.post("/students", {
      name,
      phone,
      email,
      source: "Suvvi",
      status: "new",
    });
    
    console.log(`✨ Новый клиент создан: ${name}`);
    await notifyAdmin(`Новая заявка: ${name}, ${phone}`);
    
    return res.data;
  } catch (error) {
    console.error("❌ Ошибка создания клиента:", error.message);
    throw error;
  }
}

// Получение открытых групп по курсу
export async function getOpenGroups(courseId) {
  try {
    const res = await alfa.get(`/groups?course=${courseId}&status=open`);
    return res.data;
  } catch (error) {
    console.error("❌ Ошибка получения групп:", error.message);
    return [];
  }
}

// Получение всех открытых групп (для напоминаний)
export async function getAllOpenGroups() {
  try {
    const res = await alfa.get(`/groups?status=open`);
    return res.data;
  } catch (error) {
    console.error("❌ Ошибка получения всех групп:", error.message);
    return [];
  }
}

// Добавление студента в группу
export async function addToGroup(groupId, studentId) {
  try {
    const res = await alfa.post(`/groups/${groupId}/members`, {
      student_id: studentId,
    });
    console.log(`✅ Студент ${studentId} добавлен в группу ${groupId}`);
    return res.data;
  } catch (error) {
    console.error("❌ Ошибка добавления в группу:", error.message);
    throw error;
  }
}

// Создание новой группы
export async function createGroup(courseId) {
  try {
    const res = await alfa.post(`/groups`, {
      course_id: courseId,
      status: "open",
      max_members: 8,
    });
    console.log(`✨ Создана новая группа ${res.data.id} для курса ${courseId}`);
    await notifyAdmin(`Создана новая группа для курса ${courseId}`);
    return res.data;
  } catch (error) {
    console.error("❌ Ошибка создания группы:", error.message);
    throw error;
  }
}

// Обновление статуса студента
export async function updateStudentStatus(studentId, status) {
  try {
    const res = await alfa.patch(`/students/${studentId}`, { status });
    console.log(`✅ Статус студента ${studentId} изменен на ${status}`);
    return res.data;
  } catch (error) {
    console.error("❌ Ошибка обновления статуса:", error.message);
    throw error;
  }
}

// Обновление оплаты
export async function updatePayment(studentId, amount, paid = true) {
  try {
    const res = await alfa.post(`/students/${studentId}/payments`, {
      amount,
      paid,
      date: new Date().toISOString(),
    });
    console.log(`✅ Оплата ${amount} для студента ${studentId} зарегистрирована`);
    return res.data;
  } catch (error) {
    console.error("❌ Ошибка регистрации оплаты:", error.message);
    throw error;
  }
}

// Получение информации о студенте
export async function getStudent(studentId) {
  try {
    const res = await alfa.get(`/students/${studentId}`);
    return res.data;
  } catch (error) {
    console.error("❌ Ошибка получения студента:", error.message);
    return null;
  }
}

// Обработка вебхука от Alfa CRM
export async function handleAlfaWebhook(req, res) {
  try {
    const { event, data } = req.body;
    console.log(`📩 Webhook от Alfa CRM: ${event}`);

    switch (event) {
      case "student.status_changed":
        // Синхронизация статуса в Suvvi
        await syncToSuvvi({
          student_id: data.student_id,
          status: data.new_status,
          suvvi_id: data.suvvi_id,
        });
        break;

      case "payment.created":
        // Уведомление клиента об оплате
        await syncToSuvvi({
          student_id: data.student_id,
          payment: data.amount,
          suvvi_id: data.suvvi_id,
        });
        break;

      case "group.full":
        // Группа заполнена - создать новую
        await createGroup(data.course_id);
        break;

      case "lesson.completed":
        // Запросить обратную связь после урока
        await requestFeedback(data);
        break;

      default:
        console.log(`⚠️ Неизвестное событие: ${event}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Ошибка обработки Alfa webhook:", error.message);
    res.status(500).json({ error: error.message });
  }
}

// Запрос обратной связи
async function requestFeedback(data) {
  try {
    const { group_id, lesson_id, students } = data;
    
    for (const student of students) {
      if (student.suvvi_id) {
        await syncToSuvvi({
          suvvi_id: student.suvvi_id,
          type: "feedback_request",
          lesson_id,
          group_id,
        });
      }
    }
  } catch (error) {
    console.error("❌ Ошибка запроса обратной связи:", error.message);
  }
}
