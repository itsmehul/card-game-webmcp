import { DesktopOnly } from "@/components/desktop-only";
import { GameTable } from "@/components/game/game-table";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function GameSessionPage({ params }: Props) {
  const { id } = await params;
  return (
    <DesktopOnly>
      <GameTable routeSessionId={id} />
    </DesktopOnly>
  );
}
