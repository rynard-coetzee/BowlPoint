import { createBrowserRouter } from "react-router-dom";

import QuickScore from "./pages/QuickScore/QuickScore";
import QuickTournament from "./pages/QuickTournament/QuickTournament";
import TournamentList from "./pages/QuickTournament/TournamentList";

import AppLayout from "./layouts/AppLayout";

import Dashboard from "./pages/Dashboard/Dashboard";
import Competitions from "./pages/Competitions/Competitions";
import Clubs from "./pages/Clubs/Clubs";
import Players from "./pages/Players/Players";
import Teams from "./pages/Teams/Teams";
import Reports from "./pages/Reports/Reports";
import Settings from "./pages/Settings/Settings";

import SupabaseTest from "./pages/Settings/SupabaseTest";

import LiveTournament from "./pages/LiveTournament/LiveTournament";
import CompetitionLive from "./pages/Competitions/CompetitionLive";
import CompetitionWorkspace from "./pages/Competitions/CompetitionWorkspace";
import Login from "./pages/Auth/Login";
import ForgotPassword from "./pages/Auth/ForgotPassword";
import ResetPassword from "./pages/Auth/ResetPassword";
import Users from "./pages/Users/Users";
import ProtectedRoute from "./components/auth/ProtectedRoute";


const router = createBrowserRouter([

    /*
     * Public Live Tournament
     *
     * This deliberately sits outside AppLayout
     * so players don't see the BowlPoint sidebar.
     */
    {
        path: "/live/:publicCode",
        element: <LiveTournament />
    },

    /*
     * Public Live Competition
     *
     * Kept outside AppLayout so spectators get a clean
     * mobile-friendly results page without the admin sidebar.
     */
    {
        path: "/competition/live/:publicCode",
        element: <CompetitionLive />
    },


    { path: "/login", element: <Login /> },
    { path: "/forgot-password", element: <ForgotPassword /> },
    { path: "/reset-password", element: <ResetPassword /> },

    /*
     * Main BowlPoint application
     */
    {
        path: "/",
        element: <AppLayout />,

        children: [
            { element: <ProtectedRoute />, children: [

            {
                index: true,
                element: <Dashboard />
            },


            /*
             * Quick Score
             *
             * /quick-score
             *      = active/completed tournament list
             *
             * /quick-score/new
             *      = create a new Quick Score tournament
             *
             * /quick-score/:tournamentId
             *      = open an existing Quick Score tournament
             *
             * All authenticated roles can use Quick Score. Ownership
             * is enforced by the tournament service/database policies.
             */

            {
                path: "/quick-score",
                element: <TournamentList />
            },

            {
                path: "quick-score/new",
                element: <QuickTournament />
            },

            {
                path: "quick-score/:tournamentId",
                element: <QuickTournament />
            },

            /*
             * Legacy Quick Tournament URLs.
             * Keep these working for existing bookmarks/links, but make
             * them available to all authenticated Quick Score users.
             */
            {
                path: "quick-tournament",
                element: <TournamentList />
            },

            {
                path: "quick-tournament/new",
                element: <QuickTournament />
            },

            {
                path: "quick-tournament/:tournamentId",
                element: <QuickTournament />
            },

            {
                path: "competitions",
                element: <Competitions />
            },


            {
                path: "clubs",
                element: <ProtectedRoute roles={["admin", "comp_secretary"]} />,
                children: [{ index: true, element: <Clubs /> }]
            },


            /*
             * Competition Workspace
             *
             * /competitions/:competitionId = open an existing competition
             *
             * CompetitionWorkspace reads competitionId from useParams().
             */
            {
                path: "competitions/:competitionId",
                element: <CompetitionWorkspace />
            },


            {
                path: "players",
                element: <ProtectedRoute roles={["admin", "comp_secretary"]} />,
                children: [{ index: true, element: <Players /> }]
            },


            {
                path: "teams",
                element: <ProtectedRoute roles={["admin", "comp_secretary"]} />,
                children: [{ index: true, element: <Teams /> }]
            },


            {
                path: "reports",
                element: <Reports />
            },


            {
                path: "users",
                element: <ProtectedRoute roles={["admin", "comp_secretary"]} />,
                children: [{ index: true, element: <Users /> }]
            },


            {
                path: "settings",
                element: <ProtectedRoute roles={["admin", "comp_secretary"]} />,
                children: [{ index: true, element: <Settings /> }]
            },


            {
                path: "supabase-test",
                element: <SupabaseTest />
            }

            ] }
        ]

    }

]);


export default router;
