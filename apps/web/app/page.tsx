import { Chat } from "../components/chat";

export default function HomePage() {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const hasApiKey = apiKey.length > 0;

  return <Chat hasApiKey={hasApiKey} />;
}
