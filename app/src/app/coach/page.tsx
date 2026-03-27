import { CHARACTER_LIST } from "@/lib/frame-data";
import ChatInterface from "@/components/ChatInterface";

export default function CoachPage() {
  return <ChatInterface characters={CHARACTER_LIST} />;
}
