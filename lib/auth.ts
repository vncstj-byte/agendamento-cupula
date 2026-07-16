import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Configuração do login do mentorado (Auth.js / NextAuth v5).
 *
 * O mentorado entra com a conta Google apenas para se identificar:
 * pegamos nome e e-mail para saber quem marcou e para convidá-lo
 * ao evento. Nenhuma permissão da agenda do mentorado é solicitada.
 *
 * O provedor Google lê automaticamente AUTH_GOOGLE_ID e AUTH_GOOGLE_SECRET
 * do ambiente (.env).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/agendar",
  },
  callbacks: {
    async session({ session }) {
      return session;
    },
  },
});
