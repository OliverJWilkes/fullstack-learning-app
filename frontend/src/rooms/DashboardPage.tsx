import { useAuth } from "../auth/useAuth";

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard-page">
      <h1>Welcome, {user?.displayName}</h1>
      <p>Room creation and joining are coming in the next milestone.</p>
      <button onClick={logout}>Log out</button>
    </div>
  );
}
