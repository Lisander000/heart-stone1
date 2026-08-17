import * as React from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * Eén modal, twee vormen.
 *
 * Op de desktop een gewone Dialog: gecentreerd, met een muis bedienbaar.
 * Op smalle schermen een bottom sheet die je kunt vastpakken en wegvegen —
 * daar is een gecentreerd venster met een klein kruisje het verkeerde model.
 *
 * De aanroepende code merkt het verschil niet: geef `open`, `onOpenChange`,
 * een `title` en je inhoud, en dit kiest de juiste vorm.
 */

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Toegankelijke én zichtbare titel. Elke modal heeft er een nodig. */
  title: React.ReactNode;
  children: React.ReactNode;
  /** Extra klassen voor het inhoudsvlak (bijv. een maximale breedte). */
  className?: string;
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-display text-lg">{title}</DrawerTitle>
          </DrawerHeader>
          <div className={cn("overflow-y-auto px-4 pb-6", className)}>{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-md", className)}>
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
