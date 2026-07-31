import { createBrowserRouter } from "react-router-dom";
import QuickScore from "./pages/QuickScore/QuickScore";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard/Dashboard";
import Competitions from "./pages/Competitions/Competitions";
import Players from "./pages/Players/Players";
import Teams from "./pages/Teams/Teams";
import Reports from "./pages/Reports/Reports";
import Settings from "./pages/Settings/Settings";

const router = createBrowserRouter([
    {
        path: "/",
        element: <AppLayout />,
        children: [
            {
                index: true,
                element: <Dashboard />
            },
            {
                path: "/quick-score",
                element: <QuickScore />
            },
            {
                path: "competitions",
                element: <Competitions />
            },
            {
                path: "players",
                element: <Players />
            },
            {
                path: "teams",
                element: <Teams />
            },
            {
                path: "reports",
                element: <Reports />
            },
            {
                path: "settings",
                element: <Settings />
            }
        ]
    }
]);

export default router;