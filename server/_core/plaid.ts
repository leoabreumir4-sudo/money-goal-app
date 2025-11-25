import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { ENV } from "./env";

// Map environment string to Plaid environment
const getPlaidEnvironment = (env: string) => {
  switch (env) {
    case "sandbox":
      return PlaidEnvironments.sandbox;
    case "development":
      return PlaidEnvironments.development;
    case "production":
      return PlaidEnvironments.production;
    default:
      return PlaidEnvironments.sandbox;
  }
};

const configuration = new Configuration({
  basePath: getPlaidEnvironment(ENV.plaidEnv),
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": ENV.plaidClientId,
      "PLAID-SECRET": ENV.plaidSecret,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);
