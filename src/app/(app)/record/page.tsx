import type { Metadata } from "next";
import { RecordView } from "@/components/app/RecordView";

export const metadata: Metadata = {
  title: "記録 | TAMERU",
};

export default function RecordPage() {
  return <RecordView />;
}
