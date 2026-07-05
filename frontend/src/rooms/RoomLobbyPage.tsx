import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { ApiError } from "../lib/apiClient";
import * as roomsApi from "./api";
import type { RoomState } from "./api";

const POISONER_OPTIONAL_MIN = 11;
const POISONER_OPTIONAL_MAX = 15;

export function RoomLobbyPage() {
  const { code } = useParams<{ code: string }>();
  const { token, user } = useAuth();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [includePoisoner, setIncludePoisoner] = useState(false);

  const refresh = useCallback(async () => {
    if (!token || !code) return;
    try {
      const state = await roomsApi.getRoom(token, code);
      setRoom(state);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load room");
    }
  }, [token, code]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!room || room.status !== "LOBBY") return;
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [room, refresh]);

  async function handleJoin() {
    if (!token || !code) return;
    setIsBusy(true);
    setError(null);
    try {
      setRoom(await roomsApi.joinRoom(token, code));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to join room");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStart() {
    if (!token || !code || !room) return;
    setIsBusy(true);
    setError(null);
    try {
      const playerCount = room.players.length;
      const needsPoisonerDecision =
        room.hostType === "HUMAN" && playerCount >= POISONER_OPTIONAL_MIN && playerCount <= POISONER_OPTIONAL_MAX;
      setRoom(await roomsApi.startGame(token, code, needsPoisonerDecision ? includePoisoner : undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start game");
    } finally {
      setIsBusy(false);
    }
  }

  if (!room) {
    return (
      <div className="room-page">
        {error ? <p className="auth-error">{error}</p> : <p>Loading room…</p>}
        <Link to="/">Back to dashboard</Link>
      </div>
    );
  }

  const isPlayer = room.players.some((p) => p.userId === user?.id);
  const canJoin = !room.isHost && !isPlayer && room.status === "LOBBY";
  const playerCount = room.players.length;
  const canStart = room.isHost && room.status === "LOBBY" && playerCount >= 8 && playerCount <= 18;
  const needsPoisonerDecision =
    room.hostType === "HUMAN" && playerCount >= POISONER_OPTIONAL_MIN && playerCount <= POISONER_OPTIONAL_MAX;

  return (
    <div className="room-page">
      <h1>Room {room.code}</h1>
      <p>
        Status: {room.status} · Host: {room.hostType} {room.isHost && "(you)"}
      </p>

      {error && <p className="auth-error">{error}</p>}

      <h2>Players ({playerCount}/18)</h2>
      <ul>
        {room.players.map((p) => (
          <li key={p.id}>
            {p.displayName}
            {p.userId === user?.id && " (you)"}
            {p.role && ` — ${p.role}`}
            {!p.isAlive && " (dead)"}
          </li>
        ))}
      </ul>

      {canJoin && (
        <button onClick={handleJoin} disabled={isBusy}>
          Join this room
        </button>
      )}

      {room.isHost && room.status === "LOBBY" && (
        <div>
          {needsPoisonerDecision && (
            <label>
              <input
                type="checkbox"
                checked={includePoisoner}
                onChange={(e) => setIncludePoisoner(e.target.checked)}
              />
              Include the Poisoner
            </label>
          )}
          <button onClick={handleStart} disabled={isBusy || !canStart}>
            Start game
          </button>
          {!canStart && <p>Need 8–18 players to start (currently {playerCount}).</p>}
        </div>
      )}

      <p>
        <Link to="/">Back to dashboard</Link>
      </p>
    </div>
  );
}
