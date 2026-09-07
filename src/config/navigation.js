const navigation = [

    {
        title: "Dashboard",
        path: "/",
        icon: "house-fill"
    },

    {
        title: "Quick Score",
        path: "/quick-score",
        icon: "diagram-3-fill"
    },

    {
        title: "Competitions",
        path: "/competitions",
        icon: "trophy-fill"
    },

    {
        title: "Clubs",
        roles: ["admin", "comp_secretary"],
        path: "/clubs",
        icon: "building-fill"
    },

    {
        title: "Players",
        roles: ["admin", "comp_secretary"],
        path: "/players",
        icon: "person-fill"
    },

    {
        title: "Reports",
        path: "/reports",
        icon: "bar-chart-fill"
    },

    {
        title: "Users",
        path: "/users",
        icon: "people-fill",
        roles: ["admin", "comp_secretary"]
    },

    {
        title: "Settings",
        roles: ["admin", "comp_secretary"],
        path: "/settings",
        icon: "gear-fill"
    }

];

export default navigation;