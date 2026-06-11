import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import "./load-env.js";
import { prisma } from "./prisma.js";
import { departmentCodeToId, permissions, roleLabels, rolePermissions } from "./security.js";
const hotelCode = "NODERA";
const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? crypto.randomBytes(12).toString("base64url");
const departments = [
    { code: "EXECUTIVE", name: "Genel Yönetim" },
    { code: "HR", name: "İnsan Kaynakları" },
    { code: "TECHNICAL", name: "Teknik Servis" },
    { code: "HOUSEKEEPING", name: "Housekeeping" },
    { code: "FRONT_OFFICE", name: "Ön Büro" },
    { code: "SECURITY", name: "Güvenlik" },
    { code: "SPA", name: "SPA" },
    { code: "SATIS", name: "Satış" },
    { code: "FNB", name: "Yiyecek & İçecek" }
];
const roleDepartments = {
    siteAdmin: "EXECUTIVE",
    generalManager: "EXECUTIVE",
    hrManager: "HR",
    technicalManager: "TECHNICAL",
    technicalAssistant: "TECHNICAL",
    hkManager: "HOUSEKEEPING",
    frontOfficeManager: "FRONT_OFFICE",
    securityManager: "SECURITY",
    technicalChief: "TECHNICAL",
    floorChief: "HOUSEKEEPING",
    staff: null,
    spaManager: "SPA",
    salesManager: "SATIS",
    fnbManager: "FNB"
};
const users = [
    { username: "NODERADMIN", fullName: "Hasan Fırat Keskin", email: "noderadmin@noderasoftware.com", role: "siteAdmin", department: "EXECUTIVE" },
    { username: "admin", fullName: "Aylin Karaca", email: "aylin.karaca@hotelops.local", role: "generalManager", department: "EXECUTIVE" },
    { username: "manager", fullName: "Murat Erdem", email: "murat.erdem@hotelops.local", role: "generalManager", department: "EXECUTIVE" },
    { username: "ik.mudur", fullName: "Mert Demir", email: "mert.demir@hotelops.local", role: "hrManager", department: "HR" },
    { username: "teknisyen1", fullName: "Emre Teknik", email: "emre.teknik@hotelops.local", role: "staff", department: "TECHNICAL" },
    { username: "hk.personel", fullName: "Selin Oda", email: "selin.oda@hotelops.local", role: "staff", department: "HOUSEKEEPING" },
    { username: "housekeeping1", fullName: "Nihan Kaya", email: "nihan.kaya@hotelops.local", role: "floorChief", department: "HOUSEKEEPING" },
    { username: "hk.mudur", fullName: "Derya Housekeeping", email: "derya.housekeeping@hotelops.local", role: "hkManager", department: "HOUSEKEEPING" },
    { username: "onburo", fullName: "Ece Yılmaz", email: "ece.yilmaz@hotelops.local", role: "frontOfficeManager", department: "FRONT_OFFICE" },
    { username: "guvenlik", fullName: "Kerem Aksoy", email: "kerem.aksoy@hotelops.local", role: "securityManager", department: "SECURITY" },
    { username: "satis", fullName: "Deniz Satış", email: "deniz.satis@hotelops.local", role: "salesManager", department: "SATIS" },
    { username: "fnb", fullName: "Can Akın", email: "can.akin@hotelops.local", role: "fnbManager", department: "FNB" }
];
const workOrders = [
    {
        code: "WO-24081",
        title: "1108 numaralı odada klima arızası",
        type: "FAULT",
        department: "TECHNICAL",
        priority: "CRITICAL",
        status: "ACCEPTED",
        assignee: "teknisyen1",
        room: "1108",
        location: "11. Kat",
        due: "2026-05-12T14:30:00.000Z",
        createdBy: "onburo",
        description: "Misafir odasında klima soğutmuyor. Parça kontrolü gerekiyor.",
        tags: "klima, oda, acil",
        checklist: ["Elektrik beslemesini kontrol et", "Filtre ve fan kontrolü", "Misafire dönüş notu bırak"]
    },
    {
        code: "HK-88214",
        title: "VIP suite final oda kontrolü",
        type: "PLANNED_HOUSEKEEPING",
        department: "HOUSEKEEPING",
        priority: "HIGH",
        status: "REPORTED",
        assignee: "housekeeping1",
        room: "1501",
        location: "15. Kat",
        due: "2026-05-12T12:45:00.000Z",
        createdBy: "housekeeping1",
        description: "VIP misafir girişi öncesi oda checklist kontrolü.",
        tags: "vip, suite, kontrol",
        checklist: ["Minibar", "Banyo setleri", "Koku ve tekstil kontrolü"]
    },
    {
        code: "SEC-11902",
        title: "Balo salonu güvenlik devriyesi",
        type: "JOB",
        department: "SECURITY",
        priority: "MEDIUM",
        status: "ACCEPTED",
        assignee: "guvenlik",
        room: "",
        location: "Balo Salonu",
        due: "2026-05-12T21:00:00.000Z",
        createdBy: "guvenlik",
        description: "Gala organizasyonu için giriş ve kat devriyesi.",
        tags: "gala, devriye",
        checklist: ["Giriş kontrolü", "Kamera kontrolü", "Kapanış raporu"]
    },
    {
        code: "HR-44107",
        title: "Sezonluk işe alım mülakatları",
        type: "JOB",
        department: "HR",
        priority: "LOW",
        status: "REPORTED",
        assignee: "ik.mudur",
        room: "",
        location: "İK Ofisi",
        due: "2026-05-13T17:30:00.000Z",
        createdBy: "ik.mudur",
        description: "Kat hizmetleri ve teknik ekip için sezonluk aday görüşmeleri.",
        tags: "ik, mülakat",
        checklist: ["Aday listesi", "Görüşme notu", "Referans kontrol"]
    },
    {
        code: "FNB-55320",
        title: "Banket teknik kurulum talebi",
        type: "JOB",
        department: "TECHNICAL",
        priority: "HIGH",
        status: "ASSIGNED",
        assignee: "teknisyen1",
        room: "",
        location: "Grand Ballroom",
        due: "2026-05-12T19:00:00.000Z",
        createdBy: "fnb",
        description: "Ses sistemi ve sahne ışığı teknik kurulum desteği.",
        tags: "banket, teknik",
        checklist: ["Ses sistemi", "Işık masası", "Yedek kablo"]
    }
];
const calendarEvents = [
    { department: "TECHNICAL", title: "Chiller planlı bakım", startsAt: "2026-05-12T09:30:00.000Z", endsAt: "2026-05-12T11:30:00.000Z", loadScore: 64 },
    { department: "HOUSEKEEPING", title: "HK oda kontrol planı", startsAt: "2026-05-12T08:00:00.000Z", endsAt: "2026-05-12T16:00:00.000Z", loadScore: 82 },
    { department: "FRONT_OFFICE", title: "Grup check-in dalgası", startsAt: "2026-05-12T14:00:00.000Z", endsAt: "2026-05-12T18:00:00.000Z", loadScore: 78 },
    { department: "SECURITY", title: "Kongre katı devriye", startsAt: "2026-05-12T18:00:00.000Z", endsAt: "2026-05-12T23:00:00.000Z", loadScore: 52 },
    { department: "HR", title: "Oryantasyon eğitimi", startsAt: "2026-05-15T10:00:00.000Z", endsAt: "2026-05-15T12:00:00.000Z", loadScore: 35 }
];
async function main() {
    const passwordHash = await bcrypt.hash(defaultPassword, 12);
    const hotel = await prisma.hotel.upsert({
        where: { code: hotelCode },
        update: { name: "Nodera Sistem", timezone: "Europe/Istanbul" },
        create: { code: hotelCode, name: "Nodera Sistem", timezone: "Europe/Istanbul" }
    });
    const departmentMap = new Map();
    for (const department of departments) {
        const created = await prisma.department.upsert({
            where: { hotelId_code: { hotelId: hotel.id, code: department.code } },
            update: { name: department.name },
            create: { hotelId: hotel.id, code: department.code, name: department.name }
        });
        departmentMap.set(department.code, created.id);
    }
    for (const permission of permissions) {
        await prisma.permission.upsert({
            where: { code: permission },
            update: { description: permission },
            create: { code: permission, description: permission }
        });
    }
    const roleMap = new Map();
    for (const [code, label] of Object.entries(roleLabels)) {
        const role = await prisma.role.upsert({
            where: { code },
            update: { name: label, departmentCode: roleDepartments[code] },
            create: { code, name: label, departmentCode: roleDepartments[code] }
        });
        roleMap.set(code, role.id);
        const assignedPermissions = rolePermissions[code] ?? [];
        for (const permissionCode of assignedPermissions) {
            const permission = await prisma.permission.findUniqueOrThrow({ where: { code: permissionCode } });
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
                update: {},
                create: { roleId: role.id, permissionId: permission.id }
            });
        }
    }
    const userMap = new Map();
    for (const user of users) {
        const created = await prisma.user.upsert({
            where: { username: user.username },
            update: {
                hotelId: hotel.id,
                fullName: user.fullName,
                email: user.email,
                passwordHash,
                roleId: roleMap.get(user.role),
                departmentId: departmentMap.get(user.department),
                isActive: true,
                deletedAt: null
            },
            create: {
                hotelId: hotel.id,
                departmentId: departmentMap.get(user.department),
                roleId: roleMap.get(user.role),
                username: user.username,
                email: user.email,
                passwordHash,
                fullName: user.fullName,
                isActive: true
            }
        });
        userMap.set(user.username, created.id);
        if (!["siteAdmin", "generalManager", "frontOfficeManager", "securityManager", "salesManager", "fnbManager"].includes(user.role)) {
            await prisma.staffProfile.upsert({
                where: { userId: created.id },
                update: { title: roleLabels[user.role] ?? "Personel" },
                create: {
                    userId: created.id,
                    employeeNo: `EMP-${user.username.replace(/\W/g, "").toUpperCase()}`,
                    title: roleLabels[user.role] ?? "Personel",
                    hireDate: new Date("2025-01-15T00:00:00.000Z")
                }
            });
        }
    }
    for (const workOrder of workOrders) {
        const created = await prisma.workOrder.upsert({
            where: { code: workOrder.code },
            update: {
                title: workOrder.title,
                type: workOrder.type,
                departmentId: departmentMap.get(workOrder.department),
                assignedToId: userMap.get(workOrder.assignee),
                description: workOrder.description,
                room: workOrder.room,
                location: workOrder.location,
                tags: workOrder.tags,
                checklistJson: JSON.stringify(workOrder.checklist),
                priority: workOrder.priority,
                status: workOrder.status,
                slaDueAt: new Date(workOrder.due)
            },
            create: {
                code: workOrder.code,
                type: workOrder.type,
                departmentId: departmentMap.get(workOrder.department),
                createdById: userMap.get(workOrder.createdBy),
                assignedToId: userMap.get(workOrder.assignee),
                title: workOrder.title,
                description: workOrder.description,
                room: workOrder.room,
                location: workOrder.location,
                tags: workOrder.tags,
                checklistJson: JSON.stringify(workOrder.checklist),
                priority: workOrder.priority,
                status: workOrder.status,
                slaDueAt: new Date(workOrder.due)
            }
        });
        await prisma.workOrderTimeline.upsert({
            where: { id: `${created.id}-seed` },
            update: { message: "Başlangıç verisi oluşturuldu." },
            create: {
                id: `${created.id}-seed`,
                workOrderId: created.id,
                actorId: userMap.get(workOrder.createdBy),
                status: workOrder.status,
                message: "Başlangıç verisi oluşturuldu.",
                metadata: { seeded: true, department: departmentCodeToId[workOrder.department] }
            }
        });
    }
    for (const event of calendarEvents) {
        const departmentId = departmentMap.get(event.department);
        const existing = await prisma.calendarEvent.findFirst({
            where: {
                departmentId,
                title: event.title,
                startsAt: new Date(event.startsAt)
            }
        });
        if (existing) {
            await prisma.calendarEvent.update({
                where: { id: existing.id },
                data: {
                    endsAt: new Date(event.endsAt),
                    loadScore: event.loadScore,
                    description: "Seed takvim kaydı"
                }
            });
        }
        else {
            await prisma.calendarEvent.create({
                data: {
                    departmentId,
                    title: event.title,
                    description: "Seed takvim kaydı",
                    startsAt: new Date(event.startsAt),
                    endsAt: new Date(event.endsAt),
                    loadScore: event.loadScore,
                    createdById: userMap.get("admin")
                }
            });
        }
    }
    console.log("Seed completed. Default password is managed by SEED_DEFAULT_PASSWORD.");
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
