import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { ApiError } from "../lib/apiClient";
import * as roomsApi from "./api";
import type { HostType } from "./api";

export function DashboardPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [hostType, setHostType] = useState<HostType>("AI");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleCreate() {
    if (!token) return;
    setIsBusy(true);
    setError(null);
    try {
      const room = await roomsApi.createRoom(token, hostType);
      navigate(`/rooms/${room.code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create room");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setIsBusy(true);
    setError(null);
    const code = joinCode.trim().toUpperCase();
    try {
      await roomsApi.joinRoom(token, code);
      navigate(`/rooms/${code}`);
    } catch (err) {
      if (err instanceof ApiError && err.message === "You have already joined this room") {
        navigate(`/rooms/${code}`);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to join room");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="dashboard-page">
      <h1>Welcome, {user?.displayName}</h1>

      {error && <p className="auth-error">{error}</p>}

      <section>
        <h2>Create a room</h2>
        <label>
          Host
          <select value={hostType} onChange={(e) => setHostType(e.target.value as HostType)}>
            <option value="AI">AI host</option>
            <option value="HUMAN">I'll host</option>
          </select>
        </label>
        <button onClick={handleCreate} disabled={isBusy}>
          Create room
        </button>
      </section>

      <section>
        <h2>Join a room</h2>
        <form onSubmit={handleJoin}>
          <label>
            Room code
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} maxLength={6} required />
          </label>
          <button type="submit" disabled={isBusy}>
            Join
          </button>
        </form>
      </section>

      <button onClick={logout}>Log out</button>
    </div>
  );
}
