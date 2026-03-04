// // src/utils/authAdapter.ts
// type LoginResult = { ok: true } | { ok: false; message: string };

// const isLocalDev = import.meta.env.DEV;

// // Local dev: you already use this pattern
// function setLocalMockLogin(email: string, roleHint?: "admin" | "resident") {
//   localStorage.setItem("devModeRole", roleHint ?? "resident");
//   localStorage.setItem(
//     "mockMemberData",
//     JSON.stringify({ email, loggedIn: true, roleHint })
//   );
//   window.dispatchEvent(new CustomEvent("memberLogin", { detail: { email, roleHint } }));
// }

// export async function login(email: string, password: string): Promise<LoginResult> {
//   const e = email.trim().toLowerCase();

//   if (isLocalDev) {
//     // Local dev: accept any password for now
//     setLocalMockLogin(e);
//     return { ok: true };
//   }

//   // Production Wix:
   
//   const { authentication } = await import("wix-members-frontend");
//   try {
//     await authentication.login(e, password);
//     return { ok: true };
//   } catch (err: any) {
//     return { ok: false, message: err?.message ?? "Login failed" };
//   }
// }

// export async function registerResident(
//   email: string,
//   password: string,
//   profile: { firstName: string; lastName: string; phoneNumber?: string }
// ): Promise<LoginResult> {
//   const e = email.trim().toLowerCase();

//   if (isLocalDev) {
//     // Local dev: just pretend registered + logged in
//     setLocalMockLogin(e, "resident");
//     return { ok: true };
//   }

//   const { authentication } = await import("wix-members-frontend");
//   try {
//     await authentication.register(e, password, {
//       contactInfo: {
//         firstName: profile.firstName,
//         lastName: profile.lastName,
//         phones: profile.phoneNumber ? [profile.phoneNumber] : [],
//       },
//     });
//     return { ok: true };
//   } catch (err: any) {
//     return { ok: false, message: err?.message ?? "Registration failed" };
//   }
// }

// export async function sendResetPasswordEmail(email: string): Promise<LoginResult> {
//   const e = email.trim().toLowerCase();

//   if (isLocalDev) {
//     return { ok: true };
//   }

//   const { authentication } = await import(/* @vite-ignore */ "wix-members-frontend");
//   try {
//     await authentication.sendResetPasswordEmail(e);
//     return { ok: true };
//   } catch (err: any) {
//     return { ok: false, message: err?.message ?? "Reset failed" };
//   }
// }

// export async function logout(): Promise<void> {
//   if (isLocalDev) {
//     localStorage.removeItem("mockMemberData");
//     localStorage.removeItem("devModeRole");
//     window.dispatchEvent(new CustomEvent("memberLogout"));
//     return;
//   }
//   const { authentication } = await import("wix-members-frontend");
//   await authentication.logout();
// }
