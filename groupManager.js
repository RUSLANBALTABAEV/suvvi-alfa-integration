import {
  getOpenGroups,
  addToGroup,
  createGroup,
  updateStudentStatus,
} from "./alfaApi.js";
import { notifyAdmin } from "./notifications.js";

const MAX_GROUP_SIZE = 8;

export async function assignToGroup(studentId, courseId) {
  try {
    console.log(`🔍 Поиск группы для студента ${studentId}, курс ${courseId}`);

    const groups = await getOpenGroups(courseId);
    let targetGroup = findAvailableGroup(groups);

    if (!targetGroup) {
      console.log(`📝 Нет доступных групп, создаем новую для курса ${courseId}`);
      targetGroup = await createGroup(courseId);
      await notifyAdmin(`Создана новая группа ${targetGroup.id} для курса ${courseId}`);
    }

    await addToGroup(targetGroup.id, studentId);
    const updatedGroup = await checkGroupStatus(targetGroup.id, courseId);

    console.log(`✅ Студент ${studentId} назначен в группу ${targetGroup.id}`);
    return updatedGroup;
  } catch (error) {
    console.error("❌ Ошибка назначения в группу:", error.message);
    throw error;
  }
}

function findAvailableGroup(groups) {
  return groups.find((g) => {
    const currentSize = g.members_count || 0;
    return currentSize < MAX_GROUP_SIZE;
  });
}

async function checkGroupStatus(groupId, courseId) {
  try {
    const groups = await getOpenGroups(courseId);
    const group = groups.find((g) => g.id === groupId);

    if (!group) return null;

    if (group.members_count >= MAX_GROUP_SIZE) {
      console.log(`✅ Группа ${groupId} заполнена (${group.members_count}/${MAX_GROUP_SIZE})`);
      await notifyAdmin(
        `Группа ${groupId} заполнена! Участников: ${group.members_count}/${MAX_GROUP_SIZE}`
      );
    }

    return group;
  } catch (error) {
    console.error("❌ Ошибка проверки статуса группы:", error.message);
    return null;
  }
}

export async function getAvailableSlots(courseId) {
  try {
    const groups = await getOpenGroups(courseId);
    
    const slots = groups.map((g) => ({
      group_id: g.id,
      course_id: courseId,
      available: MAX_GROUP_SIZE - (g.members_count || 0),
      total: MAX_GROUP_SIZE,
      start_date: g.start_date,
      schedule: g.schedule,
    }));

    const totalAvailable = slots.reduce((sum, slot) => sum + slot.available, 0);
    
    return {
      total_available: totalAvailable,
      groups: slots,
    };
  } catch (error) {
    console.error("❌ Ошибка получения свободных слотов:", error.message);
    return { total_available: 0, groups: [] };
  }
}
