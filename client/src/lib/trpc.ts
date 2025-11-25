import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>({
  // Adiciona o transformer SuperJSON para serialização/desserialização de dados
  // Isso corrige o erro "Unable to transform response from server"
  transformer: superjson,
});
