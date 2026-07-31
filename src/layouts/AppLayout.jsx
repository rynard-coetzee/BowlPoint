import { Outlet } from "react-router-dom";

import "./AppLayout.css";
import Sidebar from "../components/layout/Sidebar";

function AppLayout() {
    return (
        <div className="app-layout">

            <Sidebar />

            <main className="main-content">
                <Outlet />
            </main>

        </div>
    );
}

export default AppLayout;