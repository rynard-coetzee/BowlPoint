import "./Sidebar.css";
import navigation from "../../config/navigation";
import { NavLink } from "react-router-dom";

function Sidebar() {
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

                {navigation.map((item) => (

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

        </aside>
    );
}

export default Sidebar;