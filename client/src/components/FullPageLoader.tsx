import { Loader2 } from "lucide-react";

export default function FullPageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 z-50">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
    </div>
  );
}
