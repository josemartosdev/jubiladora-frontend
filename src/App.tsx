import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { checkApiOnline } from "./api/client";
import { Layout } from "./components/Layout";
import { CalendarPage } from "./pages/CalendarPage";
import { ExplorePage } from "./pages/ExplorePage";
import { HomePage } from "./pages/HomePage";
import { MatchDetailPage } from "./pages/MatchDetailPage";
import { PredictionsPage } from "./pages/PredictionsPage";
import "./design-tokens.css";
import "./App.css";

export default function App() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const ok = await checkApiOnline();
      if (!cancelled) setOnline(ok);
    };
    poll();
    const id = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout online={online} />}>
          <Route index element={<HomePage />} />
          <Route path="calendario" element={<CalendarPage />} />
          <Route path="predicciones" element={<PredictionsPage />} />
          <Route path="explorar" element={<ExplorePage />} />
          <Route path="partido/:fixtureId" element={<MatchDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
