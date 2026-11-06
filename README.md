# Story Circle

เว็บเกมปาร์ตี้ภาษาไทยสำหรับเพื่อน 2–10 คน ใช้มือถือคนละเครื่อง สร้างวงด้วยชื่อเล่น สแกน QR แล้วเล่นได้เลย

**Production:** https://striking-sparkle-production-adf7.up.railway.app

## เล่นอะไรได้บ้าง

- **โหวตข้างน้อย** — เลือกให้ตรงกับคนส่วนใหญ่ เสมอรอดทั้งวง; 2 คนเล่น **ใจตรงกัน**
- **แข่งม้า** — เลือก 1 ใน 8 ม้า ติด 3 อันดับแรกรอด พร้อมคะแนนตามอันดับ
- **ร่มชูชีพวัดใจ** — 3–10 คน คนแรกหลุด แย่งโควต้ารอดใน 8 วินาที
- **เล่นผสม** — สลับเกม 3, 6 หรือ 9 รอบตามจำนวนคน

มีคำถามพร้อมเล่น120ข้อและเขียนเองได้ กดพร้อม/พักตานี้ พักวง ข้ามรอบ เปลี่ยนเกมระหว่างรอบ และสรุปคะแนนแยกเกมท้ายวง ผลอยู่ต่อเมื่อ refresh หรือหลุดเชื่อมต่อ สรุปวงเก็บประมาณ24ชั่วโมงหลังจบ

## พัฒนาบนเครื่อง

ใช้ Node.js22 และ PostgreSQL18 หรือรุ่นที่ Prisma6 รองรับ ตั้งค่า `backend/.env` ด้วยค่าของฐานข้อมูลท้องถิ่น:

```dotenv
DATABASE_URL=postgresql://postgres:your-local-password@localhost:5432/story_circle
JWT_SECRET=replace-with-a-long-random-development-secret
PORT=3001
FRONTEND_URL=http://localhost:5173
```

ติดตั้งและเปิด backend:

```sh
cd backend
npm ci
npm run db:push
npm run dev
```

อีก terminal เปิด frontend:

```sh
cd frontend
npm ci
npm run dev
```

Vite proxy `/api` และ `/socket.io` ไปที่backend จึงไม่ต้องกำหนด `VITE_API_URL` สำหรับการใช้งานนี้

## ตรวจงาน

```sh
npm run lint --prefix frontend
npm run build --prefix frontend
npm test --prefix backend
```

สำหรับintegrationให้เปิดแอปกับฐานข้อมูลทดสอบที่แยกไว้ ตั้ง `PORT=3105`, `HOST_GRACE_MS=1500` แล้วเรียกจากroot:

```sh
node backend/scripts/smoke-party.mjs
```

สคริปต์สร้างQAguests/วงชั่วคราวเพื่อทดสอบ10clients มีการพักรอรอบตามเวลาจริง ใช้ `--production --url=...` เฉพาะsmokeขนาด3clientsบนเว็บที่ได้รับอนุญาต ห้ามใช้load testกับฐานจริง GitHub ActionsรันชุดหลักกับPostgreSQL18ให้อัตโนมัติ

## โครงสร้าง

- `backend/src/party/engine.js` — กติกาและstate transitionsที่ทดสอบแยกได้
- `backend/src/party/service.js` — transactions, revision, deadlines, snapshots, presence, hostและretention
- `backend/src/party/questions.js` — คลังคำถามภาษาไทย
- `frontend/src/pages/PartyHome.jsx` — หน้าแรกและสร้าง/เข้าวง
- `frontend/src/pages/PartyRoom.jsx` — ห้องรอ ทั้งสามเกม และสรุป
- `frontend/src/hooks/useParty.js` — เชื่อมต่อ รับsnapshot และส่งคำสั่งพร้อมack

## Deploy

Dockerfileรวมfrontend/backendเป็นNode processเดียว ใช้PostgreSQLprivateและapp1replicaบนRailway คำสั่งpre-deployคือ `npm run db:push`, healthcheck `/health/ready`.

อ่าน [การ deploy](DEPLOYMENT.md), [บันทึก v2 และการตรวจงาน](docs/PRODUCTION-V2.md), และ [แผนประสบการณ์เกม](docs/GAME-EXPERIENCE-PLAN.md).

ข้อมูลรอบเก่าในschemaยังอยู่เพื่อไม่ลบประวัติเดิม แต่protocolเกมเดิมถูกแทนด้วย `party:sync`, `party:command`, `party:state`, `party:leave`. รุ่นนี้ไม่มีการเรียกAIแบบเสียเงินระหว่างเล่น
