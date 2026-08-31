import { auth } from "@/auth";
import ParentContactClient from "./contact-client";

export default async function ParentContactPage() {
  const session = await auth();

  const isParentLoggedIn =
    session?.user?.role === "PARENT";

  return (
    <ParentContactClient
      isParentLoggedIn={isParentLoggedIn}
    />
  );
}
