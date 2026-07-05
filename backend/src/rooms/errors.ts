export class RoomNotFoundError extends Error {
  constructor() {
    super("Room not found");
    this.name = "RoomNotFoundError";
  }
}

export class RoomNotJoinableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "RoomNotJoinableError";
  }
}

export class NotRoomHostError extends Error {
  constructor() {
    super("Only the host can perform this action");
    this.name = "NotRoomHostError";
  }
}

export class InvalidPlayerCountError extends Error {
  constructor(count: number) {
    super(`Cannot start a game with ${count} players (must be 8-18)`);
    this.name = "InvalidPlayerCountError";
  }
}
