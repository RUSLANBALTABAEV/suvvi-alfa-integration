import axios from "axios";
import dotenv from "dotenv";
import { findOrCreateClient, getOpenGroups, addToGroup, createGroup } from "./alfaApi.js";

dotenv.config();

const suvvi = axios.create({
  baseURL: process.env.SUVVI_API_URL,
  headers: { Authorization: `Bearer ${process.env.SUVVI_TOKEN}` },
});

export async function handleSuvviWebhook(req, res) {
  const { event, data } = req.body;

  if (event === "new_lead") {
    // 1. Создать / обновить клиента в AlfaCRM
    const client = await findOrCreateClient(data);

    // 2. Проверить группы по курсу
    const groups = await getOpenGroups(data.course_id);
    let group = groups.find((g) => g.members_count < 8);

    if (!group) group = await createGroup(data.course_id);

    // 3. Добавить клиента в группу
    await addToGroup(group.id, client.id);

    // 4. Ответить пользователю через Suvvi
    await suvvi.post("/messages", {
      recipient_id: data.lead_id,
      type: "text",
      text: `Вы записаны в группу №${group.id}. Занятия начнутся ${group.start_date}.`,
    });
  }

  res.status(200).send("OK");
}
