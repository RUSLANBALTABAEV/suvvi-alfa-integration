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

// ✅ НОВАЯ ФУНКЦИЯ: Получение неоплаченных студентов
export async function getUnpaidStudents() {
  try {
    // Получаем студентов со статусом "registered" (записаны, но не оплатили)
    const res = await alfa.get(`/students?status=registered`);
    const students = res.data;

    // Фильтруем только тех, у кого нет оплаты или оплата не подтверждена
    const unpaid = [];
    
    for (const student of students) {
      try {
        const paymentsRes = await alfa.get(`/students/${student.id}/payments`);
        const payments = paymentsRes.data || [];
        
        // Проверяем, есть ли подтвержденные оплаты
        const hasPaidPayment = payments.some(p => p.paid === true);
        
        if (!hasPaidPayment) {
          // Получаем информацию о группе студента
          const groupRes = await alfa.get(`/students/${student.id}/group`);
          const group = groupRes.data;
          
          unpaid.push({
            ...student,
            group_id: group?.id,
            group_start_date: group?.start_date,
            amount: group?.course_price || 0,
          });
        }
      } catch (error) {
        console.error(`⚠️ Ошибка проверки оплат студента ${student.id}:`, error.message);
      }
    }

    console.log(`💰 Найдено неоплаченных студентов: ${unpaid.length}`);
    return unpaid;
  } catch (error) {
    console.error("❌ Ошибка получения неоплаченных студентов:", error.message);
    return [];
  }
}

// ✅ НОВАЯ ФУНКЦИЯ: Получение статистики за день
export async function getDailyStats() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Получаем новые заявки за сегодня
    const newLeadsRes = await alfa.get(`/students?created_at_from=${todayISO}&status=new`);
    const newLeads = newLeadsRes.data?.length || 0;

    // Получаем оплаты за сегодня
    const paymentsRes = await alfa.get(`/payments?date_from=${todayISO}`);
    const payments = paymentsRes.data || [];
    const paidPayments = payments.filter(p => p.paid === true);
    const totalAmount = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Получаем активных студентов (со статусом "active" или "paid")
    const activeRes = await alfa.get(`/students?status=active,paid`);
    const activeStudents = activeRes.data?.length || 0;

    // Получаем открытые группы
    const openGroupsRes = await alfa.get(`/groups?status=open`);
    const openGroups = openGroupsRes.data || [];
    
    // Считаем заполненные группы (8 человек)
    const fullGroups = openGroups.filter(g => (g.members_count || 0) >= 8).length;

    console.log(`📊 Статистика собрана: заявок ${newLeads}, оплат ${paidPayments.length}`);

    return {
      new_leads: newLeads,
      payments: paidPayments.length,
      total_amount: totalAmount,
      active_students: activeStudents,
      open_groups: openGroups.length,
      full_groups: fullGroups,
    };
  } catch (error) {
    console.error("❌ Ошибка получения статистики:", error.message);
    
    // Возвращаем нулевую статистику в случае ошибки
    return {
      new_leads: 0,
      payments: 0,
      total_amount: 0,
      active_students: 0,
      open_groups: 0,
      full_groups: 0,
    };
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
