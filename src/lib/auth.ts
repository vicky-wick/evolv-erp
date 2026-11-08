export interface Session {
  name: string;
  email: string;
  role: string;
  signedInAt: string;
}

const STORAGE_KEY = "evolve.session";

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function signIn(email: string): Session {
  const handle = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  const name = handle
    ? handle
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Team member";

  const session: Session = {
    name,
    email,
    role: "Administrator",
    signedInAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function signOut(): void {
  localStorage.removeItem(STORAGE_KEY);
}
