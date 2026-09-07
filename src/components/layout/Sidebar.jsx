import "./Sidebar.css";
import navigation from "../../config/navigation";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function Sidebar() {
    const { profile, signOut } = useAuth();

    const canSee = (item) => {
        if (!item.roles) return true;
        return item.roles.includes(profile?.role);
    };

    return (
        <aside className="sidebar">

            <div className="sidebar-brand">

                <img
                    src="/bowlpoint-logo.png"
                    alt="BowlPoint"
                    className="sidebar-logo"
                />

            </div>

            <ul>

                {navigation.filter(canSee).map((item) => (

                    <li key={item.path}>

                        <NavLink
                            to={item.path}
                            className={({ isActive }) =>
                                isActive ? "active-link" : ""
                            }
                        >

                            <i className={`bi bi-${item.icon}`}></i>

                            <span>{item.title}</span>

                        </NavLink>

                    </li>

                ))}

            </ul>

            {profile && (
                <div className="sidebar-user">
                    <div className="sidebar-user-name">{profile.full_name || "BowlPoint User"}</div>
                    <div className="sidebar-user-role">{profile.role === "comp_secretary" ? "Comp Secretary" : profile.role === "admin" ? "Admin" : "User"}</div>
                    <button type="button" className="sidebar-signout" onClick={signOut}>Sign out</button>
                </div>
            )}

        </aside>
    );
}

export default Sidebar;