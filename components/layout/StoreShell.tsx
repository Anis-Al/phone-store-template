import type { ReactNode } from "react";
import { CartSheet } from "@/components/cart/CartSheet";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { WhatsAppFab } from "@/components/layout/WhatsAppFab";

/** Storefront chrome. The admin panel (app/admin) has its own shell. */
export function StoreShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
      <WhatsAppFab />
      <CartSheet />
    </>
  );
}
