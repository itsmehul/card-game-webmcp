import { DesktopOnly } from "@/components/desktop-only";
import { GameTable } from "@/components/game/game-table";

export default function Home() {
  return (
    <DesktopOnly>
      <GameTable />
    </DesktopOnly>
  );
}
