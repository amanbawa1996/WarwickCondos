// src/lib/WixMembersFrontend.ts (or wherever it lives)

// async function getMembersFrontend() {
//   try {
//     const m = "wix-members-frontend"; // non-literal dynamic import key trick
//     const mod = await import(m as any);
//     return (mod as any).default ?? mod;
//   } catch {
//     const stub = (await import("src/dev-stubs/wix-members-frontend")).default;
//     return stub;
//   }
// }

// export async function getAuthentication() {
//   const members = await getMembersFrontend();
//   return members.authentication;
// }

