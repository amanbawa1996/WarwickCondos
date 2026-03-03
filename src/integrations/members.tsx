import React, { createContext, useContext, useEffect, useState } from "react";

type Role = "admin" | "resident" | null;

type MemberState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  userRole: Role;
  member: any | null;
  actions: {
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
  };
};

const MemberContext = createContext<MemberState>({
  isAuthenticated: false,
  isLoading: true,
  userRole: null,
  member: null,
  actions: {
    logout: async () => {},
    refresh: async () => {},
  },
});


export function MemberProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<MemberState, "actions">>({
    isAuthenticated: false,
    isLoading: true,
    userRole: null,
    member: null,
  });

  const refresh = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json();

      setState({
        isAuthenticated: !!data.loggedIn,
        isLoading: false,
        userRole: data.loggedIn ? data.role : null,
        // keep flexible: if /api/auth/me returns "member", use it; otherwise store whole payload
        member: data.member ?? (data.loggedIn ? data : null),
      });
    } catch {
      setState({ isAuthenticated: false, isLoading: false, userRole: null, member: null });
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      // wipe local state immediately
      setState({ isAuthenticated: false, isLoading: false, userRole: null, member: null });
      // redirect to login
      window.location.assign("/");
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MemberContext.Provider
      value={{
        ...state,
        actions: { logout, refresh },
      }}
    >
      {children}
    </MemberContext.Provider>
  );
}

export function useMember() {
  return useContext(MemberContext);
}