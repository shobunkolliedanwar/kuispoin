import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { upsertGoogleUser } from '@/lib/user';

export const authOptions: NextAuthOptions = {
  providers: [GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  })],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, profile, account }) {
      if (profile?.sub && token.email) {
        token.googleId = profile.sub;
        const dbUser = await upsertGoogleUser({
          googleId: profile.sub,
          email: token.email,
          name: token.name,
          image: token.picture,
        });
        token.userId = dbUser.id;
        token.role = dbUser.role;
        token.status = dbUser.status;
      }
      // Token lama tetap menyimpan identity setelah callback OAuth pertama.
      if (account?.provider === 'google' && profile?.sub) token.googleId = profile.sub;
      if (!token.userId && typeof token.googleId === 'string' && token.email) {
        const dbUser = await upsertGoogleUser({ googleId: token.googleId, email: token.email, name: token.name, image: token.picture });
        token.userId = dbUser.id; token.role = dbUser.role; token.status = dbUser.status;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === 'string' ? token.userId : (token.sub ?? '');
        session.user.googleId = typeof token.googleId === 'string' ? token.googleId : '';
        session.user.role = token.role === 'ADMIN' ? 'ADMIN' : 'USER';
        session.user.status = typeof token.status === 'string' ? token.status : 'ACTIVE';
      }
      return session;
    },
  },
};
