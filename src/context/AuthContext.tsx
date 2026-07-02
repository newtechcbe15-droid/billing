import React, { createContext, useContext } from "react";

export type UserRole = "Admin" | "Staff";

interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: any;
  session: any;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const contextValue: AuthContextType = {
    user: { id: "admin-bypass" },
    session: { access_token: "bypass" },
    profile: {
      id: "admin-bypass",
      full_name: "Admin",
      role: "Admin",
      is_active: true,
      created_at: new Date().toISOString()
    },
    loading: false,
    isAdmin: true,
    isStaff: true,
    refreshProfile: async () => {},
    signOut: async () => {},
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
};