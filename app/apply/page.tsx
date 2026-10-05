import type { Metadata } from "next";
import { ApplyScreen } from "@/components/ApplyScreen";

// The link people share: shows as "Apply · OBC Networking" with this description in chats and search results.
export const metadata: Metadata = {
  title: "Apply",
  description: "Apply to join an OB Club event. Only five questions are required.",
  openGraph: {
    title: "Apply to join OB Club",
    description: "Apply to join an OB Club event. Only five questions are required.",
    url: "/apply/",
    siteName: "OBC Networking",
    type: "website",
  },
};

export default function ApplyPage() {
  return <ApplyScreen />;
}
