import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import WelcomePage from "./pages/WelcomePage.jsx";
import UploadPage from "./pages/UploadPage.jsx";
import IncompatiblePage from "./pages/IncompatiblePage.jsx";
import LoadingPage from "./pages/LoadingPage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";

/**
 * Flow:  /  ->  /upload  ->  /incompatible (back to /upload)
 *                        ->  /loading  ->  /results/:id  (back to /)
 * Separate: /history lists past submissions; each opens /results/:id.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/incompatible" element={<IncompatiblePage />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route path="/results/:id" element={<ResultsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
