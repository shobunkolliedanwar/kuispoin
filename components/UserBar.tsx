"use client";
import { signOut, useSession } from "next-auth/react";

export default function UserBar() {
  const { data: session } = useSession();
  if (!session?.user) return null;
  return <div className="userBar">
    {session.user.image ? <img src={session.user.image} alt="Foto profil" /> : <div className="avatar">{session.user.name?.[0] ?? "U"}</div>}
    <div className="userInfo"><b>{session.user.name}</b><small>{session.user.email}</small></div>
    <button className="logoutBtn" onClick={() => signOut({ callbackUrl: "/login" })}>Keluar</button>
  </div>;
}
