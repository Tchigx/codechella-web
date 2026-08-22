import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/sync",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { positions, since, hits, died } = await request.json();

    if (positions?.length) {
      await ctx.runMutation(api.game.writePositions, { positions });
    }

    if (hits > 0 || died) {
      await ctx.runMutation(api.round.report, { hits: hits ?? 0, died: !!died });
    }

    const round = await ctx.runQuery(api.round.current);

    if (since === null || since === undefined) {
      return Response.json({ commands: [], cursor: Date.now(), round });
    }

    const commands = await ctx.runQuery(api.game.commandsSince, { since });
    const cursor = commands.length
      ? Math.max(...commands.map((c) => c._creationTime))
      : since;

    return Response.json({ commands, cursor, round });
  }),
});

export default http;