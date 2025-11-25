import { usePlaidLink } from "react-plaid-link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
}

export function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  // Get link token from backend
  const { isLoading: isCreatingToken } = trpc.plaid.createLinkToken.useQuery(undefined, {
    onSuccess: (data) => {
      setLinkToken(data.linkToken);
    },
    onError: (error) => {
      toast.error("Failed to initialize bank connection");
      console.error("Link token error:", error);
    },
  });

  // Exchange public token mutation
  const exchangeToken = trpc.plaid.exchangePublicToken.useMutation({
    onSuccess: () => {
      toast.success("Bank account connected successfully!");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("Failed to connect bank account");
      console.error("Exchange token error:", error);
    },
  });

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken, metadata) => {
      exchangeToken.mutate({
        publicToken,
        metadata: {
          institution: metadata.institution
            ? {
                name: metadata.institution.name,
                institution_id: metadata.institution.institution_id,
              }
            : undefined,
          accounts: metadata.accounts.map((acc) => ({
            id: acc.id,
            name: acc.name,
            mask: acc.mask,
            type: acc.type,
            subtype: acc.subtype,
          })),
        },
      });
    },
    onExit: (error, metadata) => {
      if (error) {
        console.error("Plaid Link error:", error, metadata);
      }
    },
  });

  return (
    <Button
      onClick={() => open()}
      disabled={!ready || isCreatingToken || exchangeToken.isPending}
      variant="outline"
    >
      {isCreatingToken ? "Initializing..." : exchangeToken.isPending ? "Connecting..." : "Connect Bank Account"}
    </Button>
  );
}
