import { db } from "@/lib/db";
import { SignupForm } from "@/components/auth/signup-form";

export default async function SignupPage() {
  const companies = await db.company.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return <SignupForm companies={companies} />;
}
