import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const alfa = axios.create({
  baseURL: process.env.ALFA_API_URL,
  headers: { Authorization: `Bearer ${process.env.ALFA_API_KEY}` },
});

export async function findOrCreateClient(data) {
  const { phone, name, email } = data;
  const search = await alfa.get(`/students?phone=${phone}`);
  if (search.data.length) return search.data[0];

  const res = await alfa.post("/students", { name, phone, email, source: "Suvvi" });
  return res.data;
}

export async function getOpenGroups(courseId) {
  const res = await alfa.get(`/groups?course=${courseId}&status=open`);
  return res.data;
}

export async function addToGroup(groupId, studentId) {
  return await alfa.post(`/groups/${groupId}/members`, { student_id: studentId });
}

export async function createGroup(courseId) {
  const res = await alfa.post(`/groups`, { course_id: courseId, status: "open" });
  return res.data;
}
