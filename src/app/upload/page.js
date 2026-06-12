"use client";

import { useRouter } from "next/navigation";
import DeliveryFlow from "@/app/components/DeliveryFlow";

// Standalone page version of the delivery flow (the dashboard uses the modal).
export default function UploadPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-4xl">
      <DeliveryFlow onConfirmed={() => router.refresh()} onClose={() => router.push("/")} />
    </div>
  );
}
