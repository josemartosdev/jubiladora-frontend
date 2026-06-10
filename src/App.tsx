import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { checkApiOnline } from "./api/client";
import { AppClockProvider } from "./context/AppClockContext";
import { BetSlipProvider } from "./context/BetSlipContext";
import { Layout } from "./components/Layout";
import { BettingPage } from "./pages/BettingPage";
import { CalendarPage } from "./pages/CalendarPage";
import { HomePage } from "./pages/HomePage";
import { MatchDetailPage } from "./pages/MatchDetailPage";
import { PredictionsPage } from "./pages/PredictionsPage";
import { ConfigPage } from "./pages/ConfigPage";
import { SimulationPage } from "./pages/SimulationPage";
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
    <AppClockProvider>
      <BetSlipProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout online={online} />}>
              <Route index element={<HomePage />} />
              <Route path="predicciones" element={<PredictionsPage />} />
              <Route path="simulacion" element={<SimulationPage />} />
              <Route path="apuestas" element={<BettingPage />} />
              <Route path="calendario" element={<CalendarPage />} />
              <Route path="configuracion" element={<ConfigPage />} />
              <Route path="partido/:fixtureId" element={<MatchDetailPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </BetSlipProvider>
    </AppClockProvider>
  );
}
