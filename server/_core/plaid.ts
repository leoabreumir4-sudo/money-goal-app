import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { ENV } from "./env";

const configuration = new Configuration({
  basePath: PlaidEnvironments[ENV.plaidEnv as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": ENV.plaidClientId,
      "PLAID-SECRET": ENV.plaidSecret,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);
