import type { Game, GamePlayer, User } from "@prisma/client";

type PlayerWithUser = GamePlayer & { user: User };
type GameWithPlayers = Game & { players: PlayerWithUser[] };

/**
 * Redacts role/team info the requester isn't entitled to see: only the host,
 * the player themself, or (once the game has started) the publicly-revealed
 * Mayor get their role exposed over this endpoint.
 */
export function serializeRoomState(game: GameWithPlayers, requestingUserId: string) {
  const isHost = game.hostUserId === requestingUserId;

  return {
    id: game.id,
    code: game.code,
    hostType: game.hostType,
    status: game.status,
    playerCount: game.playerCount,
    winningTeam: game.winningTeam,
    isHost,
    players: game.players.map((player) => {
      const revealRole =
        isHost || player.userId === requestingUserId || (game.status === "IN_PROGRESS" && player.role === "MAYOR");

      return {
        id: player.id,
        userId: player.userId,
        displayName: player.user.displayName,
        seatOrder: player.seatOrder,
        isAlive: player.isAlive,
        role: revealRole ? player.role : null,
        team: revealRole ? player.team : null,
      };
    }),
  };
}
