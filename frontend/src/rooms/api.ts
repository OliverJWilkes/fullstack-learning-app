import { apiRequest } from "../lib/apiClient";

export type HostType = "HUMAN" | "AI";
export type GameStatus = "LOBBY" | "IN_PROGRESS" | "FINISHED";

export interface RoomPlayer {
  id: string;
  userId: string;
  displayName: string;
  seatOrder: number;
  isAlive: boolean;
  role: string | null;
  team: string | null;
}

export interface RoomState {
  id: string;
  code: string;
  hostType: HostType;
  status: GameStatus;
  playerCount: number | null;
  winningTeam: string | null;
  isHost: boolean;
  players: RoomPlayer[];
}

export function createRoom(token: string, hostType: HostType): Promise<RoomState> {
  return apiRequest("/rooms", { method: "POST", token, body: { hostType } });
}

export function getRoom(token: string, code: string): Promise<RoomState> {
  return apiRequest(`/rooms/${code}`, { token });
}

export function joinRoom(token: string, code: string): Promise<RoomState> {
  return apiRequest(`/rooms/${code}/join`, { method: "POST", token });
}

export function startGame(token: string, code: string, poisonerDecision?: boolean): Promise<RoomState> {
  return apiRequest(`/rooms/${code}/start`, {
    method: "POST",
    token,
    body: poisonerDecision === undefined ? {} : { poisonerDecision },
  });
}
