/** سكربت لمرة واحدة: إعادة تعيين كلمة مرور المستخدم ahmed. */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const اسم_المستخدم = "ahmed";
const كلمة_المرور_الجديدة = "ahmed@2003";

async function main() {
  const hash = await bcrypt.hash(كلمة_المرور_الجديدة, 10);
  const مستخدم = await prisma.user.update({
    where: { username: اسم_المستخدم },
    data: { passwordHash: hash, mustChangePassword: false },
  });
  console.log(`✓ تم تحديث كلمة مرور ${مستخدم.name} (${مستخدم.username})`);
  console.log(`  كلمة المرور الجديدة: ${كلمة_المرور_الجديدة}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ فشل التحديث:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
