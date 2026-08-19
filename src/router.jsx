import { createBrowserRouter } from "react-router-dom";

import QuickTournament from "./pages/QuickTournament/QuickTournament";
import TournamentList from "./pages/QuickTournament/TournamentList";

import AppLayout from "./layouts/AppLayout";

import Dashboard from "./pages/Dashboard/Dashboard";
import Competitions from "./pages/Competitions/Competitions";
import Players from "./pages/Players/Players";
import Teams from "./pages/Teams/Teams";
import Reports from "./pages/Reports/Reports";
import Settings from "./pages/Settings/Settings";

import SupabaseTest from "./pages/Settings/SupabaseTest";

import LiveTournament from "./pages/LiveTournament/LiveTournament";


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
     * Main BowlPoint application
     */
    {
        path: "/",
        element: <AppLayout />,

        children: [

            {
                index: true,
                element: <Dashboard />
            },


            /*
             * Tournament Manager
             *
             * /quick-tournament
             *      = tournament list
             *
             * /quick-tournament/new
             *      = create a new tournament
             *
             * /quick-tournament/:tournamentId
             *      = open an existing tournament
             */

            {
                path: "quick-tournament",
                element: <TournamentList />
            },


            /*
             * IMPORTANT:
             *
             * Keep /new before :tournamentId so
             * "new" is not interpreted as a tournament ID.
             */
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
            },


            {
                path: "supabase-test",
                element: <SupabaseTest />
            }

        ]

    }

]);


export default router;